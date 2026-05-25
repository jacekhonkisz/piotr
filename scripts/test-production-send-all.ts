/**
 * Calls the PRODUCTION /api/send-report endpoint for each client.
 * Same exact flow as the admin calendar "Wyślij" button.
 * Review mode redirects to EMAIL_REVIEW_RECIPIENT (jac.honkisz@gmail.com).
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function run() {
  const anonSb = createClient(SUPABASE_URL, ANON_KEY);
  const { data: session, error: loginErr } = await anonSb.auth.signInWithPassword({
    email: 'admin@example.com',
    password: 'password123'
  });
  if (loginErr || !session.session) {
    console.error('Login failed:', loginErr?.message);
    process.exit(1);
  }
  const token = session.session.access_token;
  console.log('✅ Logged in as admin\n');

  const serviceSb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: clients } = await serviceSb
    .from('clients')
    .select('id, name')
    .eq('admin_id', session.user.id);

  if (!clients?.length) {
    console.log('No clients found');
    process.exit(0);
  }

  console.log(`Found ${clients.length} clients. Sending via production /api/send-report...\n`);

  for (const client of clients) {
    console.log(`📧 ${client.name}...`);
    try {
      const res = await fetch(`${APP_URL}/api/send-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          clientId: client.id,
          includePdf: true
        })
      });

      const data = await res.json();
      if (data.success) {
        console.log(`   ✅ Sent (${data.details?.successful?.join(', ') || 'ok'})`);
      } else {
        console.log(`   ❌ Failed: ${data.error || data.details || JSON.stringify(data)}`);
      }
    } catch (err: any) {
      console.log(`   ❌ Error: ${err.message}`);
    }
  }

  console.log('\n🏁 Done.');
}

run();
