import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest, canAccessClient, createErrorResponse } from '../../../lib/auth-middleware';
import logger from '../../../lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface YearOverYearData {
  current: {
    spend: number;
    impressions: number;
    clicks: number;
    reservations: number;
    reservation_value: number;
    booking_step_1: number;
    booking_step_2: number;
    booking_step_3: number;
    // Google Ads specific fields
    google_spend: number;
    google_impressions: number;
    google_clicks: number;
    google_reservations: number;
    google_reservation_value: number;
    google_booking_step_1: number;
    google_booking_step_2: number;
    google_booking_step_3: number;
  };
  previous: {
    spend: number;
    impressions: number;
    clicks: number;
    reservations: number;
    reservation_value: number;
    booking_step_1: number;
    booking_step_2: number;
    booking_step_3: number;
    // Google Ads specific fields
    google_spend: number;
    google_impressions: number;
    google_clicks: number;
    google_reservations: number;
    google_reservation_value: number;
    google_booking_step_1: number;
    google_booking_step_2: number;
    google_booking_step_3: number;
  };
  changes: {
    spend: number;
    impressions: number;
    clicks: number;
    reservations: number;
    reservation_value: number;
    booking_step_1: number;
    booking_step_2: number;
    booking_step_3: number;
    // Google Ads specific fields
    google_spend: number;
    google_impressions: number;
    google_clicks: number;
    google_reservations: number;
    google_reservation_value: number;
    google_booking_step_1: number;
    google_booking_step_2: number;
    google_booking_step_3: number;
  };
}

// Helper function to get previous year date range
function getPreviousYearDateRange(dateRange: { start: string; end: string }) {
  const startDate = new Date(dateRange.start);
  const endDate = new Date(dateRange.end);
  
  const previousYearStart = new Date(startDate);
  previousYearStart.setFullYear(startDate.getFullYear() - 1);
  
  const previousYearEnd = new Date(endDate);
  previousYearEnd.setFullYear(endDate.getFullYear() - 1);
  
  return {
    start: previousYearStart.toISOString().split('T')[0],
    end: previousYearEnd.toISOString().split('T')[0]
  };
}

// Helper function to calculate percentage change
function calculatePercentageChange(current: number, previous: number): number {
  // If no previous data exists, don't show misleading percentage
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

// Helper function to aggregate campaign data
function aggregateCampaignData(campaigns: any[]) {
  return campaigns.reduce((acc, campaign) => ({
    spend: acc.spend + (campaign.spend || 0),
    impressions: acc.impressions + (campaign.impressions || 0),
    clicks: acc.clicks + (campaign.clicks || 0),
    reservations: acc.reservations + (campaign.reservations || 0),
    reservation_value: acc.reservation_value + (campaign.reservation_value || 0),
    booking_step_1: acc.booking_step_1 + (campaign.booking_step_1 || 0),
    booking_step_2: acc.booking_step_2 + (campaign.booking_step_2 || 0),
    booking_step_3: acc.booking_step_3 + (campaign.booking_step_3 || 0),
  }), {
    spend: 0,
    impressions: 0,
    clicks: 0,
    reservations: 0,
    reservation_value: 0,
    booking_step_1: 0,
    booking_step_2: 0,
    booking_step_3: 0,
  });
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('🚨 CRITICAL: YoY API REACHED!');
    logger.info('🚨 CRITICAL: YoY API REACHED!');
    logger.info('📊 Year-over-year comparison API called');
    
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createErrorResponse(authResult.error || 'Authentication failed', authResult.statusCode || 401);
    }

    const { user } = authResult;
    
    // Parse request body
    const { clientId, dateRange } = await request.json();

    if (!clientId || !dateRange?.start || !dateRange?.end) {
      return createErrorResponse('Missing required parameters: clientId, dateRange.start, dateRange.end', 400);
    }

    // ✅ REMOVED: Hardcoded blocker for short periods - let YoY work for any period
    logger.info('📊 Processing year-over-year comparison for any date range', {
        clientId,
        dateRange,
      reason: 'Removed hardcoded restrictions - using same data sources as reports page'
    });
    
    // Get client data and validate access
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();
      
    if (clientError || !clientData) {
      logger.error('❌ Client not found:', { clientId, error: clientError });
      return createErrorResponse('Client not found', 404);
    }
    
    // Check if user can access this client
    if (!canAccessClient(user, clientData.email)) {
      return createErrorResponse('Access denied', 403);
    }

    logger.info(`📊 Fetching year-over-year comparison for client ${clientId} (${clientData.name})`);
    logger.info(`   Current period: ${dateRange.start} to ${dateRange.end}`);
    logger.info(`   Authenticated user: ${user.email}`);

    // Get previous year date range
    const previousYearRange = getPreviousYearDateRange(dateRange);
    logger.info(`   Previous year period: ${previousYearRange.start} to ${previousYearRange.end}`);
    
    // 🔍 CRITICAL DEBUG: Log exact date calculations
    logger.info('🔍 CRITICAL DATE RANGE DEBUG:', {
      inputCurrentStart: dateRange.start,
      inputCurrentEnd: dateRange.end,
      calculatedPreviousStart: previousYearRange.start,
      calculatedPreviousEnd: previousYearRange.end,
      currentYear: new Date(dateRange.start || '2024-01-01').getFullYear(),
      previousYear: new Date(previousYearRange.start || '2023-01-01').getFullYear(),
      currentMonth: new Date(dateRange.start || '2024-01-01').getMonth() + 1,
      previousMonth: new Date(previousYearRange.start || '2023-01-01').getMonth() + 1,
      note: 'This shows exactly what periods are being compared'
    });

    // Debug: Check what data exists in the database for this client
    const { data: allClientData, error: debugError } = await supabase
      .from('campaign_summaries')
      .select('summary_date, platform, total_spend, reservation_value, reservations')
      .eq('client_id', clientId)
      .order('summary_date', { ascending: false })
      .limit(10);
      
    logger.info('🔍 Debug: Recent data in database for this client:', {
      clientId,
      recentData: allClientData?.map(d => ({
        date: d.summary_date,
        platform: d.platform,
        spend: d.total_spend,
        reservation_value: d.reservation_value
      }))
    });

    // ✅ NEW APPROACH: Use the same APIs as reports page for current year data
    logger.info('🔄 Fetching CURRENT year data using same APIs as reports page...');
    
    // Get auth header for API calls
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return createErrorResponse('Missing authorization header', 401);
    }

    let currentMetaData = null;
    let currentGoogleData = null;
    
    // Fetch current Meta data using same API as reports page
    try {
      const metaResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/fetch-live-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          clientId,
          dateRange,
          platform: 'meta'
        })
      });
      
      if (metaResponse.ok) {
        const metaResult = await metaResponse.json();
        if (metaResult.success && metaResult.data) {
          currentMetaData = {
            spend: metaResult.data.stats?.totalSpend || 0,
            impressions: metaResult.data.stats?.totalImpressions || 0,
            clicks: metaResult.data.stats?.totalClicks || 0,
            reservations: metaResult.data.conversionMetrics?.reservations || 0,
            reservation_value: metaResult.data.conversionMetrics?.reservation_value || 0,
            booking_step_1: metaResult.data.conversionMetrics?.booking_step_1 || 0,
            booking_step_2: metaResult.data.conversionMetrics?.booking_step_2 || 0,
            booking_step_3: metaResult.data.conversionMetrics?.booking_step_3 || 0,
          };
          
          // 🔍 DEBUG: Log detailed reservation value data
          logger.info('✅ Current Meta data fetched from live API:', currentMetaData);
          logger.info('🔍 RESERVATION VALUE DEBUG:', {
            rawReservationValue: metaResult.data.conversionMetrics?.reservation_value,
            finalReservationValue: currentMetaData.reservation_value,
            hasConversionMetrics: !!metaResult.data.conversionMetrics,
            conversionMetricsKeys: metaResult.data.conversionMetrics ? Object.keys(metaResult.data.conversionMetrics) : [],
            allConversionMetrics: metaResult.data.conversionMetrics
          });
        }
      }
    } catch (error) {
      logger.warn('⚠️ Failed to fetch current Meta data from live API:', error);
    }
    
    // Fetch current Google data using same API as reports page
    try {
      const googleResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/fetch-google-ads-live-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          clientId,
          dateRange,
          platform: 'google'
        })
      });
      
      if (googleResponse.ok) {
        const googleResult = await googleResponse.json();
        if (googleResult.success && googleResult.data) {
          currentGoogleData = {
            google_spend: googleResult.data.stats?.totalSpend || 0,
            google_impressions: googleResult.data.stats?.totalImpressions || 0,
            google_clicks: googleResult.data.stats?.totalClicks || 0,
            google_reservations: googleResult.data.conversionMetrics?.reservations || 0,
            google_reservation_value: googleResult.data.conversionMetrics?.reservation_value || 0,
            google_booking_step_1: googleResult.data.conversionMetrics?.booking_step_1 || 0,
            google_booking_step_2: googleResult.data.conversionMetrics?.booking_step_2 || 0,
            google_booking_step_3: googleResult.data.conversionMetrics?.booking_step_3 || 0,
          };
          logger.info('✅ Current Google data fetched from live API:', currentGoogleData);
        }
      }
    } catch (error) {
      logger.warn('⚠️ Failed to fetch current Google data from live API:', error);
    }

    // ✅ USE SAME APPROACH AS REPORTS PAGE: Call /api/fetch-live-data for previous year
    logger.info('🔄 Fetching previous year data using SAME APIs as reports page...');

    let previousMetaData = null;
    let previousGoogleData = null;

    // Check if previous year is within API limits (37 months) - used for both Meta and Google
    const previousYearStart = new Date(previousYearRange.start || '2020-01-01');
    const now = new Date();
    const maxPastDate = new Date(now);
    maxPastDate.setMonth(maxPastDate.getMonth() - 37);
    const isWithinAPILimits = previousYearStart >= maxPastDate;

    // Fetch previous year Meta data using SAME API as reports page
    try {
      logger.info('🔄 Fetching previous year Meta data using /api/fetch-live-data (same as reports page)...');
      
      logger.info('📅 Previous year API limits check:', {
        previousYearStart: previousYearRange.start,
        maxPastDate: maxPastDate.toISOString().split('T')[0],
        isWithinAPILimits,
        willForceFresh: isWithinAPILimits
      });
      
      const prevMetaResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/fetch-live-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          clientId,
          dateRange: previousYearRange,
          platform: 'meta',
          forceFresh: isWithinAPILimits // Force fresh API call if within limits
        })
      });
      
      logger.info('📊 Previous year Meta API response:', {
        status: prevMetaResponse.status,
        statusText: prevMetaResponse.statusText,
        ok: prevMetaResponse.ok
      });
      
      if (prevMetaResponse.ok) {
        const prevMetaResult = await prevMetaResponse.json();
        logger.info('🔍 Previous year Meta API data structure:', {
          success: prevMetaResult.success,
          hasData: !!prevMetaResult.data,
          dataKeys: prevMetaResult.data ? Object.keys(prevMetaResult.data) : [],
          hasConversionMetrics: !!prevMetaResult.data?.conversionMetrics,
          reservationValue: prevMetaResult.data?.conversionMetrics?.reservation_value,
          totalSpend: prevMetaResult.data?.stats?.totalSpend
        });
        
        if (prevMetaResult.success && prevMetaResult.data) {
          previousMetaData = {
            spend: prevMetaResult.data.stats?.totalSpend || 0,
            impressions: prevMetaResult.data.stats?.totalImpressions || 0,
            clicks: prevMetaResult.data.stats?.totalClicks || 0,
            reservations: prevMetaResult.data.conversionMetrics?.reservations || 0,
            reservation_value: prevMetaResult.data.conversionMetrics?.reservation_value || 0,
            booking_step_1: prevMetaResult.data.conversionMetrics?.booking_step_1 || 0,
            booking_step_2: prevMetaResult.data.conversionMetrics?.booking_step_2 || 0,
            booking_step_3: prevMetaResult.data.conversionMetrics?.booking_step_3 || 0,
          };
          logger.info('✅ Previous year Meta data fetched successfully:', {
            ...previousMetaData,
            dateRange: previousYearRange,
            forcedFresh: isWithinAPILimits
          });
        } else {
          logger.warn('⚠️ Previous year Meta API returned no data:', {
            success: prevMetaResult.success,
            hasData: !!prevMetaResult.data,
            error: prevMetaResult.error,
            dateRange: previousYearRange,
            isWithinAPILimits,
            suggestion: 'This might be because there was no campaign activity during this period, or the data is beyond API limits'
          });
        }
      } else {
        const errorText = await prevMetaResponse.text();
        logger.error('❌ Previous year Meta API call failed:', {
          status: prevMetaResponse.status,
          statusText: prevMetaResponse.statusText,
          error: errorText
        });
      }
    } catch (error) {
      logger.error('❌ Failed to fetch previous year Meta data:', error);
    }

    // Fetch previous year Google data using SAME API as reports page
    try {
      logger.info('🔄 Fetching previous year Google data using /api/fetch-google-ads-live-data (same as reports page)...');
      
      // For Google Ads, we can also force fresh if within reasonable limits
      const prevGoogleResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/fetch-google-ads-live-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          clientId,
          dateRange: previousYearRange,
          platform: 'google',
          forceFresh: isWithinAPILimits // Use same logic as Meta
        })
      });
      
      logger.info('📊 Previous year Google API response:', {
        status: prevGoogleResponse.status,
        statusText: prevGoogleResponse.statusText,
        ok: prevGoogleResponse.ok
      });
      
      if (prevGoogleResponse.ok) {
        const prevGoogleResult = await prevGoogleResponse.json();
        logger.info('🔍 Previous year Google API data structure:', {
          success: prevGoogleResult.success,
          hasData: !!prevGoogleResult.data,
          dataKeys: prevGoogleResult.data ? Object.keys(prevGoogleResult.data) : [],
          hasConversionMetrics: !!prevGoogleResult.data?.conversionMetrics,
          reservationValue: prevGoogleResult.data?.conversionMetrics?.reservation_value,
          totalSpend: prevGoogleResult.data?.stats?.totalSpend
        });
        
        if (prevGoogleResult.success && prevGoogleResult.data) {
          previousGoogleData = {
            google_spend: prevGoogleResult.data.stats?.totalSpend || 0,
            google_impressions: prevGoogleResult.data.stats?.totalImpressions || 0,
            google_clicks: prevGoogleResult.data.stats?.totalClicks || 0,
            google_reservations: prevGoogleResult.data.conversionMetrics?.reservations || 0,
            google_reservation_value: prevGoogleResult.data.conversionMetrics?.reservation_value || 0,
            google_booking_step_1: prevGoogleResult.data.conversionMetrics?.booking_step_1 || 0,
            google_booking_step_2: prevGoogleResult.data.conversionMetrics?.booking_step_2 || 0,
            google_booking_step_3: prevGoogleResult.data.conversionMetrics?.booking_step_3 || 0,
          };
          logger.info('✅ Previous year Google data fetched successfully:', {
            ...previousGoogleData,
            dateRange: previousYearRange,
            forcedFresh: isWithinAPILimits
          });
        } else {
          logger.warn('⚠️ Previous year Google API returned no data:', {
            success: prevGoogleResult.success,
            hasData: !!prevGoogleResult.data,
            error: prevGoogleResult.error,
            dateRange: previousYearRange,
            isWithinAPILimits,
            suggestion: 'This might be because there was no Google Ads activity during this period, or the data is beyond API limits'
          });
        }
      } else {
        const errorText = await prevGoogleResponse.text();
        logger.error('❌ Previous year Google API call failed:', {
          status: prevGoogleResponse.status,
          statusText: prevGoogleResponse.statusText,
          error: errorText
        });
      }
    } catch (error) {
      logger.error('❌ Failed to fetch previous year Google data:', error);
    }

    // ✅ LOG FINAL DATA AVAILABILITY STATUS
    logger.info('📊 Final data availability check:', {
      metaCurrentExists: !!currentMetaData && currentMetaData.reservation_value > 0,
      metaPreviousExists: !!previousMetaData && previousMetaData.reservation_value > 0,
      googleCurrentExists: !!currentGoogleData && currentGoogleData.google_reservation_value > 0,
      googlePreviousExists: !!previousGoogleData && previousGoogleData.google_reservation_value > 0,
      previousYearRange,
      message: 'Using same APIs as reports page for previous year data'
    });


    // ✅ ENSURE DATA OBJECTS EXIST (but keep values as 0 if no real data found)
    previousMetaData = previousMetaData || { spend: 0, impressions: 0, clicks: 0, reservations: 0, reservation_value: 0, booking_step_1: 0, booking_step_2: 0, booking_step_3: 0 };
    previousGoogleData = previousGoogleData || { google_spend: 0, google_impressions: 0, google_clicks: 0, google_reservations: 0, google_reservation_value: 0, google_booking_step_1: 0, google_booking_step_2: 0, google_booking_step_3: 0 };

    logger.info('📊 Final YoY Data Sources:', {
      currentMetaSource: currentMetaData ? 'live-api' : 'none',
      currentGoogleSource: currentGoogleData ? 'live-api' : 'none',
      previousMetaSource: previousMetaData.reservation_value > 0 ? 'database-or-api' : 'none',
      previousGoogleSource: previousGoogleData.google_reservation_value > 0 ? 'database-or-api' : 'none',
      previousMetaSpend: previousMetaData.spend,
      previousMetaReservationValue: previousMetaData.reservation_value,
      previousGoogleSpend: previousGoogleData.google_spend,
      previousGoogleReservationValue: previousGoogleData.google_reservation_value,
      dateRange,
      previousYearRange
    });



    // ✅ Use current year data from live APIs (already fetched above)
    const finalCurrentMetaData = currentMetaData || {
      spend: 0,
      impressions: 0,
      clicks: 0,
      reservations: 0,
      reservation_value: 0,
      booking_step_1: 0,
      booking_step_2: 0,
      booking_step_3: 0,
    };

    const finalCurrentGoogleData = currentGoogleData || {
      google_spend: 0,
      google_impressions: 0,
      google_clicks: 0,
      google_reservations: 0,
      google_reservation_value: 0,
      google_booking_step_1: 0,
      google_booking_step_2: 0,
      google_booking_step_3: 0,
    };

    // ✅ Previous year data already fetched above using smart logic

    // Combine current year data (using live API data)
    const currentData = {
      ...finalCurrentMetaData,
      ...finalCurrentGoogleData
    };

    // Combine previous year data (from database)
    const previousData = {
      ...previousMetaData,
      ...previousGoogleData
    };

    // Calculate percentage changes
    const changes = {
      spend: calculatePercentageChange(currentData.spend, previousData.spend),
      impressions: calculatePercentageChange(currentData.impressions, previousData.impressions),
      clicks: calculatePercentageChange(currentData.clicks, previousData.clicks),
      reservations: calculatePercentageChange(currentData.reservations, previousData.reservations),
      reservation_value: calculatePercentageChange(currentData.reservation_value, previousData.reservation_value),
      booking_step_1: calculatePercentageChange(currentData.booking_step_1, previousData.booking_step_1),
      booking_step_2: calculatePercentageChange(currentData.booking_step_2, previousData.booking_step_2),
      booking_step_3: calculatePercentageChange(currentData.booking_step_3, previousData.booking_step_3),
      // Google Ads percentage changes
      google_spend: calculatePercentageChange(currentData.google_spend, previousData.google_spend),
      google_impressions: calculatePercentageChange(currentData.google_impressions, previousData.google_impressions),
      google_clicks: calculatePercentageChange(currentData.google_clicks, previousData.google_clicks),
      google_reservations: calculatePercentageChange(currentData.google_reservations, previousData.google_reservations),
      google_reservation_value: calculatePercentageChange(currentData.google_reservation_value, previousData.google_reservation_value),
      google_booking_step_1: calculatePercentageChange(currentData.google_booking_step_1, previousData.google_booking_step_1),
      google_booking_step_2: calculatePercentageChange(currentData.google_booking_step_2, previousData.google_booking_step_2),
      google_booking_step_3: calculatePercentageChange(currentData.google_booking_step_3, previousData.google_booking_step_3),
    };

    const result: YearOverYearData = {
      current: currentData,
      previous: previousData,
      changes,
    };

    const responseTime = Date.now() - startTime;
    
    logger.info('✅ Year-over-year comparison calculated successfully', {
      clientId,
      responseTime,
      currentSpend: currentData.spend,
      previousSpend: previousData.spend,
      spendChange: changes.spend.toFixed(1) + '%',
      currentReservations: currentData.reservations,
      previousReservations: previousData.reservations,
      reservationsChange: changes.reservations.toFixed(1) + '%',
      // 🔍 CRITICAL: Meta reservation value debugging
      currentMetaReservationValue: currentData.reservation_value,
      previousMetaReservationValue: previousData.reservation_value,
      metaReservationValueChange: changes.reservation_value.toFixed(1) + '%',
      // Google Ads data
      googleCurrentSpend: currentData.google_spend,
      googlePreviousSpend: previousData.google_spend,
      googleSpendChange: changes.google_spend.toFixed(1) + '%',
      googleCurrentReservationValue: currentData.google_reservation_value,
      googlePreviousReservationValue: previousData.google_reservation_value,
      googleReservationValueChange: changes.google_reservation_value.toFixed(1) + '%',
      // 🚨 CRITICAL AUDIT DATA
      dateRangeDebug: {
        currentPeriod: `${dateRange.start} to ${dateRange.end}`,
        previousPeriod: `${previousYearRange.start} to ${previousYearRange.end}`,
        note: 'If you see 1,026,464 zł but expect 3,079,443.32 zł from August 2024, check if the previous period matches August 2024'
      }
    });

    return NextResponse.json(result);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('❌ Error in year-over-year comparison API:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime,
      clientId: request.url
    });
    
    return createErrorResponse('Internal server error', 500);
  }
}
