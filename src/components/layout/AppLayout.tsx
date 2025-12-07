import { ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Users,
  Package,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Tv,
  UserCircle,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAdmin = role === 'admin';

  const adminMenuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Users, label: 'Vendedores', path: '/sellers' },
    { icon: BarChart3, label: 'Relatórios', path: '/reports' },
    { icon: Settings, label: 'Configurações', path: '/settings' },
  ];

  const sellerMenuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Users, label: 'Meus Clientes', path: '/clients' },
    { icon: Settings, label: 'Configurações', path: '/settings' },
  ];

  const menuItems = isAdmin ? adminMenuItems : sellerMenuItems;

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background flex">
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
          "fixed lg:static inset-y-0 left-0 z-50 w-72 bg-sidebar border-r border-sidebar-border transition-transform duration-300 flex flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Tv className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg gradient-text">StreamControl</h1>
              <p className="text-xs text-muted-foreground capitalize">{role || 'Usuário'}</p>
            </div>
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setSidebarOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="flex-1 text-left">{item.label}</span>
                {isActive && <ChevronRight className="w-4 h-4" />}
              </button>
            );
          })}
        </nav>

        {/* User & Logout */}
        <div className="p-4 border-t border-sidebar-border space-y-2">
          <div className="px-4 py-3 rounded-lg bg-sidebar-accent/50">
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
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border p-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Tv className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold gradient-text">StreamControl</span>
            </div>
            <div className="w-10" /> {/* Spacer */}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>

      {/* Mobile close button */}
      {sidebarOpen && (
        <button
          className="fixed top-4 right-4 z-50 lg:hidden p-2 rounded-lg bg-card border border-border"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
