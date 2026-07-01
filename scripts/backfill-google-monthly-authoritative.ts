/**
 * BACKFILL AUTHORITATIVE GOOGLE ADS MONTHLY SUMMARIES
 *
 * One-off remediation for closed months whose stored campaign_summaries row is
 * a partial current-month cache snapshot (see audit: stored spend far below the
 * live account total). Re-fetches the FULL month directly from the Google Ads
 * API and overwrites the monthly row via the SHARED authoritative collector
 * (same code path as end-of-month-collection and the verify/heal cron), so all
 * three stay perfectly consistent.
 *
 * Usage:
 *   npx tsx scripts/backfill-google-monthly-authoritative.ts 2026-06
 *   npx tsx scripts/backfill-google-monthly-authoritative.ts 2026-06 --client=<clientId>
 *   npx tsx scripts/backfill-google-monthly-authoritative.ts 2026-06 --dry-run
 *   # Chunk large client counts (idempotent, safe to resume/re-run):
 *   npx tsx scripts/backfill-google-monthly-authoritative.ts 2026-06 --offset=0 --limit=10
 *   npx tsx scripts/backfill-google-monthly-authoritative.ts 2026-06 --offset=10 --limit=10
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import {
  collectAuthoritativeGoogleMonth,
  buildGoogleAdsService,
  monthBounds,
} from '../src/lib/google-monthly-authoritative-collector';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const args = process.argv.slice(2);
  const targetMonth = args.find((a) => /^\d{4}-\d{2}$/.test(a));
  const dryRun = args.includes('--dry-run');
  const clientFilter = args.find((a) => a.startsWith('--client='))?.split('=')[1];
  const offset = Math.max(0, parseInt(args.find((a) => a.startsWith('--offset='))?.split('=')[1] || '0', 10) || 0);
  const limitArg = args.find((a) => a.startsWith('--limit='))?.split('=')[1];
  const limit = limitArg ? Math.max(1, parseInt(limitArg, 10)) : undefined;

  if (!targetMonth) {
    console.error('❌ Provide a target month, e.g. `npx tsx scripts/backfill-google-monthly-authoritative.ts 2026-06`');
    process.exit(1);
  }

  const { startDate, endDate } = monthBounds(targetMonth);

  console.log(`\n🗓️  Backfilling authoritative Google Ads monthly data for ${targetMonth} (${startDate} → ${endDate})`);
  console.log(`🔧 Mode: ${dryRun ? 'DRY RUN (no writes)' : 'LIVE (will overwrite campaign_summaries)'}`);
  console.log(`📦 Slice: offset=${offset}${limit !== undefined ? ` limit=${limit}` : ' (all)'}\n`);

  const { data: settingsData, error: settingsError } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', [
      'google_ads_client_id',
      'google_ads_client_secret',
      'google_ads_developer_token',
      'google_ads_manager_refresh_token',
      'google_ads_manager_customer_id',
    ]);
  if (settingsError || !settingsData) {
    throw new Error(`Failed to load Google Ads system settings: ${settingsError?.message}`);
  }
  const settings = Object.fromEntries(settingsData.map((s: any) => [s.key, s.value])) as Record<string, string>;

  let clientsQuery = supabase
    .from('clients')
    .select('id, name, google_ads_customer_id, google_ads_refresh_token')
    .eq('google_ads_enabled', true)
    .not('google_ads_customer_id', 'is', null)
    .order('created_at');
  if (clientFilter) clientsQuery = clientsQuery.eq('id', clientFilter);
  if (limit !== undefined) clientsQuery = clientsQuery.range(offset, offset + limit - 1);
  else if (offset > 0) clientsQuery = clientsQuery.range(offset, offset + 9999);

  const { data: clients, error: clientsError } = await clientsQuery;
  if (clientsError) throw new Error(`Failed to load clients: ${clientsError.message}`);
  if (!clients || clients.length === 0) {
    console.log('⚠️ No matching Google-enabled clients found.');
    return;
  }

  const summary: Array<Record<string, unknown>> = [];

  for (const client of clients) {
    try {
      // Prior stored value, for reporting the correction.
      const { data: prior } = await supabase
        .from('campaign_summaries')
        .select('total_spend')
        .eq('client_id', client.id)
        .eq('platform', 'google')
        .eq('summary_type', 'monthly')
        .eq('summary_date', startDate)
        .maybeSingle();
      const priorSpend = prior ? Number((prior as any).total_spend) : 0;

      const service = buildGoogleAdsService(settings, client.google_ads_customer_id!, client.google_ads_refresh_token);
      const result = await collectAuthoritativeGoogleMonth(supabase, service, client.id, startDate, endDate, { dryRun });

      if (result.status === 'no_campaigns') {
        console.log(`⚠️  ${client.name}: no campaigns returned, skipping`);
        summary.push({ client: client.name, status: 'no_campaigns' });
      } else {
        const flag = result.dataSource === 'google_ads_api_incomplete' ? ' ⚠️ INCOMPLETE' : '';
        console.log(
          `✅ ${client.name.padEnd(30)} prior=${priorSpend.toFixed(2).padStart(10)} → new=${result.spend
            .toFixed(2)
            .padStart(10)} (account=${result.accountSpend.toFixed(2)}) campaigns=${result.campaigns} [${result.status}]${flag}`
        );
        summary.push({
          client: client.name,
          priorSpend,
          newSpend: result.spend,
          accountSpend: result.accountSpend,
          status: result.status,
          dataSource: result.dataSource,
          campaigns: result.campaigns,
        });
      }
    } catch (e) {
      console.log(`❌ ${client.name}: ${(e as Error).message}`);
      summary.push({ client: client.name, error: (e as Error).message });
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  console.log('\n📊 Backfill summary:');
  console.table(summary);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
