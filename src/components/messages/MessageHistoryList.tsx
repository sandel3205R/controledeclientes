import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageSquare, Check, CheckCheck, X, Clock, Phone, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageHistory } from '@/hooks/useMessageHistory';

interface MessageHistoryListProps {
  messages: MessageHistory[];
  loading: boolean;
}

const statusConfig = {
  sent: { label: 'Enviada', icon: Check, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  delivered: { label: 'Entregue', icon: CheckCheck, color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  failed: { label: 'Falhou', icon: X, color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  pending: { label: 'Pendente', icon: Clock, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
};

const typeLabels: Record<string, string> = {
  welcome: 'Boas-vindas',
  renewal: 'Renovação',
  expiring: 'Vencimento',
  payment: 'Pagamento',
  credentials: 'Credenciais',
  bulk: 'Mensagem em massa',
  custom: 'Personalizada',
};

export function MessageHistoryList({ messages, loading }: MessageHistoryListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            Nenhuma mensagem enviada ainda
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <ScrollArea className="h-[600px] pr-4">
      <div className="space-y-3">
        {messages.map((msg) => {
          const status = statusConfig[msg.delivery_status] || statusConfig.sent;
          const StatusIcon = status.icon;
          
          return (
            <Card key={msg.id} className="hover:bg-muted/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium truncate">{msg.client_name}</span>
                      {msg.client_phone && (
                        <>
                          <Phone className="h-3 w-3 text-muted-foreground ml-2" />
                          <span className="text-sm text-muted-foreground">{msg.client_phone}</span>
                        </>
                      )}
                    </div>
                    
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {msg.message_content}
                    </p>
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {typeLabels[msg.message_type] || msg.message_type}
                      </Badge>
                      <Badge variant="outline" className={`text-xs ${status.color}`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                    <div>{format(new Date(msg.sent_at), "dd/MM/yyyy", { locale: ptBR })}</div>
                    <div>{format(new Date(msg.sent_at), "HH:mm", { locale: ptBR })}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </ScrollArea>
  );
}
