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
  plan_type: 'trial' | 'active'; // trial = 3 days, active = 30 days
}

serve(async (req) => {
  console.log("create-seller function called", req.method);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    console.log("Creating supabase admin client");
    
    // Admin client for all operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    console.log("Auth header present:", !!authHeader);
    
    if (!authHeader) {
      console.error("No auth header");
      throw new Error("Não autorizado - sem token");
    }

    const token = authHeader.replace("Bearer ", "");
    console.log("Token extracted, length:", token.length);
    
    // Properly verify the JWT using Supabase's getUser method
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      console.error("Token verification failed:", userError?.message);
      throw new Error("Não autorizado - token inválido");
    }
    
    const userId = user.id;
    console.log("Verified user ID:", userId);

    // Check if requesting user is admin using the admin client
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    console.log("Role check - role:", roleData?.role, "error:", roleError?.message);

    if (roleError || roleData?.role !== "admin") {
      console.error("Role error:", roleError?.message, "role:", roleData?.role);
      throw new Error("Apenas administradores podem criar vendedores");
    }

    const body = await req.json();
    const { email, password, full_name, whatsapp, plan_type = 'trial' }: CreateSellerRequest = body;
    
    console.log("Creating seller with email:", email, "name:", full_name, "plan:", plan_type);

    // Calculate expiration based on plan type
    const now = new Date();
    const daysToAdd = plan_type === 'active' ? 30 : 3;
    const expirationDate = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

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

    // Update profile with whatsapp and subscription expiration
    if (newUser.user) {
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ 
          whatsapp: whatsapp || null, 
          full_name,
          subscription_expires_at: expirationDate.toISOString(),
          is_permanent: false
        })
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