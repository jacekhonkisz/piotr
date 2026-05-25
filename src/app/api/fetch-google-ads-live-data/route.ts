import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from '../../../lib/google-ads-api';
import { authenticateRequest, canAccessClient, createErrorResponse } from '../../../lib/auth-middleware';
import logger from '../../../lib/logger';
import { performanceMonitor } from '../../../lib/performance';
import { 
  analyzeDateRange, 
  selectMetaAPIMethod, 
  validateDateRange
} from '../../../lib/date-range-utils';
import {
  fetchGoogleDynamicConversionRows,
  googleDynamicRowsToMetricMap,
} from '../../../lib/google-dynamic-conversion-fetch';
import {
  googleEmailContactsFromRow,
  googlePhoneContactsFromRow,
  sumGoogleEmailContactsFromCampaigns,
  sumGooglePhoneContactsFromCampaigns,
} from '../../../lib/google-ads-contact-metrics';

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
  
  const result = startYear === currentYear && 
         startMonth === currentMonth &&
         endYear === currentYear && 
         endMonth === currentMonth;
         
  logger.info('🎯 IS CURRENT MONTH RESULT (Google Ads):', result);
  return result;
}

// Helper function to generate period ID from date range
function generatePeriodIdFromDateRange(startDate: string, endDate: string): string | null {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Check if it's a monthly period (1st to last day of month)
  const isMonthlyPeriod = start.getDate() === 1 && 
    end.getMonth() === start.getMonth() && 
    end.getFullYear() === start.getFullYear() &&
    end.getDate() === new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  
  if (isMonthlyPeriod) {
    const year = start.getFullYear();
    const month = String(start.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
  
  return null;
}

// This function has been removed - we now use only real data from Google Ads API
// No more fake data generation

// Helper function to load data from database for previous months/weeks
async function loadFromDatabase(clientId: string, startDate: string, endDate: string) {
  console.log(`📚 Loading Google Ads data from unified campaign_summaries table for ${startDate} to ${endDate}`);
  
  try {
    // Determine if this is a weekly or monthly request based on date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const summaryType = daysDiff <= 7 ? 'weekly' : 'monthly';
    
    console.log(`📊 Detected ${summaryType} request (${daysDiff} days) for Google Ads platform`);
    
    // Query unified campaign_summaries table with Google platform filter
    let storedSummary, error;
    
    if (summaryType === 'weekly') {
      // ✅ FIX: Use exact Monday matching (same as StandardizedDataFetcher and BackgroundDataCollector)
      // Weekly data is always stored with summary_date = Monday of that week
      const { getMondayOfWeek, formatDateISO } = await import('../../../lib/week-helpers');
      
      const requestedStartDate = new Date(startDate);
      const weekMonday = getMondayOfWeek(requestedStartDate);
      const weekMondayStr = formatDateISO(weekMonday);
      
      console.log(`📅 Searching for weekly Google Ads data:`, {
        requestedRange: `${startDate} to ${endDate}`,
        calculatedMonday: weekMondayStr,
        note: 'Weekly data is stored with summary_date = Monday (ISO 8601)'
      });
      
      // First try exact Monday match (most accurate)
      const { data: weeklyResults, error: weeklyError } = await supabase
        .from('campaign_summaries')
        .select('*')
        .eq('client_id', clientId)
        .eq('summary_type', 'weekly')
        .eq('platform', 'google')
        .eq('summary_date', weekMondayStr)  // ✅ EXACT MATCH on Monday
        .limit(1);
      
      if (weeklyResults && weeklyResults.length > 0) {
        storedSummary = weeklyResults[0];
        error = null;
        console.log(`✅ Found weekly Google Ads data for week starting ${weekMondayStr}`);
      } else {
        // Fallback: Try range query for edge cases (different Monday calculation)
        console.log(`⚠️ No exact Monday match, trying range query as fallback...`);
        
        const { data: rangeResults, error: rangeError } = await supabase
          .from('campaign_summaries')
          .select('*')
          .eq('client_id', clientId)
          .eq('summary_type', 'weekly')
          .eq('platform', 'google')
          .gte('summary_date', startDate)
          .lte('summary_date', endDate)
          .order('summary_date', { ascending: false })
          .limit(1);
        
        if (rangeResults && rangeResults.length > 0) {
          storedSummary = rangeResults[0];
          error = null;
          console.log(`✅ Found weekly Google Ads data via range query: ${storedSummary.summary_date}`);
        } else {
          storedSummary = null;
          error = rangeError || { message: `No weekly Google Ads data found for week starting ${weekMondayStr}` };
          
          // DEBUG: Show available weeks
          const { data: debugResults } = await supabase
            .from('campaign_summaries')
            .select('summary_date, total_spend')
            .eq('client_id', clientId)
            .eq('summary_type', 'weekly')
            .eq('platform', 'google')
            .order('summary_date', { ascending: false })
            .limit(5);
          
          if (debugResults && debugResults.length > 0) {
            console.log(`🔍 DEBUG: Available Google Ads weekly summaries:`, debugResults);
          }
        }
      }
    } else {
      // For monthly data, look for any Google Ads data in the month range
      // IMPORTANT: Google Ads data is stored as 'weekly' type even for monthly requests
      console.log(`📅 Looking for Google monthly data for ${startDate} to ${endDate}`);
      
      // Try to find monthly summary first, then weekly as fallback
      let monthlyResults = null;
      let monthlyError = null;
      
      // First try monthly summary type
      const monthlyQuery = await supabase
        .from('campaign_summaries')
        .select('*')
        .eq('client_id', clientId)
        .eq('summary_type', 'monthly')
        .eq('platform', 'google')
        .gte('summary_date', startDate)
        .lte('summary_date', endDate)
        .order('summary_date', { ascending: false })
        .limit(1);
      
      if (monthlyQuery.data && monthlyQuery.data.length > 0) {
        monthlyResults = monthlyQuery.data;
        console.log(`✅ Found monthly Google Ads summary`);
      } else {
        // ❌ NO FALLBACK TO WEEKLY SUMMARIES FOR MONTHLY REQUESTS
        // Monthly and weekly are COMPLETELY SEPARATE systems
        // If no monthly summary exists, return null (will trigger live API call)
        console.log(`❌ No monthly summary found - monthly and weekly systems are separate`);
        console.log(`   → Monthly should collect data from ${startDate} to ${endDate} as ONE record`);
        console.log(`   → Weekly is a different system and should NOT be aggregated for monthly`);
        monthlyResults = null;
        monthlyError = { message: 'No monthly summary found - monthly summaries must be collected separately from weekly' };
      }
      
      if (monthlyResults && monthlyResults.length > 0) {
        storedSummary = monthlyResults[0];
        error = null;
        console.log(`✅ Found Google data in month range: ${storedSummary.summary_date}`);
      } else {
        // Fallback: Try specific dates (original logic)
        console.log(`📅 No data in range, trying specific dates...`);
        
        // First try original date
        const { data: exactResult, error: exactError } = await supabase
          .from('campaign_summaries')
          .select('*')
          .eq('client_id', clientId)
          .eq('summary_date', startDate)
          .eq('summary_type', 'weekly')
          .eq('platform', 'google')
          .single();
        
        if (exactResult) {
          storedSummary = exactResult;
          error = null;
          console.log(`✅ Found Google data on exact date: ${startDate}`);
        } else {
          // Try modified date (original + 1 day)
          const originalDate = new Date(startDate);
          const modifiedDate = new Date(originalDate);
          modifiedDate.setDate(modifiedDate.getDate() + 1);
          const modifiedDateString = modifiedDate.toISOString().split('T')[0];
          
          console.log(`📅 Trying modified date: ${modifiedDateString}`);
          
          const { data: modifiedResult, error: modifiedError } = await supabase
            .from('campaign_summaries')
            .select('*')
            .eq('client_id', clientId)
            .eq('summary_date', modifiedDateString)
            .eq('summary_type', 'weekly')
            .eq('platform', 'google')
            .single();
          
          if (modifiedResult) {
            storedSummary = modifiedResult;
            error = null;
            console.log(`✅ Found Google data on modified date: ${modifiedDateString}`);
          } else {
            storedSummary = null;
            error = modifiedError || exactError || monthlyError;
            console.log(`⚠️ No Google data found in range ${startDate} to ${endDate} or specific dates`);
          }
        }
      }
    }

    if (error || !storedSummary) {
      console.log(`⚠️ No stored ${summaryType} Google Ads data found - NO FALLBACK (complete separation)`);
      return null;
    }

    console.log(`✅ Found stored ${summaryType} Google Ads data in database`);

    // Extract data from stored summary (same format as Meta API)
    const campaigns = storedSummary.campaign_data || [];
    const totals = {
      totalSpend: storedSummary.total_spend || 0,
      totalImpressions: storedSummary.total_impressions || 0,
      totalClicks: storedSummary.total_clicks || 0,
      totalConversions: 0, // Conversions removed
      averageCtr: storedSummary.average_ctr || 0,
      averageCpc: storedSummary.average_cpc || 0
    };

    // Use aggregated conversion metrics from database if available
    let conversionMetrics;
    
    if (storedSummary.booking_step_1 !== null &&
        storedSummary.reservations !== null &&
        storedSummary.reservation_value !== null &&
        storedSummary.booking_step_2 !== null) {
      
      // ✅ CRITICAL FIX: Round all conversion counts to integers for consistency with live API
      const reservationValue = Math.round((storedSummary.reservation_value || 0) * 100) / 100;
      conversionMetrics = {
        click_to_call: Math.round(googlePhoneContactsFromRow(storedSummary as Record<string, unknown>)),
        email_contacts: Math.round(googleEmailContactsFromRow(storedSummary as Record<string, unknown>)),
        booking_step_1: Math.round(storedSummary.booking_step_1 || 0),
        reservations: Math.round(storedSummary.reservations || 0),
        reservation_value: reservationValue,
        // ✅ FIX: Add conversion_value and total_conversion_value (both = reservation_value for Google Ads)
        // reservation_value contains "Wartość konwersji" which includes all conversion values
        conversion_value: reservationValue,
        total_conversion_value: reservationValue, // This is what UI displays as "łączna wartość rezerwacji"
        booking_step_2: Math.round(storedSummary.booking_step_2 || 0),
        booking_step_3: Math.round(storedSummary.booking_step_3 || 0),
        roas: Math.round((storedSummary.roas || 0) * 100) / 100,
        cost_per_reservation: Math.round((storedSummary.cost_per_reservation || 0) * 100) / 100
      };
      
      console.log(`📊 Using aggregated conversion metrics from database:`, conversionMetrics);
    } else {
      // Fallback: Calculate from campaign data (legacy support)
      // ✅ CRITICAL FIX: Round all conversion counts to integers (Google Ads returns floats)
      const totalReservationValue = campaigns.reduce((sum: number, c: any) => sum + (c.reservation_value || 0), 0);
      const totalReservations = Math.round(campaigns.reduce((sum: number, c: any) => sum + (c.reservations || 0), 0));
      
      const reservationValue = Math.round(totalReservationValue * 100) / 100;
      const conversionValue = Math.round(campaigns.reduce((sum: number, c: any) => sum + (c.conversion_value || 0), 0) * 100) / 100;
      const totalConversionValueRaw = campaigns.reduce((sum: number, c: any) => sum + (c.total_conversion_value || 0), 0);
      const totalConversionValue = totalConversionValueRaw > 0 ? Math.round(totalConversionValueRaw * 100) / 100 : reservationValue;
      conversionMetrics = {
        click_to_call: Math.round(sumGooglePhoneContactsFromCampaigns(campaigns as Record<string, unknown>[])),
        email_contacts: Math.round(sumGoogleEmailContactsFromCampaigns(campaigns as Record<string, unknown>[])),
        booking_step_1: Math.round(campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_1 || 0), 0)),
        reservations: totalReservations,
        reservation_value: reservationValue, // Round to 2 decimal places
        // ✅ FIX: Add conversion_value and total_conversion_value from campaigns
        conversion_value: conversionValue || reservationValue,
        total_conversion_value: totalConversionValue || reservationValue, // This is what UI displays as "łączna wartość rezerwacji"
        booking_step_2: Math.round(campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_2 || 0), 0)),
        booking_step_3: Math.round(campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_3 || 0), 0)),
        roas: totals.totalSpend > 0 ? Math.round((totalConversionValue || reservationValue) / totals.totalSpend * 100) / 100 : 0,
        cost_per_reservation: totalReservations > 0 ? Math.round((totals.totalSpend / totalReservations) * 100) / 100 : 0
      };
      
      console.log(`📊 Calculated conversion metrics from campaign data (fallback):`, conversionMetrics);
    }

    // Transform database campaigns to API format (if needed)
    // 🔧 FIX: Handle both snake_case and camelCase campaign names from database
    const transformedCampaigns = campaigns.map((campaign: any) => ({
      id: campaign.id || campaign.campaignId,
      campaign_id: campaign.campaign_id || campaign.campaignId || '',
      campaign_name: campaign.campaign_name || campaign.campaignName || campaign.name || 'Unknown Campaign',
      spend: parseFloat(campaign.spend || 0),
      impressions: parseInt(campaign.impressions || 0),
      clicks: parseInt(campaign.clicks || 0),
      conversions: parseInt(campaign.conversions || campaign.reservations || 0),
      reservations: parseInt(campaign.reservations || 0),
      ctr: campaign.impressions > 0 ? (campaign.clicks / campaign.impressions) * 100 : 0,
      cpc: campaign.clicks > 0 ? campaign.spend / campaign.clicks : 0,
      status: campaign.status || 'ACTIVE',
      // Conversion tracking metrics (canonical parser fields + legacy DB aliases)
      click_to_call: Math.round(googlePhoneContactsFromRow(campaign as Record<string, unknown>)),
      email_contacts: Math.round(googleEmailContactsFromRow(campaign as Record<string, unknown>)),
      booking_step_1: parseInt(campaign.booking_step_1 || 0),
      booking_step_2: parseInt(campaign.booking_step_2 || 0),
      booking_step_3: parseInt(campaign.booking_step_3 || 0),
      reservation_value: parseFloat(campaign.reservation_value || 0),
      roas: campaign.roas || 0,
      cost_per_reservation: campaign.cost_per_reservation || 0
    }));

    // Use pre-calculated totals from database (already calculated above)
    // No need to recalculate from campaigns since we have aggregated data

    console.log(`📊 Database totals: ${totals.totalSpend} PLN spend, ${transformedCampaigns.length} campaigns`);

    // Hydrate the breakdown tables (networks / devices / keywords /
    // demographics / regions) from the persistent google_ads_tables_data
    // cache so historical periods do not return an empty "Brak danych"
    // payload to the reports UI and PDF generator. The cache is populated
    // by the live API path (below) and by /api/fetch-google-ads-tables.
    const {
      loadGoogleAdsTablesFromDatabase,
      EMPTY_GOOGLE_ADS_TABLES,
      hasAnyGoogleAdsTablesRows,
      normalizeGoogleAdsTables,
      persistGoogleAdsTables,
    } = await import('../../../lib/google-ads-tables-storage');
    const storedTables = await loadGoogleAdsTablesFromDatabase(clientId, startDate, endDate);
    const summaryTables = normalizeGoogleAdsTables((storedSummary as any).google_ads_tables);
    const googleAdsTables = storedTables
      ?? (hasAnyGoogleAdsTablesRows(summaryTables) ? summaryTables : { ...EMPTY_GOOGLE_ADS_TABLES });

    if (!storedTables && hasAnyGoogleAdsTablesRows(summaryTables)) {
      await persistGoogleAdsTables(clientId, startDate, endDate, summaryTables, 'campaign_summaries');
    }

    const dynamicMetricValues =
      (storedSummary as any).google_dynamic_metric_values &&
      typeof (storedSummary as any).google_dynamic_metric_values === 'object'
        ? (storedSummary as any).google_dynamic_metric_values
        : {};
    const dynamicMetricRows = Array.isArray((storedSummary as any).google_dynamic_metric_rows)
      ? (storedSummary as any).google_dynamic_metric_rows
      : [];
    console.log('📊 Historical googleAdsTables (from google_ads_tables_data):', {
      hasStoredRow: !!storedTables,
      networks: googleAdsTables.networkPerformance.length,
      devices: googleAdsTables.devicePerformance.length,
      keywords: googleAdsTables.keywordPerformance.length,
      demographics: googleAdsTables.demographicPerformance.length,
      regions: googleAdsTables.geographicPerformance.length,
    });

  return {
    client: {
      id: clientId,
      currency: 'PLN'
    },
      campaigns: transformedCampaigns,
      stats: {
        totalSpend: totals.totalSpend,
        totalImpressions: totals.totalImpressions,
        totalClicks: totals.totalClicks,
        totalConversions: totals.totalConversions,
        averageCtr: totals.averageCtr,
        averageCpc: totals.averageCpc
      },
    conversionMetrics,
      googleAdsTables, // Generated from campaign data
    dynamicMetricValues,
    dynamicMetricRows,
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
    platform: 'google'
  };

  } catch (error: any) {
    console.log(`❌ Database query error: ${error?.message || error}`);
    return null;
  }
}

export async function POST(request: NextRequest) {
  // CRITICAL DEBUG: This should be the FIRST thing we see
  console.log('🔥 GOOGLE ADS API ROUTE REACHED - VERY FIRST LOG');
  console.log('🔥 Timestamp:', new Date().toISOString());
  
  const startTime = Date.now();
  
  try {
    console.log('🚀 GOOGLE ADS API CALL STARTED:', {
      timestamp: new Date().toISOString(),
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries())
    });
    
    logger.info('Google Ads live data fetch started', { endpoint: '/api/fetch-google-ads-live-data' });
    
    // Parse request body first to provide better error messages
    let requestBody;
    try {
      const bodyText = await request.text();
      console.log('📥 RAW REQUEST BODY:', bodyText);
      
      if (!bodyText || bodyText.trim() === '') {
        console.log('❌ EMPTY REQUEST BODY');
        return createErrorResponse('Empty request body', 400);
      }
      
      requestBody = JSON.parse(bodyText);
      console.log('📥 REQUEST BODY PARSED:', {
        dateRange: requestBody.dateRange,
        clientId: requestBody.clientId,
        clearCache: requestBody.clearCache,
        forceFresh: requestBody.forceFresh
      });
    } catch (parseError) {
      console.error('❌ REQUEST BODY PARSE ERROR:', parseError);
      logger.error('❌ Failed to parse request body:', parseError);
      return createErrorResponse('Invalid JSON in request body', 400);
    }
    
    const { dateRange, clientId, clearCache, forceFresh, bypassAllCache, reason } = requestBody;
    
    // ✅ LOG REFRESH REQUESTS
    if (reason?.includes('refresh') || reason?.includes('dashboard-refresh')) {
      console.log('🔄 REFRESH BUTTON REQUEST DETECTED:', {
        reason,
        forceFresh,
        bypassAllCache,
        clearCache,
        clientId,
        dateRange
      });
      logger.info('🔄 REFRESH BUTTON REQUEST:', { reason, forceFresh, bypassAllCache });
    }
    
    // Validate required fields
    if (!clientId) {
      logger.error('❌ Missing clientId in request');
      return createErrorResponse('Client ID is required', 400);
    }
    
    if (!dateRange || !dateRange.start || !dateRange.end) {
      logger.error('❌ Missing or invalid dateRange in request');
      return createErrorResponse('Date range with start and end dates is required', 400);
    }
    
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createErrorResponse(authResult.error || 'Authentication failed', 401);
    }
    const user = authResult.user;
    logger.info('🔐 Google Ads live data request authenticated for user:', user.email);
    
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
    
    logger.info('Google Ads client found', {
      id: clientData.id,
      name: clientData.name,
      email: clientData.email,
      hasGoogleAdsCustomerId: !!clientData.google_ads_customer_id,
      hasGoogleAdsRefreshToken: !!clientData.google_ads_refresh_token,
      customerId: clientData.google_ads_customer_id
    });
    
    const client = clientData;

    // Early check: Verify client has Google Ads configured
    if (!client.google_ads_customer_id || !client.google_ads_enabled) {
      console.log('❌ CLIENT NOT CONFIGURED FOR GOOGLE ADS:', {
        clientName: client.name,
        hasCustomerId: !!client.google_ads_customer_id,
        isEnabled: client.google_ads_enabled
      });
      return createErrorResponse(`Client '${client.name}' is not configured for Google Ads. This client only has Meta Ads configured.`, 400);
    }

    // Use standardized date range strategy
    let startDate: string;
    let endDate: string;
    let rangeAnalysis;
    let apiMethod;
    
    if (dateRange?.start && dateRange?.end) {
      startDate = dateRange.start;
      endDate = dateRange.end;
      
      // Validate date range
      const validation = validateDateRange(startDate, endDate);
      if (!validation.isValid) {
        console.error('❌ DATE RANGE VALIDATION FAILED:', {
          startDate,
          endDate,
          error: validation.error,
          today: new Date().toISOString().split('T')[0]
        });
        logger.error('❌ Date range validation failed', {
          startDate,
          endDate,
          error: validation.error
        });
        return createErrorResponse(validation.error!, 400);
      }
      
      rangeAnalysis = analyzeDateRange(startDate, endDate);
      apiMethod = selectMetaAPIMethod({ start: startDate, end: endDate }); // Reuse Meta API method selection logic
      
      console.log('📅 GOOGLE ADS DATE RANGE ANALYSIS:', {
        startDate,
        endDate,
        rangeType: rangeAnalysis.rangeType,
        daysDiff: rangeAnalysis.daysDiff,
        selectedMethod: apiMethod.method
      });
      
      logger.info('📅 Google Ads date range analysis:', {
        startDate,
        endDate,
        rangeType: rangeAnalysis.rangeType,
        daysDiff: rangeAnalysis.daysDiff,
        selectedMethod: apiMethod.method
      });
    } else {
      console.log('❌ DATE RANGE REQUIRED ERROR');
      return createErrorResponse('Date range is required', 400);
    }
    
    console.log('🎯 ABOUT TO CHECK DATABASE/LIVE API DECISION...');

    // Check if we should use database for historical data (not current month/week)
    // ✅ FIX: Properly detect if this is the CURRENT week, not just current month
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const requestStart = new Date(startDate);
    const requestEnd = new Date(endDate);
    const daysDiff = Math.ceil((requestEnd.getTime() - requestStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const isWeeklyRequest = daysDiff <= 7;
    
    let isCurrentPeriod = false;
    
    if (isWeeklyRequest) {
      // For weekly requests: Check if the request includes TODAY
      // ✅ FIX: Check if startDate <= today AND endDate >= today (week contains today)
      // This properly detects current week even if endDate is capped to today
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      // Build "today at midnight local time" directly so we never round-trip
      // through a possibly-undefined string from split('T')[0].
      const todayObj = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Current week: start <= today AND end >= today (week contains today)
      const weekContainsToday = startDateObj <= todayObj && endDateObj >= todayObj;
      
      // Also check if this is the current week by comparing week boundaries
      // Use try-catch to handle any import errors gracefully
      let isCurrentWeekByBoundary = false;
      try {
        const { getMondayOfWeek, formatDateISO } = await import('../../../lib/week-helpers');
        const { getCurrentWeekInfo } = await import('../../../lib/week-utils');
        const currentWeek = getCurrentWeekInfo();
        const requestedWeekMonday = getMondayOfWeek(startDateObj);
        const requestedWeekMondayStr = formatDateISO(requestedWeekMonday);
        const currentWeekMondayStr = currentWeek.startDate;
        
        // If the requested week's Monday matches current week's Monday, it's the current week
        isCurrentWeekByBoundary = requestedWeekMondayStr === currentWeekMondayStr;
      } catch (importError) {
        console.warn('⚠️ Failed to import week-helpers for boundary check, using fallback:', importError);
        // Fallback: just use weekContainsToday
      }
      
      isCurrentPeriod = weekContainsToday || isCurrentWeekByBoundary;
      
      console.log('📅 WEEKLY PERIOD DETECTION:', {
        startDate,
        endDate,
        today,
        weekContainsToday,
        isCurrentWeekByBoundary,
        isCurrentPeriod,
        reason: isCurrentPeriod 
          ? '✅ Current week (contains today or matches current week boundary) - use smart cache'
          : '📚 Historical week - use DATABASE'
      });
    } else {
      // For monthly requests: Check if start is in current month
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      isCurrentPeriod = requestStart >= currentMonthStart;
      
      console.log('📅 MONTHLY PERIOD DETECTION:', {
        startDate,
        endDate,
        currentMonthStart: currentMonthStart.toISOString().split('T')[0],
        isCurrentPeriod
      });
    }
    
    // Use database for historical periods, live API for current period
    const shouldUseDatabase = !isCurrentPeriod;
    
    console.log('🎯 DATABASE USAGE DECISION:', {
      startDate,
      endDate,
      daysDiff,
      isWeeklyRequest,
      isCurrentPeriod,
      shouldUseDatabase,
      forceFresh
    });
    
    if (shouldUseDatabase && !forceFresh) {
      console.log('📊 HISTORICAL PERIOD DETECTED - CHECKING DATABASE FIRST');
      logger.info('📊 HISTORICAL PERIOD DETECTED - CHECKING DATABASE FIRST');
      
      try {
        console.log('🔍 CALLING loadFromDatabase...');
        const databaseResult = await loadFromDatabase(client.id, startDate, endDate);
        console.log('✅ loadFromDatabase COMPLETED:', { hasResult: !!databaseResult });
        
        if (databaseResult) {
          console.log('✅ RETURNING STORED GOOGLE ADS DATA FROM DATABASE');
          logger.info('✅ RETURNING STORED GOOGLE ADS DATA FROM DATABASE');

          // Backfill missing breakdown tables on the fly so historical
          // periods don't render "Brak danych" sections. We try to load
          // credentials and call the live Google Ads API once, then
          // persist into google_ads_tables_data so subsequent requests
          // (UI re-renders, PDF exports) skip this work.
          try {
            const { hasAnyGoogleAdsTablesRows, fetchAndStoreGoogleAdsTables } =
              await import('../../../lib/google-ads-tables-storage');
            if (!hasAnyGoogleAdsTablesRows((databaseResult as any).googleAdsTables)) {
              const { data: settingsData } = await supabase
                .from('system_settings')
                .select('key, value')
                .in('key', [
                  'google_ads_client_id',
                  'google_ads_client_secret',
                  'google_ads_developer_token',
                  'google_ads_manager_refresh_token',
                  'google_ads_manager_customer_id',
                ]);
              const settings = (settingsData || []).reduce((acc: Record<string, any>, s: any) => {
                acc[s.key] = s.value;
                return acc;
              }, {});

              const refreshToken =
                settings.google_ads_manager_refresh_token || (client as any).google_ads_refresh_token;

              if (refreshToken && settings.google_ads_client_id && (client as any).google_ads_customer_id) {
                const { GoogleAdsAPIService } = await import('../../../lib/google-ads-api');
                const googleAdsService = new GoogleAdsAPIService({
                  refreshToken,
                  clientId: settings.google_ads_client_id,
                  clientSecret: settings.google_ads_client_secret,
                  developmentToken: settings.google_ads_developer_token,
                  customerId: (client as any).google_ads_customer_id,
                  managerCustomerId: settings.google_ads_manager_customer_id,
                });

                const live = await fetchAndStoreGoogleAdsTables(
                  googleAdsService,
                  client.id,
                  startDate,
                  endDate,
                );
                if (live) {
                  (databaseResult as any).googleAdsTables = live;
                  console.log('✅ Backfilled historical googleAdsTables from live API', {
                    networks: live.networkPerformance.length,
                    devices: live.devicePerformance.length,
                    keywords: live.keywordPerformance.length,
                    demographics: live.demographicPerformance.length,
                    regions: live.geographicPerformance.length,
                  });
                }
              } else {
                console.log('⚠️ Skipping historical tables backfill (missing credentials)');
              }
            }
          } catch (backfillErr) {
            logger.warn('⚠️ Historical googleAdsTables backfill failed', {
              err: backfillErr instanceof Error ? backfillErr.message : backfillErr,
            });
          }

          const responseTime = Date.now() - startTime;
          logger.info('🚀 Google Ads API response completed', {
            responseTime: `${responseTime}ms`,
            source: 'campaign-summaries-database',
            campaignCount: databaseResult.campaigns?.length || 0
          });
          
          // 🔍 DEBUG: Log the exact response being sent to UI
          console.log('📡 SENDING RESPONSE TO UI:', {
            success: true,
            hasData: !!databaseResult,
            campaignCount: databaseResult?.campaigns?.length || 0,
            totalSpend: databaseResult?.stats?.totalSpend || 0,
            clientId: databaseResult?.client?.id,
            dateRange: databaseResult?.dateRange,
            source: 'campaign-summaries-database'
          });
          
          // ✅ FIX: Include debug info that UI expects (same format as Meta)
          return NextResponse.json({
            success: true,
            data: databaseResult,
            responseTime,
            source: 'database',
            debug: {
              source: 'campaign-summaries-database',
              cachePolicy: 'database-first-historical',
              responseTime,
              reason: 'historical-week-google-ads',
              periodType: 'historical'
            },
            validation: {
              actualSource: 'campaign_summaries',
              expectedSource: 'campaign_summaries',
              isConsistent: true
            }
          });
        } else {
          // ✅ FIX: For historical periods, if database has no data, return error instead of calling API
          // Historical data should be collected via background collector, not live API
          console.log('⚠️ NO DATABASE RESULT FOR HISTORICAL PERIOD - RETURNING ERROR');
          console.log('📚 Historical data must be collected via background collector first');
          logger.info('⚠️ Google Ads database lookup returned no data for historical period', {
            startDate,
            endDate,
            clientId: client.id,
            note: 'Historical data should be collected via background collector'
          });
          
          return createErrorResponse(
            `No historical data available for ${startDate} to ${endDate}. Please run weekly data collection first.`,
            404
          );
        }
      } catch (dbError) {
        console.log('❌ DATABASE LOADING ERROR:', dbError);
        console.log('🔄 PROCEEDING TO LIVE API DESPITE DATABASE ERROR');
        // Continue to live API fetch instead of failing
      }
    } else {
      console.log('🔄 CURRENT PERIOD OR FORCE FRESH - SKIPPING DATABASE CHECK');
      
      // 🔧 BYPASS ALL CACHE: Log when bypassing all caching layers
      if (bypassAllCache || forceFresh) {
        console.log('🚀 BYPASSING CACHE MODE:', {
          bypassAllCache,
          forceFresh,
          reason,
          isCurrentPeriod,
          note: 'Will call live Google Ads API directly'
        });
        logger.info('🚀 BYPASSING CACHE: Direct Google Ads API call', { bypassAllCache, forceFresh, reason });
      }

      // ✅ NEW: Clear cache if requested
      if (clearCache) {
        console.log('🗑️ CLEARING GOOGLE ADS CACHE...');
        const currentPeriodId = generatePeriodIdFromDateRange(startDate, endDate) || 
          `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        const { error: deleteError } = await supabase
          .from('google_ads_current_month_cache')
          .delete()
          .eq('client_id', client.id)
          .eq('period_id', currentPeriodId);
        
        if (deleteError) {
          console.warn('⚠️ Failed to clear cache:', deleteError);
        } else {
          console.log('✅ Google Ads cache cleared for period:', currentPeriodId);
        }
      }

      // ✅ NEW: Check smart cache for current period (same as Meta)
      // 🔧 BYPASS ALL CACHE: Skip smart cache if bypassAllCache is set OR forceFresh is true (for refresh button)
      // ✅ FIX: Use weekly cache for weekly requests, monthly cache for monthly requests
      if (isCurrentPeriod && !forceFresh && !bypassAllCache) {
        if (isWeeklyRequest) {
          console.log('📊 🔴 CURRENT WEEK DETECTED - CHECKING GOOGLE ADS WEEKLY SMART CACHE...');
          logger.info('📊 🔴 CURRENT WEEK DETECTED - USING GOOGLE ADS WEEKLY SMART CACHE SYSTEM...');
          
          try {
            // ✅ FIX: Use weekly smart cache for weekly requests
            const { getGoogleAdsSmartWeekCacheData } = await import('../../../lib/google-ads-smart-cache-helper');
            const { getCurrentWeekInfo } = await import('../../../lib/week-utils');
            const currentWeek = getCurrentWeekInfo();
            
            console.log('📅 Current week info for smart cache:', {
              periodId: currentWeek.periodId,
              startDate: currentWeek.startDate,
              endDate: currentWeek.endDate
            });
            
            const smartCacheResult = await getGoogleAdsSmartWeekCacheData(client.id, false, currentWeek.periodId);
            
            if (smartCacheResult.success && smartCacheResult.data) {
              const responseTime = Date.now() - startTime;
              console.log(`🚀 ✅ GOOGLE ADS WEEKLY SMART CACHE SUCCESS: Current week data loaded in ${responseTime}ms`);
              console.log(`📊 Weekly smart cache data structure:`, {
                hasCampaigns: !!smartCacheResult.data.campaigns,
                campaignsCount: smartCacheResult.data.campaigns?.length || 0,
                hasStats: !!smartCacheResult.data.stats,
                totalSpend: smartCacheResult.data.stats?.totalSpend || 0,
                periodId: currentWeek.periodId
              });
              
              logger.info('🚀 Google Ads weekly API response completed', {
                responseTime: `${responseTime}ms`,
                source: 'smart_week_cache',
                campaignCount: smartCacheResult.data.campaigns?.length || 0,
                totalSpend: smartCacheResult.data.stats?.totalSpend || 0
              });
              
              return NextResponse.json({
                success: true,
                data: smartCacheResult.data,
                responseTime,
                source: 'smart_week_cache'
              });
            } else {
              console.log('⚠️ Weekly smart cache miss or no data, proceeding to live API...');
              console.log('🔍 Weekly cache result:', {
                success: smartCacheResult.success,
                hasData: !!smartCacheResult.data,
                error: smartCacheResult.error
              });
            }
          } catch (cacheError: any) {
            console.error('❌ WEEKLY SMART CACHE ERROR:', {
              message: cacheError.message,
              stack: cacheError.stack,
              name: cacheError.name
            });
            console.log('🔄 Proceeding to live API...');
            logger.error('❌ Weekly smart cache error, falling back to live API:', {
              error: cacheError.message,
              stack: cacheError.stack
            });
          }
        } else {
          console.log('📊 🔴 CURRENT MONTH DETECTED - CHECKING GOOGLE ADS MONTHLY SMART CACHE...');
          logger.info('📊 🔴 CURRENT MONTH DETECTED - USING GOOGLE ADS MONTHLY SMART CACHE SYSTEM...');
          
          try {
            // Use the Google Ads monthly smart cache system for current month
            const { getGoogleAdsSmartCacheData } = await import('../../../lib/google-ads-smart-cache-helper');
            const smartCacheResult = await getGoogleAdsSmartCacheData(client.id, false);
            
            if (smartCacheResult.success && smartCacheResult.data) {
              const responseTime = Date.now() - startTime;
              console.log(`🚀 ✅ GOOGLE ADS MONTHLY SMART CACHE SUCCESS: Current month data loaded in ${responseTime}ms`);
              console.log(`📊 Monthly smart cache data structure:`, {
                hasCampaigns: !!smartCacheResult.data.campaigns,
                campaignsCount: smartCacheResult.data.campaigns?.length || 0,
                hasStats: !!smartCacheResult.data.stats,
                totalSpend: smartCacheResult.data.stats?.totalSpend || 0,
                hasGoogleAdsTables: !!smartCacheResult.data.googleAdsTables
              });
              
              logger.info('🚀 Google Ads monthly API response completed', {
                responseTime: `${responseTime}ms`,
                source: 'smart_cache',
                campaignCount: smartCacheResult.data.campaigns?.length || 0,
                totalSpend: smartCacheResult.data.stats?.totalSpend || 0
              });
              
              return NextResponse.json({
                success: true,
                data: smartCacheResult.data,
                responseTime,
                source: 'smart_cache'
              });
            } else {
              console.log('⚠️ Monthly smart cache miss or no data, proceeding to live API...');
              console.log('🔍 Monthly cache result:', {
                success: smartCacheResult.success,
                hasData: !!smartCacheResult.data,
                error: smartCacheResult.error
              });
            }
          } catch (cacheError: any) {
            console.log('❌ MONTHLY SMART CACHE ERROR:', cacheError.message);
            console.log('🔄 Proceeding to live API...');
            logger.error('❌ Monthly smart cache error, falling back to live API:', cacheError);
          }
        }
      }
    }

    // Get Google Ads API credentials from system settings
    console.log('🔧 FETCHING GOOGLE ADS SYSTEM SETTINGS...');
    const { data: settingsData, error: settingsError } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'google_ads_client_id', 
        'google_ads_client_secret', 
        'google_ads_developer_token',
        'google_ads_manager_refresh_token',
        'google_ads_manager_customer_id'
      ]);

    if (settingsError || !settingsData) {
      console.log('❌ SYSTEM SETTINGS ERROR:', { settingsError, hasData: !!settingsData });
      logger.error('❌ Failed to get Google Ads system settings:', settingsError);
      return createErrorResponse('Google Ads system configuration not found', 500);
    }
    
    console.log('✅ SYSTEM SETTINGS FETCHED:', {
      settingsCount: settingsData.length,
      keys: settingsData.map(s => s.key)
    });

    const settings = settingsData.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, any>);

    // Prefer manager refresh token over client-specific token
    // Manager tokens have broader access and are more reliable
    let refreshToken = null;
    let tokenSource = '';
    
    if (settings.google_ads_manager_refresh_token) {
      refreshToken = settings.google_ads_manager_refresh_token;
      tokenSource = 'manager';
    } else if (client.google_ads_refresh_token) {
      refreshToken = client.google_ads_refresh_token;
      tokenSource = 'client';
    }
    
    console.log('🔑 REFRESH TOKEN CHECK:', {
      hasManagerToken: !!settings.google_ads_manager_refresh_token,
      hasClientToken: !!client.google_ads_refresh_token,
      selectedToken: refreshToken ? 'AVAILABLE' : 'MISSING',
      tokenSource
    });
    
    if (!refreshToken) {
      console.log('❌ NO REFRESH TOKEN FOUND');
      return createErrorResponse('Google Ads refresh token not found. Please configure Google Ads authentication.', 400);
    }
    
    console.log(`✅ Using ${tokenSource} refresh token for Google Ads API`);



    const googleAdsCredentials = {
      refreshToken,
      clientId: settings.google_ads_client_id,
      clientSecret: settings.google_ads_client_secret,
      developmentToken: settings.google_ads_developer_token,
      customerId: client.google_ads_customer_id,
      managerCustomerId: settings.google_ads_manager_customer_id,
    };

    console.log('🔧 GOOGLE ADS CREDENTIALS PREPARED:', {
      hasRefreshToken: !!googleAdsCredentials.refreshToken,
      hasClientId: !!googleAdsCredentials.clientId,
      hasClientSecret: !!googleAdsCredentials.clientSecret,
      hasDeveloperToken: !!googleAdsCredentials.developmentToken,
      customerId: googleAdsCredentials.customerId,
      managerCustomerId: googleAdsCredentials.managerCustomerId
    });

    // Initialize Google Ads API service
    console.log('🚀 INITIALIZING GOOGLE ADS API SERVICE...');
    const googleAdsService = new GoogleAdsAPIService(googleAdsCredentials);

    // Validate credentials first
    console.log('🔍 VALIDATING GOOGLE ADS CREDENTIALS...');
    let validation;
    try {
      validation = await googleAdsService.validateCredentials();
      console.log('✅ CREDENTIALS VALIDATION COMPLETED:', { valid: validation.valid, error: validation.error });
    } catch (validationError: any) {
      console.log('❌ CREDENTIALS VALIDATION EXCEPTION:', validationError);
      logger.error('❌ Google Ads credentials validation error:', validationError);
      return createErrorResponse(`Google Ads credentials validation failed: ${validationError?.message || validationError}`, 400);
    }
    
    if (!validation.valid) {
      console.log('❌ CREDENTIALS VALIDATION FAILED:', validation.error);
      logger.error('❌ Google Ads credentials validation failed:', validation.error);
      
      // ❌ REMOVED: No more sample/mockup data fallback!
      // Instead, try to load historical data from database when token is expired
      if (validation.error?.includes('invalid_grant') || validation.error?.includes('expired')) {
        console.log('⚠️ TOKEN EXPIRED - Attempting to load historical data from database');
        logger.warn('⚠️ Google Ads token expired, falling back to database for historical data');
        
        // Try to load from database even for current period if token is expired
        try {
          const databaseResult = await loadFromDatabase(client.id, startDate, endDate);
          
          if (databaseResult) {
            console.log('✅ Loaded Google Ads data from database despite token issue');
            logger.info('✅ Loaded Google Ads historical data from database (token expired)');
            
            const responseTime = Date.now() - startTime;
            return NextResponse.json({
              success: true,
              data: {
                ...databaseResult,
                debug: {
                  source: 'database_fallback_token_expired',
                  tokenError: validation.error,
                  message: 'Data loaded from database. Google Ads token needs refresh for live data.',
                  instructions: 'Run: node scripts/generate-new-refresh-token.js'
                }
              },
              responseTime,
              source: 'database_token_expired'
            });
          }
        } catch (dbError) {
          console.log('⚠️ Database fallback also failed:', dbError);
        }
        
        // If database also has no data, return error with instructions
        return NextResponse.json({
          success: false,
          error: 'Google Ads token expired and no historical data available in database',
          debug: {
            tokenError: validation.error,
            message: 'Google Ads refresh token needs to be regenerated. No cached data available.',
            instructions: 'Run: node scripts/generate-new-refresh-token.js',
            note: 'Run background data collection after fixing the token to populate historical data.'
          }
        }, { status: 401 });
      }
      
      return createErrorResponse(`Google Ads credentials invalid: ${validation.error}`, 400);
    }

    console.log('✅ CREDENTIALS VALIDATION SUCCESSFUL');
    logger.info('✅ Google Ads credentials validated successfully');

    // Fetch fresh campaign data from Google Ads API
    logger.info(`🔄 Fetching fresh Google Ads data for ${startDate} to ${endDate}`);
    
    let freshCampaigns;
    let conversionDebug;
    try {
      const campaignResult = await googleAdsService.getCampaignData(startDate, endDate);
      
      // Handle new return format with debug info
      if (campaignResult && typeof campaignResult === 'object' && (campaignResult as any).campaigns) {
        freshCampaigns = (campaignResult as any).campaigns;
        conversionDebug = (campaignResult as any).conversionDebug;
        logger.info(`🔍 Conversion debug: ${JSON.stringify(conversionDebug)}`);
      } else {
        // Fallback for old format
        freshCampaigns = campaignResult;
      }
      
      logger.info(`✅ Fetched ${freshCampaigns.length} fresh Google Ads campaigns`);
    } catch (campaignError: any) {
      logger.error('❌ Failed to fetch Google Ads campaign data:', campaignError);
      return createErrorResponse(`Failed to fetch Google Ads data: ${campaignError?.message || campaignError}`, 500);
    }
    
    // Calculate totals from fresh data
    const totalSpend = freshCampaigns.reduce((sum: number, campaign: any) => sum + (campaign.spend || 0), 0);
    const totalImpressions = freshCampaigns.reduce((sum: number, campaign: any) => sum + (campaign.impressions || 0), 0);
    const totalClicks = freshCampaigns.reduce((sum: number, campaign: any) => sum + (campaign.clicks || 0), 0);

    const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const averageCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

    // ✅ CRITICAL FIX: Booking steps MUST come ONLY from Google Ads API directly
    // NO calculations, NO daily_kpi_data, NO estimates - ONLY API data
    console.log('📊 AGGREGATING GOOGLE ADS CONVERSION METRICS FROM API DATA ONLY...');
    console.log('✅ BOOKING STEPS: Using ONLY Google Ads API data (freshCampaigns) - NO daily_kpi_data, NO calculations');
    
    // ✅ ALWAYS use freshCampaigns for booking steps (they come directly from Google Ads API)
    // The getCampaignData() function already parsed conversion actions via parseGoogleAdsConversions()
    const bookingStep1 = Math.round(freshCampaigns.reduce((sum: number, c: any) => sum + (c.booking_step_1 || 0), 0));
    const bookingStep2 = Math.round(freshCampaigns.reduce((sum: number, c: any) => sum + (c.booking_step_2 || 0), 0));
    const bookingStep3 = Math.round(freshCampaigns.reduce((sum: number, c: any) => sum + (c.booking_step_3 || 0), 0));
    
    console.log(`✅ BOOKING STEPS FROM API: Step1=${bookingStep1}, Step2=${bookingStep2}, Step3=${bookingStep3}`);
    
    // E-mail / Telefon: same source as Google Ads UI — Σ campaigns from getCampaignData →
    // parseGoogleAdsConversions (never daily_kpi overrides; avoids stale or divergent KPI rows).
    const totalReservationValue = freshCampaigns.reduce((sum: number, c: any) => sum + (c.reservation_value || 0), 0);
    const conversionValue = freshCampaigns.reduce((sum: number, c: any) => sum + (c.conversion_value || 0), 0);
    const totalConversionValue = freshCampaigns.reduce((sum: number, c: any) => sum + (c.total_conversion_value || 0), 0);
    const totalReservations = Math.round(freshCampaigns.reduce((sum: number, c: any) => sum + (c.reservations || 0), 0));
    
    const clickToCall = Math.round(
      sumGooglePhoneContactsFromCampaigns(freshCampaigns as Record<string, unknown>[])
    );
    const emailContacts = Math.round(
      sumGoogleEmailContactsFromCampaigns(freshCampaigns as Record<string, unknown>[])
    );
    
    const conversionMetrics = {
      click_to_call: clickToCall,
      email_contacts: emailContacts,
      // ✅ CRITICAL: Booking steps ALWAYS from API only
      booking_step_1: bookingStep1,
      booking_step_2: bookingStep2,
      booking_step_3: bookingStep3,
      reservations: totalReservations,
      reservation_value: Math.round(totalReservationValue * 100) / 100,
      conversion_value: Math.round(conversionValue * 100) / 100, // "Wartość konwersji"
      total_conversion_value: Math.round(totalConversionValue * 100) / 100, // "Łączna wartość konwersji"
      roas: totalSpend > 0 ? Math.round((totalConversionValue / totalSpend) * 100) / 100 : 0,
      cost_per_reservation: totalReservations > 0 ? Math.round((totalSpend / totalReservations) * 100) / 100 : 0
    };
    
    console.log('📊 FINAL GOOGLE ADS CONVERSION METRICS (booking steps from API only):', conversionMetrics);

    // Fetch Google Ads tables data with a tiered strategy:
    //   1) Smart cache (current month) — covers ~80% of requests, sub-second.
    //   2) Persistent google_ads_tables_data row for this exact date range.
    //   3) Live Google Ads API call (and persist to (2) for next time).
    // This ordering means historical periods, weekly views, and custom
    // date ranges all return populated networks/devices/keywords/
    // demographics/regions instead of empty arrays.
    console.log('📊 FETCHING GOOGLE ADS TABLES DATA...');
    const {
      loadGoogleAdsTablesFromDatabase,
      fetchAndStoreGoogleAdsTables,
      hasAnyGoogleAdsTablesRows,
      normalizeGoogleAdsTables,
      EMPTY_GOOGLE_ADS_TABLES,
    } = await import('@/lib/google-ads-tables-storage');
    let googleAdsTables: any = null;

    try {
      const { getGoogleAdsSmartCacheData } = await import('@/lib/google-ads-smart-cache-helper');
      const smartCacheResult = await getGoogleAdsSmartCacheData(client.id, false);

      if (smartCacheResult.success && smartCacheResult.data?.googleAdsTables) {
        console.log('✅ GOOGLE ADS TABLES DATA FROM SMART CACHE');
        googleAdsTables = normalizeGoogleAdsTables(smartCacheResult.data.googleAdsTables);
        if (!hasAnyGoogleAdsTablesRows(googleAdsTables)) {
          googleAdsTables = null;
        }
      }
    } catch (error: any) {
      logger.warn('⚠️ Smart cache lookup for tables failed:', error?.message || error);
    }

    if (!googleAdsTables) {
      const stored = await loadGoogleAdsTablesFromDatabase(client.id, startDate, endDate);
      if (hasAnyGoogleAdsTablesRows(stored)) {
        console.log('✅ GOOGLE ADS TABLES DATA FROM google_ads_tables_data');
        googleAdsTables = stored;
      }
    }

    if (!googleAdsTables) {
      console.log('⚠️ No cached tables, fetching from live Google Ads API...');
      const live = await fetchAndStoreGoogleAdsTables(
        googleAdsService,
        client.id,
        startDate,
        endDate,
      );
      googleAdsTables = live ?? { ...EMPTY_GOOGLE_ADS_TABLES };
    }

    // Get account info
    const accountInfo = await googleAdsService.getAccountInfo();

    let dynamicMetricValues: Record<string, number> = {};
    let dynamicMetricRows: Array<{ key: string; id: string; label: string; count: number; value: number }> = [];
    try {
      const dyn = await fetchGoogleDynamicConversionRows(client.id, startDate, endDate);
      if (dyn.fetchOk) {
        dynamicMetricValues = googleDynamicRowsToMetricMap(dyn.rows);
        dynamicMetricRows = dyn.rows.map((r) => ({
          key: r.key,
          id: r.id,
          label: r.label,
          count: r.count,
          value: r.value
        }));
      }
    } catch (dynErr) {
      logger.warn('fetch-google-ads-live-data: dynamic conversions fetch failed', dynErr);
    }

    const result = {
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        google_ads_customer_id: client.google_ads_customer_id,
        currency: accountInfo.currency || 'PLN'
      },
      dateRange: {
        start: startDate,
        end: endDate
      },
      campaigns: freshCampaigns,
      stats: {
        totalSpend,
        totalImpressions,
        totalClicks,
        /** Align with stored `total_conversions` + metrics audit (primary booking count). */
        totalConversions: conversionMetrics.reservations,
        averageCtr,
        averageCpc
      },
      conversionMetrics,
      googleAdsTables,
      accountInfo,
      fromDatabase: false,
      platform: 'google',
      // Add debug info about conversion mapping
      conversionDebug: conversionDebug || {
        allActionNames: [],
        unmappedActions: [],
        totalActions: 0,
        unmappedCount: 0
      },
      /** dyn_google_* keys aligned with metrics config / discovery */
      dynamicMetricValues,
      /** Same data as key→count map, with conversion action names for UI / audit */
      dynamicMetricRows,
    };

    const responseTime = Date.now() - startTime;
    logger.info('🚀 Google Ads API response completed', {
      responseTime: `${responseTime}ms`,
      source: 'live_api',
      campaignCount: freshCampaigns.length,
      totalSpend,
      totalConversions: conversionMetrics.reservations
    });

    // ✅ NEW: Update database immediately if this is a refresh request
    // This ensures hard refresh shows correct data instead of waiting for cron job
    // Works for all users in production mode - dynamically handles any client and date range
    if (forceFresh || bypassAllCache || reason?.includes('refresh')) {
      console.log('💾 REFRESH REQUEST: Updating database with fresh data for client:', client.id);
      
      try {
        // ✅ DYNAMIC: Determine if this is monthly or weekly based on date range
        // Works for any date range - automatically detects type
        const daysDiff = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const summaryType = daysDiff <= 7 ? 'weekly' : 'monthly';
        
        // ✅ DYNAMIC: Calculate summary_date based on date range type
        // For monthly: use first day of month (e.g., 2026-01-01)
        // For weekly: use Monday of the week (ISO 8601 standard)
        let summaryDate: string;
        try {
          if (summaryType === 'monthly') {
            // Extract year and month from start date (handles any month/year)
            const startDateObj = new Date(startDate + 'T00:00:00.000Z'); // Use UTC to avoid timezone issues
            if (isNaN(startDateObj.getTime())) {
              throw new Error(`Invalid start date: ${startDate}`);
            }
            const year = startDateObj.getFullYear();
            const month = String(startDateObj.getMonth() + 1).padStart(2, '0');
            summaryDate = `${year}-${month}-01`;
          } else {
            // For weekly, use Monday of the week (same logic as BackgroundDataCollector)
            const { getMondayOfWeek, formatDateISO } = await import('../../../lib/week-helpers');
            const startDateObj = new Date(startDate + 'T00:00:00.000Z');
            if (isNaN(startDateObj.getTime())) {
              throw new Error(`Invalid start date: ${startDate}`);
            }
            const weekMonday = getMondayOfWeek(startDateObj);
            summaryDate = formatDateISO(weekMonday);
          }
        } catch (dateError: any) {
          console.error('❌ Error calculating summary_date:', dateError);
          logger.error('❌ Error calculating summary_date:', dateError);
          throw dateError; // Re-throw to be caught by outer catch
        }
        
        // ✅ DYNAMIC: Calculate derived metrics
        const cost_per_reservation = conversionMetrics.reservations > 0 ? totalSpend / conversionMetrics.reservations : 0;
        const activeCampaigns = freshCampaigns.filter((c: any) => c.status === 'ENABLED' || c.status === 'ACTIVE').length;
        
        // ✅ DYNAMIC: Prepare summary data for any client and date range
        const summary = {
          client_id: client.id,
          summary_type: summaryType,
          summary_date: summaryDate,
          platform: 'google',
          total_spend: totalSpend,
          total_impressions: Math.round(totalImpressions),
          total_clicks: Math.round(totalClicks),
          total_conversions: Math.round(conversionMetrics.reservations || 0),
          average_ctr: averageCtr,
          average_cpc: averageCpc,
          click_to_call: Math.round(conversionMetrics.click_to_call || 0),
          email_contacts: Math.round(conversionMetrics.email_contacts || 0),
          booking_step_1: Math.round(conversionMetrics.booking_step_1 || 0),
          booking_step_2: Math.round(conversionMetrics.booking_step_2 || 0),
          booking_step_3: Math.round(conversionMetrics.booking_step_3 || 0),
          reservations: Math.round(conversionMetrics.reservations || 0),
          reservation_value: conversionMetrics.reservation_value || 0,
          conversion_value: conversionMetrics.conversion_value || 0,
          total_conversion_value: conversionMetrics.total_conversion_value || 0,
          cost_per_reservation: cost_per_reservation,
          roas: conversionMetrics.roas || 0,
          campaign_data: freshCampaigns,
          google_ads_tables: googleAdsTables,
          google_dynamic_metric_values: dynamicMetricValues,
          google_dynamic_metric_rows: dynamicMetricRows,
          active_campaign_count: activeCampaigns,
          total_campaigns: freshCampaigns.length,
          data_source: 'live_api_refresh', // ✅ Track that this was updated via refresh button
          last_updated: new Date().toISOString()
        };
        
        console.log('💾 Upserting to database:', {
          clientId: client.id,
          summaryType,
          summaryDate,
          totalConversions: Math.round(conversionMetrics.reservations || 0),
          campaignCount: freshCampaigns.length,
          dateRange: `${startDate} to ${endDate}`
        });
        
        // ✅ DYNAMIC: Upsert to database (works for any client, any date range)
        const { error: dbError } = await supabase
          .from('campaign_summaries')
          .upsert(summary, {
            onConflict: 'client_id,summary_type,summary_date,platform'
          });
        
        if (dbError) {
          console.error('❌ Failed to update database after refresh:', {
            error: dbError.message,
            clientId: client.id,
            summaryType,
            summaryDate
          });
          logger.error('❌ Failed to update database after refresh:', {
            error: dbError,
            clientId: client.id,
            summaryType,
            summaryDate
          });
        } else {
          console.log('✅ Database updated with fresh data:', {
            clientId: client.id,
            clientName: client.name,
            summaryType,
            summaryDate,
            totalConversions: Math.round(conversionMetrics.reservations || 0),
            totalSpend: totalSpend.toFixed(2),
            campaignCount: freshCampaigns.length,
            note: 'Hard refresh will now show correct value from database'
          });
          logger.info('✅ Database updated with fresh data after refresh', {
            clientId: client.id,
            summaryType,
            summaryDate,
            totalConversions: Math.round(conversionMetrics.reservations || 0),
            totalSpend,
            campaignCount: freshCampaigns.length
          });
        }
      } catch (updateError: any) {
        console.error('❌ Error updating database after refresh:', {
          error: updateError?.message || updateError,
          clientId: client.id,
          dateRange: `${startDate} to ${endDate}`,
          stack: updateError?.stack
        });
        logger.error('❌ Error updating database after refresh:', {
          error: updateError,
          clientId: client.id,
          dateRange: `${startDate} to ${endDate}`
        });
        // ✅ Don't fail the request - just log the error so UI still works
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
      responseTime,
      source: 'live_api'
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    // Detailed error logging for debugging
    console.error('🚨 GOOGLE ADS API DETAILED ERROR:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      name: error instanceof Error ? error.name : 'Unknown error type',
      timestamp: new Date().toISOString(),
      responseTime
    });
    
    logger.error('❌ Google Ads live data fetch failed:', error);
    
    // Determine appropriate status code
    let statusCode = 500;
    let errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    // Check for specific error types that should return 400
    if (errorMessage.includes('Client ID') || 
        errorMessage.includes('Date range') || 
        errorMessage.includes('required') ||
        errorMessage.includes('validation')) {
      statusCode = 400;
    }
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      responseTime,
      debug: process.env.NODE_ENV === 'development' ? {
        stack: error instanceof Error ? error.stack : null,
        name: error instanceof Error ? error.name : null
      } : undefined
    }, { status: statusCode });
  }
}
