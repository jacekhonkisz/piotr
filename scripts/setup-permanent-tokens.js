const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables. Please check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupPermanentTokens() {
  console.log('🔧 Meta API Permanent Token Setup\n');
  console.log('This script will help you set up permanent Meta API tokens for your clients.\n');

  // Check environment variables
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    console.log('❌ Missing Meta App credentials in .env.local file');
    console.log('💡 Please add these environment variables:');
    console.log('   META_APP_ID=your_meta_app_id');
    console.log('   META_APP_SECRET=your_meta_app_secret');
    console.log('\n📋 To get these credentials:');
    console.log('   1. Go to https://developers.facebook.com/');
    console.log('   2. Create a new app or select existing app');
    console.log('   3. Add "Marketing API" product');
    console.log('   4. Copy App ID and App Secret');
    return;
  }

  console.log('✅ Meta App credentials found');
  console.log(`   App ID: ${appId.substring(0, 10)}...`);
  console.log(`   App Secret: ${appSecret.substring(0, 10)}...\n`);

  // Get all clients
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('*');

  if (clientsError) {
    console.error('❌ Error fetching clients:', clientsError);
    return;
  }

  if (!clients || clients.length === 0) {
    console.log('ℹ️ No clients found in database.');
    return;
  }

  console.log(`📋 Found ${clients.length} client(s):\n`);

  for (const client of clients) {
    console.log(`🔍 Client: ${client.name} (${client.email})`);
    console.log(`   Ad Account ID: ${client.ad_account_id}`);
    console.log(`   Current Token: ${client.meta_access_token ? 'Present (expired)' : 'Missing'}`);
    
    // Test current token
    if (client.meta_access_token) {
      try {
        const testResponse = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${client.meta_access_token}`);
        const testData = await testResponse.json();
        
        if (testData.error) {
          console.log(`   ❌ Token Status: ${testData.error.message}`);
        } else {
          console.log(`   ✅ Token Status: Valid`);
        }
      } catch (error) {
        console.log(`   ❌ Token Status: Error testing token`);
      }
    } else {
      console.log(`   ❌ Token Status: No token found`);
    }
    
    console.log('');
  }

  console.log('📋 **NEXT STEPS TO SET UP PERMANENT TOKENS:**\n');
  console.log('1️⃣ **Generate New Access Token:**');
  console.log('   a) Go to https://developers.facebook.com/tools/explorer/');
  console.log('   b) Select your app from the dropdown');
  console.log('   c) Click "Generate Access Token"');
  console.log('   d) Select these permissions:');
  console.log('      - ads_read');
  console.log('      - ads_management');
  console.log('      - business_management');
  console.log('      - read_insights');
  console.log('   e) Copy the generated token\n');

  console.log('2️⃣ **Convert to Long-Lived Token:**');
  console.log('   Run this command with your new token:');
  console.log(`   curl -X GET "https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=YOUR_NEW_TOKEN"\n`);

  console.log('3️⃣ **Update Client Tokens:**');
  console.log('   Use the admin panel or run the update script:');
  console.log('   node scripts/update-meta-token.js\n');

  console.log('4️⃣ **Alternative: System User Token (Most Permanent):**');
  console.log('   a) Go to Business Manager → Settings → Business Settings');
  console.log('   b) Create a System User with Admin role');
  console.log('   c) Generate token with required permissions');
  console.log('   d) Assign to your ad accounts\n');

  console.log('🎯 **Recommended Approach:**');
  console.log('   Use System User tokens for maximum permanence - they never expire!');
  console.log('   This is the most reliable solution for production applications.\n');

  console.log('📞 **Need Help?**');
  console.log('   - Check the META_API_TROUBLESHOOTING.md file for detailed instructions');
  console.log('   - Ensure your Meta app has the Marketing API product added');
  console.log('   - Verify your ad account IDs are correct');
}

setupPermanentTokens(); 