/**
 * DEEP ANALYSIS: Booking Steps Discrepancy
 * 
 * This script traces the entire data flow to find where booking steps are lost:
 * 1. Live Google Ads API → Raw conversion data
 * 2. Conversion breakdown parsing
 * 3. Campaign data merge
 * 4. Cache storage
 * 5. Reports page retrieval
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from '../src/lib/google-ads-api';
import { parseGoogleAdsConversions } from '../src/lib/google-ads-actions-parser';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔍 DEEP ANALYSIS: Booking Steps Discrepancy\n');
  console.log('='.repeat(80));

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
  console.log(`✅ Client: ${client.name} (${client.id})\n`);

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

  // 3. Calculate date range
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  console.log(`📅 Date Range: ${startDate} to ${endDate}\n`);

  // 4. STEP 1: Fetch raw conversion data from API
  console.log('STEP 1: FETCHING RAW CONVERSION DATA FROM GOOGLE ADS API\n');
  console.log('-'.repeat(80));
  
  const googleAdsService = new GoogleAdsAPIService(credentials);
  
  // Get raw conversion breakdown
  const conversionBreakdown = await googleAdsService.getConversionBreakdown(startDate, endDate);
  
  console.log(`✅ Conversion breakdown fetched for ${Object.keys(conversionBreakdown).length} campaigns\n`);
  
  // Show breakdown for top campaigns
  const topCampaigns = Object.entries(conversionBreakdown)
    .filter(([_, data]: [string, any]) => (data.booking_step_1 || 0) > 0)
    .sort(([_, a]: [string, any], [__, b]: [string, any]) => (b.booking_step_1 || 0) - (a.booking_step_1 || 0))
    .slice(0, 5);

  console.log('📊 Top 5 Campaigns in Conversion Breakdown:');
  topCampaigns.forEach(([campaignId, data]: [string, any], index) => {
    console.log(`   ${index + 1}. Campaign ID: ${campaignId}`);
    console.log(`      Step 1: ${data.booking_step_1 || 0}`);
    console.log(`      Step 2: ${data.booking_step_2 || 0}`);
    console.log(`      Step 3: ${data.booking_step_3 || 0}`);
    console.log(`      Reservations: ${data.reservations || 0}`);
    console.log();
  });

  // Aggregate totals from breakdown
  const breakdownTotals = Object.values(conversionBreakdown).reduce((acc: any, data: any) => {
    acc.step1 += data.booking_step_1 || 0;
    acc.step2 += data.booking_step_2 || 0;
    acc.step3 += data.booking_step_3 || 0;
    acc.reservations += data.reservations || 0;
    return acc;
  }, { step1: 0, step2: 0, step3: 0, reservations: 0 });

  console.log('📊 CONVERSION BREAKDOWN TOTALS:');
  console.log(`   Step 1: ${breakdownTotals.step1}`);
  console.log(`   Step 2: ${breakdownTotals.step2}`);
  console.log(`   Step 3: ${breakdownTotals.step3}`);
  console.log(`   Reservations: ${breakdownTotals.reservations}\n`);

  // 5. STEP 2: Fetch campaign data and check merge
  console.log('STEP 2: FETCHING CAMPAIGN DATA AND CHECKING MERGE\n');
  console.log('-'.repeat(80));
  
  const campaignData = await googleAdsService.getCampaignData(startDate, endDate);
  
  console.log(`✅ Fetched ${campaignData.length} campaigns\n`);

  // Check which campaigns have booking steps
  const campaignsWithSteps = campaignData.filter((c: any) => (c.booking_step_1 || 0) > 0);
  console.log(`📊 Campaigns with booking_step_1 > 0: ${campaignsWithSteps.length}\n`);

  // Check top campaign from breakdown
  if (topCampaigns.length > 0) {
    const [topCampaignId] = topCampaigns[0];
    const topCampaignInData = campaignData.find((c: any) => String(c.campaignId) === String(topCampaignId));
    
    if (topCampaignInData) {
      console.log(`📋 Top Campaign (ID: ${topCampaignId}) in Campaign Data:`);
      console.log(`   Campaign Name: ${topCampaignInData.campaignName}`);
      console.log(`   Step 1: ${topCampaignInData.booking_step_1 || 0}`);
      console.log(`   Step 2: ${topCampaignInData.booking_step_2 || 0}`);
      console.log(`   Step 3: ${topCampaignInData.booking_step_3 || 0}`);
      
      const breakdownData = conversionBreakdown[topCampaignId];
      if (breakdownData) {
        console.log(`\n   🔍 COMPARISON:`);
        console.log(`   Breakdown Step 1: ${breakdownData.booking_step_1 || 0}`);
        console.log(`   Campaign Step 1: ${topCampaignInData.booking_step_1 || 0}`);
        
        if (topCampaignInData.booking_step_1 !== breakdownData.booking_step_1) {
          console.log(`   ❌ MISMATCH: Campaign data doesn't match breakdown!`);
          console.log(`   Difference: ${Math.abs((topCampaignInData.booking_step_1 || 0) - (breakdownData.booking_step_1 || 0))}`);
        } else {
          console.log(`   ✅ Match: Campaign data matches breakdown`);
        }
      } else {
        console.log(`   ❌ Campaign ID NOT FOUND in conversion breakdown!`);
      }
    } else {
      console.log(`   ❌ Top campaign (ID: ${topCampaignId}) NOT FOUND in campaign data!`);
      console.log(`   Available campaign IDs: ${campaignData.slice(0, 5).map((c: any) => c.campaignId).join(', ')}...`);
    }
  }

  // Aggregate totals from campaign data
  const campaignTotals = campaignData.reduce((acc: any, c: any) => {
    acc.step1 += c.booking_step_1 || 0;
    acc.step2 += c.booking_step_2 || 0;
    acc.step3 += c.booking_step_3 || 0;
    acc.reservations += c.reservations || 0;
    return acc;
  }, { step1: 0, step2: 0, step3: 0, reservations: 0 });

  console.log('\n📊 CAMPAIGN DATA TOTALS:');
  console.log(`   Step 1: ${campaignTotals.step1}`);
  console.log(`   Step 2: ${campaignTotals.step2}`);
  console.log(`   Step 3: ${campaignTotals.step3}`);
  console.log(`   Reservations: ${campaignTotals.reservations}\n`);

  // 6. STEP 3: Check cache
  console.log('STEP 3: CHECKING CACHE DATA\n');
  console.log('-'.repeat(80));
  
  const periodId = `${year}-${String(month).padStart(2, '0')}`;
  const { data: cacheData } = await supabase
    .from('google_ads_current_month_cache')
    .select('*')
    .eq('client_id', client.id)
    .eq('period_id', periodId)
    .single();

  if (cacheData) {
    console.log(`✅ Cache found (last updated: ${new Date(cacheData.last_updated).toLocaleString()})\n`);
    
    const cacheTotals = {
      step1: parseFloat(cacheData.cache_data?.conversionMetrics?.booking_step_1 || '0') || 0,
      step2: parseFloat(cacheData.cache_data?.conversionMetrics?.booking_step_2 || '0') || 0,
      step3: parseFloat(cacheData.cache_data?.conversionMetrics?.booking_step_3 || '0') || 0,
      reservations: parseFloat(cacheData.cache_data?.conversionMetrics?.reservations || '0') || 0
    };

    console.log('📊 CACHE TOTALS:');
    console.log(`   Step 1: ${cacheTotals.step1}`);
    console.log(`   Step 2: ${cacheTotals.step2}`);
    console.log(`   Step 3: ${cacheTotals.step3}`);
    console.log(`   Reservations: ${cacheTotals.reservations}\n`);

    // Check individual campaigns in cache
    const cacheCampaigns = cacheData.cache_data?.campaigns || [];
    console.log(`📊 Campaigns in cache: ${cacheCampaigns.length}\n`);

    // Sum all campaigns in cache
    const cacheSum = cacheCampaigns.reduce((acc: any, c: any) => {
      acc.step1 += parseFloat(c.booking_step_1 || '0') || 0;
      acc.step2 += parseFloat(c.booking_step_2 || '0') || 0;
      acc.step3 += parseFloat(c.booking_step_3 || '0') || 0;
      acc.reservations += parseFloat(c.reservations || '0') || 0;
      return acc;
    }, { step1: 0, step2: 0, step3: 0, reservations: 0 });

    console.log('📊 SUM OF ALL CAMPAIGNS IN CACHE:');
    console.log(`   Step 1: ${cacheSum.step1}`);
    console.log(`   Step 2: ${cacheSum.step2}`);
    console.log(`   Step 3: ${cacheSum.step3}`);
    console.log(`   Reservations: ${cacheSum.reservations}\n`);

    // Check if top campaign is in cache
    if (topCampaigns.length > 0) {
      const [topCampaignId] = topCampaigns[0];
      const topCampaignInCache = cacheCampaigns.find((c: any) => String(c.campaignId) === String(topCampaignId));
      
      if (topCampaignInCache) {
        console.log(`📋 Top Campaign (ID: ${topCampaignId}) in Cache:`);
        console.log(`   Campaign Name: ${topCampaignInCache.campaignName}`);
        console.log(`   Step 1: ${topCampaignInCache.booking_step_1 || 0}`);
        console.log(`   Step 2: ${topCampaignInCache.booking_step_2 || 0}`);
        console.log(`   Step 3: ${topCampaignInCache.booking_step_3 || 0}\n`);
      } else {
        console.log(`   ❌ Top campaign (ID: ${topCampaignId}) NOT FOUND in cache!\n`);
      }
    }
  } else {
    console.log('⚠️ No cache found\n');
  }

  // 7. STEP 4: Check database (campaign_summaries)
  console.log('STEP 4: CHECKING DATABASE (campaign_summaries)\n');
  console.log('-'.repeat(80));
  
  const { data: summaries } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', client.id)
    .eq('platform', 'google')
    .gte('summary_date', startDate)
    .lte('summary_date', endDate);

  if (summaries && summaries.length > 0) {
    console.log(`✅ Found ${summaries.length} campaign summaries\n`);
    
    const summaryTotals = summaries.reduce((acc: any, s: any) => {
      const campaignData = Array.isArray(s.campaign_data) ? s.campaign_data : [];
      campaignData.forEach((c: any) => {
        acc.step1 += parseFloat(c.booking_step_1 || '0') || 0;
        acc.step2 += parseFloat(c.booking_step_2 || '0') || 0;
        acc.step3 += parseFloat(c.booking_step_3 || '0') || 0;
        acc.reservations += parseFloat(c.reservations || '0') || 0;
      });
      return acc;
    }, { step1: 0, step2: 0, step3: 0, reservations: 0 });

    console.log('📊 CAMPAIGN_SUMMARIES TOTALS:');
    console.log(`   Step 1: ${summaryTotals.step1}`);
    console.log(`   Step 2: ${summaryTotals.step2}`);
    console.log(`   Step 3: ${summaryTotals.step3}`);
    console.log(`   Reservations: ${summaryTotals.reservations}\n`);
  } else {
    console.log('⚠️ No campaign summaries found\n');
  }

  // 8. COMPARISON SUMMARY
  console.log('='.repeat(80));
  console.log('📊 COMPARISON SUMMARY\n');
  console.log('='.repeat(80));
  console.log(`Conversion Breakdown (Raw API):`);
  console.log(`   Step 1: ${breakdownTotals.step1}`);
  console.log(`   Step 2: ${breakdownTotals.step2}`);
  console.log(`   Step 3: ${breakdownTotals.step3}\n`);
  
  console.log(`Campaign Data (After Merge):`);
  console.log(`   Step 1: ${campaignTotals.step1}`);
  console.log(`   Step 2: ${campaignTotals.step2}`);
  console.log(`   Step 3: ${campaignTotals.step3}\n`);
  
  if (cacheData) {
    const cacheTotals = {
      step1: parseFloat(cacheData.cache_data?.conversionMetrics?.booking_step_1 || '0') || 0,
      step2: parseFloat(cacheData.cache_data?.conversionMetrics?.booking_step_2 || '0') || 0,
      step3: parseFloat(cacheData.cache_data?.conversionMetrics?.booking_step_3 || '0') || 0
    };
    console.log(`Cache Totals:`);
    console.log(`   Step 1: ${cacheTotals.step1}`);
    console.log(`   Step 2: ${cacheTotals.step2}`);
    console.log(`   Step 3: ${cacheTotals.step3}\n`);
  }

  // 9. IDENTIFY THE ISSUE
  console.log('='.repeat(80));
  console.log('🔍 ROOT CAUSE ANALYSIS\n');
  console.log('='.repeat(80));
  
  if (breakdownTotals.step1 !== campaignTotals.step1) {
    console.log(`❌ ISSUE FOUND: Conversion breakdown (${breakdownTotals.step1}) doesn't match campaign data (${campaignTotals.step1})`);
    console.log(`   → Campaign IDs might not be matching correctly`);
    console.log(`   → Check if campaign.id type matches breakdown keys\n`);
  }
  
  if (cacheData) {
    const cacheTotals = {
      step1: parseFloat(cacheData.cache_data?.conversionMetrics?.booking_step_1 || '0') || 0,
      step2: parseFloat(cacheData.cache_data?.conversionMetrics?.booking_step_2 || '0') || 0,
      step3: parseFloat(cacheData.cache_data?.conversionMetrics?.booking_step_3 || '0') || 0
    };
    
    if (campaignTotals.step1 !== cacheTotals.step1) {
      console.log(`❌ ISSUE FOUND: Campaign data (${campaignTotals.step1}) doesn't match cache (${cacheTotals.step1})`);
      console.log(`   → Cache might have been created with old data`);
      console.log(`   → Or aggregation in cache creation is wrong\n`);
    }
  }

  console.log('='.repeat(80));
  console.log('✅ ANALYSIS COMPLETE');
  console.log('='.repeat(80));
}

main().catch(console.error);

