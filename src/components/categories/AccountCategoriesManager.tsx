import { useState } from 'react';
import { useAccountCategories, DEFAULT_CATEGORIES } from '@/hooks/useAccountCategories';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { Plus, Edit, Trash2, Tag, Crown, Terminal, Tv, Radio, Loader2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

const ICON_OPTIONS = [
  { id: 'tag', label: 'Tag', icon: Tag },
  { id: 'crown', label: 'Coroa', icon: Crown },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'tv', label: 'TV', icon: Tv },
  { id: 'radio', label: 'Radio', icon: Radio },
];

const COLOR_OPTIONS = [
  { id: 'gray', label: 'Cinza', class: 'bg-gray-500' },
  { id: 'yellow', label: 'Amarelo', class: 'bg-yellow-500' },
  { id: 'green', label: 'Verde', class: 'bg-green-500' },
  { id: 'blue', label: 'Azul', class: 'bg-blue-500' },
  { id: 'purple', label: 'Roxo', class: 'bg-purple-500' },
  { id: 'red', label: 'Vermelho', class: 'bg-red-500' },
  { id: 'orange', label: 'Laranja', class: 'bg-orange-500' },
  { id: 'pink', label: 'Rosa', class: 'bg-pink-500' },
];

function getIconComponent(iconId: string) {
  const iconOption = ICON_OPTIONS.find(i => i.id === iconId);
  return iconOption?.icon || Tag;
}

function getColorClass(colorId: string) {
  const colorOption = COLOR_OPTIONS.find(c => c.id === colorId);
  return colorOption?.class || 'bg-gray-500';
}

export default function AccountCategoriesManager() {
  const { categories, loading, addCategory, updateCategory, deleteCategory } = useAccountCategories();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    icon: 'tag',
    color: 'gray',
  });

  const handleOpenNew = () => {
    setEditingCategory(null);
    setFormData({ name: '', icon: 'tag', color: 'gray' });
    setDialogOpen(true);
  };

  const handleEdit = (category: { id: string; name: string; icon: string; color: string }) => {
    setEditingCategory(category.id);
    setFormData({ name: category.name, icon: category.icon, color: category.color });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setCategoryToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!categoryToDelete) return;
    await deleteCategory(categoryToDelete);
    setDeleteDialogOpen(false);
    setCategoryToDelete(null);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;

    setSaving(true);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory, formData);
      } else {
        await addCategory(formData.name, formData.icon, formData.color);
      }
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const IconComponent = getIconComponent(formData.icon);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Categorias de Conta
              </CardTitle>
              <CardDescription>
                Crie categorias personalizadas para organizar seus clientes
              </CardDescription>
            </div>
            <Button onClick={handleOpenNew} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nova Categoria
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Default Categories */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Categorias Padrão</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {DEFAULT_CATEGORIES.map((cat) => {
                    const Icon = getIconComponent(cat.icon);
                    return (
                      <div
                        key={cat.id}
                        className={cn(
                          "flex items-center gap-2 p-3 rounded-lg border bg-muted/30",
                          `border-${cat.color}-500/30`
                        )}
                      >
                        <div className={cn("p-1.5 rounded", getColorClass(cat.color))}>
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-sm font-medium">{cat.name}</span>
                        <Lock className="h-3 w-3 text-muted-foreground ml-auto" />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom Categories */}
              {categories.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Suas Categorias</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {categories.map((cat) => {
                      const Icon = getIconComponent(cat.icon);
                      return (
                        <div
                          key={cat.id}
                          className={cn(
                            "flex items-center gap-2 p-3 rounded-lg border bg-card",
                            `border-${cat.color}-500/30`
                          )}
                        >
                          <div className={cn("p-1.5 rounded", getColorClass(cat.color))}>
                            <Icon className="h-4 w-4 text-white" />
                          </div>
                          <span className="text-sm font-medium flex-1">{cat.name}</span>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleEdit({ id: cat.id, name: cat.name, icon: cat.icon, color: cat.color })}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(cat.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {categories.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Você ainda não criou nenhuma categoria personalizada.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Categoria</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Streaming, Games, VPN..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ícone</Label>
                <Select
                  value={formData.icon}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, icon: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <SelectItem key={opt.id} value={opt.id}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {opt.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Cor</Label>
                <Select
                  value={formData.color}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, color: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_OPTIONS.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        <div className="flex items-center gap-2">
                          <div className={cn("h-4 w-4 rounded", opt.class)} />
                          {opt.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Preview</Label>
              <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
                <div className={cn("p-1.5 rounded", getColorClass(formData.color))}>
                  <IconComponent className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-medium">
                  {formData.name || 'Nome da categoria'}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !formData.name.trim()}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Clientes com esta categoria não serão afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
