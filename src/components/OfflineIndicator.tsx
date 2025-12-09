import { Wifi, WifiOff, Cloud, Loader2 } from 'lucide-react';
import { useOfflineSyncContext } from '@/hooks/useOfflineSync';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function OfflineIndicator() {
  const { isOnline, isSyncing, pendingCount, lastSync, nextSync, forceSync } = useOfflineSyncContext();

  const formatTime = (date: Date | null) => {
    if (!date) return '--:--';
    return format(date, 'HH:mm', { locale: ptBR });
  };

  const formatDateTime = (date: Date | null) => {
    if (!date) return 'Nunca';
    return format(date, "dd/MM 'às' HH:mm", { locale: ptBR });
  };

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isOnline ? "outline" : "secondary"}
            size="sm"
            className={`gap-2 shadow-lg ${!isOnline ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-700 dark:text-yellow-400' : ''}`}
            onClick={() => isOnline && forceSync()}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Sincronizando...</span>
              </>
            ) : isOnline ? (
              <>
                <Cloud className="h-4 w-4 text-green-500" />
                {pendingCount > 0 && (
                  <span className="text-xs bg-primary/10 px-1.5 py-0.5 rounded-full">
                    {pendingCount}
                  </span>
                )}
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4" />
                <span className="text-xs">Offline</span>
                {pendingCount > 0 && (
                  <span className="text-xs bg-yellow-500/30 px-1.5 py-0.5 rounded-full">
                    {pendingCount}
                  </span>
                )}
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[250px]">
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="h-3 w-3 text-green-500" />
              ) : (
                <WifiOff className="h-3 w-3 text-yellow-500" />
              )}
              <span>{isOnline ? 'Conectado' : 'Offline'}</span>
            </div>
            
            {pendingCount > 0 && (
              <div className="text-muted-foreground">
                {pendingCount} alteração(ões) pendente(s)
              </div>
            )}
            
            <div className="text-muted-foreground pt-1 border-t border-border">
              <div>Última sync: {formatDateTime(lastSync)}</div>
              <div>Próxima sync: {formatTime(nextSync)}</div>
            </div>
            
            {isOnline && (
              <div className="text-primary pt-1">
                Clique para sincronizar agora
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
