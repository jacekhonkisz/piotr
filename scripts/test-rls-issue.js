const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client (same as frontend)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing required environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

async function testRLSIssue() {
  console.log('🧪 Testing RLS issue simulation...\n');

  try {
    // Step 1: Sign in as admin (simulate frontend auth)
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

    // Step 2: Get session (simulate frontend session check)
    console.log('\n2. Getting session...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.error('❌ Session error:', sessionError?.message || 'No session');
      return;
    }

    console.log('✅ Session found for user:', session.user.email);
    console.log('Session token length:', session.access_token.length);

    // Step 3: Try to fetch profile (this is where it hangs in frontend)
    console.log('\n3. Attempting to fetch profile (this should hang if RLS issue)...');
    console.log('User ID from session:', session.user.id);
    
    const startTime = Date.now();
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    const endTime = Date.now();
    console.log(`Query took ${endTime - startTime}ms`);

    if (error) {
      console.error('❌ Profile fetch failed:', error.message);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
    } else {
      console.log('✅ Profile fetched successfully:', profile);
    }

    // Step 4: Test with a timeout to see if it hangs
    console.log('\n4. Testing with timeout...');
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Query timeout')), 5000);
    });

    const profilePromise = supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    try {
      const result = await Promise.race([profilePromise, timeoutPromise]);
      console.log('✅ Query completed within timeout:', result);
    } catch (timeoutError) {
      console.log('❌ Query timed out - this confirms the hanging issue');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testRLSIssue(); 