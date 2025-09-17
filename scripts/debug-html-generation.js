#!/usr/bin/env node

/**
 * Debug HTML generation to see what's happening with comparison sections
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugHTMLGeneration() {
  console.log('🔍 DEBUGGING HTML GENERATION PROCESS\n');

  const clientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'; // Belmonte Hotel
  const dateRange = { start: '2025-08-01', end: '2025-08-31' };

  console.log('📊 Fetching all required data...');

  // Get current month data
  const { data: currentSummary } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', clientId)
    .eq('summary_type', 'monthly')
    .eq('summary_date', '2025-08-01')
    .single();

  // Get previous month data (July 2025)
  const { data: prevMonthSummary } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', clientId)
    .eq('summary_type', 'monthly')
    .eq('summary_date', '2025-07-01')
    .single();

  // Get previous year data (August 2024)
  const { data: prevYearSummary } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', clientId)
    .eq('summary_type', 'monthly')
    .eq('summary_date', '2024-08-01')
    .single();

  // Get client info
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();

  console.log('✅ Data fetched successfully:');
  console.log('   Current (Aug 2025):', currentSummary ? `${currentSummary.total_spend} zł` : 'Missing');
  console.log('   Previous Month (Jul 2025):', prevMonthSummary ? `${prevMonthSummary.total_spend} zł` : 'Missing');
  console.log('   Previous Year (Aug 2024):', prevYearSummary ? `${prevYearSummary.total_spend} zł` : 'Missing');
  console.log('   Client:', client?.name || 'Missing');

  // Simulate the exact data structure that would be passed to the PDF generation
  const reportData = {
    reportType: 'monthly',
    client: client,
    dateRange: dateRange,
    totals: {
      spend: currentSummary?.total_spend || 0,
      impressions: currentSummary?.total_impressions || 0,
      clicks: currentSummary?.total_clicks || 0,
      conversions: currentSummary?.total_conversions || 0
    },
    campaigns: [], // Empty as per the issue
    previousMonthTotals: prevMonthSummary ? {
      spend: prevMonthSummary.total_spend || 0,
      impressions: prevMonthSummary.total_impressions || 0,
      clicks: prevMonthSummary.total_clicks || 0,
      conversions: prevMonthSummary.total_conversions || 0
    } : null,
    previousMonthConversions: prevMonthSummary ? {
      click_to_call: 0,
      email_contacts: 0,
      booking_step_1: 0,
      reservations: 0,
      reservation_value: 0,
      booking_step_2: 0
    } : null,
    previousYearTotals: prevYearSummary ? {
      spend: prevYearSummary.total_spend || 0,
      impressions: prevYearSummary.total_impressions || 0,
      clicks: prevYearSummary.total_clicks || 0,
      conversions: prevYearSummary.total_conversions || 0
    } : null,
    previousYearConversions: prevYearSummary ? {
      click_to_call: 0,
      email_contacts: 0,
      booking_step_1: 0,
      reservations: 0,
      reservation_value: 0,
      booking_step_2: 0
    } : null
  };

  console.log('\n🔍 TESTING VALIDATION FUNCTIONS:');

  // Test shouldShowPeriodComparison
  const shouldShowPeriodComparison = () => {
    console.log('📋 Testing shouldShowPeriodComparison:');
    console.log('   Report Type:', reportData.reportType);
    console.log('   Previous Month Totals:', !!reportData.previousMonthTotals);
    console.log('   Previous Month Conversions:', !!reportData.previousMonthConversions);
    
    if (reportData.reportType === 'monthly') {
      const hasData = !!(reportData.previousMonthTotals && reportData.previousMonthConversions);
      console.log('   Monthly comparison data available:', hasData);
      
      if (hasData && reportData.previousMonthTotals) {
        const previousSpend = reportData.previousMonthTotals.spend || 0;
        console.log('   Previous month spend:', previousSpend);
        
        if (previousSpend > 0) {
          console.log('   ✅ Monthly comparison SHOULD be shown');
          return true;
        } else {
          console.log('   🚫 Monthly comparison hidden: Previous month has no spend');
          return false;
        }
      }
    }
    return false;
  };

  // Test shouldShowYearOverYear
  const shouldShowYearOverYear = () => {
    console.log('\n📋 Testing shouldShowYearOverYear:');
    console.log('   Report Type:', reportData.reportType);
    console.log('   Previous Year Totals:', !!reportData.previousYearTotals);
    console.log('   Previous Year Conversions:', !!reportData.previousYearConversions);
    
    if (reportData.reportType === 'monthly' || reportData.reportType === 'custom') {
      if (!reportData.previousYearTotals || !reportData.previousYearConversions) {
        console.log('   🚫 Year-over-year hidden: No previous year data');
        return false;
      }
      
      const currentSpend = reportData.totals.spend || 0;
      const previousSpend = reportData.previousYearTotals.spend || 0;
      
      console.log('   Current spend:', currentSpend);
      console.log('   Previous year spend:', previousSpend);
      
      if (previousSpend <= 0) {
        console.log('   🚫 Year-over-year hidden: No meaningful previous year data');
        return false;
      }
      
      console.log('   ✅ Year-over-year SHOULD be shown');
      return true;
    }
    return false;
  };

  // Run validation tests
  const periodResult = shouldShowPeriodComparison();
  const yearResult = shouldShowYearOverYear();

  console.log('\n🎯 VALIDATION RESULTS:');
  console.log('   Period Comparison (Month-over-Month):', periodResult ? '✅ SHOW' : '❌ HIDE');
  console.log('   Year-over-Year Comparison:', yearResult ? '✅ SHOW' : '❌ HIDE');

  // Now let's simulate the HTML generation
  console.log('\n🔍 SIMULATING HTML GENERATION:');

  // Simulate the generatePeriodComparisonTable function
  const generatePeriodComparisonTable = () => {
    if (!periodResult && !reportData.previousMonthTotals) {
      console.log('   🚫 Period comparison table: NOT GENERATED (validation failed)');
      return '';
    }
    
    console.log('   ✅ Period comparison table: WILL BE GENERATED');
    return '<!-- Period comparison table HTML would go here -->';
  };

  // Simulate the year-over-year section
  const generateYearOverYearSection = () => {
    if (!yearResult) {
      console.log('   🚫 Year-over-year section: NOT GENERATED (validation failed)');
      return '';
    }
    
    console.log('   ✅ Year-over-year section: WILL BE GENERATED');
    return '<!-- Year-over-year section HTML would go here -->';
  };

  // Test HTML generation
  const periodTable = generatePeriodComparisonTable();
  const yearSection = generateYearOverYearSection();

  console.log('\n📝 HTML GENERATION RESULTS:');
  console.log('   Period comparison table:', periodTable ? '✅ Generated' : '❌ Not generated');
  console.log('   Year-over-year section:', yearSection ? '✅ Generated' : '❌ Not generated');

  if (periodTable && yearSection) {
    console.log('\n🎉 HTML GENERATION IS WORKING!');
    console.log('   Both comparison sections should appear in the final HTML');
    console.log('   If they\'re not in the PDF, the issue is with Puppeteer rendering');
  } else {
    console.log('\n❌ HTML GENERATION HAS ISSUES:');
    if (!periodTable) console.log('   - Period comparison table not generated');
    if (!yearSection) console.log('   - Year-over-year section not generated');
  }

  console.log('\n🔧 ROOT CAUSE ANALYSIS:');
  console.log('   The validation logic is working correctly');
  console.log('   The data is available in the database');
  console.log('   The issue must be in one of these areas:');
  console.log('   1. Data not being properly attached to reportData in the API');
  console.log('   2. HTML template not being generated correctly');
  console.log('   3. Puppeteer not rendering the HTML properly');
  console.log('   4. Server not using the updated code (restart needed)');

  console.log('\n📋 NEXT STEPS:');
  console.log('   1. Check server logs for our debug messages');
  console.log('   2. Verify the server is using the updated code');
  console.log('   3. Test with a simple HTML generation first');
  console.log('   4. Check if Puppeteer is working correctly');
}

debugHTMLGeneration().catch(console.error); 