require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAdminClientReports() {
  console.log('🔍 Testing Admin Client Reports Access...\n');

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

    // Get jacek's client ID
    console.log('\n📋 Getting jacek client ID...');
    const { data: jacekClient, error: jacekError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'jac.honkisz@gmail.com')
      .single();

    if (jacekError) {
      console.error('❌ Jacek client fetch failed:', jacekError);
      return;
    }

    console.log('✅ Jacek client found:');
    console.log('   Client ID:', jacekClient.id);
    console.log('   Name:', jacekClient.name);
    console.log('   Admin ID:', jacekClient.admin_id);

    // Test admin access to jacek's client data (simulating the reports page logic)
    console.log('\n📋 Testing admin access to jacek client data...');
    const { data: adminJacekClient, error: adminJacekError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', jacekClient.id)
      .eq('admin_id', adminAuth.user.id) // Ensure admin owns this client
      .single();

    if (adminJacekError) {
      console.error('❌ Admin jacek client access failed:', adminJacekError);
      return;
    }

    console.log('✅ Admin jacek client access successful:');
    console.log('   Client ID:', adminJacekClient.id);
    console.log('   Name:', adminJacekClient.name);

    // Test admin access to jacek's reports
    console.log('\n📋 Testing admin access to jacek reports...');
    const { data: jacekReports, error: reportsError } = await supabase
      .from('reports')
      .select('*')
      .eq('client_id', jacekClient.id);

    if (reportsError) {
      console.error('❌ Admin jacek reports access failed:', reportsError);
      return;
    }

    console.log('✅ Admin jacek reports access successful:');
    console.log('   Total reports:', jacekReports.length);
    jacekReports.forEach((report, index) => {
      console.log(`   ${index + 1}. ${report.date_range_start} to ${report.date_range_end}`);
    });

    console.log('\n🎯 Admin Client Reports Test Summary:');
    console.log('   ✅ Admin can access specific client data');
    console.log('   ✅ Admin can access client reports');
    console.log('   ✅ Reports page should work for admin users');
    console.log('   ✅ URL: /reports?clientId=' + jacekClient.id);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAdminClientReports(); 