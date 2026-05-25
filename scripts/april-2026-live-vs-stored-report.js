#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
const PERIOD = { start: '2026-04-01', end: '2026-04-30', summaryDate: '2026-04-01' };

const ADMIN_CANDIDATES = [
  { email: 'admin@example.com', password: 'password123' },
  { email: 'jac.honkisz@gmail.com', password: 'v&6uP*1UqTQN' }
];

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pctDiff(live, stored) {
  const denom = Math.max(Math.abs(live), Math.abs(stored), 1);
  return (Math.abs(live - stored) / denom) * 100;
}

function metricDiff(metricName, live, stored) {
  return {
    metric: metricName,
    live: number(live),
    stored: number(stored),
    delta: number(live) - number(stored),
    pctDiff: pctDiff(number(live), number(stored))
  };
}

async function getAccessToken() {
  for (const candidate of ADMIN_CANDIDATES) {
    const { data, error } = await supabaseAuth.auth.signInWithPassword(candidate);
    if (!error && data?.session?.access_token) {
      return data.session.access_token;
    }
  }
  throw new Error('Could not obtain an authenticated access token for API calls.');
}

async function fetchLive(endpoint, accessToken, body) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }

  return {
    ok: response.ok,
    status: response.status,
    body: parsed
  };
}

async function run() {
  console.log('Starting April 2026 live vs stored audit...');

  const accessToken = await getAccessToken();
  console.log('Authenticated successfully.');

  const { data: clients, error: clientError } = await supabaseAdmin
    .from('clients')
    .select('id,name,email,ad_account_id,meta_access_token,google_ads_customer_id,google_ads_enabled')
    .order('name');

  if (clientError) {
    throw clientError;
  }

  const relevantClients = (clients || []).filter((c) => {
    const hasMeta = !!(c.ad_account_id && c.meta_access_token);
    const hasGoogle = !!(c.google_ads_customer_id && c.google_ads_enabled);
    return hasMeta || hasGoogle;
  });

  const results = [];

  for (const client of relevantClients) {
    const clientResult = {
      clientId: client.id,
      clientName: client.name,
      clientEmail: client.email,
      meta: null,
      google: null
    };

    const hasMeta = !!(client.ad_account_id && client.meta_access_token);
    if (hasMeta) {
      const live = await fetchLive('/api/fetch-live-data', accessToken, {
        clientId: client.id,
        dateRange: { start: PERIOD.start, end: PERIOD.end },
        platform: 'meta',
        forceFresh: true,
        bypassAllCache: true,
        reason: 'april-2026-live-vs-stored-audit'
      });

      const { data: stored } = await supabaseAdmin
        .from('campaign_summaries')
        .select('*')
        .eq('client_id', client.id)
        .eq('platform', 'meta')
        .eq('summary_type', 'monthly')
        .eq('summary_date', PERIOD.summaryDate)
        .maybeSingle();

      clientResult.meta = { live, stored };
    }

    const hasGoogle = !!(client.google_ads_customer_id && client.google_ads_enabled);
    if (hasGoogle) {
      const live = await fetchLive('/api/fetch-google-ads-live-data', accessToken, {
        clientId: client.id,
        dateRange: { start: PERIOD.start, end: PERIOD.end },
        forceFresh: true,
        bypassAllCache: true,
        reason: 'april-2026-live-vs-stored-audit'
      });

      const { data: stored } = await supabaseAdmin
        .from('campaign_summaries')
        .select('*')
        .eq('client_id', client.id)
        .eq('platform', 'google')
        .eq('summary_type', 'monthly')
        .eq('summary_date', PERIOD.summaryDate)
        .maybeSingle();

      clientResult.google = { live, stored };
    }

    results.push(clientResult);
    console.log(`Processed ${client.name}`);
  }

  const analyzed = results.map((r) => {
    function analyzePlatform(platformData, platformName) {
      if (!platformData) return null;
      const liveOk = platformData.live.ok;
      const liveData = platformData.live.body?.data || {};
      const liveStats = liveData.stats || {};
      const liveConv = liveData.conversionMetrics || {};
      const stored = platformData.stored || {};

      const diffs = liveOk && stored
        ? [
            metricDiff('total_spend', liveStats.totalSpend, stored.total_spend),
            metricDiff('total_impressions', liveStats.totalImpressions, stored.total_impressions),
            metricDiff('total_clicks', liveStats.totalClicks, stored.total_clicks),
            metricDiff('total_conversions', liveStats.totalConversions, stored.total_conversions),
            metricDiff('click_to_call', liveConv.click_to_call, stored.click_to_call),
            metricDiff('email_contacts', liveConv.email_contacts, stored.email_contacts),
            metricDiff('booking_step_1', liveConv.booking_step_1, stored.booking_step_1),
            metricDiff('booking_step_2', liveConv.booking_step_2, stored.booking_step_2),
            metricDiff('booking_step_3', liveConv.booking_step_3, stored.booking_step_3),
            metricDiff('reservations', liveConv.reservations, stored.reservations),
            metricDiff('reservation_value', liveConv.reservation_value, stored.reservation_value),
            metricDiff('roas', liveConv.roas, stored.roas),
            metricDiff('cost_per_reservation', liveConv.cost_per_reservation, stored.cost_per_reservation)
          ]
        : [];

      return {
        platform: platformName,
        liveOk,
        liveStatus: platformData.live.status,
        liveError: liveOk ? null : platformData.live.body?.error || platformData.live.body?.details || 'Request failed',
        storedFound: !!stored,
        diffs
      };
    }

    return {
      clientId: r.clientId,
      clientName: r.clientName,
      clientEmail: r.clientEmail,
      meta: analyzePlatform(r.meta, 'meta'),
      google: analyzePlatform(r.google, 'google')
    };
  });

  const allPlatformRows = analyzed.flatMap((c) => [c.meta, c.google].filter(Boolean));
  const failedLiveCalls = allPlatformRows.filter((p) => !p.liveOk).length;
  const missingStoredRows = allPlatformRows.filter((p) => p.liveOk && !p.storedFound).length;
  const comparedRows = allPlatformRows.filter((p) => p.liveOk && p.storedFound);
  const mismatchedRows = comparedRows.filter((p) => p.diffs.some((d) => d.pctDiff > 1)).length;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const jsonPath = path.join(outDir, `april-2026-live-vs-stored-${timestamp}.json`);
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        period: PERIOD,
        totals: {
          clientsProcessed: analyzed.length,
          platformChecks: allPlatformRows.length,
          comparedRows: comparedRows.length,
          failedLiveCalls,
          missingStoredRows,
          mismatchedRows
        },
        results: analyzed
      },
      null,
      2
    )
  );

  const mdLines = [];
  mdLines.push('# April 2026 Live API vs Stored Data Audit');
  mdLines.push('');
  mdLines.push(`Period: ${PERIOD.start} to ${PERIOD.end}`);
  mdLines.push('');
  mdLines.push('## Summary');
  mdLines.push(`- Clients processed: ${analyzed.length}`);
  mdLines.push(`- Platform checks (Meta + Google rows): ${allPlatformRows.length}`);
  mdLines.push(`- Successful live+stored comparisons: ${comparedRows.length}`);
  mdLines.push(`- Live API failures: ${failedLiveCalls}`);
  mdLines.push(`- Missing stored monthly rows: ${missingStoredRows}`);
  mdLines.push(`- Rows with >1% mismatch on any tracked metric: ${mismatchedRows}`);
  mdLines.push('');
  mdLines.push('## Per Client');
  mdLines.push('');

  for (const client of analyzed) {
    mdLines.push(`### ${client.clientName} (${client.clientEmail})`);
    for (const platform of [client.meta, client.google].filter(Boolean)) {
      mdLines.push(`- ${platform.platform.toUpperCase()}: live=${platform.liveOk ? 'ok' : `failed (${platform.liveStatus})`}, stored=${platform.storedFound ? 'found' : 'missing'}`);
      if (platform.liveError) {
        mdLines.push(`  - Error: ${platform.liveError}`);
      }
      if (platform.liveOk && platform.storedFound) {
        for (const d of platform.diffs) {
          mdLines.push(`  - ${d.metric}: live=${d.live}, stored=${d.stored}, delta=${d.delta}, diff=${d.pctDiff.toFixed(2)}%`);
        }
      }
    }
    mdLines.push('');
  }

  const mdPath = path.join(outDir, `april-2026-live-vs-stored-${timestamp}.md`);
  fs.writeFileSync(mdPath, mdLines.join('\n'));

  console.log(`Report written: ${mdPath}`);
  console.log(`Raw data written: ${jsonPath}`);
}

run().catch((error) => {
  console.error('Audit failed:', error);
  process.exit(1);
});

