/**
 * Metrics Audit — client-facing metrics only (live vs stored).
 *
 * Same fields as Report Metric Contract v1 / campaign_summaries / dashboard cards:
 * spend, impressions, clicks, CTR, CPC, funnel + reservation value + ROAS.
 * Plus lightweight sanity rows (Σ campaigns vs stats totals) and stored data_source.
 *
 * Intentionally excludes: dyn_meta_* / dyn_google_* (admin discovery only),
 * conversionDebug, googleAdsTables row counts, and other DB columns not shown to clients.
 */

import type { Platform } from './report-metric-contract';

export type AuditValueKind = 'number' | 'text';

export interface AuditCompareRow {
  group: string;
  key: string;
  label: string;
  kind: AuditValueKind;
  live: string;
  stored: string;
  delta: number | null;
  pctDiff: number | null;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1e7 || (Math.abs(n) < 0.0001 && n !== 0)) return n.toExponential(4);
  const rounded = Math.round(n * 1e6) / 1e6;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(6).replace(/\.?0+$/, '');
}

function fmtText(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function pctDiff(live: number, stored: number): { delta: number; pct: number | null } {
  const delta = live - stored;
  const denom = Math.max(Math.abs(live), Math.abs(stored), 1);
  return { delta, pct: (Math.abs(delta) / denom) * 100 };
}

function metaSumCampaigns(
  campaigns: any[],
  pick: (c: any) => number
): number {
  if (!Array.isArray(campaigns)) return 0;
  return campaigns.reduce((s, c) => s + pick(c), 0);
}

function googleSumCampaigns(campaigns: any[], pick: (c: any) => number): number {
  if (!Array.isArray(campaigns)) return 0;
  return campaigns.reduce((s, c) => s + pick(c), 0);
}

function googleCampaignSpend(c: any): number {
  const micro = c?.cost_micros;
  if (micro != null && micro !== '' && num(micro) !== 0) {
    return num(micro) / 1e6;
  }
  return num(c?.spend);
}

function pushNumberRow(
  rows: AuditCompareRow[],
  group: string,
  key: string,
  label: string,
  liveVal: number,
  storedVal: number
) {
  const { delta, pct } = pctDiff(liveVal, storedVal);
  rows.push({
    group,
    key,
    label,
    kind: 'number',
    live: fmtNumber(liveVal),
    stored: fmtNumber(storedVal),
    delta,
    pctDiff: pct
  });
}

function pushTextRow(
  rows: AuditCompareRow[],
  group: string,
  key: string,
  label: string,
  liveVal: unknown,
  storedVal: unknown
) {
  rows.push({
    group,
    key,
    label,
    kind: 'text',
    live: fmtText(liveVal),
    stored: fmtText(storedVal),
    delta: null,
    pctDiff: null
  });
}

export function buildMetricsAuditRows(
  platform: Platform,
  liveData: Record<string, unknown> | null,
  storedData: Record<string, unknown> | null
): AuditCompareRow[] {
  const rows: AuditCompareRow[] = [];
  const live = liveData || {};
  const stored = storedData || {};

  const stats = (live.stats as Record<string, unknown>) || {};
  const conv = (live.conversionMetrics as Record<string, unknown>) || {};
  const campaigns = (live.campaigns as unknown[]) || [];

  const G_CORE = 'Core — spend, reach, clicks, rates (dashboard & reports)';
  const G_CONV = 'Funnel & value — same as client report / PDF';
  const G_DERIVED = platform === 'meta' ? 'Sanity — Meta campaigns[] vs stats' : 'Sanity — Google campaigns[] vs stats';
  const G_CONTRACT = platform === 'meta'
    ? 'Contract v1 — Meta UI parity (link clicks, inline_link_click_ctr)'
    : 'Contract v1 — Google UI parity (clicks, ctr)';
  const G_CONTEXT = 'Audit context';

  if (platform === 'meta') {
    pushNumberRow(rows, G_CORE, 'total_spend', 'Total spend', num(stats.totalSpend), num(stored.total_spend));
    pushNumberRow(rows, G_CORE, 'total_impressions', 'Total impressions', num(stats.totalImpressions), num(stored.total_impressions));
    pushNumberRow(rows, G_CORE, 'total_clicks', 'Total clicks (link clicks)', num(stats.totalClicks), num(stored.total_clicks));
    pushNumberRow(rows, G_CORE, 'total_conversions', 'Total conversions (= reservations)', num(stats.totalConversions), num(stored.total_conversions));
    pushNumberRow(rows, G_CORE, 'average_ctr', 'CTR %', num(stats.averageCtr), num(stored.average_ctr));
    pushNumberRow(rows, G_CORE, 'average_cpc', 'CPC', num(stats.averageCpc), num(stored.average_cpc));

    pushNumberRow(rows, G_CONV, 'click_to_call', 'Phone / click-to-call', num(conv.click_to_call), num(stored.click_to_call));
    pushNumberRow(rows, G_CONV, 'email_contacts', 'Email contacts', num(conv.email_contacts), num(stored.email_contacts));
    pushNumberRow(rows, G_CONV, 'booking_step_1', 'Booking step 1', num(conv.booking_step_1), num(stored.booking_step_1));
    pushNumberRow(rows, G_CONV, 'booking_step_2', 'Booking step 2', num(conv.booking_step_2), num(stored.booking_step_2));
    pushNumberRow(rows, G_CONV, 'booking_step_3', 'Booking step 3', num(conv.booking_step_3), num(stored.booking_step_3));
    pushNumberRow(rows, G_CONV, 'reservations', 'Reservations', num(conv.reservations), num(stored.reservations));
    pushNumberRow(rows, G_CONV, 'reservation_value', 'Reservation value', num(conv.reservation_value), num(stored.reservation_value));
    pushNumberRow(rows, G_CONV, 'roas', 'ROAS', num(conv.roas), num(stored.roas));
    pushNumberRow(rows, G_CONV, 'cost_per_reservation', 'Cost per reservation', num(conv.cost_per_reservation), num(stored.cost_per_reservation));

    const sumSpend = metaSumCampaigns(campaigns as any[], (c) => num(c.spend));
    const sumImp = metaSumCampaigns(campaigns as any[], (c) => num(c.impressions));
    const sumLink = metaSumCampaigns(campaigns as any[], (c) => num(c.inline_link_clicks ?? c.clicks));
    const sumAllClicks = metaSumCampaigns(campaigns as any[], (c) => num(c.clicks));
    pushNumberRow(rows, G_DERIVED, 'campaigns_count', 'Campaign count (live vs stored total_campaigns)', (campaigns as any[]).length, num(stored.total_campaigns));
    pushNumberRow(rows, G_DERIVED, 'sum_campaign_spend', 'Σ campaign.spend vs stats.totalSpend', sumSpend, num(stats.totalSpend));
    pushNumberRow(rows, G_DERIVED, 'sum_campaign_impressions', 'Σ campaign.impressions vs stats', sumImp, num(stats.totalImpressions));
    pushNumberRow(rows, G_DERIVED, 'sum_campaign_link_clicks', 'Σ link clicks vs stats.totalClicks', sumLink, num(stats.totalClicks));

    // Contract v1 parity — does the stored row match Meta UI (link clicks)?
    const storedClicks = num(stored.total_clicks);
    pushNumberRow(rows, G_CONTRACT, 'stored_clicks_vs_link_clicks', 'Stored total_clicks should equal Σ inline_link_clicks (Meta UI)', sumLink, storedClicks);
    pushNumberRow(rows, G_CONTRACT, 'stored_clicks_vs_all_clicks', 'If stored equals Σ campaign.clicks instead, row was written by legacy writer', sumAllClicks, storedClicks);

    pushTextRow(rows, G_CONTEXT, 'data_source', 'Stored row data_source', null, stored.data_source);
  } else {
    pushNumberRow(rows, G_CORE, 'total_spend', 'Total spend', num(stats.totalSpend), num(stored.total_spend));
    pushNumberRow(rows, G_CORE, 'total_impressions', 'Total impressions', num(stats.totalImpressions), num(stored.total_impressions));
    pushNumberRow(rows, G_CORE, 'total_clicks', 'Total clicks', num(stats.totalClicks), num(stored.total_clicks));
    pushNumberRow(rows, G_CORE, 'total_conversions', 'Total conversions (summary field)', num(conv.reservations), num(stored.total_conversions));
    pushNumberRow(rows, G_CORE, 'average_ctr', 'CTR %', num(stats.averageCtr), num(stored.average_ctr));
    pushNumberRow(rows, G_CORE, 'average_cpc', 'CPC', num(stats.averageCpc), num(stored.average_cpc));

    pushNumberRow(rows, G_CONV, 'click_to_call', 'Phone / click-to-call', num(conv.click_to_call), num(stored.click_to_call));
    pushNumberRow(rows, G_CONV, 'email_contacts', 'Email contacts', num(conv.email_contacts), num(stored.email_contacts));
    pushNumberRow(rows, G_CONV, 'booking_step_1', 'Booking step 1', num(conv.booking_step_1), num(stored.booking_step_1));
    pushNumberRow(rows, G_CONV, 'booking_step_2', 'Booking step 2', num(conv.booking_step_2), num(stored.booking_step_2));
    pushNumberRow(rows, G_CONV, 'booking_step_3', 'Booking step 3', num(conv.booking_step_3), num(stored.booking_step_3));
    pushNumberRow(rows, G_CONV, 'reservations', 'Reservations', num(conv.reservations), num(stored.reservations));
    pushNumberRow(rows, G_CONV, 'reservation_value', 'Reservation value', num(conv.reservation_value), num(stored.reservation_value));
    pushNumberRow(rows, G_CONV, 'conversion_value', 'Conversion value', num(conv.conversion_value), num((stored as any).conversion_value));
    pushNumberRow(rows, G_CONV, 'total_conversion_value', 'Total conversion value', num(conv.total_conversion_value), num((stored as any).total_conversion_value));
    pushNumberRow(rows, G_CONV, 'roas', 'ROAS', num(conv.roas), num(stored.roas));
    pushNumberRow(rows, G_CONV, 'cost_per_reservation', 'Cost per reservation', num(conv.cost_per_reservation), num(stored.cost_per_reservation));

    const sumSpend = googleSumCampaigns(campaigns as any[], googleCampaignSpend);
    const sumImp = googleSumCampaigns(campaigns as any[], (c) => num(c.impressions));
    const sumClk = googleSumCampaigns(campaigns as any[], (c) => num(c.clicks));
    pushNumberRow(rows, G_DERIVED, 'campaigns_count', 'Campaign count (live vs stored)', (campaigns as any[]).length, num(stored.total_campaigns));
    pushNumberRow(rows, G_DERIVED, 'sum_campaign_spend', 'Σ campaign.spend vs stats', sumSpend, num(stats.totalSpend));
    pushNumberRow(rows, G_DERIVED, 'sum_campaign_impressions', 'Σ campaign.impressions vs stats', sumImp, num(stats.totalImpressions));
    pushNumberRow(rows, G_DERIVED, 'sum_campaign_clicks', 'Σ campaign.clicks vs stats', sumClk, num(stats.totalClicks));
    const sumConvVal = googleSumCampaigns(campaigns as any[], (c) => num(c.conversion_value));
    const sumTotConvVal = googleSumCampaigns(campaigns as any[], (c) => num(c.total_conversion_value));
    pushNumberRow(rows, G_DERIVED, 'sum_campaign_conversion_value', 'Σ campaign.conversion_value vs conv.', sumConvVal, num(conv.conversion_value));
    pushNumberRow(rows, G_DERIVED, 'sum_campaign_total_conversion_value', 'Σ campaign.total_conversion_value vs conv.', sumTotConvVal, num(conv.total_conversion_value));

    pushTextRow(rows, G_CONTEXT, 'data_source', 'Stored row data_source', null, stored.data_source);
  }

  return rows;
}

export function groupAuditRows(rows: AuditCompareRow[]): Map<string, AuditCompareRow[]> {
  const m = new Map<string, AuditCompareRow[]>();
  for (const r of rows) {
    const list = m.get(r.group) || [];
    list.push(r);
    m.set(r.group, list);
  }
  return m;
}
