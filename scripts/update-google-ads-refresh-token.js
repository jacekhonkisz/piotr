require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function updateGoogleAdsRefreshToken() {
  console.log('🔑 GOOGLE ADS REFRESH TOKEN UPDATER\n');
  console.log('='.repeat(60));
  console.log('This script will help you update your Google Ads refresh token');
  console.log('in the system_settings table.\n');

  // First, check current token
  console.log('📋 Checking current token in database...\n');
  
  const { data: currentSetting, error: fetchError } = await supabase
    .from('system_settings')
    .select('*')
    .eq('key', 'google_ads_manager_refresh_token')
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('❌ Error fetching current token:', fetchError);
    rl.close();
    return;
  }

  if (currentSetting) {
    const currentToken = currentSetting.value || '';
    console.log('Current token in database:');
    console.log(`   Preview: ${currentToken.substring(0, 50)}...`);
    console.log(`   Length: ${currentToken.length} characters`);
    console.log(`   Last updated: ${currentSetting.updated_at || 'N/A'}\n`);
    
    if (currentToken.includes('test-token') || currentToken.length < 50) {
      console.log('⚠️  WARNING: Current token appears to be a test/placeholder token!\n');
    }
  } else {
    console.log('⚠️  No token found in database. Will create new entry.\n');
  }

  // Get new token from user
  console.log('📝 Please enter your Google Ads refresh token:');
  console.log('   (The token should be a long string starting with "1//")\n');
  
  const newToken = await askQuestion('Refresh Token: ');

  if (!newToken || newToken.trim().length === 0) {
    console.log('\n❌ No token provided. Exiting.');
    rl.close();
    return;
  }

  const trimmedToken = newToken.trim();

  // Validate token format
  if (!trimmedToken.startsWith('1//')) {
    console.log('\n⚠️  WARNING: Token does not start with "1//"');
    console.log('   This might not be a valid Google OAuth refresh token.');
    const proceed = await askQuestion('   Continue anyway? (y/n): ');
    if (proceed.toLowerCase() !== 'y' && proceed.toLowerCase() !== 'yes') {
      console.log('\n❌ Update cancelled.');
      rl.close();
      return;
    }
  }

  if (trimmedToken.length < 50) {
    console.log('\n⚠️  WARNING: Token is very short (< 50 characters)');
    console.log('   Real Google OAuth refresh tokens are typically 100+ characters.');
    const proceed = await askQuestion('   Continue anyway? (y/n): ');
    if (proceed.toLowerCase() !== 'y' && proceed.toLowerCase() !== 'yes') {
      console.log('\n❌ Update cancelled.');
      rl.close();
      return;
    }
  }

  // Test the token before saving
  console.log('\n🔍 Testing token validity...');
  
  // Get client credentials
  const { data: credentials, error: credError } = await supabase
    .from('system_settings')
    .select('*')
    .in('key', ['google_ads_client_id', 'google_ads_client_secret']);

  if (credError || !credentials || credentials.length < 2) {
    console.log('⚠️  Cannot test token - missing client credentials');
    console.log('   Will save token anyway, but it may not work.\n');
  } else {
    const clientId = credentials.find(c => c.key === 'google_ads_client_id')?.value;
    const clientSecret = credentials.find(c => c.key === 'google_ads_client_secret')?.value;

    if (clientId && clientSecret) {
      try {
        const testResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: trimmedToken,
            grant_type: 'refresh_token'
          })
        });

        const testData = await testResponse.json();

        if (testResponse.ok) {
          console.log('✅ Token is VALID!');
          console.log(`   Access token expires in: ${testData.expires_in} seconds`);
          console.log(`   Token type: ${testData.token_type}\n`);
        } else {
          console.log('❌ Token validation FAILED:');
          console.log(`   Error: ${testData.error || 'Unknown error'}`);
          console.log(`   Description: ${testData.error_description || 'No description'}\n`);
          
          if (testData.error === 'invalid_grant') {
            console.log('🚨 This token is invalid, expired, or revoked.');
            console.log('   Please generate a new refresh token.\n');
          }
          
          const proceed = await askQuestion('   Save token anyway? (y/n): ');
          if (proceed.toLowerCase() !== 'y' && proceed.toLowerCase() !== 'yes') {
            console.log('\n❌ Update cancelled.');
            rl.close();
            return;
          }
        }
      } catch (error) {
        console.log('⚠️  Could not test token:', error.message);
        console.log('   Will save token anyway.\n');
      }
    }
  }

  // Save the token
  console.log('💾 Saving token to database...\n');

  const { data: updatedSetting, error: updateError } = await supabase
    .from('system_settings')
    .upsert({
      key: 'google_ads_manager_refresh_token',
      value: trimmedToken,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'key'
    });

  if (updateError) {
    console.error('❌ Error saving token:', updateError);
    console.log('\n📋 MANUAL UPDATE REQUIRED:');
    console.log('Run this SQL in Supabase:\n');
    console.log(`UPDATE system_settings`);
    console.log(`SET value = '${trimmedToken}',`);
    console.log(`    updated_at = NOW()`);
    console.log(`WHERE key = 'google_ads_manager_refresh_token';\n`);
    rl.close();
    return;
  }

  console.log('✅ Token saved successfully!\n');
  console.log('📋 Token details:');
  console.log(`   Preview: ${trimmedToken.substring(0, 50)}...`);
  console.log(`   Length: ${trimmedToken.length} characters`);
  console.log(`   Saved at: ${new Date().toISOString()}\n`);

  // Verify it was saved
  const { data: verifySetting } = await supabase
    .from('system_settings')
    .select('*')
    .eq('key', 'google_ads_manager_refresh_token')
    .single();

  if (verifySetting && verifySetting.value === trimmedToken) {
    console.log('✅ Verification: Token confirmed in database!\n');
  }

  console.log('🎉 UPDATE COMPLETE!');
  console.log('='.repeat(60));
  console.log('\n💡 Next steps:');
  console.log('   1. Test the token by running: node scripts/audit-google-ads-token-config.js');
  console.log('   2. Or test in your app - the Google Ads API should work now!\n');

  rl.close();
}

// Run the updater
updateGoogleAdsRefreshToken().catch(error => {
  console.error('💥 Script error:', error);
  rl.close();
  process.exit(1);
});




