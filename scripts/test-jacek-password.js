const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testJacekPassword() {
  try {
    console.log('🔍 Testing the correct password for jacek...\n');

    const correctPassword = 'v&6uP*1UqTQN';

    console.log(`🔐 Testing password: "${correctPassword}"`);
    
    try {
      const { data: { session }, error } = await supabase.auth.signInWithPassword({
        email: 'jac.honkisz@gmail.com',
        password: correctPassword
      });

      if (error) {
        console.log(`   ❌ Failed: ${error.message}`);
      } else {
        console.log(`   ✅ SUCCESS! Password is correct`);
        console.log(`   🔑 Access token: ${session?.access_token ? 'Present' : 'Missing'}`);
        
        // Test the API with this password
        console.log(`   🌐 Testing API with correct password...`);
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

        console.log(`   📡 API Response status: ${response.status}`);
        if (response.ok) {
          const data = await response.json();
          console.log(`   ✅ API working! Found ${data.data?.campaigns?.length || 0} campaigns`);
          console.log(`   💰 Total spend: $${data.data?.stats?.totalSpend || 0}`);
          console.log(`   📊 Campaigns:`, data.data?.campaigns?.map(c => c.name));
        } else {
          const errorData = await response.text();
          console.log(`   ❌ API failed: ${errorData}`);
        }
      }
    } catch (testError) {
      console.log(`   ❌ Error: ${testError.message}`);
    }

  } catch (error) {
    console.error('❌ Error testing password:', error);
  }
}

testJacekPassword(); 