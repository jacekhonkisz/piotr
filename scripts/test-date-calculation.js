console.log('🧪 Testing Date Calculation Logic\n');

// Test March 2024
const year = 2024;
const month = 3;

console.log(`📅 Testing for ${year}-${month.toString().padStart(2, '0')}`);

// Method 1: Current logic
const startDate1 = new Date(year, month - 1, 1);
const endDate1 = new Date(year, month, 0);

console.log('Method 1 (current):');
console.log(`Start: ${startDate1.toISOString().split('T')[0]}`);
console.log(`End: ${endDate1.toISOString().split('T')[0]}`);

// Method 2: Correct logic
const startDate2 = new Date(year, month - 1, 1);
const endDate2 = new Date(year, month, 0);

console.log('Method 2 (correct):');
console.log(`Start: ${startDate2.toISOString().split('T')[0]}`);
console.log(`End: ${endDate2.toISOString().split('T')[0]}`);

// Method 3: Manual calculation
const startDate3 = new Date(year, month - 1, 1);
const endDate3 = new Date(year, month, 0);

console.log('Method 3 (manual):');
console.log(`Start: ${startDate3.toISOString().split('T')[0]}`);
console.log(`End: ${endDate3.toISOString().split('T')[0]}`);

// Let's check what the actual dates should be
console.log('\n📅 Expected dates:');
console.log('March 2024 should be: 2024-03-01 to 2024-03-31');
console.log('April 2024 should be: 2024-04-01 to 2024-04-30');

// Test with different months
const testMonths = [
  { year: 2024, month: 3, name: 'March 2024' },
  { year: 2024, month: 4, name: 'April 2024' },
  { year: 2025, month: 7, name: 'July 2025' },
];

console.log('\n📅 Testing all months:');
testMonths.forEach(test => {
  const start = new Date(test.year, test.month - 1, 1);
  const end = new Date(test.year, test.month, 0);
  
  console.log(`${test.name}:`);
  console.log(`  Start: ${start.toISOString().split('T')[0]}`);
  console.log(`  End: ${end.toISOString().split('T')[0]}`);
  console.log(`  Start month: ${start.getMonth() + 1}, End month: ${end.getMonth() + 1}`);
}); 