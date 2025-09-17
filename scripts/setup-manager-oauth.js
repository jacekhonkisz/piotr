#!/usr/bin/env node

/**
 * Setup Manager OAuth Refresh Token for Google Ads
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupManagerOAuth() {
  console.log('🔐 Setting up Manager OAuth for Google Ads');
  console.log('===========================================\n');
  
  console.log('📝 Steps to complete OAuth setup:');
  console.log('');
  console.log('1. 🌐 Go to Google Cloud Console: https://console.cloud.google.com');
  console.log('2. 📋 Create OAuth 2.0 Credentials:');
  console.log('   - APIs & Services → Credentials');
  console.log('   - Create Credentials → OAuth 2.0 Client ID');
  console.log('   - Application type: Web application');
  console.log('   - Add authorized redirect URIs');
  console.log('');
  console.log('3. 🔑 Generate Refresh Token:');
  console.log('   - Use Google OAuth 2.0 Playground: https://developers.google.com/oauthplayground/');
  console.log('   - Select "Google Ads API v14"');
  console.log('   - Authorize with your MANAGER account (293-100-0497)');
  console.log('   - Get the refresh token');
  console.log('');
  console.log('4. 💾 Store credentials in system settings');
  console.log('');
  
  // Check current OAuth settings
  const { data: settings, error } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['google_ads_client_id', 'google_ads_client_secret', 'google_ads_manager_refresh_token'])
    .order('key');
  
  if (error) {
    console.error('❌ Error fetching settings:', error.message);
    return;
  }
  
  console.log('📊 Current OAuth Settings:');
  console.log('===========================');
  
  const settingsMap = {};
  settings?.forEach(setting => {
    settingsMap[setting.key] = setting.value;
  });
  
  console.log(`Client ID: ${settingsMap.google_ads_client_id ? '✅ SET' : '❌ NOT SET'}`);
  console.log(`Client Secret: ${settingsMap.google_ads_client_secret ? '✅ SET' : '❌ NOT SET'}`);
  console.log(`Manager Refresh Token: ${settingsMap.google_ads_manager_refresh_token ? '✅ SET' : '❌ NOT SET'}`);
  
  if (!settingsMap.google_ads_manager_refresh_token) {
    // Add the manager refresh token setting
    const { error: insertError } = await supabase
      .from('system_settings')
      .upsert({
        key: 'google_ads_manager_refresh_token',
        value: '',
        description: 'Manager account refresh token for accessing all client Google Ads accounts'
      }, { onConflict: 'key' });
    
    if (insertError) {
      console.log('⚠️  Error creating manager refresh token setting:', insertError.message);
    } else {
      console.log('✅ Created manager refresh token setting');
    }
  }
  
  const missingCount = ['google_ads_client_id', 'google_ads_client_secret', 'google_ads_manager_refresh_token']
    .filter(key => !settingsMap[key]).length;
  
  console.log('');
  if (missingCount === 0) {
    console.log('🎉 All OAuth credentials configured!');
    console.log('✅ Ready to access Google Ads API for all clients');
  } else {
    console.log(`⚠️  ${missingCount} OAuth credentials missing`);
    console.log('📝 Complete the steps above to finish setup');
  }
  
  console.log('');
  console.log('🚀 Once OAuth is complete:');
  console.log('1. All 20 clients can use the same manager token');
  console.log('2. No need for individual refresh tokens per client');
  console.log('3. Manager account accesses all client data');
  console.log('4. Simple and efficient for bulk operations');
}

async function testManagerAccess() {
  console.log('🧪 Testing Manager Account Access');
  console.log('=================================\n');
  
  try {
    // Get OAuth settings
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['google_ads_client_id', 'google_ads_client_secret', 'google_ads_manager_refresh_token', 'google_ads_developer_token'])
      .order('key');
    
    if (error) {
      console.error('❌ Error fetching settings:', error.message);
      return;
    }
    
    const settingsMap = {};
    settings?.forEach(setting => {
      settingsMap[setting.key] = setting.value;
    });
    
    const required = ['google_ads_client_id', 'google_ads_client_secret', 'google_ads_manager_refresh_token', 'google_ads_developer_token'];
    const missing = required.filter(key => !settingsMap[key]);
    
    if (missing.length > 0) {
      console.log('❌ Missing OAuth credentials:');
      missing.forEach(key => console.log(`   - ${key}`));
      console.log('');
      console.log('⚠️  Complete OAuth setup first');
      return;
    }
    
    console.log('✅ All OAuth credentials present');
    console.log('📡 Testing Google Ads API access...');
    
    // Test with manager account - list accessible customers
    const testUrl = 'https://googleads.googleapis.com/v14/customers:listAccessibleCustomers';
    
    // Note: This would need actual OAuth token refresh logic
    console.log('⚠️  OAuth token refresh logic needed for full testing');
    console.log('✅ Setup is ready for implementation');
    
  } catch (error) {
    console.error('❌ Error testing access:', error);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--test')) {
    await testManagerAccess();
  } else {
    await setupManagerOAuth();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  setupManagerOAuth,
  testManagerAccess
}; 