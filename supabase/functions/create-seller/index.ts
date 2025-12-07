import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateSellerRequest {
  email: string;
  password: string;
  full_name: string;
  whatsapp?: string;
}

serve(async (req) => {
  console.log("create-seller function called", req.method);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    console.log("Creating supabase clients");
    
    // Admin client for creating users
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Regular client to verify the requesting user
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

    // Verify the requesting user is an admin
    const authHeader = req.headers.get("Authorization");
    console.log("Auth header present:", !!authHeader);
    
    if (!authHeader) {
      console.error("No auth header");
      throw new Error("Não autorizado - sem token");
    }

    const token = authHeader.replace("Bearer ", "");
    console.log("Token extracted, length:", token.length);
    
    // Use the admin client to get the user from the token
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    console.log("Auth result - user:", requestingUser?.id, "error:", authError?.message);
    
    if (authError || !requestingUser) {
      console.error("Auth error:", authError?.message);
      throw new Error("Não autorizado - token inválido");
    }

    // Check if requesting user is admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .single();

    console.log("Role check - role:", roleData?.role, "error:", roleError?.message);

    if (roleError || roleData?.role !== "admin") {
      console.error("Role error:", roleError?.message, "role:", roleData?.role);
      throw new Error("Apenas administradores podem criar vendedores");
    }

    const body = await req.json();
    const { email, password, full_name, whatsapp }: CreateSellerRequest = body;
    
    console.log("Creating seller with email:", email, "name:", full_name);

    // Create user with admin API (doesn't affect current session)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError) {
      console.error("Create user error:", createError.message);
      throw new Error(createError.message);
    }

    console.log("User created:", newUser.user?.id);

    // Update profile with whatsapp if provided
    if (whatsapp && newUser.user) {
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ whatsapp, full_name })
        .eq("id", newUser.user.id);
      
      if (updateError) {
        console.log("Profile update warning:", updateError.message);
      }
    }

    console.log("Seller created successfully");

    return new Response(
      JSON.stringify({ success: true, user: newUser.user }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error creating seller:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});