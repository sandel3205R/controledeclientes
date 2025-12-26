import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { differenceInDays, isPast, isToday, isTomorrow, addDays } from 'date-fns';

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
  expiringToday: ExpiringClient[];
  expiringTomorrow: ExpiringClient[];
  expiringIn3Days: ExpiringClient[];
  totalAmount: number;
}

export function useNotificationBadge() {
  const { user } = useAuth();
  const [badgeData, setBadgeData] = useState<NotificationBadgeData>({
    count: 0,
    expiringToday: [],
    expiringTomorrow: [],
    expiringIn3Days: [],
    totalAmount: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchExpiringClients = useCallback(async () => {
    if (!user) {
      setBadgeData({
        count: 0,
        expiringToday: [],
        expiringTomorrow: [],
        expiringIn3Days: [],
        totalAmount: 0
      });
      setIsLoading(false);
      return;
    }

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const in3Days = addDays(today, 3);
      
      const { data: clients, error } = await supabase
        .from('clients')
        .select('id, name, phone, expiration_date, plan_price')
        .eq('seller_id', user.id)
        .gte('expiration_date', today.toISOString().split('T')[0])
        .lte('expiration_date', in3Days.toISOString().split('T')[0])
        .order('expiration_date', { ascending: true });

      if (error) {
        console.error('Error fetching expiring clients:', error);
        return;
      }

      const expiringToday: ExpiringClient[] = [];
      const expiringTomorrow: ExpiringClient[] = [];
      const expiringIn3Days: ExpiringClient[] = [];
      let totalAmount = 0;

      (clients || []).forEach(client => {
        const expDate = new Date(client.expiration_date);
        const daysRemaining = differenceInDays(expDate, today);
        
        let urgency: 'critical' | 'high' | 'medium' | 'low' = 'low';
        if (daysRemaining <= 0) urgency = 'critical';
        else if (daysRemaining === 1) urgency = 'high';
        else if (daysRemaining <= 3) urgency = 'medium';

        const expiringClient: ExpiringClient = {
          ...client,
          daysRemaining,
          urgency
        };

        totalAmount += client.plan_price || 0;

        if (isToday(expDate)) {
          expiringToday.push(expiringClient);
        } else if (isTomorrow(expDate)) {
          expiringTomorrow.push(expiringClient);
        } else {
          expiringIn3Days.push(expiringClient);
        }
      });

      const count = expiringToday.length + expiringTomorrow.length + expiringIn3Days.length;

      setBadgeData({
        count,
        expiringToday,
        expiringTomorrow,
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
    refresh
  };
}
