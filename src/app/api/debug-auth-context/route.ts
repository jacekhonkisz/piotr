import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import logger from '../../../lib/logger';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Debugging authentication context...\n');
    
    // Test 1: Check if we can access the cache tables
    const { data: bypassData, error: bypassError } = await supabase
      .from('current_month_cache')
      .select('count(*)')
      .limit(1);
    
    console.log('1️⃣ Cache access test:');
    if (bypassError) {
      console.log(`❌ Cache access blocked: ${bypassError.message}`);
    } else {
      console.log(`✅ Cache accessible: ${JSON.stringify(bypassData)}`);
    }
    
    // Test 2: Try to create a simple test record
    const testClientId = '00000000-0000-0000-0000-000000000001';
    const testPeriodId = 'test-debug-2025';
    
    const { data: insertData, error: insertError } = await supabase
      .from('current_month_cache')
      .upsert({
        client_id: testClientId,
        period_id: testPeriodId,
        cache_data: { test: true, timestamp: new Date().toISOString() },
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'client_id,period_id'
      })
      .select();
    
    console.log('\n2️⃣ Insert test:');
    if (insertError) {
      console.log(`❌ Insert failed: ${insertError.message}`);
      console.log(`   Code: ${insertError.code}`);
      console.log(`   Details: ${JSON.stringify(insertError.details)}`);
    } else {
      console.log(`✅ Insert successful: ${JSON.stringify(insertData)}`);
      
      // Clean up
      await supabase
        .from('current_month_cache')
        .delete()
        .eq('client_id', testClientId)
        .eq('period_id', testPeriodId);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Auth context debug completed',
      results: {
        cacheAccess: bypassData || null,
        insertTest: insertError ? { error: insertError.message, code: insertError.code } : { success: true }
      }
    });
    
  } catch (error) {
    console.error('❌ Auth context debug failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
