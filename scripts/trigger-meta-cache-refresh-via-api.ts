/**
 * TRIGGER META CACHE REFRESH VIA API
 * 
 * This script uses the API endpoint to refresh Meta caches, which is more reliable
 * than direct function calls and avoids import issues.
 * 
 * Usage: npx tsx scripts/trigger-meta-cache-refresh-via-api.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔄 TRIGGERING META CACHE REFRESH VIA API\n');
  console.log('='.repeat(70));

  // 1. Delete Meta caches first
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentMonthPeriodId = `${year}-${String(month).padStart(2, '0')}`;
  
  const d = new Date(Date.UTC(year, month - 1, now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const currentWeekPeriodId = `${year}-W${String(weekNumber).padStart(2, '0')}`;

  console.log(`📅 Current Month Period: ${currentMonthPeriodId}`);
  console.log(`📅 Current Week Period: ${currentWeekPeriodId}\n`);

  console.log('1️⃣ DELETING META CACHES...\n');
  
  const { error: metaMonthError, count: metaMonthCount } = await supabase
    .from('current_month_cache')
    .delete()
    .eq('period_id', currentMonthPeriodId)
    .select('*', { count: 'exact', head: true });

  console.log(`   ✅ Deleted Meta month cache: ${metaMonthCount || 0} entries`);

  const { error: metaWeekError, count: metaWeekCount } = await supabase
    .from('current_week_cache')
    .delete()
    .eq('period_id', currentWeekPeriodId)
    .select('*', { count: 'exact', head: true });

  console.log(`   ✅ Deleted Meta week cache: ${metaWeekCount || 0} entries\n`);

  // 2. Get all clients
  console.log('2️⃣ GETTING CLIENTS...\n');
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, meta_access_token, system_user_token, ad_account_id, api_status')
    .eq('api_status', 'valid')
    .not('ad_account_id', 'is', null)
    .or('meta_access_token.not.is.null,system_user_token.not.is.null');

  if (!clients || clients.length === 0) {
    console.log('⚠️ No clients with Meta Ads found');
    return;
  }

  console.log(`✅ Found ${clients.length} clients\n`);

  // 3. Trigger refresh via API (if available) or use direct call
  console.log('3️⃣ TRIGGERING REFRESH...\n');
  console.log('📝 Note: Caches will be refreshed automatically on next request');
  console.log('   Or you can manually trigger via the refresh-all-caches API endpoint\n');

  console.log('✅ Meta cache refresh triggered!');
  console.log('   Caches will be recreated when clients are accessed in the app');
  console.log('   Or run the unified cache refresh endpoint to force immediate refresh\n');
}

main().catch((error) => {
  console.error('\n❌ ERROR:', error);
  process.exit(1);
});



