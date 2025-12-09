import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushSubscription {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface Client {
  name: string;
  expiration_date: string;
  seller_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get clients expiring in the next 3 days
    const today = new Date();
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const { data: expiringClients, error: clientsError } = await supabase
      .from('clients')
      .select('name, expiration_date, seller_id')
      .gte('expiration_date', today.toISOString().split('T')[0])
      .lte('expiration_date', threeDaysFromNow.toISOString().split('T')[0]);

    if (clientsError) {
      throw clientsError;
    }

    if (!expiringClients || expiringClients.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No expiring clients found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group clients by seller
    const clientsBySeller = expiringClients.reduce((acc, client) => {
      if (!acc[client.seller_id]) {
        acc[client.seller_id] = [];
      }
      acc[client.seller_id].push(client);
      return acc;
    }, {} as Record<string, Client[]>);

    // Get push subscriptions for sellers with expiring clients
    const sellerIds = Object.keys(clientsBySeller);
    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', sellerIds);

    if (subsError) {
      throw subsError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No subscriptions found for sellers with expiring clients' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send notifications
    const results = [];
    for (const subscription of subscriptions as PushSubscription[]) {
      const sellerClients = clientsBySeller[subscription.user_id];
      if (!sellerClients) continue;

      const clientCount = sellerClients.length;
      const payload = JSON.stringify({
        title: `${clientCount} cliente${clientCount > 1 ? 's' : ''} vencendo`,
        body: clientCount === 1 
          ? `${sellerClients[0].name} vence em breve!`
          : `Você tem ${clientCount} clientes com assinatura expirando nos próximos 3 dias.`,
        icon: '/pwa-192x192.png',
        url: '/clientes'
      });

      try {
        // Using web-push library equivalent for Deno
        const response = await sendPushNotification(
          subscription,
          payload,
          vapidPublicKey,
          vapidPrivateKey,
          supabaseUrl
        );
        results.push({ userId: subscription.user_id, success: true });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('Error sending push to', subscription.user_id, errorMessage);
        results.push({ userId: subscription.user_id, success: false, error: errorMessage });
        
        // Remove invalid subscription
        if (errorMessage.includes('410') || errorMessage.includes('404')) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', subscription.endpoint);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Sent notifications to ${results.filter(r => r.success).length} users`,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function sendPushNotification(
  subscription: PushSubscription,
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  audience: string
): Promise<Response> {
  const encoder = new TextEncoder();
  
  // Create JWT for VAPID
  const header = { alg: 'ES256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    aud: new URL(subscription.endpoint).origin,
    exp: now + 12 * 60 * 60,
    sub: `mailto:admin@${new URL(audience).hostname}`
  };

  const jwt = await createVapidJwt(header, claims, vapidPrivateKey);

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400'
    },
    body: await encryptPayload(payload, subscription.p256dh, subscription.auth)
  });

  if (!response.ok) {
    throw new Error(`Push failed: ${response.status} ${await response.text()}`);
  }

  return response;
}

async function createVapidJwt(header: object, claims: object, privateKey: string): Promise<string> {
  const headerB64 = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const claimsB64 = btoa(JSON.stringify(claims)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  const unsignedToken = `${headerB64}.${claimsB64}`;
  
  // Import private key and sign
  const keyData = base64UrlToArrayBuffer(privateKey);
  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsignedToken)
  );
  
  const signatureB64 = arrayBufferToBase64Url(signature);
  return `${unsignedToken}.${signatureB64}`;
}

async function encryptPayload(payload: string, _p256dh: string, _auth: string): Promise<ArrayBuffer> {
  // Simplified - in production use proper web-push encryption
  const encoder = new TextEncoder();
  return encoder.encode(payload).buffer as ArrayBuffer;
}

function base64UrlToArrayBuffer(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
