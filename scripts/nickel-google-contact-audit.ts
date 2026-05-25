/**
 * Live Google Ads API (same path as production getCampaignData → parseGoogleAdsConversions)
 * for Nickel Resort Grzybowo; compare E-mail / Telefon totals to Google Ads UI.
 *
 * Usage:
 *   npx tsx scripts/nickel-google-contact-audit.ts [startYYYY-MM-DD] [endYYYY-MM-DD]
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   system_settings: google_ads_client_id, google_ads_client_secret,
 *   google_ads_developer_token, google_ads_manager_refresh_token (or client token),
 *   google_ads_manager_customer_id
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from '../src/lib/google-ads-api';
import {
  isGoogleAdsEmailAddressClickConversion,
  isGoogleAdsPhoneOrCallConversion,
} from '../src/lib/google-ads-actions-parser';

const EXPECT = {
  emailUi: 11,
  phoneNrPlusHosted: 29 + 36,
  callsFromAds: 23,
  phoneAllInOne: 29 + 36 + 23,
};

async function loadGoogleCredentials(supabase: ReturnType<typeof createClient>) {
  const { data: settingsData, error } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', [
      'google_ads_client_id',
      'google_ads_client_secret',
      'google_ads_developer_token',
      'google_ads_manager_refresh_token',
      'google_ads_manager_customer_id',
    ]);
  if (error || !settingsData?.length) {
    throw new Error(`system_settings: ${error?.message || 'empty'}`);
  }
  const settings = Object.fromEntries(settingsData.map((s) => [s.key, s.value])) as Record<string, string>;
  return settings;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, google_ads_enabled, google_ads_customer_id, google_ads_refresh_token')
    .ilike('name', '%nickel%')
    .limit(8);

  if (error || !clients?.length) {
    console.error('No client matching %nickel%', error);
    process.exit(1);
  }

  const client = clients.find((c) => /grzybowo/i.test(c.name)) || clients[0];
  if (!client.google_ads_enabled || !client.google_ads_customer_id) {
    console.error('Client missing Google Ads:', client);
    process.exit(1);
  }

  const settings = await loadGoogleCredentials(supabase);
  const refreshToken =
    settings.google_ads_manager_refresh_token || (client as { google_ads_refresh_token?: string }).google_ads_refresh_token;
  if (!refreshToken) {
    console.error('No google_ads_manager_refresh_token and no client google_ads_refresh_token');
    process.exit(1);
  }

  const googleAdsService = new GoogleAdsAPIService({
    refreshToken,
    clientId: settings.google_ads_client_id!,
    clientSecret: settings.google_ads_client_secret!,
    developmentToken: settings.google_ads_developer_token!,
    customerId: client.google_ads_customer_id.replace(/-/g, ''),
    managerCustomerId: settings.google_ads_manager_customer_id?.replace(/-/g, ''),
  });

  const val = await googleAdsService.validateCredentials();
  if (!val.valid) {
    console.error('Google Ads validateCredentials:', val.error);
    process.exit(1);
  }

  const argv = process.argv.slice(2);
  const end = argv[1] || new Date().toISOString().slice(0, 10);
  const start = argv[0] || end.slice(0, 8) + '01';

  console.log('Client:', client.name, client.id);
  console.log('Customer:', client.google_ads_customer_id);
  console.log('Date range:', start, '→', end);
  console.log('Calling GoogleAdsAPIService.getCampaignData()…\n');

  const campaigns = await googleAdsService.getCampaignData(start, end);

  let email = 0;
  let phone = 0;
  for (const c of campaigns) {
    email += c.email_contacts || 0;
    phone += c.click_to_call || 0;
  }

  console.log('Aggregated (sum of campaigns, same as app after fetch):');
  console.log('  email_contacts:   ', Math.round(email));
  console.log('  click_to_call:    ', Math.round(phone));
  console.log();

  console.log('--- Compare to Google Ads UI (screenshot) ---');
  console.log('Expected E-mail (Kliknięcie w adres e-mail):     ', EXPECT.emailUi);
  console.log('Expected Telefon (nr + Clicks to call only):   ', EXPECT.phoneNrPlusHosted);
  console.log('Expected Calls from ads:                     ', EXPECT.callsFromAds);
  console.log('Expected all in one phone bucket (app model):', EXPECT.phoneAllInOne);
  console.log();
  console.log(
    '  E-mail match:',
    Math.round(email) === EXPECT.emailUi ? '✅' : '❌',
    `(Δ ${Math.round(email) - EXPECT.emailUi})`
  );
  console.log(
    '  Phone bucket (includes calls from ads):',
    Math.round(phone) === EXPECT.phoneAllInOne ? '✅' : '❌',
    `(got ${Math.round(phone)}, Δ vs UI one-bucket ${Math.round(phone) - EXPECT.phoneAllInOne})`
  );
  if (Math.round(phone) === EXPECT.phoneNrPlusHosted) {
    console.log('  ℹ️ Matches 65 only — “Calls from ads” may use a name we do not map, or different date range in UI.');
  }

  // Account-level name check via same API surface: re-query breakdown keys (optional quick grep)
  const byName: Record<string, number> = {};
  for (const c of campaigns) {
    const convs = (c as { conversions?: { conversion_name?: string; name?: string; conversions?: number; value?: number }[] })
      .conversions;
    if (!Array.isArray(convs)) continue;
    for (const row of convs) {
      const n = String(row.conversion_name || row.name || '').trim();
      if (!n) continue;
      const v = Number(row.conversions ?? row.value ?? 0);
      if (!Number.isFinite(v) || v === 0) continue;
      byName[n] = (byName[n] || 0) + v;
    }
  }
  const names = Object.keys(byName);
  if (names.length) {
    console.log('\nRaw conversion_name keys on campaign objects (if present):');
    for (const n of names.sort((a, b) => (byName[b] || 0) - (byName[a] || 0)).slice(0, 25)) {
      const tag = [
        isGoogleAdsEmailAddressClickConversion(n) ? 'EMAIL' : '',
        isGoogleAdsPhoneOrCallConversion(n) ? 'PHONE' : '',
      ]
        .filter(Boolean)
        .join('+');
      console.log(`  ${(byName[n] || 0).toFixed(1).padStart(7)}  ${tag.padEnd(8)}  ${n}`);
    }
  } else {
    console.log('\n(No per-row conversions[] on campaign objects — totals come from getConversionBreakdown + parser only.)');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
