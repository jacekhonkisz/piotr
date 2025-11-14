/**
 * Test the period detection logic to see if November 2025 is considered "current month"
 * Date: November 14, 2025
 */

const dateRange = {
  start: '2025-11-01',
  end: '2025-11-30'
};

const startDate = new Date(dateRange.start);
const endDate = new Date(dateRange.end);
const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth(); // 0-indexed (November = 10)

const isCurrentMonth = 
  startDate.getFullYear() === currentYear &&
  startDate.getMonth() === currentMonth &&
  endDate >= now;

console.log('📅 PERIOD DETECTION TEST');
console.log('=======================\n');

console.log('Input date range:', dateRange.start, 'to', dateRange.end);
console.log('');
console.log('Current date:', now.toISOString().split('T')[0]);
console.log('Current year:', currentYear);
console.log('Current month (0-indexed):', currentMonth, '(November = 10)');
console.log('');
console.log('Start date:', startDate.toISOString().split('T')[0]);
console.log('Start year:', startDate.getFullYear());
console.log('Start month (0-indexed):', startDate.getMonth());
console.log('');
console.log('End date:', endDate.toISOString().split('T')[0]);
console.log('End date >= now:', endDate >= now);
console.log('');
console.log('Condition checks:');
console.log('✓ startDate.getFullYear() === currentYear:', startDate.getFullYear() === currentYear);
console.log('✓ startDate.getMonth() === currentMonth:', startDate.getMonth() === currentMonth);
console.log('✓ endDate >= now:', endDate >= now);
console.log('');
console.log('Result:');
console.log('Is current month?', isCurrentMonth ? '✅ YES' : '❌ NO');
console.log('');

if (isCurrentMonth) {
  console.log('✅ SHOULD USE SMART CACHE');
} else {
  console.log('❌ WILL FETCH FROM LIVE API (Historical period)');
  console.log('');
  console.log('⚠️ THIS IS THE PROBLEM!');
  console.log('The period is NOT detected as current month, so it falls back to live API.');
  console.log('But the live API might return no data or different data than what\'s in the cache.');
}

