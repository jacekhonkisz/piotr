#!/usr/bin/env node

/**
 * Update Google Ads OAuth Credentials
 * 
 * This script helps you update the OAuth Client ID and Client Secret
 * in the system_settings table.
 */

const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');
require('dotenv').config();

// Supabase client configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function updateOAuthCredentials() {
  console.log('🔐 Google Ads OAuth Credentials Update');
  console.log('=======================================\n');
  
  console.log('📝 You need to provide:');
  console.log('   1. OAuth Client ID (from Google Cloud Console)');
  console.log('   2. OAuth Client Secret (from Google Cloud Console)\n');
  
  console.log('💡 If you don\'t have these yet, see: GOOGLE_ADS_OAUTH_SETUP_GUIDE.md\n');
  
  // Ask for confirmation
  const proceed = await askQuestion('Do you have your OAuth credentials ready? (yes/no): ');
  
  if (proceed.toLowerCase() !== 'yes' && proceed.toLowerCase() !== 'y') {
    console.log('\n📖 Please follow the setup guide first:');
    console.log('   cat GOOGLE_ADS_OAUTH_SETUP_GUIDE.md\n');
    rl.close();
    return;
  }
  
  console.log('\n');
  
  // Get Client ID
  const clientId = await askQuestion('Enter OAuth Client ID: ');
  
  if (!clientId || clientId.trim() === '') {
    console.error('❌ Client ID cannot be empty');
    rl.close();
    return;
  }
  
  // Get Client Secret
  const clientSecret = await askQuestion('Enter OAuth Client Secret: ');
  
  if (!clientSecret || clientSecret.trim() === '') {
    console.error('❌ Client Secret cannot be empty');
    rl.close();
    return;
  }
  
  console.log('\n🔄 Updating credentials in database...\n');
  
  try {
    // Update Client ID
    const { error: clientIdError } = await supabase
      .from('system_settings')
      .upsert({
        key: 'google_ads_client_id',
        value: clientId.trim(),
        description: 'Google Ads API Client ID (OAuth)'
      }, {
        onConflict: 'key'
      });
    
    if (clientIdError) throw clientIdError;
    console.log('✅ Client ID updated');
    
    // Update Client Secret
    const { error: clientSecretError } = await supabase
      .from('system_settings')
      .upsert({
        key: 'google_ads_client_secret',
        value: clientSecret.trim(),
        description: 'Google Ads API Client Secret (OAuth)'
      }, {
        onConflict: 'key'
      });
    
    if (clientSecretError) throw clientSecretError;
    console.log('✅ Client Secret updated');
    
    console.log('\n🎉 OAuth credentials updated successfully!\n');
    
    // Verify settings
    console.log('🔍 Verifying all Google Ads settings...\n');
    
    const { data: settings, error: fetchError } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'google_ads_developer_token',
        'google_ads_client_id',
        'google_ads_client_secret',
        'google_ads_manager_customer_id',
        'google_ads_manager_refresh_token'
      ]);
    
    if (fetchError) throw fetchError;
    
    console.log('📋 Current Configuration:');
    console.log('========================');
    
    const requiredSettings = [
      'google_ads_developer_token',
      'google_ads_client_id',
      'google_ads_client_secret',
      'google_ads_manager_customer_id',
      'google_ads_manager_refresh_token'
    ];
    
    let allConfigured = true;
    
    for (const key of requiredSettings) {
      const setting = settings?.find(s => s.key === key);
      const isSet = setting?.value && setting.value.trim() !== '';
      const icon = isSet ? '✅' : '❌';
      const status = isSet ? '***[SET]***' : '[MISSING]';
      
      console.log(`${icon} ${key}: ${status}`);
      
      if (!isSet) {
        allConfigured = false;
      }
    }
    
    console.log('\n');
    
    if (allConfigured) {
      console.log('🎊 SUCCESS! All credentials are configured!');
      console.log('\n📝 Next Steps:');
      console.log('   1. Run production readiness test:');
      console.log('      node scripts/test-google-ads-production-ready.js');
      console.log('');
      console.log('   2. Test API connection:');
      console.log('      node scripts/test-google-ads-api-connection.js');
      console.log('');
      console.log('   3. Deploy to production!');
    } else {
      console.log('⚠️  Some credentials are still missing.');
      console.log('\n📝 What\'s missing:');
      
      const missingToken = !settings?.find(s => s.key === 'google_ads_manager_refresh_token')?.value;
      
      if (missingToken) {
        console.log('   ❌ Manager Refresh Token');
        console.log('      Generate using OAuth playground or your app\'s OAuth flow');
        console.log('      See: GOOGLE_ADS_OAUTH_SETUP_GUIDE.md');
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error updating credentials:', error);
  }
  
  rl.close();
}

async function displayCurrentSettings() {
  console.log('📋 Current Google Ads Configuration');
  console.log('===================================\n');
  
  try {
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('key, value, description')
      .like('key', 'google_ads_%')
      .order('key');
    
    if (error) throw error;
    
    if (!settings || settings.length === 0) {
      console.log('⚠️  No Google Ads settings found in database');
      return;
    }
    
    settings.forEach(setting => {
      const isSecret = setting.key.includes('secret') || setting.key.includes('token');
      const hasValue = setting.value && setting.value.trim() !== '';
      
      let displayValue;
      if (!hasValue) {
        displayValue = '❌ [NOT SET]';
      } else if (isSecret) {
        displayValue = '✅ ***[HIDDEN]***';
      } else {
        displayValue = `✅ ${setting.value}`;
      }
      
      console.log(`${setting.key}:`);
      console.log(`  Value: ${displayValue}`);
      console.log(`  Description: ${setting.description || 'N/A'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error fetching settings:', error);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--show') || args.includes('-s')) {
    await displayCurrentSettings();
  } else if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage:');
    console.log('  node scripts/update-google-oauth-credentials.js       Update OAuth credentials');
    console.log('  node scripts/update-google-oauth-credentials.js -s    Show current settings');
    console.log('  node scripts/update-google-oauth-credentials.js -h    Show this help');
  } else {
    await updateOAuthCredentials();
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  updateOAuthCredentials,
  displayCurrentSettings
};


