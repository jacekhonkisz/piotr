#!/usr/bin/env npx tsx
/**
 * Audit Google Ads historical recollection coverage in Supabase.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const RECOLLECT_SOURCES = new Set(['google_ads_api', 'attribution_recollection', 'google_ads_api_backfill']);
const RECOLLECT_WINDOW_MS = 72 * 60 * 60 * 1000; // last 72h

type Row = {
  id: string;
  client_id: string;
  summary_type: string;
  summary_date: string;
  data_source: string | null;
  last_updated: string | null;
  total_spend: number | null;
  google_dynamic_metric_values: Record<string, number> | null;
};

async function fetchClientGoogleSummaries(clientId: string): Promise<Row[]> {
  const rows: Row[] = [];
  const pageSize = 200;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('campaign_summaries')
      .select(
        'id,client_id,summary_type,summary_date,data_source,last_updated,total_spend,google_dynamic_metric_values',
      )
      .eq('platform', 'google')
      .eq('client_id', clientId)
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`${clientId}: ${error.message}`);
    if (!data?.length) break;
    rows.push(...(data as Row[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

function hasDynValues(row: Row): boolean {
  const v = row.google_dynamic_metric_values;
  return !!v && typeof v === 'object' && Object.keys(v).length > 0;
}

function isRecentlyRecollected(row: Row): boolean {
  if (!row.last_updated) return false;
  const ts = new Date(row.last_updated).getTime();
  if (Date.now() - ts > RECOLLECT_WINDOW_MS) return false;
  return RECOLLECT_SOURCES.has(row.data_source || '') || row.data_source === 'google_ads_api';
}

function expectedMonths(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 1; i <= 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`,
    );
  }
  return months;
}

async function main() {
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name')
    .eq('google_ads_enabled', true)
    .not('google_ads_customer_id', 'is', null)
    .order('name');

  if (clientsError) throw clientsError;

  const clientNames = Object.fromEntries((clients || []).map((c) => [c.id, c.name]));

  const inScope: Row[] = [];
  for (const client of clients || []) {
    process.stdout.write(`  loading ${client.name.slice(0, 28)}...`);
    const chunk = await fetchClientGoogleSummaries(client.id);
    inScope.push(...chunk);
    console.log(` ${chunk.length} rows`);
  }
  const monthly = inScope.filter((r) => r.summary_type === 'monthly');
  const weekly = inScope.filter((r) => r.summary_type === 'weekly');

  const withDyn = inScope.filter(hasDynValues);
  const recentRecollect = inScope.filter(isRecentlyRecollected);
  const missingDyn = inScope.filter((r) => !hasDynValues(r));

  const expected = expectedMonths();
  const expectedPerClient = expected.length;

  console.log('═══════════════════════════════════════════════════════════');
  console.log('GOOGLE ADS RECOLLECT AUDIT');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`Audit time: ${new Date().toISOString()}`);
  console.log(`Google-enabled clients: ${clients?.length ?? 0}`);
  console.log(`campaign_summaries (google, in-scope): ${inScope.length}`);
  console.log(`  monthly: ${monthly.length}  weekly: ${weekly.length}\n`);

  console.log('── Field coverage (all in-scope rows) ──');
  console.log(
    `  google_dynamic_metric_values (non-empty): ${withDyn.length}/${inScope.length} (${pct(withDyn.length, inScope.length)})`,
  );
  console.log(
    `  updated in last 72h (collector sources):  ${recentRecollect.length}/${inScope.length}\n`,
  );

  console.log('── By period type (missing dynamic metrics) ──');
  for (const type of ['monthly', 'weekly'] as const) {
    const subset = inScope.filter((r) => r.summary_type === type);
    const miss = subset.filter((r) => !hasDynValues(r));
    console.log(`  ${type}: ${miss.length}/${subset.length} missing dyn (${pct(miss.length, subset.length)})`);
  }

  console.log('\n── Per client ──');
  console.log(
    '  ' +
      'Client'.padEnd(36) +
      'Rows'.padStart(6) +
      'DynOK'.padStart(7) +
      'Miss'.padStart(6) +
      'Mo'.padStart(5) +
      'Wk'.padStart(5) +
      'Rec72h'.padStart(8),
  );
  console.log('  ' + '-'.repeat(73));

  for (const client of clients || []) {
    const cr = inScope.filter((r) => r.client_id === client.id);
    const dynOk = cr.filter(hasDynValues).length;
    const miss = cr.length - dynOk;
    const mo = cr.filter((r) => r.summary_type === 'monthly').length;
    const wk = cr.filter((r) => r.summary_type === 'weekly').length;
    const rec = cr.filter(isRecentlyRecollected).length;
    const flag = miss > 0 ? '' : ' ✓';
    console.log(
      '  ' +
        client.name.slice(0, 36).padEnd(36) +
        String(cr.length).padStart(6) +
        String(dynOk).padStart(7) +
        String(miss).padStart(6) +
        String(mo).padStart(5) +
        String(wk).padStart(5) +
        String(rec).padStart(8) +
        flag,
    );
  }

  console.log('\n── Monthly coverage vs expected 18 months ──');
  for (const client of clients || []) {
    const mo = monthly.filter((r) => r.client_id === client.id);
    const have = new Set(mo.map((r) => r.summary_date));
    const missingMonths = expected.filter((d) => !have.has(d));
    const dynOkMonths = mo.filter(hasDynValues).length;
    const status =
      missingMonths.length === 0 && dynOkMonths >= expectedPerClient
        ? 'OK'
        : missingMonths.length > 0
          ? `missing ${missingMonths.length} mo`
          : `dyn ${dynOkMonths}/${mo.length}`;
    console.log(`  ${client.name.slice(0, 32).padEnd(32)} ${status}`);
    if (missingMonths.length > 0 && missingMonths.length <= 4) {
      console.log(`    absent: ${missingMonths.join(', ')}`);
    }
  }

  const { count: tablesRows } = await supabase
    .from('google_ads_tables_data')
    .select('*', { count: 'exact', head: true });

  const { data: tablesByClient } = await supabase
    .from('google_ads_tables_data')
    .select('client_id');

  const tablesPerClient: Record<string, number> = {};
  for (const t of tablesByClient || []) {
    tablesPerClient[t.client_id] = (tablesPerClient[t.client_id] || 0) + 1;
  }

  console.log('\n── google_ads_tables_data ──');
  console.log(`  total rows: ${tablesRows ?? 0}`);
  for (const client of clients || []) {
    console.log(`  ${client.name.slice(0, 32).padEnd(32)} ${tablesPerClient[client.id] ?? 0} ranges`);
  }

  if (missingDyn.length > 0) {
    console.log('\n── Sample rows still missing dynamic metrics (max 15) ──');
    for (const r of missingDyn.slice(0, 15)) {
      console.log(
        `  ${(clientNames[r.client_id] || r.client_id).slice(0, 28)} | ${r.summary_type} ${r.summary_date} | spend ${r.total_spend ?? 0} | src ${r.data_source} | upd ${r.last_updated?.slice(0, 19) ?? 'n/a'}`,
      );
    }
  }

  // Overall verdict
  const complete =
    missingDyn.length === 0 &&
    withDyn.length === inScope.length &&
    (clients?.length ?? 0) > 0;

  const partial = withDyn.length > 0 && missingDyn.length < inScope.length;

  console.log('\n═══════════════════════════════════════════════════════════');
  if (complete) {
    console.log('VERDICT: PASS — all in-scope Google summaries have dynamic metrics.');
  } else if (partial) {
    console.log(
      `VERDICT: PARTIAL — ${withDyn.length}/${inScope.length} rows have dynamic metrics; ${missingDyn.length} still empty.`,
    );
    console.log('  Check if recollect job is still running (only client 1 may be done).');
  } else {
    console.log('VERDICT: FAIL — dynamic metrics largely missing; migration or recollect may not have run.');
  }
  console.log('═══════════════════════════════════════════════════════════\n');
}

function pct(n: number, d: number): string {
  if (!d) return '0%';
  return `${Math.round((100 * n) / d)}%`;
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
