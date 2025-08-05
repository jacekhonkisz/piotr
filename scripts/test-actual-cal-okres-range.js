// Test script to check the actual "Cały Okres" date range
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testActualCalOkresRange() {
  console.log('🔍 Testing actual "Cały Okres" date range...\n');

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

    // 2. Calculate the EXACT date range that "Cały Okres" uses
    console.log('\n📅 Step 2: Calculating actual "Cały Okres" date range...');
    const currentDate = new Date();
    const maxPastDate = new Date();
    maxPastDate.setMonth(maxPastDate.getMonth() - 37); // Meta API limit
    
    const clientStartDate = new Date(client.created_at);
    const effectiveStartDate = clientStartDate > maxPastDate ? clientStartDate : maxPastDate;

    console.log('📊 Date Analysis:', {
      currentDate: currentDate.toISOString().split('T')[0],
      clientStartDate: clientStartDate.toISOString().split('T')[0],
      maxPastDate: maxPastDate.toISOString().split('T')[0],
      effectiveStartDate: effectiveStartDate.toISOString().split('T')[0],
      monthsBack: 37
    });

    // 3. Show what months "Cały Okres" would actually process
    console.log('\n📅 Step 3: Months that "Cały Okres" would process...');
    
    const startYear = effectiveStartDate.getFullYear();
    const startMonth = effectiveStartDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    console.log(`📅 "Cały Okres" would fetch from ${startYear}-${String(startMonth + 1).padStart(2, '0')} to ${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`);

    let totalMonths = 0;
    const monthsToProcess = [];

    // Calculate total months to process
    for (let year = startYear; year <= currentYear; year++) {
      const monthEnd = year === currentYear ? currentMonth : 11;
      const monthStart = year === startYear ? startMonth : 0;
      
      for (let month = monthStart; month <= monthEnd; month++) {
        totalMonths++;
        const monthName = `${year}-${String(month + 1).padStart(2, '0')}`;
        monthsToProcess.push({ year, month, name: monthName });
      }
    }

    console.log(`📊 Total months to process: ${totalMonths}`);
    console.log('📅 Months to process:', monthsToProcess.map(m => m.name));

    // 4. Test the actual months that "Cały Okres" would fetch
    console.log('\n🌐 Step 4: Testing actual "Cały Okres" months...');
    
    if (!client.meta_access_token) {
      console.error('❌ No Meta API token found for client');
      return;
    }

    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;

    let allCampaigns = [];
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;

    for (const monthInfo of monthsToProcess) {
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

    // 5. Show the aggregated results (what "Cały Okres" should display)
    console.log('\n📊 Step 5: Aggregated results (what "Cały Okres" should show)...');
    
    console.log('📊 Final totals:', {
      totalSpend: totalSpend.toFixed(2),
      totalImpressions: totalImpressions.toLocaleString(),
      totalClicks: totalClicks.toLocaleString(),
      totalConversions: totalConversions.toLocaleString(),
      campaignsWithData: allCampaigns.length
    });

    if (allCampaigns.length > 0) {
      console.log('✅ Found campaigns with data in the actual "Cały Okres" range');
    } else {
      console.log('❌ No campaigns with data found in the actual "Cały Okres" range');
      console.log('💡 This explains why you see zeros - there is no data in the date range that "Cały Okres" is actually fetching');
    }

    console.log('\n🔍 Summary:');
    console.log(`- "Cały Okres" fetches from: ${effectiveStartDate.toISOString().split('T')[0]} to ${currentDate.toISOString().split('T')[0]}`);
    console.log(`- This is only ${totalMonths} month(s) of data`);
    console.log(`- If there's no data in this range, you'll see zeros`);
    console.log(`- The client was created on ${clientStartDate.toISOString().split('T')[0]}, so there might not be much historical data`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testActualCalOkresRange(); 