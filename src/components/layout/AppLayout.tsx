import { ReactNode, useState } from 'react';
import { format } from 'date-fns';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import ThemeBackground from '@/components/ThemeBackground';
import SubscriptionExpiredDialog from '@/components/SubscriptionExpiredDialog';
import { ForceUpdateButton } from '@/components/ForceUpdateButton';
import OnboardingTour from '@/components/onboarding/OnboardingTour';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSharedPanels } from '@/hooks/useSharedPanels';
import { SharedPanelsBadge } from '@/components/shared-panels/SharedPanelsBadge';
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Tv,
  ChevronRight,
  MessageSquare,
  AlertTriangle,
  MessageCircle,
  Database,
  Clock,
  Ticket,
  Gift,
  Share2,
  Copy,
  Check,
  Receipt,
  History,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import logoImg from '@/assets/logo.jpg';

interface AppLayoutProps {
  children: ReactNode;
}

const ADMIN_WHATSAPP = '+5531998518865';
const ADMIN_NAME = 'SANDEL';

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, role, signOut, subscription } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { availableSlots } = useSharedPanels();

  const appUrl = window.location.origin;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Erro ao copiar link');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Controle de Clientes',
          text: 'Acesse o painel de controle de clientes',
          url: appUrl,
        });
      } catch (err) {
        // User cancelled or error
      }
    } else {
      handleCopyLink();
    }
  };

  const isAdmin = role === 'admin';
  
  // Check if subscription is expiring soon (7 days or less)
  const isExpiringSoon = !isAdmin && 
    !subscription?.isPermanent && 
    !subscription?.isExpired && 
    subscription?.daysRemaining !== null && 
    subscription?.daysRemaining <= 7;

  const handleContactAdmin = () => {
    const phone = ADMIN_WHATSAPP.replace(/\D/g, '');
    const message = `Olá ${ADMIN_NAME}! 👋\n\nMeu plano vence em ${subscription?.daysRemaining} dias e gostaria de renovar.\n\nComo faço para continuar usando o painel?`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const adminMenuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Users, label: 'Vendedores', path: '/sellers' },
    { icon: BarChart3, label: 'Relatórios', path: '/reports' },
    { icon: Database, label: 'Backup', path: '/backup' },
    { icon: Settings, label: 'Configurações', path: '/settings' },
  ];

  const sellerMenuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Users, label: 'Meus Clientes', path: '/clients' },
    { icon: Tv, label: 'Servidores', path: '/servers' },
    { icon: Receipt, label: 'Contas a Pagar', path: '/bills' },
    { icon: Ticket, label: 'Cupons', path: '/coupons' },
    { icon: Gift, label: 'Indicações', path: '/referrals' },
    { icon: MessageSquare, label: 'Templates', path: '/templates' },
    { icon: History, label: 'Histórico Mensagens', path: '/messages' },
    { icon: Settings, label: 'Configurações', path: '/settings' },
  ];

  const menuItems = isAdmin ? adminMenuItems : sellerMenuItems;

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background flex relative">
      {/* Seasonal Theme Background */}
      <ThemeBackground />
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 lg:w-72 bg-sidebar border-r border-sidebar-border transition-transform duration-300 flex flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="p-4 lg:p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-white flex items-center justify-center">
              <img src={logoImg} alt="Logo" className="w-8 h-8 object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-lg gradient-text truncate">Controle de Clientes</h1>
              <p className="text-xs text-muted-foreground capitalize">{role || 'Usuário'}</p>
            </div>
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 p-3 lg:p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const showBadge = item.path === '/clients' && !isAdmin && availableSlots > 0;
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setSidebarOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 lg:px-4 py-2.5 lg:py-3 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/15 text-primary border border-primary/30 glow-effect"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-primary"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive && "text-primary")} />
                <span className="flex-1 text-left truncate">{item.label}</span>
                {showBadge && <SharedPanelsBadge count={availableSlots} />}
                {isActive && !showBadge && <ChevronRight className="w-4 h-4 text-primary" />}
              </button>
            );
          })}
        </nav>

        {/* Subscription Counter for Sellers */}
        {!isAdmin && subscription && !subscription.isPermanent && subscription.expiresAt && (
          <div className="px-3 lg:px-4 py-2">
            <div className={cn(
              "px-3 py-2 rounded-lg border flex items-center gap-2",
              subscription.isExpired 
                ? "bg-destructive/10 border-destructive/30 text-destructive"
                : subscription.daysRemaining !== null && subscription.daysRemaining <= 1
                  ? "bg-red-500/10 border-red-500/30 text-red-500"
                  : subscription.daysRemaining !== null && subscription.daysRemaining <= 3
                    ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-500"
                    : "bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-500"
            )}>
              <Clock className="w-4 h-4 shrink-0" />
              <div className="flex-1 min-w-0">
                {subscription.isExpired ? (
                  <p className="text-xs font-medium">Plano expirado</p>
                ) : (
                  <>
                    <p className="text-xs font-medium">Vencimento</p>
                    <p className="text-sm font-bold">{format(new Date(subscription.expiresAt), 'dd/MM/yyyy')}</p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* User & Logout */}
        <div className="p-3 lg:p-4 border-t border-sidebar-border space-y-2">
          <div className="px-3 lg:px-4 py-2.5 lg:py-3 rounded-lg bg-sidebar-accent/50 border border-sidebar-border">
            <p className="text-sm font-medium truncate">{user?.email}</p>
            <p className="text-xs text-muted-foreground capitalize">{role}</p>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen w-full">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-between p-3 lg:p-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden"
              >
                <Menu className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2 lg:hidden">
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-white flex items-center justify-center">
                  <img src={logoImg} alt="Logo" className="w-6 h-6 object-contain" />
                </div>
                <span className="font-bold gradient-text">Controle de Clientes</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Share2 className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="end">
                  <div className="space-y-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-sm"
                      onClick={handleShare}
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      Compartilhar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-sm"
                      onClick={handleCopyLink}
                    >
                      {copied ? (
                        <Check className="w-4 h-4 mr-2 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 mr-2" />
                      )}
                      {copied ? 'Copiado!' : 'Copiar link'}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              
              <ForceUpdateButton variant="minimal" showLabel={false} />
              <ThemeSwitcher />
            </div>
          </div>

          {/* Subscription Expiring Warning Banner */}
          {isExpiringSoon && subscription?.expiresAt && (
            <div className="px-3 lg:px-6 pt-3">
              <Alert className="bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-500">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span>
                    ⚠️ Seu plano vence em <strong>{format(subscription.expiresAt, 'dd/MM/yyyy')}</strong>. Entre em contato para renovar!
                  </span>
                  <Button 
                    variant="whatsapp" 
                    size="sm"
                    onClick={handleContactAdmin}
                    className="shrink-0"
                  >
                    <MessageCircle className="w-4 h-4 mr-1" />
                    Falar com {ADMIN_NAME}
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 p-3 lg:p-6 xl:p-8 overflow-auto">
          {children}
        </main>
      </div>

      {/* Mobile close button */}
      {sidebarOpen && (
        <button
          className="fixed top-4 right-4 z-50 lg:hidden p-2 rounded-lg bg-card border border-border shadow-lg"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Subscription Expired Dialog */}
      <SubscriptionExpiredDialog />

      {/* Onboarding Tour for new sellers */}
      {!isAdmin && <OnboardingTour />}
    </div>
  );
}
