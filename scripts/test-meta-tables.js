require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMetaTablesAPI() {
  console.log('🧪 Testing Meta Tables API...\n');

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

    // Test the new API methods directly
    const { MetaAPIService } = require('../src/lib/meta-api');
    
    if (!testClient.meta_token) {
      console.log('⚠️ Client has no Meta token, skipping API tests');
      return;
    }

    const metaService = new MetaAPIService(testClient.meta_token);
    
    // Test date range (current month)
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    console.log(`📅 Testing with date range: ${startDate} to ${endDate}\n`);

    // Test placement performance
    console.log('🔍 Testing placement performance...');
    try {
      const placementData = await metaService.getPlacementPerformance(
        testClient.ad_account_id,
        startDate,
        endDate
      );
      console.log(`✅ Placement performance: ${placementData.length} records`);
      if (placementData.length > 0) {
        console.log('   Sample data:', placementData[0]);
      }
    } catch (error) {
      console.log('❌ Placement performance error:', error.message);
    }

    // Test demographic performance
    console.log('\n🔍 Testing demographic performance...');
    try {
      const demographicData = await metaService.getDemographicPerformance(
        testClient.ad_account_id,
        startDate,
        endDate
      );
      console.log(`✅ Demographic performance: ${demographicData.length} records`);
      if (demographicData.length > 0) {
        console.log('   Sample data:', demographicData[0]);
      }
    } catch (error) {
      console.log('❌ Demographic performance error:', error.message);
    }

    // Test ad relevance results
    console.log('\n🔍 Testing ad relevance results...');
    try {
      const adRelevanceData = await metaService.getAdRelevanceResults(
        testClient.ad_account_id,
        startDate,
        endDate
      );
      console.log(`✅ Ad relevance results: ${adRelevanceData.length} records`);
      if (adRelevanceData.length > 0) {
        console.log('   Sample data:', adRelevanceData[0]);
      }
    } catch (error) {
      console.log('❌ Ad relevance results error:', error.message);
    }

    console.log('\n🎉 Meta Tables API test completed!');

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Run the test
testMetaTablesAPI(); 