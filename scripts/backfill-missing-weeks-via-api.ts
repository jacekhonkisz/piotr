/**
 * Backfill Missing Google Ads Weeks via API
 * 
 * Alternative approach: Uses the existing weekly collection API
 * This is simpler and uses the same logic as background collector
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

async function backfillViaAPI() {
  console.log('🔄 BACKFILLING MISSING GOOGLE ADS WEEKS VIA API\n');
  console.log('='.repeat(60));
  
  // Step 1: Get all clients with Google Ads
  console.log('\n1️⃣ Finding clients with Google Ads...');
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name, google_ads_customer_id')
    .not('google_ads_customer_id', 'is', null);
  
  if (clientsError || !clients || clients.length === 0) {
    console.error('❌ No clients with Google Ads found');
    process.exit(1);
  }
  
  console.log(`✅ Found ${clients.length} clients\n`);
  
  // Step 2: Trigger weekly collection for each client
  console.log('2️⃣ Triggering weekly collection for all clients...\n');
  
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
    
    // Small delay between clients
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ BACKFILL TRIGGERED!');
  console.log('\n📊 Collection runs in background');
  console.log('⏱️  Check progress with: npx tsx scripts/monitor-google-ads-weekly-collection.ts');
}

backfillViaAPI()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Backfill failed:', error);
    process.exit(1);
  });

