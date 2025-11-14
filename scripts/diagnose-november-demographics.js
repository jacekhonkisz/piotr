/**
 * Diagnostic script to audit why demographics data is not showing for November 2025
 * Date: November 14, 2025
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnoseNovemberDemographics() {
  console.log('🔍 NOVEMBER 2025 DEMOGRAPHICS DIAGNOSTIC');
  console.log('========================================\n');

  try {
    // Step 1: Get Belmonte client data
    console.log('Step 1: Finding Belmonte client...');
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .ilike('name', '%belmonte%')
      .single();

    if (clientError || !client) {
      console.error('❌ Client not found:', clientError);
      return;
    }

    console.log('✅ Client found:', {
      id: client.id,
      name: client.name,
      hasMetaToken: !!client.meta_access_token,
      hasAdAccountId: !!client.ad_account_id
    });

    // Step 2: Check current month cache
    console.log('\nStep 2: Checking current month cache (November 2025)...');
    const { data: cacheData, error: cacheError } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', client.id)
      .eq('period_id', '2025-11');

    if (cacheError) {
      console.error('❌ Cache query error:', cacheError);
    } else if (!cacheData || cacheData.length === 0) {
      console.log('⚠️ NO CACHE FOUND for November 2025');
      console.log('   This means no data has been cached yet for this period.');
    } else {
      const cache = cacheData[0];
      console.log('✅ Cache found:', {
        periodId: cache.period_id,
        lastUpdated: cache.last_updated,
        cacheAge: `${Math.round((Date.now() - new Date(cache.last_updated).getTime()) / 1000)}s`,
        hasCacheData: !!cache.cache_data
      });

      // Analyze meta tables in cache
      if (cache.cache_data?.metaTables) {
        const metaTables = cache.cache_data.metaTables;
        console.log('\n   Meta Tables in Cache:');
        console.log('   - Placement Performance:', metaTables.placementPerformance?.length || 0, 'records');
        console.log('   - Demographic Performance:', metaTables.demographicPerformance?.length || 0, 'records');
        console.log('   - Ad Relevance Results:', metaTables.adRelevanceResults?.length || 0, 'records');

        if (metaTables.demographicPerformance && metaTables.demographicPerformance.length > 0) {
          console.log('\n   ✅ DEMOGRAPHIC DATA EXISTS IN CACHE');
          console.log('   Sample demographics:');
          metaTables.demographicPerformance.slice(0, 3).forEach((demo, idx) => {
            console.log(`      ${idx + 1}. Age: ${demo.age}, Gender: ${demo.gender}, Spend: ${demo.spend}, Impressions: ${demo.impressions}`);
          });
        } else {
          console.log('\n   ❌ NO DEMOGRAPHIC DATA IN CACHE');
        }
      } else {
        console.log('\n   ❌ NO metaTables KEY IN CACHE');
        console.log('   Available keys:', Object.keys(cache.cache_data || {}));
      }
    }

    // Step 3: Test Meta API connection for demographics
    console.log('\n\nStep 3: Testing live Meta API connection for demographics...');
    
    if (!client.meta_access_token) {
      console.log('❌ No Meta access token available');
      return;
    }

    const { MetaAPIService } = require('../src/lib/meta-api-optimized');
    const metaService = new MetaAPIService(client.meta_access_token);

    // Validate token
    console.log('   Validating Meta API token...');
    const tokenValidation = await metaService.validateToken();
    console.log('   Token validation:', tokenValidation);

    if (!tokenValidation.valid) {
      console.log('❌ Meta API token is invalid');
      return;
    }

    // Prepare ad account ID
    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;

    // Test demographic performance fetch for November 2025
    console.log('\n   Fetching demographic data for November 2025...');
    const dateStart = '2025-11-01';
    const dateEnd = '2025-11-30';

    try {
      const demographicData = await metaService.getDemographicPerformance(
        adAccountId,
        dateStart,
        dateEnd
      );

      console.log('\n   ✅ Meta API Response:');
      console.log('   - Records fetched:', demographicData.length);
      
      if (demographicData.length > 0) {
        console.log('   - Sample data:');
        demographicData.slice(0, 3).forEach((demo, idx) => {
          console.log(`      ${idx + 1}. Age: ${demo.age}, Gender: ${demo.gender}, Spend: ${demo.spend}, Clicks: ${demo.clicks}, Impressions: ${demo.impressions}`);
        });
        
        // Analyze data structure
        const firstItem = demographicData[0];
        console.log('\n   - Available fields:', Object.keys(firstItem));
        console.log('\n   - Age groups:', [...new Set(demographicData.map(d => d.age))]);
        console.log('   - Genders:', [...new Set(demographicData.map(d => d.gender))]);
      } else {
        console.log('   ⚠️ Meta API returned ZERO records');
        console.log('   Possible reasons:');
        console.log('   - No active campaigns during this period');
        console.log('   - No demographic data available in Meta system');
        console.log('   - Campaigns not configured to track demographics');
      }

    } catch (apiError) {
      console.error('\n   ❌ Meta API call failed:', apiError.message);
      console.error('   Error details:', apiError);
    }

    // Step 4: Check if smart cache helper is working
    console.log('\n\nStep 4: Testing smart cache helper...');
    const { getSmartCacheData } = require('../src/lib/smart-cache-helper');
    
    try {
      const smartCacheResult = await getSmartCacheData(client.id, false, 'meta');
      console.log('   Smart cache result:', {
        success: smartCacheResult.success,
        hasData: !!smartCacheResult.data,
        hasMetaTables: !!smartCacheResult.data?.metaTables,
        demographicCount: smartCacheResult.data?.metaTables?.demographicPerformance?.length || 0,
        source: smartCacheResult.source
      });
    } catch (smartCacheError) {
      console.error('   ❌ Smart cache error:', smartCacheError.message);
    }

    // Step 5: Check historical period detection logic
    console.log('\n\nStep 5: Checking period detection logic...');
    const now = new Date();
    const startDate = new Date('2025-11-01');
    const endDate = new Date('2025-11-30');
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    const isCurrentMonth = 
      startDate.getFullYear() === currentYear &&
      startDate.getMonth() === currentMonth &&
      endDate >= now;
    
    console.log('   Current date:', now.toISOString().split('T')[0]);
    console.log('   Request start:', startDate.toISOString().split('T')[0]);
    console.log('   Request end:', endDate.toISOString().split('T')[0]);
    console.log('   Is current month?', isCurrentMonth);
    console.log('   Should use smart cache?', isCurrentMonth && !false); // forceRefresh = false

    // Final summary
    console.log('\n\n📋 DIAGNOSTIC SUMMARY');
    console.log('====================');
    console.log('1. Client found:', !!client ? '✅' : '❌');
    console.log('2. Cache exists for Nov 2025:', cacheData && cacheData.length > 0 ? '✅' : '❌');
    console.log('3. Demographics in cache:', cacheData?.[0]?.cache_data?.metaTables?.demographicPerformance?.length > 0 ? '✅' : '❌');
    console.log('4. Meta API token valid:', tokenValidation?.valid ? '✅' : '❌');
    console.log('5. Period detection correct:', isCurrentMonth ? '✅' : '❌');

  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
    console.error(error.stack);
  }
}

diagnoseNovemberDemographics();

