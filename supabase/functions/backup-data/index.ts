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
    console.log('Decrypt failed, returning original:', error);
    return ciphertext;
  }
}

async function decryptClientCredentials(client: Record<string, unknown>): Promise<Record<string, unknown>> {
  const decryptedClient = { ...client };
  
  for (const field of CREDENTIAL_FIELDS) {
    const value = client[field];
    if (value && typeof value === 'string') {
      decryptedClient[field] = await decrypt(value);
    }
  }
  
  return decryptedClient;
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

    // Decrypt client credentials if requested
    let processedClients = clients || [];
    if (decryptData && clients) {
      console.log('Decrypting client credentials...');
      processedClients = await Promise.all(
        clients.map((client: Record<string, unknown>) => decryptClientCredentials(client))
      );
      console.log('Decryption completed for', processedClients.length, 'clients');
    }

    const backupData = {
      version: '1.0',
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
