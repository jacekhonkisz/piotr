require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkHavetClientData() {
  console.log('🔍 CHECKING HAVET CLIENT DATA\n');
  console.log('='.repeat(50));

  const targetToken = 'EAAKZBRTlpNXsBPMg0chlsVDyDiPuQcOZAYaKYtz2rQKW93ZBGuH0VJzj2eFWv8WNVrus3mBbm8RnpG5JVFjOA7813ZCRy8zZBH0qTLNK9QZCrhO8ZAITtIkeGohn1DfRyouTDIoASdBNJzbPUphAEZAX2TmFMRmXrcySZA5ZBqiL8Oz7n6KquIBL92EaZAwk6UzOZCurpQZDZD';
  const targetAdAccountId = '659510566204299'; // Havet account
  const targetAppId = '61579156319978'; // API Raporty app

  try {
    // 1. Search for client with this token
    console.log('1️⃣ Searching for client with this token...');
    const { data: clientsWithToken, error: tokenError } = await supabase
      .from('clients')
      .select('*')
      .eq('meta_access_token', targetToken);

    if (tokenError) {
      console.error('❌ Error searching by token:', tokenError);
      return;
    }

    if (clientsWithToken && clientsWithToken.length > 0) {
      console.log(`✅ Found ${clientsWithToken.length} client(s) with this token:`);
      clientsWithToken.forEach((client, index) => {
        console.log(`   ${index + 1}. ${client.name} (${client.email})`);
        console.log(`      ID: ${client.id}`);
        console.log(`      Ad Account: ${client.ad_account_id}`);
        console.log(`      API Status: ${client.api_status || 'Unknown'}`);
        console.log(`      Last Report: ${client.last_report_date || 'Never'}`);
      });
    } else {
      console.log('❌ No client found with this exact token');
    }

    // 2. Search for client with Havet ad account ID
    console.log('\n2️⃣ Searching for client with Havet ad account ID...');
    const { data: clientsWithHavetAccount, error: havetError } = await supabase
      .from('clients')
      .select('*')
      .eq('ad_account_id', targetAdAccountId);

    if (havetError) {
      console.error('❌ Error searching by Havet ad account ID:', havetError);
      return;
    }

    if (clientsWithHavetAccount && clientsWithHavetAccount.length > 0) {
      console.log(`✅ Found ${clientsWithHavetAccount.length} client(s) with Havet ad account:`);
      clientsWithHavetAccount.forEach((client, index) => {
        console.log(`   ${index + 1}. ${client.name} (${client.email})`);
        console.log(`      ID: ${client.id}`);
        console.log(`      Has Token: ${client.meta_access_token ? 'Yes' : 'No'}`);
        if (client.meta_access_token) {
          console.log(`      Token Preview: ${client.meta_access_token.substring(0, 20)}...`);
        }
        console.log(`      API Status: ${client.api_status || 'Unknown'}`);
        console.log(`      Last Report: ${client.last_report_date || 'Never'}`);
      });
    } else {
      console.log('❌ No client found with Havet ad account ID');
    }

    // 3. Test the token with Meta API for Havet account
    console.log('\n3️⃣ Testing token with Meta API for Havet account...');
    try {
      // Test basic token validity
      const tokenInfoResponse = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${targetToken}`);
      const tokenInfo = await tokenInfoResponse.json();
      
      if (tokenInfo.error) {
        console.error('❌ Token validation failed:', tokenInfo.error.message);
        return;
      } else {
        console.log('✅ Token is valid');
        console.log(`   User ID: ${tokenInfo.id}`);
        console.log(`   Name: ${tokenInfo.name}`);
        
        // Test Havet ad account access
        const havetAccountId = `act_${targetAdAccountId}`;
        const havetResponse = await fetch(`https://graph.facebook.com/v18.0/${havetAccountId}?access_token=${targetToken}&fields=id,name,account_id,account_status,currency,timezone_name`);
        const havetData = await havetResponse.json();
        
        if (havetData.error) {
          console.error('❌ Havet ad account access failed:', havetData.error.message);
        } else {
          console.log('✅ Havet ad account accessible:');
          console.log(`   Name: ${havetData.name}`);
          console.log(`   Account ID: ${havetData.account_id}`);
          console.log(`   Status: ${havetData.account_status}`);
          console.log(`   Currency: ${havetData.currency}`);
          console.log(`   Timezone: ${havetData.timezone_name}`);
        }
        
        // Test campaigns access for Havet account
        console.log('\n4️⃣ Testing campaigns access for Havet account...');
        const campaignsResponse = await fetch(`https://graph.facebook.com/v18.0/${havetAccountId}/campaigns?access_token=${targetToken}&fields=id,name,status,objective&limit=5`);
        const campaignsData = await campaignsResponse.json();
        
        if (campaignsData.error) {
          console.error('❌ Campaigns access failed:', campaignsData.error.message);
        } else {
          console.log(`✅ Campaigns accessible: ${campaignsData.data?.length || 0} campaigns found`);
          campaignsData.data?.forEach((campaign, index) => {
            console.log(`   ${index + 1}. ${campaign.name} (${campaign.id})`);
            console.log(`      Status: ${campaign.status}`);
            console.log(`      Objective: ${campaign.objective}`);
          });
        }
        
        // Test insights access for Havet account
        console.log('\n5️⃣ Testing insights access for Havet account...');
        const insightsResponse = await fetch(`https://graph.facebook.com/v18.0/${havetAccountId}/insights?access_token=${targetToken}&fields=impressions,clicks,spend&date_preset=last_7d&limit=1`);
        const insightsData = await insightsResponse.json();
        
        if (insightsData.error) {
          console.error('❌ Insights access failed:', insightsData.error.message);
        } else {
          console.log(`✅ Insights accessible: ${insightsData.data?.length || 0} records found`);
          if (insightsData.data && insightsData.data.length > 0) {
            const insight = insightsData.data[0];
            console.log(`   Impressions: ${insight.impressions || 'N/A'}`);
            console.log(`   Clicks: ${insight.clicks || 'N/A'}`);
            console.log(`   Spend: ${insight.spend || 'N/A'}`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Meta API test failed:', error.message);
    }

    // 6. Show all clients for reference
    console.log('\n6️⃣ All clients in database:');
    const { data: allClients, error: allError } = await supabase
      .from('clients')
      .select('id, name, email, ad_account_id, meta_access_token');

    if (allError) {
      console.error('❌ Error fetching all clients:', allError);
      return;
    }

    console.log(`📊 Total clients: ${allClients.length}`);
    allClients.forEach((client, index) => {
      console.log(`   ${index + 1}. ${client.name} (${client.email})`);
      console.log(`      Ad Account: ${client.ad_account_id || 'Not set'}`);
      console.log(`      Has Token: ${client.meta_access_token ? 'Yes' : 'No'}`);
      if (client.meta_access_token) {
        console.log(`      Token Preview: ${client.meta_access_token.substring(0, 20)}...`);
      }
    });

    // 7. Check if we should add Havet as a new client
    console.log('\n7️⃣ Recommendation:');
    if (!clientsWithHavetAccount || clientsWithHavetAccount.length === 0) {
      console.log('💡 Havet account is not in the database yet.');
      console.log('   Would you like to add it as a new client?');
      console.log('   This would allow you to generate reports for Havet campaigns.');
    } else {
      console.log('✅ Havet account is already in the database.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the function
checkHavetClientData().catch(console.error); 