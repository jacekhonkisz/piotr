#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateRefreshToken() {
  const newRefreshToken = process.argv[2];
  
  if (!newRefreshToken) {
    console.log('❌ Please provide the new refresh token as an argument');
    console.log('Usage: node scripts/update-refresh-token.js "YOUR_NEW_REFRESH_TOKEN"');
    return;
  }

  if (!newRefreshToken.startsWith('1//')) {
    console.log('⚠️  Warning: Refresh token should start with "1//"');
    console.log('   Current token:', newRefreshToken.substring(0, 10) + '...');
  }

  console.log('🔄 Updating Google Ads Manager Refresh Token...');
  
  const { data, error } = await supabase
    .from('system_settings')
    .update({ value: newRefreshToken })
    .eq('key', 'google_ads_manager_refresh_token')
    .select();

  if (error) {
    console.error('❌ Error updating refresh token:', error.message);
    return;
  }

  console.log('✅ Refresh token updated successfully!');
  console.log('🧪 Testing the new token...');

  // Test the new token
  try {
    const testScript = require('./fetch-belmonte-google-ads-data.js');
    console.log('🎯 Running Belmonte test...');
  } catch (err) {
    console.log('🧪 To test the new token, run:');
    console.log('   node scripts/fetch-belmonte-google-ads-data.js');
  }
}

updateRefreshToken();
