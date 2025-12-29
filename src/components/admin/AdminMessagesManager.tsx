import { useState } from 'react';
import { useAdminMessages, AdminMessage } from '@/hooks/useAdminMessages';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Megaphone,
  Plus,
  Edit,
  Trash2,
  Loader2,
  AlertTriangle,
  Info,
  AlertCircle,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const PRIORITY_OPTIONS = [
  { id: 'low', label: 'Baixa', icon: Info, color: 'text-muted-foreground' },
  { id: 'normal', label: 'Normal', icon: Bell, color: 'text-blue-500' },
  { id: 'high', label: 'Alta', icon: AlertCircle, color: 'text-yellow-500' },
  { id: 'urgent', label: 'Urgente', icon: AlertTriangle, color: 'text-destructive' },
];

function getPriorityConfig(priority: string) {
  return PRIORITY_OPTIONS.find(p => p.id === priority) || PRIORITY_OPTIONS[1];
}

export default function AdminMessagesManager() {
  const { messages, loading, createMessage, updateMessage, deleteMessage, toggleActive } = useAdminMessages();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState<AdminMessage | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    message: '',
    priority: 'normal',
    expires_at: '',
  });

  const handleOpenNew = () => {
    setEditingMessage(null);
    setFormData({ title: '', message: '', priority: 'normal', expires_at: '' });
    setDialogOpen(true);
  };

  const handleEdit = (msg: AdminMessage) => {
    setEditingMessage(msg);
    setFormData({
      title: msg.title,
      message: msg.message,
      priority: msg.priority,
      expires_at: msg.expires_at ? format(new Date(msg.expires_at), 'yyyy-MM-dd') : '',
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setMessageToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!messageToDelete) return;
    await deleteMessage(messageToDelete);
    setDeleteDialogOpen(false);
    setMessageToDelete(null);
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.message.trim()) return;

    setSaving(true);
    try {
      if (editingMessage) {
        await updateMessage(editingMessage.id, {
          title: formData.title,
          message: formData.message,
          priority: formData.priority as any,
          expires_at: formData.expires_at || null,
        });
      } else {
        await createMessage({
          title: formData.title,
          message: formData.message,
          priority: formData.priority,
          expires_at: formData.expires_at || null,
        });
      }
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Megaphone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Mensagens para Vendedores</CardTitle>
                <CardDescription>
                  Envie comunicados e avisos importantes para todos os vendedores
                </CardDescription>
              </div>
            </div>
            <Button onClick={handleOpenNew} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nova Mensagem
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Nenhuma mensagem enviada ainda.</p>
              <p className="text-sm">Clique em "Nova Mensagem" para criar um comunicado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => {
                const priorityConfig = getPriorityConfig(msg.priority);
                const PriorityIcon = priorityConfig.icon;
                const isExpired = msg.expires_at && new Date(msg.expires_at) < new Date();

                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "p-4 rounded-lg border transition-all",
                      msg.is_active && !isExpired
                        ? "bg-card border-border"
                        : "bg-muted/30 border-muted opacity-60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <PriorityIcon className={cn("h-4 w-4", priorityConfig.color)} />
                          <h4 className="font-semibold truncate">{msg.title}</h4>
                          <Badge variant={msg.is_active && !isExpired ? 'default' : 'secondary'} className="text-xs">
                            {isExpired ? 'Expirada' : msg.is_active ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{msg.message}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>Criada: {format(new Date(msg.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                          {msg.expires_at && (
                            <span>Expira: {format(new Date(msg.expires_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={msg.is_active}
                          onCheckedChange={(checked) => toggleActive(msg.id, checked)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(msg)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(msg.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingMessage ? 'Editar Mensagem' : 'Nova Mensagem'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Atualização do Sistema"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Mensagem *</Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Digite o conteúdo da mensagem..."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, priority: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <SelectItem key={opt.id} value={opt.id}>
                          <div className="flex items-center gap-2">
                            <Icon className={cn("h-4 w-4", opt.color)} />
                            {opt.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expires_at">Expira em (opcional)</Label>
                <Input
                  id="expires_at"
                  type="date"
                  value={formData.expires_at}
                  onChange={(e) => setFormData(prev => ({ ...prev, expires_at: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={saving || !formData.title.trim() || !formData.message.trim()}
            >
              {saving ? 'Salvando...' : editingMessage ? 'Atualizar' : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover mensagem?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A mensagem será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
