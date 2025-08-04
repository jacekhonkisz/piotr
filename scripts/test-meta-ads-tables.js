const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMetaAdsTables() {
  console.log('🧪 Testing Meta Ads Tables API...');
  
  try {
    // Get a test client
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .limit(1);
    
    if (clientsError || !clients || clients.length === 0) {
      console.log('❌ No clients found for testing');
      return;
    }
    
    const testClient = clients[0];
    console.log('✅ Test client found:', {
      id: testClient.id,
      name: testClient.name,
      email: testClient.email,
      hasMetaToken: !!testClient.meta_access_token,
      adAccountId: testClient.ad_account_id
    });
    
    if (!testClient.meta_access_token) {
      console.log('⚠️ Test client has no Meta token, skipping API test');
      return;
    }
    
    // Test the Meta Ads tables API endpoint
    const testDateStart = '2024-01-01';
    const testDateEnd = '2024-01-31';
    
    console.log('📡 Testing API endpoint with dates:', { testDateStart, testDateEnd });
    
    const response = await fetch('http://localhost:3000/api/fetch-meta-tables', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TEST_JWT_TOKEN || 'test-token'}`
      },
      body: JSON.stringify({
        dateStart: testDateStart,
        dateEnd: testDateEnd,
        clientId: testClient.id
      })
    });
    
    console.log('📡 API Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API Response:', {
        success: data.success,
        hasPlacementData: !!data.data?.placementPerformance,
        hasDemographicData: !!data.data?.demographicPerformance,
        hasAdRelevanceData: !!data.data?.adRelevanceResults,
        placementCount: data.data?.placementPerformance?.length || 0,
        demographicCount: data.data?.demographicPerformance?.length || 0,
        adRelevanceCount: data.data?.adRelevanceResults?.length || 0
      });
    } else {
      const errorData = await response.text();
      console.log('❌ API Error:', errorData);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testMetaAdsTables(); 