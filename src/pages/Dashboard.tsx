import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import StatCard from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, DollarSign, UserCheck, AlertTriangle, Clock, TrendingUp, Server, PiggyBank, Wallet, Receipt } from 'lucide-react';
import { differenceInDays, isPast } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface SellerDashboardStats {
  totalClients: number;
  activeClients: number;
  expiringClients: number;
  expiredClients: number;
  totalRevenue: number;
}

interface FixedServerStats {
  count: number;
  totalMonthlyCost: number;
  servers: Array<{ name: string; cost: number }>;
}

interface CreditServerStats {
  count: number;
  totalCreditCost: number;
  totalUsedCredits: number;
  totalCreditExpense: number;
  reservePerClient: number;
  totalReserve: number;
  servers: Array<{ name: string; creditCost: number; usedCredits: number; totalCredits: number }>;
}

interface FinancialSummary {
  totalRevenue: number;
  totalFixedCosts: number;
  totalCreditCosts: number;
  totalReserve: number;
  netProfit: number;
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
  const [fixedServers, setFixedServers] = useState<FixedServerStats>({
    count: 0,
    totalMonthlyCost: 0,
    servers: [],
  });
  const [creditServers, setCreditServers] = useState<CreditServerStats>({
    count: 0,
    totalCreditCost: 0,
    totalUsedCredits: 0,
    totalCreditExpense: 0,
    reservePerClient: 0,
    totalReserve: 0,
    servers: [],
  });
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary>({
    totalRevenue: 0,
    totalFixedCosts: 0,
    totalCreditCosts: 0,
    totalReserve: 0,
    netProfit: 0,
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

        // Fetch server stats
        const { data: servers } = await supabase
          .from('servers')
          .select('*')
          .eq('seller_id', user.id)
          .eq('is_active', true);

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

          // Separate fixed servers (monthly cost only) from credit servers
          if (servers && servers.length > 0) {
            // Fixed servers - have monthly_cost > 0 and no credit system
            const fixedServersList = servers.filter(s => Number(s.monthly_cost) > 0 && Number(s.credit_cost) === 0);
            const fixedTotalCost = fixedServersList.reduce((sum, s) => sum + (Number(s.monthly_cost) || 0), 0);
            
            setFixedServers({
              count: fixedServersList.length,
              totalMonthlyCost: fixedTotalCost,
              servers: fixedServersList.map(s => ({ name: s.name, cost: Number(s.monthly_cost) || 0 })),
            });

            // Credit servers - have credit_cost > 0
            const creditServersList = servers.filter(s => Number(s.credit_cost) > 0);
            const totalCreditCostPerCredit = creditServersList.reduce((sum, s) => sum + (Number(s.credit_cost) || 0), 0);
            const totalUsedCreditsCount = creditServersList.reduce((sum, s) => sum + (s.used_credits || 0), 0);
            const totalCreditExpenseValue = creditServersList.reduce((sum, s) => (Number(s.credit_cost) || 0) * (s.used_credits || 0) + sum, 0);
            
            // Calculate reserve per client
            const activeClientCount = active + expiring;
            const avgCreditCost = creditServersList.length > 0 ? totalCreditCostPerCredit / creditServersList.length : 0;
            const reservePerClientValue = avgCreditCost;
            const totalReserveValue = reservePerClientValue * activeClientCount;

            setCreditServers({
              count: creditServersList.length,
              totalCreditCost: totalCreditCostPerCredit,
              totalUsedCredits: totalUsedCreditsCount,
              totalCreditExpense: totalCreditExpenseValue,
              reservePerClient: reservePerClientValue,
              totalReserve: totalReserveValue,
              servers: creditServersList.map(s => ({
                name: s.name,
                creditCost: Number(s.credit_cost) || 0,
                usedCredits: s.used_credits || 0,
                totalCredits: s.total_credits || 0,
              })),
            });

            // Also include servers with both monthly and credit costs
            const hybridServers = servers.filter(s => Number(s.monthly_cost) > 0 && Number(s.credit_cost) > 0);
            const hybridMonthlyCost = hybridServers.reduce((sum, s) => sum + (Number(s.monthly_cost) || 0), 0);

            // Calculate financial summary
            const totalFixedCostsValue = fixedTotalCost + hybridMonthlyCost;
            const netProfitValue = revenue - totalFixedCostsValue - totalCreditExpenseValue;

            setFinancialSummary({
              totalRevenue: revenue,
              totalFixedCosts: totalFixedCostsValue,
              totalCreditCosts: totalCreditExpenseValue,
              totalReserve: totalReserveValue,
              netProfit: netProfitValue,
            });
          } else {
            setFinancialSummary({
              totalRevenue: revenue,
              totalFixedCosts: 0,
              totalCreditCosts: 0,
              totalReserve: 0,
              netProfit: revenue,
            });
          }
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

        {/* Financial Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            title="Vendas (Receita)"
            value={`R$ ${financialSummary.totalRevenue.toFixed(2)}`}
            icon={DollarSign}
            variant="success"
          />
          <StatCard
            title="Custos Fixos"
            value={`R$ ${financialSummary.totalFixedCosts.toFixed(2)}`}
            icon={Receipt}
            variant="warning"
          />
          <StatCard
            title="Custos Créditos"
            value={`R$ ${financialSummary.totalCreditCosts.toFixed(2)}`}
            icon={Server}
            variant="warning"
          />
          <StatCard
            title="Reserva p/ Créditos"
            value={`R$ ${financialSummary.totalReserve.toFixed(2)}`}
            icon={PiggyBank}
            variant="secondary"
          />
          <StatCard
            title="Lucro Líquido"
            value={`R$ ${financialSummary.netProfit.toFixed(2)}`}
            icon={Wallet}
            variant="primary"
          />
        </div>

        {/* Servers Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Fixed Servers Card */}
          <Card variant="glow">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="w-5 h-5 text-warning" />
                Servidores Fixos (Mensalidade)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {fixedServers.count > 0 ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-border">
                    <span className="text-sm text-muted-foreground">Total de Servidores</span>
                    <span className="font-bold">{fixedServers.count}</span>
                  </div>
                  <div className="space-y-2">
                    {fixedServers.servers.map((server, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <span>{server.name}</span>
                        <span className="text-warning font-medium">R$ {server.cost.toFixed(2)}/mês</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-border">
                    <span className="font-medium">Total Mensal</span>
                    <span className="text-lg font-bold text-warning">R$ {fixedServers.totalMonthlyCost.toFixed(2)}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Receipt className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>Nenhum servidor fixo cadastrado</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Credit Servers Card */}
          <Card variant="glow">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="w-5 h-5 text-secondary" />
                Servidores por Crédito
              </CardTitle>
            </CardHeader>
            <CardContent>
              {creditServers.count > 0 ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-border">
                    <span className="text-sm text-muted-foreground">Total de Servidores</span>
                    <span className="font-bold">{creditServers.count}</span>
                  </div>
                  <div className="space-y-2">
                    {creditServers.servers.map((server, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <div>
                          <span>{server.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            ({server.usedCredits}/{server.totalCredits} créditos)
                          </span>
                        </div>
                        <span className="text-secondary font-medium">R$ {server.creditCost.toFixed(3)}/créd</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                    <div>
                      <p className="text-xs text-muted-foreground">Reserva/Cliente</p>
                      <p className="font-bold text-secondary">R$ {creditServers.reservePerClient.toFixed(3)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Gasto em Créditos</p>
                      <p className="font-bold text-warning">R$ {creditServers.totalCreditExpense.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Server className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>Nenhum servidor por crédito cadastrado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Financial Resume */}
        <Card className="bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 border-primary/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              Resumo Final do Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Receita Total</p>
                <p className="text-lg font-bold text-success">+ R$ {financialSummary.totalRevenue.toFixed(2)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">(-) Custos Fixos</p>
                <p className="text-lg font-bold text-warning">- R$ {financialSummary.totalFixedCosts.toFixed(2)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">(-) Custos Créditos</p>
                <p className="text-lg font-bold text-warning">- R$ {financialSummary.totalCreditCosts.toFixed(2)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Reserva Necessária</p>
                <p className="text-lg font-bold text-secondary">R$ {financialSummary.totalReserve.toFixed(2)}</p>
              </div>
              <div className="space-y-1 bg-primary/20 rounded-lg p-2 -m-2">
                <p className="text-xs text-muted-foreground">= Lucro Líquido</p>
                <p className="text-xl font-bold text-primary">R$ {financialSummary.netProfit.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

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
