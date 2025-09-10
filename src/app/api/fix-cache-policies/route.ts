import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import logger from '../../../lib/logger';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Testing cache access...');
    
    // Test if we can access the cache tables
    const { data: monthData, error: monthError } = await supabase
      .from('current_month_cache')
      .select('*')
      .limit(1);
    
    const { data: weekData, error: weekError } = await supabase
      .from('current_week_cache')
      .select('*')
      .limit(1);
    
    if (monthError || weekError) {
      console.error('❌ Cache access issues:', { monthError, weekError });
      return NextResponse.json({
        success: false,
        error: 'Cache access issues detected',
        details: {
          monthError: monthError?.message,
          weekError: weekError?.message
        }
      }, { status: 500 });
    }
    
    console.log('✅ Cache access working correctly');
    
    return NextResponse.json({
      success: true,
      message: 'Cache access is working correctly',
      results: {
        monthCacheAccessible: !monthError,
        weekCacheAccessible: !weekError
      }
    });
    
  } catch (error) {
    console.error('❌ Error testing cache access:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
