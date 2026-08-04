/**
 * POST-FIX AUDIT: stored Google monthly summaries vs live API (fixed parser).
 *
 * For each Google-enabled client and each given month, fetches the month live
 * via the production path (getCampaignData → getConversionBreakdown →
 * parseGoogleAdsConversions with primary-purchase rule) and compares with the
 * stored campaign_summaries row that the app serves for closed months.
 *
 * Usage:
 *   npx tsx scripts/audit-post-fix-google-monthly.ts 2026-06 2026-07 [more months...]
 *   npx tsx scripts/audit-post-fix-google-monthly.ts 2026-06 --client=Lambert
 */
import 'dotenv/config';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from '../src/lib/google-ads-api';
import { loadClientConversionMappings } from '../src/lib/client-conversion-mappings-server';
import { monthBounds } from '../src/lib/google-monthly-authoritative-collector';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const METRICS = [
  'spend',
  'impressions',
  'clicks',
  'reservations',
  'reservation_value',
  'email_contacts',
  'click_to_call',
  'booking_step_1',
  'booking_step_2',
  'booking_step_3',
] as const;
type MetricKey = (typeof METRICS)[number];

function isMoney(m: MetricKey) {
  return m === 'spend' || m === 'reservation_value';
}

async function main() {
  const args = process.argv.slice(2);
  const months = args.filter((a) => /^\d{4}-\d{2}$/.test(a));
  const clientFilter = args.find((a) => a.startsWith('--client='))?.split('=')[1];
  if (months.length === 0) {
    console.error('Provide at least one month, e.g. 2026-06');
    process.exit(1);
  }

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

  let q = supabase
    .from('clients')
    .select('id, name, google_ads_customer_id')
    .eq('google_ads_enabled', true)
    .not('google_ads_customer_id', 'is', null)
    .order('name');
  if (clientFilter) q = q.ilike('name', `%${clientFilter}%`);
  const { data: clients } = await q;

  let mismatches = 0;
  let comparisons = 0;
  const problems: string[] = [];

  for (const month of months) {
    const { startDate, endDate } = monthBounds(month);
    console.log(`\n${'='.repeat(90)}\nMONTH ${month} (${startDate} → ${endDate}) — LIVE (fixed parser) vs STORED campaign_summaries\n${'='.repeat(90)}`);

    for (const client of clients || []) {
      try {
        const mappings = await loadClientConversionMappings(client.id);
        const svc = new GoogleAdsAPIService({
          refreshToken: settings.google_ads_manager_refresh_token,
          clientId: settings.google_ads_client_id,
          clientSecret: settings.google_ads_client_secret,
          developmentToken: settings.google_ads_developer_token,
          customerId: client.google_ads_customer_id as string,
          managerCustomerId: settings.google_ads_manager_customer_id,
          conversionMappings: mappings,
        } as any);

        const campaigns: any[] = await svc.getCampaignData(startDate, endDate);
        const live: Record<MetricKey, number> = campaigns.reduce(
          (a: any, c: any) => {
            for (const m of METRICS) a[m] += Number(c[m]) || 0;
            return a;
          },
          Object.fromEntries(METRICS.map((m) => [m, 0])) as any
        );

        const { data: stored } = await supabase
          .from('campaign_summaries')
          .select(
            'total_spend, total_impressions, total_clicks, reservations, reservation_value, email_contacts, click_to_call, booking_step_1, booking_step_2, booking_step_3, data_source, last_updated'
          )
          .eq('client_id', client.id)
          .eq('platform', 'google')
          .eq('summary_type', 'monthly')
          .eq('summary_date', startDate)
          .maybeSingle();

        if (!stored) {
          console.log(`\n${client.name}: ❌ NO STORED ROW`);
          problems.push(`${client.name} ${month}: no stored row`);
          continue;
        }

        const storedVals: Record<MetricKey, number> = {
          spend: Number(stored.total_spend) || 0,
          impressions: Number(stored.total_impressions) || 0,
          clicks: Number(stored.total_clicks) || 0,
          reservations: Number(stored.reservations) || 0,
          reservation_value: Number(stored.reservation_value) || 0,
          email_contacts: Number(stored.email_contacts) || 0,
          click_to_call: Number(stored.click_to_call) || 0,
          booking_step_1: Number(stored.booking_step_1) || 0,
          booking_step_2: Number(stored.booking_step_2) || 0,
          booking_step_3: Number(stored.booking_step_3) || 0,
        };

        const rows: string[] = [];
        let clientOk = true;
        for (const m of METRICS) {
          comparisons++;
          const l = live[m];
          const s = storedVals[m];
          // Live data can drift slightly vs the stored snapshot (Google late
          // attribution), so allow 1 unit or 0.5% for counts, 1% for money.
          const tol = isMoney(m) ? Math.max(0.05, l * 0.01) : Math.max(1, l * 0.005);
          const ok = Math.abs(l - s) <= tol;
          if (!ok) {
            clientOk = false;
            mismatches++;
            problems.push(`${client.name} ${month} ${m}: live=${l.toFixed(2)} stored=${s.toFixed(2)}`);
          }
          rows.push(
            `   ${ok ? '✓' : '❌'} ${m.padEnd(18)} live=${l.toFixed(isMoney(m) ? 2 : 0).padStart(12)}  stored=${s.toFixed(isMoney(m) ? 2 : 0).padStart(12)}`
          );
        }
        console.log(`\n${client.name} [${stored.data_source}]${clientOk ? ' ✅ ALL MATCH' : ' ⚠️ MISMATCHES'}`);
        if (!clientOk) console.log(rows.join('\n'));
      } catch (e: any) {
        console.log(`\n${client.name}: ❌ ERROR ${e.message}`);
        problems.push(`${client.name} ${month}: fetch error ${e.message}`);
      }
    }
  }

  console.log(`\n${'='.repeat(90)}`);
  console.log(`RESULT: ${comparisons} comparisons, ${mismatches} mismatches`);
  if (problems.length) {
    console.log('\nPROBLEMS:');
    for (const p of problems) console.log(`  ❌ ${p}`);
  } else {
    console.log('✅ All stored monthly rows match the live API through the fixed parser.');
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
