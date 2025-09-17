// Script to check belmonte@hotel.com user role directly in database
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkBelmonteRole() {
  console.log('🔍 Checking Belmonte User Role in Database\n');

  try {
    // Find the belmonte user by email
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', 'belmonte@hotel.com')
      .single();

    if (userError) {
      console.error('❌ Error finding belmonte user:', userError.message);
      return;
    }

    if (!user) {
      console.log('❌ Belmonte user not found in profiles table');
      return;
    }

    console.log('✅ Belmonte user found:');
    console.log(`   🆔 ID: ${user.id}`);
    console.log(`   📧 Email: ${user.email}`);
    console.log(`   👑 Role: ${user.role || 'Not set'}`);
    console.log(`   📅 Created: ${user.created_at}`);
    console.log(`   🔄 Updated: ${user.updated_at}`);

    // Check if user is admin
    if (user.role === 'admin') {
      console.log('\n✅ Belmonte user has ADMIN role');
    } else {
      console.log('\n❌ Belmonte user does NOT have admin role');
      console.log(`   Current role: ${user.role || 'Not set'}`);
      console.log('💡 This is why you get "Access denied - admin only"');
    }

    // Check all users and their roles
    const { data: allUsers, error: allUsersError } = await supabase
      .from('profiles')
      .select('id, email, role')
      .order('email');

    if (allUsersError) {
      console.error('❌ Error getting all users:', allUsersError.message);
    } else {
      console.log('\n👥 All Users in System:');
      allUsers.forEach((u, index) => {
        const roleIcon = u.role === 'admin' ? '👑' : '👤';
        console.log(`   ${index + 1}. ${roleIcon} ${u.email} (${u.role || 'No role'})`);
      });
    }

    // Check if there are any admin users
    const adminUsers = allUsers?.filter(u => u.role === 'admin') || [];
    console.log(`\n📊 Admin Users: ${adminUsers.length}`);
    
    if (adminUsers.length === 0) {
      console.log('⚠️ No admin users found - this is a problem!');
      console.log('💡 You need at least one admin user to access admin features');
    } else {
      console.log('✅ Admin users found:');
      adminUsers.forEach(admin => {
        console.log(`   • ${admin.email}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the check
checkBelmonteRole(); 