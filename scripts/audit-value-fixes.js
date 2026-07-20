/**
 * One-off audit: verify the Meta value-mapping fix and Google value semantics.
 * Reads live Supabase data (no mutation). Run: node scripts/audit-value-fixes.js
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const num = (v) => (typeof v === 'number' ? v : parseFloat(v || '0') || 0);
const zl = (v) => `${num(v).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;

async function findClients() {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, ad_account_id, google_ads_customer_id, google_ads_enabled')
    .or('name.ilike.%pinea%,name.ilike.%kraft%,name.ilike.%kra%');
  if (error) throw error;
  return data || [];
}

function showCM(label, cm) {
  if (!cm) {
    console.log(`   ${label}: <none>`);
    return;
  }
  console.log(`   ${label}:`);
  console.log(`      reservation_value      = ${zl(cm.reservation_value)}`);
  console.log(`      conversion_value       = ${zl(cm.conversion_value)}`);
  console.log(`      total_conversion_value = ${zl(cm.total_conversion_value)}`);
  console.log(`      roas                   = ${num(cm.roas).toFixed(2)}x`);
  console.log(`      reservations           = ${num(cm.reservations)}`);
  // The bug signature: ROAS > 0 but value cards == 0
  if (num(cm.roas) > 0 && num(cm.total_conversion_value) === 0) {
    console.log(`      ⚠️  BUG SIGNATURE: roas>0 but total_conversion_value=0`);
  }
}

async function auditMetaCurrentMonth(client, periodId) {
  console.log(`\n=== META current_month_cache (${periodId}) — ${client.name} ===`);
  const { data } = await supabase
    .from('current_month_cache')
    .select('period_id, last_updated, cache_data')
    .eq('client_id', client.id)
    .eq('period_id', periodId)
    .maybeSingle();
  if (!data) {
    console.log('   <no cache row>');
    return;
  }
  console.log(`   last_updated: ${data.last_updated}`);
  showCM('conversionMetrics (stored)', data.cache_data?.conversionMetrics);
}

async function auditGoogleCurrentMonth(client, periodId) {
  console.log(`\n=== GOOGLE google_ads_current_month_cache (${periodId}) — ${client.name} ===`);
  const { data } = await supabase
    .from('google_ads_current_month_cache')
    .select('period_id, last_updated, cache_data')
    .eq('client_id', client.id)
    .eq('period_id', periodId)
    .maybeSingle();
  if (!data) {
    console.log('   <no cache row>');
    return;
  }
  console.log(`   last_updated: ${data.last_updated}`);
  showCM('conversionMetrics (stored)', data.cache_data?.conversionMetrics);
}

async function auditDailyKpi(client, start, end) {
  const { data } = await supabase
    .from('daily_kpi_data')
    .select('date, reservations, reservation_value, data_source')
    .eq('client_id', client.id)
    .gte('date', start)
    .lte('date', end);
  const totalResv = (data || []).reduce((s, r) => s + num(r.reservation_value), 0);
  const totalRes = (data || []).reduce((s, r) => s + num(r.reservations), 0);
  console.log(`\n   daily_kpi_data ${start}..${end}: rows=${data?.length || 0}, reservations=${totalRes}, reservation_value=${zl(totalResv)}`);
}

async function auditSummaries(client, monthStart) {
  console.log(`\n=== campaign_summaries (monthly ${monthStart}) — ${client.name} ===`);
  const { data } = await supabase
    .from('campaign_summaries')
    .select('platform, summary_date, total_spend, reservations, reservation_value, total_conversion_value')
    .eq('client_id', client.id)
    .eq('summary_type', 'monthly')
    .eq('summary_date', monthStart);
  if (!data || data.length === 0) {
    console.log('   <no monthly summaries for this month>');
    return;
  }
  for (const r of data) {
    console.log(`   [${r.platform}] spend=${zl(r.total_spend)} reservations=${num(r.reservations)} reservation_value=${zl(r.reservation_value)} total_conversion_value=${zl(r.total_conversion_value)}`);
  }
}

(async () => {
  const now = new Date();
  const curPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const curStart = `${curPeriod}-01`;
  const curEnd = now.toISOString().split('T')[0];

  const clients = await findClients();
  console.log('Matched clients:');
  clients.forEach((c) => console.log(`  - ${c.name} (${c.id}) meta=${!!c.ad_account_id} google=${!!c.google_ads_enabled}/${c.google_ads_customer_id || '-'}`));

  for (const client of clients) {
    console.log(`\n\n############ ${client.name} ############`);
    await auditMetaCurrentMonth(client, curPeriod);
    await auditDailyKpi(client, curStart, curEnd);
    await auditGoogleCurrentMonth(client, curPeriod);
    await auditSummaries(client, '2026-05-01');
    await auditDailyKpi(client, '2026-05-01', '2026-05-31');
  }
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
