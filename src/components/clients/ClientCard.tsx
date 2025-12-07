import { format, differenceInDays, isPast, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, Edit, Trash2, MessageCircle, PartyPopper, Calendar, Monitor, User, Lock, Eye, EyeOff, RefreshCw, Bell, CheckCircle, Smartphone, Server, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
    if (isExpired) return { label: 'Vencido', class: 'status-expired' };
    if (isExpiring) return { label: `Vence em ${daysUntilExpiration}d`, class: 'status-expiring' };
    return { label: 'Ativo', class: 'status-active' };
  };

  const status = getStatus();

  const formatPhone = (phone: string) => {
    return phone.replace(/\D/g, '');
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
    
    // Check if there's a custom default template for this type
    const customTemplate = templates.find(t => t.type === type && t.is_default);
    
    let message: string;
    
    if (customTemplate) {
      message = replaceVariables(customTemplate.message);
    } else {
      // Default messages
      const defaultMessages = {
        billing: `Olá ${client.name}! 👋\n\nSeu plano *${planName}* vence em ${format(expirationDate, "dd 'de' MMMM", { locale: ptBR })}.\n\nDeseja renovar? Entre em contato para mais informações.`,
        welcome: `Olá ${client.name}! 🎉\n\nSeja bem-vindo ao *${planName}*!\n\nSeus dados de acesso:\n📱 Dispositivo: ${client.device || 'N/A'}\n👤 Usuário: ${client.login || 'N/A'}\n🔑 Senha: ${client.password || 'N/A'}\n\nQualquer dúvida, estamos à disposição!`,
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
      const newExpiration = addDays(baseDate, 30); // Default 30 days renewal
      await onRenew(client.id, format(newExpiration, 'yyyy-MM-dd'));
    } finally {
      setIsRenewing(false);
    }
  };

  return (
    <Card variant="gradient" className="animate-scale-in hover:scale-[1.01] transition-transform">
      <CardContent className="p-4">
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base truncate">{client.name}</h3>
              {(client.plan_name || client.plan_price) && (
                <p className="text-sm text-muted-foreground">
                  {client.plan_name}{client.plan_name && client.plan_price ? ' • ' : ''}
                  {client.plan_price ? `R$ ${client.plan_price.toFixed(2)}` : ''}
                </p>
              )}
            </div>
            <Badge className={cn("shrink-0 border text-xs", status.class)}>
              {status.label}
            </Badge>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4 shrink-0" />
              <span className="truncate">{format(expirationDate, 'dd/MM/yyyy')}</span>
            </div>
            {client.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="w-4 h-4 shrink-0" />
                <span className="truncate">{client.phone}</span>
              </div>
            )}
            {client.device && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Monitor className="w-4 h-4 shrink-0" />
                <span className="truncate">{client.device}</span>
              </div>
            )}
            {client.login && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="w-4 h-4 shrink-0" />
                <span className="truncate">{client.login}</span>
              </div>
            )}
            {client.app_name && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Smartphone className="w-4 h-4 shrink-0" />
                <span className="truncate">{client.app_name}</span>
              </div>
            )}
            {client.mac_address && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Wifi className="w-4 h-4 shrink-0" />
                <span className="truncate font-mono text-xs">{client.mac_address}</span>
              </div>
            )}
            {client.server_name && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Server className="w-4 h-4 shrink-0" />
                <span className="truncate">{client.server_name}</span>
              </div>
            )}
          </div>

          {/* Password */}
          {client.password && (
            <div className="flex items-center gap-2 text-sm">
              <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground truncate">
                {showPassword ? client.password : '••••••••'}
              </span>
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            {onRenew && (
              <Button
                variant="default"
                size="sm"
                onClick={handleRenew}
                disabled={isRenewing}
                className="flex-1 min-w-[100px]"
              >
                <RefreshCw className={cn("w-4 h-4", isRenewing && "animate-spin")} />
                <span className="hidden sm:inline">Renovar</span>
              </Button>
            )}
            {client.phone && (
              <>
                <Button
                  variant="whatsapp"
                  size="sm"
                  onClick={() => sendWhatsApp('billing')}
                  className="flex-1 min-w-[80px]"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">Cobrança</span>
                </Button>
                <Button
                  variant="whatsapp"
                  size="sm"
                  onClick={() => sendWhatsApp('renewal')}
                  className="flex-1 min-w-[80px]"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">Renovado</span>
                </Button>
                <Button
                  variant="whatsapp"
                  size="sm"
                  onClick={() => sendWhatsApp('reminder')}
                  className="flex-1 min-w-[80px]"
                >
                  <Bell className="w-4 h-4" />
                  <span className="hidden sm:inline">Lembrete</span>
                </Button>
                <Button
                  variant="whatsapp"
                  size="sm"
                  onClick={() => sendWhatsApp('welcome')}
                  className="flex-1 min-w-[80px]"
                >
                  <PartyPopper className="w-4 h-4" />
                  <span className="hidden sm:inline">Boas-vindas</span>
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="w-4 h-4" />
            </Button>
            <Button variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
