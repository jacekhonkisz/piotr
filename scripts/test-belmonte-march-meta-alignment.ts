/**
 * Live test: recollect Belmonte Meta March 2026 into campaign_summaries (recollectMeta path),
 * then verify reservations/reservation_value match sum(campaign_data).
 *
 * Usage: npx tsx scripts/test-belmonte-march-meta-alignment.ts
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

function sumFromCampaigns(campaigns: any[]) {
  return campaigns.reduce(
    (acc, c) => ({
      r: acc.r + Number(c.reservations || 0),
      v: acc.v + Number(c.reservation_value || 0)
    }),
    { r: 0, v: 0 }
  );
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key);

  const { data: client, error: ce } = await supabase
    .from('clients')
    .select('id, name, system_user_token, meta_access_token, ad_account_id')
    .eq('id', BELMONTE_ID)
    .single();

  if (ce || !client) {
    console.error('Client error:', ce);
    process.exit(1);
  }

  const token = client.system_user_token || client.meta_access_token;
  if (!token) {
    console.error('No Meta token');
    process.exit(1);
  }

  let adId = client.ad_account_id || '';
  if (adId.startsWith('act_')) adId = adId.slice(4);

  console.log('\n=== Live Meta fetch + upsert (recollectMeta-style) ===\n');

  const meta = new MetaAPIServiceOptimized(token);
  meta.clearCache();

  const raw = await meta.getCampaignInsights(adId, MARCH_START, MARCH_END, 0);
  const campaigns = enhanceCampaignsWithConversions(raw);
  const conv = aggregateConversionMetrics(campaigns);

  const totals = campaigns.reduce(
    (a: any, c: any) => ({
      spend: a.spend + (parseFloat(c.spend) || 0),
      impressions: a.impressions + (parseInt(c.impressions, 10) || 0),
      clicks: a.clicks + (parseInt(String(c.inline_link_clicks || c.clicks), 10) || 0),
      conversions: a.conversions + (parseInt(c.conversions, 10) || 0)
    }),
    { spend: 0, impressions: 0, clicks: 0, conversions: 0 }
  );

  let averageCtr = 0;
  let averageCpc = 0;
  try {
    const acct = await meta.getAccountInsights(adId, MARCH_START, MARCH_END);
    averageCtr = parseFloat(acct?.inline_link_click_ctr || acct?.ctr || '0');
    averageCpc = parseFloat(acct?.cost_per_inline_link_click || acct?.cpc || '0');
  } catch {
    averageCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    averageCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  }

  const roas = totals.spend > 0 && conv.reservation_value > 0 ? conv.reservation_value / totals.spend : 0;
  const costPerRes = conv.reservations > 0 && totals.spend > 0 ? totals.spend / conv.reservations : 0;

  const sumC = sumFromCampaigns(campaigns);
  console.log('API aggregateConversionMetrics:', conv.reservations, conv.reservation_value);
  console.log('Sum from campaigns array:       ', sumC.r, sumC.v);
  console.log('Match:', conv.reservations === sumC.r && Math.round(conv.reservation_value) === Math.round(sumC.v) ? 'YES' : 'NO');

  const { error: upErr } = await supabase.from('campaign_summaries').upsert(
    {
      client_id: client.id,
      platform: 'meta',
      summary_type: 'monthly',
      summary_date: MARCH_START,
      total_spend: totals.spend,
      total_impressions: Math.round(totals.impressions),
      total_clicks: Math.round(totals.clicks),
      total_conversions: Math.round(totals.conversions),
      average_ctr: averageCtr,
      average_cpc: averageCpc,
      click_to_call: Math.round(conv.click_to_call || 0),
      email_contacts: Math.round(conv.email_contacts || 0),
      booking_step_1: Math.round(conv.booking_step_1 || 0),
      booking_step_2: Math.round(conv.booking_step_2 || 0),
      booking_step_3: Math.round(conv.booking_step_3 || 0),
      reservations: Math.round(conv.reservations || 0),
      reservation_value: Math.round((conv.reservation_value || 0) * 100) / 100,
      roas: Math.round(roas * 100) / 100,
      cost_per_reservation: Math.round(costPerRes * 100) / 100,
      campaign_data: campaigns,
      data_source: 'attribution_recollection',
      last_updated: new Date().toISOString()
    },
    { onConflict: 'client_id,summary_type,summary_date,platform' }
  );

  if (upErr) {
    console.error('Upsert failed:', upErr);
    process.exit(1);
  }

  const { data: row } = await supabase
    .from('campaign_summaries')
    .select('reservations, reservation_value, campaign_data, data_source')
    .eq('client_id', BELMONTE_ID)
    .eq('summary_type', 'monthly')
    .eq('platform', 'meta')
    .eq('summary_date', MARCH_START)
    .single();

  const camps = (row?.campaign_data || []) as any[];
  const sumDb = sumFromCampaigns(camps);

  console.log('\n=== After DB upsert ===');
  console.log('data_source:', row?.data_source);
  console.log('Row reservations / value:', row?.reservations, row?.reservation_value);
  console.log('Sum from campaign_data:  ', sumDb.r, sumDb.v);
  const aligned =
    Number(row?.reservations) === sumDb.r &&
    Math.round(Number(row?.reservation_value)) === Math.round(sumDb.v);
  console.log('\n✅ Row totals match sum(campaign_data):', aligned ? 'YES' : 'NO');

  process.exit(aligned ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
