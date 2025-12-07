import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get the authorization header to verify user is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decode the JWT to get user ID
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      console.log('User verification failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || roleData?.role !== 'admin') {
      console.log('User is not admin:', roleError);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting backup for admin user:', user.id);

    // Fetch all data from all tables
    const [
      { data: profiles, error: profilesError },
      { data: userRoles, error: userRolesError },
      { data: clients, error: clientsError },
      { data: servers, error: serversError },
      { data: plans, error: plansError },
      { data: templates, error: templatesError },
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('*'),
      supabaseAdmin.from('user_roles').select('*'),
      supabaseAdmin.from('clients').select('*'),
      supabaseAdmin.from('servers').select('*'),
      supabaseAdmin.from('plans').select('*'),
      supabaseAdmin.from('whatsapp_templates').select('*'),
    ]);

    if (profilesError) console.log('Profiles error:', profilesError);
    if (userRolesError) console.log('User roles error:', userRolesError);
    if (clientsError) console.log('Clients error:', clientsError);
    if (serversError) console.log('Servers error:', serversError);
    if (plansError) console.log('Plans error:', plansError);
    if (templatesError) console.log('Templates error:', templatesError);

    const backupData = {
      version: '1.0',
      created_at: new Date().toISOString(),
      tables: {
        profiles: profiles || [],
        user_roles: userRoles || [],
        clients: clients || [],
        servers: servers || [],
        plans: plans || [],
        whatsapp_templates: templates || [],
      },
      metadata: {
        total_profiles: profiles?.length || 0,
        total_clients: clients?.length || 0,
        total_servers: servers?.length || 0,
        total_plans: plans?.length || 0,
        total_templates: templates?.length || 0,
      }
    };

    console.log('Backup completed successfully. Metadata:', backupData.metadata);

    return new Response(
      JSON.stringify(backupData),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
        } 
      }
    );

  } catch (error: unknown) {
    console.error('Backup error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
