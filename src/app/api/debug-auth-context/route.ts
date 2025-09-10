import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import logger from '../../../lib/logger';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Debugging authentication context...\n');
    
    // Test 1: Check what auth.role() returns
    const { data: authRoleData, error: authRoleError } = await supabase
      .rpc('exec_sql', {
        sql: `SELECT auth.role() as current_role, current_user as current_user;`
      });
    
    console.log('1️⃣ Auth role check:');
    if (authRoleError) {
      console.log(`❌ Error: ${authRoleError.message}`);
    } else {
      console.log(`✅ Auth role: ${JSON.stringify(authRoleData)}`);
    }
    
    // Test 2: Check if we can bypass RLS by using service role directly
    const { data: bypassData, error: bypassError } = await supabase
      .from('current_month_cache')
      .select('count(*)')
      .limit(1);
    
    console.log('\n2️⃣ RLS bypass test:');
    if (bypassError) {
      console.log(`❌ RLS still blocking: ${bypassError.message}`);
    } else {
      console.log(`✅ RLS bypassed: ${JSON.stringify(bypassData)}`);
    }
    
    // Test 3: Try to create a simple test record
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
    
    console.log('\n3️⃣ Insert test:');
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
    
    // Test 4: Check current user and role
    const { data: userData, error: userError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT 
            current_user,
            session_user,
            current_setting('role'),
            current_setting('request.jwt.claims', true) as jwt_claims
        `
      });
    
    console.log('\n4️⃣ User context:');
    if (userError) {
      console.log(`❌ Error: ${userError.message}`);
    } else {
      console.log(`✅ User context: ${JSON.stringify(userData)}`);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Auth context debug completed',
      results: {
        authRole: authRoleData || null,
        rlsBypass: bypassData || null,
        insertTest: insertError ? { error: insertError.message, code: insertError.code } : { success: true },
        userContext: userData || null
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
