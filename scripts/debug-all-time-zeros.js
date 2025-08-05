// Debug script for all-time zeros issue
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugAllTimeZeros() {
  console.log('🔍 Debugging All-Time Zeros Issue...\n');

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

    // 2. Test date calculations
    console.log('\n📅 Step 2: Testing date calculations...');
    const currentDate = new Date();
    const maxPastDate = new Date();
    maxPastDate.setMonth(maxPastDate.getMonth() - 37);
    
    const clientStartDate = new Date(client.created_at);
    const effectiveStartDate = clientStartDate > maxPastDate ? clientStartDate : maxPastDate;

    console.log('📊 Date Analysis:', {
      currentDate: currentDate.toISOString().split('T')[0],
      clientStartDate: clientStartDate.toISOString().split('T')[0],
      maxPastDate: maxPastDate.toISOString().split('T')[0],
      effectiveStartDate: effectiveStartDate.toISOString().split('T')[0],
      monthsBack: 37
    });

    // 3. Test a single month API call
    console.log('\n🌐 Step 3: Testing single month API call...');
    const testMonth = {
      start: '2024-01-01',
      end: '2024-01-31'
    };

    console.log('📡 Testing month:', testMonth);

    const response = await fetch('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
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
      }
    } else {
      const errorText = await response.text();
      console.log('❌ API Error:', errorText);
    }

    // 4. Test all-time date range
    console.log('\n🌐 Step 4: Testing all-time date range...');
    const allTimeRange = {
      start: effectiveStartDate.toISOString().split('T')[0],
      end: currentDate.toISOString().split('T')[0]
    };

    console.log('📡 All-time range:', allTimeRange);

    const allTimeResponse = await fetch('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        dateRange: allTimeRange,
        clientId: client.id
      })
    });

    console.log('📡 All-time response status:', allTimeResponse.status);
    
    if (allTimeResponse.ok) {
      const allTimeData = await allTimeResponse.json();
      console.log('✅ All-time API Response:', {
        hasData: !!allTimeData,
        hasDataProperty: !!allTimeData.data,
        campaignsCount: allTimeData.data?.campaigns?.length || allTimeData.campaigns?.length || 0,
        hasError: !!allTimeData.error,
        error: allTimeData.error,
        debug: allTimeData.debug
      });

      if (allTimeData.data?.campaigns) {
        console.log('📊 All-time campaigns data:', allTimeData.data.campaigns.map(c => ({
          id: c.campaign_id,
          name: c.campaign_name,
          spend: c.spend,
          impressions: c.impressions,
          clicks: c.clicks,
          conversions: c.conversions
        })));
      }
    } else {
      const errorText = await allTimeResponse.text();
      console.log('❌ All-time API Error:', errorText);
    }

    console.log('\n🔍 Debug Summary:');
    console.log('- Check if the server is running on localhost:3000');
    console.log('- Check if the client has valid Meta API token');
    console.log('- Check if the ad account has any campaigns');
    console.log('- Check if the campaigns have data for the specified date range');

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugAllTimeZeros(); 