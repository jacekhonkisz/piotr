// Test script to verify date range calculation

const testDateRangeCalculation = () => {
  console.log('Testing date range calculation...');
  
  // Test March 2024
  const periodId = '2024-03';
  const [year, month] = periodId.split('-').map(Number);
  
  console.log('Period ID:', periodId);
  console.log('Year:', year);
  console.log('Month:', month);
  
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // Last day of the month
  
  console.log('Start date:', startDate.toISOString());
  console.log('End date:', endDate.toISOString());
  
  const periodStartDate = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
  const periodEndDate = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
  
  console.log('Formatted start date:', periodStartDate);
  console.log('Formatted end date:', periodEndDate);
  
  // Test if this matches the expected range for March 2024
  const expectedStart = '2024-03-01';
  const expectedEnd = '2024-03-31';
  
  console.log('\nValidation:');
  console.log('Start date matches expected:', periodStartDate === expectedStart);
  console.log('End date matches expected:', periodEndDate === expectedEnd);
  
  return { periodStartDate, periodEndDate };
};

// Test multiple periods
const testMultiplePeriods = () => {
  console.log('\n\nTesting multiple periods...');
  
  const periods = ['2024-03', '2024-04', '2024-05'];
  
  periods.forEach(periodId => {
    console.log(`\n--- ${periodId} ---`);
    testDateRangeCalculation.call(null, periodId);
  });
};

// Run tests
testDateRangeCalculation();
testMultiplePeriods(); 