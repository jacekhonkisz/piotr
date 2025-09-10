import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    
    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 400 });
    }

    // Check current month cache
    const { data: monthCache, error: monthError } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', clientId)
      .order('last_updated', { ascending: false });

    // Check current week cache
    const { data: weekCache, error: weekError } = await supabase
      .from('current_week_cache')
      .select('*')
      .eq('client_id', clientId)
      .order('last_updated', { ascending: false });

    // Check Google Ads caches
    const { data: googleMonthCache, error: googleMonthError } = await supabase
      .from('google_ads_current_month_cache')
      .select('*')
      .eq('client_id', clientId)
      .order('last_updated', { ascending: false });

    const { data: googleWeekCache, error: googleWeekError } = await supabase
      .from('google_ads_current_week_cache')
      .select('*')
      .eq('client_id', clientId)
      .order('last_updated', { ascending: false });

    return NextResponse.json({
      success: true,
      data: {
        currentMonthCache: {
          data: monthCache,
          error: monthError,
          count: monthCache?.length || 0
        },
        currentWeekCache: {
          data: weekCache,
          error: weekError,
          count: weekCache?.length || 0
        },
        googleAdsMonthCache: {
          data: googleMonthCache,
          error: googleMonthError,
          count: googleMonthCache?.length || 0
        },
        googleAdsWeekCache: {
          data: googleWeekCache,
          error: googleWeekError,
          count: googleWeekCache?.length || 0
        }
      }
    });

  } catch (error) {
    console.error('Error checking cache tables:', error);
    return NextResponse.json({ error: 'Failed to check cache tables' }, { status: 500 });
  }
}
