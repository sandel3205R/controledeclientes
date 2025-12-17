import { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CalendarIcon,
  TrendingUp,
  DollarSign,
  Ticket,
  Users,
  FileDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CouponUsage {
  id: string;
  coupon_id: string;
  client_id: string;
  seller_id: string;
  original_price: number;
  discount_applied: number;
  final_price: number;
  created_at: string;
  coupon?: {
    code: string;
    name: string;
    discount_type: string;
    discount_value: number;
  };
  client?: {
    name: string;
    phone: string;
  };
}

interface Coupon {
  id: string;
  code: string;
  name: string;
  current_uses: number;
}

type PeriodFilter = 'today' | 'week' | 'month' | 'last_month' | 'custom';

export default function CouponUsageReport() {
  const { user } = useAuth();
  const [usages, setUsages] = useState<CouponUsage[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('month');
  const [couponFilter, setCouponFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{
    from: Date;
    to: Date;
  }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  useEffect(() => {
    if (user) {
      fetchCoupons();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchUsages();
    }
  }, [user, dateRange, couponFilter]);

  useEffect(() => {
    // Update date range based on period filter
    const now = new Date();
    switch (periodFilter) {
      case 'today':
        setDateRange({
          from: new Date(now.setHours(0, 0, 0, 0)),
          to: new Date(new Date().setHours(23, 59, 59, 999)),
        });
        break;
      case 'week':
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        setDateRange({ from: weekAgo, to: new Date() });
        break;
      case 'month':
        setDateRange({
          from: startOfMonth(now),
          to: endOfMonth(now),
        });
        break;
      case 'last_month':
        const lastMonth = subMonths(now, 1);
        setDateRange({
          from: startOfMonth(lastMonth),
          to: endOfMonth(lastMonth),
        });
        break;
      // 'custom' doesn't auto-update
    }
  }, [periodFilter]);

  const fetchCoupons = async () => {
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('id, code, name, current_uses')
        .order('code');

      if (error) throw error;
      setCoupons(data || []);
    } catch (error) {
      console.error('Error fetching coupons:', error);
    }
  };

  const fetchUsages = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('coupon_usages')
        .select(`
          *,
          coupon:coupons(code, name, discount_type, discount_value),
          client:clients(name, phone)
        `)
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString())
        .order('created_at', { ascending: false });

      if (couponFilter !== 'all') {
        query = query.eq('coupon_id', couponFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setUsages((data || []) as CouponUsage[]);
    } catch (error: any) {
      toast.error('Erro ao carregar relatório');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const totalUsages = usages.length;
    const totalDiscount = usages.reduce((sum, u) => sum + u.discount_applied, 0);
    const totalOriginal = usages.reduce((sum, u) => sum + u.original_price, 0);
    const totalFinal = usages.reduce((sum, u) => sum + u.final_price, 0);
    const uniqueClients = new Set(usages.map((u) => u.client_id)).size;
    const uniqueCoupons = new Set(usages.map((u) => u.coupon_id)).size;

    return {
      totalUsages,
      totalDiscount,
      totalOriginal,
      totalFinal,
      uniqueClients,
      uniqueCoupons,
    };
  }, [usages]);

  const exportToCSV = () => {
    if (usages.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    const headers = ['Data', 'Cupom', 'Cliente', 'Valor Original', 'Desconto', 'Valor Final'];
    const rows = usages.map((u) => [
      format(new Date(u.created_at), 'dd/MM/yyyy HH:mm'),
      u.coupon?.code || 'N/A',
      u.client?.name || 'N/A',
      u.original_price.toFixed(2),
      u.discount_applied.toFixed(2),
      u.final_price.toFixed(2),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_cupons_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    toast.success('Relatório exportado!');
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card variant="gradient">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/20">
                <Ticket className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalUsages}</p>
                <p className="text-sm text-muted-foreground">Usos no período</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="gradient">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-green-500/20">
                <DollarSign className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  R$ {stats.totalDiscount.toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground">Total em descontos</p>
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
                <p className="text-2xl font-bold">{stats.uniqueClients}</p>
                <p className="text-sm text-muted-foreground">Clientes beneficiados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="gradient">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-purple-500/20">
                <TrendingUp className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  R$ {stats.totalFinal.toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground">Receita com desconto</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Select
              value={periodFilter}
              onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="week">Última semana</SelectItem>
                <SelectItem value="month">Este mês</SelectItem>
                <SelectItem value="last_month">Mês passado</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>

            {periodFilter === 'custom' && (
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[140px] justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(dateRange.from, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateRange.from}
                      onSelect={(date) =>
                        date && setDateRange((prev) => ({ ...prev, from: date }))
                      }
                      initialFocus
                      className={cn('p-3 pointer-events-auto')}
                    />
                  </PopoverContent>
                </Popover>
                <span className="flex items-center text-muted-foreground">até</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[140px] justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(dateRange.to, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateRange.to}
                      onSelect={(date) =>
                        date && setDateRange((prev) => ({ ...prev, to: date }))
                      }
                      initialFocus
                      className={cn('p-3 pointer-events-auto')}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <Select value={couponFilter} onValueChange={setCouponFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Cupom" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os cupons</SelectItem>
                {coupons.map((coupon) => (
                  <SelectItem key={coupon.id} value={coupon.id}>
                    {coupon.code} ({coupon.current_uses} usos)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={exportToCSV} className="ml-auto">
              <FileDown className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Usage Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Histórico de Uso</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : usages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Ticket className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum uso de cupom no período selecionado</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cupom</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Original</TableHead>
                    <TableHead className="text-right">Desconto</TableHead>
                    <TableHead className="text-right">Final</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usages.map((usage) => (
                    <TableRow key={usage.id}>
                      <TableCell className="text-sm">
                        {format(new Date(usage.created_at), "dd/MM/yy HH:mm", {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="font-mono">
                            {usage.coupon?.code || 'N/A'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {usage.client?.name || 'Cliente removido'}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        R$ {usage.original_price.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-green-500 font-medium">
                        -R$ {usage.discount_applied.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        R$ {usage.final_price.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
