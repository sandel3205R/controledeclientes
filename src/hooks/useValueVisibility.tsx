import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'valuesHidden';

interface ValueVisibilityContextType {
  valuesHidden: boolean;
  toggleVisibility: () => void;
  formatValue: (value: string | number) => string;
}

const ValueVisibilityContext = createContext<ValueVisibilityContextType | undefined>(undefined);

export function ValueVisibilityProvider({ children }: { children: ReactNode }) {
  const [valuesHidden, setValuesHidden] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(valuesHidden));
  }, [valuesHidden]);

  const toggleVisibility = useCallback(() => {
    setValuesHidden(prev => !prev);
  }, []);

  const formatValue = useCallback((value: string | number): string => {
    if (!valuesHidden) return String(value);
    const strValue = String(value);
    return strValue.replace(/[0-9]/g, '•').replace(/[R$]/g, '');
  }, [valuesHidden]);

  return (
    <ValueVisibilityContext.Provider value={{ valuesHidden, toggleVisibility, formatValue }}>
      {children}
    </ValueVisibilityContext.Provider>
  );
}

export function useValueVisibility() {
  const context = useContext(ValueVisibilityContext);
  if (context === undefined) {
    throw new Error('useValueVisibility must be used within a ValueVisibilityProvider');
  }
  return context;
}

// Hook standalone para uso fora do provider (ex: página de Clientes)
export function useLocalValueVisibility() {
  const [valuesHidden, setValuesHidden] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(valuesHidden));
  }, [valuesHidden]);

  const toggleVisibility = useCallback(() => {
    setValuesHidden(prev => !prev);
  }, []);

  return { valuesHidden, toggleVisibility };
}
