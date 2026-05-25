/* eslint-disable no-console */
/**
 * Audit: which metrics are non-zero in last closed month, based on `daily_kpi_data`.
 * Notes:
 * - This reflects what we have actually stored/collected in the DB.
 * - Some metrics from the UI catalog are not present in `daily_kpi_data` schema (yet),
 *   so they will appear as 0 in discovery unless sourced elsewhere.
 */

require('dotenv').config({ path: '.env.local', quiet: true });
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function lastClosed() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const s = new Date(y, m - 1, 1);
  const e = new Date(y, m, 0);
  const ymd = (d) => d.toISOString().split('T')[0];
  return { start: ymd(s), end: ymd(e) };
}

const METRICS = [
  'total_spend',
  'total_impressions',
  'total_clicks',
  'total_conversions',
  'average_ctr',
  'average_cpc',
  'booking_step_1',
  'booking_step_2',
  'reservations',
  'reservation_value',
  'click_to_call',
  'email_contacts',
  'roas',
  'cost_per_reservation',
];

function platformFromDataSource(ds) {
  const s = String(ds || '').toLowerCase();
  if (s.includes('google')) return 'google';
  if (s.includes('meta') || s.includes('facebook')) return 'meta';
  return 'unknown';
}

async function main() {
  const range = lastClosed();

  const { data: clients, error: ce } = await sb.from('clients').select('id,name').order('name');
  if (ce) throw ce;

  const ids = (clients || []).map((c) => c.id);

  const { data: rows, error: de } = await sb
    .from('daily_kpi_data')
    .select(`client_id,date,data_source,${METRICS.join(',')}`)
    .in('client_id', ids)
    .gte('date', range.start)
    .lte('date', range.end);
  if (de) throw de;

  const byClient = new Map();
  for (const r of rows || []) {
    const platform = platformFromDataSource(r.data_source);
    const key = `${r.client_id}::${platform}`;
    const acc = byClient.get(key) || { client_id: r.client_id, platform, days: 0, sums: Object.fromEntries(METRICS.map((m) => [m, 0])) };
    acc.days++;
    for (const m of METRICS) acc.sums[m] += Number(r[m] || 0);
    byClient.set(key, acc);
  }

  const nameById = new Map((clients || []).map((c) => [c.id, c.name]));

  const perClient = Array.from(byClient.values())
    .map((r) => ({
      hotel: nameById.get(r.client_id),
      platform: r.platform,
      days: r.days,
      sums: r.sums,
    }))
    .sort((a, b) => (a.hotel || '').localeCompare(b.hotel || '') || a.platform.localeCompare(b.platform));

  // Metric-level non-zero counts across client-platforms
  const nonZeroCounts = Object.fromEntries(METRICS.map((m) => [m, 0]));
  for (const r of perClient) {
    for (const m of METRICS) {
      if (Math.abs(Number(r.sums[m] || 0)) > 1e-9) nonZeroCounts[m]++;
    }
  }

  console.log(
    JSON.stringify(
      {
        dateRange: range,
        clients: (clients || []).length,
        dailyRows: (rows || []).length,
        clientPlatformsWithAnyData: perClient.length,
        nonZeroCountsPerMetricAcrossClientPlatforms: nonZeroCounts,
        perClient,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

