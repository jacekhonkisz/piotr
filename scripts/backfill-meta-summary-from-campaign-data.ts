/**
 * Backfill Meta `campaign_summaries` core columns from embedded `campaign_data`.
 *
 * Rewrites:
 *   - total_clicks      = Σ inline_link_clicks ?? clicks      (Meta UI "Link clicks")
 *   - average_ctr       = weighted by link clicks using API inline_link_click_ctr ?? ctr
 *   - average_cpc       = weighted by link clicks using API cost_per_inline_link_click ?? cpc
 *
 * Matches Meta Business Suite numbers exactly (canonical contract v1).
 *
 * Usage:
 *   npx tsx scripts/backfill-meta-summary-from-campaign-data.ts --dry-run
 *   npx tsx scripts/backfill-meta-summary-from-campaign-data.ts
 *   npx tsx scripts/backfill-meta-summary-from-campaign-data.ts --client <client_id> --month 2026-04
 *
 * Operates only on rows where `platform = 'meta'` and `campaign_data` is a
 * non-empty array. Skips rows whose canonical values already match.
 */

import { config as loadEnv } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

loadEnv({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TOLERANCE = 0.005; // half a basis point / 0.005 PLN

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^0-9.\-eE]/g, '');
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

interface Aggregated {
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  average_ctr: number;
  average_cpc: number;
  campaigns_used_for_avgs: number;
}

function aggregateFromCampaigns(raw: unknown): Aggregated | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const campaigns = raw as Record<string, unknown>[];

  let totalSpend = 0;
  let totalImpressions = 0;
  let totalLinkClicks = 0;
  let weightedCtrSum = 0;
  let weightedCpcSum = 0;
  let weightSum = 0;
  let weighted = 0;

  for (const c of campaigns) {
    const linkClicks = num(c.inline_link_clicks ?? c.clicks);
    const impressions = num(c.impressions);
    const spend = num(c.spend);
    const ctr = num(c.inline_link_click_ctr ?? c.ctr);
    const cpc = num(c.cost_per_inline_link_click ?? c.cpc);

    totalSpend += spend;
    totalImpressions += impressions;
    totalLinkClicks += linkClicks;

    if (linkClicks > 0 && ctr > 0 && cpc > 0) {
      weightedCtrSum += ctr * linkClicks;
      weightedCpcSum += cpc * linkClicks;
      weightSum += linkClicks;
      weighted++;
    }
  }

  const avgCtr = weightSum > 0
    ? weightedCtrSum / weightSum
    : (totalImpressions > 0 ? (totalLinkClicks / totalImpressions) * 100 : 0);
  const avgCpc = weightSum > 0
    ? weightedCpcSum / weightSum
    : (totalLinkClicks > 0 ? totalSpend / totalLinkClicks : 0);

  return {
    total_spend: Math.round(totalSpend * 100) / 100,
    total_impressions: Math.round(totalImpressions),
    total_clicks: Math.round(totalLinkClicks),
    average_ctr: Math.round(avgCtr * 1e4) / 1e4,
    average_cpc: Math.round(avgCpc * 1e4) / 1e4,
    campaigns_used_for_avgs: weighted
  };
}

function approxEq(a: number, b: number, tol = TOLERANCE): boolean {
  return Math.abs(a - b) <= tol;
}

interface RowChange {
  field: string;
  before: number;
  after: number;
}

function diffRow(row: Record<string, unknown>, agg: Aggregated): RowChange[] {
  const changes: RowChange[] = [];
  const before = {
    total_clicks: num(row.total_clicks),
    average_ctr: num(row.average_ctr),
    average_cpc: num(row.average_cpc)
  };
  if (Math.abs(before.total_clicks - agg.total_clicks) > 0.5) {
    changes.push({ field: 'total_clicks', before: before.total_clicks, after: agg.total_clicks });
  }
  if (!approxEq(before.average_ctr, agg.average_ctr)) {
    changes.push({ field: 'average_ctr', before: before.average_ctr, after: agg.average_ctr });
  }
  if (!approxEq(before.average_cpc, agg.average_cpc)) {
    changes.push({ field: 'average_cpc', before: before.average_cpc, after: agg.average_cpc });
  }
  return changes;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const clientArgIdx = process.argv.indexOf('--client');
  const monthArgIdx = process.argv.indexOf('--month');
  const clientFilter = clientArgIdx >= 0 ? process.argv[clientArgIdx + 1] : null;
  const monthFilter = monthArgIdx >= 0 ? process.argv[monthArgIdx + 1] : null; // e.g. 2026-04

  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase: SupabaseClient = createClient(url, key);
  const pageSize = 200;
  let offset = 0;
  let examined = 0;
  let skippedNoCampaigns = 0;
  let unchanged = 0;
  let wouldUpdate = 0;
  let updated = 0;
  let errors = 0;

  console.log(JSON.stringify({
    mode: dryRun ? 'DRY-RUN' : 'APPLY',
    clientFilter: clientFilter || 'ALL',
    monthFilter: monthFilter || 'ALL'
  }, null, 2));

  for (;;) {
    let query = supabase
      .from('campaign_summaries')
      .select('id, client_id, summary_date, summary_type, campaign_data, total_clicks, average_ctr, average_cpc')
      .eq('platform', 'meta')
      .not('campaign_data', 'is', null)
      .order('summary_date', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (clientFilter) query = query.eq('client_id', clientFilter);
    if (monthFilter) {
      const start = `${monthFilter}-01`;
      const [yStr, mStr] = monthFilter.split('-');
      const y = Number(yStr);
      const m = Number(mStr);
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${monthFilter}-${String(lastDay).padStart(2, '0')}`;
      query = query.gte('summary_date', start).lte('summary_date', end);
    }

    const { data: rows, error } = await query;
    if (error) {
      console.error('Query error:', error.message);
      process.exit(1);
    }
    if (!rows || rows.length === 0) break;

    for (const row of rows as Record<string, unknown>[]) {
      examined++;
      const agg = aggregateFromCampaigns(row.campaign_data);
      if (!agg) {
        skippedNoCampaigns++;
        continue;
      }
      const changes = diffRow(row, agg);
      if (changes.length === 0) {
        unchanged++;
        continue;
      }
      wouldUpdate++;
      console.log(JSON.stringify({
        id: row.id,
        client_id: row.client_id,
        summary_type: row.summary_type,
        summary_date: row.summary_date,
        weightedCampaigns: agg.campaigns_used_for_avgs,
        changes
      }));

      if (dryRun) continue;
      const { error: upErr } = await supabase
        .from('campaign_summaries')
        .update({
          total_clicks: agg.total_clicks,
          average_ctr: agg.average_ctr,
          average_cpc: agg.average_cpc,
          last_updated: new Date().toISOString()
        })
        .eq('id', row.id as string);
      if (upErr) {
        console.error('Update failed', row.id, upErr.message);
        errors++;
      } else {
        updated++;
      }
    }

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  console.log(JSON.stringify({
    summary: {
      mode: dryRun ? 'DRY-RUN' : 'APPLY',
      examined,
      skippedNoCampaigns,
      unchanged,
      rowsNeedingChange: wouldUpdate,
      updated,
      errors
    }
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
