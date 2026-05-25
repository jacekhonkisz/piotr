#!/usr/bin/env npx tsx
/**
 * Audit: stored campaign_summaries (meta, monthly) vs live Meta Graph API.
 * Flags rows where DB has spend/impressions but API returns empty for that month.
 *
 * Usage: npx tsx scripts/audit-stored-vs-live-meta.ts [--apply-report-only]
 * Output: audit-stored-vs-live-meta-{timestamp}.json + .md in project root
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const SPEND_TOLERANCE_PLN = 1;
const IMPRESSION_TOLERANCE = 10;
const API_DELAY_MS = 180;

type StoredRow = {
  id: string;
  client_id: string;
  summary_date: string;
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  reservations: number | null;
  data_source: string | null;
  last_updated: string | null;
  campaign_data: Array<Record<string, unknown>> | null;
};

type ClientInfo = {
  id: string;
  name: string;
  ad_account_id: string | null;
  system_user_token: string | null;
  meta_access_token: string | null;
};

type AuditRow = {
  clientId: string;
  clientName: string;
  period: string;
  summaryDate: string;
  storedSpend: number;
  storedImpressions: number;
  storedClicks: number;
  storedConversions: number;
  storedReservations: number | null;
  dataSource: string | null;
  lastUpdated: string | null;
  liveSpend: number | null;
  liveImpressions: number | null;
  liveClicks: number | null;
  liveError: string | null;
  status:
    | 'PHANTOM_STORED' // stored > 0, API = 0
    | 'MISMATCH' // both > 0, differ materially
    | 'MATCH'
    | 'STORED_EMPTY' // stored = 0 (skipped in main set)
    | 'API_ERROR'
    | 'NO_CREDENTIALS';
  syntheticMarkers: string[];
  campaignCount: number;
};

function periodFromSummaryDate(summaryDate: string): { start: string; end: string; tag: string } {
  const tag = summaryDate.slice(0, 7);
  const [y, m] = tag.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    tag,
    start: `${tag}-01`,
    end: `${tag}-${String(lastDay).padStart(2, '0')}`,
  };
}

function detectSyntheticMarkers(campaignData: Array<Record<string, unknown>> | null): string[] {
  const markers: string[] = [];
  if (!campaignData?.length) return markers;

  const names = campaignData.map((c) => String(c.campaign_name || c.campaignName || ''));
  const ids = campaignData.map((c) => String(c.campaign_id || c.campaignId || ''));

  if (names.some((n) => / - Campaign \d+$/i.test(n))) {
    markers.push('generic_campaign_names');
  }
  if (ids.some((id) => id.startsWith('campaign_'))) {
    markers.push('synthetic_campaign_ids');
  }
  if (campaignData.length <= 4 && names.every((n) => /Campaign \d/i.test(n))) {
    markers.push('likely_populate_script');
  }

  return markers;
}

async function fetchLiveAccountInsights(
  token: string,
  adAccountId: string,
  start: string,
  end: string
): Promise<{ spend: number; impressions: number; clicks: number; error: string | null }> {
  const adId = adAccountId.startsWith('act_') ? adAccountId.substring(4) : adAccountId;
  const url =
    `https://graph.facebook.com/v21.0/act_${adId}/insights?level=account` +
    `&time_range={"since":"${start}","until":"${end}"}` +
    `&fields=spend,impressions,clicks&access_token=${token}`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    if (json.error) {
      return { spend: 0, impressions: 0, clicks: 0, error: json.error.message || JSON.stringify(json.error) };
    }
    const row = json.data?.[0];
    return {
      spend: parseFloat(row?.spend || '0'),
      impressions: parseInt(row?.impressions || '0', 10),
      clicks: parseInt(row?.clicks || '0', 10),
      error: null,
    };
  } catch (e) {
    return {
      spend: 0,
      impressions: 0,
      clicks: 0,
      error: e instanceof Error ? e.message : 'fetch failed',
    };
  }
}

function classify(
  stored: { spend: number; impressions: number },
  live: { spend: number; impressions: number; error: string | null }
): AuditRow['status'] {
  if (live.error) return 'API_ERROR';
  const storedHas = stored.spend > SPEND_TOLERANCE_PLN || stored.impressions > IMPRESSION_TOLERANCE;
  const liveHas = live.spend > SPEND_TOLERANCE_PLN || live.impressions > IMPRESSION_TOLERANCE;

  if (storedHas && !liveHas) return 'PHANTOM_STORED';
  if (!storedHas && liveHas) return 'STORED_EMPTY';
  if (storedHas && liveHas) {
    const spendDiff = Math.abs(stored.spend - live.spend);
    const impDiff = Math.abs(stored.impressions - live.impressions);
    if (spendDiff > Math.max(50, stored.spend * 0.05) || impDiff > Math.max(500, stored.impressions * 0.05)) {
      return 'MISMATCH';
    }
    return 'MATCH';
  }
  return 'MATCH';
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: clients, error: clientsErr } = await supabase
    .from('clients')
    .select('id, name, ad_account_id, system_user_token, meta_access_token')
    .not('ad_account_id', 'is', null);

  if (clientsErr) throw clientsErr;

  const clientMap = new Map<string, ClientInfo>();
  for (const c of clients || []) {
    clientMap.set(c.id, c as ClientInfo);
  }

  const { data: storedRows, error: storedErr } = await supabase
    .from('campaign_summaries')
    .select(
      'id, client_id, summary_date, total_spend, total_impressions, total_clicks, total_conversions, reservations, data_source, last_updated, campaign_data'
    )
    .eq('platform', 'meta')
    .eq('summary_type', 'monthly')
    .order('client_id')
    .order('summary_date');

  if (storedErr) throw storedErr;

  const rows = (storedRows || []) as StoredRow[];
  const withSpend = rows.filter(
    (r) => (r.total_spend || 0) > SPEND_TOLERANCE_PLN || (r.total_impressions || 0) > IMPRESSION_TOLERANCE
  );

  console.log(`Auditing ${withSpend.length} stored monthly Meta rows (of ${rows.length} total)...\n`);

  const results: AuditRow[] = [];
  let idx = 0;

  for (const row of withSpend) {
    idx++;
    const client = clientMap.get(row.client_id);
    const period = periodFromSummaryDate(row.summary_date);
    const token = client?.system_user_token || client?.meta_access_token;

    process.stdout.write(
      `[${idx}/${withSpend.length}] ${client?.name || row.client_id} ${period.tag}... `
    );

    const syntheticMarkers = detectSyntheticMarkers(row.campaign_data);

    if (!client?.ad_account_id || !token) {
      results.push({
        clientId: row.client_id,
        clientName: client?.name || 'unknown',
        period: period.tag,
        summaryDate: row.summary_date,
        storedSpend: row.total_spend,
        storedImpressions: row.total_impressions,
        storedClicks: row.total_clicks,
        storedConversions: row.total_conversions,
        storedReservations: row.reservations,
        dataSource: row.data_source,
        lastUpdated: row.last_updated,
        liveSpend: null,
        liveImpressions: null,
        liveClicks: null,
        liveError: 'missing credentials',
        status: 'NO_CREDENTIALS',
        syntheticMarkers,
        campaignCount: row.campaign_data?.length || 0,
      });
      console.log('NO_CREDENTIALS');
      continue;
    }

    const live = await fetchLiveAccountInsights(token, client.ad_account_id, period.start, period.end);
    const status = classify(
      { spend: row.total_spend, impressions: row.total_impressions },
      live
    );

    results.push({
      clientId: row.client_id,
      clientName: client.name,
      period: period.tag,
      summaryDate: row.summary_date,
      storedSpend: row.total_spend,
      storedImpressions: row.total_impressions,
      storedClicks: row.total_clicks,
      storedConversions: row.total_conversions,
      storedReservations: row.reservations,
      dataSource: row.data_source,
      lastUpdated: row.last_updated,
      liveSpend: live.spend,
      liveImpressions: live.impressions,
      liveClicks: live.clicks,
      liveError: live.error,
      status,
      syntheticMarkers,
      campaignCount: row.campaign_data?.length || 0,
    });

    console.log(status, `(stored ${row.total_spend} vs live ${live.spend})`);
    await new Promise((r) => setTimeout(r, API_DELAY_MS));
  }

  const summary = {
    auditedAt: new Date().toISOString(),
    totalStoredMonthlyRows: rows.length,
    rowsWithStoredSpend: withSpend.length,
    phantomStored: results.filter((r) => r.status === 'PHANTOM_STORED').length,
    mismatch: results.filter((r) => r.status === 'MISMATCH').length,
    match: results.filter((r) => r.status === 'MATCH').length,
    apiError: results.filter((r) => r.status === 'API_ERROR').length,
    noCredentials: results.filter((r) => r.status === 'NO_CREDENTIALS').length,
    withSyntheticMarkers: results.filter((r) => r.syntheticMarkers.length > 0).length,
    phantomWithSynthetic: results.filter(
      (r) => r.status === 'PHANTOM_STORED' && r.syntheticMarkers.length > 0
    ).length,
  };

  const phantoms = results.filter((r) => r.status === 'PHANTOM_STORED');
  const mismatches = results.filter((r) => r.status === 'MISMATCH');

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const jsonPath = path.join(process.cwd(), `audit-stored-vs-live-meta-${ts}.json`);
  const mdPath = path.join(process.cwd(), `audit-stored-vs-live-meta-${ts}.md`);

  fs.writeFileSync(jsonPath, JSON.stringify({ summary, results }, null, 2));

  const mdLines = [
    '# Stored vs Live Meta API Audit',
    '',
    `Generated: ${summary.auditedAt}`,
    '',
    '## Summary',
    '',
    `| Metric | Count |`,
    `|--------|------:|`,
    `| Monthly Meta rows in DB | ${summary.totalStoredMonthlyRows} |`,
    `| Rows with stored spend/impressions | ${summary.rowsWithStoredSpend} |`,
    `| **PHANTOM_STORED** (DB has data, API empty) | **${summary.phantomStored}** |`,
    `| MISMATCH (both have data, differ >5%) | ${summary.mismatch} |`,
    `| MATCH | ${summary.match} |`,
    `| API_ERROR | ${summary.apiError} |`,
    `| Rows with synthetic campaign markers | ${summary.withSyntheticMarkers} |`,
    `| Phantom + synthetic markers | ${summary.phantomWithSynthetic} |`,
    '',
    '## PHANTOM_STORED (should not trust / should clear)',
    '',
    '| Client | Period | Stored spend | Stored imp | Live spend | data_source | Markers |',
    '|--------|--------|-------------:|-----------:|-----------:|-------------|---------|',
  ];

  for (const r of phantoms.sort((a, b) => a.clientName.localeCompare(b.clientName) || a.period.localeCompare(b.period))) {
    mdLines.push(
      `| ${r.clientName} | ${r.period} | ${r.storedSpend.toFixed(2)} | ${r.storedImpressions} | ${r.liveSpend ?? 0} | ${r.dataSource || '-'} | ${r.syntheticMarkers.join(', ') || '-'} |`
    );
  }

  if (mismatches.length) {
    mdLines.push('', '## MISMATCH (stored vs live both non-zero)', '');
    mdLines.push('| Client | Period | Stored spend | Live spend | Stored imp | Live imp |');
    mdLines.push('|--------|--------|-------------:|-----------:|-----------:|---------:|');
    for (const r of mismatches) {
      mdLines.push(
        `| ${r.clientName} | ${r.period} | ${r.storedSpend.toFixed(2)} | ${(r.liveSpend ?? 0).toFixed(2)} | ${r.storedImpressions} | ${r.liveImpressions ?? 0} |`
      );
    }
  }

  mdLines.push('', '## Per-client phantom counts', '');
  const byClient = new Map<string, number>();
  for (const r of phantoms) {
    byClient.set(r.clientName, (byClient.get(r.clientName) || 0) + 1);
  }
  for (const [name, count] of [...byClient.entries()].sort((a, b) => b[1] - a[1])) {
    mdLines.push(`- **${name}**: ${count} phantom month(s)`);
  }

  fs.writeFileSync(mdPath, mdLines.join('\n'));

  console.log('\n========== AUDIT COMPLETE ==========');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nReports written:\n  ${jsonPath}\n  ${mdPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
