#!/usr/bin/env node

// Quick test script to verify Google Ads token is working
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testGoogleAdsToken() {
  console.log('🔍 Testing Google Ads token...');
  
  try {
    // Get the manager refresh token from system settings
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'google_ads_client_id',
        'google_ads_client_secret', 
        'google_ads_manager_refresh_token'
      ]);

    if (error) {
      console.error('❌ Error fetching settings:', error);
      return;
    }

    const settingsMap = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});

    console.log('📋 Current settings:');
    console.log('- Client ID:', settingsMap.google_ads_client_id ? '✅ Set' : '❌ Missing');
    console.log('- Client Secret:', settingsMap.google_ads_client_secret ? '✅ Set' : '❌ Missing');
    console.log('- Refresh Token:', settingsMap.google_ads_manager_refresh_token ? '✅ Set' : '❌ Missing');

    if (!settingsMap.google_ads_manager_refresh_token) {
      console.log('\n❌ No refresh token found. Please add it via /admin/google-ads-tokens');
      return;
    }

    // Test token refresh
    console.log('\n🔄 Testing token refresh...');
    
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: settingsMap.google_ads_client_id,
        client_secret: settingsMap.google_ads_client_secret,
        refresh_token: settingsMap.google_ads_manager_refresh_token,
        grant_type: 'refresh_token'
      })
    });

    if (response.ok) {
      const tokenData = await response.json();
      console.log('✅ Token refresh successful!');
      console.log('- Access token generated:', tokenData.access_token ? 'Yes' : 'No');
      console.log('- Expires in:', tokenData.expires_in, 'seconds');
      console.log('\n🎉 Google Ads token is working correctly!');
    } else {
      const errorText = await response.text();
      console.log('❌ Token refresh failed:', response.status);
      console.log('Error:', errorText);
      
      if (errorText.includes('invalid_grant')) {
        console.log('\n💡 This means your refresh token has expired or been revoked.');
        console.log('Please generate a new refresh token following the guide.');
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testGoogleAdsToken();
