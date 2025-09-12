#!/usr/bin/env node

/**
 * Test Manager Token Access
 * 
 * This script tests if the manager refresh token can access client accounts
 * using their Customer IDs, as designed in the system
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testManagerTokenAccess() {
  console.log('🔍 TESTING MANAGER TOKEN ACCESS TO CLIENT ACCOUNTS\n');
  console.log('='.repeat(60));
  
  try {
    // 1. Get system settings
    console.log('🔧 GETTING SYSTEM SETTINGS...');
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
    
    const settings = settingsData?.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, string>) || {};
    
    console.log('System Settings:');
    console.log(`   Manager Customer ID: ${settings.google_ads_manager_customer_id}`);
    console.log(`   Manager Refresh Token: ${settings.google_ads_manager_refresh_token ? '***CONFIGURED***' : 'NOT SET'}`);
    console.log(`   Client ID: ${settings.google_ads_client_id}`);
    console.log(`   Developer Token: ${settings.google_ads_developer_token ? '***CONFIGURED***' : 'NOT SET'}`);
    
    // 2. Get a test client
    console.log('\n👥 GETTING TEST CLIENT...');
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, email, google_ads_customer_id, google_ads_enabled')
      .eq('api_status', 'valid')
      .eq('google_ads_enabled', true)
      .not('google_ads_customer_id', 'is', null)
      .limit(1);
    
    if (!clients || clients.length === 0) {
      console.log('❌ No clients with Google Ads configuration found');
      return;
    }
    
    const testClient = clients[0];
    console.log(`Test Client: ${testClient.name}`);
    console.log(`Customer ID: ${testClient.google_ads_customer_id}`);
    
    // 3. Test the Google Ads API with manager token
    console.log('\n🔄 TESTING GOOGLE ADS API WITH MANAGER TOKEN...');
    
    const googleAdsCredentials = {
      refreshToken: settings.google_ads_manager_refresh_token,
      clientId: settings.google_ads_client_id,
      clientSecret: settings.google_ads_client_secret,
      developmentToken: settings.google_ads_developer_token,
      customerId: testClient.google_ads_customer_id,
      managerCustomerId: settings.google_ads_manager_customer_id,
    };
    
    console.log('Credentials prepared:');
    console.log(`   Using Manager Token: ${!!googleAdsCredentials.refreshToken}`);
    console.log(`   Target Customer ID: ${googleAdsCredentials.customerId}`);
    console.log(`   Manager Customer ID: ${googleAdsCredentials.managerCustomerId}`);
    
    // 4. Test the API call
    console.log('\n🌐 TESTING API CALL...');
    
    try {
      const response = await fetch('http://localhost:3000/api/fetch-google-ads-live-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
          clientId: testClient.id,
          startDate: '2025-09-01',
          endDate: '2025-09-12'
        })
      });
      
      console.log(`API Response Status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ API SUCCESS!');
        console.log(`Data received: ${JSON.stringify(data, null, 2)}`);
        
        if (data.data && data.data.campaigns) {
          console.log(`\n📊 CAMPAIGNS FOUND: ${data.data.campaigns.length}`);
          data.data.campaigns.slice(0, 3).forEach((campaign, i) => {
            console.log(`   ${i + 1}. ${campaign.campaignName} (ID: ${campaign.campaignId})`);
            console.log(`      Spend: ${campaign.spend}, Impressions: ${campaign.impressions}`);
          });
        }
      } else {
        const errorText = await response.text();
        console.log('❌ API ERROR:');
        console.log(`Status: ${response.status}`);
        console.log(`Error: ${errorText}`);
        
        // Try to parse error for more details
        try {
          const errorJson = JSON.parse(errorText);
          console.log('Error Details:', JSON.stringify(errorJson, null, 2));
        } catch (e) {
          console.log('Raw Error Response:', errorText);
        }
      }
    } catch (error) {
      console.log('❌ API EXCEPTION:', error.message);
    }
    
    // 5. Test with a different approach - direct API call
    console.log('\n🔧 TESTING DIRECT GOOGLE ADS API CALL...');
    
    try {
      // Import the Google Ads API service
      const { GoogleAdsAPIService } = await import('../src/lib/google-ads-api.ts');
      
      const googleAdsService = new GoogleAdsAPIService(googleAdsCredentials);
      
      console.log('✅ Google Ads API Service initialized');
      
      // Test credentials validation
      console.log('🔍 Validating credentials...');
      const validation = await googleAdsService.validateCredentials();
      
      if (validation.valid) {
        console.log('✅ Credentials are valid!');
        
        // Try to fetch campaign data
        console.log('📊 Fetching campaign data...');
        const campaigns = await googleAdsService.getCampaignData('2025-09-01', '2025-09-12');
        
        console.log(`✅ Found ${campaigns.length} campaigns`);
        campaigns.slice(0, 3).forEach((campaign, i) => {
          console.log(`   ${i + 1}. ${campaign.campaignName} (ID: ${campaign.campaignId})`);
          console.log(`      Spend: ${campaign.spend}, Impressions: ${campaign.impressions}`);
        });
      } else {
        console.log('❌ Credentials validation failed:', validation.error);
      }
    } catch (error) {
      console.log('❌ Direct API call failed:', error.message);
    }
    
    console.log('\n✅ MANAGER TOKEN ACCESS TEST COMPLETE');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testManagerTokenAccess();
