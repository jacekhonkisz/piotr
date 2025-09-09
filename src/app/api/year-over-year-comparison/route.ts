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
    
    // 🔓 AUTH DISABLED: Same as reports page - no authentication required
    logger.info('🔓 Authentication disabled for year-over-year-comparison API (same as reports page)');
    
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
    
    // No access control check (auth disabled)

    logger.info(`📊 Fetching year-over-year comparison for client ${clientId} (${clientData.name})`);
    logger.info(`   Current period: ${dateRange.start} to ${dateRange.end}`);

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

    // ✅ UNIFIED APPROACH: Use EXACT same StandardizedDataFetcher system as reports page
    logger.info('🔄 Fetching CURRENT year data using EXACT same system as reports page...');
    logger.info('🎯 YoY API: Using StandardizedDataFetcher (same as reports page)');

    let currentMetaData = null;
    let currentGoogleData = null;
    
    // Fetch current Meta data using StandardizedDataFetcher (same as reports page)
    try {
      logger.info('🎯 Using StandardizedDataFetcher for current Meta data (same as reports)...');
      const { StandardizedDataFetcher } = await import('../../../lib/standardized-data-fetcher');
      
      const metaResult = await StandardizedDataFetcher.fetchData({
        clientId,
        dateRange,
        platform: 'meta',
        reason: 'yoy-current-meta-standardized',
        sessionToken: undefined // No auth required
      });
      
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
        
        logger.info('✅ Current Meta data fetched using StandardizedDataFetcher:', currentMetaData);
      } else {
        logger.warn('⚠️ StandardizedDataFetcher failed for current Meta data:', metaResult);
      }
    } catch (error) {
      logger.warn('⚠️ Failed to fetch current Meta data using StandardizedDataFetcher:', error);
    }
    
    // Fetch current Google data using GoogleAdsStandardizedDataFetcher (same as reports page)
    try {
      logger.info('🎯 Using GoogleAdsStandardizedDataFetcher for current Google data (same as reports)...');
      const { GoogleAdsStandardizedDataFetcher } = await import('../../../lib/google-ads-standardized-data-fetcher');
      
      const googleResult = await GoogleAdsStandardizedDataFetcher.fetchData({
        clientId,
        dateRange,
        reason: 'yoy-current-google-standardized',
        sessionToken: undefined // No auth required
      });
      
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
        logger.info('✅ Current Google data fetched using GoogleAdsStandardizedDataFetcher:', currentGoogleData);
      } else {
        logger.warn('⚠️ GoogleAdsStandardizedDataFetcher failed for current Google data:', googleResult);
      }
    } catch (error) {
      logger.warn('⚠️ Failed to fetch current Google data using GoogleAdsStandardizedDataFetcher:', error);
    }

    // ✅ UNIFIED APPROACH: Use EXACT same StandardizedDataFetcher system for previous year too
    logger.info('🔄 Fetching previous year data using EXACT same system as reports page...');

    let previousMetaData = null;
    let previousGoogleData = null;

    // Fetch previous year Meta data using StandardizedDataFetcher (same as reports page)
    try {
      logger.info('🎯 Using StandardizedDataFetcher for previous Meta data (same as reports)...');
      const { StandardizedDataFetcher } = await import('../../../lib/standardized-data-fetcher');
      
      const prevMetaResult = await StandardizedDataFetcher.fetchData({
        clientId,
        dateRange: {
          start: previousYearRange.start || '2023-01-01',
          end: previousYearRange.end || '2023-12-31'
        },
        platform: 'meta',
        reason: 'yoy-previous-meta-standardized',
        sessionToken: undefined // No auth required
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
        logger.info('✅ Previous year Meta data fetched using StandardizedDataFetcher:', previousMetaData);
      } else {
        logger.warn('⚠️ StandardizedDataFetcher failed for previous Meta data:', prevMetaResult);
      }
    } catch (error) {
      logger.error('❌ Failed to fetch previous year Meta data:', error);
    }

    // Fetch previous year Google data using GoogleAdsStandardizedDataFetcher (same as reports page)
    try {
      logger.info('🎯 Using GoogleAdsStandardizedDataFetcher for previous Google data (same as reports)...');
      const { GoogleAdsStandardizedDataFetcher } = await import('../../../lib/google-ads-standardized-data-fetcher');
      
      const prevGoogleResult = await GoogleAdsStandardizedDataFetcher.fetchData({
        clientId,
        dateRange: {
          start: previousYearRange.start || '2023-01-01',
          end: previousYearRange.end || '2023-12-31'
        },
        reason: 'yoy-previous-google-standardized',
        sessionToken: undefined // No auth required
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
        logger.info('✅ Previous year Google data fetched using GoogleAdsStandardizedDataFetcher:', previousGoogleData);
      } else {
        logger.warn('⚠️ GoogleAdsStandardizedDataFetcher failed for previous Google data:', prevGoogleResult);
      }
    } catch (error) {
      logger.error('❌ Failed to fetch previous year Google data using GoogleAdsStandardizedDataFetcher:', error);
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
