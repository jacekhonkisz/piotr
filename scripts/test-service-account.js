#!/usr/bin/env node

/**
 * Test Google Ads Service Account Setup
 * 
 * This script tests the service account authentication
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🧪 TESTING GOOGLE ADS SERVICE ACCOUNT');
console.log('='.repeat(60));

async function testServiceAccount() {
  try {
    console.log('🔍 Checking service account configuration...');
    
    // Get service account settings
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'google_ads_service_account_key',
        'google_ads_service_account_email',
        'google_ads_service_account_project_id',
        'google_ads_developer_token'
      ]);
    
    if (error) {
      console.log('❌ ERROR: Failed to fetch settings:', error.message);
      return;
    }
    
    const settingsMap = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});
    
    console.log('📊 SERVICE ACCOUNT STATUS:');
    console.log('');
    
    // Check service account key
    if (settingsMap.google_ads_service_account_key && settingsMap.google_ads_service_account_key !== '') {
      console.log('✅ Service Account Key: Configured');
      try {
        const serviceAccountKey = JSON.parse(settingsMap.google_ads_service_account_key);
        console.log(`   • Project ID: ${serviceAccountKey.project_id}`);
        console.log(`   • Client Email: ${serviceAccountKey.client_email}`);
        console.log(`   • Type: ${serviceAccountKey.type}`);
      } catch (e) {
        console.log('   • ⚠️  Invalid JSON format');
      }
    } else {
      console.log('❌ Service Account Key: Not configured');
    }
    
    // Check service account email
    if (settingsMap.google_ads_service_account_email && settingsMap.google_ads_service_account_email !== '') {
      console.log('✅ Service Account Email: Configured');
      console.log(`   • Email: ${settingsMap.google_ads_service_account_email}`);
    } else {
      console.log('❌ Service Account Email: Not configured');
    }
    
    // Check project ID
    if (settingsMap.google_ads_service_account_project_id && settingsMap.google_ads_service_account_project_id !== '') {
      console.log('✅ Project ID: Configured');
      console.log(`   • Project: ${settingsMap.google_ads_service_account_project_id}`);
    } else {
      console.log('❌ Project ID: Not configured');
    }
    
    // Check developer token
    if (settingsMap.google_ads_developer_token && settingsMap.google_ads_developer_token !== '') {
      console.log('✅ Developer Token: Configured');
      console.log(`   • Token: ${settingsMap.google_ads_developer_token.substring(0, 10)}...`);
    } else {
      console.log('❌ Developer Token: Not configured');
    }
    
    console.log('');
    
    // Test service account authentication if configured
    if (settingsMap.google_ads_service_account_key && settingsMap.google_ads_service_account_key !== '') {
      console.log('🧪 Testing service account authentication...');
      
      try {
        const { GoogleAdsServiceAccountService } = require('../src/lib/google-ads-service-account');
        const serviceAccountKey = JSON.parse(settingsMap.google_ads_service_account_key);
        const serviceAccountService = new GoogleAdsServiceAccountService(serviceAccountKey);
        
        const testResult = await serviceAccountService.testAuthentication();
        
        if (testResult.success) {
          console.log('✅ Service account authentication: SUCCESS');
          console.log('');
          console.log('🎉 SERVICE ACCOUNT IS WORKING!');
          console.log('');
          console.log('📊 BENEFITS:');
          console.log('   ✅ Truly lifelong tokens (never expire)');
          console.log('   ✅ No more token refresh issues');
          console.log('   ✅ More reliable authentication');
          console.log('   ✅ Higher API rate limits');
          console.log('   ✅ Production-ready security');
        } else {
          console.log('❌ Service account authentication: FAILED');
          console.log(`   • Error: ${testResult.error}`);
          console.log('');
          console.log('🔧 TROUBLESHOOTING:');
          console.log('   1. Check if Google Ads API is enabled in your project');
          console.log('   2. Verify the service account has proper permissions');
          console.log('   3. Check if Google Ads API access is approved');
          console.log('   4. Ensure the developer token is valid');
        }
      } catch (error) {
        console.log('❌ Service account test error:', error.message);
        console.log('');
        console.log('🔧 TROUBLESHOOTING:');
        console.log('   1. Make sure the service account JSON is valid');
        console.log('   2. Check if all required fields are present');
        console.log('   3. Verify the service account has Google Ads API access');
      }
    } else {
      console.log('⚠️  Service account not configured - run setup script first');
      console.log('');
      console.log('🚀 TO SET UP SERVICE ACCOUNT:');
      console.log('   1. Create Google Cloud project');
      console.log('   2. Create service account');
      console.log('   3. Download JSON key file');
      console.log('   4. Run: node scripts/setup-google-ads-service-account.js /path/to/key.json');
    }
    
  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }
}

// Run the test
testServiceAccount();
