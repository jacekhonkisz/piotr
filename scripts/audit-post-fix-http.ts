/**
 * POST-FIX AUDIT (HTTP level): calls the real API route the reports panel uses
 * (/api/fetch-google-ads-live-data on the local dev server) with a real
 * authenticated session, and checks the numbers the client will see.
 *
 * Usage: npx tsx scripts/audit-post-fix-http.ts
 */
import 'dotenv/config';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const BASE = 'http://localhost:3000';

const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

interface Case {
  client: string;
  start: string;
  end: string;
  label: string;
  expect: Partial<Record<string, number>>;
}

const CASES: Case[] = [
  { client: 'Lambert', start: '2026-06-01', end: '2026-06-30', label: 'Lambert June (panel monthly)', expect: { reservations: 46, reservation_value: 193534.41, email_contacts: 43 } },
  { client: 'Lambert', start: '2026-07-01', end: '2026-07-31', label: 'Lambert July (panel monthly)', expect: { reservations: 80, reservation_value: 337403.34 } },
  { client: 'Arche Nałęczów', start: '2026-06-01', end: '2026-06-30', label: 'Arche Nałęczów June (panel monthly)', expect: { email_contacts: 42, reservations: 166 } },
  { client: 'Nickel', start: '2026-06-01', end: '2026-06-30', label: 'Nickel June (panel monthly, sanity)', expect: {} },
  { client: 'Lambert', start: '2026-06-08', end: '2026-06-14', label: 'Lambert week 8-14 June (panel weekly)', expect: {} },
  { client: 'Lambert', start: '2026-08-01', end: '2026-08-03', label: 'Lambert current month August (smart cache)', expect: {} },
];

async function main() {
  const { data: auth, error: authErr } = await anon.auth.signInWithPassword({
    email: 'admin@example.com',
    password: 'password123',
  });
  if (authErr || !auth.session) throw new Error(`login failed: ${authErr?.message}`);
  const token = auth.session.access_token;

  let failures = 0;
  for (const c of CASES) {
    const { data: clients } = await admin.from('clients').select('id, name').ilike('name', `%${c.client}%`).limit(1);
    const client = clients?.[0];
    if (!client) { console.log(`❌ no client ${c.client}`); failures++; continue; }

    const res = await fetch(`${BASE}/api/fetch-google-ads-live-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ clientId: client.id, dateRange: { start: c.start, end: c.end } }),
    });
    const json: any = await res.json().catch(() => ({}));
    const d = json?.data || {};
    const cm = d.conversionMetrics || {};
    const stats = d.stats || {};
    console.log(`\n=== ${c.label} — ${client.name} ${c.start}..${c.end} ===`);
    console.log(`   HTTP ${res.status} | source: ${json?.debug?.source || d?.dataSourceValidation?.actualSource || json?.source || '?'}`);
    console.log(`   spend=${Number(stats.totalSpend || 0).toFixed(2)} rez=${cm.reservations} val=${Number(cm.reservation_value || 0).toFixed(2)} email=${cm.email_contacts} tel=${cm.click_to_call} step1=${cm.booking_step_1}`);
    for (const [k, v] of Object.entries(c.expect)) {
      const actual = Number((cm as any)[k] ?? NaN);
      const ok = Math.abs(actual - Number(v)) <= Math.max(0.51, Number(v) * 0.001);
      if (!ok) failures++;
      console.log(`   ${ok ? '✓' : '❌'} expected ${k}≈${v}, served ${actual}`);
    }
  }
  console.log(`\n${failures === 0 ? '✅ HTTP SERVING AUDIT PASSED' : `❌ ${failures} failures`}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
