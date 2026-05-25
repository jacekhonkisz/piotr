#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
const PERIOD = { start: '2026-04-01', end: '2026-04-30', summaryDate: '2026-04-01' };
const PLATFORMS = ['meta', 'google'];

const ADMIN_CANDIDATES = [
  { email: 'admin@example.com', password: 'password123' },
  { email: 'jac.honkisz@gmail.com', password: 'v&6uP*1UqTQN' }
];

const THRESHOLDS = {
  total_spend_pct: 1.0,
  total_impressions_pct: 1.0,
  total_clicks_pct: 1.0,
  total_conversions_pct: 1.0,
  conversion_count_abs: 1,
  reservation_value_pct: 2.0
};

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

function pctDiff(a, b) {
  const aa = number(a);
  const bb = number(b);
  const denom = Math.max(Math.abs(aa), Math.abs(bb), 1);
  return (Math.abs(aa - bb) / denom) * 100;
}

function diffObj(metric, baseline, observed) {
  const b = number(baseline);
  const o = number(observed);
  return { metric, baseline: b, observed: o, delta: o - b, pctDiff: pctDiff(b, o) };
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function getAccessToken() {
  for (const candidate of ADMIN_CANDIDATES) {
    const { data, error } = await supabaseAuth.auth.signInWithPassword(candidate);
    if (!error && data?.session?.access_token) {
      return data.session.access_token;
    }
  }
  throw new Error('Could not obtain access token for API calls');
}

async function fetchMetaLive(accessToken, clientId) {
  const response = await fetch(`${BASE_URL}/api/fetch-live-data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      clientId,
      dateRange: { start: PERIOD.start, end: PERIOD.end },
      platform: 'meta',
      forceFresh: true,
      bypassAllCache: true,
      reason: 'pipeline-validation-baseline'
    })
  });

  const text = await response.text();
  const body = safeJsonParse(text);
  return { ok: response.ok, status: response.status, body };
}

async function fetchGoogleLive(accessToken, clientId) {
  const response = await fetch(`${BASE_URL}/api/fetch-google-ads-live-data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      clientId,
      dateRange: { start: PERIOD.start, end: PERIOD.end },
      forceFresh: true,
      bypassAllCache: true,
      reason: 'pipeline-validation-baseline'
    })
  });

  const text = await response.text();
  const body = safeJsonParse(text);
  return { ok: response.ok, status: response.status, body };
}

function inferClickSemantics(storedSummary) {
  const campaigns = Array.isArray(storedSummary?.campaign_data) ? storedSummary.campaign_data : [];
  if (!campaigns.length) {
    return {
      inferred: 'unknown',
      reason: 'campaign_data_missing',
      allClicksSum: null,
      linkClicksSum: null
    };
  }

  const allClicksSum = campaigns.reduce((sum, c) => sum + number(c.clicks), 0);
  const linkClicksSum = campaigns.reduce((sum, c) => sum + number(c.inline_link_clicks || c.clicks), 0);
  const storedClicks = number(storedSummary.total_clicks);

  const allDiff = Math.abs(allClicksSum - storedClicks);
  const linkDiff = Math.abs(linkClicksSum - storedClicks);

  if (allDiff === 0 && linkDiff === 0) {
    return { inferred: 'ambiguous_equal', reason: 'all_equals_link', allClicksSum, linkClicksSum };
  }
  if (linkDiff < allDiff) {
    return { inferred: 'link_clicks', reason: 'closer_to_inline_link_clicks', allClicksSum, linkClicksSum };
  }
  if (allDiff < linkDiff) {
    return { inferred: 'all_clicks', reason: 'closer_to_clicks', allClicksSum, linkClicksSum };
  }

  return { inferred: 'unknown', reason: 'distance_tie', allClicksSum, linkClicksSum };
}

function evaluateClient(baselineLive, storedSummary) {
  const liveData = baselineLive?.body?.data || {};
  const liveStats = liveData.stats || {};
  const liveConv = liveData.conversionMetrics || {};

  const diffs = {
    total_spend: diffObj('total_spend', liveStats.totalSpend, storedSummary.total_spend),
    total_impressions: diffObj('total_impressions', liveStats.totalImpressions, storedSummary.total_impressions),
    total_clicks: diffObj('total_clicks', liveStats.totalClicks, storedSummary.total_clicks),
    total_conversions: diffObj('total_conversions', liveStats.totalConversions, storedSummary.total_conversions),
    click_to_call: diffObj('click_to_call', liveConv.click_to_call, storedSummary.click_to_call),
    email_contacts: diffObj('email_contacts', liveConv.email_contacts, storedSummary.email_contacts),
    booking_step_1: diffObj('booking_step_1', liveConv.booking_step_1, storedSummary.booking_step_1),
    booking_step_2: diffObj('booking_step_2', liveConv.booking_step_2, storedSummary.booking_step_2),
    booking_step_3: diffObj('booking_step_3', liveConv.booking_step_3, storedSummary.booking_step_3),
    reservations: diffObj('reservations', liveConv.reservations, storedSummary.reservations),
    reservation_value: diffObj('reservation_value', liveConv.reservation_value, storedSummary.reservation_value),
    roas: diffObj('roas', liveConv.roas, storedSummary.roas),
    cost_per_reservation: diffObj('cost_per_reservation', liveConv.cost_per_reservation, storedSummary.cost_per_reservation)
  };

  const checks = {
    total_spend_ok: diffs.total_spend.pctDiff <= THRESHOLDS.total_spend_pct,
    total_impressions_ok: diffs.total_impressions.pctDiff <= THRESHOLDS.total_impressions_pct,
    total_clicks_ok: diffs.total_clicks.pctDiff <= THRESHOLDS.total_clicks_pct,
    total_conversions_ok: diffs.total_conversions.pctDiff <= THRESHOLDS.total_conversions_pct,
    click_to_call_ok: Math.abs(diffs.click_to_call.delta) <= THRESHOLDS.conversion_count_abs,
    email_contacts_ok: Math.abs(diffs.email_contacts.delta) <= THRESHOLDS.conversion_count_abs,
    booking_step_1_ok: Math.abs(diffs.booking_step_1.delta) <= THRESHOLDS.conversion_count_abs,
    booking_step_2_ok: Math.abs(diffs.booking_step_2.delta) <= THRESHOLDS.conversion_count_abs,
    booking_step_3_ok: Math.abs(diffs.booking_step_3.delta) <= THRESHOLDS.conversion_count_abs,
    reservations_ok: Math.abs(diffs.reservations.delta) <= THRESHOLDS.conversion_count_abs,
    reservation_value_ok: diffs.reservation_value.pctDiff <= THRESHOLDS.reservation_value_pct,
    roas_ok: diffs.roas.pctDiff <= THRESHOLDS.reservation_value_pct,
    cost_per_reservation_ok: diffs.cost_per_reservation.pctDiff <= THRESHOLDS.reservation_value_pct
  };

  const passedChecks = Object.values(checks).filter(Boolean).length;
  const totalChecks = Object.keys(checks).length;
  const score = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0;

  return { diffs, checks, score, passedChecks, totalChecks };
}

function aggregateByPipeline(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = row.data_source || 'unknown';
    if (!map.has(key)) {
      map.set(key, {
        pipeline: key,
        clients: 0,
        totalScore: 0,
        passClicks: 0,
        passSpend: 0,
        passImpressions: 0,
        passReservations: 0,
        avgClicksPctDiff: 0,
        inferredClickSemantics: {}
      });
    }
    const agg = map.get(key);
    agg.clients += 1;
    agg.totalScore += row.evaluation.score;
    agg.passClicks += row.evaluation.checks.total_clicks_ok ? 1 : 0;
    agg.passSpend += row.evaluation.checks.total_spend_ok ? 1 : 0;
    agg.passImpressions += row.evaluation.checks.total_impressions_ok ? 1 : 0;
    agg.passReservations += row.evaluation.checks.reservations_ok ? 1 : 0;
    agg.avgClicksPctDiff += row.evaluation.diffs.total_clicks.pctDiff;
    const sem = row.clickSemantics.inferred;
    agg.inferredClickSemantics[sem] = (agg.inferredClickSemantics[sem] || 0) + 1;
  }

  return [...map.values()].map((agg) => ({
    ...agg,
    avgScore: agg.clients ? agg.totalScore / agg.clients : 0,
    avgClicksPctDiff: agg.clients ? agg.avgClicksPctDiff / agg.clients : 0
  }));
}

async function run() {
  console.log(`Starting pipeline validation report for ${PLATFORMS.join(', ')} ${PERIOD.start}..${PERIOD.end}`);
  const accessToken = await getAccessToken();

  const { data: clients, error: clientError } = await supabaseAdmin
    .from('clients')
    .select('id,name,email,ad_account_id,meta_access_token,google_ads_customer_id,google_ads_enabled')
    .order('name');

  if (clientError) throw clientError;

  const eligibleByPlatform = {
    meta: (clients || []).filter((c) => !!(c.ad_account_id && c.meta_access_token)),
    google: (clients || []).filter((c) => !!(c.google_ads_customer_id && c.google_ads_enabled))
  };

  const clientRows = [];

  for (const platform of PLATFORMS) {
    for (const client of eligibleByPlatform[platform]) {
      const live = platform === 'meta'
        ? await fetchMetaLive(accessToken, client.id)
        : await fetchGoogleLive(accessToken, client.id);

      if (!live.ok || !live.body?.success) {
        clientRows.push({
          platform,
          clientId: client.id,
          clientName: client.name,
          liveOk: false,
          liveStatus: live.status,
          error: live.body?.error || 'live_fetch_failed'
        });
        console.log(`Live failed: ${client.name} [${platform}] (${live.status})`);
        continue;
      }

      const { data: storedSummary } = await supabaseAdmin
        .from('campaign_summaries')
        .select('*')
        .eq('client_id', client.id)
        .eq('platform', platform)
        .eq('summary_type', 'monthly')
        .eq('summary_date', PERIOD.summaryDate)
        .maybeSingle();

      if (!storedSummary) {
        clientRows.push({
          platform,
          clientId: client.id,
          clientName: client.name,
          liveOk: true,
          storedFound: false,
          error: 'stored_summary_missing'
        });
        console.log(`Stored missing: ${client.name} [${platform}]`);
        continue;
      }

      const evaluation = evaluateClient(live, storedSummary);
      const clickSemantics = platform === 'meta'
        ? inferClickSemantics(storedSummary)
        : { inferred: 'all_clicks', reason: 'google_clicks_single_definition', allClicksSum: null, linkClicksSum: null };

      clientRows.push({
        platform,
        clientId: client.id,
        clientName: client.name,
        liveOk: true,
        storedFound: true,
        data_source: storedSummary.data_source || 'unknown',
        evaluation,
        clickSemantics
      });

      console.log(`Processed ${client.name} [${platform}] (${storedSummary.data_source || 'unknown'})`);
    }
  }

  const comparableRows = clientRows.filter((r) => r.liveOk && r.storedFound);
  const byPlatform = {};
  for (const platform of PLATFORMS) {
    const platformRows = comparableRows.filter((r) => r.platform === platform);
    byPlatform[platform] = {
      totals: {
        eligibleClients: eligibleByPlatform[platform].length,
        comparableClients: platformRows.length,
        liveFailures: clientRows.filter((r) => r.platform === platform && !r.liveOk).length,
        missingStored: clientRows.filter((r) => r.platform === platform && r.liveOk && !r.storedFound).length
      },
      byPipeline: aggregateByPipeline(platformRows).sort((a, b) => b.avgScore - a.avgScore)
    };
  }

  const totals = {
    clientsMetaEligible: eligibleByPlatform.meta.length,
    clientsGoogleEligible: eligibleByPlatform.google.length,
    comparableClients: comparableRows.length,
    liveFailures: clientRows.filter((r) => !r.liveOk).length,
    missingStored: clientRows.filter((r) => r.liveOk && !r.storedFound).length
  };

  const unnecessaryCandidates = [];
  const wrongResultCandidates = [];

  for (const platform of PLATFORMS) {
    const pipelines = byPlatform[platform].byPipeline;
    unnecessaryCandidates.push(
      ...pipelines
        .filter((p) => p.clients <= 1 && p.avgScore < 95)
        .map((p) => `${platform}:${p.pipeline}`)
    );
    wrongResultCandidates.push(
      ...pipelines
        .filter((p) => p.avgClicksPctDiff > THRESHOLDS.total_clicks_pct || p.passClicks < p.clients)
        .map((p) => ({
          platform,
          pipeline: p.pipeline,
          reason: `click mismatch (avg click diff ${p.avgClicksPctDiff.toFixed(2)}%, pass ${p.passClicks}/${p.clients})`
        }))
    );
  }

  const output = {
    generatedAt: new Date().toISOString(),
    period: PERIOD,
    platforms: PLATFORMS,
    thresholds: THRESHOLDS,
    totals,
    byPlatform,
    unnecessaryCandidates,
    wrongResultCandidates,
    clients: clientRows
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, `pipeline-validation-meta-google-${PERIOD.summaryDate}-${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));

  const md = [];
  md.push('# Pipeline Validation Report (META + GOOGLE)');
  md.push('');
  md.push(`Period: ${PERIOD.start} to ${PERIOD.end}`);
  md.push('');
  md.push('## Totals');
  md.push(`- Meta eligible clients: ${totals.clientsMetaEligible}`);
  md.push(`- Google eligible clients: ${totals.clientsGoogleEligible}`);
  md.push(`- Comparable clients (live + stored): ${totals.comparableClients}`);
  md.push(`- Live baseline failures: ${totals.liveFailures}`);
  md.push(`- Missing stored summaries: ${totals.missingStored}`);
  md.push('');
  md.push('## Pipeline Accuracy By Platform');
  for (const platform of PLATFORMS) {
    md.push(`### ${platform.toUpperCase()}`);
    const pRows = byPlatform[platform].byPipeline;
    if (!pRows.length) {
      md.push('- No comparable rows');
      continue;
    }
    for (const p of pRows) {
      md.push(`- ${p.pipeline}: avgScore=${p.avgScore.toFixed(1)}%, clients=${p.clients}, clicks pass=${p.passClicks}/${p.clients}, avg clicks diff=${p.avgClicksPctDiff.toFixed(2)}%, inferred semantics=${JSON.stringify(p.inferredClickSemantics)}`);
    }
  }
  md.push('');
  md.push('## Wrong-result candidates');
  if (!wrongResultCandidates.length) {
    md.push('- None by configured thresholds');
  } else {
    wrongResultCandidates.forEach((x) => md.push(`- ${x.platform}:${x.pipeline}: ${x.reason}`));
  }
  md.push('');
  md.push('## Unnecessary candidates');
  if (!unnecessaryCandidates.length) {
    md.push('- None by configured heuristic');
  } else {
    unnecessaryCandidates.forEach((x) => md.push(`- ${x}`));
  }
  md.push('');
  md.push('## Per-client click diagnostics');
  comparableRows
    .sort((a, b) => (b.evaluation?.diffs?.total_clicks?.pctDiff || 0) - (a.evaluation?.diffs?.total_clicks?.pctDiff || 0))
    .forEach((r) => {
      md.push(`- [${r.platform}] ${r.clientName}: source=${r.data_source}, clickDiff=${r.evaluation.diffs.total_clicks.pctDiff.toFixed(2)}%, semantics=${r.clickSemantics.inferred}`);
    });

  const mdPath = path.join(outDir, `pipeline-validation-meta-google-${PERIOD.summaryDate}-${timestamp}.md`);
  fs.writeFileSync(mdPath, md.join('\n'));

  console.log(`Report written: ${mdPath}`);
  console.log(`Raw data written: ${jsonPath}`);
}

run().catch((error) => {
  console.error('Pipeline validation failed:', error);
  process.exit(1);
});

