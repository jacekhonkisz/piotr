#!/usr/bin/env node

/**
 * Debug Frontend ISO Week Calculation
 * 
 * This script tests the exact same logic used in the frontend to see where it breaks
 */

console.log('🔍 DEBUGGING FRONTEND ISO WEEK CALCULATION');
console.log('==========================================\n');

// Test the exact logic from the frontend reports page
function testFrontendCalculation(periodId) {
  console.log(`📅 Testing frontend calculation for ${periodId}:`);
  
  // Parse week ID to get start and end dates using CORRECTED ISO week calculation
  const [year, weekStr] = periodId.split('-W');
  const week = parseInt(weekStr || '1');
  
  // CORRECTED ISO week calculation - matches the fixed logic from data-lifecycle-manager.ts
  const yearNum = parseInt(year || new Date().getFullYear().toString());
  
  // Calculate ISO week using the corrected algorithm
  // January 4th is always in week 1, find its Monday
  const jan4 = new Date(yearNum, 0, 4);
  const jan4Day = jan4.getDay();
  const daysFromMonday = jan4Day === 0 ? 6 : jan4Day - 1; // Sunday = 6, Monday = 0
  
  // Find the Monday of week 1 (ISO week 1)
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - daysFromMonday);
  
  // Calculate the Monday of the target week
  const weekStartDate = new Date(firstMonday);
  weekStartDate.setDate(firstMonday.getDate() + (week - 1) * 7);
  
  console.log('  Step-by-step calculation:');
  console.log(`    Jan 4, ${yearNum}:`, jan4.toISOString().split('T')[0]);
  console.log(`    Jan 4 day of week:`, jan4Day);
  console.log(`    Days from Monday:`, daysFromMonday);
  console.log(`    First Monday:`, firstMonday.toISOString().split('T')[0]);
  console.log(`    Week ${week} start:`, weekStartDate.toISOString().split('T')[0]);
  
  // Simulate getWeekBoundaries function
  const endDate = new Date(weekStartDate);
  endDate.setDate(weekStartDate.getDate() + 6); // Add 6 days for a 7-day week
  
  const dateRange = {
    start: formatDateForMetaAPI(weekStartDate),
    end: formatDateForMetaAPI(endDate)
  };
  
  console.log('  Final result:');
  console.log(`    Start: ${dateRange.start}`);
  console.log(`    End: ${dateRange.end}`);
  console.log(`    Expected: 2025-08-31 to 2025-09-06`);
  console.log(`    Correct: ${dateRange.start === '2025-08-31' && dateRange.end === '2025-09-06'}`);
  
  return dateRange;
}

// Format date for Meta API (YYYY-MM-DD) - same as frontend
function formatDateForMetaAPI(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Test the problematic week
console.log('🧪 Testing Week 36 calculation:');
const result = testFrontendCalculation('2025-W36');

console.log('\n🔍 Additional checks:');
console.log('Current date:', new Date().toISOString().split('T')[0]);
console.log('Current week should be 35 or 36');

// Test current week detection
const now = new Date();
const currentDayOfWeek = now.getDay();
const daysToMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;

const currentWeekStart = new Date(now);
currentWeekStart.setDate(now.getDate() - daysToMonday);

console.log('Current week start:', currentWeekStart.toISOString().split('T')[0]);

// Calculate current week number
const year = now.getFullYear();
const jan4 = new Date(year, 0, 4);
const jan4Day = jan4.getDay();
const daysFromMondayJan4 = jan4Day === 0 ? 6 : jan4Day - 1;

const firstMonday = new Date(jan4);
firstMonday.setDate(jan4.getDate() - daysFromMondayJan4);

const weeksDiff = Math.floor((currentWeekStart.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
const currentWeekNumber = weeksDiff + 1;

console.log('Current week number:', currentWeekNumber);
console.log('Current week ID:', `${year}-W${String(currentWeekNumber).padStart(2, '0')}`);

console.log('\n🎯 CONCLUSION:');
if (result.start === '2025-08-31' && result.end === '2025-09-06') {
  console.log('✅ Frontend calculation is CORRECT');
  console.log('❌ The issue must be elsewhere - possibly in state management or caching');
} else {
  console.log('❌ Frontend calculation is WRONG');
  console.log('🔧 Need to fix the calculation logic');
}
