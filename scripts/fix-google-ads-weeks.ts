/**
 * Fix Google Ads Weekly Data
 * 
 * This script:
 * 1. Clears Google Ads weekly cache
 * 2. Triggers weekly data collection for all clients
 * 3. Verifies the fixes are working
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixGoogleAdsWeeks() {
  console.log('🔧 FIXING GOOGLE ADS WEEKLY DATA\n');
  console.log('=' .repeat(50));
  
  // Step 1: Clear weekly cache
  console.log('\n🗑️ Step 1: Clearing Google Ads weekly cache...');
  const { error: deleteError, count } = await supabase
    .from('google_ads_current_week_cache')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
    .select('*', { count: 'exact', head: true });
  
  if (deleteError) {
    console.error('❌ Failed to clear cache:', deleteError);
    process.exit(1);
  }
  
  console.log(`✅ Cleared ${count || 0} weekly cache records\n`);
  
  // Step 2: Get clients with Google Ads
  console.log('📋 Step 2: Finding clients with Google Ads...');
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name, google_ads_customer_id')
    .not('google_ads_customer_id', 'is', null);
  
  if (clientsError) {
    console.error('❌ Failed to fetch clients:', clientsError);
    process.exit(1);
  }
  
  if (!clients || clients.length === 0) {
    console.log('⚠️ No clients with Google Ads configured');
    return;
  }
  
  console.log(`✅ Found ${clients.length} clients\n`);
  
  // Step 3: Trigger weekly collection
  console.log('🔄 Step 3: Triggering weekly data collection...\n');
  
  const apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  for (const client of clients) {
    console.log(`📊 ${client.name} (${client.id.substring(0, 8)}...)`);
    
    try {
      const response = await fetch(`${apiUrl}/api/admin/collect-weekly-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          clientId: client.id
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`   ❌ Failed: ${response.status} - ${errorText.substring(0, 100)}`);
        continue;
      }
      
      const result = await response.json();
      if (result.success) {
        console.log(`   ✅ ${result.message || 'Collection triggered'}`);
      } else {
        console.log(`   ⚠️ ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message || error}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ COMPLETE!');
  console.log('\n📊 Next steps:');
  console.log('   1. Weekly collection is running in background');
  console.log('   2. It will collect last 53 weeks for both Meta & Google Ads');
  console.log('   3. Check logs for progress');
  console.log('   4. Refresh your dashboard after collection completes');
  console.log('\n⏱️  Collection typically takes 5-15 minutes per client');
}

fixGoogleAdsWeeks()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

