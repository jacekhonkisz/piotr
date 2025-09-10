import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import logger from '../../../lib/logger';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking RLS policies for cache tables...\n');
    
    // Since exec_sql is not available, we'll use a simpler approach
    // Check if we can access the cache tables directly
    const { data: monthCacheData, error: monthError } = await supabase
      .from('current_month_cache')
      .select('*')
      .limit(1);
    
    const { data: weekCacheData, error: weekError } = await supabase
      .from('current_week_cache')
      .select('*')
      .limit(1);
    
    return NextResponse.json({
      success: true,
      message: 'RLS policy check completed',
      results: {
        monthCacheAccessible: !monthError,
        weekCacheAccessible: !weekError,
        monthCacheError: monthError?.message || null,
        weekCacheError: weekError?.message || null,
        monthCacheSample: monthCacheData?.length || 0,
        weekCacheSample: weekCacheData?.length || 0
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
