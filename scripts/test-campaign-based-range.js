// Test script to show what "Cały Okres" should fetch based on campaign dates
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCampaignBasedRange() {
  console.log('🔍 Testing "Cały Okres" with campaign-based date range...\n');

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

    // 2. Get campaign creation dates
    console.log('\n📊 Step 2: Getting campaign creation dates...');
    
    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;
    
    const campaignsUrl = `https://graph.facebook.com/v18.0/act_${adAccountId}/campaigns?access_token=${client.meta_access_token}&fields=id,name,status,objective,created_time,start_time,stop_time`;
    
    try {
      const response = await fetch(campaignsUrl);
      const data = await response.json();
      
      if (data.error) {
        console.log('❌ Error getting campaigns:', data.error);
        return;
      }

      if (!data.data || data.data.length === 0) {
        console.log('❌ No campaigns found');
        return;
      }

      console.log('📊 Campaigns found:', data.data.map(campaign => ({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        created_time: campaign.created_time,
        start_time: campaign.start_time,
        stop_time: campaign.stop_time
      })));

      // Find earliest campaign creation date
      const campaignDates = data.data.map(c => new Date(c.created_time));
      const earliestCampaignDate = new Date(Math.min(...campaignDates));
      
      console.log(`📅 Earliest campaign created: ${earliestCampaignDate.toISOString().split('T')[0]}`);

      // 3. Calculate the CORRECT date range for "Cały Okres"
      console.log('\n📅 Step 3: Calculating correct "Cały Okres" date range...');
      
      const currentDate = new Date();
      const maxPastDate = new Date();
      maxPastDate.setMonth(maxPastDate.getMonth() - 37); // Meta API limit
      
      // Use the earliest campaign date instead of client creation date
      const effectiveStartDate = earliestCampaignDate > maxPastDate ? earliestCampaignDate : maxPastDate;

      console.log('📊 Date Analysis:', {
        currentDate: currentDate.toISOString().split('T')[0],
        clientStartDate: new Date(client.created_at).toISOString().split('T')[0],
        earliestCampaignDate: earliestCampaignDate.toISOString().split('T')[0],
        maxPastDate: maxPastDate.toISOString().split('T')[0],
        effectiveStartDate: effectiveStartDate.toISOString().split('T')[0],
        monthsBack: 37
      });

      // 4. Show what months the CORRECT "Cały Okres" would process
      console.log('\n📅 Step 4: Months that CORRECT "Cały Okres" would process...');
      
      const startYear = effectiveStartDate.getFullYear();
      const startMonth = effectiveStartDate.getMonth();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth();

      console.log(`📅 CORRECT "Cały Okres" would fetch from ${startYear}-${String(startMonth + 1).padStart(2, '0')} to ${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`);

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

      // 5. Test a few key months to see if there's data
      console.log('\n🌐 Step 5: Testing key months for data...');
      
      const keyMonths = [
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

      for (const monthInfo of keyMonths) {
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

      // 6. Show the results
      console.log('\n📊 Step 6: Results with campaign-based date range...');
      
      console.log('📊 Final totals:', {
        totalSpend: totalSpend.toFixed(2),
        totalImpressions: totalImpressions.toLocaleString(),
        totalClicks: totalClicks.toLocaleString(),
        totalConversions: totalConversions.toLocaleString(),
        campaignsWithData: allCampaigns.length
      });

      if (allCampaigns.length > 0) {
        console.log('✅ Found campaigns with data using campaign-based date range!');
        console.log('💡 This is what "Cały Okres" should show if it used campaign creation dates');
      } else {
        console.log('❌ Still no data found even with campaign-based date range');
      }

      console.log('\n🔍 Summary:');
      console.log(`- Current "Cały Okres" range: ${new Date(client.created_at).toISOString().split('T')[0]} to ${currentDate.toISOString().split('T')[0]}`);
      console.log(`- Suggested "Cały Okres" range: ${earliestCampaignDate.toISOString().split('T')[0]} to ${currentDate.toISOString().split('T')[0]}`);
      console.log(`- This would give ${totalMonths} months of data instead of just 2 months`);

    } catch (error) {
      console.log('❌ Error getting campaigns:', error.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testCampaignBasedRange(); 