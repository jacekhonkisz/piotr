const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function testSpecificAccount() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('📋 Usage: node scripts/test-specific-account.js <your_token> <ad_account_id>');
    console.log('   Example: node scripts/test-specific-account.js "EAABwzLixnjYBO..." "736841512284982"');
    return;
  }

  const token = args[0];
  const adAccountId = args[1];
  
  console.log(`🏢 Testing access to ad account: ${adAccountId}\n`);

  try {
    console.log(`🔍 Testing access to ad account ${adAccountId}...`);
    
    const response = await fetch(
      `https://graph.facebook.com/v18.0/act_${adAccountId}?fields=id,name,account_id,account_status,currency,timezone_name,created_time&access_token=${token}`
    );
    
    console.log(`📊 Response status: ${response.status}`);
    
    if (response.status === 403) {
      console.log(`❌ Access denied to ad account ${adAccountId}`);
      console.log('💡 This ad account is not accessible with this token');
      console.log('💡 Make sure:');
      console.log('   - You\'re logged in with the account that owns this ad account');
      console.log('   - The token has ads_read and ads_management permissions');
      console.log('   - The ad account is assigned to your user account');
    } else if (response.status === 404) {
      console.log(`❌ Ad account not found: ${adAccountId}`);
      console.log('💡 Check if the ad account ID is correct');
      console.log('💡 Verify the ad account still exists');
    } else {
      const data = await response.json();
      
      if (data.error) {
        console.log(`❌ Error accessing ad account: ${data.error.message}`);
        console.log(`   Error code: ${data.error.code}`);
        console.log(`   Error type: ${data.error.type}`);
      } else {
        console.log(`✅ Successfully accessed ad account!`);
        console.log(`   Account Name: ${data.name}`);
        console.log(`   Account ID: ${data.account_id}`);
        console.log(`   Status: ${data.account_status}`);
        console.log(`   Currency: ${data.currency}`);
        console.log(`   Timezone: ${data.timezone_name}`);
        console.log(`   Created: ${data.created_time}`);
        
        // Test campaigns access
        console.log('\n📋 Testing campaigns access...');
        try {
          const campaignsResponse = await fetch(
            `https://graph.facebook.com/v18.0/act_${adAccountId}/campaigns?fields=id,name,status,objective&limit=5&access_token=${token}`
          );
          
          if (campaignsResponse.status === 403) {
            console.log('❌ Cannot access campaigns - permission issue');
          } else {
            const campaignsData = await campaignsResponse.json();
            if (campaignsData.error) {
              console.log(`❌ Campaigns access error: ${campaignsData.error.message}`);
            } else {
              console.log(`✅ Campaigns access successful!`);
              console.log(`📊 Found ${campaignsData.data?.length || 0} campaigns`);
              if (campaignsData.data && campaignsData.data.length > 0) {
                campaignsData.data.forEach((campaign, index) => {
                  console.log(`   ${index + 1}. ${campaign.name} (${campaign.status})`);
                });
              }
            }
          }
        } catch (campaignError) {
          console.log(`❌ Campaigns test failed: ${campaignError.message}`);
        }
      }
    }
  } catch (error) {
    console.log(`❌ Network error: ${error.message}`);
  }
  
  console.log('\n📋 **Next Steps:**');
  console.log('1. If access is successful, you can use this ad account ID');
  console.log('2. If access is denied, you need to:');
  console.log('   - Generate a token from the account that owns this ad account');
  console.log('   - Ensure the token has proper permissions');
  console.log('   - Check if the ad account is assigned to your user');
}

testSpecificAccount(); 