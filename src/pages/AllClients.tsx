import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Filter, Calendar, User, Phone } from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';
import { cn } from '@/lib/utils';

interface ClientWithSeller {
  id: string;
  name: string;
  phone: string | null;
  expiration_date: string;
  plan_name: string | null;
  plan_price: number | null;
  seller_id: string;
  seller_name?: string;
}

type StatusFilter = 'all' | 'active' | 'expiring' | 'expired';

export default function AllClients() {
  const [clients, setClients] = useState<ClientWithSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    const fetchClients = async () => {
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, name, phone, expiration_date, seller_id, plan_name, plan_price')
        .order('expiration_date');

      if (clientsData) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, email');
        const profileMap = new Map(profiles?.map(p => [p.id, p.full_name || p.email]) || []);
        
        const enriched = clientsData.map(c => ({
          ...c,
          seller_name: profileMap.get(c.seller_id) || 'Desconhecido'
        }));
        setClients(enriched);
      }
      setLoading(false);
    };
    fetchClients();
  }, []);

  const getClientStatus = (expDate: string): StatusFilter => {
    const date = new Date(expDate);
    if (isPast(date)) return 'expired';
    if (differenceInDays(date, new Date()) <= 7) return 'expiring';
    return 'active';
  };

  const getStatusBadge = (expDate: string) => {
    const status = getClientStatus(expDate);
    const styles = { active: 'bg-success/20 text-success', expiring: 'bg-warning/20 text-warning', expired: 'bg-destructive/20 text-destructive' };
    const labels = { active: 'Ativo', expiring: 'Vencendo', expired: 'Vencido' };
    return <Badge className={cn('border text-xs', styles[status])}>{labels[status]}</Badge>;
  };

  const filteredClients = useMemo(() => {
    let result = [...clients];
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(s) || c.phone?.includes(search) || c.seller_name?.toLowerCase().includes(s));
    }
    if (statusFilter !== 'all') result = result.filter(c => getClientStatus(c.expiration_date) === statusFilter);
    return result;
  }, [clients, search, statusFilter]);

  if (loading) return <AppLayout><div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div><h1 className="text-2xl lg:text-3xl font-bold">Todos os Clientes</h1><p className="text-muted-foreground">{filteredClients.length} clientes</p></div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" /></div>
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusFilter)}><SelectTrigger className="w-full sm:w-40"><Filter className="w-4 h-4 mr-2" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="active">Ativos</SelectItem><SelectItem value="expiring">Vencendo</SelectItem><SelectItem value="expired">Vencidos</SelectItem></SelectContent></Select>
        </div>
        <Card variant="glow" className="hidden md:block overflow-hidden">
          <Table><TableHeader><TableRow className="border-border"><TableHead>Cliente</TableHead><TableHead>Telefone</TableHead><TableHead>Plano</TableHead><TableHead>Vendedor</TableHead><TableHead>Vencimento</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{filteredClients.map(c => <TableRow key={c.id} className="border-border"><TableCell className="font-medium">{c.name}</TableCell><TableCell className="text-muted-foreground">{c.phone || '-'}</TableCell><TableCell>{c.plan_name ? `${c.plan_name}${c.plan_price ? ` (R$ ${c.plan_price.toFixed(2)})` : ''}` : '-'}</TableCell><TableCell>{c.seller_name}</TableCell><TableCell>{format(new Date(c.expiration_date), 'dd/MM/yyyy')}</TableCell><TableCell>{getStatusBadge(c.expiration_date)}</TableCell></TableRow>)}</TableBody></Table>
        </Card>
        <div className="md:hidden space-y-3">{filteredClients.map(c => <Card key={c.id} variant="gradient"><CardContent className="p-4 space-y-3"><div className="flex justify-between"><div><h3 className="font-semibold">{c.name}</h3><p className="text-sm text-muted-foreground">{c.plan_name || 'Sem plano'}</p></div>{getStatusBadge(c.expiration_date)}</div><div className="grid grid-cols-2 gap-2 text-sm">{c.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-4 h-4" /><span>{c.phone}</span></div>}<div className="flex items-center gap-2 text-muted-foreground"><Calendar className="w-4 h-4" /><span>{format(new Date(c.expiration_date), 'dd/MM/yyyy')}</span></div><div className="flex items-center gap-2 text-muted-foreground col-span-2"><User className="w-4 h-4" /><span className="truncate">{c.seller_name}</span></div></div></CardContent></Card>)}</div>
        {filteredClients.length === 0 && <div className="text-center py-16"><p className="text-muted-foreground">Nenhum cliente encontrado</p></div>}
      </div>
    </AppLayout>
  );
}
