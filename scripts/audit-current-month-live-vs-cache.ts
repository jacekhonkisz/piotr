/**
 * Compare CURRENT month (July 2026) live API data vs stored smart-cache for all clients.
 * Meta:   current_month_cache.cache_data (stats + conversionMetrics)
 * Google: google_ads_current_month_cache.cache_data
 * Run: npx tsx scripts/audit-current-month-live-vs-cache.ts
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { MetaAPIServiceOptimized } from '../src/lib/meta-api-optimized';
import {
  aggregateConversionMetrics,
  enhanceCampaignsWithConversions,
} from '../src/lib/meta-actions-parser';
import { loadClientConversionMappings } from '../src/lib/client-conversion-mappings-server';

dotenv.config({ path: '.env.local' });

const now = new Date();
const YEAR = now.getFullYear();
const MONTH = now.getMonth() + 1;
const PERIOD_ID = `${YEAR}-${String(MONTH).padStart(2, '0')}`;
const START = `${PERIOD_ID}-01`;
const END = now.toISOString().slice(0, 10);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Totals = {
  spend: number;
  reservations: number;
  reservation_value: number;
  click_to_call: number;
  email_contacts: number;
  booking_step_1: number;
};

const METRICS: (keyof Totals)[] = [
  'spend',
  'reservations',
  'reservation_value',
  'click_to_call',
  'email_contacts',
  'booking_step_1',
];

function ageHours(iso: string | undefined): string {
  if (!iso) return 'n/a';
  const h = (Date.now() - new Date(iso).getTime()) / 36e5;
  return `${h.toFixed(1)}h ago`;
}

function diffMark(live: number, cached: number, isMoney: boolean): string {
  if (live === 0 && cached === 0) return '=';
  const tolerance = isMoney ? Math.max(1, live * 0.05) : Math.max(1, live * 0.05);
  return Math.abs(live - cached) <= tolerance ? '≈' : '❌';
}

function row(metric: string, live: number, cached: number) {
  const money = metric.includes('value') || metric === 'spend';
  const f = (v: number) => (money ? v.toFixed(2) : String(Math.round(v)));
  console.log(
    `      ${metric.padEnd(18)} LIVE ${f(live).padStart(12)} | CACHE ${f(cached).padStart(12)} ${diffMark(live, cached, money)}`
  );
}

async function liveMeta(client: any): Promise<Totals> {
  const token = client.system_user_token || client.meta_access_token;
  const service = new MetaAPIServiceOptimized(token);
  service.clearCache();
  const accountId = String(client.ad_account_id).replace(/^act_/, '');
  const raw = await service.getCampaignInsights(accountId, START, END, 0);
  const mappings = await loadClientConversionMappings(client.id);
  const campaigns = enhanceCampaignsWithConversions(raw, mappings);
  const agg = aggregateConversionMetrics(campaigns);
  const spend = campaigns.reduce((s: number, c: any) => s + (parseFloat(c.spend) || 0), 0);
  return {
    spend,
    reservations: agg.reservations,
    reservation_value: agg.reservation_value,
    click_to_call: agg.click_to_call,
    email_contacts: agg.email_contacts,
    booking_step_1: agg.booking_step_1,
  };
}

async function liveGoogle(client: any, settings: Record<string, string>): Promise<Totals> {
  const { GoogleAdsAPIService } = await import('../src/lib/google-ads-api');
  const mappings = await loadClientConversionMappings(client.id);
  const svc = new GoogleAdsAPIService({
    refreshToken: settings.google_ads_manager_refresh_token,
    clientId: settings.google_ads_client_id,
    clientSecret: settings.google_ads_client_secret,
    developmentToken: settings.google_ads_developer_token,
    customerId: client.google_ads_customer_id,
    managerCustomerId: settings.google_ads_manager_customer_id,
    conversionMappings: mappings,
  });
  const result = await svc.getCampaignData(START, END);
  const campaigns: any[] = result?.campaigns ?? result ?? [];
  return campaigns.reduce(
    (a, c) => ({
      spend: a.spend + (c.spend || 0),
      reservations: a.reservations + (c.reservations || 0),
      reservation_value: a.reservation_value + (c.reservation_value || 0),
      click_to_call: a.click_to_call + (c.click_to_call || 0),
      email_contacts: a.email_contacts + (c.email_contacts || 0),
      booking_step_1: a.booking_step_1 + (c.booking_step_1 || 0),
    }),
    { spend: 0, reservations: 0, reservation_value: 0, click_to_call: 0, email_contacts: 0, booking_step_1: 0 }
  );
}

function cachedTotals(cacheData: any): Totals {
  const cm = cacheData?.conversionMetrics || {};
  return {
    spend: Number(cacheData?.stats?.totalSpend || 0),
    reservations: Number(cm.reservations || 0),
    reservation_value: Number(cm.reservation_value || 0),
    click_to_call: Number(cm.click_to_call || 0),
    email_contacts: Number(cm.email_contacts || 0),
    booking_step_1: Number(cm.booking_step_1 || 0),
  };
}

async function main() {
  const { data: settingsRows } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', [
      'google_ads_client_id',
      'google_ads_client_secret',
      'google_ads_developer_token',
      'google_ads_manager_refresh_token',
      'google_ads_manager_customer_id',
    ]);
  const settings = Object.fromEntries((settingsRows || []).map((s) => [s.key, s.value]));

  const { data: clients } = await supabase
    .from('clients')
    .select(
      'id, name, ad_account_id, meta_access_token, system_user_token, google_ads_customer_id'
    )
    .order('name');

  console.log(`\n${'='.repeat(80)}`);
  console.log(`CURRENT MONTH (${PERIOD_ID}, ${START} → ${END}) — LIVE API vs SMART CACHE`);
  console.log(`${'='.repeat(80)}`);

  const problems: string[] = [];

  for (const client of clients || []) {
    console.log(`\n${client.name}`);

    if (client.ad_account_id && (client.system_user_token || client.meta_access_token)) {
      try {
        const live = await liveMeta(client);
        const { data: cacheRow } = await supabase
          .from('current_month_cache')
          .select('cache_data, last_updated')
          .eq('client_id', client.id)
          .eq('period_id', PERIOD_ID)
          .maybeSingle();
        console.log(`   META (cache ${ageHours(cacheRow?.last_updated)})`);
        if (!cacheRow) {
          console.log('      ⚠️  NO CACHE ROW');
          problems.push(`${client.name} Meta: no cache row`);
        } else {
          const cached = cachedTotals(cacheRow.cache_data);
          for (const m of METRICS) {
            row(m, live[m], cached[m]);
            if (diffMark(live[m], cached[m], m === 'spend' || m.includes('value')) === '❌') {
              problems.push(`${client.name} Meta ${m}: live ${live[m].toFixed(0)} vs cache ${cached[m].toFixed(0)}`);
            }
          }
        }
      } catch (e: any) {
        console.log(`   META error: ${e.message}`);
        problems.push(`${client.name} Meta: fetch error ${e.message}`);
      }
    }

    if (client.google_ads_customer_id) {
      try {
        const live = await liveGoogle(client, settings);
        const { data: cacheRow } = await supabase
          .from('google_ads_current_month_cache')
          .select('cache_data, last_updated')
          .eq('client_id', client.id)
          .eq('period_id', PERIOD_ID)
          .maybeSingle();
        console.log(`   GOOGLE (cache ${ageHours(cacheRow?.last_updated)})`);
        if (!cacheRow) {
          console.log('      ⚠️  NO CACHE ROW');
          problems.push(`${client.name} Google: no cache row`);
        } else {
          const cached = cachedTotals(cacheRow.cache_data);
          for (const m of METRICS) {
            row(m, live[m], cached[m]);
            if (diffMark(live[m], cached[m], m === 'spend' || m.includes('value')) === '❌') {
              problems.push(`${client.name} Google ${m}: live ${live[m].toFixed(0)} vs cache ${cached[m].toFixed(0)}`);
            }
          }
        }
      } catch (e: any) {
        console.log(`   GOOGLE error: ${e.message}`);
        problems.push(`${client.name} Google: fetch error ${e.message}`);
      }
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('LEGEND: = both zero | ≈ within 5% (cache naturally lags live) | ❌ divergent');
  console.log(`${'='.repeat(80)}`);
  if (problems.length === 0) {
    console.log('\n✅ All clients: current-month cache tracks live API within tolerance.');
  } else {
    console.log(`\n⚠️  ${problems.length} divergences:`);
    for (const p of problems) console.log(`   ❌ ${p}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
