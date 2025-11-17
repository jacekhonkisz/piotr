/**
 * DIAGNOSTIC SCRIPT: Check Meta Cache Data
 * 
 * This script queries the current_month_cache table to see what data is actually stored.
 * Run with: npx tsx scripts/check_meta_cache.ts
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
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMetaCache() {
  console.log('🔍 META CACHE DIAGNOSTIC SCRIPT');
  console.log('================================\n');

  try {
    // 1. Get all clients
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, name, company, email, ad_account_id')
      .order('name');

    if (clientError) {
      console.error('❌ Error fetching clients:', clientError);
      return;
    }

    console.log(`📊 Found ${clients.length} clients\n`);

    for (const client of clients) {
      console.log(`\n🏢 Client: ${client.name || client.company} (${client.email})`);
      console.log(`   ID: ${client.id}`);
      console.log(`   Ad Account: ${client.ad_account_id}`);

      // 2. Check current month cache for this client
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const periodId = `${year}-${String(month).padStart(2, '0')}`;

      console.log(`   Current Period: ${periodId}`);

      const { data: cacheData, error: cacheError } = await supabase
        .from('current_month_cache')
        .select('*')
        .eq('client_id', client.id)
        .eq('period_id', periodId)
        .single();

      if (cacheError) {
        if (cacheError.code === 'PGRST116') {
          console.log('   ⚠️  No cache data found');
        } else {
          console.log('   ❌ Cache error:', cacheError.message);
        }
        continue;
      }

      if (!cacheData) {
        console.log('   ⚠️  Cache data is null');
        continue;
      }

      // 3. Analyze cache data
      console.log('   ✅ Cache data found');
      console.log(`   📅 Last Updated: ${cacheData.last_updated}`);
      
      const cacheAge = Date.now() - new Date(cacheData.last_updated).getTime();
      const ageMinutes = Math.round(cacheAge / 60000);
      const ageHours = (cacheAge / 3600000).toFixed(2);
      console.log(`   ⏰ Cache Age: ${ageMinutes} minutes (${ageHours} hours)`);

      const isFresh = cacheAge < (3 * 60 * 60 * 1000); // 3 hours
      console.log(`   ${isFresh ? '✅' : '⚠️ '} Cache is ${isFresh ? 'FRESH' : 'STALE'}`);

      // 4. Check stats
      const stats = cacheData.cache_data?.stats;
      if (stats) {
        console.log('\n   📊 STATS:');
        console.log(`      Total Spend: ${stats.totalSpend || 0}`);
        console.log(`      Total Impressions: ${stats.totalImpressions || 0}`);
        console.log(`      Total Clicks: ${stats.totalClicks || 0}`);
        console.log(`      Total Conversions: ${stats.totalConversions || 0}`);
        console.log(`      Average CTR: ${stats.averageCtr || 0}%`);
        console.log(`      Average CPC: ${stats.averageCpc || 0}`);

        // 🚨 Check for zero data
        if (stats.totalSpend === 0 && stats.totalImpressions === 0 && stats.totalClicks === 0) {
          console.log('\n   🚨 WARNING: ALL METRICS ARE ZERO!');
          console.log('   🚨 This indicates either:');
          console.log('      - Meta API returned no data');
          console.log('      - API credentials are invalid/expired');
          console.log('      - Ad account has no activity in this period');
          console.log('      - Date range has no data');
        }
      } else {
        console.log('   ❌ No stats data in cache');
      }

      // 5. Check conversion metrics
      const conversionMetrics = cacheData.cache_data?.conversionMetrics;
      if (conversionMetrics) {
        console.log('\n   🎯 CONVERSION METRICS:');
        console.log(`      Click to Call: ${conversionMetrics.click_to_call || 0}`);
        console.log(`      Email Contacts: ${conversionMetrics.email_contacts || 0}`);
        console.log(`      Booking Step 1: ${conversionMetrics.booking_step_1 || 0}`);
        console.log(`      Booking Step 2: ${conversionMetrics.booking_step_2 || 0}`);
        console.log(`      Booking Step 3: ${conversionMetrics.booking_step_3 || 0}`);
        console.log(`      Reservations: ${conversionMetrics.reservations || 0}`);
        console.log(`      Reservation Value: ${conversionMetrics.reservation_value || 0}`);
        console.log(`      ROAS: ${conversionMetrics.roas || 0}`);
      } else {
        console.log('   ❌ No conversion metrics in cache');
      }

      // 6. Check campaigns
      const campaigns = cacheData.cache_data?.campaigns;
      if (campaigns && Array.isArray(campaigns)) {
        console.log(`\n   📋 CAMPAIGNS: ${campaigns.length} total`);
        if (campaigns.length > 0) {
          campaigns.slice(0, 3).forEach((campaign: any, index: number) => {
            console.log(`      ${index + 1}. ${campaign.campaign_name || campaign.name || 'Unnamed'}`);
            console.log(`         Spend: ${campaign.spend || 0}`);
            console.log(`         Clicks: ${campaign.clicks || 0}`);
            console.log(`         Impressions: ${campaign.impressions || 0}`);
          });
          if (campaigns.length > 3) {
            console.log(`      ... and ${campaigns.length - 3} more campaigns`);
          }
        }
      } else {
        console.log('   ❌ No campaigns in cache');
      }

      console.log('\n   ' + '─'.repeat(60));
    }

    console.log('\n\n📊 DIAGNOSTIC COMPLETE');
    console.log('=====================\n');

  } catch (error) {
    console.error('❌ Diagnostic error:', error);
  }
}

// Run the diagnostic
checkMetaCache().then(() => {
  console.log('✅ Diagnostic script completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});





