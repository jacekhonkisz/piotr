require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMetaSimple() {
  console.log('🧪 Testing Meta API with simple approach...\n');

  try {
    // Get a test client
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .limit(1);

    if (clientsError || !clients || clients.length === 0) {
      console.log('❌ No clients found in database');
      return;
    }

    const testClient = clients[0];
    console.log('✅ Found test client:', testClient.email);

    if (!testClient.meta_access_token) {
      console.log('⚠️ Client has no Meta token, skipping API tests');
      return;
    }

    // Test date range (current month)
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    console.log(`📅 Testing with date range: ${startDate} to ${endDate}\n`);

    // Test basic campaign insights first
    console.log('🔍 Testing basic campaign insights...');
    const basicUrl = `https://graph.facebook.com/v18.0/act_${testClient.ad_account_id}/insights?access_token=${testClient.meta_access_token}&fields=campaign_name,spend,impressions,clicks,ctr,cpc&time_range=${JSON.stringify({since: startDate, until: endDate})}&level=campaign&limit=5`;
    
    console.log('🔗 Basic URL:', basicUrl.replace(testClient.meta_access_token, 'HIDDEN_TOKEN'));
    
    const basicResponse = await fetch(basicUrl);
    const basicData = await basicResponse.json();
    
    if (basicData.error) {
      console.log('❌ Basic API Error:', basicData.error);
    } else {
      console.log('✅ Basic API Success:', basicData.data?.length || 0, 'campaigns');
      if (basicData.data && basicData.data.length > 0) {
        console.log('   Sample campaign:', basicData.data[0]);
      }
    }

    // Test publisher platform breakdown
    console.log('\n🔍 Testing publisher platform breakdown...');
    const platformUrl = `https://graph.facebook.com/v18.0/act_${testClient.ad_account_id}/insights?access_token=${testClient.meta_access_token}&fields=spend,impressions,clicks,ctr,cpc&time_range=${JSON.stringify({since: startDate, until: endDate})}&breakdowns=publisher_platform&level=ad&limit=5`;
    
    const platformResponse = await fetch(platformUrl);
    const platformData = await platformResponse.json();
    
    if (platformData.error) {
      console.log('❌ Platform API Error:', platformData.error);
    } else {
      console.log('✅ Platform API Success:', platformData.data?.length || 0, 'records');
      if (platformData.data && platformData.data.length > 0) {
        console.log('   Sample platform data:', platformData.data[0]);
      }
    }

    // Test demographic breakdown
    console.log('\n🔍 Testing demographic breakdown...');
    const demoUrl = `https://graph.facebook.com/v18.0/act_${testClient.ad_account_id}/insights?access_token=${testClient.meta_access_token}&fields=spend,impressions,clicks,ctr,cpc&time_range=${JSON.stringify({since: startDate, until: endDate})}&breakdowns=age,gender&level=ad&limit=5`;
    
    const demoResponse = await fetch(demoUrl);
    const demoData = await demoResponse.json();
    
    if (demoData.error) {
      console.log('❌ Demographic API Error:', demoData.error);
    } else {
      console.log('✅ Demographic API Success:', demoData.data?.length || 0, 'records');
      if (demoData.data && demoData.data.length > 0) {
        console.log('   Sample demographic data:', demoData.data[0]);
      }
    }

    console.log('\n🎉 Simple Meta API test completed!');

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Run the test
testMetaSimple(); 