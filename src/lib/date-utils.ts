// Simple date utilities that don't depend on Supabase
// This can be safely imported on both client and server

export function getCurrentMonthInfo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];
  
  return {
    year,
    month,
    startDate,
    endDate,
    periodId: `${year}-${String(month).padStart(2, '0')}`
  };
}

export function getCurrentWeekInfo() {
  // Import and use the standardized week calculation from week-utils
  const { getCurrentWeekInfo: getStandardizedWeekInfo } = require('./week-utils');
  return getStandardizedWeekInfo();
}

function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}
