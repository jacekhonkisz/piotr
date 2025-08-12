// Script to check current user role and admin privileges
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkUserRole() {
  console.log('🔍 Checking Current User Role and Admin Privileges\n');

  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ Error getting session:', sessionError.message);
      return;
    }

    if (!session) {
      console.log('❌ No active session found');
      console.log('💡 Please log in to your account first');
      return;
    }

    console.log('✅ Active session found');
    console.log(`👤 User ID: ${session.user.id}`);
    console.log(`📧 Email: ${session.user.email}`);
    console.log(`🔑 Access Token: ${session.access_token ? 'Present' : 'Missing'}`);

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profileError) {
      console.error('❌ Error getting user profile:', profileError.message);
      return;
    }

    if (!profile) {
      console.log('❌ No profile found for user');
      console.log('💡 This might be a new user without a profile');
      return;
    }

    console.log('\n📋 User Profile Details:');
    console.log(`   🆔 ID: ${profile.id}`);
    console.log(`   📧 Email: ${profile.email}`);
    console.log(`   👑 Role: ${profile.role || 'Not set'}`);
    console.log(`   📅 Created: ${profile.created_at}`);
    console.log(`   🔄 Updated: ${profile.updated_at}`);

    // Check if user is admin
    if (profile.role === 'admin') {
      console.log('\n✅ User has ADMIN role - should be able to access collection features');
    } else {
      console.log('\n❌ User does NOT have admin role');
      console.log(`   Current role: ${profile.role || 'Not set'}`);
      console.log('💡 To fix this, you need to update the user role to "admin"');
    }

    // Check if user exists in profiles table with admin role
    const { data: adminUsers, error: adminError } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('role', 'admin');

    if (adminError) {
      console.error('❌ Error checking admin users:', adminError.message);
    } else {
      console.log('\n👑 Admin Users in System:');
      if (adminUsers && adminUsers.length > 0) {
        adminUsers.forEach((admin, index) => {
          console.log(`   ${index + 1}. ${admin.email} (${admin.role})`);
        });
      } else {
        console.log('   ⚠️ No admin users found in the system');
      }
    }

    // Check if current user can access admin functions
    console.log('\n🔐 Testing Admin Access...');
    
    try {
      const { data: testResult, error: testError } = await supabase
        .from('campaign_summaries')
        .select('count(*)')
        .limit(1);

      if (testError) {
        console.log('   ❌ Database access test failed:', testError.message);
      } else {
        console.log('   ✅ Database access test passed');
      }
    } catch (error) {
      console.log('   ❌ Database access test failed:', error.message);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the check
checkUserRole(); 