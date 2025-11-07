#!/usr/bin/env node

/**
 * Test Google Ads API directly for October 2025
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BELMONTE_ID = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';

async function testOctoberGoogle() {
  console.log('🔍 TESTING OCTOBER 2025 GOOGLE ADS API\n');

  try {
    // 1. Get Belmonte client
    console.log('1️⃣ Fetching Belmonte client...');
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', BELMONTE_ID)
      .single();

    if (clientError || !client) {
      console.error('❌ Client not found:', clientError?.message);
      return;
    }

    console.log('   ✅ Client:', client.name);
    console.log('   Google Ads Customer ID:', client.google_ads_customer_id);
    console.log('   Has refresh token:', !!client.google_ads_refresh_token);

    // 2. Get system settings
    console.log('\n2️⃣ Fetching Google Ads system settings...');
    const { data: settingsData, error: settingsError } = await supabase
      .from('system_settings')
      .select('*')
      .in('key', [
        'google_ads_client_id',
        'google_ads_client_secret', 
        'google_ads_developer_token',
        'google_ads_manager_refresh_token',
        'google_ads_manager_customer_id'
      ]);

    if (settingsError) {
      console.error('❌ Settings error:', settingsError.message);
      return;
    }

    const settings = settingsData.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {});

    console.log('   ✅ Settings retrieved');
    console.log('   Has client ID:', !!settings.google_ads_client_id);
    console.log('   Has client secret:', !!settings.google_ads_client_secret);
    console.log('   Has developer token:', !!settings.google_ads_developer_token);
    console.log('   Has manager refresh token:', !!settings.google_ads_manager_refresh_token);
    console.log('   Manager Customer ID:', settings.google_ads_manager_customer_id);

    // 3. Test API call for October
    console.log('\n3️⃣ Testing Google Ads API for October 2025...');
    
    const requestBody = {
      clientId: BELMONTE_ID,
      dateRange: {
        start: '2025-10-01',
        end: '2025-10-31'
      }
    };
    
    console.log('   Request body:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch('http://localhost:3000/api/fetch-google-ads-live-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    console.log('   Response status:', response.status);
    const result = await response.json();
    console.log('   Response:', JSON.stringify(result, null, 2).substring(0, 500));

    if (result.success) {
      console.log('   ✅ API call successful!');
      console.log('   Total spend:', result.stats?.totalSpend);
      console.log('   Campaigns:', result.campaigns?.length);
      console.log('   Has conversion metrics:', !!result.conversionMetrics);
      
      if (result.campaigns && result.campaigns.length > 0) {
        console.log('\n   Sample campaigns:');
        result.campaigns.slice(0, 3).forEach(c => {
          console.log(`      - ${c.name}: $${c.spend}`);
        });
      }
    } else {
      console.error('   ❌ API call failed:', result.error);
      if (result.details) {
        console.error('   Details:', result.details);
      }
    }

  } catch (error) {
    console.error('\n💥 Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testOctoberGoogle()
  .then(() => {
    console.log('\n🏁 Test completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
  });

