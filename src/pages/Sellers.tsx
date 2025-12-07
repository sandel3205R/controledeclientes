import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Edit, Users, Mail, Percent } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Database } from '@/integrations/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];

const sellerSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  full_name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  commission_percentage: z.number().min(0).max(100),
});

const updateSchema = z.object({
  full_name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  commission_percentage: z.number().min(0).max(100),
});

type SellerForm = z.infer<typeof sellerSchema>;
type UpdateForm = z.infer<typeof updateSchema>;

interface SellerWithStats extends Profile {
  clientCount: number;
}

export default function Sellers() {
  const [sellers, setSellers] = useState<SellerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSeller, setEditingSeller] = useState<SellerWithStats | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const createForm = useForm<SellerForm>({
    resolver: zodResolver(sellerSchema),
    defaultValues: {
      commission_percentage: 10,
    },
  });

  const updateForm = useForm<UpdateForm>({
    resolver: zodResolver(updateSchema),
  });

  const fetchSellers = async () => {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Erro ao carregar vendedores');
      setLoading(false);
      return;
    }

    // Get client counts for each seller
    const sellersWithStats = await Promise.all(
      (profiles || []).map(async (profile) => {
        const { count } = await supabase
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .eq('seller_id', profile.id);

        return {
          ...profile,
          clientCount: count || 0,
        };
      })
    );

    setSellers(sellersWithStats);
    setLoading(false);
  };

  useEffect(() => {
    fetchSellers();
  }, []);

  useEffect(() => {
    if (editingSeller) {
      updateForm.reset({
        full_name: editingSeller.full_name || '',
        commission_percentage: Number(editingSeller.commission_percentage) || 0,
      });
    }
  }, [editingSeller, updateForm]);

  const onCreateSubmit = async (data: SellerForm) => {
    setSubmitting(true);
    try {
      // Create user using signup
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.full_name,
          },
        },
      });

      if (signUpError) throw signUpError;

      // Update profile with commission
      if (authData.user) {
        await supabase
          .from('profiles')
          .update({ commission_percentage: data.commission_percentage })
          .eq('id', authData.user.id);
      }

      toast.success('Vendedor criado com sucesso!');
      createForm.reset();
      setDialogOpen(false);
      fetchSellers();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar vendedor');
    } finally {
      setSubmitting(false);
    }
  };

  const onUpdateSubmit = async (data: UpdateForm) => {
    if (!editingSeller) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: data.full_name,
          commission_percentage: data.commission_percentage,
        })
        .eq('id', editingSeller.id);

      if (error) throw error;

      toast.success('Vendedor atualizado com sucesso!');
      setEditingSeller(null);
      fetchSellers();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar vendedor');
    } finally {
      setSubmitting(false);
    }
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
            <h1 className="text-2xl lg:text-3xl font-bold">Vendedores</h1>
            <p className="text-muted-foreground">{sellers.length} vendedores cadastrados</p>
          </div>
          <Button variant="gradient" onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Vendedor
          </Button>
        </div>

        {/* Sellers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sellers.map((seller) => (
            <Card key={seller.id} variant="gradient" className="animate-scale-in">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary to-primary flex items-center justify-center text-lg font-bold text-primary-foreground">
                      {seller.full_name?.charAt(0)?.toUpperCase() || seller.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold">{seller.full_name || 'Sem nome'}</h3>
                      <p className="text-sm text-muted-foreground truncate max-w-[150px]">
                        {seller.email}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>Clientes</span>
                    </div>
                    <Badge variant="secondary">{seller.clientCount}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Percent className="w-4 h-4" />
                      <span>Comissão</span>
                    </div>
                    <Badge variant="outline">{Number(seller.commission_percentage) || 0}%</Badge>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-4"
                  onClick={() => setEditingSeller(seller)}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Editar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Create Seller Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Vendedor</DialogTitle>
            </DialogHeader>

            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome completo *</Label>
                <Input id="full_name" {...createForm.register('full_name')} placeholder="Nome do vendedor" />
                {createForm.formState.errors.full_name && (
                  <p className="text-xs text-destructive">{createForm.formState.errors.full_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    {...createForm.register('email')}
                    placeholder="email@exemplo.com"
                    className="pl-10"
                  />
                </div>
                {createForm.formState.errors.email && (
                  <p className="text-xs text-destructive">{createForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha *</Label>
                <Input
                  id="password"
                  type="password"
                  {...createForm.register('password')}
                  placeholder="Mínimo 6 caracteres"
                />
                {createForm.formState.errors.password && (
                  <p className="text-xs text-destructive">{createForm.formState.errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="commission_percentage">Comissão (%) *</Label>
                <Input
                  id="commission_percentage"
                  type="number"
                  min={0}
                  max={100}
                  {...createForm.register('commission_percentage', { valueAsNumber: true })}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="gradient" className="flex-1" disabled={submitting}>
                  {submitting ? 'Criando...' : 'Criar Vendedor'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Seller Dialog */}
        <Dialog open={!!editingSeller} onOpenChange={() => setEditingSeller(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Vendedor</DialogTitle>
            </DialogHeader>

            <form onSubmit={updateForm.handleSubmit(onUpdateSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit_full_name">Nome completo *</Label>
                <Input id="edit_full_name" {...updateForm.register('full_name')} placeholder="Nome do vendedor" />
                {updateForm.formState.errors.full_name && (
                  <p className="text-xs text-destructive">{updateForm.formState.errors.full_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_commission">Comissão (%) *</Label>
                <Input
                  id="edit_commission"
                  type="number"
                  min={0}
                  max={100}
                  {...updateForm.register('commission_percentage', { valueAsNumber: true })}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setEditingSeller(null)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="gradient" className="flex-1" disabled={submitting}>
                  {submitting ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
