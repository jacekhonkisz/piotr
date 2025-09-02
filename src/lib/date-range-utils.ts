/**
 * Date Range Utilities for Meta API Integration
 * Standardizes date range detection and formatting across the application
 */

import logger from './logger';

export interface DateRange {
  start: string;
  end: string;
}

export interface DateRangeAnalysis {
  daysDiff: number;
  rangeType: 'daily' | 'weekly' | 'monthly' | 'custom';
  timeIncrement: number;
  isValidMonthly: boolean;
  isValidWeekly: boolean;
}

/**
 * Analyze a date range and determine the appropriate Meta API parameters
 */
export function analyzeDateRange(startDate: string, endDate: string): DateRangeAnalysis {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  // Check if it's a valid monthly range (start of month to end of month)
  const isValidMonthly = isFullMonthRange(start, end);
  
  // Check if it's a valid weekly range (7 days)
  const isValidWeekly = daysDiff === 7;

  let rangeType: 'daily' | 'weekly' | 'monthly' | 'custom';
  let timeIncrement: number;

  if (isValidMonthly) {
    rangeType = 'monthly';
    timeIncrement = 30; // Monthly aggregation
  } else if (isValidWeekly) {
    rangeType = 'weekly';
    timeIncrement = 7; // Weekly aggregation
  } else if (daysDiff <= 31) {
    rangeType = 'daily';
    timeIncrement = 1; // Daily breakdown
  } else {
    rangeType = 'custom';
    timeIncrement = 0; // No time increment for custom ranges
  }

  return {
    daysDiff,
    rangeType,
    timeIncrement,
    isValidMonthly,
    isValidWeekly
  };
}

/**
 * Check if date range covers a complete month
 */
function isFullMonthRange(start: Date, end: Date): boolean {
  // Check if start is the first day of the month
  const isStartOfMonth = start.getDate() === 1;
  
  // Check if end is the last day of the month
  const nextMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0);
  const isEndOfMonth = end.getDate() === nextMonth.getDate();
  
  // Check if they're in the same month
  const sameMonth = start.getFullYear() === end.getFullYear() && 
                   start.getMonth() === end.getMonth();
  
  return isStartOfMonth && isEndOfMonth && sameMonth;
}

/**
 * Generate month boundaries for a given year and month
 */
export function getMonthBoundaries(year: number, month: number): DateRange {
  // Create dates in UTC to avoid timezone issues
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0)); // Last day of the month
  
  return {
    start: formatDateForMetaAPI(startDate),
    end: formatDateForMetaAPI(endDate)
  };
}

/**
 * Generate week boundaries for a given start date
 */
export function getWeekBoundaries(startDate: Date): DateRange {
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6); // Add 6 days for a 7-day week (timezone-safe)
  
  return {
    start: formatDateForMetaAPI(startDate),
    end: formatDateForMetaAPI(endDate)
  };
}

/**
 * Format date for Meta API (YYYY-MM-DD)
 * Uses timezone-safe formatting to avoid UTC conversion issues
 */
export function formatDateForMetaAPI(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get the number of ISO weeks in a given year
 */
export function getWeeksInYear(year: number): number {
  // December 28th is always in the last week of the ISO year
  const dec28 = new Date(Date.UTC(year, 11, 28));
  const dayNum = dec28.getUTCDay() || 7;
  dec28.setUTCDate(dec28.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dec28.getUTCFullYear(), 0, 1));
  return Math.ceil((((dec28.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Get the start date (Monday) of a specific ISO week
 */
export function getISOWeekStartDate(year: number, week: number): Date {
  // January 4th is always in week 1 of the ISO year
  const jan4 = new Date(Date.UTC(year, 0, 4));
  
  // Find the Monday of week 1
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
  
  // Calculate the start date of the target week
  const weekStartDate = new Date(startOfWeek1);
  weekStartDate.setUTCDate(startOfWeek1.getUTCDate() + (week - 1) * 7);
  
  return weekStartDate;
}

/**
 * Validate date range for Meta API limits
 */
export function validateDateRange(startDate: string, endDate: string): {
  isValid: boolean;
  error?: string;
} {
  logger.info('🔍 Validating date range:', { startDate, endDate });
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  logger.info('🔍 Parsed dates:', { 
    start: start.toISOString(), 
    end: end.toISOString(),
    startValid: !isNaN(start.getTime()),
    endValid: !isNaN(end.getTime())
  });
  
  // Use actual current date for validation
  const currentDate = new Date();
  
  // Check if dates are valid
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    logger.info('❌ Invalid date format detected');
    return { isValid: false, error: 'Invalid date format' };
  }
  
  // Check if start is before or equal to end (allow same-day requests)
  if (start > end) {
    logger.info('❌ Start date is after end date');
    return { isValid: false, error: 'Start date must be before or equal to end date' };
  }
  
  // Check if end date is not in the future
  // For current month: allow up to today
  // For past months: allow up to end of that month
  const currentMonth = currentDate.getFullYear() === start.getFullYear() && 
                      currentDate.getMonth() === start.getMonth();
  
  let maxAllowedEnd: Date;
  if (currentMonth) {
    // Current month: allow up to today (set to end of today for comparison)
    maxAllowedEnd = new Date(currentDate);
    maxAllowedEnd.setHours(23, 59, 59, 999); // End of today
  } else {
    // Past month: allow up to end of that month
    maxAllowedEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    maxAllowedEnd.setHours(23, 59, 59, 999); // End of last day of month
  }
  
  logger.info('🔍 Date comparisons:', {
    end: end.toISOString(),
    maxAllowedEnd: maxAllowedEnd.toISOString(),
    isCurrentMonth: currentMonth,
    isEndInFuture: end > maxAllowedEnd
  });
  
  // Check if end date is in the future relative to what's allowed
  if (end > maxAllowedEnd) {
    logger.info('❌ End date is in the future');
    return { isValid: false, error: `End date cannot be in the future. For ${currentMonth ? 'current month' : 'past month'}, maximum allowed is ${maxAllowedEnd.toISOString().split('T')[0]}` };
  }
  
  // Check Meta API limits (typically 37 months back) - use actual current date
  const maxPastDate = new Date(currentDate);
  maxPastDate.setMonth(maxPastDate.getMonth() - 37);
  
  logger.info('🔍 Meta API limit check:', {
    start: start.toISOString(),
    maxPastDate: maxPastDate.toISOString(),
    isStartTooFarBack: start < maxPastDate
  });
  
  if (start < maxPastDate) {
    logger.info('❌ Start date is too far in the past');
    return { isValid: false, error: 'Start date is too far in the past (Meta API limit: 37 months)' };
  }
  
  logger.info('✅ Date range validation passed');
  return { isValid: true };
}

/**
 * Determine the best Meta API method to use for a date range
 */
export function selectMetaAPIMethod(dateRange: DateRange): {
  method: 'getMonthlyCampaignInsights' | 'getCampaignInsights';
  parameters: any;
} {
  const analysis = analyzeDateRange(dateRange.start, dateRange.end);
  
  if (analysis.isValidMonthly) {
    const startDate = new Date(dateRange.start);
    return {
      method: 'getMonthlyCampaignInsights',
      parameters: {
        year: startDate.getFullYear(),
        month: startDate.getMonth() + 1
      }
    };
  } else {
    return {
      method: 'getCampaignInsights',
      parameters: {
        dateStart: dateRange.start,
        dateEnd: dateRange.end,
        timeIncrement: analysis.timeIncrement
      }
    };
  }
} 