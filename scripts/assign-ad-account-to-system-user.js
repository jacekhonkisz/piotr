const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SYSTEM_USER_TOKEN = 'EAAJZBK7pnYW0BQILhmaJRsjgPOJMhPeNUdhatDTKuXTMd4keIPU26AZBOHen9CXwY9UZAu3XgpfCk9LiWoV831Ss3yHKZBGigOCGEZAC9buidimyHwKXZBd9En5k9QodQhCpxaWkEUNjGwYZAsSljSsD8xZBIlvgNrzUFqYLZAIEFwhK5WoyKcRs1Tmy759JtgDKuvwZDZD';
const SYSTEM_USER_ID = '61585150962271';
const AD_ACCOUNT_ID = '2043974886396316';

async function assignAdAccountToSystemUser() {
  console.log('🔧 Assigning Ad Account to System User\n');
  console.log(`System User ID: ${SYSTEM_USER_ID}`);
  console.log(`Ad Account ID: ${AD_ACCOUNT_ID}\n`);

  try {
    // First, get the business ID from the ad account
    console.log('1️⃣ Getting business ID from ad account...');
    const accountInfoResponse = await fetch(
      `https://graph.facebook.com/v18.0/act_${AD_ACCOUNT_ID}?fields=id,business&access_token=${SYSTEM_USER_TOKEN}`
    );

    if (!accountInfoResponse.ok) {
      const errorData = await accountInfoResponse.json();
      console.log(`❌ Cannot access ad account: ${errorData.error?.message || 'Unknown error'}`);
      console.log(`\n⚠️  This means the System User doesn't have access yet.`);
      console.log(`   You need to assign it manually in Business Manager.`);
      return false;
    }

    const accountInfo = await accountInfoResponse.json();
    const businessId = accountInfo.business?.id;
    
    if (!businessId) {
      console.log('❌ Cannot determine business ID from ad account');
      return false;
    }

    console.log(`✅ Business ID: ${businessId}\n`);

    // Method 1: Try to assign via Business Manager API
    console.log('2️⃣ Attempting to assign ad account via Business Manager API...');
    
    // This requires business_management permission and the business ID
    const assignResponse = await fetch(
      `https://graph.facebook.com/v18.0/${businessId}/assigned_users`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user: SYSTEM_USER_ID,
          tasks: ['ADVERTISE', 'ANALYZE'],
          access_token: SYSTEM_USER_TOKEN
        })
      }
    );

    if (!assignResponse.ok) {
      const errorData = await assignResponse.json();
      console.log(`⚠️  API assignment failed: ${errorData.error?.message || 'Unknown error'}`);
      console.log(`   Error code: ${errorData.error?.code || 'N/A'}`);
      console.log(`   Error type: ${errorData.error?.type || 'N/A'}\n`);
      
      // Method 2: Try assigning ad account directly to system user
      console.log('3️⃣ Trying alternative method: Assign ad account to system user...');
      
      const assignAccountResponse = await fetch(
        `https://graph.facebook.com/v18.0/act_${AD_ACCOUNT_ID}/assigned_users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user: SYSTEM_USER_ID,
            tasks: ['ADVERTISE', 'ANALYZE'],
            access_token: SYSTEM_USER_TOKEN
          })
        }
      );

      if (!assignAccountResponse.ok) {
        const errorData2 = await assignAccountResponse.json();
        console.log(`❌ Alternative method also failed: ${errorData2.error?.message || 'Unknown error'}`);
        console.log(`\n📋 Manual Assignment Required:`);
        console.log(`   Meta API doesn't allow programmatic assignment of ad accounts to system users.`);
        console.log(`   You must do this manually in Business Manager.\n`);
        console.log(`🔗 Direct Link:`);
        console.log(`   https://business.facebook.com/settings/system-users/${SYSTEM_USER_ID}?business_id=${businessId}`);
        console.log(`\n📝 Steps:`);
        console.log(`   1. Go to the link above`);
        console.log(`   2. Click "Przypisane zasoby" (Assigned Resources) tab`);
        console.log(`   3. Click "Przypisz" → "Konta reklamowe" (Ad Accounts)`);
        console.log(`   4. Select ad account: ${AD_ACCOUNT_ID}`);
        console.log(`   5. Role: "Admin"`);
        console.log(`   6. Click "Przypisz"`);
        return false;
      }

      const assignResult = await assignAccountResponse.json();
      console.log(`✅ Successfully assigned via alternative method!`);
      console.log(`   Result:`, assignResult);
      return true;
    }

    const assignResult = await assignResponse.json();
    console.log(`✅ Successfully assigned via Business Manager API!`);
    console.log(`   Result:`, assignResult);
    return true;

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return false;
  }
}

async function verifyAssignment() {
  console.log('\n\n🔍 Verifying Assignment\n');
  
  try {
    const adAccountsResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_id&access_token=${SYSTEM_USER_TOKEN}`
    );

    if (!adAccountsResponse.ok) {
      console.log('❌ Cannot verify - cannot fetch ad accounts');
      return;
    }

    const adAccountsData = await adAccountsResponse.json();
    const hasAccount = adAccountsData.data?.some(account => {
      const accountId = account.account_id || account.id.replace('act_', '');
      return accountId === AD_ACCOUNT_ID;
    });

    if (hasAccount) {
      console.log(`✅ Ad account ${AD_ACCOUNT_ID} is now accessible!`);
    } else {
      console.log(`❌ Ad account ${AD_ACCOUNT_ID} is still not accessible.`);
      console.log(`   Please assign it manually in Business Manager.`);
    }
  } catch (error) {
    console.log(`⚠️  Verification error: ${error.message}`);
  }
}

async function main() {
  const success = await assignAdAccountToSystemUser();
  
  if (success) {
    // Wait a moment for Meta to process
    console.log('\n⏳ Waiting 2 seconds for Meta to process...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    await verifyAssignment();
  }
}

main().catch(console.error);

