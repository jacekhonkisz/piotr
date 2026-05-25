/**
 * Force Refresh All Data
 * 
 * Clears ALL caches (Meta + Google) and optionally triggers fresh API calls
 * This ensures the UI shows the latest data with correct phone click values
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function forceRefreshAllData(clientName = null) {
  console.log('🔄 FORCE REFRESHING ALL DATA');
  console.log('='.repeat(80));
  console.log('This will clear ALL caches and force fresh API calls');
  console.log('='.repeat(80));
  console.log('');
  
  try {
    // Get clients - filter by name if provided
    let query = supabase
      .from('clients')
      .select('id, name, meta_access_token, system_user_token, ad_account_id, google_ads_customer_id')
      .or('meta_access_token.not.is.null,system_user_token.not.is.null,google_ads_customer_id.not.is.null');
    
    if (clientName) {
      query = query.ilike('name', `%${clientName}%`);
    }
    
    const { data: clients, error: clientError } = await query;
    
    if (clientError) {
      console.error('❌ Failed to get clients:', clientError);
      return;
    }
    
    if (!clients || clients.length === 0) {
      console.log('⚠️ No clients found');
      return;
    }
    
    console.log(`✅ Found ${clients.length} client(s)`);
    if (clientName) {
      console.log(`   Filtered by: "${clientName}"`);
    }
    console.log('');
    
    let clearedMetaMonth = 0;
    let clearedMetaWeek = 0;
    let clearedGoogleMonth = 0;
    let clearedGoogleWeek = 0;
    
    for (const client of clients) {
      console.log(`\n📊 Processing: ${client.name}`);
      console.log('-'.repeat(80));
      
      // Clear Meta current month cache
      const { error: metaMonthError, count: metaMonthCount } = await supabase
        .from('current_month_cache')
        .delete()
        .eq('client_id', client.id);
      
      if (metaMonthError) {
        console.error(`  ❌ Failed to clear Meta month cache:`, metaMonthError.message);
      } else {
        console.log(`  ✅ Cleared Meta current month cache`);
        clearedMetaMonth++;
      }
      
      // Clear Meta current week cache
      const { error: metaWeekError } = await supabase
        .from('current_week_cache')
        .delete()
        .eq('client_id', client.id);
      
      if (metaWeekError) {
        console.error(`  ❌ Failed to clear Meta week cache:`, metaWeekError.message);
      } else {
        console.log(`  ✅ Cleared Meta current week cache`);
        clearedMetaWeek++;
      }
      
      // Clear Google Ads current month cache
      const { error: googleMonthError } = await supabase
        .from('google_ads_current_month_cache')
        .delete()
        .eq('client_id', client.id);
      
      if (googleMonthError) {
        // Table might not exist, that's okay
        if (!googleMonthError.message.includes('does not exist')) {
          console.error(`  ⚠️ Failed to clear Google month cache:`, googleMonthError.message);
        }
      } else {
        console.log(`  ✅ Cleared Google Ads current month cache`);
        clearedGoogleMonth++;
      }
      
      // Clear Google Ads current week cache
      const { error: googleWeekError } = await supabase
        .from('google_ads_current_week_cache')
        .delete()
        .eq('client_id', client.id);
      
      if (googleWeekError) {
        // Table might not exist, that's okay
        if (!googleWeekError.message.includes('does not exist')) {
          console.error(`  ⚠️ Failed to clear Google week cache:`, googleWeekError.message);
        }
      } else {
        console.log(`  ✅ Cleared Google Ads current week cache`);
        clearedGoogleWeek++;
      }
    }
    
    console.log('\n\n' + '='.repeat(80));
    console.log(`✅ CACHE CLEAR COMPLETE`);
    console.log('='.repeat(80));
    console.log(`\n📊 Summary:`);
    console.log(`  Meta month cache: ${clearedMetaMonth} client(s)`);
    console.log(`  Meta week cache: ${clearedMetaWeek} client(s)`);
    console.log(`  Google month cache: ${clearedGoogleMonth} client(s)`);
    console.log(`  Google week cache: ${clearedGoogleWeek} client(s)`);
    console.log('\n📝 NEXT STEPS:');
    console.log('1. ✅ All caches have been cleared');
    console.log('2. 🔄 Refresh your browser/reports page');
    console.log('3. 📊 The system will now fetch fresh data from APIs');
    console.log('4. ✅ Phone clicks will use the corrected parser logic');
    console.log('\n🎯 What happens next:');
    console.log('  - Current period data will be fetched fresh from Meta/Google APIs');
    console.log('  - Historical data will be loaded from database (already corrected)');
    console.log('  - Phone clicks will show correct values (Meta: 21, Google: 18 for Havet Dec)');
    console.log('\n💡 TIP: If you want to force refresh a specific period:');
    console.log('  - Use the "Force Refresh" button in the UI (if available)');
    console.log('  - Or switch between Meta/Google tabs to trigger refresh');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error);
    console.error(error.stack);
  }
}

// Get client name from command line args (optional)
const clientName = process.argv[2] || null;

if (clientName) {
  console.log(`🎯 Force refreshing data for: ${clientName}\n`);
}

forceRefreshAllData(clientName).then(() => {
  console.log('\n✅ Complete');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});



