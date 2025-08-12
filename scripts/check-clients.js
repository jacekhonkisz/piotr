// Script to check current clients in the database
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkClients() {
  console.log('🔍 Checking Current Clients in Database\n');

  try {
    // Get all clients
    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, name, email, api_status, meta_access_token, ad_account_id')
      .order('name');

    if (error) {
      console.error('❌ Error fetching clients:', error.message);
      return;
    }

    if (!clients || clients.length === 0) {
      console.log('⚠️ No clients found in database');
      return;
    }

    console.log(`📊 Found ${clients.length} clients:\n`);

    clients.forEach((client, index) => {
      const hasToken = client.meta_access_token ? '✅' : '❌';
      const hasAdAccount = client.ad_account_id ? '✅' : '❌';
      const status = client.api_status || 'unknown';
      
      console.log(`${index + 1}. ${client.name}`);
      console.log(`   📧 Email: ${client.email}`);
      console.log(`   🔑 Meta Token: ${hasToken}`);
      console.log(`   📊 Ad Account: ${hasAdAccount}`);
      console.log(`   📈 API Status: ${status}`);
      console.log(`   🆔 ID: ${client.id}`);
      console.log('');
    });

    // Check for specific clients
    const havet = clients.find(c => c.name.toLowerCase().includes('havet'));
    const belmonte = clients.find(c => c.name.toLowerCase().includes('belmonte'));

    console.log('🎯 Target Clients Status:');
    console.log('─'.repeat(50));
    
    if (havet) {
      console.log('✅ Havet found:');
      console.log(`   Name: ${havet.name}`);
      console.log(`   Token: ${havet.meta_access_token ? 'Present' : 'Missing'}`);
      console.log(`   Ad Account: ${havet.ad_account_id || 'Missing'}`);
      console.log(`   Status: ${havet.api_status}`);
    } else {
      console.log('❌ Havet not found');
    }

    if (belmonte) {
      console.log('✅ Belmonte found:');
      console.log(`   Name: ${belmonte.name}`);
      console.log(`   Token: ${belmonte.meta_access_token ? 'Present' : 'Missing'}`);
      console.log(`   Ad Account: ${belmonte.ad_account_id || 'Missing'}`);
      console.log(`   Status: ${belmonte.api_status}`);
    } else {
      console.log('❌ Belmonte not found');
    }

    // Check which clients need data collection
    const clientsNeedingData = clients.filter(c => 
      c.meta_access_token && 
      c.ad_account_id && 
      c.api_status === 'valid'
    );

    console.log('\n📊 Clients Ready for Data Collection:');
    console.log('─'.repeat(50));
    
    if (clientsNeedingData.length > 0) {
      clientsNeedingData.forEach(client => {
        console.log(`✅ ${client.name} - Ready for collection`);
      });
    } else {
      console.log('⚠️ No clients are ready for data collection');
      console.log('   (Missing tokens, ad accounts, or invalid API status)');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the check
checkClients(); 