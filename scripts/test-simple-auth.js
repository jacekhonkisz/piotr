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

async function testSimpleAuth() {
  console.log('🧪 Testing simple auth endpoint...\n');

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
    
    if (sessionError || !session) {
      console.error('❌ Session error:', sessionError?.message || 'No session');
      return;
    }

    console.log('✅ Session found for user:', session.user.email);
    console.log('Session token length:', session.access_token.length);

    // Test the simple auth endpoint
    console.log('\n3. Testing simple auth endpoint...');
    const response = await fetch(`http://localhost:3000/api/test-auth`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Response status:', response.status);
    const responseData = await response.json();
    console.log('Response data:', responseData);

    if (response.ok) {
      console.log('✅ Simple auth test successful!');
      console.log('User role:', responseData.profile.role);
    } else {
      console.log('❌ Simple auth test failed:', responseData.error);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

testSimpleAuth(); 