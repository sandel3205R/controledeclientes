import { useState } from 'react';
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
import { Plus, Edit, Trash2, Users, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useSharedPanels, SharedPanel } from '@/hooks/useSharedPanels';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function SharedPanelsManager() {
  const { panels, loading, createPanel, updatePanel, deletePanel } = useSharedPanels();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState<SharedPanel | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', total_slots: '3' });

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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

      {panels.length === 0 ? (
        <div className="text-center py-8">
          <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground text-sm">Nenhum painel compartilhado</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={openNewDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Criar painel
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {panels.map((panel) => {
            const filledSlots = panel.filled_slots || 0;
            const availableSlots = panel.total_slots - filledSlots;
            const progress = (filledSlots / panel.total_slots) * 100;
            const isComplete = availableSlots === 0;

            return (
              <Card 
                key={panel.id} 
                className={`card-gradient border-border/50 ${!isComplete ? 'border-amber-500/30 ring-1 ring-amber-500/20' : 'border-green-500/30'}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{panel.name}</CardTitle>
                      <Badge variant={isComplete ? "default" : "secondary"} className="mt-1">
                        {isComplete ? '✓ Completo' : `${availableSlots} vaga(s)`}
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
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Ocupação</span>
                      <span className={!isComplete ? 'text-amber-500 font-medium' : 'text-green-500 font-medium'}>
                        {filledSlots} / {panel.total_slots}
                      </span>
                    </div>
                    <Progress 
                      value={progress} 
                      className={`h-2 ${isComplete ? '[&>div]:bg-green-500' : '[&>div]:bg-amber-500'}`}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog */}
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
