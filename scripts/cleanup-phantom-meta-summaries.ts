#!/usr/bin/env npx tsx
/**
 * Remove phantom Meta monthly rows (stored metrics with no live Meta API data).
 *
 * Usage:
 *   npx tsx scripts/cleanup-phantom-meta-summaries.ts           # dry-run
 *   npx tsx scripts/cleanup-phantom-meta-summaries.ts --apply   # delete rows
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import {
  detectSyntheticCampaignMarkers,
  isRealMetaCampaignId,
} from '../src/lib/campaign-summary-guard';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const APPLY = process.argv.includes('--apply');

/** Confirmed by audit-stored-vs-live-meta (2026-05-25). */
const CONFIRMED_PHANTOMS: Array<{ client_id: string; summary_date: string; name: string }> = [
  { client_id: 'df96c536-8020-432b-88b8-209d3a830857', summary_date: '2025-03-01', name: 'Nickel Resort Grzybowo' },
  { client_id: 'df96c536-8020-432b-88b8-209d3a830857', summary_date: '2025-04-01', name: 'Nickel Resort Grzybowo' },
  { client_id: 'df96c536-8020-432b-88b8-209d3a830857', summary_date: '2025-05-01', name: 'Nickel Resort Grzybowo' },
  { client_id: 'df96c536-8020-432b-88b8-209d3a830857', summary_date: '2025-06-01', name: 'Nickel Resort Grzybowo' },
  { client_id: 'df958c17-a745-4587-9fe2-738e1005d8d4', summary_date: '2025-03-01', name: 'Hotel Tobaco Łódź' },
];

const SPEND_THRESHOLD = 1;
const IMPRESSIONS_THRESHOLD = 10;
const API_DELAY_MS = 150;

async function liveMetaEmpty(
  token: string,
  adAccountId: string,
  summaryDate: string
): Promise<boolean> {
  const tag = summaryDate.slice(0, 7);
  const [y, m] = tag.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const start = `${tag}-01`;
  const end = `${tag}-${String(lastDay).padStart(2, '0')}`;
  const adId = adAccountId.startsWith('act_') ? adAccountId.substring(4) : adAccountId;
  const url =
    `https://graph.facebook.com/v21.0/act_${adId}/insights?level=account` +
    `&time_range={"since":"${start}","until":"${end}"}` +
    `&fields=spend,impressions&access_token=${token}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.error) return true;
  const row = json.data?.[0];
  const spend = parseFloat(row?.spend || '0');
  const imp = parseInt(row?.impressions || '0', 10);
  return spend <= SPEND_THRESHOLD && imp <= IMPRESSIONS_THRESHOLD;
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, ad_account_id, system_user_token, meta_access_token');

  const clientById = new Map((clients || []).map((c) => [c.id, c]));

  const { data: rows } = await supabase
    .from('campaign_summaries')
    .select('id, client_id, summary_date, total_spend, total_impressions, campaign_data, data_source')
    .eq('platform', 'meta')
    .eq('summary_type', 'monthly')
    .gt('total_spend', 0);

  const toDelete = new Map<string, { id: string; reason: string; name: string; period: string; spend: number }>();

  for (const p of CONFIRMED_PHANTOMS) {
    const { data: row } = await supabase
      .from('campaign_summaries')
      .select('id, total_spend')
      .eq('client_id', p.client_id)
      .eq('platform', 'meta')
      .eq('summary_type', 'monthly')
      .eq('summary_date', p.summary_date)
      .maybeSingle();
    if (row?.id) {
      toDelete.set(row.id, {
        id: row.id,
        reason: 'audit_confirmed_phantom',
        name: p.name,
        period: p.summary_date.slice(0, 7),
        spend: row.total_spend,
      });
    }
  }

  console.log('Scanning for additional synthetic monthly Meta rows...\n');

  for (const row of rows || []) {
    if (toDelete.has(row.id)) continue;
    const markers = detectSyntheticCampaignMarkers(row.campaign_data);
    if (markers.length === 0) continue;

    const campaigns = Array.isArray(row.campaign_data) ? row.campaign_data : [];
    const hasReal = campaigns.some((c: Record<string, unknown>) =>
      isRealMetaCampaignId(c.campaign_id || c.campaignId)
    );
    if (hasReal) continue;

    const client = clientById.get(row.client_id);
    const token = client?.system_user_token || client?.meta_access_token;
    if (!token || !client?.ad_account_id) continue;

    const empty = await liveMetaEmpty(token, client.ad_account_id, row.summary_date);
    await new Promise((r) => setTimeout(r, API_DELAY_MS));

    if (empty) {
      toDelete.set(row.id, {
        id: row.id,
        reason: `synthetic_markers:${markers.join(',')}`,
        name: client.name,
        period: row.summary_date.slice(0, 7),
        spend: row.total_spend,
      });
    }
  }

  const list = [...toDelete.values()];
  if (list.length === 0) {
    console.log('No phantom rows to delete.');
    return;
  }

  console.log(`${APPLY ? 'DELETE' : 'DRY-RUN'} — ${list.length} phantom row(s):\n`);
  for (const item of list) {
    console.log(
      `  ${item.name} | ${item.period} | spend ${item.spend} | ${item.reason} | id ${item.id}`
    );
  }

  if (!APPLY) {
    console.log('\nRe-run with --apply to delete these rows.');
    return;
  }

  const ids = list.map((i) => i.id);
  const { error } = await supabase.from('campaign_summaries').delete().in('id', ids);
  if (error) {
    console.error('Delete failed:', error.message);
    process.exit(1);
  }

  console.log(`\nDeleted ${ids.length} phantom campaign_summaries row(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
