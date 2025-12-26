import { useState } from 'react';
import { Bell, BellOff, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useNotificationBadge } from '@/hooks/useNotificationBadge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function PushNotificationToggle() {
  const { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe } = usePushNotifications();
  const { count, expiringToday, expiringTomorrow, expiringIn3Days, totalAmount, isLoading: badgeLoading } = useNotificationBadge();
  const navigate = useNavigate();
  const [isTesting, setIsTesting] = useState(false);

  const handleEnableNotifications = async () => {
    await subscribe();
  };

  const handleTestNotification = async () => {
    setIsTesting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Você precisa estar logado');
        return;
      }

      const { data, error } = await supabase.functions.invoke('test-push-notification', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        console.error('Test push error:', error);
        toast.error(data?.error || 'Erro ao enviar notificação de teste');
        return;
      }

      toast.success('Notificação de teste enviada!');
    } catch (err) {
      console.error('Test push error:', err);
      toast.error('Erro ao enviar notificação de teste');
    } finally {
      setIsTesting(false);
    }
  };

  if (!isSupported) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" disabled className="opacity-50">
            <BellOff className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Notificações não suportadas neste navegador</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (permission === 'denied') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" disabled className="opacity-50">
            <BellOff className="h-5 w-5 text-destructive" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Notificações bloqueadas. Habilite nas configurações do navegador.</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // If not subscribed, show a prominent enable button
  if (!isSubscribed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleEnableNotifications}
            disabled={isLoading}
            className="gap-2 border-primary/50 hover:bg-primary/10"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <BellOff className="h-4 w-4" />
                <span className="hidden sm:inline">Ativar Alertas</span>
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Receba alertas de vencimento no navegador</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Subscribed - show popover with notification details
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Bell className="h-5 w-5 text-primary" />
              {count > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-5 min-w-[20px] flex items-center justify-center text-xs px-1.5 animate-pulse"
                >
                  {count > 99 ? '99+' : count}
                </Badge>
              )}
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Alertas de Vencimento</h4>
            <div className="flex gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleTestNotification}
                    disabled={isTesting}
                  >
                    {isTesting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Enviar notificação de teste</p>
                </TooltipContent>
              </Tooltip>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => unsubscribe()}
                className="text-xs text-muted-foreground"
              >
                Desativar
              </Button>
            </div>
          </div>
          {count > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {count} cliente{count > 1 ? 's' : ''} vencendo • R$ {totalAmount.toFixed(2).replace('.', ',')}
            </p>
          )}
        </div>
        
        <ScrollArea className="max-h-64">
          {count === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum vencimento próximo</p>
            </div>
          ) : (
            <div className="p-2">
              {expiringToday.length > 0 && (
                <>
                  <div className="px-2 py-1.5">
                    <Badge variant="destructive" className="text-xs">
                      🔴 Vence Hoje ({expiringToday.length})
                    </Badge>
                  </div>
                  {expiringToday.map(client => (
                    <NotificationItem 
                      key={client.id} 
                      client={client} 
                      onClick={() => navigate('/clients')} 
                    />
                  ))}
                  <Separator className="my-2" />
                </>
              )}
              
              {expiringTomorrow.length > 0 && (
                <>
                  <div className="px-2 py-1.5">
                    <Badge variant="outline" className="text-xs border-orange-500 text-orange-500">
                      🟠 Vence Amanhã ({expiringTomorrow.length})
                    </Badge>
                  </div>
                  {expiringTomorrow.map(client => (
                    <NotificationItem 
                      key={client.id} 
                      client={client} 
                      onClick={() => navigate('/clients')} 
                    />
                  ))}
                  <Separator className="my-2" />
                </>
              )}
              
              {expiringIn3Days.length > 0 && (
                <>
                  <div className="px-2 py-1.5">
                    <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-500">
                      ⚠️ Próximos 3 dias ({expiringIn3Days.length})
                    </Badge>
                  </div>
                  {expiringIn3Days.map(client => (
                    <NotificationItem 
                      key={client.id} 
                      client={client} 
                      onClick={() => navigate('/clients')} 
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </ScrollArea>
        
        <div className="p-2 border-t">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={() => navigate('/clients')}
          >
            Ver Todos os Clientes
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface NotificationItemProps {
  client: {
    id: string;
    name: string;
    phone: string | null;
    plan_price: number | null;
    daysRemaining: number;
    urgency: 'critical' | 'high' | 'medium' | 'low';
  };
  onClick: () => void;
}

function NotificationItem({ client, onClick }: NotificationItemProps) {
  const openWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!client.phone) return;
    
    const phone = client.phone.replace(/\D/g, '');
    const message = client.daysRemaining <= 0 
      ? `Olá ${client.name}! Sua assinatura venceu hoje. Entre em contato para renovar!`
      : `Olá ${client.name}! Sua assinatura vence em ${client.daysRemaining} dia${client.daysRemaining > 1 ? 's' : ''}. Renove agora!`;
    
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div 
      className={cn(
        "px-2 py-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors",
        client.urgency === 'critical' && "bg-destructive/10"
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{client.name}</p>
          <p className="text-xs text-muted-foreground">
            {client.plan_price 
              ? `R$ ${client.plan_price.toFixed(2).replace('.', ',')}`
              : 'Sem valor definido'
            }
          </p>
        </div>
        {client.phone && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 shrink-0"
            onClick={openWhatsApp}
          >
            <svg className="h-4 w-4 text-green-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </Button>
        )}
      </div>
    </div>
  );
}
