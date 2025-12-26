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

function sanitizeKeyString(key: string): string {
  // Remove whitespace/newlines (secrets sometimes get pasted with line breaks)
  return key.replace(/\s+/g, "").trim();
}

function isPem(key: string): boolean {
  return /-----BEGIN [^-]+-----/.test(key);
}

function pemToBytes(pem: string): Uint8Array {
  const sanitized = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "")
    .trim();

  try {
    const binary = atob(sanitized);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
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
  const pkcs8 = pemToBytes(pem);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
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
  const spki = pemToBytes(pem);
  const key = await crypto.subtle.importKey(
    "spki",
    spki,
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
  // Uncompressed EC point (65 bytes, 0x04 | X32 | Y32)
  if (pubRaw.length !== 65 || pubRaw[0] !== 0x04) {
    console.error("[test-push] Unexpected VAPID public key raw length:", pubRaw.length);
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

  // Prefer PEM for private key if present (common format)
  if (isPem(vapidPrivateKey)) {
    const jwk = await jwkFromPkcs8Pem(vapidPrivateKey);
    x = jwk.x;
    y = jwk.y;
    d = jwk.d;
  } else {
    const privRaw = base64UrlToBytes(vapidPrivateKey);
    if (privRaw.length !== 32) {
      console.error("[test-push] Unexpected VAPID private key raw length:", privRaw.length);
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("[test-push] Auth error:", authError);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subscriptions, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("user_id, endpoint, p256dh, auth")
      .eq("user_id", user.id);

    if (subsError) throw subsError;

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Nenhuma assinatura push encontrada. Ative as notificações primeiro.",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Pick the closest client to expire for a realistic test payload
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];

    const { data: closestClient, error: clientError } = await supabase
      .from("clients")
      .select("id, name, expiration_date, plan_price")
      .eq("seller_id", user.id)
      .gte("expiration_date", todayStr)
      .order("expiration_date", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (clientError) {
      console.error("[test-push] Error fetching closest client:", clientError);
    }

    let daysRemaining = 999;
    let clientName: string | null = null;
    let clientId: string | null = null;
    let amount = 0;

    if (closestClient) {
      clientName = closestClient.name;
      clientId = closestClient.id;
      amount = Number(closestClient.plan_price ?? 0);

      const exp = new Date(`${closestClient.expiration_date}T00:00:00`);
      exp.setHours(0, 0, 0, 0);
      daysRemaining = Math.max(0, Math.round((exp.getTime() - today.getTime()) / 86400000));
    }

    const body = closestClient
      ? (daysRemaining === 0
        ? `Cliente ${clientName} vence hoje${amount ? ` - R$ ${amount.toFixed(2).replace(".", ",")}` : ""}`
        : daysRemaining === 1
        ? `Cliente ${clientName} vence amanhã${amount ? ` - R$ ${amount.toFixed(2).replace(".", ",")}` : ""}`
        : `Cliente ${clientName} vence em ${daysRemaining} dias${amount ? ` - R$ ${amount.toFixed(2).replace(".", ",")}` : ""}`)
      : `Teste de notificação enviado às ${new Date().toLocaleTimeString("pt-BR")}`;

    const payload = JSON.stringify({
      title: "⚠️ Vencimento Próximo",
      body,
      icon: "/logo.jpg",
      badge: "/pwa-192x192.png",
      url: "/clients",
      tag: `test-expiration-${daysRemaining}`,
      daysRemaining,
      totalAmount: amount,
      clients: closestClient
        ? [{ id: clientId, name: clientName, phone: null, price: amount }]
        : [],
      test: true,
    });

    const appServer = await createApplicationServer(supabaseUrl);

    const results: Array<{ success: boolean; status?: number; error?: string }> = [];

    for (const row of subscriptions as PushSubscriptionRow[]) {
      const subscription = toWebPushSubscription(row);
      const subscriber = appServer.subscribe(subscription);

      try {
        await subscriber.pushTextMessage(payload, {
          ttl: 60 * 60 * 24,
          urgency: webpush.Urgency.High,
          topic: "test",
        });

        results.push({ success: true });
      } catch (err) {
        if (err instanceof webpush.PushMessageError) {
          const status = err.response?.status;
          const errorText = await err.response?.text().catch(() => undefined);
          console.error("[test-push] PushMessageError:", status, errorText);

          // subscription expired / invalid
          if (err.isGone()) {
            await supabase.from("push_subscriptions").delete().eq("endpoint", row.endpoint);
          }

          results.push({ success: false, status, error: errorText ?? err.toString() });
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[test-push] Unknown push error:", msg);
          results.push({ success: false, error: msg });
        }
      }
    }

    const successCount = results.filter((r) => r.success).length;

    if (successCount === 0) {
      return new Response(
        JSON.stringify({
          error: "Falha ao enviar notificação. Tente desativar e ativar novamente as notificações.",
          results,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        message: "Notificação de teste enviada!",
        success: true,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[test-push] Error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
