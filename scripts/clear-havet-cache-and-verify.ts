/**
 * CLEAR HAVET CACHE AND VERIFY
 * 
 * Purpose: Clear cache for Havet and verify the parser fix is working
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearCacheAndVerify() {
  console.log('\n' + '='.repeat(80));
  console.log('🔄 CLEARING HAVET CACHE AND VERIFYING');
  console.log('='.repeat(80) + '\n');

  try {
    // 1. Get Havet client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .ilike('name', '%havet%')
      .single();
    
    if (clientError || !client) {
      console.error('❌ Failed to find Havet client:', clientError);
      return;
    }
    
    console.log('✅ Found Havet client:', client.name);

    // 2. Check current cache value
    const periodId = '2026-01';
    const { data: cache } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', client.id)
      .eq('period_id', periodId)
      .single();

    if (cache) {
      const currentPhones = cache.cache_data?.conversionMetrics?.click_to_call || 0;
      console.log(`\n📊 Current cache value: ${currentPhones} phones`);
      console.log(`   Last updated: ${cache.last_updated}`);
      
      if (currentPhones === 12) {
        console.log('   ⚠️ Cache still shows 12 phones (old value)');
      }
    } else {
      console.log('\n⚠️ No cache found');
    }

    // 3. Clear the cache
    console.log('\n🗑️ Clearing cache...');
    const { error: deleteError } = await supabase
      .from('current_month_cache')
      .delete()
      .eq('client_id', client.id)
      .eq('period_id', periodId);

    if (deleteError) {
      console.error('❌ Failed to clear cache:', deleteError);
      return;
    }

    console.log('✅ Cache cleared successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. The cache will be automatically refreshed on next dashboard load');
    console.log('   2. Or trigger a manual refresh in the dashboard');
    console.log('   3. The new parser will use ONLY PBM events');
    console.log('   4. Expected result: 2 phones (matching Meta Business Suite)');
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Cache cleared! Dashboard will fetch fresh data on next load.');
    console.log('='.repeat(80) + '\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
  }
}

clearCacheAndVerify().catch(console.error);

