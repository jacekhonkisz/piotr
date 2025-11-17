#!/usr/bin/env tsx

/**
 * EXCHANGE OAUTH CODE FOR REFRESH TOKEN
 * 
 * Takes the authorization code from OAuth flow and exchanges it
 * for access token and refresh token, then saves to database.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function exchangeCode(authCode: string) {
  console.log('\n🔄 EXCHANGING AUTHORIZATION CODE FOR REFRESH TOKEN\n');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  // Get credentials
  console.log('📥 Loading credentials from database...\n');
  
  const { data: settings, error } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['google_ads_client_id', 'google_ads_client_secret']);

  if (error || !settings) {
    console.error('❌ Failed to load credentials:', error);
    process.exit(1);
  }

  const clientId = settings.find(s => s.key === 'google_ads_client_id')?.value;
  const clientSecret = settings.find(s => s.key === 'google_ads_client_secret')?.value;

  if (!clientId || !clientSecret) {
    console.error('❌ Credentials not found in database');
    console.error('   Missing:', !clientId ? 'Client ID' : 'Client Secret');
    process.exit(1);
  }

  console.log('✅ Credentials loaded\n');
  console.log(`   Client ID: ${clientId.substring(0, 20)}...`);
  console.log(`   Client Secret: ${clientSecret.substring(0, 10)}...\n`);

  console.log('📤 Sending token exchange request to Google...\n');

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: authCode,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
        grant_type: 'authorization_code'
      })
    });

    const data: any = await response.json();

    if (!response.ok) {
      console.error('❌ Token exchange failed!\n');
      console.error('Response:', data);
      console.error('\n🔍 Common causes:');
      console.error('   1. Authorization code already used (codes are one-time use)');
      console.error('   2. Code expired (expires in 10 minutes)');
      console.error('   3. Client ID/Secret mismatch');
      console.error('   4. Redirect URI not authorized\n');
      console.error('💡 Solution: Generate a new authorization URL and try again:');
      console.error('   npx tsx scripts/generate-google-oauth-url.ts\n');
      process.exit(1);
    }

    console.log('✅ SUCCESS! Tokens received from Google\n');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('📊 TOKEN INFORMATION:');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');
    
    console.log(`Access Token:`);
    console.log(`   ${data.access_token.substring(0, 30)}...${data.access_token.substring(data.access_token.length - 20)}`);
    console.log(`   (${data.access_token.length} characters)\n`);
    
    console.log(`Refresh Token:`);
    console.log(`   ${data.refresh_token.substring(0, 30)}...${data.refresh_token.substring(data.refresh_token.length - 20)}`);
    console.log(`   (${data.refresh_token.length} characters)\n`);
    
    console.log(`Token Type: ${data.token_type}`);
    console.log(`Expires In: ${data.expires_in} seconds (${Math.floor(data.expires_in / 60)} minutes)`);
    console.log(`Scope: ${data.scope}\n`);

    console.log('═══════════════════════════════════════════════════════════════════════════════\n');
    console.log('💾 Saving refresh token to database...\n');

    const { error: updateError } = await supabase
      .from('system_settings')
      .update({ 
        value: data.refresh_token,
        updated_at: new Date().toISOString()
      })
      .eq('key', 'google_ads_manager_refresh_token');

    if (updateError) {
      console.error('❌ Database update failed:', updateError);
      console.log('\n📋 MANUAL UPDATE REQUIRED:\n');
      console.log('Copy the refresh token above and run this SQL in Supabase:\n');
      console.log(`UPDATE system_settings`);
      console.log(`SET value = '${data.refresh_token}',`);
      console.log(`    updated_at = NOW()`);
      console.log(`WHERE key = 'google_ads_manager_refresh_token';\n`);
      process.exit(1);
    }

    console.log('✅ Refresh token saved to database successfully!\n');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('🎉 SETUP COMPLETE!');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');
    
    console.log('✅ Your refresh token is now stored in the database\n');
    console.log('📅 If you set OAuth app to "Internal" type:');
    console.log('   → This token will NEVER expire\n');
    console.log('📅 If OAuth app is still in "Testing":');
    console.log('   → This token will expire in 7 days');
    console.log('   → You need to change to "Internal" or "Production" in Google Cloud Console\n');
    
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('🧪 NEXT STEPS - VERIFY TOKEN WORKS:');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');
    
    console.log('1️⃣  Test the token:');
    console.log('   npx tsx scripts/test-google-token-live.ts\n');
    
    console.log('2️⃣  Check token configuration:');
    console.log('   npx tsx scripts/check-google-token-config.ts\n');
    
    console.log('3️⃣  Verify dashboard displays current data:');
    console.log('   - Navigate to your app');
    console.log('   - Check Belmonte client');
    console.log('   - Current month/week should display correctly\n');
    
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('❌ Unexpected error:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Get auth code from command line argument
const authCode = process.argv[2];

if (!authCode) {
  console.error('❌ Missing authorization code\n');
  console.log('USAGE:');
  console.log('  npx tsx scripts/exchange-oauth-code.ts "YOUR_AUTH_CODE"\n');
  console.log('EXAMPLE:');
  console.log('  npx tsx scripts/exchange-oauth-code.ts "4/0AdLIrYe..."\n');
  console.log('💡 TIP: Make sure to wrap the code in quotes!\n');
  console.log('To get an authorization code:');
  console.log('  1. Run: npx tsx scripts/generate-google-oauth-url.ts');
  console.log('  2. Follow the instructions to get the code');
  console.log('  3. Come back here with the code\n');
  process.exit(1);
}

exchangeCode(authCode);



