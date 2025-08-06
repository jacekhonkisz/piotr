const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testStatusRemoval() {
  console.log('🔍 Testing Status Column Removal...\n');

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

    // Step 3: Test API to see if status field is still being returned
    console.log('\n🌐 Step 3: Testing API response...');
    
    try {
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
            start: '2024-04-01',
            end: '2024-04-30'
          },
          _t: Date.now()
        })
      });

      if (!response.ok) {
        console.log(`❌ API Error: ${response.status}`);
        return;
      }

      const apiData = await response.json();
      
      if (apiData.success && apiData.data?.campaigns) {
        const campaigns = apiData.data.campaigns;
        console.log(`✅ Found ${campaigns.length} campaigns in API response`);
        
        console.log('\n📋 Campaign Data Analysis:');
        campaigns.forEach((campaign, index) => {
          console.log(`  ${index + 1}. ${campaign.campaign_name}`);
          console.log(`     Campaign ID: ${campaign.campaign_id}`);
          console.log(`     Status field exists: ${campaign.hasOwnProperty('status')}`);
          console.log(`     Status value: ${campaign.status || 'undefined'}`);
          console.log(`     Spend: ${campaign.spend || 0} zł`);
          console.log(`     Impressions: ${campaign.impressions || 0}`);
          console.log(`     Clicks: ${campaign.clicks || 0}`);
          console.log('');
        });

        // Check if any campaigns still have status field
        const campaignsWithStatus = campaigns.filter(campaign => campaign.hasOwnProperty('status'));
        const campaignsWithUnknownStatus = campaigns.filter(campaign => campaign.status === 'UNKNOWN');
        
        console.log('\n📊 Status Field Analysis:');
        console.log(`- Campaigns with status field: ${campaignsWithStatus.length}`);
        console.log(`- Campaigns with UNKNOWN status: ${campaignsWithUnknownStatus.length}`);
        
        if (campaignsWithStatus.length === 0) {
          console.log('\n✅ SUCCESS: Status field has been completely removed from API response!');
        } else {
          console.log('\n⚠️ Status field still exists in some campaigns');
        }
      } else {
        console.log('❌ No campaign data returned from API');
      }
    } catch (error) {
      console.log(`❌ Error testing API: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testStatusRemoval(); 