const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkAppInfo() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('📋 Usage: node scripts/check-app-info.js <your_token> <app_id>');
    console.log('   Example: node scripts/check-app-info.js "EAABwzLixnjYBO..." "736841512284982"');
    return;
  }

  const token = args[0];
  const appId = args[1];
  
  console.log(`🔍 Checking app information for: ${appId}\n`);

  try {
    // Check app information
    console.log('1️⃣ Checking app information...');
    const appResponse = await fetch(
      `https://graph.facebook.com/v18.0/${appId}?fields=id,name,app_type,created_time,updated_time&access_token=${token}`
    );
    
    console.log(`📊 Response status: ${appResponse.status}`);
    
    if (appResponse.status === 403) {
      console.log('❌ Access denied to app information');
      console.log('💡 This app is not accessible with this token');
    } else if (appResponse.status === 404) {
      console.log('❌ App not found');
      console.log('💡 Check if the app ID is correct');
    } else {
      const appData = await appResponse.json();
      
      if (appData.error) {
        console.log(`❌ App error: ${appData.error.message}`);
      } else {
        console.log('✅ App information:');
        console.log(`   Name: ${appData.name}`);
        console.log(`   ID: ${appData.id}`);
        console.log(`   Type: ${appData.app_type}`);
        console.log(`   Created: ${appData.created_time}`);
        console.log(`   Updated: ${appData.updated_time}`);
      }
    }

    // Check app permissions
    console.log('\n2️⃣ Checking app permissions...');
    try {
      const permissionsResponse = await fetch(
        `https://graph.facebook.com/v18.0/${appId}/permissions?access_token=${token}`
      );
      
      if (permissionsResponse.ok) {
        const permissionsData = await permissionsResponse.json();
        if (permissionsData.data && permissionsData.data.length > 0) {
          console.log('📋 App permissions:');
          permissionsData.data.forEach(permission => {
            const status = permission.status === 'granted' ? '✅' : '❌';
            console.log(`   ${status} ${permission.permission}: ${permission.status}`);
          });
        } else {
          console.log('❌ No permissions found for this app');
        }
      } else {
        console.log('❌ Cannot access app permissions');
      }
    } catch (permissionError) {
      console.log(`❌ Permissions check failed: ${permissionError.message}`);
    }

    // Check if app has Marketing API
    console.log('\n3️⃣ Checking Marketing API access...');
    try {
      const marketingResponse = await fetch(
        `https://graph.facebook.com/v18.0/${appId}/insights?fields=id&access_token=${token}`
      );
      
      if (marketingResponse.status === 403) {
        console.log('❌ Marketing API not available for this app');
        console.log('💡 You need to add Marketing API product to your app');
      } else if (marketingResponse.ok) {
        console.log('✅ Marketing API is available for this app');
      } else {
        console.log('❌ Cannot determine Marketing API status');
      }
    } catch (marketingError) {
      console.log(`❌ Marketing API check failed: ${marketingError.message}`);
    }

    // Check app's ad accounts (if any)
    console.log('\n4️⃣ Checking app\'s ad accounts...');
    try {
      const adAccountsResponse = await fetch(
        `https://graph.facebook.com/v18.0/${appId}/adaccounts?fields=id,name,account_id,account_status&access_token=${token}`
      );
      
      if (adAccountsResponse.ok) {
        const adAccountsData = await adAccountsResponse.json();
        if (adAccountsData.data && adAccountsData.data.length > 0) {
          console.log(`✅ Found ${adAccountsData.data.length} ad accounts for this app:`);
          adAccountsData.data.forEach((account, index) => {
            console.log(`   ${index + 1}. ${account.name} (${account.id}) - Status: ${account.account_status}`);
          });
        } else {
          console.log('❌ No ad accounts found for this app');
        }
      } else {
        console.log('❌ Cannot access app\'s ad accounts');
      }
    } catch (adAccountsError) {
      console.log(`❌ Ad accounts check failed: ${adAccountsError.message}`);
    }

    console.log('\n📋 **Next Steps:**');
    console.log('1. If Marketing API is not available, add it to your app');
    console.log('2. If no ad accounts found, create or assign ad accounts to this app');
    console.log('3. Make sure the app has the required permissions');

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

checkAppInfo(); 