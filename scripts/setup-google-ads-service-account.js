#!/usr/bin/env node

/**
 * Google Ads Service Account Setup Script
 * 
 * This script helps you set up a Google Ads service account for lifelong tokens
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔐 GOOGLE ADS SERVICE ACCOUNT SETUP');
console.log('='.repeat(60));

console.log('\n📋 STEP-BY-STEP SETUP GUIDE:');
console.log('');

console.log('1️⃣ CREATE GOOGLE CLOUD PROJECT:');
console.log('   • Go to: https://console.cloud.google.com/');
console.log('   • Create new project: "piotr-google-ads-service"');
console.log('   • Enable Google Ads API');
console.log('');

console.log('2️⃣ CREATE SERVICE ACCOUNT:');
console.log('   • Go to: IAM & Admin → Service Accounts');
console.log('   • Create service account: "piotr-google-ads-service-account"');
console.log('   • Grant role: "Google Ads API User" or "Editor"');
console.log('');

console.log('3️⃣ GENERATE SERVICE ACCOUNT KEY:');
console.log('   • Click on your service account');
console.log('   • Go to Keys tab → Add Key → Create new key');
console.log('   • Type: JSON');
console.log('   • Download as: piotr-google-ads-service-account.json');
console.log('');

console.log('4️⃣ CONFIGURE GOOGLE ADS API ACCESS:');
console.log('   • Go to: https://ads.google.com/aw/apicenter');
console.log('   • Link your Google Cloud project');
console.log('   • Apply for API access');
console.log('');

console.log('5️⃣ UPDATE DATABASE:');
console.log('   • Run this script with the JSON file path');
console.log('   • Example: node scripts/setup-google-ads-service-account.js /path/to/service-account.json');
console.log('');

// Check if JSON file path provided
const jsonFilePath = process.argv[2];

if (!jsonFilePath) {
  console.log('❌ ERROR: Please provide the path to your service account JSON file');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/setup-google-ads-service-account.js /path/to/service-account.json');
  console.log('');
  console.log('Example:');
  console.log('  node scripts/setup-google-ads-service-account.js ./piotr-google-ads-service-account.json');
  process.exit(1);
}

// Check if file exists
if (!fs.existsSync(jsonFilePath)) {
  console.log(`❌ ERROR: File not found: ${jsonFilePath}`);
  console.log('');
  console.log('Please make sure the service account JSON file exists and the path is correct.');
  process.exit(1);
}

async function setupServiceAccount() {
  try {
    console.log('🔍 Reading service account JSON file...');
    
    // Read and parse the JSON file
    const jsonContent = fs.readFileSync(jsonFilePath, 'utf8');
    const serviceAccountKey = JSON.parse(jsonContent);
    
    // Validate required fields
    const requiredFields = [
      'type', 'project_id', 'private_key_id', 'private_key',
      'client_email', 'client_id', 'auth_uri', 'token_uri'
    ];
    
    const missingFields = requiredFields.filter(field => !serviceAccountKey[field]);
    
    if (missingFields.length > 0) {
      console.log('❌ ERROR: Missing required fields in service account JSON:');
      missingFields.forEach(field => console.log(`   • ${field}`));
      process.exit(1);
    }
    
    console.log('✅ Service account JSON file is valid');
    console.log(`   • Project ID: ${serviceAccountKey.project_id}`);
    console.log(`   • Client Email: ${serviceAccountKey.client_email}`);
    console.log(`   • Type: ${serviceAccountKey.type}`);
    console.log('');
    
    console.log('💾 Storing service account credentials in database...');
    
    // Store service account credentials in system_settings
    const { error: insertError } = await supabase
      .from('system_settings')
      .upsert([
        {
          key: 'google_ads_service_account_key',
          value: JSON.stringify(serviceAccountKey),
          description: 'Google Ads Service Account JSON Key (Lifelong Token)',
          updated_at: new Date().toISOString()
        },
        {
          key: 'google_ads_service_account_email',
          value: serviceAccountKey.client_email,
          description: 'Google Ads Service Account Email',
          updated_at: new Date().toISOString()
        },
        {
          key: 'google_ads_service_account_project_id',
          value: serviceAccountKey.project_id,
          description: 'Google Ads Service Account Project ID',
          updated_at: new Date().toISOString()
        }
      ], {
        onConflict: 'key'
      });
    
    if (insertError) {
      console.log('❌ ERROR: Failed to store service account credentials:', insertError.message);
      process.exit(1);
    }
    
    console.log('✅ Service account credentials stored successfully');
    console.log('');
    
    console.log('🧪 Testing service account authentication...');
    
    // Test the service account
    const { GoogleAdsServiceAccountService } = require('../src/lib/google-ads-service-account');
    const serviceAccountService = new GoogleAdsServiceAccountService(serviceAccountKey);
    
    const testResult = await serviceAccountService.testAuthentication();
    
    if (testResult.success) {
      console.log('✅ Service account authentication test successful!');
      console.log('');
      console.log('🎉 SETUP COMPLETE!');
      console.log('');
      console.log('📊 WHAT YOU GET:');
      console.log('   ✅ Truly lifelong tokens (never expire)');
      console.log('   ✅ No more token refresh issues');
      console.log('   ✅ More reliable authentication');
      console.log('   ✅ Higher API rate limits');
      console.log('   ✅ Production-ready security');
      console.log('');
      console.log('🚀 NEXT STEPS:');
      console.log('   1. Update your Google Ads API service to use service account');
      console.log('   2. Remove OAuth refresh token system');
      console.log('   3. Test with live data collection');
      console.log('   4. Monitor for 24-48 hours');
      console.log('');
      console.log('⚠️  IMPORTANT:');
      console.log('   • Keep the JSON file secure');
      console.log('   • Never commit it to git');
      console.log('   • Consider using environment variables in production');
    } else {
      console.log('❌ Service account authentication test failed:', testResult.error);
      console.log('');
      console.log('🔧 TROUBLESHOOTING:');
      console.log('   1. Make sure Google Ads API is enabled in your project');
      console.log('   2. Verify the service account has proper permissions');
      console.log('   3. Check if Google Ads API access is approved');
      console.log('   4. Ensure the developer token is valid');
    }
    
  } catch (error) {
    console.log('❌ ERROR:', error.message);
    console.log('');
    console.log('🔧 TROUBLESHOOTING:');
    console.log('   1. Check if the JSON file is valid');
    console.log('   2. Verify all required fields are present');
    console.log('   3. Make sure you have database access');
    console.log('   4. Check your environment variables');
  }
}

// Run the setup
setupServiceAccount();
