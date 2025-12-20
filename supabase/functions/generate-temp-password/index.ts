import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateTempPasswordRequest {
  seller_id: string;
}

// Generate random temporary password
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Não autorizado");
    }

    // Create Supabase client with the user's token
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client to verify the requesting user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the current user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Usuário não autenticado");
    }

    console.log("User requesting temp password generation:", user.id);

    // Check if user is admin
    const { data: roleData, error: roleError } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleError || roleData?.role !== "admin") {
      throw new Error("Apenas administradores podem gerar senhas temporárias");
    }

    console.log("User is admin, proceeding...");

    // Get request body
    const { seller_id }: GenerateTempPasswordRequest = await req.json();

    if (!seller_id) {
      throw new Error("ID do vendedor é obrigatório");
    }

    // Generate temporary password
    const tempPassword = generateTempPassword();
    
    // Calculate expiration (4 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 4);

    console.log("Generating temp password for seller:", seller_id);

    // Create admin client to change the password
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Update the user's password
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      seller_id,
      { password: tempPassword }
    );

    if (updateError) {
      console.error("Error updating password:", updateError);
      throw new Error("Erro ao gerar senha temporária: " + updateError.message);
    }

    // Update profile with temp password expiration
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({ temp_password_expires_at: expiresAt.toISOString() })
      .eq("id", seller_id);

    if (profileError) {
      console.error("Error updating profile:", profileError);
      // Don't throw, password was already changed
    }

    console.log("Temp password generated successfully for seller:", seller_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        temp_password: tempPassword,
        expires_at: expiresAt.toISOString(),
        message: "Senha temporária gerada com sucesso! Válida por 4 horas." 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Error in generate-temp-password:", errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
