/**
 * CTR as percent points (e.g. 2.5 means 2.5%), aligned with /reports:
 * prefer stats.averageCtr when defined (including 0); otherwise (clicks/impressions)×100.
 */
export function ctrPercentFromStats(
  averageCtr: unknown,
  totalClicks: number,
  totalImpressions: number
): number {
  if (averageCtr !== undefined && averageCtr !== null && averageCtr !== '') {
    const parsed = Number(averageCtr);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  const imp = Number(totalImpressions) || 0;
  const clk = Number(totalClicks) || 0;
  return imp > 0 ? (clk / imp) * 100 : 0;
}

/**
 * CPC in account currency per click, same contract as CTR:
 * prefer stats.averageCpc when defined (including 0); otherwise spend / clicks.
 */
export function cpcFromStats(
  averageCpc: unknown,
  totalSpend: number,
  totalClicks: number
): number {
  if (averageCpc !== undefined && averageCpc !== null && averageCpc !== '') {
    const parsed = Number(averageCpc);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  const clk = Number(totalClicks) || 0;
  const spend = Number(totalSpend) || 0;
  return clk > 0 ? spend / clk : 0;
}

/**
 * Click-weighted blend of two platform CPCs (same currency as inputs).
 */
export function cpcBlended(
  a: { cpc: number; clicks: number },
  b: { cpc: number; clicks: number }
): number {
  const w = (a.clicks || 0) + (b.clicks || 0);
  if (w <= 0) return 0;
  return ((a.cpc || 0) * (a.clicks || 0) + (b.cpc || 0) * (b.clicks || 0)) / w;
}

/**
 * Impression-weighted blend of two platform CTRs (percent points).
 */
export function ctrPercentBlended(
  a: { ctr: number; impressions: number },
  b: { ctr: number; impressions: number }
): number {
  const w = (a.impressions || 0) + (b.impressions || 0);
  if (w <= 0) return 0;
  return ((a.ctr || 0) * (a.impressions || 0) + (b.ctr || 0) * (b.impressions || 0)) / w;
}
