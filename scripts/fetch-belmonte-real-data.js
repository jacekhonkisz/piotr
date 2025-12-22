#!/usr/bin/env node

/**
 * FETCH BELMONTE REAL DATA - Test the Fix
 * 
 * This script fetches fresh data from Meta API using the FIXED code
 * and shows if we're getting real per-campaign data or distributed averages.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fetchBelmonteRealData() {
  console.log('🎯 FETCHING BELMONTE REAL DATA FROM BACKEND');
  console.log('═══════════════════════════════════════════════════\n');
  
  try {
    // Step 1: Get Belmonte client
    console.log('📋 Step 1: Finding Belmonte client...');
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .or('name.ilike.%belmonte%,email.ilike.%belmonte%')
      .limit(1);
    
    if (clientError) throw clientError;
    
    if (!clients || clients.length === 0) {
      console.error('❌ Belmonte client not found');
      process.exit(1);
    }
    
    const client = clients[0];
    console.log(`✅ Found: ${client.name}`);
    console.log(`   Client ID: ${client.id}`);
    console.log(`   Ad Account: ${client.ad_account_id}`);
    console.log(`   Has Meta Token: ${client.meta_access_token ? 'Yes' : 'No'}`);
    console.log(`   Has System Token: ${client.system_user_token ? 'Yes (permanent)' : 'No'}`);
    
    // Check token status
    if (!client.meta_access_token && !client.system_user_token) {
      console.error('\n❌ ERROR: No Meta API token available!');
      console.error('   Please update the token in the database first.');
      process.exit(1);
    }
    
    if (!client.ad_account_id) {
      console.error('\n❌ ERROR: No ad account ID configured!');
      process.exit(1);
    }
    
    // Step 2: Import and use the fixed smart cache helper
    console.log('\n📋 Step 2: Importing fixed smart-cache-helper...');
    
    // We need to use dynamic import for TypeScript/ESM module
    const { fetchFreshCurrentMonthData } = require('../src/lib/smart-cache-helper.ts');
    
    console.log('✅ Module loaded\n');
    
    // Step 3: Fetch fresh data using the FIXED code
    console.log('📋 Step 3: Fetching fresh data from Meta API...');
    console.log('⏳ This will take 10-20 seconds...');
    console.log('   (Calling getCampaignInsights with action parsing)\n');
    
    const startTime = Date.now();
    let freshData;
    
    try {
      freshData = await fetchFreshCurrentMonthData(client);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Data fetched successfully in ${elapsed}s\n`);
    } catch (fetchError) {
      console.error('\n❌ ERROR fetching data:', fetchError.message);
      
      if (fetchError.message.includes('expired') || fetchError.message.includes('token')) {
        console.error('\n🔑 TOKEN ISSUE DETECTED:');
        console.error('   The Meta API token appears to be expired or invalid.');
        console.error('   Please refresh the token in Meta Business Suite and update the database.');
      } else if (fetchError.message.includes('permission')) {
        console.error('\n🔒 PERMISSION ISSUE:');
        console.error('   The token may not have the required permissions.');
        console.error('   Required: ads_read, ads_management');
      }
      
      throw fetchError;
    }
    
    // Step 4: Analyze the fetched data
    console.log('📋 Step 4: Analyzing fetched data...\n');
    console.log('═══════════════════════════════════════════════════');
    console.log('MAIN METRICS');
    console.log('═══════════════════════════════════════════════════');
    
    const stats = freshData.stats || {};
    console.log(`Total Spend: ${stats.totalSpend?.toFixed(2) || 0} PLN`);
    console.log(`Total Impressions: ${stats.totalImpressions || 0}`);
    console.log(`Total Clicks: ${stats.totalClicks || 0}`);
    console.log(`Total Conversions: ${stats.totalConversions || 0}`);
    console.log(`Average CTR: ${stats.averageCtr?.toFixed(2) || 0}%`);
    console.log(`Average CPC: ${stats.averageCpc?.toFixed(2) || 0} PLN`);
    
    console.log('\n═══════════════════════════════════════════════════');
    console.log('CONVERSION METRICS (AGGREGATED)');
    console.log('═══════════════════════════════════════════════════');
    
    const conv = freshData.conversionMetrics || {};
    console.log(`Click to Call: ${conv.click_to_call || 0}`);
    console.log(`Email Contacts: ${conv.email_contacts || 0}`);
    console.log(`Booking Step 1: ${conv.booking_step_1 || 0}`);
    console.log(`Booking Step 2: ${conv.booking_step_2 || 0}`);
    console.log(`Booking Step 3: ${conv.booking_step_3 || 0}`);
    console.log(`Reservations: ${conv.reservations || 0}`);
    console.log(`Reservation Value: ${conv.reservation_value?.toFixed(2) || 0} PLN`);
    console.log(`ROAS: ${conv.roas?.toFixed(2) || 0}`);
    console.log(`Cost per Reservation: ${conv.cost_per_reservation?.toFixed(2) || 0} PLN`);
    
    console.log('\n═══════════════════════════════════════════════════');
    console.log('PER-CAMPAIGN DATA ANALYSIS');
    console.log('═══════════════════════════════════════════════════');
    
    const campaigns = freshData.campaigns || [];
    console.log(`Total Campaigns: ${campaigns.length}\n`);
    
    if (campaigns.length === 0) {
      console.log('⚠️  WARNING: No campaigns returned!');
      console.log('   Possible reasons:');
      console.log('   - No active campaigns in current month');
      console.log('   - Meta API error (check logs above)');
      console.log('   - Token doesn\'t have access to ad account');
      return;
    }
    
    // Analyze if data is distributed or real
    const step1Values = campaigns
      .map(c => c.booking_step_1 || 0)
      .filter(v => v > 0);
    
    const uniqueStep1Values = [...new Set(step1Values)].length;
    const allIdentical = uniqueStep1Values === 1 && step1Values.length > 1;
    
    console.log('📊 Distribution Analysis:');
    console.log(`   Campaigns with step1 > 0: ${step1Values.length}`);
    console.log(`   Unique step1 values: ${uniqueStep1Values}`);
    
    if (allIdentical) {
      console.log('   Status: ❌ ALL IDENTICAL (distributed averages - BAD!)');
      console.log(`   All campaigns have booking_step_1 = ${step1Values[0]}`);
      console.log('\n🚨 FIX NOT WORKING: Data is still being distributed!');
    } else if (uniqueStep1Values > 1) {
      console.log('   Status: ✅ VARIANCE DETECTED (real per-campaign data - GOOD!)');
      console.log(`   Values range from ${Math.min(...step1Values)} to ${Math.max(...step1Values)}`);
      console.log('\n🎉 FIX IS WORKING: Using real per-campaign data!');
    } else {
      console.log('   Status: ℹ️  Only one campaign or all zeros');
    }
    
    // Show first 5 campaigns as sample
    console.log('\n═══════════════════════════════════════════════════');
    console.log('SAMPLE CAMPAIGNS (First 5)');
    console.log('═══════════════════════════════════════════════════\n');
    
    campaigns.slice(0, 5).forEach((campaign, index) => {
      console.log(`Campaign ${index + 1}: ${campaign.campaign_name || 'Unknown'}`);
      console.log(`   Spend: ${(campaign.spend || 0).toFixed(2)} PLN`);
      console.log(`   Impressions: ${campaign.impressions || 0}`);
      console.log(`   Clicks: ${campaign.clicks || 0}`);
      console.log(`   Booking Step 1: ${campaign.booking_step_1 || 0}`);
      console.log(`   Booking Step 2: ${campaign.booking_step_2 || 0}`);
      console.log(`   Booking Step 3: ${campaign.booking_step_3 || 0}`);
      console.log(`   Reservations: ${campaign.reservations || 0}`);
      console.log(`   Has actions array: ${campaign.actions ? 'Yes' : 'No'}`);
      console.log('');
    });
    
    // Verification check
    if (campaigns.length > 1 && conv.booking_step_1 > 0) {
      const expectedDistributed = Math.round(conv.booking_step_1 / campaigns.length);
      const firstCampaignStep1 = campaigns[0].booking_step_1 || 0;
      
      console.log('═══════════════════════════════════════════════════');
      console.log('DISTRIBUTION CHECK');
      console.log('═══════════════════════════════════════════════════');
      console.log(`Total booking_step_1: ${conv.booking_step_1}`);
      console.log(`Number of campaigns: ${campaigns.length}`);
      console.log(`If distributed equally: ${expectedDistributed} per campaign`);
      console.log(`First campaign actual: ${firstCampaignStep1}`);
      
      if (firstCampaignStep1 === expectedDistributed) {
        console.log(`\n❌ MATCH! = Data is DISTRIBUTED (total/${campaigns.length})`);
        console.log('   This means the fix is NOT working.');
      } else {
        console.log(`\n✅ NO MATCH! = Data is REAL per-campaign values`);
        console.log('   This means the fix IS working!');
      }
    }
    
    // Step 5: Save to cache check
    console.log('\n═══════════════════════════════════════════════════');
    console.log('CACHE STATUS');
    console.log('═══════════════════════════════════════════════════');
    
    const currentPeriod = new Date().toISOString().substring(0, 7);
    const { data: cachedData } = await supabase
      .from('current_month_cache')
      .select('last_updated, cache_data')
      .eq('client_id', client.id)
      .eq('period_id', currentPeriod)
      .single();
    
    if (cachedData) {
      const cacheAge = new Date() - new Date(cachedData.last_updated);
      const cacheAgeSeconds = Math.floor(cacheAge / 1000);
      
      console.log(`✅ Data is cached`);
      console.log(`   Last updated: ${cachedData.last_updated}`);
      console.log(`   Cache age: ${cacheAgeSeconds} seconds ago`);
      console.log(`   Campaigns in cache: ${cachedData.cache_data?.campaigns?.length || 0}`);
      
      if (cachedData.cache_data?.campaigns?.length === 0) {
        console.log('\n⚠️  WARNING: Cache has 0 campaigns!');
        console.log('   The fresh data was not saved to cache properly.');
      }
    } else {
      console.log('⚠️  Data not found in cache (may not have been saved)');
    }
    
    console.log('\n═══════════════════════════════════════════════════');
    console.log('✅ TEST COMPLETE');
    console.log('═══════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    console.error(error);
    
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

// Run the test
fetchBelmonteRealData()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  });






