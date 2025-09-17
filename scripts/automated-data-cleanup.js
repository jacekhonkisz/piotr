#!/usr/bin/env node

/**
 * Automated Data Cleanup Script
 * 
 * This script should be run regularly (daily/weekly) to:
 * - Maintain exactly 13 months and 53 weeks for all clients
 * - Automatically remove older periods
 * - Add new current periods as time progresses
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Get current required periods (rolling window)
 */
function getCurrentRequiredPeriods() {
  const currentDate = new Date();
  const periods = {
    months: [],
    weeks: []
  };
  
  // Generate exactly 13 months backwards (rolling)
  for (let i = 0; i < 13; i++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const summaryDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    periods.months.push(summaryDate);
  }
  
  // Generate exactly 53 weeks backwards (rolling)
  const today = new Date(currentDate);
  const currentWeekStart = new Date(today);
  currentWeekStart.setDate(today.getDate() - today.getDay() + 1); // Get Monday of current week
  
  for (let i = 0; i < 53; i++) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(currentWeekStart.getDate() - (i * 7));
    const summaryDate = weekStart.toISOString().split('T')[0];
    periods.weeks.push(summaryDate);
  }
  
  return periods;
}

/**
 * Remove data that's NOT in the required periods (keep only what we need)
 */
async function removeOldData(requiredPeriods) {
  console.log('🧹 REMOVING DATA OUTSIDE REQUIRED PERIODS...\n');
  
  console.log(`📅 Keeping ONLY these ${requiredPeriods.months.length} months: ${requiredPeriods.months[0]} → ${requiredPeriods.months[requiredPeriods.months.length - 1]}`);
  console.log(`📅 Keeping ONLY these ${requiredPeriods.weeks.length} weeks: ${requiredPeriods.weeks[0]} → ${requiredPeriods.weeks[requiredPeriods.weeks.length - 1]}`);
  
  // Count data outside required periods
  const { data: unwantedMonthlyCount } = await supabase
    .from('campaign_summaries')
    .select('id', { count: 'exact' })
    .eq('summary_type', 'monthly')
    .not('summary_date', 'in', `(${requiredPeriods.months.map(m => `"${m}"`).join(',')})`);
  
  const { data: unwantedWeeklyCount } = await supabase
    .from('campaign_summaries')
    .select('id', { count: 'exact' })
    .eq('summary_type', 'weekly')
    .not('summary_date', 'in', `(${requiredPeriods.weeks.map(w => `"${w}"`).join(',')})`);
  
  console.log(`📊 Found ${unwantedMonthlyCount?.length || 0} unwanted monthly records to remove`);
  console.log(`📊 Found ${unwantedWeeklyCount?.length || 0} unwanted weekly records to remove`);
  
  // Delete unwanted monthly data (anything not in required periods)
  if (unwantedMonthlyCount && unwantedMonthlyCount.length > 0) {
    const { error: monthlyError } = await supabase
      .from('campaign_summaries')
      .delete()
      .eq('summary_type', 'monthly')
      .not('summary_date', 'in', `(${requiredPeriods.months.map(m => `"${m}"`).join(',')})`);
    
    if (monthlyError) {
      console.log(`❌ Error deleting unwanted monthly data: ${monthlyError.message}`);
    } else {
      console.log(`✅ Removed ${unwantedMonthlyCount.length} unwanted monthly records`);
    }
  }
  
  // Delete unwanted weekly data (anything not in required periods)
  if (unwantedWeeklyCount && unwantedWeeklyCount.length > 0) {
    const { error: weeklyError } = await supabase
      .from('campaign_summaries')
      .delete()
      .eq('summary_type', 'weekly')
      .not('summary_date', 'in', `(${requiredPeriods.weeks.map(w => `"${w}"`).join(',')})`);
    
    if (weeklyError) {
      console.log(`❌ Error deleting unwanted weekly data: ${weeklyError.message}`);
    } else {
      console.log(`✅ Removed ${unwantedWeeklyCount.length} unwanted weekly records`);
    }
  }
  
  if ((unwantedMonthlyCount?.length || 0) === 0 && (unwantedWeeklyCount?.length || 0) === 0) {
    console.log('✅ No unwanted data to remove - system is already clean');
  }
}

/**
 * Check and report current coverage status
 */
async function checkCoverageStatus(requiredPeriods) {
  console.log('\n📊 CHECKING CURRENT COVERAGE STATUS...\n');
  
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .neq('api_status', 'invalid');
  
  if (!clients) return { allComplete: false, summary: {} };
  
  let allComplete = true;
  const summary = {
    totalClients: clients.length,
    completeClients: 0,
    monthlyGaps: 0,
    weeklyGaps: 0
  };
  
  for (const client of clients) {
    // Check monthly coverage
    const { data: monthlyData } = await supabase
      .from('campaign_summaries')
      .select('summary_date')
      .eq('client_id', client.id)
      .eq('summary_type', 'monthly')
      .in('summary_date', requiredPeriods.months);
    
    // Check weekly coverage
    const { data: weeklyData } = await supabase
      .from('campaign_summaries')
      .select('summary_date')
      .eq('client_id', client.id)
      .eq('summary_type', 'weekly')
      .in('summary_date', requiredPeriods.weeks);
    
    const monthlyCount = monthlyData?.length || 0;
    const weeklyCount = weeklyData?.length || 0;
    const isComplete = monthlyCount === 13 && weeklyCount === 53;
    
    if (isComplete) {
      summary.completeClients++;
    } else {
      allComplete = false;
      summary.monthlyGaps += (13 - monthlyCount);
      summary.weeklyGaps += (53 - weeklyCount);
    }
    
    if (!isComplete) {
      console.log(`⚠️ ${client.name}: ${monthlyCount}/13 months, ${weeklyCount}/53 weeks`);
    }
  }
  
  if (allComplete) {
    console.log('✅ All clients have complete coverage (13 months + 53 weeks)');
  } else {
    console.log(`⚠️ ${summary.completeClients}/${summary.totalClients} clients have complete coverage`);
    console.log(`📊 Total gaps: ${summary.monthlyGaps} monthly, ${summary.weeklyGaps} weekly`);
  }
  
  return { allComplete, summary };
}

/**
 * Get total record counts
 */
async function getTotalRecordCounts() {
  const { data: monthlyCount } = await supabase
    .from('campaign_summaries')
    .select('id', { count: 'exact' })
    .eq('summary_type', 'monthly');
  
  const { data: weeklyCount } = await supabase
    .from('campaign_summaries')
    .select('id', { count: 'exact' })
    .eq('summary_type', 'weekly');
  
  return {
    monthly: monthlyCount?.length || 0,
    weekly: weeklyCount?.length || 0,
    total: (monthlyCount?.length || 0) + (weeklyCount?.length || 0)
  };
}

/**
 * Main automated cleanup function
 */
async function automatedDataCleanup() {
  console.log('🤖 AUTOMATED DATA CLEANUP\n');
  console.log('Maintaining exactly 13 months and 53 weeks for all clients');
  console.log('Running automated cleanup and maintenance...\n');
  console.log('=' .repeat(60));
  
  try {
    const startTime = Date.now();
    
    // 1. Get current required periods (rolling window)
    const requiredPeriods = getCurrentRequiredPeriods();
    
    console.log('📅 CURRENT REQUIRED PERIODS:');
    console.log(`   Months: ${requiredPeriods.months[0]} → ${requiredPeriods.months[requiredPeriods.months.length - 1]}`);
    console.log(`   Weeks: ${requiredPeriods.weeks[0]} → ${requiredPeriods.weeks[requiredPeriods.weeks.length - 1]}\n`);
    
    // 2. Get initial record counts
    const initialCounts = await getTotalRecordCounts();
    console.log('📊 INITIAL STATE:');
    console.log(`   Monthly records: ${initialCounts.monthly}`);
    console.log(`   Weekly records: ${initialCounts.weekly}`);
    console.log(`   Total records: ${initialCounts.total}\n`);
    
    // 3. Remove old data beyond required periods
    await removeOldData(requiredPeriods);
    
    // 4. Check coverage status
    const { allComplete, summary } = await checkCoverageStatus(requiredPeriods);
    
    // 5. Get final record counts
    const finalCounts = await getTotalRecordCounts();
    
    const executionTime = Date.now() - startTime;
    
    console.log('\n🎯 CLEANUP COMPLETED!');
    console.log('=' .repeat(40));
    
    console.log('\n📊 FINAL STATE:');
    console.log(`   Monthly records: ${finalCounts.monthly} (${finalCounts.monthly - initialCounts.monthly >= 0 ? '+' : ''}${finalCounts.monthly - initialCounts.monthly})`);
    console.log(`   Weekly records: ${finalCounts.weekly} (${finalCounts.weekly - initialCounts.weekly >= 0 ? '+' : ''}${finalCounts.weekly - initialCounts.weekly})`);
    console.log(`   Total records: ${finalCounts.total} (${finalCounts.total - initialCounts.total >= 0 ? '+' : ''}${finalCounts.total - initialCounts.total})`);
    
    console.log('\n📈 COVERAGE STATUS:');
    if (allComplete) {
      console.log('✅ All clients have complete coverage');
      console.log('✅ System is optimally maintained');
    } else {
      console.log(`⚠️ ${summary.completeClients}/${summary.totalClients} clients complete`);
      console.log('💡 Consider running the standardization script if gaps persist');
    }
    
    console.log(`\n⏱️ Execution time: ${executionTime}ms`);
    
    // 6. Recommendations
    console.log('\n📝 MAINTENANCE RECOMMENDATIONS:');
    
    if (allComplete) {
      console.log('✅ System is healthy - continue regular cleanup');
      console.log('📅 Schedule this script to run daily/weekly');
      console.log('🔄 Data will automatically roll forward as time progresses');
    } else {
      console.log('⚠️ Some clients have incomplete coverage');
      console.log('💡 Run: node scripts/standardize-all-clients-coverage.js');
      console.log('📊 This will fill any missing data gaps');
    }
    
    // Expected record counts
    const expectedMonthly = 13 * summary.totalClients;
    const expectedWeekly = 53 * summary.totalClients;
    const expectedTotal = expectedMonthly + expectedWeekly;
    
    console.log('\n📊 EXPECTED VS ACTUAL:');
    console.log(`   Expected: ${expectedMonthly} monthly + ${expectedWeekly} weekly = ${expectedTotal} total`);
    console.log(`   Actual: ${finalCounts.monthly} monthly + ${finalCounts.weekly} weekly = ${finalCounts.total} total`);
    console.log(`   Efficiency: ${Math.round((finalCounts.total / expectedTotal) * 100)}%`);
    
    return {
      success: true,
      allComplete,
      recordsRemoved: initialCounts.total - finalCounts.total,
      finalCounts,
      executionTime
    };
    
  } catch (error) {
    console.error('❌ Automated cleanup failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the script
if (require.main === module) {
  automatedDataCleanup()
    .then((result) => {
      if (result.success) {
        console.log('\n🎉 Automated cleanup completed successfully!');
        process.exit(0);
      } else {
        console.error('\n❌ Automated cleanup failed!');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { automatedDataCleanup };
