import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// Service Worker path - must be at root for correct scope
const SW_PATH = "/sw-push.js";

export interface PushDiagnostics {
  browserSupported: boolean;
  serviceWorkerSupported: boolean;
  pushManagerSupported: boolean;
  notificationPermission: NotificationPermission;
  serviceWorkerState: string;
  serviceWorkerScope: string;
  subscriptionEndpoint: string | null;
  vapidKeyOk: boolean;
  dbSubscriptionExists: boolean;
  lastError: string | null;
}

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

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

export function usePushSubscription() {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<PushDiagnostics | null>(null);

  // Update diagnostics
  const updateDiagnostics = useCallback(async (
    reg: ServiceWorkerRegistration | null,
    sub: PushSubscription | null,
    error: string | null = null
  ) => {
    const browserSupported = typeof window !== "undefined";
    const serviceWorkerSupported = "serviceWorker" in navigator;
    const pushManagerSupported = "PushManager" in window;
    
    let vapidKeyOk = false;
    try {
      await getVapidPublicKey();
      vapidKeyOk = true;
    } catch {
      vapidKeyOk = false;
    }

    let dbSubscriptionExists = false;
    if (user && sub) {
      const { data } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .eq("endpoint", sub.endpoint)
        .maybeSingle();
      dbSubscriptionExists = !!data;
    }

    setDiagnostics({
      browserSupported,
      serviceWorkerSupported,
      pushManagerSupported,
      notificationPermission: Notification.permission,
      serviceWorkerState: reg?.active?.state || reg?.installing?.state || reg?.waiting?.state || "none",
      serviceWorkerScope: reg?.scope || "none",
      subscriptionEndpoint: sub?.endpoint || null,
      vapidKeyOk,
      dbSubscriptionExists,
      lastError: error,
    });
  }, [user]);

  // Initialize
  useEffect(() => {
    const init = async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      setIsSupported(supported);

      if (!supported) {
        setIsLoading(false);
        return;
      }

      setPermission(Notification.permission);

      try {
        // Register service worker at root scope
        console.log("[Push] Registering service worker at:", SW_PATH);
        const reg = await navigator.serviceWorker.register(SW_PATH, {
          scope: "/",
        });
        console.log("[Push] Service worker registered:", reg.scope);
        setRegistration(reg);

        // Wait for the service worker to be ready
        await navigator.serviceWorker.ready;
        console.log("[Push] Service worker is ready");

        // Check existing subscription
        const existingSub = await reg.pushManager.getSubscription();
        if (existingSub) {
          console.log("[Push] Found existing subscription");
          setIsSubscribed(true);
          await updateDiagnostics(reg, existingSub, null);
        } else {
          await updateDiagnostics(reg, null, null);
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error("[Push] Error registering service worker:", errMsg);
        setLastError(errMsg);
      }

      setIsLoading(false);
    };

    init();
  }, [updateDiagnostics]);

  // Check subscription when user changes
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
          await updateDiagnostics(registration, subscription, null);
        } else {
          setIsSubscribed(false);
          await updateDiagnostics(registration, null, null);
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error("[Push] Error checking subscription:", errMsg);
        setLastError(errMsg);
        setIsSubscribed(false);
      }
    };

    checkSubscription();
  }, [user, registration, updateDiagnostics]);

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
      setLastError(null);

      // Request permission
      console.log("[Push] Requesting notification permission...");
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      console.log("[Push] Permission result:", permissionResult);

      if (permissionResult !== "granted") {
        toast.error("Permissão para notificações negada");
        setLastError("Permission denied");
        return false;
      }

      // Ensure service worker is registered
      let reg = registration;
      if (!reg) {
        console.log("[Push] Registering service worker...");
        reg = await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
        setRegistration(reg);
      }

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
      console.log("[Push] Service worker ready, getting VAPID key...");

      // Get VAPID public key
      const vapidPublicKey = await getVapidPublicKey();
      console.log("[Push] Got VAPID key, length:", vapidPublicKey.length);
      
      const vapidKey = urlBase64ToUint8Array(vapidPublicKey);
      console.log("[Push] Application server key bytes:", vapidKey.length);

      // Subscribe to push
      console.log("[Push] Subscribing to push manager...");
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey.buffer as ArrayBuffer,
      });
      console.log("[Push] Subscribed successfully:", subscription.endpoint);

      // Save to database
      const subscriptionJson = subscription.toJSON();
      console.log("[Push] Saving subscription to database...");

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

      if (error) {
        console.error("[Push] Database error:", error);
        throw error;
      }

      console.log("[Push] Subscription saved to database");
      setIsSubscribed(true);
      await updateDiagnostics(reg, subscription, null);
      toast.success("Notificações ativadas com sucesso!");
      return true;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error("[Push] Error subscribing:", errMsg);
      setLastError(errMsg);
      toast.error(errMsg || "Erro ao ativar notificações");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, registration, user, updateDiagnostics]);

  const unsubscribe = useCallback(async () => {
    if (!user) return false;

    try {
      setIsLoading(true);

      const reg = registration ?? (await navigator.serviceWorker.getRegistration("/"));
      const subscription = await reg?.pushManager.getSubscription();

      if (subscription) {
        // Delete from database first
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", subscription.endpoint);

        // Then unsubscribe locally
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      await updateDiagnostics(reg || null, null, null);
      toast.success("Notificações desativadas");
      return true;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error("[Push] Error unsubscribing:", errMsg);
      setLastError(errMsg);
      toast.error("Erro ao desativar notificações");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [registration, user, updateDiagnostics]);

  // Force refresh subscription
  const refreshSubscription = useCallback(async () => {
    if (!registration) return;
    
    const sub = await registration.pushManager.getSubscription();
    await updateDiagnostics(registration, sub, lastError);
  }, [registration, lastError, updateDiagnostics]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe,
    lastError,
    diagnostics,
    refreshSubscription,
  };
}
