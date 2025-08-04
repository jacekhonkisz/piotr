require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugSession() {
  console.log('🔍 Debugging current session...\n');

  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ Session error:', sessionError);
      return;
    }

    if (!session) {
      console.log('❌ No active session found');
      return;
    }

    console.log('✅ Active session found:');
    console.log('   User ID:', session.user.id);
    console.log('   Email:', session.user.email);
    console.log('   Created at:', session.user.created_at);
    console.log('   Last sign in:', session.user.last_sign_in_at);

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profileError) {
      console.error('❌ Profile fetch error:', profileError);
      return;
    }

    console.log('\n📋 User Profile:');
    console.log('   Role:', profile.role);
    console.log('   Full Name:', profile.full_name);
    console.log('   Email:', profile.email);

    // Check if this user is a client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', session.user.email)
      .single();

    if (clientError) {
      console.log('\n❌ No client record found for this user');
    } else {
      console.log('\n🏢 Client Record:');
      console.log('   Name:', client.name);
      console.log('   Admin ID:', client.admin_id);
      console.log('   API Status:', client.api_status);
    }

    // Check if this user is an admin
    if (profile.role === 'admin') {
      console.log('\n👑 This user is an ADMIN');
      console.log('   Should access: /admin');
      console.log('   Should NOT access: /dashboard');
    } else if (profile.role === 'client') {
      console.log('\n👤 This user is a CLIENT');
      console.log('   Should access: /dashboard');
      console.log('   Should NOT access: /admin');
    }

    console.log('\n🎯 Expected Behavior:');
    if (profile.role === 'admin') {
      console.log('   - Login should redirect to /admin');
      console.log('   - Accessing /dashboard should redirect to /admin');
      console.log('   - Can view all clients in admin panel');
    } else {
      console.log('   - Login should redirect to /dashboard');
      console.log('   - Accessing /admin should redirect to /dashboard');
      console.log('   - Can only view their own data');
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugSession(); 