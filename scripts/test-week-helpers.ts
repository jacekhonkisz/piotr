#!/usr/bin/env tsx

/**
 * Test Week Helper Functions
 * 
 * Validates that all week helper functions work correctly
 * Run: npx tsx scripts/test-week-helpers.ts
 */

import {
  getMondayOfWeek,
  getSundayOfWeek,
  getWeekBoundaries,
  formatDateISO,
  validateIsMonday,
  getLastNWeeks,
  getISOWeekNumber,
  isSameWeek,
  getWeekLabel
} from '../src/lib/week-helpers';

console.log('🧪 Testing Week Helper Functions\n');
console.log('=' .repeat(70));

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    failed++;
  }
}

// Test 1: getMondayOfWeek
test('getMondayOfWeek - Thursday should return previous Monday', () => {
  const thursday = new Date('2025-11-13'); // Thursday
  const monday = getMondayOfWeek(thursday);
  const expected = '2025-11-10'; // Previous Monday
  if (formatDateISO(monday) !== expected) {
    throw new Error(`Expected ${expected}, got ${formatDateISO(monday)}`);
  }
});

test('getMondayOfWeek - Monday should return same day', () => {
  const monday = new Date('2025-11-10'); // Monday
  const result = getMondayOfWeek(monday);
  const expected = '2025-11-10';
  if (formatDateISO(result) !== expected) {
    throw new Error(`Expected ${expected}, got ${formatDateISO(result)}`);
  }
});

test('getMondayOfWeek - Sunday should return previous Monday', () => {
  const sunday = new Date('2025-11-09'); // Sunday
  const monday = getMondayOfWeek(sunday);
  const expected = '2025-11-03'; // Previous Monday (ISO week starts Mon, so Sunday is end of previous week)
  if (formatDateISO(monday) !== expected) {
    throw new Error(`Expected ${expected}, got ${formatDateISO(monday)}`);
  }
});

// Test 2: getSundayOfWeek
test('getSundayOfWeek - Thursday should return next Sunday', () => {
  const thursday = new Date('2025-11-13'); // Thursday
  const sunday = getSundayOfWeek(thursday);
  const expected = '2025-11-16'; // Next Sunday
  if (formatDateISO(sunday) !== expected) {
    throw new Error(`Expected ${expected}, got ${formatDateISO(sunday)}`);
  }
});

// Test 3: getWeekBoundaries
test('getWeekBoundaries - Returns Monday and Sunday', () => {
  const wednesday = new Date('2025-11-12');
  const { start, end } = getWeekBoundaries(wednesday);
  const expectedStart = '2025-11-10';
  const expectedEnd = '2025-11-16';
  if (formatDateISO(start) !== expectedStart || formatDateISO(end) !== expectedEnd) {
    throw new Error(`Expected ${expectedStart} to ${expectedEnd}, got ${formatDateISO(start)} to ${formatDateISO(end)}`);
  }
});

// Test 4: validateIsMonday
test('validateIsMonday - Accepts Monday', () => {
  validateIsMonday(new Date('2025-11-10')); // Monday - should not throw
});

test('validateIsMonday - Rejects Thursday', () => {
  try {
    validateIsMonday(new Date('2025-11-13')); // Thursday
    throw new Error('Should have thrown error');
  } catch (error) {
    if (!error.message.includes('must be a Monday')) {
      throw error; // Re-throw if wrong error
    }
  }
});

test('validateIsMonday - Accepts Monday string', () => {
  validateIsMonday('2025-11-10'); // Monday string - should not throw
});

// Test 5: getLastNWeeks
test('getLastNWeeks - Returns correct number of weeks', () => {
  const weeks = getLastNWeeks(5, false);
  if (weeks.length !== 5) {
    throw new Error(`Expected 5 weeks, got ${weeks.length}`);
  }
});

test('getLastNWeeks - All returned dates are Mondays', () => {
  const weeks = getLastNWeeks(10, true);
  weeks.forEach((week, i) => {
    if (week.getDay() !== 1) {
      throw new Error(`Week ${i} is not a Monday: ${formatDateISO(week)}`);
    }
  });
});

test('getLastNWeeks - Weeks are in descending order', () => {
  const weeks = getLastNWeeks(5, true);
  for (let i = 0; i < weeks.length - 1; i++) {
    if (weeks[i] <= weeks[i + 1]) {
      throw new Error('Weeks are not in descending order');
    }
  }
});

// Test 6: getISOWeekNumber
test('getISOWeekNumber - Returns correct week number', () => {
  const date = new Date('2025-11-13'); // Week 46
  const weekNum = getISOWeekNumber(date);
  if (weekNum !== 46) {
    throw new Error(`Expected week 46, got week ${weekNum}`);
  }
});

// Test 7: isSameWeek
test('isSameWeek - Same week returns true', () => {
  const date1 = new Date('2025-11-10'); // Monday
  const date2 = new Date('2025-11-13'); // Thursday same week
  if (!isSameWeek(date1, date2)) {
    throw new Error('Should be same week');
  }
});

test('isSameWeek - Different week returns false', () => {
  const date1 = new Date('2025-11-10'); // Monday Week 46
  const date2 = new Date('2025-11-17'); // Monday Week 47
  if (isSameWeek(date1, date2)) {
    throw new Error('Should be different weeks');
  }
});

// Test 8: getWeekLabel
test('getWeekLabel - Returns formatted label', () => {
  const date = new Date('2025-11-13');
  const label = getWeekLabel(date);
  if (!label.includes('Week 46') || !label.includes('Nov')) {
    throw new Error(`Unexpected label: ${label}`);
  }
});

// Test 9: formatDateISO
test('formatDateISO - Returns YYYY-MM-DD format', () => {
  const date = new Date('2025-11-13T15:30:00Z');
  const formatted = formatDateISO(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
    throw new Error(`Invalid format: ${formatted}`);
  }
});

// Test 10: Edge cases
test('Edge case - New Year week', () => {
  const date = new Date('2026-01-01'); // Thursday, Jan 1
  const monday = getMondayOfWeek(date);
  validateIsMonday(monday); // Should not throw
});

test('Edge case - Last week of year', () => {
  const date = new Date('2025-12-31'); // Wednesday, Dec 31
  const monday = getMondayOfWeek(date);
  validateIsMonday(monday); // Should not throw
});

// Test 11: Week boundaries span month
test('Week boundaries - Spanning months', () => {
  const date = new Date('2025-11-01'); // Saturday, Nov 1
  const { start, end } = getWeekBoundaries(date);
  // Should include Oct 27 (Mon) to Nov 2 (Sun)
  if (start.getMonth() === end.getMonth()) {
    // This is OK, but verify it's correct
  }
  validateIsMonday(start);
});

// Summary
console.log('\n' + '='.repeat(70));
console.log('📊 TEST SUMMARY');
console.log('='.repeat(70));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📊 Total: ${passed + failed}`);

if (failed === 0) {
  console.log('\n🎉 All tests passed! Week helpers are working correctly.');
  process.exit(0);
} else {
  console.log('\n⚠️  Some tests failed. Please review the errors above.');
  process.exit(1);
}

