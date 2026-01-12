/**
 * RECOLLECT META ADS DATA FOR ALL CLIENTS
 * 
 * This script:
 * 1. Deletes Meta current period caches (month & week) for ALL clients
 * 2. Recollects Meta Ads data for all clients
 * 
 * Usage: npx tsx scripts/recollect-meta-ads-data.ts
 */

// ✅ CRITICAL: Load environment variables FIRST before any imports
import { config } from 'dotenv';
config({ path: '.env.local' });

// Now import modules that depend on environment variables
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔄 RECOLLECTING META ADS DATA FOR ALL CLIENTS\n');
  console.log('='.repeat(70));

  // 1. Calculate current period IDs
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentMonthPeriodId = `${year}-${String(month).padStart(2, '0')}`;
  
  // Current week period ID (format: YYYY-WW, e.g., 2026-W02)
  const d = new Date(Date.UTC(year, month - 1, now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const currentWeekPeriodId = `${year}-W${String(weekNumber).padStart(2, '0')}`;

  console.log(`📅 Current Month Period: ${currentMonthPeriodId}`);
  console.log(`📅 Current Week Period: ${currentWeekPeriodId}\n`);

  // 2. Delete all Meta current period caches
  console.log('1️⃣ DELETING META CURRENT PERIOD CACHES...\n');

  const { error: metaMonthError, count: metaMonthCount } = await supabase
    .from('current_month_cache')
    .delete()
    .eq('period_id', currentMonthPeriodId)
    .select('*', { count: 'exact', head: true });

  console.log(`   ✅ Deleted Meta current month cache: ${metaMonthCount || 0} entries`);

  const { error: metaWeekError, count: metaWeekCount } = await supabase
    .from('current_week_cache')
    .delete()
    .eq('period_id', currentWeekPeriodId)
    .select('*', { count: 'exact', head: true });

  console.log(`   ✅ Deleted Meta current week cache: ${metaWeekCount || 0} entries`);

  if (metaMonthError || metaWeekError) {
    console.error('❌ Error deleting caches:', { metaMonthError, metaWeekError });
  }

  console.log('\n✅ All Meta caches cleared!\n');

  // 3. Get all active clients with Meta Ads
  console.log('2️⃣ FETCHING ALL ACTIVE CLIENTS WITH META ADS...\n');
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name, meta_access_token, system_user_token, ad_account_id, api_status')
    .eq('api_status', 'valid')
    .not('ad_account_id', 'is', null)
    .or('meta_access_token.not.is.null,system_user_token.not.is.null');

  if (clientsError || !clients || clients.length === 0) {
    console.error('❌ Failed to get clients:', clientsError);
    process.exit(1);
  }

  console.log(`✅ Found ${clients.length} active clients with Meta Ads\n`);

  // 4. Recollect Meta data for each client
  console.log('3️⃣ RECOLLECTING META DATA FOR ALL CLIENTS...\n');
  console.log('='.repeat(70));
  console.log('⚠️  This may take several minutes. Processing clients one by one...\n');

  let successCount = 0;
  let errorCount = 0;
  const errors: Array<{ client: string; error: string }> = [];

  // Pre-import the helper to avoid hanging on first dynamic import
  console.log('📦 Loading Meta cache helper...');
  let cacheHelper: any = null;
  try {
    cacheHelper = await import('../src/lib/smart-cache-helper');
    console.log('✅ Helper loaded\n');
  } catch (importError: any) {
    console.error('❌ Failed to load helper:', importError.message);
    console.error('   This might be due to missing environment variables');
    console.error('   Continuing anyway - will try dynamic import per client...\n');
  }

  for (let i = 0; i < clients.length; i++) {
    const client = clients[i];
    console.log(`\n📊 Client ${i + 1}/${clients.length}: ${client.name}`);
    console.log('-'.repeat(70));

    try {
      const metaToken = client.meta_access_token || client.system_user_token;
      if (!metaToken || !client.ad_account_id) {
        console.log('   ⏭️ Skipping - no Meta token or ad account ID');
        continue;
      }

      // Recollect Meta month data
      console.log('   🔵 Recollecting Meta Ads current month data...');
      try {
        const helper = cacheHelper || await import('../src/lib/smart-cache-helper');
        const { fetchFreshCurrentMonthData } = helper;
        await fetchFreshCurrentMonthData(client);
        console.log('   ✅ Meta month data collected');
      } catch (metaError: any) {
        console.log(`   ⚠️ Meta month error: ${metaError.message}`);
        errors.push({ client: client.name, error: `Meta month: ${metaError.message}` });
      }

      // Recollect Meta week data
      console.log('   🔵 Recollecting Meta Ads current week data...');
      try {
        const helper = cacheHelper || await import('../src/lib/smart-cache-helper');
        const { fetchFreshCurrentWeekData } = helper;
        await fetchFreshCurrentWeekData(client);
        console.log('   ✅ Meta week data collected');
      } catch (metaWeekError: any) {
        console.log(`   ⚠️ Meta week error: ${metaWeekError.message}`);
        errors.push({ client: client.name, error: `Meta week: ${metaWeekError.message}` });
      }

      successCount++;
      console.log(`   ✅ Client ${client.name} completed`);

      // Small delay between clients to respect rate limits
      if (i < clients.length - 1) {
        console.log('   ⏳ Waiting 2s before next client...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error: any) {
      errorCount++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`   ❌ Error for ${client.name}: ${errorMsg}`);
      errors.push({ client: client.name, error: errorMsg });
    }
  }

  // 5. Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 RECOLLECTION SUMMARY');
  console.log('='.repeat(70));
  console.log(`   Total Clients: ${clients.length}`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${errorCount}`);

  if (errors.length > 0) {
    console.log('\n   ⚠️ ERRORS:');
    errors.forEach(({ client, error }) => {
      console.log(`      - ${client}: ${error}`);
    });
  }

  // 6. Verify cache was recreated
  console.log('\n4️⃣ VERIFYING CACHES WERE RECREATED...\n');
  
  const { count: metaMonthAfter } = await supabase
    .from('current_month_cache')
    .select('*', { count: 'exact', head: true })
    .eq('period_id', currentMonthPeriodId);

  const { count: metaWeekAfter } = await supabase
    .from('current_week_cache')
    .select('*', { count: 'exact', head: true })
    .eq('period_id', currentWeekPeriodId);

  console.log(`   Meta month cache: ${metaMonthAfter || 0} entries`);
  console.log(`   Meta week cache: ${metaWeekAfter || 0} entries`);

  console.log('\n' + '='.repeat(70));
  console.log('✅ META ADS RECOLLECTION COMPLETE!');
  console.log('='.repeat(70));
  console.log('\n📝 Note: If you see permission errors, check Meta API tokens');
  console.log('   Some clients may need token refresh or permission grants');
}

main().catch((error) => {
  console.error('\n❌ FATAL ERROR:', error);
  if (error instanceof Error) {
    console.error('   Message:', error.message);
    console.error('   Stack:', error.stack);
  }
  process.exit(1);
});

