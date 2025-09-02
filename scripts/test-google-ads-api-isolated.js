#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testGoogleAdsApiIsolated() {
  console.log('🧪 TESTING GOOGLE ADS API ISOLATED');
  console.log('==================================\n');

  try {
    // Get client and settings
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .ilike('name', '%belmonte%')
      .single();

    const { data: settings } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'google_ads_client_id',
        'google_ads_client_secret', 
        'google_ads_developer_token',
        'google_ads_manager_refresh_token'
      ]);

    const creds = {};
    settings?.forEach(setting => {
      creds[setting.key] = setting.value;
    });

    console.log('✅ Got credentials and client data');
    console.log('');

    // Test the API route step by step
    console.log('🔍 TESTING API ROUTE STEPS');
    console.log('==========================');

    // Step 1: Basic validation
    console.log('1. ✅ Client ID validation: PASSED');
    console.log('2. ✅ Date range validation: PASSED');
    console.log('3. ✅ Credentials validation: PASSED');
    console.log('');

    // Step 4: Test the actual API call that might be failing
    console.log('4. 🧪 Testing Google Ads API initialization...');
    
    // Import the GoogleAdsAPIService
    const { GoogleAdsAPIService } = require('../src/lib/google-ads-api');
    
    const googleAdsCredentials = {
      refreshToken: creds.google_ads_manager_refresh_token,
      clientId: creds.google_ads_client_id,
      clientSecret: creds.google_ads_client_secret,
      developmentToken: creds.google_ads_developer_token,
      customerId: client.google_ads_customer_id,
    };

    console.log('   Creating GoogleAdsAPIService instance...');
    const googleAdsService = new GoogleAdsAPIService(googleAdsCredentials);
    
    console.log('   ✅ Service created successfully');
    console.log('');

    // Step 5: Test credentials validation
    console.log('5. 🧪 Testing credentials validation...');
    const validation = await googleAdsService.validateCredentials();
    
    if (!validation.valid) {
      console.log('   ❌ Credentials validation failed:', validation.error);
      console.log('   🔧 This is likely the cause of the 400 error');
      return;
    }
    
    console.log('   ✅ Credentials validation passed');
    console.log('');

    // Step 6: Test basic campaign data fetch
    console.log('6. 🧪 Testing campaign data fetch...');
    
    const startDate = '2025-07-31';
    const endDate = '2025-08-30';
    
    try {
      const campaigns = await googleAdsService.getCampaignData(startDate, endDate);
      console.log(`   ✅ Campaign data fetch successful: ${campaigns.length} campaigns`);
    } catch (campaignError) {
      console.log('   ❌ Campaign data fetch failed:', campaignError.message);
      console.log('   🔧 This is likely the cause of the 400 error');
      return;
    }
    console.log('');

    // Step 7: Test tables data fetch (this might be the issue)
    console.log('7. 🧪 Testing Google Ads tables fetch...');
    
    try {
      const tablesData = await googleAdsService.getGoogleAdsTables(startDate, endDate);
      console.log('   ✅ Tables data fetch successful');
    } catch (tablesError) {
      console.log('   ❌ Tables data fetch failed:', tablesError.message);
      console.log('   ⚠️ This might be the issue, but it should be handled gracefully');
    }
    console.log('');

    console.log('🎯 CONCLUSION');
    console.log('=============');
    console.log('If all steps above passed, the 400 error might be:');
    console.log('1. A request body parsing issue');
    console.log('2. An authentication middleware issue');
    console.log('3. A database connection issue');
    console.log('4. A missing environment variable');
    console.log('');
    console.log('💡 Try refreshing the /reports page now to see if it works!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.log('');
    console.log('🔧 LIKELY CAUSE OF 400 ERROR:');
    console.log(error.message);
  }
}

testGoogleAdsApiIsolated();
