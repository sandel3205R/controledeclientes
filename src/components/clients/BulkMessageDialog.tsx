import { useState, useMemo } from 'react';
import { format, differenceInDays, isPast, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MessageCircle, Send, Users, Clock, AlertTriangle, CheckCircle, DollarSign, AlertCircle, SkipForward, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Client {
  id: string;
  name: string;
  phone: string | null;
  device: string | null;
  login: string | null;
  password: string | null;
  expiration_date: string;
  plan_name: string | null;
  plan_price: number | null;
  is_paid?: boolean | null;
}

interface WhatsAppTemplate {
  id: string;
  type: string;
  name: string;
  message: string;
  is_default: boolean;
}

interface BulkMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  templates: WhatsAppTemplate[];
  sellerName: string;
}

type MessageType = 'billing' | 'reminder' | 'renewal' | 'welcome' | 'unpaid';

export default function BulkMessageDialog({
  open,
  onOpenChange,
  clients,
  templates,
  sellerName,
}: BulkMessageDialogProps) {
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [messageType, setMessageType] = useState<MessageType>('reminder');
  const [daysFilter, setDaysFilter] = useState<string>('7');
  const [isSending, setIsSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [sendMode, setSendMode] = useState<'auto' | 'manual'>('manual');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isManualSending, setIsManualSending] = useState(false);

  const getClientStatus = (expDate: string) => {
    const date = new Date(expDate);
    if (isPast(date)) return 'expired';
    const days = differenceInDays(date, new Date());
    if (days <= 7) return 'expiring';
    return 'active';
  };

  const getDaysUntilExpiration = (expDate: string) => {
    return differenceInDays(new Date(expDate), new Date());
  };

  // Filter clients based on days filter and phone availability
  const filteredClients = useMemo(() => {
    const days = parseInt(daysFilter);
    return clients.filter((client) => {
      if (!client.phone) return false;
      
      // Filter for unpaid clients
      if (daysFilter === 'unpaid') {
        return client.is_paid === false;
      }
      
      const daysLeft = getDaysUntilExpiration(client.expiration_date);
      if (daysFilter === 'expired') {
        return daysLeft < 0;
      }
      return daysLeft >= 0 && daysLeft <= days;
    });
  }, [clients, daysFilter]);

  const toggleClient = (clientId: string) => {
    const newSelected = new Set(selectedClients);
    if (newSelected.has(clientId)) {
      newSelected.delete(clientId);
    } else {
      newSelected.add(clientId);
    }
    setSelectedClients(newSelected);
  };

  const toggleAll = () => {
    if (selectedClients.size === filteredClients.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(filteredClients.map((c) => c.id)));
    }
  };

  const replaceVariables = (message: string, client: Client) => {
    const expirationDate = new Date(client.expiration_date);
    const formattedDate = format(expirationDate, 'dd/MM/yyyy');
    const formattedDateFull = format(expirationDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    const brandName = sellerName || 'Nossa equipe';
    return message
      .replace(/{nome}/g, client.name)
      .replace(/{plano}/g, client.plan_name || 'seu plano')
      .replace(/{vencimento}/g, format(expirationDate, "dd 'de' MMMM", { locale: ptBR }))
      .replace(/{data_vencimento}/g, formattedDate)
      .replace(/{data_vencimento_completa}/g, formattedDateFull)
      .replace(/{dispositivo}/g, client.device || 'N/A')
      .replace(/{usuario}/g, client.login || 'N/A')
      .replace(/{senha}/g, client.password || 'N/A')
      .replace(/{preco}/g, client.plan_price ? `R$ ${client.plan_price.toFixed(2)}` : 'N/A')
      .replace(/{empresa}/g, brandName);
  };

  const getDefaultMessage = (type: MessageType, client: Client) => {
    const expirationDate = new Date(client.expiration_date);
    const planName = client.plan_name || 'seu plano';
    const formattedExpDate = format(expirationDate, 'dd/MM/yyyy');
    const price = client.plan_price ? `R$ ${client.plan_price.toFixed(2)}` : 'N/A';
    const brandName = sellerName || 'Nossa equipe';

    const messages = {
      billing: `Olá ${client.name}! 👋\n\n*${brandName}* informa: Seu plano *${planName}* vence em *${formattedExpDate}*.\n\nDeseja renovar? Entre em contato para mais informações.\n\n🎬 *${brandName}* - Sua melhor experiência!`,
      welcome: `Olá ${client.name}! 🎉\n\nSeja bem-vindo(a) à *${brandName}*!\n\nSeu plano: *${planName}*\n📅 Vencimento: *${formattedExpDate}*\n\nSeus dados de acesso:\n📱 Dispositivo: ${client.device || 'N/A'}\n👤 Usuário: ${client.login || 'N/A'}\n🔑 Senha: ${client.password || 'N/A'}\n\nQualquer dúvida, estamos à disposição!\n\n🎬 *${brandName}* - Sua melhor experiência!`,
      renewal: `Olá ${client.name}! ✅\n\n*${brandName}* informa: Seu plano *${planName}* foi renovado com sucesso!\n\n📅 Nova data de vencimento: *${format(addDays(new Date(), 30), 'dd/MM/yyyy')}*\n\nAgradecemos pela confiança!\n\n🎬 *${brandName}* - Sua melhor experiência!`,
      reminder: `Olá ${client.name}! ⏰\n\n*${brandName}* lembra: Seu plano *${planName}* vence em *${formattedExpDate}*.\n\nEvite a interrupção do serviço renovando antecipadamente!\n\n🎬 *${brandName}* - Sua melhor experiência!`,
      unpaid: `Olá ${client.name}! 👋\n\nNotamos que seu pagamento do plano *${planName}* (*${price}*) ainda está pendente.\n\n⚠️ *Atenção:* Se o pagamento não for realizado até o vencimento, será necessário pagar *2 meses* no próximo mês.\n\n📅 Vencimento: *${formattedExpDate}*\n\nPor favor, regularize sua situação para evitar a interrupção do serviço.\n\nQualquer dúvida, estamos à disposição! 🙏\n\n🎬 *${brandName}*`,
    };
    return messages[type];
  };

  const getMessageForClient = (client: Client) => {
    const customTemplate = templates.find((t) => t.type === messageType && t.is_default);
    if (customTemplate) {
      return replaceVariables(customTemplate.message, client);
    }
    return getDefaultMessage(messageType, client);
  };

  const formatPhone = (phone: string) => {
    return phone.replace(/\D/g, '');
  };

  const getClientsToMessage = () => {
    return filteredClients.filter((c) => selectedClients.has(c.id));
  };

  const sendMessages = async () => {
    const clientsToMessage = getClientsToMessage();
    
    if (clientsToMessage.length === 0) {
      toast.error('Selecione pelo menos um cliente');
      return;
    }

    if (sendMode === 'manual') {
      // Start manual sending mode
      setIsManualSending(true);
      setCurrentIndex(0);
      setSentCount(0);
      return;
    }

    // Auto mode - send all with delay
    setIsSending(true);
    setSentCount(0);

    for (let i = 0; i < clientsToMessage.length; i++) {
      const client = clientsToMessage[i];
      const message = getMessageForClient(client);
      const phone = formatPhone(client.phone!);
      
      window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank');
      setSentCount(i + 1);
      
      if (i < clientsToMessage.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }

    setIsSending(false);
    toast.success(`${clientsToMessage.length} mensagens enviadas!`);
    onOpenChange(false);
    setSelectedClients(new Set());
  };

  const sendCurrentMessage = () => {
    const clientsToMessage = getClientsToMessage();
    const client = clientsToMessage[currentIndex];
    
    if (!client) return;
    
    const message = getMessageForClient(client);
    const phone = formatPhone(client.phone!);
    
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank');
    setSentCount(currentIndex + 1);
  };

  const goToNext = () => {
    const clientsToMessage = getClientsToMessage();
    if (currentIndex < clientsToMessage.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Finished all
      toast.success(`${clientsToMessage.length} mensagens enviadas!`);
      setIsManualSending(false);
      setCurrentIndex(0);
      setSentCount(0);
      onOpenChange(false);
      setSelectedClients(new Set());
    }
  };

  const cancelManualSending = () => {
    setIsManualSending(false);
    setCurrentIndex(0);
    setSentCount(0);
    if (sentCount > 0) {
      toast.info(`${sentCount} mensagens foram enviadas`);
    }
  };

  const messageTypeLabels = {
    billing: { label: 'Cobrança', icon: MessageCircle, color: 'text-yellow-500' },
    reminder: { label: 'Lembrete', icon: Clock, color: 'text-orange-500' },
    renewal: { label: 'Renovação', icon: CheckCircle, color: 'text-green-500' },
    welcome: { label: 'Boas-vindas', icon: Users, color: 'text-blue-500' },
    unpaid: { label: 'Inadimplente', icon: AlertCircle, color: 'text-red-500' },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            Mensagens em Massa
          </DialogTitle>
          <DialogDescription>
            Envie mensagens personalizadas para múltiplos clientes via WhatsApp
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Filters */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Mensagem</label>
              <Select value={messageType} onValueChange={(v) => setMessageType(v as MessageType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reminder">
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-orange-500" />
                      Lembrete
                    </span>
                  </SelectItem>
                  <SelectItem value="billing">
                    <span className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-yellow-500" />
                      Cobrança
                    </span>
                  </SelectItem>
                  <SelectItem value="unpaid">
                    <span className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      Inadimplente
                    </span>
                  </SelectItem>
                  <SelectItem value="renewal">
                    <span className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Renovação
                    </span>
                  </SelectItem>
                  <SelectItem value="welcome">
                    <span className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-500" />
                      Boas-vindas
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Clientes que Vencem em</label>
              <Select value={daysFilter} onValueChange={setDaysFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Não Pagos</SelectItem>
                  <SelectItem value="1">Hoje</SelectItem>
                  <SelectItem value="3">Próximos 3 dias</SelectItem>
                  <SelectItem value="7">Próximos 7 dias</SelectItem>
                  <SelectItem value="15">Próximos 15 dias</SelectItem>
                  <SelectItem value="30">Próximos 30 dias</SelectItem>
                  <SelectItem value="expired">Já vencidos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 col-span-2">
              <label className="text-sm font-medium">Modo de Envio</label>
              <Select value={sendMode} onValueChange={(v) => setSendMode(v as 'auto' | 'manual')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">
                    <span className="flex items-center gap-2">
                      <Play className="w-4 h-4 text-blue-500" />
                      Um por um (recomendado)
                    </span>
                  </SelectItem>
                  <SelectItem value="auto">
                    <span className="flex items-center gap-2">
                      <SkipForward className="w-4 h-4 text-orange-500" />
                      Automático (abre todas as abas)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center gap-4">
              <div className="text-sm">
                <span className="text-muted-foreground">Encontrados: </span>
                <span className="font-semibold">{filteredClients.length}</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Selecionados: </span>
                <span className="font-semibold text-primary">{selectedClients.size}</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleAll}
              disabled={filteredClients.length === 0}
            >
              {selectedClients.size === filteredClients.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
            </Button>
          </div>

          {/* Client list */}
          <ScrollArea className="flex-1 border rounded-lg">
            <div className="p-2 space-y-1">
              {filteredClients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum cliente encontrado com telefone cadastrado</p>
                </div>
              ) : (
                filteredClients.map((client) => {
                  const daysLeft = getDaysUntilExpiration(client.expiration_date);
                  const status = getClientStatus(client.expiration_date);
                  const isSelected = selectedClients.has(client.id);

                  return (
                    <div
                      key={client.id}
                      onClick={() => toggleClient(client.id)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all",
                        isSelected
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-muted/50 border border-transparent"
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleClient(client.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{client.name}</span>
                          {client.plan_name && (
                            <span className="text-xs text-muted-foreground">• {client.plan_name}</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{client.phone}</div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 text-xs",
                          status === 'expired' && "status-expired",
                          status === 'expiring' && "status-expiring",
                          status === 'active' && "status-active"
                        )}
                      >
                        {daysLeft < 0
                          ? `${Math.abs(daysLeft)}d atrás`
                          : daysLeft === 0
                          ? 'Hoje'
                          : `${daysLeft}d`}
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {/* Preview */}
          {selectedClients.size > 0 && filteredClients.length > 0 && (
            <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MessageCircle className="w-4 h-4 text-green-500" />
                Prévia da mensagem
              </div>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                {(() => {
                  const selectedClient = filteredClients.find((c) => selectedClients.has(c.id));
                  if (selectedClient) {
                    return getMessageForClient(selectedClient);
                  }
                  return '';
                })()}
              </p>
            </div>
          )}

          {/* Manual Sending Mode UI */}
          {isManualSending && (
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                    {currentIndex + 1}
                  </div>
                  <div>
                    <p className="font-medium">{getClientsToMessage()[currentIndex]?.name}</p>
                    <p className="text-xs text-muted-foreground">{getClientsToMessage()[currentIndex]?.phone}</p>
                  </div>
                </div>
                <Badge variant="outline">
                  {currentIndex + 1} de {getClientsToMessage().length}
                </Badge>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={cancelManualSending}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={sendCurrentMessage}
                  className="flex-1"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Enviar Mensagem
                </Button>
                <Button 
                  onClick={goToNext}
                  variant={currentIndex < getClientsToMessage().length - 1 ? "secondary" : "default"}
                  className="flex-1"
                >
                  {currentIndex < getClientsToMessage().length - 1 ? (
                    <>
                      <SkipForward className="w-4 h-4 mr-2" />
                      Próximo
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Finalizar
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Actions */}
          {!isManualSending && (
            <div className="flex items-center justify-between pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                {isSending && `Enviando ${sentCount}/${selectedClients.size}...`}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
                  Cancelar
                </Button>
                <Button
                  onClick={sendMessages}
                  disabled={selectedClients.size === 0 || isSending}
                  className="min-w-[140px]"
                >
                  {isSending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      {sendMode === 'manual' ? 'Iniciar Envio' : `Enviar (${selectedClients.size})`}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
