#!/usr/bin/env node

/**
 * CONTRACT VALIDATION REPORT
 *
 * For each Meta + Google client, fetches:
 *   1) Fresh live API baseline (force fresh, bypass cache)
 *   2) Stored campaign_summaries row (current month)
 *
 * Maps each into a contract-conforming payload (mirroring src/lib/report-adapters)
 * and compares stored to baseline using src/lib/report-payload-validator rules.
 *
 * Outputs:
 *   - logs/contract-validation-<platform>-<period>-<ts>.json
 *   - logs/contract-validation-<platform>-<period>-<ts>.md
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

function parseMonthArg() {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--month');
  return idx >= 0 ? args[idx + 1] : null;
}

function periodForMonth(tag) {
  const [y, m] = tag.split('-').map((n) => parseInt(n, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m)) {
    throw new Error(`Invalid --month value: ${tag}`);
  }
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return {
    start: `${y}-${mm}-01`,
    end: `${y}-${mm}-${String(lastDay).padStart(2, '0')}`,
    summaryDate: `${y}-${mm}-01`
  };
}

const monthArg = parseMonthArg();
const PERIOD = monthArg
  ? periodForMonth(monthArg)
  : { start: '2026-04-01', end: '2026-04-30', summaryDate: '2026-04-01' };

const ADMIN_CANDIDATES = [
  { email: 'admin@example.com', password: 'password123' },
  { email: 'jac.honkisz@gmail.com', password: 'v&6uP*1UqTQN' }
];

const THRESHOLDS = {
  spend_pct: 1.0,
  impressions_pct: 1.0,
  clicks_pct: 1.0,
  conversions_abs: 1,
  reservation_value_pct: 2.0,
  ctr_abs: 0.05,
  cpc_abs: 0.05
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const pctDiff = (a, b) => {
  const aa = num(a);
  const bb = num(b);
  const denom = Math.max(Math.abs(aa), Math.abs(bb), 1);
  return (Math.abs(aa - bb) / denom) * 100;
};

function emptyPayload(clientId, clientName, platform, source) {
  return {
    contract_version: 'v1',
    client_id: clientId,
    client_name: clientName,
    platform,
    date_range: { start: PERIOD.start, end: PERIOD.end },
    source,
    core: {
      total_spend: 0,
      total_impressions: 0,
      total_clicks: 0,
      total_conversions: 0,
      average_ctr: 0,
      average_cpc: 0
    },
    conversion: {
      click_to_call: 0,
      email_contacts: 0,
      booking_step_1: 0,
      booking_step_2: 0,
      booking_step_3: 0,
      reservations: 0,
      reservation_value: 0,
      roas: 0,
      cost_per_reservation: 0
    }
  };
}

function adaptMetaLiveApiResponse(clientId, clientName, body) {
  const data = body?.data || {};
  const stats = data.stats || {};
  const conv = data.conversionMetrics || {};
  const payload = emptyPayload(clientId, clientName, 'meta', 'live_api');
  payload.core.total_spend = num(stats.totalSpend);
  payload.core.total_impressions = num(stats.totalImpressions);
  payload.core.total_clicks = num(stats.totalClicks);
  payload.core.total_conversions = num(stats.totalConversions);
  payload.core.average_ctr = num(stats.averageCtr);
  payload.core.average_cpc = num(stats.averageCpc);
  payload.conversion.click_to_call = num(conv.click_to_call);
  payload.conversion.email_contacts = num(conv.email_contacts);
  payload.conversion.booking_step_1 = num(conv.booking_step_1);
  payload.conversion.booking_step_2 = num(conv.booking_step_2);
  payload.conversion.booking_step_3 = num(conv.booking_step_3);
  payload.conversion.reservations = num(conv.reservations);
  payload.conversion.reservation_value = num(conv.reservation_value);
  payload.conversion.roas = num(conv.roas);
  payload.conversion.cost_per_reservation = num(conv.cost_per_reservation);
  return payload;
}

function adaptGoogleLiveApiResponse(clientId, clientName, body) {
  const data = body?.data || {};
  const stats = data.stats || {};
  const conv = data.conversionMetrics || {};
  const payload = emptyPayload(clientId, clientName, 'google', 'live_api');
  payload.core.total_spend = num(stats.totalSpend);
  payload.core.total_impressions = num(stats.totalImpressions);
  payload.core.total_clicks = num(stats.totalClicks);
  payload.core.total_conversions = num(stats.totalConversions);
  payload.core.average_ctr = num(stats.averageCtr);
  payload.core.average_cpc = num(stats.averageCpc);
  payload.conversion.click_to_call = num(conv.click_to_call);
  payload.conversion.email_contacts = num(conv.email_contacts);
  payload.conversion.booking_step_1 = num(conv.booking_step_1);
  payload.conversion.booking_step_2 = num(conv.booking_step_2);
  payload.conversion.booking_step_3 = num(conv.booking_step_3);
  payload.conversion.reservations = num(conv.reservations);
  payload.conversion.reservation_value = num(conv.reservation_value);
  payload.conversion.roas = num(conv.roas);
  payload.conversion.cost_per_reservation = num(conv.cost_per_reservation);
  return payload;
}

function adaptCampaignSummary(clientId, clientName, platform, summary) {
  const payload = emptyPayload(clientId, clientName, platform, 'campaign_summary');
  payload.core.total_spend = num(summary.total_spend);
  payload.core.total_impressions = num(summary.total_impressions);
  payload.core.total_clicks = num(summary.total_clicks);
  payload.core.total_conversions = num(summary.total_conversions);
  payload.core.average_ctr = num(summary.average_ctr);
  payload.core.average_cpc = num(summary.average_cpc);
  payload.conversion.click_to_call = num(summary.click_to_call);
  payload.conversion.email_contacts = num(summary.email_contacts);
  payload.conversion.booking_step_1 = num(summary.booking_step_1);
  payload.conversion.booking_step_2 = num(summary.booking_step_2);
  payload.conversion.booking_step_3 = num(summary.booking_step_3);
  payload.conversion.reservations = num(summary.reservations);
  payload.conversion.reservation_value = num(summary.reservation_value);
  payload.conversion.roas = num(summary.roas);
  payload.conversion.cost_per_reservation = num(summary.cost_per_reservation);
  return payload;
}

function validateContractShape(payload) {
  const issues = [];
  const checkBlock = (label, block) => {
    for (const [k, v] of Object.entries(block)) {
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
        issues.push({ severity: 'error', code: 'BAD_NUMERIC', metric: `${label}.${k}` });
      }
    }
  };
  checkBlock('core', payload.core);
  checkBlock('conversion', payload.conversion);
  if (payload.conversion.booking_step_1 > 0 && payload.conversion.booking_step_2 > payload.conversion.booking_step_1) {
    issues.push({ severity: 'warning', code: 'FUNNEL_INVERSION', metric: 'booking_step_2' });
  }
  if (payload.conversion.booking_step_2 > 0 && payload.conversion.booking_step_3 > payload.conversion.booking_step_2) {
    issues.push({ severity: 'warning', code: 'FUNNEL_INVERSION', metric: 'booking_step_3' });
  }
  if (payload.conversion.booking_step_3 > 0 && payload.conversion.reservations > payload.conversion.booking_step_3) {
    issues.push({ severity: 'warning', code: 'FUNNEL_INVERSION', metric: 'reservations' });
  }
  return issues;
}

function compareToBaseline(baseline, observed) {
  const diffs = [];
  const pctMetric = (label, b, o, threshold) => {
    const p = pctDiff(b, o);
    diffs.push({ metric: label, baseline: b, observed: o, delta: o - b, pct: p, pass: p <= threshold });
  };
  const absMetric = (label, b, o, threshold) => {
    const delta = Math.abs(o - b);
    diffs.push({ metric: label, baseline: b, observed: o, delta: o - b, pct: pctDiff(b, o), pass: delta <= threshold });
  };

  pctMetric('total_spend', baseline.core.total_spend, observed.core.total_spend, THRESHOLDS.spend_pct);
  pctMetric('total_impressions', baseline.core.total_impressions, observed.core.total_impressions, THRESHOLDS.impressions_pct);
  pctMetric('total_clicks', baseline.core.total_clicks, observed.core.total_clicks, THRESHOLDS.clicks_pct);
  absMetric('total_conversions', baseline.core.total_conversions, observed.core.total_conversions, THRESHOLDS.conversions_abs);
  absMetric('average_ctr', baseline.core.average_ctr, observed.core.average_ctr, THRESHOLDS.ctr_abs);
  absMetric('average_cpc', baseline.core.average_cpc, observed.core.average_cpc, THRESHOLDS.cpc_abs);

  absMetric('click_to_call', baseline.conversion.click_to_call, observed.conversion.click_to_call, THRESHOLDS.conversions_abs);
  absMetric('email_contacts', baseline.conversion.email_contacts, observed.conversion.email_contacts, THRESHOLDS.conversions_abs);
  absMetric('booking_step_1', baseline.conversion.booking_step_1, observed.conversion.booking_step_1, THRESHOLDS.conversions_abs);
  absMetric('booking_step_2', baseline.conversion.booking_step_2, observed.conversion.booking_step_2, THRESHOLDS.conversions_abs);
  absMetric('booking_step_3', baseline.conversion.booking_step_3, observed.conversion.booking_step_3, THRESHOLDS.conversions_abs);
  absMetric('reservations', baseline.conversion.reservations, observed.conversion.reservations, THRESHOLDS.conversions_abs);
  pctMetric('reservation_value', baseline.conversion.reservation_value, observed.conversion.reservation_value, THRESHOLDS.reservation_value_pct);
  pctMetric('roas', baseline.conversion.roas, observed.conversion.roas, THRESHOLDS.reservation_value_pct);
  pctMetric('cost_per_reservation', baseline.conversion.cost_per_reservation, observed.conversion.cost_per_reservation, THRESHOLDS.reservation_value_pct);

  const passed = diffs.filter((d) => d.pass).length;
  return { passed, total: diffs.length, score: diffs.length ? (passed / diffs.length) * 100 : 0, diffs };
}

async function getAccessToken() {
  for (const candidate of ADMIN_CANDIDATES) {
    const { data, error } = await supabaseAuth.auth.signInWithPassword(candidate);
    if (!error && data?.session?.access_token) return data.session.access_token;
  }
  throw new Error('Could not obtain access token');
}

async function fetchLiveMeta(token, clientId) {
  const r = await fetch(`${BASE_URL}/api/fetch-live-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      clientId,
      dateRange: { start: PERIOD.start, end: PERIOD.end },
      platform: 'meta',
      forceFresh: true,
      bypassAllCache: true,
      reason: 'contract-validation-baseline'
    })
  });
  const t = await r.text();
  let body;
  try { body = JSON.parse(t); } catch { body = { raw: t }; }
  return { ok: r.ok, status: r.status, body };
}

async function fetchLiveGoogle(token, clientId) {
  const r = await fetch(`${BASE_URL}/api/fetch-google-ads-live-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      clientId,
      dateRange: { start: PERIOD.start, end: PERIOD.end },
      forceFresh: true,
      bypassAllCache: true,
      reason: 'contract-validation-baseline'
    })
  });
  const t = await r.text();
  let body;
  try { body = JSON.parse(t); } catch { body = { raw: t }; }
  return { ok: r.ok, status: r.status, body };
}

async function run() {
  console.log(`Contract validation for ${PERIOD.start}..${PERIOD.end}`);
  const token = await getAccessToken();

  const { data: clients, error } = await supabaseAdmin
    .from('clients')
    .select('id,name,email,ad_account_id,meta_access_token,google_ads_customer_id,google_ads_enabled')
    .order('name');
  if (error) throw error;

  const platforms = ['meta', 'google'];
  const eligible = {
    meta: clients.filter((c) => !!(c.ad_account_id && c.meta_access_token)),
    google: clients.filter((c) => !!(c.google_ads_customer_id && c.google_ads_enabled))
  };

  const results = [];

  for (const platform of platforms) {
    for (const client of eligible[platform]) {
      const live = platform === 'meta'
        ? await fetchLiveMeta(token, client.id)
        : await fetchLiveGoogle(token, client.id);
      if (!live.ok || !live.body?.success) {
        results.push({ platform, client_id: client.id, client_name: client.name, error: 'live_failed', status: live.status });
        console.log(`Live failed [${platform}] ${client.name}`);
        continue;
      }
      const baseline = platform === 'meta'
        ? adaptMetaLiveApiResponse(client.id, client.name, live.body)
        : adaptGoogleLiveApiResponse(client.id, client.name, live.body);
      const baselineIssues = validateContractShape(baseline);

      const { data: stored } = await supabaseAdmin
        .from('campaign_summaries')
        .select('*')
        .eq('client_id', client.id)
        .eq('platform', platform)
        .eq('summary_type', 'monthly')
        .eq('summary_date', PERIOD.summaryDate)
        .maybeSingle();

      let observed = null;
      let storedIssues = [];
      let comparison = null;
      if (stored) {
        observed = adaptCampaignSummary(client.id, client.name, platform, stored);
        storedIssues = validateContractShape(observed);
        comparison = compareToBaseline(baseline, observed);
      }

      results.push({
        platform,
        client_id: client.id,
        client_name: client.name,
        baseline,
        baselineIssues,
        observed,
        storedIssues,
        data_source: stored?.data_source || null,
        comparison
      });
      console.log(`Processed [${platform}] ${client.name}`);
    }
  }

  const summarize = (rows, platform) => {
    const platformRows = rows.filter((r) => r.platform === platform && r.comparison);
    if (!platformRows.length) return null;
    const avgScore = platformRows.reduce((s, r) => s + r.comparison.score, 0) / platformRows.length;
    const fails = {};
    for (const r of platformRows) {
      for (const d of r.comparison.diffs) {
        if (!d.pass) {
          fails[d.metric] = (fails[d.metric] || 0) + 1;
        }
      }
    }
    return { clients: platformRows.length, avgScore, failsByMetric: fails };
  };

  const totals = {
    meta: summarize(results, 'meta'),
    google: summarize(results, 'google')
  };

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, `contract-validation-${PERIOD.summaryDate}-${ts}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify({
    period: PERIOD,
    thresholds: THRESHOLDS,
    totals,
    results
  }, null, 2));

  const md = [];
  md.push('# Contract Validation Report');
  md.push('');
  md.push(`Period: ${PERIOD.start} to ${PERIOD.end}`);
  md.push('');
  md.push('## Totals');
  for (const p of platforms) {
    if (!totals[p]) {
      md.push(`- ${p}: no comparable clients`);
      continue;
    }
    md.push(`- ${p}: clients=${totals[p].clients}, avgScore=${totals[p].avgScore.toFixed(1)}%, fails=${JSON.stringify(totals[p].failsByMetric)}`);
  }
  md.push('');
  md.push('## Per-client');
  for (const r of results) {
    if (!r.comparison) {
      md.push(`### [${r.platform}] ${r.client_name}`);
      md.push(`- Skipped: ${r.error || 'no stored summary'}`);
      md.push('');
      continue;
    }
    md.push(`### [${r.platform}] ${r.client_name} (source=${r.data_source || 'unknown'})`);
    md.push(`- Score: ${r.comparison.score.toFixed(1)}%  (passed ${r.comparison.passed}/${r.comparison.total})`);
    const fails = r.comparison.diffs.filter((d) => !d.pass);
    if (!fails.length) {
      md.push('- Passed all checks');
    } else {
      for (const f of fails) {
        md.push(`  - FAIL ${f.metric}: baseline=${f.baseline}, observed=${f.observed}, delta=${f.delta}, pct=${f.pct.toFixed(2)}%`);
      }
    }
    md.push('');
  }

  const mdPath = path.join(outDir, `contract-validation-${PERIOD.summaryDate}-${ts}.md`);
  fs.writeFileSync(mdPath, md.join('\n'));

  console.log(`Wrote: ${mdPath}`);
  console.log(`Wrote: ${jsonPath}`);
}

run().catch((err) => {
  console.error('Contract validation failed:', err);
  process.exit(1);
});
