import { useEffect, useRef, useCallback, useState } from 'react';
import { toast } from 'sonner';
import { differenceInDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Client {
  id: string;
  name: string;
  phone?: string | null;
  expiration_date: string;
}

interface ExpirationAlertsOptions {
  clients: Client[];
  enabled: boolean;
  soundEnabled?: boolean;
  checkIntervalMinutes?: number;
}

// Simple beep sound using Web Audio API
const playAlertSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create two beeps
    const playBeep = (startTime: number, frequency: number) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.3);
    };
    
    const now = audioContext.currentTime;
    playBeep(now, 880); // A5
    playBeep(now + 0.35, 1047); // C6
    playBeep(now + 0.7, 1319); // E6
  } catch (error) {
    console.log('Could not play sound:', error);
  }
};

export function useExpirationAlerts({
  clients,
  enabled,
  soundEnabled = true,
  checkIntervalMinutes = 30,
}: ExpirationAlertsOptions) {
  const { user } = useAuth();
  const lastCheckRef = useRef<number>(0);
  const notifiedClientsRef = useRef<Set<string>>(new Set());
  const [messagedClients, setMessagedClients] = useState<Set<string>>(new Set());

  // Fetch clients that have already been messaged
  useEffect(() => {
    const fetchMessagedClients = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('client_message_tracking')
        .select('client_id, expiration_date')
        .eq('seller_id', user.id);
      
      if (data) {
        const messagedSet = new Set(
          data.map(m => `${m.client_id}-${m.expiration_date}`)
        );
        setMessagedClients(messagedSet);
      }
    };

    fetchMessagedClients();
    // Refresh every 5 minutes
    const interval = setInterval(fetchMessagedClients, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  const checkExpirations = useCallback(() => {
    if (!enabled || clients.length === 0) return;

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const expiringIn1Day: Client[] = [];
    const expiringIn2Days: Client[] = [];
    const expiringIn3Days: Client[] = [];

    clients.forEach((client) => {
      const expDate = new Date(client.expiration_date);
      expDate.setHours(0, 0, 0, 0);
      const daysUntil = differenceInDays(expDate, now);
      const notificationKey = `${client.id}-${client.expiration_date}`;

      // Skip if already notified for this expiration in this session
      if (notifiedClientsRef.current.has(notificationKey)) return;
      
      // Skip if client was already messaged (sent renewal message)
      if (messagedClients.has(notificationKey)) return;

      // Only show notifications for clients expiring in 1, 2, or 3 days
      if (daysUntil === 1) {
        expiringIn1Day.push(client);
        notifiedClientsRef.current.add(notificationKey);
      } else if (daysUntil === 2) {
        expiringIn2Days.push(client);
        notifiedClientsRef.current.add(notificationKey);
      } else if (daysUntil === 3) {
        expiringIn3Days.push(client);
        notifiedClientsRef.current.add(notificationKey);
      }
    });

    // Show notifications
    let shouldPlaySound = false;

    if (expiringIn1Day.length > 0) {
      shouldPlaySound = true;
      if (expiringIn1Day.length === 1) {
        toast.warning(`Cliente "${expiringIn1Day[0].name}" vence amanhã!`, {
          duration: 10000,
          description: 'Não esqueça de renovar.',
        });
      } else {
        toast.warning(`${expiringIn1Day.length} clientes vencem amanhã!`, {
          duration: 10000,
          description: 'Não esqueça de renovar.',
        });
      }
    }

    if (expiringIn2Days.length > 0) {
      if (expiringIn2Days.length === 1) {
        toast.info(`Cliente "${expiringIn2Days[0].name}" vence em 2 dias`, {
          duration: 8000,
        });
      } else {
        toast.info(`${expiringIn2Days.length} clientes vencem em 2 dias`, {
          duration: 8000,
        });
      }
    }

    if (expiringIn3Days.length > 0) {
      if (expiringIn3Days.length === 1) {
        toast.info(`Cliente "${expiringIn3Days[0].name}" vence em 3 dias`, {
          duration: 8000,
        });
      } else {
        toast.info(`${expiringIn3Days.length} clientes vencem em 3 dias`, {
          duration: 8000,
        });
      }
    }

    // Play sound if enabled and there are urgent notifications
    if (shouldPlaySound && soundEnabled) {
      playAlertSound();
    }
  }, [clients, enabled, soundEnabled, messagedClients]);

  useEffect(() => {
    // Initial check after a short delay
    const initialTimeout = setTimeout(() => {
      checkExpirations();
      lastCheckRef.current = Date.now();
    }, 3000);

    // Periodic check
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastCheckRef.current >= checkIntervalMinutes * 60 * 1000) {
        checkExpirations();
        lastCheckRef.current = now;
      }
    }, 60000); // Check every minute if it's time for periodic check

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [checkExpirations, checkIntervalMinutes]);

  // Reset notifications when clients change significantly
  useEffect(() => {
    const clientIds = new Set(clients.map(c => c.id));
    notifiedClientsRef.current.forEach(key => {
      const clientId = key.split('-')[0];
      if (!clientIds.has(clientId)) {
        notifiedClientsRef.current.delete(key);
      }
    });
  }, [clients]);

  return { checkExpirations, playAlertSound };
}
