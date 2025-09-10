import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId') || 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
    
    // Test 1: Try to read from cache
    console.log('🔍 Testing cache read...');
    const { data: readData, error: readError } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', clientId)
      .order('last_updated', { ascending: false })
      .limit(1);

    console.log('Read result:', { readData, readError });

    // Test 2: Try to write to cache
    console.log('🔍 Testing cache write...');
    const testData = {
      client: { id: clientId, name: 'Test Client' },
      campaigns: [{ id: 'test-1', name: 'Test Campaign', spend: 100 }],
      stats: { totalSpend: 100 },
      fetchedAt: new Date().toISOString(),
      fromCache: false,
      cacheAge: 0
    };

    const { data: writeData, error: writeError } = await supabase
      .from('current_month_cache')
      .upsert({
        client_id: clientId,
        period_id: '2025-09',
        cache_data: testData,
        last_updated: new Date().toISOString()
      });

    console.log('Write result:', { writeData, writeError });

    // Test 3: Try to read what we just wrote
    console.log('🔍 Testing cache read after write...');
    const { data: readAfterWrite, error: readAfterWriteError } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', clientId)
      .eq('period_id', '2025-09')
      .single();

    console.log('Read after write result:', { readAfterWrite, readAfterWriteError });

    return NextResponse.json({
      success: true,
      tests: {
        read: {
          success: !readError,
          error: readError?.message,
          dataCount: readData?.length || 0
        },
        write: {
          success: !writeError,
          error: writeError?.message,
          data: writeData
        },
        readAfterWrite: {
          success: !readAfterWriteError,
          error: readAfterWriteError?.message,
          campaignsCount: readAfterWrite?.cache_data?.campaigns?.length || 0
        }
      }
    });

  } catch (error) {
    console.error('❌ Cache storage test failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
