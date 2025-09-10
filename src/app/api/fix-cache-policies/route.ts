import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import logger from '../../../lib/logger';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Fixing cache RLS policies...');
    
    // Execute the RLS policy fix directly
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        -- Add service role policy for current_month_cache
        CREATE POLICY IF NOT EXISTS "Service role can access all current month cache" ON current_month_cache
        FOR ALL USING (auth.role() = 'service_role');

        -- Add service role policy for current_week_cache  
        CREATE POLICY IF NOT EXISTS "Service role can access all current week cache" ON current_week_cache
        FOR ALL USING (auth.role() = 'service_role');

        -- Grant explicit permissions to service role
        GRANT ALL ON current_month_cache TO service_role;
        GRANT ALL ON current_week_cache TO service_role;
      `
    });
    
    if (error) {
      console.error('❌ Error fixing RLS policies:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }
    
    console.log('✅ RLS policies fixed successfully');
    
    return NextResponse.json({
      success: true,
      message: 'RLS policies fixed successfully'
    });
    
  } catch (error) {
    console.error('❌ Error fixing RLS policies:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
