#!/usr/bin/env node
/**
 * Re-sends the August 2026 monthly reports that failed on 2026-09-05.
 *
 * Uses the production /api/admin/send-manual-report endpoint so the emails go
 * through exactly the same path as a scheduled send. Review mode is expected to
 * be ON, which routes every message to the internal review recipients instead
 * of the real clients — the script refuses to run otherwise.
 *
 * Usage:
 *   node scripts/resend-august-reports-to-review.js            # dry run
 *   node scripts/resend-august-reports-to-review.js --send     # send all
 *   node scripts/resend-august-reports-to-review.js --send --only "Lambert"
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const APP_URL = process.env.VERIFY_APP_URL || 'https://www.pbmreports.pl';
const ADMIN_EMAIL = 'kontakt@piotrbajerlein.pl';
const PERIOD = { start: '2026-08-01', end: '2026-08-31' };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim();

const args = process.argv.slice(2);
const shouldSend = args.includes('--send');
const onlyIndex = args.indexOf('--only');
const onlyFilter = onlyIndex !== -1 ? args[onlyIndex + 1] : null;

/** Mint an admin access token without a password, using the service role key. */
async function mintAdminToken(admin) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: ADMIN_EMAIL,
  });
  if (error) throw new Error(`generateLink failed: ${error.message}`);

  const tokenHash = data?.properties?.hashed_token;
  if (!tokenHash) throw new Error('generateLink returned no hashed_token');

  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: verified, error: verifyError } = await anon.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'email',
  });
  if (verifyError) throw new Error(`verifyOtp failed: ${verifyError.message}`);

  const token = verified?.session?.access_token;
  if (!token) throw new Error('verifyOtp returned no session');
  return token;
}

async function main() {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: reviewSetting } = await admin
    .from('settings')
    .select('value')
    .eq('key', 'email_review_mode')
    .maybeSingle();
  const reviewMode = reviewSetting ? reviewSetting.value === 'true' : true;

  console.log(`Review mode : ${reviewMode ? 'ON (emails go to review)' : 'OFF'}`);
  if (!reviewMode) {
    throw new Error('Review mode is OFF - refusing to run, real clients would be emailed');
  }

  let query = admin
    .from('clients')
    .select('id,name')
    .eq('api_status', 'valid')
    .neq('reporting_frequency', 'on_demand')
    .order('name');
  if (onlyFilter) query = query.ilike('name', `%${onlyFilter}%`);

  const { data: clients, error } = await query;
  if (error) throw new Error(`Client lookup failed: ${error.message}`);

  console.log(`Period      : ${PERIOD.start} .. ${PERIOD.end}`);
  console.log(`Clients     : ${clients.length}`);
  console.log(`Mode        : ${shouldSend ? 'SEND' : 'DRY RUN (pass --send to send)'}\n`);

  if (!shouldSend) {
    clients.forEach((c, i) => console.log(`  ${i + 1}. ${c.name}`));
    return;
  }

  const token = await mintAdminToken(admin);
  console.log('Minted admin access token\n');

  const results = [];
  for (const [index, client] of clients.entries()) {
    const label = `[${index + 1}/${clients.length}] ${client.name}`;
    const started = Date.now();

    try {
      const response = await fetch(`${APP_URL}/api/admin/send-manual-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ clientId: client.id, period: PERIOD }),
      });

      const elapsed = ((Date.now() - started) / 1000).toFixed(0);
      const payload = await response.json().catch(() => ({}));

      if (response.ok && payload.success) {
        console.log(`${label} - sent in ${elapsed}s`);
        results.push({ client: client.name, ok: true });
      } else {
        const reason = payload.error || `HTTP ${response.status}`;
        console.log(`${label} - FAILED in ${elapsed}s: ${reason}`);
        results.push({ client: client.name, ok: false, reason });
      }
    } catch (err) {
      console.log(`${label} - ERROR: ${err.message}`);
      results.push({ client: client.name, ok: false, reason: err.message });
    }
  }

  const ok = results.filter(r => r.ok).length;
  console.log(`\nSent ${ok}/${results.length}`);
  results.filter(r => !r.ok).forEach(r => console.log(`  failed: ${r.client} - ${r.reason}`));
  if (ok !== results.length) process.exitCode = 1;
}

main().catch(err => {
  console.error('Resend failed:', err.message);
  process.exit(1);
});
