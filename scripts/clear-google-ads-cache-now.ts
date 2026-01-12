/**
 * Quick script to clear Google Ads cache
 * Run with: npx tsx scripts/clear-google-ads-cache-now.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearCache() {
  const now = new Date();
  const currentPeriodId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  console.log('🗑️ Clearing Google Ads cache...');
  console.log(`📅 Period: ${currentPeriodId}\n`);
  
  // Get count before deletion
  const { count: beforeCount } = await supabase
    .from('google_ads_current_month_cache')
    .select('*', { count: 'exact', head: true })
    .eq('period_id', currentPeriodId);
  
  console.log(`📊 Found ${beforeCount || 0} cache records to delete\n`);
  
  // Delete cache
  const { error, data } = await supabase
    .from('google_ads_current_month_cache')
    .delete()
    .eq('period_id', currentPeriodId)
    .select();
  
  if (error) {
    console.error('❌ Error clearing cache:', error);
    process.exit(1);
  }
  
  console.log(`✅ Cleared ${data?.length || 0} cache records\n`);
  console.log('🔄 Next steps:');
  console.log('   1. Refresh your dashboard');
  console.log('   2. Or click the refresh button');
  console.log('   3. Fresh data will be fetched from Google Ads API');
  console.log('   4. Booking steps will come directly from API (no daily_kpi_data)\n');
}

clearCache()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

