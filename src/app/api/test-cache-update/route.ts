import { NextRequest, NextResponse } from 'next/server';
import { getSmartCacheData } from '../../../lib/smart-cache-helper';
import { supabase } from '../../../lib/supabase';
import logger from '../../../lib/logger';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const clientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
    
    console.log('🧪 Testing cache update mechanism...\n');
    
    // 1. Check current cache state
    console.log('1️⃣ Checking current cache state...');
    const { data: currentCache, error: cacheError } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', clientId)
      .eq('period_id', '2025-09')
      .single();
    
    if (cacheError) {
      console.log('❌ Cache query error:', cacheError);
    } else if (currentCache) {
      const cacheAge = Date.now() - new Date(currentCache.last_updated).getTime();
      console.log('📊 Current cache:');
      console.log(`  Last Updated: ${currentCache.last_updated}`);
      console.log(`  Cache Age: ${Math.round(cacheAge / 1000 / 60)} minutes`);
      console.log(`  Total Spend: ${(currentCache.cache_data as any)?.stats?.totalSpend || 'N/A'}`);
    } else {
      console.log('⚠️ No cache found for current period');
    }
    
    // 2. Force refresh the cache
    console.log('\n2️⃣ Force refreshing cache...');
    const refreshResult = await getSmartCacheData(clientId, true);
    console.log('📊 Refresh result:');
    console.log(`  Success: ${refreshResult.success}`);
    console.log(`  Source: ${refreshResult.source}`);
    console.log(`  Total Spend: ${(refreshResult.data as any)?.stats?.totalSpend || 'N/A'}`);
    
    // 3. Check cache state after refresh
    console.log('\n3️⃣ Checking cache state after refresh...');
    const { data: updatedCache, error: updatedCacheError } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', clientId)
      .eq('period_id', '2025-09')
      .single();
    
    if (updatedCacheError) {
      console.log('❌ Updated cache query error:', updatedCacheError);
    } else if (updatedCache) {
      const updatedCacheAge = Date.now() - new Date(updatedCache.last_updated).getTime();
      console.log('📊 Updated cache:');
      console.log(`  Last Updated: ${updatedCache.last_updated}`);
      console.log(`  Cache Age: ${Math.round(updatedCacheAge / 1000 / 60)} minutes`);
      console.log(`  Total Spend: ${(updatedCache.cache_data as any)?.stats?.totalSpend || 'N/A'}`);
    } else {
      console.log('⚠️ No cache found after refresh');
    }
    
    // 4. Test smart cache without force refresh
    console.log('\n4️⃣ Testing smart cache without force refresh...');
    const normalResult = await getSmartCacheData(clientId, false);
    console.log('📊 Normal result:');
    console.log(`  Success: ${normalResult.success}`);
    console.log(`  Source: ${normalResult.source}`);
    console.log(`  Cache Age: ${normalResult.data?.cacheAge || 'N/A'}ms`);
    console.log(`  Total Spend: ${(normalResult.data as any)?.stats?.totalSpend || 'N/A'}`);
    
    const responseTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      testResults: {
        beforeRefresh: currentCache ? {
          lastUpdated: currentCache.last_updated,
          cacheAge: Date.now() - new Date(currentCache.last_updated).getTime(),
          totalSpend: (currentCache.cache_data as any)?.stats?.totalSpend || 0
        } : null,
        refreshResult: {
          success: refreshResult.success,
          source: refreshResult.source,
          totalSpend: (refreshResult.data as any)?.stats?.totalSpend || 0
        },
        afterRefresh: updatedCache ? {
          lastUpdated: updatedCache.last_updated,
          cacheAge: Date.now() - new Date(updatedCache.last_updated).getTime(),
          totalSpend: (updatedCache.cache_data as any)?.stats?.totalSpend || 0
        } : null,
        normalResult: {
          success: normalResult.success,
          source: normalResult.source,
          cacheAge: normalResult.data?.cacheAge || 0,
          totalSpend: (normalResult.data as any)?.stats?.totalSpend || 0
        }
      },
      totalResponseTime: responseTime
    });
    
  } catch (error) {
    console.error('❌ Cache update test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    }, { status: 500 });
  }
}
