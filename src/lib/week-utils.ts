// Week utility functions that can be used on both client and server

// Helper function to get current week info with ISO week format
export function getCurrentWeekInfo() {
  const now = new Date();
  
  // Get current week boundaries (Monday to Sunday)
  const currentDayOfWeek = now.getDay();
  const daysToMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
  
  const startOfCurrentWeek = new Date(now);
  startOfCurrentWeek.setDate(startOfCurrentWeek.getDate() - daysToMonday);
  startOfCurrentWeek.setHours(0, 0, 0, 0);
  
  const endOfCurrentWeek = new Date(startOfCurrentWeek);
  endOfCurrentWeek.setDate(endOfCurrentWeek.getDate() + 6);
  endOfCurrentWeek.setHours(23, 59, 59, 999);
  
  // Calculate ISO week number
  const year = now.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const daysFromStart = Math.floor((startOfCurrentWeek.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((daysFromStart + startOfYear.getDay() + 1) / 7);
  
  // Helper function for timezone-safe date formatting
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    year,
    week: weekNumber,
    startDate: formatDate(startOfCurrentWeek),
    endDate: formatDate(endOfCurrentWeek),
    periodId: `${year}-W${String(weekNumber).padStart(2, '0')}`
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
  
  // Calculate the start date of the ISO week using same logic as reports page
  const jan4 = new Date(year, 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  
  const weekStartDate = new Date(startOfWeek1);
  weekStartDate.setDate(startOfWeek1.getDate() + (week - 1) * 7);
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
