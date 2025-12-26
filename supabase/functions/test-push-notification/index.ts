import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Convert base64url to Uint8Array
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Convert Uint8Array to base64url
function uint8ArrayToBase64Url(arr: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Generate VAPID JWT token using ES256
async function generateVapidJwt(
  audience: string,
  subject: string,
  vapidPrivateKey: string,
  vapidPublicKey: string
): Promise<string> {
  const header = { alg: "ES256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60, // 12 hours
    sub: subject,
  };

  const headerB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import the private key for signing (P-256 / prime256v1)
  const privateKeyBytes = base64UrlToUint8Array(vapidPrivateKey);
  
  // Create JWK from raw private key bytes
  const privateKeyJwk = {
    kty: "EC",
    crv: "P-256",
    d: vapidPrivateKey,
    x: vapidPublicKey.substring(0, 43), // First 32 bytes (base64url encoded)
    y: vapidPublicKey.substring(43), // Last 32 bytes
  };

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    privateKeyJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  // Sign the token
  const signatureArrayBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = uint8ArrayToBase64Url(new Uint8Array(signatureArrayBuffer));
  
  return `${unsignedToken}.${signatureB64}`;
}

// Send push notification using fetch
async function sendPushNotification(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    const url = new URL(endpoint);
    const audience = `${url.protocol}//${url.host}`;

    console.log("[push] Generating JWT for audience:", audience);

    // Generate VAPID authorization header
    const jwt = await generateVapidJwt(audience, vapidSubject, vapidPrivateKey, vapidPublicKey);
    const vapidHeader = `vapid t=${jwt}, k=${vapidPublicKey}`;

    console.log("[push] Sending to:", endpoint.substring(0, 60) + "...");

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": vapidHeader,
        "TTL": "86400",
        "Urgency": "high",
      },
    });

    console.log("[push] Response status:", response.status);

    if (response.ok || response.status === 201) {
      return { success: true, statusCode: response.status };
    }

    const errorText = await response.text();
    console.error(`[push] Failed with status ${response.status}:`, errorText);
    
    return { 
      success: false, 
      statusCode: response.status, 
      error: `HTTP ${response.status}: ${errorText}` 
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[push] Exception:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;

    console.log("[test-push] Starting...");
    console.log("[test-push] VAPID keys configured:", !!vapidPublicKey && !!vapidPrivateKey);

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

    console.log(`[test-push] User authenticated: ${user.id}`);

    const { data: subscriptions, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("user_id, endpoint, p256dh, auth")
      .eq("user_id", user.id);

    if (subsError) {
      console.error("[test-push] Subscription fetch error:", subsError);
      throw subsError;
    }

    console.log(`[test-push] Found ${subscriptions?.length || 0} subscriptions`);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Nenhuma assinatura push encontrada. Ative as notificações primeiro.",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const vapidSubject = `mailto:admin@${new URL(supabaseUrl).hostname}`;
    const results: Array<{ success: boolean; error?: string }> = [];

    for (const subRow of subscriptions) {
      console.log("[test-push] Processing subscription...");
      
      const result = await sendPushNotification(
        subRow.endpoint,
        vapidPublicKey,
        vapidPrivateKey,
        vapidSubject
      );

      results.push(result);

      if (!result.success && (result.statusCode === 410 || result.statusCode === 404)) {
        console.log("[test-push] Removing invalid subscription");
        await supabase.from("push_subscriptions").delete().eq("endpoint", subRow.endpoint);
      }
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(`[test-push] Results: ${successCount}/${results.length} successful`);

    if (successCount === 0) {
      return new Response(
        JSON.stringify({
          error: "Falha ao enviar notificação. Tente desativar e ativar novamente as notificações.",
          results,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        message: "Notificação de teste enviada!",
        success: true,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
