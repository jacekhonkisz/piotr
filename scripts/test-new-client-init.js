/**
 * Faithful test of the "add new client → data auto-collected" flow.
 *
 *  setup   : clone a real client's Meta+Google credentials into a fresh temp
 *            client (so real ad data exists), with empty caches/summaries.
 *  trigger : (done via the debug init route in the dev server)
 *  verify  : read the temp client's current-month caches + historical summaries.
 *  cleanup : delete the temp client and all its collected rows.
 *
 * Usage:
 *   node scripts/test-new-client-init.js setup    <sourceClientId>
 *   node scripts/test-new-client-init.js verify   <tempClientId>
 *   node scripts/test-new-client-init.js cleanup  <tempClientId>
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const num = (v) => (typeof v === 'number' ? v : parseFloat(v || '0') || 0);
const zl = (v) => `${num(v).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
const TEMP_PREFIX = '__INIT_TEST__';

async function setup(sourceId) {
  const { data: src, error } = await supabase.from('clients').select('*').eq('id', sourceId).single();
  if (error || !src) throw new Error('source client not found: ' + (error && error.message));

  const clone = { ...src };
  delete clone.id;
  delete clone.created_at;
  delete clone.updated_at;
  clone.name = `${TEMP_PREFIX} ${src.name}`;
  clone.email = `init-test-${Date.now()}@example.com`;
  if ('company' in clone) clone.company = `${TEMP_PREFIX} ${src.company || src.name}`;

  const { data: inserted, error: insErr } = await supabase.from('clients').insert(clone).select('id, name').single();
  if (insErr) throw new Error('insert failed: ' + insErr.message);
  console.log('TEMP_CLIENT_ID=' + inserted.id);
  console.log('   name:', inserted.name);
  console.log('   (caches/summaries are empty — simulating a brand-new client)');
}

async function verify(id) {
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [meta, google, monthly, weekly] = await Promise.all([
    supabase.from('current_month_cache').select('cache_data').eq('client_id', id).eq('period_id', period).maybeSingle(),
    supabase.from('google_ads_current_month_cache').select('cache_data').eq('client_id', id).eq('period_id', period).maybeSingle(),
    supabase.from('campaign_summaries').select('platform, summary_date, total_spend, reservation_value, total_conversion_value').eq('client_id', id).eq('summary_type', 'monthly').order('summary_date'),
    supabase.from('campaign_summaries').select('id', { count: 'exact', head: true }).eq('client_id', id).eq('summary_type', 'weekly'),
  ]);

  console.log(`\n=== CURRENT MONTH (${period}) ===`);
  const mcm = meta.data?.cache_data?.conversionMetrics;
  const gcm = google.data?.cache_data?.conversionMetrics;
  console.log('  META cache:', meta.data ? `spend=${zl(meta.data.cache_data?.stats?.totalSpend)} reservations=${num(mcm?.reservations)} value=${zl(mcm?.total_conversion_value)} roas=${num(mcm?.roas).toFixed(2)}x` : '<none>');
  console.log('  GOOGLE cache:', google.data ? `spend=${zl(google.data.cache_data?.stats?.totalSpend)} reservations=${num(gcm?.reservations)} value=${zl(gcm?.total_conversion_value)} roas=${num(gcm?.roas).toFixed(2)}x` : '<none>');

  console.log(`\n=== HISTORICAL SUMMARIES ===`);
  console.log(`  monthly rows: ${monthly.data?.length || 0}, weekly rows: ${weekly.count || 0}`);
  (monthly.data || []).forEach((r) => console.log(`   [${r.platform}] ${r.summary_date} spend=${zl(r.total_spend)} value=${zl(r.total_conversion_value)}`));
}

async function cleanup(id) {
  await supabase.from('campaign_summaries').delete().eq('client_id', id);
  await supabase.from('current_month_cache').delete().eq('client_id', id);
  await supabase.from('google_ads_current_month_cache').delete().eq('client_id', id);
  await supabase.from('current_week_cache').delete().eq('client_id', id).then(() => {}, () => {});
  await supabase.from('google_ads_current_week_cache').delete().eq('client_id', id).then(() => {}, () => {});
  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) throw new Error('delete client failed: ' + error.message);
  console.log('🧹 Deleted temp client and all collected rows:', id);
}

const [cmd, arg] = process.argv.slice(2);
(async () => {
  if (cmd === 'setup') return setup(arg);
  if (cmd === 'verify') return verify(arg);
  if (cmd === 'cleanup') return cleanup(arg);
  console.log('usage: node scripts/test-new-client-init.js <setup|verify|cleanup> <id>');
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
