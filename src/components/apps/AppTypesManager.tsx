import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  Tv,
  Mail,
  Wifi,
} from 'lucide-react';
import { toast } from 'sonner';
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

interface AppType {
  id: string;
  name: string;
  uses_email: boolean;
}

export function AppTypesManager() {
  const { user } = useAuth();
  const [appTypes, setAppTypes] = useState<AppType[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newUsesEmail, setNewUsesEmail] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUsesEmail, setEditUsesEmail] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchAppTypes = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_types')
        .select('*')
        .eq('seller_id', user.id)
        .order('name');
      
      if (error) throw error;
      setAppTypes(data || []);
    } catch (err) {
      console.error('Error fetching app types:', err);
      toast.error('Erro ao carregar tipos de aplicativos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppTypes();
  }, [user]);

  const handleAdd = async () => {
    if (!user || !newName.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('app_types')
        .insert({
          seller_id: user.id,
          name: newName.trim(),
          uses_email: newUsesEmail,
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('Já existe um aplicativo com esse nome');
          return;
        }
        throw error;
      }

      toast.success('Aplicativo cadastrado!');
      setNewName('');
      setNewUsesEmail(true);
      fetchAppTypes();
    } catch (err) {
      console.error('Error adding app type:', err);
      toast.error('Erro ao cadastrar aplicativo');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (appType: AppType) => {
    setEditingId(appType.id);
    setEditName(appType.name);
    setEditUsesEmail(appType.uses_email);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('app_types')
        .update({
          name: editName.trim(),
          uses_email: editUsesEmail,
        })
        .eq('id', editingId);

      if (error) {
        if (error.code === '23505') {
          toast.error('Já existe um aplicativo com esse nome');
          return;
        }
        throw error;
      }

      toast.success('Aplicativo atualizado!');
      setEditingId(null);
      fetchAppTypes();
    } catch (err) {
      console.error('Error updating app type:', err);
      toast.error('Erro ao atualizar aplicativo');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase
        .from('app_types')
        .delete()
        .eq('id', deleteId);

      if (error) throw error;
      toast.success('Aplicativo excluído!');
      fetchAppTypes();
    } catch (err) {
      console.error('Error deleting app type:', err);
      toast.error('Erro ao excluir aplicativo');
    } finally {
      setDeleteId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add New App Type */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="new-app-name" className="text-sm">Novo Aplicativo</Label>
              <Input
                id="new-app-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome do aplicativo"
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 min-w-[150px]">
                <Switch
                  id="new-uses-email"
                  checked={newUsesEmail}
                  onCheckedChange={setNewUsesEmail}
                />
                <Label htmlFor="new-uses-email" className="text-xs flex items-center gap-1 cursor-pointer">
                  {newUsesEmail ? (
                    <><Mail className="h-3 w-3" /> Email/Senha</>
                  ) : (
                    <><Wifi className="h-3 w-3" /> MAC/ID</>
                  )}
                </Label>
              </div>
              <Button onClick={handleAdd} disabled={!newName.trim() || saving} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* App Types List */}
      {appTypes.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Tv className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Nenhum aplicativo cadastrado</p>
            <p className="text-xs mt-1">Adicione os aplicativos que você vende aos seus clientes</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {appTypes.map((appType) => (
            <Card key={appType.id}>
              <CardContent className="p-3">
                {editingId === appType.id ? (
                  <div className="flex items-center gap-3 flex-wrap">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 min-w-[150px] h-8"
                    />
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={editUsesEmail}
                        onCheckedChange={setEditUsesEmail}
                      />
                      <Label className="text-xs flex items-center gap-1 cursor-pointer">
                        {editUsesEmail ? (
                          <><Mail className="h-3 w-3" /> Email/Senha</>
                        ) : (
                          <><Wifi className="h-3 w-3" /> MAC/ID</>
                        )}
                      </Label>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveEdit} disabled={saving}>
                        <Save className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Tv className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">{appType.name}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5">
                        {appType.uses_email ? (
                          <><Mail className="h-2.5 w-2.5" /> Email/Senha</>
                        ) : (
                          <><Wifi className="h-2.5 w-2.5" /> MAC/ID</>
                        )}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(appType)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-7 w-7 text-destructive hover:text-destructive" 
                        onClick={() => setDeleteId(appType.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Aplicativo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este tipo de aplicativo? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
