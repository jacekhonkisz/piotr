#!/usr/bin/env tsx

/**
 * DIRECT TOKEN REFRESH TEST
 * 
 * Tests the refresh token directly with Google OAuth API
 * to see the exact error message.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testTokenRefresh() {
  console.log('\n🔍 DIRECT TOKEN REFRESH TEST\n');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  // Get credentials
  const { data: settings } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['google_ads_client_id', 'google_ads_client_secret', 'google_ads_manager_refresh_token']);

  const clientId = settings?.find(s => s.key === 'google_ads_client_id')?.value;
  const clientSecret = settings?.find(s => s.key === 'google_ads_client_secret')?.value;
  const refreshToken = settings?.find(s => s.key === 'google_ads_manager_refresh_token')?.value;

  if (!clientId || !clientSecret || !refreshToken) {
    console.error('❌ Missing credentials');
    process.exit(1);
  }

  console.log('📋 Using credentials:\n');
  console.log(`   Client ID: ${clientId.substring(0, 30)}...`);
  console.log(`   Client Secret: ${clientSecret.substring(0, 15)}...`);
  console.log(`   Refresh Token: ${refreshToken.substring(0, 30)}...`);
  console.log(`   Token Length: ${refreshToken.length} chars\n`);

  console.log('📤 Sending refresh token request to Google...\n');

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });

    const responseText = await response.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    console.log('📥 Response:\n');
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Headers:`, Object.fromEntries(response.headers.entries()));
    console.log(`   Body:`, responseData);
    console.log('');

    if (response.ok) {
      console.log('✅ ✅ ✅ TOKEN REFRESH SUCCESSFUL! ✅ ✅ ✅\n');
      console.log('📊 Access Token Information:\n');
      console.log(`   Access Token: ${responseData.access_token.substring(0, 30)}...`);
      console.log(`   Token Type: ${responseData.token_type}`);
      console.log(`   Expires In: ${responseData.expires_in} seconds (${Math.floor(responseData.expires_in / 60)} minutes)`);
      console.log(`   Scope: ${responseData.scope || 'N/A'}\n`);
      console.log('🎉 Your refresh token is VALID and WORKING!\n');
    } else {
      console.log('❌ TOKEN REFRESH FAILED\n');
      console.log('🔍 Error Details:\n');
      
      if (responseData.error) {
        console.log(`   Error: ${responseData.error}`);
        console.log(`   Description: ${responseData.error_description || 'N/A'}\n`);
        
        if (responseData.error === 'invalid_grant') {
          console.log('💡 Possible causes:\n');
          console.log('   1. Token was revoked by user');
          console.log('   2. Token is for a different OAuth client');
          console.log('   3. Token expired (if app was in Testing mode)');
          console.log('   4. Client ID/Secret mismatch\n');
          console.log('🔧 Solutions:\n');
          console.log('   1. Generate a new token using our script:');
          console.log('      npx tsx scripts/generate-google-oauth-url.ts\n');
          console.log('   2. Make sure OAuth app is in "Production" mode');
          console.log('   3. Verify Client ID/Secret match in Google Cloud Console\n');
        }
      } else {
        console.log('   Raw response:', responseText);
      }
    }

  } catch (error: any) {
    console.error('❌ Network error:', error.message);
    console.error('Full error:', error);
  }
}

testTokenRefresh();


