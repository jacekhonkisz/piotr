/**
 * Force Refresh Placement Data
 * 
 * This script clears the cache so fresh data with placement names will be fetched
 * 
 * Run: node scripts/force-refresh-placement-data.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function forceRefreshPlacementData() {
  console.log('🔄 FORCE REFRESHING PLACEMENT DATA');
  console.log('='.repeat(80));
  
  try {
    // Get all clients with Meta Ads
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, name, meta_access_token, ad_account_id')
      .not('meta_access_token', 'is', null)
      .not('ad_account_id', 'is', null);
    
    if (clientError) {
      console.error('❌ Failed to get clients:', clientError);
      return;
    }
    
    console.log(`✅ Found ${clients.length} clients with Meta Ads`);
    console.log('');
    
    for (const client of clients) {
      console.log(`\n📊 Processing: ${client.name}`);
      console.log('-'.repeat(80));
      
      // Clear current month cache for this client
      const { error: deleteError } = await supabase
        .from('current_month_cache')
        .delete()
        .eq('client_id', client.id);
      
      if (deleteError) {
        console.error(`  ❌ Failed to clear cache:`, deleteError.message);
      } else {
        console.log(`  ✅ Cleared current month cache`);
      }
    }
    
    console.log('\n\n' + '='.repeat(80));
    console.log('✅ CACHE CLEARED FOR ALL CLIENTS');
    console.log('='.repeat(80));
    console.log('\n📝 NEXT STEPS:');
    console.log('1. Restart your dev server: npm run dev');
    console.log('2. Refresh the browser page (Cmd+Shift+R or Ctrl+Shift+R)');
    console.log('3. Navigate to "Najlepsze Miejsca Docelowe"');
    console.log('4. The app will fetch fresh data with placement names');
    console.log('\n🎯 Fresh data will have readable placement names!');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error);
    console.error(error.stack);
  }
}

forceRefreshPlacementData().then(() => {
  console.log('\n✅ Complete');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Failed:', error);
  process.exit(1);
});

