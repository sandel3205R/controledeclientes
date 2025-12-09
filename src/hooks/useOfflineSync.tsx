import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PendingAction {
  id: string;
  table: string;
  action: 'insert' | 'update' | 'delete';
  data: Record<string, unknown>;
  timestamp: number;
}

interface OfflineSyncOptions {
  onSyncComplete?: () => void;
  onSyncError?: (error: Error) => void;
}

const PENDING_ACTIONS_KEY = 'offline_pending_actions';
const OFFLINE_DATA_PREFIX = 'offline_data_';

export function useOfflineSync(options: OfflineSyncOptions = {}) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const syncInProgress = useRef(false);

  // Load pending actions count
  useEffect(() => {
    const actions = getPendingActions();
    setPendingCount(actions.length);
  }, []);

  // Online/Offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Conexão restaurada! Sincronizando dados...');
      syncPendingActions();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Você está offline. As alterações serão salvas localmente.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Get pending actions from localStorage
  const getPendingActions = useCallback((): PendingAction[] => {
    try {
      const stored = localStorage.getItem(PENDING_ACTIONS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }, []);

  // Save pending actions to localStorage
  const savePendingActions = useCallback((actions: PendingAction[]) => {
    localStorage.setItem(PENDING_ACTIONS_KEY, JSON.stringify(actions));
    setPendingCount(actions.length);
  }, []);

  // Add a pending action
  const addPendingAction = useCallback((
    table: string,
    action: 'insert' | 'update' | 'delete',
    data: Record<string, unknown>
  ) => {
    const actions = getPendingActions();
    const newAction: PendingAction = {
      id: crypto.randomUUID(),
      table,
      action,
      data,
      timestamp: Date.now(),
    };
    actions.push(newAction);
    savePendingActions(actions);
    return newAction.id;
  }, [getPendingActions, savePendingActions]);

  // Remove a pending action
  const removePendingAction = useCallback((id: string) => {
    const actions = getPendingActions();
    const filtered = actions.filter(a => a.id !== id);
    savePendingActions(filtered);
  }, [getPendingActions, savePendingActions]);

  // Sync all pending actions
  const syncPendingActions = useCallback(async () => {
    if (syncInProgress.current || !navigator.onLine) return;
    
    const actions = getPendingActions();
    if (actions.length === 0) return;

    syncInProgress.current = true;
    setIsSyncing(true);

    let successCount = 0;
    let errorCount = 0;

    // Sort by timestamp to maintain order
    const sortedActions = [...actions].sort((a, b) => a.timestamp - b.timestamp);

    for (const action of sortedActions) {
      try {
        let result;
        
        // Use dynamic table access - type safety is handled at runtime
        const tableRef = supabase.from(action.table as 'clients');
        
        switch (action.action) {
          case 'insert': {
            // @ts-expect-error - dynamic table access
            const { error } = await tableRef.insert(action.data);
            result = { error };
            break;
          }
          case 'update': {
            const { id: updateId, ...updateData } = action.data;
            // @ts-expect-error - dynamic table access
            const { error } = await tableRef.update(updateData).eq('id', updateId);
            result = { error };
            break;
          }
          case 'delete': {
            // @ts-expect-error - dynamic table access  
            const { error } = await tableRef.delete().eq('id', action.data.id);
            result = { error };
            break;
          }
        }

        if (result?.error) {
          console.error('Sync error:', result.error);
          errorCount++;
        } else {
          removePendingAction(action.id);
          successCount++;
        }
      } catch (error) {
        console.error('Sync action error:', error);
        errorCount++;
      }
    }

    setIsSyncing(false);
    syncInProgress.current = false;

    if (successCount > 0) {
      toast.success(`${successCount} alteração(ões) sincronizada(s) com sucesso!`);
      options.onSyncComplete?.();
    }
    
    if (errorCount > 0) {
      toast.error(`${errorCount} alteração(ões) não puderam ser sincronizadas`);
      options.onSyncError?.(new Error(`${errorCount} sync errors`));
    }
  }, [getPendingActions, removePendingAction, options]);

  // Save data to offline cache
  const saveOfflineData = useCallback((key: string, data: unknown) => {
    try {
      localStorage.setItem(`${OFFLINE_DATA_PREFIX}${key}`, JSON.stringify({
        data,
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.error('Error saving offline data:', error);
    }
  }, []);

  // Get data from offline cache
  const getOfflineData = useCallback(<T,>(key: string): T | null => {
    try {
      const stored = localStorage.getItem(`${OFFLINE_DATA_PREFIX}${key}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.data as T;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  // Execute action with offline support
  const executeWithOfflineSupport = useCallback(async <T,>(
    table: string,
    action: 'insert' | 'update' | 'delete',
    data: Record<string, unknown>,
    onlineAction: () => Promise<{ data: T | null; error: unknown }>
  ): Promise<{ data: T | null; error: unknown; isOffline: boolean }> => {
    if (navigator.onLine) {
      const result = await onlineAction();
      return { ...result, isOffline: false };
    } else {
      // Save to pending actions
      addPendingAction(table, action, data);
      return { data: data as T, error: null, isOffline: true };
    }
  }, [addPendingAction]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    addPendingAction,
    syncPendingActions,
    saveOfflineData,
    getOfflineData,
    executeWithOfflineSupport,
  };
}

// Context for global offline sync state
import { createContext, useContext, ReactNode } from 'react';

interface OfflineSyncContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  syncPendingActions: () => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextType | null>(null);

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const offlineSync = useOfflineSync();

  return (
    <OfflineSyncContext.Provider value={{
      isOnline: offlineSync.isOnline,
      isSyncing: offlineSync.isSyncing,
      pendingCount: offlineSync.pendingCount,
      syncPendingActions: offlineSync.syncPendingActions,
    }}>
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSyncContext() {
  const context = useContext(OfflineSyncContext);
  if (!context) {
    throw new Error('useOfflineSyncContext must be used within OfflineSyncProvider');
  }
  return context;
}
