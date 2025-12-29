import { useState, useEffect } from 'react';
import { useAdminMessages } from '@/hooks/useAdminMessages';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { X, Megaphone, AlertTriangle, Info, AlertCircle, Bell, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PRIORITY_CONFIG = {
  low: { icon: Info, bgClass: 'bg-muted/50 border-muted-foreground/20', textClass: 'text-muted-foreground' },
  normal: { icon: Bell, bgClass: 'bg-blue-500/10 border-blue-500/30', textClass: 'text-blue-600 dark:text-blue-400' },
  high: { icon: AlertCircle, bgClass: 'bg-yellow-500/10 border-yellow-500/30', textClass: 'text-yellow-600 dark:text-yellow-500' },
  urgent: { icon: AlertTriangle, bgClass: 'bg-destructive/10 border-destructive/30', textClass: 'text-destructive' },
};

const DISMISSED_KEY = 'admin_messages_dismissed';

export default function AdminMessagesBanner() {
  const { activeMessages, loading, isAdmin } = useAdminMessages();
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);

  // Load dismissed messages from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(DISMISSED_KEY);
    if (stored) {
      try {
        setDismissedIds(JSON.parse(stored));
      } catch {
        setDismissedIds([]);
      }
    }
  }, []);

  // Don't show for admins (they have the manager panel)
  if (isAdmin || loading) return null;

  // Filter out dismissed messages
  const visibleMessages = activeMessages.filter(msg => !dismissedIds.includes(msg.id));

  if (visibleMessages.length === 0) return null;

  const handleDismiss = (id: string) => {
    const newDismissed = [...dismissedIds, id];
    setDismissedIds(newDismissed);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(newDismissed));
  };

  // Show only the most important message when collapsed
  const sortedMessages = [...visibleMessages].sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
    return (priorityOrder[a.priority as keyof typeof priorityOrder] || 2) - 
           (priorityOrder[b.priority as keyof typeof priorityOrder] || 2);
  });

  const displayMessages = expanded ? sortedMessages : [sortedMessages[0]];

  return (
    <div className="space-y-2 mb-4">
      {displayMessages.map((msg) => {
        const config = PRIORITY_CONFIG[msg.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.normal;
        const Icon = config.icon;

        return (
          <Alert key={msg.id} className={cn("relative pr-10", config.bgClass)}>
            <Icon className={cn("h-4 w-4", config.textClass)} />
            <AlertTitle className={cn("font-semibold flex items-center gap-2", config.textClass)}>
              {msg.title}
              <span className="text-xs font-normal text-muted-foreground">
                {format(new Date(msg.created_at), "dd/MM", { locale: ptBR })}
              </span>
            </AlertTitle>
            <AlertDescription className="text-sm mt-1">
              {msg.message}
            </AlertDescription>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-6 w-6 opacity-60 hover:opacity-100"
              onClick={() => handleDismiss(msg.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </Alert>
        );
      })}

      {/* Show more/less toggle */}
      {sortedMessages.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3 mr-1" />
              Mostrar menos
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3 mr-1" />
              Ver mais {sortedMessages.length - 1} mensagem(ns)
            </>
          )}
        </Button>
      )}
    </div>
  );
}
