/**
 * Authoritative Google Ads monthly collector (single client).
 *
 * Fetches the FULL month directly from the Google Ads API, runs an
 * account-level completeness spot-check, and upserts the monthly row into
 * campaign_summaries with data_source 'google_ads_api' (or
 * 'google_ads_api_incomplete' when the campaign sum diverges from the account
 * total). This is the single source of truth for closed-month Google data and
 * is shared by:
 *   - end-of-month-collection cron (bulk, batched)
 *   - verify-google-month-close cron (audit + self-heal)
 *   - scripts/backfill-google-monthly-authoritative.ts (manual remediation)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from './google-ads-api';
import { fetchAndStoreGoogleAdsTables } from './google-ads-tables-storage';
import {
  fetchGoogleDynamicConversionRowsWithService,
  googleDynamicRowsToMetricMap,
} from './google-dynamic-conversion-fetch';

// Campaign spend must be within this fraction of the account-level total or the
// row is flagged incomplete for review/re-collection.
export const COMPLETENESS_TOLERANCE = 0.02;

export interface AuthoritativeCollectResult {
  clientId: string;
  status: 'saved' | 'flagged_incomplete' | 'no_campaigns' | 'dry_run' | 'error';
  campaigns: number;
  spend: number;
  accountSpend: number;
  reservations: number;
  dataSource: string;
  error?: string;
}

/**
 * Collect and persist the authoritative Google Ads monthly summary for a single
 * client. Caller supplies an already-constructed API service (credentials are
 * caller-managed) plus the month boundaries (YYYY-MM-01 .. YYYY-MM-lastDay).
 */
export async function collectAuthoritativeGoogleMonth(
  supabase: SupabaseClient,
  service: GoogleAdsAPIService,
  clientId: string,
  startDate: string,
  endDate: string,
  options: { dryRun?: boolean } = {}
): Promise<AuthoritativeCollectResult> {
  const dryRun = options.dryRun ?? false;

  const campaigns = await service.getCampaignData(startDate, endDate);
  if (!campaigns || campaigns.length === 0) {
    return {
      clientId,
      status: 'no_campaigns',
      campaigns: 0,
      spend: 0,
      accountSpend: 0,
      reservations: 0,
      dataSource: 'google_ads_api',
    };
  }

  const totals = campaigns.reduce(
    (acc: any, c: any) => ({
      spend: acc.spend + (c.spend || 0),
      impressions: acc.impressions + (c.impressions || 0),
      clicks: acc.clicks + (c.clicks || 0),
      conversions: acc.conversions + (c.conversions || 0),
      click_to_call: acc.click_to_call + (c.click_to_call || 0),
      email_contacts: acc.email_contacts + (c.email_contacts || 0),
      booking_step_1: acc.booking_step_1 + (c.booking_step_1 || 0),
      booking_step_2: acc.booking_step_2 + (c.booking_step_2 || 0),
      booking_step_3: acc.booking_step_3 + (c.booking_step_3 || 0),
      reservations: acc.reservations + (c.reservations || 0),
      reservation_value: acc.reservation_value + (c.reservation_value || 0),
    }),
    {
      spend: 0, impressions: 0, clicks: 0, conversions: 0, click_to_call: 0,
      email_contacts: 0, booking_step_1: 0, booking_step_2: 0, booking_step_3: 0,
      reservations: 0, reservation_value: 0,
    }
  );

  const averageCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const averageCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  const roas = totals.spend > 0 ? totals.reservation_value / totals.spend : 0;
  const costPerReservation = totals.reservations > 0 ? totals.spend / totals.reservations : 0;

  // Completeness spot-check against the account-level total.
  let dataSource = 'google_ads_api';
  let accountSpend = 0;
  try {
    const account = await service.getAccountPerformance(startDate, endDate);
    accountSpend = account?.spend || 0;
    if (accountSpend > 0) {
      const ratio = totals.spend / accountSpend;
      if (ratio < 1 - COMPLETENESS_TOLERANCE || ratio > 1 + COMPLETENESS_TOLERANCE) {
        dataSource = 'google_ads_api_incomplete';
      }
    }
  } catch {
    // Non-fatal: keep the campaign-summed values, just can't confirm completeness.
  }

  if (dryRun) {
    return {
      clientId,
      status: 'dry_run',
      campaigns: campaigns.length,
      spend: totals.spend,
      accountSpend,
      reservations: Math.round(totals.reservations),
      dataSource,
    };
  }

  let googleAdsTables: any = null;
  try {
    googleAdsTables = await fetchAndStoreGoogleAdsTables(service, clientId, startDate, endDate);
  } catch {
    // Breakdown tables are best-effort; core totals still get saved.
  }

  let dynamicMetricValues: Record<string, number> = {};
  let dynamicMetricRows: Array<{ key: string; id: string; label: string; count: number; value: number }> = [];
  try {
    const dyn = await fetchGoogleDynamicConversionRowsWithService(service, startDate, endDate);
    if (dyn.fetchOk) {
      dynamicMetricValues = googleDynamicRowsToMetricMap(dyn.rows);
      dynamicMetricRows = dyn.rows;
    }
  } catch {
    // Dynamic conversion metrics are best-effort.
  }

  const { error: saveError } = await supabase
    .from('campaign_summaries')
    .upsert(
      {
        client_id: clientId,
        platform: 'google',
        summary_type: 'monthly',
        summary_date: startDate,
        total_spend: totals.spend,
        total_impressions: Math.round(totals.impressions),
        total_clicks: Math.round(totals.clicks),
        total_conversions: Math.round(totals.conversions),
        average_ctr: averageCtr,
        average_cpc: averageCpc,
        click_to_call: Math.round(totals.click_to_call),
        email_contacts: Math.round(totals.email_contacts),
        booking_step_1: Math.round(totals.booking_step_1),
        booking_step_2: Math.round(totals.booking_step_2),
        booking_step_3: Math.round(totals.booking_step_3),
        reservations: Math.round(totals.reservations),
        reservation_value: totals.reservation_value,
        roas,
        cost_per_reservation: costPerReservation,
        campaign_data: campaigns as any,
        google_ads_tables: googleAdsTables as any,
        google_dynamic_metric_values: dynamicMetricValues as any,
        google_dynamic_metric_rows: dynamicMetricRows as any,
        data_source: dataSource,
        last_updated: new Date().toISOString(),
      },
      { onConflict: 'client_id,summary_type,summary_date,platform' }
    );

  if (saveError) {
    return {
      clientId,
      status: 'error',
      campaigns: campaigns.length,
      spend: totals.spend,
      accountSpend,
      reservations: Math.round(totals.reservations),
      dataSource,
      error: saveError.message,
    };
  }

  return {
    clientId,
    status: dataSource === 'google_ads_api_incomplete' ? 'flagged_incomplete' : 'saved',
    campaigns: campaigns.length,
    spend: totals.spend,
    accountSpend,
    reservations: Math.round(totals.reservations),
    dataSource,
  };
}

/**
 * Build a GoogleAdsAPIService for a client using shared manager credentials.
 * `settings` is a map of system_settings key->value.
 */
export function buildGoogleAdsService(
  settings: Record<string, string>,
  customerId: string,
  clientRefreshToken?: string | null
): GoogleAdsAPIService {
  return new GoogleAdsAPIService({
    refreshToken: settings.google_ads_manager_refresh_token || clientRefreshToken || '',
    clientId: settings.google_ads_client_id,
    clientSecret: settings.google_ads_client_secret,
    developmentToken: settings.google_ads_developer_token,
    customerId,
    managerCustomerId: settings.google_ads_manager_customer_id,
  } as any);
}

/** Month boundary helper: "2026-06" -> { startDate, endDate }. */
export function monthBounds(targetMonth: string): { startDate: string; endDate: string } {
  const [year, month] = targetMonth.split('-').map(Number);
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year!, month!, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { startDate, endDate };
}

/** The just-closed month ("previous month" relative to now) as "YYYY-MM". */
export function justClosedMonth(now: Date = new Date()): string {
  const d = new Date(now);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
