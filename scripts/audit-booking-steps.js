/* eslint-disable no-console */
/**
 * Audit booking step config consistency across all clients.
 *
 * Reads Supabase credentials from `.env.local` and queries:
 * - `clients`
 * - `client_dashboard_config`
 *
 * Outputs a JSON summary:
 * - counts
 * - missing booking step keys in charts config (meta/google)
 * - label mismatches for booking steps (meta/google)
 */

require('dotenv').config({ path: '.env.local', quiet: true });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const BOOKING_KEYS = ['booking_step_1', 'booking_step_2', 'booking_step_3'];
const EXPECTED_NAMES = {
  booking_step_1: 'Pozyskane leady',
  booking_step_2: 'Wyświetlenia zawartości',
  booking_step_3: 'Inicjacje kasy',
};

function chartIndex(metrics) {
  const idx = new Map();
  for (const it of Array.isArray(metrics) ? metrics : []) {
    if (it && it.section === 'charts' && typeof it.key === 'string') {
      idx.set(it.key, it);
    }
  }
  return idx;
}

async function main() {
  const { data: clients, error: clientsError } = await sb
    .from('clients')
    .select('id,name,email,admin_id')
    .order('name');
  if (clientsError) throw clientsError;

  const ids = (clients || []).map((c) => c.id);

  const { data: cfgs, error: cfgError } = await sb
    .from('client_dashboard_config')
    .select(
      'client_id,meta_metrics_config,google_metrics_config,metrics_config,meta_enabled,google_enabled,updated_at'
    )
    .in('client_id', ids);
  if (cfgError) throw cfgError;

  const cfgMap = new Map((cfgs || []).map((c) => [c.client_id, c]));

  const rows = [];
  for (const c of clients || []) {
    const cfg = cfgMap.get(c.id);
    const metaRaw = cfg?.meta_metrics_config || cfg?.metrics_config || null;
    const googleRaw = cfg?.google_metrics_config || null;

    const metaIdx = chartIndex(metaRaw);
    const googleIdx = chartIndex(googleRaw);

    const row = {
      id: c.id,
      name: c.name,
      legacy: Boolean(cfg?.metrics_config && !cfg?.meta_metrics_config),
      metaEnabled: cfg?.meta_enabled ?? true,
      googleEnabled: cfg?.google_enabled ?? true,
      meta: {},
      google: {},
    };

    for (const k of BOOKING_KEYS) {
      const m = metaIdx.get(k);
      const g = googleIdx.get(k);
      row.meta[k] = {
        present: Boolean(m),
        visible: Boolean(m?.visible),
        name: m ? m.customName || m.defaultName || null : null,
      };
      row.google[k] = {
        present: Boolean(g),
        visible: Boolean(g?.visible),
        name: g ? g.customName || g.defaultName || null : null,
      };
    }

    rows.push(row);
  }

  const problems = [];
  for (const r of rows) {
    for (const k of BOOKING_KEYS) {
      const expected = EXPECTED_NAMES[k];
      const m = r.meta[k];
      const g = r.google[k];

      if (!m.present) problems.push({ hotel: r.name, platform: 'meta', key: k, issue: 'missing' });
      if (!g.present) problems.push({ hotel: r.name, platform: 'google', key: k, issue: 'missing' });

      if (m.present && m.name && m.name !== expected) {
        problems.push({ hotel: r.name, platform: 'meta', key: k, issue: `name_mismatch:${m.name}` });
      }
      if (g.present && g.name && g.name !== expected) {
        problems.push({ hotel: r.name, platform: 'google', key: k, issue: `name_mismatch:${g.name}` });
      }
    }
  }

  const missing = problems.filter((p) => p.issue === 'missing');
  const nameMismatches = problems.filter((p) => p.issue.startsWith('name_mismatch:'));

  const out = {
    counts: {
      totalClients: rows.length,
      legacyConfigClients: rows.filter((r) => r.legacy).length,
      metaEnabledClients: rows.filter((r) => r.metaEnabled).length,
      googleEnabledClients: rows.filter((r) => r.googleEnabled).length,
    },
    missingCount: missing.length,
    nameMismatchCount: nameMismatches.length,
    missing,
    nameMismatches,
    // Helpful for manual spot-checks:
    perClient: rows,
  };

  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

