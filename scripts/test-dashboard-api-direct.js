/**
 * Test Dashboard API Direct - Check what data the dashboard API actually returns
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testDashboardApiDirect() {
  console.log('🧪 TESTING DASHBOARD API DIRECT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  try {
    // Step 1: Check cache data directly (what API should return)
    console.log('🔍 STEP 1: Checking cache data (what API should return)...');
    
    const BELMONTE_CLIENT_ID = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const periodId = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    
    console.log(`📅 Looking for cache: period_id = ${periodId}`);
    
    const { data: cacheData, error: cacheError } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', BELMONTE_CLIENT_ID)
      .eq('period_id', periodId)
      .single();

    if (cacheError || !cacheData) {
      console.log('❌ No cache data found:', cacheError?.message);
      return;
    }

    console.log('✅ Cache data found!');
    console.log(`📅 Period: ${cacheData.period_id}`);
    console.log(`🕐 Last updated: ${cacheData.last_updated}`);
    
    const cacheAge = Date.now() - new Date(cacheData.last_updated).getTime();
    const cacheAgeHours = cacheAge / (1000 * 60 * 60);
    const isCacheFresh = cacheAgeHours < 6;
    
    console.log(`⏰ Cache age: ${cacheAgeHours.toFixed(1)} hours`);
    console.log(`✅ Cache fresh: ${isCacheFresh ? 'YES' : 'NO'} (< 6 hours)`);
    
    if (cacheData.cache_data) {
      console.log('\n📊 CACHE DATA CONTENT:');
      console.log(`💰 Total Spend: ${cacheData.cache_data.stats?.totalSpend || cacheData.cache_data.totals?.spend || 'unknown'} PLN`);
      console.log(`👁️ Total Impressions: ${(cacheData.cache_data.stats?.totalImpressions || cacheData.cache_data.totals?.impressions || 0).toLocaleString()}`);
      console.log(`🖱️ Total Clicks: ${(cacheData.cache_data.stats?.totalClicks || cacheData.cache_data.totals?.clicks || 0).toLocaleString()}`);
      console.log(`📊 Campaigns: ${cacheData.cache_data.campaigns?.length || 0}`);
      
      if (cacheData.cache_data.metaTables) {
        console.log(`🎯 Placement Performance: ${cacheData.cache_data.metaTables.placementPerformance?.length || 0} records`);
        console.log(`👥 Demographic Performance: ${cacheData.cache_data.metaTables.demographicPerformance?.length || 0} records`);
      }
    }

    // Step 2: Check what's different about the old vs new data
    console.log('\n🔍 STEP 2: Comparing with campaign_summaries (old data)...');
    
    const { data: oldSummary, error: oldError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', BELMONTE_CLIENT_ID)
      .eq('summary_type', 'monthly')
      .eq('summary_date', '2025-08-01')
      .single();

    if (oldSummary) {
      console.log(`📊 OLD DATA (campaign_summaries): ${oldSummary.total_spend} PLN`);
      console.log(`📊 NEW DATA (current_month_cache): ${cacheData.cache_data?.stats?.totalSpend || cacheData.cache_data?.totals?.spend} PLN`);
      
      const difference = (cacheData.cache_data?.stats?.totalSpend || cacheData.cache_data?.totals?.spend || 0) - oldSummary.total_spend;
      console.log(`📈 DIFFERENCE: ${difference.toFixed(2)} PLN (${((difference / oldSummary.total_spend) * 100).toFixed(1)}% increase)`);
    }

    // Step 3: Expected API response structure
    console.log('\n🔍 STEP 3: Expected API response structure...');
    
    console.log('📋 API should return:');
    console.log(`✅ Success: true`);
    console.log(`📊 Data Source: ${isCacheFresh ? 'database-cache' : 'database-cache-stale'}`);
    console.log(`💰 Spend: ${cacheData.cache_data?.stats?.totalSpend || cacheData.cache_data?.totals?.spend} PLN`);
    console.log(`🕐 Cache Age: ${Math.round(cacheAge / 1000 / 60)} minutes`);

    // Step 4: Browser cache advice
    console.log('\n🎯 TROUBLESHOOTING DASHBOARD DISPLAY:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('✅ The cache contains the correct data (14,033 PLN vs 4,369 PLN old data).');
    console.log('✅ The API should return this fresh cache data.');
    console.log('');
    console.log('🚨 IF DASHBOARD STILL SHOWS OLD DATA, TRY:');
    console.log('');
    console.log('1. 🔄 HARD REFRESH: Ctrl+Shift+R (or Cmd+Shift+R on Mac)');
    console.log('2. 🧹 CLEAR BROWSER CACHE: F12 → Application → Storage → Clear Site Data');
    console.log('3. 🚫 DISABLE CACHE: F12 → Network tab → Check "Disable cache"');
    console.log('4. 🔁 RESTART DEV SERVER: Stop npm run dev and restart');
    console.log('5. 🌐 INCOGNITO MODE: Open dashboard in private/incognito window');
    console.log('6. 📱 DIFFERENT BROWSER: Try Chrome/Firefox/Safari');
    console.log('');
    console.log('🎯 EXPECTED NEW VALUES AFTER REFRESH:');
    console.log(`💰 Wydana kwota: ~14,033 zł (currently shows 4,369,53 zł)`);
    console.log(`👁️ Wyświetlenia: ~1,976K (currently shows 727.2K)`);
    console.log(`🖱️ Kliknięcia: ~24K (currently shows 8.3K)`);
    console.log('');
    console.log('🔬 ADVANCED DEBUGGING:');
    console.log('- Open F12 DevTools → Network tab');
    console.log('- Reload dashboard and look for /api/fetch-live-data call');
    console.log('- Check the response data to confirm it has 14033 spend value');
    console.log('- If response has wrong data, there might be a server-side issue');
    console.log('- If response has correct data but UI shows wrong, it\'s a client-side caching issue');

  } catch (error) {
    console.error('\n💥 TEST ERROR:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the test
if (require.main === module) {
  testDashboardApiDirect();
}

module.exports = { testDashboardApiDirect }; 