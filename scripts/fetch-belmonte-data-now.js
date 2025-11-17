#!/usr/bin/env node

/**
 * Fetch Real Google Ads Data for Belmonte Hotel
 * Tests the actual API connection and data retrieval
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// We'll need to use the API endpoint since we can't import TypeScript directly
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function getDateRange() {
  const now = new Date();
  const end = formatDate(now);
  const start = new Date(now);
  start.setDate(start.getDate() - 30); // Last 30 days
  return {
    start: formatDate(start),
    end: end
  };
}

async function fetchBelmonteData() {
  console.log('🎯 Fetching Google Ads Data for Belmonte Hotel');
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
    console.log(`   Customer ID: ${client.google_ads_customer_id || 'Not set'}`);
    console.log(`   Client ID: ${client.id}\n`);
    
    if (!client.google_ads_customer_id) {
      console.error('❌ Belmonte does not have Google Ads Customer ID configured');
      process.exit(1);
    }
    
    // Step 2: Get Google Ads credentials
    console.log('📋 Step 2: Getting Google Ads credentials...');
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'google_ads_client_id',
        'google_ads_client_secret',
        'google_ads_developer_token',
        'google_ads_manager_customer_id',
        'google_ads_manager_refresh_token'
      ]);
    
    if (settingsError) throw settingsError;
    
    const creds = {};
    settings?.forEach(s => {
      creds[s.key] = s.value;
    });
    
    // Verify all credentials are present
    const required = [
      'google_ads_client_id',
      'google_ads_client_secret',
      'google_ads_developer_token',
      'google_ads_manager_refresh_token'
    ];
    
    for (const key of required) {
      if (!creds[key]) {
        console.error(`❌ Missing credential: ${key}`);
        process.exit(1);
      }
    }
    
    console.log('✅ All credentials found\n');
    
    // Step 3: Test API endpoint
    console.log('📋 Step 3: Testing API endpoint...');
    console.log('   Calling: /api/google-ads-account-performance\n');
    
    const dateRange = getDateRange();
    console.log(`   Date Range: ${dateRange.start} to ${dateRange.end}\n`);
    
    // Call the API endpoint
    const apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const endpoint = `${apiUrl}/api/google-ads-account-performance`;
    
    console.log('🔄 Making API request...');
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}` // Use service role key for server-side
      },
      body: JSON.stringify({
        clientId: client.id,
        startDate: dateRange.start,
        endDate: dateRange.end
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API request failed: ${response.status}`);
      console.error(`   Error: ${errorText}`);
      
      // If endpoint doesn't exist or server not running, try direct API call
      console.log('\n💡 Trying alternative: Direct API call via fetch...');
      await testDirectAPICall(client, creds, dateRange);
      return;
    }
    
    const data = await response.json();
    
    if (data.error) {
      console.error(`❌ API Error: ${data.error}`);
      if (data.message) {
        console.error(`   Details: ${data.message}`);
      }
      return;
    }
    
    console.log('✅ API request successful!\n');
    
    // Display results
    console.log('📊 Account Performance Data:');
    console.log('═══════════════════════════════');
    
    if (data.performance) {
      const perf = data.performance;
      console.log(`   Impressions: ${perf.impressions?.toLocaleString() || 0}`);
      console.log(`   Clicks: ${perf.clicks?.toLocaleString() || 0}`);
      console.log(`   Spend: ${perf.spend?.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' }) || '0 PLN'}`);
      console.log(`   CTR: ${perf.ctr?.toFixed(2) || 0}%`);
      console.log(`   CPC: ${perf.cpc?.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' }) || '0 PLN'}`);
      console.log(`   Conversions: ${perf.conversions?.toLocaleString() || 0}`);
      console.log(`   Conversion Value: ${perf.conversionValue?.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' }) || '0 PLN'}`);
      
      if (perf.impressions > 0) {
        console.log('\n✅ Data successfully fetched from Google Ads API!');
      }
    } else {
      console.log('   No performance data returned');
      console.log('   Response:', JSON.stringify(data, null, 2));
    }
    
  } catch (error) {
    console.error('\n❌ Error fetching data:', error);
    console.error('   Details:', error.message);
    
    // Try alternative method
    console.log('\n💡 Trying alternative method...');
    await testDirectAPICall(null, null, getDateRange());
  }
}

async function testDirectAPICall(client, creds, dateRange) {
  console.log('\n🔄 Testing direct Google Ads API connection...');
  
  try {
    // Get client if not provided
    if (!client) {
      const { data: clients } = await supabase
        .from('clients')
        .select('*')
        .or('name.ilike.%belmonte%,email.ilike.%belmonte%')
        .limit(1);
      
      if (!clients || clients.length === 0) {
        console.error('❌ Belmonte client not found');
        return;
      }
      client = clients[0];
    }
    
    // Get credentials if not provided
    if (!creds) {
      const { data: settings } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', [
          'google_ads_client_id',
          'google_ads_client_secret',
          'google_ads_developer_token',
          'google_ads_manager_customer_id',
          'google_ads_manager_refresh_token'
        ]);
      
      creds = {};
      settings?.forEach(s => {
        creds[s.key] = s.value;
      });
    }
    
    // Test token refresh first
    console.log('🔄 Testing token refresh...');
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: creds.google_ads_client_id,
        client_secret: creds.google_ads_client_secret,
        refresh_token: creds.google_ads_manager_refresh_token,
        grant_type: 'refresh_token'
      })
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(`❌ Token refresh failed: ${tokenResponse.status}`);
      console.error(`   Error: ${errorText}`);
      return;
    }
    
    const tokenData = await tokenResponse.json();
    console.log('✅ Access token obtained');
    
    // Use Google Ads API REST endpoint
    console.log('🔄 Fetching account data from Google Ads API...');
    
    const customerId = client.google_ads_customer_id.replace(/-/g, '');
    const apiUrl = `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:search`;
    
    const query = `
      SELECT
        customer.id,
        customer.descriptive_name,
        customer.currency_code,
        customer.time_zone,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.ctr,
        metrics.average_cpc,
        metrics.conversions,
        metrics.conversions_value
      FROM customer
      WHERE segments.date BETWEEN '${dateRange.start}' AND '${dateRange.end}'
      LIMIT 1
    `;
    
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'developer-token': creds.google_ads_developer_token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });
    
    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error(`❌ Google Ads API error: ${apiResponse.status}`);
      console.error(`   Error: ${errorText}`);
      return;
    }
    
    const apiData = await apiResponse.json();
    console.log('✅ Google Ads API response received!\n');
    
    if (apiData.results && apiData.results.length > 0) {
      const result = apiData.results[0];
      const customer = result.customer;
      const metrics = result.metrics;
      
      console.log('📊 Account Data:');
      console.log('═══════════════════════════════');
      console.log(`   Account Name: ${customer.descriptive_name}`);
      console.log(`   Customer ID: ${customer.id}`);
      console.log(`   Currency: ${customer.currency_code}`);
      console.log(`   Time Zone: ${customer.time_zone}`);
      console.log(`   Impressions: ${metrics.impressions?.toLocaleString() || 0}`);
      console.log(`   Clicks: ${metrics.clicks?.toLocaleString() || 0}`);
      console.log(`   Cost: ${(metrics.cost_micros / 1000000).toLocaleString('pl-PL', { style: 'currency', currency: customer.currency_code || 'PLN' })}`);
      console.log(`   CTR: ${metrics.ctr ? (metrics.ctr * 100).toFixed(2) : 0}%`);
      console.log(`   Avg CPC: ${metrics.average_cpc ? (metrics.average_cpc / 1000000).toLocaleString('pl-PL', { style: 'currency', currency: customer.currency_code || 'PLN' }) : '0'}`);
      console.log(`   Conversions: ${metrics.conversions?.toLocaleString() || 0}`);
      console.log(`   Conversion Value: ${metrics.conversions_value ? (metrics.conversions_value / 1000000).toLocaleString('pl-PL', { style: 'currency', currency: customer.currency_code || 'PLN' }) : '0'}`);
      
      console.log('\n🎉 SUCCESS! Google Ads data fetched successfully!');
      console.log('✅ Integration is working perfectly!');
    } else {
      console.log('⚠️  No data returned for this date range');
      console.log('   This might be normal if there was no activity');
    }
    
  } catch (error) {
    console.error('❌ Error in direct API call:', error.message);
  }
}

// Run the test
fetchBelmonteData().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});






