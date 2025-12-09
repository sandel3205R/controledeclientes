import { useEffect, useState } from 'react';
import { APP_VERSION, CHANGELOG } from '@/config/version';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Info, CheckCircle2, RefreshCw, Download } from 'lucide-react';
import { usePWAUpdate } from '@/hooks/usePWAUpdate';

const VERSION_KEY = 'app_last_version';
const VERSION_SEEN_KEY = 'app_version_seen';

export function VersionNotification() {
  const [showChangelog, setShowChangelog] = useState(false);
  const [isNewVersion, setIsNewVersion] = useState(false);
  const { needRefresh, offlineReady, update, close } = usePWAUpdate();

  // Show toast when new PWA version is available
  useEffect(() => {
    if (needRefresh) {
      toast.info(
        <div className="flex flex-col gap-2">
          <span className="font-semibold flex items-center gap-2">
            <Download className="w-4 h-4" />
            Nova versão disponível!
          </span>
          <span className="text-xs text-muted-foreground">
            Clique no botão de versão para atualizar
          </span>
        </div>,
        {
          duration: 10000,
        }
      );
    }
  }, [needRefresh]);

  // Show toast when offline ready
  useEffect(() => {
    if (offlineReady) {
      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-semibold">App pronto para uso offline!</span>
          <span className="text-xs text-muted-foreground">
            Você pode usar o app mesmo sem internet
          </span>
        </div>,
        {
          duration: 5000,
        }
      );
      close();
    }
  }, [offlineReady, close]);

  useEffect(() => {
    const lastVersion = localStorage.getItem(VERSION_KEY);

    if (lastVersion && lastVersion !== APP_VERSION) {
      // App was updated
      setIsNewVersion(true);
      
      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            App atualizado para v{APP_VERSION}
          </span>
          <span className="text-xs text-muted-foreground">
            Clique no ícone de versão para ver as novidades
          </span>
        </div>,
        {
          duration: 8000,
        }
      );
    } else if (!lastVersion) {
      // First time user
      localStorage.setItem(VERSION_KEY, APP_VERSION);
    }

    // Update stored version
    localStorage.setItem(VERSION_KEY, APP_VERSION);
  }, []);

  const markAsSeen = () => {
    localStorage.setItem(VERSION_SEEN_KEY, APP_VERSION);
    setIsNewVersion(false);
  };

  const latestChangelog = CHANGELOG[0];

  return (
    <Dialog open={showChangelog} onOpenChange={setShowChangelog}>
      {needRefresh ? (
        <Button
          variant="default"
          size="sm"
          className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 text-xs animate-pulse"
          onClick={() => update()}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Atualizar App
        </Button>
      ) : (
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 text-xs bg-background/80 backdrop-blur-sm border border-border/50 hover:bg-background"
            onClick={() => {
              setShowChangelog(true);
              markAsSeen();
            }}
          >
            {isNewVersion && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full animate-pulse" />
            )}
            <Info className="w-3.5 h-3.5" />
            v{APP_VERSION}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Versão {APP_VERSION}
          </DialogTitle>
          <DialogDescription>
            Veja as últimas atualizações do aplicativo
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {CHANGELOG.map((release) => (
              <div key={release.version} className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant={release.version === APP_VERSION ? 'default' : 'secondary'}>
                    v{release.version}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{release.date}</span>
                </div>
                <ul className="space-y-2">
                  {release.changes.map((change, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Última atualização: {latestChangelog.date}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
