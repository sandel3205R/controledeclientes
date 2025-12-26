import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushSubscriptionRow {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface Client {
  id: string;
  name: string;
  phone: string | null;
  expiration_date: string;
  seller_id: string;
  plan_price: number | null;
}

interface NotificationPreference {
  user_id: string;
  is_enabled: boolean;
  days_before: number[];
}

function sanitizeKeyString(key: string): string {
  return key.replace(/\s+/g, "").trim();
}

function isPem(key: string): boolean {
  return /-----BEGIN [^-]+-----/.test(key);
}

function pemToBytes(pem: string): ArrayBuffer {
  const sanitized = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "")
    .trim();

  try {
    const binary = atob(sanitized);
    const buffer = new ArrayBuffer(binary.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
    return buffer;
  } catch {
    throw new Error("Falha ao decodificar chave PEM (base64 inválido)");
  }
}

function base64UrlToBytes(input: string): Uint8Array {
  const s = sanitizeKeyString(input);
  const base64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);

  try {
    const binary = atob(base64 + padding);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    throw new Error("Falha ao decodificar base64/base64url");
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function jwkFromPkcs8Pem(pem: string): Promise<Required<Pick<JsonWebKey, "x" | "y" | "d">>> {
  const pkcs8Buffer = pemToBytes(pem);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8Buffer,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"],
  );

  const jwk = (await crypto.subtle.exportKey("jwk", key)) as JsonWebKey;
  if (!jwk.x || !jwk.y || !jwk.d) {
    throw new Error("Chave privada PEM inválida (faltando x/y/d)");
  }
  return { x: jwk.x, y: jwk.y, d: jwk.d };
}

async function jwkFromSpkiPem(pem: string): Promise<Required<Pick<JsonWebKey, "x" | "y">>> {
  const spkiBuffer = pemToBytes(pem);
  const key = await crypto.subtle.importKey(
    "spki",
    spkiBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    [],
  );

  const jwk = (await crypto.subtle.exportKey("jwk", key)) as JsonWebKey;
  if (!jwk.x || !jwk.y) {
    throw new Error("Chave pública PEM inválida (faltando x/y)");
  }
  return { x: jwk.x, y: jwk.y };
}

function xyFromUncompressedPublicKey(pubRaw: Uint8Array): { x: string; y: string } {
  if (pubRaw.length !== 65 || pubRaw[0] !== 0x04) {
    console.error("[send-push] Unexpected VAPID public key raw length:", pubRaw.length);
    throw new Error("Invalid VAPID_PUBLIC_KEY format");
  }

  return {
    x: bytesToBase64Url(pubRaw.slice(1, 33)),
    y: bytesToBase64Url(pubRaw.slice(33, 65)),
  };
}

function toWebPushSubscription(row: PushSubscriptionRow): webpush.PushSubscription {
  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  };
}

async function createApplicationServer(supabaseUrl: string) {
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";

  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error("VAPID keys are not configured");
  }

  let x: string;
  let y: string;
  let d: string;

  if (isPem(vapidPrivateKey)) {
    const jwk = await jwkFromPkcs8Pem(vapidPrivateKey);
    x = jwk.x;
    y = jwk.y;
    d = jwk.d;
  } else {
    const privRaw = base64UrlToBytes(vapidPrivateKey);
    if (privRaw.length !== 32) {
      console.error("[send-push] Unexpected VAPID private key raw length:", privRaw.length);
      throw new Error("Invalid VAPID_PRIVATE_KEY format");
    }
    d = bytesToBase64Url(privRaw);

    if (isPem(vapidPublicKey)) {
      const pubJwk = await jwkFromSpkiPem(vapidPublicKey);
      x = pubJwk.x;
      y = pubJwk.y;
    } else {
      const pubRaw = base64UrlToBytes(vapidPublicKey);
      const xy = xyFromUncompressedPublicKey(pubRaw);
      x = xy.x;
      y = xy.y;
    }
  }

  const exportedVapidKeys: webpush.ExportedVapidKeys = {
    publicKey: {
      kty: "EC",
      crv: "P-256",
      x,
      y,
      ext: true,
    },
    privateKey: {
      kty: "EC",
      crv: "P-256",
      x,
      y,
      d,
      ext: true,
    },
  };

  const vapidKeys = await webpush.importVapidKeys(exportedVapidKeys);
  const contactInformation = `mailto:admin@${new URL(supabaseUrl).hostname}`;

  return await webpush.ApplicationServer.new({
    contactInformation,
    vapidKeys,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    console.log("[send-push] Starting push notification process...");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const appServer = await createApplicationServer(supabaseUrl);

    // Get all notification preferences
    const { data: allPreferences, error: prefsError } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("is_enabled", true);

    if (prefsError) {
      console.error("[send-push] Error fetching preferences:", prefsError);
    }

    // Create a map of user preferences (default to [1, 3, 7] if no preference set)
    const userPreferences = new Map<string, number[]>();
    if (allPreferences) {
      for (const pref of allPreferences as unknown as NotificationPreference[]) {
        userPreferences.set(pref.user_id, (pref.days_before as unknown as number[]) || [1, 3, 7]);
      }
    }

    // Get unique days to check from all preferences (include 0 for today)
    const allDaysToCheck = new Set<number>([0, 1, 3, 7]);
    userPreferences.forEach((days) => days.forEach((d) => allDaysToCheck.add(d)));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const clientsByDay: Record<number, Client[]> = {};

    for (const daysAhead of allDaysToCheck) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + daysAhead);
      const targetDateStr = targetDate.toISOString().split("T")[0];

      const { data: expiringClients, error: clientsError } = await supabase
        .from("clients")
        .select("id, name, phone, expiration_date, seller_id, plan_price")
        .eq("expiration_date", targetDateStr);

      if (clientsError) {
        console.error(`[send-push] Error fetching clients for day ${daysAhead}:`, clientsError);
        continue;
      }

      if (expiringClients && expiringClients.length > 0) {
        clientsByDay[daysAhead] = expiringClients as unknown as Client[];
      }
    }

    if (Object.keys(clientsByDay).length === 0) {
      console.log("[send-push] No expiring clients found");
      return new Response(
        JSON.stringify({ message: "No expiring clients found for any configured period" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Group notifications by seller and urgency
    const notificationsBySeller: Record<string, {
      clients: Client[];
      days: number[];
      totalAmount: number;
      mostUrgent: number;
    }> = {};

    for (const [daysStr, clients] of Object.entries(clientsByDay)) {
      const days = parseInt(daysStr);

      for (const client of clients) {
        const sellerPrefs = userPreferences.get(client.seller_id) || [1, 3, 7];

        // Include day 0 (today) always, or if seller wants notifications for this day
        if (days === 0 || sellerPrefs.includes(days)) {
          if (!notificationsBySeller[client.seller_id]) {
            notificationsBySeller[client.seller_id] = {
              clients: [],
              days: [],
              totalAmount: 0,
              mostUrgent: 999,
            };
          }
          notificationsBySeller[client.seller_id].clients.push(client);
          notificationsBySeller[client.seller_id].totalAmount += client.plan_price || 0;

          if (!notificationsBySeller[client.seller_id].days.includes(days)) {
            notificationsBySeller[client.seller_id].days.push(days);
          }

          if (days < notificationsBySeller[client.seller_id].mostUrgent) {
            notificationsBySeller[client.seller_id].mostUrgent = days;
          }
        }
      }
    }

    const sellerIds = Object.keys(notificationsBySeller);
    if (sellerIds.length === 0) {
      return new Response(
        JSON.stringify({ message: "No sellers match notification preferences" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: subscriptions, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("user_id, endpoint, p256dh, auth")
      .in("user_id", sellerIds);

    if (subsError) throw subsError;

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No push subscriptions found for sellers" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[send-push] Sending to ${subscriptions.length} subscriptions`);

    const results: Array<{ userId: string; success: boolean; status?: number; error?: string }> = [];

    for (const subscription of subscriptions as PushSubscriptionRow[]) {
      const sellerData = notificationsBySeller[subscription.user_id];
      if (!sellerData) continue;

      const clientCount = sellerData.clients.length;
      const mostUrgent = sellerData.mostUrgent;

      let title = "⚠️ Vencimento Próximo";
      if (mostUrgent === 0) {
        title = "🔴 Vencido Hoje!";
      } else if (mostUrgent === 1) {
        title = "🟠 Vencimento Amanhã!";
      } else if (mostUrgent <= 3) {
        title = `⚠️ Vencimento em ${mostUrgent} dias`;
      }

      let body = "";
      if (clientCount === 1) {
        const client = sellerData.clients[0];
        body = `${client.name}`;
        if (client.plan_price) {
          body += ` - R$ ${client.plan_price.toFixed(2).replace(".", ",")}`;
        }
      } else {
        body = `${clientCount} clientes vencendo`;
        if (sellerData.totalAmount > 0) {
          body += ` - R$ ${sellerData.totalAmount.toFixed(2).replace(".", ",")}`;
        }
      }

      const payload = JSON.stringify({
        title,
        body,
        icon: "/logo.jpg",
        badge: "/pwa-192x192.png",
        url: "/clients",
        tag: `expiration-${mostUrgent}`,
        daysRemaining: mostUrgent,
        totalAmount: sellerData.totalAmount,
        clients: sellerData.clients.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          price: c.plan_price,
        })),
      });

      const sub = appServer.subscribe(toWebPushSubscription(subscription));

      try {
        await sub.pushTextMessage(payload, {
          ttl: 60 * 60 * 24,
          urgency: webpush.Urgency.High,
          topic: `expiration-${mostUrgent}`,
        });

        results.push({ userId: subscription.user_id, success: true });
      } catch (err) {
        if (err instanceof webpush.PushMessageError) {
          const status = err.response?.status;
          const errorText = await err.response?.text().catch(() => undefined);
          console.error("[send-push] PushMessageError:", subscription.user_id, status, errorText);

          if (err.isGone()) {
            await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
          }

          results.push({ userId: subscription.user_id, success: false, status, error: errorText ?? err.toString() });
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[send-push] Unknown push error:", subscription.user_id, msg);
          results.push({ userId: subscription.user_id, success: false, error: msg });
        }
      }
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(`[send-push] Completed: ${successCount}/${results.length} successful`);

    return new Response(
      JSON.stringify({
        message: `Sent notifications to ${successCount} users`,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[send-push] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
