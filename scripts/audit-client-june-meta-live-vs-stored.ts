import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { MetaAPIServiceOptimized } from '../src/lib/meta-api-optimized';
import {
  aggregateConversionMetrics,
  enhanceCampaignsWithConversions,
} from '../src/lib/meta-actions-parser';
import { loadClientConversionMappings } from '../src/lib/client-conversion-mappings-server';

const START = '2026-06-01';
const END = '2026-06-30';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  let clientQuery = supabase
    .from('clients')
    .select('id, name, ad_account_id, meta_access_token, system_user_token');
  clientQuery = process.env.CLIENT_FILTER
    ? clientQuery.ilike('name', `%${process.env.CLIENT_FILTER}%`)
    : clientQuery.or('name.ilike.%pinea%,name.ilike.%nickel%,name.ilike.%arche%');
  const { data: clients, error } = await clientQuery;
  if (error) throw error;

  for (const client of clients || []) {
    const token = client.system_user_token || client.meta_access_token;
    if (!token || !client.ad_account_id) continue;

    const service = new MetaAPIServiceOptimized(token);
    service.clearCache();
    const accountId = client.ad_account_id.replace(/^act_/, '');
    const raw = await service.getCampaignInsights(accountId, START, END, 0);
    const mappings = await loadClientConversionMappings(client.id);
    const campaigns = enhanceCampaignsWithConversions(raw, mappings);
    const live = aggregateConversionMetrics(campaigns);

    const { data: stored } = await supabase
      .from('campaign_summaries')
      .select(
        'booking_step_1, booking_step_2, booking_step_3, click_to_call, email_contacts, reservations, reservation_value, last_updated, data_source'
      )
      .eq('client_id', client.id)
      .eq('platform', 'meta')
      .eq('summary_type', 'monthly')
      .eq('summary_date', START)
      .maybeSingle();

    const contactActions = Array.from(
      new Set(
        raw.flatMap((campaign: any) =>
          (campaign.actions || [])
            .map((action: any) => String(action.action_type || ''))
            .filter((type: string) =>
              /call|phone|email|contact|lead|1470262077092668|2770488499782793/i.test(type)
            )
        )
      )
    ).sort();
    const actionTotals = new Map<string, number>();
    for (const campaign of raw) {
      for (const action of campaign.actions || []) {
        const type = String(action.action_type || '');
        actionTotals.set(type, (actionTotals.get(type) || 0) + Number(action.value || 0));
      }
    }
    const contactActionTotals = Array.from(actionTotals.entries())
      .filter(([type]) =>
        /call|phone|email|contact|lead|message|1470262077092668|2770488499782793/i.test(type)
      )
      .sort(([left], [right]) => left.localeCompare(right));

    console.log(`\n${client.name}`);
    console.log(
      `  LIVE: ${live.booking_step_1} → ${live.booking_step_2} → ${live.booking_step_3} → ${live.reservations} | tel ${live.click_to_call} | e-mail ${live.email_contacts} | value ${live.reservation_value.toFixed(2)}`
    );
    console.log(
      `  DB  : ${stored?.booking_step_1 || 0} → ${stored?.booking_step_2 || 0} → ${stored?.booking_step_3 || 0} → ${stored?.reservations || 0} | tel ${stored?.click_to_call || 0} | e-mail ${stored?.email_contacts || 0} | value ${Number(stored?.reservation_value || 0).toFixed(2)}`
    );
    console.log(`  Stored: ${stored?.data_source || 'missing'} @ ${stored?.last_updated || 'n/a'}`);
    console.log(`  Contact action types: ${contactActions.join(', ') || 'none'}`);
    console.log(
      `  Contact action totals: ${contactActionTotals.map(([type, value]) => `${type}=${value}`).join(', ') || 'none'}`
    );
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
