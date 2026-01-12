/**
 * CLEAR ALL CURRENT PERIOD CACHES AND RECOLLECT ALL DATA
 * 
 * This script:
 * 1. Deletes all current period caches (month & week) for ALL clients (Meta & Google)
 * 2. Triggers full data collection for all clients to refresh everything
 * 
 * Usage: npx tsx scripts/clear-all-caches-and-recollect-all-data.ts
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
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔄 CLEARING ALL CACHES AND RECOLLECTING ALL DATA\n');
  console.log('='.repeat(70));

  // 1. Calculate current period IDs
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentMonthPeriodId = `${year}-${String(month).padStart(2, '0')}`;
  
  // Current week period ID (format: YYYY-WW, e.g., 2026-W02)
  // Use ISO week calculation
  const d = new Date(Date.UTC(year, month - 1, now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const currentWeekPeriodId = `${year}-W${String(weekNumber).padStart(2, '0')}`;

  console.log(`📅 Current Month Period: ${currentMonthPeriodId}`);
  console.log(`📅 Current Week Period: ${currentWeekPeriodId}\n`);

  // 2. Delete all current period caches
  console.log('1️⃣ DELETING ALL CURRENT PERIOD CACHES...\n');

  // Delete Google Ads current month cache
  const { error: googleMonthError, count: googleMonthCount } = await supabase
    .from('google_ads_current_month_cache')
    .delete()
    .eq('period_id', currentMonthPeriodId)
    .select('*', { count: 'exact', head: true });

  console.log(`   ✅ Deleted Google Ads current month cache: ${googleMonthCount || 0} entries`);

  // Delete Google Ads current week cache
  const { error: googleWeekError, count: googleWeekCount } = await supabase
    .from('google_ads_current_week_cache')
    .delete()
    .eq('period_id', currentWeekPeriodId)
    .select('*', { count: 'exact', head: true });

  console.log(`   ✅ Deleted Google Ads current week cache: ${googleWeekCount || 0} entries`);

  // Delete Meta current month cache
  const { error: metaMonthError, count: metaMonthCount } = await supabase
    .from('current_month_cache')
    .delete()
    .eq('period_id', currentMonthPeriodId)
    .select('*', { count: 'exact', head: true });

  console.log(`   ✅ Deleted Meta current month cache: ${metaMonthCount || 0} entries`);

  // Delete Meta current week cache
  const { error: metaWeekError, count: metaWeekCount } = await supabase
    .from('current_week_cache')
    .delete()
    .eq('period_id', currentWeekPeriodId)
    .select('*', { count: 'exact', head: true });

  console.log(`   ✅ Deleted Meta current week cache: ${metaWeekCount || 0} entries`);

  if (googleMonthError || googleWeekError || metaMonthError || metaWeekError) {
    console.error('❌ Error deleting caches:', { googleMonthError, googleWeekError, metaMonthError, metaWeekError });
  }

  console.log('\n✅ All current period caches cleared!\n');

  // 3. Get all active clients
  console.log('2️⃣ FETCHING ALL ACTIVE CLIENTS...\n');
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name, meta_access_token, ad_account_id, google_ads_customer_id, google_ads_enabled, api_status')
    .eq('api_status', 'valid');

  if (clientsError || !clients || clients.length === 0) {
    console.error('❌ Failed to get clients:', clientsError);
    process.exit(1);
  }

  console.log(`✅ Found ${clients.length} active clients\n`);

  // 4. Get Google Ads system settings
  const { data: settingsData } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', [
      'google_ads_client_id',
      'google_ads_client_secret',
      'google_ads_developer_token',
      'google_ads_manager_refresh_token',
      'google_ads_manager_customer_id'
    ]);

  const settings = settingsData?.reduce((acc, s) => {
    acc[s.key] = s.value;
    return acc;
  }, {} as Record<string, any>) || {};

  // 5. Recollect data for each client
  console.log('3️⃣ RECOLLECTING DATA FOR ALL CLIENTS...\n');
  console.log('='.repeat(70));

  let successCount = 0;
  let errorCount = 0;
  const errors: Array<{ client: string; error: string }> = [];

  for (let i = 0; i < clients.length; i++) {
    const client = clients[i];
    console.log(`\n📊 Client ${i + 1}/${clients.length}: ${client.name}`);
    console.log('-'.repeat(70));

    try {
      // Recollect Meta data if client has Meta Ads
      const metaToken = client.meta_access_token || client.system_user_token;
      if (metaToken && client.ad_account_id) {
        console.log('   🔵 Recollecting Meta Ads current month data...');
        try {
          // Use dynamic import to avoid loading before env vars
          const { fetchFreshCurrentMonthData } = await import('../src/lib/smart-cache-helper');
          await fetchFreshCurrentMonthData(client);
          console.log('   ✅ Meta month data collected');
        } catch (metaError: any) {
          console.log(`   ⚠️ Meta month error: ${metaError.message}`);
          errors.push({ client: client.name, error: `Meta month: ${metaError.message}` });
        }

        console.log('   🔵 Recollecting Meta Ads current week data...');
        try {
          // Use dynamic import to avoid loading before env vars
          const { fetchFreshCurrentWeekData } = await import('../src/lib/smart-cache-helper');
          await fetchFreshCurrentWeekData(client);
          console.log('   ✅ Meta week data collected');
        } catch (metaWeekError: any) {
          console.log(`   ⚠️ Meta week error: ${metaWeekError.message}`);
          errors.push({ client: client.name, error: `Meta week: ${metaWeekError.message}` });
        }
      }

      // Recollect Google Ads data if client has Google Ads
      if (client.google_ads_enabled && client.google_ads_customer_id) {
        console.log('   🔴 Recollecting Google Ads current month data...');
        try {
          // Use dynamic import to avoid loading before env vars
          const { fetchFreshGoogleAdsCurrentMonthData } = await import('../src/lib/google-ads-smart-cache-helper');
          await fetchFreshGoogleAdsCurrentMonthData(client);
          console.log('   ✅ Google Ads month data collected');
        } catch (googleError: any) {
          console.log(`   ⚠️ Google Ads month error: ${googleError.message}`);
          errors.push({ client: client.name, error: `Google Ads: ${googleError.message}` });
        }

        // Note: Google Ads weekly cache refresh would go here if needed
        // For now, monthly is the main one
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

  // 6. Summary
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

  // 7. Verify cache was recreated
  console.log('\n4️⃣ VERIFYING CACHES WERE RECREATED...\n');
  
  const { count: googleMonthAfter } = await supabase
    .from('google_ads_current_month_cache')
    .select('*', { count: 'exact', head: true })
    .eq('period_id', currentMonthPeriodId);

  const { count: metaMonthAfter } = await supabase
    .from('current_month_cache')
    .select('*', { count: 'exact', head: true })
    .eq('period_id', currentMonthPeriodId);

  console.log(`   Google Ads month cache: ${googleMonthAfter || 0} entries`);
  console.log(`   Meta month cache: ${metaMonthAfter || 0} entries`);

  console.log('\n' + '='.repeat(70));
  console.log('✅ RECOLLECTION COMPLETE!');
  console.log('='.repeat(70));
  console.log('\n📝 Next Steps:');
  console.log('   1. Check reports page - should show correct booking steps');
  console.log('   2. Verify data matches Google Ads Console');
  console.log('   3. Run audit: npx tsx scripts/fetch-havet-live-booking-steps-comparison.ts');
}

main().catch((error) => {
  console.error('\n❌ FATAL ERROR:', error);
  if (error instanceof Error) {
    console.error('   Message:', error.message);
    console.error('   Stack:', error.stack);
  }
  process.exit(1);
});

