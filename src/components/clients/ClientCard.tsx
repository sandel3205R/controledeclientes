import { format, differenceInDays, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, Edit, Trash2, MessageCircle, PartyPopper, Calendar, Monitor, User, Lock, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface ClientCardProps {
  client: {
    id: string;
    name: string;
    phone: string | null;
    device: string | null;
    login: string | null;
    password: string | null;
    expiration_date: string;
    plan?: { name: string; price: number } | null;
  };
  onEdit: () => void;
  onDelete: () => void;
}

export default function ClientCard({ client, onEdit, onDelete }: ClientCardProps) {
  const [showPassword, setShowPassword] = useState(false);
  
  const expirationDate = new Date(client.expiration_date);
  const daysUntilExpiration = differenceInDays(expirationDate, new Date());
  const isExpired = isPast(expirationDate);
  const isExpiring = !isExpired && daysUntilExpiration <= 7;

  const getStatus = () => {
    if (isExpired) return { label: 'Vencido', class: 'status-expired' };
    if (isExpiring) return { label: `Vence em ${daysUntilExpiration}d`, class: 'status-expiring' };
    return { label: 'Ativo', class: 'status-active' };
  };

  const status = getStatus();

  const formatPhone = (phone: string) => {
    return phone.replace(/\D/g, '');
  };

  const sendWhatsApp = (type: 'billing' | 'welcome') => {
    if (!client.phone) return;
    const phone = formatPhone(client.phone);
    
    const messages = {
      billing: `Olá ${client.name}! 👋\n\nSeu plano de streaming vence em ${format(expirationDate, "dd 'de' MMMM", { locale: ptBR })}.\n\nDeseja renovar? Entre em contato para mais informações.`,
      welcome: `Olá ${client.name}! 🎉\n\nSeja bem-vindo ao nosso serviço de streaming!\n\nSeus dados de acesso:\n📱 Dispositivo: ${client.device || 'N/A'}\n👤 Login: ${client.login || 'N/A'}\n🔑 Senha: ${client.password || 'N/A'}\n\nQualquer dúvida, estamos à disposição!`,
    };

    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(messages[type])}`, '_blank');
  };

  return (
    <Card variant="gradient" className="animate-scale-in hover:scale-[1.01] transition-transform">
      <CardContent className="p-4">
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base truncate">{client.name}</h3>
              {client.plan && (
                <p className="text-sm text-muted-foreground">
                  {client.plan.name} • R$ {client.plan.price.toFixed(2)}
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
            {client.phone && (
              <>
                <Button
                  variant="whatsapp"
                  size="sm"
                  onClick={() => sendWhatsApp('billing')}
                  className="flex-1 min-w-[100px]"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">Cobrança</span>
                </Button>
                <Button
                  variant="whatsapp"
                  size="sm"
                  onClick={() => sendWhatsApp('welcome')}
                  className="flex-1 min-w-[100px]"
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
