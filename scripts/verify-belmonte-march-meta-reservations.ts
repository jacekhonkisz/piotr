/**
 * Compare Belmonte Meta API (production path) vs client Ads Manager export — March 2026.
 * Client reference from spreadsheet: ~60 purchases, ~215,262 PLN (website purchases).
 *
 * Usage: npx tsx scripts/verify-belmonte-march-meta-reservations.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { MetaAPIServiceOptimized } from '../src/lib/meta-api-optimized';
import { enhanceCampaignsWithConversions, aggregateConversionMetrics } from '../src/lib/meta-actions-parser';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const BELMONTE_ID = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
const MARCH_START = '2026-03-01';
const MARCH_END = '2026-03-31';

/** From client’s Meta export (visible rows summed) */
const CLIENT_REF = { reservations: 60, reservation_value: 215262 };

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: client, error } = await supabase
    .from('clients')
    .select('id, name, ad_account_id, system_user_token, meta_access_token')
    .eq('id', BELMONTE_ID)
    .single();

  if (error || !client) {
    console.error('Belmonte client not found:', error);
    process.exit(1);
  }

  const metaToken = client.system_user_token || client.meta_access_token;
  if (!metaToken) {
    console.error('No Meta token on client');
    process.exit(1);
  }

  let adAccountId = client.ad_account_id || '';
  if (adAccountId.startsWith('act_')) adAccountId = adAccountId.slice(4);

  console.log('\n=== Belmonte Meta — March 2026 (API vs client export) ===\n');
  console.log(`Account: ${client.name}`);
  console.log(`Range:   ${MARCH_START} … ${MARCH_END}`);
  console.log(`Client reference (spreadsheet): ${CLIENT_REF.reservations} purchases, ${CLIENT_REF.reservation_value} PLN\n`);

  const metaService = new MetaAPIServiceOptimized(metaToken);
  metaService.clearCache();

  const raw = await metaService.getCampaignInsights(adAccountId, MARCH_START, MARCH_END, 0);
  console.log(`Campaign rows returned: ${raw.length}`);

  const parsed = enhanceCampaignsWithConversions(raw);
  const agg = aggregateConversionMetrics(parsed);

  const r = Math.round(agg.reservations);
  const v = Math.round(agg.reservation_value);

  console.log('\n--- Our pipeline (unified attribution + pagination + omni_purchase) ---');
  console.log(`Reservations (count): ${r}`);
  console.log(`Reservation value:    ${v}`);

  const dR = r - CLIENT_REF.reservations;
  const dV = v - CLIENT_REF.reservation_value;
  const match =
    Math.abs(dR) <= 2 && Math.abs(dV) <= Math.max(500, CLIENT_REF.reservation_value * 0.02);

  console.log('\n--- Delta vs client ---');
  console.log(`Δ count: ${dR >= 0 ? '+' : ''}${dR}`);
  console.log(`Δ value: ${dV >= 0 ? '+' : ''}${dV}`);

  if (match) {
    console.log('\n✅ Within tolerance (±2 bookings or ±2% value, min 500 PLN) — matches client export.');
  } else {
    console.log('\n⚠️ Outside tolerance — check attribution window in Ads Manager export, timezone, or late conversions.');
  }

  const withPurchases = parsed.filter((c: any) => (c.reservations || 0) > 0 || (c.reservation_value || 0) > 0);
  console.log(`\nCampaigns with purchase data: ${withPurchases.length} / ${parsed.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
