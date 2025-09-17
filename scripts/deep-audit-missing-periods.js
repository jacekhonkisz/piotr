#!/usr/bin/env node

/**
 * Deep Audit: Missing Periods Analysis
 * 
 * This script investigates why all clients show missing weekly and monthly periods
 * and why no clients have 100% complete data
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper function to get week boundaries
function getWeekBoundaries(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(d.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0]
  };
}

// Generate expected weeks based on ACTUAL data range
function generateExpectedWeeksFromActualData(earliestDate, latestDate) {
  const weeks = [];
  const start = new Date(earliestDate);
  const end = new Date(latestDate);
  
  // Start from the earliest date and go week by week
  let currentDate = new Date(start);
  
  while (currentDate <= end) {
    const weekRange = getWeekBoundaries(currentDate);
    const weekEnd = new Date(weekRange.end);
    
    // Only include weeks that are completely within our date range
    if (weekEnd <= end) {
      weeks.push({
        startDate: weekRange.start,
        endDate: weekRange.end,
        year: weekEnd.getFullYear(),
        month: weekEnd.getMonth() + 1,
        weekNumber: Math.ceil((weekEnd.getTime() - new Date(weekEnd.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))
      });
    }
    
    // Move to next week
    currentDate.setDate(currentDate.getDate() + 7);
  }
  
  return weeks;
}

// Generate expected months based on ACTUAL data range
function generateExpectedMonthsFromActualData(earliestDate, latestDate) {
  const months = [];
  const start = new Date(earliestDate);
  const end = new Date(latestDate);
  
  // Start from the earliest month and go month by month
  let currentDate = new Date(start.getFullYear(), start.getMonth(), 1);
  
  while (currentDate <= end) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    
    months.push({
      year,
      month,
      startDate: monthStart.toISOString().split('T')[0],
      endDate: monthEnd.toISOString().split('T')[0]
    });
    
    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  
  return months;
}

async function deepAuditMissingPeriods() {
  console.log('🔍 DEEP AUDIT: Missing Periods Analysis\n');
  
  try {
    // First, determine the actual date range of data in the database
    const { data: allData } = await supabase
      .from('campaign_summaries')
      .select('summary_date, summary_type')
      .order('summary_date', { ascending: true });
    
    if (!allData || allData.length === 0) {
      console.log('❌ No data found in campaign_summaries table');
      return;
    }
    
    const allDates = allData.map(d => d.summary_date).sort();
    const earliestDate = allDates[0];
    const latestDate = allDates[allDates.length - 1];
    
    console.log(`📅 Actual Data Range in Database:`);
    console.log(`   Earliest: ${earliestDate}`);
    console.log(`   Latest: ${latestDate}`);
    console.log(`   Total Records: ${allData.length}\n`);
    
    // Generate expected periods based on ACTUAL data range
    const expectedWeeks = generateExpectedWeeksFromActualData(earliestDate, latestDate);
    const expectedMonths = generateExpectedMonthsFromActualData(earliestDate, latestDate);
    
    console.log(`📅 Expected Periods Based on Actual Data Range:`);
    console.log(`   Weekly: ${expectedWeeks.length} weeks`);
    console.log(`   Monthly: ${expectedMonths.length} months\n`);
    
    // Get all active clients
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, email, api_status, meta_access_token, ad_account_id, google_ads_customer_id')
      .eq('api_status', 'valid');
    
    if (!clients || clients.length === 0) {
      console.log('❌ No active clients found');
      return;
    }
    
    console.log(`📊 Analyzing ${clients.length} active clients\n`);
    
    const auditResults = {
      clients: [],
      summary: {
        totalClients: clients.length,
        clientsWithCompleteWeeklyData: 0,
        clientsWithCompleteMonthlyData: 0,
        totalExpectedWeeks: expectedWeeks.length,
        totalExpectedMonths: expectedMonths.length,
        totalActualWeeks: 0,
        totalActualMonths: 0
      }
    };
    
    // Analyze each client
    for (const client of clients) {
      console.log(`🔍 Analyzing client: ${client.name}`);
      
      const clientResult = {
        id: client.id,
        name: client.name,
        email: client.email,
        platforms: {
          meta: !!(client.meta_access_token && client.ad_account_id),
          google: !!client.google_ads_customer_id
        },
        weeklyData: {
          expected: expectedWeeks.length,
          actual: 0,
          missing: [],
          present: [],
          coverage: 0
        },
        monthlyData: {
          expected: expectedMonths.length,
          actual: 0,
          missing: [],
          present: [],
          coverage: 0
        }
      };
      
      // Check weekly data
      const { data: weeklyData } = await supabase
        .from('campaign_summaries')
        .select('summary_date, platform')
        .eq('client_id', client.id)
        .eq('summary_type', 'weekly')
        .order('summary_date', { ascending: true });
      
      if (weeklyData && weeklyData.length > 0) {
        // Count unique dates (not total records)
        const uniqueWeeklyDates = [...new Set(weeklyData.map(w => w.summary_date))];
        clientResult.weeklyData.actual = uniqueWeeklyDates.length;
        auditResults.summary.totalActualWeeks += uniqueWeeklyDates.length;
        
        // Check for missing weeks
        const actualWeekDates = new Set(uniqueWeeklyDates);
        for (const expectedWeek of expectedWeeks) {
          if (actualWeekDates.has(expectedWeek.startDate)) {
            clientResult.weeklyData.present.push(expectedWeek);
          } else {
            clientResult.weeklyData.missing.push(expectedWeek);
          }
        }
        
        clientResult.weeklyData.coverage = (clientResult.weeklyData.actual / clientResult.weeklyData.expected) * 100;
        
        console.log(`   📊 Weekly: ${clientResult.weeklyData.actual}/${clientResult.weeklyData.expected} (${clientResult.weeklyData.coverage.toFixed(1)}%)`);
        console.log(`   📊   Missing: ${clientResult.weeklyData.missing.length} weeks`);
        
        if (clientResult.weeklyData.missing.length > 0) {
          console.log(`   📊   Sample missing weeks:`);
          clientResult.weeklyData.missing.slice(0, 3).forEach(week => {
            console.log(`     - ${week.startDate} to ${week.endDate}`);
          });
        }
      } else {
        console.log(`   📊 Weekly: 0/${expectedWeeks.length} (0.0%)`);
        console.log(`   📊   Missing: ${expectedWeeks.length} weeks (ALL MISSING)`);
      }
      
      // Check monthly data
      const { data: monthlyData } = await supabase
        .from('campaign_summaries')
        .select('summary_date, platform')
        .eq('client_id', client.id)
        .eq('summary_type', 'monthly')
        .order('summary_date', { ascending: true });
      
      if (monthlyData && monthlyData.length > 0) {
        // Count unique dates (not total records)
        const uniqueMonthlyDates = [...new Set(monthlyData.map(m => m.summary_date))];
        clientResult.monthlyData.actual = uniqueMonthlyDates.length;
        auditResults.summary.totalActualMonths += uniqueMonthlyDates.length;
        
        // Check for missing months
        const actualMonthDates = new Set(uniqueMonthlyDates);
        for (const expectedMonth of expectedMonths) {
          if (actualMonthDates.has(expectedMonth.startDate)) {
            clientResult.monthlyData.present.push(expectedMonth);
          } else {
            clientResult.monthlyData.missing.push(expectedMonth);
          }
        }
        
        clientResult.monthlyData.coverage = (clientResult.monthlyData.actual / clientResult.monthlyData.expected) * 100;
        
        console.log(`   📊 Monthly: ${clientResult.monthlyData.actual}/${clientResult.monthlyData.expected} (${clientResult.monthlyData.coverage.toFixed(1)}%)`);
        console.log(`   📊   Missing: ${clientResult.monthlyData.missing.length} months`);
        
        if (clientResult.monthlyData.missing.length > 0) {
          console.log(`   📊   Sample missing months:`);
          clientResult.monthlyData.missing.slice(0, 3).forEach(month => {
            console.log(`     - ${month.year}-${month.month.toString().padStart(2, '0')}: ${month.startDate} to ${month.endDate}`);
          });
        }
      } else {
        console.log(`   📊 Monthly: 0/${expectedMonths.length} (0.0%)`);
        console.log(`   📊   Missing: ${expectedMonths.length} months (ALL MISSING)`);
      }
      
      // Check if client has complete data
      if (clientResult.weeklyData.missing.length === 0) {
        auditResults.summary.clientsWithCompleteWeeklyData++;
      }
      if (clientResult.monthlyData.missing.length === 0) {
        auditResults.summary.clientsWithCompleteMonthlyData++;
      }
      
      auditResults.clients.push(clientResult);
      console.log(`   ✅ Analysis complete\n`);
    }
    
    // Generate summary
    console.log('📊 MISSING PERIODS AUDIT SUMMARY');
    console.log('='.repeat(50));
    console.log(`Data Range: ${earliestDate} to ${latestDate}`);
    console.log(`Total Clients: ${auditResults.summary.totalClients}`);
    console.log(`Clients with Complete Weekly Data: ${auditResults.summary.clientsWithCompleteWeeklyData}/${auditResults.summary.totalClients}`);
    console.log(`Clients with Complete Monthly Data: ${auditResults.summary.clientsWithCompleteMonthlyData}/${auditResults.summary.totalClients}`);
    console.log(`Total Expected Weeks: ${auditResults.summary.totalExpectedWeeks}`);
    console.log(`Total Actual Weeks: ${auditResults.summary.totalActualWeeks}`);
    console.log(`Total Expected Months: ${auditResults.summary.totalExpectedMonths}`);
    console.log(`Total Actual Months: ${auditResults.summary.totalActualMonths}`);
    console.log(`Weekly Data Coverage: ${((auditResults.summary.totalActualWeeks / (auditResults.summary.totalExpectedWeeks * auditResults.summary.totalClients)) * 100).toFixed(1)}%`);
    console.log(`Monthly Data Coverage: ${((auditResults.summary.totalActualMonths / (auditResults.summary.totalExpectedMonths * auditResults.summary.totalClients)) * 100).toFixed(1)}%`);
    
    // Analyze missing patterns
    console.log('\n🔍 MISSING PATTERNS ANALYSIS:');
    
    const clientsWithMissingWeekly = auditResults.clients.filter(c => c.weeklyData.missing.length > 0);
    const clientsWithMissingMonthly = auditResults.clients.filter(c => c.monthlyData.missing.length > 0);
    
    console.log(`   Clients with missing weekly data: ${clientsWithMissingWeekly.length}/${auditResults.summary.totalClients}`);
    console.log(`   Clients with missing monthly data: ${clientsWithMissingMonthly.length}/${auditResults.summary.totalClients}`);
    
    // Check for common missing periods
    const weeklyMissingCounts = {};
    const monthlyMissingCounts = {};
    
    clientsWithMissingWeekly.forEach(client => {
      client.weeklyData.missing.forEach(week => {
        const key = week.startDate;
        weeklyMissingCounts[key] = (weeklyMissingCounts[key] || 0) + 1;
      });
    });
    
    clientsWithMissingMonthly.forEach(client => {
      client.monthlyData.missing.forEach(month => {
        const key = month.startDate;
        monthlyMissingCounts[key] = (monthlyMissingCounts[key] || 0) + 1;
      });
    });
    
    // Find periods missing for most clients
    const commonWeeklyMissing = Object.entries(weeklyMissingCounts)
      .filter(([date, count]) => count >= auditResults.summary.totalClients * 0.8) // Missing for 80%+ of clients
      .sort((a, b) => b[1] - a[1]);
    
    const commonMonthlyMissing = Object.entries(monthlyMissingCounts)
      .filter(([date, count]) => count >= auditResults.summary.totalClients * 0.8) // Missing for 80%+ of clients
      .sort((a, b) => b[1] - a[1]);
    
    console.log(`\n📊 Common Missing Periods (80%+ of clients):`);
    console.log(`   Weekly periods: ${commonWeeklyMissing.length}`);
    console.log(`   Monthly periods: ${commonMonthlyMissing.length}`);
    
    if (commonWeeklyMissing.length > 0) {
      console.log(`   Sample common missing weekly periods:`);
      commonWeeklyMissing.slice(0, 5).forEach(([date, count]) => {
        console.log(`     ${date}: Missing for ${count}/${auditResults.summary.totalClients} clients`);
      });
    }
    
    if (commonMonthlyMissing.length > 0) {
      console.log(`   Sample common missing monthly periods:`);
      commonMonthlyMissing.slice(0, 5).forEach(([date, count]) => {
        console.log(`     ${date}: Missing for ${count}/${auditResults.summary.totalClients} clients`);
      });
    }
    
    // Root cause analysis
    console.log('\n💡 ROOT CAUSE ANALYSIS:');
    
    if (auditResults.summary.clientsWithCompleteWeeklyData === 0) {
      console.log('   🚨 CRITICAL: No clients have complete weekly data');
      console.log('   - This suggests systematic data collection failures');
      console.log('   - Check background data collection processes');
      console.log('   - Verify API tokens and account access');
    }
    
    if (auditResults.summary.clientsWithCompleteMonthlyData === 0) {
      console.log('   🚨 CRITICAL: No clients have complete monthly data');
      console.log('   - This suggests systematic data collection failures');
      console.log('   - Check monthly data collection processes');
      console.log('   - Verify API tokens and account access');
    }
    
    if (commonWeeklyMissing.length > 0 || commonMonthlyMissing.length > 0) {
      console.log('   ⚠️  WARNING: Common missing periods across clients');
      console.log('   - This suggests data collection was not running during certain periods');
      console.log('   - Check system logs for downtime or errors');
      console.log('   - Consider running data backfill for missing periods');
    }
    
    console.log('\n🔧 RECOMMENDED ACTIONS:');
    console.log('   1. Check background data collection logs for errors');
    console.log('   2. Verify all client API tokens are valid and not expired');
    console.log('   3. Check for system downtime during missing periods');
    console.log('   4. Run data backfill for critical missing periods');
    console.log('   5. Implement better monitoring for data collection failures');
    
  } catch (error) {
    console.error('❌ Deep audit failed:', error);
  }
}

// Run the deep audit
deepAuditMissingPeriods();
