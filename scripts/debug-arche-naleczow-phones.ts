/**
 * Dump Arche Nałęczów June 2026 per-campaign Meta phone-related entries
 * from actions[] and conversions[] to locate the 12-vs-11 discrepancy.
 * Run: npx tsx scripts/debug-arche-naleczow-phones.ts
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { MetaAPIServiceOptimized } from '../src/lib/meta-api-optimized';
import { enhanceCampaignsWithConversions } from '../src/lib/meta-actions-parser';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const START = '2026-06-01';
const END = '2026-06-30';

const PHONEISH = /click_to_call|phone|telefon|call/i;

async function main() {
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, ad_account_id, meta_access_token, system_user_token')
    .ilike('name', '%nałęczów%')
    .maybeSingle();
  if (!client) throw new Error('client not found');

  const token = client.system_user_token || client.meta_access_token;
  const service = new MetaAPIServiceOptimized(token);
  service.clearCache();
  const accountId = String(client.ad_account_id).replace(/^act_/, '');
  const raw = await service.getCampaignInsights(accountId, START, END, 0);

  console.log(`\n${client.name} — ${raw.length} campaigns, June 2026\n`);

  for (const c of raw) {
    const actions = (c.actions || []).filter((a: any) => PHONEISH.test(String(a.action_type)));
    const conversions = (c.conversions || []).filter((a: any) =>
      PHONEISH.test(String(a.action_type))
    );
    if (actions.length === 0 && conversions.length === 0) continue;
    console.log(`Campaign: ${c.campaign_name || c.name}`);
    for (const a of actions) console.log(`  actions[]      ${a.action_type} = ${a.value}`);
    for (const a of conversions) console.log(`  conversions[]  ${a.action_type} = ${a.value}`);
  }

  const enhanced = enhanceCampaignsWithConversions(raw);
  console.log('\nParser output per campaign:');
  let total = 0;
  for (const c of enhanced) {
    if (c.click_to_call > 0) {
      console.log(`  ${c.campaign_name || c.name}: click_to_call = ${c.click_to_call}`);
      total += c.click_to_call;
    }
  }
  console.log(`\nTOTAL click_to_call = ${total} (client expects 11)`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
