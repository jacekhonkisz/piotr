import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getISOWeekStartDate } from '../../../lib/date-range-utils';
import { getISOWeekNumber, getMondayOfWeek, formatDateISO } from '../../../lib/week-helpers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function formatUTCDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseUTCDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00.000Z');
}

function isCurrentMonthRange(start: Date, end: Date): boolean {
  const now = new Date();
  return (
    start.getUTCFullYear() === now.getFullYear() &&
    start.getUTCMonth() === now.getMonth() &&
    end.getUTCFullYear() === now.getFullYear() &&
    end.getUTCMonth() === now.getMonth()
  );
}

function isCurrentWeekRange(start: Date, end: Date): boolean {
  const now = new Date();
  const currentMonday = getMondayOfWeek(now);
  const rangeMonday = getMondayOfWeek(start);
  return formatDateISO(currentMonday) === formatDateISO(rangeMonday);
}

const calculateChange = (current: number, previous: number): number => {
  if (current === 0 || previous === 0) {
    return -999;
  }
  return ((current - previous) / previous) * 100;
};

function extractSummaryMetrics(summary: any) {
  return {
    spend: summary.total_spend || 0,
    impressions: summary.total_impressions || 0,
    clicks: summary.total_clicks || 0,
    booking_step_1: summary.booking_step_1 || 0,
    booking_step_2: summary.booking_step_2 || 0,
    booking_step_3: summary.booking_step_3 || 0,
    reservations: summary.reservations || 0,
    reservation_value: summary.reservation_value || 0,
  };
}

function selectBestSummary(summaries: any[], summaryType: string): any {
  if (summaries.length === 1) return summaries[0];

  if (summaryType === 'monthly') {
    const firstOfMonth = summaries.find((r) => {
      const d = parseUTCDate(r.summary_date);
      return d.getUTCDate() === 1;
    });
    return firstOfMonth || summaries[0];
  }

  return summaries[0];
}

async function fetchSummaryData(
  clientId: string,
  dbPlatform: string,
  summaryType: string,
  dateRangeStart: string,
  dateRangeEnd: string,
  requestId: string,
  label: string
) {
  const { data, error } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', clientId)
    .eq('summary_type', summaryType)
    .eq('platform', dbPlatform)
    .gte('summary_date', dateRangeStart)
    .lte('summary_date', dateRangeEnd)
    .order('summary_date', { ascending: false });

  console.log(`🔍 [${requestId}] ${label} summaries query:`, {
    clientId: clientId.substring(0, 8),
    summaryType,
    platform: dbPlatform,
    searchRange: [dateRangeStart, dateRangeEnd],
    foundRecords: data?.length || 0,
    error: error?.message || null,
  });

  if (!data || data.length === 0) return null;

  const selected = selectBestSummary(data, summaryType);
  const metrics = extractSummaryMetrics(selected);

  console.log(`✅ [${requestId}] ${label} data from summaries:`, {
    spend: metrics.spend,
    impressions: metrics.impressions,
    clicks: metrics.clicks,
    funnel: `${metrics.booking_step_1}→${metrics.booking_step_2}→${metrics.booking_step_3}→${metrics.reservations}`,
    summaryDate: selected.summary_date,
  });

  return metrics;
}

export async function POST(request: NextRequest) {
  try {
    const { clientId, dateRange, platform } = await request.json();

    if (!clientId || !dateRange || !platform) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const requestId = Math.random().toString(36).substring(7);
    console.log(`🔄 [${requestId}] YoY Comparison Request:`, {
      clientId: clientId.substring(0, 8),
      dateRange,
      platform,
    });

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 });
    }

    // Parse dates in UTC to avoid timezone issues
    const currentStart = parseUTCDate(dateRange.start);
    const currentEnd = parseUTCDate(dateRange.end);
    const daysDiff =
      Math.ceil((currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const isWeekly = daysDiff === 7;

    console.log(`🔍 [${requestId}] Date analysis:`, {
      currentStart: formatUTCDate(currentStart),
      currentEnd: formatUTCDate(currentEnd),
      daysDiff,
      isWeekly,
    });

    // Calculate previous year date range using centralized UTC-safe functions
    let prevDateRange: { start: string; end: string };

    if (isWeekly) {
      const currentWeekNumber = getISOWeekNumber(currentStart);
      const currentYear = currentStart.getUTCFullYear();
      const prevYear = currentYear - 1;
      const prevWeekStart = getISOWeekStartDate(prevYear, currentWeekNumber);
      const prevWeekEnd = new Date(prevWeekStart);
      prevWeekEnd.setUTCDate(prevWeekStart.getUTCDate() + 6);

      prevDateRange = {
        start: formatUTCDate(prevWeekStart),
        end: formatUTCDate(prevWeekEnd),
      };

      console.log(`🔄 [${requestId}] Weekly ISO week calculation:`, {
        currentWeekNumber,
        currentYear,
        prevYear,
        prevWeekStart: prevDateRange.start,
        prevWeekEnd: prevDateRange.end,
      });
    } else {
      const prevYearStart = new Date(
        Date.UTC(currentStart.getUTCFullYear() - 1, currentStart.getUTCMonth(), currentStart.getUTCDate())
      );
      const prevYearEnd = new Date(
        Date.UTC(currentEnd.getUTCFullYear() - 1, currentEnd.getUTCMonth(), currentEnd.getUTCDate())
      );

      prevDateRange = {
        start: formatUTCDate(prevYearStart),
        end: formatUTCDate(prevYearEnd),
      };
    }

    console.log(`🔍 [${requestId}] Previous year date range:`, prevDateRange);

    const dbPlatform = platform === 'google_ads' ? 'google' : platform;
    const summaryType = isWeekly ? 'weekly' : 'monthly';

    // Determine if we're viewing the current period or a historical one
    const isViewingCurrentPeriod = isWeekly
      ? isCurrentWeekRange(currentStart, currentEnd)
      : isCurrentMonthRange(currentStart, currentEnd);

    console.log(`🔍 [${requestId}] Period classification:`, {
      isViewingCurrentPeriod,
      isWeekly,
      strategy: isViewingCurrentPeriod ? 'LIVE (smart cache/API)' : 'DATABASE (campaign_summaries)',
    });

    // ===== FETCH CURRENT PERIOD DATA =====
    let currentData: any = null;

    if (isViewingCurrentPeriod) {
      // Current period: use smart cache / live APIs for the freshest data
      console.log(`🔄 [${requestId}] Fetching CURRENT period data from live source...`);

      const baseUrl =
        process.env.NODE_ENV === 'production'
          ? `${request.nextUrl.protocol}//${request.nextUrl.host}`
          : 'http://localhost:3000';

      if (platform === 'google_ads' || platform === 'google') {
        try {
          const { getGoogleAdsSmartCacheData } = await import(
            '../../../lib/google-ads-smart-cache-helper'
          );
          const smartCacheResult = await getGoogleAdsSmartCacheData(clientId, false);

          if (smartCacheResult.success && smartCacheResult.data?.stats) {
            currentData = { ...smartCacheResult.data.stats };
            if (smartCacheResult.data.conversionMetrics) {
              currentData.totalBookingStep1 =
                smartCacheResult.data.conversionMetrics.booking_step_1 || 0;
              currentData.totalBookingStep2 =
                smartCacheResult.data.conversionMetrics.booking_step_2 || 0;
              currentData.totalBookingStep3 =
                smartCacheResult.data.conversionMetrics.booking_step_3 || 0;
              currentData.totalReservations =
                smartCacheResult.data.conversionMetrics.reservations || 0;
              currentData.totalReservationValue =
                smartCacheResult.data.conversionMetrics.reservation_value || 0;
            }
            console.log(`✅ [${requestId}] Google Ads current data from SMART CACHE`);
          }
        } catch (cacheError) {
          console.error(`❌ [${requestId}] Smart cache error:`, cacheError);
        }
      } else {
        try {
          const response = await fetch(`${baseUrl}/api/fetch-live-data`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: authHeader,
            },
            body: JSON.stringify({
              clientId,
              dateRange,
              platform: 'meta',
              reason: 'yoy-comparison-current',
            }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data?.stats) {
              currentData = { ...data.data.stats };
              if (data.data.conversionMetrics) {
                currentData.totalBookingStep1 =
                  data.data.conversionMetrics.booking_step_1 || 0;
                currentData.totalBookingStep2 =
                  data.data.conversionMetrics.booking_step_2 || 0;
                currentData.totalBookingStep3 =
                  data.data.conversionMetrics.booking_step_3 || 0;
                currentData.totalReservations =
                  data.data.conversionMetrics.reservations || 0;
                currentData.totalReservationValue =
                  data.data.conversionMetrics.reservation_value || 0;
              }
            }
          }
        } catch (fetchError) {
          console.error(`❌ [${requestId}] Meta live fetch error:`, fetchError);
        }
      }
    } else {
      // Historical period: use campaign_summaries (same source as previous year data)
      console.log(
        `🔄 [${requestId}] Fetching HISTORICAL current data from campaign_summaries (same source as previous year)...`
      );

      const summaryMetrics = await fetchSummaryData(
        clientId,
        dbPlatform,
        summaryType,
        dateRange.start,
        dateRange.end,
        requestId,
        'Current (historical)'
      );

      if (summaryMetrics) {
        currentData = {
          totalSpend: summaryMetrics.spend,
          totalImpressions: summaryMetrics.impressions,
          totalClicks: summaryMetrics.clicks,
          totalBookingStep1: summaryMetrics.booking_step_1,
          totalBookingStep2: summaryMetrics.booking_step_2,
          totalBookingStep3: summaryMetrics.booking_step_3,
          totalReservations: summaryMetrics.reservations,
          totalReservationValue: summaryMetrics.reservation_value,
        };
      }
    }

    console.log(`✅ [${requestId}] Current data resolved:`, {
      source: isViewingCurrentPeriod ? 'live' : 'campaign_summaries',
      totalSpend: currentData?.totalSpend || 0,
      totalImpressions: currentData?.totalImpressions || 0,
      totalClicks: currentData?.totalClicks || 0,
      funnel: `${currentData?.totalBookingStep1 || 0}→${currentData?.totalBookingStep2 || 0}→${currentData?.totalBookingStep3 || 0}→${currentData?.totalReservations || 0}`,
    });

    // ===== FETCH PREVIOUS YEAR DATA (always from campaign_summaries) =====
    const previousMetrics = await fetchSummaryData(
      clientId,
      dbPlatform,
      summaryType,
      prevDateRange.start,
      prevDateRange.end,
      requestId,
      'Previous year'
    );

    const previousData = previousMetrics || {
      spend: 0,
      impressions: 0,
      clicks: 0,
      booking_step_1: 0,
      booking_step_2: 0,
      booking_step_3: 0,
      reservations: 0,
      reservation_value: 0,
    };

    // ===== CALCULATE CHANGES =====
    const changes = {
      spend: calculateChange(currentData?.totalSpend || 0, previousData.spend),
      impressions: calculateChange(currentData?.totalImpressions || 0, previousData.impressions),
      clicks: calculateChange(currentData?.totalClicks || 0, previousData.clicks),
      booking_step_1: calculateChange(
        currentData?.totalBookingStep1 || 0,
        previousData.booking_step_1
      ),
      booking_step_2: calculateChange(
        currentData?.totalBookingStep2 || 0,
        previousData.booking_step_2
      ),
      booking_step_3: calculateChange(
        currentData?.totalBookingStep3 || 0,
        previousData.booking_step_3
      ),
      reservations: calculateChange(
        currentData?.totalReservations || 0,
        previousData.reservations
      ),
      reservation_value: calculateChange(
        currentData?.totalReservationValue || 0,
        previousData.reservation_value
      ),
    };

    const responsePayload = {
      current: {
        spend: currentData?.totalSpend || 0,
        impressions: currentData?.totalImpressions || 0,
        clicks: currentData?.totalClicks || 0,
        booking_step_1: currentData?.totalBookingStep1 || 0,
        booking_step_2: currentData?.totalBookingStep2 || 0,
        booking_step_3: currentData?.totalBookingStep3 || 0,
        reservations: currentData?.totalReservations || 0,
        reservation_value: currentData?.totalReservationValue || 0,
      },
      previous: {
        spend: previousData.spend,
        impressions: previousData.impressions,
        clicks: previousData.clicks,
        booking_step_1: previousData.booking_step_1,
        booking_step_2: previousData.booking_step_2,
        booking_step_3: previousData.booking_step_3,
        reservations: previousData.reservations,
        reservation_value: previousData.reservation_value,
      },
      changes: {
        spend: changes.spend || 0,
        impressions: changes.impressions || 0,
        clicks: changes.clicks || 0,
        booking_step_1: changes.booking_step_1 || 0,
        booking_step_2: changes.booking_step_2 || 0,
        booking_step_3: changes.booking_step_3 || 0,
        reservations: changes.reservations || 0,
        reservation_value: changes.reservation_value || 0,
      },
      _metadata: {
        platformRequested: platform,
        platformUsed: dbPlatform,
        isWeekly,
        summaryType,
        isViewingCurrentPeriod,
        currentDateRange: dateRange,
        previousDateRange: prevDateRange,
        currentDataSource: isViewingCurrentPeriod ? 'live' : 'campaign_summaries',
        previousDataSource: 'campaign_summaries',
        previousDataFound: !!previousMetrics,
      },
    };

    console.log(`✅ [${requestId}] YoY Comparison Response:`, {
      currentSpend: responsePayload.current.spend,
      previousSpend: responsePayload.previous.spend,
      spendChange: responsePayload.changes.spend,
      currentRange: dateRange,
      previousRange: prevDateRange,
    });

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error('YoY Comparison Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
