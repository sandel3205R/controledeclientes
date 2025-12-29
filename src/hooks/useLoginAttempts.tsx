import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LoginAttemptResult {
  banned: boolean;
  failedAttempts: number;
  remainingAttempts: number;
  maxAttempts: number;
}

interface UseLoginAttemptsReturn {
  checkBanStatus: (email: string) => Promise<LoginAttemptResult | null>;
  registerFailure: (email: string) => Promise<LoginAttemptResult | null>;
  registerSuccess: (email: string) => Promise<void>;
  isChecking: boolean;
}

export function useLoginAttempts(): UseLoginAttemptsReturn {
  const [isChecking, setIsChecking] = useState(false);

  const callEdgeFunction = useCallback(async (
    email: string, 
    action: 'check' | 'register_failure' | 'register_success'
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke('check-login-attempt', {
        body: { email, action }
      });

      if (error) {
        console.error('Edge function error:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error calling edge function:', error);
      return null;
    }
  }, []);

  const checkBanStatus = useCallback(async (email: string): Promise<LoginAttemptResult | null> => {
    setIsChecking(true);
    try {
      const result = await callEdgeFunction(email, 'check');
      return result;
    } finally {
      setIsChecking(false);
    }
  }, [callEdgeFunction]);

  const registerFailure = useCallback(async (email: string): Promise<LoginAttemptResult | null> => {
    const result = await callEdgeFunction(email, 'register_failure');
    return result;
  }, [callEdgeFunction]);

  const registerSuccess = useCallback(async (email: string): Promise<void> => {
    await callEdgeFunction(email, 'register_success');
  }, [callEdgeFunction]);

  return {
    checkBanStatus,
    registerFailure,
    registerSuccess,
    isChecking
  };
}
