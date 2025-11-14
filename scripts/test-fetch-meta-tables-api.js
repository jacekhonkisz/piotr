/**
 * Test the /api/fetch-meta-tables endpoint to see what data is actually returned
 * Date: November 14, 2025
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testFetchMetaTablesAPI() {
  console.log('🔍 TESTING /api/fetch-meta-tables API ENDPOINT');
  console.log('==============================================\n');

  try {
    // Step 1: Get Belmonte client
    console.log('Step 1: Getting Belmonte client...');
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .ilike('name', '%belmonte%')
      .single();

    if (clientError || !client) {
      console.error('❌ Client not found:', clientError);
      return;
    }

    console.log('✅ Client found:', client.id);

    // Step 2: Get auth token (simulate user session)
    console.log('\nStep 2: Creating test auth token...');
    
    // For testing, we'll use the service role key
    // In production, this would be a user session token
    
    // Step 3: Make API call
    console.log('\nStep 3: Calling /api/fetch-meta-tables...');
    
    const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', 'http://localhost:3000').replace('.supabase.co', '')}/api/fetch-meta-tables`;
    
    // Actually, let's simulate what the API does directly using the same code
    const { MetaAPIService } = require('../src/lib/meta-api-optimized.ts');
    const { getSmartCacheData } = require('../src/lib/smart-cache-helper.ts');
    
    console.log('   Testing smart cache access for November 2025...');
    
    const dateRange = {
      start: '2025-11-01',
      end: '2025-11-30'
    };
    
    // Check if this is current month
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    const isCurrentMonth = 
      startDate.getFullYear() === currentYear &&
      startDate.getMonth() === currentMonth &&
      endDate >= now;
    
    console.log('\n   Period Analysis:');
    console.log('   - Is current month:', isCurrentMonth);
    console.log('   - Should use smart cache:', isCurrentMonth);
    
    if (isCurrentMonth) {
      console.log('\n   Attempting to get data from smart cache...');
      
      try {
        const smartCacheResult = await getSmartCacheData(client.id, false, 'meta');
        
        console.log('\n   Smart Cache Result:');
        console.log('   - Success:', smartCacheResult.success);
        console.log('   - Has data:', !!smartCacheResult.data);
        console.log('   - Source:', smartCacheResult.source);
        
        if (smartCacheResult.success && smartCacheResult.data) {
          console.log('\n   Smart Cache Data Structure:');
          console.log('   - Has metaTables:', !!smartCacheResult.data.metaTables);
          
          if (smartCacheResult.data.metaTables) {
            const metaTables = smartCacheResult.data.metaTables;
            console.log('   - Placement count:', metaTables.placementPerformance?.length || 0);
            console.log('   - Demographics count:', metaTables.demographicPerformance?.length || 0);
            console.log('   - Ad relevance count:', metaTables.adRelevanceResults?.length || 0);
            
            if (metaTables.demographicPerformance && metaTables.demographicPerformance.length > 0) {
              console.log('\n   ✅ DEMOGRAPHICS DATA FOUND IN SMART CACHE');
              console.log('   Sample demographics:');
              metaTables.demographicPerformance.slice(0, 3).forEach((demo, idx) => {
                console.log(`      ${idx + 1}. Age: ${demo.age}, Gender: ${demo.gender}, Spend: ${demo.spend}, Impressions: ${demo.impressions}`);
              });
              
              console.log('\n   ✅ THIS DATA SHOULD BE RETURNED BY API');
            } else {
              console.log('\n   ❌ NO DEMOGRAPHICS IN metaTables');
            }
          } else {
            console.log('\n   ❌ NO metaTables KEY IN CACHE DATA');
            console.log('   Available keys:', Object.keys(smartCacheResult.data));
          }
        } else {
          console.log('\n   ❌ Smart cache did not return data');
        }
        
      } catch (cacheError) {
        console.error('\n   ❌ Smart cache error:', cacheError.message);
      }
    } else {
      console.log('\n   Period is not current month, would fetch from live API');
    }
    
    // Step 4: Show what API would return
    console.log('\n\n📋 EXPECTED API RESPONSE');
    console.log('========================');
    console.log('If smart cache has data with metaTables containing demographics,');
    console.log('the API should return:');
    console.log('{');
    console.log('  success: true,');
    console.log('  data: {');
    console.log('    metaTables: {');
    console.log('      placementPerformance: [...],');
    console.log('      demographicPerformance: [...], // <-- Should have 20 records');
    console.log('      adRelevanceResults: [...]');
    console.log('    },');
    console.log('    dateRange: { start: "2025-11-01", end: "2025-11-30" }');
    console.log('  },');
    console.log('  debug: { source: "smart-cache", ... }');
    console.log('}');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
  }
}

testFetchMetaTablesAPI();

