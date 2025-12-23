import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// AES-GCM encryption/decryption
const ALGORITHM = "AES-GCM";

async function getKey(): Promise<CryptoKey> {
  const encryptionKey = Deno.env.get("ENCRYPTION_KEY");
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY not configured");
  }
  
  // Derive a 256-bit key from the secret using SHA-256
  const encoder = new TextEncoder();
  const keyData = await crypto.subtle.digest("SHA-256", encoder.encode(encryptionKey));
  
  return crypto.subtle.importKey(
    "raw",
    keyData,
    { name: ALGORITHM },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encrypt(plaintext: string): Promise<string> {
  if (!plaintext) return "";
  
  const key = await getKey();
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    data
  );
  
  // Combine IV + encrypted data and encode as base64
  const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

function isLikelyEncrypted(value: string): boolean {
  // Encrypted values are base64 encoded and should be at least 13 characters
  // (12 bytes IV + at least 1 byte data, base64 encoded)
  if (value.length < 20) return false;
  
  // Check if it's valid base64
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  if (!base64Regex.test(value)) return false;
  
  // Check if value contains common plaintext patterns
  const plainTextPatterns = /^[a-zA-Z0-9_\-@.]+$/;
  if (plainTextPatterns.test(value) && value.length < 50) {
    // Could be a simple username/password, check for base64 specific patterns
    // Base64 encrypted data typically doesn't look like regular usernames
    const hasUpperAndLower = /[a-z]/.test(value) && /[A-Z]/.test(value);
    const hasNumbers = /[0-9]/.test(value);
    const hasPlusOrSlash = /[+/]/.test(value);
    
    // If it has base64 special chars, likely encrypted
    if (hasPlusOrSlash) return true;
    
    // Simple alphanumeric strings that look like usernames are probably not encrypted
    if (!hasPlusOrSlash && value.length < 30) return false;
  }
  
  return true;
}

async function decrypt(ciphertext: string): Promise<string> {
  if (!ciphertext) return "";
  
  // Check if the value looks like it's encrypted
  if (!isLikelyEncrypted(ciphertext)) {
    console.log("Value appears to be plaintext, returning as-is:", ciphertext.substring(0, 10) + "...");
    return ciphertext;
  }
  
  try {
    const key = await getKey();
    
    // Decode base64
    const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    
    // Encrypted data should have at least IV (12 bytes) + some data
    if (combined.length < 13) {
      console.log("Data too short to be encrypted, returning as-is");
      return ciphertext;
    }
    
    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);
    
    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      encryptedData
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error("Decryption error for value:", ciphertext.substring(0, 20) + "...", error);
    // If decryption fails, return the original value (might be unencrypted legacy data)
    return ciphertext;
  }
}

interface CryptoRequest {
  action: "encrypt" | "decrypt" | "encrypt_batch" | "decrypt_batch";
  data?: string;
  batch?: { [key: string]: string | null };
}

serve(async (req) => {
  console.log("crypto function called", req.method);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Não autorizado - sem token");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("Não autorizado - token inválido");
    }

    const body: CryptoRequest = await req.json();
    console.log("Action:", body.action);

    let result: any;

    switch (body.action) {
      case "encrypt":
        if (!body.data) {
          result = { encrypted: "" };
        } else {
          result = { encrypted: await encrypt(body.data) };
        }
        break;
        
      case "decrypt":
        if (!body.data) {
          result = { decrypted: "" };
        } else {
          result = { decrypted: await decrypt(body.data) };
        }
        break;
        
      case "encrypt_batch":
        if (!body.batch) {
          result = { encrypted: {} };
        } else {
          const encrypted: { [key: string]: string | null } = {};
          for (const [key, value] of Object.entries(body.batch)) {
            encrypted[key] = value ? await encrypt(value) : null;
          }
          result = { encrypted };
        }
        break;
        
      case "decrypt_batch":
        if (!body.batch) {
          result = { decrypted: {} };
        } else {
          const decrypted: { [key: string]: string | null } = {};
          for (const [key, value] of Object.entries(body.batch)) {
            decrypted[key] = value ? await decrypt(value) : null;
          }
          result = { decrypted };
        }
        break;
        
      default:
        throw new Error("Ação inválida");
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Crypto error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
