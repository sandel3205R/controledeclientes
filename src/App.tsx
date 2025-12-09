import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { OfflineSyncProvider } from "@/hooks/useOfflineSync";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { VersionNotification } from "@/components/VersionNotification";
import { LoadingSkeleton, AuthLoadingSkeleton, MinimalSpinner } from "@/components/LoadingSkeleton";

// Lazy load all pages for faster initial load
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Clients = lazy(() => import("./pages/Clients"));
const Plans = lazy(() => import("./pages/Plans"));
const Sellers = lazy(() => import("./pages/Sellers"));
const Templates = lazy(() => import("./pages/Templates"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const Install = lazy(() => import("./pages/Install"));
const Servers = lazy(() => import("./pages/Servers"));
const Backup = lazy(() => import("./pages/Backup"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return <MinimalSpinner />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (adminOnly && role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <MinimalSpinner />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/install"
        element={
          <Suspense fallback={<AuthLoadingSkeleton />}>
            <Install />
          </Suspense>
        }
      />
      <Route
        path="/auth"
        element={
          <AuthRoute>
            <Suspense fallback={<AuthLoadingSkeleton />}>
              <Auth />
            </Suspense>
          </AuthRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Suspense fallback={<LoadingSkeleton />}>
              <Dashboard />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/clients"
        element={
          <ProtectedRoute>
            <Suspense fallback={<LoadingSkeleton />}>
              <Clients />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/plans"
        element={
          <ProtectedRoute adminOnly>
            <Suspense fallback={<LoadingSkeleton />}>
              <Plans />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/sellers"
        element={
          <ProtectedRoute adminOnly>
            <Suspense fallback={<LoadingSkeleton />}>
              <Sellers />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute adminOnly>
            <Suspense fallback={<LoadingSkeleton />}>
              <Reports />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/templates"
        element={
          <ProtectedRoute>
            <Suspense fallback={<LoadingSkeleton />}>
              <Templates />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/servers"
        element={
          <ProtectedRoute>
            <Suspense fallback={<LoadingSkeleton />}>
              <Servers />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Suspense fallback={<LoadingSkeleton />}>
              <Settings />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/backup"
        element={
          <ProtectedRoute adminOnly>
            <Suspense fallback={<LoadingSkeleton />}>
              <Backup />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="*"
        element={
          <Suspense fallback={<MinimalSpinner />}>
            <NotFound />
          </Suspense>
        }
      />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <OfflineSyncProvider>
        <TooltipProvider>
          <Toaster position="top-right" richColors />
          <BrowserRouter>
            <AuthProvider>
              <AppRoutes />
              <OfflineIndicator />
              <VersionNotification />
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </OfflineSyncProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
