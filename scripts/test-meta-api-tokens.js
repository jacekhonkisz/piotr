const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMetaAPITokens() {
  console.log('🔍 Starting Meta API Token Audit...\n');

  try {
    // Get all clients with Meta tokens
    console.log('📊 Fetching all clients with Meta tokens...');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email, ad_account_id, meta_access_token')
      .not('meta_access_token', 'is', null);

    if (clientsError) {
      console.error('❌ Error fetching clients:', clientsError);
      return;
    }

    console.log(`✅ Found ${clients.length} clients with Meta tokens\n`);

    // Test each client's token
    for (const client of clients) {
      console.log(`🔍 Testing client: ${client.name} (${client.email})`);
      console.log(`📋 Ad Account ID: ${client.ad_account_id}`);
      console.log(`🔑 Token preview: ${client.meta_access_token ? client.meta_access_token.substring(0, 30) + '...' : 'none'}\n`);

      if (!client.meta_access_token) {
        console.log('❌ No Meta token found for this client\n');
        continue;
      }

      // Test 1: Basic token validation
      console.log('  🔐 Test 1: Basic token validation...');
      try {
        const validateResponse = await fetch(
          `https://graph.facebook.com/v18.0/me?access_token=${client.meta_access_token}`
        );
        const validateData = await validateResponse.json();

        if (validateData.error) {
          console.log(`    ❌ Token validation failed: ${validateData.error.message}`);
        } else {
          console.log(`    ✅ Token is valid! User ID: ${validateData.id}`);
        }
      } catch (error) {
        console.log(`    ❌ Token validation error: ${error.message}`);
      }

      // Test 2: Token permissions (ads_read)
      console.log('  📋 Test 2: Token permissions (ads_read)...');
      try {
        const permissionsResponse = await fetch(
          `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_id&access_token=${client.meta_access_token}`
        );

        if (permissionsResponse.status === 403) {
          console.log('    ❌ Token lacks ads_read permission');
        } else {
          const permissionsData = await permissionsResponse.json();
          if (permissionsData.error) {
            console.log(`    ❌ Permissions error: ${permissionsData.error.message}`);
          } else {
            console.log(`    ✅ Token has ads_read permission! Found ${permissionsData.data?.length || 0} ad accounts`);
          }
        }
      } catch (error) {
        console.log(`    ❌ Permissions test error: ${error.message}`);
      }

      // Test 3: Campaign insights access
      console.log('  📈 Test 3: Campaign insights access...');
      if (client.ad_account_id) {
        try {
          const cleanAccountId = client.ad_account_id.replace('act_', '');
          const insightsResponse = await fetch(
            `https://graph.facebook.com/v18.0/act_${cleanAccountId}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend&access_token=${client.meta_access_token}&time_range={"since":"2024-01-01","until":"2024-01-31"}`
          );

          if (insightsResponse.status === 403) {
            console.log('    ❌ No access to campaign insights (ads_management permission needed)');
          } else {
            const insightsData = await insightsResponse.json();
            if (insightsData.error) {
              console.log(`    ❌ Insights error: ${insightsData.error.message}`);
            } else {
              console.log(`    ✅ Campaign insights access successful! Found ${insightsData.data?.length || 0} campaigns`);
            }
          }
        } catch (error) {
          console.log(`    ❌ Insights test error: ${error.message}`);
        }
      } else {
        console.log('    ⚠️ No ad account ID found for this client');
      }

      // Test 4: Account info access
      console.log('  🏢 Test 4: Account info access...');
      if (client.ad_account_id) {
        try {
          const cleanAccountId = client.ad_account_id.replace('act_', '');
          const accountResponse = await fetch(
            `https://graph.facebook.com/v18.0/act_${cleanAccountId}?fields=id,name,account_id,account_status,currency&access_token=${client.meta_access_token}`
          );

          if (accountResponse.status === 403) {
            console.log('    ❌ No access to account info');
          } else {
            const accountData = await accountResponse.json();
            if (accountData.error) {
              console.log(`    ❌ Account info error: ${accountData.error.message}`);
            } else {
              console.log(`    ✅ Account info access successful! Account: ${accountData.name} (${accountData.account_status})`);
            }
          }
        } catch (error) {
          console.log(`    ❌ Account info test error: ${error.message}`);
        }
      }

      console.log('\n' + '─'.repeat(50) + '\n');
    }

    // Summary
    console.log('📊 AUDIT SUMMARY:');
    console.log('==================');
    console.log(`Total clients tested: ${clients.length}`);
    console.log('Common issues found:');
    console.log('- Missing ads_read permission');
    console.log('- Missing ads_management permission');
    console.log('- Invalid or expired tokens');
    console.log('- No access to specific ad accounts');
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('==================');
    console.log('1. Generate new tokens with proper permissions:');
    console.log('   - ads_read');
    console.log('   - ads_management');
    console.log('   - business_management');
    console.log('   - read_insights');
    console.log('2. Use System User tokens for permanent access');
    console.log('3. Ensure tokens have access to specific ad accounts');
    console.log('4. Test tokens before updating database');

  } catch (error) {
    console.error('❌ Audit failed:', error);
  }
}

// Run the audit
testMetaAPITokens().then(() => {
  console.log('✅ Meta API Token Audit Complete');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Audit failed:', error);
  process.exit(1);
}); 