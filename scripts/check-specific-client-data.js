require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSpecificClientData() {
  console.log('🔍 CHECKING SPECIFIC CLIENT DATA\n');
  console.log('='.repeat(50));

  const targetToken = 'EAAKZBRTlpNXsBPMg0chlsVDyDiPuQcOZAYaKYtz2rQKW93ZBGuH0VJzj2eFWv8WNVrus3mBbm8RnpG5JVFjOA7813ZCRy8zZBH0qTLNK9QZCrhO8ZAITtIkeGohn1DfRyouTDIoASdBNJzbPUphAEZAX2TmFMRmXrcySZA5ZBqiL8Oz7n6KquIBL92EaZAwk6UzOZCurpQZDZD';
  const targetAdAccountId = '772154478638459';

  try {
    // 1. Search for client with this token
    console.log('1️⃣ Searching for client with this token...');
    const { data: clientsWithToken, error: tokenError } = await supabase
      .from('clients')
      .select('*')
      .eq('meta_access_token', targetToken);

    if (tokenError) {
      console.error('❌ Error searching by token:', tokenError);
      return;
    }

    if (clientsWithToken && clientsWithToken.length > 0) {
      console.log(`✅ Found ${clientsWithToken.length} client(s) with this token:`);
      clientsWithToken.forEach((client, index) => {
        console.log(`   ${index + 1}. ${client.name} (${client.email})`);
        console.log(`      ID: ${client.id}`);
        console.log(`      Ad Account: ${client.ad_account_id}`);
        console.log(`      API Status: ${client.api_status || 'Unknown'}`);
        console.log(`      Last Report: ${client.last_report_date || 'Never'}`);
      });
    } else {
      console.log('❌ No client found with this exact token');
    }

    // 2. Search for client with this ad account ID
    console.log('\n2️⃣ Searching for client with this ad account ID...');
    const { data: clientsWithAdAccount, error: adAccountError } = await supabase
      .from('clients')
      .select('*')
      .eq('ad_account_id', targetAdAccountId);

    if (adAccountError) {
      console.error('❌ Error searching by ad account ID:', adAccountError);
      return;
    }

    if (clientsWithAdAccount && clientsWithAdAccount.length > 0) {
      console.log(`✅ Found ${clientsWithAdAccount.length} client(s) with this ad account ID:`);
      clientsWithAdAccount.forEach((client, index) => {
        console.log(`   ${index + 1}. ${client.name} (${client.email})`);
        console.log(`      ID: ${client.id}`);
        console.log(`      Has Token: ${client.meta_access_token ? 'Yes' : 'No'}`);
        if (client.meta_access_token) {
          console.log(`      Token Preview: ${client.meta_access_token.substring(0, 20)}...`);
        }
        console.log(`      API Status: ${client.api_status || 'Unknown'}`);
        console.log(`      Last Report: ${client.last_report_date || 'Never'}`);
      });
    } else {
      console.log('❌ No client found with this ad account ID');
    }

    // 3. Search for partial token match (in case token was truncated)
    console.log('\n3️⃣ Searching for partial token match...');
    const tokenStart = targetToken.substring(0, 20);
    const { data: clientsWithPartialToken, error: partialError } = await supabase
      .from('clients')
      .select('*')
      .ilike('meta_access_token', `${tokenStart}%`);

    if (partialError) {
      console.error('❌ Error searching by partial token:', partialError);
      return;
    }

    if (clientsWithPartialToken && clientsWithPartialToken.length > 0) {
      console.log(`✅ Found ${clientsWithPartialToken.length} client(s) with similar token:`);
      clientsWithPartialToken.forEach((client, index) => {
        console.log(`   ${index + 1}. ${client.name} (${client.email})`);
        console.log(`      ID: ${client.id}`);
        console.log(`      Ad Account: ${client.ad_account_id}`);
        console.log(`      Token Preview: ${client.meta_access_token.substring(0, 20)}...`);
        console.log(`      API Status: ${client.api_status || 'Unknown'}`);
      });
    } else {
      console.log('❌ No client found with similar token');
    }

    // 4. Test the token directly with Meta API
    console.log('\n4️⃣ Testing token with Meta API...');
    try {
      // Test basic token validity
      const tokenInfoResponse = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${targetToken}`);
      const tokenInfo = await tokenInfoResponse.json();
      
      if (tokenInfo.error) {
        console.error('❌ Token validation failed:', tokenInfo.error.message);
      } else {
        console.log('✅ Token is valid');
        console.log(`   User ID: ${tokenInfo.id}`);
        console.log(`   Name: ${tokenInfo.name}`);
        
        // Test ad accounts access
        const adAccountsResponse = await fetch(`https://graph.facebook.com/v18.0/me/adaccounts?access_token=${targetToken}&fields=id,name,account_id,account_status`);
        const adAccounts = await adAccountsResponse.json();
        
        if (adAccounts.error) {
          console.error('❌ Ad accounts access failed:', adAccounts.error.message);
        } else {
          console.log(`✅ Ad accounts accessible: ${adAccounts.data?.length || 0} accounts`);
          adAccounts.data?.forEach(account => {
            console.log(`   - ${account.name} (${account.account_id}) - Status: ${account.account_status}`);
          });
        }
        
        // Test specific ad account access
        const adAccountId = targetAdAccountId.startsWith('act_') ? targetAdAccountId : `act_${targetAdAccountId}`;
        const accountResponse = await fetch(`https://graph.facebook.com/v18.0/${adAccountId}?access_token=${targetToken}&fields=id,name,account_id,account_status`);
        const account = await accountResponse.json();
        
        if (account.error) {
          console.error('❌ Specific ad account access failed:', account.error.message);
        } else {
          console.log('✅ Specific ad account accessible:', account.name);
        }
      }
    } catch (error) {
      console.error('❌ Meta API test failed:', error.message);
    }

    // 5. Show all clients for reference
    console.log('\n5️⃣ All clients in database:');
    const { data: allClients, error: allError } = await supabase
      .from('clients')
      .select('id, name, email, ad_account_id, meta_access_token');

    if (allError) {
      console.error('❌ Error fetching all clients:', allError);
      return;
    }

    console.log(`📊 Total clients: ${allClients.length}`);
    allClients.forEach((client, index) => {
      console.log(`   ${index + 1}. ${client.name} (${client.email})`);
      console.log(`      Ad Account: ${client.ad_account_id || 'Not set'}`);
      console.log(`      Has Token: ${client.meta_access_token ? 'Yes' : 'No'}`);
      if (client.meta_access_token) {
        console.log(`      Token Preview: ${client.meta_access_token.substring(0, 20)}...`);
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the function
checkSpecificClientData().catch(console.error); 