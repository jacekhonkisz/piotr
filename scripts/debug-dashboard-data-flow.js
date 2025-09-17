/**
 * Debug Dashboard Data Flow
 * Find out why cached data isn't showing in dashboard
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BELMONTE_CLIENT_ID = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';

async function debugDataFlow() {
  console.log('🔍 DEBUGGING DASHBOARD DATA FLOW');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  try {
    // Step 1: Check current date and what dashboard calculates
    const now = new Date();
    console.log('📅 Current date:', now.toISOString());
    console.log('📅 Current year:', now.getFullYear());
    console.log('📅 Current month:', now.getMonth() + 1);
    console.log('');

    // Step 2: Calculate dashboard date range
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const dashboardStartDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const dashboardEndDate = new Date(year, month, 0).toISOString().split('T')[0];
    
    console.log('📊 Dashboard calculates date range:');
    console.log(`   Start: ${dashboardStartDate}`);
    console.log(`   End: ${dashboardEndDate}`);
    console.log('');

    // Step 3: Check what's in cache
    const { data: cacheData, error: cacheError } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', BELMONTE_CLIENT_ID)
      .eq('period_id', '2025-08');

    console.log('💾 Cache query results:');
    if (cacheError) {
      console.log(`   ❌ Error: ${cacheError.message}`);
    } else if (cacheData && cacheData.length > 0) {
      console.log(`   ✅ Found ${cacheData.length} cache entries`);
      cacheData.forEach((entry, index) => {
        console.log(`   ${index + 1}. Period: ${entry.period_id}`);
        console.log(`      Spend: ${entry.cache_data?.stats?.totalSpend} PLN`);
        console.log(`      Updated: ${entry.last_updated}`);
      });
    } else {
      console.log('   ❌ No cache entries found');
    }
    console.log('');

    // Step 4: Test API call simulation
    console.log('🔧 Simulating API call...');
    
    // This is what the dashboard should be calling
    const testApiCall = {
      clientId: BELMONTE_CLIENT_ID,
      dateRange: {
        start: dashboardStartDate,
        end: dashboardEndDate
      },
      forceFresh: false
    };
    
    console.log('📡 API call parameters:');
    console.log(JSON.stringify(testApiCall, null, 2));
    console.log('');

    // Step 5: Check if date logic matches
    console.log('🔍 Date logic analysis:');
    
    const isCurrentMonth = (start, end) => {
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      
      const startParts = start.split('-');
      const endParts = end.split('-');
      
      const startYear = parseInt(startParts[0]);
      const startMonth = parseInt(startParts[1]);
      const endYear = parseInt(endParts[0]);
      const endMonth = parseInt(endParts[1]);
      
      return startYear === currentYear && 
             startMonth === currentMonth &&
             endYear === currentYear && 
             endMonth === currentMonth;
    };
    
    const shouldUseCache = isCurrentMonth(dashboardStartDate, dashboardEndDate);
    console.log(`   Should use current month cache: ${shouldUseCache}`);
    
    if (!shouldUseCache) {
      console.log('   ❌ ISSUE: Dashboard date range doesn\'t match current month!');
      console.log(`   Expected: 2025-08`);
      console.log(`   Calculated: ${year}-${String(month).padStart(2, '0')}`);
    }
    console.log('');

    // Step 6: Check if there's data in other tables
    console.log('🔍 Checking alternative data sources...');
    
    const { data: summaryData } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', BELMONTE_CLIENT_ID)
      .eq('summary_type', 'monthly')
      .order('summary_date', { ascending: false })
      .limit(3);

    if (summaryData && summaryData.length > 0) {
      console.log('📊 Campaign summaries found:');
      summaryData.forEach((summary, index) => {
        console.log(`   ${index + 1}. Date: ${summary.summary_date}, Spend: ${summary.total_spend} PLN`);
      });
    } else {
      console.log('   ❌ No campaign summaries found');
    }
    console.log('');

    // Summary
    console.log('🎯 DIAGNOSIS SUMMARY:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (shouldUseCache && cacheData && cacheData.length > 0) {
      console.log('✅ Cache data exists and should be used');
      console.log('❌ PROBLEM: Dashboard is not displaying cached data');
      console.log('');
      console.log('🔧 POSSIBLE CAUSES:');
      console.log('1. API response format mismatch');
      console.log('2. Frontend component not processing data correctly');
      console.log('3. Data transformation issue in dashboard');
      console.log('4. Dashboard calling wrong API endpoint');
    } else if (!shouldUseCache) {
      console.log('❌ PROBLEM: Date logic prevents cache usage');
      console.log('🔧 FIX: Adjust date calculation logic');
    } else if (!cacheData || cacheData.length === 0) {
      console.log('❌ PROBLEM: No cache data available');
      console.log('🔧 FIX: Verify cache was properly stored');
    }

  } catch (error) {
    console.error('💥 ERROR in data flow debugging:', error);
  }
}

// Run debug
if (require.main === module) {
  debugDataFlow();
}

module.exports = { debugDataFlow }; 