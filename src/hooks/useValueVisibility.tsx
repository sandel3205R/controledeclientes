import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface ValueVisibilityContextType {
  valuesHidden: boolean;
  toggleVisibility: () => void;
  formatValue: (value: string | number) => string;
}

const ValueVisibilityContext = createContext<ValueVisibilityContextType | undefined>(undefined);

export function ValueVisibilityProvider({ children }: { children: ReactNode }) {
  const [valuesHidden, setValuesHidden] = useState(false);

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
