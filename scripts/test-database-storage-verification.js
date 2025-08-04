require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testDatabaseStorage() {
  console.log('🔍 Testing database storage verification...\n');

  try {
    // Get all clients
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('api_status', 'valid');

    if (clientError || !clients || clients.length === 0) {
      console.error('❌ No valid clients found');
      return;
    }

    console.log(`📊 Found ${clients.length} valid clients`);

    // Test each client
    for (const client of clients) {
      console.log(`\n🔍 Testing client: ${client.name} (${client.id})`);
      
      // Check campaign_summaries table
      const { data: summaries, error: summariesError } = await supabase
        .from('campaign_summaries')
        .select('*')
        .eq('client_id', client.id)
        .order('summary_date', { ascending: false });

      if (summariesError) {
        console.error(`❌ Error fetching summaries for ${client.name}:`, summariesError);
        continue;
      }

      console.log(`📦 Found ${summaries.length} stored summaries`);

      if (summaries.length > 0) {
        // Group by type
        const monthly = summaries.filter(s => s.summary_type === 'monthly');
        const weekly = summaries.filter(s => s.summary_type === 'weekly');

        console.log(`  📅 Monthly summaries: ${monthly.length}`);
        console.log(`  📅 Weekly summaries: ${weekly.length}`);

        // Show recent data
        if (monthly.length > 0) {
          console.log(`  📊 Recent monthly data:`);
          monthly.slice(0, 3).forEach(summary => {
            console.log(`    - ${summary.summary_date}: $${summary.total_spend} (${summary.last_updated})`);
          });
        }

        if (weekly.length > 0) {
          console.log(`  📊 Recent weekly data:`);
          weekly.slice(0, 3).forEach(summary => {
            console.log(`    - ${summary.summary_date}: $${summary.total_spend} (${summary.last_updated})`);
          });
        }

        // Check data age
        const now = new Date();
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        const recentData = summaries.filter(s => new Date(s.summary_date) >= twelveMonthsAgo);
        const oldData = summaries.filter(s => new Date(s.summary_date) < twelveMonthsAgo);

        console.log(`  ⏰ Data age analysis:`);
        console.log(`    - Recent data (last 12 months): ${recentData.length} summaries`);
        console.log(`    - Old data (older than 12 months): ${oldData.length} summaries`);

        // Check if we have the expected amount of data
        const expectedMonthly = 12; // Last 12 months
        const expectedWeekly = 52; // Last 52 weeks

        console.log(`  📊 Data completeness:`);
        console.log(`    - Monthly: ${monthly.length}/${expectedMonthly} (${Math.round(monthly.length/expectedMonthly*100)}%)`);
        console.log(`    - Weekly: ${weekly.length}/${expectedWeekly} (${Math.round(weekly.length/expectedWeekly*100)}%)`);

        if (monthly.length < expectedMonthly * 0.8 || weekly.length < expectedWeekly * 0.8) {
          console.log(`  ⚠️  WARNING: Incomplete data storage detected`);
          console.log(`     - Consider running background collection`);
        } else {
          console.log(`  ✅ Data storage looks complete`);
        }

      } else {
        console.log(`  ⚠️  No stored data found for this client`);
        console.log(`     - This client may need background collection to be run`);
      }
    }

    // Test API endpoints
    console.log('\n🔍 Testing API endpoints...');
    
    // Test smart-fetch-data endpoint
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/test_smart_data_loading`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY
        },
        body: JSON.stringify({
          p_client_id: clients[0].id,
          p_summary_type: 'monthly',
          p_summary_date: '2024-01-01'
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Smart data loading function works`);
        console.log(`   - Found ${data.length} records for test query`);
      } else {
        console.log(`❌ Smart data loading function failed: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Error testing smart data loading: ${error.message}`);
    }

    // Summary
    console.log('\n📋 Storage Verification Summary:');
    
    let totalSummaries = 0;
    for (const client of clients) {
      const { data: clientSummaries } = await supabase
        .from('campaign_summaries')
        .select('*')
        .eq('client_id', client.id);
      totalSummaries += clientSummaries ? clientSummaries.length : 0;
    }

    console.log(`✅ Total stored summaries across all clients: ${totalSummaries}`);
    console.log(`✅ Average summaries per client: ${Math.round(totalSummaries / clients.length)}`);
    
    if (totalSummaries > 0) {
      console.log(`✅ Database storage is working`);
    } else {
      console.log(`⚠️  No data found in storage - background collection may be needed`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testDatabaseStorage().then(() => {
  console.log('\n🏁 Database storage verification completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
}); 