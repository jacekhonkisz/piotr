/**
 * Backfill Google `campaign_summaries` conversion columns from embedded `campaign_data`
 * (same aggregation idea as fetch-google-ads-live-data / campaign fallback).
 *
 * Usage:
 *   npx tsx scripts/backfill-google-summary-conversions-from-campaign-data.ts --dry-run
 *   npx tsx scripts/backfill-google-summary-conversions-from-campaign-data.ts
 *
 * Only updates rows where `platform = 'google'`, `campaign_data` is a non-empty array,
 * and at least one of (total_conversions, conversion_value, total_conversion_value) would change.
 */

import { config as loadEnv } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

loadEnv({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function aggregateFromCampaigns(campaigns: unknown): {
  total_conversions: number;
  conversion_value: number;
  total_conversion_value: number;
} | null {
  if (!Array.isArray(campaigns) || campaigns.length === 0) return null;

  let reservations = 0;
  let reservationValue = 0;
  let conversionValue = 0;
  let totalConversionValue = 0;

  for (const c of campaigns as Record<string, unknown>[]) {
    reservations += num(c.reservations);
    reservationValue += num(c.reservation_value);
    conversionValue += num(c.conversion_value);
    totalConversionValue += num(c.total_conversion_value);
  }

  const resv = Math.round(reservations);
  const rv = roundMoney(reservationValue);
  const cv = roundMoney(conversionValue);
  let tcv = roundMoney(totalConversionValue);
  if (tcv === 0 && rv > 0) tcv = rv;
  const cvFinal = cv === 0 && rv > 0 ? rv : cv;

  return {
    total_conversions: resv,
    conversion_value: cvFinal,
    total_conversion_value: tcv || rv,
  };
}

function needsUpdate(
  row: Record<string, unknown>,
  agg: { total_conversions: number; conversion_value: number; total_conversion_value: number }
): boolean {
  const tc = num(row.total_conversions);
  const cv = num(row.conversion_value);
  const tcv = num(row.total_conversion_value);
  return (
    tc !== agg.total_conversions ||
    roundMoney(cv) !== agg.conversion_value ||
    roundMoney(tcv) !== agg.total_conversion_value
  );
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase: SupabaseClient = createClient(url, key);
  const pageSize = 200;
  let offset = 0;
  let examined = 0;
  let skippedNoCampaigns = 0;
  let wouldUpdate = 0;
  let updated = 0;
  let errors = 0;

  for (;;) {
    const { data: rows, error } = await supabase
      .from('campaign_summaries')
      .select(
        'id, client_id, summary_date, summary_type, campaign_data, total_conversions, conversion_value, total_conversion_value'
      )
      .eq('platform', 'google')
      .not('campaign_data', 'is', null)
      .order('summary_date', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('Query error:', error.message);
      process.exit(1);
    }
    if (!rows?.length) break;

    for (const row of rows as Record<string, unknown>[]) {
      examined++;
      const agg = aggregateFromCampaigns(row.campaign_data);
      if (!agg) {
        skippedNoCampaigns++;
        continue;
      }
      if (!needsUpdate(row, agg)) continue;

      wouldUpdate++;
      if (dryRun) continue;

      const { error: upErr } = await supabase
        .from('campaign_summaries')
        .update({
          total_conversions: agg.total_conversions,
          conversion_value: agg.conversion_value,
          total_conversion_value: agg.total_conversion_value,
          last_updated: new Date().toISOString(),
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

  console.log(
    JSON.stringify(
      {
        dryRun,
        examined,
        skippedNoCampaigns,
        rowsNeedingChange: wouldUpdate,
        updated: dryRun ? 0 : updated,
        errors,
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
