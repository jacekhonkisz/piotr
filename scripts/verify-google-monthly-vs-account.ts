/**
 * VERIFY STORED GOOGLE MONTHLY SUMMARY vs LIVE ACCOUNT TOTALS
 *
 * Independent reconciliation of what's stored in campaign_summaries against the
 * live Google Ads account-level totals for the same month. Account-level query
 * only carries delivery metrics (spend / impressions / clicks / conv. value),
 * so those are the metrics we can reconcile apples-to-apples. Funnel metrics
 * (reservations, booking steps) come from the conversion-action breakdown and
 * cannot be validated against the account row — they are shown for context only.
 *
 * Usage:
 *   npx tsx scripts/verify-google-monthly-vs-account.ts 2026-06
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from '../src/lib/google-ads-api';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TOLERANCE = 0.02; // ±2%

function pct(stored: number, live: number): string {
  if (live === 0) return stored === 0 ? '100.0%' : 'n/a';
  return `${((stored / live) * 100).toFixed(1)}%`;
}

function flag(stored: number, live: number): string {
  if (live === 0) return stored === 0 ? 'OK' : 'CHECK';
  const ratio = stored / live;
  return ratio >= 1 - TOLERANCE && ratio <= 1 + TOLERANCE ? 'OK' : 'MISMATCH';
}

async function main() {
  const args = process.argv.slice(2);
  const targetMonth = args.find((a) => /^\d{4}-\d{2}$/.test(a)) || '2026-06';
  const [year, month] = targetMonth.split('-').map(Number);
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year!, month!, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const summaryDate = startDate;

  console.log(`\n🔎 Reconciling stored monthly summary vs LIVE account totals for ${targetMonth} (${startDate} → ${endDate})\n`);

  const { data: settingsData } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', [
      'google_ads_client_id',
      'google_ads_client_secret',
      'google_ads_developer_token',
      'google_ads_manager_refresh_token',
      'google_ads_manager_customer_id',
    ]);
  const settings = Object.fromEntries((settingsData || []).map((s: any) => [s.key, s.value]));

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, google_ads_customer_id, google_ads_refresh_token')
    .eq('google_ads_enabled', true)
    .not('google_ads_customer_id', 'is', null)
    .order('created_at');

  const rows: Array<Record<string, unknown>> = [];
  let mismatchCount = 0;

  for (const client of clients || []) {
    const { data: stored } = await supabase
      .from('campaign_summaries')
      .select('total_spend, total_impressions, total_clicks, total_conversions, reservations, data_source')
      .eq('client_id', client.id)
      .eq('platform', 'google')
      .eq('summary_type', 'monthly')
      .eq('summary_date', summaryDate)
      .maybeSingle();

    if (!stored) {
      rows.push({ client: client.name, note: 'no stored row' });
      continue;
    }

    const refreshToken = settings.google_ads_manager_refresh_token || client.google_ads_refresh_token;
    try {
      const service = new GoogleAdsAPIService({
        refreshToken,
        clientId: settings.google_ads_client_id,
        clientSecret: settings.google_ads_client_secret,
        developmentToken: settings.google_ads_developer_token,
        customerId: client.google_ads_customer_id!,
        managerCustomerId: settings.google_ads_manager_customer_id,
      });
      const acct = await service.getAccountPerformance(startDate, endDate);

      const s = {
        spend: Number((stored as any).total_spend) || 0,
        impressions: Number((stored as any).total_impressions) || 0,
        clicks: Number((stored as any).total_clicks) || 0,
      };
      const l = {
        spend: acct.spend || 0,
        impressions: acct.impressions || 0,
        clicks: acct.clicks || 0,
      };

      const spendFlag = flag(s.spend, l.spend);
      const imprFlag = flag(s.impressions, l.impressions);
      const clickFlag = flag(s.clicks, l.clicks);
      const worst = [spendFlag, imprFlag, clickFlag].includes('MISMATCH')
        ? 'MISMATCH'
        : [spendFlag, imprFlag, clickFlag].includes('CHECK')
        ? 'CHECK'
        : 'OK';
      if (worst !== 'OK') mismatchCount++;

      rows.push({
        client: client.name,
        result: worst,
        spend: `${s.spend.toFixed(0)}/${l.spend.toFixed(0)} (${pct(s.spend, l.spend)})`,
        impressions: `${s.impressions}/${l.impressions} (${pct(s.impressions, l.impressions)})`,
        clicks: `${s.clicks}/${l.clicks} (${pct(s.clicks, l.clicks)})`,
        reservations: (stored as any).reservations,
        source: (stored as any).data_source,
      });
    } catch (e) {
      rows.push({ client: client.name, result: 'ERROR', note: (e as Error).message });
    }

    await new Promise((r) => setTimeout(r, 400));
  }

  console.log('📊 Reconciliation (stored / live account) — reservations shown for context only:\n');
  console.table(rows);
  console.log(`\n${mismatchCount === 0 ? '✅ All clients within ±2% on spend, impressions, and clicks.' : `⚠️ ${mismatchCount} client(s) need review.`}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
