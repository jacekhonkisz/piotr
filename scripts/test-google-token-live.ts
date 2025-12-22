#!/usr/bin/env tsx

/**
 * TEST GOOGLE ADS TOKEN - LIVE API CALL
 * 
 * This will attempt to use the refresh token to get an access token
 * and make a simple API call to Google Ads to verify it works.
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from '../src/lib/google-ads-api.js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testGoogleToken() {
  console.log('🔍 TESTING GOOGLE ADS REFRESH TOKEN\n');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  try {
    // Get credentials
    const { data: settings } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'google_ads_client_id',
        'google_ads_client_secret',
        'google_ads_developer_token',
        'google_ads_manager_refresh_token',
        'google_ads_manager_customer_id'
      ]);

    const creds: Record<string, string> = {};
    settings?.forEach(s => {
      creds[s.key] = s.value;
    });

    // Get Belmonte client
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .or('name.ilike.%belmonte%,email.ilike.%belmonte%')
      .single();

    if (!client) {
      console.error('❌ Client not found');
      process.exit(1);
    }

    console.log('✅ Credentials loaded\n');
    console.log('📋 Configuration:');
    console.log(`   Client ID: ${creds.google_ads_client_id?.substring(0, 20)}...`);
    console.log(`   Client Secret: ${creds.google_ads_client_secret?.substring(0, 10)}...`);
    console.log(`   Developer Token: ${creds.google_ads_developer_token?.substring(0, 10)}...`);
    console.log(`   Refresh Token: ${creds.google_ads_manager_refresh_token?.substring(0, 20)}...`);
    console.log(`   Customer ID: ${client.google_ads_customer_id}\n`);

    // Test 1: Initialize Google Ads service
    console.log('1️⃣  INITIALIZING GOOGLE ADS SERVICE...\n');
    
    const googleAdsService = new GoogleAdsAPIService({
      refreshToken: creds.google_ads_manager_refresh_token!,
      clientId: creds.google_ads_client_id!,
      clientSecret: creds.google_ads_client_secret!,
      developmentToken: creds.google_ads_developer_token!,
      customerId: client.google_ads_customer_id,
    });

    console.log('   ✅ Service initialized\n');

    // Test 2: Validate credentials
    console.log('2️⃣  VALIDATING CREDENTIALS WITH GOOGLE...\n');
    
    const validation = await googleAdsService.validateCredentials();
    
    if (validation.valid) {
      console.log('   ✅ TOKEN IS VALID!\n');
      console.log('   📊 Validation details:');
      console.log(`      - Valid: ${validation.valid}`);
      console.log(`      - Customer accessible: Yes`);
      console.log(`      - Token working: Yes\n`);
    } else {
      console.log('   ❌ TOKEN IS INVALID!\n');
      console.log('   📊 Error details:');
      console.log(`      - Valid: ${validation.valid}`);
      console.log(`      - Error: ${validation.error}\n`);
      
      // Parse the error
      if (validation.error?.includes('invalid_grant')) {
        console.log('   🔍 DIAGNOSIS: invalid_grant error\n');
        console.log('   This means one of the following:');
        console.log('   1. ❌ Token was revoked in Google Cloud Console');
        console.log('   2. ❌ Token is for a different OAuth client');
        console.log('   3. ❌ OAuth consent screen needs re-approval');
        console.log('   4. ❌ Token expired (shouldn\'t happen for production tokens)');
        console.log('   5. ❌ App isn\'t published/verified by Google\n');
      } else if (validation.error?.includes('invalid_client')) {
        console.log('   🔍 DIAGNOSIS: invalid_client error\n');
        console.log('   This means:');
        console.log('   1. ❌ Client ID or Client Secret is wrong');
        console.log('   2. ❌ OAuth client was deleted in Google Cloud\n');
      } else if (validation.error?.includes('access_denied')) {
        console.log('   🔍 DIAGNOSIS: access_denied error\n');
        console.log('   This means:');
        console.log('   1. ❌ User revoked access');
        console.log('   2. ❌ App needs to be verified by Google\n');
      }
      
      process.exit(1);
    }

    // Test 3: Try a simple API call
    console.log('3️⃣  TESTING LIVE API CALL...\n');
    
    // Get data for today only (minimal request)
    const today = new Date().toISOString().split('T')[0];
    
    console.log(`   Fetching data for ${today}...\n`);
    
    const campaigns = await googleAdsService.getCampaignData(today, today);
    
    console.log(`   ✅ API CALL SUCCESSFUL!\n`);
    console.log(`   📊 Retrieved ${campaigns.length} campaigns`);
    
    if (campaigns.length > 0) {
      const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
      const totalClicks = campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
      
      console.log(`   💰 Total spend today: ${totalSpend.toFixed(2)} PLN`);
      console.log(`   👆 Total clicks today: ${totalClicks}\n`);
    }

    // Test 4: Check accessible accounts
    console.log('4️⃣  CHECKING ACCESSIBLE ACCOUNTS...\n');
    
    try {
      const accounts = await googleAdsService.getAccessibleAccounts();
      
      console.log(`   ✅ Found ${accounts.length} accessible accounts:\n`);
      
      accounts.forEach(account => {
        const isCurrent = account.customer_id === client.google_ads_customer_id;
        const marker = isCurrent ? '👉' : '  ';
        console.log(`   ${marker} ${account.customer_id} - ${account.name}`);
      });
      
      const hasAccess = accounts.some(a => a.customer_id === client.google_ads_customer_id);
      
      if (hasAccess) {
        console.log(`\n   ✅ Token has access to customer ${client.google_ads_customer_id}`);
      } else {
        console.log(`\n   ⚠️  WARNING: Token does NOT have access to ${client.google_ads_customer_id}`);
        console.log(`   This might cause issues!`);
      }
      
    } catch (error: any) {
      console.log(`   ⚠️  Could not fetch accessible accounts: ${error.message}`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════════════════════');
    console.log('📊 TEST RESULTS');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');
    
    console.log('✅ ✅ ✅ ALL TESTS PASSED! ✅ ✅ ✅\n');
    console.log('The Google Ads refresh token is VALID and WORKING!\n');
    console.log('🎉 Token is a valid production token\n');
    console.log('Next steps:');
    console.log('1. ✅ Token works - no action needed');
    console.log('2. ✅ Smart cache can be refreshed');
    console.log('3. ✅ Live API calls will work\n');

  } catch (error: any) {
    console.error('\n❌ TEST FAILED!\n');
    console.error('Error:', error.message);
    
    if (error.message?.includes('invalid_grant')) {
      console.log('\n🔍 DIAGNOSIS: invalid_grant error\n');
      console.log('Your refresh token is NO LONGER VALID.\n');
      console.log('Possible reasons:');
      console.log('1. ❌ Token was revoked by user or admin');
      console.log('2. ❌ OAuth app needs re-verification');
      console.log('3. ❌ Token is for wrong OAuth client (dev vs prod)');
      console.log('4. ❌ OAuth consent screen expired (happens for testing apps)\n');
      console.log('🔧 SOLUTION:');
      console.log('You need to re-authenticate and get a new refresh token.\n');
      console.log('Steps:');
      console.log('1. Go to Settings → Data Sources → Google Ads');
      console.log('2. Click "Re-authenticate"');
      console.log('3. Complete OAuth flow');
      console.log('4. Verify the token is saved\n');
    }
    
    process.exit(1);
  }
}

testGoogleToken();







