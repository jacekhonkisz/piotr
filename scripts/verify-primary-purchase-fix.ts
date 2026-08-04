/**
 * Verify the primary-purchase reservation rule + broadened e-mail matcher
 * through the production getCampaignData path.
 *
 * Usage: npx tsx scripts/verify-primary-purchase-fix.ts "<client pattern>" <start> <end>
 */
import 'dotenv/config';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from '../src/lib/google-ads-api';
import { loadClientConversionMappings } from '../src/lib/client-conversion-mappings-server';

dotenv.config({ path: '.env.local' });

async function main() {
  const [pattern, start, end] = process.argv.slice(2);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, google_ads_customer_id')
    .ilike('name', `%${pattern}%`)
    .limit(1);
  const client = clients?.[0];
  if (!client) throw new Error(`No client matching ${pattern}`);

  const { data: settingsRows } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', [
      'google_ads_client_id',
      'google_ads_client_secret',
      'google_ads_developer_token',
      'google_ads_manager_refresh_token',
      'google_ads_manager_customer_id',
    ]);
  const settings = Object.fromEntries((settingsRows || []).map((s: any) => [s.key, s.value])) as Record<string, string>;
  const mappings = await loadClientConversionMappings(client.id as string);

  const svc = new GoogleAdsAPIService({
    refreshToken: settings.google_ads_manager_refresh_token,
    clientId: settings.google_ads_client_id,
    clientSecret: settings.google_ads_client_secret,
    developmentToken: settings.google_ads_developer_token,
    customerId: client.google_ads_customer_id as string,
    managerCustomerId: settings.google_ads_manager_customer_id,
    conversionMappings: mappings,
  } as any);

  const campaigns: any[] = await svc.getCampaignData(start!, end!);
  const totals = campaigns.reduce(
    (a, c) => ({
      reservations: a.reservations + (c.reservations || 0),
      reservation_value: a.reservation_value + (c.reservation_value || 0),
      email_contacts: a.email_contacts + (c.email_contacts || 0),
      click_to_call: a.click_to_call + (c.click_to_call || 0),
    }),
    { reservations: 0, reservation_value: 0, email_contacts: 0, click_to_call: 0 }
  );

  console.log(`\n=== ${client.name} — ${start} → ${end} (production getCampaignData path) ===`);
  console.log(`reservations:      ${totals.reservations}`);
  console.log(`reservation_value: ${totals.reservation_value.toFixed(2)}`);
  console.log(`email_contacts:    ${totals.email_contacts}`);
  console.log(`click_to_call:     ${totals.click_to_call}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
