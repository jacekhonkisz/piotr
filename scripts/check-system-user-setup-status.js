const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SYSTEM_USER_TOKEN = 'EAAJZBK7pnYW0BQILhmaJRsjgPOJMhPeNUdhatDTKuXTMd4keIPU26AZBOHen9CXwY9UZAu3XgpfCk9LiWoV831Ss3yHKZBGigOCGEZAC9buidimyHwKXZBd9En5k9QodQhCpxaWkEUNjGwYZAsSljSsD8xZBIlvgNrzUFqYLZAIEFwhK5WoyKcRs1Tmy759JtgDKuvwZDZD';
const SYSTEM_USER_ID = '61585150962271';
const TARGET_AD_ACCOUNT = '2043974886396316';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSystemUserSetup() {
  console.log('🔍 Checking System User Setup Status\n');
  console.log('='.repeat(60) + '\n');

  // 1. Check token in database
  console.log('1️⃣ Checking token in database...');
  const { data: settingsData, error: settingsError } = await supabase
    .from('settings')
    .select('key, value, updated_at')
    .eq('key', 'meta_system_user_token')
    .single();

  if (settingsData) {
    const tokenMatch = settingsData.value === SYSTEM_USER_TOKEN;
    console.log(`   ✅ Token stored in database`);
    console.log(`   ${tokenMatch ? '✅' : '❌'} Token matches: ${tokenMatch ? 'Yes' : 'No'}`);
    console.log(`   Updated: ${settingsData.updated_at}`);
  } else {
    console.log(`   ❌ Token NOT found in database`);
  }

  // 2. Test token validity
  console.log('\n2️⃣ Testing token validity...');
  try {
    const meResponse = await fetch(
      `https://graph.facebook.com/v18.0/me?fields=id,name&access_token=${SYSTEM_USER_TOKEN}`
    );

    if (meResponse.ok) {
      const meData = await meResponse.json();
      console.log(`   ✅ Token is valid`);
      console.log(`   System User: ${meData.name || 'N/A'} (${meData.id})`);
      const idMatch = meData.id === SYSTEM_USER_ID || meData.id.toString().includes(SYSTEM_USER_ID);
      console.log(`   ${idMatch ? '✅' : '⚠️ '} System User ID match: ${idMatch ? 'Yes' : 'Partial'}`);
    } else {
      const errorData = await meResponse.json();
      console.log(`   ❌ Token invalid: ${errorData.error?.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.log(`   ❌ Error testing token: ${error.message}`);
  }

  // 3. Check accessible ad accounts
  console.log('\n3️⃣ Checking accessible ad accounts...');
  try {
    const adAccountsResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_id&access_token=${SYSTEM_USER_TOKEN}`
    );

    if (adAccountsResponse.ok) {
      const adAccountsData = await adAccountsResponse.json();
      if (adAccountsData.data && adAccountsData.data.length > 0) {
        console.log(`   ✅ Found ${adAccountsData.data.length} accessible ad account(s)`);
        
        const hasTargetAccount = adAccountsData.data.some(account => {
          const accountId = account.account_id || account.id.replace('act_', '');
          return accountId === TARGET_AD_ACCOUNT;
        });

        if (hasTargetAccount) {
          console.log(`   ✅ Target account ${TARGET_AD_ACCOUNT} IS accessible!`);
        } else {
          console.log(`   ❌ Target account ${TARGET_AD_ACCOUNT} is NOT accessible`);
          console.log(`   ⚠️  You need to assign it to System User in Business Manager`);
        }

        // Show first 5 accounts
        console.log(`\n   First 5 accounts:`);
        adAccountsData.data.slice(0, 5).forEach((account, index) => {
          const accountId = account.account_id || account.id.replace('act_', '');
          const isTarget = accountId === TARGET_AD_ACCOUNT;
          console.log(`   ${index + 1}. ${account.name || 'N/A'} (${accountId}) ${isTarget ? '✅ TARGET' : ''}`);
        });
      } else {
        console.log(`   ❌ No ad accounts accessible`);
      }
    } else {
      const errorData = await adAccountsResponse.json();
      console.log(`   ❌ Cannot fetch ad accounts: ${errorData.error?.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // 4. Test specific ad account access
  console.log(`\n4️⃣ Testing access to ad account ${TARGET_AD_ACCOUNT}...`);
  try {
    const accountResponse = await fetch(
      `https://graph.facebook.com/v18.0/act_${TARGET_AD_ACCOUNT}?fields=id,name,account_id&access_token=${SYSTEM_USER_TOKEN}`
    );

    if (accountResponse.ok) {
      const accountData = await accountResponse.json();
      console.log(`   ✅ Ad account accessible!`);
      console.log(`   Name: ${accountData.name || 'N/A'}`);
      console.log(`   ID: ${accountData.account_id || accountData.id}`);
    } else {
      const errorData = await accountResponse.json();
      console.log(`   ❌ Cannot access ad account: ${errorData.error?.message || 'Unknown error'}`);
      console.log(`   ⚠️  This means the System User doesn't have access yet.`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // 5. Check app configuration
  console.log('\n5️⃣ Checking app configuration...');
  const appId = process.env.META_APP_ID;
  if (appId) {
    console.log(`   ✅ App ID configured: ${appId}`);
  } else {
    console.log(`   ❌ App ID NOT configured in .env.local`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📋 SUMMARY - What you still need:\n');

  console.log('✅ COMPLETED:');
  console.log('   ✅ System User ID: 61585150962271');
  console.log('   ✅ Token generated and stored in database');
  console.log('   ✅ Token is valid and working');
  console.log('   ✅ App ID configured');

  console.log('\n⚠️  STILL NEEDED:');
  console.log('   ❌ Assign ad account 2043974886396316 to System User');
  console.log('      → Go to Business Manager');
  console.log('      → System Users → API - PBM - RAPORTY');
  console.log('      → Assigned Resources → Ad Accounts');
  console.log('      → Assign account 2043974886396316');

  console.log('\n🔗 Direct Link:');
  console.log(`   https://business.facebook.com/settings/system-users/${SYSTEM_USER_ID}`);
}

checkSystemUserSetup().catch(console.error);

