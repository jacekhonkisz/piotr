/**
 * FIX: Force refresh Havet cache to get correct booking steps
 * 
 * This script:
 * 1. Deletes the current month cache for Havet
 * 2. Forces a fresh fetch
 * 3. Verifies the booking steps are correct
 */

import { config } from 'dotenv';

// Load environment variables FIRST before any imports
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from '../src/lib/google-ads-api';
import { fetchFreshGoogleAdsCurrentMonthData } from '../src/lib/google-ads-smart-cache-helper';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔧 FIXING HAVET CACHE BOOKING STEPS\n');
  console.log('='.repeat(70));

  // 1. Get Havet client
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .ilike('name', '%havet%')
    .limit(1);

  if (!clients || clients.length === 0) {
    console.error('❌ Havet not found');
    process.exit(1);
  }

  const client = clients[0];
  console.log(`✅ Found client: ${client.name}`);

  // 2. Delete current cache
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const periodId = `${year}-${String(month).padStart(2, '0')}`;

  console.log(`\n1️⃣ Deleting cache for period: ${periodId}`);
  const { error: deleteError } = await supabase
    .from('google_ads_current_month_cache')
    .delete()
    .eq('client_id', client.id)
    .eq('period_id', periodId);

  if (deleteError) {
    console.error('❌ Failed to delete cache:', deleteError);
    process.exit(1);
  }
  console.log('✅ Cache deleted');

  // 3. Force fresh fetch
  console.log('\n2️⃣ Fetching fresh data...');
  try {
    const freshData = await fetchFreshGoogleAdsCurrentMonthData(client);
    
    console.log('✅ Fresh data fetched');
    console.log(`\n📊 NEW CACHE TOTALS:`);
    console.log(`   Booking Step 1: ${freshData.conversionMetrics?.booking_step_1 || 0}`);
    console.log(`   Booking Step 2: ${freshData.conversionMetrics?.booking_step_2 || 0}`);
    console.log(`   Booking Step 3: ${freshData.conversionMetrics?.booking_step_3 || 0}`);
    console.log(`   Total Spend: ${freshData.stats?.totalSpend || 0}`);
    console.log(`   Campaigns: ${freshData.campaigns?.length || 0}`);

    // 4. Verify top campaign
    const topCampaign = freshData.campaigns?.find((c: any) => c.campaignName === '[PBM] GSN | Brand PL');
    if (topCampaign) {
      console.log(`\n📋 TOP CAMPAIGN VERIFICATION:`);
      console.log(`   Campaign: ${topCampaign.campaignName}`);
      console.log(`   Step 1: ${topCampaign.booking_step_1 || 0}`);
      console.log(`   Step 2: ${topCampaign.booking_step_2 || 0}`);
      console.log(`   Step 3: ${topCampaign.booking_step_3 || 0}`);
      
      if (topCampaign.booking_step_1 > 0) {
        console.log(`   ✅ Campaign has booking steps - cache is correct!`);
      } else {
        console.log(`   ❌ Campaign still has 0 booking steps - bug still exists!`);
      }
    }

    // 5. Check cache was saved
    console.log('\n3️⃣ Verifying cache was saved...');
    const { data: newCache } = await supabase
      .from('google_ads_current_month_cache')
      .select('*')
      .eq('client_id', client.id)
      .eq('period_id', periodId)
      .single();

    if (newCache) {
      const cacheTotals = {
        step1: parseFloat(newCache.cache_data?.conversionMetrics?.booking_step_1 || '0') || 0,
        step2: parseFloat(newCache.cache_data?.conversionMetrics?.booking_step_2 || '0') || 0,
        step3: parseFloat(newCache.cache_data?.conversionMetrics?.booking_step_3 || '0') || 0
      };

      console.log('✅ Cache saved');
      console.log(`\n📊 CACHE VERIFICATION:`);
      console.log(`   Step 1: ${cacheTotals.step1}`);
      console.log(`   Step 2: ${cacheTotals.step2}`);
      console.log(`   Step 3: ${cacheTotals.step3}`);

      if (cacheTotals.step1 > 400) {
        console.log(`\n✅ SUCCESS: Cache now has correct booking steps!`);
      } else {
        console.log(`\n❌ ISSUE: Cache still has wrong booking steps (${cacheTotals.step1} instead of ~459)`);
      }
    } else {
      console.log('⚠️ Cache not found after refresh');
    }

  } catch (error) {
    console.error('❌ Error fetching fresh data:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
    process.exit(1);
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ FIX COMPLETE');
  console.log('='.repeat(70));
}

main().catch(console.error);

