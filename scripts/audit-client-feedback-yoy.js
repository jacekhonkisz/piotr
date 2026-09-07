/**
 * Read-only audit: does the previous-year period have Google/Meta reservation_value
 * stored? Missing previous-year value is what suppresses the "vs rok do roku"
 * badges for "Wartość rezerwacji" and "ROAS" in the PDF.
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PERIODS = ['2026-07-01', '2025-07-01'];

async function main() {
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name, google_ads_enabled, google_ads_customer_id, ad_account_id');
  if (clientsError) throw clientsError;

  const { data: rows, error } = await supabase
    .from('campaign_summaries')
    .select('client_id, platform, summary_date, total_spend, total_conversions, reservations, reservation_value, total_conversion_value')
    .eq('summary_type', 'monthly')
    .in('summary_date', PERIODS)
    .order('summary_date', { ascending: false });
  if (error) throw error;

  const byClient = new Map();
  for (const row of rows) {
    if (!byClient.has(row.client_id)) byClient.set(row.client_id, []);
    byClient.get(row.client_id).push(row);
  }

  for (const client of clients) {
    const clientRows = byClient.get(client.id) || [];
    if (clientRows.length === 0) continue;
    console.log(`\n=== ${client.name} (google_enabled=${!!client.google_ads_enabled}) ===`);
    for (const period of PERIODS) {
      for (const platform of ['google', 'meta']) {
        const row = clientRows.find((r) => r.summary_date === period && r.platform === platform);
        if (!row) {
          console.log(`  ${period} ${platform.padEnd(6)} -> NO ROW`);
          continue;
        }
        console.log(
          `  ${period} ${platform.padEnd(6)} -> spend=${Number(row.total_spend || 0).toFixed(2)}` +
            ` reservations=${row.reservations ?? 'null'}` +
            ` reservation_value=${row.reservation_value ?? 'null'}` +
            ` total_conversion_value=${row.total_conversion_value ?? 'null'}`
        );
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
