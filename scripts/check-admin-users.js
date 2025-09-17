const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: '.env.local'});

// Check admin users in the database
async function checkAdminUsers() {
  console.log('🔍 Checking Admin Users...\n');

  // Initialize Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Get all profiles with admin role
    const { data: adminProfiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, role, created_at')
      .eq('role', 'admin');

    if (profileError) {
      console.error('❌ Error fetching admin profiles:', profileError);
      return;
    }

    console.log(`📊 Found ${adminProfiles.length} admin users:\n`);

    adminProfiles.forEach((profile, index) => {
      console.log(`${index + 1}. ${profile.email}`);
      console.log(`   ID: ${profile.id}`);
      console.log(`   Role: ${profile.role}`);
      console.log(`   Created: ${profile.created_at}`);
      console.log('');
    });

    if (adminProfiles.length === 0) {
      console.log('❌ No admin users found in database');
      console.log('\n💡 You may need to create an admin user first');
    } else {
      console.log('✅ Admin users found!');
      console.log('\n📝 Use one of these emails to test the PDF generation:');
      adminProfiles.forEach(profile => {
        console.log(`   - ${profile.email}`);
      });
    }

  } catch (error) {
    console.error('\n❌ Check failed:', error.message);
  }
}

// Run the check
checkAdminUsers().catch(console.error); 