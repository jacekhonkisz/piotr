#!/usr/bin/env node

/**
 * Test Google Ads API Versions and Setup
 * Check if API is enabled and find the correct version
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Test different API versions
const API_VERSIONS = ['v14', 'v13', 'v12', 'v15'];

async function getCredentials() {
  const { data: settings, error } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', [
      'google_ads_developer_token',
      'google_ads_client_id', 
      'google_ads_client_secret',
      'google_ads_manager_refresh_token'
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

async function testAPIVersion(version, credentials, accessToken) {
  console.log(`\n🧪 Testing Google Ads API ${version}...`);
  
  const baseUrl = `https://googleads.googleapis.com/${version}`;
  const url = `${baseUrl}/customers:listAccessibleCustomers`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': credentials.google_ads_developer_token,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`   Status: ${response.status}`);
    
    if (response.status === 200) {
      const data = await response.json();
      console.log(`   ✅ API ${version} is working!`);
      
      if (data.resourceNames && data.resourceNames.length > 0) {
        console.log(`   📊 Found ${data.resourceNames.length} accessible customers:`);
        data.resourceNames.forEach((resourceName, index) => {
          const customerId = resourceName.replace('customers/', '');
          const formattedId = customerId.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
          console.log(`      ${index + 1}. ${customerId} (${formattedId})`);
        });
      } else {
        console.log('   📝 No customers found (but API is working)');
      }
      
      return { version, working: true, data };
    } else if (response.status === 404) {
      console.log(`   ❌ API ${version} not found (404)`);
      return { version, working: false, error: '404 Not Found' };
    } else if (response.status === 403) {
      console.log(`   ⚠️  API ${version} forbidden (403) - may need permissions`);
      const errorText = await response.text();
      return { version, working: false, error: `403 Forbidden: ${errorText.substring(0, 200)}` };
    } else {
      const errorText = await response.text();
      console.log(`   ⚠️  API ${version} returned ${response.status}`);
      return { version, working: false, error: `${response.status}: ${errorText.substring(0, 200)}` };
    }
    
  } catch (error) {
    console.log(`   ❌ API ${version} error: ${error.message}`);
    return { version, working: false, error: error.message };
  }
}

async function checkGoogleCloudProject() {
  console.log('\n🔍 Google Cloud Project Check');
  console.log('=============================');
  console.log('Your project: cellular-nuance-469408-b3');
  console.log('Project number: 1000164558061');
  console.log('');
  console.log('📋 Required APIs to enable:');
  console.log('1. Google Ads API');
  console.log('2. Google OAuth2 API');
  console.log('');
  console.log('🔗 Enable APIs here:');
  console.log('https://console.cloud.google.com/apis/library?project=cellular-nuance-469408-b3');
  console.log('');
  console.log('🔍 Specifically enable Google Ads API:');
  console.log('https://console.cloud.google.com/apis/library/googleads.googleapis.com?project=cellular-nuance-469408-b3');
}

async function testBasicConnectivity() {
  console.log('\n🌐 Testing Basic Connectivity');
  console.log('=============================');
  
  const testUrls = [
    'https://googleads.googleapis.com',
    'https://oauth2.googleapis.com/token',
    'https://www.googleapis.com'
  ];
  
  for (const url of testUrls) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      console.log(`${url}: ${response.status === 200 ? '✅' : '⚠️'} ${response.status}`);
    } catch (error) {
      console.log(`${url}: ❌ ${error.message}`);
    }
  }
}

async function main() {
  console.log('🔍 Google Ads API Version & Setup Test');
  console.log('======================================\n');
  
  try {
    // Get credentials
    const credentials = await getCredentials();
    console.log('✅ Retrieved credentials');
    
    // Test basic connectivity
    await testBasicConnectivity();
    
    // Refresh token
    const accessToken = await refreshAccessToken(credentials);
    
    // Test different API versions
    console.log('\n🧪 Testing API Versions');
    console.log('=======================');
    
    const results = [];
    for (const version of API_VERSIONS) {
      const result = await testAPIVersion(version, credentials, accessToken);
      results.push(result);
    }
    
    // Summary
    console.log('\n📊 API Version Test Results');
    console.log('===========================');
    
    const workingVersions = results.filter(r => r.working);
    const failedVersions = results.filter(r => !r.working);
    
    if (workingVersions.length > 0) {
      console.log('✅ Working versions:');
      workingVersions.forEach(r => {
        console.log(`   - ${r.version}: ✅ SUCCESS`);
      });
    } else {
      console.log('❌ No working API versions found');
    }
    
    if (failedVersions.length > 0) {
      console.log('\n❌ Failed versions:');
      failedVersions.forEach(r => {
        console.log(`   - ${r.version}: ${r.error}`);
      });
    }
    
    // Check Google Cloud project
    await checkGoogleCloudProject();
    
    console.log('\n🎯 Diagnosis');
    console.log('============');
    
    if (workingVersions.length === 0) {
      console.log('❌ Issue: Google Ads API is not accessible');
      console.log('');
      console.log('🔧 Solution:');
      console.log('1. Enable Google Ads API in your Google Cloud project');
      console.log('2. Go to: https://console.cloud.google.com/apis/library/googleads.googleapis.com?project=cellular-nuance-469408-b3');
      console.log('3. Click "Enable"');
      console.log('4. Wait a few minutes for propagation');
      console.log('5. Re-run this test');
    } else {
      console.log('✅ Google Ads API is working!');
      console.log(`   Recommended version: ${workingVersions[0].version}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

if (require.main === module) {
  main().catch(console.error);
} 