import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import StatCard from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, DollarSign, UserCheck, AlertTriangle, Clock, TrendingUp } from 'lucide-react';
import { differenceInDays, isPast } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface DashboardStats {
  totalClients: number;
  activeClients: number;
  expiringClients: number;
  expiredClients: number;
  totalRevenue: number;
  totalSellers?: number;
}

export default function Dashboard() {
  const { role, user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    activeClients: 0,
    expiringClients: 0,
    expiredClients: 0,
    totalRevenue: 0,
    totalSellers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentClients, setRecentClients] = useState<any[]>([]);

  const isAdmin = role === 'admin';

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      let clientsQuery = supabase
        .from('clients')
        .select('*, plan:plans(price)');

      if (!isAdmin) {
        clientsQuery = clientsQuery.eq('seller_id', user.id);
      }

      const { data: clients } = await clientsQuery;

      if (clients) {
        const now = new Date();
        let active = 0, expiring = 0, expired = 0, revenue = 0;

        clients.forEach((client) => {
          const expDate = new Date(client.expiration_date);
          const daysUntil = differenceInDays(expDate, now);

          if (isPast(expDate)) {
            expired++;
          } else if (daysUntil <= 7) {
            expiring++;
            revenue += client.plan?.price || 0;
          } else {
            active++;
            revenue += client.plan?.price || 0;
          }
        });

        setStats((prev) => ({
          ...prev,
          totalClients: clients.length,
          activeClients: active,
          expiringClients: expiring,
          expiredClients: expired,
          totalRevenue: revenue,
        }));

        setRecentClients(clients.slice(0, 5));
      }

      if (isAdmin) {
        const { count } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });
        
        setStats((prev) => ({ ...prev, totalSellers: (count || 1) - 1 }));
      }

      setLoading(false);
    };

    fetchStats();
  }, [user, isAdmin]);

  const pieData = [
    { name: 'Ativos', value: stats.activeClients, color: 'hsl(142, 76%, 45%)' },
    { name: 'Vencendo', value: stats.expiringClients, color: 'hsl(38, 92%, 50%)' },
    { name: 'Vencidos', value: stats.expiredClients, color: 'hsl(0, 84%, 60%)' },
  ].filter((d) => d.value > 0);

  const barData = [
    { name: 'Ativos', value: stats.activeClients },
    { name: 'Vencendo', value: stats.expiringClients },
    { name: 'Vencidos', value: stats.expiredClients },
  ];

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
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            {isAdmin ? 'Visão geral do sistema' : 'Seus clientes e estatísticas'}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total de Clientes"
            value={stats.totalClients}
            icon={Users}
            variant="primary"
          />
          <StatCard
            title="Clientes Ativos"
            value={stats.activeClients}
            icon={UserCheck}
            variant="success"
          />
          <StatCard
            title="Vencendo"
            value={stats.expiringClients}
            icon={Clock}
            variant="warning"
          />
          <StatCard
            title="Vencidos"
            value={stats.expiredClients}
            icon={AlertTriangle}
            variant="default"
          />
        </div>

        {/* Revenue & Sellers (Admin) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <StatCard
            title="Receita Total"
            value={`R$ ${stats.totalRevenue.toFixed(2)}`}
            icon={DollarSign}
            variant="secondary"
          />
          {isAdmin && (
            <StatCard
              title="Vendedores Ativos"
              value={stats.totalSellers || 0}
              icon={TrendingUp}
              variant="primary"
            />
          )}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card variant="glow">
            <CardHeader>
              <CardTitle className="text-base">Distribuição de Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(222 47% 8%)',
                        border: '1px solid hsl(222 30% 18%)',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card variant="glow">
            <CardHeader>
              <CardTitle className="text-base">Status dos Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <XAxis dataKey="name" stroke="hsl(215, 20%, 55%)" fontSize={12} />
                    <YAxis stroke="hsl(215, 20%, 55%)" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(222 47% 8%)',
                        border: '1px solid hsl(222 30% 18%)',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="value" fill="url(#gradient)" radius={[4, 4, 0, 0]} />
                    <defs>
                      <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(174 100% 50%)" />
                        <stop offset="100%" stopColor="hsl(270 60% 55%)" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
