require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCurrentUser() {
  console.log('🔍 Testing current user authentication and role...\n');

  try {
    // Test jacek login
    console.log('📋 Testing jacek login...');
    const { data: jacekAuth, error: jacekError } = await supabase.auth.signInWithPassword({
      email: 'jac.honkisz@gmail.com',
      password: 'password123'
    });

    if (jacekError) {
      console.error('❌ Jacek login failed:', jacekError);
      return;
    }

    console.log('✅ Jacek login successful');
    console.log('   User ID:', jacekAuth.user.id);
    console.log('   Email:', jacekAuth.user.email);

    // Get jacek's profile
    const { data: jacekProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', jacekAuth.user.id)
      .single();

    if (profileError) {
      console.error('❌ Profile fetch failed:', profileError);
      return;
    }

    console.log('✅ Jacek profile:');
    console.log('   Role:', jacekProfile.role);
    console.log('   Full Name:', jacekProfile.full_name);

    // Test admin login
    console.log('\n📋 Testing admin login...');
    const { data: adminAuth, error: adminError } = await supabase.auth.signInWithPassword({
      email: 'admin@example.com',
      password: 'password123'
    });

    if (adminError) {
      console.error('❌ Admin login failed:', adminError);
      return;
    }

    console.log('✅ Admin login successful');
    console.log('   User ID:', adminAuth.user.id);
    console.log('   Email:', adminAuth.user.email);

    // Get admin's profile
    const { data: adminProfile, error: adminProfileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', adminAuth.user.id)
      .single();

    if (adminProfileError) {
      console.error('❌ Admin profile fetch failed:', adminProfileError);
      return;
    }

    console.log('✅ Admin profile:');
    console.log('   Role:', adminProfile.role);
    console.log('   Full Name:', adminProfile.full_name);

    // Test client data access for jacek
    console.log('\n📋 Testing jacek client data access...');
    const { data: jacekClient, error: jacekClientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'jac.honkisz@gmail.com')
      .single();

    if (jacekClientError) {
      console.error('❌ Jacek client data fetch failed:', jacekClientError);
    } else {
      console.log('✅ Jacek client data:');
      console.log('   Name:', jacekClient.name);
      console.log('   Admin ID:', jacekClient.admin_id);
      console.log('   API Status:', jacekClient.api_status);
    }

    // Test admin client data access
    console.log('\n📋 Testing admin client data access...');
    const { data: adminClients, error: adminClientsError } = await supabase
      .from('clients')
      .select('*')
      .eq('admin_id', adminAuth.user.id);

    if (adminClientsError) {
      console.error('❌ Admin clients fetch failed:', adminClientsError);
    } else {
      console.log('✅ Admin clients data:');
      console.log('   Total clients:', adminClients.length);
      adminClients.forEach((client, index) => {
        console.log(`   ${index + 1}. ${client.name} (${client.email})`);
      });
    }

    console.log('\n🎯 Summary:');
    console.log('   Jacek should access: /dashboard (role: client)');
    console.log('   Admin should access: /admin (role: admin)');
    console.log('   Current routing should work correctly based on user role');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testCurrentUser(); 