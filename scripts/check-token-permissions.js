const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkTokenPermissions() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('📋 Usage: node scripts/check-token-permissions.js <your_token>');
    console.log('   Example: node scripts/check-token-permissions.js "EAABwzLixnjYBO..."');
    return;
  }

  const token = args[0];
  console.log('🔐 Checking token permissions...\n');

  try {
    // Check basic token info
    console.log('1️⃣ Checking basic token info...');
    const meResponse = await fetch(`https://graph.facebook.com/v18.0/me?fields=id,name&access_token=${token}`);
    const meData = await meResponse.json();
    
    if (meData.error) {
      console.log(`❌ Token error: ${meData.error.message}`);
      return;
    }
    
    console.log(`✅ Token is valid for user: ${meData.name} (${meData.id})`);
    console.log('');

    // Check permissions
    console.log('2️⃣ Checking token permissions...');
    const permissionsResponse = await fetch(`https://graph.facebook.com/v18.0/me/permissions?access_token=${token}`);
    const permissionsData = await permissionsResponse.json();
    
    if (permissionsData.error) {
      console.log(`❌ Permissions check failed: ${permissionsData.error.message}`);
      return;
    }

    console.log('📋 Current permissions:');
    const requiredPermissions = ['ads_read', 'ads_management', 'business_management', 'read_insights'];
    const missingPermissions = [];

    permissionsData.data.forEach(permission => {
      const status = permission.status === 'granted' ? '✅' : '❌';
      console.log(`   ${status} ${permission.permission}: ${permission.status}`);
      
      if (requiredPermissions.includes(permission.permission) && permission.status !== 'granted') {
        missingPermissions.push(permission.permission);
      }
    });

    console.log('');
    
    if (missingPermissions.length > 0) {
      console.log('❌ Missing required permissions:');
      missingPermissions.forEach(permission => {
        console.log(`   - ${permission}`);
      });
      console.log('');
      console.log('💡 To fix this:');
      console.log('   1. Go to https://developers.facebook.com/tools/explorer/');
      console.log('   2. Select your app');
      console.log('   3. Click "Generate Access Token"');
      console.log('   4. Make sure to select ALL required permissions');
      console.log('   5. Generate a new token');
    } else {
      console.log('✅ All required permissions are granted!');
    }

    // Test ad accounts access
    console.log('\n3️⃣ Testing ad accounts access...');
    const adAccountsResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_id&access_token=${token}`
    );

    if (adAccountsResponse.status === 403) {
      console.log('❌ Cannot access ad accounts - permission issue');
    } else {
      const adAccountsData = await adAccountsResponse.json();
      if (adAccountsData.error) {
        console.log(`❌ Ad accounts error: ${adAccountsData.error.message}`);
      } else {
        console.log(`✅ Ad accounts access successful!`);
        console.log(`📊 Found ${adAccountsData.data?.length || 0} ad accounts`);
      }
    }

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

checkTokenPermissions(); 