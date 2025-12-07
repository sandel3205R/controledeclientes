import { format, differenceInDays, isPast, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Phone, Edit, Trash2, MessageCircle, PartyPopper, Calendar, Monitor, 
  User, Lock, Eye, EyeOff, RefreshCw, Bell, CheckCircle, Smartphone, 
  Server, Wifi, Copy, MoreHorizontal 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ClientCardProps {
  client: {
    id: string;
    name: string;
    phone: string | null;
    device: string | null;
    login: string | null;
    password: string | null;
    expiration_date: string;
    plan_name: string | null;
    plan_price: number | null;
    app_name: string | null;
    mac_address: string | null;
    server_name: string | null;
  };
  onEdit: () => void;
  onDelete: () => void;
  onRenew?: (clientId: string, newExpirationDate: string) => void;
}

interface WhatsAppTemplate {
  id: string;
  type: string;
  message: string;
  is_default: boolean;
}

export default function ClientCard({ client, onEdit, onDelete, onRenew }: ClientCardProps) {
  const { user } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  
  const expirationDate = new Date(client.expiration_date);
  const daysUntilExpiration = differenceInDays(expirationDate, new Date());
  const isExpired = isPast(expirationDate);
  const isExpiring = !isExpired && daysUntilExpiration <= 7;

  useEffect(() => {
    if (user) {
      supabase
        .from('whatsapp_templates')
        .select('id, type, message, is_default')
        .eq('seller_id', user.id)
        .eq('is_default', true)
        .then(({ data }) => {
          if (data) setTemplates(data as WhatsAppTemplate[]);
        });
    }
  }, [user]);

  const getStatus = () => {
    if (isExpired) return { label: 'Vencido', class: 'status-expired', icon: '🔴' };
    if (isExpiring) return { label: `${daysUntilExpiration}d`, class: 'status-expiring', icon: '🟡' };
    return { label: 'Ativo', class: 'status-active', icon: '🟢' };
  };

  const status = getStatus();

  const formatPhone = (phone: string) => {
    return phone.replace(/\D/g, '');
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const replaceVariables = (message: string) => {
    return message
      .replace(/{nome}/g, client.name)
      .replace(/{plano}/g, client.plan_name || 'seu plano')
      .replace(/{vencimento}/g, format(expirationDate, "dd 'de' MMMM", { locale: ptBR }))
      .replace(/{dispositivo}/g, client.device || 'N/A')
      .replace(/{usuario}/g, client.login || 'N/A')
      .replace(/{senha}/g, client.password || 'N/A')
      .replace(/{preco}/g, client.plan_price ? `R$ ${client.plan_price.toFixed(2)}` : 'N/A');
  };

  const sendWhatsApp = (type: 'billing' | 'welcome' | 'renewal' | 'reminder') => {
    if (!client.phone) return;
    const phone = formatPhone(client.phone);
    const planName = client.plan_name || 'seu plano';
    
    const customTemplate = templates.find(t => t.type === type && t.is_default);
    
    let message: string;
    
    if (customTemplate) {
      message = replaceVariables(customTemplate.message);
    } else {
      const defaultMessages = {
        billing: `Olá ${client.name}! 👋\n\nSeu plano *${planName}* vence em ${format(expirationDate, "dd 'de' MMMM", { locale: ptBR })}.\n\nDeseja renovar? Entre em contato para mais informações.`,
        welcome: `Olá ${client.name}! 🎉\n\nSeja bem-vindo ao *${planName}*!\n\nSeus dados de acesso:\n👤 Usuário: ${client.login || 'N/A'}\n🔑 Senha: ${client.password || 'N/A'}\n\nQualquer dúvida, estamos à disposição!`,
        renewal: `Olá ${client.name}! ✅\n\nSeu plano *${planName}* foi renovado com sucesso!\n\nSeus dados de acesso:\n👤 Usuário: ${client.login || 'N/A'}\n🔑 Senha: ${client.password || 'N/A'}\n\nNova data de vencimento: ${format(addDays(new Date(), 30), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.\n\nAgradecemos pela confiança!`,
        reminder: `Olá ${client.name}! ⏰\n\nEste é um lembrete que seu plano *${planName}* vence em ${format(expirationDate, "dd 'de' MMMM", { locale: ptBR })}.\n\nSeus dados de acesso:\n👤 Usuário: ${client.login || 'N/A'}\n🔑 Senha: ${client.password || 'N/A'}\n\nEvite a interrupção do serviço renovando antecipadamente!`,
      };
      message = defaultMessages[type];
    }

    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleRenew = async () => {
    if (!onRenew) return;
    
    setIsRenewing(true);
    try {
      const baseDate = isPast(expirationDate) ? new Date() : expirationDate;
      const newExpiration = addDays(baseDate, 30);
      await onRenew(client.id, format(newExpiration, 'yyyy-MM-dd'));
    } finally {
      setIsRenewing(false);
    }
  };

  return (
    <Card className="card-hover border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
      <CardContent className="p-0">
        {/* Header with gradient accent */}
        <div className="p-4 border-b border-border/30">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base truncate">{client.name}</h3>
                <Badge className={cn("shrink-0 text-[10px] px-1.5 py-0", status.class)}>
                  {status.label}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-1">
                {client.plan_name && (
                  <span className="text-sm text-primary font-medium">{client.plan_name}</span>
                )}
                {client.plan_price && (
                  <span className="text-sm text-muted-foreground">
                    R$ {client.plan_price.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
            
            {/* Actions dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="w-4 h-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                {onRenew && (
                  <DropdownMenuItem onClick={handleRenew} disabled={isRenewing}>
                    <RefreshCw className={cn("w-4 h-4 mr-2", isRenewing && "animate-spin")} />
                    Renovar (+30 dias)
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Info section */}
        <div className="p-4 space-y-3">
          {/* Primary info row */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-3.5 h-3.5 shrink-0 text-primary" />
              <span className="truncate">{format(expirationDate, 'dd/MM/yyyy')}</span>
            </div>
            {client.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="w-3.5 h-3.5 shrink-0 text-primary" />
                <span className="truncate">
                  {showPhone ? client.phone : client.phone.replace(/[\d]/g, '•')}
                </span>
                <button
                  onClick={() => setShowPhone(!showPhone)}
                  className="ml-1 hover:text-foreground transition-colors"
                >
                  {showPhone ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>

          {/* Secondary info */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            {client.device && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Monitor className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{client.device}</span>
              </div>
            )}
            {client.app_name && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Smartphone className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{client.app_name}</span>
              </div>
            )}
            {client.server_name && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Server className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{client.server_name}</span>
              </div>
            )}
            {client.mac_address && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Wifi className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate font-mono text-xs">{client.mac_address}</span>
              </div>
            )}
          </div>

          {/* Credentials */}
          {(client.login || client.password) && (
            <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 border border-border/30">
              {client.login && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={() => copyToClipboard(client.login!, 'Usuário')}
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[80px]">{client.login}</span>
                      <Copy className="w-3 h-3 opacity-50" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Copiar usuário</TooltipContent>
                </Tooltip>
              )}
              {client.password && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={() => copyToClipboard(client.password!, 'Senha')}
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[60px]">
                        {showPassword ? client.password : '••••••'}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPassword(!showPassword);
                        }}
                        className="ml-1"
                      >
                        {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Copiar senha</TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </div>

        {/* WhatsApp Actions */}
        {client.phone && (
          <div className="p-3 pt-0">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => sendWhatsApp('billing')}
                className="h-9 px-3 text-xs bg-green-500/10 border-green-500/20 text-green-500 hover:bg-green-500/20 hover:text-green-400 justify-start gap-2"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Cobrar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => sendWhatsApp('renewal')}
                className="h-9 px-3 text-xs bg-green-500/10 border-green-500/20 text-green-500 hover:bg-green-500/20 hover:text-green-400 justify-start gap-2"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Renovar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => sendWhatsApp('reminder')}
                className="h-9 px-3 text-xs bg-green-500/10 border-green-500/20 text-green-500 hover:bg-green-500/20 hover:text-green-400 justify-start gap-2"
              >
                <Bell className="w-3.5 h-3.5" />
                Lembrar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => sendWhatsApp('welcome')}
                className="h-9 px-3 text-xs bg-green-500/10 border-green-500/20 text-green-500 hover:bg-green-500/20 hover:text-green-400 justify-start gap-2"
              >
                <PartyPopper className="w-3.5 h-3.5" />
                Boas-vindas
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
