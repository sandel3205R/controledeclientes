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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;

    // Get user from authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify the user's token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('[test-push] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[test-push] Sending test notification to user: ${user.id}`);

    // Get user's push subscription
    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user.id);

    if (subsError) {
      throw subsError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[test-push] No push subscriptions found for user');
      return new Response(
        JSON.stringify({ error: 'Nenhuma assinatura push encontrada. Ative as notificações primeiro.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    const payload = JSON.stringify({
      title: '🔔 Teste de Notificação',
      body: `Notificações funcionando! ${now.toLocaleTimeString('pt-BR')}`,
      icon: '/logo.jpg',
      badge: '/pwa-192x192.png',
      url: '/dashboard',
      tag: 'test-notification',
      test: true
    });

    const results = [];
    for (const subscription of subscriptions as PushSubscription[]) {
      try {
        const response = await sendWebPush(
          subscription,
          payload,
          vapidPublicKey,
          vapidPrivateKey,
          supabaseUrl
        );
        console.log(`[test-push] Sent successfully: ${response.status}`);
        results.push({ success: true });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('[test-push] Error sending push:', errorMessage);
        results.push({ success: false, error: errorMessage });
        
        // Remove invalid subscription
        if (errorMessage.includes('410') || errorMessage.includes('404') || errorMessage.includes('expired')) {
          console.log(`[test-push] Removing invalid subscription`);
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', subscription.endpoint);
        }
      }
    }

    const successCount = results.filter(r => r.success).length;
    
    if (successCount === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Falha ao enviar notificação. Tente desativar e ativar novamente.',
          results 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        message: 'Notificação de teste enviada!',
        success: true,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[test-push] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function sendWebPush(
  subscription: PushSubscription,
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  audience: string
): Promise<Response> {
  const jwt = await createVapidJwt(
    new URL(subscription.endpoint).origin,
    vapidPrivateKey,
    audience
  );

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
      'Content-Type': 'application/json',
      'TTL': '86400',
      'Urgency': 'high'
    },
    body: payload
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Push failed: ${response.status} ${text}`);
  }

  return response;
}

async function createVapidJwt(
  audience: string,
  privateKey: string,
  supabaseUrl: string
): Promise<string> {
  const header = { alg: 'ES256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: `mailto:admin@${new URL(supabaseUrl).hostname}`
  };

  const headerB64 = btoa(JSON.stringify(header))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  const claimsB64 = btoa(JSON.stringify(claims))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  const unsignedToken = `${headerB64}.${claimsB64}`;
  
  try {
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
  } catch (e) {
    console.error('[test-push] JWT signing error:', e);
    return unsignedToken;
  }
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
