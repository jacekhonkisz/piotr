const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testFixedLiveData() {
  try {
    console.log('🔍 Testing Fixed Live Data API...\n');

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
    console.log('');

    // Test the Meta API directly with the broader date range
    const accessToken = client.meta_access_token;
    const adAccountId = client.ad_account_id.replace('act_', '');
    
    console.log('🌐 Testing Meta API with broader date range (2024-2025)...');
    
    // Test account-level insights first
    const accountInsightsUrl = `https://graph.facebook.com/v18.0/act_${adAccountId}/insights?fields=spend,impressions,clicks,conversions,ctr,cpc&time_range={"since":"2024-01-01","until":"2025-12-31"}&level=account&access_token=${accessToken}`;
    
    const accountResponse = await fetch(accountInsightsUrl);
    const accountData = await accountResponse.json();
    
    console.log('📊 Account-level insights:');
    if (accountData.data && accountData.data.length > 0) {
      accountData.data.forEach((insight, index) => {
        console.log(`   Record ${index + 1}:`);
        console.log(`      💰 Spend: $${insight.spend || 0}`);
        console.log(`      👁️  Impressions: ${insight.impressions || 0}`);
        console.log(`      🖱️  Clicks: ${insight.clicks || 0}`);
        console.log(`      📊 CTR: ${insight.ctr || 0}%`);
        console.log(`      💸 CPC: $${insight.cpc || 0}`);
      });
    } else {
      console.log('   ❌ No account-level data found');
      if (accountData.error) {
        console.log(`   Error: ${accountData.error.message}`);
      }
    }
    console.log('');

    // Test campaign-level insights with broader date range
    const campaignInsightsUrl = `https://graph.facebook.com/v18.0/act_${adAccountId}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,conversions,ctr,cpc&time_range={"since":"2024-01-01","until":"2025-12-31"}&level=campaign&access_token=${accessToken}`;
    
    const campaignResponse = await fetch(campaignInsightsUrl);
    const campaignData = await campaignResponse.json();
    
    console.log('🎯 Campaign-level insights:');
    if (campaignData.data && campaignData.data.length > 0) {
      console.log(`   ✅ Found ${campaignData.data.length} campaigns with data!`);
      campaignData.data.forEach((campaign, index) => {
        console.log(`   ${index + 1}. ${campaign.campaign_name}`);
        console.log(`      💰 Spend: $${campaign.spend || 0}`);
        console.log(`      👁️  Impressions: ${campaign.impressions || 0}`);
        console.log(`      🖱️  Clicks: ${campaign.clicks || 0}`);
        console.log(`      📊 CTR: ${campaign.ctr || 0}%`);
        console.log(`      💸 CPC: $${campaign.cpc || 0}`);
      });
    } else {
      console.log('   ❌ No campaign-level data found');
      if (campaignData.error) {
        console.log(`   Error: ${campaignData.error.message}`);
      }
    }
    console.log('');

    // Test our fixed API endpoint
    console.log('🔧 Testing our fixed API endpoint...');
    
    // First, get a session token (we'll use the service role to bypass auth for testing)
    const { data: { session }, error: sessionError } = await supabase.auth.signInWithPassword({
      email: 'admin@example.com',
      password: 'password123'
    });

    if (sessionError || !session) {
      console.error('❌ Failed to get session:', sessionError);
      return;
    }

    const apiResponse = await fetch('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        dateRange: {
          start: '2024-01-01',
          end: '2025-12-31'
        }
      })
    });

    console.log('📡 API Response status:', apiResponse.status);
    
    const apiData = await apiResponse.json();
    
    if (apiResponse.ok) {
      console.log('✅ API Response:');
      console.log('Success:', apiData.success);
      console.log('Client:', apiData.data?.client?.name);
      console.log('Campaigns count:', apiData.data?.campaigns?.length || 0);
      console.log('Stats:', apiData.data?.stats);
      
      if (apiData.data?.campaigns?.length > 0) {
        console.log('\n🎯 Campaigns from API:');
        apiData.data.campaigns.forEach((campaign, index) => {
          console.log(`${index + 1}. ${campaign.campaign_name}`);
          console.log(`   💰 Spend: $${campaign.spend}`);
          console.log(`   👁️  Impressions: ${campaign.impressions}`);
          console.log(`   🖱️  Clicks: ${campaign.clicks}`);
          console.log(`   📊 CTR: ${campaign.ctr}%`);
        });
      }
    } else {
      console.log('❌ API Error:');
      console.log('Error:', apiData.error);
      console.log('Details:', apiData.details);
    }

  } catch (error) {
    console.error('❌ Error testing fixed live data:', error);
  }
}

testFixedLiveData(); 