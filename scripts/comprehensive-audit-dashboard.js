/**
 * Comprehensive Dashboard Data Flow Audit
 * Tests every step to find where the data flow is breaking
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BELMONTE_CLIENT_ID = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';

async function comprehensiveAudit() {
  console.log('🔍 COMPREHENSIVE DASHBOARD DATA FLOW AUDIT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  try {
    // Test 1: Check date range logic like API does
    console.log('🔍 TEST 1: Date Range Logic (like API)...');
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    
    console.log(`📅 Date range: ${startDate} to ${endDate}`);
    
    // Test isCurrentMonth logic exactly like API
    function isCurrentMonth(start, end) {
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
    }
    
    const isCurrentMonthRequest = isCurrentMonth(startDate, endDate);
    console.log(`📊 Is current month request: ${isCurrentMonthRequest}`);
    
    if (!isCurrentMonthRequest) {
      console.log('❌ ISSUE FOUND: API doesn\'t recognize this as current month!');
      console.log(`   Current: ${year}-${month}`);
      console.log(`   Request: ${startDate} to ${endDate}`);
    }

    // Test 2: Check cache existence exactly like API
    console.log('\n🔍 TEST 2: Cache Query (exactly like API)...');
    
    const periodId = `${year}-${String(month).padStart(2, '0')}`;
    console.log(`📅 Looking for period_id: ${periodId}`);
    
    const { data: cacheQueryResult, error: cacheQueryError } = await supabase
      .from('current_month_cache')
      .select('cache_data, last_updated')
      .eq('client_id', BELMONTE_CLIENT_ID)
      .eq('period_id', periodId)
      .maybeSingle();

    console.log(`📊 Cache query result: ${!!cacheQueryResult}`);
    console.log(`❌ Cache query error: ${!!cacheQueryError}`);
    
    if (cacheQueryError) {
      console.log(`   Error: ${cacheQueryError.message}`);
    }
    
    if (cacheQueryResult) {
      const cacheAge = Date.now() - new Date(cacheQueryResult.last_updated).getTime();
      const cacheAgeHours = cacheAge / (1000 * 60 * 60);
      const isCacheFresh = cacheAgeHours < 6;
      
      console.log(`   ✅ Cache found!`);
      console.log(`   🕐 Last updated: ${cacheQueryResult.last_updated}`);
      console.log(`   ⏰ Age: ${cacheAgeHours.toFixed(1)} hours`);
      console.log(`   ✅ Fresh (< 6h): ${isCacheFresh}`);
      
      if (cacheQueryResult.cache_data?.stats?.totalSpend) {
        console.log(`   💰 Spend in cache: ${cacheQueryResult.cache_data.stats.totalSpend} PLN`);
      } else if (cacheQueryResult.cache_data?.totals?.spend) {
        console.log(`   💰 Spend in cache: ${cacheQueryResult.cache_data.totals.spend} PLN`);
      } else {
        console.log(`   ❌ No spend data found in cache!`);
        console.log(`   📊 Cache structure:`, Object.keys(cacheQueryResult.cache_data || {}));
      }
    } else {
      console.log('   ❌ No cache found!');
    }

    // Test 3: Dashboard API call simulation
    console.log('\n🔍 TEST 3: Dashboard API Logic Simulation...');
    
    const dashboardDateRange = {
      start: `${year}-${String(month).padStart(2, '0')}-01`,
      end: new Date(year, month, 0).toISOString().split('T')[0]
    };
    
    console.log(`📅 Dashboard date range: ${dashboardDateRange.start} to ${dashboardDateRange.end}`);
    console.log(`🔧 Force fresh: false (dashboard setting)`);
    
    // Simulate the API logic path
    console.log('\n🔄 Simulating API logic path...');
    
    const simulatedIsCurrentMonth = isCurrentMonth(dashboardDateRange.start, dashboardDateRange.end);
    const forceFresh = false;
    
    console.log(`📊 Current month check: ${simulatedIsCurrentMonth}`);
    console.log(`🔧 Force fresh: ${forceFresh}`);
    
    if (simulatedIsCurrentMonth && !forceFresh) {
      console.log('✅ Should enter current month cache logic');
      
      if (cacheQueryResult) {
        const cacheAge = Date.now() - new Date(cacheQueryResult.last_updated).getTime();
        const cacheAgeHours = cacheAge / (1000 * 60 * 60);
        const isCacheFresh = cacheAgeHours < 6;
        
        if (isCacheFresh) {
          console.log('✅ Should return FRESH cache data');
          console.log(`   Expected response: ${cacheQueryResult.cache_data?.stats?.totalSpend || cacheQueryResult.cache_data?.totals?.spend} PLN`);
        } else {
          console.log('⚠️ Should return STALE cache data');
          console.log(`   Expected response: ${cacheQueryResult.cache_data?.stats?.totalSpend || cacheQueryResult.cache_data?.totals?.spend} PLN`);
        }
      } else {
        console.log('❌ Would return ZERO data (no cache found)');
      }
    } else {
      console.log('❌ Would NOT enter current month cache logic');
      console.log('   This explains why you see zeros!');
    }

    // Test 4: Check if there are multiple cache entries
    console.log('\n🔍 TEST 4: Check all cache entries...');
    
    const { data: allCacheEntries, error: allCacheError } = await supabase
      .from('current_month_cache')
      .select('period_id, last_updated, cache_data')
      .eq('client_id', BELMONTE_CLIENT_ID);

    if (allCacheEntries && allCacheEntries.length > 0) {
      console.log(`📊 Found ${allCacheEntries.length} cache entries:`);
      allCacheEntries.forEach((entry, index) => {
        const spend = entry.cache_data?.stats?.totalSpend || entry.cache_data?.totals?.spend || 'unknown';
        console.log(`   ${index + 1}. Period: ${entry.period_id}, Spend: ${spend} PLN, Updated: ${entry.last_updated}`);
      });
    } else {
      console.log('❌ No cache entries found at all!');
    }

    // Test 5: Test campaign_summaries fallback
    console.log('\n🔍 TEST 5: Check campaign_summaries fallback...');
    
    const { data: summaryData, error: summaryError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', BELMONTE_CLIENT_ID)
      .eq('summary_type', 'monthly')
      .eq('summary_date', startDate);

    if (summaryData && summaryData.length > 0) {
      console.log(`📊 Found campaign summary: ${summaryData[0].total_spend} PLN`);
      console.log(`   This might be what dashboard is showing instead!`);
    } else {
      console.log('❌ No campaign summary found');
    }

    // Test 6: Create a minimal working API response
    console.log('\n🔍 TEST 6: What API should return...');
    
    if (cacheQueryResult) {
      const expectedResponse = {
        success: true,
        data: {
          ...cacheQueryResult.cache_data,
          fromCache: true,
          cacheAge: Date.now() - new Date(cacheQueryResult.last_updated).getTime()
        },
        debug: {
          source: 'database-cache',
          currency: 'PLN'
        }
      };
      
      console.log('✅ Expected API response structure:');
      console.log(`   Success: ${expectedResponse.success}`);
      console.log(`   Spend: ${expectedResponse.data.stats?.totalSpend || expectedResponse.data.totals?.spend} PLN`);
      console.log(`   Source: ${expectedResponse.debug.source}`);
      console.log(`   From cache: ${expectedResponse.data.fromCache}`);
    }

    // Summary
    console.log('\n🎯 AUDIT SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const issues = [];
    
    if (!isCurrentMonthRequest) {
      issues.push('Date range not recognized as current month');
    }
    
    if (!cacheQueryResult) {
      issues.push('No cache data found');
    }
    
    if (cacheQueryError) {
      issues.push(`Cache query error: ${cacheQueryError.message}`);
    }
    
    if (issues.length > 0) {
      console.log('❌ ISSUES FOUND:');
      issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
    } else {
      console.log('✅ No obvious issues found');
      console.log('⚠️ This suggests the problem is in the API logic or routing');
    }
    
    console.log('\n🔧 RECOMMENDED FIXES:');
    if (!isCurrentMonthRequest) {
      console.log('1. Fix date range logic in API');
    }
    if (!cacheQueryResult) {
      console.log('2. Verify cache was stored correctly');
    }
    console.log('3. Add debug logging to API to trace execution path');
    console.log('4. Check if API is using correct database table');

  } catch (error) {
    console.error('\n💥 AUDIT ERROR:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the audit
if (require.main === module) {
  comprehensiveAudit();
}

module.exports = { comprehensiveAudit }; 