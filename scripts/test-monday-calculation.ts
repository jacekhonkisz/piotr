// Test script to compare Monday calculations
import { parseWeekPeriodId } from '../src/lib/week-utils';
import { getMondayOfWeek, formatDateISO } from '../src/lib/week-helpers';

// Test week 46 of 2025
const periodId = '2025-W46';
const weekInfo = parseWeekPeriodId(periodId);

console.log('📅 parseWeekPeriodId result:', {
  periodId,
  startDate: weekInfo.startDate,
  endDate: weekInfo.endDate
});

// Now test what getMondayOfWeek calculates for that start date
const parsedStartDate = new Date(weekInfo.startDate);
const calculatedMonday = getMondayOfWeek(parsedStartDate);
const calculatedMondayStr = formatDateISO(calculatedMonday);

console.log('📅 getMondayOfWeek result:', {
  inputDate: weekInfo.startDate,
  calculatedMonday: calculatedMondayStr,
  match: weekInfo.startDate === calculatedMondayStr
});

// Also test what's in the database
console.log('\n🔍 Expected database query:');
console.log(`SELECT * FROM campaign_summaries WHERE summary_date = '${calculatedMondayStr}' AND summary_type = 'weekly'`);



