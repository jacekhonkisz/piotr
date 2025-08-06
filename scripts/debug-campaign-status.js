const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function debugCampaignStatus() {
  console.log('🔍 Debugging Campaign Status...\n');

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
    console.log(`📊 Ad Account ID: ${clientData.ad_account_id}`);

    // Step 3: Test campaigns endpoint directly
    console.log('\n🌐 Step 3: Testing campaigns endpoint directly...');
    
    try {
      const campaignsUrl = `https://graph.facebook.com/v18.0/act_${clientData.ad_account_id}/campaigns?access_token=${clientData.meta_access_token}&fields=id,name,status,objective,created_time&limit=20`;
      
      const campaignsResponse = await fetch(campaignsUrl);
      const campaignsData = await campaignsResponse.json();

      if (campaignsData.error) {
        console.error('❌ Campaigns fetch failed:', campaignsData.error);
        return;
      }

      const campaigns = campaignsData.data || [];
      console.log(`✅ Found ${campaigns.length} campaigns in direct API call`);
      
      console.log('\n📋 Direct API Campaigns:');
      campaigns.forEach((campaign, index) => {
        console.log(`  ${index + 1}. ${campaign.name} (${campaign.id})`);
        console.log(`     Status: ${campaign.status}`);
        console.log(`     Objective: ${campaign.objective}`);
        console.log(`     Created: ${campaign.created_time}`);
        console.log('');
      });

      // Step 4: Test insights endpoint
      console.log('\n🌐 Step 4: Testing insights endpoint...');
      
      const insightsUrl = `https://graph.facebook.com/v18.0/act_${clientData.ad_account_id}/insights?access_token=${clientData.meta_access_token}&fields=campaign_id,campaign_name,impressions,clicks,spend&time_range={"since":"2024-04-01","until":"2024-04-30"}&level=campaign&limit=20`;
      
      const insightsResponse = await fetch(insightsUrl);
      const insightsData = await insightsResponse.json();

      if (insightsData.error) {
        console.error('❌ Insights fetch failed:', insightsData.error);
      } else {
        const insights = insightsData.data || [];
        console.log(`✅ Found ${insights.length} insights in direct API call`);
        
        console.log('\n📋 Direct API Insights:');
        insights.forEach((insight, index) => {
          console.log(`  ${index + 1}. ${insight.campaign_name} (${insight.campaign_id})`);
          console.log(`     Spend: ${insight.spend || 0} zł`);
          console.log(`     Impressions: ${insight.impressions || 0}`);
          console.log(`     Clicks: ${insight.clicks || 0}`);
          console.log('');
        });
      }

      // Step 5: Test our API endpoint
      console.log('\n🌐 Step 5: Testing our API endpoint...');
      
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

        if (response.ok) {
          const apiData = await response.json();
          
          if (apiData.success && apiData.data?.campaigns) {
            const campaigns = apiData.data.campaigns;
            console.log(`✅ Found ${campaigns.length} campaigns in our API`);
            
            console.log('\n📋 Our API Campaigns:');
            campaigns.forEach((campaign, index) => {
              console.log(`  ${index + 1}. ${campaign.campaign_name} (${campaign.campaign_id})`);
              console.log(`     Status: ${campaign.status || 'UNKNOWN'}`);
              console.log(`     Spend: ${campaign.spend || 0} zł`);
              console.log(`     Impressions: ${campaign.impressions || 0}`);
              console.log(`     Clicks: ${campaign.clicks || 0}`);
              console.log('');
            });
          }
        }
      } catch (error) {
        console.log(`❌ Error testing our API: ${error.message}`);
      }

    } catch (error) {
      console.log(`❌ Error testing direct API: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugCampaignStatus(); 