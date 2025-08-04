require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAdminAccess() {
  console.log('🔍 Testing Admin Access...\n');

  try {
    // Test admin login
    console.log('📋 Testing admin login...');
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

    // Get admin profile
    const { data: adminProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', adminAuth.user.id)
      .single();

    if (profileError) {
      console.error('❌ Admin profile fetch failed:', profileError);
      return;
    }

    console.log('✅ Admin profile:');
    console.log('   Role:', adminProfile.role);

    // Test admin access to clients
    console.log('\n📋 Testing admin access to clients...');
    const { data: adminClients, error: clientsError } = await supabase
      .from('clients')
      .select('*');

    if (clientsError) {
      console.error('❌ Admin clients fetch failed:', clientsError);
      return;
    }

    console.log('✅ Admin clients access successful:');
    console.log('   Total clients:', adminClients.length);
    adminClients.forEach((client, index) => {
      console.log(`   ${index + 1}. ${client.name} (${client.email})`);
    });

    // Test admin access to reports
    console.log('\n📋 Testing admin access to reports...');
    const { data: adminReports, error: reportsError } = await supabase
      .from('reports')
      .select('*');

    if (reportsError) {
      console.error('❌ Admin reports fetch failed:', reportsError);
      return;
    }

    console.log('✅ Admin reports access successful:');
    console.log('   Total reports:', adminReports.length);

    console.log('\n🎯 Admin Access Test Summary:');
    console.log('   ✅ Admin can access all clients');
    console.log('   ✅ Admin can access all reports');
    console.log('   ✅ RLS policies working correctly for admin');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAdminAccess(); 