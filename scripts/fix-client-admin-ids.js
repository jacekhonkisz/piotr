require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixClientAdminIds() {
  console.log('🔧 FIXING CLIENT ADMIN IDs\n');
  console.log('='.repeat(50));

  try {
    // Get the existing admin user
    const { data: existingAdmin, error: adminError } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('email', 'admin@example.com')
      .single();

    if (adminError || !existingAdmin) {
      console.error('❌ Existing admin not found:', adminError);
      return;
    }

    console.log('✅ Found existing admin:', existingAdmin.email, `(ID: ${existingAdmin.id})`);

    // Get the clients that need to be fixed (Havet and Belmonte)
    const { data: clientsToFix, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email, admin_id')
      .in('name', ['Havet', 'Belmonte Hotel']);

    if (clientsError) {
      console.error('❌ Error fetching clients to fix:', clientsError);
      return;
    }

    console.log(`📊 Found ${clientsToFix.length} clients to fix:`);
    clientsToFix.forEach(client => {
      console.log(`   - ${client.name} (${client.email}) - Current Admin ID: ${client.admin_id}`);
    });

    // Update the admin_id for these clients
    const { data: updatedClients, error: updateError } = await supabase
      .from('clients')
      .update({ admin_id: existingAdmin.id })
      .in('name', ['Havet', 'Belmonte Hotel'])
      .select('id, name, email, admin_id');

    if (updateError) {
      console.error('❌ Error updating clients:', updateError);
      return;
    }

    console.log('\n✅ Successfully updated clients:');
    updatedClients.forEach(client => {
      console.log(`   - ${client.name} (${client.email}) - New Admin ID: ${client.admin_id}`);
    });

    // Verify the fix
    console.log('\n🔍 Verifying the fix...');
    const { data: allClients, error: verifyError } = await supabase
      .from('clients')
      .select(`
        id,
        name,
        email,
        admin_id,
        api_status
      `)
      .order('name');

    if (verifyError) {
      console.error('❌ Error verifying:', verifyError);
      return;
    }

    console.log('\n📊 All clients after fix:');
    allClients.forEach((client, index) => {
      console.log(`${index + 1}. ${client.name} (${client.email})`);
      console.log(`   Admin ID: ${client.admin_id}`);
      console.log(`   API Status: ${client.api_status}`);
      console.log('');
    });

    // Check which clients belong to the existing admin
    const adminClients = allClients.filter(c => c.admin_id === existingAdmin.id);
    console.log(`🎯 Clients belonging to ${existingAdmin.email}: ${adminClients.length}`);
    adminClients.forEach(client => {
      console.log(`   - ${client.name} (${client.email})`);
    });

    console.log('\n✅ Fix completed! The admin panel should now show all 4 clients.');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the function
fixClientAdminIds().catch(console.error); 