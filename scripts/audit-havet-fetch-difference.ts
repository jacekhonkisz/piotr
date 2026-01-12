/**
 * AUDIT: Why Havet Booking Steps Differ Between Live API and Cache
 * 
 * This script compares:
 * 1. Live API fetch (what I just did)
 * 2. What's stored in cache
 * 3. What date ranges are being used
 * 4. How conversion breakdown is matching campaigns
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from '../src/lib/google-ads-api';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔍 AUDITING HAVET FETCH DIFFERENCE\n');
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

  // 2. Get credentials
  const { data: settingsData } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', [
      'google_ads_client_id',
      'google_ads_client_secret',
      'google_ads_developer_token',
      'google_ads_manager_refresh_token',
      'google_ads_manager_customer_id'
    ]);

  const settings = settingsData?.reduce((acc, s) => {
    acc[s.key] = s.value;
    return acc;
  }, {} as Record<string, any>) || {};

  const refreshToken = settings.google_ads_manager_refresh_token || client.google_ads_refresh_token;

  const credentials = {
    refreshToken,
    clientId: settings.google_ads_client_id || '',
    clientSecret: settings.google_ads_client_secret || '',
    developmentToken: settings.google_ads_developer_token || '',
    customerId: client.google_ads_customer_id,
    managerCustomerId: settings.google_ads_manager_customer_id || '',
  };

  // 3. Check what date range cache is using
  console.log('\n1️⃣ CHECKING CACHE DATE RANGE...');
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const periodId = `${year}-${String(month).padStart(2, '0')}`;

  const { data: cacheData } = await supabase
    .from('google_ads_current_month_cache')
    .select('*')
    .eq('client_id', client.id)
    .eq('period_id', periodId)
    .single();

  if (cacheData) {
    console.log('✅ Cache found:');
    console.log(`   Period ID: ${cacheData.period_id}`);
    console.log(`   Last Updated: ${new Date(cacheData.last_updated).toLocaleString()}`);
    console.log(`   Cache Age: ${Math.round((Date.now() - new Date(cacheData.last_updated).getTime()) / 1000 / 60)} minutes`);
    
    // Check if cache has date range info
    const cacheFetchedAt = cacheData.cache_data?.fetchedAt;
    if (cacheFetchedAt) {
      console.log(`   Fetched At: ${new Date(cacheFetchedAt).toLocaleString()}`);
    }
  } else {
    console.log('⚠️ No cache found');
  }

  // 4. Calculate current month date range (what cache should use)
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  console.log('\n2️⃣ DATE RANGE COMPARISON:');
  console.log(`   Expected: ${startDate} to ${endDate}`);
  console.log(`   Period ID: ${periodId}`);

  // 5. Fetch live data with same date range
  console.log('\n3️⃣ FETCHING LIVE DATA WITH SAME DATE RANGE...');
  const googleAdsService = new GoogleAdsAPIService(credentials);
  
  // First, let's check what getConversionBreakdown returns
  console.log('\n4️⃣ CHECKING CONVERSION BREAKDOWN...');
  const conversionBreakdown = await googleAdsService.getConversionBreakdown(startDate, endDate);
  
  console.log(`   Total campaigns with conversions: ${Object.keys(conversionBreakdown).length}`);
  
  // Show breakdown for top campaign
  const topCampaignId = Object.keys(conversionBreakdown).find(id => {
    const data = conversionBreakdown[id];
    return data && (data.booking_step_1 || 0) > 0;
  });

  if (topCampaignId) {
    const topData = conversionBreakdown[topCampaignId];
    console.log(`\n   Top Campaign ID: ${topCampaignId}`);
    console.log(`   Step 1: ${topData.booking_step_1}`);
    console.log(`   Step 2: ${topData.booking_step_2}`);
    console.log(`   Step 3: ${topData.booking_step_3}`);
  }

  // 6. Now fetch campaign data
  console.log('\n5️⃣ FETCHING CAMPAIGN DATA...');
  const campaignData = await googleAdsService.getCampaignData(startDate, endDate);

  console.log(`   Total campaigns: ${campaignData.length}`);

  // 7. Check if campaigns are getting conversion data
  console.log('\n6️⃣ CHECKING IF CAMPAIGNS HAVE CONVERSION DATA...');
  const campaignsWithSteps = campaignData.filter((c: any) => (c.booking_step_1 || 0) > 0);
  console.log(`   Campaigns with booking_step_1 > 0: ${campaignsWithSteps.length}`);

  // Find the top campaign from my live fetch
  const topCampaign = campaignData.find((c: any) => c.campaignName === '[PBM] GSN | Brand PL');
  if (topCampaign) {
    console.log(`\n   Top Campaign: ${topCampaign.campaignName}`);
    console.log(`   Campaign ID: ${topCampaign.campaignId}`);
    console.log(`   Step 1: ${topCampaign.booking_step_1}`);
    console.log(`   Step 2: ${topCampaign.booking_step_2}`);
    console.log(`   Step 3: ${topCampaign.booking_step_3}`);
    
    // Check if this campaign ID is in conversion breakdown
    if (conversionBreakdown[topCampaign.campaignId]) {
      const breakdownData = conversionBreakdown[topCampaign.campaignId];
      console.log(`\n   ✅ Campaign ID found in conversion breakdown:`);
      console.log(`      Step 1: ${breakdownData.booking_step_1}`);
      console.log(`      Step 2: ${breakdownData.booking_step_2}`);
      console.log(`      Step 3: ${breakdownData.booking_step_3}`);
      
      if (topCampaign.booking_step_1 !== breakdownData.booking_step_1) {
        console.log(`\n   ⚠️ MISMATCH: Campaign has ${topCampaign.booking_step_1} but breakdown has ${breakdownData.booking_step_1}`);
      } else {
        console.log(`\n   ✅ Match: Campaign data matches breakdown`);
      }
    } else {
      console.log(`\n   ❌ Campaign ID NOT FOUND in conversion breakdown!`);
      console.log(`   Available campaign IDs in breakdown: ${Object.keys(conversionBreakdown).slice(0, 10).join(', ')}...`);
    }
  }

  // 8. Aggregate totals
  const liveTotals = campaignData.reduce((acc, c: any) => {
    acc.step1 += c.booking_step_1 || 0;
    acc.step2 += c.booking_step_2 || 0;
    acc.step3 += c.booking_step_3 || 0;
    return acc;
  }, { step1: 0, step2: 0, step3: 0 });

  console.log('\n7️⃣ LIVE API TOTALS:');
  console.log(`   Step 1: ${liveTotals.step1}`);
  console.log(`   Step 2: ${liveTotals.step2}`);
  console.log(`   Step 3: ${liveTotals.step3}`);

  // 9. Check cache totals
  if (cacheData) {
    const cacheTotals = {
      step1: parseFloat(cacheData.cache_data?.conversionMetrics?.booking_step_1 || '0') || 0,
      step2: parseFloat(cacheData.cache_data?.conversionMetrics?.booking_step_2 || '0') || 0,
      step3: parseFloat(cacheData.cache_data?.conversionMetrics?.booking_step_3 || '0') || 0
    };

    console.log('\n8️⃣ CACHE TOTALS:');
    console.log(`   Step 1: ${cacheTotals.step1}`);
    console.log(`   Step 2: ${cacheTotals.step2}`);
    console.log(`   Step 3: ${cacheTotals.step3}`);

    // 10. Check individual campaigns in cache
    console.log('\n9️⃣ CHECKING INDIVIDUAL CAMPAIGNS IN CACHE...');
    const cacheCampaigns = cacheData.cache_data?.campaigns || [];
    console.log(`   Total campaigns in cache: ${cacheCampaigns.length}`);

    const cacheTopCampaign = cacheCampaigns.find((c: any) => c.campaignName === '[PBM] GSN | Brand PL');
    if (cacheTopCampaign) {
      console.log(`\n   Top Campaign in Cache: ${cacheTopCampaign.campaignName}`);
      console.log(`   Campaign ID: ${cacheTopCampaign.campaignId}`);
      console.log(`   Step 1: ${cacheTopCampaign.booking_step_1}`);
      console.log(`   Step 2: ${cacheTopCampaign.booking_step_2}`);
      console.log(`   Step 3: ${cacheTopCampaign.booking_step_3}`);
      
      if (topCampaign) {
        console.log(`\n   📊 COMPARISON:`);
        console.log(`   Live API Step 1: ${topCampaign.booking_step_1}`);
        console.log(`   Cache Step 1: ${cacheTopCampaign.booking_step_1}`);
        if (topCampaign.booking_step_1 !== cacheTopCampaign.booking_step_1) {
          console.log(`   ❌ MISMATCH: ${Math.abs(topCampaign.booking_step_1 - cacheTopCampaign.booking_step_1)} difference`);
        } else {
          console.log(`   ✅ Match`);
        }
      }
    } else {
      console.log(`\n   ⚠️ Top campaign NOT FOUND in cache!`);
    }

    // 11. Sum all campaigns in cache
    const cacheSum = cacheCampaigns.reduce((acc: any, c: any) => {
      acc.step1 += parseFloat(c.booking_step_1 || '0') || 0;
      acc.step2 += parseFloat(c.booking_step_2 || '0') || 0;
      acc.step3 += parseFloat(c.booking_step_3 || '0') || 0;
      return acc;
    }, { step1: 0, step2: 0, step3: 0 });

    console.log('\n🔟 SUM OF ALL CAMPAIGNS IN CACHE:');
    console.log(`   Step 1: ${cacheSum.step1}`);
    console.log(`   Step 2: ${cacheSum.step2}`);
    console.log(`   Step 3: ${cacheSum.step3}`);

    console.log('\n1️⃣1️⃣ COMPARISON: Cache Sum vs Cache Totals');
    console.log(`   Sum Step 1: ${cacheSum.step1}`);
    console.log(`   Totals Step 1: ${cacheTotals.step1}`);
    if (Math.abs(cacheSum.step1 - cacheTotals.step1) > 1) {
      console.log(`   ❌ MISMATCH: Cache sum doesn't match cache totals!`);
    } else {
      console.log(`   ✅ Match: Cache sum matches cache totals`);
    }
  }

  // 12. Check if there's a date range issue
  console.log('\n1️⃣2️⃣ CHECKING FOR DATE RANGE ISSUES...');
  console.log(`   Today: ${new Date().toISOString().split('T')[0]}`);
  console.log(`   Start Date: ${startDate}`);
  console.log(`   End Date: ${endDate}`);
  console.log(`   Is end date in future? ${endDate > new Date().toISOString().split('T')[0]}`);

  console.log('\n' + '='.repeat(70));
  console.log('✅ AUDIT COMPLETE');
  console.log('='.repeat(70));
}

main().catch(console.error);

