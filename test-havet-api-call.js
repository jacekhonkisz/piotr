/**
 * Test Google Ads API call for Havet using manager token
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from './src/lib/google-ads-api.js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testHavetAPICall() {
  console.log('🧪 Testing Google Ads API Call for Havet...\n');
  console.log('='.repeat(70));

  // Get system settings
  const { data: settingsData } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', [
      'google_ads_manager_refresh_token',
      'google_ads_manager_customer_id',
      'google_ads_client_id',
      'google_ads_client_secret',
      'google_ads_developer_token'
    ]);

  const settings = settingsData.reduce((acc, s) => {
    acc[s.key] = s.value;
    return acc;
  }, {});

  // Get Havet client
  const { data: havet } = await supabase
    .from('clients')
    .select('id, name, google_ads_customer_id')
    .ilike('name', '%havet%')
    .single();

  console.log('📋 Configuration:');
  console.log(`   Manager Token: ${settings.google_ads_manager_refresh_token ? '✅' : '❌'}`);
  console.log(`   Manager Customer ID: ${settings.google_ads_manager_customer_id}`);
  console.log(`   Havet Customer ID: ${havet.google_ads_customer_id}`);

  // Set up date range (current month)
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const endDate = now.toISOString().split('T')[0];

  console.log(`\n📅 Date Range: ${startDate} to ${endDate}`);

  // Create credentials
  const credentials = {
    refreshToken: settings.google_ads_manager_refresh_token,
    clientId: settings.google_ads_client_id,
    clientSecret: settings.google_ads_client_secret,
    developmentToken: settings.google_ads_developer_token,
    customerId: havet.google_ads_customer_id,
    managerCustomerId: settings.google_ads_manager_customer_id
  };

  console.log('\n🔧 Initializing Google Ads API Service...');
  
  try {
    const googleAdsService = new GoogleAdsAPIService(credentials);
    
    console.log('✅ Service initialized');
    console.log('\n🔍 Validating credentials...');
    
    const validation = await googleAdsService.validateCredentials();
    
    if (!validation.valid) {
      console.error('❌ Credentials invalid:', validation.error);
      return;
    }
    
    console.log('✅ Credentials valid!');
    console.log('\n📊 Fetching campaign data...');
    console.log('   (This may take 10-30 seconds...)');
    
    const startTime = Date.now();
    const campaignData = await googleAdsService.getCampaignData(startDate, endDate);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`\n✅ API call completed in ${duration} seconds`);
    console.log(`\n📈 Results:`);
    console.log(`   Campaigns found: ${campaignData.length}`);
    
    if (campaignData.length === 0) {
      console.log('\n⚠️  No campaigns returned - this might be why cache shows zeros');
      return;
    }
    
    // Calculate totals
    const totals = campaignData.reduce((acc, campaign) => {
      acc.spend += campaign.spend || 0;
      acc.impressions += campaign.impressions || 0;
      acc.clicks += campaign.clicks || 0;
      acc.step1 += campaign.booking_step_1 || 0;
      acc.step2 += campaign.booking_step_2 || 0;
      acc.step3 += campaign.booking_step_3 || 0;
      acc.reservations += campaign.reservations || 0;
      acc.reservationValue += campaign.reservation_value || 0;
      return acc;
    }, {
      spend: 0,
      impressions: 0,
      clicks: 0,
      step1: 0,
      step2: 0,
      step3: 0,
      reservations: 0,
      reservationValue: 0
    });
    
    console.log(`\n   Total Spend: ${totals.spend.toFixed(2)} PLN`);
    console.log(`   Total Impressions: ${totals.impressions.toLocaleString()}`);
    console.log(`   Total Clicks: ${totals.clicks.toLocaleString()}`);
    console.log(`   Step 1: ${totals.step1}`);
    console.log(`   Step 2: ${totals.step2}`);
    console.log(`   Step 3: ${totals.step3}`);
    console.log(`   Reservations: ${totals.reservations}`);
    console.log(`   Reservation Value: ${totals.reservationValue.toFixed(2)} PLN`);
    
    // Show top 5 campaigns
    console.log(`\n📋 Top 5 Campaigns by Spend:`);
    campaignData
      .sort((a, b) => (b.spend || 0) - (a.spend || 0))
      .slice(0, 5)
      .forEach((camp, idx) => {
        console.log(`\n   ${idx + 1}. ${camp.campaignName}`);
        console.log(`      Spend: ${camp.spend?.toFixed(2) || 0} PLN`);
        console.log(`      Clicks: ${camp.clicks || 0}`);
        console.log(`      Step 1: ${camp.booking_step_1 || 0} | Step 2: ${camp.booking_step_2 || 0} | Step 3: ${camp.booking_step_3 || 0}`);
        console.log(`      Reservations: ${camp.reservations || 0}`);
      });
    
    if (totals.spend === 0 && totals.impressions === 0) {
      console.log('\n⚠️  WARNING: All campaigns show zero spend/impressions');
      console.log('   This could mean:');
      console.log('   1. No active campaigns in Google Ads');
      console.log('   2. Date range has no data');
      console.log('   3. Manager account doesn\'t have access to this customer');
      console.log('   4. Customer ID is incorrect');
    }
    
  } catch (error) {
    console.error('\n❌ API Call Failed:');
    console.error('   Error:', error.message);
    if (error.stack) {
      console.error('\n   Stack:', error.stack.split('\n').slice(0, 5).join('\n'));
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Test complete!');
}

testHavetAPICall().catch(console.error);

