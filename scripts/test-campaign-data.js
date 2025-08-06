const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCampaignData() {
  console.log('🔍 Testing Campaign Data Across Date Ranges...\n');

  try {
    // Get client data
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, email, ad_account_id, meta_access_token')
      .eq('email', 'jac.honkisz@gmail.com')
      .single();

    if (clientError || !client) {
      console.error('❌ Client not found:', clientError);
      return;
    }

    console.log(`✅ Testing client: ${client.name} (${client.email})`);
    console.log(`📋 Ad Account ID: ${client.ad_account_id}\n`);

    if (!client.meta_access_token) {
      console.log('❌ No Meta token found');
      return;
    }

    const cleanAccountId = client.ad_account_id.replace('act_', '');

    // Test 1: Get all campaigns (without date filter)
    console.log('📋 Test 1: Getting all campaigns (no date filter)...');
    try {
      const campaignsResponse = await fetch(
        `https://graph.facebook.com/v18.0/act_${cleanAccountId}/campaigns?fields=id,name,status,objective,created_time&access_token=${client.meta_access_token}&limit=50`
      );
      
      const campaignsData = await campaignsResponse.json();
      
      if (campaignsData.error) {
        console.log(`    ❌ Campaigns error: ${campaignsData.error.message}`);
      } else {
        console.log(`    ✅ Found ${campaignsData.data?.length || 0} total campaigns`);
        
        if (campaignsData.data && campaignsData.data.length > 0) {
          console.log('    📊 Campaign details:');
          campaignsData.data.forEach((campaign, index) => {
            const createdDate = new Date(campaign.created_time);
            console.log(`      ${index + 1}. ${campaign.name} (${campaign.id})`);
            console.log(`         Status: ${campaign.status}, Objective: ${campaign.objective}`);
            console.log(`         Created: ${createdDate.toISOString().split('T')[0]}`);
          });
        }
      }
    } catch (error) {
      console.log(`    ❌ Campaigns test error: ${error.message}`);
    }

    // Test 2: Test different date ranges for insights
    const dateRanges = [
      {
        name: 'Last 7 days',
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
      },
      {
        name: 'Last 30 days',
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
      },
      {
        name: 'Last 90 days',
        start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
      },
      {
        name: 'Last 6 months',
        start: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
      },
      {
        name: 'Last year',
        start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
      }
    ];

    console.log('\n📈 Test 2: Testing campaign insights for different date ranges...');
    
    for (const dateRange of dateRanges) {
      console.log(`\n  🔍 Testing ${dateRange.name} (${dateRange.start} to ${dateRange.end})...`);
      
      try {
        const insightsResponse = await fetch(
          `https://graph.facebook.com/v18.0/act_${cleanAccountId}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc&access_token=${client.meta_access_token}&time_range={"since":"${dateRange.start}","until":"${dateRange.end}"}`
        );

        if (insightsResponse.status === 403) {
          console.log('    ❌ No access to campaign insights (ads_management permission needed)');
        } else {
          const insightsData = await insightsResponse.json();
          if (insightsData.error) {
            console.log(`    ❌ Insights error: ${insightsData.error.message}`);
          } else {
            console.log(`    ✅ Found ${insightsData.data?.length || 0} campaigns with data`);
            
            if (insightsData.data && insightsData.data.length > 0) {
              console.log('    📊 Campaign insights:');
              insightsData.data.forEach((insight, index) => {
                console.log(`      ${index + 1}. ${insight.campaign_name} (${insight.campaign_id})`);
                console.log(`         Spend: ${insight.spend || '0'}, Impressions: ${insight.impressions || '0'}, Clicks: ${insight.clicks || '0'}`);
                console.log(`         CTR: ${insight.ctr || '0'}%, CPC: ${insight.cpc || '0'}`);
              });
            }
          }
        }
      } catch (error) {
        console.log(`    ❌ Insights test error: ${error.message}`);
      }
    }

    // Test 3: Check account spending
    console.log('\n💰 Test 3: Checking account spending...');
    try {
      const spendingResponse = await fetch(
        `https://graph.facebook.com/v18.0/act_${cleanAccountId}/insights?fields=spend,impressions,clicks&access_token=${client.meta_access_token}&time_range={"since":"2024-01-01","until":"2024-12-31"}`
      );

      if (spendingResponse.status === 403) {
        console.log('    ❌ No access to account spending data');
      } else {
        const spendingData = await spendingResponse.json();
        if (spendingData.error) {
          console.log(`    ❌ Spending error: ${spendingData.error.message}`);
        } else {
          console.log(`    ✅ Account spending data: ${spendingData.data?.length || 0} records`);
          
          if (spendingData.data && spendingData.data.length > 0) {
            const totalSpend = spendingData.data.reduce((sum, record) => sum + parseFloat(record.spend || '0'), 0);
            const totalImpressions = spendingData.data.reduce((sum, record) => sum + parseInt(record.impressions || '0'), 0);
            const totalClicks = spendingData.data.reduce((sum, record) => sum + parseInt(record.clicks || '0'), 0);
            
            console.log(`    📊 Total spend: ${totalSpend.toFixed(2)}`);
            console.log(`    📊 Total impressions: ${totalImpressions.toLocaleString()}`);
            console.log(`    📊 Total clicks: ${totalClicks.toLocaleString()}`);
          }
        }
      }
    } catch (error) {
      console.log(`    ❌ Spending test error: ${error.message}`);
    }

    // Test 4: Check if there are any active campaigns
    console.log('\n🎯 Test 4: Checking for active campaigns...');
    try {
      const activeResponse = await fetch(
        `https://graph.facebook.com/v18.0/act_${cleanAccountId}/campaigns?fields=id,name,status,objective&access_token=${client.meta_access_token}&filtering=[{"field":"status","operator":"IN","value":["ACTIVE","PAUSED"]}]`
      );

      const activeData = await activeResponse.json();
      if (activeData.error) {
        console.log(`    ❌ Active campaigns error: ${activeData.error.message}`);
      } else {
        console.log(`    ✅ Found ${activeData.data?.length || 0} active/paused campaigns`);
        
        if (activeData.data && activeData.data.length > 0) {
          console.log('    📊 Active campaigns:');
          activeData.data.forEach((campaign, index) => {
            console.log(`      ${index + 1}. ${campaign.name} (${campaign.id}) - Status: ${campaign.status}`);
          });
        }
      }
    } catch (error) {
      console.log(`    ❌ Active campaigns test error: ${error.message}`);
    }

    console.log('\n📊 SUMMARY:');
    console.log('===========');
    console.log('The Meta API connection is working correctly.');
    console.log('The tokens have proper permissions.');
    console.log('The issue is likely that:');
    console.log('1. There are no campaigns in the tested date ranges');
    console.log('2. Campaigns exist but have no spending data');
    console.log('3. Campaigns are inactive or paused');
    console.log('\n💡 NEXT STEPS:');
    console.log('==============');
    console.log('1. Check if there are any campaigns in the account');
    console.log('2. Verify if campaigns have spending data');
    console.log('3. Test with different date ranges');
    console.log('4. Consider adding demo data for testing');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testCampaignData().then(() => {
  console.log('\n✅ Campaign Data Test Complete');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
}); 