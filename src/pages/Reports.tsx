import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import StatCard from '@/components/dashboard/StatCard';
import { DollarSign, Users, TrendingUp, Calendar, Download } from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

interface ReportData {
  totalRevenue: number;
  totalClients: number;
  newClients: number;
  sellerStats: { name: string; clients: number; revenue: number }[];
  monthlyData: { month: string; revenue: number; clients: number }[];
}

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [reportData, setReportData] = useState<ReportData>({ totalRevenue: 0, totalClients: 0, newClients: 0, sellerStats: [], monthlyData: [] });

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

  useEffect(() => { fetchReportData(); }, [startDate, endDate]);

  const exportReport = () => {
    const data = [['Relatório'], [`Período: ${format(parseISO(startDate), 'dd/MM/yyyy')} - ${format(parseISO(endDate), 'dd/MM/yyyy')}`], [], ['Receita Total', `R$ ${reportData.totalRevenue.toFixed(2)}`], ['Total Clientes', reportData.totalClients], [], ['Vendedor', 'Clientes', 'Receita'], ...reportData.sellerStats.map(s => [s.name, s.clients, `R$ ${s.revenue.toFixed(2)}`])];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
    XLSX.writeFile(wb, `relatorio_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Exportado!');
  };

  if (loading) return <AppLayout><div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"><div><h1 className="text-2xl lg:text-3xl font-bold">Relatórios</h1><p className="text-muted-foreground">Análise de vendas</p></div><Button variant="gradient" onClick={exportReport}><Download className="w-4 h-4 mr-2" />Exportar</Button></div>
        <Card variant="glow"><CardContent className="p-4"><div className="flex flex-col sm:flex-row gap-4 items-end"><div className="flex-1 space-y-2"><Label>Data Inicial</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div><div className="flex-1 space-y-2"><Label>Data Final</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div><Button variant="outline" onClick={fetchReportData}><Calendar className="w-4 h-4 mr-2" />Aplicar</Button></div></CardContent></Card>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4"><StatCard title="Receita Total" value={`R$ ${reportData.totalRevenue.toFixed(2)}`} icon={DollarSign} variant="primary" /><StatCard title="Total Clientes" value={reportData.totalClients} icon={Users} variant="secondary" /><StatCard title="Novos no Período" value={reportData.newClients} icon={TrendingUp} variant="success" /><StatCard title="Média/Cliente" value={`R$ ${reportData.newClients > 0 ? (reportData.totalRevenue / reportData.newClients).toFixed(2) : '0.00'}`} icon={DollarSign} variant="warning" /></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card variant="glow"><CardHeader><CardTitle className="text-base">Receita Mensal</CardTitle></CardHeader><CardContent><div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={reportData.monthlyData}><XAxis dataKey="month" stroke="hsl(215, 20%, 55%)" fontSize={12} /><YAxis stroke="hsl(215, 20%, 55%)" fontSize={12} /><Tooltip contentStyle={{ backgroundColor: 'hsl(222 47% 8%)', border: '1px solid hsl(222 30% 18%)', borderRadius: '8px' }} formatter={(v: number) => [`R$ ${v.toFixed(2)}`, 'Receita']} /><Line type="monotone" dataKey="revenue" stroke="hsl(174 100% 50%)" strokeWidth={2} dot={{ fill: 'hsl(174 100% 50%)' }} /></LineChart></ResponsiveContainer></div></CardContent></Card>
          <Card variant="glow"><CardHeader><CardTitle className="text-base">Vendas por Vendedor</CardTitle></CardHeader><CardContent><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={reportData.sellerStats.slice(0, 5)} layout="vertical"><XAxis type="number" stroke="hsl(215, 20%, 55%)" fontSize={12} /><YAxis dataKey="name" type="category" stroke="hsl(215, 20%, 55%)" fontSize={12} width={100} /><Tooltip contentStyle={{ backgroundColor: 'hsl(222 47% 8%)', border: '1px solid hsl(222 30% 18%)', borderRadius: '8px' }} formatter={(v: number) => [`R$ ${v.toFixed(2)}`, 'Receita']} /><Bar dataKey="revenue" fill="url(#gradientBar)" radius={[0, 4, 4, 0]} /><defs><linearGradient id="gradientBar" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="hsl(270 60% 55%)" /><stop offset="100%" stopColor="hsl(174 100% 50%)" /></linearGradient></defs></BarChart></ResponsiveContainer></div></CardContent></Card>
        </div>
        <Card variant="glow"><CardHeader><CardTitle className="text-base">Detalhamento</CardTitle></CardHeader><CardContent><div className="space-y-3">{reportData.sellerStats.map((s, i) => <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-sm font-bold text-primary-foreground">{s.name.charAt(0).toUpperCase()}</div><div><p className="font-medium">{s.name}</p><p className="text-sm text-muted-foreground">{s.clients} clientes</p></div></div><div className="text-right"><p className="font-bold text-lg">R$ {s.revenue.toFixed(2)}</p></div></div>)}</div></CardContent></Card>
      </div>
    </AppLayout>
  );
}
