const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkAllPossibleAdAccounts() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('📋 Usage: node scripts/check-all-possible-ad-accounts.js <your_token>');
    console.log('   Example: node scripts/check-all-possible-ad-accounts.js "EAABwzLixnjYBO..."');
    return;
  }

  const token = args[0];
  console.log('🔍 Checking all possible ad account sources...\n');

  try {
    // Check different possible sources for ad accounts
    const sources = [
      { name: 'Personal Ad Accounts', endpoint: '/me/adaccounts' },
      { name: 'Business Ad Accounts', endpoint: '/me/businesses' },
      { name: 'App Ad Accounts', endpoint: '/736841512284982/adaccounts' },
      { name: 'API Ad Accounts', endpoint: '/61578369947034/adaccounts' },
      { name: 'Page Ad Accounts', endpoint: '/me/accounts' }
    ];

    for (const source of sources) {
      console.log(`🔍 Checking ${source.name}...`);
      
      try {
        const response = await fetch(
          `https://graph.facebook.com/v18.0${source.endpoint}?fields=id,name,account_id,account_status&access_token=${token}`
        );

        if (response.status === 403) {
          console.log(`   ❌ Access denied to ${source.name}`);
        } else if (response.status === 404) {
          console.log(`   ❌ ${source.name} not found`);
        } else if (response.ok) {
          const data = await response.json();
          
          if (data.error) {
            console.log(`   ❌ Error: ${data.error.message}`);
          } else if (data.data && data.data.length > 0) {
            console.log(`   ✅ Found ${data.data.length} items in ${source.name}:`);
            data.data.forEach((item, index) => {
              if (item.account_id) {
                // This is an ad account
                console.log(`      ${index + 1}. ${item.name} (${item.id}) - Status: ${item.account_status}`);
              } else {
                // This might be a business or page
                console.log(`      ${index + 1}. ${item.name} (${item.id})`);
              }
            });
          } else {
            console.log(`   ❌ No items found in ${source.name}`);
          }
        } else {
          console.log(`   ❌ Unexpected response: ${response.status}`);
        }
      } catch (error) {
        console.log(`   ❌ Error checking ${source.name}: ${error.message}`);
      }
      
      console.log('');
    }

    console.log('📋 **Summary:**');
    console.log('If no ad accounts were found above, you need to:');
    console.log('1. Create an ad account in Business Manager');
    console.log('2. Assign it to your API (ID: 61578369947034)');
    console.log('3. Update your database with the correct ad account ID');

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

checkAllPossibleAdAccounts(); 