#!/usr/bin/env npx tsx
/**
 * Re-collect Google Ads historical data (monthly + weekly) with:
 * - google_dynamic_metric_values / google_dynamic_metric_rows
 * - google_ads_tables + google_ads_tables_data
 *
 * Usage:
 *   npx tsx scripts/recollect-google-historical-dynamic.ts
 *   npx tsx scripts/recollect-google-historical-dynamic.ts --client=CLIENT_UUID
 *   npx tsx scripts/recollect-google-historical-dynamic.ts --months=18 --weeks=78
 */

import { config } from 'dotenv';

config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const clientArg = args.find((a) => a.startsWith('--client='));
const monthsArg = args.find((a) => a.startsWith('--months='));
const weeksArg = args.find((a) => a.startsWith('--weeks='));

const clientId = clientArg ? clientArg.split('=')[1] : undefined;
const monthsBack = monthsArg ? parseInt(monthsArg.split('=')[1], 10) : 18;
const weeksBack = weeksArg ? parseInt(weeksArg.split('=')[1], 10) : 78;

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { error: schemaError } = await supabase
    .from('campaign_summaries')
    .select('google_dynamic_metric_values, google_dynamic_metric_rows')
    .limit(1);

  if (schemaError?.message?.includes('google_dynamic_metric')) {
    console.error('❌ Migration columns missing on campaign_summaries. Run the SQL migration first.');
    console.error(schemaError.message);
    process.exit(1);
  }

  console.log('🚀 Google Ads historical recollect (dynamic metrics + tables)');
  console.log(`   monthsBack=${monthsBack}, weeksBack=${weeksBack}${clientId ? `, client=${clientId}` : ''}`);
  console.log(`   startedAt=${new Date().toISOString()}\n`);

  const { BackgroundDataCollector } = await import('../src/lib/background-data-collector');
  const collector = BackgroundDataCollector.getInstance();
  const started = Date.now();

  const result = await collector.recollectGoogleAdsHistorical({
    monthsBack,
    weeksBack,
    clientId,
  });

  const elapsedMin = ((Date.now() - started) / 60000).toFixed(1);
  console.log('\n✅ Recollect complete');
  console.log(`   clients=${result.clients}, months=${result.months}, weeks=${result.weeks}`);
  console.log(`   elapsed=${elapsedMin} min`);

  const { count: withDyn } = await supabase
    .from('campaign_summaries')
    .select('id', { count: 'exact', head: true })
    .eq('platform', 'google')
    .neq('google_dynamic_metric_values', '{}');

  console.log(`   google summaries with non-empty dynamic metrics: ${withDyn ?? '?'}`);
}

main().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
