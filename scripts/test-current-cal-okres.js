// Test script to verify current "Cały Okres" functionality
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCurrentCalOkres() {
  console.log('🔍 Testing Current "Cały Okres" Functionality\n');

  try {
    // 1. Get client data
    console.log('📋 Step 1: Getting client data...');
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, name, email, created_at, ad_account_id, meta_access_token')
      .limit(1);

    if (clientError || !clients || clients.length === 0) {
      console.error('❌ No clients found:', clientError);
      return;
    }

    const client = clients[0];
    console.log('✅ Client found:', {
      id: client.id,
      name: client.name,
      email: client.email,
      created_at: client.created_at,
      ad_account_id: client.ad_account_id,
      hasToken: !!client.meta_access_token
    });

    if (!client.meta_access_token) {
      console.error('❌ No Meta API token found');
      return;
    }

    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;

    // 2. Simulate the exact logic from loadAllTimeData function
    console.log('\n📅 Step 2: Simulating loadAllTimeData logic...');
    
    // Get campaign creation dates to find the earliest campaign
    console.log('🔍 Getting campaign creation dates...');
    
    const campaignsResponse = await fetch(`https://graph.facebook.com/v18.0/act_${adAccountId}/campaigns?access_token=${client.meta_access_token}&fields=id,name,created_time`);
    
    let earliestCampaignDate = null;
    
    if (campaignsResponse.ok) {
      const campaignsData = await campaignsResponse.json();
      if (campaignsData.data && campaignsData.data.length > 0) {
        console.log('📊 Campaigns found:');
        campaignsData.data.forEach(campaign => {
          const createdDate = new Date(campaign.created_time);
          console.log(`- ${campaign.name}: ${createdDate.toISOString().split('T')[0]}`);
        });
        
                 // Find the earliest campaign creation date
         const campaignDates = campaignsData.data.map((c) => new Date(c.created_time));
        earliestCampaignDate = new Date(Math.min(...campaignDates));
        console.log(`📅 Earliest campaign created: ${earliestCampaignDate.toISOString().split('T')[0]}`);
      }
    }

    // Calculate effective start date (same logic as frontend)
    const currentDate = new Date();
    const maxPastDate = new Date();
    maxPastDate.setMonth(maxPastDate.getMonth() - 37); // Meta API limit: 37 months
    
    const clientStartDate = new Date(client.created_at);
    console.log(`📅 Client business start date: ${clientStartDate.toISOString().split('T')[0]}`);
    
    let effectiveStartDate;
    if (earliestCampaignDate) {
      effectiveStartDate = earliestCampaignDate > maxPastDate ? earliestCampaignDate : maxPastDate;
      console.log(`📅 Using campaign-based start date: ${effectiveStartDate.toISOString().split('T')[0]}`);
    } else {
      effectiveStartDate = clientStartDate > maxPastDate ? clientStartDate : maxPastDate;
      console.log(`📅 Using client-based start date: ${effectiveStartDate.toISOString().split('T')[0]}`);
    }
    
    console.log(`📅 Effective start date: ${effectiveStartDate.toISOString().split('T')[0]}`);
    
    const startYear = effectiveStartDate.getFullYear();
    const startMonth = effectiveStartDate.getMonth();
    const startDay = effectiveStartDate.getDate();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const currentDay = currentDate.getDate();
    
    console.log(`📅 Date range: ${startYear}-${String(startMonth + 1).padStart(2, '0')}-${String(startDay).padStart(2, '0')} to ${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`);

    // 3. Test month-by-month fetching (like the frontend does)
    console.log('\n📅 Step 3: Testing month-by-month fetching...');
    
    let allCampaigns = [];
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;
    let monthsWithData = 0;
    
    // Calculate total months to process
    let totalMonths = 0;
    for (let year = startYear; year <= currentYear; year++) {
      const monthEnd = year === currentYear ? currentMonth : 11;
      const monthStart = year === startYear ? startMonth : 0;
      totalMonths += monthEnd - monthStart + 1;
    }
    
    console.log(`📊 Total months to process: ${totalMonths}`);
    
    let processedMonths = 0;
    
    // Fetch data month by month
    for (let year = startYear; year <= currentYear; year++) {
      const monthEnd = year === currentYear ? currentMonth : 11;
      const monthStart = year === startYear ? startMonth : 0;
      
      for (let month = monthStart; month <= monthEnd; month++) {
        processedMonths++;
        console.log(`\n📅 Processing ${year}-${String(month + 1).padStart(2, '0')} (${processedMonths}/${totalMonths})`);
        
        try {
          // Use exact dates for first and last months, full months for others
          let startDay = '01';
          let endDay = String(new Date(year, month + 1, 0).getDate());
          
          // For the first month, use the exact day from effective start date
          if (year === startYear && month === startMonth) {
            startDay = String(startDay).padStart(2, '0');
          }
          
          // For the last month, use the exact day from current date
          if (year === currentYear && month === currentMonth) {
            endDay = String(currentDay).padStart(2, '0');
          }
          
          const dateStart = `${year}-${String(month + 1).padStart(2, '0')}-${startDay}`;
          const dateEnd = `${year}-${String(month + 1).padStart(2, '0')}-${endDay}`;
          
          console.log(`📅 Date range for this month: ${dateStart} to ${dateEnd}`);
          
          // Make API call (simulating the frontend call to /api/fetch-live-data)
          const insightsUrl = `https://graph.facebook.com/v18.0/act_${adAccountId}/insights?access_token=${client.meta_access_token}&fields=campaign_id,campaign_name,impressions,clicks,spend,conversions&time_range={"since":"${dateStart}","until":"${dateEnd}"}&time_increment=1&level=campaign`;
          
          const response = await fetch(insightsUrl);
          const data = await response.json();
          
          if (data.data && data.data.length > 0) {
            // Aggregate daily data by campaign (like the frontend does)
            const campaignMap = new Map();
            
            data.data.forEach(insight => {
              const campaignId = insight.campaign_id;
              if (!campaignMap.has(campaignId)) {
                campaignMap.set(campaignId, {
                  campaign_id: campaignId,
                  campaign_name: insight.campaign_name || 'Unknown Campaign',
                  impressions: 0,
                  clicks: 0,
                  spend: 0,
                  conversions: 0
                });
              }
              
              const campaign = campaignMap.get(campaignId);
              campaign.impressions += parseInt(insight.impressions) || 0;
              campaign.clicks += parseInt(insight.clicks) || 0;
              campaign.spend += parseFloat(insight.spend) || 0;
              campaign.conversions += parseInt(insight.conversions) || 0;
            });
            
            const monthCampaigns = Array.from(campaignMap.values());
            const monthSpend = monthCampaigns.reduce((sum, campaign) => sum + campaign.spend, 0);
            const monthImpressions = monthCampaigns.reduce((sum, campaign) => sum + campaign.impressions, 0);
            const monthClicks = monthCampaigns.reduce((sum, campaign) => sum + campaign.clicks, 0);
            const monthConversions = monthCampaigns.reduce((sum, campaign) => sum + campaign.conversions, 0);
            
            console.log(`✅ ${year}-${String(month + 1).padStart(2, '0')}: ${monthSpend.toFixed(2)} PLN, ${monthImpressions} impressions, ${monthClicks} clicks`);
            console.log(`   Campaigns:`, monthCampaigns.map(c => ({
              name: c.campaign_name,
              spend: c.spend.toFixed(2),
              impressions: c.impressions,
              clicks: c.clicks
            })));
            
            // Add to totals
            totalSpend += monthSpend;
            totalImpressions += monthImpressions;
            totalClicks += monthClicks;
            totalConversions += monthConversions;
            monthsWithData++;
            
            allCampaigns.push(...monthCampaigns);
          } else {
            console.log(`⚠️ ${year}-${String(month + 1).padStart(2, '0')}: No data`);
          }
          
          // Small delay to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 300));
          
        } catch (error) {
          console.log(`❌ Error processing ${year}-${String(month + 1).padStart(2, '0')}:`, error.message);
        }
      }
    }

    // 4. Remove duplicates and show final results
    console.log('\n📊 Step 4: Final Results...');
    
    // Remove duplicates based on campaign_id
    const uniqueCampaigns = allCampaigns.filter((campaign, index, self) => 
      index === self.findIndex(c => c.campaign_id === campaign.campaign_id)
    );
    
    console.log('📊 All-time data summary:');
    console.log(`- Total spend: ${totalSpend.toFixed(2)} PLN`);
    console.log(`- Total impressions: ${totalImpressions.toLocaleString()}`);
    console.log(`- Total clicks: ${totalClicks.toLocaleString()}`);
    console.log(`- Total conversions: ${totalConversions.toLocaleString()}`);
    console.log(`- Months with data: ${monthsWithData}`);
    console.log(`- Unique campaigns: ${uniqueCampaigns.length}`);
    console.log(`- Date range: ${effectiveStartDate.toISOString().split('T')[0]} to ${currentDate.toISOString().split('T')[0]}`);
    
    console.log('\n📊 Unique campaigns:');
    uniqueCampaigns.forEach(campaign => {
      console.log(`- ${campaign.campaign_name}: ${campaign.spend.toFixed(2)} PLN`);
    });

    // 5. Compare with expected values
    console.log('\n📊 Step 5: Comparison with Expected Values...');
    console.log('🎯 Expected "Cały Okres" should show:');
    console.log('- Total spend: ~259.39 PLN (from our earlier comprehensive test)');
    console.log('- Date range: From March 29, 2024 (earliest campaign) to today');
    console.log('- Campaigns: 4 unique campaigns');
    
    const expectedSpend = 259.39;
    const difference = Math.abs(totalSpend - expectedSpend);
    const percentageDiff = (difference / expectedSpend) * 100;
    
    console.log(`\n📊 Comparison:`);
    console.log(`- Actual spend: ${totalSpend.toFixed(2)} PLN`);
    console.log(`- Expected spend: ${expectedSpend.toFixed(2)} PLN`);
    console.log(`- Difference: ${difference.toFixed(2)} PLN (${percentageDiff.toFixed(1)}%)`);
    
    if (difference < 1) {
      console.log('✅ Results match expected values!');
    } else {
      console.log('⚠️ Discrepancy detected - investigate further');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testCurrentCalOkres(); 