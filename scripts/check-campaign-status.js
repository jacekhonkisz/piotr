require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkCampaignStatus() {
  console.log('🔍 Checking Campaign Status for jac.honkisz@gmail.com...\n');

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
    console.log(`🔑 Token Status: ${clientData.api_status}`);

    // Step 3: Check database campaigns
    console.log('\n📊 Step 3: Checking database campaigns...');
    const { data: dbCampaigns, error: dbError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', clientData.id)
      .order('date_range_start', { ascending: false })
      .limit(10);

    if (dbError) {
      console.error('❌ Error fetching database campaigns:', dbError);
      return;
    }

    console.log(`✅ Found ${dbCampaigns?.length || 0} campaigns in database`);
    
    if (dbCampaigns && dbCampaigns.length > 0) {
      console.log('\n📈 Database Campaigns (last 10):');
      dbCampaigns.forEach((campaign, index) => {
        console.log(`  ${index + 1}. ${campaign.campaign_name}`);
        console.log(`     Campaign ID: ${campaign.campaign_id}`);
        console.log(`     Status: ${campaign.status}`);
        console.log(`     Spend: ${campaign.spend} zł`);
        console.log(`     Date: ${campaign.date_range_start} to ${campaign.date_range_end}`);
        console.log(`     Impressions: ${campaign.impressions}`);
        console.log(`     Clicks: ${campaign.clicks}`);
        console.log('');
      });
    }

    // Step 4: Check Meta API campaigns
    console.log('\n🌐 Step 4: Checking Meta API campaigns...');
    
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
            start: '2025-08-01',
            end: new Date().toISOString().split('T')[0] // Today's date
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
        console.log(`✅ Found ${campaigns.length} campaigns in Meta API`);
        
        console.log('\n📋 Meta API Campaigns:');
        campaigns.forEach((campaign, index) => {
          console.log(`  ${index + 1}. ${campaign.campaign_name}`);
          console.log(`     Campaign ID: ${campaign.campaign_id}`);
          console.log(`     Status: ${campaign.status || 'Unknown'}`);
          console.log(`     Spend: ${campaign.spend || 0} zł`);
          console.log(`     Impressions: ${campaign.impressions || 0}`);
          console.log(`     Clicks: ${campaign.clicks || 0}`);
          console.log(`     CTR: ${campaign.ctr || 0}%`);
          console.log('');
        });

        // Check if any campaigns have spend
        const totalSpend = campaigns.reduce((sum, campaign) => sum + (campaign.spend || 0), 0);
        const totalImpressions = campaigns.reduce((sum, campaign) => sum + (campaign.impressions || 0), 0);
        const totalClicks = campaigns.reduce((sum, campaign) => sum + (campaign.clicks || 0), 0);

        console.log('\n📊 Meta API Summary:');
        console.log(`- Total Spend: ${totalSpend.toFixed(2)} zł`);
        console.log(`- Total Impressions: ${totalImpressions.toLocaleString()}`);
        console.log(`- Total Clicks: ${totalClicks}`);

        if (totalSpend === 0) {
          console.log('\n⚠️ ISSUE: All campaigns have 0 spend');
          console.log('Possible reasons:');
          console.log('1. Campaigns are paused in Meta Ads');
          console.log('2. Campaigns have no budget allocated');
          console.log('3. Campaigns are not running in the current period');
          console.log('4. API permissions are limited');
        } else {
          console.log('\n✅ SUCCESS: Found real data in Meta API');
        }
      } else {
        console.log('❌ No campaign data returned from Meta API');
      }
    } catch (error) {
      console.log(`❌ Error calling Meta API: ${error.message}`);
    }

    // Step 5: Recommendations
    console.log('\n🎯 Recommendations:');
    console.log('1. Check if campaigns are active in Meta Ads Manager');
    console.log('2. Verify campaign budgets and spending limits');
    console.log('3. Check if campaigns are scheduled for the current period');
    console.log('4. Verify API permissions for the access token');
    console.log('5. Consider testing with a different date range');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkCampaignStatus(); 