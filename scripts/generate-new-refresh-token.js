#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function generateRefreshTokenInstructions() {
  console.log('🔐 Google Ads Refresh Token Generation Guide');
  console.log('===========================================\n');

  // Get current credentials
  const { data: settings, error } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['google_ads_client_id', 'google_ads_client_secret']);

  if (error) {
    console.error('❌ Error getting credentials:', error.message);
    return;
  }

  const creds = {};
  settings?.forEach(setting => {
    creds[setting.key] = setting.value;
  });

  console.log('📋 Your OAuth Credentials:');
  console.log(`   Client ID: ${creds.google_ads_client_id}`);
  console.log(`   Client Secret: ${creds.google_ads_client_secret}\n`);

  console.log('🌐 Step 1: Go to OAuth 2.0 Playground');
  console.log('   URL: https://developers.google.com/oauthplayground/\n');

  console.log('⚙️  Step 2: Configure OAuth Playground');
  console.log('   1. Click the gear icon (⚙️) in top right');
  console.log('   2. Check "Use your own OAuth credentials"');
  console.log(`   3. OAuth Client ID: ${creds.google_ads_client_id}`);
  console.log(`   4. OAuth Client secret: ${creds.google_ads_client_secret}\n`);

  console.log('🎯 Step 3: Select Google Ads API');
  console.log('   1. In "Select & authorize APIs" section');
  console.log('   2. Find "Google Ads API v14"');
  console.log('   3. Select: https://www.googleapis.com/auth/adwords');
  console.log('   4. Click "Authorize APIs"\n');

  console.log('🔑 Step 4: Get Refresh Token');
  console.log('   1. Sign in with your MANAGER account (293-100-0497)');
  console.log('   2. Grant permissions');
  console.log('   3. Click "Exchange authorization code for tokens"');
  console.log('   4. Copy the "Refresh token" value\n');

  console.log('💾 Step 5: Update Database');
  console.log('   Run this command with your new refresh token:');
  console.log('   node -e "');
  console.log('   const { createClient } = require(\'@supabase/supabase-js\');');
  console.log('   require(\'dotenv\').config();');
  console.log('   const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);');
  console.log('   supabase.from(\'system_settings\').update({ value: \'YOUR_NEW_REFRESH_TOKEN\' }).eq(\'key\', \'google_ads_manager_refresh_token\').then(console.log);');
  console.log('   "\n');

  console.log('🧪 Step 6: Test Integration');
  console.log('   node scripts/fetch-belmonte-google-ads-data.js\n');

  console.log('⚠️  Important Notes:');
  console.log('   - Use the MANAGER account (293-100-0497) for authorization');
  console.log('   - The refresh token should start with "1//"');
  console.log('   - Keep the refresh token secure and private');
  console.log('   - This token will work for all your Google Ads clients\n');
}

generateRefreshTokenInstructions();
