const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testReportsPageAPI() {
  console.log('🔍 Testing Reports Page API Calls...\n');

  try {
    // Get client data
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, email, ad_account_id, meta_access_token')
      .eq('email', 'jac.honkisz@gmail.com')
      .single();

    if (clientError || !client) {
      console.error('❌ Client not found:', clientError);
      return;
    }

    console.log(`✅ Testing client: ${client.name} (${client.email})`);
    console.log(`📋 Ad Account ID: ${client.ad_account_id}\n`);

    if (!client.meta_access_token) {
      console.log('❌ No Meta token found');
      return;
    }

    // Test the exact API call that the reports page makes
    console.log('📡 Testing Reports Page API Call...');
    console.log('====================================');
    
    // Simulate the exact request body that the reports page sends
    const requestBody = {
      dateRange: {
        start: '2024-04-01',
        end: '2024-04-30'
      },
      clientId: client.id
    };

    console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));

    // Make the API call to our fetch-live-data endpoint
    const response = await fetch('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // We need to simulate authentication - let's get a session token
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📥 Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('📊 Response data:', JSON.stringify(data, null, 2));
    } else {
      const errorText = await response.text();
      console.log('❌ Response error:', errorText);
    }

    // Also test the exact date range from the image (April 2023)
    console.log('\n📡 Testing April 2023 (from image)...');
    console.log('=====================================');
    
    const requestBody2023 = {
      dateRange: {
        start: '2023-04-01',
        end: '2023-04-30'
      },
      clientId: client.id
    };

    console.log('📤 Request body (2023):', JSON.stringify(requestBody2023, null, 2));

    const response2023 = await fetch('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody2023)
    });

    console.log('📥 Response status (2023):', response2023.status);
    
    if (response2023.ok) {
      const data2023 = await response2023.json();
      console.log('📊 Response data (2023):', JSON.stringify(data2023, null, 2));
    } else {
      const errorText2023 = await response2023.text();
      console.log('❌ Response error (2023):', errorText2023);
    }

    // Test direct Meta API call for April 2023
    console.log('\n📡 Testing Direct Meta API for April 2023...');
    console.log('=============================================');
    
    const cleanAccountId = client.ad_account_id.replace('act_', '');
    
    try {
      const insightsResponse = await fetch(
        `https://graph.facebook.com/v18.0/act_${cleanAccountId}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc&access_token=${client.meta_access_token}&time_range={"since":"2023-04-01","until":"2023-04-30"}`
      );

      console.log('📥 Direct Meta API status:', insightsResponse.status);
      
      if (insightsResponse.status === 403) {
        console.log('❌ No access to campaign insights (ads_management permission needed)');
      } else {
        const insightsData = await insightsResponse.json();
        if (insightsData.error) {
          console.log('❌ Insights error:', insightsData.error.message);
        } else {
          console.log('✅ Found', insightsData.data?.length || 0, 'campaigns with data');
          
          if (insightsData.data && insightsData.data.length > 0) {
            console.log('📊 Campaign insights:');
            insightsData.data.forEach((insight, index) => {
              console.log(`   ${index + 1}. ${insight.campaign_name || 'Unknown'} (${insight.campaign_id || 'Unknown'})`);
              console.log(`      Spend: ${insight.spend || '0'}, Impressions: ${insight.impressions || '0'}, Clicks: ${insight.clicks || '0'}`);
              console.log(`      CTR: ${insight.ctr || '0'}%, CPC: ${insight.cpc || '0'}`);
            });
          } else {
            console.log('⚠️ No campaign data found in April 2023 (campaigns may not have been active)');
          }
        }
      }
    } catch (error) {
      console.log('❌ Direct Meta API error:', error.message);
    }

    console.log('\n🔍 DIAGNOSIS:');
    console.log('=============');
    console.log('1. The reports page is showing April 2023 instead of April 2024');
    console.log('2. This suggests the period generation is still using the wrong date');
    console.log('3. April 2023 likely has no campaign data (campaigns were created in 2024)');
    console.log('4. The system date (August 2025) is still affecting the frontend');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testReportsPageAPI().then(() => {
  console.log('\n✅ Reports Page API Test Complete');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
}); 