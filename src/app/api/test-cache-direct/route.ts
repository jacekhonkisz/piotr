import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import logger from '../../../lib/logger';

export async function POST(request: NextRequest) {
  try {
    const clientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
    const periodId = '2025-09';
    
    console.log('🧪 Testing direct cache update...');
    
    // Test data
    const testCacheData = {
      client: {
        id: clientId,
        name: 'Belmonte Hotel',
        adAccountId: '438600948208231'
      },
      campaigns: [],
      stats: {
        totalSpend: 6672.02,
        totalImpressions: 50000,
        totalClicks: 1500,
        totalConversions: 5,
        averageCtr: 3.0,
        averageCpc: 4.45
      },
      conversionMetrics: {
        click_to_call: 200,
        email_contacts: 100,
        booking_step_1: 50,
        booking_step_2: 25,
        booking_step_3: 10,
        reservations: 5,
        reservation_value: 15000,
        roas: 2.25,
        cost_per_reservation: 1334.40
      },
      fetchedAt: new Date().toISOString(),
      fromCache: false,
      cacheAge: 0
    };
    
    // Try to insert/update cache directly
    console.log('1️⃣ Attempting direct cache upsert...');
    const { data: upsertResult, error: upsertError } = await supabase
      .from('current_month_cache')
      .upsert({
        client_id: clientId,
        period_id: periodId,
        cache_data: testCacheData,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'client_id,period_id'
      })
      .select();
    
    if (upsertError) {
      console.error('❌ Upsert error:', upsertError);
      return NextResponse.json({
        success: false,
        error: upsertError.message,
        details: upsertError
      }, { status: 500 });
    }
    
    console.log('✅ Cache upsert successful:', upsertResult);
    
    // Verify the cache was saved
    console.log('2️⃣ Verifying cache was saved...');
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
        error: verifyError.message,
        details: verifyError
      }, { status: 500 });
    }
    
    console.log('✅ Cache verification successful:', {
      lastUpdated: verifyResult.last_updated,
      totalSpend: verifyResult.cache_data?.stats?.totalSpend
    });
    
    return NextResponse.json({
      success: true,
      message: 'Direct cache update successful',
      cacheData: {
        lastUpdated: verifyResult.last_updated,
        totalSpend: verifyResult.cache_data?.stats?.totalSpend,
        periodId: verifyResult.period_id
      }
    });
    
  } catch (error) {
    console.error('❌ Direct cache test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
