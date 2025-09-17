#!/usr/bin/env node

/**
 * Test OAuth Setup with Google Cloud Project
 * Project: cellular-nuance-469408-b3 (1000164558061)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Your Google Cloud Project details
const GOOGLE_CLOUD_PROJECT = {
  project_number: '1000164558061',
  project_id: 'cellular-nuance-469408-b3'
};

async function checkGoogleCloudProject() {
  console.log('🌐 Google Cloud Project Information');
  console.log('===================================');
  console.log(`Project Number: ${GOOGLE_CLOUD_PROJECT.project_number}`);
  console.log(`Project ID: ${GOOGLE_CLOUD_PROJECT.project_id}`);
  console.log('');
  
  // Check if Google Ads API is enabled for this project
  console.log('📋 Steps to verify Google Ads API is enabled:');
  console.log('1. Go to: https://console.cloud.google.com/apis/dashboard');
  console.log(`2. Select project: ${GOOGLE_CLOUD_PROJECT.project_id}`);
  console.log('3. Search for "Google Ads API" and ensure it\'s enabled');
  console.log('');
}

async function generateOAuthCredentials() {
  console.log('🔐 OAuth 2.0 Credentials Setup');
  console.log('==============================');
  console.log('');
  console.log('1. Go to Google Cloud Console:');
  console.log(`   https://console.cloud.google.com/apis/credentials?project=${GOOGLE_CLOUD_PROJECT.project_id}`);
  console.log('');
  console.log('2. Click "Create Credentials" → "OAuth 2.0 Client IDs"');
  console.log('');
  console.log('3. Configure OAuth consent screen (if not done):');
  console.log('   - Application type: External');
  console.log('   - Application name: Your App Name');
  console.log('   - Authorized domains: your-domain.com');
  console.log('');
  console.log('4. Create OAuth 2.0 Client ID:');
  console.log('   - Application type: Web application');
  console.log('   - Name: Google Ads API Client');
  console.log('   - Authorized JavaScript origins:');
  console.log('     * https://your-domain.com');
  console.log('     * https://developers.google.com (for OAuth Playground)');
  console.log('   - Authorized redirect URIs:');
  console.log('     * https://developers.google.com/oauthplayground');
  console.log('     * https://your-domain.com/auth/callback');
  console.log('');
  console.log('5. Copy the Client ID and Client Secret that are generated');
  console.log('');
}

async function generateRefreshToken() {
  console.log('🔑 Generate Refresh Token for Manager Account');
  console.log('=============================================');
  console.log('');
  console.log('1. Go to OAuth 2.0 Playground:');
  console.log('   https://developers.google.com/oauthplayground/');
  console.log('');
  console.log('2. Configure OAuth 2.0 settings (gear icon):');
  console.log('   ✅ Check "Use your own OAuth credentials"');
  console.log('   - OAuth Client ID: [paste your Client ID]');
  console.log('   - OAuth Client secret: [paste your Client Secret]');
  console.log('');
  console.log('3. Select APIs:');
  console.log('   - Search for "Google Ads API"');
  console.log('   - Select: https://www.googleapis.com/auth/adwords');
  console.log('');
  console.log('4. Authorize APIs:');
  console.log('   - Click "Authorize APIs"');
  console.log('   - Sign in with your MANAGER account (293-100-0497)');
  console.log('   - Grant permissions');
  console.log('');
  console.log('5. Exchange authorization code for tokens:');
  console.log('   - Click "Exchange authorization code for tokens"');
  console.log('   - Copy the "Refresh token" value');
  console.log('');
  console.log('⚠️  IMPORTANT: Make sure you authorize with the account that has access to');
  console.log('   Manager Customer ID: 293-100-0497');
  console.log('');
}

async function testWithExampleCredentials() {
  console.log('🧪 Testing OAuth Flow (Simulation)');
  console.log('===================================');
  console.log('');
  
  // Example of what the credentials would look like
  console.log('Expected OAuth credentials format:');
  console.log('');
  console.log('Client ID (example):');
  console.log('1000164558061-abcd1234efgh5678ijkl9012mnop3456.apps.googleusercontent.com');
  console.log('');
  console.log('Client Secret (example):');
  console.log('GOCSPX-abcdefghijklmnopqrstuvwxyz123456');
  console.log('');
  console.log('Refresh Token (example):');
  console.log('1//0GWzw1234567890abcdefghijklmnopqrstuvwxyz...');
  console.log('');
  
  // Test the current system settings
  const { data: settings, error } = await supabase
    .from('system_settings')
    .select('key, value')
    .like('key', 'google_ads_%')
    .order('key');
  
  if (error) {
    console.error('❌ Error fetching settings:', error.message);
    return;
  }
  
  console.log('📊 Current System Settings:');
  console.log('===========================');
  
  const settingsMap = {};
  settings?.forEach(setting => {
    settingsMap[setting.key] = setting.value;
  });
  
  const oauthSettings = [
    'google_ads_client_id',
    'google_ads_client_secret', 
    'google_ads_manager_refresh_token'
  ];
  
  oauthSettings.forEach(key => {
    const isSet = settingsMap[key] && settingsMap[key].length > 0;
    console.log(`${key}: ${isSet ? '✅ SET' : '❌ NOT SET'}`);
  });
  
  const systemSettings = [
    'google_ads_developer_token',
    'google_ads_manager_customer_id',
    'google_ads_enabled'
  ];
  
  console.log('');
  console.log('System settings (already configured):');
  systemSettings.forEach(key => {
    const value = settingsMap[key];
    console.log(`${key}: ${value || 'NOT SET'}`);
  });
}

async function createQuickTestUrl() {
  console.log('🚀 Quick Test URL Generator');
  console.log('===========================');
  console.log('');
  console.log('Once you have OAuth credentials, test with this URL pattern:');
  console.log('');
  
  const testUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=YOUR_CLIENT_ID&` +
    `redirect_uri=https://developers.google.com/oauthplayground&` +
    `scope=https://www.googleapis.com/auth/adwords&` +
    `response_type=code&` +
    `access_type=offline&` +
    `prompt=consent`;
  
  console.log('Test OAuth URL:');
  console.log(testUrl);
  console.log('');
  console.log('Replace YOUR_CLIENT_ID with your actual Client ID');
  console.log('');
}

async function main() {
  console.log('🎯 Google Ads OAuth Testing for Project');
  console.log('========================================');
  console.log(`Project: ${GOOGLE_CLOUD_PROJECT.project_id}`);
  console.log(`Number: ${GOOGLE_CLOUD_PROJECT.project_number}`);
  console.log('');
  
  try {
    await checkGoogleCloudProject();
    await generateOAuthCredentials();
    await generateRefreshToken();
    await testWithExampleCredentials();
    await createQuickTestUrl();
    
    console.log('📝 Summary of Next Steps:');
    console.log('=========================');
    console.log('1. ✅ Project identified: cellular-nuance-469408-b3');
    console.log('2. ❌ Create OAuth 2.0 credentials in this project');
    console.log('3. ❌ Generate refresh token using OAuth Playground');
    console.log('4. ❌ Store credentials in admin settings');
    console.log('5. ❌ Test Google Ads API access');
    console.log('');
    console.log('🎉 Once complete: All 20 clients will have Google Ads access!');
    
  } catch (error) {
    console.error('❌ Error during OAuth testing:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  checkGoogleCloudProject,
  generateOAuthCredentials,
  generateRefreshToken,
  testWithExampleCredentials,
  GOOGLE_CLOUD_PROJECT
}; 