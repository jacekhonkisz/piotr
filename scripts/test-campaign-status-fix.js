const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testCampaignStatusFix() {
  console.log('🔍 Testing Campaign Status Fix...\n');

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

    // Step 3: Test Meta API directly to see if status field is being returned
    console.log('\n🌐 Step 3: Testing Meta API directly...');
    
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
          _t: Date.now() // Force cache bust
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
        console.log(`✅ Found ${campaigns.length} campaigns in Meta API`);
        
        console.log('\n📋 Campaign Status Analysis:');
        let hasStatus = 0;
        let hasUnknownStatus = 0;
        
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
          console.log('');
        });

        console.log('\n📊 Status Summary:');
        console.log(`- Campaigns with status: ${hasStatus}`);
        console.log(`- Campaigns with UNKNOWN status: ${hasUnknownStatus}`);
        
        if (hasUnknownStatus > 0) {
          console.log('\n⚠️ ISSUE: Some campaigns still show UNKNOWN status');
          console.log('Possible causes:');
          console.log('1. Cache is still serving old data');
          console.log('2. Meta API is not returning status field');
          console.log('3. Status field is not being parsed correctly');
          
          console.log('\n🔄 Attempting to clear cache and retry...');
          
          // Try again with a different timestamp
          const retryResponse = await fetch('http://localhost:3000/api/fetch-live-data', {
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
              _t: Date.now() + 1000 // Different timestamp
            })
          });
          
          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            if (retryData.success && retryData.data?.campaigns) {
              console.log('\n🔄 Retry Results:');
              retryData.data.campaigns.forEach((campaign, index) => {
                console.log(`  ${index + 1}. ${campaign.campaign_name} - Status: ${campaign.status || 'UNKNOWN'}`);
              });
            }
          }
        } else {
          console.log('\n✅ SUCCESS: All campaigns have proper status values!');
        }
      } else {
        console.log('❌ No campaign data returned from Meta API');
      }
    } catch (error) {
      console.log(`❌ Error testing Meta API: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testCampaignStatusFix(); 