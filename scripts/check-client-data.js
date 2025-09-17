const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkClientData() {
  try {
    console.log('🔍 Checking client data...\n');

    // Get all clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*');

    if (clientsError) {
      console.error('Error fetching clients:', clientsError);
      return;
    }

    console.log(`📋 Found ${clients.length} clients:\n`);

    clients.forEach((client, index) => {
      console.log(`${index + 1}. ${client.name} (${client.email})`);
      console.log(`   ID: ${client.id}`);
      console.log(`   Ad Account: ${client.ad_account_id || 'Not set'}`);
      console.log(`   Meta Token: ${client.meta_access_token ? 'Present' : 'Missing'}`);
      console.log(`   API Status: ${client.api_status || 'Unknown'}`);
      console.log(`   Last Report: ${client.last_report_date || 'Never'}`);
      console.log('');
    });

    // Check if jacek has Meta credentials
    const jacek = clients.find(c => c.email === 'jac.honkisz@gmail.com');
    if (jacek) {
      console.log('🎯 Jacek Client Details:');
      console.log(`   Name: ${jacek.name}`);
      console.log(`   Email: ${jacek.email}`);
      console.log(`   Ad Account ID: ${jacek.ad_account_id}`);
      console.log(`   Has Meta Token: ${jacek.meta_access_token ? 'Yes' : 'No'}`);
      console.log(`   Token Length: ${jacek.meta_access_token ? jacek.meta_access_token.length : 0}`);
      console.log(`   API Status: ${jacek.api_status}`);
      
      if (jacek.meta_access_token) {
        console.log(`   Token Preview: ${jacek.meta_access_token.substring(0, 20)}...`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkClientData(); 