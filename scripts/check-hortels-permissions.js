require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkHortelsPermissions() {
  console.log('🔍 Checking Hortels clients Meta API permissions...\n');

  try {
    // Get all clients
    const { data: clients, error } = await supabase
      .from('clients')
      .select('*');

    if (error) {
      console.error('❌ Error fetching clients:', error);
      return;
    }

    // Filter for Hortels clients
    const hortelsClients = clients.filter(client => 
      client.name.toLowerCase().includes('hortel') || 
      client.name.toLowerCase().includes('havet') || 
      client.name.toLowerCase().includes('belmonte')
    );

    console.log(`📊 Found ${hortelsClients.length} Hortels clients:\n`);

    for (const client of hortelsClients) {
      console.log(`🏨 Client: ${client.name}`);
      console.log(`   Email: ${client.email}`);
      console.log(`   Ad Account: ${client.ad_account_id}`);
      console.log(`   Token Status: ${client.api_status || 'unknown'}`);
      console.log(`   Token Preview: ${client.meta_access_token?.substring(0, 20)}...`);
      
      // Test token permissions
      try {
        // Test basic token validity
        const tokenTestResponse = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${client.meta_access_token}`);
        const tokenTestData = await tokenTestResponse.json();
        
        if (tokenTestData.error) {
          console.log(`   ❌ Token Error: ${tokenTestData.error.message}`);
        } else {
          console.log(`   ✅ Token Valid: ${tokenTestData.name} (ID: ${tokenTestData.id})`);
          
          // Test ad account access
          const accountIdWithPrefix = client.ad_account_id.startsWith('act_') ? client.ad_account_id : `act_${client.ad_account_id}`;
          const accountTestResponse = await fetch(
            `https://graph.facebook.com/v18.0/${accountIdWithPrefix}?fields=id,name,account_id,status&access_token=${client.meta_access_token}`
          );
          const accountTestData = await accountTestResponse.json();
          
          if (accountTestData.error) {
            console.log(`   ❌ Ad Account Error: ${accountTestData.error.message}`);
            console.log(`   🔧 Required: ads_read or ads_management permission`);
          } else {
            console.log(`   ✅ Ad Account Access: ${accountTestData.name} (Status: ${accountTestData.status})`);
            
            // Test campaign insights access (this is what's needed for conversion tracking)
            const insightsTestResponse = await fetch(
              `https://graph.facebook.com/v18.0/${accountIdWithPrefix}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend&limit=1&access_token=${client.meta_access_token}`
            );
            const insightsTestData = await insightsTestResponse.json();
            
            if (insightsTestData.error) {
              console.log(`   ❌ Campaign Insights Error: ${insightsTestData.error.message}`);
              console.log(`   🔧 This is why conversion tracking shows "Nie skonfigurowane"`);
            } else {
              console.log(`   ✅ Campaign Insights Access: Available`);
              console.log(`   📊 Found ${insightsTestData.data?.length || 0} campaigns with insights`);
            }
          }
        }
      } catch (error) {
        console.log(`   ❌ API Test Error: ${error.message}`);
      }
      
      console.log('');
    }

    console.log('🎯 Summary:');
    console.log('The conversion tracking shows "Nie skonfigurowane" because:');
    console.log('1. Meta API tokens lack ads_read or ads_management permissions');
    console.log('2. Without these permissions, campaign insights cannot be fetched');
    console.log('3. No campaign insights = no conversion tracking data');
    console.log('4. No conversion data = all values = 0 = "Not configured" status');
    console.log('');
    console.log('🔧 Solution:');
    console.log('1. Generate new Meta API tokens with proper permissions');
    console.log('2. Update the client tokens in the database');
    console.log('3. Ensure tokens have ads_read or ads_management scope');

  } catch (error) {
    console.error('💥 Script error:', error);
  }
}

checkHortelsPermissions(); 