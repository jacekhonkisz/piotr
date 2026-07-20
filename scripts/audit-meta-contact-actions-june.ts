/**
 * Dump every Meta action_type that could map to phone/email for Pinea, Nickel, Arche (June 2026).
 * Run: npx tsx scripts/audit-meta-contact-actions-june.ts
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { MetaAPIServiceOptimized } from '../src/lib/meta-api-optimized';
import {
  selectMetaPhoneClicks,
  parseMetaActions,
  sumMetaFormConversionActions,
} from '../src/lib/meta-actions-parser';

dotenv.config({ path: '.env.local' });

const START = '2026-06-01';
const END = '2026-06-30';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Client-reported expected values from July 2026 feedback emails */
const CLIENT_EXPECTED: Record<string, { phones?: number; emails?: number }> = {
  'Pinea Resort Pobierowo': { phones: 19 },
  'Nickel Resort Grzybowo': { phones: 7, emails: 3 },
  'Arche Nałęczów': { phones: 11 },
};

function buildActionMap(actions: any[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const a of actions || []) {
    const t = String(a.action_type || '').toLowerCase();
    const v = parseInt(String(a.value || '0'), 10);
    if (!isNaN(v) && v >= 0) map.set(t, (map.get(t) || 0) + v);
  }
  return map;
}

function phoneCandidates(map: Map<string, number>): Array<{ type: string; value: number }> {
  return Array.from(map.entries())
    .filter(([t]) =>
      /call|phone|1470262077092668|click_to_call|messaging|contact|lead/i.test(t)
    )
    .map(([type, value]) => ({ type, value }))
    .sort((a, b) => b.value - a.value);
}

function emailCandidates(map: Map<string, number>): Array<{ type: string; value: number }> {
  return Array.from(map.entries())
    .filter(([t]) =>
      /email|mail|2770488499782793|lead|contact|message|messaging/i.test(t)
    )
    .map(([type, value]) => ({ type, value }))
    .sort((a, b) => b.value - a.value);
}

async function main() {
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, ad_account_id, meta_access_token, system_user_token')
    .or('name.ilike.%pinea%,name.ilike.%nickel%,name.ilike.%arche nałęczów%');

  for (const client of clients || []) {
    const token = client.system_user_token || client.meta_access_token;
    if (!token || !client.ad_account_id) continue;

    const service = new MetaAPIServiceOptimized(token);
    service.clearCache();
    const accountId = client.ad_account_id.replace(/^act_/, '');
    const campaigns = await service.getCampaignInsights(accountId, START, END, 0);

    const accountMap = new Map<string, number>();
    for (const c of campaigns) {
      for (const a of c.actions || []) {
        const t = String(a.action_type || '').toLowerCase();
        const v = parseInt(String(a.value || '0'), 10);
        if (!isNaN(v) && v >= 0) {
          accountMap.set(t, (accountMap.get(t) || 0) + v);
        }
      }
    }

    const parsed = parseMetaActions(
      Array.from(accountMap.entries()).map(([action_type, value]) => ({
        action_type,
        value: String(value),
      }))
    );

    const expected = CLIENT_EXPECTED[client.name];

    console.log('\n' + '='.repeat(72));
    console.log(client.name);
    if (expected) {
      console.log(
        `  Client expects: phones=${expected.phones ?? '?'} | emails=${expected.emails ?? '?'}`
      );
    }
    console.log(`  Parser output:  phones=${parsed.click_to_call} | emails=${parsed.email_contacts}`);
    console.log(`  selectMetaPhoneClicks (account map): ${selectMetaPhoneClicks(accountMap)}`);

    // Priority breakdown for phones
    const phonePriority = [
      'click_to_call_native_call_placed',
      'click_to_call_call_confirm',
      'call_confirm_grouped',
      'click_to_call_native_20s_call_connect',
      'click_to_call_native_60s_call_connect',
      'offsite_conversion.custom.1470262077092668',
    ];
    console.log('  Phone priority candidates:');
    for (const key of phonePriority) {
      const v = accountMap.get(key);
      if (v) console.log(`    ${key} = ${v}`);
    }

    console.log('  All phone-related action types (account total):');
    for (const { type, value } of phoneCandidates(accountMap)) {
      console.log(`    ${type} = ${value}`);
    }

    console.log('  All email-related action types (account total):');
    for (const { type, value } of emailCandidates(accountMap)) {
      console.log(`    ${type} = ${value}`);
    }

    // Custom offsite events (often PBM website tracking)
    const customEvents = Array.from(accountMap.entries())
      .filter(([t]) => t.includes('offsite_conversion.custom'))
      .sort((a, b) => b[1] - a[1]);
    if (customEvents.length) {
      console.log('  Custom offsite_conversion events:');
      for (const [type, value] of customEvents) {
        console.log(`    ${type} = ${value}`);
      }
    }

    // Lead / form (excluded from headline but may be what client counts as email)
    const formSum = sumMetaFormConversionActions(
      Array.from(accountMap.entries()).map(([action_type, value]) => ({
        action_type,
        value: String(value),
      }))
    );
    if (formSum > 0) console.log(`  Form/lead actions (parser excludes): ${formSum}`);

    // Per-campaign: only campaigns with any phone/email signal
    console.log('  Per-campaign contact signals:');
    for (const c of campaigns) {
      const cmap = buildActionMap(c.actions || []);
      const phones = selectMetaPhoneClicks(cmap);
      const cparsed = parseMetaActions(c.actions || [], c.action_values || [], c.campaign_name);
      if (phones > 0 || cparsed.email_contacts > 0 || phoneCandidates(cmap).length > 0) {
        console.log(`    ${c.campaign_name}`);
        console.log(`      parser tel=${cparsed.click_to_call} email=${cparsed.email_contacts}`);
        for (const { type, value } of phoneCandidates(cmap).slice(0, 6)) {
          console.log(`      ${type}=${value}`);
        }
      }
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
