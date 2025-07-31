const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
require('dotenv').config({path: '.env.local'});

// Test Meta API directly
async function testMetaAPIDirect() {
  console.log('🧪 Testing Meta API Direct Access...\n');

  // Initialize Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Get a client with Meta API token
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, name, meta_access_token, ad_account_id')
      .not('meta_access_token', 'is', null)
      .limit(1);

    if (clientError || !clients || clients.length === 0) {
      console.error('❌ No clients with Meta API tokens found');
      return;
    }

    const client = clients[0];
    console.log(`🔍 Testing client: ${client.name}`);
    console.log(`   ID: ${client.id}`);
    console.log(`   Ad Account: ${client.ad_account_id}`);
    console.log(`   Token: ${client.meta_access_token.substring(0, 20)}...`);

    // Test current month
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const monthStartDate = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
    const monthEndDate = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    console.log(`\n📅 Testing date range: ${monthStartDate} to ${monthEndDate}`);

    // Test direct Meta API call
    console.log('\n1. Testing direct Meta API call...');
    try {
      const metaApiUrl = `https://graph.facebook.com/v18.0/act_${client.ad_account_id}/insights`;
      const params = new URLSearchParams({
        access_token: client.meta_access_token,
        fields: 'campaign_name,spend,impressions,clicks,ctr,cpc,conversions',
        time_range: JSON.stringify({since: monthStartDate, until: monthEndDate}),
        level: 'campaign',
        limit: '10'
      });

      console.log(`   API URL: ${metaApiUrl}`);
      console.log(`   Testing with ad account: ${client.ad_account_id}`);

      const metaResponse = await fetch(`${metaApiUrl}?${params}`);
      const metaData = await metaResponse.json();

      if (metaData.error) {
        console.log(`   ❌ Meta API Error: ${metaData.error.message}`);
        console.log(`   Error Code: ${metaData.error.code}`);
        console.log(`   Error Subcode: ${metaData.error.error_subcode}`);
        
        if (metaData.error.code === 190) {
          console.log(`   💡 Token might be expired or invalid`);
        } else if (metaData.error.code === 100) {
          console.log(`   💡 Ad account ID might be incorrect`);
        } else if (metaData.error.code === 294) {
          console.log(`   💡 Managing Ad Account permission required`);
        }
      } else {
        console.log(`   ✅ Meta API Success: ${metaData.data?.length || 0} campaigns found`);
        if (metaData.data && metaData.data.length > 0) {
          console.log('\n📊 Real campaign data:');
          metaData.data.forEach((campaign, index) => {
            console.log(`   ${index + 1}. ${campaign.campaign_name}`);
            console.log(`      Spend: ${campaign.spend} zł`);
            console.log(`      Impressions: ${campaign.impressions}`);
            console.log(`      Clicks: ${campaign.clicks}`);
            console.log(`      CTR: ${campaign.ctr}%`);
            console.log(`      CPC: ${campaign.cpc} zł`);
            console.log(`      Conversions: ${campaign.conversions || 0}`);
          });
        } else {
          console.log('   ⚠️  No campaigns found for this period');
        }
      }
    } catch (metaError) {
      console.log(`   ❌ Meta API call failed: ${metaError.message}`);
    }

    // Test fetch-live-data endpoint
    console.log('\n2. Testing fetch-live-data endpoint...');
    try {
      const apiResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/fetch-live-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
          dateRange: {
            start: monthStartDate,
            end: monthEndDate
          },
          clientId: client.id
        })
      });

      if (apiResponse.ok) {
        const monthData = await apiResponse.json();
        
        if (monthData.success && monthData.data?.campaigns) {
          console.log(`   ✅ fetch-live-data Success: ${monthData.data.campaigns.length} campaigns`);
          if (monthData.data.campaigns.length > 0) {
            console.log('\n📊 Processed campaign data:');
            monthData.data.campaigns.forEach((campaign, index) => {
              console.log(`   ${index + 1}. ${campaign.campaign_name}`);
              console.log(`      Spend: ${campaign.spend} zł`);
              console.log(`      Impressions: ${campaign.impressions}`);
              console.log(`      Clicks: ${campaign.clicks}`);
              console.log(`      CTR: ${campaign.ctr}%`);
            });
          }
        } else {
          console.log(`   ⚠️  No campaigns in fetch-live-data response`);
          console.log(`   Response:`, monthData);
        }
      } else {
        const errorData = await apiResponse.json().catch(() => ({}));
        console.log(`   ❌ fetch-live-data failed: ${apiResponse.status} - ${errorData.error || 'Unknown error'}`);
      }
    } catch (apiError) {
      console.log(`   ❌ fetch-live-data call failed: ${apiError.message}`);
    }

    console.log('\n🎉 Meta API direct test completed!');
    console.log('\n📋 Analysis:');
    console.log('   - If Meta API returns real data → PDF should show real data');
    console.log('   - If Meta API returns no data → PDF will show demo data');
    console.log('   - If Meta API returns errors → Check token permissions');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

// Run the test
testMetaAPIDirect().catch(console.error); 