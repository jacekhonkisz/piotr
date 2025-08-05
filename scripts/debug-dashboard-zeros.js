const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xbklptrrfdspyvnjaojf.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key'
);

async function debugDashboardZeros() {
  console.log('🔍 Debugging Dashboard Zero Values...\n');

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
    console.log('   Ad Account ID:', client.ad_account_id);
    console.log('   Has Meta Token:', !!client.meta_access_token);

    // 3. Test fetch-live-data endpoint
    console.log('\n3️⃣ Testing /api/fetch-live-data endpoint...');
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
    console.log('   Debug info:', liveData.debug);
    
    if (liveData.data) {
      console.log('   Campaigns count:', liveData.data.campaigns?.length || 0);
      console.log('   Stats:', liveData.data.stats);
      
      if (liveData.data.campaigns && liveData.data.campaigns.length > 0) {
        console.log('   Sample campaign:', liveData.data.campaigns[0]);
      } else {
        console.log('   ⚠️ No campaigns found in response');
      }
    }

    // 4. Test Meta API directly for placement performance
    console.log('\n4️⃣ Testing placement performance...');
    const placementResponse = await fetch('http://localhost:3002/api/fetch-meta-tables', {
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
      })
    });

    if (placementResponse.ok) {
      const placementData = await placementResponse.json();
      console.log('✅ Placement data fetched');
      console.log('   Placement performance count:', placementData.placementPerformance?.length || 0);
      
      if (placementData.placementPerformance && placementData.placementPerformance.length > 0) {
        console.log('   Sample placement:', placementData.placementPerformance[0]);
        console.log('   All placements:', placementData.placementPerformance.map(p => p.placement));
      }
    } else {
      console.log('❌ Placement data fetch failed');
    }

    // 5. Check if there are any stored reports
    console.log('\n5️⃣ Checking stored reports...');
    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select('*')
      .eq('client_id', client.id)
      .order('generated_at', { ascending: false })
      .limit(5);

    if (reportsError) {
      console.log('❌ Error fetching reports:', reportsError.message);
    } else {
      console.log('✅ Found', reports?.length || 0, 'stored reports');
      if (reports && reports.length > 0) {
        console.log('   Latest report:', {
          id: reports[0].id,
          generated_at: reports[0].generated_at,
          date_range_start: reports[0].date_range_start,
          date_range_end: reports[0].date_range_end
        });
      }
    }

    // 6. Check campaigns table
    console.log('\n6️⃣ Checking campaigns table...');
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (campaignsError) {
      console.log('❌ Error fetching campaigns:', campaignsError.message);
    } else {
      console.log('✅ Found', campaigns?.length || 0, 'stored campaigns');
      if (campaigns && campaigns.length > 0) {
        console.log('   Sample campaign:', {
          campaign_name: campaigns[0].campaign_name,
          spend: campaigns[0].spend,
          impressions: campaigns[0].impressions,
          clicks: campaigns[0].clicks
        });
      }
    }

    console.log('\n🎉 Dashboard Debug Complete!');
    console.log('\n📋 Summary:');
    console.log('   - Admin authentication: ✅');
    console.log('   - Client data: ✅');
    console.log('   - Live data fetch: ' + (liveData.data ? '✅' : '❌'));
    console.log('   - Campaigns in live data: ' + (liveData.data?.campaigns?.length || 0));
    console.log('   - Stored reports: ' + (reports?.length || 0));
    console.log('   - Stored campaigns: ' + (campaigns?.length || 0));

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run the debug
debugDashboardZeros(); 