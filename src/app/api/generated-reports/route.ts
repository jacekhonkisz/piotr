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
    const reportType = searchParams.get('reportType');
    const periodStart = searchParams.get('periodStart');
    const periodEnd = searchParams.get('periodEnd');

    // Check authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }

    let query = supabase
      .from('generated_reports')
      .select(`
        id,
        client_id,
        report_type,
        period_start,
        period_end,
        polish_summary,
        polish_subject,
        pdf_url,
        pdf_size_bytes,
        pdf_generated_at,
        total_spend,
        total_impressions,
        total_clicks,
        total_conversions,
        ctr,
        cpc,
        cpm,
        cpa,
        generated_at,
        status,
        error_message
      `)
      .eq('client_id', clientId)
      .order('generated_at', { ascending: false });

    // Add optional filters
    if (reportType) {
      query = query.eq('report_type', reportType);
    }
    if (periodStart) {
      query = query.eq('period_start', periodStart);
    }
    if (periodEnd) {
      query = query.eq('period_end', periodEnd);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch generated reports' }, { status: 500 });
    }

    // If searching for a specific report, return single result
    if (reportType && periodStart && periodEnd) {
      const report = data?.[0] || null;
      return NextResponse.json({ report });
    }

    // Return all matching reports
    return NextResponse.json({ reports: data || [] });

  } catch (error) {
    console.error('Generated reports API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 