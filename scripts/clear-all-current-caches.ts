/**
 * Clear All Current Month/Week Caches
 * 
 * This script clears all current month and week caches
 * to force fresh API fetches with account-level insights
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

async function clearAllCurrentCaches() {
  console.log('🧹 CLEARING ALL CURRENT MONTH/WEEK CACHES\n');
  console.log('='.repeat(70));

  try {
    // 1. Get count before deletion
    const { count: monthCount } = await supabase
      .from('current_month_cache')
      .select('*', { count: 'exact', head: true });

    const { count: weekCount } = await supabase
      .from('current_week_cache')
      .select('*', { count: 'exact', head: true });

    console.log(`📊 Current State:`);
    console.log(`   Month Cache Entries: ${monthCount || 0}`);
    console.log(`   Week Cache Entries: ${weekCount || 0}`);

    // 2. Delete all current month cache
    console.log('\n🗑️  Deleting current_month_cache...');
    const { data: monthData, error: monthError } = await supabase
      .from('current_month_cache')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Always true condition to delete all
      .select();

    if (monthError) {
      console.error('❌ Error deleting month cache:', monthError);
    } else {
      console.log(`   ✅ Deleted ${monthData?.length || 0} month cache entries`);
    }

    // 3. Delete all current week cache
    console.log('\n🗑️  Deleting current_week_cache...');
    const { data: weekData, error: weekError } = await supabase
      .from('current_week_cache')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Always true condition to delete all
      .select();

    if (weekError) {
      console.error('❌ Error deleting week cache:', weekError);
    } else {
      console.log(`   ✅ Deleted ${weekData?.length || 0} week cache entries`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Cache cleared successfully!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Refresh the reports page');
    console.log('   2. The system will fetch fresh data with API values');
    console.log('   3. New cache entries will include account-level insights');

  } catch (error: any) {
    console.error('\n❌ Error clearing caches:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

clearAllCurrentCaches()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

