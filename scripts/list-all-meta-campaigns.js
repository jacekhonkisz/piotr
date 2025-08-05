require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function listAllMetaCampaigns() {
  console.log('🔍 Listing ALL Campaigns from Meta API for jac.honkisz@gmail.com...\n');

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

    // Step 3: Fetch ALL campaigns from Meta API
    console.log('\n🌐 Step 3: Fetching ALL campaigns from Meta API...');
    
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
            start: '2024-01-01',
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
        console.log(`✅ Found ${campaigns.length} campaigns in Meta API\n`);
        
        console.log('📋 ALL Meta API Campaigns:');
        console.log('=' .repeat(80));
        
        campaigns.forEach((campaign, index) => {
          console.log(`\n${index + 1}. ${campaign.campaign_name}`);
          console.log(`   Campaign ID: ${campaign.campaign_id}`);
          console.log(`   Status: ${campaign.status || 'Unknown'}`);
          console.log(`   Spend: ${campaign.spend || 0} zł`);
          console.log(`   Impressions: ${campaign.impressions || 0}`);
          console.log(`   Clicks: ${campaign.clicks || 0}`);
          console.log(`   CTR: ${campaign.ctr || 0}%`);
          console.log(`   CPC: ${campaign.cpc || 0} zł`);
          console.log(`   Conversions: ${campaign.conversions || 0}`);
          console.log(`   Reach: ${campaign.reach || 0}`);
          console.log(`   Frequency: ${campaign.frequency || 0}`);
          
          // Add any additional fields that might be available
          if (campaign.objective) console.log(`   Objective: ${campaign.objective}`);
          if (campaign.bid_strategy) console.log(`   Bid Strategy: ${campaign.bid_strategy}`);
          if (campaign.budget_remaining) console.log(`   Budget Remaining: ${campaign.budget_remaining} zł`);
          if (campaign.created_time) console.log(`   Created: ${campaign.created_time}`);
          if (campaign.updated_time) console.log(`   Updated: ${campaign.updated_time}`);
          
          console.log('   ' + '-'.repeat(60));
        });

        // Calculate totals
        const totalSpend = campaigns.reduce((sum, campaign) => sum + (campaign.spend || 0), 0);
        const totalImpressions = campaigns.reduce((sum, campaign) => sum + (campaign.impressions || 0), 0);
        const totalClicks = campaigns.reduce((sum, campaign) => sum + (campaign.clicks || 0), 0);
        const totalConversions = campaigns.reduce((sum, campaign) => sum + (campaign.conversions || 0), 0);
        const totalReach = campaigns.reduce((sum, campaign) => sum + (campaign.reach || 0), 0);

        const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
        const averageCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
        const averageFrequency = totalReach > 0 ? totalImpressions / totalReach : 0;

        console.log('\n📊 Meta API Summary:');
        console.log('=' .repeat(50));
        console.log(`Total Campaigns: ${campaigns.length}`);
        console.log(`Total Spend: ${totalSpend.toFixed(2)} zł`);
        console.log(`Total Impressions: ${totalImpressions.toLocaleString()}`);
        console.log(`Total Clicks: ${totalClicks.toLocaleString()}`);
        console.log(`Total Conversions: ${totalConversions.toLocaleString()}`);
        console.log(`Total Reach: ${totalReach.toLocaleString()}`);
        console.log(`Average CTR: ${averageCtr.toFixed(2)}%`);
        console.log(`Average CPC: ${averageCpc.toFixed(2)} zł`);
        console.log(`Average Frequency: ${averageFrequency.toFixed(2)}`);

        // Status breakdown
        const statusCount = {};
        campaigns.forEach(campaign => {
          const status = campaign.status || 'Unknown';
          statusCount[status] = (statusCount[status] || 0) + 1;
        });

        console.log('\n📈 Campaign Status Breakdown:');
        Object.entries(statusCount).forEach(([status, count]) => {
          console.log(`   ${status}: ${count} campaigns`);
        });

        // Check if any campaigns have spend
        const campaignsWithSpend = campaigns.filter(campaign => (campaign.spend || 0) > 0);
        console.log(`\n💰 Campaigns with spend: ${campaignsWithSpend.length}/${campaigns.length}`);

        if (campaignsWithSpend.length > 0) {
          console.log('\n📈 Campaigns with Real Spend:');
          campaignsWithSpend.forEach((campaign, index) => {
            console.log(`   ${index + 1}. ${campaign.campaign_name}: ${campaign.spend} zł`);
          });
        } else {
          console.log('\n⚠️ No campaigns have spend in the current period');
        }

      } else {
        console.log('❌ No campaign data returned from Meta API');
        if (apiData.error) {
          console.log(`Error: ${apiData.error}`);
        }
      }
    } catch (error) {
      console.log(`❌ Error calling Meta API: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

listAllMetaCampaigns(); 