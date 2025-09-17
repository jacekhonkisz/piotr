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

async function fixUserRoles() {
  console.log('🔧 Fixing user roles...\n');

  try {
    // Get all users
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) {
      throw usersError;
    }

    const adminUser = users.users.find(u => u.email === 'admin@example.com');
    const jacUser = users.users.find(u => u.email === 'jac.honkisz@gmail.com');

    if (!adminUser || !jacUser) {
      console.log('❌ Could not find required users');
      return;
    }

    console.log('📋 Current users:');
    console.log(`  - ${adminUser.email} (ID: ${adminUser.id})`);
    console.log(`  - ${jacUser.email} (ID: ${jacUser.id})`);

    // Fix admin@example.com role (ensure it's admin)
    console.log('\n🔧 Fixing admin@example.com role...');
    const { error: adminProfileError } = await supabase
      .from('profiles')
      .upsert({
        id: adminUser.id,
        email: adminUser.email,
        role: 'admin',
        full_name: 'Admin User'
      });

    if (adminProfileError) {
      console.log(`❌ Failed to fix admin role: ${adminProfileError.message}`);
    } else {
      console.log('✅ admin@example.com role set to admin');
    }

    // Fix jac.honkisz@gmail.com role (make it client)
    console.log('\n🔧 Fixing jac.honkisz@gmail.com role...');
    const { error: jacProfileError } = await supabase
      .from('profiles')
      .upsert({
        id: jacUser.id,
        email: jacUser.email,
        role: 'client',
        full_name: 'Jacek Honkisz'
      });

    if (jacProfileError) {
      console.log(`❌ Failed to fix jac role: ${jacProfileError.message}`);
    } else {
      console.log('✅ jac.honkisz@gmail.com role set to client');
    }

    // Transfer all clients back to admin@example.com
    console.log('\n🔄 Transferring all clients to admin@example.com...');
    const { data: allClients, error: clientsError } = await supabase
      .from('clients')
      .select('*');

    if (clientsError) {
      throw clientsError;
    }

    for (const client of allClients) {
      console.log(`🔄 Transferring ${client.name} to admin@example.com...`);
      
      const { error: updateError } = await supabase
        .from('clients')
        .update({ admin_id: adminUser.id })
        .eq('id', client.id);

      if (updateError) {
        console.log(`  ❌ Failed: ${updateError.message}`);
      } else {
        console.log(`  ✅ Transferred successfully`);
      }
    }

    // Verify final state
    console.log('\n✅ Final verification:');
    
    // Check profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*');

    if (!profilesError) {
      profiles.forEach(profile => {
        console.log(`  - ${profile.email}: ${profile.role}`);
      });
    }

    // Check clients
    const { data: finalClients, error: finalClientsError } = await supabase
      .from('clients')
      .select('*');

    if (!finalClientsError) {
      console.log('\n📋 Clients owned by admin@example.com:');
      finalClients.forEach(client => {
        console.log(`  - ${client.name} (${client.email})`);
      });
    }

    console.log('\n🎉 User roles fixed successfully!');
    console.log('\n📋 Final credentials:');
    console.log('Admin: admin@example.com / password123');
    console.log('Client: jac.honkisz@gmail.com / password123');
    console.log('Client: client@example.com / password123');

  } catch (error) {
    console.error('❌ Error fixing user roles:', error.message);
    process.exit(1);
  }
}

fixUserRoles(); 