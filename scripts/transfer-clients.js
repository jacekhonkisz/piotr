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

async function transferClients() {
  console.log('🔄 Transferring clients to jac.honkisz@gmail.com...\n');

  try {
    // Get user IDs
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

    console.log(`From: ${adminUser.email} (${adminUser.id})`);
    console.log(`To: ${jacUser.email} (${jacUser.id})`);

    // Get clients owned by admin@example.com
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .eq('admin_id', adminUser.id);

    if (clientsError) {
      throw clientsError;
    }

    console.log(`\n📋 Found ${clients.length} clients to transfer:`);
    clients.forEach(client => {
      console.log(`  - ${client.name} (${client.email})`);
    });

    // Transfer each client
    for (const client of clients) {
      console.log(`\n🔄 Transferring ${client.name}...`);
      
      const { error: updateError } = await supabase
        .from('clients')
        .update({ admin_id: jacUser.id })
        .eq('id', client.id);

      if (updateError) {
        console.log(`  ❌ Failed: ${updateError.message}`);
      } else {
        console.log(`  ✅ Transferred successfully`);
      }
    }

    // Verify transfer
    console.log('\n✅ Verification:');
    const { data: jacClients, error: verifyError } = await supabase
      .from('clients')
      .select('*')
      .eq('admin_id', jacUser.id);

    if (verifyError) {
      console.log(`❌ Verification failed: ${verifyError.message}`);
    } else {
      console.log(`📋 jac.honkisz@gmail.com now owns ${jacClients.length} clients:`);
      jacClients.forEach(client => {
        console.log(`  - ${client.name} (${client.email})`);
      });
    }

    console.log('\n🎉 Transfer completed!');
    console.log('You can now log in as jac.honkisz@gmail.com and manage these clients.');

  } catch (error) {
    console.error('❌ Error transferring clients:', error.message);
    process.exit(1);
  }
}

transferClients(); 