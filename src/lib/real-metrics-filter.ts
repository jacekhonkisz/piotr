/**
 * UI filters: only show metrics that exist in API snapshots (not placeholders)
 * and have a non-zero value in at least one compared period.
 */

/** Keys that `metric-snapshot` does not populate from API (always 0 today). */
export const SNAPSHOT_PLACEHOLDER_KEYS = new Set<string>([
  'frequency',
  'inline_link_clicks',
  'lead',
]);

export function hasNumericValue(n: unknown): boolean {
  const x = Number(n);
  return Number.isFinite(x) && Math.abs(x) > 1e-9;
}

/** Discovery table: last completed month (recent) or prior month had data on Meta or Google. */
export function filterDiscoveryCatalogKeys(
  keys: string[],
  metaRecent: Record<string, number>,
  googleRecent: Record<string, number>,
  metaPrior: Record<string, number>,
  googlePrior: Record<string, number>
): string[] {
  return keys.filter((k) => {
    if (SNAPSHOT_PLACEHOLDER_KEYS.has(k)) return false;
    return (
      hasNumericValue(metaRecent[k]) ||
      hasNumericValue(googleRecent[k]) ||
      hasNumericValue(metaPrior[k]) ||
      hasNumericValue(googlePrior[k])
    );
  });
}

/** Dashboard MoM charts: show only metrics with data in current month and/or previous month snapshot. */
export function filterChartMetricsWithRealData<T extends { key: string }>(
  charts: T[],
  current: Record<string, number>,
  previous: Record<string, number>
): T[] {
  return charts.filter((m) => {
    if (SNAPSHOT_PLACEHOLDER_KEYS.has(m.key)) return false;
    return hasNumericValue(current[m.key]) || hasNumericValue(previous[m.key]);
  });
}

/** Modal chart toggles: metric had data for this platform in discovery (recent or prior). */
export function metricHadDataForPlatform(
  platform: 'meta' | 'google',
  key: string,
  metaRecent: Record<string, number>,
  metaPrior: Record<string, number>,
  googleRecent: Record<string, number>,
  googlePrior: Record<string, number>
): boolean {
  if (SNAPSHOT_PLACEHOLDER_KEYS.has(key)) return false;
  if (platform === 'meta') {
    return hasNumericValue(metaRecent[key]) || hasNumericValue(metaPrior[key]);
  }
  return hasNumericValue(googleRecent[key]) || hasNumericValue(googlePrior[key]);
}
