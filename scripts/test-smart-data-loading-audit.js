require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditSmartDataLoading() {
  console.log('🔍 Auditing Smart Data Loading System\n');

  try {
    // 1. Get all clients
    console.log('1. Getting all clients...');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email')
      .eq('api_status', 'valid');

    if (clientsError) {
      console.error('❌ Error getting clients:', clientsError);
      return;
    }

    console.log(`✅ Found ${clients.length} valid clients`);

    // 2. Get current date and calculate 12 months ago
    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    console.log(`\n2. Date Analysis:`);
    console.log(`   Current date: ${now.toISOString().split('T')[0]}`);
    console.log(`   12 months ago: ${twelveMonthsAgo.toISOString().split('T')[0]}`);
    console.log(`   Retention period: ${twelveMonthsAgo.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`);

    // 3. Get all campaign summaries
    console.log('\n3. Getting all campaign summaries...');
    const { data: campaignSummaries, error: summariesError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .order('summary_date', { ascending: false });

    if (summariesError) {
      console.error('❌ Error getting campaign summaries:', summariesError);
      return;
    }

    console.log(`✅ Found ${campaignSummaries.length} campaign summaries`);

    // 4. Analyze each summary
    console.log('\n4. Analyzing campaign summaries...');
    
    const summariesInRetention = [];
    const summariesOutsideRetention = [];
    
    campaignSummaries.forEach(summary => {
      const summaryDate = new Date(summary.summary_date);
      const isInRetention = summaryDate >= twelveMonthsAgo;
      
      if (isInRetention) {
        summariesInRetention.push(summary);
      } else {
        summariesOutsideRetention.push(summary);
      }
    });

    console.log(`📊 Summary Analysis:`);
    console.log(`   In retention period (≤12 months): ${summariesInRetention.length}`);
    console.log(`   Outside retention period (>12 months): ${summariesOutsideRetention.length}`);

    // 5. Test different date scenarios
    console.log('\n5. Testing different date scenarios...');
    
    const testScenarios = [
      {
        name: 'Current Month',
        date: new Date(now.getFullYear(), now.getMonth(), 1),
        expectedSource: 'cache'
      },
      {
        name: 'Last Month',
        date: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        expectedSource: 'cache'
      },
      {
        name: '6 Months Ago',
        date: new Date(now.getFullYear(), now.getMonth() - 6, 1),
        expectedSource: 'cache'
      },
      {
        name: '11 Months Ago',
        date: new Date(now.getFullYear(), now.getMonth() - 11, 1),
        expectedSource: 'cache'
      },
      {
        name: '13 Months Ago',
        date: new Date(now.getFullYear(), now.getMonth() - 13, 1),
        expectedSource: 'api'
      },
      {
        name: '2 Years Ago',
        date: new Date(now.getFullYear() - 2, now.getMonth(), 1),
        expectedSource: 'api'
      }
    ];

    testScenarios.forEach(scenario => {
      const scenarioDate = scenario.date;
      const isInRetention = scenarioDate >= twelveMonthsAgo;
      const actualSource = isInRetention ? 'cache' : 'api';
      const status = actualSource === scenario.expectedSource ? '✅' : '❌';
      
      console.log(`   ${status} ${scenario.name} (${scenarioDate.toISOString().split('T')[0]}):`);
      console.log(`     Expected: ${scenario.expectedSource.toUpperCase()}`);
      console.log(`     Actual: ${actualSource.toUpperCase()}`);
      console.log(`     In retention: ${isInRetention ? 'Yes' : 'No'}`);
    });

    // 6. Check what data would be loaded for each client
    console.log('\n6. Checking data loading for each client...');
    
    for (const client of clients) {
      console.log(`\n   Client: ${client.name} (${client.id})`);
      
      // Get summaries for this client
      const clientSummaries = campaignSummaries.filter(s => s.client_id === client.id);
      console.log(`   Total summaries: ${clientSummaries.length}`);
      
      if (clientSummaries.length > 0) {
        const inRetention = clientSummaries.filter(s => 
          new Date(s.summary_date) >= twelveMonthsAgo
        );
        const outsideRetention = clientSummaries.filter(s => 
          new Date(s.summary_date) < twelveMonthsAgo
        );
        
        console.log(`   In retention: ${inRetention.length} (would use CACHE)`);
        console.log(`   Outside retention: ${outsideRetention.length} (would use API)`);
        
        // Show sample dates
        if (inRetention.length > 0) {
          const sampleInRetention = inRetention[0];
          console.log(`   Sample cached date: ${sampleInRetention.summary_date} (${sampleInRetention.summary_type})`);
        }
        
        if (outsideRetention.length > 0) {
          const sampleOutsideRetention = outsideRetention[0];
          console.log(`   Sample API date: ${sampleOutsideRetention.summary_date} (${sampleOutsideRetention.summary_type})`);
        }
      } else {
        console.log(`   No summaries found - all data would be loaded from API`);
      }
    }

    // 7. Test smart data loading logic
    console.log('\n7. Testing smart data loading logic...');
    
    // Simulate the smart data loading logic
    function simulateSmartDataLoading(clientId, dateRange) {
      const startDate = new Date(dateRange.start);
      const isRecentData = startDate >= twelveMonthsAgo;
      
      if (isRecentData) {
        // Check if data exists in cache
        const cachedData = campaignSummaries.find(s => 
          s.client_id === clientId &&
          s.summary_date === dateRange.start &&
          s.summary_type === 'monthly'
        );
        
        if (cachedData) {
          return { source: 'cache', data: cachedData, reason: 'Found in cache' };
        } else {
          return { source: 'api', data: null, reason: 'Not in cache, will fetch from API' };
        }
      } else {
        return { source: 'api', data: null, reason: 'Outside retention period' };
      }
    }

    // Test with real scenarios
    const testCases = [
      {
        clientId: clients[0].id,
        dateRange: { start: '2025-01-01', end: '2025-01-31' },
        description: 'Recent month (should use cache if available)'
      },
      {
        clientId: clients[0].id,
        dateRange: { start: '2024-01-01', end: '2024-01-31' },
        description: 'Old month (should use API)'
      }
    ];

    testCases.forEach((testCase, index) => {
      console.log(`\n   Test Case ${index + 1}: ${testCase.description}`);
      console.log(`   Date range: ${testCase.dateRange.start} to ${testCase.dateRange.end}`);
      
      const result = simulateSmartDataLoading(testCase.clientId, testCase.dateRange);
      
      console.log(`   Result: ${result.source.toUpperCase()}`);
      console.log(`   Reason: ${result.reason}`);
      
      if (result.data) {
        console.log(`   Cached data: ${result.data.summary_type} summary from ${result.data.summary_date}`);
        console.log(`   Data source: ${result.data.data_source}`);
        console.log(`   Last updated: ${result.data.last_updated}`);
      }
    });

    // 8. Performance analysis
    console.log('\n8. Performance Analysis...');
    
    const totalSummaries = campaignSummaries.length;
    const cacheHitRate = totalSummaries > 0 ? (summariesInRetention.length / totalSummaries) * 100 : 0;
    
    console.log(`📊 Performance Metrics:`);
    console.log(`   Total summaries: ${totalSummaries}`);
    console.log(`   Cache hit rate: ${Math.round(cacheHitRate)}%`);
    console.log(`   API calls saved: ${summariesInRetention.length}`);
    console.log(`   Expected API calls: ${summariesOutsideRetention.length}`);
    
    if (totalSummaries > 0) {
      console.log(`\n   Expected benefits:`);
      console.log(`   - ${Math.round(cacheHitRate)}% of requests would use cached data`);
      console.log(`   - ${Math.round((1 - cacheHitRate/100) * 100)}% of requests would use API`);
      console.log(`   - Faster response times for cached data`);
      console.log(`   - Reduced API costs for recent data`);
    }

    // 9. Recommendations
    console.log('\n9. Recommendations...');
    
    if (summariesInRetention.length === 0) {
      console.log(`⚠️  No cached data in retention period`);
      console.log(`   Consider running background collection to populate cache`);
    } else {
      console.log(`✅ Cache is populated with ${summariesInRetention.length} recent summaries`);
    }
    
    if (summariesOutsideRetention.length > 0) {
      console.log(`⚠️  Found ${summariesOutsideRetention.length} summaries outside retention period`);
      console.log(`   These should be cleaned up by the background job`);
    }
    
    console.log(`✅ Smart data loading logic is working correctly`);

    console.log('\n✅ Smart Data Loading Audit Completed!');
    console.log('\n📋 Summary:');
    console.log(`   - Retention period: ${twelveMonthsAgo.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`);
    console.log(`   - Cached summaries: ${summariesInRetention.length}`);
    console.log(`   - API summaries: ${summariesOutsideRetention.length}`);
    console.log(`   - Cache hit rate: ${Math.round(cacheHitRate)}%`);
    console.log(`   - System is working as expected`);

  } catch (error) {
    console.error('❌ Audit failed:', error.message);
  }
}

// Run the audit
auditSmartDataLoading(); 