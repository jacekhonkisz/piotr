const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables. Please check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testProfileLoading() {
  console.log('🧪 Testing profile loading...\n');

  try {
    // First, sign in as admin@example.com
    console.log('1. Signing in as admin@example.com...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'admin@example.com',
      password: 'password123'
    });

    if (signInError) {
      console.error('❌ Sign in failed:', signInError.message);
      return;
    }

    console.log('✅ Sign in successful:', signInData.user.email);

    // Get the session
    console.log('\n2. Getting session...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ Session error:', sessionError.message);
      return;
    }

    if (!session) {
      console.error('❌ No session found');
      return;
    }

    console.log('✅ Session found for user:', session.user.email);

    // Try to get the profile
    console.log('\n3. Loading profile...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profileError) {
      console.error('❌ Profile loading failed:', profileError.message);
      console.error('Error details:', {
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
        code: profileError.code
      });
      return;
    }

    console.log('✅ Profile loaded successfully:');
    console.log('  - Email:', profile.email);
    console.log('  - Role:', profile.role);
    console.log('  - Full Name:', profile.full_name);
    console.log('  - ID:', profile.id);

    // Test the redirect logic
    console.log('\n4. Testing redirect logic...');
    if (profile.role === 'admin') {
      console.log('✅ User is admin - should redirect to /admin');
    } else {
      console.log('✅ User is client - should redirect to /dashboard');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

testProfileLoading(); 