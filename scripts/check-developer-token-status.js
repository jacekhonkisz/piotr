#!/usr/bin/env node

/**
 * Check Developer Token Status and Google Ads API Requirements
 * The issue is that ALL endpoints return 404, which suggests either:
 * 1. Developer token needs approval
 * 2. API is not properly enabled with correct permissions
 * 3. Wrong API endpoint format
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
    throw new Error(`Token refresh failed: ${response.status}`);
  }
  
  const tokenData = await response.json();
  return tokenData.access_token;
}

async function checkDeveloperTokenStatus() {
  console.log('🔍 CHECKING DEVELOPER TOKEN STATUS');
  console.log('==================================');
  console.log('');
  console.log('📋 Common Issues with Google Ads API 404 Errors:');
  console.log('');
  console.log('1. 🔑 DEVELOPER TOKEN NOT APPROVED');
  console.log('   - New developer tokens need Google approval');
  console.log('   - Can take 24-48 hours for approval');
  console.log('   - Check status at: https://ads.google.com/aw/overview');
  console.log('');
  console.log('2. 🔐 INSUFFICIENT API PERMISSIONS');
  console.log('   - Manager account needs API access enabled');
  console.log('   - Check Google Ads account settings');
  console.log('');
  console.log('3. 🌐 WRONG API ENDPOINT');
  console.log('   - Google Ads API uses different base URL than other Google APIs');
  console.log('   - Requires specific authentication flow');
  console.log('');
  console.log('4. 📍 REGIONAL API RESTRICTIONS');
  console.log('   - Some regions have different endpoints');
  console.log('   - API might not be available in all regions');
}

async function testWithCorrectGoogleAdsFormat(credentials, accessToken) {
  console.log('\n🧪 TESTING CORRECT GOOGLE ADS API FORMAT');
  console.log('=========================================');
  
  // The Google Ads API requires very specific format
  const testEndpoints = [
    {
      name: 'List Accessible Customers (Correct Format)',
      url: 'https://googleads.googleapis.com/v14/customers:listAccessibleCustomers',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': credentials.google_ads_developer_token,
        'Content-Type': 'application/json',
        'login-customer-id': credentials.google_ads_manager_customer_id.replace(/-/g, '')
      }
    },
    {
      name: 'List Accessible Customers (with login-customer-id)',
      url: 'https://googleads.googleapis.com/v14/customers:listAccessibleCustomers',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': credentials.google_ads_developer_token,
        'Content-Type': 'application/json',
        'login-customer-id': credentials.google_ads_manager_customer_id.replace(/-/g, '')
      }
    },
    {
      name: 'Minimal Test (v13)',
      url: 'https://googleads.googleapis.com/v13/customers:listAccessibleCustomers',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': credentials.google_ads_developer_token
      }
    }
  ];
  
  for (const test of testEndpoints) {
    console.log(`\n🔍 Testing: ${test.name}`);
    console.log(`   URL: ${test.url}`);
    console.log(`   Headers: ${Object.keys(test.headers).join(', ')}`);
    
    try {
      const response = await fetch(test.url, {
        method: test.method,
        headers: test.headers
      });
      
      console.log(`   📡 Status: ${response.status}`);
      
      if (response.status === 200) {
        const data = await response.json();
        console.log('   ✅ SUCCESS! API is working!');
        
        if (data.resourceNames) {
          console.log(`   📊 Found ${data.resourceNames.length} accessible customers:`);
          data.resourceNames.forEach(name => {
            const id = name.replace('customers/', '');
            const formatted = id.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
            console.log(`      - ${id} (${formatted})`);
          });
          return { success: true, data, workingFormat: test };
        }
      } else if (response.status === 400) {
        const errorData = await response.json();
        console.log('   ⚠️  400 Bad Request (API accessible but request invalid)');
        console.log(`   Error: ${JSON.stringify(errorData, null, 2)}`);
        return { success: false, apiAccessible: true, error: errorData };
      } else if (response.status === 401) {
        console.log('   ⚠️  401 Unauthorized (API accessible but auth issue)');
        return { success: false, apiAccessible: true, error: 'Unauthorized' };
      } else if (response.status === 403) {
        const errorData = await response.json();
        console.log('   ⚠️  403 Forbidden (API accessible but permission issue)');
        console.log(`   Error: ${JSON.stringify(errorData, null, 2)}`);
        return { success: false, apiAccessible: true, error: errorData };
      } else if (response.status === 404) {
        console.log('   ❌ 404 Not Found (API endpoint not found)');
      } else {
        const errorText = await response.text();
        console.log(`   ❌ ${response.status}: ${errorText.substring(0, 200)}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Network Error: ${error.message}`);
    }
  }
  
  return { success: false, apiAccessible: false };
}

async function checkGoogleAdsAccountSettings() {
  console.log('\n⚙️  GOOGLE ADS ACCOUNT SETTINGS CHECK');
  console.log('====================================');
  console.log('');
  console.log('🔍 Please verify these settings in your Google Ads account:');
  console.log('');
  console.log('1. 📱 Go to Google Ads: https://ads.google.com/aw/overview');
  console.log('2. 🔧 Click "Tools and Settings" (wrench icon)');
  console.log('3. 🔑 Go to "Setup" > "API Center"');
  console.log('4. 📊 Check your Developer Token status');
  console.log('');
  console.log('📋 Developer Token Status should be:');
  console.log('   ✅ "Approved" - Ready to use');
  console.log('   ⏳ "Under review" - Wait for approval');
  console.log('   ❌ "Disapproved" - Need to request again');
  console.log('');
  console.log('🎯 Manager Account Requirements:');
  console.log('   - Manager Customer ID: 293-100-0497');
  console.log('   - Must have at least $100 in lifetime spend OR');
  console.log('   - Must be linked to client accounts with spend');
  console.log('   - API access must be enabled');
}

async function provideNextSteps(testResult) {
  console.log('\n🎯 DIAGNOSIS & NEXT STEPS');
  console.log('=========================');
  
  if (testResult.success) {
    console.log('✅ SUCCESS: Google Ads API is working!');
    console.log('   Your integration is complete and ready to use.');
    return;
  }
  
  if (testResult.apiAccessible) {
    console.log('⚠️  PARTIAL SUCCESS: API is accessible but has auth/permission issues');
    console.log('');
    console.log('🔧 Likely solutions:');
    console.log('1. Check developer token approval status');
    console.log('2. Verify manager account has API access');
    console.log('3. Ensure customer IDs are correct');
    console.log('4. Check account spending requirements');
  } else {
    console.log('❌ ISSUE: Google Ads API endpoints not accessible');
    console.log('');
    console.log('🔧 Most likely causes:');
    console.log('');
    console.log('1. 🔑 DEVELOPER TOKEN NOT APPROVED');
    console.log('   Solution: Wait for Google approval (24-48 hours)');
    console.log('   Check: https://ads.google.com/aw/overview > Tools > API Center');
    console.log('');
    console.log('2. 🌍 GOOGLE ADS API NOT ENABLED');
    console.log('   Solution: Enable in Google Cloud Console');
    console.log('   Link: https://console.cloud.google.com/apis/library/googleads.googleapis.com?project=cellular-nuance-469408-b3');
    console.log('');
    console.log('3. 💰 ACCOUNT SPENDING REQUIREMENTS');
    console.log('   Solution: Manager account needs $100+ lifetime spend');
    console.log('   Alternative: Link to client accounts with sufficient spend');
    console.log('');
    console.log('4. 🔐 API ACCESS NOT ENABLED');
    console.log('   Solution: Enable API access in Google Ads account settings');
  }
  
  console.log('\n📞 IMMEDIATE ACTION:');
  console.log('==================');
  console.log('1. Check developer token status in Google Ads');
  console.log('2. Verify Google Ads API is enabled in Cloud Console');
  console.log('3. Ensure manager account meets spending requirements');
  console.log('4. Wait 24-48 hours if token is under review');
}

async function main() {
  console.log('🔍 DEVELOPER TOKEN & API STATUS CHECK');
  console.log('=====================================\n');
  
  try {
    const credentials = await getCredentials();
    
    console.log('📋 Current Setup:');
    console.log(`   Developer Token: ${credentials.google_ads_developer_token}`);
    console.log(`   Manager Customer ID: ${credentials.google_ads_manager_customer_id}`);
    console.log(`   Google Cloud Project: cellular-nuance-469408-b3`);
    
    await checkDeveloperTokenStatus();
    
    const accessToken = await refreshAccessToken(credentials);
    console.log('\n✅ OAuth token refresh: SUCCESS');
    
    const testResult = await testWithCorrectGoogleAdsFormat(credentials, accessToken);
    
    await checkGoogleAdsAccountSettings();
    
    await provideNextSteps(testResult);
    
  } catch (error) {
    console.error('\n❌ Check failed:', error.message);
  }
}

if (require.main === module) {
  main().catch(console.error);
} 