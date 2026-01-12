/**
 * Clear Google Ads Cache and Trigger Fresh Data Collection
 * 
 * This script:
 * 1. Clears the Google Ads smart cache for current month
 * 2. Triggers a fresh API fetch to recollect data with fixed booking steps logic
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearAndRefreshCache() {
  console.log('🗑️ CLEARING GOOGLE ADS CACHE...\n');
  
  // Get current month period ID
  const now = new Date();
  const currentPeriodId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  console.log(`📅 Current period: ${currentPeriodId}`);
  
  // Clear cache for all clients
  const { data: deletedData, error: deleteError } = await supabase
    .from('google_ads_current_month_cache')
    .delete()
    .eq('period_id', currentPeriodId)
    .select();
  
  if (deleteError) {
    console.error('❌ Failed to clear cache:', deleteError);
    process.exit(1);
  }
  
  console.log(`✅ Cleared ${deletedData?.length || 0} cache records for period ${currentPeriodId}\n`);
  
  // Get all clients with Google Ads configured
  console.log('📋 Finding clients with Google Ads configured...\n');
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name, google_ads_customer_id')
    .not('google_ads_customer_id', 'is', null);
  
  if (clientsError) {
    console.error('❌ Failed to fetch clients:', clientsError);
    process.exit(1);
  }
  
  if (!clients || clients.length === 0) {
    console.log('⚠️ No clients with Google Ads configured found');
    return;
  }
  
  console.log(`✅ Found ${clients.length} clients with Google Ads\n`);
  
  // Trigger fresh data collection for each client
  console.log('🔄 Triggering fresh data collection...\n');
  
  for (const client of clients) {
    console.log(`📊 Refreshing data for: ${client.name} (${client.id})`);
    
    try {
      // Call the API endpoint to trigger fresh fetch
      const apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/fetch-google-ads-live-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}` // Use service role key for server-side
        },
        body: JSON.stringify({
          clientId: client.id,
          dateRange: {
            start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
            end: now.toISOString().split('T')[0]
          },
          forceFresh: true,
          bypassAllCache: true,
          clearCache: true,
          reason: 'cache-clear-and-refresh-script'
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`   ❌ Failed: ${response.status} - ${errorText}`);
        continue;
      }
      
      const result = await response.json();
      if (result.success) {
        console.log(`   ✅ Success: ${result.data?.campaigns?.length || 0} campaigns fetched`);
        console.log(`   📊 Booking Steps: Step1=${result.data?.conversionMetrics?.booking_step_1 || 0}, Step2=${result.data?.conversionMetrics?.booking_step_2 || 0}, Step3=${result.data?.conversionMetrics?.booking_step_3 || 0}`);
      } else {
        console.error(`   ❌ API returned error: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message || error}`);
    }
    
    // Small delay between clients
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n✅ Cache cleared and fresh data collection triggered for all clients');
  console.log('📊 The cache will now contain fresh booking steps data from Google Ads API');
}

// Run the script
clearAndRefreshCache()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

