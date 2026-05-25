#!/usr/bin/env npx tsx
/**
 * Re-collect Meta monthly campaign_summaries for audit MISMATCH clients/periods.
 *
 * Usage: npx tsx scripts/recollect-mismatch-meta.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { MetaAPIService } from '../src/lib/meta-api-optimized';
import {
  enhanceCampaignsWithConversions,
  aggregateConversionMetrics,
} from '../src/lib/meta-actions-parser';
import {
  validateMetaCampaignSummaryWrite,
  logBlockedMetaSummaryWrite,
} from '../src/lib/campaign-summary-guard';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const TARGETS: Array<{ clientId: string; name: string; months: string[] }> = [
  {
    clientId: 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa',
    name: 'Belmonte Hotel',
    months: ['2025-03', '2025-04', '2025-05', '2025-06'],
  },
  {
    clientId: '8657100a-6e87-422c-97f4-b733754a9ff8',
    name: 'Hotel Lambert Ustronie Morskie',
    months: ['2025-03'],
  },
];

function periodBounds(monthTag: string): { start: string; end: string; summaryDate: string } {
  const [y, m] = monthTag.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    summaryDate: `${monthTag}-01`,
    start: `${monthTag}-01`,
    end: `${monthTag}-${String(lastDay).padStart(2, '0')}`,
  };
}

async function recollectMonth(
  supabase: ReturnType<typeof createClient>,
  client: {
    id: string;
    name: string;
    ad_account_id: string;
    system_user_token: string | null;
    meta_access_token: string | null;
  },
  monthTag: string
) {
  const token = client.system_user_token || client.meta_access_token;
  if (!token || !client.ad_account_id) {
    return { month: monthTag, status: 'skipped' as const, reason: 'no credentials' };
  }

  const { start, end, summaryDate } = periodBounds(monthTag);
  const metaService = new MetaAPIService(token);
  const tokenCheck = await metaService.validateToken();
  if (!tokenCheck.valid) {
    return { month: monthTag, status: 'skipped' as const, reason: 'invalid token' };
  }

  const adAccountId = client.ad_account_id.startsWith('act_')
    ? client.ad_account_id.substring(4)
    : client.ad_account_id;

  const { data: before } = await supabase
    .from('campaign_summaries')
    .select('total_spend, total_impressions, total_clicks, reservations')
    .eq('client_id', client.id)
    .eq('platform', 'meta')
    .eq('summary_type', 'monthly')
    .eq('summary_date', summaryDate)
    .maybeSingle();

  const rawCampaigns = await metaService.getCampaignInsights(adAccountId, start, end);
  if (!rawCampaigns?.length) {
    return { month: monthTag, status: 'skipped' as const, reason: 'no campaigns from API' };
  }

  const campaigns = enhanceCampaignsWithConversions(rawCampaigns);
  const conv = aggregateConversionMetrics(campaigns);

  const totals = campaigns.reduce(
    (a, c) => ({
      spend: a.spend + (parseFloat(c.spend) || 0),
      impressions: a.impressions + (parseInt(c.impressions, 10) || 0),
      clicks: a.clicks + (parseInt(c.inline_link_clicks || c.clicks, 10) || 0),
      conversions: a.conversions + (parseInt(c.conversions, 10) || 0),
    }),
    { spend: 0, impressions: 0, clicks: 0, conversions: 0 }
  );

  let averageCtr: number;
  let averageCpc: number;
  try {
    const acct = await metaService.getAccountInsights(adAccountId, start, end);
    averageCtr = parseFloat(acct?.inline_link_click_ctr || acct?.ctr || '0');
    averageCpc = parseFloat(acct?.cost_per_inline_link_click || acct?.cpc || '0');
  } catch {
    averageCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    averageCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  }

  const roas =
    totals.spend > 0 && conv.reservation_value > 0
      ? conv.reservation_value / totals.spend
      : 0;
  const costPerRes =
    conv.reservations > 0 && totals.spend > 0 ? totals.spend / conv.reservations : 0;

  const guard = validateMetaCampaignSummaryWrite({
    totals,
    campaigns,
    liveApiCampaignCount: campaigns.length,
  });
  if (!guard.allowed) {
    logBlockedMetaSummaryWrite('mismatch_recollection', client.id, summaryDate, guard);
    return { month: monthTag, status: 'skipped' as const, reason: guard.reason };
  }

  const { error } = await supabase.from('campaign_summaries').upsert(
    {
      client_id: client.id,
      platform: 'meta',
      summary_type: 'monthly',
      summary_date: summaryDate,
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
      data_source: 'mismatch_recollection_v1',
      last_updated: new Date().toISOString(),
    },
    { onConflict: 'client_id,summary_type,summary_date,platform' }
  );

  if (error) {
    return { month: monthTag, status: 'failed' as const, reason: error.message };
  }

  return {
    month: monthTag,
    status: 'success' as const,
    before: {
      spend: before?.total_spend ?? 0,
      impressions: before?.total_impressions ?? 0,
    },
    after: {
      spend: totals.spend,
      impressions: totals.impressions,
      campaigns: campaigns.length,
      reservations: conv.reservations || 0,
    },
  };
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('Meta mismatch recollection\n');

  for (const target of TARGETS) {
    const { data: client, error } = await supabase
      .from('clients')
      .select('id, name, ad_account_id, system_user_token, meta_access_token')
      .eq('id', target.clientId)
      .single();

    if (error || !client) {
      console.error(`❌ ${target.name}: client not found`);
      continue;
    }

    console.log(`\n=== ${client.name} ===`);

    for (const month of target.months) {
      const result = await recollectMonth(supabase, client, month);
      if (result.status === 'success') {
        console.log(
          `  ✅ ${month}: spend ${result.before.spend.toFixed(2)} → ${result.after.spend.toFixed(2)} PLN | ` +
            `imp ${result.before.impressions} → ${result.after.impressions} | ` +
            `${result.after.campaigns} campaigns | ${result.after.reservations} reservations`
        );
      } else {
        console.log(`  ⚠️ ${month}: ${result.status} — ${result.reason}`);
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
