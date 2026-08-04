/**
 * Dump Google Ads conversion actions (with primary_for_goal = "Podstawowe"/"Dodatkowe")
 * and per-action totals for a date range, for a given client.
 *
 * Usage:
 *   npx tsx scripts/audit-conversion-actions-primary.ts "<client name pattern>" <startYYYY-MM-DD> <endYYYY-MM-DD>
 */
import 'dotenv/config';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from '../src/lib/google-ads-api';

dotenv.config({ path: '.env.local' });

async function main() {
  const [pattern, start, end] = process.argv.slice(2);
  if (!pattern || !start || !end) {
    console.error('Usage: npx tsx scripts/audit-conversion-actions-primary.ts "<client pattern>" <start> <end>');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, google_ads_enabled, google_ads_customer_id')
    .ilike('name', `%${pattern}%`)
    .limit(5);
  if (error || !clients?.length) {
    console.error('No client matching pattern', pattern, error);
    process.exit(1);
  }
  const client = clients[0];
  console.log(`\nCLIENT: ${client.name} (customer ${client.google_ads_customer_id}) — ${start} → ${end}`);

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

  const svc = new GoogleAdsAPIService({
    refreshToken: settings.google_ads_manager_refresh_token,
    clientId: settings.google_ads_client_id,
    clientSecret: settings.google_ads_client_secret,
    developmentToken: settings.google_ads_developer_token,
    customerId: client.google_ads_customer_id as string,
    managerCustomerId: settings.google_ads_manager_customer_id,
  } as any);
  const exec = (q: string) => (svc as any).executeQuery(q);

  console.log('\n=== CONVERSION ACTION CATALOG ===');
  const catalog = await exec(`
    SELECT
      conversion_action.id,
      conversion_action.name,
      conversion_action.category,
      conversion_action.type,
      conversion_action.status,
      conversion_action.primary_for_goal,
      conversion_action.include_in_conversions_metric
    FROM conversion_action
    ORDER BY conversion_action.name
  `);
  const catByName: Record<string, any> = {};
  for (const row of catalog || []) {
    const ca = row.conversion_action;
    catByName[String(ca.name)] = ca;
    console.log(
      `  ${String(ca.name).padEnd(45)} cat=${String(ca.category).padEnd(22)} primary_for_goal=${String(ca.primary_for_goal).padEnd(5)} include_in_conv=${String(ca.include_in_conversions_metric).padEnd(5)} status=${ca.status}`
    );
  }

  console.log('\n=== PER-ACTION TOTALS (customer level) ===');
  const rows = await exec(`
    SELECT
      segments.conversion_action_name,
      metrics.all_conversions,
      metrics.all_conversions_value,
      metrics.conversions,
      metrics.conversions_value
    FROM customer
    WHERE segments.date BETWEEN '${start}' AND '${end}'
    ORDER BY segments.conversion_action_name
  `);
  const totals: Record<string, { all: number; allVal: number; conv: number; convVal: number }> = {};
  for (const row of rows || []) {
    const name = String(row.segments?.conversion_action_name || '');
    const t = (totals[name] ||= { all: 0, allVal: 0, conv: 0, convVal: 0 });
    t.all += parseFloat(row.metrics?.all_conversions || '0') || 0;
    t.allVal += parseFloat(row.metrics?.all_conversions_value || '0') || 0;
    t.conv += parseFloat(row.metrics?.conversions || '0') || 0;
    t.convVal += parseFloat(row.metrics?.conversions_value || '0') || 0;
  }
  for (const [name, t] of Object.entries(totals).sort((a, b) => b[1].all - a[1].all)) {
    const meta = catByName[name];
    console.log(
      `  ${name.padEnd(45)} all_conv=${t.all.toFixed(2).padStart(10)} all_val=${t.allVal.toFixed(2).padStart(12)} | conv=${t.conv.toFixed(2).padStart(10)} conv_val=${t.convVal.toFixed(2).padStart(12)} | cat=${meta?.category ?? '?'} primary=${meta?.primary_for_goal ?? '?'}`
    );
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
