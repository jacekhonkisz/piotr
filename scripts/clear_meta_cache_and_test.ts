/**
 * Clear Meta Cache and Force Fresh Fetch
 * 
 * This script clears the current_month_cache for Belmonte Hotel and forces a fresh fetch.
 * Run with: npx tsx scripts/clear_meta_cache_and_test.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearAndTest() {
  console.log('🔧 CLEAR CACHE AND TEST FRESH FETCH');
  console.log('====================================\n');

  try {
    // Get Belmonte Hotel
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('company', 'Belmonte Hotel')
      .single();

    if (clientError || !client) {
      console.error('❌ Client not found:', clientError);
      return;
    }

    console.log('🏢 Client: Belmonte Hotel');
    console.log(`   ID: ${client.id}`);
    console.log();

    // Calculate current period
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const periodId = `${year}-${String(month).padStart(2, '0')}`;

    console.log(`📅 Current Period: ${periodId}`);
    console.log();

    // Step 1: Check existing cache
    console.log('Step 1: Check existing cache');
    console.log('─'.repeat(60));
    
    const { data: oldCache, error: oldCacheError } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', client.id)
      .eq('period_id', periodId)
      .single();

    if (oldCache) {
      console.log('✅ Old cache found:');
      console.log(`   Total Spend: ${oldCache.cache_data?.stats?.totalSpend || 0}`);
      console.log(`   Total Impressions: ${oldCache.cache_data?.stats?.totalImpressions || 0}`);
      console.log(`   Total Clicks: ${oldCache.cache_data?.stats?.totalClicks || 0}`);
      console.log(`   Last Updated: ${oldCache.last_updated}`);
    } else {
      console.log('⚠️  No existing cache found');
    }
    console.log();

    // Step 2: Delete existing cache
    console.log('Step 2: Delete existing cache');
    console.log('─'.repeat(60));
    
    const { error: deleteError } = await supabase
      .from('current_month_cache')
      .delete()
      .eq('client_id', client.id)
      .eq('period_id', periodId);

    if (deleteError) {
      console.error('❌ Error deleting cache:', deleteError);
    } else {
      console.log('✅ Cache deleted successfully');
    }
    console.log();

    // Step 3: Trigger fresh fetch by calling smart cache function
    console.log('Step 3: Trigger fresh data fetch');
    console.log('─'.repeat(60));
    console.log('📡 Fetching fresh data from Meta API...');
    console.log('   (This will use the new cache-clearing logic)');
    console.log();

    // Import and call the smart cache function
    const { fetchFreshCurrentMonthData } = await import('../src/lib/smart-cache-helper');
    
    const freshData = await fetchFreshCurrentMonthData(client);

    if (freshData) {
      console.log('✅ Fresh data fetched successfully!');
      console.log();
      console.log('📊 NEW DATA FROM META API:');
      console.log('─'.repeat(60));
      console.log(`   Total Spend: ${freshData.stats?.totalSpend || 0}`);
      console.log(`   Total Impressions: ${freshData.stats?.totalImpressions || 0}`);
      console.log(`   Total Clicks: ${freshData.stats?.totalClicks || 0}`);
      console.log(`   Total Conversions: ${freshData.stats?.totalConversions || 0}`);
      console.log(`   Average CTR: ${freshData.stats?.averageCtr || 0}%`);
      console.log(`   Average CPC: ${freshData.stats?.averageCpc || 0}`);
      console.log();
      console.log(`   Campaigns: ${freshData.campaigns?.length || 0}`);
      console.log();
      console.log('🎯 CONVERSION METRICS:');
      console.log(`   Reservations: ${freshData.conversionMetrics?.reservations || 0}`);
      console.log(`   Reservation Value: ${freshData.conversionMetrics?.reservation_value || 0}`);
      console.log(`   ROAS: ${freshData.conversionMetrics?.roas || 0}`);
      console.log();

      // Check if data is still zeros
      if (freshData.stats?.totalSpend === 0 && 
          freshData.stats?.totalImpressions === 0 && 
          freshData.stats?.totalClicks === 0) {
        console.log('🚨 WARNING: Data is STILL all zeros!');
        console.log('🚨 This indicates a data processing issue in the code');
        console.log('🚨 Check the logs above for diagnostic information');
      } else {
        console.log('🎉 SUCCESS! Data has real metrics!');
        console.log('🎉 The cache clearing fix worked!');
      }
    } else {
      console.log('❌ Failed to fetch fresh data');
    }

    console.log();
    console.log('=' .repeat(60));

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the test
clearAndTest().then(() => {
  console.log('\n✅ Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


