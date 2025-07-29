require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testHistoricalData() {
  console.log('📊 Testing Historical Data for jac.honkisz@gmail.com\n');

  try {
    // Get the client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'jac.honkisz@gmail.com')
      .single();

    if (clientError || !client) {
      console.error('❌ Client not found:', clientError);
      return;
    }

    const baseUrl = 'https://graph.facebook.com/v18.0';
    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4) 
      : client.ad_account_id;

    console.log(`🔗 Testing with account: act_${adAccountId}`);

    // Test different date ranges
    const dateRanges = [
      { name: 'Last 7 days', start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), end: new Date() },
      { name: 'Last 30 days', start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), end: new Date() },
      { name: 'Last 90 days', start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), end: new Date() },
      { name: 'Last 6 months', start: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), end: new Date() },
      { name: 'This year', start: new Date('2024-01-01'), end: new Date() },
      { name: 'Last year', start: new Date('2023-01-01'), end: new Date('2023-12-31') },
    ];

    for (const range of dateRanges) {
      const startDate = range.start.toISOString().split('T')[0];
      const endDate = range.end.toISOString().split('T')[0];
      
      console.log(`\n📅 Testing ${range.name} (${startDate} to ${endDate})...`);
      
      const insightsUrl = `${baseUrl}/act_${adAccountId}/insights?access_token=${client.meta_access_token}&fields=campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc,date_start,date_stop&time_range=${JSON.stringify({since: startDate, until: endDate})}&level=campaign&limit=25`;
      
      try {
        const insightsResponse = await fetch(insightsUrl);
        const insightsData = await insightsResponse.json();
        
        if (insightsData.error) {
          console.log(`   ❌ Error: ${insightsData.error.message} (Code: ${insightsData.error.code})`);
        } else {
          console.log(`   ✅ Found ${insightsData.data?.length || 0} campaign insights`);
          if (insightsData.data && insightsData.data.length > 0) {
            let totalSpend = 0;
            let totalImpressions = 0;
            let totalClicks = 0;
            
            insightsData.data.forEach((insight, index) => {
              const spend = parseFloat(insight.spend || 0);
              const impressions = parseInt(insight.impressions || 0);
              const clicks = parseInt(insight.clicks || 0);
              
              totalSpend += spend;
              totalImpressions += impressions;
              totalClicks += clicks;
              
              console.log(`      ${index + 1}. ${insight.campaign_name || insight.campaign_id}`);
              console.log(`         - Spend: $${spend.toFixed(2)}`);
              console.log(`         - Impressions: ${impressions.toLocaleString()}`);
              console.log(`         - Clicks: ${clicks.toLocaleString()}`);
              console.log(`         - CTR: ${insight.ctr || 0}%`);
              console.log(`         - Date: ${insight.date_start} to ${insight.date_stop}`);
            });
            
            console.log(`   📊 Totals: $${totalSpend.toFixed(2)} spend, ${totalImpressions.toLocaleString()} impressions, ${totalClicks.toLocaleString()} clicks`);
          } else {
            console.log(`   ⚠️ No insights data found for this period`);
          }
        }
      } catch (error) {
        console.log(`   ❌ Request failed: ${error.message}`);
      }
    }

    // Test account-level insights
    console.log(`\n🏢 Testing account-level insights (last 30 days)...`);
    const accountInsightsUrl = `${baseUrl}/act_${adAccountId}/insights?access_token=${client.meta_access_token}&fields=impressions,clicks,spend,ctr,cpc&time_range=${JSON.stringify({since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], until: new Date().toISOString().split('T')[0]})}&level=account&limit=10`;
    
    try {
      const accountInsightsResponse = await fetch(accountInsightsUrl);
      const accountInsightsData = await accountInsightsResponse.json();
      
      if (accountInsightsData.error) {
        console.log(`   ❌ Account insights error: ${accountInsightsData.error.message}`);
      } else {
        console.log(`   ✅ Found ${accountInsightsData.data?.length || 0} account insights`);
        if (accountInsightsData.data && accountInsightsData.data.length > 0) {
          accountInsightsData.data.forEach((insight, index) => {
            console.log(`      ${index + 1}. Account Level`);
            console.log(`         - Spend: $${insight.spend || 0}`);
            console.log(`         - Impressions: ${insight.impressions || 0}`);
            console.log(`         - Clicks: ${insight.clicks || 0}`);
            console.log(`         - CTR: ${insight.ctr || 0}%`);
          });
        } else {
          console.log(`   ⚠️ No account-level insights found`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Account insights request failed: ${error.message}`);
    }

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testHistoricalData(); 