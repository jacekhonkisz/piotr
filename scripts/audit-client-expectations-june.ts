/**
 * Compare June 2026 stored vs live vs client-stated expectations (Pinea, Nickel, Arche).
 * Run: npx tsx scripts/audit-client-expectations-june.ts
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { MetaAPIServiceOptimized } from '../src/lib/meta-api-optimized';
import {
  aggregateConversionMetrics,
  enhanceCampaignsWithConversions,
} from '../src/lib/meta-actions-parser';
import { loadClientConversionMappings } from '../src/lib/client-conversion-mappings-server';

dotenv.config({ path: '.env.local' });

const START = '2026-06-01';
const END = '2026-06-30';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Expectation = {
  reservations?: number;
  reservation_value?: number;
  click_to_call?: number;
  email_contacts?: number;
  note?: string;
};

/** From client feedback emails (July 2026) — only explicit numbers / clear OK flags */
const CLIENT_EXPECTED: Record<
  string,
  { google?: Expectation; meta?: Expectation }
> = {
  'Pinea Resort Pobierowo': {
    google: { note: 'reservations OK; booking steps + contacts wrong (no numbers given)' },
    meta: {
      click_to_call: 19,
      note: 'reservations OK; booking steps were missing from email (template fix)',
    },
  },
  'Nickel Resort Grzybowo': {
    google: {
      reservations: 50,
      reservation_value: 125952.63,
      note: 'booking steps wrong; phones label only; emails OK',
    },
    meta: {
      click_to_call: 7,
      email_contacts: 3,
      note: 'booking steps were missing from email (template fix)',
    },
  },
  'Arche Nałęczów': {
    google: { note: 'June conversions questioned (attribution lag); no exact numbers' },
    meta: {
      click_to_call: 11,
      note: 'asked what metric we use for calls',
    },
  },
  'Arche Dwór Uphagena Gdańsk': {
    google: { note: 'same Arche feedback batch' },
    meta: { note: 'Arche group — phones not explicitly numbered in email' },
  },
};

function match(
  actual: number | undefined,
  expected: number | undefined,
  tolerance = 0.02
): '✅' | '❌' | '—' | '?' {
  if (expected === undefined) return '?';
  const a = Number(actual || 0);
  if (Number.isInteger(expected)) return a === expected ? '✅' : '❌';
  return Math.abs(a - expected) < tolerance ? '✅' : '❌';
}

function fmt(n: number | undefined | null, money = false) {
  const v = Number(n || 0);
  return money
    ? v.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : String(v);
}

async function fetchLiveGoogle(client: any, settings: Record<string, string>) {
  const { GoogleAdsAPIService } = await import('../src/lib/google-ads-api');
  const mappings = await loadClientConversionMappings(client.id);
  const svc = new GoogleAdsAPIService({
    refreshToken: settings.google_ads_manager_refresh_token,
    clientId: settings.google_ads_client_id,
    clientSecret: settings.google_ads_client_secret,
    developmentToken: settings.google_ads_developer_token,
    customerId: client.google_ads_customer_id,
    managerCustomerId: settings.google_ads_manager_customer_id,
    conversionMappings: mappings,
  });
  const result = await svc.getCampaignData(START, END);
  const campaigns = result?.campaigns ?? result ?? [];
  const totals = (campaigns as any[]).reduce(
    (a, c) => ({
      reservations: a.reservations + (c.reservations || 0),
      reservation_value: a.reservation_value + (c.reservation_value || 0),
      booking_step_1: a.booking_step_1 + (c.booking_step_1 || 0),
      booking_step_2: a.booking_step_2 + (c.booking_step_2 || 0),
      booking_step_3: a.booking_step_3 + (c.booking_step_3 || 0),
      click_to_call: a.click_to_call + (c.click_to_call || 0),
      email_contacts: a.email_contacts + (c.email_contacts || 0),
    }),
    {
      reservations: 0,
      reservation_value: 0,
      booking_step_1: 0,
      booking_step_2: 0,
      booking_step_3: 0,
      click_to_call: 0,
      email_contacts: 0,
    }
  );
  totals.reservations = Math.round(totals.reservations);
  totals.reservation_value = Math.round(totals.reservation_value * 100) / 100;
  return totals;
}

async function fetchLiveMeta(client: any) {
  const token = client.system_user_token || client.meta_access_token;
  const service = new MetaAPIServiceOptimized(token);
  service.clearCache();
  const accountId = String(client.ad_account_id).replace(/^act_/, '');
  const raw = await service.getCampaignInsights(accountId, START, END, 0);
  const mappings = await loadClientConversionMappings(client.id);
  const campaigns = enhanceCampaignsWithConversions(raw, mappings);
  return aggregateConversionMetrics(campaigns);
}

async function fetchStored(clientId: string, platform: 'google' | 'meta') {
  const { data } = await supabase
    .from('campaign_summaries')
    .select(
      'reservations, reservation_value, booking_step_1, booking_step_2, booking_step_3, click_to_call, email_contacts, data_source, last_updated'
    )
    .eq('client_id', clientId)
    .eq('platform', platform)
    .eq('summary_type', 'monthly')
    .eq('summary_date', START)
    .maybeSingle();
  return data;
}

function printRow(
  label: string,
  metric: string,
  expected: number | undefined,
  live: number,
  stored: number,
  money = false
) {
  const exp = expected === undefined ? '—' : money ? fmt(expected, true) : String(expected);
  const liveMark = match(live, expected);
  const storedMark = match(stored, expected);
  console.log(
    `    ${metric.padEnd(22)} expected ${String(exp).padStart(12)} | LIVE ${fmt(live, money).padStart(12)} ${liveMark} | DB ${fmt(stored, money).padStart(12)} ${storedMark}`
  );
}

async function main() {
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
  const settings = Object.fromEntries((settingsRows || []).map((s) => [s.key, s.value]));

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, ad_account_id, meta_access_token, system_user_token, google_ads_customer_id')
    .or('name.ilike.%pinea%,name.ilike.%nickel%,name.ilike.%arche%')
    .order('name');

  console.log(`\n${'='.repeat(88)}`);
  console.log('CLIENT EXPECTATIONS vs LIVE (fixed parser) vs STORED DB — June 2026');
  console.log(`${'='.repeat(88)}`);

  const summary: string[] = [];

  for (const client of clients || []) {
    const expected = CLIENT_EXPECTED[client.name];
    if (!expected) continue;

    console.log(`\n${client.name}`);
    if (expected.google?.note) console.log(`  Google note: ${expected.google.note}`);
    if (expected.meta?.note) console.log(`  Meta note:   ${expected.meta.note}`);

    if (client.google_ads_customer_id) {
      console.log('  GOOGLE:');
      const live = await fetchLiveGoogle(client, settings);
      const stored = (await fetchStored(client.id, 'google')) || {};
      printRow('google', 'reservations', expected.google?.reservations, live.reservations, stored.reservations || 0);
      printRow('google', 'reservation_value', expected.google?.reservation_value, live.reservation_value, Number(stored.reservation_value || 0), true);
      printRow('google', 'booking_step_1', undefined, live.booking_step_1, stored.booking_step_1 || 0);
      printRow('google', 'booking_step_2', undefined, live.booking_step_2, stored.booking_step_2 || 0);
      printRow('google', 'booking_step_3', undefined, live.booking_step_3, stored.booking_step_3 || 0);
      printRow('google', 'phones (sum)', undefined, live.click_to_call, stored.click_to_call || 0);
      printRow('google', 'emails', undefined, live.email_contacts, stored.email_contacts || 0);
      console.log(`    stored @ ${stored.last_updated || 'n/a'} [${stored.data_source || 'missing'}]`);

      if (expected.google?.reservations !== undefined) {
        if (match(live.reservations, expected.google.reservations) === '❌')
          summary.push(`${client.name} Google LIVE reservations`);
        if (match(stored.reservations, expected.google.reservations) === '❌')
          summary.push(`${client.name} Google STORED reservations`);
        if (expected.google.reservation_value !== undefined) {
          if (match(live.reservation_value, expected.google.reservation_value) === '❌')
            summary.push(`${client.name} Google LIVE value`);
          if (match(stored.reservation_value, expected.google.reservation_value) === '❌')
            summary.push(`${client.name} Google STORED value`);
        }
      }
    }

    if (client.ad_account_id && (client.system_user_token || client.meta_access_token)) {
      console.log('  META:');
      const live = await fetchLiveMeta(client);
      const stored = (await fetchStored(client.id, 'meta')) || {};
      printRow('meta', 'reservations', undefined, live.reservations, stored.reservations || 0);
      printRow('meta', 'reservation_value', undefined, live.reservation_value, Number(stored.reservation_value || 0), true);
      printRow('meta', 'booking_step_1', undefined, live.booking_step_1, stored.booking_step_1 || 0);
      printRow('meta', 'booking_step_2', undefined, live.booking_step_2, stored.booking_step_2 || 0);
      printRow('meta', 'booking_step_3', undefined, live.booking_step_3, stored.booking_step_3 || 0);
      printRow('meta', 'phones', expected.meta?.click_to_call, live.click_to_call, stored.click_to_call || 0);
      printRow('meta', 'emails', expected.meta?.email_contacts, live.email_contacts, stored.email_contacts || 0);
      console.log(`    stored @ ${stored.last_updated || 'n/a'} [${stored.data_source || 'missing'}]`);

      if (expected.meta?.click_to_call !== undefined) {
        if (match(live.click_to_call, expected.meta.click_to_call) === '❌')
          summary.push(`${client.name} Meta LIVE phones`);
        if (match(stored.click_to_call, expected.meta.click_to_call) === '❌')
          summary.push(`${client.name} Meta STORED phones`);
      }
      if (expected.meta?.email_contacts !== undefined) {
        if (match(live.email_contacts, expected.meta.email_contacts) === '❌')
          summary.push(`${client.name} Meta LIVE emails`);
        if (match(stored.email_contacts, expected.meta.email_contacts) === '❌')
          summary.push(`${client.name} Meta STORED emails`);
      }
    }
  }

  console.log(`\n${'='.repeat(88)}`);
  console.log('LEGEND: ✅ matches client number | ❌ mismatch | ? no number from client | — not stated');
  console.log(`${'='.repeat(88)}`);
  console.log('\nOVERALL (numbered expectations only):');
  if (summary.length === 0) {
    console.log('  ✅ All LIVE values with explicit client numbers match.');
    console.log('  ⚠️  STORED DB may still differ until June recollection runs.');
  } else {
    console.log('  Remaining mismatches:');
    for (const s of summary) console.log(`    ❌ ${s}`);
  }

  console.log('\nNon-data fixes (already in code, not in DB):');
  console.log('  ✅ Meta booking steps in email template (Pinea, Nickel)');
  console.log('  ✅ Phone label unified to "Kliknięcia w numer telefonu/połączenia z reklam"');
  console.log('  ⚠️  Google booking steps — need per-client conversion_mappings in admin (no screenshots to map)');
  console.log('  ⚠️  Pinea Google phones/emails — client said wrong but gave no target numbers');

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
