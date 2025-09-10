import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import { getSmartCacheData } from '../../../lib/smart-cache-helper';
import logger from '../../../lib/logger';

export async function GET(request: NextRequest) {
  try {
    const clientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
    
    console.log('🧪 FINAL CACHE TEST - Comprehensive Analysis\n');
    
    // 1. Test Meta API directly
    console.log('1️⃣ Testing Meta API directly...');
    const metaApiResponse = await fetch('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        dateRange: { start: '2025-09-01', end: '2025-09-30' },
        platform: 'meta',
        forceFresh: true
      })
    });
    
    const metaApiData = await metaApiResponse.json();
    const metaApiSpend = metaApiData.data?.stats?.totalSpend || 0;
    console.log(`✅ Meta API spend: ${metaApiSpend} PLN`);
    
    // 2. Test smart cache with force refresh
    console.log('\n2️⃣ Testing smart cache with force refresh...');
    const smartCacheForceResult = await getSmartCacheData(clientId, true);
    const smartCacheForceSpend = smartCacheForceResult.data?.stats?.totalSpend || 0;
    console.log(`✅ Smart cache force refresh spend: ${smartCacheForceSpend} PLN`);
    console.log(`   Source: ${smartCacheForceResult.source}`);
    
    // 3. Test smart cache without force refresh
    console.log('\n3️⃣ Testing smart cache without force refresh...');
    const smartCacheNormalResult = await getSmartCacheData(clientId, false);
    const smartCacheNormalSpend = smartCacheNormalResult.data?.stats?.totalSpend || 0;
    const cacheAge = smartCacheNormalResult.data?.cacheAge || 0;
    console.log(`✅ Smart cache normal spend: ${smartCacheNormalSpend} PLN`);
    console.log(`   Source: ${smartCacheNormalResult.source}`);
    console.log(`   Cache age: ${Math.round(cacheAge / 1000 / 60)} minutes`);
    
    // 4. Test standardized data fetcher
    console.log('\n4️⃣ Testing standardized data fetcher...');
    const { StandardizedDataFetcher } = await import('../../../lib/standardized-data-fetcher');
    const standardizedResult = await StandardizedDataFetcher.fetchData({
      clientId,
      dateRange: { start: '2025-09-01', end: '2025-09-30' },
      platform: 'meta',
      reason: 'final-test'
    });
    const standardizedSpend = standardizedResult.data?.stats?.totalSpend || 0;
    console.log(`✅ Standardized fetcher spend: ${standardizedSpend} PLN`);
    console.log(`   Source: ${standardizedResult.debug?.source}`);
    
    // 5. Analysis
    console.log('\n📊 ANALYSIS:');
    console.log('='.repeat(50));
    
    const isMetaApiWorking = metaApiSpend > 5000;
    const isSmartCacheWorking = smartCacheForceSpend > 5000;
    const isCacheFresh = cacheAge < 3 * 60 * 60 * 1000; // 3 hours
    const isStandardizedWorking = standardizedSpend > 5000;
    
    console.log(`Meta API: ${isMetaApiWorking ? '✅ WORKING' : '❌ FAILED'} (${metaApiSpend} PLN)`);
    console.log(`Smart Cache Force: ${isSmartCacheWorking ? '✅ WORKING' : '❌ FAILED'} (${smartCacheForceSpend} PLN)`);
    console.log(`Smart Cache Normal: ${isCacheFresh ? '✅ FRESH' : '❌ STALE'} (${smartCacheNormalSpend} PLN, ${Math.round(cacheAge / 1000 / 60)}min old)`);
    console.log(`Standardized Fetcher: ${isStandardizedWorking ? '✅ WORKING' : '❌ FAILED'} (${standardizedSpend} PLN)`);
    
    // 6. Diagnosis
    console.log('\n🔍 DIAGNOSIS:');
    if (isMetaApiWorking && isSmartCacheWorking && isCacheFresh && isStandardizedWorking) {
      console.log('✅ ALL SYSTEMS WORKING - Cache is properly updated and fresh!');
    } else if (isMetaApiWorking && isSmartCacheWorking && !isCacheFresh) {
      console.log('⚠️  CACHE NOT SAVING - Meta API works, smart cache fetches fresh data, but cache is not being saved');
      console.log('   SOLUTION: RLS policies need to be fixed to allow service role to write to cache');
    } else if (isMetaApiWorking && !isSmartCacheWorking) {
      console.log('❌ SMART CACHE FAILING - Meta API works but smart cache is not fetching fresh data');
    } else if (!isMetaApiWorking) {
      console.log('❌ META API FAILING - Root cause is Meta API not working');
    } else {
      console.log('❌ MIXED ISSUES - Multiple problems detected');
    }
    
    return NextResponse.json({
      success: true,
      message: 'Final cache test completed',
      results: {
        metaApi: {
          spend: metaApiSpend,
          working: isMetaApiWorking
        },
        smartCacheForce: {
          spend: smartCacheForceSpend,
          working: isSmartCacheWorking,
          source: smartCacheForceResult.source
        },
        smartCacheNormal: {
          spend: smartCacheNormalSpend,
          cacheAge: cacheAge,
          fresh: isCacheFresh,
          source: smartCacheNormalResult.source
        },
        standardizedFetcher: {
          spend: standardizedSpend,
          working: isStandardizedWorking,
          source: standardizedResult.debug?.source
        },
        diagnosis: {
          allWorking: isMetaApiWorking && isSmartCacheWorking && isCacheFresh && isStandardizedWorking,
          cacheNotSaving: isMetaApiWorking && isSmartCacheWorking && !isCacheFresh,
          smartCacheFailing: isMetaApiWorking && !isSmartCacheWorking,
          metaApiFailing: !isMetaApiWorking
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Final cache test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
