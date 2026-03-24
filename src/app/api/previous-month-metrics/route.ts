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
    const platform = searchParams.get('platform') || 'meta';

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthStr = previousMonth.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('campaign_summaries')
      .select('booking_step_1, reservations, reservation_value, summary_date, platform')
      .eq('client_id', clientId)
      .eq('summary_type', 'monthly')
      .eq('platform', platform)
      .eq('summary_date', previousMonthStr)
      .single();

    if (error || !data) {
      return NextResponse.json({
        booking_step_1: 0,
        reservations: 0,
        reservation_value: 0,
        found: false,
        searchedMonth: previousMonthStr,
        searchedPlatform: platform
      });
    }

    return NextResponse.json({
      booking_step_1: data.booking_step_1 || 0,
      reservations: data.reservations || 0,
      reservation_value: data.reservation_value || 0,
      found: true,
      searchedMonth: previousMonthStr,
      searchedPlatform: platform
    });
  } catch (err) {
    console.error('Error fetching previous month metrics:', err);
    return NextResponse.json({
      booking_step_1: 0,
      reservations: 0,
      reservation_value: 0,
      found: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
