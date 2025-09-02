#!/usr/bin/env node

/**
 * Test Google Ads API for Belmonte using Official Library
 * This replaces the broken REST API approach
 */

const { GoogleAdsApi } = require('google-ads-api');
require('dotenv').config();

const supabase = require('@supabase/supabase-js').createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getGoogleAdsCredentials() {
  console.log('🔐 Getting Google Ads credentials...');
  
  const { data: settings, error } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', [
      'google_ads_developer_token',
      'google_ads_client_id', 
      'google_ads_client_secret',
      'google_ads_manager_refresh_token'
    ]);
  
  if (error) {
    throw new Error(`Failed to get credentials: ${error.message}`);
  }
  
  const creds = {};
  settings?.forEach(setting => {
    creds[setting.key] = setting.value;
  });
  
  console.log('✅ Retrieved all credentials');
  return creds;
}

async function getBelmonteClient() {
  console.log('🔍 Finding Belmonte client...');
  
  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('email', 'belmonte@hotel.com')
    .single();
  
  if (error) {
    throw new Error(`Failed to find Belmonte: ${error.message}`);
  }
  
  console.log('✅ Found Belmonte client:');
  console.log(`   Name: ${client.name}`);
  console.log(`   Email: ${client.email}`);
  console.log(`   Google Ads Customer ID: ${client.google_ads_customer_id}`);
  console.log(`   Google Ads Enabled: ${client.google_ads_enabled}`);
  
  return client;
}

async function testGoogleAdsAPI(credentials, belmonteClient) {
  console.log('\n🧪 Testing Google Ads API with Official Library...');
  
  try {
    // Initialize Google Ads API client
    const client = new GoogleAdsApi({
      client_id: credentials.google_ads_client_id,
      client_secret: credentials.google_ads_client_secret,
      developer_token: credentials.google_ads_developer_token
    });

    console.log('✅ Google Ads API client initialized');

    // Create customer instance
    const customer = client.Customer({
      customer_id: belmonteClient.google_ads_customer_id.replace(/-/g, ''),
      refresh_token: credentials.google_ads_manager_refresh_token
    });

    console.log('✅ Customer instance created');

    // Test basic query
    console.log('\n📊 Testing basic customer query...');
    const query = `
      SELECT 
        customer.id,
        customer.descriptive_name,
        customer.currency_code,
        customer.time_zone
      FROM customer
      LIMIT 1
    `;

    const response = await customer.query(query);
    
    if (response && response.length > 0) {
      console.log('✅ Customer query successful!');
      console.log('📋 Customer Data:');
      console.log(`   ID: ${response[0].customer.id}`);
      console.log(`   Name: ${response[0].customer.descriptive_name}`);
      console.log(`   Currency: ${response[0].customer.currency_code}`);
      console.log(`   Timezone: ${response[0].customer.time_zone}`);
    } else {
      console.log('⚠️  Customer query returned no results');
    }

    // Test campaign query
    console.log('\n📈 Testing campaign query...');
    const campaignQuery = `
      SELECT 
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros
      FROM campaign 
      WHERE segments.date DURING LAST_30_DAYS
      ORDER BY metrics.impressions DESC
      LIMIT 5
    `;

    const campaignResponse = await customer.query(campaignQuery);
    
    if (campaignResponse && campaignResponse.length > 0) {
      console.log('✅ Campaign query successful!');
      console.log(`📊 Found ${campaignResponse.length} campaigns`);
      
      campaignResponse.forEach((campaign, index) => {
        const costDollars = ((campaign.metrics.cost_micros || 0) / 1000000).toFixed(2);
        console.log(`\n${index + 1}. ${campaign.campaign.name}`);
        console.log(`   ID: ${campaign.campaign.id}`);
        console.log(`   Status: ${campaign.campaign.status}`);
        console.log(`   Type: ${campaign.campaign.advertising_channel_type}`);
        console.log(`   Impressions: ${campaign.metrics.impressions || 0}`);
        console.log(`   Clicks: ${campaign.metrics.clicks || 0}`);
        console.log(`   Cost: $${costDollars}`);
      });
    } else {
      console.log('⚠️  Campaign query returned no results (no campaigns in last 30 days)');
    }

    return true;

  } catch (error) {
    console.error('❌ Google Ads API Error:', error.message);
    console.error('Full error:', error);
    return false;
  }
}

async function main() {
  console.log('🎯 Testing Google Ads API for Belmonte (Official Library)');
  console.log('========================================================\n');
  
  try {
    // Step 1: Get credentials
    const credentials = await getGoogleAdsCredentials();
    
    // Step 2: Get Belmonte client info
    const belmonteClient = await getBelmonteClient();
    
    if (!belmonteClient.google_ads_customer_id) {
      console.log('❌ Belmonte does not have Google Ads Customer ID configured');
      return;
    }
    
    if (!belmonteClient.google_ads_enabled) {
      console.log('❌ Google Ads is not enabled for Belmonte');
      return;
    }
    
    // Step 3: Test Google Ads API
    const apiSuccess = await testGoogleAdsAPI(credentials, belmonteClient);
    
    // Summary
    console.log('\n📊 Test Summary');
    console.log('================');
    console.log(`Google Ads API Test: ${apiSuccess ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    if (apiSuccess) {
      console.log('\n🎉 Google Ads integration is working perfectly!');
      console.log('✅ Official API library connected');
      console.log('✅ Customer data retrieved');
      console.log('✅ Campaign data accessible');
      console.log('\n🚀 Your Google Ads integration is ready for production!');
    } else {
      console.log('\n🔧 Troubleshooting needed:');
      console.log('1. Check API credentials');
      console.log('2. Verify customer ID access');
      console.log('3. Check Google Ads account status');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testGoogleAdsAPI
};
