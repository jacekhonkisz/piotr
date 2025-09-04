#!/usr/bin/env node

// Complete script to get Google Ads refresh token
// This script includes both Client ID and Client Secret

const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Your OAuth credentials
const CLIENT_ID = '1000164558061-q3du2rn10omdb5g0a0h6rbh10g7p6t9m.apps.googleusercontent.com';

// We'll get the client secret from your system settings
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function getClientSecret() {
  console.log('🔍 Getting OAuth credentials from your system...\n');
  
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'google_ads_client_secret')
      .single();
    
    if (error || !data?.value) {
      console.log('❌ Client Secret not found in system settings.');
      console.log('Please add it via /admin/settings or /admin/google-ads-tokens\n');
      
      const manualSecret = await ask('Enter your OAuth Client Secret manually: ');
      return manualSecret;
    }
    
    console.log('✅ Found OAuth Client Secret in system settings\n');
    return data.value;
  } catch (error) {
    console.log('❌ Error accessing system settings:', error.message);
    const manualSecret = await ask('Enter your OAuth Client Secret manually: ');
    return manualSecret;
  }
}

async function generateRefreshToken() {
  console.log('🔑 Google Ads Refresh Token Generator');
  console.log('=====================================\n');
  
  try {
    const clientSecret = await getClientSecret();
    
    if (!clientSecret) {
      console.log('❌ Cannot proceed without Client Secret');
      process.exit(1);
    }
    
    console.log('📋 Your OAuth Credentials:');
    console.log('- Client ID:', CLIENT_ID);
    console.log('- Client Secret: ✅ Found\n');
    
    // Generate authorization URL
    const scope = 'https://www.googleapis.com/auth/adwords';
    const redirectUri = 'urn:ietf:wg:oauth:2.0:oob';
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(CLIENT_ID)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `response_type=code&` +
      `access_type=offline&` +
      `prompt=consent`;
    
    console.log('🌐 STEP 1: Open this URL in your browser:');
    console.log('==========================================');
    console.log(authUrl);
    console.log('==========================================\n');
    
    console.log('📝 STEP 2: Follow these instructions:');
    console.log('1. Sign in with your Google Ads Manager account');
    console.log('2. Click "Allow" to grant permissions');
    console.log('3. Copy the authorization code from the page\n');
    
    const authCode = await ask('🔑 STEP 3: Paste the authorization code here: ');
    
    console.log('\n🔄 Exchanging code for refresh token...\n');
    
    // Exchange code for tokens
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: clientSecret,
        code: authCode.trim(),
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      })
    });
    
    if (response.ok) {
      const tokens = await response.json();
      
      console.log('🎉 SUCCESS! Your refresh token has been generated!\n');
      console.log('🔑 REFRESH TOKEN (copy this entire line):');
      console.log('==========================================');
      console.log(tokens.refresh_token);
      console.log('==========================================\n');
      
      console.log('📋 NEXT STEPS:');
      console.log('1. Copy the refresh token above');
      console.log('2. Go to your admin panel: /admin/google-ads-tokens');
      console.log('3. Paste it in the "Manager Refresh Token" field');
      console.log('4. Click "Save Settings"');
      console.log('5. Click "Test Connection" to verify it works\n');
      
      console.log('✅ Once you do this, your Google Ads data will start flowing!');
      
      // Optionally save to system settings
      const saveToSystem = await ask('💾 Would you like me to save this token to your system now? (y/n): ');
      
      if (saveToSystem.toLowerCase() === 'y' || saveToSystem.toLowerCase() === 'yes') {
        try {
          const { error } = await supabase
            .from('system_settings')
            .upsert({
              key: 'google_ads_manager_refresh_token',
              value: tokens.refresh_token,
              description: 'Google Ads Manager Refresh Token'
            }, {
              onConflict: 'key'
            });
          
          if (error) {
            console.log('❌ Error saving to system:', error.message);
          } else {
            console.log('✅ Refresh token saved to system settings!');
            console.log('🎉 Your Google Ads integration is now ready!');
          }
        } catch (error) {
          console.log('❌ Error saving to system:', error.message);
        }
      }
      
    } else {
      const error = await response.text();
      console.log('❌ Error getting refresh token:');
      console.log(error);
      
      if (error.includes('invalid_grant')) {
        console.log('\n💡 This usually means:');
        console.log('- The authorization code expired (try again)');
        console.log('- The code was already used (get a new one)');
        console.log('- There was a copy/paste error');
      }
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  rl.close();
}

// Run the script
generateRefreshToken();
