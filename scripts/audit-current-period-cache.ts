/**
 * Audit Current Period Cache
 * 
 * This script checks if the current period cache contains API values
 * and identifies any fallback to recalculation
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function auditCurrentPeriodCache() {
  console.log('🔍 AUDIT: Current Period Cache - API Values\n');
  console.log('='.repeat(70));

  try {
    // Get current month info
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const periodId = `${year}-${String(month).padStart(2, '0')}`;

    console.log(`\n📅 Current Period: ${periodId} (${year}-${String(month).padStart(2, '0')})`);

    // 1. Check current_month_cache
    console.log('\n1️⃣ Checking current_month_cache...');
    const { data: monthCache, error: monthError } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('period_id', periodId)
      .order('last_updated', { ascending: false });

    if (monthError) {
      console.error('❌ Error fetching month cache:', monthError);
      return;
    }

    if (!monthCache || monthCache.length === 0) {
      console.log('   ⚠️  No cache entries found for current month');
      console.log('   ✅ This is OK - system will fetch fresh data with API values');
      return;
    }

    console.log(`   Found ${monthCache.length} cache entries\n`);

    for (const cache of monthCache) {
      const cacheData = cache.cache_data as any;
      const stats = cacheData?.stats || {};
      
      // Get client name
      const { data: client } = await supabase
        .from('clients')
        .select('name')
        .eq('id', cache.client_id)
        .single();

      console.log(`   📊 Client: ${client?.name || cache.client_id}`);
      console.log(`      Period: ${cache.period_id}`);
      console.log(`      Last Updated: ${new Date(cache.last_updated).toLocaleString('pl-PL')}`);
      
      // Check if API values exist
      const hasApiCtr = stats.averageCtr !== undefined && stats.averageCtr !== null;
      const hasApiCpc = stats.averageCpc !== undefined && stats.averageCpc !== null;
      
      console.log(`      Has API CTR: ${hasApiCtr ? '✅' : '❌'} (${stats.averageCtr || 'N/A'})`);
      console.log(`      Has API CPC: ${hasApiCpc ? '✅' : '❌'} (${stats.averageCpc || 'N/A'})`);
      
      // Calculate what the value would be if recalculated
      const calculatedCtr = stats.totalImpressions > 0 
        ? (stats.totalClicks / stats.totalImpressions) * 100 
        : 0;
      const calculatedCpc = stats.totalClicks > 0 
        ? stats.totalSpend / stats.totalClicks 
        : 0;
      
      console.log(`      Calculated CTR: ${calculatedCtr.toFixed(2)}%`);
      console.log(`      Calculated CPC: ${calculatedCpc.toFixed(2)} zł`);
      
      // Check if values match (indicating recalculation)
      const ctrMatches = Math.abs((stats.averageCtr || 0) - calculatedCtr) < 0.01;
      const cpcMatches = Math.abs((stats.averageCpc || 0) - calculatedCpc) < 0.01;
      
      if (ctrMatches && cpcMatches && hasApiCtr && hasApiCpc) {
        console.log(`      ⚠️  WARNING: API values match calculated values - may be recalculated!`);
      } else if (!hasApiCtr || !hasApiCpc) {
        console.log(`      ❌ MISSING: API values not in cache - will fallback to calculation`);
      } else {
        console.log(`      ✅ GOOD: API values differ from calculated - using API values`);
        console.log(`         Difference: CTR ${Math.abs((stats.averageCtr || 0) - calculatedCtr).toFixed(2)}%, CPC ${Math.abs((stats.averageCpc || 0) - calculatedCpc).toFixed(2)} zł`);
      }
      
      console.log('');
    }

    // 2. Check current_week_cache
    console.log('\n2️⃣ Checking current_week_cache...');
    const { data: weekCache, error: weekError } = await supabase
      .from('current_week_cache')
      .select('*')
      .gte('period_start', `${year}-${String(month).padStart(2, '0')}-01`)
      .lt('period_start', `${year}-${String(month + 1).padStart(2, '0')}-01`)
      .order('last_updated', { ascending: false });

    if (weekError) {
      console.error('❌ Error fetching week cache:', weekError);
    } else if (weekCache && weekCache.length > 0) {
      console.log(`   Found ${weekCache.length} cache entries`);
      // Similar analysis for week cache
    } else {
      console.log('   No week cache entries found');
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Audit complete');

  } catch (error: any) {
    console.error('\n❌ Error during audit:', error);
    process.exit(1);
  }
}

auditCurrentPeriodCache()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });



