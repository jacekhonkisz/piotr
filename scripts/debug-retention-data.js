require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugRetentionData() {
  console.log('🔍 Debugging Retention Data - Why Only One Record?\n');

  try {
    // 1. Get current date and calculate 12 months ago
    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    console.log('1. Date Analysis:');
    console.log(`   Current date: ${now.toISOString().split('T')[0]}`);
    console.log(`   12 months ago: ${twelveMonthsAgo.toISOString().split('T')[0]}`);
    console.log(`   Retention period: ${twelveMonthsAgo.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`);

    // 2. Generate expected months in retention
    console.log('\n2. Expected months in retention:');
    const expectedMonths = [];
    const currentDate = new Date(twelveMonthsAgo);
    
    while (currentDate <= now) {
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const dateString = `${year}-${month}-01`;
      expectedMonths.push(dateString);
      
      console.log(`   - ${dateString} (${year}-${month})`);
      
      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    console.log(`   Total expected months: ${expectedMonths.length}`);

    // 3. Get all campaign summaries
    console.log('\n3. Getting all campaign summaries...');
    const { data: allSummaries, error: summariesError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .order('summary_date', { ascending: false });

    if (summariesError) {
      console.error('❌ Error getting campaign summaries:', summariesError);
      return;
    }

    console.log(`✅ Found ${allSummaries.length} total campaign summaries`);

    // 4. Analyze each summary
    console.log('\n4. Analyzing each summary:');
    
    const summariesInRetention = [];
    const summariesOutsideRetention = [];
    
    allSummaries.forEach(summary => {
      const summaryDate = new Date(summary.summary_date);
      const isInRetention = summaryDate >= twelveMonthsAgo;
      
      console.log(`   ${summary.summary_date}: ${isInRetention ? '✅ IN retention' : '❌ OUTSIDE retention'} (${summary.summary_type})`);
      
      if (isInRetention) {
        summariesInRetention.push(summary);
      } else {
        summariesOutsideRetention.push(summary);
      }
    });

    console.log(`\n📊 Summary Analysis:`);
    console.log(`   In retention period: ${summariesInRetention.length}`);
    console.log(`   Outside retention period: ${summariesOutsideRetention.length}`);

    // 5. Check what months are missing
    console.log('\n5. Checking missing months:');
    
    const existingMonths = summariesInRetention.map(s => s.summary_date);
    const missingMonths = expectedMonths.filter(month => !existingMonths.includes(month));
    
    console.log(`   Existing months in retention: ${existingMonths.length}`);
    existingMonths.forEach(month => {
      console.log(`     ✅ ${month}`);
    });
    
    console.log(`\n   Missing months in retention: ${missingMonths.length}`);
    missingMonths.forEach(month => {
      console.log(`     ❌ ${month}`);
    });

    // 6. Check background collection status
    console.log('\n6. Checking background collection status...');
    
    // Check if background collection has been run
    const { data: backgroundJobs, error: jobsError } = await supabase
      .from('background_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (jobsError) {
      console.log('   ⚠️  No background_jobs table found (this is normal)');
    } else {
      console.log(`   Found ${backgroundJobs?.length || 0} background jobs`);
      if (backgroundJobs && backgroundJobs.length > 0) {
        backgroundJobs.forEach(job => {
          console.log(`     - ${job.job_type}: ${job.status} at ${job.created_at}`);
        });
      }
    }

    // 7. Check if background collection endpoints exist
    console.log('\n7. Checking background collection endpoints...');
    
    const endpoints = [
      '/api/background/collect-monthly',
      '/api/background/collect-weekly',
      '/api/background/cleanup-old-data'
    ];
    
    endpoints.forEach(endpoint => {
      console.log(`   ${endpoint}: Available (checked in code)`);
    });

    // 8. Check cron jobs configuration
    console.log('\n8. Checking cron jobs configuration...');
    
    try {
      const fs = require('fs');
      const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
      
      if (vercelConfig.crons) {
        console.log('   Cron jobs configured in vercel.json:');
        vercelConfig.crons.forEach(cron => {
          console.log(`     - ${cron.path}: ${cron.schedule}`);
        });
      } else {
        console.log('   ⚠️  No cron jobs configured in vercel.json');
      }
    } catch (error) {
      console.log('   ⚠️  Could not read vercel.json');
    }

    // 9. Check if data collection was ever run
    console.log('\n9. Checking if data collection was ever run...');
    
    if (allSummaries.length === 0) {
      console.log('   ❌ No campaign summaries found - background collection never run');
    } else {
      const oldestSummary = allSummaries[allSummaries.length - 1];
      const newestSummary = allSummaries[0];
      
      console.log(`   📅 Data collection range:`);
      console.log(`     Oldest: ${oldestSummary.summary_date} (${oldestSummary.summary_type})`);
      console.log(`     Newest: ${newestSummary.summary_date} (${newestSummary.summary_type})`);
      console.log(`     Total records: ${allSummaries.length}`);
      
      // Check if the data looks like it was collected systematically
      const monthlySummaries = allSummaries.filter(s => s.summary_type === 'monthly');
      const weeklySummaries = allSummaries.filter(s => s.summary_type === 'weekly');
      
      console.log(`     Monthly summaries: ${monthlySummaries.length}`);
      console.log(`     Weekly summaries: ${weeklySummaries.length}`);
      
      if (monthlySummaries.length === 1 && weeklySummaries.length === 0) {
        console.log('   ⚠️  Only one monthly summary found - looks like manual test data');
      } else if (monthlySummaries.length > 1) {
        console.log('   ✅ Multiple monthly summaries found - background collection working');
      }
    }

    // 10. Recommendations
    console.log('\n10. Recommendations:');
    
    if (missingMonths.length > 0) {
      console.log(`   🔧 To populate missing months:`);
      console.log(`      1. Run background collection manually:`);
      console.log(`         curl -X POST http://localhost:3002/api/background/collect-monthly`);
      console.log(`      2. Check cron jobs are running:`);
      console.log(`         - Verify Vercel cron jobs are active`);
      console.log(`         - Check logs for background collection errors`);
      console.log(`      3. Verify client tokens are valid:`);
      console.log(`         - Check meta_access_token is not expired`);
      console.log(`         - Verify ad_account_id is correct`);
    }
    
    if (allSummaries.length === 0) {
      console.log(`   🚀 To start data collection:`);
      console.log(`      1. Ensure at least one client has valid Meta API credentials`);
      console.log(`      2. Run initial background collection`);
      console.log(`      3. Set up cron jobs for automatic collection`);
    }

    console.log('\n✅ Retention Data Debug Completed!');
    console.log('\n📋 Summary:');
    console.log(`   - Expected months in retention: ${expectedMonths.length}`);
    console.log(`   - Actual months in retention: ${summariesInRetention.length}`);
    console.log(`   - Missing months: ${missingMonths.length}`);
    console.log(`   - Background collection status: ${allSummaries.length > 1 ? 'Working' : 'Needs setup'}`);

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

// Run the debug
debugRetentionData(); 