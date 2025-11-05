#!/usr/bin/env node

/**
 * Test Belmonte Google Ads Data Fetch via API Endpoint
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testBelmonteFetch() {
  console.log('🎯 Testing Belmonte Google Ads Data Fetch');
  console.log('═══════════════════════════════════════════════════\n');
  
  try {
    // Get Belmonte client
    console.log('📋 Getting Belmonte client...');
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
    console.log(`   Customer ID: ${client.google_ads_customer_id}`);
    console.log(`   Client ID: ${client.id}\n`);
    
    // Get date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    const dateStart = startDate.toISOString().split('T')[0];
    const dateEnd = endDate.toISOString().split('T')[0];
    
    console.log(`📅 Date Range: ${dateStart} to ${dateEnd}\n`);
    
    // Get credentials
    console.log('📋 Getting credentials...');
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
    
    console.log('✅ Credentials ready\n');
    
    // Test token refresh
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
    console.log('✅ Access token obtained\n');
    
    // Now test using the google-ads-api library approach
    // Since we can't import TypeScript, let's use a simpler query approach
    console.log('🔄 Testing Google Ads API connection...');
    console.log('   Using Google Ads API REST endpoint...\n');
    
    // Use the correct Google Ads API endpoint
    const customerId = client.google_ads_customer_id.replace(/-/g, '');
    const apiUrl = `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:searchStream`;
    
    const query = `
      SELECT
        customer.id,
        customer.descriptive_name,
        customer.currency_code,
        segments.date,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.ctr,
        metrics.average_cpc,
        metrics.conversions,
        metrics.conversions_value
      FROM customer
      WHERE segments.date >= '${dateStart}' AND segments.date <= '${dateEnd}'
      ORDER BY segments.date DESC
      LIMIT 100
    `;
    
    console.log('📤 Sending query to Google Ads API...');
    console.log(`   URL: ${apiUrl}`);
    console.log(`   Customer ID: ${customerId}\n`);
    
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'developer-token': creds.google_ads_developer_token,
        'Content-Type': 'application/json',
        'login-customer-id': creds.google_ads_manager_customer_id.replace(/-/g, '')
      },
      body: JSON.stringify({ query })
    });
    
    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error(`❌ Google Ads API error: ${apiResponse.status}`);
      
      // Try to parse JSON error
      try {
        const errorJson = JSON.parse(errorText);
        console.error(`   Error: ${JSON.stringify(errorJson, null, 2)}`);
      } catch {
        console.error(`   Error: ${errorText.substring(0, 500)}`);
      }
      
      if (apiResponse.status === 401) {
        console.log('\n💡 Possible issues:');
        console.log('   - Access token expired');
        console.log('   - Developer token not authorized');
      } else if (apiResponse.status === 403) {
        console.log('\n💡 Possible issues:');
        console.log('   - Insufficient permissions');
        console.log('   - Customer account not accessible');
      } else if (apiResponse.status === 404) {
        console.log('\n💡 Possible issues:');
        console.log('   - Customer ID format incorrect');
        console.log('   - Account not found');
      }
      
      return;
    }
    
    const apiData = await apiResponse.json();
    
    console.log('✅ Google Ads API response received!\n');
    
    // Parse the response
    if (apiData.results && apiData.results.length > 0) {
      console.log(`📊 Found ${apiData.results.length} data points\n`);
      
      // Aggregate the data
      let totalImpressions = 0;
      let totalClicks = 0;
      let totalCostMicros = 0;
      let totalConversions = 0;
      let totalConversionsValue = 0;
      let customerName = '';
      let currency = 'PLN';
      
      apiData.results.forEach((result) => {
        const customer = result.customer;
        const metrics = result.metrics;
        const segment = result.segments;
        
        if (!customerName && customer?.descriptive_name) {
          customerName = customer.descriptive_name;
        }
        if (customer?.currency_code) {
          currency = customer.currency_code;
        }
        
        totalImpressions += parseInt(metrics?.impressions || '0');
        totalClicks += parseInt(metrics?.clicks || '0');
        totalCostMicros += parseInt(metrics?.cost_micros || '0');
        totalConversions += parseFloat(metrics?.conversions || '0');
        totalConversionsValue += parseFloat(metrics?.conversions_value || '0');
      });
      
      const spend = totalCostMicros / 1000000;
      const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const cpc = totalClicks > 0 ? spend / totalClicks : 0;
      const roas = spend > 0 ? (totalConversionsValue / 1000000) / spend : 0;
      
      console.log('📊 Account Performance Summary:');
      console.log('═══════════════════════════════════════');
      console.log(`   Account: ${customerName || 'Belmonte Hotel'}`);
      console.log(`   Customer ID: ${customerId}`);
      console.log(`   Currency: ${currency}`);
      console.log(`   Date Range: ${dateStart} to ${dateEnd}`);
      console.log('');
      console.log(`   Impressions: ${totalImpressions.toLocaleString()}`);
      console.log(`   Clicks: ${totalClicks.toLocaleString()}`);
      console.log(`   Spend: ${spend.toLocaleString('pl-PL', { style: 'currency', currency: currency })}`);
      console.log(`   CTR: ${ctr.toFixed(2)}%`);
      console.log(`   CPC: ${cpc.toLocaleString('pl-PL', { style: 'currency', currency: currency })}`);
      console.log(`   Conversions: ${totalConversions.toLocaleString()}`);
      console.log(`   Conversion Value: ${(totalConversionsValue / 1000000).toLocaleString('pl-PL', { style: 'currency', currency: currency })}`);
      console.log(`   ROAS: ${roas.toFixed(2)}`);
      
      console.log('\n🎉 SUCCESS! Google Ads data fetched successfully!');
      console.log('✅ Integration is working perfectly!');
      console.log('✅ Data is being retrieved from Google Ads API!');
      
    } else {
      console.log('⚠️  No data returned for this date range');
      console.log('   This might be normal if:');
      console.log('   - There was no activity in this period');
      console.log('   - Campaigns were paused');
      console.log('   - Date range has no data');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('   Stack:', error.stack);
  }
}

testBelmonteFetch().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});



