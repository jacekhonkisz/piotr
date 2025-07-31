require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkClients() {
  console.log('🔍 Checking clients with Meta API tokens...\n');
  
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, meta_access_token, ad_account_id');

  if (error) {
    console.error('❌ Error fetching clients:', error);
    return;
  }

  console.log(`📊 Found ${clients.length} total clients:\n`);

  clients.forEach((client, index) => {
    console.log(`${index + 1}. ${client.name}`);
    console.log(`   ID: ${client.id}`);
    console.log(`   Ad Account: ${client.ad_account_id || 'Not set'}`);
    console.log(`   Meta Token: ${client.meta_access_token ? '✅ Present' : '❌ Missing'}`);
    if (client.meta_access_token) {
      console.log(`   Token Preview: ${client.meta_access_token.substring(0, 20)}...`);
    }
    console.log('');
  });

  const clientsWithTokens = clients.filter(c => c.meta_access_token);
  console.log(`\n🎯 Summary:`);
  console.log(`   Total clients: ${clients.length}`);
  console.log(`   Clients with Meta tokens: ${clientsWithTokens.length}`);
  console.log(`   Clients without Meta tokens: ${clients.length - clientsWithTokens.length}`);

  if (clientsWithTokens.length === 0) {
    console.log('\n⚠️  No clients have Meta API tokens!');
    console.log('   This means all PDFs will show demo data.');
    console.log('   To see real Meta API data, you need to:');
    console.log('   1. Add Meta API tokens to clients');
    console.log('   2. Ensure tokens have proper permissions');
    console.log('   3. Verify ad account IDs are correct');
  } else {
    console.log('\n✅ Found clients with Meta tokens!');
    console.log('   These clients will show real Meta API data in PDFs.');
  }
}

checkClients().catch(console.error); 