import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import logger from '../../../lib/logger';

export async function POST(request: NextRequest) {
  try {
    const clientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
    const periodId = '2025-09';
    
    console.log('🧪 Testing if RLS is disabled...\n');
    
    // Test 1: Try to insert a test record
    console.log('1️⃣ Testing cache insert...');
    const testData = {
      client: { id: clientId, name: 'Test' },
      stats: { totalSpend: 9999.99 },
      fetchedAt: new Date().toISOString()
    };
    
    const { data: insertResult, error: insertError } = await supabase
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
    
    if (insertError) {
      console.log(`❌ Insert failed: ${insertError.message}`);
      console.log(`   Code: ${insertError.code}`);
      return NextResponse.json({
        success: false,
        error: insertError.message,
        code: insertError.code,
        rlsStillActive: true
      }, { status: 500 });
    }
    
    console.log(`✅ Insert successful: ${insertResult?.length || 0} records`);
    
    // Test 2: Try to read the record back
    console.log('\n2️⃣ Testing cache read...');
    const { data: readResult, error: readError } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', clientId)
      .eq('period_id', periodId)
      .single();
    
    if (readError) {
      console.log(`❌ Read failed: ${readError.message}`);
      return NextResponse.json({
        success: false,
        error: readError.message,
        code: readError.code,
        rlsStillActive: true
      }, { status: 500 });
    }
    
    console.log(`✅ Read successful: ${readResult.cache_data?.stats?.totalSpend || 'N/A'}`);
    
    // Test 3: Clean up test record
    console.log('\n3️⃣ Cleaning up test record...');
    const { error: deleteError } = await supabase
      .from('current_month_cache')
      .delete()
      .eq('client_id', clientId)
      .eq('period_id', periodId);
    
    if (deleteError) {
      console.log(`⚠️ Cleanup failed: ${deleteError.message}`);
    } else {
      console.log('✅ Cleanup successful');
    }
    
    return NextResponse.json({
      success: true,
      message: 'RLS is disabled - cache access working',
      rlsStillActive: false,
      testResults: {
        insert: 'success',
        read: 'success',
        cleanup: deleteError ? 'failed' : 'success'
      }
    });
    
  } catch (error) {
    console.error('❌ RLS test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      rlsStillActive: true
    }, { status: 500 });
  }
}
