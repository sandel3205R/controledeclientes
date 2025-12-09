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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

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
