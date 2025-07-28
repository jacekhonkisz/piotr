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

async function testAdminPermissions() {
  console.log('🧪 Testing admin permissions...\n');

  try {
    // Get all users
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) {
      throw usersError;
    }

    // Find admin users
    const adminUsers = users.users.filter(user => 
      user.email === 'admin@example.com' || user.email === 'jac.honkisz@gmail.com'
    );

    console.log('🔍 Admin users found:');
    adminUsers.forEach(user => {
      console.log(`  - ${user.email} (ID: ${user.id})`);
    });

    // Check profiles for admin users
    console.log('\n👥 Admin profiles:');
    for (const user of adminUsers) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.log(`  ❌ ${user.email}: Profile error - ${profileError.message}`);
      } else {
        console.log(`  ✅ ${user.email}: Role = ${profile.role}`);
      }
    }

    // Check clients owned by each admin
    console.log('\n🏢 Clients by admin:');
    for (const user of adminUsers) {
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .eq('admin_id', user.id);

      if (clientsError) {
        console.log(`  ❌ ${user.email}: Clients error - ${clientsError.message}`);
      } else {
        console.log(`  📋 ${user.email}: ${clients.length} clients`);
        clients.forEach(client => {
          console.log(`    - ${client.name} (${client.email}) - ID: ${client.id}`);
        });
      }
    }

    // Test client deletion for each admin
    console.log('\n🗑️ Testing client deletion permissions:');
    for (const user of adminUsers) {
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .eq('admin_id', user.id)
        .limit(1);

      if (clientsError || !clients.length) {
        console.log(`  ⚠️ ${user.email}: No clients to test deletion`);
        continue;
      }

      const testClient = clients[0];
      console.log(`  🧪 ${user.email}: Testing deletion of ${testClient.name} (${testClient.id})`);

      // Try to delete the client (we'll restore it immediately)
      const { error: deleteError } = await supabase
        .from('clients')
        .delete()
        .eq('id', testClient.id);

      if (deleteError) {
        console.log(`    ❌ Delete failed: ${deleteError.message}`);
      } else {
        console.log(`    ✅ Delete successful`);
        
        // Restore the client
        const { error: restoreError } = await supabase
          .from('clients')
          .insert(testClient);

        if (restoreError) {
          console.log(`    ⚠️ Restore failed: ${restoreError.message}`);
        } else {
          console.log(`    ✅ Client restored`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error testing admin permissions:', error.message);
    process.exit(1);
  }
}

testAdminPermissions();