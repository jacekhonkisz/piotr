/**
 * Force Refresh Phone Clicks Cache
 * 
 * Clears current month/week cache to force fresh fetch with fixed phone click parser
 * This will test the fix for phone clicks accumulation bug
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function forceRefreshPhoneClicks() {
  console.log('🔄 FORCE REFRESHING PHONE CLICKS CACHE');
  console.log('='.repeat(80));
  console.log('This will clear cache and force fresh fetch with fixed parser');
  console.log('='.repeat(80));
  console.log('');
  
  try {
    // Get all clients with Meta Ads
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, name, meta_access_token, system_user_token, ad_account_id')
      .or('meta_access_token.not.is.null,system_user_token.not.is.null')
      .not('ad_account_id', 'is', null);
    
    if (clientError) {
      console.error('❌ Failed to get clients:', clientError);
      return;
    }
    
    console.log(`✅ Found ${clients.length} clients with Meta Ads`);
    console.log('');
    
    let clearedCount = 0;
    
    for (const client of clients) {
      console.log(`\n📊 Processing: ${client.name}`);
      console.log('-'.repeat(80));
      
      // Clear current month cache
      const { error: monthError } = await supabase
        .from('current_month_cache')
        .delete()
        .eq('client_id', client.id);
      
      if (monthError) {
        console.error(`  ❌ Failed to clear month cache:`, monthError.message);
      } else {
        console.log(`  ✅ Cleared current month cache`);
        clearedCount++;
      }
      
      // Clear current week cache
      const { error: weekError } = await supabase
        .from('current_week_cache')
        .delete()
        .eq('client_id', client.id);
      
      if (weekError) {
        console.error(`  ❌ Failed to clear week cache:`, weekError.message);
      } else {
        console.log(`  ✅ Cleared current week cache`);
      }
    }
    
    console.log('\n\n' + '='.repeat(80));
    console.log(`✅ CACHE CLEARED FOR ${clearedCount} CLIENTS`);
    console.log('='.repeat(80));
    console.log('\n📝 NEXT STEPS:');
    console.log('1. The cache has been cleared');
    console.log('2. Next time you load the dashboard, it will fetch fresh data');
    console.log('3. The fixed parser will now correctly accumulate phone clicks');
    console.log('4. Phone clicks should match between current and past periods');
    console.log('\n🔍 TO TEST:');
    console.log('- Open the dashboard and check phone click numbers');
    console.log('- Compare with Meta Business Suite to verify accuracy');
    console.log('- Check that multiple phone click actions are now counted correctly');
    console.log('\n🎯 The fix ensures:');
    console.log('  ✅ Multiple click_to_call_call_confirm actions are accumulated (not overwritten)');
    console.log('  ✅ All phone click variants are captured');
    console.log('  ✅ Phone clicks match between current and past periods');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error);
    console.error(error.stack);
  }
}

forceRefreshPhoneClicks().then(() => {
  console.log('\n✅ Complete');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});



