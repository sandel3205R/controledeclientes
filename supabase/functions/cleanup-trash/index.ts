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
    
    // Verify admin authentication
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

    // Check if user is admin using service role client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleError || roleData?.role !== 'admin') {
      console.error('Admin access required. User role:', roleData?.role)
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Admin ${user.email} initiated cleanup`)

    // Get retention days from settings or use default (30 days)
    const { data: settingsData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'trash_retention_days')
      .maybeSingle()

    const retentionDays = settingsData ? parseInt(settingsData.value) : 30
    
    // Calculate the cutoff date
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    console.log(`Cleaning up sellers deleted before: ${cutoffDate.toISOString()}`)

    // Find sellers that have been in trash longer than retention period
    const { data: sellersToDelete, error: fetchError } = await supabase
      .from('profiles')
      .select('id, email, full_name, deleted_at')
      .not('deleted_at', 'is', null)
      .lt('deleted_at', cutoffDate.toISOString())

    if (fetchError) {
      console.error('Error fetching sellers to delete:', fetchError)
      throw fetchError
    }

    if (!sellersToDelete || sellersToDelete.length === 0) {
      console.log('No sellers to clean up')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No sellers to clean up',
          deleted_count: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${sellersToDelete.length} sellers to permanently delete`)

    let deletedCount = 0
    const errors: string[] = []

    for (const seller of sellersToDelete) {
      try {
        console.log(`Deleting seller: ${seller.email} (${seller.id})`)

        // Delete all associated data
        await supabase.from('clients').delete().eq('seller_id', seller.id)
        await supabase.from('servers').delete().eq('seller_id', seller.id)
        await supabase.from('whatsapp_templates').delete().eq('seller_id', seller.id)
        await supabase.from('user_roles').delete().eq('user_id', seller.id)
        
        // Delete the profile
        const { error: deleteError } = await supabase
          .from('profiles')
          .delete()
          .eq('id', seller.id)

        if (deleteError) {
          throw deleteError
        }

        deletedCount++
        console.log(`Successfully deleted seller: ${seller.email}`)
      } catch (err) {
        const errorMsg = `Failed to delete seller ${seller.email}: ${err instanceof Error ? err.message : 'Unknown error'}`
        console.error(errorMsg)
        errors.push(errorMsg)
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Cleaned up ${deletedCount} sellers`,
        deleted_count: deletedCount,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Cleanup error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
