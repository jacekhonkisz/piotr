#!/usr/bin/env node

/**
 * CANONICAL BACKFILL (Meta-only, monthly)
 *
 * For each Meta client and a given month (or month range):
 *  1. Fetch fresh live API (canonical contract values: link clicks, weighted CTR/CPC,
 *     parsed reservations).
 *  2. Read the current campaign_summaries row.
 *  3. Compute diff between canonical vs stored values.
 *  4. In dry-run mode (default), write a JSON+MD audit report only.
 *  5. With --apply, upsert canonical numeric fields (totals + conversion metrics)
 *     into campaign_summaries while preserving campaign_data and meta_tables.
 *
 * The script keeps a complete before/after audit log so any change is reversible.
 *
 * Usage:
 *   node scripts/canonical-backfill.js                                # dry-run April 2026
 *   node scripts/canonical-backfill.js --month 2026-04                # explicit single month
 *   node scripts/canonical-backfill.js --month 2026-04 --apply        # commit single month
 *   node scripts/canonical-backfill.js --from 2025-11 --to 2026-03    # dry-run range
 *   node scripts/canonical-backfill.js --from 2025-11 --to 2026-03 --apply
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');

function flag(name) {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : undefined;
}

function parseMonth(tag) {
  const [yearStr, monthStr] = (tag || '').split('-');
  const y = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    throw new Error(`Invalid month tag: ${tag}`);
  }
  return { year: y, month: m };
}

function monthTag(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function buildPeriod(tag) {
  const { year, month } = parseMonth(tag);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    tag,
    start: `${tag}-01`,
    end: `${tag}-${String(lastDay).padStart(2, '0')}`,
    summaryDate: `${tag}-01`
  };
}

function buildMonthList() {
  const fromTag = flag('--from');
  const toTag = flag('--to');
  const monthTagFlag = flag('--month');
  if (fromTag && toTag) {
    const from = parseMonth(fromTag);
    const to = parseMonth(toTag);
    const list = [];
    let y = from.year;
    let m = from.month;
    while (y < to.year || (y === to.year && m <= to.month)) {
      list.push(monthTag(y, m));
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }
    return list;
  }
  return [monthTagFlag ?? '2026-04'];
}

const MONTHS = buildMonthList();

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
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

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const round = (v, digits = 4) => {
  const factor = Math.pow(10, digits);
  return Math.round(v * factor) / factor;
};

async function getAccessToken() {
  for (const candidate of ADMIN_CANDIDATES) {
    const { data, error } = await supabaseAuth.auth.signInWithPassword(candidate);
    if (!error && data?.session?.access_token) return data.session.access_token;
  }
  throw new Error('Could not obtain access token');
}

async function fetchLiveMeta(token, clientId, period) {
  const r = await fetch(`${BASE_URL}/api/fetch-live-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      clientId,
      dateRange: { start: period.start, end: period.end },
      platform: 'meta',
      forceFresh: true,
      bypassAllCache: true,
      reason: 'canonical-backfill'
    })
  });
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  return { ok: r.ok, status: r.status, body };
}

function buildCanonical(clientId, body, period) {
  const data = body?.data || {};
  const stats = data.stats || {};
  const conv = data.conversionMetrics || {};
  return {
    client_id: clientId,
    platform: 'meta',
    summary_type: 'monthly',
    summary_date: period.summaryDate,
    total_spend: round(num(stats.totalSpend), 2),
    total_impressions: Math.round(num(stats.totalImpressions)),
    total_clicks: Math.round(num(stats.totalClicks)),
    total_conversions: Math.round(num(stats.totalConversions)),
    average_ctr: round(num(stats.averageCtr), 4),
    average_cpc: round(num(stats.averageCpc), 4),
    click_to_call: Math.round(num(conv.click_to_call)),
    email_contacts: Math.round(num(conv.email_contacts)),
    booking_step_1: Math.round(num(conv.booking_step_1)),
    booking_step_2: Math.round(num(conv.booking_step_2)),
    booking_step_3: Math.round(num(conv.booking_step_3)),
    reservations: Math.round(num(conv.reservations)),
    reservation_value: round(num(conv.reservation_value), 2),
    roas: round(num(conv.roas), 4),
    cost_per_reservation: round(num(conv.cost_per_reservation), 4)
  };
}

const TRACKED_FIELDS = [
  'total_spend',
  'total_impressions',
  'total_clicks',
  'total_conversions',
  'average_ctr',
  'average_cpc',
  'click_to_call',
  'email_contacts',
  'booking_step_1',
  'booking_step_2',
  'booking_step_3',
  'reservations',
  'reservation_value',
  'roas',
  'cost_per_reservation'
];

function diffFields(stored, canonical) {
  const diffs = {};
  for (const field of TRACKED_FIELDS) {
    const before = num(stored?.[field]);
    const after = num(canonical[field]);
    if (Math.abs(after - before) > 0.0001) {
      diffs[field] = { before, after, delta: round(after - before, 4) };
    }
  }
  return diffs;
}

async function applyUpdate(clientId, canonical, period) {
  const update = {};
  for (const field of TRACKED_FIELDS) update[field] = canonical[field];
  update.last_updated = new Date().toISOString();
  update.data_source = 'canonical_backfill_v1';
  const { error } = await supabaseAdmin
    .from('campaign_summaries')
    .update(update)
    .eq('client_id', clientId)
    .eq('platform', 'meta')
    .eq('summary_type', 'monthly')
    .eq('summary_date', period.summaryDate);
  return error;
}

function summarizeDiffs(allDiffs) {
  const counts = {};
  for (const entry of allDiffs) {
    for (const field of Object.keys(entry.diffs)) {
      counts[field] = (counts[field] || 0) + 1;
    }
  }
  return counts;
}

async function processMonth(period, eligible, token) {
  const monthResults = [];
  for (const client of eligible) {
    let live;
    try {
      live = await fetchLiveMeta(token, client.id, period);
    } catch (err) {
      monthResults.push({
        client_id: client.id,
        client_name: client.name,
        error: 'live_request_failed',
        message: err.message
      });
      continue;
    }
    if (!live.ok || !live.body?.success) {
      monthResults.push({
        client_id: client.id,
        client_name: client.name,
        error: 'live_failed',
        status: live.status
      });
      continue;
    }

    const canonical = buildCanonical(client.id, live.body, period);

    const { data: stored } = await supabaseAdmin
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', client.id)
      .eq('platform', 'meta')
      .eq('summary_type', 'monthly')
      .eq('summary_date', period.summaryDate)
      .maybeSingle();

    if (!stored) {
      monthResults.push({
        client_id: client.id,
        client_name: client.name,
        status: 'no_stored_row'
      });
      continue;
    }

    const diffs = diffFields(stored, canonical);
    const hasChanges = Object.keys(diffs).length > 0;

    // Guardrail: refuse to overwrite a non-trivial stored row with an empty canonical
    // payload. Protects against transient empty live API responses (e.g. rate limit,
    // timeout) silently zeroing out healthy stored data.
    const canonicalIsEmpty =
      num(canonical.total_spend) === 0 &&
      num(canonical.total_impressions) === 0 &&
      num(canonical.total_clicks) === 0;
    const storedIsNonTrivial =
      num(stored.total_spend) > 1 ||
      num(stored.total_impressions) > 100 ||
      num(stored.total_clicks) > 1;
    const blockedEmpty = canonicalIsEmpty && storedIsNonTrivial;

    let updateError = null;
    if (APPLY && hasChanges && !blockedEmpty) {
      updateError = await applyUpdate(client.id, canonical, period);
    }
    if (blockedEmpty) {
      monthResults.push({
        client_id: client.id,
        client_name: client.name,
        had_changes: hasChanges,
        stored_data_source: stored.data_source ?? null,
        diffs,
        applied: false,
        skipped_reason: 'canonical_empty_stored_nontrivial'
      });
      continue;
    }

    monthResults.push({
      client_id: client.id,
      client_name: client.name,
      had_changes: hasChanges,
      stored_data_source: stored.data_source ?? null,
      diffs,
      apply_error: updateError ? updateError.message : null,
      applied: APPLY && hasChanges && !updateError
    });
  }
  return monthResults;
}

function writeMonthReport(period, results, logsDir) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const tag = APPLY ? 'apply' : 'dry-run';
  const baseName = `canonical-backfill-${period.tag}-${tag}-${stamp}`;
  const jsonPath = path.join(logsDir, `${baseName}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify({ period, mode: tag, results }, null, 2));

  const fieldCounts = summarizeDiffs(results.filter((r) => r.diffs));
  const lines = [];
  lines.push(`# Canonical Backfill Report`);
  lines.push('');
  lines.push(`Period: ${period.start} to ${period.end}`);
  lines.push(`Mode: ${tag.toUpperCase()}`);
  lines.push('');
  lines.push(`## Field-level change frequency (would-change clients)`);
  if (Object.keys(fieldCounts).length === 0) {
    lines.push(`- No fields changed for any client.`);
  } else {
    for (const [field, count] of Object.entries(fieldCounts).sort((a, b) => b[1] - a[1])) {
      lines.push(`- ${field}: ${count}`);
    }
  }
  lines.push('');
  lines.push(`## Per-client`);
  for (const r of results) {
    lines.push(`### ${r.client_name}`);
    if (r.error) {
      lines.push(`- error: ${r.error}${r.status ? ` (status=${r.status})` : ''}${r.message ? ` ${r.message}` : ''}`);
      continue;
    }
    if (r.status === 'no_stored_row') {
      lines.push(`- skipped: no stored row for this period`);
      continue;
    }
    lines.push(`- stored data_source: ${r.stored_data_source ?? 'unknown'}`);
    if (!r.had_changes) {
      lines.push(`- no changes (already canonical)`);
      continue;
    }
    if (r.applied) {
      lines.push(`- APPLIED: ${Object.keys(r.diffs).length} field(s) updated`);
    } else if (APPLY) {
      lines.push(`- APPLY FAILED: ${r.apply_error}`);
    } else {
      lines.push(`- DRY-RUN: ${Object.keys(r.diffs).length} field(s) would change`);
    }
    for (const [field, d] of Object.entries(r.diffs)) {
      lines.push(`  - ${field}: ${d.before} → ${d.after} (Δ ${d.delta})`);
    }
  }
  const mdPath = path.join(logsDir, `${baseName}.md`);
  fs.writeFileSync(mdPath, lines.join('\n'));
  return { jsonPath, mdPath };
}

function writeRangeSummary(monthSummaries, logsDir) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const tag = APPLY ? 'apply' : 'dry-run';
  const baseName = `canonical-backfill-RANGE-${tag}-${stamp}`;
  const lines = [];
  lines.push(`# Canonical Backfill Range Summary`);
  lines.push('');
  lines.push(`Mode: ${tag.toUpperCase()}`);
  lines.push(`Months processed: ${monthSummaries.length}`);
  lines.push('');
  lines.push(`| Month | Clients | Changed | Applied | No-store | Errors | Top fields changed |`);
  lines.push(`|-------|---------|---------|---------|----------|--------|--------------------|`);
  for (const m of monthSummaries) {
    const top = Object.entries(m.fieldCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([k, v]) => `${k} (${v})`)
      .join(', ') || '—';
    lines.push(`| ${m.tag} | ${m.totalClients} | ${m.changedClients} | ${m.appliedClients} | ${m.noStored} | ${m.errors} | ${top} |`);
  }
  const mdPath = path.join(logsDir, `${baseName}.md`);
  fs.writeFileSync(mdPath, lines.join('\n'));
  return mdPath;
}

async function run() {
  console.log(`\nCanonical backfill (Meta)`);
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Months: ${MONTHS.join(', ')}`);

  const token = await getAccessToken();

  const { data: clients, error } = await supabaseAdmin
    .from('clients')
    .select('id,name,email,ad_account_id,meta_access_token')
    .order('name');
  if (error) throw error;

  const eligible = (clients || []).filter((c) => !!(c.ad_account_id && c.meta_access_token));
  console.log(`Eligible Meta clients: ${eligible.length}\n`);

  const logsDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

  const monthSummaries = [];

  for (const monthStr of MONTHS) {
    const period = buildPeriod(monthStr);
    console.log(`=== ${period.tag} (${period.start}..${period.end}) ===`);

    const results = await processMonth(period, eligible, token);

    const fieldCounts = summarizeDiffs(results.filter((r) => r.diffs));
    const changedClients = results.filter((r) => r.had_changes).length;
    const appliedClients = results.filter((r) => r.applied).length;
    const noStored = results.filter((r) => r.status === 'no_stored_row').length;
    const errors = results.filter((r) => r.error).length;

    const summary = {
      tag: period.tag,
      totalClients: results.length,
      changedClients,
      appliedClients,
      noStored,
      errors,
      fieldCounts
    };
    monthSummaries.push(summary);

    const { mdPath } = writeMonthReport(period, results, logsDir);
    console.log(`  changed=${changedClients}  applied=${appliedClients}  noStored=${noStored}  errors=${errors}`);
    console.log(`  → ${path.basename(mdPath)}\n`);
  }

  if (MONTHS.length > 1) {
    const rangeMd = writeRangeSummary(monthSummaries, logsDir);
    console.log(`Range summary: ${rangeMd}`);
  }

  if (!APPLY) {
    console.log('\nDry-run complete. Re-run with --apply to write changes.');
  } else {
    console.log('\nApply complete. Re-run contract-validation-report.js to verify.');
  }
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
