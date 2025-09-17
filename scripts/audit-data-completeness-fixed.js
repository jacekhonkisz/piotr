#!/usr/bin/env node

/**
 * Data Completeness Audit Script - Fixed Version
 * 
 * This script audits the completeness of weekly and monthly data
 * for all clients based on actual data patterns in the database
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

// Helper function to get month boundaries
function getMonthBoundaries(year, month) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
}

// Generate expected weeks based on actual data range
function generateExpectedWeeks(earliestDate, latestDate) {
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

// Generate expected months based on actual data range
function generateExpectedMonths(earliestDate, latestDate) {
  const months = [];
  const start = new Date(earliestDate);
  const end = new Date(latestDate);
  
  // Start from the earliest month and go month by month
  let currentDate = new Date(start.getFullYear(), start.getMonth(), 1);
  
  while (currentDate <= end) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const monthRange = getMonthBoundaries(year, month);
    
    months.push({
      year,
      month,
      startDate: monthRange.start,
      endDate: monthRange.end
    });
    
    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  
  return months;
}

async function auditDataCompleteness() {
  console.log('🔍 Starting Data Completeness Audit (Fixed Version)...\n');
  
  try {
    // Get all active clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email, api_status, meta_access_token, ad_account_id, google_ads_customer_id')
      .eq('api_status', 'valid');
    
    if (clientsError) {
      throw new Error(`Failed to get clients: ${clientsError.message}`);
    }
    
    console.log(`📊 Found ${clients.length} active clients\n`);
    
    // First, determine the actual date range of data in the database
    const { data: allData, error: dataError } = await supabase
      .from('campaign_summaries')
      .select('summary_date, summary_type')
      .order('summary_date', { ascending: true });
    
    if (dataError) {
      throw new Error(`Failed to get data range: ${dataError.message}`);
    }
    
    if (allData.length === 0) {
      console.log('❌ No data found in campaign_summaries table');
      return;
    }
    
    const allDates = allData.map(d => d.summary_date).sort();
    const earliestDate = allDates[0];
    const latestDate = allDates[allDates.length - 1];
    
    console.log(`📅 Data Range in Database:`);
    console.log(`   Earliest: ${earliestDate}`);
    console.log(`   Latest: ${latestDate}`);
    console.log(`   Total Records: ${allData.length}\n`);
    
    // Generate expected data periods based on actual data range
    const expectedWeeks = generateExpectedWeeks(earliestDate, latestDate);
    const expectedMonths = generateExpectedMonths(earliestDate, latestDate);
    
    console.log(`📅 Expected data periods based on actual data range:`);
    console.log(`   - Weekly: ${expectedWeeks.length} weeks`);
    console.log(`   - Monthly: ${expectedMonths.length} months\n`);
    
    const auditResults = {
      clients: [],
      summary: {
        totalClients: clients.length,
        clientsWithCompleteWeeklyData: 0,
        clientsWithCompleteMonthlyData: 0,
        totalExpectedWeeks: expectedWeeks.length,
        totalExpectedMonths: expectedMonths.length,
        totalActualWeeks: 0,
        totalActualMonths: 0,
        dataRange: {
          earliest: earliestDate,
          latest: latestDate
        }
      }
    };
    
    // Audit each client
    for (const client of clients) {
      console.log(`🔍 Auditing client: ${client.name} (${client.email})`);
      
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
          platforms: { meta: 0, google: 0 }
        },
        monthlyData: {
          expected: expectedMonths.length,
          actual: 0,
          missing: [],
          present: [],
          platforms: { meta: 0, google: 0 }
        }
      };
      
      // Check weekly data
      console.log(`   📅 Checking weekly data...`);
      const { data: weeklyData, error: weeklyError } = await supabase
        .from('campaign_summaries')
        .select('summary_date, platform, total_spend, total_impressions, total_clicks, total_conversions')
        .eq('client_id', client.id)
        .eq('summary_type', 'weekly')
        .order('summary_date', { ascending: false });
      
      if (weeklyError) {
        console.log(`   ❌ Error fetching weekly data: ${weeklyError.message}`);
      } else {
        clientResult.weeklyData.actual = weeklyData.length;
        auditResults.summary.totalActualWeeks += weeklyData.length;
        
        // Count by platform
        weeklyData.forEach(record => {
          const platform = record.platform || 'meta';
          clientResult.weeklyData.platforms[platform] = (clientResult.weeklyData.platforms[platform] || 0) + 1;
        });
        
        // Check for missing weeks
        const actualWeekDates = new Set(weeklyData.map(w => w.summary_date));
        for (const expectedWeek of expectedWeeks) {
          if (actualWeekDates.has(expectedWeek.startDate)) {
            clientResult.weeklyData.present.push(expectedWeek);
          } else {
            clientResult.weeklyData.missing.push(expectedWeek);
          }
        }
        
        console.log(`   📊 Weekly: ${weeklyData.length}/${expectedWeeks.length} weeks present`);
        console.log(`   📊   Meta: ${clientResult.weeklyData.platforms.meta}, Google: ${clientResult.weeklyData.platforms.google}`);
        if (clientResult.weeklyData.missing.length > 0) {
          console.log(`   ⚠️  Missing weeks: ${clientResult.weeklyData.missing.length}`);
        }
      }
      
      // Check monthly data
      console.log(`   📅 Checking monthly data...`);
      const { data: monthlyData, error: monthlyError } = await supabase
        .from('campaign_summaries')
        .select('summary_date, platform, total_spend, total_impressions, total_clicks, total_conversions')
        .eq('client_id', client.id)
        .eq('summary_type', 'monthly')
        .order('summary_date', { ascending: false });
      
      if (monthlyError) {
        console.log(`   ❌ Error fetching monthly data: ${monthlyError.message}`);
      } else {
        clientResult.monthlyData.actual = monthlyData.length;
        auditResults.summary.totalActualMonths += monthlyData.length;
        
        // Count by platform
        monthlyData.forEach(record => {
          const platform = record.platform || 'meta';
          clientResult.monthlyData.platforms[platform] = (clientResult.monthlyData.platforms[platform] || 0) + 1;
        });
        
        // Check for missing months
        const actualMonthDates = new Set(monthlyData.map(m => m.summary_date));
        for (const expectedMonth of expectedMonths) {
          if (actualMonthDates.has(expectedMonth.startDate)) {
            clientResult.monthlyData.present.push(expectedMonth);
          } else {
            clientResult.monthlyData.missing.push(expectedMonth);
          }
        }
        
        console.log(`   📊 Monthly: ${monthlyData.length}/${expectedMonths.length} months present`);
        console.log(`   📊   Meta: ${clientResult.monthlyData.platforms.meta}, Google: ${clientResult.monthlyData.platforms.google}`);
        if (clientResult.monthlyData.missing.length > 0) {
          console.log(`   ⚠️  Missing months: ${clientResult.monthlyData.missing.length}`);
        }
      }
      
      // Check if client has complete data
      if (clientResult.weeklyData.missing.length === 0) {
        auditResults.summary.clientsWithCompleteWeeklyData++;
      }
      if (clientResult.monthlyData.missing.length === 0) {
        auditResults.summary.clientsWithCompleteMonthlyData++;
      }
      
      auditResults.clients.push(clientResult);
      console.log(`   ✅ Client audit complete\n`);
    }
    
    // Generate summary report
    console.log('📊 AUDIT SUMMARY REPORT');
    console.log('='.repeat(50));
    console.log(`Data Range: ${auditResults.summary.dataRange.earliest} to ${auditResults.summary.dataRange.latest}`);
    console.log(`Total Clients: ${auditResults.summary.totalClients}`);
    console.log(`Clients with Complete Weekly Data: ${auditResults.summary.clientsWithCompleteWeeklyData}/${auditResults.summary.totalClients}`);
    console.log(`Clients with Complete Monthly Data: ${auditResults.summary.clientsWithCompleteMonthlyData}/${auditResults.summary.totalClients}`);
    console.log(`Total Expected Weeks: ${auditResults.summary.totalExpectedWeeks}`);
    console.log(`Total Actual Weeks: ${auditResults.summary.totalActualWeeks}`);
    console.log(`Total Expected Months: ${auditResults.summary.totalExpectedMonths}`);
    console.log(`Total Actual Months: ${auditResults.summary.totalActualMonths}`);
    console.log(`Weekly Data Coverage: ${((auditResults.summary.totalActualWeeks / (auditResults.summary.totalExpectedWeeks * auditResults.summary.totalClients)) * 100).toFixed(1)}%`);
    console.log(`Monthly Data Coverage: ${((auditResults.summary.totalActualMonths / (auditResults.summary.totalExpectedMonths * auditResults.summary.totalClients)) * 100).toFixed(1)}%`);
    
    // Platform breakdown
    console.log('\n📊 PLATFORM BREAKDOWN');
    console.log('='.repeat(50));
    const platformStats = {
      weekly: { meta: 0, google: 0 },
      monthly: { meta: 0, google: 0 }
    };
    
    auditResults.clients.forEach(client => {
      platformStats.weekly.meta += client.weeklyData.platforms.meta || 0;
      platformStats.weekly.google += client.weeklyData.platforms.google || 0;
      platformStats.monthly.meta += client.monthlyData.platforms.meta || 0;
      platformStats.monthly.google += client.monthlyData.platforms.google || 0;
    });
    
    console.log(`Weekly Data by Platform:`);
    console.log(`   Meta: ${platformStats.weekly.meta} records`);
    console.log(`   Google: ${platformStats.weekly.google} records`);
    console.log(`Monthly Data by Platform:`);
    console.log(`   Meta: ${platformStats.monthly.meta} records`);
    console.log(`   Google: ${platformStats.monthly.google} records`);
    
    // Detailed client breakdown
    console.log('\n📋 DETAILED CLIENT BREAKDOWN');
    console.log('='.repeat(50));
    
    for (const client of auditResults.clients) {
      console.log(`\n🏢 ${client.name} (${client.email})`);
      console.log(`   Platforms: Meta=${client.platforms.meta ? '✅' : '❌'}, Google=${client.platforms.google ? '✅' : '❌'}`);
      console.log(`   Weekly Data: ${client.weeklyData.actual}/${client.weeklyData.expected} (${((client.weeklyData.actual/client.weeklyData.expected)*100).toFixed(1)}%)`);
      console.log(`   Monthly Data: ${client.monthlyData.actual}/${client.monthlyData.expected} (${((client.monthlyData.actual/client.monthlyData.expected)*100).toFixed(1)}%)`);
      
      if (client.weeklyData.actual > 0) {
        console.log(`   Weekly Platforms: Meta=${client.weeklyData.platforms.meta || 0}, Google=${client.weeklyData.platforms.google || 0}`);
      }
      if (client.monthlyData.actual > 0) {
        console.log(`   Monthly Platforms: Meta=${client.monthlyData.platforms.meta || 0}, Google=${client.monthlyData.platforms.google || 0}`);
      }
      
      if (client.weeklyData.missing.length > 0) {
        console.log(`   ⚠️  Missing Weekly Periods: ${client.weeklyData.missing.length}`);
        const recentMissing = client.weeklyData.missing.slice(0, 3);
        recentMissing.forEach(week => {
          console.log(`      - Week ${week.weekNumber}: ${week.startDate} to ${week.endDate}`);
        });
        if (client.weeklyData.missing.length > 3) {
          console.log(`      ... and ${client.weeklyData.missing.length - 3} more`);
        }
      }
      
      if (client.monthlyData.missing.length > 0) {
        console.log(`   ⚠️  Missing Monthly Periods: ${client.monthlyData.missing.length}`);
        const recentMissing = client.monthlyData.missing.slice(0, 3);
        recentMissing.forEach(month => {
          console.log(`      - ${month.year}-${month.month.toString().padStart(2, '0')}: ${month.startDate} to ${month.endDate}`);
        });
        if (client.monthlyData.missing.length > 3) {
          console.log(`      ... and ${client.monthlyData.missing.length - 3} more`);
        }
      }
    }
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS');
    console.log('='.repeat(50));
    
    const incompleteClients = auditResults.clients.filter(c => 
      c.weeklyData.missing.length > 0 || c.monthlyData.missing.length > 0
    );
    
    if (incompleteClients.length === 0) {
      console.log('✅ All clients have complete data coverage for the current data range!');
    } else {
      console.log(`⚠️  ${incompleteClients.length} clients have incomplete data:`);
      incompleteClients.forEach(client => {
        console.log(`   - ${client.name}: ${client.weeklyData.missing.length} missing weeks, ${client.monthlyData.missing.length} missing months`);
      });
      
      console.log('\n🔧 Suggested Actions:');
      console.log('   1. Run background data collection for incomplete clients');
      console.log('   2. Check API tokens and account access for failing clients');
      console.log('   3. Review data collection logs for error patterns');
      console.log('   4. Consider running manual data backfill for critical missing periods');
      console.log('   5. Verify that both Meta and Google Ads data collection is working properly');
    }
    
    console.log('\n✅ Audit completed successfully!');
    
  } catch (error) {
    console.error('❌ Audit failed:', error);
    process.exit(1);
  }
}

// Run the audit
auditDataCompleteness();
