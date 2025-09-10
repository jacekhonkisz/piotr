import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import logger from '../../../lib/logger';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking RLS policies for cache tables...\n');
    
    // Check current_month_cache policies
    const { data: monthPolicies, error: monthError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT 
            schemaname,
            tablename,
            policyname,
            permissive,
            roles,
            cmd,
            qual,
            with_check
          FROM pg_policies 
          WHERE tablename = 'current_month_cache'
          ORDER BY policyname;
        `
      });
    
    if (monthError) {
      console.error('❌ Error checking month cache policies:', monthError);
    } else {
      console.log('📋 Current month cache policies:');
      console.log(JSON.stringify(monthPolicies, null, 2));
    }
    
    // Check current_week_cache policies
    const { data: weekPolicies, error: weekError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT 
            schemaname,
            tablename,
            policyname,
            permissive,
            roles,
            cmd,
            qual,
            with_check
          FROM pg_policies 
          WHERE tablename = 'current_week_cache'
          ORDER BY policyname;
        `
      });
    
    if (weekError) {
      console.error('❌ Error checking week cache policies:', weekError);
    } else {
      console.log('📋 Current week cache policies:');
      console.log(JSON.stringify(weekPolicies, null, 2));
    }
    
    // Check if service role has access
    const { data: serviceRoleCheck, error: serviceError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT 
            has_table_privilege('service_role', 'current_month_cache', 'SELECT') as can_select,
            has_table_privilege('service_role', 'current_month_cache', 'INSERT') as can_insert,
            has_table_privilege('service_role', 'current_month_cache', 'UPDATE') as can_update,
            has_table_privilege('service_role', 'current_month_cache', 'DELETE') as can_delete;
        `
      });
    
    if (serviceError) {
      console.error('❌ Error checking service role privileges:', serviceError);
    } else {
      console.log('🔑 Service role privileges:');
      console.log(JSON.stringify(serviceRoleCheck, null, 2));
    }
    
    return NextResponse.json({
      success: true,
      message: 'RLS policy check completed',
      results: {
        monthCachePolicies: monthPolicies || [],
        weekCachePolicies: weekPolicies || [],
        serviceRolePrivileges: serviceRoleCheck || []
      }
    });
    
  } catch (error) {
    console.error('❌ RLS policy check failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
