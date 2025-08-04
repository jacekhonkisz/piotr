const { createClient } = require('@supabase/supabase-js');
const { SmartDataLoader } = require('../src/lib/smart-data-loader');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testStoredVsLiveData() {
  console.log('🧪 Testing stored vs live data fetching...\n');

  try {
    // Get a test client
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('api_status', 'valid')
      .limit(1);

    if (clientError || !clients || clients.length === 0) {
      console.error('❌ No valid clients found');
      return;
    }

    const testClient = clients[0];
    console.log(`📊 Testing with client: ${testClient.name} (${testClient.id})`);

    // Test 1: Check if campaign_summaries table has data
    console.log('\n🔍 Test 1: Checking campaign_summaries table...');
    const { data: summaries, error: summariesError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', testClient.id)
      .order('summary_date', { ascending: false });

    if (summariesError) {
      console.error('❌ Error fetching summaries:', summariesError);
    } else {
      console.log(`✅ Found ${summaries.length} stored summaries`);
      
      if (summaries.length > 0) {
        console.log('📅 Recent stored summaries:');
        summaries.slice(0, 5).forEach(summary => {
          console.log(`  - ${summary.summary_type}: ${summary.summary_date} (${summary.last_updated})`);
        });
      }
    }

    // Test 2: Test recent data (should be stored)
    console.log('\n🔍 Test 2: Testing recent data (should be stored)...');
    const recentDateRange = {
      start: '2024-01-01',
      end: '2024-01-31'
    };

    const smartLoader = SmartDataLoader.getInstance();
    const recentResult = await smartLoader.loadData(testClient.id, recentDateRange);
    
    console.log(`📊 Recent data result:`);
    console.log(`  - Source: ${recentResult.source}`);
    console.log(`  - Is Historical: ${recentResult.isHistorical}`);
    console.log(`  - Data Age: ${recentResult.dataAge}`);
    console.log(`  - Last Updated: ${recentResult.lastUpdated}`);

    // Test 3: Test older data (should be live-fetched)
    console.log('\n🔍 Test 3: Testing older data (should be live-fetched)...');
    const oldDateRange = {
      start: '2022-01-01',
      end: '2022-01-31'
    };

    const oldResult = await smartLoader.loadData(testClient.id, oldDateRange);
    
    console.log(`📊 Old data result:`);
    console.log(`  - Source: ${oldResult.source}`);
    console.log(`  - Is Historical: ${oldResult.isHistorical}`);
    console.log(`  - Data Age: ${oldResult.dataAge}`);
    console.log(`  - Last Updated: ${oldResult.lastUpdated}`);

    // Test 4: Check database directly for specific dates
    console.log('\n🔍 Test 4: Checking database for specific dates...');
    
    // Check for recent date
    const { data: recentStored, error: recentStoredError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', testClient.id)
      .eq('summary_date', recentDateRange.start)
      .eq('summary_type', 'monthly');

    if (recentStoredError) {
      console.error('❌ Error checking recent stored data:', recentStoredError);
    } else {
      console.log(`📦 Recent date (${recentDateRange.start}) stored: ${recentStored && recentStored.length > 0 ? 'YES' : 'NO'}`);
      if (recentStored && recentStored.length > 0) {
        console.log(`  - Last updated: ${recentStored[0].last_updated}`);
        console.log(`  - Total spend: $${recentStored[0].total_spend}`);
      }
    }

    // Check for old date
    const { data: oldStored, error: oldStoredError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', testClient.id)
      .eq('summary_date', oldDateRange.start)
      .eq('summary_type', 'monthly');

    if (oldStoredError) {
      console.error('❌ Error checking old stored data:', oldStoredError);
    } else {
      console.log(`📦 Old date (${oldDateRange.start}) stored: ${oldStored && oldStored.length > 0 ? 'YES' : 'NO'}`);
    }

    // Test 5: Performance comparison
    console.log('\n🔍 Test 5: Performance comparison...');
    
    const startTime1 = Date.now();
    const recentResult2 = await smartLoader.loadData(testClient.id, recentDateRange);
    const recentTime = Date.now() - startTime1;

    const startTime2 = Date.now();
    const oldResult2 = await smartLoader.loadData(testClient.id, oldDateRange);
    const oldTime = Date.now() - startTime2;

    console.log(`⚡ Performance:`);
    console.log(`  - Recent data (${recentResult2.source}): ${recentTime}ms`);
    console.log(`  - Old data (${oldResult2.source}): ${oldTime}ms`);
    console.log(`  - Speed difference: ${oldTime > 0 ? Math.round((oldTime / recentTime) * 100) / 100 : 'N/A'}x slower`);

    // Test 6: Verify data consistency
    console.log('\n🔍 Test 6: Data consistency check...');
    
    if (recentResult2.source === 'stored' && recentStored && recentStored.length > 0) {
      const storedData = recentStored[0];
      const fetchedData = recentResult2.data;
      
      console.log(`📊 Data consistency:`);
      console.log(`  - Stored spend: $${storedData.total_spend}`);
      console.log(`  - Fetched spend: $${fetchedData.totals?.spend || 'N/A'}`);
      console.log(`  - Data matches: ${Math.abs(storedData.total_spend - (fetchedData.totals?.spend || 0)) < 0.01 ? 'YES' : 'NO'}`);
    }

    // Summary
    console.log('\n📋 Test Summary:');
    console.log(`✅ Recent data (${recentDateRange.start}): ${recentResult.source === 'stored' ? 'STORED' : 'LIVE'}`);
    console.log(`✅ Old data (${oldDateRange.start}): ${oldResult.source === 'api' ? 'LIVE' : 'STORED'}`);
    console.log(`✅ Performance: Recent data ${recentTime < oldTime ? 'faster' : 'slower'} than old data`);
    console.log(`✅ Database has ${summaries.length} stored summaries`);

    if (recentResult.source === 'stored' && oldResult.source === 'api') {
      console.log('\n🎉 SUCCESS: Smart data loading is working correctly!');
      console.log('   - Recent data is being fetched from storage');
      console.log('   - Old data is being live-fetched from API');
    } else {
      console.log('\n⚠️  WARNING: Smart data loading may not be working as expected');
      console.log('   - Check if background collection is running');
      console.log('   - Verify database has stored data');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testStoredVsLiveData().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
}); 