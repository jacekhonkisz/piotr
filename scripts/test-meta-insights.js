const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMetaInsights() {
  try {
    console.log('🔍 Testing Meta API insights with different date ranges...\n');

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

    const accessToken = client.meta_access_token;
    const adAccountId = client.ad_account_id.replace('act_', '');

    // Test different date ranges
    const dateRanges = [
      { name: 'Last 7 days', start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] },
      { name: 'Last 30 days', start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] },
      { name: 'Last 90 days', start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] },
      { name: 'This month', start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] },
      { name: 'Last month', start: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split('T')[0], end: new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().split('T')[0] }
    ];

    for (const range of dateRanges) {
      console.log(`📅 Testing ${range.name}: ${range.start} to ${range.end}`);
      
      const insightsUrl = `https://graph.facebook.com/v18.0/act_${adAccountId}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,conversions,ctr,cpc&time_range={"since":"${range.start}","until":"${range.end}"}&level=campaign&access_token=${accessToken}`;
      
      const insightsResponse = await fetch(insightsUrl);
      const insightsData = await insightsResponse.json();
      
      if (insightsData.data && insightsData.data.length > 0) {
        console.log(`✅ Found ${insightsData.data.length} campaigns with data!`);
        insightsData.data.forEach((campaign, index) => {
          console.log(`   ${index + 1}. ${campaign.campaign_name}`);
          console.log(`      💰 Spend: $${campaign.spend || 0}`);
          console.log(`      👁️  Impressions: ${campaign.impressions || 0}`);
          console.log(`      🖱️  Clicks: ${campaign.clicks || 0}`);
        });
      } else {
        console.log(`❌ No data found for ${range.name}`);
        if (insightsData.error) {
          console.log(`   Error: ${insightsData.error.message}`);
        }
      }
      console.log('');
    }

    // Test individual campaigns
    console.log('🎯 Testing individual campaigns...');
    const campaignsResponse = await fetch(`https://graph.facebook.com/v18.0/act_${adAccountId}/campaigns?fields=id,name,status,created_time&access_token=${accessToken}`);
    const campaignsData = await campaignsResponse.json();
    
    if (campaignsData.data) {
      for (const campaign of campaignsData.data) {
        console.log(`\n📊 Testing campaign: ${campaign.name} (${campaign.status})`);
        console.log(`   Created: ${campaign.created_time}`);
        
        // Test insights for this specific campaign
        const campaignInsightsUrl = `https://graph.facebook.com/v18.0/${campaign.id}/insights?fields=impressions,clicks,spend,conversions,ctr,cpc&time_range={"since":"2025-01-01","until":"2025-12-31"}&access_token=${accessToken}`;
        
        const campaignInsightsResponse = await fetch(campaignInsightsUrl);
        const campaignInsightsData = await campaignInsightsResponse.json();
        
        if (campaignInsightsData.data && campaignInsightsData.data.length > 0) {
          console.log(`   ✅ Has data: ${campaignInsightsData.data.length} records`);
          campaignInsightsData.data.forEach((insight, index) => {
            console.log(`      Record ${index + 1}:`);
            console.log(`         💰 Spend: $${insight.spend || 0}`);
            console.log(`         👁️  Impressions: ${insight.impressions || 0}`);
            console.log(`         🖱️  Clicks: ${insight.clicks || 0}`);
            console.log(`         📊 CTR: ${insight.ctr || 0}%`);
          });
        } else {
          console.log(`   ❌ No insights data`);
          if (campaignInsightsData.error) {
            console.log(`      Error: ${campaignInsightsData.error.message}`);
          }
        }
      }
    }

  } catch (error) {
    console.error('❌ Error testing Meta insights:', error);
  }
}

testMetaInsights(); 