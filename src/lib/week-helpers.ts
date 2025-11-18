/**
 * ISO Week Helper Functions
 * 
 * Ensures all weekly data uses Monday as week start (ISO 8601 standard)
 * 
 * @module week-helpers
 */

/**
 * Get the Monday of the ISO week containing the given date
 * 
 * @param date Any date within the week
 * @returns Monday of that week (00:00:00)
 * 
 * @example
 * getMondayOfWeek(new Date('2025-11-13')) // Returns Monday, Nov 11, 2025
 */
export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  // Calculate days to subtract to get to Monday
  // Sunday (0) -> go back 6 days
  // Monday (1) -> no change
  // Tuesday (2) -> go back 1 day, etc.
  const daysToSubtract = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - daysToSubtract);
  return d;
}

/**
 * Get the Sunday of the ISO week containing the given date
 * 
 * @param date Any date within the week
 * @returns Sunday of that week (23:59:59.999)
 * 
 * @example
 * getSundayOfWeek(new Date('2025-11-13')) // Returns Sunday, Nov 17, 2025
 */
export function getSundayOfWeek(date: Date): Date {
  const monday = getMondayOfWeek(date);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

/**
 * Get week boundaries for a given date
 * 
 * @param date Any date within the week
 * @returns Object with start (Monday) and end (Sunday) dates
 * 
 * @example
 * getWeekBoundaries(new Date('2025-11-13'))
 * // Returns: { start: Mon Nov 11, end: Sun Nov 17 }
 */
export function getWeekBoundaries(date: Date): { start: Date; end: Date } {
  return {
    start: getMondayOfWeek(date),
    end: getSundayOfWeek(date)
  };
}

/**
 * Format date as YYYY-MM-DD (ISO 8601 date string)
 * Uses local timezone to avoid timezone conversion issues
 * 
 * @param date Date to format
 * @returns ISO date string (YYYY-MM-DD)
 * 
 * @example
 * formatDateISO(new Date('2025-11-13')) // Returns: "2025-11-13"
 */
export function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Validate that a date is a Monday
 * 
 * @param date Date to validate (Date object or ISO string)
 * @throws Error if date is not Monday
 * 
 * @example
 * validateIsMonday(new Date('2025-11-10')) // OK (Monday)
 * validateIsMonday(new Date('2025-11-13')) // Throws error (Thursday)
 */
export function validateIsMonday(date: Date | string): void {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (d.getDay() !== 1) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    throw new Error(
      `Weekly summary_date must be a Monday! Got: ${formatDateISO(d)} (${dayNames[d.getDay()]})`
    );
  }
}

/**
 * Get an array of Mondays for the last N weeks
 * 
 * @param weeksBack Number of weeks to go back (default: 53)
 * @param includeCurrentWeek Include current incomplete week (default: true)
 * @returns Array of Monday dates, newest first
 * 
 * @example
 * getLastNWeeks(4, true)
 * // Returns: [Mon Nov 11, Mon Nov 4, Mon Oct 28, Mon Oct 21, Mon Oct 14]
 */
export function getLastNWeeks(weeksBack: number = 53, includeCurrentWeek: boolean = true): Date[] {
  const weeks: Date[] = [];
  const today = new Date();
  
  // Add current week if requested
  if (includeCurrentWeek) {
    weeks.push(getMondayOfWeek(today));
  }
  
  // Calculate last completed week (previous Monday)
  const lastCompleteWeek = new Date(today);
  lastCompleteWeek.setDate(lastCompleteWeek.getDate() - 7);
  const lastCompleteMonday = getMondayOfWeek(lastCompleteWeek);
  
  // Add N previous completed weeks
  for (let i = 0; i < weeksBack; i++) {
    const weekDate = new Date(lastCompleteMonday);
    weekDate.setDate(weekDate.getDate() - (i * 7));
    weeks.push(weekDate);
  }
  
  return weeks;
}

/**
 * Calculate ISO week number for a given date
 * 
 * @param date Date to calculate week number for
 * @returns ISO week number (1-53)
 * 
 * @example
 * getISOWeekNumber(new Date('2025-11-13')) // Returns: 46
 */
export function getISOWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Set to nearest Thursday (current date + 4 - current day number)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  // Get first day of year
  const yearStart = new Date(d.getFullYear(), 0, 1);
  // Calculate full weeks to nearest Thursday
  const weekNumber = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return weekNumber;
}

/**
 * Check if two dates are in the same ISO week
 * 
 * @param date1 First date
 * @param date2 Second date
 * @returns true if dates are in the same week
 * 
 * @example
 * isSameWeek(new Date('2025-11-10'), new Date('2025-11-13')) // true
 * isSameWeek(new Date('2025-11-10'), new Date('2025-11-17')) // false
 */
export function isSameWeek(date1: Date, date2: Date): boolean {
  const monday1 = getMondayOfWeek(date1);
  const monday2 = getMondayOfWeek(date2);
  return formatDateISO(monday1) === formatDateISO(monday2);
}

/**
 * Get week label for display
 * 
 * @param date Any date within the week
 * @returns Human-readable week label
 * 
 * @example
 * getWeekLabel(new Date('2025-11-13')) // Returns: "Week 46 (Nov 11-17, 2025)"
 */
export function getWeekLabel(date: Date): string {
  const { start, end } = getWeekBoundaries(date);
  const weekNumber = getISOWeekNumber(date);
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  const year = start.getFullYear();
  
  if (startMonth === endMonth) {
    return `Week ${weekNumber} (${startMonth} ${start.getDate()}-${end.getDate()}, ${year})`;
  } else {
    return `Week ${weekNumber} (${startMonth} ${start.getDate()}-${endMonth} ${end.getDate()}, ${year})`;
  }
}

