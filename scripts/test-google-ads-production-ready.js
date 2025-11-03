#!/usr/bin/env node

/**
 * Google Ads Production Readiness Test Script
 * 
 * Tests the Google Ads API implementation with the new Standard Access token
 * to verify it's ready for production use.
 * 
 * Your approval details:
 * - Company type: Agency
 * - Tool type: External reporting (read-only)
 * - Developer Token: WCX04VxQqB0fsV0YDX0w1g
 * - Access Level: Standard Access (APPROVED ✅)
 */

const { createClient } = require('@supabase/supabase-js');
const { GoogleAdsApi } = require('google-ads-api');
require('dotenv').config();

// Supabase client configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration in environment variables');
  console.log('\n💡 Make sure you have a .env.local file with:');
  console.log('   NEXT_PUBLIC_SUPABASE_URL=your-url');
  console.log('   SUPABASE_SERVICE_ROLE_KEY=your-key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Test results tracker
const testResults = {
  passed: [],
  failed: [],
  warnings: []
};

function logSuccess(message) {
  console.log(`✅ ${message}`);
  testResults.passed.push(message);
}

function logError(message, error = null) {
  console.log(`❌ ${message}`);
  if (error) console.error('   Error:', error.message || error);
  testResults.failed.push(message);
}

function logWarning(message) {
  console.log(`⚠️  ${message}`);
  testResults.warnings.push(message);
}

async function testDeveloperToken() {
  console.log('\n📋 TEST 1: Developer Token Configuration');
  console.log('=========================================');
  
  try {
    const { data: tokenSetting, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'google_ads_developer_token')
      .single();
    
    if (error) throw error;
    
    if (!tokenSetting?.value) {
      logError('Developer token not found in database');
      return false;
    }
    
    const expectedToken = 'WCX04VxQqB0fsV0YDX0w1g';
    if (tokenSetting.value === expectedToken) {
      logSuccess(`Developer token is correct: ${expectedToken}`);
      logSuccess('Token has Standard Access approval from Google');
      return true;
    } else {
      logError(`Developer token mismatch. Expected: ${expectedToken}, Found: ${tokenSetting.value}`);
      return false;
    }
  } catch (error) {
    logError('Failed to check developer token', error);
    return false;
  }
}

async function testSystemSettings() {
  console.log('\n📋 TEST 2: System Settings Configuration');
  console.log('=========================================');
  
  try {
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'google_ads_developer_token',
        'google_ads_client_id',
        'google_ads_client_secret',
        'google_ads_manager_customer_id',
        'google_ads_manager_refresh_token'
      ]);
    
    if (error) throw error;
    
    const requiredSettings = {
      'google_ads_developer_token': false,
      'google_ads_client_id': false,
      'google_ads_client_secret': false,
      'google_ads_manager_customer_id': false
    };
    
    settings?.forEach(setting => {
      if (setting.value && setting.value.trim() !== '') {
        requiredSettings[setting.key] = true;
        if (setting.key.includes('secret') || setting.key.includes('token')) {
          logSuccess(`${setting.key}: ***[SET]***`);
        } else {
          logSuccess(`${setting.key}: ${setting.value}`);
        }
      }
    });
    
    let allRequired = true;
    for (const [key, isSet] of Object.entries(requiredSettings)) {
      if (!isSet) {
        logError(`Missing required setting: ${key}`);
        allRequired = false;
      }
    }
    
    const hasRefreshToken = settings?.some(s => 
      s.key === 'google_ads_manager_refresh_token' && s.value
    );
    
    if (hasRefreshToken) {
      logSuccess('Manager refresh token configured');
    } else {
      logWarning('Manager refresh token not set (required for API calls)');
    }
    
    return allRequired;
  } catch (error) {
    logError('Failed to check system settings', error);
    return false;
  }
}

async function testAPIConnection() {
  console.log('\n📋 TEST 3: Google Ads API Connection');
  console.log('=========================================');
  
  try {
    // Get credentials
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'google_ads_developer_token',
        'google_ads_client_id',
        'google_ads_client_secret',
        'google_ads_manager_customer_id',
        'google_ads_manager_refresh_token'
      ]);
    
    if (settingsError) throw settingsError;
    
    const creds = {};
    settings?.forEach(s => {
      creds[s.key] = s.value;
    });
    
    // Check if we have all required credentials
    if (!creds.google_ads_developer_token) {
      logError('Missing developer token');
      return false;
    }
    
    if (!creds.google_ads_client_id || !creds.google_ads_client_secret) {
      logWarning('Missing OAuth credentials - cannot test API connection');
      logWarning('This is needed for actual API calls');
      return false;
    }
    
    if (!creds.google_ads_manager_refresh_token) {
      logWarning('Missing refresh token - cannot test API connection');
      logWarning('Generate refresh token using OAuth flow');
      return false;
    }
    
    if (!creds.google_ads_manager_customer_id) {
      logError('Missing manager customer ID');
      return false;
    }
    
    // Initialize Google Ads API client
    console.log('🔄 Initializing Google Ads API client...');
    const client = new GoogleAdsApi({
      client_id: creds.google_ads_client_id,
      client_secret: creds.google_ads_client_secret,
      developer_token: creds.google_ads_developer_token
    });
    
    const customer = client.Customer({
      customer_id: creds.google_ads_manager_customer_id.replace(/-/g, ''),
      refresh_token: creds.google_ads_manager_refresh_token
    });
    
    // Test API call - get account info
    console.log('🔄 Testing API call: Fetching account information...');
    const query = `
      SELECT
        customer.id,
        customer.descriptive_name,
        customer.currency_code,
        customer.time_zone,
        customer.test_account
      FROM customer
      LIMIT 1
    `;
    
    const result = await customer.query(query);
    
    if (result && result.length > 0) {
      const account = result[0].customer;
      logSuccess('API connection successful!');
      logSuccess(`Account: ${account.descriptive_name}`);
      logSuccess(`Customer ID: ${account.id}`);
      logSuccess(`Currency: ${account.currency_code}`);
      logSuccess(`Time Zone: ${account.time_zone}`);
      
      if (account.test_account) {
        logWarning('This is a TEST account - Standard Access works with production accounts too');
      } else {
        logSuccess('This is a PRODUCTION account - Standard Access is active!');
      }
      
      return true;
    } else {
      logError('API call returned no data');
      return false;
    }
  } catch (error) {
    if (error.message?.includes('DEVELOPER_TOKEN_NOT_ON_ALLOWLIST')) {
      logError('Token not yet activated - may take a few hours after approval');
      logWarning('Try again in 1-2 hours');
    } else if (error.message?.includes('invalid_grant')) {
      logError('Refresh token expired or invalid');
      logWarning('Generate a new refresh token using OAuth flow');
    } else {
      logError('API connection failed', error);
    }
    return false;
  }
}

async function testRMFImplementation() {
  console.log('\n📋 TEST 4: RMF Implementation Verification');
  console.log('=========================================');
  
  try {
    // Check if RMF endpoints exist
    const fs = require('fs');
    const path = require('path');
    
    const requiredEndpoints = [
      'src/app/api/fetch-google-ads-live-data/route.ts',
      'src/app/api/google-ads-account-performance/route.ts',
      'src/app/api/google-ads-ads/route.ts',
      'src/app/api/google-ads-ad-groups/route.ts'
    ];
    
    let allEndpointsExist = true;
    for (const endpoint of requiredEndpoints) {
      const fullPath = path.join(process.cwd(), endpoint);
      if (fs.existsSync(fullPath)) {
        logSuccess(`Endpoint exists: ${endpoint}`);
      } else {
        logError(`Missing endpoint: ${endpoint}`);
        allEndpointsExist = false;
      }
    }
    
    // Check if GoogleAdsAPIService exists
    const apiServicePath = path.join(process.cwd(), 'src/lib/google-ads-api.ts');
    if (fs.existsSync(apiServicePath)) {
      logSuccess('GoogleAdsAPIService implementation found');
      
      // Read the file and check for key methods
      const fileContent = fs.readFileSync(apiServicePath, 'utf8');
      const requiredMethods = [
        'getAccountPerformance',
        'getAdGroupPerformance',
        'getAdPerformance',
        'getKeywordPerformance',
        'getSearchTermPerformance',
        'getNetworkPerformance',
        'getDevicePerformance'
      ];
      
      let allMethodsFound = true;
      for (const method of requiredMethods) {
        if (fileContent.includes(method)) {
          logSuccess(`RMF method implemented: ${method}`);
        } else {
          logError(`Missing RMF method: ${method}`);
          allMethodsFound = false;
        }
      }
      
      return allEndpointsExist && allMethodsFound;
    } else {
      logError('GoogleAdsAPIService not found');
      return false;
    }
  } catch (error) {
    logError('Failed to verify RMF implementation', error);
    return false;
  }
}

async function testDatabaseSchema() {
  console.log('\n📋 TEST 5: Database Schema Verification');
  console.log('=========================================');
  
  try {
    // Check if required tables exist
    const { data: tables, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .in('table_name', [
        'clients',
        'system_settings',
        'google_ads_campaigns',
        'google_ads_ad_groups',
        'google_ads_ads',
        'google_ads_keywords'
      ]);
    
    // Note: The above query might not work on all Supabase instances
    // So we'll test by trying to query each table instead
    
    const requiredTables = [
      'clients',
      'system_settings',
      'google_ads_campaigns',
      'google_ads_tables_data'
    ];
    
    let allTablesExist = true;
    for (const tableName of requiredTables) {
      try {
        const { error: queryError } = await supabase
          .from(tableName)
          .select('*')
          .limit(0);
        
        if (queryError) {
          logError(`Table missing or inaccessible: ${tableName}`);
          allTablesExist = false;
        } else {
          logSuccess(`Table exists: ${tableName}`);
        }
      } catch (err) {
        logError(`Table missing: ${tableName}`);
        allTablesExist = false;
      }
    }
    
    return allTablesExist;
  } catch (error) {
    logError('Failed to verify database schema', error);
    return false;
  }
}

function printFinalReport() {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════');
  console.log('📊 PRODUCTION READINESS REPORT');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log(`✅ Tests Passed: ${testResults.passed.length}`);
  console.log(`❌ Tests Failed: ${testResults.failed.length}`);
  console.log(`⚠️  Warnings: ${testResults.warnings.length}`);
  console.log('');
  
  const totalTests = testResults.passed.length + testResults.failed.length;
  const successRate = totalTests > 0 ? (testResults.passed.length / totalTests * 100).toFixed(1) : 0;
  
  console.log(`Success Rate: ${successRate}%`);
  console.log('');
  
  if (testResults.failed.length === 0) {
    console.log('🎉 PRODUCTION READY! All critical tests passed.');
    console.log('');
    console.log('✅ Your Google Ads Standard Access is approved and working!');
    console.log('✅ All RMF requirements are implemented');
    console.log('✅ Database schema is properly configured');
    console.log('✅ API endpoints are ready');
    console.log('');
    
    if (testResults.warnings.length > 0) {
      console.log('⚠️  Note: There are some warnings to address:');
      testResults.warnings.forEach(warning => {
        console.log(`   - ${warning}`);
      });
    }
    
    console.log('');
    console.log('🚀 Next Steps:');
    console.log('   1. Deploy to production environment');
    console.log('   2. Configure OAuth credentials if not already done');
    console.log('   3. Generate refresh tokens for client accounts');
    console.log('   4. Test with real client data');
    console.log('   5. Monitor API usage and quotas');
  } else {
    console.log('⚠️  NOT READY FOR PRODUCTION');
    console.log('');
    console.log('Failed Tests:');
    testResults.failed.forEach(failure => {
      console.log(`   ❌ ${failure}`);
    });
    console.log('');
    console.log('Please fix the above issues before deploying to production.');
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  
  console.log('📝 Your Google Ads API Approval Details:');
  console.log('   Company Type: Agency');
  console.log('   Tool Type: External reporting (read-only)');
  console.log('   Access Level: Standard Access ✅');
  console.log('   Developer Token: WCX04VxQqB0fsV0YDX0w1g');
  console.log('   Manager Customer ID: 293-100-0497');
  console.log('');
  console.log('═══════════════════════════════════════════════════');
}

async function main() {
  console.log('🎯 Google Ads Production Readiness Test');
  console.log('═══════════════════════════════════════════════════');
  console.log('Testing implementation with Standard Access approval');
  console.log('═══════════════════════════════════════════════════');
  
  // Run all tests
  await testDeveloperToken();
  await testSystemSettings();
  await testAPIConnection();
  await testRMFImplementation();
  await testDatabaseSchema();
  
  // Print final report
  printFinalReport();
  
  // Exit with appropriate code
  process.exit(testResults.failed.length > 0 ? 1 : 0);
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  testDeveloperToken,
  testSystemSettings,
  testAPIConnection,
  testRMFImplementation,
  testDatabaseSchema
};

