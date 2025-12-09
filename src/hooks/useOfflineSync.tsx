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

interface LocalData {
  clients: Record<string, unknown>[];
  servers: Record<string, unknown>[];
  plans: Record<string, unknown>[];
  templates: Record<string, unknown>[];
}

const PENDING_ACTIONS_KEY = 'offline_pending_actions';
const LOCAL_DATA_KEY = 'offline_local_data';
const LAST_SYNC_KEY = 'offline_last_sync';

// Default sync times: 8:00, 14:00, 20:00
const DEFAULT_SYNC_HOURS = [8, 14, 20];

// Helper functions outside component
const getPendingActionsFromStorage = (): PendingAction[] => {
  try {
    const stored = localStorage.getItem(PENDING_ACTIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const getLocalDataFromStorage = (): LocalData => {
  try {
    const stored = localStorage.getItem(LOCAL_DATA_KEY);
    return stored ? JSON.parse(stored) : { clients: [], servers: [], plans: [], templates: [] };
  } catch {
    return { clients: [], servers: [], plans: [], templates: [] };
  }
};

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [nextSync, setNextSync] = useState<Date | null>(null);
  const syncInProgress = useRef(false);

  // Calculate next sync time
  const calculateNextSync = useCallback(() => {
    const now = new Date();
    const currentHour = now.getHours();
    
    let nextSyncHour = DEFAULT_SYNC_HOURS.find(h => h > currentHour);
    const nextSyncDate = new Date(now);
    
    if (!nextSyncHour) {
      nextSyncHour = DEFAULT_SYNC_HOURS[0];
      nextSyncDate.setDate(nextSyncDate.getDate() + 1);
    }
    
    nextSyncDate.setHours(nextSyncHour, 0, 0, 0);
    setNextSync(nextSyncDate);
    return nextSyncDate;
  }, []);

  // Save pending actions to localStorage
  const savePendingActions = useCallback((actions: PendingAction[]) => {
    localStorage.setItem(PENDING_ACTIONS_KEY, JSON.stringify(actions));
    setPendingCount(actions.length);
  }, []);

  // Save local data
  const saveLocalData = useCallback((data: Partial<LocalData>) => {
    const current = getLocalDataFromStorage();
    const updated = { ...current, ...data };
    localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(updated));
  }, []);

  // Sync all pending actions to database
  const syncPendingActions = useCallback(async () => {
    if (syncInProgress.current || !navigator.onLine) return;
    
    const actions = getPendingActionsFromStorage();
    if (actions.length === 0) {
      const now = new Date();
      localStorage.setItem(LAST_SYNC_KEY, now.toISOString());
      setLastSync(now);
      calculateNextSync();
      return;
    }

    syncInProgress.current = true;
    setIsSyncing(true);
    
    toast.info(`Sincronizando ${actions.length} alteração(ões)...`);

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
          const remaining = getPendingActionsFromStorage().filter(a => a.id !== action.id);
          savePendingActions(remaining);
          successCount++;
        }
      } catch (error) {
        console.error('Sync action error:', error);
        errorCount++;
      }
    }

    const now = new Date();
    localStorage.setItem(LAST_SYNC_KEY, now.toISOString());
    setLastSync(now);
    calculateNextSync();

    setIsSyncing(false);
    syncInProgress.current = false;

    if (successCount > 0) {
      toast.success(`${successCount} alteração(ões) sincronizada(s)!`);
    }
    
    if (errorCount > 0) {
      toast.error(`${errorCount} alteração(ões) com erro.`);
    }
  }, [calculateNextSync, savePendingActions]);

  // Update local data cache when offline changes happen
  const updateLocalDataCache = useCallback((
    table: string,
    action: 'insert' | 'update' | 'delete',
    data: Record<string, unknown>
  ) => {
    const localData = getLocalDataFromStorage();
    const tableKey = table as keyof LocalData;
    
    if (!localData[tableKey]) {
      localData[tableKey] = [];
    }
    
    switch (action) {
      case 'insert':
        localData[tableKey].push(data);
        break;
      case 'update':
        const updateIndex = localData[tableKey].findIndex((item: Record<string, unknown>) => item.id === data.id);
        if (updateIndex >= 0) {
          localData[tableKey][updateIndex] = { ...localData[tableKey][updateIndex], ...data };
        }
        break;
      case 'delete':
        localData[tableKey] = localData[tableKey].filter((item: Record<string, unknown>) => item.id !== data.id);
        break;
    }
    
    saveLocalData(localData);
  }, [saveLocalData]);

  // Add a pending action (offline write)
  const addPendingAction = useCallback((
    table: string,
    action: 'insert' | 'update' | 'delete',
    data: Record<string, unknown>
  ) => {
    const actions = getPendingActionsFromStorage();
    
    const filteredActions = actions.filter(a => 
      !(a.table === table && a.data.id === data.id)
    );
    
    const newAction: PendingAction = {
      id: crypto.randomUUID(),
      table,
      action,
      data,
      timestamp: Date.now(),
    };
    
    filteredActions.push(newAction);
    savePendingActions(filteredActions);
    updateLocalDataCache(table, action, data);
    
    return newAction.id;
  }, [savePendingActions, updateLocalDataCache]);

  // Force manual sync
  const forceSync = useCallback(async () => {
    if (!navigator.onLine) {
      toast.error('Sem conexão. Conecte-se à internet para sincronizar.');
      return;
    }
    await syncPendingActions();
  }, [syncPendingActions]);

  // Cache data locally
  const cacheData = useCallback((table: string, data: Record<string, unknown>[]) => {
    const localData = getLocalDataFromStorage();
    const tableKey = table as keyof LocalData;
    localData[tableKey] = data;
    saveLocalData(localData);
  }, [saveLocalData]);

  // Get cached data
  const getCachedData = useCallback((table: string): Record<string, unknown>[] => {
    const localData = getLocalDataFromStorage();
    const tableKey = table as keyof LocalData;
    return localData[tableKey] || [];
  }, []);

  // Execute with offline-first approach
  const executeOfflineFirst = useCallback(async <T,>(
    table: string,
    action: 'insert' | 'update' | 'delete',
    data: Record<string, unknown>
  ): Promise<{ success: boolean; isOffline: boolean }> => {
    addPendingAction(table, action, data);
    return { success: true, isOffline: !navigator.onLine };
  }, [addPendingAction]);

  // Initialize on mount
  useEffect(() => {
    const actions = getPendingActionsFromStorage();
    setPendingCount(actions.length);
    
    const storedLastSync = localStorage.getItem(LAST_SYNC_KEY);
    if (storedLastSync) {
      setLastSync(new Date(storedLastSync));
    }
    
    calculateNextSync();

    // Sync scheduler - check every minute
    const interval = setInterval(() => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      if (DEFAULT_SYNC_HOURS.includes(currentHour) && currentMinute === 0) {
        if (navigator.onLine && !syncInProgress.current) {
          syncPendingActions();
        }
      }
      
      calculateNextSync();
    }, 60000);

    return () => clearInterval(interval);
  }, [calculateNextSync, syncPendingActions]);

  // Online/Offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Conexão restaurada!');
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.info('Modo offline ativado.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSync,
    nextSync,
    addPendingAction,
    syncPendingActions,
    forceSync,
    cacheData,
    getCachedData,
    executeOfflineFirst,
  };
}

// Context for global offline sync state
interface OfflineSyncContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSync: Date | null;
  nextSync: Date | null;
  syncPendingActions: () => Promise<void>;
  forceSync: () => Promise<void>;
  addPendingAction: (table: string, action: 'insert' | 'update' | 'delete', data: Record<string, unknown>) => string;
  cacheData: (table: string, data: Record<string, unknown>[]) => void;
  getCachedData: (table: string) => Record<string, unknown>[];
  executeOfflineFirst: <T>(table: string, action: 'insert' | 'update' | 'delete', data: Record<string, unknown>) => Promise<{ success: boolean; isOffline: boolean }>;
}

const OfflineSyncContext = createContext<OfflineSyncContextType | null>(null);

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const offlineSync = useOfflineSync();

  return (
    <OfflineSyncContext.Provider value={{
      isOnline: offlineSync.isOnline,
      isSyncing: offlineSync.isSyncing,
      pendingCount: offlineSync.pendingCount,
      lastSync: offlineSync.lastSync,
      nextSync: offlineSync.nextSync,
      syncPendingActions: offlineSync.syncPendingActions,
      forceSync: offlineSync.forceSync,
      addPendingAction: offlineSync.addPendingAction,
      cacheData: offlineSync.cacheData,
      getCachedData: offlineSync.getCachedData,
      executeOfflineFirst: offlineSync.executeOfflineFirst,
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
