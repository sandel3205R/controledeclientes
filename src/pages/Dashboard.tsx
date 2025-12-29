import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useExpirationAlerts } from '@/hooks/useExpirationAlerts';
import AppLayout from '@/components/layout/AppLayout';
import StatCard from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, DollarSign, UserCheck, AlertTriangle, Clock, TrendingUp, Server, PiggyBank, Wallet, Receipt, Bell, Crown, MessageCircle, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { differenceInDays, isPast, format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useNavigate } from 'react-router-dom';
import { ValueVisibilityProvider, useValueVisibility } from '@/hooks/useValueVisibility';
import AdminMessagesManager from '@/components/admin/AdminMessagesManager';
import AdminMessagesBanner from '@/components/admin/AdminMessagesBanner';

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

interface LowCreditAlert {
  serverName: string;
  remaining: number;
  percentage: number;
  isCritical: boolean;
}

interface FinancialSummary {
  totalRevenue: number;
  totalFixedCosts: number;
  totalCreditCosts: number;
  totalReserve: number;
  netProfit: number;
}

interface PremiumAccountStats {
  name: string;
  clientCount: number;
  totalRevenue: number;
}

interface AdminDashboardStats {
  totalSellers: number;
}

interface ExpiringSeller {
  id: string;
  full_name: string | null;
  email: string;
  whatsapp: string | null;
  subscription_expires_at: string | null;
  is_permanent: boolean | null;
  daysRemaining: number;
  isExpired: boolean;
}

const ADMIN_WHATSAPP = '+5531998518865';
const ADMIN_NAME = 'SANDEL';

function DashboardContent() {
  const { role, user } = useAuth();
  const navigate = useNavigate();
  const { valuesHidden, formatValue } = useValueVisibility();
  const [sellerStats, setSellerStats] = useState<SellerDashboardStats>({
    totalClients: 0,
    activeClients: 0,
    expiringClients: 0,
    expiredClients: 0,
    totalRevenue: 0,
  });
  const [lowCreditAlerts, setLowCreditAlerts] = useState<LowCreditAlert[]>([]);
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
  const [premiumAccounts, setPremiumAccounts] = useState<PremiumAccountStats[]>([]);
  const [expiringSellers, setExpiringSellers] = useState<ExpiringSeller[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string; phone?: string | null; expiration_date: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isAdmin = role === 'admin';
  
  // Get sound preference from localStorage
  const getSoundEnabled = () => {
    const stored = localStorage.getItem('expiration_alert_sound_enabled');
    return stored !== 'false'; // Default to true
  };
  
  // Use expiration alerts hook for seller dashboard
  useExpirationAlerts({
    clients,
    enabled: !isAdmin && clients.length > 0,
    soundEnabled: getSoundEnabled(),
    checkIntervalMinutes: 30,
  });

  const fetchStats = useCallback(async (isManualRefresh = false) => {
    if (!user) {
      setLoading(false);
      return;
    }

    if (isManualRefresh) {
      setRefreshing(true);
    }
    if (isAdmin) {
        // Admin sees seller count and expiring sellers
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .is('deleted_at', null);

        if (profiles) {
          // Filter out the admin (first user)
          const sellers = profiles.filter((_, index) => index > 0 || profiles.length === 1);
          setAdminStats({ totalSellers: sellers.length });

          // Find sellers with expiring or expired subscriptions
          const now = new Date();
          const expiring: ExpiringSeller[] = [];

          sellers.forEach((seller) => {
            if (seller.is_permanent) return;
            if (!seller.subscription_expires_at) {
              expiring.push({
                ...seller,
                daysRemaining: 0,
                isExpired: true,
              });
              return;
            }

            const expiresAt = new Date(seller.subscription_expires_at);
            // Use Math.ceil to match the calculation in useAuth.tsx
            const diffMs = expiresAt.getTime() - now.getTime();
            const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            const isExpired = isPast(expiresAt);

            // Show sellers expiring in 7 days or already expired
            if (isExpired || daysRemaining <= 7) {
              expiring.push({
                ...seller,
                daysRemaining: Math.max(0, daysRemaining),
                isExpired,
              });
            }
          });

          // Sort: expired first, then by days remaining
          expiring.sort((a, b) => {
            if (a.isExpired && !b.isExpired) return -1;
            if (!a.isExpired && b.isExpired) return 1;
            return a.daysRemaining - b.daysRemaining;
          });

          setExpiringSellers(expiring);
        }
      } else {
        // Seller sees their own client stats - fetch in parallel
        const [clientsResult, serversResult] = await Promise.all([
          supabase
            .from('clients')
            .select('*')
            .eq('seller_id', user.id),
          supabase
            .from('servers')
            .select('*')
            .eq('seller_id', user.id)
            .eq('is_active', true)
        ]);

        const clients = clientsResult.data;
        const servers = serversResult.data;

        if (clients) {
          const now = new Date();
          let active = 0, expiring = 0, expired = 0, revenue = 0;

          // Group clients by server_name (premium accounts)
          const premiumAccountsMap = new Map<string, { count: number; revenue: number }>();

          clients.forEach((client) => {
            const expDate = new Date(client.expiration_date);
            const daysUntil = differenceInDays(expDate, now);
            const clientPrice = client.plan_price || 0;
            const isActive = !isPast(expDate);

            if (isPast(expDate)) {
              expired++;
            } else if (daysUntil <= 7) {
              expiring++;
              revenue += clientPrice;
            } else {
              active++;
              revenue += clientPrice;
            }

            // Track premium accounts (server_name field)
            if (client.server_name && isActive) {
              const existing = premiumAccountsMap.get(client.server_name);
              if (existing) {
                existing.count++;
                existing.revenue += clientPrice;
              } else {
                premiumAccountsMap.set(client.server_name, { count: 1, revenue: clientPrice });
              }
            }
          });

          // Convert premium accounts map to array
          const premiumAccountsList: PremiumAccountStats[] = Array.from(premiumAccountsMap.entries())
            .map(([name, stats]) => ({
              name,
              clientCount: stats.count,
              totalRevenue: stats.revenue,
            }))
            .sort((a, b) => b.totalRevenue - a.totalRevenue);
          
          setPremiumAccounts(premiumAccountsList);

          // Store clients for expiration alerts
          setClients(clients.map(c => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            expiration_date: c.expiration_date,
          })));

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

            // Check for low credit alerts
            const alerts: LowCreditAlert[] = [];
            servers.forEach(s => {
              if (s.total_credits && s.total_credits > 0) {
                const usagePercent = ((s.used_credits || 0) / s.total_credits) * 100;
                const remaining = s.total_credits - (s.used_credits || 0);
                if (usagePercent >= 80) {
                  alerts.push({
                    serverName: s.name,
                    remaining,
                    percentage: 100 - usagePercent,
                    isCritical: usagePercent >= 95,
                  });
                }
              }
            });
            setLowCreditAlerts(alerts);

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
    setRefreshing(false);
  }, [user, isAdmin]);

  useEffect(() => {
    // Só executar quando user e role estiverem carregados
    if (!user || role === null) {
      return;
    }

    let isMounted = true;
    let interval: NodeJS.Timeout | null = null;

    const loadStats = async () => {
      if (!isMounted) return;
      
      try {
        await fetchStats();
      } catch (error) {
        console.error('Error fetching stats:', error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadStats();

    // Auto-refresh a cada 30 segundos (não 5s para evitar sobrecarga)
    interval = setInterval(loadStats, 30000);

    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
    };
  }, [user?.id, role]);

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

  // Helper to send WhatsApp message
  const sendWhatsAppToSeller = (seller: ExpiringSeller, type: 'reminder' | 'expired') => {
    if (!seller.whatsapp) return;
    
    const phone = seller.whatsapp.replace(/\D/g, '');
    const name = seller.full_name || 'Vendedor';
    
    let message = '';
    if (type === 'expired') {
      message = `Olá ${name}! 👋

⚠️ Seu período de teste/plano expirou.

Para continuar usando o painel e não perder seus dados, entre em contato para ativar seu plano.

Estamos à disposição!
${ADMIN_NAME}`;
    } else {
      message = `Olá ${name}! 👋

⏰ Seu plano vence em ${seller.daysRemaining} ${seller.daysRemaining === 1 ? 'dia' : 'dias'}.

Não deixe de renovar para continuar usando o painel sem interrupções!

Qualquer dúvida, estamos à disposição.
${ADMIN_NAME}`;
    }
    
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const VisibilityToggle = () => {
    const { valuesHidden, toggleVisibility } = useValueVisibility();
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={toggleVisibility}
        className="gap-2"
      >
        {valuesHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        {valuesHidden ? 'Mostrar' : 'Ocultar'}
      </Button>
    );
  };

  // Admin Dashboard - Shows seller count and expiring sellers
  if (isAdmin) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold">Dashboard Admin</h1>
              <p className="text-muted-foreground">Gestão de vendedores</p>
            </div>
            <div className="flex items-center gap-2">
              <VisibilityToggle />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchStats(true)}
                disabled={refreshing}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Atualizando...' : 'Atualizar'}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Vendedores Ativos"
              value={adminStats.totalSellers}
              icon={Users}
              variant="primary"
            />
            <StatCard
              title="Planos Vencendo"
              value={expiringSellers.filter(s => !s.isExpired).length}
              icon={Clock}
              variant="warning"
            />
            <StatCard
              title="Planos Expirados"
              value={expiringSellers.filter(s => s.isExpired).length}
              icon={AlertTriangle}
              variant="default"
            />
          </div>

          {/* Expiring/Expired Sellers Section */}
          {expiringSellers.length > 0 && (
            <Card variant="glow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-warning" />
                  Vendedores com Planos Vencendo/Vencidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {expiringSellers.map((seller) => (
                    <div
                      key={seller.id}
                      className={`p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        seller.isExpired 
                          ? 'bg-destructive/10 border-destructive/30' 
                          : seller.daysRemaining <= 1
                            ? 'bg-red-500/10 border-red-500/30'
                            : 'bg-yellow-500/10 border-yellow-500/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                          seller.isExpired 
                            ? 'bg-destructive/20 text-destructive' 
                            : 'bg-yellow-500/20 text-yellow-600'
                        }`}>
                          {seller.full_name?.charAt(0)?.toUpperCase() || seller.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{seller.full_name || seller.email}</p>
                          <p className="text-xs text-muted-foreground">{seller.email}</p>
                          {seller.subscription_expires_at && (
                            <p className="text-xs text-muted-foreground">
                              Vence: {format(new Date(seller.subscription_expires_at), 'dd/MM/yyyy HH:mm')}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 sm:gap-3">
                        <Badge className={
                          seller.isExpired 
                            ? 'bg-destructive/20 text-destructive' 
                            : seller.daysRemaining <= 1
                              ? 'bg-red-500/20 text-red-600'
                              : 'bg-yellow-500/20 text-yellow-600'
                        }>
                          {seller.isExpired 
                            ? 'Expirado' 
                            : `${seller.daysRemaining}d restantes`
                          }
                        </Badge>
                        
                        {seller.whatsapp && (
                          <Button
                            size="sm"
                            variant="whatsapp"
                            onClick={() => sendWhatsAppToSeller(seller, seller.isExpired ? 'expired' : 'reminder')}
                          >
                            <MessageCircle className="w-4 h-4 mr-1" />
                            {seller.isExpired ? 'Cobrar' : 'Lembrar'}
                          </Button>
                        )}
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate('/sellers')}
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Renovar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {expiringSellers.length === 0 && (
            <Card variant="glow">
              <CardContent className="p-8 text-center">
                <Crown className="w-16 h-16 mx-auto mb-4 text-primary" />
                <h3 className="text-lg font-semibold mb-2">Tudo em ordem!</h3>
                <p className="text-muted-foreground">
                  Nenhum vendedor com plano vencendo nos próximos 7 dias.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Admin Messages Manager */}
          <AdminMessagesManager />
        </div>
      </AppLayout>
    );
  }

  // Seller Dashboard - Shows their own stats and sales
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Admin Messages Banner */}
        <AdminMessagesBanner />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Meu Dashboard</h1>
            <p className="text-muted-foreground">Seus clientes e estatísticas de vendas</p>
          </div>
          <div className="flex items-center gap-2">
            <VisibilityToggle />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchStats(true)}
              disabled={refreshing}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Atualizando...' : 'Atualizar'}
            </Button>
          </div>
        </div>

        {/* Low Credit Alerts */}
        {lowCreditAlerts.length > 0 && (
          <div className="space-y-2">
            {lowCreditAlerts.map((alert, index) => (
              <Alert 
                key={index} 
                variant={alert.isCritical ? "destructive" : "default"}
                className={`cursor-pointer ${!alert.isCritical ? 'border-warning/50 bg-warning/10' : ''}`}
                onClick={() => navigate('/servers')}
              >
                <Bell className="h-4 w-4" />
                <AlertTitle className={!alert.isCritical ? 'text-warning' : ''}>
                  {alert.isCritical ? '⚠️ Créditos Críticos!' : '⚡ Créditos Baixos'}
                </AlertTitle>
                <AlertDescription className={!alert.isCritical ? 'text-warning/80' : ''}>
                  <strong>{alert.serverName}</strong> tem apenas {valuesHidden ? '••' : alert.remaining} créditos restantes ({valuesHidden ? '••' : `${alert.percentage.toFixed(0)}%`}). 
                  Clique para gerenciar.
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total de Clientes"
            value={sellerStats.totalClients}
            icon={Users}
            variant="primary"
            linkTo="/clients"
          />
          <StatCard
            title="Clientes Ativos"
            value={sellerStats.activeClients}
            icon={UserCheck}
            variant="success"
            linkTo="/clients?status=active"
          />
          <StatCard
            title="Vencendo"
            value={sellerStats.expiringClients}
            icon={Clock}
            variant="warning"
            linkTo="/clients?status=expiring"
          />
          <StatCard
            title="Vencidos"
            value={sellerStats.expiredClients}
            icon={AlertTriangle}
            variant="default"
            linkTo="/clients?status=expired"
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
                    <span className="font-bold">{valuesHidden ? '••' : fixedServers.count}</span>
                  </div>
                  <div className="space-y-2">
                    {fixedServers.servers.map((server, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <span>{server.name}</span>
                        <span className="text-warning font-medium">{valuesHidden ? '•••••' : `R$ ${server.cost.toFixed(2)}/mês`}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-border">
                    <span className="font-medium">Total Mensal</span>
                    <span className="text-lg font-bold text-warning">{valuesHidden ? '•••••' : `R$ ${fixedServers.totalMonthlyCost.toFixed(2)}`}</span>
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
                    <span className="font-bold">{valuesHidden ? '••' : creditServers.count}</span>
                  </div>
                  <div className="space-y-2">
                    {creditServers.servers.map((server, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <div>
                          <span>{server.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            ({valuesHidden ? '••/••' : `${server.usedCredits}/${server.totalCredits}`} créditos)
                          </span>
                        </div>
                        <span className="text-secondary font-medium">{valuesHidden ? '•••••' : `R$ ${server.creditCost.toFixed(3)}/créd`}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                    <div>
                      <p className="text-xs text-muted-foreground">Reserva/Cliente</p>
                      <p className="font-bold text-secondary">{valuesHidden ? '•••••' : `R$ ${creditServers.reservePerClient.toFixed(3)}`}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Gasto em Créditos</p>
                      <p className="font-bold text-warning">{valuesHidden ? '•••••' : `R$ ${creditServers.totalCreditExpense.toFixed(2)}`}</p>
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

        {/* Premium Accounts Section */}
        {premiumAccounts.length > 0 && (
          <Card variant="glow" className="border-amber-500/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-500" />
                Contas Premium - Lucros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {premiumAccounts.map((account, index) => (
                    <div 
                      key={index} 
                      className="flex justify-between items-center p-3 rounded-lg bg-amber-500/10 border border-amber-500/20"
                    >
                      <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4 text-amber-500" />
                        <div>
                          <p className="font-medium">{account.name}</p>
                          <p className="text-xs text-muted-foreground">{valuesHidden ? '••' : account.clientCount} cliente{account.clientCount > 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <span className="text-lg font-bold text-amber-500">{valuesHidden ? '•••••' : `R$ ${account.totalRevenue.toFixed(2)}`}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-border">
                  <span className="font-medium">Total Contas Premium</span>
                  <span className="text-xl font-bold text-amber-500">
                    {valuesHidden ? '•••••' : `R$ ${premiumAccounts.reduce((sum, a) => sum + a.totalRevenue, 0).toFixed(2)}`}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
                <p className="text-lg font-bold text-success">{valuesHidden ? '•••••' : `+ R$ ${financialSummary.totalRevenue.toFixed(2)}`}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">(-) Custos Fixos</p>
                <p className="text-lg font-bold text-warning">{valuesHidden ? '•••••' : `- R$ ${financialSummary.totalFixedCosts.toFixed(2)}`}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">(-) Custos Créditos</p>
                <p className="text-lg font-bold text-warning">{valuesHidden ? '•••••' : `- R$ ${financialSummary.totalCreditCosts.toFixed(2)}`}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Reserva Necessária</p>
                <p className="text-lg font-bold text-secondary">{valuesHidden ? '•••••' : `R$ ${financialSummary.totalReserve.toFixed(2)}`}</p>
              </div>
              <div className="space-y-1 bg-primary/20 rounded-lg p-2 -m-2">
                <p className="text-xs text-muted-foreground">= Lucro Líquido</p>
                <p className="text-xl font-bold text-primary">{valuesHidden ? '•••••' : `R$ ${financialSummary.netProfit.toFixed(2)}`}</p>
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

export default function Dashboard() {
  return (
    <ValueVisibilityProvider>
      <DashboardContent />
    </ValueVisibilityProvider>
  );
}
