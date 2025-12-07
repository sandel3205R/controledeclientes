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

    console.log('Starting restore for admin user:', user.id);

    // Parse the backup data from request body
    const backupData = await req.json();

    if (!backupData.version || !backupData.tables) {
      return new Response(
        JSON.stringify({ error: 'Invalid backup format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = {
      plans: { inserted: 0, errors: 0 },
      servers: { inserted: 0, errors: 0 },
      clients: { inserted: 0, errors: 0 },
      whatsapp_templates: { inserted: 0, errors: 0 },
    };

    // Restore Plans (upsert to avoid duplicates)
    if (backupData.tables.plans && backupData.tables.plans.length > 0) {
      console.log('Restoring plans:', backupData.tables.plans.length);
      for (const plan of backupData.tables.plans) {
        const { error } = await supabaseAdmin
          .from('plans')
          .upsert(plan, { onConflict: 'id' });
        
        if (error) {
          console.log('Plan insert error:', error);
          results.plans.errors++;
        } else {
          results.plans.inserted++;
        }
      }
    }

    // Restore Servers (upsert)
    if (backupData.tables.servers && backupData.tables.servers.length > 0) {
      console.log('Restoring servers:', backupData.tables.servers.length);
      for (const server of backupData.tables.servers) {
        const { error } = await supabaseAdmin
          .from('servers')
          .upsert(server, { onConflict: 'id' });
        
        if (error) {
          console.log('Server insert error:', error);
          results.servers.errors++;
        } else {
          results.servers.inserted++;
        }
      }
    }

    // Restore Clients (upsert)
    if (backupData.tables.clients && backupData.tables.clients.length > 0) {
      console.log('Restoring clients:', backupData.tables.clients.length);
      for (const client of backupData.tables.clients) {
        const { error } = await supabaseAdmin
          .from('clients')
          .upsert(client, { onConflict: 'id' });
        
        if (error) {
          console.log('Client insert error:', error);
          results.clients.errors++;
        } else {
          results.clients.inserted++;
        }
      }
    }

    // Restore WhatsApp Templates (upsert)
    if (backupData.tables.whatsapp_templates && backupData.tables.whatsapp_templates.length > 0) {
      console.log('Restoring templates:', backupData.tables.whatsapp_templates.length);
      for (const template of backupData.tables.whatsapp_templates) {
        const { error } = await supabaseAdmin
          .from('whatsapp_templates')
          .upsert(template, { onConflict: 'id' });
        
        if (error) {
          console.log('Template insert error:', error);
          results.whatsapp_templates.errors++;
        } else {
          results.whatsapp_templates.inserted++;
        }
      }
    }

    console.log('Restore completed. Results:', results);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Restauração concluída',
        results 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    console.error('Restore error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
