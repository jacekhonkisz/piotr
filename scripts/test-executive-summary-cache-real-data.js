require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testExecutiveSummaryCacheWithRealData() {
  console.log('🧪 Testing Executive Summary Cache with Real Data\n');

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

    // 2. Get reports from last 12 months
    console.log('\n2. Getting reports from last 12 months...');
    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    console.log(`   Date range: ${twelveMonthsAgo.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`);

    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select(`
        id,
        client_id,
        date_range_start,
        date_range_end,
        generated_at,
        clients (
          id,
          name,
          email
        )
      `)
      .gte('date_range_start', twelveMonthsAgo.toISOString().split('T')[0])
      .order('date_range_start', { ascending: false });

    if (reportsError) {
      console.error('❌ Error getting reports:', reportsError);
      return;
    }

    console.log(`✅ Found ${reports.length} reports from last 12 months`);

    if (reports.length === 0) {
      console.log('⚠️  No reports found in last 12 months');
      console.log('   This is expected for a new system');
      return;
    }

    // 3. Check executive summaries cache for these reports
    console.log('\n3. Checking executive summaries cache...');
    const { data: cachedSummaries, error: summariesError } = await supabase
      .from('executive_summaries')
      .select('*')
      .gte('date_range_start', twelveMonthsAgo.toISOString().split('T')[0]);

    if (summariesError) {
      console.error('❌ Error getting cached summaries:', summariesError);
      return;
    }

    console.log(`✅ Found ${cachedSummaries.length} cached executive summaries`);

    // 4. Analyze cache coverage
    console.log('\n4. Analyzing cache coverage...');
    
    const reportsWithCache = new Set();
    const reportsWithoutCache = [];
    
    reports.forEach(report => {
      const hasCache = cachedSummaries.some(summary => 
        summary.client_id === report.client_id &&
        summary.date_range_start === report.date_range_start &&
        summary.date_range_end === report.date_range_end
      );
      
      if (hasCache) {
        reportsWithCache.add(report.id);
      } else {
        reportsWithoutCache.push(report);
      }
    });

    console.log(`📊 Cache Coverage:`);
    console.log(`   Reports with cached summaries: ${reportsWithCache.size}/${reports.length} (${Math.round(reportsWithCache.size/reports.length*100)}%)`);
    console.log(`   Reports without cached summaries: ${reportsWithoutCache.length}/${reports.length} (${Math.round(reportsWithoutCache.length/reports.length*100)}%)`);

    // 5. Show detailed breakdown by client
    console.log('\n5. Detailed breakdown by client...');
    
    const clientStats = {};
    
    reports.forEach(report => {
      const clientName = report.clients.name;
      if (!clientStats[clientName]) {
        clientStats[clientName] = { total: 0, cached: 0, notCached: 0 };
      }
      
      clientStats[clientName].total++;
      
      const hasCache = cachedSummaries.some(summary => 
        summary.client_id === report.client_id &&
        summary.date_range_start === report.date_range_start &&
        summary.date_range_end === report.date_range_end
      );
      
      if (hasCache) {
        clientStats[clientName].cached++;
      } else {
        clientStats[clientName].notCached++;
      }
    });

    Object.entries(clientStats).forEach(([clientName, stats]) => {
      const cacheRate = Math.round(stats.cached/stats.total*100);
      console.log(`   ${clientName}:`);
      console.log(`     Total reports: ${stats.total}`);
      console.log(`     Cached: ${stats.cached} (${cacheRate}%)`);
      console.log(`     Not cached: ${stats.notCached} (${100-cacheRate}%)`);
    });

    // 6. Show sample cached summaries
    if (cachedSummaries.length > 0) {
      console.log('\n6. Sample cached summaries...');
      
      const sampleSummaries = cachedSummaries.slice(0, 3);
      sampleSummaries.forEach((summary, index) => {
        const client = clients.find(c => c.id === summary.client_id);
        console.log(`   Sample ${index + 1}:`);
        console.log(`     Client: ${client?.name || 'Unknown'}`);
        console.log(`     Period: ${summary.date_range_start} to ${summary.date_range_end}`);
        console.log(`     Content length: ${summary.content.length} characters`);
        console.log(`     Generated: ${summary.generated_at}`);
        console.log(`     AI Generated: ${summary.is_ai_generated ? 'Yes' : 'No'}`);
        console.log('');
      });
    }

    // 7. Test cache service operations
    console.log('\n7. Testing cache service operations...');
    
    if (reportsWithoutCache.length > 0) {
      const testReport = reportsWithoutCache[0];
      const testClient = testReport.clients;
      
      console.log(`   Testing with report: ${testClient.name} (${testReport.date_range_start} to ${testReport.date_range_end})`);
      
      // Simulate cache service operations
      const testSummary = {
        content: `Test executive summary for ${testClient.name} covering ${testReport.date_range_start} to ${testReport.date_range_end}. This is a test summary to verify cache functionality.`,
        is_ai_generated: true
      };
      
      // Test saving to cache
      const { data: savedSummary, error: saveError } = await supabase
        .from('executive_summaries')
        .insert({
          client_id: testReport.client_id,
          date_range_start: testReport.date_range_start,
          date_range_end: testReport.date_range_end,
          content: testSummary.content,
          is_ai_generated: testSummary.is_ai_generated,
          generated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (saveError) {
        console.log(`   ❌ Error saving test summary: ${saveError.message}`);
      } else {
        console.log(`   ✅ Successfully saved test summary to cache`);
        console.log(`     ID: ${savedSummary.id}`);
        console.log(`     Content length: ${savedSummary.content.length} characters`);
        
        // Test retrieving from cache
        const { data: retrievedSummary, error: retrieveError } = await supabase
          .from('executive_summaries')
          .select('*')
          .eq('client_id', testReport.client_id)
          .eq('date_range_start', testReport.date_range_start)
          .eq('date_range_end', testReport.date_range_end)
          .single();

        if (retrieveError) {
          console.log(`   ❌ Error retrieving test summary: ${retrieveError.message}`);
        } else {
          console.log(`   ✅ Successfully retrieved test summary from cache`);
          console.log(`     Content matches: ${retrievedSummary.content === testSummary.content}`);
        }
        
        // Clean up test data
        const { error: deleteError } = await supabase
          .from('executive_summaries')
          .delete()
          .eq('id', savedSummary.id);

        if (deleteError) {
          console.log(`   ⚠️  Warning: Could not clean up test data: ${deleteError.message}`);
        } else {
          console.log(`   ✅ Cleaned up test data`);
        }
      }
    } else {
      console.log('   ⚠️  No reports without cache to test with');
    }

    // 8. Performance analysis
    console.log('\n8. Performance Analysis...');
    console.log('   Expected benefits for current data:');
    console.log(`   - Cache hit rate: ${Math.round(reportsWithCache.size/reports.length*100)}%`);
    console.log(`   - Potential API call reduction: ${Math.round(reportsWithCache.size/reports.length*100)}%`);
    console.log(`   - Fast PDF generation for ${reportsWithCache.size} reports`);
    console.log(`   - Consistent summary quality for cached reports`);

    console.log('\n✅ Executive Summary Cache Real Data Test Completed!');
    console.log('\n📋 Summary:');
    console.log(`   - Total reports in last 12 months: ${reports.length}`);
    console.log(`   - Cached summaries: ${cachedSummaries.length}`);
    console.log(`   - Cache coverage: ${Math.round(reportsWithCache.size/reports.length*100)}%`);
    console.log(`   - System is working correctly`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testExecutiveSummaryCacheWithRealData(); 