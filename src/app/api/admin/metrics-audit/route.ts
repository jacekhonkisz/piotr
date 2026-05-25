import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest, canAccessClient } from '../../../../lib/auth-middleware';
import { getMondayOfWeek, formatDateISO } from '../../../../lib/week-helpers';
import { getCurrentWeekInfo } from '../../../../lib/week-utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Platform = 'meta' | 'google';

function isMonthlyRange(start: string, end: string): boolean {
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return false;
  const first = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
  const last = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 0));
  return (
    startDate.getUTCFullYear() === endDate.getUTCFullYear() &&
    startDate.getUTCMonth() === endDate.getUTCMonth() &&
    startDate.getUTCDate() === first.getUTCDate() &&
    endDate.getUTCDate() === last.getUTCDate()
  );
}

function dayDiffInclusive(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00.000Z`);
  const e = new Date(`${end}T00:00:00.000Z`);
  return Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function aggregateDailyRows(rows: any[]) {
  // daily_kpi_data.total_clicks is already canonical (link clicks for Meta, clicks for Google).
  const totals = rows.reduce(
    (acc, row) => {
      acc.total_spend += Number(row.total_spend || 0);
      acc.total_impressions += Number(row.total_impressions || 0);
      acc.total_clicks += Number(row.total_clicks || 0);
      acc.total_conversions += Number(row.total_conversions || 0);
      acc.click_to_call += Number(row.click_to_call || 0);
      acc.email_contacts += Number(row.email_contacts || 0);
      acc.booking_step_1 += Number(row.booking_step_1 || 0);
      acc.booking_step_2 += Number(row.booking_step_2 || 0);
      acc.booking_step_3 += Number(row.booking_step_3 || 0);
      acc.reservations += Number(row.reservations || 0);
      acc.reservation_value += Number(row.reservation_value || 0);
      acc.campaigns_count += Number(row.campaigns_count || 0);
      return acc;
    },
    {
      total_spend: 0,
      total_impressions: 0,
      total_clicks: 0,
      total_conversions: 0,
      click_to_call: 0,
      email_contacts: 0,
      booking_step_1: 0,
      booking_step_2: 0,
      booking_step_3: 0,
      reservations: 0,
      reservation_value: 0,
      campaigns_count: 0
    }
  );

  const roas = totals.total_spend > 0 ? totals.reservation_value / totals.total_spend : 0;
  const cost_per_reservation = totals.reservations > 0 ? totals.total_spend / totals.reservations : 0;
  const average_ctr =
    totals.total_impressions > 0 ? (totals.total_clicks / totals.total_impressions) * 100 : 0;
  const average_cpc = totals.total_clicks > 0 ? totals.total_spend / totals.total_clicks : 0;

  return {
    ...totals,
    average_ctr,
    average_cpc,
    roas,
    cost_per_reservation
  };
}

/** Today as YYYY-MM-DD (UTC) for period overlap checks. */
function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isDateInInclusiveRange(day: string, start: string, end: string): boolean {
  return day >= start && day <= end;
}

/**
 * Active calendar month: full-month range and "today" falls inside it.
 * For these ranges, `campaign_summaries` is often missing or zero until month close;
 * smart cache (`current_month_cache` / `google_ads_current_month_cache`) is authoritative.
 */
function isActiveCalendarMonth(dateRange: { start: string; end: string }, monthly: boolean): boolean {
  if (!monthly) return false;
  const today = todayUtcDate();
  return isDateInInclusiveRange(today, dateRange.start, dateRange.end);
}

/**
 * Selected weekly row is the current ISO week (same Monday as smart cache period).
 */
function isActiveIsoWeek(summaryDate: string, weekly: boolean): boolean {
  if (!weekly) return false;
  try {
    const cw = getCurrentWeekInfo();
    return summaryDate === cw.startDate;
  } catch {
    return false;
  }
}

type SmartKind = 'month' | 'week';

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Map smart-cache `cache_data` into the flat shape expected by `buildMetricsAuditRows` (stored side).
 */
function mapSmartCacheToStored(
  platform: Platform,
  kind: SmartKind,
  cacheData: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!cacheData || typeof cacheData !== 'object') return null;

  const stats = (cacheData.stats as Record<string, unknown>) || {};
  const conv = (cacheData.conversionMetrics as Record<string, unknown>) || {};
  const campaigns = (cacheData.campaigns as unknown[]) || [];

  const totalSpend = num(stats.totalSpend);
  const totalImpressions = num(stats.totalImpressions);
  const totalClicks = num(stats.totalClicks);
  const reservations = num(conv.reservations);
  const statsConv = num(stats.totalConversions);
  const totalConversions = statsConv > 0 ? Math.round(statsConv) : reservations;

  const reservationValue = num(conv.reservation_value);
  const dataSourceTag =
    platform === 'google'
      ? `smart_cache:google_ads_current_${kind}_cache`
      : `smart_cache:meta_current_${kind}_cache`;

  const base: Record<string, unknown> = {
    total_spend: totalSpend,
    total_impressions: totalImpressions,
    total_clicks: totalClicks,
    total_conversions: totalConversions,
    average_ctr: num(stats.averageCtr),
    average_cpc: num(stats.averageCpc),
    click_to_call: num(conv.click_to_call),
    email_contacts: num(conv.email_contacts),
    booking_step_1: num(conv.booking_step_1),
    booking_step_2: num(conv.booking_step_2),
    booking_step_3: num(conv.booking_step_3),
    reservations,
    reservation_value: reservationValue,
    total_campaigns: Array.isArray(campaigns) ? campaigns.length : 0,
    data_source: dataSourceTag
  };

  if (platform === 'google' && Array.isArray(campaigns) && campaigns.length > 0) {
    // Match fetch-google-ads-live-data: Σ campaign.conversion_value / total_conversion_value.
    // Cached conversionMetrics historically omitted conversion_value — derive from campaigns when present.
    const sumCv = Math.round(campaigns.reduce((s, c: any) => s + num(c.conversion_value), 0) * 100) / 100;
    const sumTcv = Math.round(campaigns.reduce((s, c: any) => s + num(c.total_conversion_value), 0) * 100) / 100;
    base.conversion_value = sumCv;
    base.total_conversion_value = sumTcv > 0 ? sumTcv : sumCv;
    const tcv = num(base.total_conversion_value);
    base.roas =
      totalSpend > 0 && tcv > 0 ? Math.round((tcv / totalSpend) * 100) / 100 : num(conv.roas);
    base.cost_per_reservation =
      reservations > 0 && totalSpend > 0
        ? Math.round((totalSpend / reservations) * 100) / 100
        : num(conv.cost_per_reservation);
  } else if (platform === 'google') {
    const roas =
      num(conv.roas) || (totalSpend > 0 && reservationValue > 0 ? reservationValue / totalSpend : 0);
    const costPerRes =
      num(conv.cost_per_reservation) ||
      (reservations > 0 && totalSpend > 0 ? totalSpend / reservations : 0);
    base.conversion_value = num(conv.conversion_value) || reservationValue;
    base.total_conversion_value =
      num(conv.total_conversion_value) || num(conv.conversion_value) || reservationValue;
    base.roas = roas;
    base.cost_per_reservation = costPerRes;
  } else {
    base.roas =
      num(conv.roas) || (totalSpend > 0 && reservationValue > 0 ? reservationValue / totalSpend : 0);
    base.cost_per_reservation =
      num(conv.cost_per_reservation) ||
      (reservations > 0 && totalSpend > 0 ? totalSpend / reservations : 0);
  }

  return base;
}

function storedMetaFromSmartCacheRow(row: {
  last_updated?: string | null;
  cache_data?: Record<string, unknown> | null;
}): {
  cacheLastUpdated: string | null;
  cacheFetchedAt: string | null;
  ageMinutes: number | null;
} {
  const cacheLastUpdated = row?.last_updated != null ? String(row.last_updated) : null;
  const cd = row?.cache_data as Record<string, unknown> | undefined;
  const cacheFetchedAt = cd?.fetchedAt != null ? String(cd.fetchedAt) : null;
  const ref = cacheLastUpdated || cacheFetchedAt;
  let ageMinutes: number | null = null;
  if (ref) {
    const t = new Date(ref).getTime();
    if (!Number.isNaN(t)) ageMinutes = Math.round((Date.now() - t) / 60000);
  }
  return { cacheLastUpdated, cacheFetchedAt, ageMinutes };
}

async function tryFetchSmartCacheStored(
  clientId: string,
  platform: Platform,
  kind: SmartKind,
  periodId: string
): Promise<{
  data: Record<string, unknown>;
  source: string;
  row: { last_updated?: string | null; cache_data?: Record<string, unknown> | null };
} | null> {
  const table =
    platform === 'google'
      ? kind === 'month'
        ? 'google_ads_current_month_cache'
        : 'google_ads_current_week_cache'
      : kind === 'month'
        ? 'current_month_cache'
        : 'current_week_cache';

  const { data: row, error } = await supabase
    .from(table)
    .select('cache_data, last_updated, period_id')
    .eq('client_id', clientId)
    .eq('period_id', periodId)
    .maybeSingle();

  if (error || !row?.cache_data) return null;

  const mapped = mapSmartCacheToStored(platform, kind, row.cache_data as Record<string, unknown>);
  if (!mapped) return null;

  return { data: mapped, source: table, row };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: auth.statusCode || 401 });
    }

    const body = await request.json();
    const { clientId, dateRange, platform } = body as {
      clientId: string;
      dateRange: { start: string; end: string };
      platform: Platform;
    };

    if (!clientId || !dateRange?.start || !dateRange?.end || !platform) {
      return NextResponse.json({ error: 'clientId, platform, dateRange.start and dateRange.end are required' }, { status: 400 });
    }

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id,email')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    if (!canAccessClient(auth.user, client.email)) {
      return NextResponse.json({ error: 'Access denied for this client' }, { status: 403 });
    }

    const days = dayDiffInclusive(dateRange.start, dateRange.end);
    const monthly = isMonthlyRange(dateRange.start, dateRange.end);
    const weekly = days <= 7;

    if (monthly || weekly) {
      const summaryType = monthly ? 'monthly' : 'weekly';
      const summaryDate = monthly
        ? dateRange.start
        : formatDateISO(getMondayOfWeek(new Date(`${dateRange.start}T00:00:00.000Z`)));

      // In-flight calendar month / current ISO week: dashboard uses smart cache, not a finalized monthly summary row.
      if (monthly && isActiveCalendarMonth(dateRange, monthly)) {
        const periodId = dateRange.start.slice(0, 7);
        const cached = await tryFetchSmartCacheStored(clientId, platform, 'month', periodId);
        if (cached) {
          const sm = storedMetaFromSmartCacheRow(cached.row);
          return NextResponse.json({
            success: true,
            source: cached.source,
            summaryType,
            summaryDate,
            data: cached.data,
            storedMeta: {
              sourceTable: cached.source,
              periodId,
              ...sm,
              interpretation:
                sm.ageMinutes != null && sm.ageMinutes > 180
                  ? 'Cache is older than ~3h; small spend/booking drift vs live API is expected until the next refresh-all-caches / google-ads-daily-collection run.'
                  : sm.ageMinutes != null && sm.ageMinutes > 30
                    ? 'Cache may lag live slightly; cron refreshes every few hours.'
                    : 'Cache is recent; large conversion_value gaps usually indicate a logic bug (now fixed for Google Σ campaigns).'
            }
          });
        }
      } else if (weekly && isActiveIsoWeek(summaryDate, weekly)) {
        const { periodId } = getCurrentWeekInfo();
        const cached = await tryFetchSmartCacheStored(clientId, platform, 'week', periodId);
        if (cached) {
          const sm = storedMetaFromSmartCacheRow(cached.row);
          return NextResponse.json({
            success: true,
            source: cached.source,
            summaryType,
            summaryDate,
            data: cached.data,
            storedMeta: {
              sourceTable: cached.source,
              periodId,
              ...sm,
              interpretation:
                sm.ageMinutes != null && sm.ageMinutes > 180
                  ? 'Weekly cache may be stale vs live; check last_updated vs your compare time.'
                  : 'Cache is reasonably fresh.'
            }
          });
        }
      }

      const { data: summary, error: summaryError } = await supabase
        .from('campaign_summaries')
        .select('*')
        .eq('client_id', clientId)
        .eq('platform', platform)
        .eq('summary_type', summaryType)
        .eq('summary_date', summaryDate)
        .maybeSingle();

      if (summaryError) {
        return NextResponse.json({ error: summaryError.message }, { status: 500 });
      }

      const lastUp = summary && (summary as any).last_updated != null ? String((summary as any).last_updated) : null;
      let ageM: number | null = null;
      if (lastUp) {
        const t = new Date(lastUp).getTime();
        if (!Number.isNaN(t)) ageM = Math.round((Date.now() - t) / 60000);
      }

      return NextResponse.json({
        success: true,
        source: 'campaign_summaries',
        summaryType,
        summaryDate,
        data: summary || null,
        storedMeta: {
          sourceTable: 'campaign_summaries',
          cacheLastUpdated: lastUp,
          cacheFetchedAt: null,
          ageMinutes: ageM,
          interpretation: summary
            ? 'Finalized monthly/weekly summary row (not smart cache).'
            : 'No summary row for this period.'
        }
      });
    }

    const dataSource = platform === 'meta' ? 'meta_api' : 'google_ads_api';
    const { data: dailyRows, error: dailyError } = await supabase
      .from('daily_kpi_data')
      .select('*')
      .eq('client_id', clientId)
      .eq('data_source', dataSource)
      .gte('date', dateRange.start)
      .lte('date', dateRange.end)
      .order('date', { ascending: true });

    if (dailyError) {
      return NextResponse.json({ error: dailyError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      source: 'daily_kpi_data',
      summaryType: 'custom',
      summaryDate: null,
      data: dailyRows && dailyRows.length > 0 ? aggregateDailyRows(dailyRows) : null,
      rawRows: dailyRows || [],
      storedMeta: {
        sourceTable: 'daily_kpi_data',
        cacheLastUpdated: null,
        cacheFetchedAt: null,
        ageMinutes: null,
        interpretation:
          'Custom range: aggregated from daily_kpi_data rows (not smart cache). Spend drift vs live can occur if daily rows lag.'
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

