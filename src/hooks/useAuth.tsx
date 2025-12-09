import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface SubscriptionInfo {
  expiresAt: Date | null;
  isPermanent: boolean;
  isExpired: boolean;
  daysRemaining: number | null;
  hoursRemaining: number | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  subscription: SubscriptionInfo | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, whatsapp?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);

  const fetchUserRole = async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();
    
    if (data) {
      setRole(data.role);
    }
  };

  const fetchSubscription = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('subscription_expires_at, is_permanent')
      .eq('id', userId)
      .single();
    
    if (data) {
      const expiresAt = data.subscription_expires_at ? new Date(data.subscription_expires_at) : null;
      const isPermanent = data.is_permanent || false;
      const now = new Date();
      const isExpired = !isPermanent && expiresAt ? expiresAt < now : false;
      
      let daysRemaining: number | null = null;
      let hoursRemaining: number | null = null;
      
      if (expiresAt && !isPermanent) {
        const diffMs = expiresAt.getTime() - now.getTime();
        const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        
        daysRemaining = diffDays > 0 ? diffDays : 0;
        hoursRemaining = diffHours > 0 ? diffHours : 0;
      }

      setSubscription({
        expiresAt,
        isPermanent,
        isExpired,
        daysRemaining,
        hoursRemaining
      });
    }
  };

  const refreshSubscription = async () => {
    if (user) {
      await fetchSubscription(user.id);
    }
  };

  useEffect(() => {
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchUserRole(session.user.id);
            fetchSubscription(session.user.id);
          }, 0);
        } else {
          setRole(null);
          setSubscription(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id);
        fetchSubscription(session.user.id);
      }
      setLoading(false);
    });

    return () => authSubscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, whatsapp?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });

    // Update profile with whatsapp after signup
    if (!error && data.user && whatsapp) {
      await supabase
        .from('profiles')
        .update({ whatsapp })
        .eq('id', data.user.id);
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setSubscription(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, subscription, signIn, signUp, signOut, refreshSubscription }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
