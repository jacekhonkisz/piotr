require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testStoredVsLiveComparison() {
  console.log('🧪 Testing stored vs live data comparison...\n');

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

    // Test 1: Check what's stored in database
    console.log('\n🔍 Test 1: Checking stored data...');
    const { data: storedData, error: storedError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', testClient.id)
      .order('summary_date', { ascending: false });

    if (storedError) {
      console.error('❌ Error fetching stored data:', storedError);
      return;
    }

    console.log(`📦 Found ${storedData.length} stored summaries`);
    
    if (storedData.length > 0) {
      console.log('📅 Stored summaries:');
      storedData.forEach(summary => {
        console.log(`  - ${summary.summary_type}: ${summary.summary_date} - $${summary.total_spend} (${summary.last_updated})`);
      });
    }

    // Test 2: Test smart data loading for a stored date
    if (storedData.length > 0) {
      const testDate = storedData[0].summary_date;
      console.log(`\n🔍 Test 2: Testing smart loading for stored date ${testDate}...`);
      
      // This would normally use the SmartDataLoader, but let's test the API endpoint
      const response = await fetch('/api/smart-fetch-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: testClient.id,
          dateRange: {
            start: testDate,
            end: testDate
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Smart loading result:`);
        console.log(`  - Source: ${result.metadata?.source || 'unknown'}`);
        console.log(`  - Data Age: ${result.metadata?.dataAge || 'unknown'}`);
        console.log(`  - Is Historical: ${result.metadata?.isHistorical || 'unknown'}`);
      } else {
        console.log(`❌ Smart loading failed: ${response.status}`);
      }
    }

    // Test 3: Test API endpoint directly
    console.log('\n🔍 Test 3: Testing API endpoint directly...');
    
    const response = await fetch('/api/fetch-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId: testClient.id,
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31'
        }
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ API endpoint result:`);
      console.log(`  - Success: ${result.success}`);
      console.log(`  - Has data: ${!!result.data}`);
      console.log(`  - Data type: ${typeof result.data}`);
    } else {
      console.log(`❌ API endpoint failed: ${response.status}`);
    }

    // Test 4: Check if background collection has run
    console.log('\n🔍 Test 4: Checking background collection status...');
    
    const { data: recentSummaries, error: recentError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', testClient.id)
      .gte('last_updated', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

    if (recentError) {
      console.error('❌ Error checking recent summaries:', recentError);
    } else {
      console.log(`📊 Recent summaries (last 24h): ${recentSummaries.length}`);
      if (recentSummaries.length > 0) {
        console.log('✅ Background collection appears to be working');
      } else {
        console.log('⚠️  No recent data - background collection may not be running');
      }
    }

    // Test 5: Manual verification of stored vs live
    console.log('\n🔍 Test 5: Manual verification...');
    
    // Check if we have data for a recent month
    const currentDate = new Date();
    const testMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const testMonthStr = testMonth.toISOString().split('T')[0];
    
    const { data: monthData, error: monthError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', testClient.id)
      .eq('summary_date', testMonthStr)
      .eq('summary_type', 'monthly')
      .single();

    if (monthError || !monthData) {
      console.log(`📦 No stored data for ${testMonthStr} - would be live-fetched`);
    } else {
      console.log(`📦 Found stored data for ${testMonthStr}:`);
      console.log(`  - Spend: $${monthData.total_spend}`);
      console.log(`  - Last updated: ${monthData.last_updated}`);
      console.log(`  - Age: ${Math.round((Date.now() - new Date(monthData.last_updated).getTime()) / (1000 * 60 * 60))} hours`);
    }

    // Summary
    console.log('\n📋 Test Summary:');
    console.log(`✅ Database has ${storedData.length} stored summaries`);
    console.log(`✅ Client: ${testClient.name}`);
    console.log(`✅ API status: ${testClient.api_status}`);
    
    if (storedData.length > 0) {
      console.log('✅ Storage is working - data is being saved');
    } else {
      console.log('⚠️  No stored data found - background collection may be needed');
    }

    // Recommendations
    console.log('\n💡 Recommendations:');
    if (storedData.length < 12) {
      console.log('  - Run background collection to populate more data');
      console.log('  - Check if background jobs are scheduled');
    }
    
    if (storedData.length > 0) {
      console.log('  - Smart data loading should work for stored dates');
      console.log('  - Older dates will be live-fetched from API');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testStoredVsLiveComparison().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
}); 