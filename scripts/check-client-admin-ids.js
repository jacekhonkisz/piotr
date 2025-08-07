require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkClientAdminIds() {
  console.log('🔍 CHECKING CLIENT ADMIN IDs\n');
  console.log('='.repeat(50));

  try {
    // Get all clients with their admin information
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select(`
        id,
        name,
        email,
        company,
        ad_account_id,
        admin_id,
        api_status,
        created_at
      `)
      .order('created_at', { ascending: false });

    if (clientsError) {
      console.error('❌ Error fetching clients:', clientsError);
      return;
    }

    console.log(`📊 Found ${clients.length} clients:\n`);

    // Get all admin users
    const { data: admins, error: adminsError } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('role', 'admin');

    if (adminsError) {
      console.error('❌ Error fetching admins:', adminsError);
      return;
    }

    console.log('👥 Admin users:');
    admins.forEach(admin => {
      console.log(`   - ${admin.email} (ID: ${admin.id})`);
    });
    console.log('');

    // Display clients with their admin info
    clients.forEach((client, index) => {
      console.log(`${index + 1}. ${client.name} (${client.email})`);
      console.log(`   ID: ${client.id}`);
      console.log(`   Company: ${client.company || 'N/A'}`);
      console.log(`   Ad Account: ${client.ad_account_id}`);
      console.log(`   Admin ID: ${client.admin_id}`);
      console.log(`   API Status: ${client.api_status}`);
      console.log(`   Created: ${client.created_at}`);
      
      // Find the admin name
      const admin = admins.find(a => a.id === client.admin_id);
      if (admin) {
        console.log(`   Admin: ${admin.email}`);
      } else {
        console.log(`   ❌ Admin not found for ID: ${client.admin_id}`);
      }
      console.log('');
    });

    // Check which admin is currently logged in (assuming jacek)
    console.log('🔍 Current admin session check:');
    const jacekAdmin = admins.find(a => a.email === 'jac.honkisz@gmail.com');
    if (jacekAdmin) {
      console.log(`✅ jacek admin found: ${jacekAdmin.email} (ID: ${jacekAdmin.id})`);
      
      const jacekClients = clients.filter(c => c.admin_id === jacekAdmin.id);
      console.log(`📊 jacek has ${jacekClients.length} clients:`);
      jacekClients.forEach(client => {
        console.log(`   - ${client.name} (${client.email})`);
      });
    } else {
      console.log('❌ jacek admin not found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the function
checkClientAdminIds().catch(console.error); 