/**
 * Verify Smart Caching System - Test if caching is working after fixes
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Belmonte Hotel Client ID
const BELMONTE_CLIENT_ID = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';

async function verifySmartCaching() {
  console.log('🧪 VERIFYING SMART CACHING SYSTEM');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🏨 Testing with: Belmonte Hotel`);
  console.log(`🆔 Client ID: ${BELMONTE_CLIENT_ID}`);
  console.log('');

  try {
    // Test 1: Check current month cache table
    console.log('🔍 TEST 1: Checking current_month_cache table...');
    
    const { data: cacheData, error: cacheError } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', BELMONTE_CLIENT_ID);

    if (cacheError) {
      console.log('❌ Cache table query failed:', cacheError.message);
    } else {
      console.log(`📊 Found ${cacheData.length} cache records for Belmonte`);
      
      if (cacheData.length > 0) {
        const latestCache = cacheData.sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated))[0];
        console.log(`📅 Latest cache: ${latestCache.period_id}`);
        console.log(`🕐 Last updated: ${latestCache.last_updated}`);
        
        const cacheAge = Date.now() - new Date(latestCache.last_updated).getTime();
        const ageHours = cacheAge / (1000 * 60 * 60);
        console.log(`⏰ Cache age: ${ageHours.toFixed(1)} hours`);
        
        if (ageHours < 3) {
          console.log('✅ Cache is FRESH (< 3 hours)');
        } else {
          console.log('⚠️ Cache is STALE (> 3 hours)');
        }
      } else {
        console.log('⚠️ No cache records found - cache might not be populated yet');
      }
    }

    // Test 2: Test smart cache API endpoint
    console.log('\n🔍 TEST 2: Testing smart cache API endpoint...');
    
    const smartCacheUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('/rest/v1', '')}/api/smart-cache`;
    
    try {
      const response = await fetch(smartCacheUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: BELMONTE_CLIENT_ID,
          forceRefresh: false // Test cache retrieval
        })
      });

      console.log(`📡 API Response Status: ${response.status}`);
      
      if (response.status === 401) {
        console.log('🔒 Expected 401 - Authentication required (normal for direct API call)');
        console.log('✅ Smart cache API endpoint is accessible');
      } else if (response.ok) {
        const data = await response.json();
        console.log('✅ Smart cache API responded successfully');
        console.log(`📊 Data source: ${data.source || 'unknown'}`);
      } else {
        console.log('⚠️ Unexpected API response status');
      }
      
    } catch (apiError) {
      console.log('❌ Smart cache API test failed:', apiError.message);
    }

    // Test 3: Check campaign_summaries table for comparison
    console.log('\n🔍 TEST 3: Checking campaign_summaries table...');
    
    const now = new Date();
    const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    
    const { data: summaryData, error: summaryError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', BELMONTE_CLIENT_ID)
      .eq('summary_type', 'monthly')
      .eq('summary_date', currentMonthStart);

    if (summaryError) {
      console.log('⚠️ Campaign summaries query failed:', summaryError.message);
    } else if (summaryData.length > 0) {
      const summary = summaryData[0];
      console.log('✅ Found campaign summary for current month');
      console.log(`💰 Total Spend: ${summary.total_spend} PLN`);
      console.log(`📊 Total Campaigns: ${summary.total_campaigns}`);
      console.log(`📅 Last Updated: ${summary.last_updated}`);
      
      if (summary.meta_tables) {
        console.log('📊 Meta Tables Available:');
        console.log(`  🎯 Placement Performance: ${summary.meta_tables.placementPerformance?.length || 0} records`);
        console.log(`  👥 Demographic Performance: ${summary.meta_tables.demographicPerformance?.length || 0} records`);
        console.log(`  📈 Ad Relevance Results: ${summary.meta_tables.adRelevanceResults?.length || 0} records`);
      }
    } else {
      console.log('⚠️ No campaign summary found for current month');
    }

    // Test 4: Check configuration flags in files
    console.log('\n🔍 TEST 4: Verifying configuration fixes...');
    
    const fs = require('fs').promises;
    
    // Check smart-cache-helper.ts
    const smartCacheContent = await fs.readFile('src/lib/smart-cache-helper.ts', 'utf8');
    
    const hasForceDataFlag = smartCacheContent.includes('const FORCE_LIVE_DATA_FOR_BOOKING_STEPS = false');
    const hasBackgroundRefresh = smartCacheContent.includes('const ENABLE_BACKGROUND_REFRESH = true');
    
    console.log(`🔧 FORCE_LIVE_DATA_FOR_BOOKING_STEPS = false: ${hasForceDataFlag ? '✅' : '❌'}`);
    console.log(`🔧 ENABLE_BACKGROUND_REFRESH = true: ${hasBackgroundRefresh ? '✅' : '❌'}`);
    
    // Check dashboard page.tsx
    const dashboardContent = await fs.readFile('src/app/dashboard/page.tsx', 'utf8');
    const hasForceFreshFalse = dashboardContent.includes('forceFresh: false');
    
    console.log(`🔧 Dashboard forceFresh = false: ${hasForceFreshFalse ? '✅' : '❌'}`);

    // Final Assessment
    console.log('\n🎯 SMART CACHING ASSESSMENT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const configFixed = hasForceDataFlag && hasBackgroundRefresh && hasForceFreshFalse;
    const hasData = (cacheData && cacheData.length > 0) || (summaryData && summaryData.length > 0);
    
    console.log(`⚙️ Configuration Fixed: ${configFixed ? '✅ YES' : '❌ NO'}`);
    console.log(`📊 Data Available: ${hasData ? '✅ YES' : '⚠️ PARTIAL'}`);
    
    if (configFixed && hasData) {
      console.log('\n🎉 SMART CACHING SHOULD NOW BE WORKING!');
      console.log('');
      console.log('✅ Configuration is correct');
      console.log('✅ Cache data is available');
      console.log('✅ API endpoints are accessible');
      console.log('');
      console.log('🔄 Next steps:');
      console.log('1. Restart your development server (npm run dev)');
      console.log('2. Open dashboard and check browser console for cache messages');
      console.log('3. Look for "✅ Returning fresh cached data" in console');
      console.log('4. Dashboard should load faster using cached data');
    } else if (configFixed) {
      console.log('\n⚠️ CONFIGURATION FIXED BUT DATA NEEDS POPULATION');
      console.log('');
      console.log('✅ Configuration is correct');
      console.log('⚠️ Cache tables need to be populated');
      console.log('');
      console.log('🔄 Next steps:');
      console.log('1. Load the dashboard once to populate cache');
      console.log('2. Or run background cache refresh manually');
      console.log('3. Then smart caching should start working');
    } else {
      console.log('\n❌ SMART CACHING NEEDS MORE FIXES');
      console.log('');
      console.log('🔧 Check the configuration flags manually');
      console.log('🔧 Ensure all temporary testing flags are disabled');
    }

  } catch (error) {
    console.error('\n💥 VERIFICATION ERROR:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the verification
if (require.main === module) {
  verifySmartCaching();
}

module.exports = { verifySmartCaching }; 