import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { differenceInDays, addDays } from 'date-fns';

interface ExpiringClient {
  id: string;
  name: string;
  phone: string | null;
  expiration_date: string;
  plan_price: number | null;
  daysRemaining: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
}

interface NotificationBadgeData {
  count: number;
  expiringIn1Day: ExpiringClient[];
  expiringIn2Days: ExpiringClient[];
  expiringIn3Days: ExpiringClient[];
  totalAmount: number;
}

export function useNotificationBadge() {
  const { user } = useAuth();
  const [badgeData, setBadgeData] = useState<NotificationBadgeData>({
    count: 0,
    expiringIn1Day: [],
    expiringIn2Days: [],
    expiringIn3Days: [],
    totalAmount: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchExpiringClients = useCallback(async () => {
    if (!user) {
      setBadgeData({
        count: 0,
        expiringIn1Day: [],
        expiringIn2Days: [],
        expiringIn3Days: [],
        totalAmount: 0
      });
      setIsLoading(false);
      return;
    }

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Start from tomorrow (1 day) to 3 days from now
      const tomorrow = addDays(today, 1);
      const in3Days = addDays(today, 3);
      
      // Fetch clients expiring in 1-3 days
      const { data: clients, error } = await supabase
        .from('clients')
        .select('id, name, phone, expiration_date, plan_price')
        .eq('seller_id', user.id)
        .gte('expiration_date', tomorrow.toISOString().split('T')[0])
        .lte('expiration_date', in3Days.toISOString().split('T')[0])
        .order('expiration_date', { ascending: true });

      if (error) {
        console.error('Error fetching expiring clients:', error);
        return;
      }

      // Fetch clients that have already been messaged
      const { data: messagedClients } = await supabase
        .from('client_message_tracking')
        .select('client_id, expiration_date')
        .eq('seller_id', user.id);

      // Create a set of messaged client+expiration combinations
      const messagedSet = new Set(
        (messagedClients || []).map(m => `${m.client_id}-${m.expiration_date}`)
      );

      const expiringIn1Day: ExpiringClient[] = [];
      const expiringIn2Days: ExpiringClient[] = [];
      const expiringIn3Days: ExpiringClient[] = [];
      let totalAmount = 0;

      (clients || []).forEach(client => {
        // Skip if already messaged for this expiration
        const trackingKey = `${client.id}-${client.expiration_date}`;
        if (messagedSet.has(trackingKey)) return;

        const expDate = new Date(client.expiration_date);
        const daysRemaining = differenceInDays(expDate, today);
        
        let urgency: 'critical' | 'high' | 'medium' | 'low' = 'low';
        if (daysRemaining === 1) urgency = 'critical';
        else if (daysRemaining === 2) urgency = 'high';
        else if (daysRemaining === 3) urgency = 'medium';

        const expiringClient: ExpiringClient = {
          ...client,
          daysRemaining,
          urgency
        };

        totalAmount += client.plan_price || 0;

        if (daysRemaining === 1) {
          expiringIn1Day.push(expiringClient);
        } else if (daysRemaining === 2) {
          expiringIn2Days.push(expiringClient);
        } else if (daysRemaining === 3) {
          expiringIn3Days.push(expiringClient);
        }
      });

      const count = expiringIn1Day.length + expiringIn2Days.length + expiringIn3Days.length;

      setBadgeData({
        count,
        expiringIn1Day,
        expiringIn2Days,
        expiringIn3Days,
        totalAmount
      });

      // Update app badge if supported
      if ('setAppBadge' in navigator && count > 0) {
        try {
          await (navigator as any).setAppBadge(count);
        } catch (e) {
          console.log('Badge API not supported');
        }
      } else if ('clearAppBadge' in navigator) {
        try {
          await (navigator as any).clearAppBadge();
        } catch (e) {
          // Ignore
        }
      }
    } catch (error) {
      console.error('Error in fetchExpiringClients:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Mark client as messaged
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
      
      // Refresh the badge data
      fetchExpiringClients();
    } catch (error) {
      console.error('Error marking client as messaged:', error);
    }
  }, [user, fetchExpiringClients]);

  useEffect(() => {
    fetchExpiringClients();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchExpiringClients, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [fetchExpiringClients]);

  const refresh = useCallback(() => {
    setIsLoading(true);
    fetchExpiringClients();
  }, [fetchExpiringClients]);

  return {
    ...badgeData,
    isLoading,
    refresh,
    markAsMessaged
  };
}
