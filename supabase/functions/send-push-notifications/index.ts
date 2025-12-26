import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

function toWebPushSubscription(row: PushSubscriptionRow) {
  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  };
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

    // Configure VAPID (web-push will handle encryption + required headers)
    const vapidSubject = `mailto:admin@${new URL(supabaseUrl).hostname}`;
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

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
      .select('user_id, endpoint, p256dh, auth')
      .in('user_id', sellerIds);

    if (subsError) throw subsError;

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[send-push] No push subscriptions found for sellers');
      return new Response(
        JSON.stringify({ message: 'No push subscriptions found for sellers' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send-push] Sending to ${subscriptions.length} subscriptions`);

    const results: Array<{ userId: string; success: boolean; error?: string }> = [];

    for (const subscription of subscriptions as PushSubscriptionRow[]) {
      const sellerData = notificationsBySeller[subscription.user_id];
      if (!sellerData) continue;

      const clientCount = sellerData.clients.length;
      const mostUrgent = sellerData.mostUrgent;

      let title = '⚠️ Vencimento Próximo';
      if (mostUrgent === 0) {
        title = '🔴 Vencido Hoje!';
      } else if (mostUrgent === 1) {
        title = '🟠 Vencimento Amanhã!';
      } else if (mostUrgent <= 3) {
        title = `⚠️ Vencimento em ${mostUrgent} dias`;
      }

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
        clients: sellerData.clients.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          price: c.plan_price,
        })),
      });

      try {
        await webpush.sendNotification(toWebPushSubscription(subscription) as any, payload, {
          TTL: 60 * 60 * 24,
          urgency: 'high',
        } as any);

        console.log(`[send-push] Sent to ${subscription.user_id}`);
        results.push({ userId: subscription.user_id, success: true });
      } catch (err: any) {
        const errorMessage = err?.message ? String(err.message) : String(err);
        const statusCode = err?.statusCode;

        console.error('[send-push] Error sending push to', subscription.user_id, { statusCode, errorMessage });
        results.push({ userId: subscription.user_id, success: false, error: errorMessage });

        if (statusCode === 410 || statusCode === 404 || errorMessage.includes('410') || errorMessage.includes('404') || errorMessage.includes('expired')) {
          console.log(`[send-push] Removing invalid subscription for ${subscription.user_id}`);
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', subscription.endpoint);
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
