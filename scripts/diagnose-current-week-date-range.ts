/**
 * Diagnostic script to check what date ranges are being used for current week fetching
 * This will help identify if the date range is incorrect
 */

import { getCurrentWeekInfo, parseWeekPeriodId } from '../src/lib/week-utils';

console.log('🔍 DIAGNOSING CURRENT WEEK DATE RANGE\n');
console.log('=' .repeat(60));

// Get current week info
const currentWeek = getCurrentWeekInfo();
console.log('\n📅 getCurrentWeekInfo() returns:');
console.log(JSON.stringify(currentWeek, null, 2));

// Check what parseWeekPeriodId returns for the same period
const parsedWeek = parseWeekPeriodId(currentWeek.periodId);
console.log('\n📅 parseWeekPeriodId() returns (for same periodId):');
console.log(JSON.stringify(parsedWeek, null, 2));

// Compare dates
console.log('\n🔍 COMPARISON:');
console.log(`Start Date Match: ${currentWeek.startDate === parsedWeek.startDate ? '✅' : '❌'}`);
console.log(`  - getCurrentWeekInfo: ${currentWeek.startDate}`);
console.log(`  - parseWeekPeriodId:  ${parsedWeek.startDate}`);

console.log(`\nEnd Date Match: ${currentWeek.endDate === parsedWeek.endDate ? '✅' : '⚠️ (Expected - endDate should be capped to today)'}`);
console.log(`  - getCurrentWeekInfo: ${currentWeek.endDate} (should be capped to today)`);
console.log(`  - parseWeekPeriodId:  ${parsedWeek.endDate} (full week end - Sunday)`);

// Check today's date
const today = new Date();
const todayStr = today.toISOString().split('T')[0];
console.log(`\n📆 Today's date: ${todayStr}`);

// Check if end date is correctly capped
if (currentWeek.endDate > todayStr) {
  console.log('\n🚨 PROBLEM: End date is in the future!');
  console.log(`   Current week end date: ${currentWeek.endDate}`);
  console.log(`   Today: ${todayStr}`);
} else if (currentWeek.endDate === todayStr) {
  console.log('\n✅ End date is correctly capped to today');
} else {
  console.log('\n⚠️ End date is in the past (might be correct if week already ended)');
}

// Check what would be passed to Meta API
console.log('\n📡 What would be passed to Meta API getCampaignInsights():');
console.log(`   startDate: ${currentWeek.startDate}`);
console.log(`   endDate: ${currentWeek.endDate}`);
console.log(`   periodId: ${currentWeek.periodId}`);

// Check if this is a valid date range
const startDate = new Date(currentWeek.startDate);
const endDate = new Date(currentWeek.endDate);
const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

console.log(`\n📊 Date Range Analysis:`);
console.log(`   Days in range: ${daysDiff}`);
console.log(`   Start day of week: ${startDate.getDay()} (0=Sunday, 1=Monday)`);
console.log(`   End day of week: ${endDate.getDay()} (0=Sunday, 1=Monday)`);

if (startDate.getDay() !== 1) {
  console.log('\n⚠️ WARNING: Start date is not Monday!');
}

if (daysDiff > 7) {
  console.log('\n⚠️ WARNING: Date range is more than 7 days!');
} else if (daysDiff < 1) {
  console.log('\n🚨 ERROR: Invalid date range (end before start)!');
}

console.log('\n' + '='.repeat(60));



