const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditClientLiveFetching() {
  console.log('🔍 Auditing Client Live Data Fetching...\n');

  try {
    // Get both clients
    const { data: belmonteClient, error: belmonteError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'belmonte@hotel.com')
      .single();

    const { data: havetClient, error: havetError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'havet@magialubczyku.pl')
      .single();

    if (belmonteError || !belmonteClient) {
      console.error('❌ Belmonte client not found:', belmonteError);
      return;
    }

    if (havetError || !havetClient) {
      console.error('❌ Havet client not found:', havetError);
      return;
    }

    console.log('📋 Client Information:');
    console.log('🏨 Belmonte Hotel:');
    console.log(`   ID: ${belmonteClient.id}`);
    console.log(`   Ad Account: ${belmonteClient.ad_account_id}`);
    console.log(`   Meta Token: ${belmonteClient.meta_access_token ? 'Present' : 'Missing'}`);
    console.log(`   Token Preview: ${belmonteClient.meta_access_token?.substring(0, 20)}...`);
    
    console.log('\n🏨 Havet:');
    console.log(`   ID: ${havetClient.id}`);
    console.log(`   Ad Account: ${havetClient.ad_account_id}`);
    console.log(`   Meta Token: ${havetClient.meta_access_token ? 'Present' : 'Missing'}`);
    console.log(`   Token Preview: ${havetClient.meta_access_token?.substring(0, 20)}...`);

    // Check if they have different credentials
    const sameAdAccount = belmonteClient.ad_account_id === havetClient.ad_account_id;
    const sameToken = belmonteClient.meta_access_token === havetClient.meta_access_token;

    console.log('\n🔍 Credential Comparison:');
    console.log(`   Same Ad Account: ${sameAdAccount ? '❌ YES (ISSUE!)' : '✅ NO (GOOD)'}`);
    console.log(`   Same Meta Token: ${sameToken ? '❌ YES (ISSUE!)' : '✅ NO (GOOD)'}`);

    if (sameAdAccount || sameToken) {
      console.log('\n⚠️  ISSUE DETECTED: Clients are sharing API credentials!');
      return;
    }

    console.log('\n✅ GOOD: Each client has unique API credentials');

    // Get admin session for API testing
    const { data: { session }, error: sessionError } = await supabase.auth.signInWithPassword({
      email: 'jac.honkisz@gmail.com',
      password: 'v&6uP*1UqTQN'
    });

    if (sessionError || !session) {
      console.error('❌ Failed to get admin session:', sessionError);
      return;
    }

    console.log('\n🔐 Admin session obtained');

    // Test live data fetching for both clients
    const testDateRange = {
      start: '2025-08-01',
      end: '2025-08-07'
    };

    console.log('\n🌐 Testing Live Data Fetching...');

    // Test Belmonte
    console.log('\n📊 Testing Belmonte Hotel live data...');
    const belmonteResponse = await fetch('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        clientId: belmonteClient.id,
        dateRange: testDateRange
      })
    });

    console.log(`   Belmonte Response Status: ${belmonteResponse.status}`);
    
    if (belmonteResponse.ok) {
      const belmonteData = await belmonteResponse.json();
      console.log(`   Belmonte Campaigns: ${belmonteData.data?.campaigns?.length || 0}`);
      console.log(`   Belmonte Total Spend: ${belmonteData.data?.stats?.totalSpend || 0}`);
    } else {
      const errorText = await belmonteResponse.text();
      console.log(`   Belmonte Error: ${errorText}`);
    }

    // Test Havet
    console.log('\n📊 Testing Havet live data...');
    const havetResponse = await fetch('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        clientId: havetClient.id,
        dateRange: testDateRange
      })
    });

    console.log(`   Havet Response Status: ${havetResponse.status}`);
    
    if (havetResponse.ok) {
      const havetData = await havetResponse.json();
      console.log(`   Havet Campaigns: ${havetData.data?.campaigns?.length || 0}`);
      console.log(`   Havet Total Spend: ${havetData.data?.stats?.totalSpend || 0}`);
    } else {
      const errorText = await havetResponse.text();
      console.log(`   Havet Error: ${errorText}`);
    }

    console.log('\n✅ Audit completed successfully');

  } catch (error) {
    console.error('❌ Audit failed:', error);
  }
}

auditClientLiveFetching(); 