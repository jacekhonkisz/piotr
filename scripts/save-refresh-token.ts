#!/usr/bin/env tsx

/**
 * SAVE REFRESH TOKEN TO DATABASE
 * 
 * Saves a refresh token directly to the database.
 * Use this if you got the token from OAuth Playground or another source.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function saveRefreshToken(refreshToken: string) {
  console.log('\n💾 SAVING REFRESH TOKEN TO DATABASE\n');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  // Validate token format
  if (!refreshToken || refreshToken.length < 50) {
    console.error('❌ Invalid refresh token format');
    console.error('   Token should be at least 50 characters long');
    process.exit(1);
  }

  console.log('📋 Token Information:\n');
  console.log(`   Length: ${refreshToken.length} characters`);
  console.log(`   Starts with: ${refreshToken.substring(0, 20)}...`);
  console.log(`   Ends with: ...${refreshToken.substring(refreshToken.length - 20)}\n`);

  console.log('💾 Saving to database...\n');

  const { error } = await supabase
    .from('system_settings')
    .update({ 
      value: refreshToken,
      updated_at: new Date().toISOString()
    })
    .eq('key', 'google_ads_manager_refresh_token');

  if (error) {
    console.error('❌ Database update failed:', error);
    console.log('\n📋 MANUAL UPDATE REQUIRED:\n');
    console.log('Run this SQL in Supabase:\n');
    console.log(`UPDATE system_settings`);
    console.log(`SET value = '${refreshToken}',`);
    console.log(`    updated_at = NOW()`);
    console.log(`WHERE key = 'google_ads_manager_refresh_token';\n`);
    process.exit(1);
  }

  console.log('✅ Refresh token saved to database successfully!\n');

  // Verify it was saved
  const { data: verify } = await supabase
    .from('system_settings')
    .select('value, updated_at')
    .eq('key', 'google_ads_manager_refresh_token')
    .single();

  if (verify) {
    console.log('✅ Verification: Token confirmed in database\n');
    console.log(`   Updated at: ${new Date(verify.updated_at).toLocaleString()}\n`);
  }

  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🧪 NEXT STEP - VERIFY TOKEN WORKS:');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  
  console.log('Run this command to test the token:');
  console.log('   npx tsx scripts/test-google-token-live.ts\n');
  
  console.log('Expected output:');
  console.log('   ✅ ✅ ✅ ALL TESTS PASSED! ✅ ✅ ✅\n');
}

// Get token from command line argument
const refreshToken = process.argv[2];

if (!refreshToken) {
  console.error('❌ Missing refresh token\n');
  console.log('USAGE:');
  console.log('  npx tsx scripts/save-refresh-token.ts "YOUR_REFRESH_TOKEN"\n');
  console.log('EXAMPLE:');
  console.log('  npx tsx scripts/save-refresh-token.ts "1//048KJkXfnyITCCgYIARAAGAQSNWF..."\n');
  console.log('💡 TIP: Make sure to wrap the token in quotes!\n');
  console.log('To get the refresh token:');
  console.log('  1. Complete OAuth flow in OAuth Playground');
  console.log('  2. Copy the "refresh_token" value from the JSON response');
  console.log('  3. Run this script with the token\n');
  process.exit(1);
}

saveRefreshToken(refreshToken);

