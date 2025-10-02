import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';

export async function GET() {
  try {
    // Test query to see what Supabase actually returns
    const { data, error } = await supabaseAdmin
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', '8657100a-6e87-422c-97f4-b733754a9ff8')
      .eq('summary_type', 'monthly')
      .eq('summary_date', '2025-09-01')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      debug: {
        has_campaign_data: data.campaign_data !== null,
        campaign_data_type: typeof data.campaign_data,
        is_array: Array.isArray(data.campaign_data),
        length: Array.isArray(data.campaign_data) ? data.campaign_data.length : null,
        first_campaign: data.campaign_data && data.campaign_data[0] ? data.campaign_data[0] : null,
        total_spend: data.total_spend,
        total_impressions: data.total_impressions,
        raw_campaign_data_sample: data.campaign_data ? JSON.stringify(data.campaign_data).substring(0, 500) : null
      },
      full_data: data
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

