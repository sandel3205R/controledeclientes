import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface NotificationState {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  swRegistration: ServiceWorkerRegistration | null;
  error: string | null;
}

export function useNotifications() {
  const { user } = useAuth();
  const [state, setState] = useState<NotificationState>({
    isSupported: false,
    permission: 'default',
    isSubscribed: false,
    isLoading: true,
    swRegistration: null,
    error: null,
  });

  // Verificar suporte a notificações
  const checkSupport = useCallback(() => {
    const supported = 'Notification' in window && 
                      'serviceWorker' in navigator && 
                      'PushManager' in window;
    
    setState(prev => ({
      ...prev,
      isSupported: supported,
      permission: supported ? Notification.permission : 'denied',
    }));
    
    return supported;
  }, []);

  // Registrar Service Worker (usa o registration ativo/controlador quando existir)
  const registerServiceWorker = useCallback(async (): Promise<ServiceWorkerRegistration | null> => {
    try {
      console.log('[Notifications] Garantindo Service Worker...');

      const existing = await navigator.serviceWorker.getRegistration('/');
      const existingUrl =
        existing?.active?.scriptURL ??
        existing?.waiting?.scriptURL ??
        existing?.installing?.scriptURL ??
        '';

      // Se não houver SW ou ele não for o SW de push, registra/atualiza para o correto
      if (!existing || !existingUrl.includes('/sw-push.js')) {
        await navigator.serviceWorker.register('/sw-push.js', { scope: '/' });
      }

      // Sempre use o registration que está pronto/controlando a página
      const readyRegistration = await navigator.serviceWorker.ready;

      console.log('[Notifications] Service Worker pronto:', readyRegistration.scope);
      setState(prev => ({ ...prev, swRegistration: readyRegistration }));

      return readyRegistration;
    } catch (error) {
      console.error('[Notifications] Erro ao garantir SW:', error);
      setState(prev => ({ ...prev, error: 'Erro ao registrar Service Worker' }));
      return null;
    }
  }, []);

  // Verificar se já está inscrito e sincronizar com o banco se necessário
  const checkSubscription = useCallback(async (registration: ServiceWorkerRegistration) => {
    try {
      const subscription = await registration.pushManager.getSubscription();
      const isSubscribed = !!subscription;
      
      console.log('[Notifications] Subscription existente no navegador:', isSubscribed);
      
      // Se há subscription no navegador E usuário logado, sincronizar com o banco
      if (subscription && user) {
        const subscriptionJSON = subscription.toJSON();
        
        // Verificar se já existe no banco
        const { data: existingInDb } = await supabase
          .from('push_subscriptions')
          .select('id, endpoint')
          .eq('user_id', user.id)
          .maybeSingle();
        
        // Se não existe ou endpoint mudou, atualizar
        if (!existingInDb || existingInDb.endpoint !== subscriptionJSON.endpoint) {
          console.log('[Notifications] Sincronizando subscription com o banco...');
          await supabase
            .from('push_subscriptions')
            .upsert({
              user_id: user.id,
              endpoint: subscriptionJSON.endpoint!,
              p256dh: subscriptionJSON.keys!.p256dh,
              auth: subscriptionJSON.keys!.auth,
            }, {
              onConflict: 'user_id'
            });
          console.log('[Notifications] Subscription sincronizada com sucesso');
        }
      }
      
      setState(prev => ({ ...prev, isSubscribed }));
      return isSubscribed;
    } catch (error) {
      console.error('[Notifications] Erro ao verificar inscrição:', error);
      return false;
    }
  }, [user]);

  // Converter VAPID key para ArrayBuffer
  const urlBase64ToUint8Array = (base64String: string): ArrayBuffer => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const buffer = new ArrayBuffer(rawData.length);
    const outputArray = new Uint8Array(buffer);
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    return buffer;
  };

  // Pedir permissão
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      console.log('[Notifications] Pedindo permissão...');
      const permission = await Notification.requestPermission();
      
      setState(prev => ({ ...prev, permission }));
      console.log('[Notifications] Permissão:', permission);
      
      return permission === 'granted';
    } catch (error) {
      console.error('[Notifications] Erro ao pedir permissão:', error);
      return false;
    }
  }, []);

  // Ativar notificações
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // 1. Verificar suporte
      if (!checkSupport()) {
        throw new Error('Notificações não suportadas neste navegador');
      }

      // 2. Pedir permissão
      const hasPermission = await requestPermission();
      if (!hasPermission) {
        throw new Error('Permissão negada. Habilite nas configurações do navegador.');
      }

      // 3. Registrar Service Worker
      const registration = await registerServiceWorker();
      if (!registration) {
        throw new Error('Falha ao registrar Service Worker');
      }

      // 4. Buscar VAPID key
      console.log('[Notifications] Buscando VAPID key...');
      const { data: session } = await supabase.auth.getSession();
      
      const { data: vapidData, error: vapidError } = await supabase.functions.invoke('get-vapid-public-key', {
        headers: {
          Authorization: `Bearer ${session.session?.access_token}`
        }
      });

      if (vapidError || !vapidData?.publicKey) {
        throw new Error('Falha ao obter chave VAPID');
      }

      console.log('[Notifications] VAPID key obtida');

      // 5. Criar subscription
      const applicationServerKey = urlBase64ToUint8Array(vapidData.publicKey);
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
      });

      console.log('[Notifications] Subscription criada:', subscription);

      // 6. Salvar no banco
      const subscriptionJSON = subscription.toJSON();
      
      const { error: dbError } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: subscriptionJSON.endpoint!,
          p256dh: subscriptionJSON.keys!.p256dh,
          auth: subscriptionJSON.keys!.auth,
        }, {
          onConflict: 'user_id'
        });

      if (dbError) {
        throw new Error('Erro ao salvar no banco: ' + dbError.message);
      }

      setState(prev => ({ ...prev, isSubscribed: true, isLoading: false }));
      toast.success('Notificações ativadas com sucesso!');
      return true;

    } catch (error: any) {
      console.error('[Notifications] Erro:', error);
      const errorMessage = error.message || 'Erro ao ativar notificações';
      setState(prev => ({ ...prev, error: errorMessage, isLoading: false }));
      toast.error(errorMessage);
      return false;
    }
  }, [user, checkSupport, requestPermission, registerServiceWorker]);

  // Desativar notificações
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // 1. Remover do banco
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id);

      // 2. Cancelar subscription do navegador
      const registration =
        state.swRegistration ??
        (await navigator.serviceWorker.getRegistration('/')) ??
        (await navigator.serviceWorker.ready);

      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }

      setState(prev => ({ ...prev, isSubscribed: false, isLoading: false, swRegistration: registration }));
      toast.success('Notificações desativadas');
      return true;

    } catch (error: any) {
      console.error('[Notifications] Erro ao desativar:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      toast.error('Erro ao desativar notificações');
      return false;
    }
  }, [user, state.swRegistration]);

  // Enviar notificação de teste
  const sendTestNotification = useCallback(async (): Promise<boolean> => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return false;
    }

    try {
      const { data: session } = await supabase.auth.getSession();
      
      const { error } = await supabase.functions.invoke('test-push-notification', {
        headers: {
          Authorization: `Bearer ${session.session?.access_token}`
        }
      });

      if (error) throw error;

      toast.success('Notificação de teste enviada!');
      return true;

    } catch (error: any) {
      console.error('[Notifications] Erro no teste:', error);
      toast.error('Erro ao enviar teste: ' + (error.message || 'Erro desconhecido'));
      return false;
    }
  }, [user]);

  // Inicialização - roda quando o usuário muda também (login/logout)
  useEffect(() => {
    const init = async () => {
      if (!checkSupport()) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      const registration = await registerServiceWorker();
      if (registration) {
        await checkSubscription(registration);
      }

      setState(prev => ({ ...prev, isLoading: false }));
    };

    init();
  }, [user, checkSupport, registerServiceWorker, checkSubscription]);

  return {
    ...state,
    subscribe,
    unsubscribe,
    sendTestNotification,
    requestPermission,
  };
}