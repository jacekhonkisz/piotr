/**
 * Backfill Google Ads Weekly Data
 * 
 * This script:
 * 1. Clears Google Ads weekly cache
 * 2. Triggers collection of last 52 weeks of Google Ads data
 * 3. Ensures all weeks have proper booking steps from API
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function backfillWeeklyData() {
  console.log('🔄 Starting Google Ads weekly data backfill...\n');
  
  // Step 1: Clear weekly cache
  console.log('🗑️ Step 1: Clearing Google Ads weekly cache...');
  const { error: deleteError } = await supabase
    .from('google_ads_current_week_cache')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
  
  if (deleteError) {
    console.error('❌ Failed to clear cache:', deleteError);
    process.exit(1);
  }
  console.log('✅ Weekly cache cleared\n');
  
  // Step 2: Get all clients with Google Ads
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
  
  console.log(`✅ Found ${clients.length} clients with Google Ads\n`);
  
  // Step 3: Trigger weekly collection for each client
  console.log('🔄 Step 3: Triggering weekly data collection...\n');
  
  for (const client of clients) {
    console.log(`📊 Processing: ${client.name} (${client.id})`);
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      
      // Trigger background weekly collection
      const response = await fetch(`${apiUrl}/api/admin/collect-weekly-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          clientId: client.id,
          platform: 'google',
          weeks: 52 // Collect last 52 weeks
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`   ❌ Failed: ${response.status} - ${errorText}`);
        continue;
      }
      
      const result = await response.json();
      if (result.success) {
        console.log(`   ✅ Success: ${result.message || 'Weekly collection triggered'}`);
      } else {
        console.error(`   ❌ Error: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message || error}`);
    }
    
    // Small delay between clients
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n✅ Weekly data backfill triggered for all clients');
  console.log('📊 Note: Collection runs in background, may take several minutes');
}

backfillWeeklyData()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

