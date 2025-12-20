import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import {
  Plus,
  Users,
  Gift,
  Copy,
  CheckCircle,
  Clock,
  XCircle,
  Search,
  Percent,
  Share2,
  UserPlus,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

interface Client {
  id: string;
  name: string;
  phone: string | null;
  referral_code: string | null;
  plan_name: string | null;
  plan_price: number | null;
  seller_id: string;
}

interface Seller {
  id: string;
  full_name: string | null;
  email: string;
}

interface Referral {
  id: string;
  seller_id: string;
  referrer_client_id: string;
  referred_client_id: string;
  status: 'pending' | 'completed' | 'expired';
  discount_percentage: number;
  coupon_id: string | null;
  completed_at: string | null;
  created_at: string;
  referrer?: Client;
  referred?: Client;
  seller?: Seller;
}

export default function ReferralsManager() {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'expired'>('all');
  const [sellerFilter, setSellerFilter] = useState<string>('all');

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedClientForShare, setSelectedClientForShare] = useState<Client | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    referrer_id: '',
    referred_id: '',
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, phone, referral_code, plan_name, plan_price, seller_id')
        .order('name');

      if (clientsError) throw clientsError;
      setClients(clientsData || []);

      // Fetch sellers for admin view
      if (isAdmin) {
        const { data: sellersData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .order('full_name');
        setSellers(sellersData || []);
      }

      // Fetch referrals with related data
      const { data: referralsData, error: referralsError } = await supabase
        .from('referrals')
        .select(`
          *,
          referrer:clients!referrals_referrer_client_id_fkey(id, name, phone, referral_code, plan_name, plan_price, seller_id),
          referred:clients!referrals_referred_client_id_fkey(id, name, phone, referral_code, plan_name, plan_price, seller_id)
        `)
        .order('created_at', { ascending: false });

      if (referralsError) throw referralsError;

      // For admin, fetch seller info
      let referralsWithSeller = referralsData || [];
      if (isAdmin && referralsWithSeller.length > 0) {
        const sellerIds = [...new Set(referralsWithSeller.map(r => r.seller_id))];
        const { data: sellerProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', sellerIds);

        const sellerMap = new Map(sellerProfiles?.map(s => [s.id, s]) || []);
        referralsWithSeller = referralsWithSeller.map(r => ({
          ...r,
          seller: sellerMap.get(r.seller_id)
        }));
      }

      setReferrals(referralsWithSeller as Referral[]);
    } catch (error: any) {
      toast.error('Erro ao carregar dados');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredReferrals = useMemo(() => {
    return referrals.filter((referral) => {
      const matchesSearch =
        referral.referrer?.name.toLowerCase().includes(search.toLowerCase()) ||
        referral.referred?.name.toLowerCase().includes(search.toLowerCase()) ||
        referral.seller?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        referral.seller?.email?.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || referral.status === statusFilter;

      const matchesSeller =
        sellerFilter === 'all' || referral.seller_id === sellerFilter;

      return matchesSearch && matchesStatus && matchesSeller;
    });
  }, [referrals, search, statusFilter, sellerFilter]);

  const stats = useMemo(() => {
    const total = referrals.length;
    const completed = referrals.filter((r) => r.status === 'completed').length;
    const pending = referrals.filter((r) => r.status === 'pending').length;
    const totalDiscount = referrals
      .filter((r) => r.status === 'completed')
      .reduce((sum, r) => {
        const price = r.referrer?.plan_price || 0;
        return sum + (price * r.discount_percentage) / 100;
      }, 0);

    return { total, completed, pending, totalDiscount };
  }, [referrals]);

  const handleOpenDialog = () => {
    setFormData({ referrer_id: '', referred_id: '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.referrer_id || !formData.referred_id) {
      toast.error('Selecione o cliente que indicou e o indicado');
      return;
    }

    if (formData.referrer_id === formData.referred_id) {
      toast.error('O cliente não pode indicar a si mesmo');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('referrals').insert({
        seller_id: user?.id,
        referrer_client_id: formData.referrer_id,
        referred_client_id: formData.referred_id,
        discount_percentage: 50,
        status: 'pending',
      });

      if (error) {
        if (error.code === '23505') {
          toast.error('Esta indicação já foi registrada');
          return;
        }
        throw error;
      }

      toast.success('Indicação registrada! O desconto de 50% será aplicado quando confirmado.');
      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao registrar indicação');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteReferral = async (referral: Referral) => {
    try {
      // Create a coupon for the referrer
      const referrer = referral.referrer;
      if (!referrer) {
        toast.error('Cliente que indicou não encontrado');
        return;
      }

      const couponCode = `IND${referrer.referral_code || referrer.id.slice(0, 6).toUpperCase()}`;
      
      // Create coupon
      const { data: couponData, error: couponError } = await supabase
        .from('coupons')
        .insert({
          seller_id: user?.id,
          code: couponCode,
          name: `Indicação de ${referrer.name}`,
          discount_type: 'percentage',
          discount_value: 50,
          max_uses: 1,
          is_active: true,
        })
        .select()
        .single();

      if (couponError && couponError.code !== '23505') {
        throw couponError;
      }

      // Update referral status
      const { error: updateError } = await supabase
        .from('referrals')
        .update({
          status: 'completed',
          coupon_id: couponData?.id,
          completed_at: new Date().toISOString(),
        })
        .eq('id', referral.id);

      if (updateError) throw updateError;

      toast.success(`Indicação confirmada! Cupom ${couponCode} criado com 50% de desconto para ${referrer.name}`);
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao confirmar indicação');
      console.error(error);
    }
  };

  const handleExpireReferral = async (referralId: string) => {
    try {
      const { error } = await supabase
        .from('referrals')
        .update({ status: 'expired' })
        .eq('id', referralId);

      if (error) throw error;
      toast.success('Indicação expirada');
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao expirar indicação');
      console.error(error);
    }
  };

  const copyReferralCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Código copiado!');
  };

  const generateReferralLink = (client: Client) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/?ref=${client.referral_code}`;
  };

  const handleShareLink = async (client: Client) => {
    const link = generateReferralLink(client);
    const message = `🎉 Indique amigos e ganhe 50% de desconto!\n\nUse meu código de indicação: ${client.referral_code}\n\nOu acesse: ${link}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Programa de Indicação',
          text: message,
          url: link,
        });
      } catch (err) {
        // User cancelled or share failed, fallback to copy
        copyToClipboard(message);
      }
    } else {
      copyToClipboard(message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Link copiado para a área de transferência!');
  };

  const openShareDialog = (client: Client) => {
    setSelectedClientForShare(client);
    setShareDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
            <CheckCircle className="w-3 h-3 mr-1" />
            Confirmada
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
            <Clock className="w-3 h-3 mr-1" />
            Pendente
          </Badge>
        );
      case 'expired':
        return (
          <Badge className="bg-red-500/20 text-red-500 border-red-500/30">
            <XCircle className="w-3 h-3 mr-1" />
            Expirada
          </Badge>
        );
      default:
        return null;
    }
  };

  // Get clients available to be referred (not already referred by the selected referrer)
  const availableReferred = useMemo(() => {
    if (!formData.referrer_id) return clients;
    
    const existingReferrals = referrals
      .filter((r) => r.referrer_client_id === formData.referrer_id)
      .map((r) => r.referred_client_id);

    return clients.filter(
      (c) => c.id !== formData.referrer_id && !existingReferrals.includes(c.id)
    );
  }, [clients, formData.referrer_id, referrals]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Programa de Indicação</h2>
          <p className="text-muted-foreground">
            Indicou, ganhou 50% de desconto no mês atual
          </p>
        </div>
        <Button onClick={handleOpenDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Indicação
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card variant="gradient">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/20">
                <Share2 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Indicações</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="gradient">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-green-500/20">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.completed}</p>
                <p className="text-sm text-muted-foreground">Confirmadas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="gradient">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-yellow-500/20">
                <Clock className="w-6 h-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="gradient">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-purple-500/20">
                <Gift className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">R$ {stats.totalDiscount.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">Descontos Dados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* How it works */}
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            Como funciona?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-primary/20 text-primary font-bold text-sm">1</div>
              <div>
                <p className="font-medium">Cliente indica</p>
                <p className="text-sm text-muted-foreground">
                  Um cliente existente indica um novo cliente
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-primary/20 text-primary font-bold text-sm">2</div>
              <div>
                <p className="font-medium">Você confirma</p>
                <p className="text-sm text-muted-foreground">
                  Quando o indicado se torna cliente
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-primary/20 text-primary font-bold text-sm">3</div>
              <div>
                <p className="font-medium">Desconto gerado</p>
                <p className="text-sm text-muted-foreground">
                  Cupom de 50% criado automaticamente
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="completed">Confirmadas</SelectItem>
            <SelectItem value="expired">Expiradas</SelectItem>
          </SelectContent>
        </Select>
        {isAdmin && sellers.length > 0 && (
          <Select
            value={sellerFilter}
            onValueChange={setSellerFilter}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Vendedores</SelectItem>
              {sellers.map((seller) => (
                <SelectItem key={seller.id} value={seller.id}>
                  {seller.full_name || seller.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Referrals Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Indicações</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredReferrals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserPlus className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>
                {referrals.length === 0
                  ? 'Nenhuma indicação registrada'
                  : 'Nenhuma indicação encontrada'}
              </p>
              {referrals.length === 0 && (
                <Button onClick={handleOpenDialog} className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Registrar primeira indicação
                </Button>
              )}
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isAdmin && <TableHead>Vendedor</TableHead>}
                    <TableHead>Quem Indicou</TableHead>
                    <TableHead>Indicado</TableHead>
                    <TableHead>Desconto</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReferrals.map((referral) => (
                    <TableRow key={referral.id}>
                      {isAdmin && (
                        <TableCell>
                          <div className="text-sm">
                            <p className="font-medium">{referral.seller?.full_name || 'Sem nome'}</p>
                            <p className="text-xs text-muted-foreground">{referral.seller?.email}</p>
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        <div>
                          <p className="font-medium">{referral.referrer?.name}</p>
                          {referral.referrer?.referral_code && (
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="text-xs font-mono">
                                {referral.referrer.referral_code}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={() =>
                                  copyReferralCode(referral.referrer!.referral_code!)
                                }
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{referral.referred?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {referral.referred?.plan_name || 'Sem plano'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-500/20 text-green-500">
                          <Percent className="w-3 h-3 mr-1" />
                          {referral.discount_percentage}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(referral.created_at), 'dd/MM/yy', {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell>{getStatusBadge(referral.status)}</TableCell>
                      <TableCell className="text-right">
                        {referral.status === 'pending' && !isAdmin && (
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleCompleteReferral(referral)}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Confirmar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleExpireReferral(referral.id)}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Clients with Referral Codes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-5 h-5" />
            Códigos de Indicação dos Clientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {clients.slice(0, 30).map((client) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{client.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {client.plan_name || 'Sem plano'}
                    </p>
                  </div>
                  {client.referral_code && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant="secondary" className="font-mono">
                        {client.referral_code}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => copyReferralCode(client.referral_code!)}
                        title="Copiar código"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openShareDialog(client)}
                        title="Compartilhar link"
                      >
                        <Share2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* New Referral Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Indicação</DialogTitle>
            <DialogDescription>
              Registre uma indicação. Quando confirmada, um cupom de 50% será gerado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Quem indicou?</Label>
              <Select
                value={formData.referrer_id}
                onValueChange={(v) =>
                  setFormData((prev) => ({ ...prev, referrer_id: v, referred_id: '' }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente que indicou" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Quem foi indicado?</Label>
              <Select
                value={formData.referred_id}
                onValueChange={(v) =>
                  setFormData((prev) => ({ ...prev, referred_id: v }))
                }
                disabled={!formData.referrer_id}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      formData.referrer_id
                        ? 'Selecione o cliente indicado'
                        : 'Primeiro selecione quem indicou'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableReferred.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2 text-green-500">
                <Gift className="w-5 h-5" />
                <span className="font-medium">Desconto: 50%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Ao confirmar a indicação, um cupom será criado automaticamente
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Registrar Indicação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Link Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5" />
              Compartilhar Link de Indicação
            </DialogTitle>
            <DialogDescription>
              Compartilhe o link abaixo para que {selectedClientForShare?.name} indique novos clientes e ganhe 50% de desconto.
            </DialogDescription>
          </DialogHeader>
          
          {selectedClientForShare && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Código de Indicação</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="font-mono text-lg px-3 py-1">
                      {selectedClientForShare.referral_code}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyReferralCode(selectedClientForShare.referral_code!)}
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Copiar
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Link Completo</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      readOnly
                      value={generateReferralLink(selectedClientForShare)}
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(generateReferralLink(selectedClientForShare))}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button 
                  className="w-full"
                  onClick={() => handleShareLink(selectedClientForShare)}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Compartilhar via WhatsApp/Apps
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    const link = generateReferralLink(selectedClientForShare);
                    const message = `🎉 Indique amigos e ganhe 50% de desconto!\n\nUse o código: ${selectedClientForShare.referral_code}\n\nOu acesse: ${link}`;
                    copyToClipboard(message);
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar Mensagem Completa
                </Button>
                {selectedClientForShare.phone && (
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => {
                      const phone = selectedClientForShare.phone!.replace(/\D/g, '');
                      const link = generateReferralLink(selectedClientForShare);
                      const message = encodeURIComponent(`🎉 Olá ${selectedClientForShare.name}!\n\nVocê pode indicar amigos e ganhar 50% de desconto!\n\nSeu código: ${selectedClientForShare.referral_code}\n\nLink: ${link}`);
                      window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
                    }}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Enviar para o Cliente via WhatsApp
                  </Button>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
