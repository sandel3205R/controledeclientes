import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, Edit, Users, Phone, Calendar, MessageCircle, RefreshCw, Bell, Mail, Trash2, RotateCcw, Archive, Crown, Clock, Gift, CreditCard, Settings2, Search, KeyRound } from 'lucide-react';

import { TempPasswordDialog } from '@/components/sellers/TempPasswordDialog';

import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addDays, differenceInDays } from 'date-fns';

interface SellerProfile {
  id: string;
  email: string;
  full_name: string | null;
  whatsapp: string | null;
  created_at: string | null;
  is_active: boolean | null;
  deleted_at: string | null;
  subscription_expires_at: string | null;
  is_permanent: boolean | null;
  seller_plan_id: string | null;
  has_unlimited_clients: boolean | null;
}

const sellerSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  full_name: z.string().min(2, 'Nome/Empresa é obrigatório'),
  whatsapp: z.string().optional().or(z.literal('')),
  plan_type: z.enum(['trial', 'active']),
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
  const [trashedSellers, setTrashedSellers] = useState<SellerWithStats[]>([]);
  const [expiredSellers, setExpiredSellers] = useState<SellerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSeller, setEditingSeller] = useState<SellerWithStats | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<SellerWithStats | null>(null);
  const [permanentDeleteConfirm, setPermanentDeleteConfirm] = useState<SellerWithStats | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState<SellerWithStats | null>(null);
  
  const [emptyTrashConfirm, setEmptyTrashConfirm] = useState(false);
  const [emptyingTrash, setEmptyingTrash] = useState(false);
  const [retentionDays, setRetentionDays] = useState(30);
  
  const [expiredFilter, setExpiredFilter] = useState<'all' | '7' | '15' | '30'>('all');
  const [moveToTrashConfirm, setMoveToTrashConfirm] = useState<SellerWithStats | null>(null);
  const [tempPasswordSeller, setTempPasswordSeller] = useState<SellerWithStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [daysFilter, setDaysFilter] = useState<'all' | '3' | '7' | '15' | '30'>('all');
  
  // Confirmation states for plan actions
  const [makePermanentConfirm, setMakePermanentConfirm] = useState<SellerWithStats | null>(null);
  const [removePermanentConfirm, setRemovePermanentConfirm] = useState<SellerWithStats | null>(null);
  const [activatePlanConfirm, setActivatePlanConfirm] = useState<{ seller: SellerWithStats; days: number } | null>(null);
  const createForm = useForm<SellerForm>({
    resolver: zodResolver(sellerSchema),
    defaultValues: {
      email: '',
      password: '',
      full_name: '',
      whatsapp: '',
      plan_type: 'trial',
    }
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
    // Fetch retention days setting
    const { data: settingsData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'trash_retention_days')
      .maybeSingle();
    
    if (settingsData) {
      setRetentionDays(parseInt(settingsData.value) || 30);
    }

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

        return { 
          ...profile, 
          clientCount: count || 0,
          is_active: profile.is_active ?? true
        } as SellerWithStats;
      })
    );

    // Separate active, expired and trashed sellers
    const now = new Date();
    const active = sellersWithStats.filter(s => {
      if (s.deleted_at) return false;
      if (s.is_permanent) return true;
      if (!s.subscription_expires_at) return false;
      return new Date(s.subscription_expires_at) >= now;
    });
    
    const expired = sellersWithStats.filter(s => {
      if (s.deleted_at) return false;
      if (s.is_permanent) return false;
      if (!s.subscription_expires_at) return true; // No plan = expired
      return new Date(s.subscription_expires_at) < now;
    });
    
    const trashed = sellersWithStats.filter(s => s.deleted_at);

    setSellers(active);
    setExpiredSellers(expired);
    setTrashedSellers(trashed);
    setLoading(false);
  };

  // Filter expired sellers by days
  const filteredExpiredSellers = expiredSellers.filter(seller => {
    if (expiredFilter === 'all') return true;
    
    const now = new Date();
    const expiredAt = seller.subscription_expires_at ? new Date(seller.subscription_expires_at) : now;
    const daysExpired = differenceInDays(now, expiredAt);
    
    switch (expiredFilter) {
      case '7': return daysExpired <= 7;
      case '15': return daysExpired <= 15;
      case '30': return daysExpired <= 30;
      default: return true;
    }
  });

  const handleMoveExpiredToTrash = async (seller: SellerWithStats) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .eq('id', seller.id);

      if (error) throw error;

      toast.success('Vendedor movido para a lixeira!');
      setMoveToTrashConfirm(null);
      fetchSellers();
    } catch (error: any) {
      toast.error('Erro ao mover vendedor para lixeira');
    }
  };

  // Filter sellers by search and days
  const filterSellers = (sellersList: SellerWithStats[]) => {
    return sellersList.filter(seller => {
      // Search filter
      const matchesSearch = searchQuery === '' || 
        seller.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        seller.email.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;
      
      // Days filter (subscription days remaining)
      if (daysFilter === 'all') return true;
      
      if (seller.is_permanent) return true;
      if (!seller.subscription_expires_at) return false;
      
      const now = new Date();
      const expiresAt = new Date(seller.subscription_expires_at);
      const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysRemaining < 0) return false; // Expired
      
      switch (daysFilter) {
        case '3': return daysRemaining <= 3;
        case '7': return daysRemaining <= 7;
        case '15': return daysRemaining <= 15;
        case '30': return daysRemaining <= 30;
        default: return true;
      }
    });
  };

  const filteredActiveSellers = filterSellers(sellers);

  const toggleSellerActive = async (sellerId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: isActive })
        .eq('id', sellerId);

      if (error) throw error;

      toast.success(isActive ? 'Vendedor ativado!' : 'Vendedor desativado!');
      setSellers(prev => prev.map(s => s.id === sellerId ? { ...s, is_active: isActive } : s));
    } catch (error: any) {
      toast.error('Erro ao alterar status do vendedor');
    }
  };

  const handleDelete = async (seller: SellerWithStats) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .eq('id', seller.id);

      if (error) throw error;

      toast.success('Vendedor movido para a lixeira!');
      setDeleteConfirm(null);
      fetchSellers();
    } catch (error: any) {
      toast.error('Erro ao remover vendedor');
    }
  };

  const handleRestore = async (seller: SellerWithStats) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ deleted_at: null, is_active: true })
        .eq('id', seller.id);

      if (error) throw error;

      toast.success('Vendedor restaurado com sucesso!');
      setRestoreConfirm(null);
      fetchSellers();
    } catch (error: any) {
      toast.error('Erro ao restaurar vendedor');
    }
  };

  const handlePermanentDelete = async (seller: SellerWithStats) => {
    try {
      // First delete all clients of this seller
      const { error: clientsError } = await supabase
        .from('clients')
        .delete()
        .eq('seller_id', seller.id);

      if (clientsError) throw clientsError;

      // Delete servers of this seller
      const { error: serversError } = await supabase
        .from('servers')
        .delete()
        .eq('seller_id', seller.id);

      if (serversError) throw serversError;

      // Delete whatsapp templates of this seller
      const { error: templatesError } = await supabase
        .from('whatsapp_templates')
        .delete()
        .eq('seller_id', seller.id);

      if (templatesError) throw templatesError;

      // Delete user role
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', seller.id);

      if (roleError) throw roleError;

      // Finally delete the profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', seller.id);

      if (profileError) throw profileError;

      toast.success('Vendedor excluído permanentemente!');
      setPermanentDeleteConfirm(null);
      fetchSellers();
    } catch (error: any) {
      console.error('Error permanently deleting seller:', error);
      toast.error('Erro ao excluir vendedor permanentemente');
    }
  };

  const handleEmptyTrash = async () => {
    setEmptyingTrash(true);
    try {
      let deletedCount = 0;
      for (const seller of trashedSellers) {
        // Delete all associated data
        await supabase.from('clients').delete().eq('seller_id', seller.id);
        await supabase.from('servers').delete().eq('seller_id', seller.id);
        await supabase.from('whatsapp_templates').delete().eq('seller_id', seller.id);
        await supabase.from('user_roles').delete().eq('user_id', seller.id);
        
        const { error } = await supabase.from('profiles').delete().eq('id', seller.id);
        if (!error) deletedCount++;
      }

      toast.success(`${deletedCount} vendedores excluídos permanentemente!`);
      setEmptyTrashConfirm(false);
      fetchSellers();
    } catch (error: any) {
      console.error('Error emptying trash:', error);
      toast.error('Erro ao esvaziar lixeira');
    } finally {
      setEmptyingTrash(false);
    }
  };

  const activatePlan = async (sellerId: string, days: number = 30) => {
    try {
      // Find the seller to check current expiration
      const allSellers = [...sellers, ...expiredSellers];
      const seller = allSellers.find(s => s.id === sellerId);
      
      let baseDate = new Date();
      
      // If seller has an active (future) subscription, add days to that date
      if (seller?.subscription_expires_at) {
        const currentExpiration = new Date(seller.subscription_expires_at);
        if (currentExpiration > baseDate) {
          baseDate = currentExpiration;
        }
      }
      
      const newExpiration = addDays(baseDate, days);
      const { error } = await supabase
        .from('profiles')
        .update({ subscription_expires_at: newExpiration.toISOString() })
        .eq('id', sellerId);

      if (error) throw error;

      toast.success(`Plano de ${days} dias ativado com sucesso!`);
      fetchSellers();
    } catch (error: any) {
      console.error('Erro ao ativar plano:', error);
      toast.error('Erro ao ativar plano');
    }
  };

  const makePermanent = async (sellerId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_permanent: true, subscription_expires_at: null })
        .eq('id', sellerId);

      if (error) throw error;

      toast.success('Vendedor agora é permanente!');
      fetchSellers();
    } catch (error: any) {
      toast.error('Erro ao tornar permanente');
    }
  };

  const removePermanent = async (sellerId: string) => {
    try {
      // Set 30 days from now as the new expiration
      const newExpiration = addDays(new Date(), 30);
      const { error } = await supabase
        .from('profiles')
        .update({ is_permanent: false, subscription_expires_at: newExpiration.toISOString() })
        .eq('id', sellerId);

      if (error) throw error;

      toast.success('Status permanente removido! Plano de 30 dias ativado.');
      fetchSellers();
    } catch (error: any) {
      toast.error('Erro ao remover status permanente');
    }
  };

  const getSubscriptionStatus = (seller: SellerWithStats) => {
    if (seller.is_permanent) {
      return { label: 'Permanente', class: 'bg-primary/20 text-primary', icon: Crown };
    }
    if (!seller.subscription_expires_at) {
      return { label: 'Sem plano', class: 'bg-destructive/20 text-destructive', icon: Clock };
    }
    const expiresAt = new Date(seller.subscription_expires_at);
    const now = new Date();
    const isExpired = expiresAt < now;
    
    // Use Math.ceil to match the calculation in useAuth.tsx
    const diffMs = expiresAt.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (isExpired) {
      return { label: 'Expirado', class: 'bg-destructive/20 text-destructive', icon: Clock };
    }
    if (daysRemaining <= 3) {
      return { label: `${daysRemaining}d restantes`, class: 'bg-yellow-500/20 text-yellow-600', icon: Clock };
    }
    return { label: `${daysRemaining}d restantes`, class: 'bg-green-500/20 text-green-600', icon: Clock };
  };


  // Message templates with 3 layout options each
  const messageTemplates = {
    billing: {
      1: (name: string) => `Olá ${name}!

💰 PAGAMENTO PENDENTE

Identificamos que seu pagamento mensal está em aberto.

📌 Por favor, entre em contato para regularizar sua situação e evitar interrupções no serviço.

Aguardamos seu retorno!
Atenciosamente, SANDEL`,

      2: (name: string) => `${name}, tudo bem?

Passando para lembrar sobre o pagamento pendente do seu painel.

💳 Valor: [valor]
📅 Vencimento: [data]

Qualquer dúvida, estou à disposição!

Abraço,
SANDEL`,

      3: (name: string) => `Olá ${name}!

🔔 Aviso Importante

Seu pagamento está pendente. Para continuar utilizando o sistema sem interrupções, por favor regularize o quanto antes.

PIX: [chave]

Após o pagamento, envie o comprovante aqui.

SANDEL`
    },
    renewal: {
      1: (name: string) => `Olá ${name}!

✅ RENOVAÇÃO CONFIRMADA

Seu acesso foi renovado com sucesso!

📅 Nova validade: +30 dias

Agradecemos pela confiança e parceria!

Qualquer dúvida, estamos à disposição.
SANDEL`,

      2: (name: string) => `${name}, ótima notícia!

🎉 Pagamento confirmado!

Seu painel foi renovado por mais 30 dias.

Obrigado por continuar conosco!

Boas vendas,
SANDEL`,

      3: (name: string) => `Olá ${name}!

✨ Tudo certo!

Recebemos seu pagamento e seu acesso já está liberado.

📆 Válido até: [nova data]

Conte conosco!
SANDEL`
    },
    reminder: {
      1: (name: string) => `Olá ${name}!

⏰ LEMBRETE DE VENCIMENTO

Seu plano vence em breve!

📅 Data de vencimento: [data]

Para evitar interrupções, realize o pagamento antecipadamente.

Estamos à disposição!
SANDEL`,

      2: (name: string) => `${name}, tudo bem?

Passando para lembrar que seu plano está próximo do vencimento.

⚠️ Faltam poucos dias!

Não deixe para última hora, renove já e continue vendendo sem parar.

SANDEL`,

      3: (name: string) => `Olá ${name}!

📢 Aviso de Renovação

Seu acesso expira em breve.

💡 Dica: Renove com antecedência e evite ficar sem o sistema.

Aguardo seu contato!
SANDEL`
    }
  };

  const [messageLayoutPreference, setMessageLayoutPreference] = useState<{
    billing: 1 | 2 | 3;
    renewal: 1 | 2 | 3;
    reminder: 1 | 2 | 3;
  }>(() => {
    const saved = localStorage.getItem('sellerMessageLayouts');
    return saved ? JSON.parse(saved) : { billing: 1, renewal: 1, reminder: 1 };
  });

  const [messageConfigOpen, setMessageConfigOpen] = useState(false);

  const saveMessagePreference = (type: 'billing' | 'renewal' | 'reminder', layout: 1 | 2 | 3) => {
    const newPrefs = { ...messageLayoutPreference, [type]: layout };
    setMessageLayoutPreference(newPrefs);
    localStorage.setItem('sellerMessageLayouts', JSON.stringify(newPrefs));
    toast.success('Preferência salva!');
  };

  const sendWhatsApp = (whatsapp: string, type: 'billing' | 'renewal' | 'reminder', sellerName: string) => {
    const phone = whatsapp.replace(/\D/g, '');
    const layout = messageLayoutPreference[type];
    const message = messageTemplates[type][layout](sellerName);

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
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
    console.log('Submitting seller data:', data);
    try {
      const { data: result, error } = await supabase.functions.invoke('create-seller', {
        body: {
          email: data.email,
          password: data.password,
          full_name: data.full_name,
          whatsapp: data.whatsapp || null,
          plan_type: data.plan_type,
        },
      });

      console.log('Edge function result:', result, 'error:', error);

      if (error) {
        throw new Error(error.message || 'Erro ao criar vendedor');
      }

      if (result?.error) {
        throw new Error(result.error);
      }

      toast.success('Vendedor criado com sucesso!');
      createForm.reset();
      setDialogOpen(false);
      
      // Wait a bit for the database to propagate the new user before fetching
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchSellers();
    } catch (error: any) {
      console.error('Error creating seller:', error);
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

  const SellerCard = ({ seller, isTrash = false, isExpired = false, onMoveToTrash }: { seller: SellerWithStats; isTrash?: boolean; isExpired?: boolean; onMoveToTrash?: () => void }) => (
    <Card variant="gradient" className={`animate-scale-in ${!seller.is_active ? 'opacity-60' : ''}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary to-primary flex items-center justify-center text-lg font-bold text-primary-foreground">
              {seller.full_name?.charAt(0)?.toUpperCase() || seller.email.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-semibold">{seller.full_name || 'Sem nome'}</h3>
              <p className="text-xs text-muted-foreground">{seller.email}</p>
            </div>
          </div>
          {!isTrash && !isExpired && (
            <div className="flex items-center gap-2">
              <Switch
                checked={seller.is_active ?? true}
                onCheckedChange={(checked) => toggleSellerActive(seller.id, checked)}
              />
              <Badge variant={seller.is_active ? 'default' : 'secondary'}>
                {seller.is_active ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
          )}
          {isExpired && (
            <div className="flex flex-col items-end gap-1">
              <Badge variant="destructive">
                <Clock className="w-3 h-3 mr-1" />
                Vencido
              </Badge>
              {seller.subscription_expires_at && (
                <span className="text-[10px] text-muted-foreground">
                  Desde {format(new Date(seller.subscription_expires_at), 'dd/MM/yyyy')}
                </span>
              )}
            </div>
          )}
          {isTrash && seller.deleted_at && (
            <div className="flex flex-col items-end gap-1">
              <Badge variant="destructive">Na Lixeira</Badge>
              {(() => {
                const deletedDate = new Date(seller.deleted_at);
                const expirationDate = addDays(deletedDate, retentionDays);
                const daysRemaining = differenceInDays(expirationDate, new Date());
                
                if (daysRemaining <= 0) {
                  return (
                    <span className="text-[10px] text-destructive font-medium animate-pulse">
                      Será excluído em breve
                    </span>
                  );
                }
                
                const urgencyClass = daysRemaining <= 7 
                  ? 'text-destructive' 
                  : daysRemaining <= 14 
                    ? 'text-yellow-600' 
                    : 'text-muted-foreground';
                
                return (
                  <span className={`text-[10px] ${urgencyClass} font-medium`}>
                    {daysRemaining} {daysRemaining === 1 ? 'dia' : 'dias'} para exclusão
                  </span>
                );
              })()}
            </div>
          )}
        </div>

        <div className="space-y-3">
          {/* Subscription Status */}
          {!isTrash && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                {(() => {
                  const status = getSubscriptionStatus(seller);
                  const StatusIcon = status.icon;
                  return <StatusIcon className="w-4 h-4" />;
                })()}
                <span>Plano</span>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <Badge className={getSubscriptionStatus(seller).class}>
                  {getSubscriptionStatus(seller).label}
                </Badge>
                {!seller.is_permanent && seller.subscription_expires_at && (
                  <span className="text-[10px] text-muted-foreground">
                    Expira: {format(new Date(seller.subscription_expires_at), 'dd/MM/yyyy')}
                  </span>
                )}
              </div>
            </div>
          )}
          
          
          {seller.whatsapp && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="w-4 h-4" />
                <span>WhatsApp</span>
              </div>
              <span className="text-xs">{seller.whatsapp}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>Clientes</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{seller.clientCount}</Badge>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>{isTrash ? 'Removido em' : 'Cadastrado em'}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {isTrash && seller.deleted_at 
                ? format(new Date(seller.deleted_at), 'dd/MM/yyyy')
                : seller.created_at 
                  ? format(new Date(seller.created_at), 'dd/MM/yyyy') 
                  : '-'}
            </span>
          </div>
        </div>

        {/* Admin Plan Actions */}
        {!isTrash && !seller.is_permanent && (
          <div className="flex gap-2 mt-4 pt-4 border-t border-border">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => setActivatePlanConfirm({ seller, days: 5 })}
            >
              <Gift className="w-4 h-4 mr-1" />
              +5 dias
            </Button>
            <Button 
              variant="gradient" 
              size="sm" 
              className="flex-1"
              onClick={() => setActivatePlanConfirm({ seller, days: 30 })}
            >
              <CreditCard className="w-4 h-4 mr-1" />
              +30 dias
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setMakePermanentConfirm(seller)}
              title="Tornar permanente"
            >
              <Crown className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Remove Permanent Status */}
        {!isTrash && seller.is_permanent && (
          <div className="flex gap-2 mt-4 pt-4 border-t border-border">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 border-destructive/50 text-destructive hover:bg-destructive/10"
              onClick={() => setRemovePermanentConfirm(seller)}
            >
              <Crown className="w-4 h-4 mr-1" />
              Remover Permanente
            </Button>
          </div>
        )}

        {!isTrash && seller.whatsapp && (
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

        <div className="flex gap-2 mt-4">
          {isExpired ? (
            <>
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditingSeller(seller)}>
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
              <Button variant="whatsapp" size="sm" onClick={() => {
                if (seller.whatsapp) {
                  const phone = seller.whatsapp.replace(/\D/g, '');
                  const message = `Olá ${seller.full_name || 'Vendedor'}! 👋\n\nPercebemos que seu plano venceu. Gostaríamos de renovar sua assinatura!\n\nPodemos conversar?`;
                  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
                }
              }} disabled={!seller.whatsapp} title="WhatsApp">
                <MessageCircle className="w-4 h-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="text-destructive hover:text-destructive"
                onClick={onMoveToTrash}
                title="Mover para Lixeira"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          ) : !isTrash ? (
            <>
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditingSeller(seller)}>
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
              <Button variant="outline" size="sm" onClick={() => setTempPasswordSeller(seller)} title="Gerar Senha Temporária">
                <KeyRound className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(seller)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setRestoreConfirm(seller)}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Restaurar
              </Button>
              <Button variant="whatsapp" size="sm" onClick={() => {
                if (seller.whatsapp) {
                  const phone = seller.whatsapp.replace(/\D/g, '');
                  const message = `Olá ${seller.full_name || 'Vendedor'}! 👋\n\nSentimos sua falta! Gostaríamos de conversar sobre sua volta para a equipe.\n\nPodemos conversar?`;
                  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
                }
              }} disabled={!seller.whatsapp}>
                <MessageCircle className="w-4 h-4" />
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => setPermanentDeleteConfirm(seller)}
                title="Excluir Permanentemente"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );

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
            <p className="text-muted-foreground">{sellers.length} ativos · {expiredSellers.length} vencidos · {trashedSellers.length} na lixeira</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setMessageConfigOpen(true)}>
              <Settings2 className="w-4 h-4 mr-2" />
              Mensagens
            </Button>
            <Button variant="gradient" onClick={() => { createForm.reset(); setDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Vendedor
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant={daysFilter === 'all' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setDaysFilter('all')}
            >
              Todos
            </Button>
            <Button 
              variant={daysFilter === '3' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setDaysFilter('3')}
            >
              ≤3 dias
            </Button>
            <Button 
              variant={daysFilter === '7' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setDaysFilter('7')}
            >
              ≤7 dias
            </Button>
            <Button 
              variant={daysFilter === '15' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setDaysFilter('15')}
            >
              ≤15 dias
            </Button>
            <Button 
              variant={daysFilter === '30' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setDaysFilter('30')}
            >
              ≤30 dias
            </Button>
          </div>
        </div>

        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="active" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Ativos ({filteredActiveSellers.length})
            </TabsTrigger>
            <TabsTrigger value="expired" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Vencidos ({expiredSellers.length})
            </TabsTrigger>
            <TabsTrigger value="trash" className="flex items-center gap-2">
              <Archive className="w-4 h-4" />
              Lixeira ({trashedSellers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-6">
            {filteredActiveSellers.length === 0 ? (
              <Card variant="glow">
                <CardContent className="p-8 text-center">
                  <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">
                    {sellers.length === 0 ? 'Nenhum vendedor ativo' : 'Nenhum vendedor encontrado'}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {sellers.length === 0 ? 'Adicione seu primeiro vendedor para começar.' : 'Tente ajustar os filtros de busca.'}
                  </p>
                  {sellers.length === 0 && (
                    <Button variant="gradient" onClick={() => { createForm.reset(); setDialogOpen(true); }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Novo Vendedor
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredActiveSellers.map((seller) => (
                  <SellerCard key={seller.id} seller={seller} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="expired" className="mt-6">
            {expiredSellers.length === 0 ? (
              <Card variant="glow">
                <CardContent className="p-8 text-center">
                  <Clock className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum vendedor vencido</h3>
                  <p className="text-muted-foreground">Todos os vendedores estão com o plano ativo.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between gap-3">
                  <div className="flex gap-2 flex-wrap">
                    <Button 
                      variant={expiredFilter === 'all' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setExpiredFilter('all')}
                    >
                      Todos ({expiredSellers.length})
                    </Button>
                    <Button 
                      variant={expiredFilter === '7' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setExpiredFilter('7')}
                    >
                      Até 7 dias
                    </Button>
                    <Button 
                      variant={expiredFilter === '15' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setExpiredFilter('15')}
                    >
                      Até 15 dias
                    </Button>
                    <Button 
                      variant={expiredFilter === '30' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setExpiredFilter('30')}
                    >
                      Até 30 dias
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredExpiredSellers.map((seller) => (
                    <SellerCard key={seller.id} seller={seller} isExpired onMoveToTrash={() => setMoveToTrashConfirm(seller)} />
                  ))}
                </div>
                {filteredExpiredSellers.length === 0 && (
                  <Card variant="glow">
                    <CardContent className="p-8 text-center">
                      <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">Nenhum vendedor vencido neste período.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="trash" className="mt-6">
            {trashedSellers.length === 0 ? (
              <Card variant="glow">
                <CardContent className="p-8 text-center">
                  <Archive className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Lixeira vazia</h3>
                  <p className="text-muted-foreground">Vendedores removidos aparecerão aqui.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button 
                    variant="destructive" 
                    onClick={() => setEmptyTrashConfirm(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Esvaziar Lixeira ({trashedSellers.length})
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {trashedSellers.map((seller) => (
                    <SellerCard key={seller.id} seller={seller} isTrash />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Create Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Vendedor</DialogTitle>
            </DialogHeader>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome / Empresa *</Label>
                <Input id="full_name" {...createForm.register('full_name')} placeholder="Ex: João Silva ou SanPlay" />
                {createForm.formState.errors.full_name && (
                  <p className="text-xs text-destructive">{createForm.formState.errors.full_name.message}</p>
                )}
                <p className="text-xs text-muted-foreground">Este nome aparecerá nas mensagens de WhatsApp para os clientes</p>
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
                <Input id="password" type="password" {...createForm.register('password')} placeholder="Mínimo 6 caracteres" />
                {createForm.formState.errors.password && (
                  <p className="text-xs text-destructive">{createForm.formState.errors.password.message}</p>
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
              
              {/* Plan Type Selection */}
              <div className="space-y-3">
                <Label>Tipo de Plano *</Label>
                <RadioGroup
                  value={createForm.watch('plan_type')}
                  onValueChange={(value: 'trial' | 'active') => createForm.setValue('plan_type', value)}
                  className="grid grid-cols-2 gap-3"
                >
                  <div className="relative">
                    <RadioGroupItem value="trial" id="trial" className="peer sr-only" />
                    <label
                      htmlFor="trial"
                      className="flex flex-col items-center justify-center p-4 rounded-lg border-2 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50"
                    >
                      <Gift className="w-6 h-6 mb-2 text-yellow-500" />
                      <span className="font-medium">Teste Grátis</span>
                      <span className="text-xs text-muted-foreground">3 dias</span>
                    </label>
                  </div>
                  <div className="relative">
                    <RadioGroupItem value="active" id="active" className="peer sr-only" />
                    <label
                      htmlFor="active"
                      className="flex flex-col items-center justify-center p-4 rounded-lg border-2 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50"
                    >
                      <CreditCard className="w-6 h-6 mb-2 text-green-500" />
                      <span className="font-medium">Plano Ativo</span>
                      <span className="text-xs text-muted-foreground">30 dias</span>
                    </label>
                  </div>
                </RadioGroup>
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

        {/* Edit Dialog */}
        <Dialog open={!!editingSeller} onOpenChange={() => setEditingSeller(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Vendedor</DialogTitle>
            </DialogHeader>
            <form onSubmit={updateForm.handleSubmit(onUpdateSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit_full_name">Nome / Empresa *</Label>
                <Input id="edit_full_name" {...updateForm.register('full_name')} placeholder="Ex: João Silva ou SanPlay" />
                {updateForm.formState.errors.full_name && (
                  <p className="text-xs text-destructive">{updateForm.formState.errors.full_name.message}</p>
                )}
                <p className="text-xs text-muted-foreground">Este nome aparecerá nas mensagens de WhatsApp para os clientes</p>
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

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Mover para Lixeira?</AlertDialogTitle>
              <AlertDialogDescription>
                O vendedor <strong>{deleteConfirm?.full_name || deleteConfirm?.email}</strong> será movido para a lixeira. 
                Você poderá restaurá-lo a qualquer momento.
                {deleteConfirm && deleteConfirm.clientCount > 0 && (
                  <span className="block mt-2 text-warning">
                    Atenção: Este vendedor possui {deleteConfirm.clientCount} cliente(s) cadastrado(s).
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              >
                Mover para Lixeira
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Restore Confirmation */}
        <AlertDialog open={!!restoreConfirm} onOpenChange={() => setRestoreConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Restaurar Vendedor?</AlertDialogTitle>
              <AlertDialogDescription>
                O vendedor <strong>{restoreConfirm?.full_name || restoreConfirm?.email}</strong> será restaurado e poderá acessar o sistema novamente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => restoreConfirm && handleRestore(restoreConfirm)}>
                Restaurar Vendedor
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Permanent Delete Confirmation */}
        <AlertDialog open={!!permanentDeleteConfirm} onOpenChange={() => setPermanentDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive">⚠️ Excluir Permanentemente?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>Esta ação <strong>não pode ser desfeita</strong>.</p>
                <p>O vendedor <strong>{permanentDeleteConfirm?.full_name || permanentDeleteConfirm?.email}</strong> e todos os seus dados serão excluídos permanentemente:</p>
                <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                  <li>Todos os clientes ({permanentDeleteConfirm?.clientCount || 0})</li>
                  <li>Todos os servidores</li>
                  <li>Todos os templates de WhatsApp</li>
                  <li>Perfil e configurações</li>
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => permanentDeleteConfirm && handlePermanentDelete(permanentDeleteConfirm)}
              >
                Excluir Permanentemente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Move Expired to Trash Confirmation */}
        <AlertDialog open={!!moveToTrashConfirm} onOpenChange={() => setMoveToTrashConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Mover Vendedor Vencido para Lixeira?</AlertDialogTitle>
              <AlertDialogDescription>
                O vendedor <strong>{moveToTrashConfirm?.full_name || moveToTrashConfirm?.email}</strong> será movido para a lixeira.
                {moveToTrashConfirm?.subscription_expires_at && (
                  <span className="block mt-2">
                    Plano vencido desde: {format(new Date(moveToTrashConfirm.subscription_expires_at), 'dd/MM/yyyy')}
                  </span>
                )}
                {moveToTrashConfirm && moveToTrashConfirm.clientCount > 0 && (
                  <span className="block mt-2 text-yellow-600">
                    Atenção: Este vendedor possui {moveToTrashConfirm.clientCount} cliente(s) cadastrado(s).
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => moveToTrashConfirm && handleMoveExpiredToTrash(moveToTrashConfirm)}
              >
                Mover para Lixeira
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Message Templates Configuration */}
        <Dialog open={messageConfigOpen} onOpenChange={setMessageConfigOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings2 className="w-5 h-5" />
                Configurar Mensagens WhatsApp
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {/* Billing Messages */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-yellow-500" />
                  Mensagens de Cobrança
                </h3>
                <RadioGroup
                  value={String(messageLayoutPreference.billing)}
                  onValueChange={(v) => saveMessagePreference('billing', Number(v) as 1 | 2 | 3)}
                  className="space-y-3"
                >
                  {[1, 2, 3].map((num) => (
                    <div key={num} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value={String(num)} id={`billing-${num}`} className="mt-1" />
                      <Label htmlFor={`billing-${num}`} className="flex-1 cursor-pointer">
                        <span className="font-medium text-sm">Layout {num}</span>
                        <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap font-sans">
                          {messageTemplates.billing[num as 1 | 2 | 3]('[Nome]')}
                        </pre>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* Renewal Messages */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-green-500" />
                  Mensagens de Renovação
                </h3>
                <RadioGroup
                  value={String(messageLayoutPreference.renewal)}
                  onValueChange={(v) => saveMessagePreference('renewal', Number(v) as 1 | 2 | 3)}
                  className="space-y-3"
                >
                  {[1, 2, 3].map((num) => (
                    <div key={num} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value={String(num)} id={`renewal-${num}`} className="mt-1" />
                      <Label htmlFor={`renewal-${num}`} className="flex-1 cursor-pointer">
                        <span className="font-medium text-sm">Layout {num}</span>
                        <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap font-sans">
                          {messageTemplates.renewal[num as 1 | 2 | 3]('[Nome]')}
                        </pre>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* Reminder Messages */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Bell className="w-4 h-4 text-orange-500" />
                  Mensagens de Lembrete
                </h3>
                <RadioGroup
                  value={String(messageLayoutPreference.reminder)}
                  onValueChange={(v) => saveMessagePreference('reminder', Number(v) as 1 | 2 | 3)}
                  className="space-y-3"
                >
                  {[1, 2, 3].map((num) => (
                    <div key={num} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value={String(num)} id={`reminder-${num}`} className="mt-1" />
                      <Label htmlFor={`reminder-${num}`} className="flex-1 cursor-pointer">
                        <span className="font-medium text-sm">Layout {num}</span>
                        <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap font-sans">
                          {messageTemplates.reminder[num as 1 | 2 | 3]('[Nome]')}
                        </pre>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </div>
          </DialogContent>
        </Dialog>


        {/* Temp Password Dialog */}
        <TempPasswordDialog
          open={!!tempPasswordSeller}
          onOpenChange={(open) => !open && setTempPasswordSeller(null)}
          seller={tempPasswordSeller}
          onSuccess={fetchSellers}
        />

        {/* Empty Trash Confirmation */}
        <AlertDialog open={emptyTrashConfirm} onOpenChange={setEmptyTrashConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Esvaziar Lixeira</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>
                  Você está prestes a excluir permanentemente <strong>{trashedSellers.length} vendedores</strong> da lixeira.
                </p>
                <p className="text-destructive font-medium">
                  Esta ação é irreversível e todos os dados associados serão perdidos:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                  <li>Todos os clientes dos vendedores</li>
                  <li>Todos os servidores</li>
                  <li>Todos os templates de WhatsApp</li>
                  <li>Perfis e permissões</li>
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={emptyingTrash}>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleEmptyTrash} 
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={emptyingTrash}
              >
                {emptyingTrash ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Excluindo...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Esvaziar Lixeira
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Make Permanent Confirmation */}
        <AlertDialog open={!!makePermanentConfirm} onOpenChange={(open) => !open && setMakePermanentConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-primary" />
                Tornar Permanente
              </AlertDialogTitle>
              <AlertDialogDescription>
                <p>
                  Você realmente deseja tornar <strong>{makePermanentConfirm?.full_name || makePermanentConfirm?.email}</strong> um vendedor permanente?
                </p>
                <p className="mt-2 text-sm">
                  Vendedores permanentes não possuem data de expiração e terão acesso vitalício ao sistema.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => {
                  if (makePermanentConfirm) {
                    makePermanent(makePermanentConfirm.id);
                    setMakePermanentConfirm(null);
                  }
                }}
              >
                <Crown className="w-4 h-4 mr-2" />
                Sim, Tornar Permanente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Remove Permanent Confirmation */}
        <AlertDialog open={!!removePermanentConfirm} onOpenChange={(open) => !open && setRemovePermanentConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-destructive" />
                Remover Status Permanente
              </AlertDialogTitle>
              <AlertDialogDescription>
                <p>
                  Você realmente deseja remover o status permanente de <strong>{removePermanentConfirm?.full_name || removePermanentConfirm?.email}</strong>?
                </p>
                <p className="mt-2 text-sm">
                  O vendedor receberá um plano de 30 dias a partir de hoje.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => {
                  if (removePermanentConfirm) {
                    removePermanent(removePermanentConfirm.id);
                    setRemovePermanentConfirm(null);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Sim, Remover Permanente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Activate Plan Confirmation */}
        <AlertDialog open={!!activatePlanConfirm} onOpenChange={(open) => !open && setActivatePlanConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                {activatePlanConfirm?.days === 5 ? (
                  <Gift className="w-5 h-5 text-primary" />
                ) : (
                  <CreditCard className="w-5 h-5 text-primary" />
                )}
                Adicionar {activatePlanConfirm?.days} Dias
              </AlertDialogTitle>
              <AlertDialogDescription>
                <p>
                  Você realmente deseja adicionar <strong>{activatePlanConfirm?.days} dias</strong> ao plano de <strong>{activatePlanConfirm?.seller.full_name || activatePlanConfirm?.seller.email}</strong>?
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {activatePlanConfirm?.seller.subscription_expires_at 
                    ? `Data de expiração atual: ${format(new Date(activatePlanConfirm.seller.subscription_expires_at), 'dd/MM/yyyy')}`
                    : 'O vendedor não possui plano ativo.'}
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => {
                  if (activatePlanConfirm) {
                    activatePlan(activatePlanConfirm.seller.id, activatePlanConfirm.days);
                    setActivatePlanConfirm(null);
                  }
                }}
              >
                Sim, Adicionar {activatePlanConfirm?.days} Dias
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </AppLayout>
  );
}