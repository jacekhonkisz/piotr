const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function listAdAccounts() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('📋 Usage: node scripts/list-ad-accounts.js <your_token>');
    console.log('   Example: node scripts/list-ad-accounts.js "EAABwzLixnjYBO..."');
    return;
  }

  const token = args[0];
  console.log('🏢 Listing all available ad accounts...\n');

  try {
    // Get all ad accounts
    const response = await fetch(
      `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_id,account_status,currency,timezone_name,created_time&access_token=${token}`
    );

    if (response.status === 403) {
      console.log('❌ Access denied to ad accounts');
      console.log('💡 This token does not have ads_read permission');
      return;
    }

    const data = await response.json();

    if (data.error) {
      console.log(`❌ Error: ${data.error.message}`);
      return;
    }

    if (!data.data || data.data.length === 0) {
      console.log('📭 No ad accounts found');
      console.log('');
      console.log('💡 This could mean:');
      console.log('   1. You don\'t have any ad accounts');
      console.log('   2. The ad accounts are not assigned to this token/user');
      console.log('   3. You need to create an ad account first');
      console.log('');
      console.log('🔧 To fix this:');
      console.log('   1. Go to https://business.facebook.com/');
      console.log('   2. Create an ad account or check existing ones');
      console.log('   3. Make sure the ad account is assigned to your user');
      return;
    }

    console.log(`✅ Found ${data.data.length} ad account(s):\n`);

    data.data.forEach((account, index) => {
      console.log(`${index + 1}. ${account.name}`);
      console.log(`   ID: ${account.id}`);
      console.log(`   Account ID: ${account.account_id}`);
      console.log(`   Status: ${account.account_status}`);
      console.log(`   Currency: ${account.currency}`);
      console.log(`   Timezone: ${account.timezone_name}`);
      console.log(`   Created: ${account.created_time}`);
      console.log('');
    });

    console.log('📋 **Next Steps:**');
    console.log('1. Choose an ad account from the list above');
    console.log('2. Update your client in the database with the correct ad account ID');
    console.log('3. Test the ad account access with the token');

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

listAdAccounts(); 