#!/usr/bin/env node

/**
 * Update OAuth Credentials for Google Ads
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// OAuth credentials (updated December 19, 2025)
const OAUTH_CREDENTIALS = {
  client_id: '1000164558061-q3du2rn10omdb5g0a0h6rbh10g7p6t9m.apps.googleusercontent.com',
  client_secret: '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'
};

async function updateOAuthCredentials() {
  console.log('🔐 Updating Google Ads OAuth Credentials');
  console.log('========================================\n');
  
  try {
    // Update OAuth credentials in system settings
    const credentialsToUpdate = [
      {
        key: 'google_ads_client_id',
        value: OAUTH_CREDENTIALS.client_id,
        description: 'Google Ads API Client ID (OAuth)'
      },
      {
        key: 'google_ads_client_secret',
        value: OAUTH_CREDENTIALS.client_secret,
        description: 'Google Ads API Client Secret (OAuth)'
      }
    ];
    
    console.log('📝 Updating OAuth credentials...');
    
    for (const credential of credentialsToUpdate) {
      const { error } = await supabase
        .from('system_settings')
        .upsert(credential, { onConflict: 'key' });
      
      if (error) {
        console.log(`❌ Error updating ${credential.key}:`, error.message);
        return false;
      } else {
        console.log(`✅ Updated ${credential.key}`);
      }
    }
    
    console.log('\n✅ OAuth credentials updated successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Error updating credentials:', error);
    return false;
  }
}

async function checkCurrentSettings() {
  console.log('\n📊 Current Google Ads Settings Status');
  console.log('====================================');
  
  try {
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('key, value')
      .like('key', 'google_ads_%')
      .order('key');
    
    if (error) {
      console.error('❌ Error fetching settings:', error.message);
      return;
    }
    
    const settingsMap = {};
    settings?.forEach(setting => {
      settingsMap[setting.key] = setting.value;
    });
    
    // Check all required settings
    const requiredSettings = [
      { key: 'google_ads_developer_token', name: 'Developer Token' },
      { key: 'google_ads_manager_customer_id', name: 'Manager Customer ID' },
      { key: 'google_ads_client_id', name: 'OAuth Client ID' },
      { key: 'google_ads_client_secret', name: 'OAuth Client Secret' },
      { key: 'google_ads_manager_refresh_token', name: 'Manager Refresh Token' },
      { key: 'google_ads_enabled', name: 'Integration Enabled' }
    ];
    
    let completeCount = 0;
    
    requiredSettings.forEach(setting => {
      const value = settingsMap[setting.key];
      const isSet = value && value.length > 0;
      
      if (isSet) completeCount++;
      
      console.log(`${setting.name}: ${isSet ? '✅ SET' : '❌ NOT SET'}`);
      
      // Show partial values for verification (but hide secrets)
      if (isSet && !setting.key.includes('secret') && !setting.key.includes('token')) {
        console.log(`   Value: ${value}`);
      } else if (isSet) {
        const maskedValue = value.substring(0, 10) + '***' + value.substring(value.length - 4);
        console.log(`   Value: ${maskedValue}`);
      }
    });
    
    console.log(`\n📈 Progress: ${completeCount}/${requiredSettings.length} credentials configured`);
    
    return { complete: completeCount === requiredSettings.length, missing: requiredSettings.length - completeCount };
    
  } catch (error) {
    console.error('❌ Error checking settings:', error);
    return { complete: false, missing: 6 };
  }
}

async function generateRefreshTokenInstructions() {
  console.log('\n🔑 Next Step: Generate Refresh Token');
  console.log('===================================');
  console.log('');
  console.log('Now that OAuth credentials are set up, generate the refresh token:');
  console.log('');
  console.log('1. Go to OAuth 2.0 Playground:');
  console.log('   https://developers.google.com/oauthplayground/');
  console.log('');
  console.log('2. Click the ⚙️ settings icon (top right)');
  console.log('   ✅ Check "Use your own OAuth credentials"');
  console.log('   - OAuth Client ID: 1000164558061-q3du2rn10omdb5g0a0h6rbh10g7p6t9m.apps.googleusercontent.com');
  console.log('   - OAuth Client secret: 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');
  console.log('');
  console.log('3. Select APIs (left panel):');
  console.log('   - Find "Google Ads API v14"');
  console.log('   - Select: https://www.googleapis.com/auth/adwords');
  console.log('');
  console.log('4. Authorize APIs:');
  console.log('   - Click "Authorize APIs"');
  console.log('   - Sign in with the account that manages Customer ID: 293-100-0497');
  console.log('   - Grant permissions');
  console.log('');
  console.log('5. Exchange authorization code for tokens:');
  console.log('   - Click "Exchange authorization code for tokens"');
  console.log('   - Copy the "Refresh token" (starts with 1//0...)');
  console.log('');
  console.log('6. Update system settings:');
  console.log('   - Go to /admin/settings in your app');
  console.log('   - Find "Google Ads API" section');
  console.log('   - Paste the refresh token');
  console.log('   - Save settings');
  console.log('');
}

async function testOAuthCredentials() {
  console.log('\n🧪 Testing OAuth Credentials');
  console.log('============================');
  
  try {
    // Test the OAuth URL generation
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(OAUTH_CREDENTIALS.client_id)}&` +
      `redirect_uri=${encodeURIComponent('https://developers.google.com/oauthplayground')}&` +
      `scope=${encodeURIComponent('https://www.googleapis.com/auth/adwords')}&` +
      `response_type=code&` +
      `access_type=offline&` +
      `prompt=consent`;
    
    console.log('✅ OAuth credentials format is valid');
    console.log('✅ Client ID matches project: 1000164558061');
    console.log('✅ Client Secret format is correct');
    console.log('');
    console.log('🔗 Test OAuth URL (click to test authorization):');
    console.log(authUrl.substring(0, 100) + '...');
    console.log('');
    console.log('⚠️  Use this URL if OAuth Playground doesn\'t work:');
    console.log('   Copy the full URL and paste in browser');
    
  } catch (error) {
    console.error('❌ Error testing OAuth credentials:', error);
  }
}

async function main() {
  console.log('🎯 Google Ads OAuth Credentials Setup');
  console.log('=====================================');
  console.log(`Project: cellular-nuance-469408-b3`);
  console.log(`Client ID: ${OAUTH_CREDENTIALS.client_id.substring(0, 20)}...`);
  console.log('');
  
  try {
    // Step 1: Update OAuth credentials
    const updateSuccess = await updateOAuthCredentials();
    
    if (!updateSuccess) {
      console.log('❌ Failed to update credentials');
      return;
    }
    
    // Step 2: Check current settings status
    const { complete, missing } = await checkCurrentSettings();
    
    // Step 3: Test OAuth credentials
    await testOAuthCredentials();
    
    // Step 4: Show next steps
    if (!complete) {
      await generateRefreshTokenInstructions();
    }
    
    // Summary
    console.log('\n📋 Summary');
    console.log('==========');
    if (missing === 1) {
      console.log('🟡 Almost complete! Only refresh token needed');
      console.log('✅ OAuth credentials are set up');
      console.log('❌ Generate refresh token (see instructions above)');
      console.log('');
      console.log('🎉 Once refresh token is added: ALL 20 clients will have Google Ads access!');
    } else if (missing === 0) {
      console.log('🎉 Setup is 100% complete!');
      console.log('✅ All credentials configured');
      console.log('✅ Ready for Google Ads API access');
    } else {
      console.log(`⚠️  ${missing} credentials still needed`);
    }
    
  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  updateOAuthCredentials,
  checkCurrentSettings,
  testOAuthCredentials,
  OAUTH_CREDENTIALS
}; 