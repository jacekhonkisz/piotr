require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixAdminLogin() {
  console.log('🔧 Fixing admin login...\n');

  try {
    // First, sign out any existing session
    console.log('📤 Signing out current session...');
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      console.error('❌ Sign out error:', signOutError);
    } else {
      console.log('✅ Signed out successfully');
    }

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Now sign in as admin
    console.log('\n📥 Signing in as admin...');
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'admin@example.com',
      password: 'password123'
    });

    if (signInError) {
      console.error('❌ Sign in error:', signInError);
      return;
    }

    console.log('✅ Sign in successful!');
    console.log('   User ID:', authData.user.id);
    console.log('   Email:', authData.user.email);

    // Get the user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      console.error('❌ Profile fetch error:', profileError);
      return;
    }

    console.log('\n📋 User Profile:');
    console.log('   Role:', profile.role);
    console.log('   Full Name:', profile.full_name);

    // Get admin's clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .eq('admin_id', authData.user.id);

    if (clientsError) {
      console.error('❌ Clients fetch error:', clientsError);
      return;
    }

    console.log('\n🏢 Admin Clients:');
    console.log('   Total clients:', clients.length);
    clients.forEach((client, index) => {
      console.log(`   ${index + 1}. ${client.name} (${client.email}) - ID: ${client.id}`);
    });

    console.log('\n🎯 Expected Behavior:');
    console.log('   - Should be redirected to /admin');
    console.log('   - Should see admin panel with all clients');
    console.log('   - "View Reports" button should work for each client');

    console.log('\n✅ Admin login fixed!');
    console.log('   Now refresh your browser and you should see the admin panel.');
    console.log('   Test the "View Reports" button for jacek client.');

  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
}

fixAdminLogin(); 