const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testJacekDashboard() {
  try {
    console.log('🔍 Testing jacek dashboard access...\n');

    // Login as jacek
    const { data: { session }, error: loginError } = await supabase.auth.signInWithPassword({
      email: 'jac.honkisz@gmail.com',
      password: 'v&6uP*1UqTQN'
    });

    if (loginError) {
      console.error('❌ Login failed:', loginError.message);
      return;
    }

    console.log('✅ Login successful');
    console.log(`🔑 Access token: ${session?.access_token ? 'Present' : 'Missing'}`);

    // Test the dashboard API
    console.log('\n🌐 Testing dashboard API...');
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

    console.log(`📡 API Response status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API working! Dashboard data:');
      console.log(`   📊 Campaigns: ${data.data?.campaigns?.length || 0}`);
      console.log(`   💰 Total spend: $${data.data?.stats?.totalSpend || 0}`);
      console.log(`   👥 Total impressions: ${data.data?.stats?.totalImpressions || 0}`);
      console.log(`   🎯 Total clicks: ${data.data?.stats?.totalClicks || 0}`);
      
      if (data.data?.campaigns?.length > 0) {
        console.log('\n📋 Campaign details:');
        data.data.campaigns.forEach((campaign, index) => {
          console.log(`   ${index + 1}. ${campaign.name}`);
          console.log(`      💰 Spend: $${campaign.spend || 0}`);
          console.log(`      👥 Impressions: ${campaign.impressions || 0}`);
          console.log(`      🎯 Clicks: ${campaign.clicks || 0}`);
        });
      }
    } else {
      const errorData = await response.text();
      console.log(`❌ API failed: ${errorData}`);
    }

    // Test client data
    console.log('\n👥 Testing client data...');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .eq('admin_id', session.user.id);

    if (clientsError) {
      console.log(`❌ Client data error: ${clientsError.message}`);
    } else {
      console.log(`✅ Found ${clients.length} clients for jacek:`);
      clients.forEach(client => {
        console.log(`   - ${client.name} (${client.email})`);
      });
    }

    console.log('\n🎉 Dashboard test completed!');
    console.log('jacek should now be able to log in and see real data.');

  } catch (error) {
    console.error('❌ Error testing dashboard:', error);
  }
}

testJacekDashboard(); 