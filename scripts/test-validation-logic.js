#!/usr/bin/env node

/**
 * Test the validation logic directly to see if our fixes are working
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testValidationLogic() {
  console.log('🧪 TESTING VALIDATION LOGIC DIRECTLY\n');

  const clientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'; // Belmonte Hotel
  const dateRange = { start: '2025-08-01', end: '2025-08-31' };

  // Simulate the exact data structure that would be in reportData
  console.log('📊 Fetching comparison data...');

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

  // Get current month data (August 2025)
  const { data: currentSummary } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', clientId)
    .eq('summary_type', 'monthly')
    .eq('summary_date', '2025-08-01')
    .single();

  console.log('✅ Data fetched:');
  console.log('   Current (Aug 2025):', currentSummary ? `${currentSummary.total_spend} zł` : 'Missing');
  console.log('   Previous Month (Jul 2025):', prevMonthSummary ? `${prevMonthSummary.total_spend} zł` : 'Missing');
  console.log('   Previous Year (Aug 2024):', prevYearSummary ? `${prevYearSummary.total_spend} zł` : 'Missing');

  // Simulate reportData structure
  const mockReportData = {
    reportType: 'monthly',
    totals: {
      spend: currentSummary?.total_spend || 0,
      impressions: currentSummary?.total_impressions || 0,
      clicks: currentSummary?.total_clicks || 0,
      conversions: currentSummary?.total_conversions || 0
    },
    previousMonthTotals: prevMonthSummary ? {
      spend: prevMonthSummary.total_spend || 0,
      impressions: prevMonthSummary.total_impressions || 0,
      clicks: prevMonthSummary.total_clicks || 0,
      conversions: prevMonthSummary.total_conversions || 0
    } : null,
    previousMonthConversions: prevMonthSummary ? {
      reservations: 0, // Would be calculated from campaign_data
      reservation_value: 0
    } : null,
    previousYearTotals: prevYearSummary ? {
      spend: prevYearSummary.total_spend || 0,
      impressions: prevYearSummary.total_impressions || 0,
      clicks: prevYearSummary.total_clicks || 0,
      conversions: prevYearSummary.total_conversions || 0
    } : null,
    previousYearConversions: prevYearSummary ? {
      reservations: 0, // Would be calculated from campaign_data
      reservation_value: 0
    } : null
  };

  // Test our validation functions
  console.log('\n🔍 TESTING VALIDATION FUNCTIONS:');

  // Test shouldShowPeriodComparison logic
  const shouldShowPeriodComparison = () => {
    console.log('📋 Testing shouldShowPeriodComparison:');
    console.log('   Report Type:', mockReportData.reportType);
    console.log('   Previous Month Totals:', !!mockReportData.previousMonthTotals);
    console.log('   Previous Month Conversions:', !!mockReportData.previousMonthConversions);
    
    if (mockReportData.reportType === 'monthly') {
      const hasData = !!(mockReportData.previousMonthTotals && mockReportData.previousMonthConversions);
      console.log('   Monthly comparison data available:', hasData);
      
      if (hasData && mockReportData.previousMonthTotals) {
        const previousSpend = mockReportData.previousMonthTotals.spend || 0;
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

  // Test shouldShowYearOverYear logic
  const shouldShowYearOverYear = () => {
    console.log('\n📋 Testing shouldShowYearOverYear:');
    console.log('   Report Type:', mockReportData.reportType);
    console.log('   Previous Year Totals:', !!mockReportData.previousYearTotals);
    console.log('   Previous Year Conversions:', !!mockReportData.previousYearConversions);
    
    if (mockReportData.reportType === 'monthly' || mockReportData.reportType === 'custom') {
      if (!mockReportData.previousYearTotals || !mockReportData.previousYearConversions) {
        console.log('   🚫 Year-over-year hidden: No previous year data');
        return false;
      }
      
      const currentSpend = mockReportData.totals.spend || 0;
      const previousSpend = mockReportData.previousYearTotals.spend || 0;
      
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

  // Run the tests
  const periodResult = shouldShowPeriodComparison();
  const yearResult = shouldShowYearOverYear();

  console.log('\n🎯 VALIDATION RESULTS:');
  console.log('   Period Comparison (Month-over-Month):', periodResult ? '✅ SHOW' : '❌ HIDE');
  console.log('   Year-over-Year Comparison:', yearResult ? '✅ SHOW' : '❌ HIDE');

  if (periodResult && yearResult) {
    console.log('\n🎉 VALIDATION LOGIC IS WORKING!');
    console.log('   Both comparison sections should appear in PDFs');
    console.log('   If they\'re not appearing, the issue is likely:');
    console.log('   1. Server not restarted to pick up changes');
    console.log('   2. Data not being properly attached to reportData');
    console.log('   3. Template rendering issue');
  } else {
    console.log('\n❌ VALIDATION LOGIC HAS ISSUES:');
    if (!periodResult) console.log('   - Period comparison logic failing');
    if (!yearResult) console.log('   - Year-over-year logic failing');
  }

  // Test if the issue is server restart
  console.log('\n🔄 RECOMMENDED NEXT STEPS:');
  console.log('   1. Restart the Next.js development server');
  console.log('   2. Generate a new PDF');
  console.log('   3. Check server logs for our debug messages');
}

testValidationLogic().catch(console.error); 