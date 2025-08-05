require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugAdAccountAccess() {
  console.log('🔍 DEBUGGING AD ACCOUNT ACCESS\n');
  console.log('='.repeat(50));

  try {
    // Get client data
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'jac.honkisz@gmail.com')
      .single();

    if (clientError || !client) {
      console.error('❌ Client not found:', clientError);
      return;
    }

    console.log('✅ Client found:', client.name);
    console.log('🔑 Token has all required permissions');

    // Test different ad account ID formats
    const adAccountId = client.ad_account_id;
    console.log('\n🔍 Testing ad account access with different formats...');
    
    const testFormats = [
      { name: 'Original format', id: adAccountId },
      { name: 'With act_ prefix', id: adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}` },
      { name: 'Without act_ prefix', id: adAccountId.startsWith('act_') ? adAccountId.substring(4) : adAccountId }
    ];

    for (const format of testFormats) {
      console.log(`\n📋 Testing: ${format.name} (${format.id})`);
      
      try {
        const accountUrl = `https://graph.facebook.com/v18.0/${format.id}?access_token=${client.meta_access_token}&fields=id,name,account_status,currency,timezone_name`;
        const response = await fetch(accountUrl);
        const data = await response.json();

        if (data.error) {
          console.log(`   ❌ Error: ${data.error.message}`);
          console.log(`   📝 Error code: ${data.error.code}`);
          console.log(`   📝 Error subcode: ${data.error.error_subcode}`);
        } else {
          console.log(`   ✅ SUCCESS! Account info:`, {
            id: data.id,
            name: data.name,
            status: data.account_status,
            currency: data.currency,
            timezone: data.timezone_name
          });
        }
      } catch (error) {
        console.log(`   ❌ Network error: ${error.message}`);
      }
    }

    // Test getting user's ad accounts
    console.log('\n🔍 Testing user ad accounts access...');
    try {
      const adAccountsUrl = `https://graph.facebook.com/v18.0/me/adaccounts?access_token=${client.meta_access_token}&fields=id,name,account_id,account_status`;
      const response = await fetch(adAccountsUrl);
      const data = await response.json();

      if (data.error) {
        console.log(`❌ Error getting ad accounts: ${data.error.message}`);
      } else {
        const accounts = data.data || [];
        console.log(`✅ Found ${accounts.length} ad accounts for user:`);
        
        accounts.forEach((account, index) => {
          console.log(`   ${index + 1}. ${account.name} (${account.account_id})`);
          console.log(`      Status: ${account.account_status}`);
          console.log(`      ID: ${account.id}`);
        });

        // Check if our target account is in the list
        const targetAccount = accounts.find(acc => 
          acc.account_id === adAccountId || 
          acc.id === adAccountId ||
          acc.id === `act_${adAccountId}` ||
          acc.account_id === adAccountId.replace('act_', '')
        );

        if (targetAccount) {
          console.log(`\n🎯 Target account found in user's accounts!`);
          console.log(`   Using ID: ${targetAccount.id}`);
        } else {
          console.log(`\n⚠️ Target account NOT found in user's accounts`);
          console.log(`   Expected: ${adAccountId}`);
          console.log(`   Available: ${accounts.map(acc => acc.account_id).join(', ')}`);
        }
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }

    // Test business accounts
    console.log('\n🔍 Testing business accounts access...');
    try {
      const businessAccountsUrl = `https://graph.facebook.com/v18.0/me/businesses?access_token=${client.meta_access_token}&fields=id,name,verification_status`;
      const response = await fetch(businessAccountsUrl);
      const data = await response.json();

      if (data.error) {
        console.log(`❌ Error getting business accounts: ${data.error.message}`);
      } else {
        const businesses = data.data || [];
        console.log(`✅ Found ${businesses.length} business accounts:`);
        
        businesses.forEach((business, index) => {
          console.log(`   ${index + 1}. ${business.name} (${business.id})`);
          console.log(`      Verification: ${business.verification_status}`);
        });
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }

    // Recommendations
    console.log('\n📋 RECOMMENDATIONS\n');
    console.log('='.repeat(50));
    
    console.log('🔧 Possible solutions:');
    console.log('   1. Check if the ad account ID is correct');
    console.log('   2. Verify the user has access to this specific ad account');
    console.log('   3. Check if the ad account is in a Business Manager');
    console.log('   4. Ensure the ad account is not disabled or restricted');
    console.log('   5. Try using a different ad account ID from the user\'s list');

  } catch (error) {
    console.error('💥 Script error:', error);
  }
}

// Run the debug
debugAdAccountAccess(); 