#!/usr/bin/env node

/**
 * VERIFY BACKFILL (stored-only)
 *
 * Reads the dry-run JSON reports (which contain the canonical `after` values
 * the backfill intended to write — i.e. fresh live API at apply time) and
 * compares them against the current stored campaign_summaries rows. Confirms
 * the apply persisted those values exactly.
 *
 * No external API calls — fast, deterministic, and proves the backfill
 * produced the canonical state in the DB.
 *
 * Usage:
 *   node scripts/verify-backfill-stored.js --from 2025-11 --to 2026-04
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const args = process.argv.slice(2);
const flag = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};

const FROM = flag('--from') || '2025-11';
const TO = flag('--to') || '2026-04';

function parseMonth(tag) {
  const [y, m] = tag.split('-').map(Number);
  return { y, m };
}

function* monthsRange(fromTag, toTag) {
  const f = parseMonth(fromTag);
  const t = parseMonth(toTag);
  let y = f.y;
  let m = f.m;
  while (y < t.y || (y === t.y && m <= t.m)) {
    yield `${y}-${String(m).padStart(2, '0')}`;
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
}

const TRACKED = [
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

function findLatestDryRun(monthTag) {
  const logsDir = path.join(__dirname, '..', 'logs');
  const files = fs
    .readdirSync(logsDir)
    .filter((f) => f.startsWith(`canonical-backfill-${monthTag}-dry-run-`) && f.endsWith('.json'))
    .sort()
    .reverse();
  return files.length ? path.join(logsDir, files[0]) : null;
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

async function verifyMonth(monthTag) {
  const dryRunPath = findLatestDryRun(monthTag);
  if (!dryRunPath) {
    return { monthTag, error: 'no_dry_run_report_found' };
  }
  const dryRun = JSON.parse(fs.readFileSync(dryRunPath, 'utf-8'));
  const period = dryRun.period;

  const summaryDate = period.summaryDate;

  const { data: storedRows, error } = await supabaseAdmin
    .from('campaign_summaries')
    .select('*')
    .eq('summary_type', 'monthly')
    .eq('platform', 'meta')
    .eq('summary_date', summaryDate);

  if (error) return { monthTag, error: error.message };

  const storedById = new Map(storedRows.map((r) => [r.client_id, r]));

  const perClient = [];
  let canonicalCount = 0;
  let mismatchCount = 0;
  let missingCount = 0;
  for (const r of dryRun.results) {
    if (r.error || r.status === 'no_stored_row') {
      perClient.push({ client_name: r.client_name, status: r.status || r.error });
      continue;
    }
    const stored = storedById.get(r.client_id);
    if (!stored) {
      missingCount += 1;
      perClient.push({ client_name: r.client_name, status: 'stored_row_missing_after_apply' });
      continue;
    }
    const expected = {};
    for (const f of TRACKED) {
      const before = num(r.diffs[f]?.before);
      const after = num(r.diffs[f]?.after);
      // If dry-run recorded a diff: expected = after; else expected = current stored (no change).
      expected[f] = r.diffs[f] ? after : num(stored[f]);
    }
    const drifts = {};
    for (const f of TRACKED) {
      const got = num(stored[f]);
      const want = expected[f];
      if (Math.abs(got - want) > 0.01) {
        drifts[f] = { expected: want, stored: got, delta: Math.round((got - want) * 10000) / 10000 };
      }
    }
    if (Object.keys(drifts).length === 0) {
      canonicalCount += 1;
      perClient.push({
        client_name: r.client_name,
        status: 'canonical',
        data_source: stored.data_source
      });
    } else {
      mismatchCount += 1;
      perClient.push({
        client_name: r.client_name,
        status: 'drift',
        data_source: stored.data_source,
        drifts
      });
    }
  }

  return {
    monthTag,
    canonicalCount,
    mismatchCount,
    missingCount,
    total: dryRun.results.length,
    perClient
  };
}

async function run() {
  const months = [...monthsRange(FROM, TO)];
  console.log(`Verifying backfill (stored-only) for: ${months.join(', ')}`);

  const results = [];
  for (const m of months) {
    const r = await verifyMonth(m);
    results.push(r);
    if (r.error) {
      console.log(`  ${m}: ${r.error}`);
    } else {
      console.log(
        `  ${m}: canonical=${r.canonicalCount}/${r.total}  drift=${r.mismatchCount}  missing=${r.missingCount}`
      );
    }
  }

  const lines = [];
  lines.push(`# Backfill Verification (stored vs canonical-from-dry-run)`);
  lines.push('');
  lines.push(`Range: ${FROM} → ${TO}`);
  lines.push('');
  lines.push(`| Month | Canonical | Drift | Missing | Total |`);
  lines.push(`|-------|-----------|-------|---------|-------|`);
  for (const r of results) {
    if (r.error) {
      lines.push(`| ${r.monthTag} | – | – | – | error: ${r.error} |`);
      continue;
    }
    lines.push(`| ${r.monthTag} | ${r.canonicalCount} | ${r.mismatchCount} | ${r.missingCount} | ${r.total} |`);
  }
  lines.push('');
  lines.push(`## Per-month detail`);
  for (const r of results) {
    if (r.error) continue;
    lines.push(`### ${r.monthTag}`);
    for (const p of r.perClient) {
      if (p.status === 'canonical') {
        lines.push(`- ✅ ${p.client_name} (source=${p.data_source})`);
      } else if (p.status === 'drift') {
        lines.push(`- ❌ ${p.client_name} (source=${p.data_source})`);
        for (const [f, d] of Object.entries(p.drifts)) {
          lines.push(`    - ${f}: stored=${d.stored} expected=${d.expected} Δ=${d.delta}`);
        }
      } else {
        lines.push(`- — ${p.client_name}: ${p.status}`);
      }
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.join(__dirname, '..', 'logs', `backfill-verification-${FROM}-${TO}-${stamp}.md`);
  fs.writeFileSync(out, lines.join('\n'));
  console.log(`\nWrote: ${out}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
