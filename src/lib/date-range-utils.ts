/**
 * Date Range Utilities for Meta API Integration
 * Standardizes date range detection and formatting across the application
 */

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
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // Last day of the month
  
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
  endDate.setDate(startDate.getDate() + 6); // Add 6 days for a 7-day week
  
  return {
    start: formatDateForMetaAPI(startDate),
    end: formatDateForMetaAPI(endDate)
  };
}

/**
 * Format date for Meta API (YYYY-MM-DD)
 */
export function formatDateForMetaAPI(date: Date): string {
  const parts = date.toISOString().split('T');
  return parts[0] || '';
}

/**
 * Validate date range for Meta API limits
 */
export function validateDateRange(startDate: string, endDate: string): {
  isValid: boolean;
  error?: string;
} {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Use the actual current date (system date) since it's the real current date
  const currentDate = new Date();
  
  // Check if dates are valid
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { isValid: false, error: 'Invalid date format' };
  }
  
  // Check if start is before end
  if (start >= end) {
    return { isValid: false, error: 'Start date must be before end date' };
  }
  
  // Check if end date is not in the future (allow current month even if not ended)
  const currentMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  
  // Allow the current month to be accessed even if it's not finished
  if (end > currentMonthEnd) {
    return { isValid: false, error: 'End date cannot be in the future' };
  }
  
  // Check Meta API limits (typically 37 months back)
  const maxPastDate = new Date();
  maxPastDate.setMonth(maxPastDate.getMonth() - 37);
  
  if (start < maxPastDate) {
    return { isValid: false, error: 'Start date is too far in the past (Meta API limit: 37 months)' };
  }
  
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