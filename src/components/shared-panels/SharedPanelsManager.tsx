import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Plus, Edit, Trash2, Users, AlertCircle, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useSharedPanels, SharedPanel } from '@/hooks/useSharedPanels';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';

interface PanelClient {
  id: string;
  name: string;
  phone: string | null;
  login: string | null;
  password: string | null;
}

export function SharedPanelsManager() {
  const { user } = useAuth();
  const { panels, loading, createPanel, updatePanel, deletePanel, fetchPanels } = useSharedPanels();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addClientDialogOpen, setAddClientDialogOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState<SharedPanel | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedPanel, setSelectedPanel] = useState<SharedPanel | null>(null);
  const [panelClients, setPanelClients] = useState<PanelClient[]>([]);
  const [sharedCredentials, setSharedCredentials] = useState({ login: '', password: '' });
  
  const [formData, setFormData] = useState({ name: '', total_slots: '3' });
  const [clientFormData, setClientFormData] = useState({
    name: '',
    phone: '',
    expiration_date: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingPanel) {
      const success = await updatePanel(editingPanel.id, formData.name, parseInt(formData.total_slots) || 3);
      if (success) {
        toast.success('Painel atualizado!');
        setDialogOpen(false);
        resetForm();
      } else {
        toast.error('Erro ao atualizar painel');
      }
    } else {
      const result = await createPanel(formData.name, parseInt(formData.total_slots) || 3);
      if (result) {
        toast.success('Painel criado!');
        setDialogOpen(false);
        resetForm();
      } else {
        toast.error('Erro ao criar painel');
      }
    }
  };

  const handleEdit = (panel: SharedPanel) => {
    setEditingPanel(panel);
    setFormData({ name: panel.name, total_slots: panel.total_slots.toString() });
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const success = await deletePanel(deleteId);
    if (success) {
      toast.success('Painel excluído');
    } else {
      toast.error('Erro ao excluir painel');
    }
    setDeleteId(null);
  };

  const resetForm = () => {
    setFormData({ name: '', total_slots: '3' });
    setEditingPanel(null);
  };

  const openNewDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openAddClientDialog = async (panel: SharedPanel) => {
    setSelectedPanel(panel);
    
    // Fetch existing clients in this panel to get the shared login/password
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, phone, login, password')
      .eq('shared_panel_id', panel.id)
      .order('created_at');
    
    if (clients && clients.length > 0) {
      setPanelClients(clients);
      // Pre-fill login/password from existing client
      setSharedCredentials({
        login: clients[0].login || '',
        password: clients[0].password || '',
      });
    } else {
      setPanelClients([]);
      setSharedCredentials({ login: '', password: '' });
    }
    
    setClientFormData({
      name: '',
      phone: '',
      expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
    
    setAddClientDialogOpen(true);
  };

  const handleAddClient = async () => {
    if (!user || !selectedPanel) return;

    if (!clientFormData.name.trim()) {
      toast.error('Nome do cliente é obrigatório');
      return;
    }

    if (!clientFormData.expiration_date) {
      toast.error('Data de vencimento é obrigatória');
      return;
    }

    const { error } = await supabase.from('clients').insert({
      seller_id: user.id,
      name: clientFormData.name,
      phone: clientFormData.phone || null,
      expiration_date: clientFormData.expiration_date,
      shared_panel_id: selectedPanel.id,
      login: sharedCredentials.login || null,
      password: sharedCredentials.password || null,
    });

    if (error) {
      console.error('Error adding client:', error);
      toast.error('Erro ao adicionar cliente');
    } else {
      toast.success('Cliente adicionado ao painel!');
      await fetchPanels();
      
      // Check if panel is now full
      const newFilledSlots = (selectedPanel.filled_slots || 0) + 1;
      if (newFilledSlots >= selectedPanel.total_slots) {
        toast.success('Painel completo! Todas as vagas foram preenchidas.');
        setAddClientDialogOpen(false);
      } else {
        // Refresh clients list and update selected panel
        const { data: clients } = await supabase
          .from('clients')
          .select('id, name, phone, login, password')
          .eq('shared_panel_id', selectedPanel.id)
          .order('created_at');
        if (clients) {
          setPanelClients(clients);
        }
        
        // Reset form for next client
        setClientFormData({
          name: '',
          phone: '',
          expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        });
        
        // Update selected panel slots count
        setSelectedPanel({
          ...selectedPanel,
          filled_slots: newFilledSlots,
        });
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Only show panels with available slots
  const panelsWithAvailableSlots = panels.filter(p => (p.filled_slots || 0) < p.total_slots);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Painéis Compartilhados</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie créditos que servem para múltiplos clientes
          </p>
        </div>
        <Button variant="gradient" size="sm" onClick={openNewDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Painel
        </Button>
      </div>

      {panelsWithAvailableSlots.length > 0 && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-500">Vagas Disponíveis</AlertTitle>
          <AlertDescription className="text-amber-400">
            {panelsWithAvailableSlots.length} painel(is) com vagas para preencher
          </AlertDescription>
        </Alert>
      )}

      {panelsWithAvailableSlots.length === 0 ? (
        <div className="text-center py-8">
          <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground text-sm">
            {panels.length === 0 
              ? 'Nenhum painel compartilhado' 
              : 'Todos os painéis estão completos!'
            }
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={openNewDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Criar painel
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {panelsWithAvailableSlots.map((panel) => {
            const filledSlots = panel.filled_slots || 0;
            const availableSlots = panel.total_slots - filledSlots;
            const progress = (filledSlots / panel.total_slots) * 100;

            return (
              <Card 
                key={panel.id} 
                className="card-gradient border-amber-500/30 ring-1 ring-amber-500/20"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{panel.name}</CardTitle>
                      <Badge variant="secondary" className="mt-1 bg-amber-500/20 text-amber-500">
                        {availableSlots} vaga(s) disponível(is)
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(panel)}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(panel.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Ocupação</span>
                      <span className="text-amber-500 font-medium">
                        {filledSlots} / {panel.total_slots}
                      </span>
                    </div>
                    <Progress 
                      value={progress} 
                      className="h-2 [&>div]:bg-amber-500"
                    />
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-amber-500/30 hover:bg-amber-500/10"
                    onClick={() => openAddClientDialog(panel)}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Adicionar Cliente ({availableSlots} vaga{availableSlots !== 1 ? 's' : ''})
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Panel Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingPanel ? 'Editar Painel' : 'Novo Painel'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="panel_name">Nome do Painel *</Label>
              <Input
                id="panel_name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Crédito Server X"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="total_slots">Total de Vagas</Label>
              <Input
                id="total_slots"
                type="number"
                min="1"
                max="10"
                value={formData.total_slots}
                onChange={(e) => setFormData({ ...formData, total_slots: e.target.value })}
                placeholder="3"
              />
              <p className="text-xs text-muted-foreground">Quantos clientes cabem neste crédito</p>
            </div>
            <div className="flex gap-2 pt-2">
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

      {/* Add Client to Panel Dialog */}
      <Dialog open={addClientDialogOpen} onOpenChange={setAddClientDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Adicionar Cliente - {selectedPanel?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {panelClients.length > 0 && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Clientes neste painel:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {panelClients.map(client => (
                    <li key={client.id}>• {client.name}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="client-name">Nome do Cliente *</Label>
              <Input
                id="client-name"
                value={clientFormData.name}
                onChange={(e) => setClientFormData({ ...clientFormData, name: e.target.value })}
                placeholder="Nome do cliente"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="client-phone">Telefone</Label>
              <Input
                id="client-phone"
                value={clientFormData.phone}
                onChange={(e) => setClientFormData({ ...clientFormData, phone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="client-expiration">Data de Vencimento *</Label>
              <Input
                id="client-expiration"
                type="date"
                value={clientFormData.expiration_date}
                onChange={(e) => setClientFormData({ ...clientFormData, expiration_date: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="shared-login">Login Compartilhado</Label>
                <Input
                  id="shared-login"
                  value={sharedCredentials.login}
                  onChange={(e) => setSharedCredentials({ ...sharedCredentials, login: e.target.value })}
                  placeholder="Login"
                  disabled={panelClients.length > 0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shared-password">Senha Compartilhada</Label>
                <Input
                  id="shared-password"
                  value={sharedCredentials.password}
                  onChange={(e) => setSharedCredentials({ ...sharedCredentials, password: e.target.value })}
                  placeholder="Senha"
                  disabled={panelClients.length > 0}
                />
              </div>
            </div>
            
            {panelClients.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Login/senha são compartilhados com os clientes existentes
              </p>
            )}

            {selectedPanel && (
              <div className="p-3 bg-primary/10 rounded-lg">
                <p className="text-sm">
                  Vagas restantes após adicionar: {' '}
                  <span className="font-bold">
                    {selectedPanel.total_slots - (selectedPanel.filled_slots || 0) - 1}
                  </span>
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddClientDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddClient}>
              <UserPlus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir painel?</AlertDialogTitle>
            <AlertDialogDescription>
              O painel será removido. Os clientes vinculados não serão excluídos.
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
  );
}
