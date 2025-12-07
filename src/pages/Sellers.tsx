import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Users, Phone, Calendar, MessageCircle, RefreshCw, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';

interface SellerProfile {
  id: string;
  email: string;
  full_name: string | null;
  whatsapp: string | null;
  created_at: string | null;
}

const sellerSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  full_name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  whatsapp: z.string().min(10, 'WhatsApp inválido').optional().or(z.literal('')),
});

const updateSchema = z.object({
  full_name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  whatsapp: z.string().optional(),
});

type SellerForm = z.infer<typeof sellerSchema>;
type UpdateForm = z.infer<typeof updateSchema>;

interface SellerWithStats extends SellerProfile {
  clientCount: number;
}

// Format phone number as +55 31 95555-5555
const formatWhatsApp = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  
  if (digits.length === 0) return '';
  
  let formatted = '+';
  
  if (digits.length <= 2) {
    formatted += digits;
  } else if (digits.length <= 4) {
    formatted += `${digits.slice(0, 2)} ${digits.slice(2)}`;
  } else if (digits.length <= 9) {
    formatted += `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
  } else {
    formatted += `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
  }
  
  return formatted;
};

export default function Sellers() {
  const [sellers, setSellers] = useState<SellerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSeller, setEditingSeller] = useState<SellerWithStats | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const createForm = useForm<SellerForm>({
    resolver: zodResolver(sellerSchema),
  });

  const updateForm = useForm<UpdateForm>({
    resolver: zodResolver(updateSchema),
  });

  const handleWhatsAppChange = (e: React.ChangeEvent<HTMLInputElement>, formType: 'create' | 'update') => {
    const formatted = formatWhatsApp(e.target.value);
    if (formType === 'create') {
      createForm.setValue('whatsapp', formatted);
    } else {
      updateForm.setValue('whatsapp', formatted);
    }
  };

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

    const sellersWithStats = await Promise.all(
      (profiles || []).map(async (profile) => {
        const { count } = await supabase
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .eq('seller_id', profile.id);

        return { ...profile, clientCount: count || 0 };
      })
    );

    setSellers(sellersWithStats);
    setLoading(false);
  };

  const sendWhatsApp = (whatsapp: string, type: 'billing' | 'renewal' | 'reminder', sellerName: string) => {
    const phone = whatsapp.replace(/\D/g, '');
    
    const messages = {
      billing: `Olá ${sellerName}! 👋\n\nSeu pagamento mensal está pendente.\n\nPor favor, entre em contato para regularizar sua situação.\n\nObrigado!`,
      renewal: `Olá ${sellerName}! 🎉\n\nSeu aplicativo foi renovado com sucesso!\n\nAgradecemos pela confiança e parceria.\n\nQualquer dúvida, estamos à disposição!`,
      reminder: `Olá ${sellerName}! ⏰\n\nEste é um lembrete sobre seu pagamento que vence em breve.\n\nEvite interrupções no serviço realizando o pagamento antecipadamente.\n\nObrigado!`,
    };

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(messages[type])}`, '_blank');
  };

  useEffect(() => { fetchSellers(); }, []);

  useEffect(() => {
    if (editingSeller) {
      updateForm.reset({ 
        full_name: editingSeller.full_name || '',
        whatsapp: editingSeller.whatsapp || ''
      });
    }
  }, [editingSeller, updateForm]);

  const onCreateSubmit = async (data: SellerForm) => {
    setSubmitting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-seller`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session?.access_token}`,
          },
          body: JSON.stringify({
            email: data.email,
            password: data.password,
            full_name: data.full_name,
            whatsapp: data.whatsapp || null,
          }),
        }
      );

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar vendedor');
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
          whatsapp: data.whatsapp || null
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
                      {seller.whatsapp && (
                        <p className="text-sm text-muted-foreground">{seller.whatsapp}</p>
                      )}
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
                      <Calendar className="w-4 h-4" />
                      <span>Cadastrado em</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {seller.created_at ? format(new Date(seller.created_at), 'dd/MM/yyyy') : '-'}
                    </span>
                  </div>
                </div>

                {seller.whatsapp && (
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
                    <Button 
                      variant="whatsapp" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => sendWhatsApp(seller.whatsapp!, 'billing', seller.full_name || 'Vendedor')}
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span className="hidden sm:inline">Cobrança</span>
                    </Button>
                    <Button 
                      variant="whatsapp" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => sendWhatsApp(seller.whatsapp!, 'renewal', seller.full_name || 'Vendedor')}
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span className="hidden sm:inline">Renovação</span>
                    </Button>
                    <Button 
                      variant="whatsapp" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => sendWhatsApp(seller.whatsapp!, 'reminder', seller.full_name || 'Vendedor')}
                    >
                      <Bell className="w-4 h-4" />
                      <span className="hidden sm:inline">Lembrete</span>
                    </Button>
                  </div>
                )}

                <Button variant="outline" size="sm" className="w-full mt-4" onClick={() => setEditingSeller(seller)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Editar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

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
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="whatsapp" 
                    value={createForm.watch('whatsapp') || ''}
                    onChange={(e) => handleWhatsAppChange(e, 'create')}
                    placeholder="+55 31 95555-5555" 
                    className="pl-10" 
                  />
                </div>
                {createForm.formState.errors.whatsapp && (
                  <p className="text-xs text-destructive">{createForm.formState.errors.whatsapp.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha *</Label>
                <Input id="password" type="password" {...createForm.register('password')} placeholder="Mínimo 6 caracteres" />
                {createForm.formState.errors.password && (
                  <p className="text-xs text-destructive">{createForm.formState.errors.password.message}</p>
                )}
              </div>
              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" variant="gradient" className="flex-1" disabled={submitting}>
                  {submitting ? 'Criando...' : 'Criar Vendedor'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

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
                <Label htmlFor="edit_whatsapp">WhatsApp</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="edit_whatsapp" 
                    value={updateForm.watch('whatsapp') || ''}
                    onChange={(e) => handleWhatsAppChange(e, 'update')}
                    placeholder="+55 31 95555-5555" 
                    className="pl-10" 
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setEditingSeller(null)}>Cancelar</Button>
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
