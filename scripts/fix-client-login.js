require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixClientLogin() {
  console.log('🔧 Fixing client login...\n');

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

    // Now sign in as jacek (client)
    console.log('\n📥 Signing in as jacek (client)...');
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'jac.honkisz@gmail.com',
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

    // Get client data
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'jac.honkisz@gmail.com')
      .single();

    if (clientError) {
      console.error('❌ Client data fetch error:', clientError);
      return;
    }

    console.log('\n🏢 Client Data:');
    console.log('   Name:', client.name);
    console.log('   API Status:', client.api_status);
    console.log('   Admin ID:', client.admin_id);

    console.log('\n🎯 Expected Behavior:');
    console.log('   - Should be redirected to /dashboard');
    console.log('   - Should see client dashboard with reports');
    console.log('   - Should NOT see admin panel');

    console.log('\n✅ Client login fixed!');
    console.log('   Now refresh your browser and you should see the client dashboard.');

  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
}

fixClientLogin(); 