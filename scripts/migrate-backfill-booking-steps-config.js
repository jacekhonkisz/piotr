/* eslint-disable no-console */
/**
 * Migration: ensure every client has `client_dashboard_config` row
 * and booking step chart metrics exist for both Meta and Google.
 *
 * Why:
 * - In the current DB, `client_dashboard_config` may be empty or partial.
 * - UI merges saved configs with defaults, so we can store only the missing items
 *   and still get full configuration via `mergeWithDefaults`.
 *
 * Usage:
 * - Dry run (default): `node scripts/migrate-backfill-booking-steps-config.js`
 * - Apply changes:     `node scripts/migrate-backfill-booking-steps-config.js --apply`
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

const APPLY = process.argv.includes('--apply');

const BOOKING_STEP_ITEMS = [
  {
    key: 'booking_step_1',
    section: 'charts',
    defaultName: 'Pozyskane leady',
    customName: null,
    visible: true,
    order: 0,
    format: 'number',
    description: 'Booking step 1 — wyszukiwania / leady',
  },
  {
    key: 'booking_step_2',
    section: 'charts',
    defaultName: 'Wyświetlenia zawartości',
    customName: null,
    visible: true,
    order: 1,
    format: 'number',
    description: 'Booking step 2 — wyświetlenia zawartości',
  },
  {
    key: 'booking_step_3',
    section: 'charts',
    defaultName: 'Inicjacje kasy',
    customName: null,
    visible: true,
    order: 2,
    format: 'number',
    description: 'Booking step 3 — zainicjowane przejścia do kasy',
  },
];

function isArray(x) {
  return Array.isArray(x);
}

function ensureBookingStepsInCharts(metricsConfig) {
  const list = isArray(metricsConfig) ? metricsConfig.slice() : [];

  const hasKey = new Set(
    list
      .filter((m) => m && m.section === 'charts' && typeof m.key === 'string')
      .map((m) => m.key)
  );

  // Keep existing items untouched; only append missing booking steps.
  // We set a stable order for new items by placing them at the end,
  // with an order greater than any existing charts item.
  const maxChartsOrder = list.reduce((mx, m) => {
    if (!m || m.section !== 'charts') return mx;
    const o = Number(m.order);
    return Number.isFinite(o) ? Math.max(mx, o) : mx;
  }, -1);

  let added = 0;
  for (let i = 0; i < BOOKING_STEP_ITEMS.length; i++) {
    const it = BOOKING_STEP_ITEMS[i];
    if (hasKey.has(it.key)) continue;
    list.push({ ...it, order: maxChartsOrder + 1 + i });
    added++;
  }

  return { list, added };
}

async function main() {
  const { data: clients, error: clientsError } = await sb
    .from('clients')
    .select('id,name')
    .order('name');
  if (clientsError) throw clientsError;

  const ids = (clients || []).map((c) => c.id);
  if (!ids.length) {
    console.log('No clients found.');
    return;
  }

  const { data: cfgs, error: cfgError } = await sb
    .from('client_dashboard_config')
    .select('client_id,meta_metrics_config,google_metrics_config,meta_enabled,google_enabled')
    .in('client_id', ids);
  if (cfgError) throw cfgError;

  const cfgMap = new Map((cfgs || []).map((c) => [c.client_id, c]));

  let wouldInsert = 0;
  let wouldUpdate = 0;
  let metaAddedTotal = 0;
  let googleAddedTotal = 0;

  const upserts = [];

  for (const client of clients || []) {
    const existing = cfgMap.get(client.id);

    const metaExisting = existing?.meta_metrics_config;
    const googleExisting = existing?.google_metrics_config;

    const metaEnsured = ensureBookingStepsInCharts(metaExisting);
    const googleEnsured = ensureBookingStepsInCharts(googleExisting);

    const isNewRow = !existing;
    const changed = isNewRow || metaEnsured.added > 0 || googleEnsured.added > 0;

    if (!changed) continue;

    if (isNewRow) wouldInsert++;
    else wouldUpdate++;

    metaAddedTotal += metaEnsured.added;
    googleAddedTotal += googleEnsured.added;

    upserts.push({
      client_id: client.id,
      meta_metrics_config: metaEnsured.list,
      google_metrics_config: googleEnsured.list,
      meta_enabled: existing?.meta_enabled ?? true,
      google_enabled: existing?.google_enabled ?? true,
    });
  }

  console.log(
    JSON.stringify(
      {
        apply: APPLY,
        clients: ids.length,
        existingConfigRows: (cfgs || []).length,
        wouldInsert,
        wouldUpdate,
        metaBookingItemsAdded: metaAddedTotal,
        googleBookingItemsAdded: googleAddedTotal,
      },
      null,
      2
    )
  );

  if (!APPLY) {
    console.log('Dry run only. Re-run with --apply to write changes.');
    return;
  }

  // Write in chunks to avoid request limits
  const CHUNK = 100;
  for (let i = 0; i < upserts.length; i += CHUNK) {
    const chunk = upserts.slice(i, i + CHUNK);
    const { error } = await sb
      .from('client_dashboard_config')
      .upsert(chunk, { onConflict: 'client_id' });
    if (error) throw error;
  }

  console.log(`✅ Applied upserts: ${upserts.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

