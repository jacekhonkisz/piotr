const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAdminSettingsRouting() {
  console.log('🧪 Testing Admin Settings Routing...\n');

  try {
    // Test 1: Check if admin users exist
    console.log('1. Checking for admin users...');
    const { data: adminUsers, error: adminError } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'admin');

    if (adminError) {
      throw adminError;
    }

    console.log(`✅ Found ${adminUsers.length} admin users`);
    
    if (adminUsers.length > 0) {
      console.log('   Admin users:');
      adminUsers.forEach(user => {
        console.log(`   - ${user.email} (${user.full_name || 'No name'})`);
      });
    }

    // Test 2: Check if client users exist
    console.log('\n2. Checking for client users...');
    const { data: clientUsers, error: clientError } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'client');

    if (clientError) {
      throw clientError;
    }

    console.log(`✅ Found ${clientUsers.length} client users`);

    // Test 3: Check system settings access
    console.log('\n3. Testing system settings access...');
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('*')
      .limit(5);

    if (settingsError) {
      throw settingsError;
    }

    console.log(`✅ Successfully accessed ${settings.length} system settings`);

    // Test 4: Check email_logs_bulk table access
    console.log('\n4. Testing email_logs_bulk table access...');
    const { data: bulkLogs, error: bulkError } = await supabase
      .from('email_logs_bulk')
      .select('*')
      .limit(5);

    if (bulkError) {
      throw bulkError;
    }

    console.log(`✅ Successfully accessed email_logs_bulk table (${bulkLogs.length} records)`);

    console.log('\n🎉 Admin Settings Routing Test Completed Successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Navigate to http://localhost:3000/admin/settings');
    console.log('   2. Login with an admin account');
    console.log('   3. Verify the settings page loads correctly');
    console.log('   4. Test the email configuration form');
    console.log('   5. Test the reporting settings');

    if (adminUsers.length === 0) {
      console.log('\n⚠️  Warning: No admin users found!');
      console.log('   You may need to create an admin user first.');
      console.log('   Run: node scripts/setup-users.js');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAdminSettingsRouting(); 