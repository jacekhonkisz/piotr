require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function clearDashboardCache() {
  console.log('🧹 Clearing Dashboard Cache...\n');

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

    // Step 2: Get client data
    console.log('\n🔍 Step 2: Getting client data...');
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', user.email)
      .single();

    if (clientError || !clientData) {
      console.error('❌ Client not found:', clientError);
      return;
    }

    console.log('✅ Client found:', clientData.id);

    // Step 3: Clear any cached data by making a fresh API call
    console.log('\n🔄 Step 3: Making fresh API call to clear cache...');
    
    const response = await fetch('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      body: JSON.stringify({
        clientId: clientData.id,
        dateRange: {
          start: '2024-01-01',
          end: new Date().toISOString().split('T')[0]
        },
        _t: Date.now(),
        forceRefresh: true
      })
    });

    if (!response.ok) {
      console.log(`❌ API Error: ${response.status}`);
      return;
    }

    const apiData = await response.json();
    
    if (apiData.success && apiData.data?.campaigns) {
      const campaigns = apiData.data.campaigns;
      const totalSpend = campaigns.reduce((sum, campaign) => sum + (campaign.spend || 0), 0);
      
      console.log(`✅ Cache cleared successfully!`);
      console.log(`📊 Fresh data loaded: ${totalSpend.toFixed(2)} zł spend from ${campaigns.length} campaigns`);
      
      console.log('\n🎯 Next Steps:');
      console.log('1. Open your browser and go to http://localhost:3000/dashboard');
      console.log('2. Press Ctrl+F5 (or Cmd+Shift+R on Mac) to force refresh');
      console.log('3. You should now see 259.39 zł instead of 0 zł');
      console.log('4. If you still see 0 zł, try clearing browser cache completely');
      
    } else {
      console.log('❌ Failed to load fresh data');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

clearDashboardCache(); 