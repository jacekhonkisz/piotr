#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deepTestOAuthMismatch() {
  console.log('🧪 DEEP TESTING: OAuth Credential Mismatch Theory');
  console.log('================================================\n');

  // Get all credential history
  const { data: settings, error } = await supabase
    .from('system_settings')
    .select('key, value, created_at, updated_at')
    .like('key', '%google_ads%')
    .order('updated_at', { ascending: false });

  if (error) {
    console.log('❌ Error:', error.message);
    return;
  }

  const creds = {};
  settings?.forEach(setting => {
    creds[setting.key] = {
      value: setting.value,
      created_at: setting.created_at,
      updated_at: setting.updated_at
    };
  });

  console.log('📊 DETAILED CREDENTIAL TIMELINE:');
  console.log('================================');
  
  const relevantKeys = ['google_ads_client_id', 'google_ads_client_secret', 'google_ads_manager_refresh_token'];
  relevantKeys.forEach(key => {
    if (creds[key]) {
      const displayValue = key.includes('secret') || key.includes('token') 
        ? creds[key].value?.substring(0, 15) + '...' 
        : creds[key].value;
      console.log(`${key}:`);
      console.log(`   Value: ${displayValue}`);
      console.log(`   Created: ${creds[key].created_at}`);
      console.log(`   Updated: ${creds[key].updated_at}`);
      console.log('');
    }
  });

  // Test 1: Check if the issue is really credential mismatch
  console.log('🧪 TEST 1: Credential Relationship Analysis');
  console.log('===========================================');
  
  const clientIdDate = new Date(creds.google_ads_client_id?.updated_at);
  const clientSecretDate = new Date(creds.google_ads_client_secret?.updated_at);
  const refreshTokenDate = new Date(creds.google_ads_manager_refresh_token?.updated_at);
  
  console.log(`Client ID last updated: ${clientIdDate.toISOString()}`);
  console.log(`Client Secret last updated: ${clientSecretDate.toISOString()}`);
  console.log(`Refresh Token last updated: ${refreshTokenDate.toISOString()}`);
  
  const oauthNewerThanToken = (clientIdDate > refreshTokenDate) || (clientSecretDate > refreshTokenDate);
  console.log(`OAuth credentials newer than refresh token: ${oauthNewerThanToken ? '✅ YES (MISMATCH CONFIRMED)' : '❌ NO'}`);
  
  // Test 2: Try the actual OAuth call with detailed error analysis
  console.log('\n🧪 TEST 2: OAuth Call with Error Pattern Analysis');
  console.log('=================================================');
  
  const testPayload = {
    client_id: creds.google_ads_client_id?.value,
    client_secret: creds.google_ads_client_secret?.value,
    refresh_token: creds.google_ads_manager_refresh_token?.value,
    grant_type: 'refresh_token'
  };
  
  console.log('Request payload (masked):');
  console.log(`   client_id: ${testPayload.client_id}`);
  console.log(`   client_secret: ${testPayload.client_secret?.substring(0, 15)}...`);
  console.log(`   refresh_token: ${testPayload.refresh_token?.substring(0, 15)}...`);
  console.log(`   grant_type: ${testPayload.grant_type}`);
  
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(testPayload)
    });
    
    const responseText = await response.text();
    console.log(`\nResponse status: ${response.status}`);
    console.log(`Response: ${responseText}`);
    
    if (response.status !== 200) {
      try {
        const errorData = JSON.parse(responseText);
        console.log('\n🔍 ERROR ANALYSIS:');
        
        if (errorData.error === 'invalid_grant') {
          console.log('   Error Type: invalid_grant');
          console.log('   Description:', errorData.error_description);
          
          if (errorData.error_description.includes('expired or revoked')) {
            console.log('\n💡 DIAGNOSIS:');
            console.log('   This error typically means:');
            console.log('   1. Refresh token was issued for different client_id/secret');
            console.log('   2. OR the refresh token was actually revoked');
            console.log('   3. OR there was a clock skew issue');
            
            if (oauthNewerThanToken) {
              console.log('\n✅ CONFIRMED: OAuth credential mismatch is the cause');
              console.log('   The refresh token predates the current OAuth credentials');
            } else {
              console.log('\n❓ UNCLEAR: Dates don\'t show mismatch, investigating other causes...');
            }
          }
        }
      } catch (parseError) {
        console.log('   Could not parse error response as JSON');
      }
    } else {
      console.log('\n✅ OAuth call succeeded - no mismatch issue');
      const tokenData = JSON.parse(responseText);
      console.log(`   Access token received: ${tokenData.access_token?.substring(0, 20)}...`);
    }
    
  } catch (fetchError) {
    console.log('\n❌ Network error:', fetchError.message);
  }
  
  // Test 3: Alternative test - try with a known working refresh token format
  console.log('\n🧪 TEST 3: Refresh Token Format Validation');
  console.log('==========================================');
  
  const refreshToken = creds.google_ads_manager_refresh_token?.value;
  if (refreshToken) {
    console.log(`Refresh token format analysis:`);
    console.log(`   Starts with "1//": ${refreshToken.startsWith('1//') ? '✅ YES' : '❌ NO'}`);
    console.log(`   Length: ${refreshToken.length} characters`);
    console.log(`   Contains only valid characters: ${/^[A-Za-z0-9/_-]+$/.test(refreshToken) ? '✅ YES' : '❌ NO'}`);
    
    if (!refreshToken.startsWith('1//')) {
      console.log('   ⚠️  WARNING: Refresh token format is unusual');
    }
  }
  
  console.log('\n🎯 FINAL CONCLUSION:');
  if (oauthNewerThanToken) {
    console.log('✅ CONFIRMED: OAuth credential mismatch is the root cause');
    console.log('   Solution: Generate new refresh token with current credentials');
    console.log('   Confidence Level: 95%');
  } else {
    console.log('❓ INCONCLUSIVE: Need to investigate other potential causes');
    console.log('   The dates don\'t clearly show a mismatch');
    console.log('   Confidence Level: 50%');
  }
}

deepTestOAuthMismatch();
