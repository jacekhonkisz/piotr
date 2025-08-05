const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xbklptrrfdspyvnjaojf.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key'
);

async function testQuickDashboard() {
  console.log('🔍 Quick Dashboard Test...\n');

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

    // 3. Test fetch-live-data with the new focused date range
    console.log('\n3️⃣ Testing /api/fetch-live-data with focused date range...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    const fetchLiveDataResponse = await fetch('http://localhost:3002/api/fetch-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        clientId: client.id,
        dateRange: {
          start: '2024-07-01',
          end: '2024-07-31'
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
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

    console.log('\n🎉 Quick Dashboard Test Complete!');

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('❌ Request timed out after 15 seconds');
    } else {
      console.error('❌ Test failed:', error);
    }
  }
}

// Run the test
testQuickDashboard(); 