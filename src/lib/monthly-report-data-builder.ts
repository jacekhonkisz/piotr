/**
 * Shared monthly report data builder.
 *
 * Single source of truth for the numbers that appear in the client monthly
 * email. Both the scheduler (`email-scheduler.ts`) and the manual send route
 * (`/api/send-report`) call this so the two pipelines can never diverge on
 * data source (StandardizedDataFetcher) or metric definitions (ROAS,
 * konwersje/reservations, offline model, cost percentages — all delegated to
 * `prepareClientMonthlyReportData`).
 */

import { StandardizedDataFetcher } from './standardized-data-fetcher';
import { GoogleAdsStandardizedDataFetcher } from './google-ads-standardized-data-fetcher';
import { getPolishMonthName, prepareClientMonthlyReportData } from './email-helpers';
import logger from './logger';

export interface MonthlyReportClient {
  id: string;
  name: string;
  google_ads_enabled?: boolean;
  meta_access_token?: string | null;
}

export interface MonthlyReportPeriod {
  start: string;
  end: string;
}

export interface MonthlyReportBuildResult {
  /** Payload consumed by the email template (shape of prepareClientMonthlyReportData). */
  reportData: ReturnType<typeof prepareClientMonthlyReportData>;
  monthName: string;
  monthNumber: number;
  year: number;
  googleAdsData: Record<string, number> | undefined;
  metaAdsData: Record<string, number> | undefined;
  metaCampaignRows: any[] | undefined;
}

/**
 * Fetch Meta + Google Ads data via the standardized fetchers for the given
 * period and compute the canonical email report payload.
 */
export async function buildMonthlyReportData(params: {
  client: MonthlyReportClient;
  period: MonthlyReportPeriod;
  sessionToken?: string;
  reasonPrefix?: string;
}): Promise<MonthlyReportBuildResult> {
  const { client, period, sessionToken, reasonPrefix = 'monthly-report' } = params;

  // Step 1: Google Ads data (only when enabled for this client)
  let googleAdsData: Record<string, number> | undefined;
  if (client.google_ads_enabled) {
    try {
      const googleResult = await GoogleAdsStandardizedDataFetcher.fetchData({
        clientId: client.id,
        dateRange: { start: period.start, end: period.end },
        reason: `${reasonPrefix}-google-ads`,
        sessionToken
      });

      if (googleResult.success && googleResult.data) {
        const stats = googleResult.data.stats;
        const conversions = googleResult.data.conversionMetrics as Record<string, number> | undefined;
        const emailClicks = conversions?.email_contacts ?? (conversions as any)?.email_clicks ?? 0;
        const phoneClicks = conversions?.click_to_call ?? (conversions as any)?.phone_calls ?? 0;

        googleAdsData = {
          spend: stats.totalSpend || 0,
          impressions: stats.totalImpressions || 0,
          clicks: stats.totalClicks || 0,
          averageCtr: stats.averageCtr || 0,
          averageCpc: stats.averageCpc || 0,
          emailClicks,
          phoneClicks,
          bookingStep1: conversions?.booking_step_1 || 0,
          bookingStep2: conversions?.booking_step_2 || 0,
          bookingStep3: conversions?.booking_step_3 || 0,
          reservations: conversions?.reservations || 0,
          reservationValue: conversions?.reservation_value || 0
        };
      }
    } catch (error) {
      logger.warn('⚠️ buildMonthlyReportData: Google Ads fetch failed', {
        clientId: client.id,
        error: error instanceof Error ? error.message : 'unknown'
      });
    }
  }

  // Step 2: Meta Ads data (only when a token is configured)
  let metaAdsData: Record<string, number> | undefined;
  let metaCampaignRows: any[] | undefined;
  if (client.meta_access_token) {
    try {
      const metaResult = await StandardizedDataFetcher.fetchData({
        clientId: client.id,
        dateRange: { start: period.start, end: period.end },
        platform: 'meta',
        reason: `${reasonPrefix}-meta-ads`,
        sessionToken
      });

      if (metaResult.success && metaResult.data) {
        metaCampaignRows = (metaResult.data.campaigns || []).filter(
          (c: any) => !c.platform || c.platform === 'meta'
        );
        const stats = metaResult.data.stats;
        const conversions = metaResult.data.conversionMetrics as Record<string, number> | undefined;
        const emailClicks = conversions?.email_contacts ?? (conversions as any)?.email_clicks ?? 0;
        const phoneClicks = conversions?.click_to_call ?? (conversions as any)?.phone_calls ?? 0;

        metaAdsData = {
          spend: stats.totalSpend || 0,
          impressions: stats.totalImpressions || 0,
          linkClicks: stats.totalClicks || 0,
          averageCtr: stats.averageCtr || 0,
          averageCpc: stats.averageCpc || 0,
          emailClicks,
          phoneClicks,
          reservations: conversions?.reservations || 0,
          reservationValue: conversions?.reservation_value || 0
        };
      }
    } catch (error) {
      logger.warn('⚠️ buildMonthlyReportData: Meta Ads fetch failed', {
        clientId: client.id,
        error: error instanceof Error ? error.message : 'unknown'
      });
    }
  }

  // Step 3: Polish month/year for the template header, derived from period start
  const startDate = new Date(period.start);
  const monthNumber = startDate.getUTCMonth() + 1;
  const year = startDate.getUTCFullYear();
  const monthName = getPolishMonthName(monthNumber);

  // Step 4: Canonical metric calculation (ROAS, konwersje, offline, cost %)
  const reportData = prepareClientMonthlyReportData(
    client.id,
    client.name,
    monthNumber,
    year,
    googleAdsData,
    metaAdsData,
    undefined,
    metaCampaignRows
  );

  return { reportData, monthName, monthNumber, year, googleAdsData, metaAdsData, metaCampaignRows };
}

/**
 * Map the builder's flattened platform data into the `campaign_summaries`-style
 * shape that `adaptCampaignSummary` expects, so the pre-send guard can validate
 * exactly what we are about to send against a fresh live baseline.
 */
export function builtPlatformToSummaryShape(
  data: Record<string, number>,
  platform: 'meta' | 'google'
): Record<string, number> {
  const clicks = platform === 'meta' ? (data.linkClicks || 0) : (data.clicks || 0);
  return {
    total_spend: data.spend || 0,
    total_impressions: data.impressions || 0,
    total_clicks: clicks,
    average_ctr: data.averageCtr || 0,
    average_cpc: data.averageCpc || 0,
    email_contacts: data.emailClicks || 0,
    click_to_call: data.phoneClicks || 0,
    booking_step_1: data.bookingStep1 || 0,
    booking_step_2: data.bookingStep2 || 0,
    booking_step_3: data.bookingStep3 || 0,
    reservations: data.reservations || 0,
    reservation_value: data.reservationValue || 0
  };
}
