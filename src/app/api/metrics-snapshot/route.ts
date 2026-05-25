import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { StandardizedDataFetcher } from '@/lib/standardized-data-fetcher';
import { GoogleAdsStandardizedDataFetcher } from '@/lib/google-ads-standardized-data-fetcher';
import { buildGoogleMetricSnapshot, buildMetaMetricSnapshot } from '@/lib/metric-snapshot';
import {
  fetchGoogleDynamicConversionRows,
  googleDynamicRowsToMetricMap,
} from '@/lib/google-dynamic-conversion-fetch';
import { metaCampaignsToDynamicMetricMap } from '@/lib/dynamic-conversion-discovery';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function assertClientAccess(userId: string, email: string | undefined, clientId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (profile?.role === 'admin') {
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('admin_id', userId)
      .single();
    return !!client;
  }
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('email', email)
    .single();
  return !!client;
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const platform = (searchParams.get('platform') || 'meta') as 'meta' | 'google';
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    if (!clientId || !start || !end) {
      return NextResponse.json(
        { error: 'clientId, start, end (YYYY-MM-DD) are required' },
        { status: 400 }
      );
    }

    const ok = await assertClientAccess(user.id, user.email ?? undefined, clientId);
    if (!ok) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const dateRange = { start, end };

    if (platform === 'google') {
      const r = await GoogleAdsStandardizedDataFetcher.fetchData({
        clientId,
        dateRange,
        reason: 'metrics-snapshot',
        sessionToken: token,
      });
      if (!r.success || !r.data) {
        return NextResponse.json({
          platform: 'google',
          dateRange,
          snapshot: {},
          success: false
        });
      }
      const googleDyn = await fetchGoogleDynamicConversionRows(clientId, dateRange.start, dateRange.end);
      const googleDynMap = googleDyn.fetchOk ? googleDynamicRowsToMetricMap(googleDyn.rows) : {};
      const snapshot = buildGoogleMetricSnapshot(
        r.data.stats,
        r.data.conversionMetrics,
        googleDynMap
      );
      return NextResponse.json({
        platform: 'google',
        dateRange,
        snapshot,
        success: true,
        debug: r.debug
      });
    }

    const r = await StandardizedDataFetcher.fetchData({
      clientId,
      dateRange,
      platform: 'meta',
      reason: 'metrics-snapshot'
    });
    if (!r.success || !r.data) {
      return NextResponse.json({
        platform: 'meta',
        dateRange,
        snapshot: {},
        success: false
      });
    }
    const metaCampaigns = r.data.campaigns || [];
    const metaDynMap = metaCampaignsToDynamicMetricMap(metaCampaigns);
    const snapshot = buildMetaMetricSnapshot(
      r.data.stats,
      r.data.conversionMetrics,
      metaDynMap
    );
    return NextResponse.json({
      platform: 'meta',
      dateRange,
      snapshot,
      success: true,
      debug: r.debug
    });
  } catch (e) {
    console.error('GET /api/metrics-snapshot', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
