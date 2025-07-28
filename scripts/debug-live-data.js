const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugLiveData() {
  try {
    console.log('🔍 Debugging Live Data API...\n');

    // Get jacek client data
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'jac.honkisz@gmail.com')
      .single();

    if (clientError || !client) {
      console.error('❌ Client not found:', clientError);
      return;
    }

    console.log('📋 Client found:', client.name);
    console.log('🔑 Ad Account ID:', client.ad_account_id);
    console.log('📊 Meta Token:', client.meta_access_token ? 'Present' : 'Missing');
    console.log('');

    // Get a session token for jacek
    const { data: { session }, error: sessionError } = await supabase.auth.signInWithPassword({
      email: 'jac.honkisz@gmail.com',
      password: 'password123' // Assuming this is the password
    });

    if (sessionError || !session) {
      console.error('❌ Failed to get session:', sessionError);
      return;
    }

    console.log('✅ Session obtained for jacek');
    console.log('🔐 Access Token:', session.access_token ? 'Present' : 'Missing');
    console.log('');

    // Test the live data API
    console.log('🌐 Testing /api/fetch-live-data endpoint...');
    
    const response = await fetch('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        dateRange: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end: new Date().toISOString().split('T')[0]
        }
      })
    });

    console.log('📡 Response status:', response.status);
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('📡 Response body:', responseText);

    if (response.ok) {
      const data = JSON.parse(responseText);
      console.log('\n✅ API Response:');
      console.log('Success:', data.success);
      console.log('Client:', data.data?.client?.name);
      console.log('Campaigns count:', data.data?.campaigns?.length || 0);
      console.log('Stats:', data.data?.stats);
      
      if (data.data?.campaigns?.length > 0) {
        console.log('\n🎯 Campaigns:');
        data.data.campaigns.forEach((campaign, index) => {
          console.log(`${index + 1}. ${campaign.campaign_name}`);
          console.log(`   💰 Spend: $${campaign.spend}`);
          console.log(`   👁️  Impressions: ${campaign.impressions}`);
          console.log(`   🖱️  Clicks: ${campaign.clicks}`);
          console.log(`   📊 CTR: ${campaign.ctr}%`);
        });
      }
    } else {
      console.log('\n❌ API Error:');
      try {
        const errorData = JSON.parse(responseText);
        console.log('Error:', errorData.error);
        console.log('Details:', errorData.details);
      } catch (e) {
        console.log('Raw error:', responseText);
      }
    }

  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

debugLiveData(); 