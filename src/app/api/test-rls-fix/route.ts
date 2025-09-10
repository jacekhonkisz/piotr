import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import logger from '../../../lib/logger';

export async function GET(request: NextRequest) {
  try {
    const clientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
    const periodId = '2025-09';
    
    console.log('🧪 Testing RLS fix and cache update...\n');
    
    // 1. Test if we can read from cache table
    console.log('1️⃣ Testing cache table read access...');
    const { data: readResult, error: readError } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', clientId)
      .eq('period_id', periodId)
      .single();
    
    if (readError) {
      console.error('❌ Read error:', readError);
      return NextResponse.json({
        success: false,
        step: 'read',
        error: readError.message,
        code: readError.code
      }, { status: 500 });
    }
    
    console.log('✅ Read access working');
    console.log(`  Current cache: ${readResult ? 'EXISTS' : 'NOT FOUND'}`);
    if (readResult) {
      const cacheAge = Date.now() - new Date(readResult.last_updated).getTime();
      console.log(`  Cache age: ${Math.round(cacheAge / 1000 / 60)} minutes`);
      console.log(`  Total spend: ${(readResult.cache_data as any)?.stats?.totalSpend || 'N/A'}`);
    }
    
    // 2. Test if we can write to cache table
    console.log('\n2️⃣ Testing cache table write access...');
    const testData = {
      client: { id: clientId, name: 'Test' },
      stats: { totalSpend: 9999.99 },
      fetchedAt: new Date().toISOString()
    };
    
    const { data: writeResult, error: writeError } = await supabase
      .from('current_month_cache')
      .upsert({
        client_id: clientId,
        period_id: periodId,
        cache_data: testData,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'client_id,period_id'
      })
      .select();
    
    if (writeError) {
      console.error('❌ Write error:', writeError);
      return NextResponse.json({
        success: false,
        step: 'write',
        error: writeError.message,
        code: writeError.code,
        details: writeError
      }, { status: 500 });
    }
    
    console.log('✅ Write access working');
    console.log(`  Upserted: ${writeResult?.length || 0} records`);
    
    // 3. Verify the write worked
    console.log('\n3️⃣ Verifying write worked...');
    const { data: verifyResult, error: verifyError } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', clientId)
      .eq('period_id', periodId)
      .single();
    
    if (verifyError) {
      console.error('❌ Verify error:', verifyError);
      return NextResponse.json({
        success: false,
        step: 'verify',
        error: verifyError.message,
        code: verifyError.code
      }, { status: 500 });
    }
    
    console.log('✅ Write verification successful');
    console.log(`  Total spend: ${(verifyResult.cache_data as any)?.stats?.totalSpend || 'N/A'}`);
    
    // 4. Test smart cache system
    console.log('\n4️⃣ Testing smart cache system...');
    const { getSmartCacheData } = await import('../../../lib/smart-cache-helper');
    const smartCacheResult = await getSmartCacheData(clientId, true);
    
    console.log('📊 Smart cache result:');
    console.log(`  Success: ${smartCacheResult.success}`);
    console.log(`  Source: ${smartCacheResult.source}`);
    console.log(`  Total spend: ${smartCacheResult.data?.stats?.totalSpend || 'N/A'}`);
    
    return NextResponse.json({
      success: true,
      message: 'RLS fix test completed',
      results: {
        readAccess: 'working',
        writeAccess: 'working',
        smartCache: {
          success: smartCacheResult.success,
          source: smartCacheResult.source,
          totalSpend: smartCacheResult.data?.stats?.totalSpend || 0
        },
        cacheData: {
          totalSpend: (verifyResult.cache_data as any)?.stats?.totalSpend || 0,
          lastUpdated: verifyResult.last_updated
        }
      }
    });
    
  } catch (error) {
    console.error('❌ RLS fix test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
