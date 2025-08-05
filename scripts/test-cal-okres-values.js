// Test script to check what values are fetched from "Cały Okres"
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCalOkresValues() {
  console.log('🔍 Testing "Cały Okres" values...\n');

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

    // 2. Calculate the date range that "Cały Okres" would use
    console.log('\n📅 Step 2: Calculating "Cały Okres" date range...');
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

    // 3. Test the exact API call that "Cały Okres" would make
    console.log('\n🌐 Step 3: Testing "Cały Okres" API call...');
    
    // Simulate the month-by-month fetching that "Cały Okres" does
    const startYear = effectiveStartDate.getFullYear();
    const startMonth = effectiveStartDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    console.log(`📅 Fetching data from ${startYear}-${String(startMonth + 1).padStart(2, '0')} to ${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`);

    let allCampaigns = [];
    let totalMonths = 0;
    let processedMonths = 0;

    // Calculate total months to process
    for (let year = startYear; year <= currentYear; year++) {
      const monthEnd = year === currentYear ? currentMonth : 11;
      const monthStart = year === startYear ? startMonth : 0;
      totalMonths += monthEnd - monthStart + 1;
    }

    console.log(`📊 Total months to process: ${totalMonths}`);

    // Test a few specific months to see what data we get
    const testMonths = [
      { year: 2024, month: 1, name: 'January 2024' },
      { year: 2024, month: 6, name: 'June 2024' },
      { year: 2024, month: 12, name: 'December 2024' },
      { year: 2025, month: 1, name: 'January 2025' },
      { year: 2025, month: 7, name: 'July 2025' }
    ];

    for (const testMonth of testMonths) {
      processedMonths++;
      console.log(`\n📅 Testing ${testMonth.name} (${processedMonths}/${testMonths.length})`);
      
      const startDay = '01';
      const endDay = String(new Date(testMonth.year, testMonth.month, 0).getDate());
      
      const requestBody = {
        dateRange: {
          start: `${testMonth.year}-${String(testMonth.month).padStart(2, '0')}-${startDay}`,
          end: `${testMonth.year}-${String(testMonth.month).padStart(2, '0')}-${endDay}`
        },
        clientId: client.id
      };

      console.log(`📡 API request for ${testMonth.name}:`, requestBody);

      try {
        const response = await fetch('http://localhost:3000/api/fetch-live-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify(requestBody)
        });

        console.log(`📡 Response status for ${testMonth.name}:`, response.status);

        if (response.ok) {
          const data = await response.json();
          console.log(`✅ ${testMonth.name} API Response:`, {
            hasData: !!data,
            hasDataProperty: !!data.data,
            campaignsCount: data.data?.campaigns?.length || data.campaigns?.length || 0,
            hasError: !!data.error,
            error: data.error,
            debug: data.debug
          });

          if (data.data?.campaigns) {
            const monthCampaigns = data.data.campaigns;
            console.log(`📊 ${testMonth.name} campaigns data:`, monthCampaigns.map(c => ({
              id: c.campaign_id,
              name: c.campaign_name,
              spend: c.spend,
              impressions: c.impressions,
              clicks: c.clicks,
              conversions: c.conversions
            })));

            // Calculate totals for this month
            const monthTotals = monthCampaigns.reduce((acc, campaign) => ({
              spend: acc.spend + (parseFloat(campaign.spend) || 0),
              impressions: acc.impressions + (parseInt(campaign.impressions) || 0),
              clicks: acc.clicks + (parseInt(campaign.clicks) || 0),
              conversions: acc.conversions + (parseInt(campaign.conversions) || 0)
            }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 });

            console.log(`📊 ${testMonth.name} totals:`, monthTotals);

            allCampaigns.push(...monthCampaigns);
          }
        } else {
          const errorText = await response.text();
          console.log(`❌ ${testMonth.name} API Error:`, errorText);
        }
      } catch (error) {
        console.log(`⚠️ Error testing ${testMonth.name}:`, error.message);
      }

      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 4. Calculate aggregated totals (what "Cały Okres" should show)
    console.log('\n📊 Step 4: Calculating aggregated totals...');
    
    const aggregatedTotals = allCampaigns.reduce((acc, campaign) => ({
      spend: acc.spend + (parseFloat(campaign.spend) || 0),
      impressions: acc.impressions + (parseInt(campaign.impressions) || 0),
      clicks: acc.clicks + (parseInt(campaign.clicks) || 0),
      conversions: acc.conversions + (parseInt(campaign.conversions) || 0)
    }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 });

    console.log('📊 Aggregated totals (what "Cały Okres" should show):', aggregatedTotals);

    // 5. Check for any campaigns with non-zero values
    const nonZeroCampaigns = allCampaigns.filter(campaign => 
      parseFloat(campaign.spend) > 0 || 
      parseInt(campaign.impressions) > 0 || 
      parseInt(campaign.clicks) > 0 || 
      parseInt(campaign.conversions) > 0
    );

    console.log(`📊 Campaigns with non-zero values: ${nonZeroCampaigns.length}/${allCampaigns.length}`);

    if (nonZeroCampaigns.length > 0) {
      console.log('✅ Found campaigns with data:', nonZeroCampaigns.map(c => ({
        id: c.campaign_id,
        name: c.campaign_name,
        spend: c.spend,
        impressions: c.impressions,
        clicks: c.clicks,
        conversions: c.conversions
      })));
    } else {
      console.log('❌ No campaigns with non-zero values found');
    }

    console.log('\n🔍 Summary:');
    console.log('- Check if the server is running on localhost:3000');
    console.log('- Check if the client has valid Meta API token');
    console.log('- Check if the ad account has any campaigns');
    console.log('- Check if the campaigns have data for the specified date range');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testCalOkresValues(); 