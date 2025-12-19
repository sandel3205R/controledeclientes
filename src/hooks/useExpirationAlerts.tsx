import { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { differenceInDays, isPast } from 'date-fns';

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
  const lastCheckRef = useRef<number>(0);
  const notifiedClientsRef = useRef<Set<string>>(new Set());

  const checkExpirations = useCallback(() => {
    if (!enabled || clients.length === 0) return;

    const now = new Date();
    const expiringToday: Client[] = [];
    const expiringTomorrow: Client[] = [];
    const newlyExpired: Client[] = [];

    clients.forEach((client) => {
      const expDate = new Date(client.expiration_date);
      const daysUntil = differenceInDays(expDate, now);
      const isExpired = isPast(expDate);
      const notificationKey = `${client.id}-${client.expiration_date}`;

      // Skip if already notified for this expiration
      if (notifiedClientsRef.current.has(notificationKey)) return;

      // Skip clients expired for more than 24 hours (daysUntil < 0 means expired)
      if (isExpired && daysUntil < 0) return;

      if (isExpired && daysUntil === 0) {
        // Expired today (within 24 hours)
        newlyExpired.push(client);
        notifiedClientsRef.current.add(notificationKey);
      } else if (daysUntil === 0) {
        expiringToday.push(client);
        notifiedClientsRef.current.add(notificationKey);
      } else if (daysUntil === 1) {
        expiringTomorrow.push(client);
        notifiedClientsRef.current.add(notificationKey);
      }
    });

    // Show notifications
    let shouldPlaySound = false;

    if (newlyExpired.length > 0) {
      shouldPlaySound = true;
      if (newlyExpired.length === 1) {
        toast.error(`Cliente "${newlyExpired[0].name}" expirou!`, {
          duration: 10000,
          description: 'Acesse a página de clientes para renovar.',
        });
      } else {
        toast.error(`${newlyExpired.length} clientes expiraram!`, {
          duration: 10000,
          description: 'Acesse a página de clientes para renovar.',
        });
      }
    }

    if (expiringToday.length > 0) {
      shouldPlaySound = true;
      if (expiringToday.length === 1) {
        toast.warning(`Cliente "${expiringToday[0].name}" vence HOJE!`, {
          duration: 10000,
          description: 'Não esqueça de renovar.',
        });
      } else {
        toast.warning(`${expiringToday.length} clientes vencem HOJE!`, {
          duration: 10000,
          description: 'Não esqueça de renovar.',
        });
      }
    }

    if (expiringTomorrow.length > 0) {
      if (expiringTomorrow.length === 1) {
        toast.info(`Cliente "${expiringTomorrow[0].name}" vence amanhã`, {
          duration: 8000,
        });
      } else {
        toast.info(`${expiringTomorrow.length} clientes vencem amanhã`, {
          duration: 8000,
        });
      }
    }

    // Play sound if enabled and there are urgent notifications
    if (shouldPlaySound && soundEnabled) {
      playAlertSound();
    }
  }, [clients, enabled, soundEnabled]);

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
