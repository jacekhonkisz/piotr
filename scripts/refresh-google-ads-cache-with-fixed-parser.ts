/**
 * Refresh Google Ads Smart Cache with Fixed Parser
 * 
 * This script refreshes all Google Ads current month caches to use the fixed parser
 * that correctly matches "PBM - Booking Engine - krok 1/2/3" conversion actions
 */

// Load environment variables FIRST before any imports
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function refreshClientCache(client: any) {
  console.log(`\n🔄 Refreshing cache for: ${client.name}`);
  console.log(`   Customer ID: ${client.google_ads_customer_id}`);

  try {
    // Dynamic import to avoid loading before env vars
    const { fetchFreshGoogleAdsCurrentMonthData } = await import('../src/lib/google-ads-smart-cache-helper');
    const freshData = await fetchFreshGoogleAdsCurrentMonthData(client);
    
    console.log(`   ✅ Cache refreshed successfully`);
    console.log(`   Booking Step 1: ${freshData.conversionMetrics?.booking_step_1 || 0}`);
    console.log(`   Booking Step 2: ${freshData.conversionMetrics?.booking_step_2 || 0}`);
    console.log(`   Booking Step 3: ${freshData.conversionMetrics?.booking_step_3 || 0}`);
    console.log(`   Reservations: ${freshData.conversionMetrics?.reservations || 0}`);
    console.log(`   Total Spend: ${freshData.stats?.totalSpend?.toFixed(2) || 0} PLN`);
    
    return { success: true, client: client.name };
  } catch (error: any) {
    console.error(`   ❌ Failed to refresh cache: ${error.message}`);
    return { success: false, client: client.name, error: error.message };
  }
}

async function main() {
  console.log('🔄 Refreshing Google Ads Smart Cache with Fixed Parser');
  console.log('====================================================\n');

  // Get all clients with Google Ads enabled
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, google_ads_customer_id, google_ads_refresh_token')
    .not('google_ads_customer_id', 'is', null);

  if (error) {
    console.error('❌ Failed to fetch clients:', error);
    process.exit(1);
  }

  console.log(`Found ${clients?.length || 0} clients with Google Ads configured\n`);

  const results = {
    success: [] as string[],
    failed: [] as Array<{ name: string; error: string }>
  };

  for (const client of clients || []) {
    const result = await refreshClientCache(client);
    if (result.success) {
      results.success.push(result.client);
    } else {
      results.failed.push({ name: result.client, error: result.error || 'Unknown error' });
    }
    
    // Add delay between clients to avoid rate limiting
    if (clients && clients.indexOf(client) < clients.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
    }
  }

  // Summary
  console.log('\n\n📊 REFRESH SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Successfully refreshed: ${results.success.length} clients`);
  if (results.success.length > 0) {
    console.log(`   ${results.success.join(', ')}`);
  }
  
  if (results.failed.length > 0) {
    console.log(`\n❌ Failed to refresh: ${results.failed.length} clients`);
    results.failed.forEach(({ name, error }) => {
      console.log(`   ${name}: ${error}`);
    });
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  console.log('\n✅ Cache refresh complete! Smart cache now uses the fixed parser.');
  console.log('   Booking steps should now match Google Ads console values.');
}

main().catch(console.error);

