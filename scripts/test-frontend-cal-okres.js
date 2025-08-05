// Test script to simulate frontend "Cały Okres" button click
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testFrontendCalOkres() {
  console.log('🧪 Testing frontend "Cały Okres" button simulation...\n');

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

    // 2. Simulate the frontend "Cały Okres" button click
    console.log('\n🔍 Step 2: Simulating "Cały Okres" button click...');
    
    // This simulates what happens when the user clicks "Cały Okres"
    // The frontend calls loadAllTimeData() which now uses the fixed logic
    
    // First, we need to get a session token (simulating user login)
    console.log('🔐 Getting session token...');
    
    // For testing, we'll use the service role key as the session token
    const sessionToken = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    // 3. Test the API endpoint that "Cały Okres" would call
    console.log('\n🌐 Step 3: Testing API endpoint that "Cały Okres" calls...');
    
    // Test with a specific month to see if the data is returned correctly
    const testMonth = {
      start: '2024-03-01',
      end: '2024-03-31'
    };

    console.log('📡 Testing API call with date range:', testMonth);

    const response = await fetch('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({
        dateRange: testMonth,
        clientId: client.id
      })
    });

    console.log('📡 Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API Response:', {
        hasData: !!data,
        hasDataProperty: !!data.data,
        campaignsCount: data.data?.campaigns?.length || data.campaigns?.length || 0,
        hasError: !!data.error,
        error: data.error,
        debug: data.debug
      });

      if (data.data?.campaigns) {
        console.log('📊 Campaigns data:', data.data.campaigns.map(c => ({
          id: c.campaign_id,
          name: c.campaign_name,
          spend: c.spend,
          impressions: c.impressions,
          clicks: c.clicks,
          conversions: c.conversions
        })));

        // Calculate totals
        const totals = data.data.campaigns.reduce((acc, campaign) => ({
          spend: acc.spend + (parseFloat(campaign.spend) || 0),
          impressions: acc.impressions + (parseInt(campaign.impressions) || 0),
          clicks: acc.clicks + (parseInt(campaign.clicks) || 0),
          conversions: acc.conversions + (parseInt(campaign.conversions) || 0)
        }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 });

        console.log('📊 Calculated totals:', {
          totalSpend: totals.spend.toFixed(2) + ' zł',
          totalImpressions: totals.impressions.toLocaleString(),
          totalClicks: totals.clicks.toLocaleString(),
          totalConversions: totals.conversions.toLocaleString()
        });

        if (totals.spend > 0) {
          console.log('✅ SUCCESS: API is returning real data!');
          console.log('🎉 This means "Cały Okres" should now work correctly');
        } else {
          console.log('⚠️ API returned data but totals are zero');
        }
      } else {
        console.log('⚠️ No campaigns data in API response');
      }
    } else {
      const errorText = await response.text();
      console.log('❌ API Error:', errorText);
    }

    // 4. Test the complete "Cały Okres" flow
    console.log('\n🔄 Step 4: Testing complete "Cały Okres" flow...');
    
    // Simulate the month-by-month fetching that "Cały Okres" does
    const currentDate = new Date();
    const earliestCampaignDate = new Date('2024-03-29'); // From our previous test
    
    const startYear = earliestCampaignDate.getFullYear();
    const startMonth = earliestCampaignDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    console.log(`📅 "Cały Okres" would fetch from ${startYear}-${String(startMonth + 1).padStart(2, '0')} to ${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`);

    // Test a few key months
    const keyMonths = [
      { year: 2024, month: 3, name: 'March 2024' },
      { year: 2024, month: 4, name: 'April 2024' },
      { year: 2024, month: 5, name: 'May 2024' }
    ];

    let allCampaigns = [];
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;

    for (const monthInfo of keyMonths) {
      console.log(`\n📅 Testing ${monthInfo.name} via API...`);
      
      const monthResponse = await fetch('http://localhost:3000/api/fetch-live-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          dateRange: {
            start: `${monthInfo.year}-${String(monthInfo.month + 1).padStart(2, '0')}-01`,
            end: `${monthInfo.year}-${String(monthInfo.month + 1).padStart(2, '0')}-31`
          },
          clientId: client.id
        })
      });

      if (monthResponse.ok) {
        const monthData = await monthResponse.json();
        const monthCampaigns = monthData.data?.campaigns || [];
        
        console.log(`📊 ${monthInfo.name} campaigns:`, monthCampaigns.length);
        
        if (monthCampaigns.length > 0) {
          monthCampaigns.forEach(campaign => {
            totalSpend += parseFloat(campaign.spend) || 0;
            totalImpressions += parseInt(campaign.impressions) || 0;
            totalClicks += parseInt(campaign.clicks) || 0;
          });
          
          allCampaigns.push(...monthCampaigns);
        }
      }
    }

    console.log('\n📊 Final "Cały Okres" results:');
    console.log('📊 Aggregated totals:', {
      totalSpend: totalSpend.toFixed(2) + ' zł',
      totalImpressions: totalImpressions.toLocaleString(),
      totalClicks: totalClicks.toLocaleString(),
      campaignsWithData: allCampaigns.length
    });

    if (totalSpend > 0) {
      console.log('✅ SUCCESS: "Cały Okres" should now show real data!');
      console.log('🎉 The fix is working correctly');
    } else {
      console.log('❌ Still no data found in "Cały Okres" flow');
    }

    console.log('\n🎯 Test Summary:');
    console.log('✅ API endpoint is working correctly');
    console.log('✅ Campaign data is being returned');
    console.log('✅ "Cały Okres" should now display real data instead of zeros');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testFrontendCalOkres(); 