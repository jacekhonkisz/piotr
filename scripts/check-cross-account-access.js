#!/usr/bin/env node

/**
 * Script to check if existing system user tokens can access ad accounts of clients without tokens
 */

require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Clients without tokens that we want to check
const clientsWithoutTokens = [
  {
    name: 'Arche Nałęczów',
    adAccountId: '1840493736446778',
    businessManagerId: '7255168957851204',
    email: 'arche.naleczow@example.com'
  },
  {
    name: 'Młyn Klekotki',
    adAccountId: '1986851554988160',
    businessManagerId: '3195952590697293',
    email: 'mlyn.klekotki@example.com'
  },
  {
    name: 'Sandra SPA Karpacz',
    adAccountId: '876383783444749',
    businessManagerId: '232610765847396',
    email: 'sandra.spa@example.com'
  },
  {
    name: 'Nickel Resort Grzybowo',
    adAccountId: '4058314751116360',
    businessManagerId: '1852856535343006',
    email: 'nickel.resort@example.com'
  }
];

async function getExistingTokens() {
  console.log('🔍 Getting tokens from successfully added clients...\n');
  
  const { data: clients, error } = await supabase
    .from('clients')
    .select('name, email, meta_access_token, ad_account_id')
    .not('meta_access_token', 'is', null);

  if (error) {
    throw new Error(`Failed to get clients: ${error.message}`);
  }

  console.log(`Found ${clients.length} clients with tokens:`);
  clients.forEach(client => {
    console.log(`   • ${client.name} (${client.ad_account_id})`);
  });

  return clients;
}

async function testTokenAccess(token, adAccountId, clientName, tokenOwner) {
  try {
    console.log(`   🔍 Testing ${tokenOwner}'s token...`);
    
    // Test ad account access
    const response = await fetch(
      `https://graph.facebook.com/v18.0/act_${adAccountId}?fields=id,name,account_status,currency&access_token=${token}`,
      { timeout: 10000 }
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { 
        success: false, 
        error: `HTTP ${response.status}: ${errorData.error?.message || 'Unknown error'}` 
      };
    }

    const accountData = await response.json();
    
    return { 
      success: true, 
      account: {
        id: accountData.id,
        name: accountData.name,
        status: accountData.account_status,
        currency: accountData.currency
      },
      tokenOwner: tokenOwner
    };

  } catch (error) {
    return { 
      success: false, 
      error: error.message 
    };
  }
}

async function checkCrossAccountAccess() {
  console.log('🚀 CHECKING CROSS-ACCOUNT ACCESS FOR CLIENTS WITHOUT TOKENS\n');
  console.log('='.repeat(70));

  try {
    // Get existing tokens
    const existingClients = await getExistingTokens();
    
    if (existingClients.length === 0) {
      console.log('❌ No clients with tokens found!');
      return;
    }

    const results = {
      accessible: [],
      notAccessible: []
    };

    // Test each client without token against all existing tokens
    for (const clientWithoutToken of clientsWithoutTokens) {
      console.log(`\n🏨 Testing access for: ${clientWithoutToken.name}`);
      console.log(`   📧 Email: ${clientWithoutToken.email}`);
      console.log(`   🏢 Ad Account: ${clientWithoutToken.adAccountId}`);
      console.log(`   🏢 Business Manager: ${clientWithoutToken.businessManagerId}`);

      let foundAccess = false;
      const accessResults = [];

      // Test with each existing token
      for (const existingClient of existingClients) {
        const result = await testTokenAccess(
          existingClient.meta_access_token,
          clientWithoutToken.adAccountId,
          clientWithoutToken.name,
          existingClient.name
        );

        if (result.success) {
          console.log(`   ✅ ACCESSIBLE via ${existingClient.name}'s token!`);
          console.log(`      Account: ${result.account.name} (Status: ${result.account.status})`);
          console.log(`      Currency: ${result.account.currency}`);
          
          foundAccess = true;
          accessResults.push({
            tokenOwner: existingClient.name,
            tokenOwnerEmail: existingClient.email,
            token: existingClient.meta_access_token,
            account: result.account
          });
        } else {
          console.log(`   ❌ Not accessible via ${existingClient.name}'s token: ${result.error}`);
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (foundAccess) {
        results.accessible.push({
          ...clientWithoutToken,
          accessVia: accessResults
        });
      } else {
        results.notAccessible.push(clientWithoutToken);
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(70));
    console.log('📋 CROSS-ACCOUNT ACCESS SUMMARY');
    console.log('='.repeat(70));

    console.log(`\n✅ Clients that CAN be added using existing tokens: ${results.accessible.length}`);
    results.accessible.forEach(client => {
      console.log(`\n   🏨 ${client.name}`);
      console.log(`      📧 Email: ${client.email}`);
      console.log(`      🏢 Ad Account: ${client.adAccountId}`);
      console.log(`      🔑 Can use tokens from:`);
      client.accessVia.forEach(access => {
        console.log(`         • ${access.tokenOwner} (${access.tokenOwnerEmail})`);
        console.log(`           Account: ${access.account.name} (${access.account.status})`);
      });
    });

    console.log(`\n❌ Clients that CANNOT be added with existing tokens: ${results.notAccessible.length}`);
    results.notAccessible.forEach(client => {
      console.log(`   • ${client.name} - Need their own Meta Ads token`);
    });

    // Provide actionable recommendations
    if (results.accessible.length > 0) {
      console.log('\n🎯 ACTIONABLE RECOMMENDATIONS:');
      console.log('\nYou can now add these clients using existing tokens:');
      
      results.accessible.forEach(client => {
        const bestToken = client.accessVia[0]; // Use the first working token
        console.log(`\n📝 To add ${client.name}:`);
        console.log(`   1. Use token from: ${bestToken.tokenOwner}`);
        console.log(`   2. Token: ${bestToken.token.substring(0, 20)}...`);
        console.log(`   3. Ad Account ID: ${client.adAccountId}`);
        console.log(`   4. Email: ${client.email}`);
      });

      console.log('\n💡 Would you like me to automatically add these clients now?');
    }

    return results;

  } catch (error) {
    console.error('💥 Error:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  checkCrossAccountAccess().catch(console.error);
}

module.exports = { checkCrossAccountAccess };
