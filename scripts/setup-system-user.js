const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function setupSystemUser() {
  console.log('🔧 Meta API System User Setup for Permanent Tokens\n');
  
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  
  console.log('📋 Current Setup:');
  console.log(`   App ID: ${appId}`);
  console.log(`   App Secret: ${appSecret ? '✅ Set' : '❌ Missing'}`);
  console.log('');
  
  console.log('🎯 **SYSTEM USER SETUP (PERMANENT TOKENS)**\n');
  console.log('📋 **Step-by-Step Instructions:**\n');
  
  console.log('1️⃣ **Access Business Manager:**');
  console.log('   • Go to: https://business.facebook.com/');
  console.log('   • Log in with your Facebook account');
  console.log('');
  
  console.log('2️⃣ **Navigate to System Users:**');
  console.log('   • Click "Business Settings" (gear icon)');
  console.log('   • Go to "Users" → "System Users"');
  console.log('   • Click "Add" → "System User"');
  console.log('');
  
  console.log('3️⃣ **Create System User:**');
  console.log('   • Name: "API Access User"');
  console.log('   • Role: "Admin" or "Developer"');
  console.log('   • Click "Create System User"');
  console.log('');
  
  console.log('4️⃣ **Assign App Access:**');
  console.log('   • Click on your new System User');
  console.log('   • Go to "Assigned Assets" → "Apps"');
  console.log('   • Click "Assign" → "Apps"');
  console.log('   • Select your app: "jakpisac2"');
  console.log('   • Role: "Admin" or "Developer"');
  console.log('   • Click "Assign"');
  console.log('');
  
  console.log('5️⃣ **Assign Ad Account Access:**');
  console.log('   • Still in "Assigned Assets"');
  console.log('   • Go to "Ad Accounts"');
  console.log('   • Click "Assign" → "Ad Accounts"');
  console.log('   • Select: 703853679965014');
  console.log('   • Role: "Admin"');
  console.log('   • Click "Assign"');
  console.log('');
  
  console.log('6️⃣ **Generate System User Token:**');
  console.log('   • In System User settings');
  console.log('   • Go to "Access Tokens"');
  console.log('   • Click "Generate New Token"');
  console.log('   • Select your app: "jakpisac2"');
  console.log('   • Permissions: ads_read, ads_management, business_management');
  console.log('   • Click "Generate Token"');
  console.log('');
  
  console.log('7️⃣ **Copy the Token:**');
  console.log('   • Copy the generated token (starts with EAA...)');
  console.log('   • This token NEVER expires!');
  console.log('');
  
  console.log('8️⃣ **Update Your Application:**');
  console.log('   • Run: node scripts/update-all-tokens.js --all "SYSTEM_USER_TOKEN"');
  console.log('   • This will update all clients with the permanent token');
  console.log('');
  
  console.log('🎉 **Benefits of System User Tokens:**');
  console.log('   ✅ Never expire');
  console.log('   ✅ No need for manual renewal');
  console.log('   ✅ Perfect for production applications');
  console.log('   ✅ Can access multiple ad accounts');
  console.log('');
  
  console.log('⚠️ **Important Notes:**');
  console.log('   • System Users are tied to your Business Manager');
  console.log('   • You need Business Manager admin access');
  console.log('   • The token will work as long as the System User exists');
  console.log('');
  
  console.log('🔗 **Useful Links:**');
  console.log('   • Business Manager: https://business.facebook.com/');
  console.log('   • Meta for Developers: https://developers.facebook.com/');
  console.log('   • System User Docs: https://developers.facebook.com/docs/marketing-api/access#system-user');
}

setupSystemUser(); 