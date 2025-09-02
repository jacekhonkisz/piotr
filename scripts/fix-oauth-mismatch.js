#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixOAuthMismatch() {
  console.log('🔧 Fixing OAuth Credential Mismatch');
  console.log('===================================\n');

  // Get current credentials
  const { data: settings, error } = await supabase
    .from('system_settings')
    .select('key, value, updated_at')
    .in('key', [
      'google_ads_client_id',
      'google_ads_client_secret', 
      'google_ads_manager_refresh_token'
    ]);

  if (error) {
    console.log('❌ Error getting credentials:', error.message);
    return;
  }

  const creds = {};
  settings?.forEach(setting => {
    creds[setting.key] = setting.value;
    creds[setting.key + '_updated'] = setting.updated_at;
  });

  console.log('🔍 Credential Mismatch Analysis:');
  console.log(`   OAuth Client ID updated: ${creds.google_ads_client_id_updated}`);
  console.log(`   OAuth Client Secret updated: ${creds.google_ads_client_secret_updated}`);
  console.log(`   Refresh Token updated: ${creds.google_ads_manager_refresh_token_updated}`);

  const oauthDate = new Date(creds.google_ads_client_id_updated);
  const tokenDate = new Date(creds.google_ads_manager_refresh_token_updated);

  if (oauthDate > tokenDate) {
    console.log('\n❌ MISMATCH CONFIRMED:');
    console.log('   OAuth credentials are newer than refresh token');
    console.log('   This explains the invalid_grant error');
  } else {
    console.log('\n✅ No mismatch detected');
  }

  console.log('\n🛠️  SOLUTION:');
  console.log('   You need to generate a new refresh token using the current OAuth credentials.');
  console.log('   The refresh token must be created specifically for these credentials:');
  console.log(`   Client ID: ${creds.google_ads_client_id}`);
  console.log(`   Client Secret: ${creds.google_ads_client_secret.substring(0, 15)}...`);

  console.log('\n📋 Quick Fix Steps:');
  console.log('1. Go to: https://developers.google.com/oauthplayground/');
  console.log('2. Click gear icon (⚙️) → "Use your own OAuth credentials"');
  console.log(`3. OAuth Client ID: ${creds.google_ads_client_id}`);
  console.log(`4. OAuth Client secret: ${creds.google_ads_client_secret}`);
  console.log('5. Select: Google Ads API v14 → https://www.googleapis.com/auth/adwords');
  console.log('6. Authorize with manager account (293-100-0497)');
  console.log('7. Get refresh token and run:');
  console.log('   node scripts/update-refresh-token.js "YOUR_NEW_REFRESH_TOKEN"');

  console.log('\n⚡ This will fix the issue permanently!');
  console.log('   The app will then work automatically without any manual intervention.');
}

fixOAuthMismatch();
