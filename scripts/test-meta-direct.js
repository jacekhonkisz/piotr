const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMetaDirect() {
  try {
    console.log('🔍 Testing Meta API directly with jacek credentials...\n');

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

    if (!client.meta_access_token) {
      console.error('❌ No Meta access token found');
      return;
    }

    // Test Meta API directly
    console.log('🌐 Testing Meta API directly...');
    
    const accessToken = client.meta_access_token;
    const adAccountId = client.ad_account_id.replace('act_', '');
    
    console.log('🔑 Using access token:', accessToken.substring(0, 20) + '...');
    console.log('🏢 Using ad account ID:', adAccountId);
    console.log('');

    // Test 1: Validate token
    console.log('🔐 Step 1: Validating token...');
    const tokenResponse = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${accessToken}`);
    const tokenData = await tokenResponse.json();
    console.log('Token validation response:', tokenData);
    console.log('');

    if (tokenData.error) {
      console.error('❌ Token validation failed:', tokenData.error);
      return;
    }

    // Test 2: Get ad accounts
    console.log('🏢 Step 2: Getting ad accounts...');
    const accountsResponse = await fetch(`https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_id&access_token=${accessToken}`);
    const accountsData = await accountsResponse.json();
    console.log('Ad accounts response:', accountsData);
    console.log('');

    // Test 3: Get campaigns
    console.log('🎯 Step 3: Getting campaigns...');
    const campaignsResponse = await fetch(`https://graph.facebook.com/v18.0/act_${adAccountId}/campaigns?fields=id,name,status&access_token=${accessToken}`);
    const campaignsData = await campaignsResponse.json();
    console.log('Campaigns response:', campaignsData);
    console.log('');

    // Test 4: Get campaign insights
    console.log('📊 Step 4: Getting campaign insights...');
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];
    
    const insightsUrl = `https://graph.facebook.com/v18.0/act_${adAccountId}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,conversions,ctr,cpc&time_range={"since":"${startDate}","until":"${endDate}"}&level=campaign&access_token=${accessToken}`;
    
    console.log('🔗 Insights URL:', insightsUrl);
    const insightsResponse = await fetch(insightsUrl);
    const insightsData = await insightsResponse.json();
    console.log('Insights response:', insightsData);
    console.log('');

    if (insightsData.data && insightsData.data.length > 0) {
      console.log('✅ Found campaign data!');
      console.log(`📊 Number of campaigns: ${insightsData.data.length}`);
      
      insightsData.data.forEach((campaign, index) => {
        console.log(`\n🎯 Campaign ${index + 1}:`);
        console.log(`   Name: ${campaign.campaign_name}`);
        console.log(`   ID: ${campaign.campaign_id}`);
        console.log(`   💰 Spend: $${campaign.spend || 0}`);
        console.log(`   👁️  Impressions: ${campaign.impressions || 0}`);
        console.log(`   🖱️  Clicks: ${campaign.clicks || 0}`);
        console.log(`   📊 CTR: ${campaign.ctr || 0}%`);
      });
    } else {
      console.log('⚠️  No campaign data found');
      if (insightsData.error) {
        console.log('Error:', insightsData.error);
      }
    }

  } catch (error) {
    console.error('❌ Error testing Meta API:', error);
  }
}

testMetaDirect(); 