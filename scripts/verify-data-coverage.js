#!/usr/bin/env node

/**
 * Verify Data Coverage Script
 * 
 * This script verifies that all clients have proper data coverage
 * for both monthly and weekly periods.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyDataCoverage() {
  console.log('🔍 VERIFYING DATA COVERAGE FOR ALL CLIENTS\n');
  
  try {
    // 1. Get all clients
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, name, email')
      .neq('api_status', 'invalid');
    
    if (clientError || !clients || clients.length === 0) {
      console.error('❌ No clients found:', clientError);
      return;
    }
    
    console.log(`👥 Found ${clients.length} clients to verify\n`);
    
    // 2. Check data coverage for each client
    const coverageReport = [];
    
    for (const client of clients) {
      console.log(`📊 Checking coverage for: ${client.name}`);
      
      // Get monthly data count
      const { data: monthlyData, error: monthlyError } = await supabase
        .from('campaign_summaries')
        .select('summary_date, total_spend, total_conversions')
        .eq('client_id', client.id)
        .eq('summary_type', 'monthly')
        .order('summary_date', { ascending: false });
      
      // Get weekly data count
      const { data: weeklyData, error: weeklyError } = await supabase
        .from('campaign_summaries')
        .select('summary_date, total_spend, total_conversions')
        .eq('client_id', client.id)
        .eq('summary_type', 'weekly')
        .order('summary_date', { ascending: false });
      
      if (monthlyError || weeklyError) {
        console.error(`   ❌ Error fetching data: ${monthlyError?.message || weeklyError?.message}`);
        continue;
      }
      
      const monthlyCount = monthlyData?.length || 0;
      const weeklyCount = weeklyData?.length || 0;
      
      // Get date ranges
      const latestMonthly = monthlyData?.[0]?.summary_date || 'None';
      const oldestMonthly = monthlyData?.[monthlyCount - 1]?.summary_date || 'None';
      const latestWeekly = weeklyData?.[0]?.summary_date || 'None';
      const oldestWeekly = weeklyData?.[weeklyCount - 1]?.summary_date || 'None';
      
      // Check if current month (September 2025) exists
      const hasCurrentMonth = monthlyData?.some(d => d.summary_date === '2025-09-01') || false;
      
      const clientCoverage = {
        client: client.name,
        monthlyCount,
        weeklyCount,
        latestMonthly,
        oldestMonthly,
        latestWeekly,
        oldestWeekly,
        hasCurrentMonth,
        totalRecords: monthlyCount + weeklyCount
      };
      
      coverageReport.push(clientCoverage);
      
      console.log(`   📅 Monthly: ${monthlyCount} records (${oldestMonthly} → ${latestMonthly})`);
      console.log(`   📅 Weekly: ${weeklyCount} records (${oldestWeekly} → ${latestWeekly})`);
      console.log(`   🗓️  Current month (Sep 2025): ${hasCurrentMonth ? '✅ Yes' : '❌ No'}`);
      console.log(`   📊 Total records: ${monthlyCount + weeklyCount}\n`);
    }
    
    // 3. Summary report
    console.log('📋 COVERAGE SUMMARY REPORT\n');
    
    const totalClients = coverageReport.length;
    const clientsWithCurrentMonth = coverageReport.filter(c => c.hasCurrentMonth).length;
    const avgMonthlyRecords = Math.round(coverageReport.reduce((sum, c) => sum + c.monthlyCount, 0) / totalClients);
    const avgWeeklyRecords = Math.round(coverageReport.reduce((sum, c) => sum + c.weeklyCount, 0) / totalClients);
    const totalRecords = coverageReport.reduce((sum, c) => sum + c.totalRecords, 0);
    
    console.log(`👥 Total clients: ${totalClients}`);
    console.log(`✅ Clients with current month data: ${clientsWithCurrentMonth}/${totalClients}`);
    console.log(`📅 Average monthly records per client: ${avgMonthlyRecords}`);
    console.log(`📅 Average weekly records per client: ${avgWeeklyRecords}`);
    console.log(`📊 Total records in database: ${totalRecords}`);
    
    // 4. Check for any issues
    console.log('\n🔍 ISSUE DETECTION\n');
    
    const clientsWithoutCurrentMonth = coverageReport.filter(c => !c.hasCurrentMonth);
    const clientsWithLowData = coverageReport.filter(c => c.totalRecords < 10);
    
    if (clientsWithoutCurrentMonth.length > 0) {
      console.log(`⚠️  Clients missing current month data (${clientsWithoutCurrentMonth.length}):`);
      clientsWithoutCurrentMonth.forEach(c => {
        console.log(`   - ${c.client}`);
      });
    } else {
      console.log('✅ All clients have current month data');
    }
    
    if (clientsWithLowData.length > 0) {
      console.log(`\n⚠️  Clients with low data coverage (${clientsWithLowData.length}):`);
      clientsWithLowData.forEach(c => {
        console.log(`   - ${c.client}: ${c.totalRecords} records`);
      });
    } else {
      console.log('\n✅ All clients have adequate data coverage');
    }
    
    // 5. Date range analysis
    console.log('\n📅 DATE RANGE ANALYSIS\n');
    
    const allMonthlyDates = coverageReport.flatMap(c => [c.latestMonthly, c.oldestMonthly]).filter(d => d !== 'None');
    const allWeeklyDates = coverageReport.flatMap(c => [c.latestWeekly, c.oldestWeekly]).filter(d => d !== 'None');
    
    if (allMonthlyDates.length > 0) {
      const latestMonth = allMonthlyDates.sort().reverse()[0];
      const oldestMonth = allMonthlyDates.sort()[0];
      console.log(`📅 Monthly data range: ${oldestMonth} → ${latestMonth}`);
    }
    
    if (allWeeklyDates.length > 0) {
      const latestWeek = allWeeklyDates.sort().reverse()[0];
      const oldestWeek = allWeeklyDates.sort()[0];
      console.log(`📅 Weekly data range: ${oldestWeek} → ${latestWeek}`);
    }
    
    // 6. Sample recent data
    console.log('\n📊 SAMPLE RECENT DATA\n');
    
    const { data: recentSample } = await supabase
      .from('campaign_summaries')
      .select('summary_date, summary_type, total_spend, total_conversions')
      .order('summary_date', { ascending: false })
      .limit(10);
    
    if (recentSample && recentSample.length > 0) {
      console.log('Most recent records:');
      recentSample.forEach(record => {
        console.log(`   ${record.summary_date} | ${record.summary_type} | ${record.total_spend} PLN | ${record.total_conversions} conv`);
      });
    }
    
    console.log('\n🎉 DATA COVERAGE VERIFICATION COMPLETED!');
    
    if (clientsWithoutCurrentMonth.length === 0 && clientsWithLowData.length === 0) {
      console.log('\n✅ ALL SYSTEMS GO! Data coverage is complete and proper.');
      console.log('📝 The reports page should now:');
      console.log('   - Show September 2025 as the current month');
      console.log('   - Load historical data from database (fast)');
      console.log('   - Only make API calls for current period data');
    } else {
      console.log('\n⚠️  Some issues detected. Please review the report above.');
    }
    
  } catch (error) {
    console.error('❌ Error during verification:', error);
  }
}

// Run the script
if (require.main === module) {
  verifyDataCoverage()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { verifyDataCoverage };
