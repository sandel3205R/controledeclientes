import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useMessageTracking() {
  const { user } = useAuth();

  const markAsMessaged = useCallback(async (clientId: string, expirationDate: string) => {
    if (!user) return;

    try {
      await supabase
        .from('client_message_tracking')
        .upsert({
          client_id: clientId,
          seller_id: user.id,
          expiration_date: expirationDate,
          messaged_at: new Date().toISOString()
        }, {
          onConflict: 'client_id,expiration_date'
        });
    } catch (error) {
      console.error('Error marking client as messaged:', error);
    }
  }, [user]);

  return { markAsMessaged };
}
