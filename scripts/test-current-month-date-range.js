// Test script to verify current month date range calculation

function testCurrentMonthDateRange() {
  console.log('🔍 Testing Current Month Date Range...\n');

  // Simulate the date range calculation logic
  const periodId = '2025-08';
  const [year, month] = periodId.split('-').map(Number);
  
  console.log(`📅 Testing period: ${periodId}`);
  console.log(`📅 Year: ${year}, Month: ${month}`);
  
  // Check if this is the current month
  const currentDate = new Date();
  const isCurrentMonth = year === currentDate.getFullYear() && month === (currentDate.getMonth() + 1);
  
  console.log(`📅 Current date: ${currentDate.toISOString().split('T')[0]}`);
  console.log(`📅 Current year: ${currentDate.getFullYear()}, Current month: ${currentDate.getMonth() + 1}`);
  console.log(`✅ Is current month: ${isCurrentMonth}`);
  
  let dateRange;
  
  if (isCurrentMonth) {
    // For current month, use today as the end date
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(); // Today
    
    dateRange = {
      start: startDate.toISOString().split('T')[0] || '',
      end: endDate.toISOString().split('T')[0] || ''
    };
    
    console.log(`📅 Current month date range:`, {
      startDate: dateRange.start,
      endDate: dateRange.end,
      isCurrentMonth: true
    });
  } else {
    // For past months, use the full month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of the month
    
    dateRange = {
      start: startDate.toISOString().split('T')[0] || '',
      end: endDate.toISOString().split('T')[0] || ''
    };
    
    console.log(`📅 Past month date range:`, {
      startDate: dateRange.start,
      endDate: dateRange.end,
      isCurrentMonth: false
    });
  }
  
  // Test validation
  console.log('\n🔍 Testing Date Validation:');
  console.log('==========================');
  
  const start = new Date(dateRange.start);
  const end = new Date(dateRange.end);
  const currentDateForValidation = new Date();
  
  console.log(`📅 Start date: ${start.toISOString()}`);
  console.log(`📅 End date: ${end.toISOString()}`);
  console.log(`📅 Current date: ${currentDateForValidation.toISOString()}`);
  
  // Check if end date is in the future
  const isEndInFuture = end > currentDateForValidation;
  console.log(`❌ End date is in future: ${isEndInFuture}`);
  
  if (isEndInFuture) {
    console.log('❌ This would cause "End date cannot be in the future" error');
  } else {
    console.log('✅ Date range is valid');
  }
  
  console.log('\n📊 EXPECTED RESULT:');
  console.log('===================');
  console.log('✅ Current month (August 2025) should use today as end date');
  console.log('✅ Past months should use full month (1st to last day)');
  console.log('✅ No more "End date cannot be in the future" errors');
  console.log('✅ Current month shows data from August 1st to today');
}

// Run the test
testCurrentMonthDateRange(); 