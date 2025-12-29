import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function usePasswordUpdateCheck() {
  const { user, role } = useAuth();
  const [needsPasswordUpdate, setNeedsPasswordUpdate] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkPasswordStatus = useCallback(async () => {
    if (!user) {
      setNeedsPasswordUpdate(false);
      setLoading(false);
      return;
    }

    // Only check for sellers, not admins
    if (role === 'admin') {
      setNeedsPasswordUpdate(false);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('needs_password_update')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error checking password status:', error);
        setNeedsPasswordUpdate(false);
      } else {
        setNeedsPasswordUpdate(data?.needs_password_update ?? false);
      }
    } catch (error) {
      console.error('Error checking password status:', error);
      setNeedsPasswordUpdate(false);
    } finally {
      setLoading(false);
    }
  }, [user, role]);

  useEffect(() => {
    checkPasswordStatus();
  }, [checkPasswordStatus]);

  const markPasswordUpdated = useCallback(() => {
    setNeedsPasswordUpdate(false);
  }, []);

  return {
    needsPasswordUpdate,
    loading,
    markPasswordUpdated,
    recheckStatus: checkPasswordStatus
  };
}
