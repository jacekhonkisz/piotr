#!/usr/bin/env node

/**
 * Audit script to check available comparison data in campaign_summaries table
 * Run with: node scripts/audit-comparison-data.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditComparisonData() {
  console.log('🔍 AUDITING COMPARISON DATA AVAILABILITY\n');

  try {
    // 1. Check all clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name')
      .order('name');

    if (clientsError) {
      throw clientsError;
    }

    console.log(`📋 Found ${clients.length} clients\n`);

    // 2. For each client, check available summary data
    for (const client of clients) {
      console.log(`🏢 CLIENT: ${client.name} (ID: ${client.id})`);

      // Check monthly summaries
      const { data: monthlySummaries, error: monthlyError } = await supabase
        .from('campaign_summaries')
        .select('summary_date, total_spend, total_conversions, summary_type')
        .eq('client_id', client.id)
        .eq('summary_type', 'monthly')
        .order('summary_date', { ascending: false })
        .limit(12); // Last 12 months

      if (monthlyError) {
        console.log('   ❌ Error fetching monthly data:', monthlyError.message);
        continue;
      }

      if (monthlySummaries.length === 0) {
        console.log('   ⚠️ No monthly summary data found');
        continue;
      }

      console.log(`   📅 Monthly Summaries (${monthlySummaries.length} found):`);
      monthlySummaries.forEach(summary => {
        console.log(`      ${summary.summary_date}: ${(summary.total_spend || 0).toFixed(2)} zł, ${summary.total_conversions || 0} conversions`);
      });

      // Check for year-over-year data availability
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;
      
      // Check if we have data for this month last year
      const lastYearDate = `${currentYear - 1}-${currentMonth.toString().padStart(2, '0')}-01`;
      const thisYearDate = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;

      const lastYearData = monthlySummaries.find(s => s.summary_date === lastYearDate);
      const thisYearData = monthlySummaries.find(s => s.summary_date === thisYearDate);

      console.log(`   📊 Year-over-Year Analysis (${currentMonth}/${currentYear} vs ${currentMonth}/${currentYear - 1}):`);
      console.log(`      This year (${thisYearDate}): ${thisYearData ? '✅ Available' : '❌ Missing'}`);
      console.log(`      Last year (${lastYearDate}): ${lastYearData ? '✅ Available' : '❌ Missing'}`);

      if (thisYearData && lastYearData) {
        console.log(`      🎯 Year-over-Year comparison POSSIBLE`);
      } else {
        console.log(`      ⚠️ Year-over-Year comparison NOT POSSIBLE`);
      }

      // Check for previous month data
      const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      const previousMonthDate = `${prevYear}-${prevMonth.toString().padStart(2, '0')}-01`;
      
      const previousMonthData = monthlySummaries.find(s => s.summary_date === previousMonthDate);
      
      console.log(`   📈 Month-over-Month Analysis (${currentMonth}/${currentYear} vs ${prevMonth}/${prevYear}):`);
      console.log(`      This month (${thisYearDate}): ${thisYearData ? '✅ Available' : '❌ Missing'}`);
      console.log(`      Previous month (${previousMonthDate}): ${previousMonthData ? '✅ Available' : '❌ Missing'}`);

      if (thisYearData && previousMonthData) {
        console.log(`      🎯 Month-over-Month comparison POSSIBLE`);
      } else {
        console.log(`      ⚠️ Month-over-Month comparison NOT POSSIBLE`);
      }

      console.log(''); // Empty line for readability
    }

    // 3. Overall summary
    console.log('📊 OVERALL SUMMARY:');
    
    const { data: totalSummaries, error: totalError } = await supabase
      .from('campaign_summaries')
      .select('summary_type, summary_date, client_id')
      .eq('summary_type', 'monthly');

    if (!totalError) {
      const summaryMap = {};
      totalSummaries.forEach(summary => {
        const key = summary.summary_date;
        if (!summaryMap[key]) {
          summaryMap[key] = 0;
        }
        summaryMap[key]++;
      });

      console.log('   📅 Monthly summaries by date:');
      Object.entries(summaryMap)
        .sort(([a], [b]) => b.localeCompare(a)) // Sort by date descending
        .slice(0, 12) // Show last 12 months
        .forEach(([date, count]) => {
          console.log(`      ${date}: ${count} client(s)`);
        });
    }

  } catch (error) {
    console.error('❌ Error during audit:', error);
  }
}

async function suggestDataCreation() {
  console.log('\n🔧 SUGGESTIONS FOR MISSING DATA:\n');
  
  console.log('1. 📝 Create missing monthly summaries:');
  console.log('   Run: node scripts/collect-monthly.js');
  console.log('');
  
  console.log('2. 🗓️ Backfill historical data:');
  console.log('   Run: node scripts/backfill-historical-summaries.js');
  console.log('');
  
  console.log('3. 🔄 Set up automated collection:');
  console.log('   Ensure cron jobs are running for monthly data collection');
  console.log('');
  
  console.log('4. ✅ Test PDF generation with comparison data:');
  console.log('   Generate a PDF for a period that has both current and comparison data');
}

// Run the audit
auditComparisonData().then(() => {
  suggestDataCreation();
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 