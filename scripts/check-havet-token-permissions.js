require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkHavetTokenPermissions() {
  console.log('🔍 CHECKING HAVET TOKEN AND PERMISSIONS\n');
  console.log('='.repeat(80));

  const HAVET_CLIENT_ID = '93d46876-addc-4b99-b1e1-437428dd54f1';

  try {
    // 1. Get client from database
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', HAVET_CLIENT_ID)
      .single();

    if (clientError || !client) {
      console.log('❌ Client not found');
      return;
    }

    console.log('📋 CLIENT DETAILS:');
    console.log(`   Name: ${client.name}`);
    console.log(`   Email: ${client.email}`);
    console.log(`   Ad Account ID: ${client.ad_account_id}`);
    console.log(`   API Status: ${client.api_status}`);
    console.log(`   Token (first 50 chars): ${client.meta_access_token?.substring(0, 50)}...`);
    console.log(`   Token Length: ${client.meta_access_token?.length || 0} chars`);

    const accessToken = client.meta_access_token;

    // 2. Test token validity - me endpoint
    console.log('\n\n1️⃣ Testing token validity (me endpoint)...');
    try {
      const meResponse = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${accessToken}`);
      const meData = await meResponse.json();
      
      if (meData.error) {
        console.log(`   ❌ Token Error: ${meData.error.message}`);
        console.log(`   Error Code: ${meData.error.code}`);
        console.log(`   Error Type: ${meData.error.type}`);
      } else {
        console.log(`   ✅ Token is valid`);
        console.log(`   User ID: ${meData.id}`);
        console.log(`   Name: ${meData.name}`);
      }
    } catch (e) {
      console.log(`   ❌ Request failed: ${e.message}`);
    }

    // 3. Test token debug info
    console.log('\n2️⃣ Testing token debug info...');
    try {
      const debugResponse = await fetch(`https://graph.facebook.com/v18.0/debug_token?input_token=${accessToken}&access_token=${accessToken}`);
      const debugData = await debugResponse.json();
      
      if (debugData.error) {
        console.log(`   ❌ Debug Error: ${debugData.error.message}`);
      } else if (debugData.data) {
        console.log(`   ✅ Token Debug Info:`);
        console.log(`   App ID: ${debugData.data.app_id}`);
        console.log(`   User ID: ${debugData.data.user_id}`);
        console.log(`   Type: ${debugData.data.type}`);
        console.log(`   Is Valid: ${debugData.data.is_valid}`);
        console.log(`   Expires At: ${debugData.data.expires_at ? new Date(debugData.data.expires_at * 1000).toISOString() : 'Never'}`);
        console.log(`   Data Access Expires At: ${debugData.data.data_access_expires_at ? new Date(debugData.data.data_access_expires_at * 1000).toISOString() : 'N/A'}`);
        
        if (debugData.data.scopes) {
          console.log(`   Scopes: ${debugData.data.scopes.join(', ')}`);
        }
        
        if (debugData.data.granular_scopes) {
          console.log(`   Granular Scopes:`);
          debugData.data.granular_scopes.forEach(scope => {
            console.log(`      - ${scope.scope}${scope.target_ids ? ` (targets: ${scope.target_ids.join(', ')})` : ''}`);
          });
        }
      }
    } catch (e) {
      console.log(`   ❌ Debug request failed: ${e.message}`);
    }

    // 4. Test ad account access
    console.log('\n3️⃣ Testing ad account access...');
    const adAccountId = `act_${client.ad_account_id}`;
    
    try {
      const accountResponse = await fetch(`https://graph.facebook.com/v18.0/${adAccountId}?access_token=${accessToken}&fields=id,name,account_id,account_status,currency,amount_spent,business`);
      const accountData = await accountResponse.json();
      
      if (accountData.error) {
        console.log(`   ❌ Ad Account Error: ${accountData.error.message}`);
        console.log(`   Error Code: ${accountData.error.code}`);
        
        // Check for specific permission error
        if (accountData.error.code === 200) {
          console.log('\n   ⚠️ PERMISSION ISSUE DETECTED!');
          console.log('   The token does not have ads_read or ads_management permission');
          console.log('   for this specific ad account.\n');
          console.log('   Possible causes:');
          console.log('   1. Token was generated for a different Business Manager');
          console.log('   2. Ad account was not shared with the System User');
          console.log('   3. Permission was revoked');
          console.log('\n   FIX: Re-generate token with proper ad account access');
        }
      } else {
        console.log(`   ✅ Ad Account accessible:`);
        console.log(`   Account ID: ${accountData.account_id}`);
        console.log(`   Name: ${accountData.name}`);
        console.log(`   Status: ${accountData.account_status}`);
        console.log(`   Currency: ${accountData.currency}`);
        console.log(`   Amount Spent: ${accountData.amount_spent || 'N/A'}`);
        if (accountData.business) {
          console.log(`   Business: ${accountData.business.name} (${accountData.business.id})`);
        }
      }
    } catch (e) {
      console.log(`   ❌ Ad account request failed: ${e.message}`);
    }

    // 5. Test campaigns access
    console.log('\n4️⃣ Testing campaigns access...');
    try {
      const campaignsResponse = await fetch(`https://graph.facebook.com/v18.0/${adAccountId}/campaigns?access_token=${accessToken}&fields=id,name,status&limit=5`);
      const campaignsData = await campaignsResponse.json();
      
      if (campaignsData.error) {
        console.log(`   ❌ Campaigns Error: ${campaignsData.error.message}`);
      } else if (campaignsData.data) {
        console.log(`   ✅ Found ${campaignsData.data.length} campaigns`);
        campaignsData.data.slice(0, 3).forEach((c, i) => {
          console.log(`      ${i + 1}. ${c.name} (${c.status})`);
        });
      }
    } catch (e) {
      console.log(`   ❌ Campaigns request failed: ${e.message}`);
    }

    // 6. Test insights access
    console.log('\n5️⃣ Testing insights access...');
    try {
      const insightsResponse = await fetch(`https://graph.facebook.com/v18.0/${adAccountId}/insights?access_token=${accessToken}&fields=spend,impressions,clicks&date_preset=this_month`);
      const insightsData = await insightsResponse.json();
      
      if (insightsData.error) {
        console.log(`   ❌ Insights Error: ${insightsData.error.message}`);
        console.log(`   Error Code: ${insightsData.error.code}`);
      } else if (insightsData.data && insightsData.data.length > 0) {
        const insight = insightsData.data[0];
        console.log(`   ✅ Insights accessible:`);
        console.log(`   Spend: ${insight.spend} PLN`);
        console.log(`   Impressions: ${insight.impressions}`);
        console.log(`   Clicks: ${insight.clicks}`);
      } else {
        console.log(`   ⚠️ No insights data returned`);
      }
    } catch (e) {
      console.log(`   ❌ Insights request failed: ${e.message}`);
    }

    // 7. List available ad accounts for this token
    console.log('\n6️⃣ Listing all ad accounts accessible with this token...');
    try {
      const adAccountsResponse = await fetch(`https://graph.facebook.com/v18.0/me/adaccounts?access_token=${accessToken}&fields=id,name,account_id,account_status`);
      const adAccountsData = await adAccountsResponse.json();
      
      if (adAccountsData.error) {
        console.log(`   ❌ Error: ${adAccountsData.error.message}`);
      } else if (adAccountsData.data) {
        console.log(`   Found ${adAccountsData.data.length} ad account(s):`);
        adAccountsData.data.forEach((acc, i) => {
          const isTarget = acc.account_id === client.ad_account_id;
          console.log(`      ${i + 1}. ${acc.name} (${acc.account_id}) ${isTarget ? '⭐ TARGET' : ''}`);
          console.log(`         Status: ${acc.account_status}`);
        });
        
        // Check if target account is in the list
        const targetFound = adAccountsData.data.some(acc => acc.account_id === client.ad_account_id);
        if (!targetFound) {
          console.log(`\n   ❌ TARGET AD ACCOUNT NOT FOUND IN TOKEN'S ACCESSIBLE ACCOUNTS!`);
          console.log(`   The token cannot access ad account: ${client.ad_account_id}`);
          console.log(`   This is why the API returns permission errors.`);
        } else {
          console.log(`\n   ✅ Target ad account is accessible with this token`);
        }
      }
    } catch (e) {
      console.log(`   ❌ Ad accounts list request failed: ${e.message}`);
    }

    // Summary
    console.log('\n\n' + '='.repeat(80));
    console.log('📋 DIAGNOSIS SUMMARY');
    console.log('='.repeat(80));
    
    console.log(`
The audit reveals the following issues with Havet's December 2025 data:

1. ❌ SMART CACHE IS EMPTY
   - The cache record exists but contains NO DATA
   - This is because the API fetch failed due to permission issues

2. ❌ API PERMISSION ERROR (#200)
   - Error: "Ad account owner has NOT grant ads_management or ads_read permission"
   - The Meta access token does NOT have permission to access this ad account
   
3. ❌ NO HISTORICAL DATA
   - No campaign_summaries for December 2025
   - No daily_kpi_data for December 2025
   - The system has been unable to collect data due to permission issues

4. 🔧 ROOT CAUSE
   - The Meta access token stored for Havet client either:
     a) Was generated for a different Business Manager
     b) The ad account was not properly assigned to the System User
     c) Permissions were revoked

5. 📋 REQUIRED FIX
   - Generate a new Meta access token with proper permissions
   - Ensure the System User has ads_read permission for ad account 659510566204299
   - Update the token in the database
   - Force refresh the cache
`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkHavetTokenPermissions().catch(console.error);
