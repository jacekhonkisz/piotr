import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import logger from '../../../lib/logger';

export async function GET(request: NextRequest) {
  try {
    console.log('🔧 Disabling RLS for cache tables...\n');
    
    // Test if we can access the tables without RLS
    console.log('1️⃣ Testing current access...');
    
    const { data: testData, error: testError } = await supabase
      .from('current_month_cache')
      .select('count(*)')
      .limit(1);
    
    if (testError) {
      console.log(`❌ Current access blocked: ${testError.message}`);
    } else {
      console.log(`✅ Current access working: ${JSON.stringify(testData)}`);
    }
    
    return NextResponse.json({
      success: true,
      message: 'RLS status check completed',
      currentAccess: testError ? { error: testError.message } : { working: true }
    });
    
  } catch (error) {
    console.error('❌ RLS check failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
