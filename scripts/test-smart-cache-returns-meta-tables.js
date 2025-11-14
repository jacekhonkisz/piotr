/**
 * Test what getSmartCacheData actually returns
 * This will show us if metaTables is included or not
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testSmartCacheReturn() {
  console.log('🔍 TESTING WHAT SMART CACHE RETURNS');
  console.log('===================================\n');

  try {
    // Get Belmonte client
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .ilike('name', '%belmonte%')
      .single();

    console.log('Client:', client.name);
    console.log('Client ID:', client.id);

    // Check what's actually IN the cache (database)
    console.log('\n📊 Step 1: Check DATABASE cache directly...');
    const { data: cacheData } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', client.id)
      .eq('period_id', '2025-11')
      .single();

    if (cacheData?.cache_data?.metaTables) {
      console.log('✅ Database cache HAS metaTables:');
      console.log('   - Demographics:', cacheData.cache_data.metaTables.demographicPerformance?.length || 0);
      console.log('   - Placement:', cacheData.cache_data.metaTables.placementPerformance?.length || 0);
    } else {
      console.log('❌ Database cache does NOT have metaTables');
      console.log('   Available keys:', Object.keys(cacheData?.cache_data || {}));
    }

    // Now simulate what the API does
    console.log('\n📊 Step 2: Simulate API endpoint behavior...');
    
    // The API spreads cache_data like this:
    const returnedData = {
      ...cacheData.cache_data,
      fromCache: true,
      cacheAge: Date.now() - new Date(cacheData.last_updated).getTime()
    };

    console.log('\n✅ What would be RETURNED to API:');
    console.log('   Has metaTables key:', !!returnedData.metaTables);
    console.log('   Available keys:', Object.keys(returnedData));
    
    if (returnedData.metaTables) {
      console.log('   ✅ metaTables IS included in return');
      console.log('   - Demographics:', returnedData.metaTables.demographicPerformance?.length || 0);
      console.log('   - Placement:', returnedData.metaTables.placementPerformance?.length || 0);
    } else {
      console.log('   ❌ metaTables is NOT included in return');
    }

    // Check what the API endpoint receives
    console.log('\n📊 Step 3: Check what API endpoint does with it...');
    console.log('   The API endpoint code:');
    console.log('   if (smartCacheResult.success && smartCacheResult.data?.metaTables) {');
    console.log('      metaTables = smartCacheResult.data.metaTables;');
    console.log('   }');
    console.log('');
    console.log('   smartCacheResult.data would be:', !!returnedData ? 'EXISTS' : 'undefined');
    console.log('   smartCacheResult.data.metaTables would be:', returnedData.metaTables ? 'EXISTS' : 'undefined');

    // Final diagnosis
    console.log('\n\n📋 DIAGNOSIS');
    console.log('============');
    
    if (cacheData?.cache_data?.metaTables && returnedData.metaTables) {
      console.log('✅ metaTables exists in database cache');
      console.log('✅ metaTables IS included when cache data is spread');
      console.log('✅ API endpoint SHOULD receive metaTables');
      console.log('');
      console.log('❓ BUT frontend is receiving EMPTY arrays...');
      console.log('');
      console.log('This means either:');
      console.log('1. The API endpoint is NOT calling getSmartCacheData');
      console.log('2. The API endpoint is calling it but the condition fails');
      console.log('3. Something is modifying the data between smart cache and API response');
      console.log('');
      console.log('NEXT STEP: Check server logs when you reload the page');
      console.log('Look for: "🔍 SMART CACHE RETURNING" message');
    } else if (cacheData?.cache_data?.metaTables && !returnedData.metaTables) {
      console.log('✅ metaTables exists in database cache');
      console.log('❌ metaTables is NOT included when spreading cache_data');
      console.log('');
      console.log('🔧 FIX: The spread operator is not including metaTables');
      console.log('This is the bug!');
    } else {
      console.log('❌ metaTables does NOT exist in database cache');
      console.log('The cache needs to be populated first');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  }
}

testSmartCacheReturn();

