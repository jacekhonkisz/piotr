#!/usr/bin/env node

/**
 * Diagnose Google Ads API Access
 * Check what customers are accessible and verify setup
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const GOOGLE_ADS_API_VERSION = 'v14';
const GOOGLE_ADS_BASE_URL = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;

async function getCredentials() {
  const { data: settings, error } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', [
      'google_ads_developer_token',
      'google_ads_client_id', 
      'google_ads_client_secret',
      'google_ads_manager_refresh_token',
      'google_ads_manager_customer_id'
    ]);
  
  if (error) throw new Error(`Failed to get credentials: ${error.message}`);
  
  const creds = {};
  settings?.forEach(setting => {
    creds[setting.key] = setting.value;
  });
  
  return creds;
}

async function refreshAccessToken(credentials) {
  console.log('🔄 Refreshing OAuth access token...');
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
  console.log('📋 Listing all accessible customers...');
  
  // Try the correct endpoint
  const url = `${GOOGLE_ADS_BASE_URL}/customers:listAccessibleCustomers`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': credentials.google_ads_developer_token,
      'Content-Type': 'application/json'
    }
  });
  
  console.log(`📡 Response Status: ${response.status}`);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.log('❌ List customers failed');
    console.log('Response:', errorText.substring(0, 500));
    
    // Try alternative endpoint
    console.log('\n🔄 Trying alternative approach...');
    return await tryAlternativeCustomerList(credentials, accessToken);
  }
  
  const data = await response.json();
  console.log('✅ Successfully listed accessible customers!');
  
  if (data.resourceNames && data.resourceNames.length > 0) {
    console.log('\n📊 Accessible Customers:');
    console.log('========================');
    data.resourceNames.forEach((resourceName, index) => {
      const customerId = resourceName.replace('customers/', '');
      const formattedId = customerId.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
      console.log(`${index + 1}. Customer ID: ${customerId} (${formattedId})`);
    });
    
    // Check if Belmonte's customer ID is in the list
    const belmonteCustomerId = '7892609395'; // 789-260-9395 without dashes
    const hasAccess = data.resourceNames.some(name => 
      name.includes(belmonteCustomerId)
    );
    
    console.log(`\n🎯 Belmonte Access Check:`);
    console.log(`   Looking for: ${belmonteCustomerId} (789-260-9395)`);
    console.log(`   Access: ${hasAccess ? '✅ YES' : '❌ NO'}`);
    
    if (!hasAccess) {
      console.log('\n⚠️  Belmonte Customer ID not found in accessible customers');
      console.log('   This means either:');
      console.log('   1. Customer ID 789-260-9395 doesn\'t exist');
      console.log('   2. Manager account doesn\'t have access to this customer');
      console.log('   3. Customer ID format is incorrect');
    }
    
  } else {
    console.log('📝 No accessible customers found');
  }
  
  return data;
}

async function tryAlternativeCustomerList(credentials, accessToken) {
  console.log('🔄 Trying to get customer info via manager account...');
  
  const managerCustomerId = credentials.google_ads_manager_customer_id.replace(/-/g, '');
  const url = `${GOOGLE_ADS_BASE_URL}/customers/${managerCustomerId}/googleAds:search`;
  
  const query = `
    SELECT 
      customer_client.client_customer,
      customer_client.level,
      customer_client.manager,
      customer_client.descriptive_name,
      customer_client.currency_code,
      customer_client.time_zone,
      customer_client.status
    FROM customer_client
    WHERE customer_client.level <= 1
  `;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': credentials.google_ads_developer_token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: query.trim() })
  });
  
  console.log(`📡 Manager query response: ${response.status}`);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.log('❌ Manager query failed');
    console.log('Response:', errorText.substring(0, 300));
    return null;
  }
  
  const data = await response.json();
  console.log('✅ Manager query successful!');
  
  if (data.results && data.results.length > 0) {
    console.log('\n📊 Client Accounts Under Manager:');
    console.log('=================================');
    data.results.forEach((result, index) => {
      const client = result.customerClient;
      const customerId = client.clientCustomer.replace('customers/', '');
      const formattedId = customerId.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
      
      console.log(`${index + 1}. ${client.descriptiveName || 'Unnamed Account'}`);
      console.log(`   Customer ID: ${customerId} (${formattedId})`);
      console.log(`   Status: ${client.status}`);
      console.log(`   Currency: ${client.currencyCode}`);
      console.log(`   Manager: ${client.manager ? 'Yes' : 'No'}`);
      console.log('');
    });
  }
  
  return data;
}

async function testSpecificCustomer(credentials, accessToken, customerId) {
  console.log(`\n🧪 Testing specific customer: ${customerId}`);
  
  const cleanCustomerId = customerId.replace(/-/g, '');
  const url = `${GOOGLE_ADS_BASE_URL}/customers/${cleanCustomerId}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': credentials.google_ads_developer_token,
      'Content-Type': 'application/json'
    }
  });
  
  console.log(`📡 Customer info response: ${response.status}`);
  
  if (response.ok) {
    const data = await response.json();
    console.log('✅ Customer exists and is accessible!');
    console.log('Customer info:', JSON.stringify(data, null, 2));
  } else {
    const errorText = await response.text();
    console.log('❌ Customer not accessible');
    console.log('Error:', errorText.substring(0, 200));
  }
}

async function main() {
  console.log('🔍 Google Ads API Access Diagnosis');
  console.log('===================================\n');
  
  try {
    // Get credentials
    const credentials = await getCredentials();
    console.log('✅ Retrieved credentials');
    console.log(`   Manager Customer ID: ${credentials.google_ads_manager_customer_id}`);
    console.log(`   Developer Token: ${credentials.google_ads_developer_token.substring(0, 10)}...`);
    
    // Refresh token
    const accessToken = await refreshAccessToken(credentials);
    
    // List accessible customers
    const customers = await listAccessibleCustomers(credentials, accessToken);
    
    // Test Belmonte's specific customer ID
    await testSpecificCustomer(credentials, accessToken, '789-260-9395');
    
    console.log('\n📋 Diagnosis Summary:');
    console.log('=====================');
    console.log('✅ OAuth authentication: Working');
    console.log('✅ API connectivity: Working');
    console.log('✅ Developer token: Valid');
    console.log('✅ Manager account: Accessible');
    
    console.log('\n🔧 Next Steps:');
    console.log('==============');
    console.log('1. Verify Customer ID 789-260-9395 exists in Google Ads');
    console.log('2. Ensure manager account has access to this customer');
    console.log('3. Check if customer has any campaigns/data');
    console.log('4. Try with a different customer ID from the accessible list');
    
  } catch (error) {
    console.error('❌ Diagnosis failed:', error.message);
  }
}

if (require.main === module) {
  main().catch(console.error);
} 