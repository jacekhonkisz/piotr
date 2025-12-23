/**
 * CHECK META TOKEN STATUS FOR ALL CLIENTS
 * 
 * This script validates Meta API tokens for all clients to identify
 * which ones have expired or invalid tokens.
 * 
 * Run with: npx tsx scripts/check-meta-tokens.ts
 */

import { createClient } from '@supabase/supabase-js';
import { MetaAPIServiceOptimized } from '../src/lib/meta-api-optimized';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Client {
  id: string;
  name: string;
  meta_access_token?: string;
  system_user_token?: string;
  ad_account_id?: string;
  api_status?: string;
}

async function checkAllMetaTokens() {
  console.log('🔍 Checking Meta API Token Status for All Clients');
  console.log('='.repeat(70));
  
  // Fetch all clients with Meta credentials
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, meta_access_token, system_user_token, ad_account_id, api_status')
    .not('meta_access_token', 'is', null);
  
  if (error) {
    console.error('❌ Query error:', error);
    return;
  }
  
  console.log(`\n📊 Found ${clients?.length || 0} clients with Meta credentials\n`);
  
  const results: { name: string; status: string; tokenType: string; error?: string }[] = [];
  
  for (const client of (clients || []) as Client[]) {
    const metaToken = client.system_user_token || client.meta_access_token;
    const tokenType = client.system_user_token ? 'System User (permanent)' : 'Access Token (60-day)';
    
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`📌 ${client.name}`);
    console.log(`   Token type: ${tokenType}`);
    console.log(`   Ad Account: ${client.ad_account_id || 'NOT SET'}`);
    
    if (!metaToken) {
      console.log(`   ❌ No token available`);
      results.push({ name: client.name, status: '❌ NO TOKEN', tokenType });
      continue;
    }
    
    if (!client.ad_account_id) {
      console.log(`   ⚠️ No ad account ID`);
      results.push({ name: client.name, status: '⚠️ NO AD ACCOUNT', tokenType });
      continue;
    }
    
    try {
      const metaService = new MetaAPIServiceOptimized(metaToken);
      const validation = await metaService.validateToken();
      
      if (validation.valid) {
        console.log(`   ✅ Token VALID`);
        results.push({ name: client.name, status: '✅ VALID', tokenType });
      } else {
        console.log(`   ❌ Token INVALID: ${validation.error}`);
        results.push({ name: client.name, status: '❌ INVALID', tokenType, error: validation.error });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log(`   ❌ Error: ${errorMsg}`);
      results.push({ name: client.name, status: '❌ ERROR', tokenType, error: errorMsg });
    }
    
    // Small delay between checks
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // Summary table
  console.log(`\n\n${'='.repeat(70)}`);
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  console.log('\n');
  
  console.log('| Client Name                      | Status      | Token Type            |');
  console.log('|----------------------------------|-------------|----------------------|');
  
  for (const r of results) {
    const name = r.name.padEnd(32).substring(0, 32);
    const status = r.status.padEnd(11);
    const tokenType = r.tokenType.substring(0, 20).padEnd(20);
    console.log(`| ${name} | ${status} | ${tokenType} |`);
  }
  
  const validCount = results.filter(r => r.status === '✅ VALID').length;
  const invalidCount = results.filter(r => r.status.includes('❌')).length;
  const warningCount = results.filter(r => r.status.includes('⚠️')).length;
  
  console.log(`\n📈 Statistics:`);
  console.log(`   ✅ Valid tokens: ${validCount}`);
  console.log(`   ❌ Invalid/Error: ${invalidCount}`);
  console.log(`   ⚠️ Missing config: ${warningCount}`);
  console.log(`   📊 Total: ${results.length}`);
  
  // List clients that need attention
  const needsAttention = results.filter(r => r.status !== '✅ VALID');
  if (needsAttention.length > 0) {
    console.log(`\n🚨 CLIENTS NEEDING ATTENTION:`);
    for (const c of needsAttention) {
      console.log(`   - ${c.name}: ${c.status}${c.error ? ` (${c.error})` : ''}`);
    }
  }
}

checkAllMetaTokens()
  .then(() => {
    console.log('\n🏁 Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('🔥 Fatal error:', error);
    process.exit(1);
  });

