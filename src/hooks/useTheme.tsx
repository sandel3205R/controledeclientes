import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type ThemeType = 'netflix' | 'neon-blue' | 'emerald';

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  themes: { id: ThemeType; name: string; colors: string[] }[];
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
];

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeType>(() => {
    const saved = localStorage.getItem('app-theme');
    return (saved as ThemeType) || 'netflix';
  });

  useEffect(() => {
    localStorage.setItem('app-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes }}>
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
