import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Plus, 
  Server, 
  Edit, 
  Trash2, 
  DollarSign, 
  Users,
  TrendingUp,
  CreditCard,
  Calculator
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface ServerData {
  id: string;
  name: string;
  monthly_cost: number;
  credit_cost: number;
  total_credits: number;
  used_credits: number;
  notes: string | null;
  is_active: boolean;
  clients_count?: number;
  total_revenue?: number;
}

interface ClientCount {
  server_id: string;
  count: number;
  revenue: number;
}

export default function Servers() {
  const { user } = useAuth();
  const [servers, setServers] = useState<ServerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<ServerData | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [clientCounts, setClientCounts] = useState<ClientCount[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    monthly_cost: '',
    credit_cost: '',
    total_credits: '',
    notes: '',
  });

  const fetchServers = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('servers')
      .select('*')
      .order('name');

    if (error) {
      toast.error('Erro ao carregar servidores');
      return;
    }

    setServers(data || []);
    setLoading(false);
  };

  const fetchClientCounts = async () => {
    if (!user) return;

    const { data: clients } = await supabase
      .from('clients')
      .select('server_id, plan_price');

    if (clients) {
      const counts: { [key: string]: ClientCount } = {};
      clients.forEach(client => {
        if (client.server_id) {
          if (!counts[client.server_id]) {
            counts[client.server_id] = { server_id: client.server_id, count: 0, revenue: 0 };
          }
          counts[client.server_id].count++;
          counts[client.server_id].revenue += client.plan_price || 0;
        }
      });
      setClientCounts(Object.values(counts));
    }
  };

  useEffect(() => {
    fetchServers();
    fetchClientCounts();
  }, [user]);

  const serversWithStats = useMemo(() => {
    return servers.map(server => {
      const clientData = clientCounts.find(c => c.server_id === server.id);
      return {
        ...server,
        clients_count: clientData?.count || 0,
        total_revenue: clientData?.revenue || 0,
        used_credits: clientData?.count || 0,
      };
    });
  }, [servers, clientCounts]);

  const totalStats = useMemo(() => {
    const totalMonthlyCost = serversWithStats.reduce((acc, s) => acc + (s.monthly_cost || 0), 0);
    const totalCreditCost = serversWithStats.reduce((acc, s) => acc + ((s.credit_cost || 0) * s.used_credits), 0);
    const totalRevenue = serversWithStats.reduce((acc, s) => acc + (s.total_revenue || 0), 0);
    const totalClients = serversWithStats.reduce((acc, s) => acc + (s.clients_count || 0), 0);
    const totalProfit = totalRevenue - totalMonthlyCost - totalCreditCost;

    return { totalMonthlyCost, totalCreditCost, totalRevenue, totalClients, totalProfit };
  }, [serversWithStats]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const serverData = {
      name: formData.name,
      monthly_cost: parseFloat(formData.monthly_cost) || 0,
      credit_cost: parseFloat(formData.credit_cost) || 0,
      total_credits: parseInt(formData.total_credits) || 0,
      notes: formData.notes || null,
      seller_id: user.id,
    };

    try {
      if (editingServer) {
        const { error } = await supabase
          .from('servers')
          .update(serverData)
          .eq('id', editingServer.id);
        if (error) throw error;
        toast.success('Servidor atualizado!');
      } else {
        const { error } = await supabase
          .from('servers')
          .insert([serverData]);
        if (error) throw error;
        toast.success('Servidor criado!');
      }
      setDialogOpen(false);
      resetForm();
      fetchServers();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar servidor');
    }
  };

  const handleEdit = (server: ServerData) => {
    setEditingServer(server);
    setFormData({
      name: server.name,
      monthly_cost: server.monthly_cost?.toString() || '',
      credit_cost: server.credit_cost?.toString() || '',
      total_credits: server.total_credits?.toString() || '',
      notes: server.notes || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    const { error } = await supabase.from('servers').delete().eq('id', deleteId);

    if (error) {
      toast.error('Erro ao excluir servidor');
    } else {
      toast.success('Servidor excluído');
      fetchServers();
    }
    setDeleteId(null);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      monthly_cost: '',
      credit_cost: '',
      total_credits: '',
      notes: '',
    });
    setEditingServer(null);
  };

  const openNewDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Servidores</h1>
            <p className="text-muted-foreground">Gerencie seus servidores e controle custos</p>
          </div>
          <Button variant="gradient" onClick={openNewDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Servidor
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="card-gradient border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Server className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Servidores</p>
                  <p className="text-xl font-bold">{servers.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-gradient border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Clientes</p>
                  <p className="text-xl font-bold">{totalStats.totalClients}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-gradient border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Custo Mensal</p>
                  <p className="text-xl font-bold">R$ {totalStats.totalMonthlyCost.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-gradient border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Receita</p>
                  <p className="text-xl font-bold">R$ {totalStats.totalRevenue.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-gradient border-border/50 col-span-2 lg:col-span-1">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${totalStats.totalProfit >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'} flex items-center justify-center`}>
                  <TrendingUp className={`w-5 h-5 ${totalStats.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Lucro</p>
                  <p className={`text-xl font-bold ${totalStats.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    R$ {totalStats.totalProfit.toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Servers Grid */}
        {serversWithStats.length === 0 ? (
          <div className="text-center py-16">
            <Server className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">Nenhum servidor cadastrado</p>
            <Button variant="gradient" className="mt-4" onClick={openNewDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar servidor
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {serversWithStats.map((server) => {
              const creditUsage = server.total_credits > 0 
                ? (server.used_credits / server.total_credits) * 100 
                : 0;
              const serverCost = (server.monthly_cost || 0) + ((server.credit_cost || 0) * server.used_credits);
              const serverProfit = (server.total_revenue || 0) - serverCost;

              return (
                <Card key={server.id} className="card-gradient border-border/50 overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                          <Server className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{server.name}</CardTitle>
                          <Badge variant={server.is_active ? "default" : "secondary"} className="mt-1">
                            {server.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(server)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(server.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Credits Progress */}
                    {server.total_credits > 0 && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Créditos</span>
                          <span>{server.used_credits} / {server.total_credits}</span>
                        </div>
                        <Progress value={creditUsage} className="h-2" />
                      </div>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                        <p className="text-xs text-muted-foreground">Clientes</p>
                        <p className="text-lg font-semibold">{server.clients_count}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                        <p className="text-xs text-muted-foreground">Mensalidade</p>
                        <p className="text-lg font-semibold">R$ {(server.monthly_cost || 0).toFixed(2)}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                        <p className="text-xs text-muted-foreground">Custo/Crédito</p>
                        <p className="text-lg font-semibold">R$ {(server.credit_cost || 0).toFixed(2)}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                        <p className="text-xs text-muted-foreground">Receita</p>
                        <p className="text-lg font-semibold text-amber-500">R$ {(server.total_revenue || 0).toFixed(2)}</p>
                      </div>
                    </div>

                    {/* Profit */}
                    <div className={`p-4 rounded-lg ${serverProfit >= 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'} border`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calculator className={`w-5 h-5 ${serverProfit >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                          <span className="font-medium">Lucro</span>
                        </div>
                        <span className={`text-xl font-bold ${serverProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          R$ {serverProfit.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {server.notes && (
                      <p className="text-sm text-muted-foreground border-t border-border/30 pt-3">
                        {server.notes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Server Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingServer ? 'Editar Servidor' : 'Novo Servidor'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Servidor *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Servidor Principal"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="monthly_cost">Mensalidade (R$)</Label>
                  <Input
                    id="monthly_cost"
                    type="number"
                    step="0.01"
                    value={formData.monthly_cost}
                    onChange={(e) => setFormData({ ...formData, monthly_cost: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="credit_cost">Custo por Crédito (R$)</Label>
                  <Input
                    id="credit_cost"
                    type="number"
                    step="0.01"
                    value={formData.credit_cost}
                    onChange={(e) => setFormData({ ...formData, credit_cost: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="total_credits">Total de Créditos</Label>
                <Input
                  id="total_credits"
                  type="number"
                  value={formData.total_credits}
                  onChange={(e) => setFormData({ ...formData, total_credits: e.target.value })}
                  placeholder="Ex: 100"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Notas sobre o servidor"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="gradient" className="flex-1">
                  Salvar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir servidor?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. O servidor será removido permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
