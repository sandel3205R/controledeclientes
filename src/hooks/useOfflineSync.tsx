import { useState, useEffect, useCallback, useRef, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PendingAction {
  id: string;
  table: string;
  action: 'insert' | 'update' | 'delete';
  data: Record<string, unknown>;
  timestamp: number;
}

const PENDING_ACTIONS_KEY = 'offline_pending_actions';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const syncInProgress = useRef(false);

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

    const sortedActions = [...actions].sort((a, b) => a.timestamp - b.timestamp);

    for (const action of sortedActions) {
      try {
        let result;
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
      toast.success(`${successCount} alteração(ões) sincronizada(s)!`);
    }
    
    if (errorCount > 0) {
      toast.error(`${errorCount} alteração(ões) com erro`);
    }
  }, [getPendingActions, removePendingAction]);

  // Load pending actions count on mount
  useEffect(() => {
    const actions = getPendingActions();
    setPendingCount(actions.length);
  }, [getPendingActions]);

  // Online/Offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Conexão restaurada!');
      syncPendingActions();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Você está offline.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncPendingActions]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    addPendingAction,
    syncPendingActions,
  };
}

// Context
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
