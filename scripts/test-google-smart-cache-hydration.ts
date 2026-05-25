#!/usr/bin/env npx tsx
import { config } from 'dotenv';

config({ path: '.env.local' });

async function main() {
  const { createClient } = await import('@supabase/supabase-js');
  const { getGoogleAdsSmartCacheData } = await import('../src/lib/google-ads-smart-cache-helper');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const clientName = process.argv[2] || 'Belmonte Hotel';
  const { data: client, error } = await supabase
    .from('clients')
    .select('id,name')
    .eq('name', clientName)
    .single();

  if (error || !client) {
    throw new Error(error?.message || `${clientName} not found`);
  }

  const started = Date.now();
  const result = await getGoogleAdsSmartCacheData(client.id, false);
  const tables = result.data?.googleAdsTables || {};
  const counts = Object.fromEntries(
    Object.entries(tables).map(([key, value]) => [key, Array.isArray(value) ? value.length : typeof value]),
  );

  console.log(JSON.stringify({
    success: result.success,
    source: result.source,
    elapsedMs: Date.now() - started,
    dynKeys: Object.keys(result.data?.dynamicMetricValues || {}).length,
    tableCounts: counts,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
