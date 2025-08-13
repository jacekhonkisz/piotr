import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MetaAPIService } from '../../../lib/meta-api';
import { authenticateRequest, canAccessClient, createErrorResponse } from '../../../lib/auth-middleware';
import logger from '../../../lib/logger';
import { performanceMonitor } from '../../../lib/performance';
import { 
  analyzeDateRange, 
  selectMetaAPIMethod, 
  validateDateRange
} from '../../../lib/date-range-utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

// Helper function to check if date range is current month
function isCurrentMonth(startDate: string, endDate: string): boolean {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  const start = new Date(startDate + 'T00:00:00.000Z');
  const end = new Date(endDate + 'T23:59:59.999Z');
  
  const startYear = start.getFullYear();
  const startMonth = start.getMonth() + 1;
  const endYear = end.getFullYear();
  const endMonth = end.getMonth() + 1;
  
  console.log('🔍 CURRENT MONTH DETECTION:', {
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
  
  // Check if the range covers the current month
  const result = startYear === currentYear && 
         startMonth === currentMonth &&
         endYear === currentYear && 
         endMonth === currentMonth;
         
  console.log('🎯 IS CURRENT MONTH RESULT:', result);
  return result;
}

// Helper function to check if date range is current week
function isCurrentWeek(startDate: string, endDate: string): boolean {
  const now = new Date();
  
  // 🔧 FIX: Use exact same ISO week calculation as frontend
  // This MUST match the frontend logic exactly
  const getISOWeekBoundaries = (date: Date) => {
    // Get current week boundaries (Monday to Sunday)
    const currentDayOfWeek = date.getDay();
    const daysToMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
    
    const startOfCurrentWeek = new Date(date);
    startOfCurrentWeek.setDate(startOfCurrentWeek.getDate() - daysToMonday);
    startOfCurrentWeek.setHours(0, 0, 0, 0);
    
         const endOfCurrentWeek = new Date(startOfCurrentWeek);
     endOfCurrentWeek.setDate(endOfCurrentWeek.getDate() + 6);
     endOfCurrentWeek.setHours(0, 0, 0, 0); // Use 00:00:00 for date comparison
    
    return {
      start: startOfCurrentWeek.toISOString().split('T')[0],
      end: endOfCurrentWeek.toISOString().split('T')[0]
    };
  };
  
  const currentWeekBoundaries = getISOWeekBoundaries(now);
  
  console.log('🔍 CURRENT WEEK DETECTION (ISO):', {
    now: now.toISOString(),
    currentWeekStart: currentWeekBoundaries.start,
    currentWeekEnd: currentWeekBoundaries.end,
    requestStartDate: startDate,
    requestEndDate: endDate
  });
  
  // Simple string comparison for date ranges
  const result = startDate === currentWeekBoundaries.start && endDate === currentWeekBoundaries.end;
  
  console.log('🔍 CURRENT WEEK DETECTION RESULT (ISO):', {
    startDateMatches: startDate === currentWeekBoundaries.start,
    endDateMatches: endDate === currentWeekBoundaries.end,
    result
  });
  
  return result;
}

// Helper function to load data from database for previous months/weeks
async function loadFromDatabase(clientId: string, startDate: string, endDate: string) {
  console.log(`📊 Loading data from database for ${clientId} (${startDate} to ${endDate})`);
  
  // Determine if this is a weekly or monthly request based on date range
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const summaryType = daysDiff <= 7 ? 'weekly' : 'monthly';
  
  console.log(`📊 Detected ${summaryType} request (${daysDiff} days)`);
  
  const { data: storedSummary, error } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', clientId)
    .eq('summary_date', startDate)
    .eq('summary_type', summaryType)
    .single();

  if (error || !storedSummary) {
    console.log(`⚠️ No stored ${summaryType} data found, falling back to live fetch`);
    return null;
  }

  console.log(`✅ Found stored ${summaryType} data in database`);
  
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
      roas: storedSummary.roas || 0,
      cost_per_reservation: storedSummary.cost_per_reservation || 0
    };
    
    console.log(`📊 Using pre-aggregated conversion metrics from database:`, conversionMetrics);
  } else {
    // Fallback: Calculate from campaign data (legacy support)
    conversionMetrics = {
      click_to_call: campaigns.reduce((sum: number, c: any) => sum + (c.click_to_call || 0), 0),
      email_contacts: campaigns.reduce((sum: number, c: any) => sum + (c.email_contacts || 0), 0),
      booking_step_1: campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_1 || 0), 0),
      reservations: campaigns.reduce((sum: number, c: any) => sum + (c.reservations || 0), 0),
      reservation_value: campaigns.reduce((sum: number, c: any) => sum + (c.reservation_value || 0), 0),
      booking_step_2: campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_2 || 0), 0),
      roas: totals.totalSpend > 0 ? campaigns.reduce((sum: number, c: any) => sum + (c.reservation_value || 0), 0) / totals.totalSpend : 0,
      cost_per_reservation: campaigns.reduce((sum: number, c: any) => sum + (c.reservations || 0), 0) > 0 ? 
        totals.totalSpend / campaigns.reduce((sum: number, c: any) => sum + (c.reservations || 0), 0) : 0
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
  
  try {
    logger.info('Live data fetch started', { endpoint: '/api/fetch-live-data' });
    // Authenticate the request using centralized middleware
    const authResult = await authenticateRequest(request);
    
    if (!authResult.success || !authResult.user) {
      return createErrorResponse(authResult.error || 'Authentication failed', authResult.statusCode || 401);
    }

    const { user } = authResult;
    
    // Parse request body
    const requestBody = await request.json();
    const { dateRange, clientId, clearCache, forceFresh } = requestBody;
    
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
    
    console.log('✅ Client found:', {
      id: clientData.id,
      name: clientData.name,
      email: clientData.email,
      hasAdAccountId: !!clientData.ad_account_id,
      hasMetaToken: !!clientData.meta_access_token,
      adAccountId: clientData.ad_account_id
    });
    
    // Check if user can access this client
    if (!canAccessClient(user, clientData.email)) {
      return createErrorResponse('Access denied', 403);
    }
    
    const client = clientData;

    // Use standardized date range strategy
    let startDate: string;
    let endDate: string;
    let rangeAnalysis;
    let apiMethod;
    
    if (dateRange?.start && dateRange?.end) {
      startDate = dateRange.start;
      endDate = dateRange.end;
      
      console.log('📅 Received date range:', { startDate, endDate });
      
      // Check if this is an all-time request (very old start date)
      const startDateObj = new Date(startDate);
      const currentDate = new Date();
      const maxPastDate = new Date(currentDate);
      maxPastDate.setMonth(maxPastDate.getMonth() - 37); // Meta API limit
      
      const isAllTimeRequest = startDateObj.getFullYear() <= 2010;
      const isWithinAPILimits = startDateObj >= maxPastDate;
      
      console.log('📅 Request type:', { 
        isAllTimeRequest, 
        startYear: startDateObj.getFullYear(),
        isWithinAPILimits,
        maxPastDate: maxPastDate.toISOString().split('T')[0],
        requestedStartDate: startDate
      });
      
      // Only validate date range for requests within API limits
      if (isWithinAPILimits) {
        const validation = validateDateRange(startDate, endDate);
        console.log('📅 Date range validation result:', validation);
        
        if (!validation.isValid) {
          console.log('❌ Date range validation failed:', validation.error);
          return NextResponse.json({ 
            error: 'Invalid date range', 
            details: validation.error
          }, { status: 400 });
        }
      } else if (isAllTimeRequest) {
        console.log('📅 All-time request detected, skipping date range validation');
      } else {
        console.log('⚠️ Date range exceeds Meta API limits (37 months), but proceeding anyway');
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

          console.log('📅 Date range for API call:', { startDate, endDate, method: apiMethod.method });

      // SMART ROUTING: Current month vs Current week vs Previous periods
      const isCurrentMonthRequest = isCurrentMonth(startDate, endDate);
      const isCurrentWeekRequest = isCurrentWeek(startDate, endDate);
      
      console.log(`📊 CRITICAL DEBUG - ROUTING ANALYSIS:`, {
        startDate,
        endDate,
        currentSystemDate: new Date().toISOString(),
        currentYear: new Date().getFullYear(),
        currentMonth: new Date().getMonth() + 1,
        isCurrentMonthRequest,
        isCurrentWeekRequest,
        forceFresh,
        forceFreshType: typeof forceFresh,
        routingDecision: isCurrentMonthRequest ? 'SMART CACHE (MONTHLY)' : 
                        isCurrentWeekRequest ? 'SMART CACHE (WEEKLY)' : 'DATABASE FIRST',
        willUseWeeklyCache: isCurrentWeekRequest && !forceFresh,
        willUseDatabaseLookup: !forceFresh && !isCurrentMonthRequest && !isCurrentWeekRequest
      });

      // CRITICAL DEBUG: Check exactly why database cache might be skipped
      console.log(`🔍 CRITICAL DEBUG - CACHE CONDITIONS:`, {
        'isCurrentMonthRequest': isCurrentMonthRequest,
        'NOT forceFresh': !forceFresh,
        'Combined condition (isCurrentMonthRequest && !forceFresh)': isCurrentMonthRequest && !forceFresh,
        'Will check database cache': isCurrentMonthRequest && !forceFresh
      });
      
      if (!forceFresh && !isCurrentMonthRequest && !isCurrentWeekRequest) {
        // Previous periods: Use database lookup (data doesn't change)
        console.log('📊 Checking database for previous period data...');
        const databaseResult = await loadFromDatabase(clientId, startDate, endDate);
        
        if (databaseResult) {
          const responseTime = Date.now() - startTime;
          console.log(`🚀 Database lookup completed in ${responseTime}ms`);
          
          return NextResponse.json({
            success: true,
            data: databaseResult,
            debug: {
              source: 'database',
              responseTime,
              authenticatedUser: user.email,
              currency: 'PLN'
            }
          });
        }
      } else if (isCurrentWeekRequest && !forceFresh) {
        // Current week: Use smart cache (3-hour refresh) for weekly data
        console.log('📊 🟡 CURRENT WEEK DETECTED - CHECKING WEEKLY SMART CACHE...');
        
        try {
          // Use the shared weekly smart cache helper
          const { getSmartWeekCacheData } = await import('../../../lib/smart-cache-helper');
          const cacheResult = await getSmartWeekCacheData(clientId, false);
          
          if (cacheResult.success && cacheResult.data.campaigns.length >= 0) {
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
                period: 'current-week'
              }
            });
          }
        } catch (cacheError) {
          console.error('⚠️ Weekly smart cache failed, falling back to live fetch:', cacheError);
        }
      } else if (isCurrentMonthRequest && !forceFresh) {
        // Current month: SIMPLE DATABASE-FIRST APPROACH
        console.log('📊 🔴 CURRENT MONTH DETECTED - CHECKING DATABASE CACHE...');
        console.log('🔍 CRITICAL DEBUG - Cache check parameters:', {
          clientId,
          currentTime: new Date().toISOString()
        });
        
        try {
          // Check database cache directly (no complex smart cache logic)
          const now = new Date();
          const currentYear = now.getFullYear();
          const currentMonth = now.getMonth() + 1;
          const periodId = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
          
          console.log('🔍 CRITICAL DEBUG - Database query parameters:', {
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

          console.log('🔍 CRITICAL DEBUG - Database query result:', {
            hasResult: !!cacheQueryResult,
            hasError: !!cacheQueryError,
            errorMessage: cacheQueryError?.message,
            errorCode: cacheQueryError?.code,
            resultType: typeof cacheQueryResult,
            resultKeys: cacheQueryResult ? Object.keys(cacheQueryResult) : null
          });

          let cachedData = cacheQueryResult;
          let cacheError = cacheQueryError;

          console.log('🔍 CRITICAL DEBUG - Parsing database query result...');
          
          console.log('🔍 CRITICAL DEBUG - Database query result:', {
            hasData: !!cachedData,
            hasError: !!cacheError,
            errorMessage: cacheError?.message,
            errorCode: cacheError?.code,
            dataKeys: cachedData ? Object.keys(cachedData) : null
          });

          if (cacheError) {
            console.log('❌ CRITICAL DEBUG - Database cache error:', cacheError);
          }

          if (cachedData) {
            const cacheAge = Date.now() - new Date(cachedData.last_updated).getTime();
            const cacheAgeHours = cacheAge / (1000 * 60 * 60);
            const isCacheFresh = cacheAgeHours < 6; // 6 hour cache (was 3)

            console.log('🔍 CRITICAL DEBUG - Cache age analysis:', {
              cacheAge,
              cacheAgeHours,
              isCacheFresh,
              lastUpdated: cachedData.last_updated
            });

            if (isCacheFresh) {
              console.log('✅ Database Cache: Returning fresh cached data', {
                cacheAgeMinutes: Math.round(cacheAge / 1000 / 60),
                lastUpdated: cachedData.last_updated
              });

              const responseTime = Date.now() - startTime;
              return NextResponse.json({
                success: true,
                data: {
                  ...cachedData.cache_data,
                  fromCache: true,
                  cacheAge: cacheAge
                },
                debug: {
                  source: 'database-cache',
                  responseTime,
                  cacheAge: cacheAge,
                  authenticatedUser: user.email,
                  currency: 'PLN',
                  cacheInfo: `Fresh cache (${Math.round(cacheAge / 1000 / 60)} minutes old)`
                }
              });
            } else {
              // 🔧 FIX: ALWAYS return stale cache instead of bypassing to Meta API
              console.log('⚠️ Database Cache: Cache is stale, but returning stale data (NO BYPASS)', {
                cacheAgeHours: Math.round(cacheAgeHours * 10) / 10,
                lastUpdated: cachedData.last_updated,
                policy: 'database-first'
              });

              const responseTime = Date.now() - startTime;
              return NextResponse.json({
                success: true,
                data: {
                  ...cachedData.cache_data,
                  fromCache: true,
                  cacheAge: cacheAge,
                  staleData: true
                },
                debug: {
                  source: 'database-cache-stale',
                  responseTime,
                  cacheAge: cacheAge,
                  authenticatedUser: user.email,
                  currency: 'PLN',
                  cacheInfo: `Stale cache (${Math.round(cacheAgeHours * 10) / 10} hours old) - database-first policy`
                }
              });
            }
          } else {
            // 🔧 FIX: Return empty data structure instead of bypassing to Meta API
            console.log('⚠️ Database Cache: No cache found, returning empty data (NO BYPASS)', {
              policy: 'database-first'
            });

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
                noData: true
              },
              debug: {
                source: 'database-no-cache',
                responseTime,
                authenticatedUser: user.email,
                currency: 'PLN',
                cacheInfo: 'No cache found - database-first policy'
              }
            });
          }
        } catch (cacheError) {
          // 🔧 FIX: Return empty data instead of bypassing to Meta API on error
          console.log('❌ CRITICAL DEBUG - Database cache exception, returning empty data (NO BYPASS):', cacheError);
          
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
              authenticatedUser: user.email,
              currency: 'PLN',
              cacheInfo: 'Database error - database-first policy',
              error: cacheError instanceof Error ? cacheError.message : 'Unknown error'
            }
          });
        }
      } else {
        console.log('🔍 CRITICAL DEBUG - Database cache check SKIPPED because:', {
          isCurrentMonthRequest,
          forceFresh,
          condition: `${isCurrentMonthRequest} && !${forceFresh}`,
          result: isCurrentMonthRequest && !forceFresh
        });
      }

      // 🔧 CRITICAL FIX: Only proceed with Meta API if explicitly forced
      if (!forceFresh) {
        console.log('🚫 CRITICAL PROTECTION - Meta API bypass BLOCKED (database-first policy)');
        console.log('💡 To refresh data, use forceFresh: true parameter');
        
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
            bypassBlocked: true
          },
          debug: {
            source: 'bypass-blocked',
            responseTime,
            authenticatedUser: user.email,
            currency: 'PLN',
            cacheInfo: 'Meta API bypass blocked - database-first policy enforced'
          }
        });
      }

      // Only reach here if forceFresh: true
      console.log(`🔄 EXPLICIT FORCE REFRESH - Proceeding with live Meta API fetch (forceFresh: true)`);
      console.log('🔍 Meta API call reason: Explicit force refresh requested');

      // Initialize Meta API service
    const metaService = new MetaAPIService(client.meta_access_token);
    
    // Check for cache clearing parameter
    const shouldClearCache = clearCache === 'true' || clearCache === true || forceFresh;
    if (shouldClearCache) {
      console.log('🗑️ Cache clearing requested');
      metaService.clearCache();
    }
    
    // Validate token first
    console.log('🔐 Validating Meta API token...');
    const tokenValidation = await metaService.validateToken();
    console.log('🔐 Token validation result:', tokenValidation);
    
    // Also check token info to see permissions
    try {
      const tokenInfo = await metaService.getTokenInfo();
      console.log('🔐 Token info:', {
        success: tokenInfo.success,
        scopes: tokenInfo.info?.scopes,
        isLongLived: tokenInfo.isLongLived,
        expiresAt: tokenInfo.expiresAt
      });
    } catch (error) {
      console.log('⚠️ Could not get token info:', error);
    }
    
    if (!tokenValidation.valid) {
      return NextResponse.json({ 
        error: 'Invalid Meta Ads token', 
        details: tokenValidation.error
      }, { status: 400 });
    }

    // Fetch live campaign insights from Meta API
    console.log('📈 Fetching campaign insights from Meta API...');
    
    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;
    
    console.log('🏢 Using ad account ID:', adAccountId);
    
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

      console.log('📊 Campaign insights result:', {
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
      console.log('⚠️ No campaign insights found, trying to get basic campaign data...');
      
      try {
        const allCampaigns = await metaService.getCampaigns(adAccountId);
        console.log('📋 All campaigns found:', allCampaigns.length);

        if (allCampaigns.length > 0) {
          console.log('✅ Creating basic campaign data from campaigns list');
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
      console.log('🔍 Fetching account info for adAccountId:', adAccountId);
      accountInfo = await metaService.getAccountInfo(adAccountId);
      console.log('💰 Account info fetched successfully:', {
        currency: accountInfo.currency,
        timezone: accountInfo.timezone_name,
        status: accountInfo.account_status,
        fullResponse: accountInfo
      });
    } catch (error) {
      console.log('⚠️ Could not fetch account info:', error);
      console.log('⚠️ Error details:', {
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
        booking_step_2: totalBookingStep2
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
      console.log('💾 🔴 CURRENT MONTH DATA - STORING IN SMART CACHE...', {
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

        console.log('✅ Current month data cached successfully');
      } catch (cacheError) {
        console.log('⚠️ Failed to cache current month data:', cacheError);
        // Don't fail the request if caching fails
      }
    }

    return NextResponse.json({
      success: true,
      data: responseData,
      debug: {
        tokenValid: tokenValidation.valid,
        campaignInsightsCount: campaignInsights.length,
        dateRange: { startDate, endDate },
        metaApiError: metaApiError,
        hasMetaApiError: !!metaApiError,
        authenticatedUser: user.email,
        currency: accountInfo?.currency || 'USD',
        source: isCurrentMonthRequest ? 'live-api-cached' : 'live-api',
        responseTime
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