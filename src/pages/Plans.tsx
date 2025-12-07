import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, Package, DollarSign, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const planSchema = z.object({ name: z.string().min(2), price: z.number().min(0), duration_days: z.number().min(1), description: z.string().optional(), is_active: z.boolean() });
type PlanForm = z.infer<typeof planSchema>;
interface Plan { id: string; name: string; price: number; duration_days: number; description: string | null; is_active: boolean; }

export default function Plans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<PlanForm>({ resolver: zodResolver(planSchema), defaultValues: { is_active: true, duration_days: 30, price: 0 } });
  const isActive = watch('is_active');

  const fetchPlans = async () => { const { data } = await supabase.from('plans').select('*').order('price'); setPlans(data || []); setLoading(false); };
  useEffect(() => { fetchPlans(); }, []);
  useEffect(() => { if (editingPlan) reset({ name: editingPlan.name, price: editingPlan.price, duration_days: editingPlan.duration_days, description: editingPlan.description || '', is_active: editingPlan.is_active }); else reset({ name: '', price: 0, duration_days: 30, description: '', is_active: true }); }, [editingPlan, reset]);

  const onSubmit = async (data: PlanForm) => {
    try {
      const payload = { name: data.name, price: data.price, duration_days: data.duration_days, description: data.description || null, is_active: data.is_active };
      if (editingPlan) { const { error } = await supabase.from('plans').update(payload).eq('id', editingPlan.id); if (error) throw error; toast.success('Plano atualizado!'); }
      else { const { error } = await supabase.from('plans').insert([payload]); if (error) throw error; toast.success('Plano criado!'); }
      fetchPlans(); setDialogOpen(false);
    } catch (e: any) { toast.error(e.message || 'Erro'); }
  };

  const handleDelete = async () => { if (!deleteId) return; await supabase.from('plans').delete().eq('id', deleteId); toast.success('Excluído'); fetchPlans(); setDeleteId(null); };

  if (loading) return <AppLayout><div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"><div><h1 className="text-2xl lg:text-3xl font-bold">Planos</h1><p className="text-muted-foreground">Gerencie os planos</p></div><Button variant="gradient" onClick={() => { setEditingPlan(null); setDialogOpen(true); }}><Plus className="w-4 h-4 mr-2" />Novo Plano</Button></div>
        {plans.length === 0 ? <div className="text-center py-16"><p className="text-muted-foreground">Nenhum plano</p><Button variant="gradient" className="mt-4" onClick={() => { setEditingPlan(null); setDialogOpen(true); }}><Plus className="w-4 h-4 mr-2" />Criar primeiro</Button></div> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{plans.map(p => (
            <Card key={p.id} variant="gradient" className={!p.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-2"><div className="flex items-start justify-between"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center"><Package className="w-5 h-5 text-primary-foreground" /></div><div><CardTitle className="text-lg">{p.name}</CardTitle>{!p.is_active && <span className="text-xs text-muted-foreground">Inativo</span>}</div></div></div></CardHeader>
              <CardContent className="space-y-4"><div className="space-y-2"><div className="flex items-center gap-2 text-sm"><DollarSign className="w-4 h-4 text-primary" /><span className="text-2xl font-bold">R$ {p.price.toFixed(2)}</span></div><div className="flex items-center gap-2 text-sm text-muted-foreground"><Calendar className="w-4 h-4" /><span>{p.duration_days} dias</span></div></div>{p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}<div className="flex gap-2 pt-2 border-t border-border"><Button variant="outline" size="sm" className="flex-1" onClick={() => { setEditingPlan(p); setDialogOpen(true); }}><Edit className="w-4 h-4 mr-2" />Editar</Button><Button variant="destructive" size="sm" onClick={() => setDeleteId(p.id)}><Trash2 className="w-4 h-4" /></Button></div></CardContent>
            </Card>
          ))}</div>
        )}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent><DialogHeader><DialogTitle>{editingPlan ? 'Editar' : 'Novo'} Plano</DialogTitle></DialogHeader><form onSubmit={handleSubmit(onSubmit)} className="space-y-4"><div className="space-y-2"><Label>Nome *</Label><Input {...register('name')} />{errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}</div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Preço *</Label><Input type="number" step="0.01" {...register('price', { valueAsNumber: true })} /></div><div className="space-y-2"><Label>Duração (dias) *</Label><Input type="number" {...register('duration_days', { valueAsNumber: true })} /></div></div><div className="space-y-2"><Label>Descrição</Label><Input {...register('description')} /></div><div className="flex items-center justify-between"><Label>Ativo</Label><Switch checked={isActive} onCheckedChange={c => setValue('is_active', c)} /></div><div className="flex gap-2 pt-4"><Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button type="submit" variant="gradient" className="flex-1">Salvar</Button></div></form></DialogContent></Dialog>
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      </div>
    </AppLayout>
  );
}
