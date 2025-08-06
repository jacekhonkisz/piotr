const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testHistoricalCampaignStatus() {
  console.log('🔍 Testing Historical Campaign Status (April 2024)...\n');

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

    // Step 3: Test with April 2024 data (when campaigns were active)
    console.log('\n🌐 Step 3: Testing with April 2024 data...');
    
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
        const errorText = await response.text();
        console.log(`Error details: ${errorText}`);
        return;
      }

      const apiData = await response.json();
      
      if (apiData.success && apiData.data?.campaigns) {
        const campaigns = apiData.data.campaigns;
        console.log(`✅ Found ${campaigns.length} campaigns in Meta API for April 2024`);
        
        console.log('\n📋 Campaign Status Analysis (April 2024):');
        let hasStatus = 0;
        let hasUnknownStatus = 0;
        let totalSpend = 0;
        
        campaigns.forEach((campaign, index) => {
          console.log(`  ${index + 1}. ${campaign.campaign_name}`);
          console.log(`     Campaign ID: ${campaign.campaign_id}`);
          console.log(`     Status: ${campaign.status || 'UNKNOWN'}`);
          console.log(`     Spend: ${campaign.spend || 0} zł`);
          console.log(`     Impressions: ${campaign.impressions || 0}`);
          console.log(`     Clicks: ${campaign.clicks || 0}`);
          
          if (campaign.status && campaign.status !== 'UNKNOWN') {
            hasStatus++;
          } else {
            hasUnknownStatus++;
          }
          
          totalSpend += campaign.spend || 0;
          console.log('');
        });

        console.log('\n📊 April 2024 Summary:');
        console.log(`- Campaigns with status: ${hasStatus}`);
        console.log(`- Campaigns with UNKNOWN status: ${hasUnknownStatus}`);
        console.log(`- Total spend: ${totalSpend.toFixed(2)} zł`);
        
        if (hasUnknownStatus === 0 && totalSpend > 0) {
          console.log('\n✅ SUCCESS: All campaigns have proper status values and real data!');
          console.log('🎯 This confirms the status field is working correctly.');
        } else if (hasUnknownStatus > 0) {
          console.log('\n⚠️ Some campaigns still show UNKNOWN status');
        } else {
          console.log('\n⚠️ No spending data found in April 2024');
        }
      } else {
        console.log('❌ No campaign data returned from Meta API');
      }
    } catch (error) {
      console.log(`❌ Error testing Meta API: ${error.message}`);
    }

    // Step 4: Test with March 2024 data as well
    console.log('\n🌐 Step 4: Testing with March 2024 data...');
    
    try {
      const marchResponse = await fetch('http://localhost:3000/api/fetch-live-data', {
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
            start: '2024-03-01',
            end: '2024-03-31'
          },
          _t: Date.now() + 1000
        })
      });

      if (marchResponse.ok) {
        const marchData = await marchResponse.json();
        
        if (marchData.success && marchData.data?.campaigns) {
          const marchCampaigns = marchData.data.campaigns;
          console.log(`✅ Found ${marchCampaigns.length} campaigns in Meta API for March 2024`);
          
          console.log('\n📋 March 2024 Campaigns:');
          let marchTotalSpend = 0;
          
          marchCampaigns.forEach((campaign, index) => {
            console.log(`  ${index + 1}. ${campaign.campaign_name} - Status: ${campaign.status || 'UNKNOWN'} - Spend: ${campaign.spend || 0} zł`);
            marchTotalSpend += campaign.spend || 0;
          });
          
          console.log(`\n📊 March 2024 Total Spend: ${marchTotalSpend.toFixed(2)} zł`);
        }
      }
    } catch (error) {
      console.log(`❌ Error testing March data: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testHistoricalCampaignStatus(); 