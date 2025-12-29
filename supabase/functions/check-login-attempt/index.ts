import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_FAILED_ATTEMPTS = 10;

interface RequestBody {
  email: string;
  action: 'check' | 'register_failure' | 'register_success';
  ip_address?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { email, action, ip_address }: RequestBody = await req.json();
    
    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Get failed attempts count for this email
    const { data: attempts, error: countError } = await supabase
      .from('login_attempts')
      .select('id')
      .eq('email', normalizedEmail)
      .eq('is_successful', false);

    if (countError) {
      console.error('Error counting attempts:', countError);
      return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const failedCount = attempts?.length || 0;
    const isBanned = failedCount >= MAX_FAILED_ATTEMPTS;
    const remainingAttempts = Math.max(0, MAX_FAILED_ATTEMPTS - failedCount);

    // Action: Check if banned
    if (action === 'check') {
      console.log(`Check for ${normalizedEmail}: ${failedCount} failed attempts, banned: ${isBanned}`);
      
      return new Response(
        JSON.stringify({ 
          banned: isBanned, 
          failedAttempts: failedCount,
          remainingAttempts,
          maxAttempts: MAX_FAILED_ATTEMPTS
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Register failed attempt
    if (action === 'register_failure') {
      const { error: insertError } = await supabase
        .from('login_attempts')
        .insert({
          email: normalizedEmail,
          ip_address: ip_address || null,
          is_successful: false
        });

      if (insertError) {
        console.error('Error registering failed attempt:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to register attempt' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const newFailedCount = failedCount + 1;
      const newIsBanned = newFailedCount >= MAX_FAILED_ATTEMPTS;
      const newRemainingAttempts = Math.max(0, MAX_FAILED_ATTEMPTS - newFailedCount);

      console.log(`Registered failure for ${normalizedEmail}: ${newFailedCount} total failures, banned: ${newIsBanned}`);

      return new Response(
        JSON.stringify({ 
          registered: true,
          banned: newIsBanned,
          failedAttempts: newFailedCount,
          remainingAttempts: newRemainingAttempts,
          maxAttempts: MAX_FAILED_ATTEMPTS
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Register successful login (clear failed attempts)
    if (action === 'register_success') {
      // Record successful attempt
      await supabase
        .from('login_attempts')
        .insert({
          email: normalizedEmail,
          ip_address: ip_address || null,
          is_successful: true
        });

      // Delete all failed attempts for this email
      const { error: deleteError } = await supabase
        .from('login_attempts')
        .delete()
        .eq('email', normalizedEmail)
        .eq('is_successful', false);

      if (deleteError) {
        console.error('Error clearing failed attempts:', deleteError);
      }

      console.log(`Registered success for ${normalizedEmail}: cleared failed attempts`);

      return new Response(
        JSON.stringify({ 
          registered: true,
          cleared: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-login-attempt:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
