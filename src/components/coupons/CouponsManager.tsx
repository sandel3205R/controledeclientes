import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { Label } from '@/components/ui/label';
import {
  Plus,
  Edit,
  Trash2,
  Ticket,
  Copy,
  CheckCircle,
  XCircle,
  Percent,
  DollarSign,
  Calendar,
  Users,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Coupon {
  id: string;
  seller_id: string;
  code: string;
  name: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_uses: number | null;
  current_uses: number;
  min_plan_value: number | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export default function CouponsManager() {
  const { user } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [couponToDelete, setCouponToDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: '',
    max_uses: '',
    min_plan_value: '',
    expires_at: '',
    is_active: true,
  });

  useEffect(() => {
    if (user) {
      fetchCoupons();
    }
  }, [user]);

  const fetchCoupons = async () => {
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCoupons((data || []) as Coupon[]);
    } catch (error: any) {
      toast.error('Erro ao carregar cupons');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCoupons = useMemo(() => {
    return coupons.filter((coupon) => {
      const matchesSearch =
        coupon.code.toLowerCase().includes(search.toLowerCase()) ||
        coupon.name.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && coupon.is_active) ||
        (statusFilter === 'inactive' && !coupon.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [coupons, search, statusFilter]);

  const stats = useMemo(() => {
    const active = coupons.filter((c) => c.is_active).length;
    const totalUses = coupons.reduce((sum, c) => sum + c.current_uses, 0);
    return { total: coupons.length, active, totalUses };
  }, [coupons]);

  const handleOpenDialog = (coupon?: Coupon) => {
    if (coupon) {
      setEditingCoupon(coupon);
      setFormData({
        code: coupon.code,
        name: coupon.name,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value.toString(),
        max_uses: coupon.max_uses?.toString() || '',
        min_plan_value: coupon.min_plan_value?.toString() || '',
        expires_at: coupon.expires_at
          ? format(new Date(coupon.expires_at), 'yyyy-MM-dd')
          : '',
        is_active: coupon.is_active,
      });
    } else {
      setEditingCoupon(null);
      setFormData({
        code: '',
        name: '',
        discount_type: 'percentage',
        discount_value: '',
        max_uses: '',
        min_plan_value: '',
        expires_at: '',
        is_active: true,
      });
    }
    setDialogOpen(true);
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData((prev) => ({ ...prev, code }));
  };

  const handleSave = async () => {
    if (!formData.code.trim() || !formData.name.trim() || !formData.discount_value) {
      toast.error('Preencha código, nome e valor do desconto');
      return;
    }

    const discountValue = parseFloat(formData.discount_value);
    if (isNaN(discountValue) || discountValue <= 0) {
      toast.error('Valor do desconto inválido');
      return;
    }

    if (formData.discount_type === 'percentage' && discountValue > 100) {
      toast.error('Desconto em porcentagem não pode ser maior que 100%');
      return;
    }

    setSaving(true);
    try {
      const couponData = {
        code: formData.code.toUpperCase().trim(),
        name: formData.name.trim(),
        discount_type: formData.discount_type,
        discount_value: discountValue,
        max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
        min_plan_value: formData.min_plan_value
          ? parseFloat(formData.min_plan_value)
          : null,
        expires_at: formData.expires_at
          ? new Date(formData.expires_at).toISOString()
          : null,
        is_active: formData.is_active,
      };

      if (editingCoupon) {
        const { error } = await supabase
          .from('coupons')
          .update(couponData)
          .eq('id', editingCoupon.id);

        if (error) throw error;
        toast.success('Cupom atualizado!');
      } else {
        const { error } = await supabase.from('coupons').insert({
          ...couponData,
          seller_id: user?.id,
        });

        if (error) {
          if (error.code === '23505') {
            toast.error('Já existe um cupom com este código');
            return;
          }
          throw error;
        }
        toast.success('Cupom criado!');
      }

      setDialogOpen(false);
      fetchCoupons();
    } catch (error: any) {
      toast.error('Erro ao salvar cupom');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!couponToDelete) return;

    try {
      const { error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', couponToDelete);

      if (error) throw error;
      toast.success('Cupom excluído!');
      fetchCoupons();
    } catch (error: any) {
      toast.error('Erro ao excluir cupom');
      console.error(error);
    } finally {
      setDeleteDialogOpen(false);
      setCouponToDelete(null);
    }
  };

  const handleToggleActive = async (coupon: Coupon) => {
    try {
      const { error } = await supabase
        .from('coupons')
        .update({ is_active: !coupon.is_active })
        .eq('id', coupon.id);

      if (error) throw error;
      toast.success(coupon.is_active ? 'Cupom desativado' : 'Cupom ativado');
      fetchCoupons();
    } catch (error: any) {
      toast.error('Erro ao atualizar cupom');
      console.error(error);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Código copiado!');
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const isMaxedOut = (coupon: Coupon) => {
    return coupon.max_uses !== null && coupon.current_uses >= coupon.max_uses;
  };

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
          <h2 className="text-2xl font-bold">Cupons de Desconto</h2>
          <p className="text-muted-foreground">
            Crie e gerencie cupons para seus clientes
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Cupom
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card variant="gradient">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/20">
                <Ticket className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total de Cupons</p>
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
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-sm text-muted-foreground">Cupons Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="gradient">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-500/20">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalUses}</p>
                <p className="text-sm text-muted-foreground">Total de Usos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código ou nome..."
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
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Coupons Grid */}
      {filteredCoupons.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Ticket className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              {coupons.length === 0
                ? 'Nenhum cupom criado'
                : 'Nenhum cupom encontrado'}
            </p>
            {coupons.length === 0 && (
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Criar primeiro cupom
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCoupons.map((coupon) => {
            const expired = isExpired(coupon.expires_at);
            const maxedOut = isMaxedOut(coupon);
            const isDisabled = !coupon.is_active || expired || maxedOut;

            return (
              <Card
                key={coupon.id}
                variant="gradient"
                className={cn(isDisabled && 'opacity-60')}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg font-mono">
                          {coupon.code}
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyCode(coupon.code)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {coupon.name}
                      </p>
                    </div>
                    <Switch
                      checked={coupon.is_active}
                      onCheckedChange={() => handleToggleActive(coupon)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Discount Value */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                    {coupon.discount_type === 'percentage' ? (
                      <Percent className="w-5 h-5 text-primary" />
                    ) : (
                      <DollarSign className="w-5 h-5 text-primary" />
                    )}
                    <span className="text-xl font-bold text-primary">
                      {coupon.discount_type === 'percentage'
                        ? `${coupon.discount_value}%`
                        : `R$ ${coupon.discount_value.toFixed(2)}`}
                    </span>
                    <span className="text-sm text-muted-foreground">de desconto</span>
                  </div>

                  {/* Info badges */}
                  <div className="flex flex-wrap gap-2">
                    {coupon.max_uses !== null && (
                      <Badge variant="secondary" className="text-xs">
                        <Users className="w-3 h-3 mr-1" />
                        {coupon.current_uses}/{coupon.max_uses} usos
                      </Badge>
                    )}
                    {coupon.expires_at && (
                      <Badge
                        variant={expired ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        <Calendar className="w-3 h-3 mr-1" />
                        {expired
                          ? 'Expirado'
                          : format(new Date(coupon.expires_at), 'dd/MM/yy', {
                              locale: ptBR,
                            })}
                      </Badge>
                    )}
                    {coupon.min_plan_value && (
                      <Badge variant="outline" className="text-xs">
                        Mín: R$ {coupon.min_plan_value.toFixed(0)}
                      </Badge>
                    )}
                  </div>

                  {/* Status badges */}
                  {(expired || maxedOut || !coupon.is_active) && (
                    <div className="flex gap-2">
                      {!coupon.is_active && (
                        <Badge variant="destructive" className="text-xs">
                          <XCircle className="w-3 h-3 mr-1" />
                          Desativado
                        </Badge>
                      )}
                      {expired && coupon.is_active && (
                        <Badge variant="destructive" className="text-xs">
                          <XCircle className="w-3 h-3 mr-1" />
                          Expirado
                        </Badge>
                      )}
                      {maxedOut && coupon.is_active && !expired && (
                        <Badge variant="destructive" className="text-xs">
                          <XCircle className="w-3 h-3 mr-1" />
                          Esgotado
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleOpenDialog(coupon)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setCouponToDelete(coupon.id);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCoupon ? 'Editar Cupom' : 'Novo Cupom'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Code */}
            <div className="space-y-2">
              <Label>Código do cupom</Label>
              <div className="flex gap-2">
                <Input
                  value={formData.code}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      code: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="DESCONTO10"
                  className="font-mono uppercase"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={generateCode}
                  className="shrink-0"
                >
                  Gerar
                </Button>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label>Nome do cupom</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Ex: Desconto de Natal"
              />
            </div>

            {/* Discount Type & Value */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo de desconto</Label>
                <Select
                  value={formData.discount_type}
                  onValueChange={(v) =>
                    setFormData((prev) => ({
                      ...prev,
                      discount_type: v as 'percentage' | 'fixed',
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                    <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input
                  type="number"
                  value={formData.discount_value}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      discount_value: e.target.value,
                    }))
                  }
                  placeholder={formData.discount_type === 'percentage' ? '10' : '5.00'}
                />
              </div>
            </div>

            {/* Max Uses & Min Value */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Limite de usos</Label>
                <Input
                  type="number"
                  value={formData.max_uses}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, max_uses: e.target.value }))
                  }
                  placeholder="Ilimitado"
                />
              </div>
              <div className="space-y-2">
                <Label>Valor mínimo (R$)</Label>
                <Input
                  type="number"
                  value={formData.min_plan_value}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      min_plan_value: e.target.value,
                    }))
                  }
                  placeholder="Sem mínimo"
                />
              </div>
            </div>

            {/* Expiration */}
            <div className="space-y-2">
              <Label>Data de expiração</Label>
              <Input
                type="date"
                value={formData.expires_at}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, expires_at: e.target.value }))
                }
              />
            </div>

            {/* Active */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <Label>Cupom ativo</Label>
                <p className="text-xs text-muted-foreground">
                  Desative para impedir novos usos
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, is_active: checked }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cupom?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O histórico de uso será perdido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
