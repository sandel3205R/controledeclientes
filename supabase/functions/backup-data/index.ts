import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Credential fields that may be encrypted
const CREDENTIAL_FIELDS = [
  'login', 'password',
  'login2', 'password2',
  'login3', 'password3',
  'login4', 'password4',
  'login5', 'password5'
];

async function getKey(): Promise<CryptoKey> {
  const keyString = Deno.env.get('ENCRYPTION_KEY');
  if (!keyString) {
    throw new Error('ENCRYPTION_KEY not configured');
  }
  
  const keyData = new TextEncoder().encode(keyString.padEnd(32, '0').slice(0, 32));
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
}

function isLikelyEncrypted(value: string): boolean {
  if (!value || value.length < 20) return false;
  try {
    const decoded = atob(value);
    return decoded.length >= 12;
  } catch {
    return false;
  }
}

async function decrypt(ciphertext: string): Promise<string> {
  if (!ciphertext || typeof ciphertext !== 'string') {
    return ciphertext;
  }
  
  if (!isLikelyEncrypted(ciphertext)) {
    return ciphertext;
  }
  
  try {
    const key = await getKey();
    const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.log('Decrypt failed for value, returning original:', error);
    return ciphertext;
  }
}

async function decryptClientCredentials(client: Record<string, unknown>): Promise<Record<string, unknown>> {
  const decryptedClient = { ...client };
  
  for (const field of CREDENTIAL_FIELDS) {
    const value = client[field];
    if (value && typeof value === 'string') {
      try {
        decryptedClient[field] = await decrypt(value);
      } catch (e) {
        console.log(`Failed to decrypt ${field}, keeping original`);
        decryptedClient[field] = value;
      }
    }
  }
  
  return decryptedClient;
}

// Clean client for universal export - remove project-specific references
function cleanClientForExport(client: Record<string, unknown>): Record<string, unknown> {
  return {
    // Keep only essential, portable fields
    name: client.name || '',
    phone: client.phone || null,
    email: client.email || null,
    telegram: client.telegram || null,
    device: client.device || null,
    login: client.login || null,
    password: client.password || null,
    login2: client.login2 || null,
    password2: client.password2 || null,
    login3: client.login3 || null,
    password3: client.password3 || null,
    login4: client.login4 || null,
    password4: client.password4 || null,
    login5: client.login5 || null,
    password5: client.password5 || null,
    mac_address: client.mac_address || null,
    expiration_date: client.expiration_date || null,
    plan_name: client.plan_name || null,
    plan_price: client.plan_price || null,
    server_name: client.server_name || null,
    app_name: client.app_name || null,
    account_type: client.account_type || null,
    screens: client.screens || 1,
    notes: client.notes || null,
    payment_notes: client.payment_notes || null,
    is_paid: client.is_paid ?? true,
    is_annual_paid: client.is_annual_paid ?? false,
  };
}

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

    // Parse request body for options
    let decryptData = false;
    try {
      const body = await req.json();
      decryptData = body.decrypt === true;
    } catch {
      // No body or invalid JSON, use defaults
    }

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

    console.log('Starting backup for admin user:', user.id, 'Decrypt:', decryptData);

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

    // Process clients - decrypt if requested and clean for universal export
    let processedClients: Record<string, unknown>[] = [];
    if (clients && clients.length > 0) {
      console.log('Processing', clients.length, 'clients...');
      
      for (const client of clients) {
        let processedClient = client as Record<string, unknown>;
        
        // Decrypt if requested
        if (decryptData) {
          processedClient = await decryptClientCredentials(processedClient);
        }
        
        // Clean for universal export
        processedClient = cleanClientForExport(processedClient);
        processedClients.push(processedClient);
      }
      
      console.log('Processed', processedClients.length, 'clients');
    }

    const backupData = {
      version: '2.0',
      format: 'universal',
      created_at: new Date().toISOString(),
      decrypted: decryptData,
      tables: {
        profiles: profiles || [],
        user_roles: userRoles || [],
        clients: processedClients,
        servers: servers || [],
        plans: plans || [],
        whatsapp_templates: templates || [],
      },
      metadata: {
        total_profiles: profiles?.length || 0,
        total_clients: processedClients.length,
        total_servers: servers?.length || 0,
        total_plans: plans?.length || 0,
        total_templates: templates?.length || 0,
      }
    };

    console.log('Backup completed successfully. Metadata:', backupData.metadata);

    return new Response(
      JSON.stringify(backupData, null, 2),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json; charset=utf-8',
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