import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type ThemeType = 'netflix' | 'neon-blue' | 'emerald' | 'purple-galaxy' | 'sunset-orange' | 'cyberpunk' | 'ocean-deep' | 'gold-luxury' | 'aurora-violet' | 'citrus-light';

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  themes: { id: ThemeType; name: string; colors: string[] }[];
  isAdmin: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const themes = [
  { 
    id: 'netflix' as ThemeType, 
    name: 'Netflix', 
    colors: ['#E50914', '#B81D24', '#141414'] 
  },
  { 
    id: 'neon-blue' as ThemeType, 
    name: 'Neon Azul', 
    colors: ['#00D4FF', '#7C3AED', '#0F172A'] 
  },
  { 
    id: 'emerald' as ThemeType, 
    name: 'Esmeralda', 
    colors: ['#10B981', '#059669', '#0F1419'] 
  },
  { 
    id: 'purple-galaxy' as ThemeType, 
    name: 'Galáxia Roxa', 
    colors: ['#A855F7', '#6366F1', '#1E1033'] 
  },
  { 
    id: 'sunset-orange' as ThemeType, 
    name: 'Pôr do Sol', 
    colors: ['#F97316', '#EAB308', '#1A1207'] 
  },
  { 
    id: 'cyberpunk' as ThemeType, 
    name: 'Cyberpunk', 
    colors: ['#EC4899', '#06B6D4', '#0D0D12'] 
  },
  { 
    id: 'ocean-deep' as ThemeType, 
    name: 'Oceano Profundo', 
    colors: ['#0EA5E9', '#2DD4BF', '#0A1628'] 
  },
  { 
    id: 'gold-luxury' as ThemeType, 
    name: 'Ouro Luxuoso', 
    colors: ['#FBBF24', '#D97706', '#141008'] 
  },
  { 
    id: 'aurora-violet' as ThemeType, 
    name: 'Aurora Violeta', 
    colors: ['#FFFFFF', '#E879F9', '#581C87'] 
  },
  { 
    id: 'citrus-light' as ThemeType, 
    name: 'Citrus Claro', 
    colors: ['#F97316', '#FBBF24', '#FFFBEB'] 
  },
];

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeType>('netflix');
  const [isAdmin, setIsAdmin] = useState(false);

  // Fetch theme from database on mount
  useEffect(() => {
    const fetchTheme = async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'theme')
        .single();

      if (data && !error) {
        setThemeState(data.value as ThemeType);
        document.documentElement.setAttribute('data-theme', data.value);
      }
    };

    fetchTheme();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('theme-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'app_settings',
          filter: 'key=eq.theme'
        },
        (payload) => {
          const newTheme = payload.new.value as ThemeType;
          setThemeState(newTheme);
          document.documentElement.setAttribute('data-theme', newTheme);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();
        
        setIsAdmin(roleData?.role === 'admin');
      }
    };

    checkAdmin();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      checkAdmin();
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const setTheme = async (newTheme: ThemeType) => {
    if (!isAdmin) return;

    const { error } = await supabase
      .from('app_settings')
      .update({ value: newTheme })
      .eq('key', 'theme');

    if (!error) {
      setThemeState(newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes, isAdmin }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
