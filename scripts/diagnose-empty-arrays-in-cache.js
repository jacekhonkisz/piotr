/**
 * Diagnose why metaTables has empty arrays when returned from API
 * Even though database cache shows 20 demographics
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnoseEmptyArrays() {
  console.log('🔍 DIAGNOSING EMPTY ARRAYS IN API RESPONSE');
  console.log('===========================================\n');

  try {
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .ilike('name', '%belmonte%')
      .single();

    console.log('Client:', client.name);

    // Get cache data
    const { data: cacheData } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', client.id)
      .eq('period_id', '2025-11')
      .single();

    console.log('\n📊 CACHE DATA STRUCTURE ANALYSIS');
    console.log('==================================');

    // Check the exact structure
    const metaTables = cacheData.cache_data.metaTables;
    
    console.log('\n1. metaTables object:', !!metaTables);
    console.log('   Type:', typeof metaTables);
    console.log('   Keys:', metaTables ? Object.keys(metaTables) : 'N/A');

    console.log('\n2. demographicPerformance:');
    console.log('   Exists:', !!metaTables?.demographicPerformance);
    console.log('   Type:', typeof metaTables?.demographicPerformance);
    console.log('   Is Array:', Array.isArray(metaTables?.demographicPerformance));
    console.log('   Length:', metaTables?.demographicPerformance?.length);
    
    if (metaTables?.demographicPerformance?.length > 0) {
      console.log('   ✅ HAS DATA');
      console.log('   First item keys:', Object.keys(metaTables.demographicPerformance[0]));
      console.log('   First item sample:', JSON.stringify(metaTables.demographicPerformance[0]).substring(0, 200) + '...');
    } else {
      console.log('   ❌ EMPTY OR MISSING');
    }

    console.log('\n3. placementPerformance:');
    console.log('   Exists:', !!metaTables?.placementPerformance);
    console.log('   Is Array:', Array.isArray(metaTables?.placementPerformance));
    console.log('   Length:', metaTables?.placementPerformance?.length);

    // Now simulate the spread operation that happens in getSmartCacheData
    console.log('\n\n📊 SIMULATING getSmartCacheData RETURN');
    console.log('========================================');

    const returnData = {
      ...cacheData.cache_data,
      fromCache: true,
      cacheAge: Date.now() - new Date(cacheData.last_updated).getTime()
    };

    console.log('\n1. Spread operation result:');
    console.log('   Has metaTables:', !!returnData.metaTables);
    console.log('   metaTables type:', typeof returnData.metaTables);
    
    console.log('\n2. After spread - demographicPerformance:');
    console.log('   Exists:', !!returnData.metaTables?.demographicPerformance);
    console.log('   Is Array:', Array.isArray(returnData.metaTables?.demographicPerformance));
    console.log('   Length:', returnData.metaTables?.demographicPerformance?.length);

    // Check if spreading is the issue
    console.log('\n\n📊 TESTING DIFFERENT ACCESS METHODS');
    console.log('=====================================');

    console.log('\n1. Direct access:');
    console.log('   cacheData.cache_data.metaTables.demographicPerformance.length:', 
                cacheData.cache_data.metaTables.demographicPerformance.length);

    console.log('\n2. After spread:');
    console.log('   returnData.metaTables.demographicPerformance.length:', 
                returnData.metaTables.demographicPerformance.length);

    console.log('\n3. Reference equality:');
    console.log('   Same array?:', 
                cacheData.cache_data.metaTables.demographicPerformance === returnData.metaTables.demographicPerformance);

    // Test JSON serialization (what happens when API returns it)
    console.log('\n\n📊 TESTING JSON SERIALIZATION');
    console.log('===============================');

    const jsonString = JSON.stringify({
      success: true,
      data: {
        metaTables: returnData.metaTables
      }
    });

    const parsed = JSON.parse(jsonString);
    
    console.log('\n1. After JSON.stringify + parse:');
    console.log('   demographicPerformance length:', parsed.data.metaTables.demographicPerformance.length);
    console.log('   Data preserved?:', parsed.data.metaTables.demographicPerformance.length === 20 ? '✅ YES' : '❌ NO');

    // Final diagnosis
    console.log('\n\n📋 DIAGNOSIS');
    console.log('=============');
    
    if (cacheData.cache_data.metaTables.demographicPerformance.length === 20 &&
        returnData.metaTables.demographicPerformance.length === 20 &&
        parsed.data.metaTables.demographicPerformance.length === 20) {
      console.log('✅ Data is preserved through all transformations');
      console.log('');
      console.log('🚨 THIS MEANS THE PROBLEM IS IN THE API ENDPOINT ITSELF!');
      console.log('');
      console.log('The API endpoint is either:');
      console.log('1. NOT calling getSmartCacheData');
      console.log('2. Calling it but using different data');
      console.log('3. Falling back to live Meta API which returns empty');
      console.log('');
      console.log('Check if the API endpoint has a condition that fails');
      console.log('Look for the logs we added with "API ENDPOINT: About to check condition"');
    } else {
      console.log('❌ Data is being lost somewhere in the transformation');
      if (returnData.metaTables.demographicPerformance.length === 0) {
        console.log('   Lost during spread operation');
      } else if (parsed.data.metaTables.demographicPerformance.length === 0) {
        console.log('   Lost during JSON serialization');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  }
}

diagnoseEmptyArrays();

