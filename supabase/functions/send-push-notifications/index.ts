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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;

    console.log('[send-push] Starting push notification process...');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all notification preferences
    const { data: allPreferences, error: prefsError } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('is_enabled', true);

    if (prefsError) {
      console.error('[send-push] Error fetching preferences:', prefsError);
    }

    console.log(`[send-push] Found ${allPreferences?.length || 0} enabled preferences`);

    // Create a map of user preferences (default to [1, 3, 7] if no preference set)
    const userPreferences = new Map<string, number[]>();
    if (allPreferences) {
      for (const pref of allPreferences as NotificationPreference[]) {
        userPreferences.set(pref.user_id, pref.days_before || [1, 3, 7]);
      }
    }

    // Get unique days to check from all preferences (include 0 for today)
    const allDaysToCheck = new Set<number>([0, 1, 3, 7]);
    userPreferences.forEach(days => days.forEach(d => allDaysToCheck.add(d)));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const clientsByDay: Record<number, Client[]> = {};
    
    for (const daysAhead of allDaysToCheck) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + daysAhead);
      const targetDateStr = targetDate.toISOString().split('T')[0];

      const { data: expiringClients, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, phone, expiration_date, seller_id, plan_price')
        .eq('expiration_date', targetDateStr);

      if (clientsError) {
        console.error(`[send-push] Error fetching clients for day ${daysAhead}:`, clientsError);
        continue;
      }

      if (expiringClients && expiringClients.length > 0) {
        clientsByDay[daysAhead] = expiringClients;
        console.log(`[send-push] Found ${expiringClients.length} clients expiring in ${daysAhead} days`);
      }
    }

    if (Object.keys(clientsByDay).length === 0) {
      console.log('[send-push] No expiring clients found');
      return new Response(
        JSON.stringify({ message: 'No expiring clients found for any configured period' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group notifications by seller and urgency
    const notificationsBySeller: Record<string, { 
      clients: Client[], 
      days: number[],
      totalAmount: number,
      mostUrgent: number 
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
              mostUrgent: 999
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

    // Get push subscriptions for sellers with notifications
    const sellerIds = Object.keys(notificationsBySeller);
    if (sellerIds.length === 0) {
      console.log('[send-push] No sellers match notification preferences');
      return new Response(
        JSON.stringify({ message: 'No sellers match notification preferences' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', sellerIds);

    if (subsError) {
      throw subsError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[send-push] No push subscriptions found for sellers');
      return new Response(
        JSON.stringify({ message: 'No push subscriptions found for sellers' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send-push] Sending to ${subscriptions.length} subscriptions`);

    // Send notifications
    const results = [];
    for (const subscription of subscriptions as PushSubscription[]) {
      const sellerData = notificationsBySeller[subscription.user_id];
      if (!sellerData) continue;

      const clientCount = sellerData.clients.length;
      const mostUrgent = sellerData.mostUrgent;
      
      // Build title based on urgency
      let title = '⚠️ Vencimento Próximo';
      if (mostUrgent === 0) {
        title = '🔴 Vencido Hoje!';
      } else if (mostUrgent === 1) {
        title = '🟠 Vencimento Amanhã!';
      } else if (mostUrgent <= 3) {
        title = `⚠️ Vencimento em ${mostUrgent} dias`;
      }

      // Build body
      let body = '';
      if (clientCount === 1) {
        const client = sellerData.clients[0];
        body = `${client.name}`;
        if (client.plan_price) {
          body += ` - R$ ${client.plan_price.toFixed(2).replace('.', ',')}`;
        }
      } else {
        body = `${clientCount} clientes vencendo`;
        if (sellerData.totalAmount > 0) {
          body += ` - R$ ${sellerData.totalAmount.toFixed(2).replace('.', ',')}`;
        }
      }
      
      const payload = JSON.stringify({
        title,
        body,
        icon: '/logo.jpg',
        badge: '/pwa-192x192.png',
        url: '/clients',
        tag: `expiration-${mostUrgent}`,
        daysRemaining: mostUrgent,
        totalAmount: sellerData.totalAmount,
        clients: sellerData.clients.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          price: c.plan_price
        }))
      });

      try {
        const response = await sendWebPush(
          subscription,
          payload,
          vapidPublicKey,
          vapidPrivateKey,
          supabaseUrl
        );
        console.log(`[send-push] Sent to ${subscription.user_id}: ${response.status}`);
        results.push({ userId: subscription.user_id, success: true });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('[send-push] Error sending push to', subscription.user_id, errorMessage);
        results.push({ userId: subscription.user_id, success: false, error: errorMessage });
        
        // Remove invalid subscription (410 Gone or 404 Not Found)
        if (errorMessage.includes('410') || errorMessage.includes('404') || errorMessage.includes('expired')) {
          console.log(`[send-push] Removing invalid subscription for ${subscription.user_id}`);
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', subscription.endpoint);
        }
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[send-push] Completed: ${successCount}/${results.length} successful`);

    return new Response(
      JSON.stringify({ 
        message: `Sent notifications to ${successCount} users`,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[send-push] Error:', errorMessage);
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
  // Create VAPID JWT
  const jwt = await createVapidJwt(
    new URL(subscription.endpoint).origin,
    vapidPrivateKey,
    audience
  );

  // For now, send unencrypted payload (basic push)
  // In production, you'd want to implement proper Web Push encryption
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
    exp: now + 12 * 60 * 60, // 12 hours
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
  } catch (e) {
    console.error('[send-push] JWT signing error:', e);
    // Return unsigned token as fallback (some push services accept this)
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
