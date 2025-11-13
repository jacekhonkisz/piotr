/**
 * AUDIT ALL META TOKENS
 * 
 * Tests which tokens are working and which are expired.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function auditAllTokens() {
  console.log('🔍 META TOKEN AUDIT');
  console.log('='.repeat(60));
  console.log();

  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, company, name, email, meta_access_token, ad_account_id')
    .order('company');

  if (error || !clients) {
    console.error('❌ Error fetching clients:', error);
    return;
  }

  console.log(`Testing ${clients.length} clients...\n`);

  let workingCount = 0;
  let expiredCount = 0;
  let missingCount = 0;
  let errorCount = 0;

  for (const client of clients) {
    const name = client.company || client.name || client.email;
    console.log(`\n🏢 ${name}`);
    console.log(`   ID: ${client.id}`);

    // Check if token exists
    if (!client.meta_access_token) {
      console.log('   ⚠️  No Meta access token');
      missingCount++;
      continue;
    }

    // Check if ad account exists
    if (!client.ad_account_id) {
      console.log('   ⚠️  No ad account ID');
      missingCount++;
      continue;
    }

    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;

    console.log(`   Account: ${adAccountId}`);
    console.log(`   Token length: ${client.meta_access_token.length} chars`);

    try {
      // Test with a simple campaigns API call
      const url = `https://graph.facebook.com/v21.0/act_${adAccountId}/campaigns?fields=id,name&limit=1&access_token=${client.meta_access_token}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        if (data.error.code === 190 || data.error.error_subcode === 463) {
          console.log('   ❌ TOKEN EXPIRED');
          console.log(`   Error: ${data.error.message.substring(0, 80)}...`);
          expiredCount++;
        } else {
          console.log('   ❌ API ERROR');
          console.log(`   Error: ${data.error.message}`);
          errorCount++;
        }
      } else {
        console.log('   ✅ TOKEN WORKS');
        console.log(`   Campaigns found: ${data.data?.length || 0}`);
        workingCount++;
      }
    } catch (err) {
      console.log('   ❌ NETWORK ERROR');
      console.log(`   Error: ${err instanceof Error ? err.message : 'Unknown'}`);
      errorCount++;
    }
  }

  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total clients: ${clients.length}`);
  console.log(`✅ Working tokens: ${workingCount} (${(workingCount/clients.length*100).toFixed(1)}%)`);
  console.log(`❌ Expired tokens: ${expiredCount} (${(expiredCount/clients.length*100).toFixed(1)}%)`);
  console.log(`⚠️  Missing tokens: ${missingCount} (${(missingCount/clients.length*100).toFixed(1)}%)`);
  console.log(`❌ Other errors: ${errorCount} (${(errorCount/clients.length*100).toFixed(1)}%)`);
  console.log();

  if (workingCount === clients.length) {
    console.log('🎉 ALL TOKENS ARE WORKING!');
  } else if (workingCount > 0) {
    console.log(`⚠️  ${clients.length - workingCount} clients need token refresh`);
  } else {
    console.log('🚨 NO WORKING TOKENS FOUND!');
  }
}

auditAllTokens().then(() => {
  console.log('\n✅ Audit complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});



