const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function findAdAccounts() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('📋 Usage: node scripts/find-ad-accounts.js <your_token>');
    console.log('   Example: node scripts/find-ad-accounts.js "EAABwzLixnjYBO..."');
    return;
  }

  const token = args[0];
  console.log('🔍 Searching for accessible ad accounts...\n');

  try {
    // Try different endpoints to find ad accounts
    console.log('1️⃣ Checking /me/adaccounts...');
    const meAdAccountsResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_id,account_status&access_token=${token}`
    );
    
    if (meAdAccountsResponse.ok) {
      const meAdAccountsData = await meAdAccountsResponse.json();
      if (meAdAccountsData.data && meAdAccountsData.data.length > 0) {
        console.log(`✅ Found ${meAdAccountsData.data.length} ad accounts via /me/adaccounts:`);
        meAdAccountsData.data.forEach((account, index) => {
          console.log(`   ${index + 1}. ${account.name} (${account.id}) - Status: ${account.account_status}`);
        });
      } else {
        console.log('❌ No ad accounts found via /me/adaccounts');
      }
    } else {
      console.log('❌ Cannot access /me/adaccounts');
    }

    console.log('\n2️⃣ Checking business ad accounts...');
    try {
      const businessResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/businesses?fields=id,name&access_token=${token}`
      );
      
      if (businessResponse.ok) {
        const businessData = await businessResponse.json();
        if (businessData.data && businessData.data.length > 0) {
          console.log(`✅ Found ${businessData.data.length} businesses:`);
          
          for (const business of businessData.data) {
            console.log(`   Business: ${business.name} (${business.id})`);
            
            // Try to get ad accounts for this business
            const businessAdAccountsResponse = await fetch(
              `https://graph.facebook.com/v18.0/${business.id}/adaccounts?fields=id,name,account_id,account_status&access_token=${token}`
            );
            
            if (businessAdAccountsResponse.ok) {
              const businessAdAccountsData = await businessAdAccountsResponse.json();
              if (businessAdAccountsData.data && businessAdAccountsData.data.length > 0) {
                console.log(`     📊 Found ${businessAdAccountsData.data.length} ad accounts:`);
                businessAdAccountsData.data.forEach((account, index) => {
                  console.log(`       ${index + 1}. ${account.name} (${account.id}) - Status: ${account.account_status}`);
                });
              } else {
                console.log(`     ❌ No ad accounts found for this business`);
              }
            } else {
              console.log(`     ❌ Cannot access ad accounts for this business`);
            }
          }
        } else {
          console.log('❌ No businesses found');
        }
      } else {
        console.log('❌ Cannot access businesses');
      }
    } catch (businessError) {
      console.log(`❌ Business check failed: ${businessError.message}`);
    }

    console.log('\n3️⃣ Checking pages (might have ad accounts)...');
    try {
      const pagesResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,category&access_token=${token}`
      );
      
      if (pagesResponse.ok) {
        const pagesData = await pagesResponse.json();
        if (pagesData.data && pagesData.data.length > 0) {
          console.log(`✅ Found ${pagesData.data.length} pages:`);
          pagesData.data.forEach((page, index) => {
            console.log(`   ${index + 1}. ${page.name} (${page.id}) - Category: ${page.category}`);
          });
        } else {
          console.log('❌ No pages found');
        }
      } else {
        console.log('❌ Cannot access pages');
      }
    } catch (pagesError) {
      console.log(`❌ Pages check failed: ${pagesError.message}`);
    }

    console.log('\n📋 **Next Steps:**');
    console.log('1. If you found ad accounts above, note their IDs');
    console.log('2. Go to Business Manager and assign them to your API');
    console.log('3. If no ad accounts found, you may need to create one');
    console.log('4. Or check if your ad accounts are owned by a different account');

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

findAdAccounts(); 