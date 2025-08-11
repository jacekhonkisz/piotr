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

// Helper function to load data from database for previous months
async function loadFromDatabase(clientId: string, startDate: string, endDate: string) {
  console.log(`📊 Loading data from database for ${clientId} (${startDate} to ${endDate})`);
  
  const { data: storedSummary, error } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', clientId)
    .eq('summary_date', startDate)
    .eq('summary_type', 'monthly')
    .single();

  if (error || !storedSummary) {
    console.log('⚠️ No stored data found, falling back to live fetch');
    return null;
  }

  console.log('✅ Found stored data in database');
  
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

  // Extract conversion metrics from campaign data
  const conversionMetrics = {
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
    fromDatabase: true
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

      // SMART ROUTING: Current month vs Previous months
      const isCurrentMonthRequest = isCurrentMonth(startDate, endDate);
      console.log(`📊 DETAILED ROUTING ANALYSIS:`, {
        startDate,
        endDate,
        currentSystemDate: new Date().toISOString(),
        currentYear: new Date().getFullYear(),
        currentMonth: new Date().getMonth() + 1,
        isCurrentMonthRequest,
        forceFresh,
        routingDecision: isCurrentMonthRequest ? 'SMART CACHE' : 'DATABASE FIRST'
      });
      
      if (!forceFresh && !isCurrentMonthRequest) {
        // Previous months: Use database lookup (data doesn't change)
        console.log('📊 Checking database for previous month data...');
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
      } else if (isCurrentMonthRequest && !forceFresh) {
        // Current month: Use smart cache (3-hour refresh) BUT fetch live and store
        console.log('📊 🔴 CURRENT MONTH DETECTED - CHECKING SMART CACHE...');
        
        try {
          // Use the shared smart cache helper
          const { getSmartCacheData } = await import('../../../lib/smart-cache-helper');
          
          console.log('📊 🔍 Calling getSmartCacheData for clientId:', clientId);
          const cacheResult = await getSmartCacheData(clientId, false);
          
          console.log('📊 💾 Cache result received:', {
            success: cacheResult.success,
            hasData: !!cacheResult.data,
            hasCampaigns: cacheResult.data?.campaigns !== undefined,
            campaignCount: cacheResult.data?.campaigns?.length || 'N/A',
            source: cacheResult.source,
            fromCache: cacheResult.data?.fromCache
          });
          
          if (cacheResult.success && cacheResult.data.campaigns !== undefined) {
            const responseTime = Date.now() - startTime;
            console.log(`🚀 ✅ SMART CACHE HIT! Completed in ${responseTime}ms - campaigns: ${cacheResult.data.campaigns.length}`);
            
            return NextResponse.json({
              success: true,
              data: cacheResult.data,
              debug: {
                source: cacheResult.source,
                responseTime,
                cacheAge: cacheResult.data.cacheAge,
                authenticatedUser: user.email,
                currency: cacheResult.data.client?.currency || 'PLN'
              }
            });
          } else {
            console.log('⚠️ ❌ SMART CACHE MISS - Reason:', {
              success: cacheResult.success,
              hasData: !!cacheResult.data,
              hasCampaigns: cacheResult.data?.campaigns !== undefined,
              error: cacheResult.error || 'No error'
            });
            console.log('📊 🔄 Falling back to live Meta API fetch and will cache result...');
          }
        } catch (cacheError) {
          console.log('⚠️ ❌ Smart cache error, fetching live data:', cacheError);
        }
      }

      // If database lookup failed OR this is current month (live fetch + cache), proceed with Meta API
      console.log(`🔄 Proceeding with live Meta API fetch${isCurrentMonthRequest ? ' (will cache for 3 hours)' : ''}...`);

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