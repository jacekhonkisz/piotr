/**
 * Check Havet January 2026 Google Ads Booking Steps
 * Compares cache vs live API with fixed parser
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from '../src/lib/google-ads-api';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('🔍 Checking Havet January 2026 Google Ads Booking Steps\n');

  // Get Havet client
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .ilike('name', '%havet%')
    .single();

  if (clientError || !client) {
    console.error('❌ Havet client not found');
    process.exit(1);
  }

  console.log(`✅ Client: ${client.name}`);
  console.log(`   Customer ID: ${client.google_ads_customer_id}\n`);

  // January 2026 date range
  const dateStart = '2026-01-01';
  const dateEnd = '2026-01-31';
  const periodId = '2026-01';

  console.log(`📅 Period: ${periodId} (${dateStart} to ${dateEnd})\n`);

  // 1. Check Smart Cache
  console.log('1️⃣ Checking Smart Cache...');
  const { data: cacheData, error: cacheError } = await supabase
    .from('google_ads_current_month_cache')
    .select('*')
    .eq('client_id', client.id)
    .eq('period_id', periodId)
    .single();

  if (cacheData && cacheData.cache_data) {
    const cache = cacheData.cache_data;
    console.log('✅ Smart Cache Found:');
    console.log(`   Last Updated: ${cacheData.last_updated}`);
    console.log(`   Booking Step 1: ${cache.conversionMetrics?.booking_step_1 || 0}`);
    console.log(`   Booking Step 2: ${cache.conversionMetrics?.booking_step_2 || 0}`);
    console.log(`   Booking Step 3: ${cache.conversionMetrics?.booking_step_3 || 0}`);
    console.log(`   Reservations: ${cache.conversionMetrics?.reservations || 0}`);
    console.log(`   Reservation Value: ${cache.conversionMetrics?.reservation_value || 0} PLN`);
    console.log(`   Total Conversion Value (Wartość konwersji): ${cache.conversionMetrics?.total_conversion_value || 0} PLN`);
    console.log(`   Total Spend: ${cache.stats?.totalSpend || 0} PLN`);
    console.log(`   Campaigns: ${cache.campaigns?.length || 0}\n`);
  } else {
    console.log('⚠️  No smart cache found\n');
  }

  // 2. Fetch Live API Data
  console.log('2️⃣ Fetching Live API Data (with fixed parser)...\n');

  // Get Google Ads system settings
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
    console.error('❌ Google Ads system configuration not found');
    process.exit(1);
  }

  const settings = settingsData.reduce((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {} as Record<string, any>);

  // Use the same token priority logic
  let refreshToken = null;
  if (settings.google_ads_manager_refresh_token) {
    refreshToken = settings.google_ads_manager_refresh_token;
  } else if (client.google_ads_refresh_token) {
    refreshToken = client.google_ads_refresh_token;
  }

  if (!refreshToken) {
    console.error('❌ Google Ads refresh token not found');
    process.exit(1);
  }

  const googleAdsCredentials = {
    refreshToken,
    clientId: settings.google_ads_client_id,
    clientSecret: settings.google_ads_client_secret,
    developmentToken: settings.google_ads_developer_token,
    customerId: client.google_ads_customer_id!,
    managerCustomerId: settings.google_ads_manager_customer_id,
  };

  // Initialize Google Ads API service
  const googleAdsService = new GoogleAdsAPIService(googleAdsCredentials);

  // Validate credentials
  const validation = await googleAdsService.validateCredentials();
  if (!validation.valid) {
    console.error(`❌ Google Ads credentials invalid: ${validation.error}`);
    process.exit(1);
  }

  // Fetch campaign data
  console.log('   Fetching campaign data...');
  const campaignData = await googleAdsService.getCampaignData(dateStart, dateEnd);
  console.log(`   ✅ Fetched ${campaignData.length} campaigns\n`);

  // Aggregate conversion metrics
  const conversionMetrics = campaignData.reduce((acc, campaign: any) => {
    acc.booking_step_1 += campaign.booking_step_1 || 0;
    acc.booking_step_2 += campaign.booking_step_2 || 0;
    acc.booking_step_3 += campaign.booking_step_3 || 0;
    acc.reservations += campaign.reservations || 0;
    acc.reservation_value += campaign.reservation_value || 0;
    acc.total_conversion_value += campaign.total_conversion_value || 0;
    return acc;
  }, {
    booking_step_1: 0,
    booking_step_2: 0,
    booking_step_3: 0,
    reservations: 0,
    reservation_value: 0,
    total_conversion_value: 0
  });

  const totalSpend = campaignData.reduce((sum, campaign) => sum + (campaign.spend || 0), 0);
  const totalConversionValue = campaignData.reduce((sum, campaign) => sum + (campaign.total_conversion_value || 0), 0);

  console.log('✅ Live API Results (with fixed parser):');
  console.log(`   Booking Step 1: ${Math.round(conversionMetrics.booking_step_1)}`);
  console.log(`   Booking Step 2: ${Math.round(conversionMetrics.booking_step_2)}`);
  console.log(`   Booking Step 3: ${Math.round(conversionMetrics.booking_step_3)}`);
  console.log(`   Reservations: ${Math.round(conversionMetrics.reservations)}`);
  console.log(`   Reservation Value: ${conversionMetrics.reservation_value.toFixed(2)} PLN`);
  console.log(`   Total Conversion Value (Wartość konwersji): ${totalConversionValue.toFixed(2)} PLN`);
  console.log(`   Total Spend: ${totalSpend.toFixed(2)} PLN`);
  console.log(`   Campaigns: ${campaignData.length}\n`);

  // 3. Show top campaigns with booking steps
  console.log('3️⃣ Top 10 Campaigns by Booking Step 1:');
  const campaignsWithSteps = campaignData
    .filter((c: any) => (c.booking_step_1 || 0) > 0)
    .sort((a: any, b: any) => (b.booking_step_1 || 0) - (a.booking_step_1 || 0))
    .slice(0, 10);

  campaignsWithSteps.forEach((campaign: any, index: number) => {
    console.log(`   ${index + 1}. ${campaign.campaignName}`);
    console.log(`      Step 1: ${campaign.booking_step_1 || 0}, Step 2: ${campaign.booking_step_2 || 0}, Step 3: ${campaign.booking_step_3 || 0}, Reservations: ${campaign.reservations || 0}`);
  });

  // 4. Comparison
  if (cacheData && cacheData.cache_data) {
    const cache = cacheData.cache_data;
    console.log('\n4️⃣ Comparison (Cache vs Live API):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const step1Diff = Math.round(conversionMetrics.booking_step_1) - (cache.conversionMetrics?.booking_step_1 || 0);
    const step2Diff = Math.round(conversionMetrics.booking_step_2) - (cache.conversionMetrics?.booking_step_2 || 0);
    const step3Diff = Math.round(conversionMetrics.booking_step_3) - (cache.conversionMetrics?.booking_step_3 || 0);
    const reservationsDiff = Math.round(conversionMetrics.reservations) - (cache.conversionMetrics?.reservations || 0);
    const totalConversionValueDiff = totalConversionValue - (cache.conversionMetrics?.total_conversion_value || 0);

    console.log(`   Booking Step 1: ${cache.conversionMetrics?.booking_step_1 || 0} (cache) vs ${Math.round(conversionMetrics.booking_step_1)} (live) = ${step1Diff > 0 ? '+' : ''}${step1Diff}`);
    console.log(`   Booking Step 2: ${cache.conversionMetrics?.booking_step_2 || 0} (cache) vs ${Math.round(conversionMetrics.booking_step_2)} (live) = ${step2Diff > 0 ? '+' : ''}${step2Diff}`);
    console.log(`   Booking Step 3: ${cache.conversionMetrics?.booking_step_3 || 0} (cache) vs ${Math.round(conversionMetrics.booking_step_3)} (live) = ${step3Diff > 0 ? '+' : ''}${step3Diff}`);
    console.log(`   Reservations: ${cache.conversionMetrics?.reservations || 0} (cache) vs ${Math.round(conversionMetrics.reservations)} (live) = ${reservationsDiff > 0 ? '+' : ''}${reservationsDiff}`);
    console.log(`   Total Conversion Value: ${(cache.conversionMetrics?.total_conversion_value || 0).toFixed(2)} (cache) vs ${totalConversionValue.toFixed(2)} (live) = ${totalConversionValueDiff > 0 ? '+' : ''}${totalConversionValueDiff.toFixed(2)}`);

    if (Math.abs(step1Diff) > 0.01 || Math.abs(step2Diff) > 0.01 || Math.abs(step3Diff) > 0.01 || Math.abs(reservationsDiff) > 0.01) {
      console.log('\n   🚨 DISCREPANCY DETECTED - Cache needs refresh!');
    } else {
      console.log('\n   ✅ Values match - Cache is correct!');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }
}

main().catch(console.error);

