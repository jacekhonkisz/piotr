const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables. Please check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDatabase() {
  console.log('🔍 Checking database state...\n');

  try {
    // Get all users
    console.log('📋 Users:');
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) {
      throw usersError;
    }

    users.users.forEach(user => {
      console.log(`  - ${user.email} (ID: ${user.id})`);
    });

    // Get all profiles
    console.log('\n👥 Profiles:');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*');

    if (profilesError) {
      throw profilesError;
    }

    profiles.forEach(profile => {
      console.log(`  - ${profile.email} (Role: ${profile.role})`);
    });

    // Get all clients
    console.log('\n🏢 Clients:');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*');

    if (clientsError) {
      throw clientsError;
    }

    clients.forEach(client => {
      console.log(`  - ${client.name} (${client.email}) - Admin: ${client.admin_id}`);
    });

    // Get all reports
    console.log('\n📊 Reports:');
    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select('*');

    if (reportsError) {
      throw reportsError;
    }

    reports.forEach(report => {
      console.log(`  - Report for client ${report.client_id} (${report.date_range_start} to ${report.date_range_end})`);
    });

  } catch (error) {
    console.error('❌ Error checking database:', error.message);
    process.exit(1);
  }
}

checkDatabase(); 