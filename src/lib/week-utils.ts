// Week utility functions that can be used on both client and server

// Helper function to get current week info with ISO week format
export function getCurrentWeekInfo() {
  const now = new Date();
  const year = now.getFullYear();
  
  // 🔧 FIX: Use the same ISO week calculation as parseWeekPeriodId for consistency
  // First, find which ISO week today belongs to
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  
  // Now use parseWeekPeriodId to get the correct boundaries for this week
  const periodId = `${year}-W${String(weekNumber).padStart(2, '0')}`;
  const weekInfo = parseWeekPeriodId(periodId);
  
  // 🔧 FIX: For current week, cap end date to today to avoid future date validation errors
  const today = new Date(now);
  today.setHours(23, 59, 59, 999);
  
  const endDate = new Date(weekInfo.endDate);
  const actualEndDate = endDate > today ? today : endDate;
  
  // Helper function for timezone-safe date formatting
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    year: weekInfo.year,
    week: weekInfo.week,
    startDate: weekInfo.startDate,
    endDate: formatDate(actualEndDate), // Use capped end date
    periodId: weekInfo.periodId
  };
}

// Helper function to parse week period ID and get week info
export function parseWeekPeriodId(periodId: string) {
  const [yearStr, weekStr] = periodId.split('-W');
  const year = parseInt(yearStr || '');
  const week = parseInt(weekStr || '');
  
  if (isNaN(year) || isNaN(week)) {
    throw new Error(`Invalid weekly period ID: ${periodId}`);
  }
  
  // Calculate the start date of the ISO week using CORRECTED algorithm
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay();
  const daysFromMonday = jan4Day === 0 ? 6 : jan4Day - 1; // Sunday = 6, Monday = 0
  
  // Find the Monday of week 1 (ISO week 1)
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - daysFromMonday);
  
  // Calculate the Monday of the target week
  const weekStartDate = new Date(firstMonday);
  weekStartDate.setDate(firstMonday.getDate() + (week - 1) * 7);
  weekStartDate.setHours(0, 0, 0, 0);
  
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekStartDate.getDate() + 6);
  weekEndDate.setHours(23, 59, 59, 999);
  
  // Helper function for timezone-safe date formatting
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    year,
    week,
    startDate: formatDate(weekStartDate),
    endDate: formatDate(weekEndDate),
    periodId
  };
}

// Helper function to check if a period ID represents the current week
export function isCurrentWeekPeriod(periodId: string): boolean {
  const currentWeek = getCurrentWeekInfo();
  return periodId === currentWeek.periodId;
}
