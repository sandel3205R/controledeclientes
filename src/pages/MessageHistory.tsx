import { RefreshCw, MessageSquare } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageHistoryList } from '@/components/messages/MessageHistoryList';
import { useMessageHistory } from '@/hooks/useMessageHistory';

export default function MessageHistory() {
  const { messages, loading, fetchMessages } = useMessageHistory();

  const stats = {
    total: messages.length,
    sent: messages.filter(m => m.delivery_status === 'sent').length,
    delivered: messages.filter(m => m.delivery_status === 'delivered').length,
    failed: messages.filter(m => m.delivery_status === 'failed').length,
  };

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageSquare className="h-6 w-6" />
              Histórico de Mensagens
            </h1>
            <p className="text-muted-foreground">
              Acompanhe todas as mensagens enviadas aos clientes
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchMessages}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total</CardDescription>
              <CardTitle className="text-2xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Enviadas</CardDescription>
              <CardTitle className="text-2xl text-blue-500">{stats.sent}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Entregues</CardDescription>
              <CardTitle className="text-2xl text-green-500">{stats.delivered}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Falhas</CardDescription>
              <CardTitle className="text-2xl text-red-500">{stats.failed}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Mensagens Recentes</CardTitle>
            <CardDescription>Últimas 100 mensagens enviadas</CardDescription>
          </CardHeader>
          <CardContent>
            <MessageHistoryList messages={messages} loading={loading} />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
