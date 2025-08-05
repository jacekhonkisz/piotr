const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xbklptrrfdspyvnjaojf.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key'
);

async function testDashboardData() {
  console.log('🔍 Testing Dashboard Data Fetching...\n');

  try {
    // 1. Get admin user session
    console.log('1️⃣ Getting admin user session...');
    const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@example.com',
      password: 'password123'
    });

    if (authError || !user) {
      console.log('❌ Failed to authenticate admin user:', authError?.message);
      return;
    }

    console.log('✅ Admin user authenticated:', user.email);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      console.log('❌ No access token available');
      return;
    }

    // 2. Get a client to test with
    console.log('\n2️⃣ Getting client data...');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .limit(1);

    if (clientsError || !clients || clients.length === 0) {
      console.log('❌ No clients found:', clientsError?.message);
      return;
    }

    const client = clients[0];
    console.log('✅ Found client:', client.name);

    // 3. Test fetch-live-data with the new date range
    console.log('\n3️⃣ Testing /api/fetch-live-data with new date range...');
    const fetchLiveDataResponse = await fetch('http://localhost:3002/api/fetch-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        clientId: client.id,
        dateRange: {
          start: '2024-02-01',
          end: '2025-08-31'
        }
      })
    });

    console.log('   Status:', fetchLiveDataResponse.status);

    if (!fetchLiveDataResponse.ok) {
      const errorText = await fetchLiveDataResponse.text();
      console.log('❌ Fetch live data failed:', errorText);
      return;
    }

    const liveData = await fetchLiveDataResponse.json();
    console.log('✅ Fetch live data successful');
    
    if (liveData.data) {
      console.log('   Campaigns count:', liveData.data.campaigns?.length || 0);
      console.log('   Stats:', liveData.data.stats);
      
      if (liveData.data.campaigns && liveData.data.campaigns.length > 0) {
        console.log('   Sample campaign:', {
          id: liveData.data.campaigns[0].campaign_id,
          name: liveData.data.campaigns[0].campaign_name,
          spend: liveData.data.campaigns[0].spend,
          impressions: liveData.data.campaigns[0].impressions,
          clicks: liveData.data.campaigns[0].clicks
        });
      } else {
        console.log('   ⚠️ No campaigns found in response');
      }
    }

    console.log('\n🎉 Dashboard Data Test Complete!');
    console.log('\n📋 Summary:');
    console.log('   - Admin authentication: ✅');
    console.log('   - Client data: ✅');
    console.log('   - Live data fetch: ' + (liveData.data ? '✅' : '❌'));
    console.log('   - Campaigns in live data: ' + (liveData.data?.campaigns?.length || 0));
    console.log('   - Total spend: ' + (liveData.data?.stats?.totalSpend || 0));

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testDashboardData(); 