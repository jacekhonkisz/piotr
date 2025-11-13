/**
 * DETECT TOKEN TYPE
 * 
 * This script checks if tokens are System User tokens or regular User tokens.
 * System User tokens have different characteristics and NEVER expire.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function detectTokenType() {
  console.log('🔍 TOKEN TYPE DETECTION');
  console.log('='.repeat(80));
  console.log('\nChecking if tokens are System User tokens or User tokens...\n');

  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, company, name, email, meta_access_token, ad_account_id')
    .order('company');

  if (error || !clients) {
    console.error('❌ Error fetching clients:', error);
    return;
  }

  let systemUserCount = 0;
  let userTokenCount = 0;
  let errorCount = 0;
  let expiredCount = 0;

  for (const client of clients) {
    const name = client.company || client.name || client.email;
    console.log(`\n🏢 ${name}`);

    if (!client.meta_access_token) {
      console.log('   ⚠️  No token');
      errorCount++;
      continue;
    }

    try {
      // Test 1: Call /me endpoint
      // System User tokens return app info, User tokens return user info
      const meUrl = `https://graph.facebook.com/v21.0/me?access_token=${client.meta_access_token}`;
      const meResponse = await fetch(meUrl);
      const meData = await meResponse.json();

      if (meData.error) {
        if (meData.error.code === 190) {
          console.log('   ❌ EXPIRED TOKEN');
          console.log(`   Error: ${meData.error.message.substring(0, 80)}`);
          expiredCount++;
          continue;
        } else {
          console.log('   ❌ API ERROR');
          console.log(`   Error: ${meData.error.message}`);
          errorCount++;
          continue;
        }
      }

      // Test 2: Get token debug info
      const debugUrl = `https://graph.facebook.com/v21.0/debug_token?input_token=${client.meta_access_token}&access_token=${client.meta_access_token}`;
      const debugResponse = await fetch(debugUrl);
      const debugData = await debugResponse.json();

      const tokenInfo = debugData.data || {};

      // Analyze token type
      const isSystemUser = tokenInfo.type === 'system_user' || 
                          tokenInfo.granular_scopes?.some((s: any) => s.scope === 'business_management') ||
                          !meData.name; // System tokens don't return name in /me

      console.log('   📊 Token Analysis:');
      console.log(`      Type: ${tokenInfo.type || 'unknown'}`);
      console.log(`      App ID: ${tokenInfo.app_id || 'N/A'}`);
      console.log(`      Issued: ${tokenInfo.issued_at ? new Date(tokenInfo.issued_at * 1000).toLocaleDateString() : 'N/A'}`);
      console.log(`      Expires: ${tokenInfo.expires_at ? new Date(tokenInfo.expires_at * 1000).toLocaleDateString() : 'NEVER (permanent)'}`);
      console.log(`      Scopes: ${tokenInfo.scopes?.join(', ') || 'N/A'}`);

      if (isSystemUser || tokenInfo.type === 'system_user') {
        console.log(`   ✅ SYSTEM USER TOKEN (PERMANENT - NEVER EXPIRES)`);
        systemUserCount++;
      } else {
        console.log(`   ⚠️  USER TOKEN (Expires in ${tokenInfo.expires_at ? Math.floor((tokenInfo.expires_at * 1000 - Date.now()) / (1000 * 60 * 60 * 24)) : '?'} days)`);
        userTokenCount++;
      }

      // Additional details
      if (meData.name) {
        console.log(`   👤 User: ${meData.name}`);
      } else {
        console.log(`   🤖 System User or App Token`);
      }

    } catch (err) {
      console.log(`   ❌ ERROR: ${err instanceof Error ? err.message : 'Unknown'}`);
      errorCount++;
    }
  }

  // Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total clients: ${clients.length}`);
  console.log(`\n✅ System User tokens (PERMANENT): ${systemUserCount}`);
  console.log(`⚠️  User tokens (60-day expiry): ${userTokenCount}`);
  console.log(`❌ Expired tokens: ${expiredCount}`);
  console.log(`⚠️  Errors/Missing: ${errorCount}`);
  console.log();

  if (systemUserCount > 0) {
    console.log('🎉 GREAT NEWS! You DO have System User tokens!');
    console.log(`   ${systemUserCount} client(s) are using permanent tokens that never expire.`);
  } else {
    console.log('⚠️  No System User tokens found.');
    console.log('   All tokens are User tokens that expire after 60 days.');
  }

  if (systemUserCount > 0 && userTokenCount > 0) {
    console.log('\n💡 RECOMMENDATION:');
    console.log('   Some clients use permanent tokens, others use temporary ones.');
    console.log('   Consider migrating all clients to System User tokens for consistency.');
  }

  console.log();
}

detectTokenType().then(() => {
  console.log('✅ Detection complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});



