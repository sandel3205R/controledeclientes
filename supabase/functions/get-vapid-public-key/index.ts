import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeKeyString(key: string): string {
  return key.trim().replace(/^['"]|['"]$/g, "");
}

function sanitizeBase64Like(key: string): string {
  return normalizeKeyString(key)
    .replace(/\s+/g, "")
    .replace(/[^A-Za-z0-9\-_+\/=]/g, "");
}

function isPem(key: string): boolean {
  return /-----BEGIN [^-]+-----/.test(normalizeKeyString(key));
}

function pemToBytes(pem: string): ArrayBuffer {
  const sanitized = normalizeKeyString(pem)
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "")
    .trim();

  const binary = atob(sanitized);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return buffer;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
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
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const publicKeyRaw = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
    if (!publicKeyRaw) {
      return new Response(JSON.stringify({ error: "VAPID_PUBLIC_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The browser requires the VAPID public key as base64url-encoded raw (uncompressed) P-256 point.
    let publicKeyForBrowser: string;

    if (isPem(publicKeyRaw)) {
      const spki = pemToBytes(publicKeyRaw);
      const key = await crypto.subtle.importKey(
        "spki",
        spki,
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        [],
      );
      const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
      publicKeyForBrowser = bytesToBase64Url(raw);
    } else {
      // Accept base64 or base64url (with extra characters) and normalize to base64url
      const cleaned = sanitizeBase64Like(publicKeyRaw);
      publicKeyForBrowser = cleaned.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    }

    return new Response(JSON.stringify({ publicKey: publicKeyForBrowser }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
