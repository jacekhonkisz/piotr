/**
 * FETCH LIVE GOOGLE ADS BOOKING STEPS FOR HAVET AND COMPARE TO DATABASE
 * 
 * This script:
 * 1. Fetches live data from Google Ads API for Havet (current month)
 * 2. Extracts booking steps from the API response
 * 3. Queries database for the same data
 * 4. Compares them side by side
 * 
 * Usage: npx tsx scripts/fetch-havet-live-booking-steps-comparison.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from '../src/lib/google-ads-api';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔍 FETCHING LIVE GOOGLE ADS BOOKING STEPS FOR HAVET\n');
  console.log('='.repeat(60));
  
  try {
    // 1. Get Havet client
    console.log('\n1️⃣ Finding Havet client...');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .ilike('name', '%havet%')
      .limit(1);

    if (clientsError || !clients || clients.length === 0) {
      console.error('❌ Failed to find Havet client:', clientsError);
      process.exit(1);
    }

    const client = clients[0];
    console.log('✅ Found Havet client:', {
      id: client.id,
      name: client.name,
      customerId: client.google_ads_customer_id,
      enabled: client.google_ads_enabled
    });

    if (!client.google_ads_enabled || !client.google_ads_customer_id) {
      console.error('❌ Havet is not configured for Google Ads');
      process.exit(1);
    }

    // 2. Get Google Ads credentials
    console.log('\n2️⃣ Getting Google Ads credentials...');
    const { data: settingsData, error: settingsError } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'google_ads_client_id',
        'google_ads_client_secret',
        'google_ads_developer_token',
        'google_ads_manager_refresh_token',
        'google_ads_manager_customer_id'
      ]);

    if (settingsError || !settingsData) {
      console.error('❌ Failed to get system settings:', settingsError);
      process.exit(1);
    }

    const settings = settingsData.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, any>);

    // Use manager token if available, otherwise client token
    let refreshToken = null;
    if (settings.google_ads_manager_refresh_token) {
      refreshToken = settings.google_ads_manager_refresh_token;
      console.log('✅ Using manager refresh token');
    } else if (client.google_ads_refresh_token) {
      refreshToken = client.google_ads_refresh_token;
      console.log('✅ Using client refresh token');
    }

    if (!refreshToken) {
      console.error('❌ No refresh token available for Havet');
      process.exit(1);
    }

    const credentials = {
      refreshToken,
      clientId: settings.google_ads_client_id || '',
      clientSecret: settings.google_ads_client_secret || '',
      developmentToken: settings.google_ads_developer_token || '',
      customerId: client.google_ads_customer_id,
      managerCustomerId: settings.google_ads_manager_customer_id || '',
    };

    // 3. Calculate current month date range
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    console.log('\n3️⃣ Date range:', { startDate, endDate });

    // 4. Initialize Google Ads API service
    console.log('\n4️⃣ Initializing Google Ads API service...');
    const googleAdsService = new GoogleAdsAPIService(credentials);

    // Validate credentials
    const validation = await googleAdsService.validateCredentials();
    if (!validation.valid) {
      console.error('❌ Google Ads credentials invalid:', validation.error);
      process.exit(1);
    }
    console.log('✅ Credentials validated');

    // 5. Fetch live data from API
    console.log('\n5️⃣ Fetching live data from Google Ads API...');
    const startTime = Date.now();
    const campaignData = await googleAdsService.getCampaignData(startDate, endDate);
    const apiResponseTime = Date.now() - startTime;

    console.log(`✅ Fetched ${campaignData.length} campaigns in ${apiResponseTime}ms`);

    // 6. Aggregate booking steps from API
    const apiTotals = campaignData.reduce((acc, campaign: any) => {
      acc.booking_step_1 += campaign.booking_step_1 || 0;
      acc.booking_step_2 += campaign.booking_step_2 || 0;
      acc.booking_step_3 += campaign.booking_step_3 || 0;
      acc.total_spend += campaign.spend || 0;
      acc.campaign_count += 1;
      return acc;
    }, {
      booking_step_1: 0,
      booking_step_2: 0,
      booking_step_3: 0,
      total_spend: 0,
      campaign_count: 0
    });

    console.log('\n📊 LIVE API RESULTS:');
    console.log('   Booking Step 1:', apiTotals.booking_step_1);
    console.log('   Booking Step 2:', apiTotals.booking_step_2);
    console.log('   Booking Step 3:', apiTotals.booking_step_3);
    console.log('   Total Spend:', apiTotals.total_spend.toFixed(2));
    console.log('   Campaign Count:', apiTotals.campaign_count);

    // 7. Get data from database - Cache
    console.log('\n6️⃣ Querying database - Smart Cache...');
    const { data: cacheData, error: cacheError } = await supabase
      .from('google_ads_current_month_cache')
      .select('*')
      .eq('client_id', client.id)
      .eq('period_id', `${year}-${String(month).padStart(2, '0')}`)
      .single();

    let cacheTotals = null;
    if (!cacheError && cacheData) {
      cacheTotals = {
        booking_step_1: parseFloat(cacheData.cache_data?.conversionMetrics?.booking_step_1 || '0') || 0,
        booking_step_2: parseFloat(cacheData.cache_data?.conversionMetrics?.booking_step_2 || '0') || 0,
        booking_step_3: parseFloat(cacheData.cache_data?.conversionMetrics?.booking_step_3 || '0') || 0,
        total_spend: parseFloat(cacheData.cache_data?.stats?.totalSpend || '0') || 0,
        campaign_count: cacheData.cache_data?.campaigns?.length || 0,
        last_updated: cacheData.last_updated
      };
      console.log('✅ Found cache data');
    } else {
      console.log('⚠️ No cache data found');
    }

    // 8. Get data from database - google_ads_campaigns table
    console.log('\n7️⃣ Querying database - google_ads_campaigns table...');
    const { data: campaignsData, error: campaignsError } = await supabase
      .from('google_ads_campaigns')
      .select('booking_step_1, booking_step_2, booking_step_3, spend')
      .eq('client_id', client.id)
      .gte('date_range_start', startDate)
      .lte('date_range_end', endDate);

    let dbCampaignsTotals = null;
    if (!campaignsError && campaignsData && campaignsData.length > 0) {
      dbCampaignsTotals = campaignsData.reduce((acc, campaign: any) => {
        acc.booking_step_1 += parseFloat(campaign.booking_step_1 || '0') || 0;
        acc.booking_step_2 += parseFloat(campaign.booking_step_2 || '0') || 0;
        acc.booking_step_3 += parseFloat(campaign.booking_step_3 || '0') || 0;
        acc.total_spend += parseFloat(campaign.spend || '0') || 0;
        acc.campaign_count += 1;
        return acc;
      }, {
        booking_step_1: 0,
        booking_step_2: 0,
        booking_step_3: 0,
        total_spend: 0,
        campaign_count: 0
      });
      console.log(`✅ Found ${campaignsData.length} campaigns in database`);
    } else {
      console.log('⚠️ No campaigns data found in database');
    }

    // 9. Get data from database - campaign_summaries
    console.log('\n8️⃣ Querying database - campaign_summaries...');
    const { data: summaryData, error: summaryError } = await supabase
      .from('campaign_summaries')
      .select('booking_step_1, booking_step_2, booking_step_3, total_spend')
      .eq('client_id', client.id)
      .eq('platform', 'google')
      .eq('summary_type', 'monthly')
      .eq('summary_date', startDate)
      .single();

    let dbSummaryTotals = null;
    if (!summaryError && summaryData) {
      dbSummaryTotals = {
        booking_step_1: parseFloat(summaryData.booking_step_1 || '0') || 0,
        booking_step_2: parseFloat(summaryData.booking_step_2 || '0') || 0,
        booking_step_3: parseFloat(summaryData.booking_step_3 || '0') || 0,
        total_spend: parseFloat(summaryData.total_spend || '0') || 0
      };
      console.log('✅ Found summary data');
    } else {
      console.log('⚠️ No summary data found');
    }

    // 10. Compare results
    console.log('\n' + '='.repeat(60));
    console.log('📊 COMPARISON RESULTS');
    console.log('='.repeat(60));

    console.log('\n🔵 LIVE API (Google Ads API):');
    console.log(`   Booking Step 1: ${apiTotals.booking_step_1}`);
    console.log(`   Booking Step 2: ${apiTotals.booking_step_2}`);
    console.log(`   Booking Step 3: ${apiTotals.booking_step_3}`);
    console.log(`   Total Spend: ${apiTotals.total_spend.toFixed(2)}`);
    console.log(`   Campaigns: ${apiTotals.campaign_count}`);

    if (cacheTotals) {
      console.log('\n🟢 SMART CACHE (google_ads_current_month_cache):');
      console.log(`   Booking Step 1: ${cacheTotals.booking_step_1}`);
      console.log(`   Booking Step 2: ${cacheTotals.booking_step_2}`);
      console.log(`   Booking Step 3: ${cacheTotals.booking_step_3}`);
      console.log(`   Total Spend: ${cacheTotals.total_spend.toFixed(2)}`);
      console.log(`   Campaigns: ${cacheTotals.campaign_count}`);
      console.log(`   Last Updated: ${new Date(cacheTotals.last_updated).toLocaleString()}`);
      
      // Compare
      const step1Diff = Math.abs(apiTotals.booking_step_1 - cacheTotals.booking_step_1);
      const step2Diff = Math.abs(apiTotals.booking_step_2 - cacheTotals.booking_step_2);
      const step3Diff = Math.abs(apiTotals.booking_step_3 - cacheTotals.booking_step_3);
      
      console.log('\n   📊 DIFFERENCES:');
      console.log(`   Step 1: ${step1Diff > 1 ? '❌ MISMATCH' : '✅ Match'} (diff: ${step1Diff})`);
      console.log(`   Step 2: ${step2Diff > 1 ? '❌ MISMATCH' : '✅ Match'} (diff: ${step2Diff})`);
      console.log(`   Step 3: ${step3Diff > 1 ? '❌ MISMATCH' : '✅ Match'} (diff: ${step3Diff})`);
    }

    if (dbCampaignsTotals) {
      console.log('\n🟡 DATABASE (google_ads_campaigns table):');
      console.log(`   Booking Step 1: ${dbCampaignsTotals.booking_step_1}`);
      console.log(`   Booking Step 2: ${dbCampaignsTotals.booking_step_2}`);
      console.log(`   Booking Step 3: ${dbCampaignsTotals.booking_step_3}`);
      console.log(`   Total Spend: ${dbCampaignsTotals.total_spend.toFixed(2)}`);
      console.log(`   Campaigns: ${dbCampaignsTotals.campaign_count}`);
      
      // Compare
      const step1Diff = Math.abs(apiTotals.booking_step_1 - dbCampaignsTotals.booking_step_1);
      const step2Diff = Math.abs(apiTotals.booking_step_2 - dbCampaignsTotals.booking_step_2);
      const step3Diff = Math.abs(apiTotals.booking_step_3 - dbCampaignsTotals.booking_step_3);
      
      console.log('\n   📊 DIFFERENCES:');
      console.log(`   Step 1: ${step1Diff > 1 ? '❌ MISMATCH' : '✅ Match'} (diff: ${step1Diff})`);
      console.log(`   Step 2: ${step2Diff > 1 ? '❌ MISMATCH' : '✅ Match'} (diff: ${step2Diff})`);
      console.log(`   Step 3: ${step3Diff > 1 ? '❌ MISMATCH' : '✅ Match'} (diff: ${step3Diff})`);
    }

    if (dbSummaryTotals) {
      console.log('\n🟠 DATABASE (campaign_summaries):');
      console.log(`   Booking Step 1: ${dbSummaryTotals.booking_step_1}`);
      console.log(`   Booking Step 2: ${dbSummaryTotals.booking_step_2}`);
      console.log(`   Booking Step 3: ${dbSummaryTotals.booking_step_3}`);
      console.log(`   Total Spend: ${dbSummaryTotals.total_spend.toFixed(2)}`);
      
      // Compare
      const step1Diff = Math.abs(apiTotals.booking_step_1 - dbSummaryTotals.booking_step_1);
      const step2Diff = Math.abs(apiTotals.booking_step_2 - dbSummaryTotals.booking_step_2);
      const step3Diff = Math.abs(apiTotals.booking_step_3 - dbSummaryTotals.booking_step_3);
      
      console.log('\n   📊 DIFFERENCES:');
      console.log(`   Step 1: ${step1Diff > 1 ? '❌ MISMATCH' : '✅ Match'} (diff: ${step1Diff})`);
      console.log(`   Step 2: ${step2Diff > 1 ? '❌ MISMATCH' : '✅ Match'} (diff: ${step2Diff})`);
      console.log(`   Step 3: ${step3Diff > 1 ? '❌ MISMATCH' : '✅ Match'} (diff: ${step3Diff})`);
    }

    // 11. Show individual campaigns with booking steps from API
    console.log('\n' + '='.repeat(60));
    console.log('📋 INDIVIDUAL CAMPAIGNS WITH BOOKING STEPS (from API):');
    console.log('='.repeat(60));
    
    const campaignsWithSteps = campaignData
      .filter((c: any) => (c.booking_step_1 || 0) > 0 || (c.booking_step_2 || 0) > 0 || (c.booking_step_3 || 0) > 0)
      .slice(0, 20); // Show first 20

    if (campaignsWithSteps.length > 0) {
      campaignsWithSteps.forEach((campaign: any, index: number) => {
        console.log(`\n${index + 1}. ${campaign.campaignName}`);
        console.log(`   Step 1: ${campaign.booking_step_1 || 0}`);
        console.log(`   Step 2: ${campaign.booking_step_2 || 0}`);
        console.log(`   Step 3: ${campaign.booking_step_3 || 0}`);
        console.log(`   Spend: ${(campaign.spend || 0).toFixed(2)}`);
      });
    } else {
      console.log('\n⚠️ No campaigns with booking steps found in API response');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ COMPARISON COMPLETE');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

main();

