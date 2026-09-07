#!/usr/bin/env node
/**
 * Verifies that /api/generate-pdf accepts the scheduler's service-role token.
 *
 * Reproduces exactly what EmailScheduler.generatePdfBuffer does, without
 * sending any email. Pass a client name substring to target one client.
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const APP_URL = process.env.VERIFY_APP_URL || 'https://www.pbmreports.pl';
const PERIOD = { start: '2026-08-01', end: '2026-08-31' };

async function main() {
  const nameFilter = process.argv[2];

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY.trim()
  );

  let query = supabase
    .from('clients')
    .select('id,name')
    .eq('api_status', 'valid')
    .neq('reporting_frequency', 'on_demand');
  if (nameFilter) query = query.ilike('name', `%${nameFilter}%`);

  const { data: clients, error } = await query.limit(1);
  if (error) throw new Error(`Client lookup failed: ${error.message}`);
  if (!clients?.length) throw new Error('No matching client found');

  const client = clients[0];
  console.log(`Client : ${client.name} (${client.id})`);
  console.log(`Period : ${PERIOD.start} .. ${PERIOD.end}`);
  console.log(`Target : ${APP_URL}/api/generate-pdf\n`);

  const started = Date.now();
  const response = await fetch(`${APP_URL}/api/generate-pdf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY.trim()}`,
    },
    body: JSON.stringify({ clientId: client.id, dateRange: PERIOD }),
  });

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`HTTP ${response.status} in ${elapsed}s`);

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    console.log(`FAILED: ${details.slice(0, 500)}`);
    process.exit(1);
  }

  const bytes = (await response.arrayBuffer()).byteLength;
  console.log(`PDF OK : ${(bytes / 1024).toFixed(0)} KB`);
  console.log('\nService-role authentication is working.');
}

main().catch(err => {
  console.error('Verification failed:', err.message);
  process.exit(1);
});
