import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChangePasswordRequest {
  seller_id: string;
  new_password: string;
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

    console.log("User requesting password change:", user.id);

    // Check if user is admin
    const { data: roleData, error: roleError } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleError || roleData?.role !== "admin") {
      throw new Error("Apenas administradores podem alterar senhas");
    }

    console.log("User is admin, proceeding...");

    // Get request body
    const { seller_id, new_password }: ChangePasswordRequest = await req.json();

    if (!seller_id || !new_password) {
      throw new Error("ID do vendedor e nova senha são obrigatórios");
    }

    if (new_password.length < 6) {
      throw new Error("A senha deve ter no mínimo 6 caracteres");
    }

    console.log("Changing password for seller:", seller_id);

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
      { password: new_password }
    );

    if (updateError) {
      console.error("Error updating password:", updateError);
      throw new Error("Erro ao alterar senha: " + updateError.message);
    }

    console.log("Password changed successfully for seller:", seller_id);

    return new Response(
      JSON.stringify({ success: true, message: "Senha alterada com sucesso!" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Error in change-seller-password:", errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
