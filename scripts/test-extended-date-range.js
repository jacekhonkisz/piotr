// Test script to check if there was spend data before March 29, 2024
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testExtendedDateRange() {
  console.log('🔍 Testing extended date range to find earlier spend data...\n');

  try {
    // 1. Get a client
    console.log('📋 Step 1: Getting client data...');
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, name, email, created_at, ad_account_id, meta_access_token')
      .limit(1);

    if (clientError) {
      console.error('❌ Error fetching clients:', clientError);
      return;
    }

    if (!clients || clients.length === 0) {
      console.error('❌ No clients found');
      return;
    }

    const client = clients[0];
    console.log('✅ Client found:', {
      id: client.id,
      name: client.name,
      email: client.email,
      created_at: client.created_at,
      ad_account_id: client.ad_account_id,
      hasToken: !!client.meta_access_token,
      tokenLength: client.meta_access_token?.length || 0
    });

    if (!client.meta_access_token) {
      console.error('❌ No Meta API token found for client');
      return;
    }

    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;

    // 2. Test earlier months to see if there was spend before March 2024
    console.log('\n📅 Step 2: Testing earlier months for spend data...');
    
    const earlierMonths = [
      { year: 2023, month: 1, name: 'January 2023' },
      { year: 2023, month: 6, name: 'June 2023' },
      { year: 2023, month: 12, name: 'December 2023' },
      { year: 2024, month: 1, name: 'January 2024' },
      { year: 2024, month: 2, name: 'February 2024' },
      { year: 2024, month: 3, name: 'March 2024' },
      { year: 2024, month: 4, name: 'April 2024' },
      { year: 2024, month: 5, name: 'May 2024' },
      { year: 2024, month: 6, name: 'June 2024' },
      { year: 2024, month: 7, name: 'July 2024' },
      { year: 2024, month: 8, name: 'August 2024' },
      { year: 2024, month: 9, name: 'September 2024' },
      { year: 2024, month: 10, name: 'October 2024' },
      { year: 2024, month: 11, name: 'November 2024' },
      { year: 2024, month: 12, name: 'December 2024' },
      { year: 2025, month: 1, name: 'January 2025' },
      { year: 2025, month: 2, name: 'February 2025' },
      { year: 2025, month: 3, name: 'March 2025' },
      { year: 2025, month: 4, name: 'April 2025' },
      { year: 2025, month: 5, name: 'May 2025' },
      { year: 2025, month: 6, name: 'June 2025' },
      { year: 2025, month: 7, name: 'July 2025' },
      { year: 2025, month: 8, name: 'August 2025' }
    ];

    let allCampaigns = [];
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;
    let monthsWithData = [];

    for (const monthInfo of earlierMonths) {
      console.log(`\n📅 Testing ${monthInfo.name}...`);
      
      const startDay = '01';
      const endDay = String(new Date(monthInfo.year, monthInfo.month + 1, 0).getDate());
      
      const insightsUrl = `https://graph.facebook.com/v18.0/act_${adAccountId}/insights?access_token=${client.meta_access_token}&fields=campaign_id,campaign_name,impressions,clicks,spend,conversions&time_range={"since":"${monthInfo.year}-${String(monthInfo.month + 1).padStart(2, '0')}-${startDay}","until":"${monthInfo.year}-${String(monthInfo.month + 1).padStart(2, '0')}-${endDay}"}&level=campaign`;
      
      try {
        const response = await fetch(insightsUrl);
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
          console.log(`✅ ${monthInfo.name} has data:`, data.data.map(insight => ({
            campaign_id: insight.campaign_id,
            campaign_name: insight.campaign_name,
            impressions: insight.impressions,
            clicks: insight.clicks,
            spend: insight.spend,
            conversions: insight.conversions
          })));

          // Add to totals
          data.data.forEach(insight => {
            totalSpend += parseFloat(insight.spend) || 0;
            totalImpressions += parseInt(insight.impressions) || 0;
            totalClicks += parseInt(insight.clicks) || 0;
            totalConversions += parseInt(insight.conversions) || 0;
          });

          allCampaigns.push(...data.data);
          monthsWithData.push({
            month: monthInfo.name,
            spend: data.data.reduce((sum, insight) => sum + (parseFloat(insight.spend) || 0), 0),
            impressions: data.data.reduce((sum, insight) => sum + (parseInt(insight.impressions) || 0), 0),
            clicks: data.data.reduce((sum, insight) => sum + (parseInt(insight.clicks) || 0), 0)
          });
        } else {
          console.log(`⚠️ ${monthInfo.name} has no data`);
        }
      } catch (error) {
        console.log(`❌ Error testing ${monthInfo.name}:`, error.message);
      }

      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // 3. Show comprehensive results
    console.log('\n📊 Step 3: Comprehensive spend analysis...');
    
    console.log('📊 Total aggregated data:', {
      totalSpend: totalSpend.toFixed(2) + ' zł',
      totalImpressions: totalImpressions.toLocaleString(),
      totalClicks: totalClicks.toLocaleString(),
      totalConversions: totalConversions.toLocaleString(),
      campaignsWithData: allCampaigns.length,
      monthsWithData: monthsWithData.length
    });

    if (monthsWithData.length > 0) {
      console.log('\n📅 Months with spend data:');
      monthsWithData.forEach(month => {
        console.log(`- ${month.month}: ${month.spend.toFixed(2)} zł, ${month.impressions} impressions, ${month.clicks} clicks`);
      });
    }

    // 4. Find the earliest month with data
    if (monthsWithData.length > 0) {
      const earliestMonth = monthsWithData[0];
      console.log(`\n📅 Earliest month with spend data: ${earliestMonth.month}`);
      console.log(`💡 This suggests the true start of advertising activity`);
    }

    // 5. Compare with our previous findings
    console.log('\n📊 Step 4: Comparison with previous findings...');
    
    const march2024Data = monthsWithData.find(m => m.month === 'March 2024');
    if (march2024Data) {
      console.log('📊 March 2024 data:', {
        spend: march2024Data.spend.toFixed(2) + ' zł',
        impressions: march2024Data.impressions.toLocaleString(),
        clicks: march2024Data.clicks.toLocaleString()
      });
    }

    console.log('\n🎯 Analysis Summary:');
    console.log(`- Total spend found: ${totalSpend.toFixed(2)} zł`);
    console.log(`- Months with data: ${monthsWithData.length}`);
    console.log(`- This might explain the 259 PLN you mentioned`);
    console.log(`- The data spans from the earliest month with activity to today`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testExtendedDateRange(); 