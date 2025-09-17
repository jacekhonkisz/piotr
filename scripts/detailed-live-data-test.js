#!/usr/bin/env node

/**
 * Detailed Live Data Test
 * 
 * This script performs a more detailed test of live data fetching
 * to understand the API errors and data patterns
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function detailedLiveDataTest() {
  console.log('🔍 DETAILED LIVE DATA TEST\n');
  console.log('='.repeat(60));
  
  try {
    // 1. Test a single client with detailed error analysis
    console.log('🎯 TESTING SINGLE CLIENT WITH DETAILED ANALYSIS');
    console.log('='.repeat(60));
    
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, email, meta_access_token, ad_account_id, google_ads_customer_id, api_status')
      .eq('api_status', 'valid')
      .limit(1);
    
    if (!clients || clients.length === 0) {
      console.log('❌ No active clients found');
      return;
    }
    
    const testClient = clients[0];
    console.log(`Testing with: ${testClient.name}`);
    console.log(`Meta: ${testClient.meta_access_token ? '✅' : '❌'}`);
    console.log(`Google Ads: ${testClient.google_ads_customer_id ? '✅' : '❌'}`);
    
    // 2. Test Meta API with detailed error handling
    if (testClient.meta_access_token && testClient.ad_account_id) {
      console.log('\n🔄 TESTING META API...');
      try {
        const metaResponse = await fetch('http://localhost:3000/api/fetch-live-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({
            clientId: testClient.id,
            dateRange: { start: '2025-09-01', end: '2025-09-12' },
            platform: 'meta',
            forceFresh: true
          })
        });
        
        console.log(`Meta API Status: ${metaResponse.status}`);
        
        if (metaResponse.ok) {
          const metaData = await metaResponse.json();
          console.log(`✅ Meta API Success: ${JSON.stringify(metaData, null, 2)}`);
        } else {
          const errorText = await metaResponse.text();
          console.log(`❌ Meta API Error: ${errorText}`);
        }
      } catch (error) {
        console.log(`❌ Meta API Exception: ${error.message}`);
      }
    }
    
    // 3. Test Google Ads API with detailed error handling
    if (testClient.google_ads_customer_id) {
      console.log('\n🔄 TESTING GOOGLE ADS API...');
      try {
        const googleResponse = await fetch('http://localhost:3000/api/fetch-google-ads-live-data', {
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
        
        console.log(`Google Ads API Status: ${googleResponse.status}`);
        
        if (googleResponse.ok) {
          const googleData = await googleResponse.json();
          console.log(`✅ Google Ads API Success: ${JSON.stringify(googleData, null, 2)}`);
        } else {
          const errorText = await googleResponse.text();
          console.log(`❌ Google Ads API Error: ${errorText}`);
          
          // Try to parse error for more details
          try {
            const errorJson = JSON.parse(errorText);
            console.log(`Error Details: ${JSON.stringify(errorJson, null, 2)}`);
          } catch (e) {
            console.log(`Raw Error: ${errorText}`);
          }
        }
      } catch (error) {
        console.log(`❌ Google Ads API Exception: ${error.message}`);
      }
    }
    
    // 4. Test database data for this client
    console.log('\n📊 TESTING DATABASE DATA...');
    const { data: dbData } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', testClient.id)
      .gte('summary_date', '2025-09-01')
      .lte('summary_date', '2025-09-12')
      .order('summary_date');
    
    console.log(`Database Records: ${dbData?.length || 0}`);
    if (dbData && dbData.length > 0) {
      console.log('Sample Database Record:');
      console.log(JSON.stringify(dbData[0], null, 2));
    }
    
    // 5. Test system settings
    console.log('\n🔧 TESTING SYSTEM SETTINGS...');
    const { data: settings } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['google_ads_enabled', 'google_ads_client_id', 'google_ads_developer_token']);
    
    settings?.forEach(setting => {
      const value = setting.key.includes('secret') || setting.key.includes('token') 
        ? (setting.value ? '***CONFIGURED***' : 'NOT SET')
        : setting.value;
      console.log(`${setting.key}: ${value}`);
    });
    
    // 6. Test Google Ads credentials for this client
    console.log('\n🔑 TESTING CLIENT GOOGLE ADS CREDENTIALS...');
    const { data: clientDetails } = await supabase
      .from('clients')
      .select('google_ads_customer_id, google_ads_refresh_token, google_ads_access_token, google_ads_token_expires_at, google_ads_enabled')
      .eq('id', testClient.id)
      .single();
    
    if (clientDetails) {
      console.log(`Customer ID: ${clientDetails.google_ads_customer_id}`);
      console.log(`Refresh Token: ${clientDetails.google_ads_refresh_token ? '***CONFIGURED***' : 'NOT SET'}`);
      console.log(`Access Token: ${clientDetails.google_ads_access_token ? '***CONFIGURED***' : 'NOT SET'}`);
      console.log(`Token Expires: ${clientDetails.google_ads_token_expires_at || 'NOT SET'}`);
      console.log(`Enabled: ${clientDetails.google_ads_enabled}`);
    }
    
    // 7. Test if we can access Google Ads API directly
    console.log('\n🌐 TESTING GOOGLE ADS API ACCESS...');
    try {
      const testResponse = await fetch('http://localhost:3000/api/test-google-ads-health', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        }
      });
      
      console.log(`Google Ads Health Check Status: ${testResponse.status}`);
      if (testResponse.ok) {
        const healthData = await testResponse.json();
        console.log(`Health Check Result: ${JSON.stringify(healthData, null, 2)}`);
      } else {
        const errorText = await testResponse.text();
        console.log(`Health Check Error: ${errorText}`);
      }
    } catch (error) {
      console.log(`Health Check Exception: ${error.message}`);
    }
    
    console.log('\n✅ DETAILED TEST COMPLETE');
    
  } catch (error) {
    console.error('❌ Detailed test failed:', error);
  }
}

// Run the detailed test
detailedLiveDataTest();
