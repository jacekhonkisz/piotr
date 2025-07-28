/**
 * Test script to verify authentication flow and database connectivity
 * Run with: node scripts/test-auth-flow.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAuthFlow() {
  try {
    console.log('🔍 Testing Authentication Flow...\n');

    // Try to sign in as jacek
    console.log('🔐 Attempting to sign in as jacek...');
    const { data: { session }, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'jac.honkisz@gmail.com',
      password: 'password123'
    });

    if (signInError) {
      console.log('❌ Sign in failed:', signInError.message);
      
      // Try with admin credentials
      console.log('\n🔐 Trying admin credentials...');
      const { data: { session: adminSession }, error: adminError } = await supabase.auth.signInWithPassword({
        email: 'admin@example.com',
        password: 'password123'
      });

      if (adminError) {
        console.log('❌ Admin sign in also failed:', adminError.message);
        return;
      }

      console.log('✅ Admin sign in successful');
      console.log('🔑 Access token:', adminSession?.access_token ? 'Present' : 'Missing');
      
      // Test the API with admin token
      console.log('\n🌐 Testing API with admin token...');
      const response = await fetch('http://localhost:3000/api/fetch-live-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminSession.access_token}`
        },
        body: JSON.stringify({
          dateRange: {
            start: '2024-01-01',
            end: '2025-12-31'
          }
        })
      });

      console.log('📡 Response status:', response.status);
      const responseText = await response.text();
      console.log('📡 Response body:', responseText);

    } else {
      console.log('✅ jacek sign in successful');
      console.log('🔑 Access token:', session?.access_token ? 'Present' : 'Missing');
      
      // Test the API with jacek token
      console.log('\n🌐 Testing API with jacek token...');
      const response = await fetch('http://localhost:3000/api/fetch-live-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          dateRange: {
            start: '2024-01-01',
            end: '2025-12-31'
          }
        })
      });

      console.log('📡 Response status:', response.status);
      const responseText = await response.text();
      console.log('📡 Response body:', responseText);
    }

  } catch (error) {
    console.error('❌ Error testing auth flow:', error);
  }
}

testAuthFlow(); 