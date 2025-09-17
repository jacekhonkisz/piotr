const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function assignClientToAdmin() {
  console.log('🔧 Assigning client to admin user...\n');

  try {
    // Get the admin user
    const { data: adminUser, error: adminError } = await supabase.auth.admin.listUsers();
    
    if (adminError) {
      console.error('❌ Error fetching admin user:', adminError);
      return;
    }

    const admin = adminUser.users.find(u => u.email === 'admin@example.com');
    if (!admin) {
      console.error('❌ Admin user not found');
      return;
    }

    console.log(`👤 Admin user: ${admin.email} (ID: ${admin.id})`);

    // Get all clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*');

    if (clientsError) {
      console.error('❌ Error fetching clients:', clientsError);
      return;
    }

    console.log(`📊 Found ${clients.length} clients:`);
    clients.forEach((client, index) => {
      console.log(`   ${index + 1}. ${client.name} (${client.email}) - ID: ${client.id}`);
    });

    // Find the Havet client (which has conversion data)
    const havetClient = clients.find(c => c.email === 'havet@magialubczyku.pl');
    
    if (!havetClient) {
      console.error('❌ Havet client not found');
      return;
    }

    console.log(`\n🎯 Assigning Havet client to admin...`);
    console.log(`   Client: ${havetClient.name} (${havetClient.email})`);
    console.log(`   Client ID: ${havetClient.id}`);

    // Update the client to assign admin_id
    const { error: updateError } = await supabase
      .from('clients')
      .update({ admin_id: admin.id })
      .eq('id', havetClient.id);

    if (updateError) {
      console.error('❌ Error assigning client to admin:', updateError);
      return;
    }

    console.log('✅ Successfully assigned Havet client to admin!');

    // Verify the assignment
    const { data: updatedClient, error: verifyError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', havetClient.id)
      .single();

    if (verifyError) {
      console.error('❌ Error verifying assignment:', verifyError);
      return;
    }

    console.log(`\n✅ Verification:`);
    console.log(`   Client: ${updatedClient.name}`);
    console.log(`   Admin ID: ${updatedClient.admin_id}`);
    console.log(`   Admin matches: ${updatedClient.admin_id === admin.id ? '✅ YES' : '❌ NO'}`);

    console.log('\n🎯 Next Steps:');
    console.log('1. Log out and log back in as admin@example.com');
    console.log('2. The dashboard should now show Havet client data');
    console.log('3. Conversion tracking should display real data instead of zeros');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

assignClientToAdmin(); 