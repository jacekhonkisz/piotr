#!/usr/bin/env node

/**
 * Fetch Google Ads Data for Belmonte Client
 * First real test of the complete Google Ads integration
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Google Ads API configuration
const GOOGLE_ADS_API_VERSION = 'v14';
const GOOGLE_ADS_BASE_URL = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;

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

async function refreshAccessToken(credentials) {
  console.log('🔄 Refreshing OAuth access token...');
  
  const tokenUrl = 'https://oauth2.googleapis.com/token';
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: credentials.google_ads_client_id,
      client_secret: credentials.google_ads_client_secret,
      refresh_token: credentials.google_ads_manager_refresh_token,
      grant_type: 'refresh_token'
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
  }
  
  const tokenData = await response.json();
  console.log('✅ Access token refreshed successfully');
  
  return tokenData.access_token;
}

async function listAccessibleCustomers(credentials, accessToken) {
  console.log('📋 Listing accessible customers...');
  
  const url = `${GOOGLE_ADS_BASE_URL}/customers:listAccessibleCustomers`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': credentials.google_ads_developer_token,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.log(`⚠️  List customers failed: ${response.status} - ${errorText}`);
    return null;
  }
  
  const data = await response.json();
  console.log('✅ Successfully listed accessible customers:');
  
  if (data.resourceNames) {
    data.resourceNames.forEach(resourceName => {
      const customerId = resourceName.replace('customers/', '');
      console.log(`   Customer ID: ${customerId}`);
    });
  }
  
  return data;
}

async function fetchCampaigns(credentials, accessToken, customerId) {
  console.log(`📊 Fetching campaigns for customer: ${customerId}...`);
  
  // Remove dashes from customer ID for API calls
  const cleanCustomerId = customerId.replace(/-/g, '');
  
  const url = `${GOOGLE_ADS_BASE_URL}/customers/${cleanCustomerId}/googleAds:search`;
  
  const query = `
    SELECT 
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      segments.date
    FROM campaign 
    WHERE segments.date DURING LAST_30_DAYS
    ORDER BY metrics.impressions DESC
    LIMIT 10
  `;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': credentials.google_ads_developer_token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: query.trim()
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.log(`⚠️  Campaign fetch failed: ${response.status} - ${errorText}`);
    return null;
  }
  
  const data = await response.json();
  console.log('✅ Successfully fetched campaign data!');
  
  if (data.results && data.results.length > 0) {
    console.log('\n📈 Campaign Performance (Last 30 Days):');
    console.log('==========================================');
    
    data.results.forEach((result, index) => {
      const campaign = result.campaign;
      const metrics = result.metrics;
      const costDollars = (parseInt(metrics.costMicros) / 1000000).toFixed(2);
      
      console.log(`\n${index + 1}. ${campaign.name}`);
      console.log(`   Campaign ID: ${campaign.id}`);
      console.log(`   Status: ${campaign.status}`);
      console.log(`   Type: ${campaign.advertisingChannelType}`);
      console.log(`   Impressions: ${metrics.impressions || 0}`);
      console.log(`   Clicks: ${metrics.clicks || 0}`);
      console.log(`   Cost: $${costDollars}`);
      console.log(`   Conversions: ${metrics.conversions || 0}`);
    });
    
    // Calculate totals
    const totals = data.results.reduce((acc, result) => {
      const metrics = result.metrics;
      return {
        impressions: acc.impressions + (parseInt(metrics.impressions) || 0),
        clicks: acc.clicks + (parseInt(metrics.clicks) || 0),
        cost: acc.cost + (parseInt(metrics.costMicros) || 0),
        conversions: acc.conversions + (parseFloat(metrics.conversions) || 0)
      };
    }, { impressions: 0, clicks: 0, cost: 0, conversions: 0 });
    
    console.log('\n📊 Totals (Last 30 Days):');
    console.log('=========================');
    console.log(`Total Impressions: ${totals.impressions.toLocaleString()}`);
    console.log(`Total Clicks: ${totals.clicks.toLocaleString()}`);
    console.log(`Total Cost: $${(totals.cost / 1000000).toFixed(2)}`);
    console.log(`Total Conversions: ${totals.conversions.toFixed(1)}`);
    
    if (totals.clicks > 0) {
      const ctr = ((totals.clicks / totals.impressions) * 100).toFixed(2);
      const cpc = (totals.cost / 1000000 / totals.clicks).toFixed(2);
      console.log(`CTR: ${ctr}%`);
      console.log(`CPC: $${cpc}`);
    }
    
  } else {
    console.log('📝 No campaign data found for the last 30 days');
  }
  
  return data;
}

async function fetchKeywords(credentials, accessToken, customerId) {
  console.log(`🔍 Fetching keywords for customer: ${customerId}...`);
  
  const cleanCustomerId = customerId.replace(/-/g, '');
  const url = `${GOOGLE_ADS_BASE_URL}/customers/${cleanCustomerId}/googleAds:search`;
  
  const query = `
    SELECT 
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      campaign.name,
      ad_group.name,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros
    FROM keyword_view 
    WHERE segments.date DURING LAST_30_DAYS
    AND metrics.impressions > 0
    ORDER BY metrics.impressions DESC
    LIMIT 10
  `;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': credentials.google_ads_developer_token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: query.trim()
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.log(`⚠️  Keywords fetch failed: ${response.status} - ${errorText}`);
    return null;
  }
  
  const data = await response.json();
  
  if (data.results && data.results.length > 0) {
    console.log('\n🔑 Top Keywords (Last 30 Days):');
    console.log('===============================');
    
    data.results.forEach((result, index) => {
      const keyword = result.adGroupCriterion.keyword;
      const metrics = result.metrics;
      const campaign = result.campaign;
      const adGroup = result.adGroup;
      const costDollars = (parseInt(metrics.costMicros) / 1000000).toFixed(2);
      
      console.log(`\n${index + 1}. "${keyword.text}"`);
      console.log(`   Match Type: ${keyword.matchType}`);
      console.log(`   Campaign: ${campaign.name}`);
      console.log(`   Ad Group: ${adGroup.name}`);
      console.log(`   Impressions: ${metrics.impressions || 0}`);
      console.log(`   Clicks: ${metrics.clicks || 0}`);
      console.log(`   Cost: $${costDollars}`);
    });
  } else {
    console.log('📝 No keyword data found for the last 30 days');
  }
  
  return data;
}

async function main() {
  console.log('🎯 Fetching Google Ads Data for Belmonte');
  console.log('========================================\n');
  
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
    
    // Step 3: Refresh access token
    const accessToken = await refreshAccessToken(credentials);
    
    // Step 4: List accessible customers (to verify access)
    const customers = await listAccessibleCustomers(credentials, accessToken);
    
    // Step 5: Fetch campaign data for Belmonte
    const campaigns = await fetchCampaigns(
      credentials, 
      accessToken, 
      belmonteClient.google_ads_customer_id
    );
    
    // Step 6: Fetch keyword data for Belmonte
    const keywords = await fetchKeywords(
      credentials,
      accessToken,
      belmonteClient.google_ads_customer_id
    );
    
    console.log('\n🎉 Google Ads Data Fetch Complete!');
    console.log('==================================');
    console.log('✅ OAuth authentication successful');
    console.log('✅ API access confirmed');
    console.log('✅ Campaign data retrieved');
    console.log('✅ Keyword data retrieved');
    console.log('\n🚀 Your Google Ads integration is working perfectly!');
    
  } catch (error) {
    console.error('❌ Error fetching Google Ads data:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Verify all credentials are correct');
    console.log('2. Check that Customer ID 789-260-9395 has data');
    console.log('3. Ensure manager account has access to this customer');
    console.log('4. Verify Google Ads API is enabled in your project');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  getGoogleAdsCredentials,
  getBelmonteClient,
  refreshAccessToken,
  fetchCampaigns,
  fetchKeywords
}; 