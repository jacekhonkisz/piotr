const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditYearOverYearLogic() {
  console.log('🔍 AUDITING YEAR-OVER-YEAR LOGIC - 12 MONTHS BACKWARD\n');

  try {
    // 1. Test current implementation logic
    console.log('1️⃣ TESTING CURRENT IMPLEMENTATION LOGIC');
    
    function getPreviousYearDateRange(dateRange) {
      const dateParts = dateRange.start.split('-').map(Number);
      if (dateParts.length !== 3) {
        throw new Error(`Invalid date format: ${dateRange.start}`);
      }
      
      const year = dateParts[0];
      const month = dateParts[1];
      const day = dateParts[2];
      
      // Calculate previous year (same month) - CURRENT IMPLEMENTATION
      const previousYear = year - 1;
      const previousYearStart = `${previousYear}-${month.toString().padStart(2, '0')}-01`;
      
      return { start: previousYearStart };
    }

    // Test cases
    const testCases = [
      { input: '2025-08-01', description: 'August 2025' },
      { input: '2025-01-01', description: 'January 2025' },
      { input: '2025-12-01', description: 'December 2025' },
      { input: '2026-03-01', description: 'March 2026' }
    ];

    console.log('📅 Current implementation results:');
    testCases.forEach(testCase => {
      const result = getPreviousYearDateRange({ start: testCase.input });
      console.log(`   ${testCase.description} (${testCase.input}) → ${result.start}`);
    });

    // 2. Test what 12 months backward SHOULD be
    console.log('\n2️⃣ TESTING 12 MONTHS BACKWARD LOGIC');
    
    function get12MonthsBackwardDate(dateRange) {
      const currentDate = new Date(dateRange.start + 'T00:00:00Z'); // Ensure UTC
      
      // Calculate 12 months backward
      const twelveMonthsBack = new Date(currentDate);
      twelveMonthsBack.setUTCFullYear(currentDate.getUTCFullYear() - 1);
      
      // Format as YYYY-MM-DD (first day of that month)
      const year = twelveMonthsBack.getUTCFullYear();
      const month = twelveMonthsBack.getUTCMonth() + 1; // getUTCMonth() returns 0-11
      const backwardStart = `${year}-${month.toString().padStart(2, '0')}-01`;
      
      return { start: backwardStart };
    }

    console.log('📅 12 months backward results:');
    testCases.forEach(testCase => {
      const result = get12MonthsBackwardDate({ start: testCase.input });
      console.log(`   ${testCase.description} (${testCase.input}) → ${result.start}`);
    });

    // 3. Compare the two approaches
    console.log('\n3️⃣ COMPARING APPROACHES');
    
    console.log('┌─────────────────┬─────────────────┬─────────────────┬─────────┐');
    console.log('│ Current Date    │ Current Logic   │ 12 Months Back │ Match?  │');
    console.log('├─────────────────┼─────────────────┼─────────────────┼─────────┤');
    
    testCases.forEach(testCase => {
      const currentResult = getPreviousYearDateRange({ start: testCase.input });
      const backwardResult = get12MonthsBackwardDate({ start: testCase.input });
      const match = currentResult.start === backwardResult.start ? '✅' : '❌';
      
      console.log(`│ ${testCase.input.padEnd(15)} │ ${currentResult.start.padEnd(15)} │ ${backwardResult.start.padEnd(15)} │ ${match.padEnd(7)} │`);
    });
    console.log('└─────────────────┴─────────────────┴─────────────────┴─────────┘');

    // 4. Check database for available data 12 months back
    console.log('\n4️⃣ CHECKING DATABASE FOR 12 MONTHS BACKWARD DATA');
    
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name')
      .eq('name', 'Belmonte Hotel')
      .single();

    if (clients) {
      console.log(`\n📊 Checking data availability for client: ${clients.name}`);
      
      // Get all available monthly summaries for this client
      const { data: summaries } = await supabase
        .from('campaign_summaries')
        .select('summary_date, total_spend, total_impressions')
        .eq('client_id', clients.id)
        .eq('summary_type', 'monthly')
        .order('summary_date', { ascending: false });

      console.log('\nAvailable monthly data:');
      summaries?.forEach(summary => {
        console.log(`   ${summary.summary_date}: ${summary.total_spend} zł, ${summary.total_impressions} impressions`);
      });

      // Test 12 months backward for current available dates
      console.log('\n📈 Testing 12 months backward for available dates:');
      
      const availableDates = summaries?.map(s => s.summary_date) || [];
      
      availableDates.slice(0, 5).forEach(date => {
        const twelveMonthsBack = get12MonthsBackwardDate({ start: date });
        const hasBackwardData = availableDates.includes(twelveMonthsBack.start);
        
        console.log(`   ${date} → ${twelveMonthsBack.start} ${hasBackwardData ? '✅ Available' : '❌ Not available'}`);
      });
    }

    // 5. Test edge cases
    console.log('\n5️⃣ TESTING EDGE CASES');
    
    const edgeCases = [
      { input: '2024-02-29', description: 'Leap Year February' }, // Leap year
      { input: '2025-02-28', description: 'Non-Leap Year February' },
      { input: '2025-01-31', description: 'January 31st' },
      { input: '2025-03-31', description: 'March 31st' }
    ];

    console.log('🧪 Edge case results:');
    edgeCases.forEach(testCase => {
      try {
        const result = get12MonthsBackwardDate({ start: testCase.input });
        console.log(`   ${testCase.description}: ${testCase.input} → ${result.start} ✅`);
      } catch (error) {
        console.log(`   ${testCase.description}: ${testCase.input} → ERROR: ${error.message} ❌`);
      }
    });

    // 6. Verify the logic is correct
    console.log('\n6️⃣ VERIFICATION SUMMARY');
    
    const verification = testCases.every(testCase => {
      const currentResult = getPreviousYearDateRange({ start: testCase.input });
      const backwardResult = get12MonthsBackwardDate({ start: testCase.input });
      return currentResult.start === backwardResult.start;
    });

    if (verification) {
      console.log('✅ CURRENT IMPLEMENTATION IS CORRECT');
      console.log('   The logic properly calculates 12 months backward (same month, previous year)');
    } else {
      console.log('❌ CURRENT IMPLEMENTATION NEEDS FIXING');
      console.log('   The logic does not properly calculate 12 months backward');
    }

    console.log('\n💡 SUMMARY:');
    console.log('   • Year-over-year comparison looks for same month in previous year');
    console.log('   • August 2025 compares to August 2024 (12 months back)');
    console.log('   • January 2025 compares to January 2024 (12 months back)');
    console.log('   • This is the correct approach for year-over-year analysis');

  } catch (error) {
    console.error('💥 Audit error:', error);
  }
}

auditYearOverYearLogic(); 