#!/usr/bin/env node

/**
 * Data Completeness Audit Script
 * 
 * This script audits the completeness of weekly and monthly data
 * for all clients over the past year (52 weeks, 12 months)
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

// Generate expected weeks for past year
function generateExpectedWeeks() {
  const weeks = [];
  const currentDate = new Date();
  
  // Start from last completed week
  const lastCompletedWeekEnd = new Date(currentDate);
  const dayOfWeek = lastCompletedWeekEnd.getDay();
  const daysToLastSunday = dayOfWeek === 0 ? 0 : dayOfWeek;
  lastCompletedWeekEnd.setDate(lastCompletedWeekEnd.getDate() - daysToLastSunday);
  lastCompletedWeekEnd.setHours(23, 59, 59, 999);
  
  for (let i = 0; i < 52; i++) {
    const weekEndDate = new Date(lastCompletedWeekEnd.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
    const weekStartDate = new Date(weekEndDate.getTime() - (6 * 24 * 60 * 60 * 1000));
    const weekRange = getWeekBoundaries(weekStartDate);
    
    // Only include completed weeks
    if (weekEndDate < currentDate) {
      weeks.push({
        weekNumber: i + 1,
        startDate: weekRange.start,
        endDate: weekRange.end,
        year: weekEndDate.getFullYear(),
        month: weekEndDate.getMonth() + 1
      });
    }
  }
  
  return weeks;
}

// Generate expected months for past year
function generateExpectedMonths() {
  const months = [];
  const currentDate = new Date();
  
  for (let i = 0; i < 12; i++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const monthRange = getMonthBoundaries(year, month);
    
    months.push({
      year,
      month,
      startDate: monthRange.start,
      endDate: monthRange.end
    });
  }
  
  return months;
}

async function auditDataCompleteness() {
  console.log('🔍 Starting Data Completeness Audit...\n');
  
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
    
    // Generate expected data periods
    const expectedWeeks = generateExpectedWeeks();
    const expectedMonths = generateExpectedMonths();
    
    console.log(`📅 Expected data periods:`);
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
        totalActualMonths: 0
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
          present: []
        },
        monthlyData: {
          expected: expectedMonths.length,
          actual: 0,
          missing: [],
          present: []
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
    console.log(`Total Clients: ${auditResults.summary.totalClients}`);
    console.log(`Clients with Complete Weekly Data: ${auditResults.summary.clientsWithCompleteWeeklyData}/${auditResults.summary.totalClients}`);
    console.log(`Clients with Complete Monthly Data: ${auditResults.summary.clientsWithCompleteMonthlyData}/${auditResults.summary.totalClients}`);
    console.log(`Total Expected Weeks: ${auditResults.summary.totalExpectedWeeks}`);
    console.log(`Total Actual Weeks: ${auditResults.summary.totalActualWeeks}`);
    console.log(`Total Expected Months: ${auditResults.summary.totalExpectedMonths}`);
    console.log(`Total Actual Months: ${auditResults.summary.totalActualMonths}`);
    console.log(`Weekly Data Coverage: ${((auditResults.summary.totalActualWeeks / (auditResults.summary.totalExpectedWeeks * auditResults.summary.totalClients)) * 100).toFixed(1)}%`);
    console.log(`Monthly Data Coverage: ${((auditResults.summary.totalActualMonths / (auditResults.summary.totalExpectedMonths * auditResults.summary.totalClients)) * 100).toFixed(1)}%`);
    
    // Detailed client breakdown
    console.log('\n📋 DETAILED CLIENT BREAKDOWN');
    console.log('='.repeat(50));
    
    for (const client of auditResults.clients) {
      console.log(`\n🏢 ${client.name} (${client.email})`);
      console.log(`   Platforms: Meta=${client.platforms.meta ? '✅' : '❌'}, Google=${client.platforms.google ? '✅' : '❌'}`);
      console.log(`   Weekly Data: ${client.weeklyData.actual}/${client.weeklyData.expected} (${((client.weeklyData.actual/client.weeklyData.expected)*100).toFixed(1)}%)`);
      console.log(`   Monthly Data: ${client.monthlyData.actual}/${client.monthlyData.expected} (${((client.monthlyData.actual/client.monthlyData.expected)*100).toFixed(1)}%)`);
      
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
      console.log('✅ All clients have complete data coverage!');
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
    }
    
    console.log('\n✅ Audit completed successfully!');
    
  } catch (error) {
    console.error('❌ Audit failed:', error);
    process.exit(1);
  }
}

// Run the audit
auditDataCompleteness();
