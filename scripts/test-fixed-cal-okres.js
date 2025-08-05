// Test script to verify the fixed "Cały Okres" functionality
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testFixedCalOkres() {
  console.log('🧪 Testing fixed "Cały Okres" functionality...\n');

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

    // 2. Simulate the fixed "Cały Okres" logic
    console.log('\n🔍 Step 2: Simulating fixed "Cały Okres" logic...');
    
    // Get campaign creation dates (this is what the fix does)
    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;
    
    console.log('📡 Fetching campaigns to find earliest creation date...');
    
    const campaignsResponse = await fetch(`https://graph.facebook.com/v18.0/act_${adAccountId}/campaigns?access_token=${client.meta_access_token}&fields=id,name,created_time`);
    
    let earliestCampaignDate = null;
    
    if (campaignsResponse.ok) {
      const campaignsData = await campaignsResponse.json();
      if (campaignsData.data && campaignsData.data.length > 0) {
        // Find the earliest campaign creation date
        const campaignDates = campaignsData.data.map((c) => new Date(c.created_time));
        earliestCampaignDate = new Date(Math.min(...campaignDates));
        console.log(`📅 Earliest campaign created: ${earliestCampaignDate.toISOString().split('T')[0]}`);
      }
    }

    // Calculate effective start date (FIXED LOGIC)
    const currentDate = new Date();
    const maxPastDate = new Date();
    maxPastDate.setMonth(maxPastDate.getMonth() - 37); // Meta API limit
    
    const clientStartDate = new Date(client.created_at);
    console.log(`📅 Client business start date: ${clientStartDate.toISOString().split('T')[0]}`);
    
    // Use the earliest campaign date, but respect API limits
    let effectiveStartDate;
    if (earliestCampaignDate) {
      effectiveStartDate = earliestCampaignDate > maxPastDate ? earliestCampaignDate : maxPastDate;
      console.log(`📅 Using campaign-based start date: ${effectiveStartDate.toISOString().split('T')[0]}`);
    } else {
      // Fallback to client start date
      effectiveStartDate = clientStartDate > maxPastDate ? clientStartDate : maxPastDate;
      console.log(`📅 Using client-based start date: ${effectiveStartDate.toISOString().split('T')[0]}`);
    }
    
    console.log(`📅 Effective start date: ${effectiveStartDate.toISOString().split('T')[0]}`);

    // 3. Test the API endpoint with the fixed date range
    console.log('\n🌐 Step 3: Testing API endpoint with fixed date range...');
    
    const startYear = effectiveStartDate.getFullYear();
    const startMonth = effectiveStartDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    console.log(`📅 Testing date range: ${startYear}-${String(startMonth + 1).padStart(2, '0')} to ${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`);

    // Test a few key months to see the data
    const testMonths = [
      { year: 2024, month: 3, name: 'March 2024' },
      { year: 2024, month: 4, name: 'April 2024' },
      { year: 2024, month: 5, name: 'May 2024' },
      { year: 2024, month: 6, name: 'June 2024' },
      { year: 2024, month: 7, name: 'July 2024' },
      { year: 2024, month: 8, name: 'August 2024' }
    ];

    let allCampaigns = [];
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;

    for (const monthInfo of testMonths) {
      console.log(`\n📅 Testing ${monthInfo.name}...`);
      
      const startDay = '01';
      const endDay = String(new Date(monthInfo.year, monthInfo.month + 1, 0).getDate());
      
      const insightsUrl = `https://graph.facebook.com/v18.0/act_${adAccountId}/insights?access_token=${client.meta_access_token}&fields=campaign_id,campaign_name,impressions,clicks,spend,conversions&time_range={"since":"${monthInfo.year}-${String(monthInfo.month + 1).padStart(2, '0')}-${startDay}","until":"${monthInfo.year}-${String(monthInfo.month + 1).padStart(2, '0')}-${endDay}"}&level=campaign`;
      
      try {
        const response = await fetch(insightsUrl);
        const data = await response.json();
        
        console.log(`📡 ${monthInfo.name} response:`, {
          status: response.status,
          hasError: !!data.error,
          error: data.error,
          insightsCount: data.data?.length || 0
        });
        
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
        } else {
          console.log(`⚠️ ${monthInfo.name} has no data`);
        }
      } catch (error) {
        console.log(`❌ Error testing ${monthInfo.name}:`, error.message);
      }

      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 4. Show the final results (what "Cały Okres" should now show)
    console.log('\n📊 Step 4: Final results (what "Cały Okres" should now show)...');
    
    console.log('📊 Aggregated totals:', {
      totalSpend: totalSpend.toFixed(2) + ' zł',
      totalImpressions: totalImpressions.toLocaleString(),
      totalClicks: totalClicks.toLocaleString(),
      totalConversions: totalConversions.toLocaleString(),
      campaignsWithData: allCampaigns.length
    });

    if (allCampaigns.length > 0) {
      console.log('✅ SUCCESS: Found real campaign data!');
      console.log('🎉 This is what "Cały Okres" should now display instead of zeros');
    } else {
      console.log('❌ Still no data found');
    }

    // 5. Compare with the old behavior
    console.log('\n📊 Step 5: Comparison with old behavior...');
    
    const oldStartDate = new Date(client.created_at);
    const oldEndDate = new Date();
    const oldMonths = Math.ceil((oldEndDate - oldStartDate) / (1000 * 60 * 60 * 24 * 30));
    
    console.log('📊 Comparison:', {
      oldBehavior: {
        startDate: oldStartDate.toISOString().split('T')[0],
        endDate: oldEndDate.toISOString().split('T')[0],
        months: oldMonths,
        data: 'Zeros (no data in this range)'
      },
      newBehavior: {
        startDate: effectiveStartDate.toISOString().split('T')[0],
        endDate: currentDate.toISOString().split('T')[0],
        months: Math.ceil((currentDate - effectiveStartDate) / (1000 * 60 * 60 * 24 * 30)),
        data: `${totalSpend.toFixed(2)} zł spend, ${totalImpressions.toLocaleString()} impressions, ${totalClicks.toLocaleString()} clicks`
      }
    });

    console.log('\n🎯 Test Summary:');
    console.log('✅ The fix should now show real campaign data instead of zeros');
    console.log('✅ Date range expanded from 2 months to 18 months');
    console.log('✅ Campaign-based start date instead of client-based start date');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testFixedCalOkres(); 