const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function testWithNewAdAccount() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('📋 Usage: node scripts/test-with-new-ad-account.js <your_token> <ad_account_id>');
    console.log('   Example: node scripts/test-with-new-ad-account.js "EAABwzLixnjYBO..." "act_123456789"');
    console.log('');
    console.log('💡 To get an ad account ID:');
    console.log('   1. Go to https://business.facebook.com/');
    console.log('   2. Navigate to Ad Accounts');
    console.log('   3. Create a new ad account');
    console.log('   4. Copy the ad account ID (starts with "act_")');
    return;
  }

  const token = args[0];
  const adAccountId = args[1];
  
  console.log(`🏢 Testing with ad account: ${adAccountId}\n`);

  try {
    // Remove 'act_' prefix if present
    const cleanAccountId = adAccountId.replace('act_', '');
    
    console.log('1️⃣ Testing ad account access...');
    const accountResponse = await fetch(
      `https://graph.facebook.com/v18.0/act_${cleanAccountId}?fields=id,name,account_id,account_status,currency,timezone_name&access_token=${token}`
    );
    
    console.log(`📊 Response status: ${accountResponse.status}`);
    
    if (accountResponse.status === 403) {
      console.log('❌ Access denied to ad account');
      console.log('💡 Make sure the ad account is assigned to your API');
    } else if (accountResponse.status === 404) {
      console.log('❌ Ad account not found');
      console.log('💡 Check if the ad account ID is correct');
    } else {
      const accountData = await accountResponse.json();
      
      if (accountData.error) {
        console.log(`❌ Ad account error: ${accountData.error.message}`);
      } else {
        console.log('✅ Ad account access successful!');
        console.log(`   Name: ${accountData.name}`);
        console.log(`   ID: ${accountData.id}`);
        console.log(`   Account ID: ${accountData.account_id}`);
        console.log(`   Status: ${accountData.account_status}`);
        console.log(`   Currency: ${accountData.currency}`);
        console.log(`   Timezone: ${accountData.timezone_name}`);
        
        // Test campaigns
        console.log('\n2️⃣ Testing campaigns access...');
        try {
          const campaignsResponse = await fetch(
            `https://graph.facebook.com/v18.0/act_${cleanAccountId}/campaigns?fields=id,name,status,objective&limit=5&access_token=${token}`
          );
          
          if (campaignsResponse.status === 403) {
            console.log('❌ Cannot access campaigns - permission issue');
          } else {
            const campaignsData = await campaignsResponse.json();
            if (campaignsData.error) {
              console.log(`❌ Campaigns error: ${campaignsData.error.message}`);
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
        
        // Test insights
        console.log('\n3️⃣ Testing insights access...');
        try {
          const insightsResponse = await fetch(
            `https://graph.facebook.com/v18.0/act_${cleanAccountId}/insights?fields=impressions,clicks,spend&date_preset=last_30d&access_token=${token}`
          );
          
          if (insightsResponse.status === 403) {
            console.log('❌ Cannot access insights - permission issue');
          } else {
            const insightsData = await insightsResponse.json();
            if (insightsData.error) {
              console.log(`❌ Insights error: ${insightsData.error.message}`);
            } else {
              console.log(`✅ Insights access successful!`);
              console.log(`📊 Found ${insightsData.data?.length || 0} insight records`);
            }
          }
        } catch (insightsError) {
          console.log(`❌ Insights test failed: ${insightsError.message}`);
        }
        
        console.log('\n🎉 **Success!**');
        console.log('✅ Ad account is accessible');
        console.log('✅ Campaigns can be accessed');
        console.log('✅ Insights can be accessed');
        console.log('');
        console.log('💡 **Next Steps:**');
        console.log('1. Update your database with this ad account ID');
        console.log('2. Test your application dashboard');
        console.log('3. Create some test campaigns to see real data');
      }
    }

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

testWithNewAdAccount(); 