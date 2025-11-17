import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MetaAPIService } from '../../../lib/meta-api-optimized';
import { authenticateRequest, canAccessClient, createErrorResponse } from '../../../lib/auth-middleware';
import logger from '../../../lib/logger';
import { performanceMonitor } from '../../../lib/performance';
import { 
  analyzeDateRange, 
  selectMetaAPIMethod, 
  validateDateRange
} from '../../../lib/date-range-utils';
import { getCurrentWeekInfo } from '../../../lib/week-utils';
import { StandardizedDataFetcher } from '../../../lib/standardized-data-fetcher';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

// Helper function to check if date range is current month
function isCurrentMonth(startDate: string, endDate: string): boolean {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  // 🔧 FIX: Parse dates correctly to avoid timezone issues
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const startYear = start.getFullYear();
  const startMonth = start.getMonth() + 1;
  const endYear = end.getFullYear();
  const endMonth = end.getMonth() + 1;
  
  logger.debug('Debug info', {
    now: now.toISOString(),
    currentYear,
    currentMonth,
    startDate,
    endDate,
    startYear,
    startMonth,
    endYear,
    endMonth,
    isStartCurrentMonth: startYear === currentYear && startMonth === currentMonth,
    isEndCurrentMonth: endYear === currentYear && endMonth === currentMonth,
    bothInCurrentMonth: startYear === currentYear && startMonth === currentMonth && endYear === currentYear && endMonth === currentMonth
  });
  
  // 🔒 STRICT: Must be exact current month AND include today
  const today: string = now.toISOString().split('T')[0];
  const includesCurrentDay: boolean = endDate >= today;
  
  const result = startYear === currentYear && 
         startMonth === currentMonth &&
         endYear === currentYear && 
         endMonth === currentMonth &&
         includesCurrentDay; // ← STRICT: Must include today
         
  logger.info('🔒 STRICT CURRENT MONTH CHECK:', {
    result,
    today,
    endDate,
    includesCurrentDay,
    note: result ? 'CURRENT MONTH (use cache)' : 'PAST MONTH (use database)'
  });
  return result;
}

// Helper function to check if date range is current week
// Helper function to generate period ID from date range
function generatePeriodIdFromDateRange(startDate: string, endDate: string): string | null {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  if (daysDiff <= 7) {
    // Weekly period - calculate ISO week
    const year = start.getFullYear();
    
    // Calculate ISO week number using same logic as frontend
    const jan4 = new Date(year, 0, 4);
    const startOfYear = new Date(jan4);
    startOfYear.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
    
    const weeksDiff = Math.floor((start.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const weekNumber = weeksDiff + 1;
    
    return `${year}-W${String(weekNumber).padStart(2, '0')}`;
  } else if (daysDiff >= 28 && daysDiff <= 31) {
    // Monthly period
    const year = start.getFullYear();
    const month = start.getMonth() + 1;
    return `${year}-${String(month).padStart(2, '0')}`;
  }
  
  return null; // Custom date range
}

function isCurrentWeek(startDate: string, endDate: string): boolean {
  const now = new Date();
  
  // 🔧 FIX: Use centralized getCurrentWeekInfo to ensure consistency
  const currentWeekInfo = getCurrentWeekInfo();
  
  logger.debug('🔍 Current week validation:', {
    now: now.toISOString(),
    currentWeekStart: currentWeekInfo.startDate,
    currentWeekEnd: currentWeekInfo.endDate,
    requestStartDate: startDate,
    requestEndDate: endDate
  });
  
  // 🔧 FIX: Strict current week detection - must match exactly
  // Check if the request is for the current week period with exact date match
  const requestStart = new Date(startDate);
  const requestEnd = new Date(endDate);
  const currentWeekStart = new Date(currentWeekInfo.startDate);
  const currentWeekEnd = new Date(currentWeekInfo.endDate);
  
  // 🔒 STRICT: Must match current week exactly AND include today
  const today: string = now.toISOString().split('T')[0];
  const includesCurrentDay: boolean = endDate >= today;
  const startMatches = startDate === currentWeekInfo.startDate;
  const endMatches = endDate === currentWeekInfo.endDate;
  
  // Check if this is exactly a 7-day period starting on Monday
  const daysDiff = Math.ceil((requestEnd.getTime() - requestStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const isMondayStart = requestStart.getDay() === 1;
  const isExactWeek = daysDiff === 7 && isMondayStart;
  
  const result = startMatches && endMatches && isExactWeek && includesCurrentDay;
  
  logger.debug('🔒 STRICT WEEK CHECK:', {
    startDateMatches: startMatches,
    endDateMatches: endMatches,
    isExactWeek: isExactWeek,
    includesCurrentDay: includesCurrentDay,
    daysDiff: daysDiff,
    isMondayStart: isMondayStart,
    result: result,
    today: today,
    endDate: endDate,
    reasoning: result ? 'CURRENT WEEK (use cache)' : 'PAST WEEK (use database)'
  });
  
  return result;
}

// Helper function to load data from database with date-based separation
async function loadFromDatabase(clientId: string, startDate: string, endDate: string, platform: string = 'meta') {
  console.log(`📊 Loading data from database for ${clientId} (${startDate} to ${endDate}) - Platform: ${platform}`);
  
  // Determine if this is a weekly or monthly request based on date range
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const summaryType = daysDiff <= 7 ? 'weekly' : 'monthly';
  
  console.log(`📊 Detected ${summaryType} request (${daysDiff} days) for ${platform} platform`);
  
  // 🎯 STRICT SEPARATION RULES (DATABASE-FIRST FOR ALL PAST PERIODS):
  // - Any past month (even last month) → ALWAYS use campaign_summaries database
  // - Current month only → Use smart caching (3-hour refresh)
  // - Current week only → Use smart caching
  
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentMonthStart = currentYear + '-' + String(currentMonth).padStart(2, '0') + '-01';
  
  // 🔒 STRICT: Only exact current month gets cache (must match year AND month AND end date >= today)
  const requestYear = parseInt(startDate.split('-')[0]);
  const requestMonth = parseInt(startDate.split('-')[1]);
  const isExactCurrentMonth = (
    summaryType === 'monthly' && 
    requestYear === currentYear && 
    requestMonth === currentMonth &&
    endDate >= today
  );
  
  // 🔒 STRICT: Week must include today
  const isCurrentWeek = summaryType === 'weekly' && start <= now && end >= now && endDate >= today;
  
  const isPastPeriod = !isExactCurrentMonth && !isCurrentWeek;
  
  console.log(`🔒 STRICT PERIOD CLASSIFICATION:`, {
    today,
    startDate,
    endDate,
    currentYear,
    currentMonth,
    requestYear,
    requestMonth,
    isExactCurrentMonth,
    isCurrentWeek,
    isPastPeriod,
    decision: isPastPeriod ? '💾 DATABASE (past period)' : '🔄 CACHE (current period)'
  });
  
  let storedSummary, error;
  
  if (summaryType === 'weekly') {
    // 📅 WEEKLY DATA: Always use campaign_summaries table
    console.log(`📅 Searching for weekly data in campaign_summaries between ${startDate} and ${endDate}`);
    
    const { data: weeklyResults, error: weeklyError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', clientId)
      .eq('summary_type', 'weekly')
      .eq('platform', platform)
      .gte('summary_date', startDate)
      .lte('summary_date', endDate)
      .order('summary_date', { ascending: false })
      .limit(1);
    
    if (weeklyResults && weeklyResults.length > 0) {
      storedSummary = weeklyResults[0];
      error = null;
      console.log(`✅ Found weekly data for ${storedSummary.summary_date} (requested ${startDate}-${endDate})`);
    } else {
      // Try broader search - within 7 days of start date
      console.log(`📅 No exact match, searching within 7 days of ${startDate}`);
      
      const weekBefore = new Date(startDate);
      weekBefore.setDate(weekBefore.getDate() - 3);
      const weekAfter = new Date(startDate);
      weekAfter.setDate(weekAfter.getDate() + 3);
      
      const { data: broadResults, error: broadError } = await supabase
        .from('campaign_summaries')
        .select('*')
        .eq('client_id', clientId)
        .eq('summary_type', 'weekly')
        .eq('platform', platform)
        .gte('summary_date', weekBefore.toISOString().split('T')[0])
        .lte('summary_date', weekAfter.toISOString().split('T')[0])
        .order('summary_date', { ascending: false })
        .limit(1);
      
      if (broadResults && broadResults.length > 0) {
        storedSummary = broadResults[0];
        error = null;
        console.log(`✅ Found nearby weekly data for ${storedSummary.summary_date} (requested ${startDate})`);
      } else {
        storedSummary = null;
        error = broadError || { message: 'No weekly data found in date range' };
      }
    }
  } else {
    // 📅 MONTHLY DATA: Prioritize campaign_summaries (has campaign details), fallback to daily_kpi_data
    console.log(`📅 Searching for monthly data - trying campaign_summaries first for ${startDate}`);
    
    // Try campaign_summaries first (has full campaign details)
    const { data: monthlyResult, error: monthlyError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', clientId)
      .eq('summary_date', startDate)
      .eq('summary_type', 'monthly')
      .eq('platform', platform)
      .single();
      
    console.log(`🔍 campaign_summaries query result:`, {
      found: !!monthlyResult,
      error: monthlyError?.message,
      campaignsCount: monthlyResult?.campaign_data?.length || 0,
      totalSpend: monthlyResult?.total_spend,
      platform: monthlyResult?.platform,
      query: { clientId, startDate, platform }
    });
      
    if (monthlyResult) {
      storedSummary = monthlyResult;
      error = null;
      console.log(`✅ Found monthly data in campaign_summaries with ${monthlyResult.campaign_data?.length || 0} campaigns`);
    } else {
      // Fallback to daily_kpi_data aggregation if campaign_summaries doesn't exist
      console.log(`⚠️ No campaign_summaries found, trying daily_kpi_data aggregation`);
      
      const { data: dailyRecords, error: dailyError } = await supabase
        .from('daily_kpi_data')
        .select('*')
        .eq('client_id', clientId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });
        
      if (dailyRecords && dailyRecords.length > 0) {
      console.log(`✅ Found ${dailyRecords.length} daily records, aggregating for monthly total`);
      
      // Aggregate daily records into monthly summary format
      const totalSpend = dailyRecords.reduce((sum, record) => sum + (record.total_spend || 0), 0);
      const totalImpressions = dailyRecords.reduce((sum, record) => sum + (record.total_impressions || 0), 0);
      const totalClicks = dailyRecords.reduce((sum, record) => sum + (record.total_clicks || 0), 0);
      const totalConversions = dailyRecords.reduce((sum, record) => sum + (record.total_conversions || 0), 0);
      
      // Calculate derived metrics
      const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const averageCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
      
      // Aggregate conversion metrics
      const click_to_call = dailyRecords.reduce((sum, record) => sum + (record.click_to_call || 0), 0);
      const email_contacts = dailyRecords.reduce((sum, record) => sum + (record.email_contacts || 0), 0);
      const booking_step_1 = dailyRecords.reduce((sum, record) => sum + (record.booking_step_1 || 0), 0);
      const booking_step_2 = dailyRecords.reduce((sum, record) => sum + (record.booking_step_2 || 0), 0);
      const reservations = dailyRecords.reduce((sum, record) => sum + (record.reservations || 0), 0);
      const reservation_value = dailyRecords.reduce((sum, record) => sum + (record.reservation_value || 0), 0);
      
      // Create synthetic monthly summary from daily data
      storedSummary = {
        client_id: clientId,
        summary_date: startDate,
        summary_type: 'monthly',
        platform: platform,
        total_spend: totalSpend,
        total_impressions: totalImpressions,
        total_clicks: totalClicks,
        total_conversions: totalConversions,
        average_ctr: averageCtr,
        average_cpc: averageCpc,
        click_to_call,
        email_contacts,
        booking_step_1,
        booking_step_2,
        reservations,
        reservation_value,
        campaign_data: [], // Not needed for totals
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      error = null;
      
      console.log(`✅ Aggregated daily data: ${totalSpend.toFixed(2)} PLN, ${totalClicks} clicks from ${dailyRecords.length} days`);
      } else {
        // No data found in either source
        console.log(`⚠️ No daily records or campaign_summaries found for ${startDate}`);
        storedSummary = null;
        error = { message: 'No data found' };
      }
    }
  }

  if (error || !storedSummary) {
    console.log(`⚠️ No stored ${summaryType} data found, falling back to live fetch`);
    return null;
  }

  console.log(`✅ Found stored ${summaryType} data in database`);
  console.log(`🔍 DEBUG: campaign_data type:`, typeof storedSummary.campaign_data);
  console.log(`🔍 DEBUG: campaign_data length:`, Array.isArray(storedSummary.campaign_data) ? storedSummary.campaign_data.length : 'not array');
  console.log(`🔍 DEBUG: campaign_data sample:`, storedSummary.campaign_data ? JSON.stringify(storedSummary.campaign_data).substring(0, 200) : 'null');
  
  // Extract data from stored summary
  const campaigns = storedSummary.campaign_data || [];
  const totals = {
    totalSpend: storedSummary.total_spend || 0,
    totalImpressions: storedSummary.total_impressions || 0,
    totalClicks: storedSummary.total_clicks || 0,
    totalConversions: storedSummary.total_conversions || 0,
    averageCtr: storedSummary.average_ctr || 0,
    averageCpc: storedSummary.average_cpc || 0
  };

  // ENHANCED: Use aggregated conversion metrics from database if available
  let conversionMetrics;
  
  if (storedSummary.click_to_call !== null && storedSummary.click_to_call !== undefined) {
    // Use pre-aggregated conversion metrics from database columns (preferred)
    conversionMetrics = {
      click_to_call: storedSummary.click_to_call || 0,
      email_contacts: storedSummary.email_contacts || 0,
      booking_step_1: storedSummary.booking_step_1 || 0,
      reservations: storedSummary.reservations || 0,
      reservation_value: storedSummary.reservation_value || 0,
      booking_step_2: storedSummary.booking_step_2 || 0,
      booking_step_3: storedSummary.booking_step_3 || 0,
      roas: storedSummary.roas || 0,
      cost_per_reservation: storedSummary.cost_per_reservation || 0,
      // Add performance metrics from meta_tables
      reach: storedSummary.meta_tables?.performanceMetrics?.reach || 0,
      offline_reservations: storedSummary.meta_tables?.performanceMetrics?.offline_reservations || 0,
      offline_value: storedSummary.meta_tables?.performanceMetrics?.offline_value || 0
    };
    
    console.log(`📊 Using real conversion metrics from database:`, conversionMetrics);
  } else {
    // Fallback: Calculate from campaign data (legacy support)
    conversionMetrics = {
      click_to_call: campaigns.reduce((sum: number, c: any) => sum + (c.click_to_call || 0), 0),
      email_contacts: campaigns.reduce((sum: number, c: any) => sum + (c.email_contacts || 0), 0),
      booking_step_1: campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_1 || 0), 0),
      reservations: campaigns.reduce((sum: number, c: any) => sum + (c.reservations || 0), 0),
      reservation_value: campaigns.reduce((sum: number, c: any) => sum + (c.reservation_value || 0), 0),
      booking_step_2: campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_2 || 0), 0),
      booking_step_3: campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_3 || 0), 0),
      roas: totals.totalSpend > 0 ? campaigns.reduce((sum: number, c: any) => sum + (c.reservation_value || 0), 0) / totals.totalSpend : 0,
      cost_per_reservation: campaigns.reduce((sum: number, c: any) => sum + (c.reservations || 0), 0) > 0 ? 
        totals.totalSpend / campaigns.reduce((sum: number, c: any) => sum + (c.reservations || 0), 0) : 0,
      // Add performance metrics from meta_tables (fallback also uses stored data)
      reach: storedSummary.meta_tables?.performanceMetrics?.reach || 0,
      offline_reservations: storedSummary.meta_tables?.performanceMetrics?.offline_reservations || 0,
      offline_value: storedSummary.meta_tables?.performanceMetrics?.offline_value || 0
    };
    
    console.log(`📊 Calculated conversion metrics from campaign data (fallback):`, conversionMetrics);
  }

  return {
    client: {
      id: clientId,
      currency: 'PLN'
    },
    campaigns,
    stats: totals,
    conversionMetrics,
    metaTables: storedSummary.meta_tables, // ✅ RESTORED: Include stored meta tables data
    dateRange: {
      start: startDate,
      end: endDate
    },
    accountInfo: {
      currency: 'PLN',
      timezone: 'Europe/Warsaw',
      status: 'ACTIVE'
    },
    fromDatabase: true,
    summaryType: summaryType
  };
}
  
  export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  // 🔧 CACHE-FIRST ENFORCEMENT: Strict policy to prevent cache bypassing
  const ENFORCE_STRICT_CACHE_FIRST = true;
  
  try {
    logger.info('Live data fetch started', { 
      endpoint: '/api/fetch-live-data',
      cacheFirstEnforced: ENFORCE_STRICT_CACHE_FIRST
    });
    
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createErrorResponse(authResult.error || 'Authentication failed', 401);
    }
    const user = authResult.user;
    logger.info('🔐 Fetch-live-data authenticated for user:', user.email);
    
    // Parse request body
    const requestBody = await request.json();
    const { dateRange, clientId, clearCache, forceFresh, platform = 'meta', reason } = requestBody;
    
    if (!clientId) {
      return createErrorResponse('Client ID required', 400);
    }
    
    // Get client data
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();
      
    if (clientError || !clientData) {
      console.error('❌ Client not found:', { clientId, error: clientError });
      return createErrorResponse('Client not found', 404);
    }
    
    logger.info('Success', {
      id: clientData.id,
      name: clientData.name,
      email: clientData.email,
      hasAdAccountId: !!clientData.ad_account_id,
      hasMetaToken: !!clientData.meta_access_token,
      adAccountId: clientData.ad_account_id
    });
    
    // Access control handled by authentication middleware
    
    const client = clientData;

    // ✅ NEW: Use StandardizedDataFetcher if request comes from standardized system
    if (reason?.includes('standardized') || reason?.includes('period-') || reason?.includes('meta_performance')) {
      logger.info('🎯 Using StandardizedDataFetcher for request:', { reason, clientId, dateRange, platform });
      
      try {
        const result = await StandardizedDataFetcher.fetchData({
          clientId,
          dateRange: dateRange || { start: '', end: '' },
          platform: platform as 'meta' | 'google',
          reason,
          sessionToken: undefined // Server-side doesn't need token
        });
        
        const responseTime = Date.now() - startTime;
        logger.info('✅ StandardizedDataFetcher completed:', {
          success: result.success,
          source: result.debug?.source,
          responseTime
        });
        
        return NextResponse.json({
          ...result,
          debug: {
            ...result.debug,
            authenticatedUser: user.email,
            responseTime
          }
        });
      } catch (error) {
        logger.error('❌ StandardizedDataFetcher failed:', error);
        // Fall through to legacy logic as fallback
      }
    }

    // Legacy logic for non-standardized requests (keep for backwards compatibility)
    let startDate: string;
    let endDate: string;
    let rangeAnalysis;
    let apiMethod;
    
    if (dateRange?.start && dateRange?.end) {
      startDate = dateRange.start;
      endDate = dateRange.end;
      
      logger.info('📅 Received date range:', { startDate, endDate });
      
      // Check if this is an all-time request (very old start date)
      const startDateObj = new Date(startDate);
      const currentDate = new Date();
      const maxPastDate = new Date(currentDate);
      maxPastDate.setMonth(maxPastDate.getMonth() - 37); // Meta API limit
      
      const isAllTimeRequest = startDateObj.getFullYear() <= 2010;
      const isWithinAPILimits = startDateObj >= maxPastDate;
      
      // Additional check: if the date range is very large (more than 2 years), treat as all-time request
      const endDateObj = new Date(endDate);
      const daysDiff = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const isLargeRangeRequest = daysDiff > 730; // More than 2 years
      
      // Check if this is an all-time request by looking at the reason parameter
      const isAllTimeByReason = reason?.includes('all-time') || reason?.includes('standardized-live');
      
      const isAllTimeOrLargeRange = isAllTimeRequest || isLargeRangeRequest || isAllTimeByReason;
      
      logger.info('📅 Request type:', { 
        isAllTimeRequest, 
        isLargeRangeRequest,
        isAllTimeByReason,
        isAllTimeOrLargeRange,
        startYear: startDateObj.getFullYear(),
        daysDiff,
        isWithinAPILimits,
        maxPastDate: maxPastDate.toISOString().split('T')[0],
        requestedStartDate: startDate,
        reason
      });
      
      // Only validate date range for requests within API limits AND not all-time/large range requests
      if (isWithinAPILimits && !isAllTimeOrLargeRange) {
        const validation = validateDateRange(startDate, endDate);
        logger.info('📅 Date range validation result:', validation);
        
        if (!validation.isValid) {
          logger.error('Error occurred', validation.error);
          return NextResponse.json({ 
            error: 'Invalid date range', 
            details: validation.error
          }, { status: 400 });
        }
      } else if (isAllTimeOrLargeRange) {
        logger.info('📅 All-time or large range request detected, skipping date range validation');
      } else {
        logger.info('⚠️ Date range exceeds Meta API limits (37 months), but proceeding anyway');
      }
      
      // Analyze date range
      rangeAnalysis = analyzeDateRange(startDate, endDate);
      apiMethod = selectMetaAPIMethod({ start: startDate, end: endDate });
      
      console.log(`📅 Date range analysis:`, {
        rangeType: rangeAnalysis.rangeType,
        daysDiff: rangeAnalysis.daysDiff,
        isValidMonthly: rangeAnalysis.isValidMonthly,
        selectedMethod: apiMethod.method
      });
    } else {
      // Default to last 30 days if no date range provided
      const currentDate = new Date();
      endDate = currentDate.toISOString().split('T')[0] || '';
      const defaultStart = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      startDate = defaultStart.toISOString().split('T')[0] || '';
      
      rangeAnalysis = analyzeDateRange(startDate, endDate);
      apiMethod = selectMetaAPIMethod({ start: startDate, end: endDate });
    }

          logger.info('📅 Date range for API call:', { startDate, endDate, method: apiMethod.method });

      // SMART ROUTING: Determine request type first, then check if current or historical
      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const requestType = daysDiff <= 8 ? 'weekly' : 'monthly'; // 🔧 FIX: Allow up to 8 days for weekly (week can span month boundary)
      
      // Apply current/historical logic based on request type
      const isCurrentMonthRequest = requestType === 'monthly' && isCurrentMonth(startDate, endDate);
      const isCurrentWeekRequest = requestType === 'weekly' && isCurrentWeek(startDate, endDate);
      
      console.log(`📊 CRITICAL DEBUG - ROUTING ANALYSIS:`, {
        startDate,
        endDate,
        daysDiff,
        requestType,
        currentSystemDate: new Date().toISOString(),
        currentYear: new Date().getFullYear(),
        currentMonth: new Date().getMonth() + 1,
        isCurrentMonthRequest,
        isCurrentWeekRequest,
        forceFresh,
        forceFreshType: typeof forceFresh,
        cacheFirstEnforced: ENFORCE_STRICT_CACHE_FIRST,
        routingDecision: isCurrentMonthRequest ? 'SMART CACHE (MONTHLY)' : 
                        isCurrentWeekRequest ? 'SMART CACHE (WEEKLY)' : 'DATABASE FIRST',
        willUseWeeklyCache: isCurrentWeekRequest && !forceFresh,
        willUseDatabaseLookup: !forceFresh && !isCurrentMonthRequest && !isCurrentWeekRequest,
        cacheBypassAllowed: !ENFORCE_STRICT_CACHE_FIRST || forceFresh
      });

      // CRITICAL DEBUG: Check exactly why database cache might be skipped
      console.log(`🔍 CRITICAL DEBUG - CACHE CONDITIONS:`, {
        'isCurrentMonthRequest': isCurrentMonthRequest,
        'NOT forceFresh': !forceFresh,
        'Combined condition (isCurrentMonthRequest && !forceFresh)': isCurrentMonthRequest && !forceFresh,
        'Will check database cache': isCurrentMonthRequest && !forceFresh
      });
      
      if (!isCurrentMonthRequest && !isCurrentWeekRequest) {
        // Previous periods: STRICT DATABASE-FIRST POLICY
        console.log('📊 🔒 HISTORICAL PERIOD - ENFORCING DATABASE-FIRST POLICY');
        
        if (!forceFresh || !ENFORCE_STRICT_CACHE_FIRST) {
          logger.info('📊 Checking database for previous period data...');
          const databaseResult = await loadFromDatabase(clientId, startDate, endDate, platform);
          
          if (databaseResult) {
            const responseTime = Date.now() - startTime;
            console.log(`🚀 ✅ DATABASE SUCCESS: Historical data loaded in ${responseTime}ms`);
            
            return NextResponse.json({
              success: true,
              data: {
                ...databaseResult,
                dataSourceValidation: {
                  expectedSource: 'database',
                  actualSource: 'database',
                  cacheFirstEnforced: ENFORCE_STRICT_CACHE_FIRST,
                  isHistoricalPeriod: true
                }
              },
              debug: {
                source: 'database-historical',
                responseTime,
                authenticatedUser: user.email,
                currency: 'PLN',
                cachePolicy: 'strict-database-first'
              }
            });
          } else {
            console.log('⚠️ No historical data found in database');
            
            // 🔧 STRICT ENFORCEMENT: Only allow live API for historical data if explicitly forced
            if (ENFORCE_STRICT_CACHE_FIRST && !forceFresh) {
              console.log('🔒 CACHE-FIRST ENFORCEMENT: Blocking live API call for historical period');
              return NextResponse.json({
                success: false,
                error: 'No historical data available',
                data: null,
                debug: {
                  source: 'database-not-found',
                  responseTime: Date.now() - startTime,
                  authenticatedUser: user.email,
                  currency: 'PLN',
                  cachePolicy: 'strict-database-first-blocked',
                  reason: 'Historical data not found and live API blocked by cache-first policy'
                }
              });
            }
          }
        }
        
        // Only reach here if forceFresh=true AND cache enforcement allows it
        if (forceFresh && ENFORCE_STRICT_CACHE_FIRST) {
          // Force fresh for historical period - fetch from Meta API
          logger.info('🔄 FORCE FRESH REQUESTED FOR HISTORICAL PERIOD - FETCHING FROM META API');
          
          // Get client data for Meta API call
          const { data: clientData, error: clientError } = await supabase
            .from('clients')
            .select('*')
            .eq('id', clientId)
            .single();
            
          if (clientError || !clientData) {
            throw new Error('Client not found for Meta API call');
          }
          
          // Import MetaAPIService dynamically
          const { MetaAPIService } = await import('../../../lib/meta-api-optimized');
          const metaService = new MetaAPIService(clientData.meta_access_token);
          
          const adAccountId = clientData.ad_account_id.startsWith('act_') 
            ? clientData.ad_account_id.substring(4)
            : clientData.ad_account_id;
          
          logger.info(`🔄 Fetching fresh historical data from Meta API for ${startDate} to ${endDate}`);
          
          // Fetch fresh campaign data from Meta API
          const freshCampaigns = await metaService.getCampaignInsights(
            adAccountId,
            startDate,
            endDate,
            0 // No time increment
          );
          
          logger.info(`✅ Fetched ${freshCampaigns.length} fresh campaigns with real booking steps`);
          
          // Calculate totals from fresh data
          const totalSpend = freshCampaigns.reduce((sum, campaign) => sum + (campaign.spend || 0), 0);
          const totalImpressions = freshCampaigns.reduce((sum, campaign) => sum + (campaign.impressions || 0), 0);
          const totalClicks = freshCampaigns.reduce((sum, campaign) => sum + (campaign.clicks || 0), 0);
          const totalConversions = freshCampaigns.reduce((sum, campaign) => sum + (campaign.conversions || 0), 0);
          const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
          const averageCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
          
          // Calculate conversion metrics from fresh data
          const freshConversionMetrics = {
            click_to_call: freshCampaigns.reduce((sum, c) => sum + (c.click_to_call || 0), 0),
            email_contacts: freshCampaigns.reduce((sum, c) => sum + (c.email_contacts || 0), 0),
            booking_step_1: freshCampaigns.reduce((sum, c) => sum + (c.booking_step_1 || 0), 0),
            booking_step_2: freshCampaigns.reduce((sum, c) => sum + (c.booking_step_2 || 0), 0),
            booking_step_3: freshCampaigns.reduce((sum, c) => sum + (c.booking_step_3 || 0), 0),
            reservations: freshCampaigns.reduce((sum, c) => sum + (c.reservations || 0), 0),
            reservation_value: freshCampaigns.reduce((sum, c) => sum + (c.reservation_value || 0), 0),
            roas: totalSpend > 0 ? freshCampaigns.reduce((sum, c) => sum + (c.reservation_value || 0), 0) / totalSpend : 0,
            cost_per_reservation: freshCampaigns.reduce((sum, c) => sum + (c.reservations || 0), 0) > 0 ? 
              totalSpend / freshCampaigns.reduce((sum, c) => sum + (c.reservations || 0), 0) : 0
          };
          
          logger.info('📊 Fresh conversion metrics with real booking steps:', freshConversionMetrics);
          
          const freshData = {
            client: { id: clientId, currency: 'PLN' },
            campaigns: freshCampaigns,
            stats: {
              totalSpend,
              totalImpressions,
              totalClicks,
              totalConversions,
              averageCtr,
              averageCpc
            },
            conversionMetrics: freshConversionMetrics,
            metaTables: null, // Could fetch this too if needed
            dateRange: { start: startDate, end: endDate },
            accountInfo: {
              currency: 'PLN',
              timezone: 'Europe/Warsaw',
              status: 'ACTIVE'
            },
            fromDatabase: false,
            freshData: true
          };
          
          const responseTime = Date.now() - startTime;
          console.log(`🚀 Fresh Meta API lookup completed in ${responseTime}ms`);
          
          return NextResponse.json({
            success: true,
            data: freshData,
            debug: {
              source: 'meta-api-fresh-historical',
              responseTime,
              authenticatedUser: 'auth-disabled',
              currency: 'PLN',
              reason: 'Force fresh historical data with real booking steps'
            }
          });
        }
      } else if (isCurrentWeekRequest && !forceFresh) {
        // Current week: Use smart cache (3-hour refresh) for weekly data
        logger.info('📊 🟡 CURRENT WEEK DETECTED - CHECKING WEEKLY SMART CACHE...');
        
        try {
          // Generate period ID from date range
          const requestedPeriodId = generatePeriodIdFromDateRange(dateRange.start, dateRange.end);
          logger.info('📅 Generated period ID for weekly cache:', { requestedPeriodId, dateRange });
          
          // Use the shared weekly smart cache helper
          const { getSmartWeekCacheData } = await import('../../../lib/smart-cache-helper');
          const cacheResult = await getSmartWeekCacheData(clientId, false, requestedPeriodId || undefined);
          
          // 🔧 DEBUG: Log what smart cache actually returned
          console.log('🔍 SMART CACHE RESULT ANALYSIS:', {
            periodId: requestedPeriodId,
            success: cacheResult.success,
            shouldUseDatabase: cacheResult.shouldUseDatabase,
            campaignCount: cacheResult.data?.campaigns?.length || 0,
            totalSpend: cacheResult.data?.stats?.totalSpend || 0,
            source: cacheResult.source,
            fromCache: cacheResult.data?.fromCache,
            hasData: !!cacheResult.data,
            willReturnData: cacheResult.success && cacheResult.data?.campaigns?.length >= 0
          });
          
          if (cacheResult.shouldUseDatabase) {
            // Historical week - use database lookup instead of smart cache
            logger.info('📚 Historical week detected, using database lookup instead of smart cache');
            const dbResult = await loadFromDatabase(clientId, dateRange.start, dateRange.end, platform);
            
            if (dbResult) {
              const responseTime = Date.now() - startTime;
              logger.info(`✅ Historical weekly data loaded from database in ${responseTime}ms`);
              
              return NextResponse.json({
                success: true,
                data: dbResult,
                debug: {
                  source: 'historical-database',
                  responseTime,
                  authenticatedUser: user.email,
                  currency: 'PLN',
                  period: requestedPeriodId || 'historical-week'
                }
              });
            } else {
              logger.info('⚠️ No historical data found in database, falling back to live fetch');
            }
          } else if (cacheResult.success && cacheResult.data.campaigns.length >= 0) {
            const responseTime = Date.now() - startTime;
            console.log(`🚀 Weekly smart cache returned data in ${responseTime}ms`);
            console.log(`📊 Weekly cache source: ${cacheResult.source}`);
            
            return NextResponse.json({
              success: true,
              data: cacheResult.data,
              debug: {
                source: cacheResult.source,
                responseTime,
                authenticatedUser: user.email,
                currency: 'PLN',
                period: requestedPeriodId || 'current-week'
              }
            });
          }
        } catch (cacheError) {
          console.error('⚠️ Weekly smart cache failed, falling back to live fetch:', cacheError);
        }
      } else if (isCurrentMonthRequest && !forceFresh) {
        // Current month: USE SMART CACHE SYSTEM
        logger.info('📊 🔴 CURRENT MONTH DETECTED - USING SMART CACHE SYSTEM...');
        logger.debug('Debug info', {
          clientId,
          currentTime: new Date().toISOString()
        });
        
        try {
          // Use the smart cache system for current month
          const { getSmartCacheData } = await import('../../../lib/smart-cache-helper');
          const smartCacheResult = await getSmartCacheData(clientId, false, platform);
          
          if (smartCacheResult.success && smartCacheResult.data) {
            const responseTime = Date.now() - startTime;
            console.log(`🚀 ✅ SMART CACHE SUCCESS: Current month data loaded in ${responseTime}ms`);
            console.log(`📊 Smart cache data structure:`, {
              hasCampaigns: !!smartCacheResult.data.campaigns,
              campaignsCount: smartCacheResult.data.campaigns?.length || 0,
              hasStats: !!smartCacheResult.data.stats,
              totalSpend: smartCacheResult.data.stats?.totalSpend || 0
            });
            
            return NextResponse.json({
              success: true,
              data: smartCacheResult.data,
              debug: {
                source: smartCacheResult.source || 'smart-cache',
                responseTime,
                cacheAge: smartCacheResult.data.cacheAge || 0,
                authenticatedUser: user.email,
                currency: 'PLN',
                cacheInfo: 'Smart cache (current month)'
              }
            });
          } else {
            console.log('⚠️ Smart cache failed, falling back to live API...');
          }
        } catch (smartCacheError) {
          console.error('⚠️ Smart cache failed, falling back to live API:', smartCacheError);
        }
        
        // Fallback to database cache if smart cache fails
        try {
          // Check database cache directly (no complex smart cache logic)
          const now = new Date();
          const currentYear = now.getFullYear();
          const currentMonth = now.getMonth() + 1;
          const periodId = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
          
          logger.debug('Debug info', {
            periodId,
            clientId,
            tableName: 'current_month_cache'
          });

          // Try the database query with better error handling
          // Using standard Supabase query (avoiding TypeScript issues)
          const { data: cacheQueryResult, error: cacheQueryError } = await supabase
            .from('current_month_cache')
            .select('cache_data, last_updated')
            .eq('client_id', clientId)
            .eq('period_id', periodId)
            .maybeSingle(); // Use maybeSingle instead of single to avoid "no rows" errors

          logger.debug('Debug info', {
            hasResult: !!cacheQueryResult,
            hasError: !!cacheQueryError,
            errorMessage: cacheQueryError?.message,
            errorCode: cacheQueryError?.code,
            resultType: typeof cacheQueryResult,
            resultKeys: cacheQueryResult ? Object.keys(cacheQueryResult) : null
          });

          let cachedData = cacheQueryResult;
          let cacheError = cacheQueryError;

          logger.info('🔍 CRITICAL DEBUG - Parsing database query result...');
          
          logger.debug('Debug info', {
            hasData: !!cachedData,
            hasError: !!cacheError,
            errorMessage: cacheError?.message,
            errorCode: cacheError?.code,
            dataKeys: cachedData ? Object.keys(cachedData) : null
          });

          if (cacheError) {
            logger.error('Error occurred', cacheError);
          }

          if (cachedData) {
            const cacheAge = Date.now() - new Date(cachedData.last_updated).getTime();
            const cacheAgeHours = cacheAge / (1000 * 60 * 60);
            const isCacheFresh = cacheAgeHours < 6; // 6 hour cache (was 3)

            logger.debug('Debug info', {
              cacheAge,
              cacheAgeHours,
              isCacheFresh,
              lastUpdated: cachedData.last_updated
            });

            // 🔧 ENHANCED: Check if cache has conversion metrics, if not, enhance with campaign_summaries data
            let enhancedCacheData = { ...cachedData.cache_data };
            let needsConversionEnhancement = false;
            
            // Check if conversion metrics are missing or zero
            if (!enhancedCacheData.conversionMetrics || 
                (enhancedCacheData.conversionMetrics.reservations === 0 && 
                 enhancedCacheData.conversionMetrics.booking_step_1 === 0)) {
              needsConversionEnhancement = true;
              logger.info('🔧 Cache missing conversion metrics - will enhance with campaign_summaries data');
            }

            if (isCacheFresh) {
              logger.info('Success', {
                cacheAgeMinutes: Math.round(cacheAge / 1000 / 60),
                lastUpdated: cachedData.last_updated,
                needsConversionEnhancement
              });

              // If conversion metrics are missing, enhance the cache data
              if (needsConversionEnhancement) {
                try {
                  logger.info('🔧 Enhancing cache with conversion metrics from campaign_summaries...');
                  
                  // Get current month data from campaign_summaries
                  const now = new Date();
                  const currentYear = now.getFullYear();
                  const currentMonth = now.getMonth() + 1;
                  const monthStartDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
                  
                  const { data: summaryData, error: summaryError } = await supabase
                    .from('campaign_summaries')
                    .select('*')
                    .eq('client_id', clientId)
                    .eq('summary_date', monthStartDate)
                    .eq('summary_type', 'monthly')
                    .maybeSingle();
                  
                  if (summaryData && !summaryError) {
                    // Enhance cache data with conversion metrics
                    enhancedCacheData.conversionMetrics = {
                      click_to_call: summaryData.click_to_call || 0,
                      email_contacts: summaryData.email_contacts || 0,
                      booking_step_1: summaryData.booking_step_1 || 0,
                      reservations: summaryData.reservations || 0,
                      reservation_value: summaryData.reservation_value || 0,
                      booking_step_2: summaryData.booking_step_2 || 0,
                      booking_step_3: summaryData.booking_step_3 || 0,
                      roas: summaryData.roas || 0,
                      cost_per_reservation: summaryData.cost_per_reservation || 0
                    };
                    
                    logger.info('✅ Successfully enhanced cache with conversion metrics:', enhancedCacheData.conversionMetrics);
                  } else {
                    logger.warn('⚠️ Could not enhance cache - no campaign_summaries data found');
                  }
                } catch (enhanceError) {
                  logger.error('❌ Error enhancing cache with conversion metrics:', enhanceError);
                }
              }

              const responseTime = Date.now() - startTime;
              return NextResponse.json({
                success: true,
                data: {
                  ...enhancedCacheData,
                  fromCache: true,
                  cacheAge: cacheAge,
                  enhancedWithConversionMetrics: needsConversionEnhancement,
                  dataSourceValidation: {
                    expectedSource: 'smart-cache',
                    actualSource: 'smart-cache-fresh',
                    cacheFirstEnforced: ENFORCE_STRICT_CACHE_FIRST,
                    isCurrentPeriod: true
                  }
                },
                debug: {
                  source: 'database-cache-enhanced',
                  responseTime,
                  cacheAge: cacheAge,
                  authenticatedUser: user.email,
                  currency: 'PLN',
                  cacheInfo: `Fresh cache (${Math.round(cacheAge / 1000 / 60)} minutes old)${needsConversionEnhancement ? ' + enhanced conversion metrics' : ''}`,
                  cachePolicy: 'smart-cache-fresh'
                }
              });
            } else {
              // 🔧 FIX: ALWAYS return stale cache instead of bypassing to Meta API
              logger.warn('Warning', {
                cacheAgeHours: Math.round(cacheAgeHours * 10) / 10,
                lastUpdated: cachedData.last_updated,
                policy: 'database-first',
                needsConversionEnhancement
              });

              // If conversion metrics are missing, enhance the stale cache data too
              if (needsConversionEnhancement) {
                try {
                  logger.info('🔧 Enhancing stale cache with conversion metrics from campaign_summaries...');
                  
                  // Get current month data from campaign_summaries
                  const now = new Date();
                  const currentYear = now.getFullYear();
                  const currentMonth = now.getMonth() + 1;
                  const monthStartDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
                  
                  const { data: summaryData, error: summaryError } = await supabase
                    .from('campaign_summaries')
                    .select('*')
                    .eq('client_id', clientId)
                    .eq('summary_date', monthStartDate)
                    .eq('summary_type', 'monthly')
                    .maybeSingle();
                  
                  if (summaryData && !summaryError) {
                    // Enhance cache data with conversion metrics
                    enhancedCacheData.conversionMetrics = {
                      click_to_call: summaryData.click_to_call || 0,
                      email_contacts: summaryData.email_contacts || 0,
                      booking_step_1: summaryData.booking_step_1 || 0,
                      reservations: summaryData.reservations || 0,
                      reservation_value: summaryData.reservation_value || 0,
                      booking_step_2: summaryData.booking_step_2 || 0,
                      booking_step_3: summaryData.booking_step_3 || 0,
                      roas: summaryData.roas || 0,
                      cost_per_reservation: summaryData.cost_per_reservation || 0
                    };
                    
                    logger.info('✅ Successfully enhanced stale cache with conversion metrics:', enhancedCacheData.conversionMetrics);
                  } else {
                    logger.warn('⚠️ Could not enhance stale cache - no campaign_summaries data found');
                  }
                } catch (enhanceError) {
                  logger.error('❌ Error enhancing stale cache with conversion metrics:', enhanceError);
                }
              }

              const responseTime = Date.now() - startTime;
              return NextResponse.json({
                success: true,
                data: {
                  ...enhancedCacheData,
                  fromCache: true,
                  cacheAge: cacheAge,
                  staleData: true,
                  enhancedWithConversionMetrics: needsConversionEnhancement,
                  dataSourceValidation: {
                    expectedSource: 'smart-cache',
                    actualSource: 'smart-cache-stale',
                    cacheFirstEnforced: ENFORCE_STRICT_CACHE_FIRST,
                    isCurrentPeriod: true
                  }
                },
                debug: {
                  source: 'database-cache-stale-enhanced',
                  responseTime,
                  cacheAge: cacheAge,
                  authenticatedUser: user.email,
                  currency: 'PLN',
                  cacheInfo: `Stale cache (${Math.round(cacheAgeHours * 10) / 10} hours old) - database-first policy${needsConversionEnhancement ? ' + enhanced conversion metrics' : ''}`,
                  cachePolicy: 'smart-cache-stale'
                }
              });
            }
          } else {
            // 🔧 FIX: Call enhanced smart cache logic when no cache exists
            logger.info('📊 No cache found - calling enhanced smart cache logic...');
            
            try {
              // Import and call the enhanced fetchFreshCurrentMonthData function
              const { fetchFreshCurrentMonthData } = await import('../../../lib/smart-cache-helper');
              
              // Get client data for the enhanced function
              const { data: clientData, error: clientError } = await supabase
                .from('clients')
                .select('*')
                .eq('id', clientId)
                .single();
                
              if (clientError || !clientData) {
                throw new Error('Client not found');
              }
              
              // Call the enhanced function that integrates daily_kpi_data
              const enhancedData = await fetchFreshCurrentMonthData(clientData);
              
              logger.info('✅ Enhanced smart cache data fetched successfully');
              
              const responseTime = Date.now() - startTime;
              return NextResponse.json({
                success: true,
                data: {
                  ...enhancedData,
                  fromCache: false,
                  enhancedLogic: true,
                  source: 'enhanced-smart-cache'
                },
                debug: {
                  source: 'enhanced-smart-cache',
                  responseTime,
                  authenticatedUser: user.email,
                  currency: 'PLN',
                  cacheInfo: 'Enhanced logic with daily_kpi_data integration'
                }
              });
              
            } catch (enhancedError) {
              logger.error('❌ Enhanced smart cache failed, falling back to empty structure:', enhancedError);
              
              // Fallback to empty structure if enhanced logic fails
              const responseTime = Date.now() - startTime;
              return NextResponse.json({
                success: true,
                data: {
                  campaigns: [],
                  stats: {
                    totalSpend: 0,
                    totalImpressions: 0,
                    totalClicks: 0,
                    totalConversions: 0,
                    averageCtr: 0,
                    averageCpc: 0
                  },
                  conversionMetrics: {
                    click_to_call: 0,
                    email_contacts: 0,
                    booking_step_1: 0,
                    reservations: 0,
                    reservation_value: 0,
                    roas: 0,
                    cost_per_reservation: 0,
                    booking_step_2: 0
                  },
                  fromCache: false,
                  noData: true,
                  enhancedLogicFailed: true
                },
                debug: {
                  source: 'database-no-cache-fallback',
                  responseTime,
                  authenticatedUser: user.email,
                  currency: 'PLN',
                  cacheInfo: 'Enhanced logic failed - fallback to empty structure'
                }
              });
            }
          }
        } catch (cacheError) {
          // 🔧 FIX: Return empty data instead of bypassing to Meta API on error
          logger.error('Error occurred', cacheError);
          
          const responseTime = Date.now() - startTime;
          return NextResponse.json({
            success: true,
            data: {
              campaigns: [],
              stats: {
                totalSpend: 0,
                totalImpressions: 0,
                totalClicks: 0,
                totalConversions: 0,
                averageCtr: 0,
                averageCpc: 0
              },
              conversionMetrics: {
                click_to_call: 0,
                email_contacts: 0,
                booking_step_1: 0,
                reservations: 0,
                reservation_value: 0,
                roas: 0,
                cost_per_reservation: 0,
                booking_step_2: 0
              },
              fromCache: false,
              error: true
            },
            debug: {
              source: 'database-error',
              responseTime,
              authenticatedUser: 'auth-disabled',
              currency: 'PLN',
              cacheInfo: 'Database error - database-first policy',
              error: cacheError instanceof Error ? cacheError.message : 'Unknown error'
            }
          });
        }
      } else {
        logger.debug('Debug info', {
          isCurrentMonthRequest,
          forceFresh,
          condition: `${isCurrentMonthRequest} && !${forceFresh}`,
          result: isCurrentMonthRequest && !forceFresh
        });
      }

            // 🔧 BYPASS PROTECTION DISABLED - Allow cache to work
      // The original bypass protection was blocking cache usage
      // This caused the dashboard to always show zero values
      // Cache checking logic should work normally now
      
      console.log('🔄 Cache checking logic enabled - bypass protection disabled');
      
// Only reach here if forceFresh: true OR cache enforcement is disabled
      if (ENFORCE_STRICT_CACHE_FIRST && !forceFresh) {
        console.log('🔒 CACHE-FIRST ENFORCEMENT: Blocking live API call - no valid cache found but enforcement is active');
        const responseTime = Date.now() - startTime;
        return NextResponse.json({
          success: false,
          error: 'No cached data available',
          data: null,
          debug: {
            source: 'cache-enforcement-block',
            responseTime,
            authenticatedUser: 'auth-disabled',
            currency: 'PLN',
            cachePolicy: 'strict-cache-first-blocked',
            reason: 'Live API blocked by cache-first enforcement policy'
          }
        });
      }

      console.log(`🔄 EXPLICIT FORCE REFRESH - Proceeding with live Meta API fetch (forceFresh: ${forceFresh}, enforcement: ${ENFORCE_STRICT_CACHE_FIRST})`);
      logger.info('🔍 Meta API call reason: Explicit force refresh requested or cache enforcement disabled');

      // 🔧 ENHANCED: Even with forceFresh: true, use enhanced logic for current month
      if (isCurrentMonthRequest) {
        console.log('🔧 ENHANCED: Force refresh for current month - using enhanced smart cache logic...');
        console.log('🔧 This will ensure reports page gets conversionMetrics with real data from daily_kpi_data');
        
        try {
          // Import and call the enhanced fetchFreshCurrentMonthData function
          const { fetchFreshCurrentMonthData } = await import('../../../lib/smart-cache-helper');
          
          // Call the enhanced function that integrates daily_kpi_data
          const enhancedData = await fetchFreshCurrentMonthData(client);
          
          logger.info('✅ Enhanced smart cache data fetched successfully with forceFresh: true');
          
          const responseTime = Date.now() - startTime;
          return NextResponse.json({
            success: true,
            data: {
              ...enhancedData,
              fromCache: false,
              enhancedLogic: true,
              source: 'enhanced-smart-cache-force-fresh'
            },
            debug: {
              source: 'enhanced-smart-cache-force-fresh',
              responseTime,
              authenticatedUser: 'auth-disabled',
              currency: 'PLN',
              cacheInfo: 'Enhanced logic with forceFresh: true',
              forceFresh: true
            }
          });
          
        } catch (enhancedError) {
          logger.error('❌ Enhanced smart cache failed with forceFresh: true, falling back to Meta API:', enhancedError);
          console.log('🔄 Falling back to standard Meta API fetch...');
        }
      }

      // Initialize Meta API service (fallback for non-current month or enhanced logic failure)
      const metaService = new MetaAPIService(client.meta_access_token);
    
    // Check for cache clearing parameter
    const shouldClearCache = clearCache === 'true' || clearCache === true || forceFresh;
    if (shouldClearCache) {
      logger.info('🗑️ Cache clearing requested');
      metaService.clearCache();
    }
    
    // Validate token first
    logger.info('🔐 Validating Meta API token...');
    const tokenValidation = await metaService.validateToken();
    logger.info('🔐 Token validation result:', tokenValidation);
    
    // Also check token info to see permissions
    try {
      const tokenInfo = await metaService.getTokenInfo();
      logger.info('🔐 Token info:', {
        success: tokenInfo.success,
        scopes: tokenInfo.info?.scopes,
        isLongLived: tokenInfo.isLongLived,
        expiresAt: tokenInfo.expiresAt
      });
    } catch (error) {
      logger.warn('Warning', error);
    }
    
    if (!tokenValidation.valid) {
      return NextResponse.json({ 
        error: 'Invalid Meta Ads token', 
        details: tokenValidation.error
      }, { status: 400 });
    }

    // Fetch live campaign insights from Meta API
    logger.info('📈 Fetching campaign insights from Meta API...');
    
    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;
    
    logger.info('🏢 Using ad account ID:', adAccountId);
    
    let campaignInsights: any[] = [];
    let metaApiError: string | null = null;
    
    try {
      if (apiMethod.method === 'getMonthlyCampaignInsights') {
        console.log(`📅 Using monthly insights method for ${apiMethod.parameters.year}-${apiMethod.parameters.month}...`);
        campaignInsights = await metaService.getMonthlyCampaignInsights(
          adAccountId,
          apiMethod.parameters.year,
          apiMethod.parameters.month
        );
      } else {
        console.log(`📅 Using standard campaign insights method with time increment: ${apiMethod.parameters.timeIncrement}...`);
        campaignInsights = await metaService.getCampaignInsights(
          adAccountId,
          apiMethod.parameters.dateStart,
          apiMethod.parameters.dateEnd,
          apiMethod.parameters.timeIncrement
        );
      }

      logger.info('Data processing', {
        count: campaignInsights.length,
        campaigns: campaignInsights.map(c => ({
          id: c.campaign_id,
          name: c.campaign_name,
          spend: c.spend,
          impressions: c.impressions,
          clicks: c.clicks
        }))
      });
    } catch (error) {
      console.error('❌ Failed to fetch campaign insights:', error);
      metaApiError = error instanceof Error ? error.message : 'Unknown error';
      campaignInsights = [];
    }

    // If no campaign-level insights, try to get basic campaign data
    if (campaignInsights.length === 0) {
      logger.info('⚠️ No campaign insights found, trying to get basic campaign data...');
      
      try {
        const allCampaigns = await metaService.getCampaigns(adAccountId);
        logger.info('📋 All campaigns found:', allCampaigns.length);

        if (allCampaigns.length > 0) {
          logger.info('✅ Creating basic campaign data from campaigns list');
          campaignInsights = allCampaigns.map(campaign => ({
            campaign_id: campaign.id,
            campaign_name: campaign.name,
            impressions: 0,
            clicks: 0,
            spend: 0,
            conversions: 0,
            ctr: 0,
            cpc: 0,
            date_start: startDate,
            date_stop: endDate,
            status: campaign.status,
            objective: campaign.objective
          }));
        }
      } catch (campaignError) {
        console.error('❌ Failed to get basic campaign data:', campaignError);
      }
    }

    // Get account info to include currency
    let accountInfo = null;
    try {
      logger.debug('Debug info', adAccountId);
      accountInfo = await metaService.getAccountInfo(adAccountId);
      logger.info('💰 Account info fetched successfully:', {
        currency: accountInfo.currency,
        timezone: accountInfo.timezone_name,
        status: accountInfo.account_status,
        fullResponse: accountInfo
      });
    } catch (error) {
      logger.warn('Warning', error);
      logger.warn('Warning', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
    }

    // Calculate summary stats
    const totalSpend = campaignInsights.reduce((sum, campaign) => sum + campaign.spend, 0);
    const totalImpressions = campaignInsights.reduce((sum, campaign) => sum + campaign.impressions, 0);
    const totalClicks = campaignInsights.reduce((sum, campaign) => sum + campaign.clicks, 0);
    const totalConversions = campaignInsights.reduce((sum, campaign) => sum + campaign.conversions, 0);
    const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const averageCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

    // Calculate conversion tracking totals
    const totalClickToCall = campaignInsights.reduce((sum, campaign) => sum + (campaign.click_to_call || 0), 0);
    const totalEmailContacts = campaignInsights.reduce((sum, campaign) => sum + (campaign.email_contacts || 0), 0);
    const totalBookingStep1 = campaignInsights.reduce((sum, campaign) => sum + (campaign.booking_step_1 || 0), 0);
    const totalReservations = campaignInsights.reduce((sum, campaign) => sum + (campaign.reservations || 0), 0);
    const totalReservationValue = campaignInsights.reduce((sum, campaign) => sum + (campaign.reservation_value || 0), 0);
    const totalBookingStep2 = campaignInsights.reduce((sum, campaign) => sum + (campaign.booking_step_2 || 0), 0);
    const totalBookingStep3 = campaignInsights.reduce((sum, campaign) => sum + (campaign.booking_step_3 || 0), 0);

    // Calculate overall ROAS and cost per reservation
    const overallRoas = totalSpend > 0 && totalReservationValue > 0 ? totalReservationValue / totalSpend : 0;
    const overallCostPerReservation = totalReservations > 0 ? totalSpend / totalReservations : 0;

    const responseTime = Date.now() - startTime;
    performanceMonitor.recordAPICall('fetch-live-data', responseTime);
    
    logger.info('Live data fetch completed successfully', {
      clientId: client.id,
      responseTime,
      campaignCount: campaignInsights.length,
      currency: accountInfo?.currency || 'USD'
    });
    
    logger.info('Final calculated stats', {
      totalSpend,
      totalImpressions, 
      totalClicks,
      totalConversions,
      averageCtr,
      averageCpc,
      campaignCount: campaignInsights.length,
      currency: accountInfo?.currency || 'USD'
    });

    // Prepare response data
    const responseData = {
      client: {
        ...client,
        currency: accountInfo?.currency || 'USD'
      },
      campaigns: campaignInsights,
      stats: {
        totalSpend,
        totalImpressions,
        totalClicks,
        totalConversions,
        averageCtr,
        averageCpc
      },
      conversionMetrics: {
        click_to_call: totalClickToCall,
        email_contacts: totalEmailContacts,
        booking_step_1: totalBookingStep1,
        reservations: totalReservations,
        reservation_value: totalReservationValue,
        roas: overallRoas,
        cost_per_reservation: overallCostPerReservation,
        booking_step_2: totalBookingStep2,
        booking_step_3: totalBookingStep3
      },
      dateRange: {
        start: startDate,
        end: endDate
      },
      accountInfo: accountInfo ? {
        currency: accountInfo.currency,
        timezone: accountInfo.timezone_name,
        status: accountInfo.account_status
      } : null,
      fromCache: false,
      lastUpdated: new Date().toISOString()
    };

    // SMART CACHE: Store current month data for 3-hour reuse
    // (isCurrentMonthRequest already declared above)
    if (isCurrentMonthRequest) {
      logger.info('💾 🔴 CURRENT MONTH DATA - STORING IN SMART CACHE...', {
        clientId,
        campaignCount: campaignInsights.length,
        willCache: true
      });
      
      try {
        const currentMonth = {
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
          periodId: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
        };

        // Store in cache table
        await supabase
          .from('current_month_cache')
          .upsert({
            client_id: clientId,
            cache_data: responseData,
            last_updated: new Date().toISOString(),
            period_id: currentMonth.periodId
          });

        logger.info('✅ Current month data cached successfully');
      } catch (cacheError) {
        logger.warn('Warning', cacheError);
        // Don't fail the request if caching fails
      }
    }

    // 🔧 ADD DATA SOURCE VALIDATION: Track when live API is used
    const dataSourceValidation = {
      expectedSource: isCurrentMonthRequest ? 'smart-cache' : isCurrentWeekRequest ? 'smart-cache' : 'database',
      actualSource: 'live-api',
      cacheFirstEnforced: ENFORCE_STRICT_CACHE_FIRST,
      isCurrentPeriod: isCurrentMonthRequest || isCurrentWeekRequest,
      shouldHaveUsedCache: (isCurrentMonthRequest || isCurrentWeekRequest) && !forceFresh,
      potentialCacheBypassed: (isCurrentMonthRequest || isCurrentWeekRequest) && !forceFresh
    };

    // Log potential cache bypass
    if (dataSourceValidation.potentialCacheBypassed) {
      console.warn('🚨 POTENTIAL CACHE BYPASS DETECTED:', {
        expectedSource: dataSourceValidation.expectedSource,
        actualSource: dataSourceValidation.actualSource,
        forceFresh,
        cacheFirstEnforced: ENFORCE_STRICT_CACHE_FIRST,
        reason: 'Live API used when cache should have been available'
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...responseData,
        dataSourceValidation
      },
      debug: {
        tokenValid: tokenValidation.valid,
        campaignInsightsCount: campaignInsights.length,
        dateRange: { startDate, endDate },
        metaApiError: metaApiError,
        hasMetaApiError: !!metaApiError,
        authenticatedUser: 'auth-disabled',
        currency: accountInfo?.currency || 'USD',
        source: isCurrentMonthRequest ? 'live-api-cached' : 'live-api',
        responseTime,
        cachePolicy: ENFORCE_STRICT_CACHE_FIRST ? 'strict-cache-first' : 'cache-optional',
        dataSourceValidation
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.error('❌ Live data fetch failed with error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime,
      errorType: error?.constructor?.name
    });
    
    logger.error('Live data fetch failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 