/**
 * POST-FIX AUDIT: what the app actually SERVES (GoogleAdsStandardizedDataFetcher),
 * for closed months (campaign_summaries path) — the same entry point the
 * reports panel / PDF / email builders use.
 *
 * Usage: npx tsx scripts/audit-post-fix-serving-paths.ts
 */
import 'dotenv/config';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CASES: Array<{ client: string; start: string; end: string; label: string; expect: Partial<Record<string, number>> }> = [
  {
    client: 'Hotel Lambert Ustronie Morskie',
    start: '2026-06-01', end: '2026-06-30',
    label: 'Lambert June (client screenshot: PBM-Rezerwacja 45.80 / 193 534.40)',
    expect: { reservations: 46, reservation_value: 193534.41 },
  },
  {
    client: 'Hotel Lambert Ustronie Morskie',
    start: '2026-07-01', end: '2026-07-31',
    label: 'Lambert July (full month; UI 1-30 showed 72.58 / 301 783.74)',
    expect: { reservations: 80 },
  },
  {
    client: 'Arche Nałęczów',
    start: '2026-06-01', end: '2026-06-30',
    label: 'Arche June (client expects 42 e-mails)',
    expect: { email_contacts: 42 },
  },
  {
    client: 'Nickel Resort Grzybowo',
    start: '2026-06-01', end: '2026-06-30',
    label: 'Nickel June (client says e-mails were already correct)',
    expect: {},
  },
];

async function main() {
  const { GoogleAdsStandardizedDataFetcher } = await import('../src/lib/google-ads-standardized-data-fetcher');

  let failures = 0;
  for (const c of CASES) {
    const { data: clients } = await admin.from('clients').select('id, name').ilike('name', `%${c.client}%`).limit(1);
    const client = clients?.[0];
    if (!client) { console.log(`❌ client not found: ${c.client}`); failures++; continue; }

    const result = await GoogleAdsStandardizedDataFetcher.fetchData({
      clientId: client.id,
      dateRange: { start: c.start, end: c.end },
      reason: 'post-fix-audit',
    });

    const cm = result.data.conversionMetrics;
    console.log(`\n=== ${c.label} ===`);
    console.log(`   source: ${result.debug.source} (${result.debug.reason})`);
    console.log(`   spend=${result.data.stats.totalSpend.toFixed(2)} rez=${cm.reservations} val=${cm.reservation_value.toFixed(2)} email=${cm.email_contacts} tel=${cm.click_to_call}`);
    for (const [k, v] of Object.entries(c.expect)) {
      const actual = (cm as any)[k];
      const ok = Math.abs(Number(actual) - Number(v)) < 0.51;
      if (!ok) failures++;
      console.log(`   ${ok ? '✓' : '❌'} expected ${k}=${v}, served ${actual}`);
    }
  }
  console.log(`\n${failures === 0 ? '✅ SERVING PATH OK — all expectations met' : `❌ ${failures} failures`}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
