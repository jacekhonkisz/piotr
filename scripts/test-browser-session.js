require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function testBrowserSession() {
  console.log('🧪 Testing Browser Session Context...\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    console.error('❌ Missing environment variables');
    return;
  }

  console.log('✅ Environment variables found');
  console.log('📡 Testing session retrieval...\n');

  // Create client with anon key (like browser would)
  const supabase = createClient(supabaseUrl, anonKey);

  try {
    console.log('🔍 Attempting to get session...');
    
    const { data: { session }, error } = await supabase.auth.getSession();
    
    console.log('📋 Session result:');
    console.log(`   Has session: ${!!session}`);
    console.log(`   Has user: ${!!session?.user}`);
    console.log(`   Has access token: ${!!session?.access_token}`);
    console.log(`   Access token length: ${session?.access_token?.length || 0}`);
    
    if (session?.access_token) {
      console.log(`   Access token preview: ${session.access_token.substring(0, 20)}...`);
    }
    
    if (error) {
      console.log(`   Error: ${error.message}`);
    }
    
    if (!session) {
      console.log('\n❌ No session found - this explains the 401 error!');
      console.log('   The frontend cannot authenticate because there is no active session.');
      console.log('   This usually means:');
      console.log('   1. User is not logged in');
      console.log('   2. Session has expired');
      console.log('   3. Browser cookies/localStorage are cleared');
    } else if (!session.access_token) {
      console.log('\n❌ Session exists but no access token - this also explains the 401 error!');
    } else {
      console.log('\n✅ Session and access token found - authentication should work!');
    }

  } catch (error) {
    console.error('❌ Error testing session:', error.message);
  }
}

testBrowserSession();
