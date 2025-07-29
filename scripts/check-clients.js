require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkClients() {
  console.log('🔍 Checking all available clients...\n');

  try {
    // Get all clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*');

    if (clientsError) {
      console.log('❌ Error fetching clients:', clientsError);
      return;
    }

    if (!clients || clients.length === 0) {
      console.log('❌ No clients found in database');
      return;
    }

    console.log(`✅ Found ${clients.length} clients:\n`);

    for (const client of clients) {
      console.log(`📧 Email: ${client.email}`);
      console.log(`   Name: ${client.name}`);
      console.log(`   Company: ${client.company || 'N/A'}`);
      console.log(`   Ad Account ID: ${client.ad_account_id}`);
      console.log(`   Has Meta Token: ${!!client.meta_access_token}`);
      console.log(`   API Status: ${client.api_status}`);
      console.log(`   Created: ${client.created_at}`);
      console.log('');
    }

    // Test the specific client mentioned
    const jacekClient = clients.find(c => c.email === 'jac.honkisz@gmail.com');
    if (jacekClient) {
      console.log('🎯 Testing jac.honkisz@gmail.com client...\n');
      
      if (!jacekClient.meta_access_token) {
        console.log('❌ No Meta token available for jac.honkisz@gmail.com');
        return;
      }

      // Test date range (current month)
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      console.log(`📅 Testing with date range: ${startDate} to ${endDate}\n`);

      // Test basic campaign insights
      console.log('🔍 Testing basic campaign insights...');
      const basicUrl = `https://graph.facebook.com/v18.0/act_${jacekClient.ad_account_id}/insights?access_token=${jacekClient.meta_access_token}&fields=campaign_name,spend,impressions,clicks,ctr,cpc&time_range=${JSON.stringify({since: startDate, until: endDate})}&level=campaign&limit=5`;
      
      const basicResponse = await fetch(basicUrl);
      const basicData = await basicResponse.json();
      
      if (basicData.error) {
        console.log('❌ Basic API Error:', basicData.error.message);
      } else {
        console.log('✅ Basic API Success:', basicData.data?.length || 0, 'campaigns');
        if (basicData.data && basicData.data.length > 0) {
          console.log('   Sample campaign:', basicData.data[0]);
        }
      }

      // Test publisher platform breakdown
      console.log('\n🔍 Testing publisher platform breakdown...');
      const platformUrl = `https://graph.facebook.com/v18.0/act_${jacekClient.ad_account_id}/insights?access_token=${jacekClient.meta_access_token}&fields=spend,impressions,clicks,ctr,cpc&time_range=${JSON.stringify({since: startDate, until: endDate})}&breakdowns=publisher_platform&level=campaign&limit=5`;
      
      const platformResponse = await fetch(platformUrl);
      const platformData = await platformResponse.json();
      
      if (platformData.error) {
        console.log('❌ Platform API Error:', platformData.error.message);
      } else {
        console.log('✅ Platform API Success:', platformData.data?.length || 0, 'records');
        if (platformData.data && platformData.data.length > 0) {
          console.log('   Sample platform data:', platformData.data[0]);
        }
      }

    } else {
      console.log('❌ jac.honkisz@gmail.com client not found');
    }

  } catch (error) {
    console.error('💥 Error:', error);
  }
}

// Run the check
checkClients(); 