require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testSpecificClient() {
  console.log('🧪 Testing specific client: jac.honkisz@gmail.com\n');

  try {
    // Get the specific client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'jac.honkisz@gmail.com')
      .single();

    if (clientError || !client) {
      console.error('❌ Client not found:', clientError);
      return;
    }

    console.log('📊 Client data:');
    console.log(`   - Name: ${client.name}`);
    console.log(`   - Ad Account ID: ${client.ad_account_id}`);
    console.log(`   - Has Token: ${!!client.meta_access_token}`);
    console.log(`   - Token Preview: ${client.meta_access_token ? client.meta_access_token.substring(0, 20) + '...' : 'NONE'}`);

    if (!client.meta_access_token) {
      console.log('❌ No Meta token found');
      return;
    }

    // Test Meta API directly
    const baseUrl = 'https://graph.facebook.com/v18.0';
    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4) 
      : client.ad_account_id;
    
    console.log(`\n🔗 Testing Meta API with account: act_${adAccountId}`);

    // Test 1: Account info
    console.log('\n1. Testing account info...');
    const accountUrl = `${baseUrl}/act_${adAccountId}?access_token=${client.meta_access_token}&fields=id,name,account_id,currency,timezone_name`;
    
    try {
      const accountResponse = await fetch(accountUrl);
      const accountData = await accountResponse.json();
      
      if (accountData.error) {
        console.log(`   ❌ Account error: ${accountData.error.message} (Code: ${accountData.error.code})`);
      } else {
        console.log(`   ✅ Account success: ${accountData.name}`);
        console.log(`      - Currency: ${accountData.currency}`);
        console.log(`      - Timezone: ${accountData.timezone_name}`);
      }
    } catch (error) {
      console.log(`   ❌ Account request failed: ${error.message}`);
    }

    // Test 2: Campaigns
    console.log('\n2. Testing campaigns...');
    const campaignsUrl = `${baseUrl}/act_${adAccountId}/campaigns?access_token=${client.meta_access_token}&fields=id,name,status,objective&limit=5`;
    
    try {
      const campaignsResponse = await fetch(campaignsUrl);
      const campaignsData = await campaignsResponse.json();
      
      if (campaignsData.error) {
        console.log(`   ❌ Campaigns error: ${campaignsData.error.message} (Code: ${campaignsData.error.code})`);
      } else {
        console.log(`   ✅ Found ${campaignsData.data?.length || 0} campaigns`);
        if (campaignsData.data && campaignsData.data.length > 0) {
          campaignsData.data.forEach((campaign, index) => {
            console.log(`      ${index + 1}. ${campaign.name} (${campaign.status})`);
          });
        }
      }
    } catch (error) {
      console.log(`   ❌ Campaigns request failed: ${error.message}`);
    }

    // Test 3: Insights for last 7 days
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    console.log(`\n3. Testing insights (${startDate} to ${endDate})...`);
    const insightsUrl = `${baseUrl}/act_${adAccountId}/insights?access_token=${client.meta_access_token}&fields=campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc&time_range=${JSON.stringify({since: startDate, until: endDate})}&level=campaign&limit=10`;
    
    try {
      const insightsResponse = await fetch(insightsUrl);
      const insightsData = await insightsResponse.json();
      
      if (insightsData.error) {
        console.log(`   ❌ Insights error: ${insightsData.error.message} (Code: ${insightsData.error.code})`);
      } else {
        console.log(`   ✅ Found ${insightsData.data?.length || 0} campaign insights`);
        if (insightsData.data && insightsData.data.length > 0) {
          insightsData.data.forEach((insight, index) => {
            console.log(`      ${index + 1}. ${insight.campaign_name || insight.campaign_id}`);
            console.log(`         - Spend: $${insight.spend || 0}`);
            console.log(`         - Impressions: ${insight.impressions || 0}`);
            console.log(`         - Clicks: ${insight.clicks || 0}`);
            console.log(`         - CTR: ${insight.ctr || 0}%`);
          });
        } else {
          console.log(`   ⚠️ No insights data found for this period`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Insights request failed: ${error.message}`);
    }

    // Test 4: Try a longer date range
    console.log(`\n4. Testing insights with longer range (last 30 days)...`);
    const longStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const longInsightsUrl = `${baseUrl}/act_${adAccountId}/insights?access_token=${client.meta_access_token}&fields=campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc&time_range=${JSON.stringify({since: longStartDate, until: endDate})}&level=campaign&limit=10`;
    
    try {
      const longInsightsResponse = await fetch(longInsightsUrl);
      const longInsightsData = await longInsightsResponse.json();
      
      if (longInsightsData.error) {
        console.log(`   ❌ Long range insights error: ${longInsightsData.error.message} (Code: ${longInsightsData.error.code})`);
      } else {
        console.log(`   ✅ Found ${longInsightsData.data?.length || 0} campaign insights in 30 days`);
        if (longInsightsData.data && longInsightsData.data.length > 0) {
          longInsightsData.data.forEach((insight, index) => {
            console.log(`      ${index + 1}. ${insight.campaign_name || insight.campaign_id}`);
            console.log(`         - Spend: $${insight.spend || 0}`);
            console.log(`         - Impressions: ${insight.impressions || 0}`);
            console.log(`         - Clicks: ${insight.clicks || 0}`);
          });
        } else {
          console.log(`   ⚠️ No insights data found in 30 days either`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Long range insights request failed: ${error.message}`);
    }

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testSpecificClient(); 