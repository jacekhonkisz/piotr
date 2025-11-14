/**
 * Comprehensive trace of Meta Tables API call flow
 * This will show us exactly where the data gets lost
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function traceMetaTablesAPI() {
  console.log('🔍 COMPREHENSIVE META TABLES API TRACE');
  console.log('======================================\n');

  try {
    // Step 1: Get client
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .ilike('name', '%belmonte%')
      .single();

    console.log('Step 1: Client found');
    console.log('  ID:', client.id);
    console.log('  Name:', client.name);

    // Step 2: Check period detection
    const dateRange = { start: '2025-11-01', end: '2025-11-30' };
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    const isCurrentMonth = 
      startDate.getFullYear() === currentYear &&
      startDate.getMonth() === currentMonth &&
      endDate >= now;

    console.log('\nStep 2: Period detection');
    console.log('  Date range:', dateRange.start, 'to', dateRange.end);
    console.log('  Is current month?', isCurrentMonth ? '✅ YES' : '❌ NO');
    console.log('  Should use smart cache?', isCurrentMonth ? '✅ YES' : '❌ NO (will use live API)');

    if (!isCurrentMonth) {
      console.log('\n🚨 PROBLEM FOUND: Period is NOT detected as current month!');
      console.log('   This means API will bypass smart cache and call live Meta API');
      console.log('   Live API might return no data or different data');
      return;
    }

    // Step 3: Check database cache
    console.log('\nStep 3: Check database cache');
    const { data: cacheData } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', client.id)
      .eq('period_id', '2025-11')
      .single();

    if (!cacheData) {
      console.log('  ❌ NO CACHE FOUND');
      return;
    }

    console.log('  ✅ Cache exists');
    console.log('  Last updated:', cacheData.last_updated);
    console.log('  Cache age:', Math.round((Date.now() - new Date(cacheData.last_updated).getTime()) / 1000), 'seconds');

    // Check cache freshness (3 hours = 10800 seconds)
    const cacheAge = Date.now() - new Date(cacheData.last_updated).getTime();
    const isFresh = cacheAge < (3 * 60 * 60 * 1000);
    console.log('  Is fresh (<3 hours)?', isFresh ? '✅ YES' : '❌ NO (stale)');

    if (!isFresh) {
      console.log('\n  ⚠️ Cache is STALE - API might refresh it');
    }

    // Step 4: Check metaTables in cache
    console.log('\nStep 4: Check metaTables in cache');
    if (cacheData.cache_data?.metaTables) {
      console.log('  ✅ metaTables EXISTS in cache');
      console.log('  Demographics:', cacheData.cache_data.metaTables.demographicPerformance?.length || 0);
      console.log('  Placement:', cacheData.cache_data.metaTables.placementPerformance?.length || 0);
      console.log('  Ad Relevance:', cacheData.cache_data.metaTables.adRelevanceResults?.length || 0);
    } else {
      console.log('  ❌ metaTables DOES NOT EXIST in cache');
      console.log('  Available keys:', Object.keys(cacheData.cache_data || {}));
    }

    // Step 5: Simulate what getSmartCacheData returns
    console.log('\nStep 5: Simulate getSmartCacheData() return');
    const smartCacheReturn = {
      success: true,
      data: {
        ...cacheData.cache_data,
        fromCache: true,
        cacheAge: cacheAge
      },
      source: 'cache'
    };

    console.log('  success:', smartCacheReturn.success);
    console.log('  data exists:', !!smartCacheReturn.data);
    console.log('  data.metaTables exists:', !!smartCacheReturn.data.metaTables);
    console.log('  Demographics in return:', smartCacheReturn.data.metaTables?.demographicPerformance?.length || 0);

    // Step 6: Simulate API endpoint condition
    console.log('\nStep 6: Simulate API endpoint condition check');
    const condition = smartCacheReturn.success && smartCacheReturn.data?.metaTables;
    console.log('  if (smartCacheResult.success && smartCacheResult.data?.metaTables)');
    console.log('  Condition result:', condition ? '✅ TRUE (will return cache data)' : '❌ FALSE (will fall back to live API)');

    if (!condition) {
      console.log('\n🚨 PROBLEM: Condition fails!');
      if (!smartCacheReturn.success) {
        console.log('   Reason: smartCacheReturn.success is false');
      }
      if (!smartCacheReturn.data) {
        console.log('   Reason: smartCacheReturn.data is undefined');
      }
      if (!smartCacheReturn.data?.metaTables) {
        console.log('   Reason: smartCacheReturn.data.metaTables is undefined');
      }
    }

    // Step 7: Simulate API response
    console.log('\nStep 7: Simulate API response to frontend');
    if (condition) {
      const apiResponse = {
        success: true,
        data: {
          metaTables: smartCacheReturn.data.metaTables,
          dateRange,
          client: {
            id: client.id,
            name: client.name
          }
        },
        debug: {
          source: 'smart-cache',
          cacheAge: smartCacheReturn.data.cacheAge
        }
      };

      console.log('  ✅ API would return smart cache data:');
      console.log('  - Demographics:', apiResponse.data.metaTables.demographicPerformance?.length || 0);
      console.log('  - Placement:', apiResponse.data.metaTables.placementPerformance?.length || 0);
      console.log('  - Source:', apiResponse.debug.source);
    } else {
      console.log('  ❌ API would fall back to live Meta API');
      console.log('  Live API might return empty data');
    }

    // Final diagnosis
    console.log('\n\n📋 FINAL DIAGNOSIS');
    console.log('==================');
    
    if (isCurrentMonth && cacheData?.cache_data?.metaTables && condition) {
      console.log('✅ Everything SHOULD work:');
      console.log('  - Period is current month');
      console.log('  - Cache has metaTables with', cacheData.cache_data.metaTables.demographicPerformance?.length || 0, 'demographics');
      console.log('  - Condition passes');
      console.log('  - API should return data from cache');
      console.log('');
      console.log('⚠️ BUT frontend is seeing EMPTY arrays!');
      console.log('');
      console.log('Possible causes:');
      console.log('1. API endpoint is NOT actually using getSmartCacheData');
      console.log('2. There is a different code path being executed');
      console.log('3. The live Meta API is being called instead');
      console.log('4. Something is modifying the response between API and frontend');
      console.log('');
      console.log('NEXT STEP: Check the Network tab in browser:');
      console.log('- Find the "fetch-meta-tables" request');
      console.log('- Check the Response tab');
      console.log('- Look for debug.source - is it "smart-cache" or "live-api"?');
    } else {
      if (!isCurrentMonth) {
        console.log('❌ Period NOT current month - API will use live API');
      }
      if (!cacheData?.cache_data?.metaTables) {
        console.log('❌ Cache does NOT have metaTables');
      }
      if (!condition) {
        console.log('❌ API condition fails - will use live API');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  }
}

traceMetaTablesAPI();

