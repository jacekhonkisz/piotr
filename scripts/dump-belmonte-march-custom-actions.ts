/**
 * Sum all offsite_conversion.custom.* action values for Belmonte March 2026 (Meta API).
 * Helps map Ads Manager columns I + K to action_type strings.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { MetaAPIServiceOptimized } from '../src/lib/meta-api-optimized';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const BELMONTE_ID = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
const START = '2026-03-01';
const END = '2026-03-31';

(async () => {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: client } = await s.from('clients').select('system_user_token, meta_access_token, ad_account_id').eq('id', BELMONTE_ID).single();
  const token = client?.system_user_token || client?.meta_access_token;
  let ad = client?.ad_account_id || '';
  if (ad.startsWith('act_')) ad = ad.slice(4);
  const meta = new MetaAPIServiceOptimized(token!);
  meta.clearCache();
  const rows = await meta.getCampaignInsights(ad, START, END, 0);
  const totals = new Map<string, number>();
  for (const r of rows) {
    for (const a of r.actions || []) {
      const t = String(a.action_type || '');
      if (!t.toLowerCase().includes('custom')) continue;
      const v = parseInt(a.value || '0', 10) || 0;
      totals.set(t, (totals.get(t) || 0) + v);
    }
  }
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  console.log('offsite_conversion.custom.* totals (March 2026, all campaigns):\n');
  for (const [t, v] of sorted) {
    console.log(v, '\t', t);
  }
  const pbm = sorted.filter(([t]) => t.includes('1470262077092668') || t.includes('2770488499782793'));
  console.log('\nKnown PBM IDs in list:', pbm);
})();
