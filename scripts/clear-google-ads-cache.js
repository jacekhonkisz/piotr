const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function clearGoogleAdsCache() {
  console.log('🗑️ Clearing Google Ads cache tables...');
  
  // Clear monthly cache
  const { error: monthlyError, count: monthlyCount } = await supabase
    .from('google_ads_current_month_cache')
    .delete()
    .neq('client_id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
  if (monthlyError) {
    console.error('❌ Error clearing monthly cache:', monthlyError);
  } else {
    console.log('✅ Cleared google_ads_current_month_cache');
  }
  
  // Clear weekly cache
  const { error: weeklyError, count: weeklyCount } = await supabase
    .from('google_ads_current_week_cache')
    .delete()
    .neq('client_id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
  if (weeklyError) {
    console.error('❌ Error clearing weekly cache:', weeklyError);
  } else {
    console.log('✅ Cleared google_ads_current_week_cache');
  }
  
  console.log('✅ Cache cleared! Next request will fetch fresh data with fixed conversion values.');
}

clearGoogleAdsCache().catch(console.error);
