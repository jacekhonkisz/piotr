#!/usr/bin/env npx tsx
/**
 * Simulates what /reports does when loading Google data:
 * same routing rules as fetch-google-ads-live-data + GoogleAdsStandardizedDataFetcher.
 *
 * Uses service role (same as the API route on the server).
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function loadHistoricalFromDb(
  clientId: string,
  startDate: string,
  endDate: string,
): Promise<{ hit: boolean; source: string; spend: number; dynKeys: number; ms: number }> {
  const t0 = Date.now();
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const isWeekly = daysDiff <= 7;

  let row: Record<string, unknown> | null = null;

  if (isWeekly) {
    const { getMondayOfWeek, formatDateISO } = await import('../src/lib/week-helpers');
    const monday = formatDateISO(getMondayOfWeek(start));
    const { data } = await admin
      .from('campaign_summaries')
      .select('total_spend,google_dynamic_metric_values,data_source')
      .eq('client_id', clientId)
      .eq('platform', 'google')
      .eq('summary_type', 'weekly')
      .eq('summary_date', monday)
      .maybeSingle();
    row = data;
  } else {
    const { data } = await admin
      .from('campaign_summaries')
      .select('total_spend,google_dynamic_metric_values,data_source,summary_date')
      .eq('client_id', clientId)
      .eq('platform', 'google')
      .eq('summary_type', 'monthly')
      .gte('summary_date', startDate)
      .lte('summary_date', endDate)
      .order('summary_date', { ascending: true })
      .limit(1);
    row = data?.[0] ?? null;
  }

  const ms = Date.now() - t0;
  if (!row) {
    return { hit: false, source: 'none', spend: 0, dynKeys: 0, ms };
  }

  const dyn = (row.google_dynamic_metric_values as Record<string, number>) || {};
  return {
    hit: true,
    source: String(row.data_source || 'campaign_summaries'),
    spend: Number(row.total_spend || 0),
    dynKeys: Object.keys(dyn).length,
    ms,
  };
}

async function loadCurrentMonthCache(
  clientId: string,
): Promise<{ hit: boolean; spend: number; dynKeys: number; hasTables: boolean; ms: number }> {
  const t0 = Date.now();
  const now = new Date();
  const periodId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const { data } = await admin
    .from('google_ads_current_month_cache')
    .select('cache_data')
    .eq('client_id', clientId)
    .eq('period_id', periodId)
    .maybeSingle();

  const ms = Date.now() - t0;
  if (!data?.cache_data) {
    return { hit: false, spend: 0, dynKeys: 0, hasTables: false, ms };
  }

  const cd = data.cache_data as Record<string, unknown>;
  const stats = (cd.stats as Record<string, number>) || {};
  const dyn = (cd.dynamicMetricValues as Record<string, number>) || {};
  return {
    hit: true,
    spend: Number(stats.totalSpend || 0),
    dynKeys: Object.keys(dyn).length,
    hasTables: !!cd.googleAdsTables,
    ms,
  };
}

async function main() {
  const { data: client } = await admin
    .from('clients')
    .select('id, name')
    .eq('google_ads_enabled', true)
    .eq('name', 'Belmonte Hotel')
    .single();

  if (!client) {
    console.error('Client not found');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('GOOGLE /reports DATA SOURCE TEST');
  console.log(`Client: ${client.name}`);
  console.log('(mirrors server-side path in /api/fetch-google-ads-live-data)');
  console.log('═══════════════════════════════════════════════════════════\n');

  const cases = [
    {
      label: 'Past month (Apr 2026) — UI path',
      ui: 'POST /api/fetch-google-ads-live-data, shouldUseDatabase=true',
      run: () => loadHistoricalFromDb(client.id, '2026-04-01', '2026-04-30'),
    },
    {
      label: 'Past week (6–12 Apr 2026) — UI path',
      ui: 'POST /api/fetch-google-ads-live-data, shouldUseDatabase=true',
      run: () => loadHistoricalFromDb(client.id, '2026-04-06', '2026-04-12'),
    },
    {
      label: 'Current month (May 2026) — UI path',
      ui: 'Smart cache google_ads_current_month_cache (no Google API if cache hit)',
      run: async () => {
        const c = await loadCurrentMonthCache(client.id);
        return {
          hit: c.hit,
          source: c.hit ? 'google_ads_current_month_cache' : 'none',
          spend: c.spend,
          dynKeys: c.dynKeys,
          ms: c.ms,
          extra: c.hasTables ? 'tables in cache' : 'no tables in cache',
        };
      },
    },
  ];

  for (const c of cases) {
    const r = await c.run();
    const extra = (r as { extra?: string }).extra;
    console.log(`── ${c.label} ──`);
    console.log(`  UI route:     ${c.ui}`);
    if (r.hit) {
      console.log(`  Result:       ✅ STORED/CACHED (no live Google API for main KPIs)`);
      console.log(`  DB read time: ${r.ms}ms`);
      console.log(`  spend:        ${r.spend.toFixed(2)} PLN`);
      console.log(`  dyn keys:     ${r.dynKeys}`);
      if (extra) console.log(`  note:         ${extra}`);
    } else {
      console.log(`  Result:       ⚠️ MISS — UI would fall back to live Google API`);
      console.log(`  DB read time: ${r.ms}ms`);
    }
    console.log('');
  }

  console.log('When YOU open /reports in the browser:\n');
  console.log('  1. Past month/week → server reads campaign_summaries (+ google_ads_tables_data)');
  console.log('     Response debug.source = "campaign-summaries-database"');
  console.log('     Network tab: one POST to /api/fetch-google-ads-live-data, NOT Google Ads hosts\n');
  console.log('  2. Current month/week → server reads google_ads_*_cache (3h TTL)');
  console.log('     debug.source = "google-ads-smart-cache" or "google-ads-weekly-smart-cache"\n');
  console.log('  3. Refresh button (Odśwież) → forceFresh/bypassAllCache → live Google API\n');
  console.log('  4. Historical + empty breakdown tables → one-time API backfill, then stored\n');
  console.log('Verify in DevTools → Network → filter "fetch-google-ads-live-data" → Response JSON → debug.source\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
