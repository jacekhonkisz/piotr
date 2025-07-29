require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMetaBreakdowns() {
  console.log('🧪 Testing Meta API breakdowns...\n');

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

    // Test different breakdowns
    const breakdownsToTest = [
      'publisher_platform',
      'platform_position', 
      'device_platform',
      'age',
      'gender',
      'country',
      'region'
    ];

    for (const breakdown of breakdownsToTest) {
      console.log(`🔍 Testing breakdown: ${breakdown}`);
      
      const url = `https://graph.facebook.com/v18.0/act_${testClient.ad_account_id}/insights?access_token=${testClient.meta_access_token}&fields=spend,impressions,clicks,ctr,cpc&time_range=${JSON.stringify({since: startDate, until: endDate})}&breakdowns=${breakdown}&level=campaign&limit=5`;
      
      try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
          console.log(`❌ ${breakdown} Error:`, data.error.message);
        } else {
          console.log(`✅ ${breakdown} Success:`, data.data?.length || 0, 'records');
          if (data.data && data.data.length > 0) {
            console.log(`   Sample ${breakdown} data:`, data.data[0]);
          }
        }
      } catch (error) {
        console.log(`❌ ${breakdown} Fetch Error:`, error.message);
      }
      
      console.log(''); // Empty line for readability
    }

    console.log('🎉 Meta API breakdowns test completed!');

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Run the test
testMetaBreakdowns(); 