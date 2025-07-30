const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function transferClients() {
  console.log('🔄 Starting client transfer...');
  
  try {
    // Get the specific user IDs we need
    const sourceAdminId = '410483f9-cd02-432f-8e0b-7e8a8cd33a54'; // jac.honkisz@gmail.com
    const targetAdminId = '585b6abc-05ef-47aa-b289-e47a52ccdc6b'; // admin@example.com

    console.log(`🔄 Transferring clients from ${sourceAdminId} to ${targetAdminId}...`);

    // Get all clients owned by the source admin
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .eq('admin_id', sourceAdminId);

    if (clientsError) {
      console.error('❌ Error fetching clients:', clientsError);
      return;
    }

    if (clients.length === 0) {
      console.log('ℹ️ No clients found to transfer');
      return;
    }

    console.log(`📋 Found ${clients.length} clients to transfer:`);
    clients.forEach(client => {
      console.log(`   - ${client.name} (${client.email})`);
    });

    // Transfer each client
    let transferredCount = 0;
    for (const client of clients) {
      console.log(`\n🔄 Transferring ${client.name}...`);
      
      const { error: updateError } = await supabase
        .from('clients')
        .update({ admin_id: targetAdminId })
        .eq('id', client.id);

      if (updateError) {
        console.error(`❌ Error transferring ${client.name}:`, updateError);
      } else {
        console.log(`✅ Successfully transferred ${client.name}`);
        transferredCount++;
      }
    }

    console.log(`\n🎉 Transfer complete! ${transferredCount}/${clients.length} clients transferred successfully.`);

    // Verify the transfer
    console.log('\n🔍 Verifying transfer...');
    const { data: targetClients, error: verifyError } = await supabase
      .from('clients')
      .select('name, email')
      .eq('admin_id', targetAdminId);

    if (verifyError) {
      console.error('❌ Error verifying transfer:', verifyError);
    } else {
      console.log(`✅ Target admin now has ${targetClients.length} clients:`);
      targetClients.forEach(client => {
        console.log(`   - ${client.name} (${client.email})`);
      });
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

transferClients(); 