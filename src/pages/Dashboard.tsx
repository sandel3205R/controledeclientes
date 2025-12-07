import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import StatCard from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, DollarSign, UserCheck, AlertTriangle, Clock, TrendingUp } from 'lucide-react';
import { differenceInDays, isPast } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface SellerDashboardStats {
  totalClients: number;
  activeClients: number;
  expiringClients: number;
  expiredClients: number;
  totalRevenue: number;
}

interface AdminDashboardStats {
  totalSellers: number;
}

export default function Dashboard() {
  const { role, user } = useAuth();
  const [sellerStats, setSellerStats] = useState<SellerDashboardStats>({
    totalClients: 0,
    activeClients: 0,
    expiringClients: 0,
    expiredClients: 0,
    totalRevenue: 0,
  });
  const [adminStats, setAdminStats] = useState<AdminDashboardStats>({
    totalSellers: 0,
  });
  const [loading, setLoading] = useState(true);

  const isAdmin = role === 'admin';

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      if (isAdmin) {
        // Admin only sees seller count
        const { count } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });
        
        setAdminStats({ totalSellers: Math.max((count || 1) - 1, 0) });
      } else {
        // Seller sees their own client stats
        const { data: clients } = await supabase
          .from('clients')
          .select('*')
          .eq('seller_id', user.id);

        if (clients) {
          const now = new Date();
          let active = 0, expiring = 0, expired = 0, revenue = 0;

          clients.forEach((client) => {
            const expDate = new Date(client.expiration_date);
            const daysUntil = differenceInDays(expDate, now);
            const clientPrice = client.plan_price || 0;

            if (isPast(expDate)) {
              expired++;
            } else if (daysUntil <= 7) {
              expiring++;
              revenue += clientPrice;
            } else {
              active++;
              revenue += clientPrice;
            }
          });

          setSellerStats({
            totalClients: clients.length,
            activeClients: active,
            expiringClients: expiring,
            expiredClients: expired,
            totalRevenue: revenue,
          });
        }
      }

      setLoading(false);
    };

    fetchStats();
  }, [user, isAdmin]);

  const pieData = [
    { name: 'Ativos', value: sellerStats.activeClients, color: 'hsl(142, 76%, 45%)' },
    { name: 'Vencendo', value: sellerStats.expiringClients, color: 'hsl(38, 92%, 50%)' },
    { name: 'Vencidos', value: sellerStats.expiredClients, color: 'hsl(0, 84%, 60%)' },
  ].filter((d) => d.value > 0);

  const barData = [
    { name: 'Ativos', value: sellerStats.activeClients },
    { name: 'Vencendo', value: sellerStats.expiringClients },
    { name: 'Vencidos', value: sellerStats.expiredClients },
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

  // Admin Dashboard - Only shows seller count
  if (isAdmin) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Dashboard Admin</h1>
            <p className="text-muted-foreground">Gestão de vendedores</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              title="Vendedores Ativos"
              value={adminStats.totalSellers}
              icon={Users}
              variant="primary"
            />
          </div>

          <Card variant="glow">
            <CardContent className="p-8 text-center">
              <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Painel Administrativo</h3>
              <p className="text-muted-foreground">
                Acesse a página de Vendedores para gerenciar sua equipe de vendas.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Seller Dashboard - Shows their own stats and sales
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Meu Dashboard</h1>
          <p className="text-muted-foreground">Seus clientes e estatísticas de vendas</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total de Clientes"
            value={sellerStats.totalClients}
            icon={Users}
            variant="primary"
          />
          <StatCard
            title="Clientes Ativos"
            value={sellerStats.activeClients}
            icon={UserCheck}
            variant="success"
          />
          <StatCard
            title="Vencendo"
            value={sellerStats.expiringClients}
            icon={Clock}
            variant="warning"
          />
          <StatCard
            title="Vencidos"
            value={sellerStats.expiredClients}
            icon={AlertTriangle}
            variant="default"
          />
        </div>

        {/* Revenue Card */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <StatCard
            title="Minhas Vendas (Receita Ativa)"
            value={`R$ ${sellerStats.totalRevenue.toFixed(2)}`}
            icon={DollarSign}
            variant="secondary"
          />
          <StatCard
            title="Média por Cliente"
            value={`R$ ${sellerStats.totalClients > 0 ? (sellerStats.totalRevenue / (sellerStats.activeClients + sellerStats.expiringClients || 1)).toFixed(2) : '0.00'}`}
            icon={TrendingUp}
            variant="primary"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card variant="glow">
            <CardHeader>
              <CardTitle className="text-base">Distribuição de Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {pieData.length > 0 ? (
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
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Nenhum cliente cadastrado
                  </div>
                )}
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
