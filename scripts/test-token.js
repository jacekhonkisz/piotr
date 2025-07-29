const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function testToken() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('📋 Usage: node scripts/test-token.js <your_token>');
    console.log('   Example: node scripts/test-token.js "EAABwzLixnjYBO..."');
    return;
  }

  const token = args[0];
  console.log('🔐 Testing Meta API token...\n');

  try {
    // Test 1: Basic token validation
    console.log('1️⃣ Testing basic token validity...');
    const validateResponse = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${token}`);
    const validateData = await validateResponse.json();

    if (validateData.error) {
      console.log(`❌ Token validation failed: ${validateData.error.message}`);
      return;
    }

    console.log('✅ Token is valid!');
    console.log(`👤 User ID: ${validateData.id}`);
    console.log('');

    // Test 2: Ad accounts access
    console.log('2️⃣ Testing ad accounts access...');
    const adAccountsResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_id&access_token=${token}`
    );

    if (adAccountsResponse.status === 403) {
      console.log('❌ Token lacks ads_read permission');
      console.log('💡 Make sure your token has these permissions:');
      console.log('   - ads_read');
      console.log('   - ads_management');
      console.log('   - business_management');
      return;
    }

    const adAccountsData = await adAccountsResponse.json();
    if (adAccountsData.error) {
      console.log(`❌ Ad accounts access failed: ${adAccountsData.error.message}`);
      return;
    }

    console.log(`✅ Ad accounts access successful!`);
    console.log(`📊 Found ${adAccountsData.data?.length || 0} ad accounts:`);
    
    if (adAccountsData.data) {
      adAccountsData.data.forEach((account, index) => {
        console.log(`   ${index + 1}. ${account.name} (${account.id})`);
      });
    }
    console.log('');

    // Test 3: Convert to long-lived token
    console.log('3️⃣ Testing token conversion to long-lived...');
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (!appId || !appSecret || appSecret === 'your_meta_app_secret') {
      console.log('❌ Missing or invalid META_APP_ID/META_APP_SECRET in .env.local');
      console.log('💡 Please update your .env.local file with real credentials');
      return;
    }

    const conversionResponse = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${token}`
    );

    if (!conversionResponse.ok) {
      const errorData = await conversionResponse.json();
      console.log(`❌ Token conversion failed: ${errorData.error?.message || 'Unknown error'}`);
      return;
    }

    const conversionData = await conversionResponse.json();
    console.log('✅ Token can be converted to long-lived!');
    console.log(`📅 Would expire in: ${conversionData.expires_in} seconds (${Math.floor(conversionData.expires_in / 86400)} days)`);
    console.log('');

    console.log('🎉 Token test completed successfully!');
    console.log('🌐 This token is ready to use in your application.');

  } catch (error) {
    console.log(`❌ Token test failed: ${error.message}`);
  }
}

testToken(); 