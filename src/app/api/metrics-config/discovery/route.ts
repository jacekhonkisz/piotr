import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { StandardizedDataFetcher } from '@/lib/standardized-data-fetcher';
import { GoogleAdsStandardizedDataFetcher } from '@/lib/google-ads-standardized-data-fetcher';
import { buildGoogleMetricSnapshot, buildMetaMetricSnapshot } from '@/lib/metric-snapshot';
import { ALL_METRIC_KEYS_FOR_DISCOVERY } from '@/lib/default-metrics-config';
import {
  extractMetaDynamicActionRows,
  metaCampaignsToDynamicMetricMap,
} from '@/lib/dynamic-conversion-discovery';
import {
  fetchGoogleDynamicConversionRows,
  googleDynamicRowsToMetricMap,
} from '@/lib/google-dynamic-conversion-fetch';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function lastCompletedCalendarMonthBounds(): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const firstPrev = new Date(y, m - 1, 1);
  const lastPrev = new Date(y, m, 0);
  const toYmd = (d: Date) => d.toISOString().split('T')[0]!;
  return { start: toYmd(firstPrev), end: toYmd(lastPrev) };
}

function currentCalendarMonthToTodayBounds(): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const start = new Date(y, m, 1);
  const toYmd = (d: Date) => d.toISOString().split('T')[0]!;
  return { start: toYmd(start), end: toYmd(now) };
}

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

    const clientId = request.nextUrl.searchParams.get('clientId');
    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    const ok = await assertClientAccess(user.id, user.email ?? undefined, clientId);
    if (!ok) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const mode = request.nextUrl.searchParams.get('mode') || 'last_closed';
    const recent =
      mode === 'current' ? currentCalendarMonthToTodayBounds() : lastCompletedCalendarMonthBounds();

    const [metaRecent, googleRecent] = await Promise.all([
      StandardizedDataFetcher.fetchData({
        clientId,
        dateRange: recent,
        platform: 'meta',
        reason: 'metrics-discovery-recent'
      }),
      GoogleAdsStandardizedDataFetcher.fetchData({
        clientId,
        dateRange: recent,
        reason: 'metrics-discovery-recent',
        sessionToken: token,
      }),
    ]);

    const metaCampaigns = metaRecent.success && metaRecent.data ? metaRecent.data.campaigns : [];
    const metaDynamic = extractMetaDynamicActionRows(metaCampaigns);

    const googleDynamic = await fetchGoogleDynamicConversionRows(clientId, recent.start, recent.end);
    const googleDynMap = googleDynamic.fetchOk ? googleDynamicRowsToMetricMap(googleDynamic.rows) : {};
    const metaDynMap = metaCampaignsToDynamicMetricMap(metaCampaigns);

    const metaRecentSnap: Record<string, number> =
      metaRecent.success && metaRecent.data
        ? buildMetaMetricSnapshot(
            metaRecent.data.stats,
            metaRecent.data.conversionMetrics,
            metaDynMap
          )
        : {};

    const googleRecentSnap: Record<string, number> =
      googleRecent.success && googleRecent.data
        ? buildGoogleMetricSnapshot(
            googleRecent.data.stats,
            googleRecent.data.conversionMetrics,
            googleDynMap
          )
        : {};

    const labelByKey: Record<string, string> = {};
    for (const row of metaDynamic) {
      labelByKey[row.key] = row.label;
    }
    for (const row of googleDynamic.rows) {
      labelByKey[row.key] = row.label;
    }

    const dynamicCatalogKeys = [
      ...metaDynamic.map((r) => r.key),
      ...googleDynamic.rows.map((r) => r.key),
    ];
    const catalogKeys = [...ALL_METRIC_KEYS_FOR_DISCOVERY, ...dynamicCatalogKeys];

    return NextResponse.json({
      catalogKeys,
      labelByKey,
      periods: {
        recent: {
          label: mode === 'current' ? 'Bieżący okres (miesiąc do dziś)' : 'Ostatni zamknięty miesiąc',
          ...recent,
        },
      },
      meta: {
        recent: metaRecentSnap,
        fetchOk: { recent: metaRecent.success },
        dynamicConversions: metaDynamic,
        dynamicConversionsFetchOk: metaRecent.success,
      },
      google: {
        recent: googleRecentSnap,
        fetchOk: { recent: googleRecent.success },
        dynamicConversions: googleDynamic.rows,
        dynamicConversionsFetchOk: googleDynamic.fetchOk,
        dynamicConversionsSkipReason: googleDynamic.skipReason,
      },
    });
  } catch (e) {
    console.error('GET /api/metrics-config/discovery', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
