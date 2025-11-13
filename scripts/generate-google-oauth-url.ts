#!/usr/bin/env tsx

/**
 * GENERATE GOOGLE OAUTH URL
 * 
 * Creates the authorization URL for Google OAuth flow
 * to get a new refresh token.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function generateOAuthURL() {
  console.log('\n🔐 GOOGLE ADS OAUTH AUTHORIZATION URL GENERATOR\n');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  // Get credentials from database
  const { data: settings, error } = await supabase
    .from('system_settings')
    .select('key, value')
    .eq('key', 'google_ads_client_id')
    .single();

  if (error || !settings) {
    console.error('❌ Client ID not found in database');
    console.error('Error:', error);
    process.exit(1);
  }

  const clientId = settings.value;

  console.log('✅ Client ID loaded from database\n');
  console.log(`   Client ID: ${clientId.substring(0, 20)}...\n`);

  // Use manual redirect for easy token copy
  const redirectUri = 'urn:ietf:wg:oauth:2.0:oob';
  const scope = 'https://www.googleapis.com/auth/adwords';

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scope)}` +
    `&access_type=offline` +
    `&prompt=consent`;

  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('📋 INSTRUCTIONS:');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  console.log('STEP 1: Copy the URL below\n');
  console.log('STEP 2: Paste it in your browser (use incognito/private window)\n');
  console.log('STEP 3: Sign in with your Google Workspace account');
  console.log('        (the one with Google Ads Manager access)\n');
  console.log('STEP 4: Click "Allow" to grant permissions\n');
  console.log('STEP 5: Copy the authorization code from the page\n');
  console.log('STEP 6: Run the exchange script:');
  console.log('        npx tsx scripts/exchange-oauth-code.ts "YOUR_CODE_HERE"\n');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🔗 AUTHORIZATION URL:');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  console.log(authUrl);
  console.log('\n═══════════════════════════════════════════════════════════════════════════════\n');
  console.log('💡 TIP: The authorization code will be displayed on screen after you approve.\n');
  console.log('    It will look like: 4/0AdLIrYe... (very long string)\n');
  console.log('    Copy the ENTIRE code including all characters.\n');
}

generateOAuthURL();

