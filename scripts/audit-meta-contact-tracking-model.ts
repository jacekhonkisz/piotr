/**
 * Audit all Meta clients: contact metrics in actions[] vs conversions[].
 * Run: npx tsx scripts/audit-meta-contact-tracking-model.ts [start] [end]
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  parseMetaActions,
  enhanceCampaignsWithConversions,
  aggregateConversionMetrics,
  extractMetaContactFromConversions,
} from '../src/lib/meta-actions-parser';

dotenv.config({ path: '.env.local' });

const START = process.argv[2] || '2026-06-01';
const END = process.argv[3] || '2026-06-30';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function graphGet(token: string, path: string): Promise<any> {
  const url = `https://graph.facebook.com/v21.0/${path}${path.includes('?') ? '&' : '?'}access_token=${token}`;
  const res = await fetch(url);
  return res.json();
}

async function fetchAccountInsights(token: string, accountId: string) {
  const path =
    `act_${accountId}/insights?level=account&time_range=${encodeURIComponent(
      JSON.stringify({ since: START, until: END })
    )}` +
    '&fields=actions,conversions&use_unified_attribution_setting=true';
  const json = await graphGet(token, path);
  if (json.error) throw new Error(json.error.message);
  return json.data?.[0] || { actions: [], conversions: [] };
}

type TrackingModel =
  | 'call_ads_actions'
  | 'pixel_conversions'
  | 'both'
  | 'none'
  | 'error'
  | 'no_token';

function classify(actions: any[], conversions: any[]): TrackingModel {
  const actionMap = new Map<string, number>();
  for (const a of actions || []) {
    const t = String(a.action_type || '').toLowerCase();
    const v = parseInt(String(a.value || '0'), 10);
    if (!isNaN(v) && v >= 0) actionMap.set(t, (actionMap.get(t) || 0) + v);
  }

  const fromActions = parseMetaActions(actions || [], [], 'audit');
  const fromConversions = extractMetaContactFromConversions(conversions || []);

  const hasCallAds =
    fromActions.click_to_call > 0 ||
    [...actionMap.keys()].some((t) => t.startsWith('click_to_call_'));
  const hasPixelContacts =
    fromConversions.click_to_call > 0 || fromConversions.email_contacts > 0;

  if (hasCallAds && hasPixelContacts) return 'both';
  if (hasCallAds) return 'call_ads_actions';
  if (hasPixelContacts) return 'pixel_conversions';
  return 'none';
}

async function main() {
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, ad_account_id, meta_access_token, system_user_token')
    .not('ad_account_id', 'is', null)
    .order('name');
  if (error) throw error;

  const rows: Array<{
    name: string;
    model: TrackingModel;
    actionsPhone: number;
    actionsEmail: number;
    convPhone: number;
    convEmail: number;
    parserBefore: number;
    parserAfter: number;
    gap: boolean;
  }> = [];

  for (const client of clients || []) {
    const token = client.system_user_token || client.meta_access_token;
    if (!token) {
      rows.push({
        name: client.name,
        model: 'no_token',
        actionsPhone: 0,
        actionsEmail: 0,
        convPhone: 0,
        convEmail: 0,
        parserBefore: 0,
        parserAfter: 0,
        gap: false,
      });
      continue;
    }

    try {
      const accountId = String(client.ad_account_id).replace(/^act_/, '');
      const insight = await fetchAccountInsights(token, accountId);
      const actions = insight.actions || [];
      const conversions = insight.conversions || [];

      const before = parseMetaActions(actions, [], client.name);
      const convContact = extractMetaContactFromConversions(conversions);
      const model = classify(actions, conversions);

      const enhanced = aggregateConversionMetrics(
        enhanceCampaignsWithConversions([
          {
            campaign_name: client.name,
            actions,
            action_values: [],
            conversions,
          },
        ])
      );

      const gap =
        (convContact.click_to_call > 0 && before.click_to_call === 0) ||
        (convContact.email_contacts > 0 && before.email_contacts === 0);

      rows.push({
        name: client.name,
        model,
        actionsPhone: before.click_to_call,
        actionsEmail: before.email_contacts,
        convPhone: convContact.click_to_call,
        convEmail: convContact.email_contacts,
        parserBefore: before.click_to_call + before.email_contacts,
        parserAfter: enhanced.click_to_call + enhanced.email_contacts,
        gap,
      });
    } catch (e: any) {
      rows.push({
        name: client.name,
        model: 'error',
        actionsPhone: 0,
        actionsEmail: 0,
        convPhone: 0,
        convEmail: 0,
        parserBefore: 0,
        parserAfter: 0,
        gap: false,
      });
      console.error(client.name, e.message);
    }
  }

  console.log(`\nMeta contact tracking audit (${START} → ${END})\n`);
  console.log(
    'Model legend: call_ads_actions = click_to_call in actions[] | pixel_conversions = PBM pixel in conversions[] | both | none\n'
  );

  const byModel = new Map<TrackingModel, number>();
  for (const r of rows) byModel.set(r.model, (byModel.get(r.model) || 0) + 1);

  console.log('Summary by model:');
  for (const [model, count] of [...byModel.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${model}: ${count}`);
  }

  const affected = rows.filter((r) => r.gap);
  console.log(`\nClients with contact data ONLY in conversions[] (parser gap): ${affected.length}`);
  for (const r of affected) {
    console.log(
      `  ${r.name} | model=${r.model} | actions tel=${r.actionsPhone} email=${r.actionsEmail} | conversions tel=${r.convPhone} email=${r.convEmail}`
    );
  }

  console.log('\nAll clients with any contact signal:');
  for (const r of rows.filter(
    (x) =>
      x.model !== 'no_token' &&
      x.model !== 'error' &&
      (x.actionsPhone ||
        x.actionsEmail ||
        x.convPhone ||
        x.convEmail ||
        x.parserBefore ||
        x.parserAfter)
  )) {
    console.log(
      `  ${r.name.padEnd(42)} ${r.model.padEnd(20)} actions ${r.actionsPhone}/${r.actionsEmail}  conv ${r.convPhone}/${r.convEmail}${r.gap ? '  ← FIX' : ''}`
    );
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
