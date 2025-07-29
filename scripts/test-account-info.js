const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testAccountInfo() {
  console.log('🔍 Testing Account Information...\n');

  try {
    // Step 1: Sign in
    console.log('🔐 Step 1: Signing in...');
    const { data: { user, session }, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'jac.honkisz@gmail.com',
      password: 'v&6uP*1UqTQN'
    });

    if (signInError) {
      console.error('❌ Sign in failed:', signInError.message);
      return;
    }

    console.log('✅ Signed in successfully');

    // Step 2: Test account info API call
    console.log('\n📡 Step 2: Testing account info API call...');
    const response = await fetch('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        dateRange: {
          start: '2020-01-01',
          end: new Date().toISOString().split('T')[0]
        }
      })
    });

    if (!response.ok) {
      console.error('❌ API call failed:', response.status);
      return;
    }

    const data = await response.json();
    console.log('✅ API Response received');
    
    console.log('\n📊 Debug Info:');
    console.log('- Account Creation Date:', data.debug?.accountCreationDate || 'Not available');
    console.log('- Token Valid:', data.debug?.tokenValid);
    console.log('- Campaigns Count:', data.debug?.campaignInsightsCount);
    console.log('- Date Range:', data.debug?.dateRange);

    if (data.debug?.accountCreationDate) {
      const creationDate = new Date(data.debug.accountCreationDate);
      console.log('\n📅 Account Details:');
      console.log('- Created:', creationDate.toLocaleDateString());
      console.log('- Age:', Math.floor((Date.now() - creationDate.getTime()) / (1000 * 60 * 60 * 24)), 'days');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testAccountInfo(); 