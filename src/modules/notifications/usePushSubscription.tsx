import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

async function getVapidPublicKey(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Você precisa estar logado");

  const { data, error } = await supabase.functions.invoke("get-vapid-public-key", {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    const serverMsg = (data as any)?.error;
    throw new Error(serverMsg || error.message || "Erro ao buscar chave VAPID");
  }

  const publicKey = (data as any)?.publicKey as string | undefined;
  if (!publicKey) throw new Error("Chave VAPID não encontrada");
  return publicKey;
}

export function usePushSubscription() {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    const init = async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window;
      setIsSupported(supported);

      if (supported) {
        setPermission(Notification.permission);

        try {
          // SW dedicado em escopo isolado para não conflitar com o SW do PWA.
          const reg = await navigator.serviceWorker.register("/push/sw-push.js", {
            scope: "/push/",
          });
          setRegistration(reg);
        } catch (error) {
          console.error("Error registering push service worker:", error);
        }
      }

      setIsLoading(false);
    };

    init();
  }, []);

  useEffect(() => {
    const checkSubscription = async () => {
      if (!user || !registration) return;

      try {
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          const { data } = await supabase
            .from("push_subscriptions")
            .select("id")
            .eq("user_id", user.id)
            .eq("endpoint", subscription.endpoint)
            .maybeSingle();

          setIsSubscribed(!!data);
        } else {
          setIsSubscribed(false);
        }
      } catch (error) {
        console.error("Error checking subscription:", error);
        setIsSubscribed(false);
      }
    };

    checkSubscription();
  }, [user, registration]);

  const subscribe = useCallback(async () => {
    if (!user) {
      toast.error("Você precisa estar logado");
      return false;
    }

    if (!isSupported) {
      toast.error("Notificações push não são suportadas neste navegador");
      return false;
    }

    try {
      setIsLoading(true);

      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== "granted") {
        toast.error("Permissão para notificações negada");
        return false;
      }

      let reg = registration;
      if (!reg) {
        reg = await navigator.serviceWorker.register("/push/sw-push.js", {
          scope: "/push/",
        });
        setRegistration(reg);
      }

      const vapidPublicKey = await getVapidPublicKey();
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      const subscriptionJson = subscription.toJSON();

      const { error } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            user_id: user.id,
            endpoint: subscriptionJson.endpoint!,
            p256dh: subscriptionJson.keys!.p256dh,
            auth: subscriptionJson.keys!.auth,
          },
          {
            onConflict: "user_id,endpoint",
          },
        );

      if (error) throw error;

      setIsSubscribed(true);
      toast.success("Notificações ativadas com sucesso!");
      return true;
    } catch (error) {
      console.error("Error subscribing to push:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao ativar notificações");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, registration, user]);

  const unsubscribe = useCallback(async () => {
    if (!user) return false;

    try {
      setIsLoading(true);

      const reg = registration ?? (await navigator.serviceWorker.getRegistration("/push/"));
      const subscription = await reg?.pushManager.getSubscription();

      if (subscription) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", subscription.endpoint);

        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      toast.success("Notificações desativadas");
      return true;
    } catch (error) {
      console.error("Error unsubscribing:", error);
      toast.error("Erro ao desativar notificações");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [registration, user]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe,
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
