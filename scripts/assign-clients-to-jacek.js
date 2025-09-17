const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function assignClientsToJacek() {
  try {
    console.log('🔍 Finding and assigning clients to jacek...\n');

    // Get jacek's user ID
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('❌ Error listing users:', usersError);
      return;
    }

    const jacek = users.find(u => u.email === 'jac.honkisz@gmail.com');
    
    if (!jacek) {
      console.log('❌ jacek user not found');
      return;
    }

    console.log(`📋 Found jacek: ${jacek.email} (${jacek.id})`);

    // Get all clients
    const { data: allClients, error: clientsError } = await supabase
      .from('clients')
      .select('*');

    if (clientsError) {
      console.error('❌ Error fetching clients:', clientsError);
      return;
    }

    console.log(`\n📊 Found ${allClients.length} total clients:`);
    allClients.forEach(client => {
      console.log(`   - ${client.name} (${client.email}) - Admin: ${client.admin_id}`);
    });

    // Find clients that need to be assigned to jacek
    const unassignedClients = allClients.filter(client => !client.admin_id);
    const otherAdminClients = allClients.filter(client => client.admin_id && client.admin_id !== jacek.id);

    console.log(`\n🔍 Analysis:`);
    console.log(`   - Unassigned clients: ${unassignedClients.length}`);
    console.log(`   - Clients owned by other admins: ${otherAdminClients.length}`);
    console.log(`   - Clients owned by jacek: ${allClients.filter(c => c.admin_id === jacek.id).length}`);

    // Assign unassigned clients to jacek
    if (unassignedClients.length > 0) {
      console.log(`\n🔄 Assigning ${unassignedClients.length} unassigned clients to jacek...`);
      
      for (const client of unassignedClients) {
        const { error: updateError } = await supabase
          .from('clients')
          .update({ admin_id: jacek.id })
          .eq('id', client.id);

        if (updateError) {
          console.log(`   ❌ Failed to assign ${client.name}: ${updateError.message}`);
        } else {
          console.log(`   ✅ Assigned ${client.name} to jacek`);
        }
      }
    }

    // Transfer clients from other admins to jacek
    if (otherAdminClients.length > 0) {
      console.log(`\n🔄 Transferring ${otherAdminClients.length} clients from other admins to jacek...`);
      
      for (const client of otherAdminClients) {
        const { error: updateError } = await supabase
          .from('clients')
          .update({ admin_id: jacek.id })
          .eq('id', client.id);

        if (updateError) {
          console.log(`   ❌ Failed to transfer ${client.name}: ${updateError.message}`);
        } else {
          console.log(`   ✅ Transferred ${client.name} to jacek`);
        }
      }
    }

    // Verify final state
    console.log('\n✅ Final verification:');
    const { data: jacekClients, error: verifyError } = await supabase
      .from('clients')
      .select('*')
      .eq('admin_id', jacek.id);

    if (verifyError) {
      console.log(`❌ Verification failed: ${verifyError.message}`);
    } else {
      console.log(`📋 jacek now owns ${jacekClients.length} clients:`);
      jacekClients.forEach(client => {
        console.log(`   - ${client.name} (${client.email})`);
      });
    }

    console.log('\n🎉 Assignment completed!');
    console.log('jacek can now log in and see his clients in the dashboard.');

  } catch (error) {
    console.error('❌ Error assigning clients:', error);
  }
}

assignClientsToJacek(); 