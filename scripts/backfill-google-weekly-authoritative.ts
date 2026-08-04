/**
 * BACKFILL GOOGLE ADS WEEKLY SUMMARIES (fixed parser).
 *
 * Re-fetches every stored Google weekly campaign_summaries row from the
 * Google Ads API through the production parser (primary-purchase reservation
 * rule + account-level rounding) and overwrites the row's core metrics.
 * Fixes two classes of stale rows:
 *   - partial mid-week snapshots that were never finalized (spend far below real)
 *   - rows computed with the old conversion-mapping rules
 *
 * The google_ads_tables column is intentionally NOT touched (preserved).
 *
 * Usage:
 *   npx tsx scripts/backfill-google-weekly-authoritative.ts            # all stored weeks
 *   npx tsx scripts/backfill-google-weekly-authoritative.ts --since=2026-06-01
 *   npx tsx scripts/backfill-google-weekly-authoritative.ts --client=Lambert --dry-run
 */
import 'dotenv/config';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { buildGoogleAdsService } from '../src/lib/google-monthly-authoritative-collector';
import {
  fetchGoogleDynamicConversionRowsWithService,
  googleDynamicRowsToMetricMap,
} from '../src/lib/google-dynamic-conversion-fetch';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function weekEnd(monday: string): string {
  const d = new Date(monday + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const since = args.find((a) => a.startsWith('--since='))?.split('=')[1];
  const clientFilter = args.find((a) => a.startsWith('--client='))?.split('=')[1];
  const today = new Date().toISOString().slice(0, 10);

  const { data: settingsRows } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', [
      'google_ads_client_id',
      'google_ads_client_secret',
      'google_ads_developer_token',
      'google_ads_manager_refresh_token',
      'google_ads_manager_customer_id',
    ]);
  const settings = Object.fromEntries((settingsRows || []).map((s: any) => [s.key, s.value])) as Record<string, string>;

  let clientsQuery = supabase
    .from('clients')
    .select('id, name, google_ads_customer_id, google_ads_refresh_token')
    .eq('google_ads_enabled', true)
    .not('google_ads_customer_id', 'is', null)
    .order('name');
  if (clientFilter) clientsQuery = clientsQuery.ilike('name', `%${clientFilter}%`);
  const { data: clients } = await clientsQuery;

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  // Each client gets its own GoogleAdsAPIService instance (own rate limiter),
  // so clients can safely run in parallel.
  const CONCURRENCY = 5;
  const queue = [...(clients || [])];

  const processClient = async (client: NonNullable<typeof clients>[number]) => {
    let rowsQuery = supabase
      .from('campaign_summaries')
      .select('summary_date, total_spend, reservations, reservation_value, email_contacts')
      .eq('client_id', client.id)
      .eq('platform', 'google')
      .eq('summary_type', 'weekly')
      .order('summary_date');
    if (since) rowsQuery = rowsQuery.gte('summary_date', since);
    const { data: weeks } = await rowsQuery;
    if (!weeks?.length) return;

    console.log(`\n### ${client.name} — ${weeks.length} stored weeks`);
    const service = buildGoogleAdsService(settings, client.google_ads_customer_id!, client.google_ads_refresh_token);

    for (const week of weeks) {
      const monday = String(week.summary_date);
      const sunday = weekEnd(monday);
      // Skip the current (unfinished) week — smart cache owns it.
      if (sunday >= today) { skipped++; continue; }

      try {
        const campaigns: any[] = await service.getCampaignData(monday, sunday);
        const t = campaigns.reduce(
          (a: any, c: any) => ({
            spend: a.spend + (c.spend || 0),
            impressions: a.impressions + (c.impressions || 0),
            clicks: a.clicks + (c.clicks || 0),
            conversions: a.conversions + (c.conversions || 0),
            click_to_call: a.click_to_call + (c.click_to_call || 0),
            email_contacts: a.email_contacts + (c.email_contacts || 0),
            booking_step_1: a.booking_step_1 + (c.booking_step_1 || 0),
            booking_step_2: a.booking_step_2 + (c.booking_step_2 || 0),
            booking_step_3: a.booking_step_3 + (c.booking_step_3 || 0),
            reservations: a.reservations + (c.reservations || 0),
            reservation_value: a.reservation_value + (c.reservation_value || 0),
          }),
          { spend: 0, impressions: 0, clicks: 0, conversions: 0, click_to_call: 0, email_contacts: 0, booking_step_1: 0, booking_step_2: 0, booking_step_3: 0, reservations: 0, reservation_value: 0 }
        );

        let dynamicMetricValues: Record<string, number> = {};
        let dynamicMetricRows: any[] = [];
        try {
          const dyn = await fetchGoogleDynamicConversionRowsWithService(service, monday, sunday);
          if (dyn.fetchOk) {
            dynamicMetricValues = googleDynamicRowsToMetricMap(dyn.rows);
            dynamicMetricRows = dyn.rows;
          }
        } catch { /* best-effort */ }

        const roas = t.spend > 0 ? t.reservation_value / t.spend : 0;
        const costPerReservation = t.reservations > 0 ? t.spend / t.reservations : 0;

        const delta = `spend ${Number(week.total_spend).toFixed(0)}→${t.spend.toFixed(0)}, rez ${week.reservations}→${Math.round(t.reservations)}, val ${Number(week.reservation_value).toFixed(0)}→${t.reservation_value.toFixed(0)}, email ${week.email_contacts}→${Math.round(t.email_contacts)}`;

        if (dryRun) {
          console.log(`  [dry] ${monday}: ${delta}`);
          continue;
        }

        const { error } = await supabase
          .from('campaign_summaries')
          .upsert(
            {
              client_id: client.id,
              platform: 'google',
              summary_type: 'weekly',
              summary_date: monday,
              total_spend: t.spend,
              total_impressions: Math.round(t.impressions),
              total_clicks: Math.round(t.clicks),
              total_conversions: Math.round(t.conversions),
              average_ctr: t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0,
              average_cpc: t.clicks > 0 ? t.spend / t.clicks : 0,
              average_cpa: costPerReservation,
              total_campaigns: campaigns.length,
              campaign_data: campaigns as any,
              google_dynamic_metric_values: dynamicMetricValues as any,
              google_dynamic_metric_rows: dynamicMetricRows as any,
              click_to_call: Math.round(t.click_to_call),
              email_contacts: Math.round(t.email_contacts),
              booking_step_1: Math.round(t.booking_step_1),
              booking_step_2: Math.round(t.booking_step_2),
              booking_step_3: Math.round(t.booking_step_3),
              reservations: Math.round(t.reservations),
              reservation_value: t.reservation_value,
              total_conversion_value: t.reservation_value,
              roas,
              cost_per_reservation: costPerReservation,
              data_source: 'google_ads_api',
              last_updated: new Date().toISOString(),
            },
            { onConflict: 'client_id,summary_type,summary_date,platform' }
          );

        if (error) {
          failed++;
          console.log(`  ❌ ${monday}: upsert error ${error.message}`);
        } else {
          updated++;
          console.log(`  ✅ ${monday}: ${delta}`);
        }
      } catch (e: any) {
        failed++;
        console.log(`  ❌ ${monday}: ${e.message}`);
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  };

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const client = queue.shift();
      if (!client) break;
      try {
        await processClient(client);
      } catch (e: any) {
        failed++;
        console.log(`❌ ${client.name}: client-level error ${e.message}`);
      }
    }
  });
  await Promise.all(workers);

  console.log(`\nDONE: updated=${updated} skipped_current=${skipped} failed=${failed}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
