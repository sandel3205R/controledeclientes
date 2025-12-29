import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Verify user authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('No authorization header provided')
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create client with user's token to verify identity
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()

    if (userError || !user) {
      console.error('Invalid token:', userError?.message)
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create service role client for privileged operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Check user role - only sellers can delete their own account
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleError) {
      console.error('Error fetching role:', roleError.message)
      return new Response(
        JSON.stringify({ error: 'Error verifying user role' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prevent admins from using this endpoint
    if (roleData?.role === 'admin') {
      console.error('Admin tried to delete account via this endpoint')
      return new Response(
        JSON.stringify({ error: 'Admins cannot delete their account' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Seller ${user.email} requested account deletion`)

    // Get user email for banning
    const userEmail = user.email?.toLowerCase()
    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: 'User email not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Add email to banned list
    const { error: banError } = await supabase
      .from('banned_emails')
      .insert({
        email: userEmail,
        reason: 'account_self_deleted',
        banned_by: user.id
      })

    if (banError && !banError.message.includes('duplicate')) {
      console.error('Error banning email:', banError.message)
      // Continue with deletion even if ban fails
    }

    console.log(`Email ${userEmail} added to banned list`)

    // Delete all associated data
    try {
      // Delete clients first (has foreign keys)
      await supabase.from('clients').delete().eq('seller_id', user.id)
      console.log('Deleted clients')
      
      // Delete servers
      await supabase.from('servers').delete().eq('seller_id', user.id)
      console.log('Deleted servers')
      
      // Delete templates
      await supabase.from('whatsapp_templates').delete().eq('seller_id', user.id)
      console.log('Deleted templates')
      
      // Delete coupons
      await supabase.from('coupons').delete().eq('seller_id', user.id)
      console.log('Deleted coupons')
      
      // Delete bills
      await supabase.from('bills_to_pay').delete().eq('seller_id', user.id)
      console.log('Deleted bills')
      
      // Delete shared panels
      await supabase.from('shared_panels').delete().eq('seller_id', user.id)
      console.log('Deleted shared panels')
      
      // Delete app types
      await supabase.from('app_types').delete().eq('seller_id', user.id)
      console.log('Deleted app types')
      
      // Delete account categories
      await supabase.from('account_categories').delete().eq('seller_id', user.id)
      console.log('Deleted account categories')
      
      // Delete message history
      await supabase.from('message_history').delete().eq('seller_id', user.id)
      console.log('Deleted message history')
      
      // Delete message tracking
      await supabase.from('client_message_tracking').delete().eq('seller_id', user.id)
      console.log('Deleted message tracking')
      
      // Delete notification preferences
      await supabase.from('notification_preferences').delete().eq('user_id', user.id)
      console.log('Deleted notification preferences')
      
      // Delete push subscriptions
      await supabase.from('push_subscriptions').delete().eq('user_id', user.id)
      console.log('Deleted push subscriptions')
      
      // Delete referrals
      await supabase.from('referrals').delete().eq('seller_id', user.id)
      console.log('Deleted referrals')
      
      // Delete coupon usages
      await supabase.from('coupon_usages').delete().eq('seller_id', user.id)
      console.log('Deleted coupon usages')
      
      // Delete client apps
      await supabase.from('client_apps').delete().eq('seller_id', user.id)
      console.log('Deleted client apps')
      
      // Delete user role
      await supabase.from('user_roles').delete().eq('user_id', user.id)
      console.log('Deleted user role')
      
      // Delete profile
      await supabase.from('profiles').delete().eq('id', user.id)
      console.log('Deleted profile')
      
      // Finally, delete the auth user
      const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(user.id)
      
      if (deleteAuthError) {
        console.error('Error deleting auth user:', deleteAuthError.message)
        throw deleteAuthError
      }
      
      console.log(`Successfully deleted account for ${userEmail}`)

    } catch (err) {
      console.error('Error during deletion:', err)
      return new Response(
        JSON.stringify({ error: 'Error deleting account data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Account deleted successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Delete account error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
