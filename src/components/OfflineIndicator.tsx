import { Wifi, WifiOff, RefreshCw, Cloud } from 'lucide-react';
import { useOfflineSyncContext } from '@/hooks/useOfflineSync';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function OfflineIndicator() {
  const { isOnline, isSyncing, pendingCount, syncPendingActions } = useOfflineSyncContext();

  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2">
      {!isOnline && (
        <Badge 
          variant="destructive" 
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs animate-pulse"
        >
          <WifiOff className="w-3.5 h-3.5" />
          Offline
        </Badge>
      )}
      
      {isOnline && pendingCount > 0 && !isSyncing && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => syncPendingActions()}
          className="flex items-center gap-1.5 bg-yellow-500/10 border-yellow-500/30 text-yellow-600 hover:bg-yellow-500/20"
        >
          <Cloud className="w-3.5 h-3.5" />
          {pendingCount} pendente(s)
        </Button>
      )}

      {isSyncing && (
        <Badge 
          variant="secondary" 
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary/10 border-primary/30"
        >
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          Sincronizando...
        </Badge>
      )}
    </div>
  );
}
