#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugAugustData() {
  console.log('🔍 DEBUGGING AUGUST 2025 vs 2024 DATA\n');
  
  const clientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'; // Belmonte
  const dateRange = { start: '2025-08-01', end: '2025-08-31' };
  
  // Check campaigns table for August 2025
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('client_id', clientId)
    .gte('date_range_start', dateRange.start)
    .lte('date_range_end', dateRange.end);
    
  console.log('📅 CAMPAIGNS TABLE (August 2025):');
  console.log('   Query: campaigns WHERE client_id = Belmonte AND date_range_start >= 2025-08-01');
  console.log('   Campaigns found:', campaigns?.length || 0);
  console.log('   Error:', error?.message || 'none');
  
  // Check campaign_summaries for August 2025
  const { data: august2025Summary } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', clientId)
    .eq('summary_type', 'monthly')
    .eq('summary_date', '2025-08-01')
    .single();
    
  console.log('\n📊 AUGUST 2025 SUMMARY:');
  console.log('   Data found:', !!august2025Summary);
  console.log('   Spend:', august2025Summary?.total_spend || 0, 'zł');
  console.log('   Campaigns in summary:', august2025Summary?.campaign_data?.length || 0);
  
  // Check campaign_summaries for August 2024
  const { data: august2024Summary } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', clientId)
    .eq('summary_type', 'monthly')
    .eq('summary_date', '2024-08-01')
    .single();
    
  console.log('\n📊 AUGUST 2024 SUMMARY:');
  console.log('   Data found:', !!august2024Summary);
  console.log('   Spend:', august2024Summary?.total_spend || 0, 'zł');
  console.log('   Campaigns in summary:', august2024Summary?.campaign_data?.length || 0);
  
  if (august2025Summary && august2024Summary) {
    console.log('\n🎯 YEAR-OVER-YEAR COMPARISON:');
    console.log('   August 2025:', august2025Summary.total_spend, 'zł');
    console.log('   August 2024:', august2024Summary.total_spend, 'zł');
    
    const change = august2024Summary.total_spend > 0 ? 
      ((august2025Summary.total_spend - august2024Summary.total_spend) / august2024Summary.total_spend) * 100 : 0;
    console.log('   Change:', (change > 0 ? '+' : '') + change.toFixed(1) + '%');
    console.log('\n✅ Year-over-year comparison data is AVAILABLE!');
    
    // Test the exact logic used in PDF generation
    console.log('\n🧪 TESTING PDF GENERATION LOGIC:');
    
    // Simulate fetchPreviousYearDataFromDB function
    const previousYearDateRange = getPreviousYearDateRange({ start: '2025-08-01', end: '2025-08-31' });
    console.log('   Previous year date range calculated:', previousYearDateRange.start);
    console.log('   Expected: 2024-08-01');
    console.log('   Match:', previousYearDateRange.start === '2024-08-01' ? '✅ YES' : '❌ NO');
    
    // Test if the data would be found with this logic
    const { data: testQuery } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', clientId)
      .eq('summary_type', 'monthly')
      .eq('summary_date', previousYearDateRange.start)
      .single();
      
    console.log('   Previous year data found with PDF logic:', !!testQuery);
    if (testQuery) {
      console.log('   ✅ PDF generation should find the data!');
    } else {
      console.log('   ❌ PDF generation will NOT find the data');
    }
  } else {
    console.log('\n❌ Missing comparison data');
    if (!august2025Summary) console.log('   Missing: August 2025');
    if (!august2024Summary) console.log('   Missing: August 2024');
  }
}

// Helper function from PDF generation (copy of the actual logic)
function getPreviousYearDateRange(dateRange) {
  const dateParts = dateRange.start.split('-').map(Number);
  if (dateParts.length !== 3) {
    throw new Error(`Invalid date format: ${dateRange.start}`);
  }
  
  const year = dateParts[0];
  const month = dateParts[1];
  
  // Calculate previous year (same month)
  const previousYear = year - 1;
  
  // Format as YYYY-MM-DD (always first day of month)
  const previousYearStart = `${previousYear}-${month.toString().padStart(2, '0')}-01`;
  
  // Calculate last day of the month in previous year
  const lastDayOfPreviousYearMonth = new Date(previousYear, month, 0).getDate();
  const previousYearEnd = `${previousYear}-${month.toString().padStart(2, '0')}-${lastDayOfPreviousYearMonth.toString().padStart(2, '0')}`;
  
  return {
    start: previousYearStart,
    end: previousYearEnd
  };
}

debugAugustData().catch(console.error); 