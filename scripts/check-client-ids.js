require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkClientIDs() {
  console.log('🔍 Checking available client IDs...\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing environment variables');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Check clients table
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, google_ads_enabled')
      .order('name');

    if (clientsError) {
      console.error('❌ Error fetching clients:', clientsError);
      return;
    }

    console.log('📋 Available clients:');
    clients.forEach(client => {
      console.log(`   ID: ${client.id}`);
      console.log(`   Name: ${client.name}`);
      console.log(`   Google Ads Enabled: ${client.google_ads_enabled}`);
      console.log('   ---');
    });

    // Check if there are any clients with Google Ads enabled
    const googleAdsClients = clients.filter(c => c.google_ads_enabled);
    console.log(`\n🎯 Clients with Google Ads enabled: ${googleAdsClients.length}`);
    
    if (googleAdsClients.length > 0) {
      console.log('✅ Found clients with Google Ads data for testing');
    } else {
      console.log('❌ No clients have Google Ads enabled');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkClientIDs();
