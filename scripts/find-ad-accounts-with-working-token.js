const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function findAdAccountsWithWorkingToken() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('📋 Usage: node scripts/find-ad-accounts-with-working-token.js <working_token>');
    console.log('   Example: node scripts/find-ad-accounts-with-working-token.js "EAABwzLixnjYBO..."');
    console.log('');
    console.log('💡 Use a fresh token from Graph API Explorer that works');
    return;
  }

  const token = args[0];
  console.log('🔍 Finding ad accounts with working token...\n');

  try {
    // Check ad accounts
    console.log('1️⃣ Checking ad accounts...');
    const adAccountsResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_id,account_status,currency,timezone_name&access_token=${token}`
    );

    if (adAccountsResponse.status === 403) {
      console.log('❌ Access denied to ad accounts');
      console.log('💡 Token might not have ads_read permission');
    } else if (adAccountsResponse.ok) {
      const adAccountsData = await adAccountsResponse.json();
      
      if (adAccountsData.error) {
        console.log(`❌ Error: ${adAccountsData.error.message}`);
      } else if (adAccountsData.data && adAccountsData.data.length > 0) {
        console.log(`✅ Found ${adAccountsData.data.length} ad account(s):`);
        adAccountsData.data.forEach((account, index) => {
          console.log(`   ${index + 1}. ${account.name}`);
          console.log(`      ID: ${account.id}`);
          console.log(`      Account ID: ${account.account_id}`);
          console.log(`      Status: ${account.account_status}`);
          console.log(`      Currency: ${account.currency}`);
          console.log(`      Timezone: ${account.timezone_name}`);
          console.log('');
        });
        
        console.log('📋 **Next Steps:**');
        console.log('1. Note the ad account IDs above');
        console.log('2. Go to Business Manager → Ad Accounts');
        console.log('3. Assign these ad accounts to your System User');
        console.log('4. Give "Admin" access to the System User');
        
      } else {
        console.log('❌ No ad accounts found');
        console.log('');
        console.log('💡 This means:');
        console.log('   - You don\'t have any ad accounts');
        console.log('   - Or ad accounts are owned by a different account');
        console.log('');
        console.log('🔧 To fix this:');
        console.log('   1. Create an ad account in Business Manager');
        console.log('   2. Or check if you have ad accounts in a different account');
      }
    } else {
      console.log(`❌ Unexpected response: ${adAccountsResponse.status}`);
    }

    // Check businesses
    console.log('\n2️⃣ Checking businesses...');
    try {
      const businessesResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/businesses?fields=id,name&access_token=${token}`
      );
      
      if (businessesResponse.ok) {
        const businessesData = await businessesResponse.json();
        if (businessesData.data && businessesData.data.length > 0) {
          console.log(`✅ Found ${businessesData.data.length} business(es):`);
          businessesData.data.forEach((business, index) => {
            console.log(`   ${index + 1}. ${business.name} (${business.id})`);
          });
        } else {
          console.log('❌ No businesses found');
        }
      } else {
        console.log('❌ Cannot access businesses');
      }
    } catch (businessError) {
      console.log(`❌ Business check failed: ${businessError.message}`);
    }

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

findAdAccountsWithWorkingToken(); 