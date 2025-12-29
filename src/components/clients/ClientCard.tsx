import { format, differenceInDays, isPast, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Phone, Edit, Trash2, MessageCircle, PartyPopper, Calendar, Monitor, 
  User, Lock, Eye, EyeOff, RefreshCw, Bell, CheckCircle, Smartphone, 
  Server, Wifi, Copy, MoreHorizontal, DollarSign, AlertCircle, Loader2, Mail, Tv, Radio, Cloud, Send
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect, useMemo } from 'react';
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
import WhatsAppCredentialSelector from './WhatsAppCredentialSelector';
import MessageTypeSelector from './MessageTypeSelector';
import { useCrypto } from '@/hooks/useCrypto';

interface ClientCardProps {
  client: {
    id: string;
    name: string;
    phone: string | null;
    telegram?: string | null;
    email?: string | null;
    device: string | null;
    login: string | null;
    password: string | null;
    login2: string | null;
    password2: string | null;
    login3: string | null;
    password3: string | null;
    login4: string | null;
    password4: string | null;
    login5: string | null;
    password5: string | null;
    expiration_date: string;
    plan_name: string | null;
    plan_price: number | null;
    app_name: string | null;
    mac_address: string | null;
    server_name: string | null;
    server_ids: string[] | null;
    is_paid?: boolean | null;
    is_annual_paid?: boolean | null;
    shared_slot_type?: string | null;
    shared_panel_id?: string | null;
    has_app?: boolean | null;
    app_type?: string | null;
  };
  servers?: { id: string; name: string }[];
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

interface Credential {
  index: number;
  serverName: string | null;
  login: string | null;
  password: string | null;
}

export default function ClientCard({ client, servers = [], onEdit, onDelete, onRenew }: ClientCardProps) {
  const { user } = useAuth();
  const { decryptCredentials } = useCrypto();
  const [showPassword, setShowPassword] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptedCredentials, setDecryptedCredentials] = useState<{
    login: string | null;
    password: string | null;
    login2: string | null;
    password2: string | null;
    login3: string | null;
    password3: string | null;
    login4: string | null;
    password4: string | null;
    login5: string | null;
    password5: string | null;
  } | null>(null);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [credentialSelectorOpen, setCredentialSelectorOpen] = useState(false);
  const [pendingMessageType, setPendingMessageType] = useState<'billing' | 'welcome' | 'renewal' | 'reminder'>('billing');
  const [sellerName, setSellerName] = useState<string>('');
  const [messageTypeSelectorOpen, setMessageTypeSelectorOpen] = useState(false);
  const [pendingPlatform, setPendingPlatform] = useState<'whatsapp' | 'telegram'>('whatsapp');
  const [pendingAction, setPendingAction] = useState<'billing' | 'welcome' | 'renewal' | 'reminder'>('billing');
  const expirationDate = new Date(client.expiration_date);
  const daysUntilExpiration = differenceInDays(expirationDate, new Date());
  const isExpired = isPast(expirationDate);
  const isExpiring = !isExpired && daysUntilExpiration <= 7;

  // Handle password reveal with decryption
  const handleTogglePassword = async () => {
    if (!showPassword && !decryptedCredentials) {
      setIsDecrypting(true);
      try {
        const decrypted = await decryptCredentials({
          login: client.login,
          password: client.password,
          login2: client.login2,
          password2: client.password2,
          login3: client.login3,
          password3: client.password3,
          login4: client.login4,
          password4: client.password4,
          login5: client.login5,
          password5: client.password5,
        });
        setDecryptedCredentials(decrypted as any);
        setShowPassword(true);
      } catch (error) {
        console.error('Decryption error:', error);
        toast.error('Erro ao descriptografar credenciais');
        // Even on error, show the original values
        setShowPassword(true);
      } finally {
        setIsDecrypting(false);
      }
    } else {
      setShowPassword(!showPassword);
    }
  };

  // Get display values - use decrypted if available, otherwise use original
  const getDisplayLogin = () => decryptedCredentials?.login || client.login;
  const getDisplayPassword = () => decryptedCredentials?.password || client.password;

  // Build credentials array based on server_ids
  const credentials = useMemo(() => {
    const creds: Credential[] = [];
    const serverIds = client.server_ids || [];
    const loginFields = [client.login, client.login2, client.login3, client.login4, client.login5];
    const passwordFields = [client.password, client.password2, client.password3, client.password4, client.password5];
    
    for (let i = 0; i < serverIds.length; i++) {
      const serverId = serverIds[i];
      const server = servers.find(s => s.id === serverId);
      creds.push({
        index: i,
        serverName: server?.name || null,
        login: loginFields[i] || null,
        password: passwordFields[i] || null,
      });
    }
    
    // If no server_ids but has login/password, add default credential
    if (creds.length === 0 && (client.login || client.password)) {
      creds.push({
        index: 0,
        serverName: client.server_name,
        login: client.login,
        password: client.password,
      });
    }
    
    return creds;
  }, [client, servers]);

  const hasMultipleCredentials = credentials.length > 1;

  useEffect(() => {
    if (user) {
      // Fetch templates
      supabase
        .from('whatsapp_templates')
        .select('id, type, message, is_default')
        .eq('seller_id', user.id)
        .eq('is_default', true)
        .then(({ data }) => {
          if (data) setTemplates(data as WhatsAppTemplate[]);
        });
      
      // Fetch seller name
      supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.full_name) setSellerName(data.full_name);
        });
    }
  }, [user]);

  const getStatus = () => {
    const formattedDate = format(expirationDate, 'dd/MM/yyyy');
    const isAnnualPaid = client.is_annual_paid === true;
    
    if (isExpired) {
      // For annual paid clients, show blue (just renewal reminder, not payment needed)
      if (isAnnualPaid) return { label: formattedDate, class: 'status-annual-renewal', icon: '🔵', isAnnualPaid: true };
      return { label: formattedDate, class: 'status-expired', icon: '🔴', isAnnualPaid: false };
    }
    if (isExpiring) {
      // For annual paid clients, show blue (just renewal reminder, not payment needed)
      if (isAnnualPaid) return { label: formattedDate, class: 'status-annual-renewal', icon: '🔵', isAnnualPaid: true };
      return { label: formattedDate, class: 'status-expiring', icon: '🟡', isAnnualPaid: false };
    }
    return { label: formattedDate, class: 'status-active', icon: '🟢', isAnnualPaid: false };
  };

  const status = getStatus();

  const formatPhone = (phone: string) => {
    return phone.replace(/\D/g, '');
  };

  const formatPhoneDisplay = (phone: string) => {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    
    // Format as +55 XX XXXXX-XXXX or +55 XX XXXX-XXXX
    if (digits.length === 13) {
      // 55 + DDD (2) + number (9)
      return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
    } else if (digits.length === 12) {
      // 55 + DDD (2) + number (8)
      return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 8)}-${digits.slice(8)}`;
    } else if (digits.length === 11) {
      // DDD (2) + number (9)
      return `+55 ${digits.slice(0, 2)} ${digits.slice(2, 7)}-${digits.slice(7)}`;
    } else if (digits.length === 10) {
      // DDD (2) + number (8)
      return `+55 ${digits.slice(0, 2)} ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const replaceVariablesWithCredential = (message: string, login: string | null, password: string | null) => {
    const formattedDate = format(expirationDate, "dd/MM/yyyy");
    const formattedDateFull = format(expirationDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    return message
      .replace(/{nome}/g, client.name)
      .replace(/{plano}/g, client.plan_name || 'seu plano')
      .replace(/{vencimento}/g, format(expirationDate, "dd 'de' MMMM", { locale: ptBR }))
      .replace(/{data_vencimento}/g, formattedDate)
      .replace(/{data_vencimento_completa}/g, formattedDateFull)
      .replace(/{dispositivo}/g, client.device || 'N/A')
      .replace(/{usuario}/g, login || 'N/A')
      .replace(/{senha}/g, password || 'N/A')
      .replace(/{preco}/g, client.plan_price ? `R$ ${client.plan_price.toFixed(2)}` : 'N/A');
  };

  const sendWhatsAppWithCredential = (type: 'billing' | 'welcome' | 'renewal' | 'reminder', login: string | null, password: string | null) => {
    if (!client.phone) return;
    const phone = formatPhone(client.phone);
    const planName = client.plan_name || 'seu plano';
    const brandName = sellerName || 'Nossa equipe';
    
    const customTemplate = templates.find(t => t.type === type && t.is_default);
    
    let message: string;
    
    if (customTemplate) {
      message = replaceVariablesWithCredential(customTemplate.message, login, password);
    } else {
      const formattedExpDate = format(expirationDate, 'dd/MM/yyyy');
      const defaultMessages = {
        billing: `Olá ${client.name}! 👋\n\n*${brandName}* informa: Seu plano *${planName}* vence em *${formattedExpDate}*.\n\nDeseja renovar? Entre em contato para mais informações.\n\n🎬 *${brandName}* - Sua melhor experiência!`,
        welcome: `Olá ${client.name}! 🎉\n\nSeja bem-vindo(a) à *${brandName}*!\n\nSeu plano: *${planName}*\n📅 Vencimento: *${formattedExpDate}*\n\nSeus dados de acesso:\n👤 Usuário: ${login || 'N/A'}\n🔑 Senha: ${password || 'N/A'}\n\nQualquer dúvida, estamos à disposição!\n\n🎬 *${brandName}* - Sua melhor experiência!`,
        renewal: `Olá ${client.name}! ✅\n\n*${brandName}* informa: Seu plano *${planName}* foi renovado com sucesso!\n\nSeus dados de acesso:\n👤 Usuário: ${login || 'N/A'}\n🔑 Senha: ${password || 'N/A'}\n\n📅 Nova data de vencimento: *${formattedExpDate}*\n\nAgradecemos pela confiança!\n\n🎬 *${brandName}* - Sua melhor experiência!`,
        reminder: `Olá ${client.name}! ⏰\n\n*${brandName}* lembra: Seu plano *${planName}* vence em *${formattedExpDate}*.\n\nSeus dados de acesso:\n👤 Usuário: ${login || 'N/A'}\n🔑 Senha: ${password || 'N/A'}\n\nEvite a interrupção do serviço renovando antecipadamente!\n\n🎬 *${brandName}* - Sua melhor experiência!`,
      };
      message = defaultMessages[type];
    }

    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleWhatsAppClick = async (type: 'billing' | 'welcome' | 'renewal' | 'reminder') => {
    if (!client.phone) return;
    
    // Decrypt credentials before sending
    let creds = decryptedCredentials;
    if (!creds) {
      try {
        creds = await decryptCredentials({
          login: client.login,
          password: client.password,
          login2: client.login2,
          password2: client.password2,
          login3: client.login3,
          password3: client.password3,
          login4: client.login4,
          password4: client.password4,
          login5: client.login5,
          password5: client.password5,
        }) as any;
        setDecryptedCredentials(creds);
      } catch (error) {
        console.error('Decryption error:', error);
        // Continue with encrypted values if decryption fails
      }
    }
    
    // If has multiple credentials, show selector
    if (hasMultipleCredentials) {
      setPendingMessageType(type);
      setCredentialSelectorOpen(true);
    } else {
      // Use first credential (or default)
      const login = creds?.login || client.login;
      const password = creds?.password || client.password;
      sendWhatsAppWithCredential(type, login, password);
    }
  };

  const handleCredentialSelect = async (credential: Credential) => {
    // Get decrypted value for the selected credential index
    let login = credential.login;
    let password = credential.password;
    
    if (decryptedCredentials) {
      const loginFields = ['login', 'login2', 'login3', 'login4', 'login5'] as const;
      const passwordFields = ['password', 'password2', 'password3', 'password4', 'password5'] as const;
      login = decryptedCredentials[loginFields[credential.index]] || credential.login;
      password = decryptedCredentials[passwordFields[credential.index]] || credential.password;
    }
    
    sendWhatsAppWithCredential(pendingMessageType, login, password);
  };

  // Send Telegram message with credential
  const sendTelegramWithCredential = (type: 'billing' | 'welcome' | 'renewal' | 'reminder', login: string | null, password: string | null, useTemplate: boolean) => {
    if (!client.telegram) return;
    
    // Format telegram username (remove @ if present)
    const telegramUser = client.telegram.replace('@', '');
    
    if (!useTemplate) {
      // Open empty chat
      window.open(`https://t.me/${telegramUser}`, '_blank');
      return;
    }
    
    const planName = client.plan_name || 'seu plano';
    const brandName = sellerName || 'Nossa equipe';
    
    const customTemplate = templates.find(t => t.type === type && t.is_default);
    
    let message: string;
    
    if (customTemplate) {
      message = replaceVariablesWithCredential(customTemplate.message, login, password);
    } else {
      const formattedExpDate = format(expirationDate, 'dd/MM/yyyy');
      const defaultMessages = {
        billing: `Olá ${client.name}! 👋\n\n${brandName} informa: Seu plano ${planName} vence em ${formattedExpDate}.\n\nDeseja renovar? Entre em contato para mais informações.\n\n🎬 ${brandName} - Sua melhor experiência!`,
        welcome: `Olá ${client.name}! 🎉\n\nSeja bem-vindo(a) à ${brandName}!\n\nSeu plano: ${planName}\n📅 Vencimento: ${formattedExpDate}\n\nSeus dados de acesso:\n👤 Usuário: ${login || 'N/A'}\n🔑 Senha: ${password || 'N/A'}\n\nQualquer dúvida, estamos à disposição!\n\n🎬 ${brandName} - Sua melhor experiência!`,
        renewal: `Olá ${client.name}! ✅\n\n${brandName} informa: Seu plano ${planName} foi renovado com sucesso!\n\nSeus dados de acesso:\n👤 Usuário: ${login || 'N/A'}\n🔑 Senha: ${password || 'N/A'}\n\n📅 Nova data de vencimento: ${formattedExpDate}\n\nAgradecemos pela confiança!\n\n🎬 ${brandName} - Sua melhor experiência!`,
        reminder: `Olá ${client.name}! ⏰\n\n${brandName} lembra: Seu plano ${planName} vence em ${formattedExpDate}.\n\nSeus dados de acesso:\n👤 Usuário: ${login || 'N/A'}\n🔑 Senha: ${password || 'N/A'}\n\nEvite a interrupção do serviço renovando antecipadamente!\n\n🎬 ${brandName} - Sua melhor experiência!`,
      };
      message = defaultMessages[type];
    }

    window.open(`https://t.me/${telegramUser}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Handle message action click (both WhatsApp and Telegram)
  const handleMessageClick = (platform: 'whatsapp' | 'telegram', type: 'billing' | 'welcome' | 'renewal' | 'reminder') => {
    setPendingPlatform(platform);
    setPendingAction(type);
    setMessageTypeSelectorOpen(true);
  };

  // Handle message type selection
  const handleMessageTypeSelect = async (useTemplate: boolean) => {
    // Decrypt credentials before sending
    let creds = decryptedCredentials;
    if (!creds && useTemplate) {
      try {
        creds = await decryptCredentials({
          login: client.login,
          password: client.password,
          login2: client.login2,
          password2: client.password2,
          login3: client.login3,
          password3: client.password3,
          login4: client.login4,
          password4: client.password4,
          login5: client.login5,
          password5: client.password5,
        }) as any;
        setDecryptedCredentials(creds);
      } catch (error) {
        console.error('Decryption error:', error);
      }
    }

    if (pendingPlatform === 'telegram') {
      const login = creds?.login || client.login;
      const password = creds?.password || client.password;
      sendTelegramWithCredential(pendingAction, login, password, useTemplate);
    } else {
      if (!useTemplate) {
        // Open empty WhatsApp chat
        if (client.phone) {
          const phone = formatPhone(client.phone);
          window.open(`https://wa.me/55${phone}`, '_blank');
        }
      } else {
        // If has multiple credentials, show selector
        if (hasMultipleCredentials) {
          setPendingMessageType(pendingAction);
          setCredentialSelectorOpen(true);
        } else {
          const login = creds?.login || client.login;
          const password = creds?.password || client.password;
          sendWhatsAppWithCredential(pendingAction, login, password);
        }
      }
    }
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
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-base truncate">{client.name}</h3>
                <Badge className={cn("shrink-0 text-[10px] px-1.5 py-0", status.class)}>
                  {status.label}
                </Badge>
                {status.isAnnualPaid && (
                  <Badge className="shrink-0 text-[10px] px-1.5 py-0 bg-blue-500/20 text-blue-400 border-blue-500/30 gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Anual Pago
                  </Badge>
                )}
                {client.is_paid === false && (
                  <Badge variant="destructive" className="shrink-0 text-[10px] px-1.5 py-0 gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Não Pago
                  </Badge>
                )}
                {client.shared_slot_type === 'p2p' && (
                  <Badge className="shrink-0 text-[10px] px-1.5 py-0 bg-blue-500/20 text-blue-400 border-blue-500/30 gap-1">
                    <Radio className="w-3 h-3" />
                    P2P
                  </Badge>
                )}
                {client.shared_slot_type === 'iptv' && (
                  <Badge className="shrink-0 text-[10px] px-1.5 py-0 bg-purple-500/20 text-purple-400 border-purple-500/30 gap-1">
                    <Tv className="w-3 h-3" />
                    IPTV
                  </Badge>
                )}
                {client.has_app && (
                  <Badge className="shrink-0 text-[10px] px-1.5 py-0 bg-cyan-500/20 text-cyan-400 border-cyan-500/30 gap-1">
                    <Cloud className="w-3 h-3" />
                    {client.app_type === 'clouddy' ? 'Clouddy' : client.app_type === 'ibo_pro' ? 'IBO PRO' : client.app_type === 'ibo_player' ? 'IBO PLAYER' : 'App'}
                  </Badge>
                )}
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
              <div className="flex items-center gap-1 text-muted-foreground">
                <Phone className="w-3.5 h-3.5 shrink-0 text-primary" />
                <span className="truncate text-xs">
                  {showPhone ? formatPhoneDisplay(client.phone) : client.phone.replace(/[\d]/g, '•')}
                </span>
                <button
                  onClick={() => setShowPhone(!showPhone)}
                  className="hover:text-foreground transition-colors"
                >
                  {showPhone ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
                {showPhone && (
                  <button
                    onClick={() => copyToClipboard(formatPhoneDisplay(client.phone!), 'WhatsApp')}
                    className="hover:text-foreground transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                )}
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
            {client.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate text-xs">{client.email}</span>
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
                      onClick={() => {
                        const displayLogin = getDisplayLogin();
                        if (displayLogin) copyToClipboard(displayLogin, 'Usuário');
                      }}
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[80px]">
                        {showPassword ? getDisplayLogin() : '••••••'}
                      </span>
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
                      onClick={() => {
                        const displayPassword = getDisplayPassword();
                        if (displayPassword) copyToClipboard(displayPassword, 'Senha');
                      }}
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[60px]">
                        {showPassword ? getDisplayPassword() : '••••••'}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Copiar senha</TooltipContent>
                </Tooltip>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleTogglePassword();
                }}
                disabled={isDecrypting}
                className="ml-auto p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                {isDecrypting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          )}
        </div>

        {/* Messaging Actions */}
        {(client.phone || client.telegram) && (
          <div className="p-3 pt-0 space-y-2">
            {/* WhatsApp Actions */}
            {client.phone && (
              <>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                  <MessageCircle className="w-3 h-3 text-green-500" />
                  WhatsApp
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMessageClick('whatsapp', 'billing')}
                    className="h-8 px-2 text-[10px] bg-green-500/10 border-green-500/20 text-green-500 hover:bg-green-500/20 hover:text-green-400 justify-center gap-1"
                  >
                    <DollarSign className="w-3 h-3" />
                    Cobrar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMessageClick('whatsapp', 'renewal')}
                    className="h-8 px-2 text-[10px] bg-green-500/10 border-green-500/20 text-green-500 hover:bg-green-500/20 hover:text-green-400 justify-center gap-1"
                  >
                    <CheckCircle className="w-3 h-3" />
                    Renovar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMessageClick('whatsapp', 'reminder')}
                    className="h-8 px-2 text-[10px] bg-green-500/10 border-green-500/20 text-green-500 hover:bg-green-500/20 hover:text-green-400 justify-center gap-1"
                  >
                    <Bell className="w-3 h-3" />
                    Lembrar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMessageClick('whatsapp', 'welcome')}
                    className="h-8 px-2 text-[10px] bg-green-500/10 border-green-500/20 text-green-500 hover:bg-green-500/20 hover:text-green-400 justify-center gap-1"
                  >
                    <PartyPopper className="w-3 h-3" />
                    Bem-vindo
                  </Button>
                </div>
              </>
            )}

            {/* Telegram Actions */}
            {client.telegram && (
              <>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium mt-2">
                  <Send className="w-3 h-3 text-sky-500" />
                  Telegram ({client.telegram})
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMessageClick('telegram', 'billing')}
                    className="h-8 px-2 text-[10px] bg-sky-500/10 border-sky-500/20 text-sky-500 hover:bg-sky-500/20 hover:text-sky-400 justify-center gap-1"
                  >
                    <DollarSign className="w-3 h-3" />
                    Cobrar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMessageClick('telegram', 'renewal')}
                    className="h-8 px-2 text-[10px] bg-sky-500/10 border-sky-500/20 text-sky-500 hover:bg-sky-500/20 hover:text-sky-400 justify-center gap-1"
                  >
                    <CheckCircle className="w-3 h-3" />
                    Renovar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMessageClick('telegram', 'reminder')}
                    className="h-8 px-2 text-[10px] bg-sky-500/10 border-sky-500/20 text-sky-500 hover:bg-sky-500/20 hover:text-sky-400 justify-center gap-1"
                  >
                    <Bell className="w-3 h-3" />
                    Lembrar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMessageClick('telegram', 'welcome')}
                    className="h-8 px-2 text-[10px] bg-sky-500/10 border-sky-500/20 text-sky-500 hover:bg-sky-500/20 hover:text-sky-400 justify-center gap-1"
                  >
                    <PartyPopper className="w-3 h-3" />
                    Bem-vindo
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Message Type Selector Dialog */}
        <MessageTypeSelector
          open={messageTypeSelectorOpen}
          onOpenChange={setMessageTypeSelectorOpen}
          platform={pendingPlatform}
          onSelect={handleMessageTypeSelect}
        />

        {/* Credential Selector Dialog */}
        <WhatsAppCredentialSelector
          open={credentialSelectorOpen}
          onOpenChange={setCredentialSelectorOpen}
          credentials={credentials}
          messageType={pendingMessageType}
          onSelect={handleCredentialSelect}
        />
      </CardContent>
    </Card>
  );
}
