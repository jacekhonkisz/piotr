const { 
  analyzeDateRange, 
  selectMetaAPIMethod, 
  validateDateRange,
  getMonthBoundaries,
  getWeekBoundaries,
  formatDateForMetaAPI
} = require('../src/lib/date-range-utils');

function testDateRangeUtils() {
  console.log('🧪 Testing Date Range Utilities\n');

  // Test 1: Monthly range detection
  console.log('1. Testing monthly range detection:');
  const monthlyRange = getMonthBoundaries(2024, 3); // March 2024
  const monthlyAnalysis = analyzeDateRange(monthlyRange.start, monthlyRange.end);
  const monthlyMethod = selectMetaAPIMethod(monthlyRange);
  
  console.log(`   Range: ${monthlyRange.start} to ${monthlyRange.end}`);
  console.log(`   Analysis: ${monthlyAnalysis.rangeType} (${monthlyAnalysis.daysDiff} days)`);
  console.log(`   Is valid monthly: ${monthlyAnalysis.isValidMonthly}`);
  console.log(`   Selected method: ${monthlyMethod.method}`);
  console.log(`   Parameters:`, monthlyMethod.parameters);

  // Test 2: Weekly range detection
  console.log('\n2. Testing weekly range detection:');
  const weekStart = new Date('2024-03-01');
  const weeklyRange = getWeekBoundaries(weekStart);
  const weeklyAnalysis = analyzeDateRange(weeklyRange.start, weeklyRange.end);
  const weeklyMethod = selectMetaAPIMethod(weeklyRange);
  
  console.log(`   Range: ${weeklyRange.start} to ${weeklyRange.end}`);
  console.log(`   Analysis: ${weeklyAnalysis.rangeType} (${weeklyAnalysis.daysDiff} days)`);
  console.log(`   Is valid weekly: ${weeklyAnalysis.isValidWeekly}`);
  console.log(`   Selected method: ${weeklyMethod.method}`);
  console.log(`   Parameters:`, weeklyMethod.parameters);

  // Test 3: Custom range detection
  console.log('\n3. Testing custom range detection:');
  const customRange = { start: '2024-03-01', end: '2024-03-15' }; // 15 days
  const customAnalysis = analyzeDateRange(customRange.start, customRange.end);
  const customMethod = selectMetaAPIMethod(customRange);
  
  console.log(`   Range: ${customRange.start} to ${customRange.end}`);
  console.log(`   Analysis: ${customAnalysis.rangeType} (${customAnalysis.daysDiff} days)`);
  console.log(`   Selected method: ${customMethod.method}`);
  console.log(`   Parameters:`, customMethod.parameters);

  // Test 4: Date validation
  console.log('\n4. Testing date validation:');
  
  const validTests = [
    { start: '2024-03-01', end: '2024-03-31', expected: true },
    { start: '2024-03-01', end: '2024-03-07', expected: true },
    { start: '2024-01-01', end: '2024-01-15', expected: true }
  ];
  
  const invalidTests = [
    { start: '2024-03-31', end: '2024-03-01', expected: false, reason: 'start after end' },
    { start: '2024-03-01', end: '2025-03-01', expected: false, reason: 'future date' },
    { start: 'invalid', end: '2024-03-01', expected: false, reason: 'invalid format' },
    { start: '2020-01-01', end: '2020-01-31', expected: false, reason: 'too far back' }
  ];

  validTests.forEach(test => {
    const validation = validateDateRange(test.start, test.end);
    const status = validation.isValid === test.expected ? '✅' : '❌';
    console.log(`   ${status} ${test.start} to ${test.end}: ${validation.isValid ? 'valid' : validation.error}`);
  });

  invalidTests.forEach(test => {
    const validation = validateDateRange(test.start, test.end);
    const status = validation.isValid === test.expected ? '✅' : '❌';
    console.log(`   ${status} ${test.start} to ${test.end}: ${validation.isValid ? 'valid' : validation.error} (${test.reason})`);
  });

  // Test 5: Edge cases for old monthly detection logic
  console.log('\n5. Testing edge cases that would break old logic:');
  
  const edgeCases = [
    { start: '2024-02-01', end: '2024-02-29', days: 29, description: 'February leap year' },
    { start: '2024-01-15', end: '2024-02-15', days: 32, description: '32-day span' },
    { start: '2024-03-01', end: '2024-04-05', days: 36, description: '36-day span' },
    { start: '2024-02-01', end: '2024-02-28', days: 28, description: 'February non-leap year' }
  ];

  edgeCases.forEach(testCase => {
    const analysis = analyzeDateRange(testCase.start, testCase.end);
    const oldLogic = testCase.days >= 25 && testCase.days <= 35;
    const newLogic = analysis.isValidMonthly;
    
    console.log(`   ${testCase.description}:`);
    console.log(`     Range: ${testCase.start} to ${testCase.end} (${testCase.days} days)`);
    console.log(`     Old logic would detect as monthly: ${oldLogic}`);
    console.log(`     New logic detects as monthly: ${newLogic}`);
    console.log(`     Actual range type: ${analysis.rangeType}`);
  });

  console.log('\n✅ Date range utilities test completed!');
}

// Run the test
try {
  testDateRangeUtils();
} catch (error) {
  console.error('❌ Test failed:', error);
  process.exit(1);
} 