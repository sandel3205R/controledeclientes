import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("[test-push] Auth error:", authError);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Configure VAPID (web-push will handle encryption + required headers)
    const vapidSubject = `mailto:admin@${new URL(supabaseUrl).hostname}`;
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    console.log(`[test-push] Sending test notification to user: ${user.id}`);

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

    const now = new Date();
    const payload = JSON.stringify({
      title: "🔔 Teste de Notificação",
      body: `Notificações funcionando! ${now.toLocaleTimeString("pt-BR")}`,
      icon: "/logo.jpg",
      badge: "/pwa-192x192.png",
      url: "/dashboard",
      tag: "test-notification",
      test: true,
    });

    const results: Array<{ success: boolean; error?: string }> = [];

    for (const subRow of subscriptions as PushSubscriptionRow[]) {
      try {
        await webpush.sendNotification(toWebPushSubscription(subRow) as any, payload, {
          TTL: 60 * 60 * 24,
          urgency: "high",
        } as any);

        console.log("[test-push] Sent OK:", subRow.endpoint);
        results.push({ success: true });
      } catch (err: any) {
        const errorMessage = err?.message ? String(err.message) : String(err);
        const statusCode = err?.statusCode;

        console.error("[test-push] Push error:", { statusCode, errorMessage });
        results.push({ success: false, error: errorMessage });

        if (statusCode === 410 || statusCode === 404 || errorMessage.includes("410") ||
          errorMessage.includes("404") || errorMessage.includes("expired")) {
          console.log("[test-push] Removing invalid subscription:", subRow.endpoint);
          await supabase.from("push_subscriptions").delete().eq("endpoint", subRow.endpoint);
        }
      }
    }

    const successCount = results.filter((r) => r.success).length;

    if (successCount === 0) {
      return new Response(
        JSON.stringify({
          error:
            "Falha ao enviar notificação. Tente desativar e ativar novamente as notificações.",
          results,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ message: "Notificação de teste enviada!", success: true, results }),
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
