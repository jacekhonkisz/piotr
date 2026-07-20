/**
 * Test: June Google reservation values vs live API + recollect cron wiring.
 * Run: node scripts/test-google-june-match-and-cron.js
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const START = '2026-06-01';
const END = '2026-06-30';
const zl = (v) => Number(v || 0).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (a, b) => (b ? ((a / b - 1) * 100).toFixed(2) + '%' : 'n/a');

async function fetchLiveGoogle(client, settings) {
  const { GoogleAdsAPIService } = require('../src/lib/google-ads-api');
  const svc = new GoogleAdsAPIService({
    refreshToken: settings.google_ads_manager_refresh_token,
    clientId: settings.google_ads_client_id,
    clientSecret: settings.google_ads_client_secret,
    developmentToken: settings.google_ads_developer_token,
    customerId: client.google_ads_customer_id,
    managerCustomerId: settings.google_ads_manager_customer_id,
  });
  const result = await svc.getCampaignData(START, END);
  const campaigns = result?.campaigns ?? result;
  const totals = (campaigns || []).reduce(
    (a, c) => ({
      reservations: a.reservations + (c.reservations || 0),
      reservation_value: a.reservation_value + (c.reservation_value || 0),
      total_conversion_value: a.total_conversion_value + (c.total_conversion_value || 0),
      booking_step_1: a.booking_step_1 + (c.booking_step_1 || 0),
      booking_step_2: a.booking_step_2 + (c.booking_step_2 || 0),
      booking_step_3: a.booking_step_3 + (c.booking_step_3 || 0),
      click_to_call: a.click_to_call + (c.click_to_call || 0),
      email_contacts: a.email_contacts + (c.email_contacts || 0),
      spend: a.spend + (c.spend || 0),
    }),
    {
      reservations: 0,
      reservation_value: 0,
      total_conversion_value: 0,
      booking_step_1: 0,
      booking_step_2: 0,
      booking_step_3: 0,
      click_to_call: 0,
      email_contacts: 0,
      spend: 0,
    }
  );
  totals.reservations = Math.round(totals.reservations);
  totals.reservation_value = Math.round(totals.reservation_value * 100) / 100;
  totals.total_conversion_value = Math.round(totals.total_conversion_value * 100) / 100;
  totals.roas = totals.spend > 0 && totals.reservation_value > 0 ? Math.round((totals.reservation_value / totals.spend) * 100) / 100 : 0;
  return totals;
}

async function testCronRoute() {
  const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return { ok: false, note: 'CRON_SECRET not set — skip HTTP cron test' };
  }
  const url = `${base}/api/automated/recollect-previous-month?offset=0&limit=2`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(120000),
    });
    const body = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      status: res.status,
      success: body.success,
      processed: body.processed ?? body.results?.length,
      successCount: body.successCount,
      note: body.error || body.message,
    };
  } catch (e) {
    return { ok: false, note: `HTTP failed: ${e.message}` };
  }
}

function auditVercelCrons() {
  const fs = require('fs');
  const path = require('path');
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '../vercel.json'), 'utf8'));
  const crons = cfg.crons || [];
  const recollect = crons.filter((c) => c.path.includes('recollect-previous-month'));
  const eom = crons.filter((c) => c.path.includes('end-of-month-collection'));
  const verify = crons.filter((c) => c.path.includes('verify-google-month-close'));
  const issues = [];
  if (recollect.length < 4) issues.push(`expected >=4 recollect crons, found ${recollect.length}`);
  const hasBatch1 = recollect.some((c) => c.path.includes('offset=0') && !c.path.includes('monthOffset=2'));
  const hasBatch2 = recollect.some((c) => c.path.includes('offset=7'));
  const hasMonth2 = recollect.some((c) => c.path.includes('monthOffset=2'));
  if (!hasBatch1) issues.push('missing recollect batch offset=0');
  if (!hasBatch2) issues.push('missing recollect batch offset=7');
  if (!hasMonth2) issues.push('missing recollect monthOffset=2 (final close)');
  return { recollect: recollect.length, eom: eom.length, verify: verify.length, issues, entries: recollect };
}

async function main() {
  console.log('=== CRON CONFIG (vercel.json) ===');
  const cronAudit = auditVercelCrons();
  console.log(`  recollect-previous-month: ${cronAudit.recollect} jobs`);
  cronAudit.entries.forEach((e) => console.log(`    - ${e.schedule} → ${e.path}`));
  console.log(`  end-of-month-collection: ${cronAudit.eom} jobs`);
  console.log(`  verify-google-month-close: ${cronAudit.verify} jobs`);
  if (cronAudit.issues.length) {
    console.log('  ❌ ISSUES:', cronAudit.issues.join('; '));
  } else {
    console.log('  ✅ All expected recollect cron entries present');
  }

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
  const settings = (settingsData || []).reduce((a, s) => {
    a[s.key] = s.value;
    return a;
  }, {});

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, google_ads_customer_id')
    .or('name.ilike.%pinea%,name.ilike.%nickel%,name.ilike.%arche%');

  console.log('\n=== LIVE API vs STORED (June 2026) ===');
  let allMatch = true;
  for (const client of clients || []) {
    if (!client.google_ads_customer_id) continue;
    const { data: sum } = await supabase
      .from('campaign_summaries')
      .select('reservations, reservation_value, total_conversion_value, booking_step_1, booking_step_2, booking_step_3, click_to_call, email_contacts, roas, data_source, last_updated')
      .eq('client_id', client.id)
      .eq('platform', 'google')
      .eq('summary_type', 'monthly')
      .eq('summary_date', START)
      .maybeSingle();

    console.log(`\n  ${client.name}`);
    const live = await fetchLiveGoogle(client, settings);
    const dbRv = Number(sum?.reservation_value || 0);
    const dbRes = Number(sum?.reservations || 0);
    const dbTcv = Number(sum?.total_conversion_value || 0);
    const rvDiff = Math.abs(live.reservation_value - dbRv);
    const resDiff = Math.abs(live.reservations - dbRes);
    const tcvMatch = Math.abs(live.total_conversion_value - dbTcv) < 0.02;
    const rvMatch = rvDiff < 0.02 && resDiff === 0;
    const semanticsOk = Math.abs(dbTcv - dbRv) < 0.02;

    console.log(`    LIVE API : ${live.reservations} rez | ${zl(live.reservation_value)} | tcv ${zl(live.total_conversion_value)} | roas ${live.roas}x`);
    console.log(`    DB stored: ${dbRes} rez | ${zl(dbRv)} | tcv ${zl(dbTcv)} | roas ${sum?.roas}x | ${sum?.data_source}`);
    console.log(`    LIVE funnel/contact: ${live.booking_step_1} → ${live.booking_step_2} → ${live.booking_step_3} | tel ${live.click_to_call} | e-mail ${live.email_contacts}`);
    console.log(`    DB funnel/contact  : ${sum?.booking_step_1 || 0} → ${sum?.booking_step_2 || 0} → ${sum?.booking_step_3 || 0} | tel ${sum?.click_to_call || 0} | e-mail ${sum?.email_contacts || 0}`);
    console.log(`    Match    : reservations ${resDiff === 0 ? '✅' : '❌ Δ' + resDiff} | value ${rvMatch ? '✅' : '❌ Δ' + zl(rvDiff) + ' (' + pct(live.reservation_value, dbRv) + ')'} | tcv=rv ${semanticsOk ? '✅' : '❌'}`);
    if (!rvMatch || !tcvMatch || !semanticsOk) allMatch = false;
  }

  console.log('\n=== RECOLLECT CRON ROUTE (HTTP smoke test) ===');
  const cronTest = await testCronRoute();
  if (cronTest.note?.includes('skip')) {
    console.log('  ⚠️', cronTest.note);
  } else if (cronTest.ok && cronTest.success !== false) {
    console.log(`  ✅ Route responded ${cronTest.status} | processed=${cronTest.processed} success=${cronTest.successCount}`);
  } else {
    console.log(`  ❌ Route failed: status=${cronTest.status} ${cronTest.note || ''}`);
  }

  console.log('\n=== SUMMARY ===');
  console.log(allMatch ? '  ✅ Stored June values match live API (reservation-only semantics)' : '  ⚠️  Some stored values differ from live API — expected if attribution moved since last DB write; run recollect or refresh');
  console.log(cronAudit.issues.length === 0 ? '  ✅ Cron jobs configured in vercel.json' : '  ❌ Cron config issues remain');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
