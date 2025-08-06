require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runBackgroundCollection() {
  console.log('🚀 Running Background Collection\n');

  try {
    // 1. Get all valid clients
    console.log('1. Getting valid clients...');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .eq('api_status', 'valid');

    if (clientsError || !clients || clients.length === 0) {
      console.error('❌ No valid clients found');
      return;
    }

    console.log(`✅ Found ${clients.length} valid clients`);

    // 2. Import and use BackgroundDataCollector
    console.log('\n2. Importing BackgroundDataCollector...');
    
    // Note: We'll simulate the background collection logic here
    // since we can't directly import the TypeScript class
    
    // 3. Calculate date range for last 12 months
    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    console.log(`📅 Collecting data for period: ${twelveMonthsAgo.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`);

    // 4. For each client, collect monthly data
    for (const client of clients) {
      console.log(`\n📊 Processing client: ${client.name} (${client.id})`);
      
      // Check if client has valid Meta API credentials
      if (!client.meta_access_token || !client.ad_account_id) {
        console.log(`   ⚠️  Skipping client - missing Meta API credentials`);
        continue;
      }

      // Generate monthly dates for the last 12 months
      const monthlyDates = [];
      const currentDate = new Date(twelveMonthsAgo);
      
      while (currentDate <= now) {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const dateString = `${year}-${month}-01`;
        monthlyDates.push(dateString);
        
        // Move to next month
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      console.log(`   📅 Will collect ${monthlyDates.length} monthly summaries`);

      // 5. Check existing summaries for this client
      const { data: existingSummaries, error: summariesError } = await supabase
        .from('campaign_summaries')
        .select('summary_date, summary_type')
        .eq('client_id', client.id)
        .eq('summary_type', 'monthly');

      if (summariesError) {
        console.error(`   ❌ Error getting existing summaries:`, summariesError);
        continue;
      }

      const existingDates = existingSummaries.map(s => s.summary_date);
      console.log(`   📊 Existing monthly summaries: ${existingDates.length}`);

      // 6. Find missing months
      const missingMonths = monthlyDates.filter(date => !existingDates.includes(date));
      console.log(`   🔍 Missing months: ${missingMonths.length}`);

      if (missingMonths.length === 0) {
        console.log(`   ✅ All months already collected`);
        continue;
      }

      // 7. Show what will be collected
      console.log(`   📋 Will collect missing months:`);
      missingMonths.forEach(month => {
        console.log(`     - ${month}`);
      });

      // 8. Simulate collection (in real implementation, this would call Meta API)
      console.log(`   ⚠️  Note: This is a simulation - real implementation would call Meta API`);
      console.log(`   ⚠️  To actually collect data, you would need to:`);
      console.log(`       1. Call Meta API for each missing month`);
      console.log(`       2. Process the campaign data`);
      console.log(`       3. Store in campaign_summaries table`);
      
      // For demonstration, let's create a sample summary for one missing month
      if (missingMonths.length > 0) {
        const sampleMonth = missingMonths[0];
        console.log(`   🧪 Creating sample summary for ${sampleMonth}...`);
        
        const sampleSummary = {
          client_id: client.id,
          summary_type: 'monthly',
          summary_date: sampleMonth,
          total_spend: 1000.00,
          total_impressions: 50000,
          total_clicks: 500,
          total_conversions: 25,
          average_ctr: 1.0,
          average_cpc: 2.0,
          average_cpa: 40.0,
          active_campaigns: 5,
          total_campaigns: 5,
          campaign_data: [],
          data_source: 'simulated',
          last_updated: new Date().toISOString()
        };

        const { data: insertedSummary, error: insertError } = await supabase
          .from('campaign_summaries')
          .insert(sampleSummary)
          .select()
          .single();

        if (insertError) {
          console.error(`   ❌ Error inserting sample summary:`, insertError);
        } else {
          console.log(`   ✅ Sample summary created for ${sampleMonth}`);
        }
      }
    }

    // 9. Show final status
    console.log('\n📊 Final Status:');
    
    const { data: finalSummaries, error: finalError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .order('summary_date', { ascending: false });

    if (!finalError && finalSummaries) {
      console.log(`   Total campaign summaries: ${finalSummaries.length}`);
      
      const inRetention = finalSummaries.filter(s => {
        const summaryDate = new Date(s.summary_date);
        return summaryDate >= twelveMonthsAgo;
      });
      
             console.log(`   Summaries in retention period: ${inRetention.length}`);
       console.log(`   Expected in retention: 13`);
      
      if (inRetention.length > 0) {
        console.log(`   Sample summaries in retention:`);
        inRetention.slice(0, 3).forEach(summary => {
          console.log(`     - ${summary.summary_date} (${summary.summary_type}) - ${summary.data_source}`);
        });
      }
    }

    console.log('\n✅ Background Collection Simulation Completed!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Implement real Meta API calls in BackgroundDataCollector');
    console.log('   2. Set up proper cron jobs in production');
    console.log('   3. Monitor collection success/failure rates');
    console.log('   4. Verify data quality and completeness');

  } catch (error) {
    console.error('❌ Background collection failed:', error.message);
  }
}

// Run the background collection
runBackgroundCollection(); 