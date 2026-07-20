const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables. Please check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const ADMIN_EMAIL = 'kontakt@piotrbajerlein.pl';
// Password can be overridden via env; defaults to the requested value.
const ADMIN_PASSWORD = process.env.PIOTR_ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  console.error('❌ PIOTR_ADMIN_PASSWORD environment variable is required');
  process.exit(1);
}
const ADMIN_NAME = 'Piotr Bajerlein';

async function createAdmin() {
  console.log(`🔐 Ensuring admin account for ${ADMIN_EMAIL}...\n`);

  try {
    // Find existing auth user (paginate defensively)
    let existing = null;
    let page = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      existing = data.users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());
      if (existing || data.users.length < 1000) break;
      page += 1;
    }

    let userId;

    if (existing) {
      console.log('ℹ️  Auth user already exists — updating password and confirming email...');
      const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: ADMIN_NAME, role: 'admin' },
      });
      if (error) throw error;
      userId = data.user.id;
      console.log('✅ Auth user updated');
    } else {
      console.log('➕ Creating new auth user...');
      const { data, error } = await supabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: ADMIN_NAME, role: 'admin' },
      });
      if (error) throw error;
      userId = data.user.id;
      console.log('✅ Auth user created');
    }

    console.log('📝 Upserting admin profile (role=admin)...');
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: userId,
          email: ADMIN_EMAIL,
          role: 'admin',
          full_name: ADMIN_NAME,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

    if (profileError) throw profileError;
    console.log('✅ Admin profile ready');

    console.log('🔁 Assigning existing clients to this admin...');
    const { data: reassignedClients, error: clientsError } = await supabase
      .from('clients')
      .update({ admin_id: userId })
      .neq('admin_id', userId)
      .select('id');

    if (clientsError) throw clientsError;
    console.log(`✅ Assigned ${reassignedClients?.length || 0} existing client(s) to this admin`);

    console.log('\n🎉 Done!');
    console.log('📋 Admin credentials:');
    console.log(`   Email:    ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log('\n⚠️  This password is weak — change it after first login.');
  } catch (error) {
    console.error('❌ Failed to create admin:', error.message || error);
    process.exit(1);
  }
}

createAdmin();
