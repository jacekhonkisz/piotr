/**
 * Flatten platform fetch results into a single map keyed like default-metrics-config `key`.
 * Used for dashboard comparison charts and metrics discovery.
 */

import type { StandardizedDataResult } from './standardized-data-fetcher';
import type { GoogleAdsStandardizedDataResult } from './google-ads-standardized-data-fetcher';

type StatsLike = {
  totalSpend?: number;
  totalImpressions?: number;
  totalClicks?: number;
  totalConversions?: number;
  averageCtr?: number;
  averageCpc?: number;
};

type MetaConv = StandardizedDataResult['data']['conversionMetrics'];
type GoogleConv = GoogleAdsStandardizedDataResult['data']['conversionMetrics'];

function num(n: unknown): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

/** Meta (StandardizedDataFetcher) → snapshot */
export function buildMetaMetricSnapshot(
  stats: StatsLike,
  conversionMetrics: MetaConv,
  /** dyn_meta_* counts (server-computed from campaigns.actions or API payload) */
  metaDynamic?: Record<string, number> | null
): Record<string, number> {
  const c = conversionMetrics || ({} as MetaConv);
  const s = stats || {};
  const spend = num(s.totalSpend);
  const conv = num(s.totalConversions);
  const reservations = num(c.reservations);
  const reservationValue = num(c.reservation_value);
  const totalConversionValue = num((c as any).total_conversion_value) || num((c as any).conversion_value) || reservationValue;
  const offlineReservations = Math.round((num(c.email_contacts) + num(c.click_to_call)) * 0.2);
  const avgReservationValue = reservations > 0 ? totalConversionValue / reservations : 0;
  const offlineValue = avgReservationValue * offlineReservations;
  const totalValueWithOffline = totalConversionValue + offlineValue;
  const base: Record<string, number> = {
    totalSpend: spend,
    totalImpressions: num(s.totalImpressions),
    totalClicks: num(s.totalClicks),
    totalConversions: conv,
    averageCtr: num(s.averageCtr),
    averageCpc: num(s.averageCpc),
    reach: num(c.reach),
    frequency: num((c as any).frequency),
    cpm:
      num(s.totalImpressions) > 0
        ? (spend / num(s.totalImpressions)) * 1000
        : 0,
    cpp: num(c.reach) > 0 ? spend / num(c.reach) : 0,
    reservations,
    reservation_value: reservationValue,
    roas: num(c.roas),
    cost_per_reservation: num(c.cost_per_reservation),
    click_to_call: num(c.click_to_call),
    email_contacts: num(c.email_contacts),
    booking_step_1: num(c.booking_step_1),
    booking_step_2: num(c.booking_step_2),
    booking_step_3: num(c.booking_step_3),
    conversion_value: num((c as any).conversion_value),
    total_conversion_value: totalConversionValue,
    offline_reservations: offlineReservations,
    offline_value: offlineValue,
    total_value_with_offline: totalValueWithOffline,
    cost_percentage: totalValueWithOffline > 0 ? (spend / totalValueWithOffline) * 100 : 0,
    averageCpa: conv > 0 ? spend / conv : 0,
    inline_link_clicks: num((c as any).inline_link_clicks),
    lead: num((c as any).lead),
    purchase: num((c as any).purchase),
    purchase_value: num((c as any).purchase_value),
  };
  return { ...base, ...(metaDynamic || {}) };
}

/** Google Ads → snapshot */
export function buildGoogleMetricSnapshot(
  stats: StatsLike,
  conversionMetrics: GoogleConv,
  /** Per–conversion-action counts keyed dyn_google_* (from getAggregatedConversionActionsByName) */
  googleDynamic?: Record<string, number> | null
): Record<string, number> {
  const c = conversionMetrics || ({} as GoogleConv);
  const s = stats || {};
  const spend = num(s.totalSpend);
  const clicks = num(s.totalClicks);
  const conv = num(s.totalConversions);
  const resVal = num(c.reservation_value);
  const totConvVal = num(c.total_conversion_value) || num(c.conversion_value) || resVal;
  const reservations = num(c.reservations);
  const offlineReservations = Math.round((num(c.email_contacts) + num(c.click_to_call)) * 0.2);
  const avgReservationValue = reservations > 0 ? totConvVal / reservations : 0;
  const offlineValue = avgReservationValue * offlineReservations;
  const totalValueWithOffline = totConvVal + offlineValue;
  const base: Record<string, number> = {
    totalSpend: spend,
    totalImpressions: num(s.totalImpressions),
    totalClicks: num(s.totalClicks),
    totalConversions: conv,
    averageCtr: num(s.averageCtr),
    averageCpc: num(s.averageCpc),
    reach: num(c.reach),
    frequency: num((c as any).frequency),
    cpm:
      num(s.totalImpressions) > 0
        ? (spend / num(s.totalImpressions)) * 1000
        : 0,
    cpp: num(c.reach) > 0 ? spend / num(c.reach) : 0,
    reservations,
    reservation_value: resVal,
    roas: num(c.roas),
    cost_per_reservation: num(c.cost_per_reservation),
    click_to_call: num(c.click_to_call),
    email_contacts: num(c.email_contacts),
    booking_step_1: num(c.booking_step_1),
    booking_step_2: num(c.booking_step_2),
    booking_step_3: num(c.booking_step_3),
    conversion_value: num(c.conversion_value),
    total_conversion_value: totConvVal,
    offline_reservations: offlineReservations,
    offline_value: offlineValue,
    total_value_with_offline: totalValueWithOffline,
    cost_percentage: totalValueWithOffline > 0 ? (spend / totalValueWithOffline) * 100 : 0,
    averageCpa: conv > 0 ? spend / conv : 0,
    inline_link_clicks: num((c as any).inline_link_clicks),
    lead: num((c as any).lead),
    purchase: num((c as any).purchase),
    purchase_value: num((c as any).purchase_value) || resVal,
  };
  const dyn = googleDynamic || {};
  return { ...base, ...dyn };
}

export function getSnapshotValue(snapshot: Record<string, number>, key: string): number {
  return num(snapshot[key]);
}
