require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMonthlyInsights() {
  console.log('📊 Testing Monthly Insights from Meta API\n');

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

    // Test monthly insights with different approaches
    const testCases = [
      {
        name: 'Monthly breakdown with time_increment=1',
        params: {
          time_increment: 1,
          time_range: JSON.stringify({since: '2024-01-01', until: '2024-12-31'})
        }
      },
      {
        name: 'Monthly breakdown with breakdowns',
        params: {
          breakdowns: JSON.stringify(['time_period']),
          time_range: JSON.stringify({since: '2024-01-01', until: '2024-12-31'})
        }
      },
      {
        name: 'Daily breakdown (to see if we can aggregate to monthly)',
        params: {
          time_increment: 1,
          time_range: JSON.stringify({since: '2024-01-01', until: '2024-01-31'})
        }
      },
      {
        name: 'Last year monthly data',
        params: {
          time_increment: 1,
          time_range: JSON.stringify({since: '2023-01-01', until: '2023-12-31'})
        }
      }
    ];

    for (const testCase of testCases) {
      console.log(`\n📅 Testing: ${testCase.name}`);
      
      const fields = [
        'campaign_id',
        'campaign_name',
        'impressions',
        'clicks',
        'spend',
        'ctr',
        'cpc',
        'date_start',
        'date_stop'
      ].join(',');

      const params = new URLSearchParams({
        access_token: client.meta_access_token,
        fields: fields,
        level: 'campaign',
        limit: '100',
        ...testCase.params
      });

      const url = `${baseUrl}/act_${adAccountId}/insights?${params.toString()}`;
      
      try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
          console.log(`   ❌ Error: ${data.error.message} (Code: ${data.error.code})`);
        } else {
          console.log(`   ✅ Found ${data.data?.length || 0} insights`);
          
          if (data.data && data.data.length > 0) {
            // Group by month if we have time_increment data
            const monthlyData = {};
            
            data.data.forEach((insight, index) => {
              const dateStart = insight.date_start;
              const month = dateStart ? dateStart.substring(0, 7) : 'unknown'; // YYYY-MM format
              
              if (!monthlyData[month]) {
                monthlyData[month] = {
                  campaigns: [],
                  totalSpend: 0,
                  totalImpressions: 0,
                  totalClicks: 0
                };
              }
              
              const spend = parseFloat(insight.spend || 0);
              const impressions = parseInt(insight.impressions || 0);
              const clicks = parseInt(insight.clicks || 0);
              
              monthlyData[month].campaigns.push({
                name: insight.campaign_name || insight.campaign_id,
                spend,
                impressions,
                clicks,
                ctr: insight.ctr || 0,
                dateStart: insight.date_start,
                dateStop: insight.date_stop
              });
              
              monthlyData[month].totalSpend += spend;
              monthlyData[month].totalImpressions += impressions;
              monthlyData[month].totalClicks += clicks;
            });
            
            // Display monthly summary
            Object.keys(monthlyData).sort().forEach(month => {
              const monthData = monthlyData[month];
              console.log(`   📊 ${month}: $${monthData.totalSpend.toFixed(2)} spend, ${monthData.totalImpressions.toLocaleString()} impressions, ${monthData.totalClicks.toLocaleString()} clicks`);
              
              monthData.campaigns.forEach((campaign, index) => {
                console.log(`      ${index + 1}. ${campaign.name}`);
                console.log(`         - Spend: $${campaign.spend.toFixed(2)}`);
                console.log(`         - Impressions: ${campaign.impressions.toLocaleString()}`);
                console.log(`         - Clicks: ${campaign.clicks.toLocaleString()}`);
                console.log(`         - CTR: ${campaign.ctr}%`);
                console.log(`         - Period: ${campaign.dateStart} to ${campaign.dateStop}`);
              });
            });
          } else {
            console.log(`   ⚠️ No data found for this approach`);
          }
        }
      } catch (error) {
        console.log(`   ❌ Request failed: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testMonthlyInsights(); 