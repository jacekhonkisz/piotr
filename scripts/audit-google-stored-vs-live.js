/* eslint-disable no-console */
/**
 * Audit: stored Google Ads summaries vs. what the Google Ads API actually reports.
 *
 * Run: node scripts/audit-google-stored-vs-live.js
 */
const fs = require('fs');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

const env = dotenv.parse(fs.readFileSync('.env.local'));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const API_VERSION = 'v22';
const PERIODS = [
  { label: '2026-06', start: '2026-06-01', end: '2026-06-30' },
  { label: '2026-07', start: '2026-07-01', end: '2026-07-31' },
];

async function getAccessToken(settings) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: settings.google_ads_client_id,
      client_secret: settings.google_ads_client_secret,
      refresh_token: settings.google_ads_manager_refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const json = await res.json();
  return json.access_token;
}

async function liveTotals({ token, devToken, managerId, customerId, period }) {
  const query = `SELECT campaign.id, metrics.cost_micros, metrics.impressions, metrics.clicks
    FROM campaign
    WHERE segments.date BETWEEN '${period.start}' AND '${period.end}'`;
  const res = await fetch(
    `https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/googleAds:searchStream`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'developer-token': devToken,
        'login-customer-id': managerId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    }
  );
  const text = await res.text();
  if (!res.ok) return { error: `HTTP ${res.status} ${text.replace(/\s+/g, ' ').slice(0, 120)}` };
  let batches;
  try {
    batches = JSON.parse(text);
  } catch {
    return { error: 'unparseable response' };
  }
  const rows = batches.flatMap((b) => b.results || []);
  return rows.reduce(
    (acc, r) => ({
      spend: acc.spend + Number(r.metrics?.costMicros || 0) / 1e6,
      impressions: acc.impressions + Number(r.metrics?.impressions || 0),
      clicks: acc.clicks + Number(r.metrics?.clicks || 0),
    }),
    { spend: 0, impressions: 0, clicks: 0 }
  );
}

const pct = (stored, live) => {
  if (!live) return stored ? 'n/a (live=0)' : '0%';
  return `${(((stored - live) / live) * 100).toFixed(0)}%`;
};
const num = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');

(async () => {
  const { data: settingsRows } = await supabase
    .from('system_settings')
    .select('key,value')
    .like('key', 'google_ads%');
  const settings = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));
  const token = await getAccessToken(settings);
  const managerId = String(settings.google_ads_manager_customer_id).replace(/-/g, '');

  const { data: clients } = await supabase
    .from('clients')
    .select('id,name,google_ads_customer_id')
    .order('name');

  const results = [];
  for (const client of clients) {
    if (!client.google_ads_customer_id) {
      results.push({ client: client.name, note: 'no google_ads_customer_id' });
      continue;
    }
    const customerId = client.google_ads_customer_id.replace(/-/g, '');
    for (const period of PERIODS) {
      const { data: stored } = await supabase
        .from('campaign_summaries')
        .select('total_spend,total_impressions,total_clicks,reservations,reservation_value,last_updated')
        .eq('client_id', client.id)
        .eq('platform', 'google')
        .eq('summary_type', 'monthly')
        .eq('summary_date', period.start)
        .maybeSingle();

      const live = await liveTotals({
        token,
        devToken: settings.google_ads_developer_token,
        managerId,
        customerId,
        period,
      });

      results.push({
        client: client.name,
        period: period.label,
        storedSpend: stored ? stored.total_spend : null,
        liveSpend: live.error ? null : live.spend,
        storedClicks: stored ? stored.total_clicks : null,
        liveClicks: live.error ? null : live.clicks,
        storedImpr: stored ? stored.total_impressions : null,
        liveImpr: live.error ? null : live.impressions,
        lastUpdated: stored?.last_updated || null,
        error: live.error || null,
      });
    }
  }

  console.log(
    ['client', 'period', 'stored_spend', 'live_spend', 'spend_diff', 'stored_clicks', 'live_clicks', 'stored_impr', 'live_impr', 'last_updated', 'error'].join(' | ')
  );
  for (const r of results) {
    if (r.note) {
      console.log(`${r.client} | ${r.note}`);
      continue;
    }
    console.log(
      [
        r.client,
        r.period,
        r.storedSpend === null ? 'MISSING' : num(r.storedSpend),
        r.liveSpend === null ? '-' : num(r.liveSpend),
        r.storedSpend === null || r.liveSpend === null ? '-' : pct(r.storedSpend, r.liveSpend),
        r.storedClicks === null ? 'MISSING' : num(r.storedClicks),
        r.liveClicks === null ? '-' : num(r.liveClicks),
        r.storedImpr === null ? 'MISSING' : num(r.storedImpr),
        r.liveImpr === null ? '-' : num(r.liveImpr),
        r.lastUpdated ? String(r.lastUpdated).slice(0, 19) : '-',
        r.error || '',
      ].join(' | ')
    );
  }
})();
