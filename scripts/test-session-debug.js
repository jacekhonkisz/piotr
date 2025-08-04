const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testSessionDebug() {
  console.log('🔍 Testing Session Debug...\n');

  try {
    // 1. Test current session
    console.log('📋 Step 1: Checking current session...');
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ Session error:', sessionError);
    } else if (!session) {
      console.log('❌ No active session found');
      
      // Try to login
      console.log('\n🔐 Attempting login...');
      const { data: { session: loginSession }, error: loginError } = await supabase.auth.signInWithPassword({
        email: 'jac.honkisz@gmail.com',
        password: 'password123'
      });
      
      if (loginError) {
        console.error('❌ Login failed:', loginError);
        return;
      }
      
      if (loginSession) {
        console.log('✅ Login successful, session created');
        console.log('Token preview:', loginSession.access_token.substring(0, 50) + '...');
      }
    } else {
      console.log('✅ Active session found');
      console.log('Token preview:', session.access_token.substring(0, 50) + '...');
    }

    // 2. Test token verification with service role
    console.log('\n🔍 Step 2: Testing token verification...');
    
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    if (session?.access_token) {
      const { data: { user }, error: verifyError } = await serviceSupabase.auth.getUser(session.access_token);
      
      if (verifyError) {
        console.error('❌ Token verification failed:', verifyError);
      } else {
        console.log('✅ Token verification successful:', {
          userId: user.id,
          email: user.email
        });
      }
    }

    // 3. Test API call directly
    console.log('\n📡 Step 3: Testing API call...');
    
    if (session?.access_token) {
      const response = await fetch('http://localhost:3000/api/fetch-live-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          dateRange: {
            start: '2025-08-01',
            end: '2025-08-31'
          },
          clientId: '5703e71f-1222-4178-885c-ce72746d0713' // jacek's client ID
        })
      });

      console.log('API Response Status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ API call failed:', errorData);
      } else {
        const data = await response.json();
        console.log('✅ API call successful:', {
          success: data.success,
          clientName: data.data?.client?.name
        });
      }
    }

  } catch (error) {
    console.error('💥 Error:', error);
  }
}

testSessionDebug(); 