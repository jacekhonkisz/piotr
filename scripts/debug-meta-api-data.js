require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugMetaAPIData() {
  console.log('🔍 Comprehensive Meta API Data Debug\n');
  console.log('=' .repeat(60));

  try {
    // 1. Check environment variables
    console.log('1. Environment Variables Check:');
    console.log('   - NEXT_PUBLIC_SUPABASE_URL:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('   - SUPABASE_SERVICE_ROLE_KEY:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log('   - NEXT_PUBLIC_SUPABASE_ANON_KEY:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    console.log('   - META_APP_ID:', !!process.env.META_APP_ID);
    console.log('   - META_APP_SECRET:', !!process.env.META_APP_SECRET);

    // 2. Check clients and their tokens
    console.log('\n2. Client Data Check:');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*');

    if (clientsError) {
      console.error('   ❌ Error fetching clients:', clientsError);
      return;
    }

    console.log(`   ✅ Found ${clients.length} clients`);
    clients.forEach((client, index) => {
      console.log(`   ${index + 1}. ${client.name} (${client.email})`);
      console.log(`      - Ad Account ID: ${client.ad_account_id}`);
      console.log(`      - Has Meta Token: ${!!client.meta_access_token}`);
      console.log(`      - Token Preview: ${client.meta_access_token ? client.meta_access_token.substring(0, 20) + '...' : 'NONE'}`);
      console.log(`      - Token Length: ${client.meta_access_token ? client.meta_access_token.length : 0}`);
    });

    // 3. Test with a specific client
    if (clients.length > 0) {
      const testClient = clients[0];
      console.log(`\n3. Testing with client: ${testClient.name}`);
      
      if (!testClient.meta_access_token) {
        console.log('   ❌ No Meta access token found for this client');
        return;
      }

      // 4. Test Meta API directly
      console.log('\n4. Direct Meta API Test:');
      
      const baseUrl = 'https://graph.facebook.com/v18.0';
      const adAccountId = testClient.ad_account_id.startsWith('act_') 
        ? testClient.ad_account_id.substring(4) 
        : testClient.ad_account_id;
      
      console.log(`   - Using Ad Account ID: ${adAccountId}`);
      console.log(`   - Full Account ID: act_${adAccountId}`);

      // Test account info first
      const accountInfoUrl = `${baseUrl}/act_${adAccountId}?access_token=${testClient.meta_access_token}&fields=id,name,account_id,currency,timezone_name`;
      console.log(`   - Testing account info...`);
      
      try {
        const accountResponse = await fetch(accountInfoUrl);
        const accountData = await accountResponse.json();
        
        if (accountData.error) {
          console.log(`   ❌ Account info error: ${accountData.error.message} (Code: ${accountData.error.code})`);
        } else {
          console.log(`   ✅ Account info success: ${accountData.name}`);
          console.log(`      - Currency: ${accountData.currency}`);
          console.log(`      - Timezone: ${accountData.timezone_name}`);
        }
      } catch (error) {
        console.log(`   ❌ Account info request failed: ${error.message}`);
      }

      // Test campaigns
      const campaignsUrl = `${baseUrl}/act_${adAccountId}/campaigns?access_token=${testClient.meta_access_token}&fields=id,name,status,objective&limit=10`;
      console.log(`   - Testing campaigns...`);
      
      try {
        const campaignsResponse = await fetch(campaignsUrl);
        const campaignsData = await campaignsResponse.json();
        
        if (campaignsData.error) {
          console.log(`   ❌ Campaigns error: ${campaignsData.error.message} (Code: ${campaignsData.error.code})`);
        } else {
          console.log(`   ✅ Found ${campaignsData.data?.length || 0} campaigns`);
          if (campaignsData.data && campaignsData.data.length > 0) {
            campaignsData.data.forEach((campaign, index) => {
              console.log(`      ${index + 1}. ${campaign.name} (${campaign.status})`);
            });
          }
        }
      } catch (error) {
        console.log(`   ❌ Campaigns request failed: ${error.message}`);
      }

      // Test insights for last 30 days
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const insightsUrl = `${baseUrl}/act_${adAccountId}/insights?access_token=${testClient.meta_access_token}&fields=campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc&time_range=${JSON.stringify({since: startDate, until: endDate})}&level=campaign&limit=10`;
      console.log(`   - Testing insights (${startDate} to ${endDate})...`);
      
      try {
        const insightsResponse = await fetch(insightsUrl);
        const insightsData = await insightsResponse.json();
        
        if (insightsData.error) {
          console.log(`   ❌ Insights error: ${insightsData.error.message} (Code: ${insightsData.error.code})`);
        } else {
          console.log(`   ✅ Found ${insightsData.data?.length || 0} campaign insights`);
          if (insightsData.data && insightsData.data.length > 0) {
            insightsData.data.forEach((insight, index) => {
              console.log(`      ${index + 1}. ${insight.campaign_name || insight.campaign_id}`);
              console.log(`         - Spend: $${insight.spend || 0}`);
              console.log(`         - Impressions: ${insight.impressions || 0}`);
              console.log(`         - Clicks: ${insight.clicks || 0}`);
              console.log(`         - CTR: ${insight.ctr || 0}%`);
            });
          } else {
            console.log(`   ⚠️ No insights data found - this explains the zeros in the dashboard`);
          }
        }
      } catch (error) {
        console.log(`   ❌ Insights request failed: ${error.message}`);
      }
    }

    // 5. Test the API endpoint
    console.log('\n5. Testing /api/fetch-live-data endpoint:');
    
    // Try to sign in as the first client
    try {
      const { data: { user, session }, error: signInError } = await supabase.auth.signInWithPassword({
        email: clients[0]?.email || 'test@example.com',
        password: 'password123' // This might not work, but worth trying
      });

      if (signInError || !session) {
        console.log('   ❌ Could not sign in as test user');
        console.log('   - This is expected if we don\'t know the password');
      } else {
        try {
          const response = await fetch('http://localhost:3000/api/fetch-live-data', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              dateRange: {
                start: '2024-01-01',
                end: new Date().toISOString().split('T')[0]
              }
            })
          });

          console.log(`   - Response status: ${response.status}`);
          
          if (response.ok) {
            const result = await response.json();
            console.log(`   ✅ API endpoint working`);
            console.log(`   - Success: ${result.success}`);
            console.log(`   - Campaigns: ${result.data?.campaigns?.length || 0}`);
            console.log(`   - Debug info:`, result.debug);
          } else {
            const errorText = await response.text();
            console.log(`   ❌ API endpoint error: ${errorText}`);
          }
        } catch (error) {
          console.log(`   ❌ API endpoint request failed: ${error.message}`);
        }
      }
    } catch (error) {
      console.log('   ❌ Sign in test failed:', error.message);
    }

    console.log('\n' + '=' .repeat(60));
    console.log('🔍 Debug complete!');

  } catch (error) {
    console.error('💥 Debug failed:', error);
  }
}

debugMetaAPIData(); 