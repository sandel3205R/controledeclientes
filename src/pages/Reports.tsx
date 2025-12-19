import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import StatCard from '@/components/dashboard/StatCard';
import { DollarSign, Users, TrendingUp, Calendar, Download, UserX, AlertTriangle, Phone, MessageCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO, isWithinInterval, differenceInDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ReportData {
  totalRevenue: number;
  totalClients: number;
  newClients: number;
  sellerStats: { name: string; clients: number; revenue: number }[];
  monthlyData: { month: string; revenue: number; clients: number }[];
}

interface LostClient {
  id: string;
  name: string;
  phone: string | null;
  plan_name: string | null;
  plan_price: number | null;
  expiration_date: string;
  days_expired: number;
}

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [reportData, setReportData] = useState<ReportData>({ totalRevenue: 0, totalClients: 0, newClients: 0, sellerStats: [], monthlyData: [] });
  const [lostClients, setLostClients] = useState<LostClient[]>([]);
  const [lostClientsLoading, setLostClientsLoading] = useState(true);

  const fetchReportData = async () => {
    setLoading(true);
    const start = parseISO(startDate);
    const end = parseISO(endDate);

    const { data: clients } = await supabase.from('clients').select('id, created_at, seller_id, plan:plans(price)');
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, email');
    
    if (!clients) { setLoading(false); return; }
    
    const profileMap = new Map(profiles?.map(p => [p.id, p.full_name || p.email]) || []);
    const filteredClients = clients.filter(c => isWithinInterval(parseISO(c.created_at), { start, end }));
    const totalRevenue = filteredClients.reduce((sum, c) => sum + (c.plan?.price || 0), 0);

    const sellerMap = new Map<string, { name: string; clients: number; revenue: number }>();
    filteredClients.forEach(c => {
      const name = profileMap.get(c.seller_id) || 'Desconhecido';
      const cur = sellerMap.get(c.seller_id) || { name, clients: 0, revenue: 0 };
      cur.clients++; cur.revenue += c.plan?.price || 0;
      sellerMap.set(c.seller_id, cur);
    });

    const monthlyMap = new Map<string, { revenue: number; clients: number }>();
    clients.forEach(c => {
      const month = format(parseISO(c.created_at), 'MMM/yy', { locale: ptBR });
      const cur = monthlyMap.get(month) || { revenue: 0, clients: 0 };
      cur.clients++; cur.revenue += c.plan?.price || 0;
      monthlyMap.set(month, cur);
    });

    setReportData({
      totalRevenue, totalClients: clients.length, newClients: filteredClients.length,
      sellerStats: Array.from(sellerMap.values()).sort((a, b) => b.revenue - a.revenue),
      monthlyData: Array.from(monthlyMap.entries()).slice(-6).map(([month, data]) => ({ month, ...data })),
    });
    setLoading(false);
  };

  const fetchLostClients = async () => {
    setLostClientsLoading(true);
    const today = new Date();
    const thirtyDaysAgo = subDays(today, 30);
    
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, phone, plan_name, plan_price, expiration_date')
      .lt('expiration_date', format(thirtyDaysAgo, 'yyyy-MM-dd'))
      .order('expiration_date', { ascending: false });

    if (clients) {
      const lostWithDays = clients.map(c => ({
        ...c,
        days_expired: differenceInDays(today, new Date(c.expiration_date))
      }));
      setLostClients(lostWithDays);
    }
    setLostClientsLoading(false);
  };

  useEffect(() => { 
    fetchReportData(); 
    fetchLostClients();
  }, [startDate, endDate]);

  const exportReport = () => {
    const data = [['Relatório'], [`Período: ${format(parseISO(startDate), 'dd/MM/yyyy')} - ${format(parseISO(endDate), 'dd/MM/yyyy')}`], [], ['Receita Total', `R$ ${reportData.totalRevenue.toFixed(2)}`], ['Total Clientes', reportData.totalClients], [], ['Vendedor', 'Clientes', 'Receita'], ...reportData.sellerStats.map(s => [s.name, s.clients, `R$ ${s.revenue.toFixed(2)}`])];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
    XLSX.writeFile(wb, `relatorio_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Exportado!');
  };

  const exportLostClients = () => {
    const data = [
      ['Relatório de Clientes Perdidos'],
      [`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`],
      [],
      ['Nome', 'Telefone', 'Plano', 'Valor', 'Vencimento', 'Dias Vencido'],
      ...lostClients.map(c => [
        c.name,
        c.phone || '-',
        c.plan_name || '-',
        c.plan_price ? `R$ ${c.plan_price.toFixed(2)}` : '-',
        format(new Date(c.expiration_date), 'dd/MM/yyyy'),
        c.days_expired
      ])
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes Perdidos');
    XLSX.writeFile(wb, `clientes_perdidos_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Exportado!');
  };

  const formatPhone = (phone: string) => phone.replace(/\D/g, '');

  const sendWhatsApp = (client: LostClient) => {
    if (!client.phone) return;
    const message = `Olá ${client.name}! 👋\n\nSentimos sua falta! Seu plano ${client.plan_name || ''} venceu há ${client.days_expired} dias.\n\nQue tal voltar? Temos condições especiais para você!\n\nEntre em contato para saber mais.`;
    window.open(`https://wa.me/55${formatPhone(client.phone)}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const totalLostRevenue = lostClients.reduce((sum, c) => sum + (c.plan_price || 0), 0);

  if (loading) return <AppLayout><div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Relatórios</h1>
            <p className="text-muted-foreground">Análise de vendas e churn</p>
          </div>
        </div>

        <Tabs defaultValue="sales" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="sales" className="gap-2">
              <TrendingUp className="w-4 h-4" />
              Vendas
            </TabsTrigger>
            <TabsTrigger value="churn" className="gap-2">
              <UserX className="w-4 h-4" />
              Clientes Perdidos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sales" className="space-y-6 mt-6">
            <div className="flex justify-end">
              <Button variant="gradient" onClick={exportReport}>
                <Download className="w-4 h-4 mr-2" />Exportar
              </Button>
            </div>
            
            <Card variant="glow">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="flex-1 space-y-2">
                    <Label>Data Inicial</Label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label>Data Final</Label>
                    <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                  </div>
                  <Button variant="outline" onClick={fetchReportData}>
                    <Calendar className="w-4 h-4 mr-2" />Aplicar
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Receita Total" value={`R$ ${reportData.totalRevenue.toFixed(2)}`} icon={DollarSign} variant="primary" />
              <StatCard title="Total Clientes" value={reportData.totalClients} icon={Users} variant="secondary" />
              <StatCard title="Novos no Período" value={reportData.newClients} icon={TrendingUp} variant="success" />
              <StatCard title="Média/Cliente" value={`R$ ${reportData.newClients > 0 ? (reportData.totalRevenue / reportData.newClients).toFixed(2) : '0.00'}`} icon={DollarSign} variant="warning" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card variant="glow">
                <CardHeader><CardTitle className="text-base">Receita Mensal</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={reportData.monthlyData}>
                        <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} formatter={(v: number) => [`R$ ${v.toFixed(2)}`, 'Receita']} />
                        <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card variant="glow">
                <CardHeader><CardTitle className="text-base">Vendas por Vendedor</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reportData.sellerStats.slice(0, 5)} layout="vertical">
                        <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={100} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} formatter={(v: number) => [`R$ ${v.toFixed(2)}`, 'Receita']} />
                        <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card variant="glow">
              <CardHeader><CardTitle className="text-base">Detalhamento</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {reportData.sellerStats.map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-sm font-bold text-primary-foreground">
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{s.name}</p>
                          <p className="text-sm text-muted-foreground">{s.clients} clientes</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">R$ {s.revenue.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="churn" className="space-y-6 mt-6">
            <div className="flex justify-end">
              <Button variant="gradient" onClick={exportLostClients} disabled={lostClients.length === 0}>
                <Download className="w-4 h-4 mr-2" />Exportar Lista
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-4 bg-destructive/10 border-destructive/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-destructive/20">
                    <UserX className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Clientes Perdidos</p>
                    <p className="text-2xl font-bold text-destructive">{lostClients.length}</p>
                  </div>
                </div>
              </Card>
              <StatCard 
                title="Receita Perdida/Mês" 
                value={`R$ ${totalLostRevenue.toFixed(2)}`} 
                icon={AlertTriangle} 
                variant="warning" 
              />
              <StatCard 
                title="Média Dias Vencido" 
                value={lostClients.length > 0 ? Math.round(lostClients.reduce((sum, c) => sum + c.days_expired, 0) / lostClients.length) : 0} 
                icon={Calendar} 
                variant="secondary" 
              />
            </div>

            <Card variant="glow">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <UserX className="w-5 h-5 text-destructive" />
                  Clientes Vencidos há mais de 30 dias
                </CardTitle>
              </CardHeader>
              <CardContent>
                {lostClientsLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : lostClients.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <Users className="w-10 h-10 mb-2 opacity-50" />
                    <p>Nenhum cliente perdido encontrado</p>
                    <p className="text-sm">Todos os clientes estão ativos ou venceram recentemente</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {lostClients.map((client) => (
                      <div 
                        key={client.id} 
                        className="flex items-center justify-between p-4 rounded-lg bg-destructive/5 border border-destructive/20 hover:bg-destructive/10 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center text-sm font-bold text-destructive shrink-0">
                            {client.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{client.name}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              {client.plan_name && (
                                <span className="text-sm text-muted-foreground">{client.plan_name}</span>
                              )}
                              {client.plan_price && (
                                <Badge variant="outline" className="text-xs">
                                  R$ {client.plan_price.toFixed(2)}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <Badge variant="destructive" className="mb-1">
                              {client.days_expired} dias
                            </Badge>
                            <p className="text-xs text-muted-foreground">
                              Venceu {format(new Date(client.expiration_date), 'dd/MM/yyyy')}
                            </p>
                          </div>
                          
                          {client.phone && (
                            <Button 
                              variant="outline" 
                              size="icon" 
                              onClick={() => sendWhatsApp(client)}
                              className="shrink-0 bg-green-500/10 border-green-500/20 text-green-500 hover:bg-green-500/20"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {lostClients.length > 0 && (
              <Card variant="glow">
                <CardHeader>
                  <CardTitle className="text-base">Distribuição por Tempo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-center">
                      <p className="text-2xl font-bold text-yellow-500">
                        {lostClients.filter(c => c.days_expired <= 45).length}
                      </p>
                      <p className="text-sm text-muted-foreground">30-45 dias</p>
                    </div>
                    <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20 text-center">
                      <p className="text-2xl font-bold text-orange-500">
                        {lostClients.filter(c => c.days_expired > 45 && c.days_expired <= 60).length}
                      </p>
                      <p className="text-sm text-muted-foreground">45-60 dias</p>
                    </div>
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
                      <p className="text-2xl font-bold text-red-500">
                        {lostClients.filter(c => c.days_expired > 60 && c.days_expired <= 90).length}
                      </p>
                      <p className="text-sm text-muted-foreground">60-90 dias</p>
                    </div>
                    <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
                      <p className="text-2xl font-bold text-destructive">
                        {lostClients.filter(c => c.days_expired > 90).length}
                      </p>
                      <p className="text-sm text-muted-foreground">+90 dias</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
