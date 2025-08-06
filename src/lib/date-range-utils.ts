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
  endDate.setUTCDate(startDate.getUTCDate() + 6); // Add 6 days for a 7-day week
  
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
  console.log('🔍 Validating date range:', { startDate, endDate });
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  console.log('🔍 Parsed dates:', { 
    start: start.toISOString(), 
    end: end.toISOString(),
    startValid: !isNaN(start.getTime()),
    endValid: !isNaN(end.getTime())
  });
  
  // Use actual current date for validation
  const currentDate = new Date();
  
  // Check if dates are valid
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    console.log('❌ Invalid date format detected');
    return { isValid: false, error: 'Invalid date format' };
  }
  
  // Check if start is before end
  if (start >= end) {
    console.log('❌ Start date is not before end date');
    return { isValid: false, error: 'Start date must be before end date' };
  }
  
  // Check if end date is not in the future (allow current month even if not ended)
  const currentMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  
  console.log('🔍 Date comparisons:', {
    end: end.toISOString(),
    currentMonthEnd: currentMonthEnd.toISOString(),
    isEndInFuture: end > currentMonthEnd
  });
  
  // Allow the current month to be accessed even if it's not finished
  if (end > currentMonthEnd) {
    console.log('❌ End date is in the future');
    return { isValid: false, error: 'End date cannot be in the future' };
  }
  
  // Check Meta API limits (typically 37 months back) - use actual current date
  const maxPastDate = new Date(currentDate);
  maxPastDate.setMonth(maxPastDate.getMonth() - 37);
  
  console.log('🔍 Meta API limit check:', {
    start: start.toISOString(),
    maxPastDate: maxPastDate.toISOString(),
    isStartTooFarBack: start < maxPastDate
  });
  
  if (start < maxPastDate) {
    console.log('❌ Start date is too far in the past');
    return { isValid: false, error: 'Start date is too far in the past (Meta API limit: 37 months)' };
  }
  
  console.log('✅ Date range validation passed');
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