/** POST-FIX AUDIT: email pipeline data (buildMonthlyReportData, same as scheduler + /api/send-report). */
import 'dotenv/config';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { buildMonthlyReportData } from '../src/lib/monthly-report-data-builder';

async function main() {
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: auth, error } = await anon.auth.signInWithPassword({ email: 'admin@example.com', password: 'password123' });
  if (error || !auth.session) throw new Error('login failed');
  const token = auth.session.access_token;

  const cases: Array<[string, string, string]> = [
    ['Lambert', '2026-06-01', '2026-06-30'],
    ['Arche Nałęczów', '2026-06-01', '2026-06-30'],
  ];
  for (const [name, start, end] of cases) {
    const { data: cs } = await svc
      .from('clients')
      .select('id, name, google_ads_enabled, meta_access_token')
      .ilike('name', `%${name}%`)
      .limit(1);
    const client = cs![0]! as any;
    const r = await buildMonthlyReportData({
      client,
      period: { start, end },
      sessionToken: token,
      reasonPrefix: 'post-fix-audit-email',
    });
    console.log('EMAIL_DATA', client.name, JSON.stringify(r.googleAdsData));
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
