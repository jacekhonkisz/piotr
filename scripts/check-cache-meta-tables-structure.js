/**
 * Check the exact structure of metaTables in the cache
 * Date: November 14, 2025
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCacheMetaTablesStructure() {
  console.log('🔍 CHECKING CACHE META TABLES STRUCTURE');
  console.log('=========================================\n');

  try {
    // Get Belmonte client
    const { data: client } = await supabase
      .from('clients')
      .select('id, name')
      .ilike('name', '%belmonte%')
      .single();

    if (!client) {
      console.error('❌ Client not found');
      return;
    }

    console.log('Client:', client.name, '(' + client.id + ')');

    // Get cache data
    const { data: cacheData } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', client.id)
      .eq('period_id', '2025-11')
      .single();

    if (!cacheData) {
      console.log('❌ No cache found for November 2025');
      return;
    }

    console.log('\n✅ Cache found');
    console.log('Last updated:', cacheData.last_updated);
    console.log('Cache age:', Math.round((Date.now() - new Date(cacheData.last_updated).getTime()) / 1000), 'seconds');

    const cache_data = cacheData.cache_data;

    console.log('\n📊 CACHE DATA TOP-LEVEL STRUCTURE:');
    console.log('Available keys:', Object.keys(cache_data));

    // Check for metaTables
    if (cache_data.metaTables) {
      console.log('\n✅ metaTables EXISTS in cache');
      console.log('metaTables keys:', Object.keys(cache_data.metaTables));
      
      const metaTables = cache_data.metaTables;
      
      console.log('\n📊 META TABLES CONTENTS:');
      console.log('- placementPerformance:', Array.isArray(metaTables.placementPerformance) ? `${metaTables.placementPerformance.length} records` : typeof metaTables.placementPerformance);
      console.log('- demographicPerformance:', Array.isArray(metaTables.demographicPerformance) ? `${metaTables.demographicPerformance.length} records` : typeof metaTables.demographicPerformance);
      console.log('- adRelevanceResults:', Array.isArray(metaTables.adRelevanceResults) ? `${metaTables.adRelevanceResults.length} records` : typeof metaTables.adRelevanceResults);
      
      // Check demographics in detail
      if (metaTables.demographicPerformance && Array.isArray(metaTables.demographicPerformance)) {
        const demographics = metaTables.demographicPerformance;
        console.log('\n🎯 DEMOGRAPHICS DETAIL:');
        console.log('Total records:', demographics.length);
        
        if (demographics.length > 0) {
          console.log('\nFirst 3 records:');
          demographics.slice(0, 3).forEach((demo, idx) => {
            console.log(`\n${idx + 1}. Record:`, JSON.stringify(demo, null, 2));
          });
          
          console.log('\nAll available fields:', Object.keys(demographics[0]));
          console.log('\n✅ DEMOGRAPHICS DATA IS PROPERLY STORED IN CACHE');
          console.log('\n⚠️ The /api/fetch-meta-tables endpoint SHOULD return this data!');
        } else {
          console.log('❌ Demographics array exists but is empty');
        }
      } else {
        console.log('\n❌ demographicPerformance is not an array or does not exist');
        console.log('Type:', typeof metaTables.demographicPerformance);
        console.log('Value:', metaTables.demographicPerformance);
      }
    } else {
      console.log('\n❌ metaTables DOES NOT EXIST in cache');
      console.log('This means smart cache does not have meta tables data');
    }

    // Final diagnosis
    console.log('\n\n📋 DIAGNOSIS');
    console.log('============');
    
    if (cache_data.metaTables && 
        cache_data.metaTables.demographicPerformance && 
        Array.isArray(cache_data.metaTables.demographicPerformance) && 
        cache_data.metaTables.demographicPerformance.length > 0) {
      
      console.log('✅ Demographics data EXISTS in cache (', cache_data.metaTables.demographicPerformance.length, 'records)');
      console.log('✅ Cache structure is correct');
      console.log('');
      console.log('❓ QUESTION: Why is the UI showing "No data"?');
      console.log('');
      console.log('Possible causes:');
      console.log('1. The /api/fetch-meta-tables endpoint is not reading from smart cache correctly');
      console.log('2. The endpoint is falling back to live API which returns no data');
      console.log('3. The frontend MetaAdsTables component is not receiving the data');
      console.log('4. There is a mismatch in date format or period detection logic');
      console.log('');
      console.log('RECOMMENDED NEXT STEP:');
      console.log('Check browser console logs when loading the page to see what data the frontend receives');
      
    } else {
      console.log('❌ Demographics data does NOT exist in cache');
      console.log('The cache needs to be populated with metaTables data');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  }
}

checkCacheMetaTablesStructure();

