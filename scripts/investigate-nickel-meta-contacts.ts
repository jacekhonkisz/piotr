/**
 * Deep investigation: Nickel Meta phones/emails mismatch (June 2026).
 * Run: npx tsx scripts/investigate-nickel-meta-contacts.ts
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { MetaAPIServiceOptimized } from '../src/lib/meta-api-optimized';
import {
  parseMetaActions,
  selectMetaPhoneClicks,
  enhanceCampaignsWithConversions,
  aggregateConversionMetrics,
} from '../src/lib/meta-actions-parser';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function buildActionMap(actions: any[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const a of actions || []) {
    const t = String(a.action_type || '').toLowerCase();
    const v = parseInt(String(a.value || '0'), 10);
    if (!isNaN(v) && v >= 0) map.set(t, (map.get(t) || 0) + v);
  }
  return map;
}

/** Old buggy parser: sum ALL click_to_call_* subtypes */
function oldSumPhoneSubtypes(actionMap: Map<string, number>): number {
  let sum = 0;
  for (const [t, v] of actionMap) {
    if (t.startsWith('click_to_call_') || t === 'phone_number_clicks' || t === 'call_confirm_grouped') {
      sum += v;
    }
  }
  return sum;
}

async function graphGet(token: string, path: string): Promise<any> {
  const base = `https://graph.facebook.com/v21.0/${path}`;
  const sep = path.includes('?') ? '&' : '?';
  const url = `${base}${sep}access_token=${token}`;
  const res = await fetch(url);
  return res.json();
}

async function fetchInsightsWithActions(
  token: string,
  accountId: string,
  start: string,
  end: string,
  extra = ''
): Promise<any[]> {
  const fields =
    'campaign_id,campaign_name,spend,actions,action_values,cost_per_action_type,conversions';
  const params = new URLSearchParams({
    level: 'campaign',
    time_range: JSON.stringify({ since: start, until: end }),
    fields,
    limit: '500',
    access_token: token,
  });
  if (extra) {
    for (const part of extra.split('&').filter(Boolean)) {
      const [k, v] = part.split('=');
      params.set(k, v);
    }
  }
  const url = `https://graph.facebook.com/v21.0/act_${accountId}/insights?${params}`;
  const all: any[] = [];
  let next: string | null = url;
  while (next) {
    const res = await fetch(next);
    const json = await res.json();
    if (json.error) throw new Error(JSON.stringify(json.error));
    all.push(...(json.data || []));
    next = json.paging?.next || null;
  }
  return all;
}

async function main() {
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .ilike('name', '%nickel%')
    .single();
  if (!client) throw new Error('Nickel client not found');

  const token = client.system_user_token || client.meta_access_token;
  const accountId = String(client.ad_account_id).replace(/^act_/, '');

  console.log('='.repeat(80));
  console.log('NICKEL META CONTACT INVESTIGATION');
  console.log('='.repeat(80));
  console.log(`Client: ${client.name}`);
  console.log(`Ad account: act_${accountId}`);
  console.log(`Client ID: ${client.id}`);

  // 1. DB history
  const { data: history } = await supabase
    .from('campaign_summaries')
    .select('summary_date,click_to_call,email_contacts,reservations,data_source,last_updated')
    .eq('client_id', client.id)
    .eq('platform', 'meta')
    .eq('summary_type', 'monthly')
    .gte('summary_date', '2025-06-01')
    .order('summary_date', { ascending: true });

  console.log('\n--- DB monthly history (phones / emails) ---');
  for (const row of history || []) {
    console.log(
      `  ${row.summary_date}: tel=${row.click_to_call} email=${row.email_contacts} res=${row.reservations} [${row.data_source}]`
    );
  }

  // 2. Custom conversions on account
  console.log('\n--- Custom conversions (Graph API) ---');
  const customConv = await graphGet(token, `act_${accountId}/customconversions?fields=id,name,rule,pixel,creation_time&limit=100`);
  if (customConv.error) {
    console.log('  Error:', customConv.error.message);
  } else {
    for (const cc of customConv.data || []) {
      const rule = typeof cc.rule === 'string' ? cc.rule : JSON.stringify(cc.rule);
      const isContact = /call|phone|email|mail|contact|tel/i.test(cc.name + rule);
      console.log(`  ${isContact ? '★' : ' '} ${cc.id} | ${cc.name}`);
      if (isContact) console.log(`      rule: ${rule.slice(0, 200)}`);
    }
  }

  // 3. Compare months: May vs June 2026
  const periods = [
    ['2026-05-01', '2026-05-31', 'May 2026'],
    ['2026-06-01', '2026-06-30', 'June 2026'],
    ['2025-11-01', '2025-11-30', 'Nov 2025 (had email=6 in DB)'],
  ];

  for (const [start, end, label] of periods) {
    console.log(`\n--- ${label} live API ---`);
    const service = new MetaAPIServiceOptimized(token);
    service.clearCache();
    const raw = await service.getCampaignInsights(accountId, start, end, 0);
    const campaigns = enhanceCampaignsWithConversions(raw);
    const totals = aggregateConversionMetrics(campaigns);

    const accountMap = new Map<string, number>();
    for (const c of raw) {
      for (const a of c.actions || []) {
        const t = String(a.action_type || '').toLowerCase();
        const v = parseInt(String(a.value || '0'), 10);
        if (!isNaN(v) && v >= 0) accountMap.set(t, (accountMap.get(t) || 0) + v);
      }
    }

    const clickToCallTypes = [...accountMap.entries()]
      .filter(([t]) => /click_to_call|phone|call_confirm|1470262077092668/i.test(t))
      .sort((a, b) => b[1] - a[1]);
    const emailTypes = [...accountMap.entries()]
      .filter(([t]) => /email|mail|2770488499782793|contact/i.test(t))
      .sort((a, b) => b[1] - a[1]);
    const customTypes = [...accountMap.entries()]
      .filter(([t]) => t.includes('offsite_conversion.custom'))
      .sort((a, b) => b[1] - a[1]);

    console.log(`  Parser: tel=${totals.click_to_call} email=${totals.email_contacts}`);
    console.log(`  Old sum click_to_call_*: ${oldSumPhoneSubtypes(accountMap)}`);
    console.log(`  selectMetaPhoneClicks: ${selectMetaPhoneClicks(accountMap)}`);
    console.log(`  Campaigns: ${raw.length}`);

    console.log('  click_to_call / phone types:', clickToCallTypes.map(([t, v]) => `${t}=${v}`).join(', ') || 'NONE');
    console.log('  email types:', emailTypes.map(([t, v]) => `${t}=${v}`).join(', ') || 'NONE');
    console.log('  custom offsite events:', customTypes.map(([t, v]) => `${t}=${v}`).join(', ') || 'NONE');

    // Per-campaign with any phone/email signal
    const withSignal = campaigns.filter(
      (c: any) =>
        c.click_to_call > 0 ||
        c.email_contacts > 0 ||
        oldSumPhoneSubtypes(buildActionMap(c.actions || [])) > 0
    );
    if (withSignal.length) {
      console.log('  Campaigns with contact signal:');
      for (const c of withSignal) {
        const cmap = buildActionMap(c.actions || []);
        console.log(
          `    ${c.campaign_name}: parser tel=${c.click_to_call} email=${c.email_contacts} oldSum=${oldSumPhoneSubtypes(cmap)}`
        );
        for (const [t, v] of [...cmap.entries()].filter(([t]) =>
          /click_to_call|phone|email|mail|custom\.|messaging/i.test(t)
        )) {
          console.log(`      ${t}=${v}`);
        }
      }
    }
  }

  // 4. Try attribution variants for June
  console.log('\n--- June 2026 attribution / field variants ---');
  const variants = [
    ['default unified', 'use_unified_attribution_setting=true'],
    ['7d_click', 'action_attribution_windows=["7d_click"]&use_unified_attribution_setting=true'],
    ['28d_click', 'action_attribution_windows=["28d_click"]&use_unified_attribution_setting=true'],
    ['1d_view', 'action_attribution_windows=["1d_view"]&use_unified_attribution_setting=true'],
  ];
  for (const [label, extra] of variants) {
    try {
      const raw = await fetchInsightsWithActions(token, accountId, '2026-06-01', '2026-06-30', extra);
      const accountMap = new Map<string, number>();
      for (const c of raw) {
        for (const a of c.actions || []) {
          const t = String(a.action_type || '').toLowerCase();
          const v = parseInt(String(a.value || '0'), 10);
          if (!isNaN(v) && v >= 0) accountMap.set(t, (accountMap.get(t) || 0) + v);
        }
      }
      const phones = selectMetaPhoneClicks(accountMap);
      const oldSum = oldSumPhoneSubtypes(accountMap);
      const emails = parseMetaActions(
        [...accountMap.entries()].map(([action_type, value]) => ({ action_type, value: String(value) }))
      ).email_contacts;
      console.log(
        `  ${label}: campaigns=${raw.length} placed=${phones} oldSum=${oldSum} email=${emails}`
      );
    } catch (e: any) {
      console.log(`  ${label}: ERROR ${e.message?.slice(0, 120)}`);
    }
  }

  // 5. Account-level insights WITH actions
  console.log('\n--- Account-level June insights (with actions) ---');
  const acctUrl = new URL(`https://graph.facebook.com/v21.0/act_${accountId}/insights`);
  acctUrl.searchParams.set('level', 'account');
  acctUrl.searchParams.set('time_range', JSON.stringify({ since: '2026-06-01', until: '2026-06-30' }));
  acctUrl.searchParams.set(
    'fields',
    'actions,action_values,cost_per_action_type,conversions'
  );
  acctUrl.searchParams.set('use_unified_attribution_setting', 'true');
  acctUrl.searchParams.set('access_token', token);
  const acctRes = await fetch(acctUrl);
  const acctJson = await acctRes.json();
  if (acctJson.error) {
    console.log('  Error:', acctJson.error.message);
  } else {
    const actions = acctJson.data?.[0]?.actions || [];
    const contactActions = actions.filter((a: any) =>
      /call|phone|email|mail|contact|click_to_call|custom\./i.test(String(a.action_type))
    );
    console.log(`  Total action types: ${actions.length}`);
    console.log('  Contact-related account actions:');
    for (const a of contactActions.sort((x: any, y: any) => Number(y.value) - Number(x.value))) {
      console.log(`    ${a.action_type} = ${a.value}`);
    }
    const costPer = acctJson.data?.[0]?.cost_per_action_type || [];
    const contactCost = costPer.filter((a: any) =>
      /call|phone|email|mail|click_to_call/i.test(String(a.action_type))
    );
    if (contactCost.length) {
      console.log('  cost_per_action_type (contact):');
      for (const a of contactCost) console.log(`    ${a.action_type}`);
    }
  }

  // 6. Compare Pinea custom events (reference account with working phones)
  console.log('\n--- Reference: Pinea custom events (working phone account) ---');
  const { data: pinea } = await supabase
    .from('clients')
    .select('ad_account_id, system_user_token, meta_access_token')
    .ilike('name', '%pinea%')
    .single();
  if (pinea) {
    const pToken = pinea.system_user_token || pinea.meta_access_token;
    const pId = String(pinea.ad_account_id).replace(/^act_/, '');
    const pService = new MetaAPIServiceOptimized(pToken);
    pService.clearCache();
    const pRaw = await pService.getCampaignInsights(pId, '2026-06-01', '2026-06-30', 0);
    const pMap = new Map<string, number>();
    for (const c of pRaw) {
      for (const a of c.actions || []) {
        const t = String(a.action_type || '').toLowerCase();
        const v = parseInt(String(a.value || '0'), 10);
        if (!isNaN(v) && v >= 0) pMap.set(t, (pMap.get(t) || 0) + v);
      }
    }
    const pCustom = [...pMap.entries()].filter(([t]) => t.includes('offsite_conversion.custom'));
    console.log('  Pinea custom events:', pCustom.map(([t, v]) => `${t}=${v}`).join(', ') || 'none');
    const nCustom = await (async () => {
      const service = new MetaAPIServiceOptimized(token);
      service.clearCache();
      const raw = await service.getCampaignInsights(accountId, '2026-06-01', '2026-06-30', 0);
      const map = new Map<string, number>();
      for (const c of raw) {
        for (const a of c.actions || []) {
          const t = String(a.action_type || '').toLowerCase();
          const v = parseInt(String(a.value || '0'), 10);
          if (!isNaN(v) && v >= 0) map.set(t, (map.get(t) || 0) + v);
        }
      }
      return [...map.entries()].filter(([t]) => t.includes('offsite_conversion.custom'));
    })();
    console.log('  Nickel custom events:', nCustom.map(([t, v]) => `${t}=${v}`).join(', ') || 'NONE');
  }

  // 7. Hypothesis: client reads cost_per_action_type or a Polish Ads Manager column
  console.log('\n--- June cost_per_action_type per campaign (contact-related) ---');
  const juneRaw = await fetchInsightsWithActions(token, accountId, '2026-06-01', '2026-06-30', 'use_unified_attribution_setting=true');
  for (const c of juneRaw) {
    const cpa = (c.cost_per_action_type || []).filter((a: any) =>
      /call|phone|email|mail|click_to_call|contact/i.test(String(a.action_type))
    );
    if (cpa.length) {
      console.log(`  ${c.campaign_name}:`);
      for (const a of cpa) console.log(`    ${a.action_type}`);
    }
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
