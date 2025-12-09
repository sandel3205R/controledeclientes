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
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    const initialize = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        // Handle invalid session errors
        if (error) {
          console.error('Session error:', error);
          setSession(null);
          setUser(null);
          setRole(null);
          setSubscription(null);
          setLoading(false);
          return;
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch role and subscription in parallel with timeout
          try {
            await Promise.race([
              Promise.all([
                fetchUserRole(session.user.id),
                fetchSubscription(session.user.id)
              ]),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 5000)
              )
            ]);
          } catch (err) {
            console.error('Error fetching user data:', err);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        // Clear state on error to prevent infinite loading
        if (mounted) {
          setSession(null);
          setUser(null);
          setRole(null);
          setSubscription(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Safety timeout - ensure loading always ends after 8 seconds max
    timeoutId = setTimeout(() => {
      if (mounted && loading) {
        console.warn('Auth initialization timeout - forcing loading to false');
        setLoading(false);
      }
    }, 8000);

    initialize();

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        // Only synchronous state updates here
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer Supabase calls with setTimeout to prevent deadlock
        if (session?.user) {
          setTimeout(() => {
            if (mounted) {
              Promise.all([
                fetchUserRole(session.user.id),
                fetchSubscription(session.user.id)
              ]).finally(() => {
                if (mounted) setLoading(false);
              });
            }
          }, 0);
        } else {
          setRole(null);
          setSubscription(null);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      authSubscription.unsubscribe();
    };
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
