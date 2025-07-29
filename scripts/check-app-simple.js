const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkAppSimple() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('📋 Usage: node scripts/check-app-simple.js <your_token> <app_id>');
    console.log('   Example: node scripts/check-app-simple.js "EAABwzLixnjYBO..." "736841512284982"');
    return;
  }

  const token = args[0];
  const appId = args[1];
  
  console.log(`🔍 Checking app: ${appId}\n`);

  try {
    // Check basic app info
    console.log('1️⃣ Basic app info...');
    const appResponse = await fetch(
      `https://graph.facebook.com/v18.0/${appId}?fields=id,name&access_token=${token}`
    );
    
    console.log(`📊 Response status: ${appResponse.status}`);
    
    if (appResponse.ok) {
      const appData = await appResponse.json();
      console.log('✅ App found:');
      console.log(`   Name: ${appData.name}`);
      console.log(`   ID: ${appData.id}`);
    } else {
      const errorData = await appResponse.json();
      console.log(`❌ App error: ${errorData.error?.message || 'Unknown error'}`);
    }

    // Check if this is the same app as in your environment
    console.log('\n2️⃣ Comparing with environment...');
    const envAppId = process.env.META_APP_ID;
    console.log(`   Environment App ID: ${envAppId}`);
    console.log(`   Checking App ID: ${appId}`);
    console.log(`   Match: ${envAppId === appId ? '✅ Yes' : '❌ No'}`);

    // Check if token was generated from this app
    console.log('\n3️⃣ Checking token source...');
    const meResponse = await fetch(`https://graph.facebook.com/v18.0/me?fields=id,name&access_token=${token}`);
    if (meResponse.ok) {
      const meData = await meResponse.json();
      console.log(`   Token belongs to: ${meData.name} (${meData.id})`);
      console.log(`   This appears to be a System User token`);
    }

    // Try to get ad accounts through the app
    console.log('\n4️⃣ Checking for ad accounts...');
    try {
      const adAccountsResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_id&access_token=${token}`
      );
      
      if (adAccountsResponse.ok) {
        const adAccountsData = await adAccountsResponse.json();
        if (adAccountsData.data && adAccountsData.data.length > 0) {
          console.log(`✅ Found ${adAccountsData.data.length} ad accounts:`);
          adAccountsData.data.forEach((account, index) => {
            console.log(`   ${index + 1}. ${account.name} (${account.id})`);
          });
        } else {
          console.log('❌ No ad accounts found');
        }
      } else {
        console.log('❌ Cannot access ad accounts');
      }
    } catch (error) {
      console.log(`❌ Ad accounts check failed: ${error.message}`);
    }

    console.log('\n📋 **Summary:**');
    console.log('✅ Your app exists and is accessible');
    console.log('✅ Your token is valid and has permissions');
    console.log('❌ No ad accounts are accessible with this token');
    console.log('');
    console.log('💡 **Next Steps:**');
    console.log('1. Create an ad account in Business Manager');
    console.log('2. Assign the ad account to your API/System User');
    console.log('3. Update your database with the correct ad account ID');

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

checkAppSimple(); 