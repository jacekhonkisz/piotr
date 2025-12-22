const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const NEW_TOKEN = 'EAAJZBK7pnYW0BQILhmaJRsjgPOJMhPeNUdhatDTKuXTMd4keIPU26AZBOHen9CXwY9UZAu3XgpfCk9LiWoV831Ss3yHKZBGigOCGEZAC9buidimyHwKXZBd9En5k9QodQhCpxaWkEUNjGwYZAsSljSsD8xZBIlvgNrzUFqYLZAIEFwhK5WoyKcRs1Tmy759JtgDKuvwZDZD';
const SYSTEM_USER_ID = '61585150962271';
const TARGET_AD_ACCOUNT = '2043974886396316';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testToken() {
  console.log('🔍 Testing New System User Token\n');
  console.log(`System User ID: ${SYSTEM_USER_ID}`);
  console.log(`Target Ad Account: ${TARGET_AD_ACCOUNT}\n`);

  try {
    // 1. Test token validity
    console.log('1️⃣ Testing token validity...');
    const meResponse = await fetch(
      `https://graph.facebook.com/v18.0/me?fields=id,name&access_token=${NEW_TOKEN}`
    );

    if (!meResponse.ok) {
      const errorData = await meResponse.json();
      console.log(`❌ Token validation failed: ${errorData.error?.message || 'Unknown error'}`);
      return false;
    }

    const meData = await meResponse.json();
    console.log(`✅ Token is valid`);
    console.log(`   System User: ${meData.name || 'N/A'} (${meData.id})`);
    console.log(`   Matches expected ID: ${meData.id === SYSTEM_USER_ID ? '✅ Yes' : '❌ No'}\n`);

    // 2. Test ad accounts access
    console.log('2️⃣ Testing ad accounts access...');
    const adAccountsResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_id&access_token=${NEW_TOKEN}`
    );

    if (!adAccountsResponse.ok) {
      const errorData = await adAccountsResponse.json();
      console.log(`❌ Cannot fetch ad accounts: ${errorData.error?.message || 'Unknown error'}`);
      return false;
    }

    const adAccountsData = await adAccountsResponse.json();
    if (adAccountsData.data && adAccountsData.data.length > 0) {
      console.log(`✅ Found ${adAccountsData.data.length} ad account(s):`);
      adAccountsData.data.forEach((account, index) => {
        const accountId = account.account_id || account.id.replace('act_', '');
        const isTarget = accountId === TARGET_AD_ACCOUNT;
        console.log(`   ${index + 1}. ${account.name || 'N/A'} (${accountId}) ${isTarget ? '✅ TARGET' : ''}`);
      });

      // Check if target account is accessible
      const hasTargetAccount = adAccountsData.data.some(account => {
        const accountId = account.account_id || account.id.replace('act_', '');
        return accountId === TARGET_AD_ACCOUNT;
      });

      if (!hasTargetAccount) {
        console.log(`\n⚠️  WARNING: Target ad account ${TARGET_AD_ACCOUNT} is NOT in the list!`);
        console.log(`   You may need to assign this ad account to the System User in Business Manager.`);
      } else {
        console.log(`\n✅ Target ad account ${TARGET_AD_ACCOUNT} is accessible!`);
      }
    } else {
      console.log('❌ No ad accounts found');
      return false;
    }

    // 3. Test specific ad account access
    console.log(`\n3️⃣ Testing access to ad account ${TARGET_AD_ACCOUNT}...`);
    const accountResponse = await fetch(
      `https://graph.facebook.com/v18.0/act_${TARGET_AD_ACCOUNT}?fields=id,name,account_id&access_token=${NEW_TOKEN}`
    );

    if (!accountResponse.ok) {
      const errorData = await accountResponse.json();
      console.log(`❌ Cannot access ad account: ${errorData.error?.message || 'Unknown error'}`);
      console.log(`   This means the System User doesn't have access to this account yet.`);
      return false;
    }

    const accountData = await accountResponse.json();
    console.log(`✅ Ad account accessible:`);
    console.log(`   Name: ${accountData.name || 'N/A'}`);
    console.log(`   ID: ${accountData.account_id || accountData.id}\n`);

    // 4. Test fetching campaigns
    console.log('4️⃣ Testing campaign data fetch...');
    const campaignsResponse = await fetch(
      `https://graph.facebook.com/v18.0/act_${TARGET_AD_ACCOUNT}/campaigns?fields=id,name,status&limit=5&access_token=${NEW_TOKEN}`
    );

    if (!campaignsResponse.ok) {
      const errorData = await campaignsResponse.json();
      console.log(`⚠️  Cannot fetch campaigns: ${errorData.error?.message || 'Unknown error'}`);
      console.log(`   This might be normal if there are no campaigns.`);
    } else {
      const campaignsData = await campaignsResponse.json();
      console.log(`✅ Can fetch campaigns: ${campaignsData.data?.length || 0} found`);
    }

    return true;

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return false;
  }
}

async function updateSystemToken() {
  console.log('\n\n🔧 Updating System Token in Database\n');

  try {
    // Update in settings table
    const { data: settingsData, error: settingsError } = await supabase
      .from('settings')
      .upsert({
        key: 'meta_system_user_token',
        value: NEW_TOKEN,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      })
      .select()
      .single();

    if (settingsError) {
      console.log(`❌ Error updating settings table: ${settingsError.message}`);
      return false;
    }

    console.log('✅ Token updated in settings table');

    // Also check if there's a system_settings table
    const { data: systemSettingsData, error: systemSettingsError } = await supabase
      .from('system_settings')
      .upsert({
        key: 'meta_system_user_token',
        value: NEW_TOKEN,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      })
      .select()
      .single();

    if (systemSettingsError) {
      // This is OK - system_settings table might not exist
      console.log('ℹ️  system_settings table not found (this is OK)');
    } else {
      console.log('✅ Token updated in system_settings table');
    }

    return true;

  } catch (error) {
    console.log(`❌ Error updating database: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 System User Token Test & Update\n');
  console.log('='.repeat(60) + '\n');

  // Test the token first
  const tokenValid = await testToken();

  if (!tokenValid) {
    console.log('\n❌ Token test failed. Please check the token and permissions.');
    console.log('   Make sure:');
    console.log('   1. The System User has access to ad account ' + TARGET_AD_ACCOUNT);
    console.log('   2. The token has ads_read, ads_management, and business_management permissions');
    return;
  }

  // Update the token in database
  const updateSuccess = await updateSystemToken();

  if (updateSuccess) {
    console.log('\n\n✅ SUCCESS! Token has been updated in the system.');
    console.log('\n📋 Next Steps:');
    console.log('   1. The system will now use this new token for all Meta API calls');
    console.log('   2. Test fetching data for ad account ' + TARGET_AD_ACCOUNT);
    console.log('   3. Verify that clients can access their data');
  } else {
    console.log('\n❌ Failed to update token in database. Please check the error above.');
  }
}

main().catch(console.error);

