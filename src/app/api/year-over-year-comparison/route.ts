import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper function to get ISO week number for a date
function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Helper function to get the start date of an ISO week
function getISOWeekStartDate(year: number, week: number): Date {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = simple;
  if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  return ISOweekStart;
}

// Helper function to calculate percentage change
const calculateChange = (current: number, previous: number, metricName?: string): number => {
  if (previous === 0) {
    return -999; // Frontend will display this as "N/A" or hide the comparison
  }
  return ((current - previous) / previous) * 100;
};

export async function POST(request: NextRequest) {
  try {
    const { clientId, dateRange, platform } = await request.json();
    
    if (!clientId || !dateRange || !platform) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const requestId = Math.random().toString(36).substring(7);
    console.log(`🔄 [${requestId}] YoY Comparison Request:`, { clientId: clientId.substring(0,8), dateRange, platform });
    
    // Extract authorization header to forward to internal API calls
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.error(`❌ [${requestId}] Missing authorization header`);
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 });
    }

    // Parse date range
    const currentStart = new Date(dateRange.start);
    const currentEnd = new Date(dateRange.end);
    const daysDiff = Math.ceil((currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const isWeekly = daysDiff <= 7;

    console.log(`🔍 [${requestId}] Date analysis:`, {
      currentStart: currentStart.toISOString().split('T')[0],
      currentEnd: currentEnd.toISOString().split('T')[0],
      daysDiff,
      isWeekly
    });
    
    // Calculate previous year date range
    let prevDateRange;
    
    if (isWeekly) {
      // For weekly periods, use proper ISO week calculation to match exact week numbers
      console.log(`🔄 [${requestId}] Weekly period detected - using ISO week calculation`);
      
      // Use the end date of the current week to get the correct ISO week number
      const currentWeekEnd = new Date(currentEnd);
      
      // Get current week number
      const currentWeekNumber = getISOWeekNumber(currentWeekEnd);
      const currentYear = currentWeekEnd.getFullYear();
      
      // Calculate previous year's same week number
      const prevYear = currentYear - 1;
      const prevWeekStart = getISOWeekStartDate(prevYear, currentWeekNumber);
      const prevWeekEnd = new Date(prevWeekStart);
      prevWeekEnd.setDate(prevWeekStart.getDate() + 6);
      
      prevDateRange = {
        start: prevWeekStart.toISOString().split('T')[0],
        end: prevWeekEnd.toISOString().split('T')[0]
      };
    } else {
      // For monthly/custom periods, use simple year subtraction
      const prevYearStart = new Date(currentStart);
      prevYearStart.setFullYear(prevYearStart.getFullYear() - 1);
      const prevYearEnd = new Date(currentEnd);
      prevYearEnd.setFullYear(prevYearEnd.getFullYear() - 1);
      
      prevDateRange = {
      start: prevYearStart.toISOString().split('T')[0],
      end: prevYearEnd.toISOString().split('T')[0]
    };
    }

    console.log(`🔍 [${requestId}] Previous year date range:`, prevDateRange);

    // Fetch current data using the same API as main dashboard for consistency
    console.log(`🔄 [${requestId}] Fetching current data using main dashboard API for consistency...`);
    
    // Define base URL for API calls
    // Use empty string for same-origin requests in production (more reliable than NEXT_PUBLIC_APP_URL)
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? '' 
      : 'http://localhost:3000';
    
    let currentData = null;
    
    // Normalize platform parameter to match database values
    // Frontend might send 'google' but DB uses 'google', or 'meta' for both
    const normalizedPlatform = platform === 'google_ads' ? 'google' : platform;
    
    if (platform === 'google_ads' || platform === 'google') {
        console.log(`🔄 [${requestId}] Platform: Google Ads - using robust API endpoint`);
      // Use the same robust API endpoint as PDF generation with fallback logic
      const response = await fetch(`${baseUrl}/api/fetch-google-ads-live-data`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          clientId,
          dateRange,
          includeTableData: false,
          reason: 'comparison-current-google'
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.stats) {
          currentData = data.data.stats;
          
          // Add funnel data from conversionMetrics if available
          if (data.data.conversionMetrics) {
            currentData.totalBookingStep1 = data.data.conversionMetrics.booking_step_1 || 0;
            currentData.totalBookingStep2 = data.data.conversionMetrics.booking_step_2 || 0;
            currentData.totalBookingStep3 = data.data.conversionMetrics.booking_step_3 || 0;
            currentData.totalReservations = data.data.conversionMetrics.reservations || 0;
            currentData.totalReservationValue = data.data.conversionMetrics.reservation_value || 0;
            
            console.log(`✅ [${requestId}] Added funnel data from Google Ads conversionMetrics:`, {
              funnel: `${currentData.totalBookingStep1}→${currentData.totalBookingStep2}→${currentData.totalBookingStep3}→${currentData.totalReservations}`,
              reservationValue: currentData.totalReservationValue
            });
          }
        } else {
          console.error(`❌ [${requestId}] Google Ads API failed:`, data.error);
        }
      } else {
        console.error(`❌ [${requestId}] Google Ads API failed:`, response.status, response.statusText);
      }
      } else {
      console.log(`🔄 [${requestId}] Platform: Meta - using main dashboard API`);
      
      // Use the same API endpoint as the main dashboard
      const response = await fetch(`${baseUrl}/api/fetch-live-data`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
        clientId,
        dateRange,
        platform: 'meta',
          reason: 'comparison-current-meta'
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.stats) {
          currentData = data.data.stats;
          
          // Add funnel data from conversionMetrics if available
          if (data.data.conversionMetrics) {
            currentData.totalBookingStep1 = data.data.conversionMetrics.booking_step_1 || 0;
            currentData.totalBookingStep2 = data.data.conversionMetrics.booking_step_2 || 0;
            currentData.totalBookingStep3 = data.data.conversionMetrics.booking_step_3 || 0;
            currentData.totalReservations = data.data.conversionMetrics.reservations || 0;
            currentData.totalReservationValue = data.data.conversionMetrics.reservation_value || 0;
            
            console.log(`✅ [${requestId}] Added funnel data from conversionMetrics:`, {
              funnel: `${currentData.totalBookingStep1}→${currentData.totalBookingStep2}→${currentData.totalBookingStep3}→${currentData.totalReservations}`,
              reservationValue: currentData.totalReservationValue
            });
          }
        } else {
          console.error(`❌ [${requestId}] Main dashboard API failed:`, data.error);
        }
      } else {
        console.error(`❌ [${requestId}] Main dashboard API failed:`, response.status, response.statusText);
      }
    }

    console.log(`✅ [${requestId}] Current data from main dashboard API:`, {
      totalSpend: currentData?.totalSpend || 0,
      totalImpressions: currentData?.totalImpressions || 0,
      totalClicks: currentData?.totalClicks || 0,
      funnel: `${currentData?.totalBookingStep1 || 0}→${currentData?.totalBookingStep2 || 0}→${currentData?.totalBookingStep3 || 0}→${currentData?.totalReservations || 0}`
    });

    // Fetch previous year data from campaign_summaries table (same source as current)
    console.log(`🔄 [${requestId}] Fetching previous data from campaign_summaries table for consistency...`);
    
    // Determine summary type based on date range
    const summaryType = isWeekly ? 'weekly' : 'monthly';
    
    // Use normalized platform to match database values ('google' or 'meta')
    const dbPlatform = platform === 'google_ads' ? 'google' : platform;
    
    console.log(`🔍 [${requestId}] Querying previous year with platform='${dbPlatform}'`);
    
    const { data: previousSummariesData, error: previousSummariesError } = await supabase
      .from('campaign_summaries')
      .select('*')
          .eq('client_id', clientId)
      .eq('summary_type', summaryType)
      .eq('platform', dbPlatform)  // ⬅️ Use normalized platform
      .gte('summary_date', prevDateRange.start!)
      .lte('summary_date', prevDateRange.end!)
      .order('summary_date', { ascending: false });

    console.log(`🔍 [${requestId}] Previous summaries query result:`, {
          clientId: clientId.substring(0,8),
      summaryType,
      platform: dbPlatform,  // ⬅️ Log which platform was used
      searchRange: [prevDateRange.start!, prevDateRange.end!],
      foundRecords: previousSummariesData?.length || 0,
      totalSpend: previousSummariesData?.reduce((sum, r) => sum + (r.total_spend || 0), 0) || 0,
      firstRecordPlatform: previousSummariesData?.[0]?.platform || 'none'  // ⬅️ Verify platform in results
    });

    let previousData = {
      spend: 0,
      impressions: 0,
      clicks: 0,
      booking_step_1: 0,
      booking_step_2: 0,
      booking_step_3: 0,
      reservations: 0,
      reservation_value: 0
    };
    
    if (previousSummariesData && previousSummariesData.length > 0) {
      // For monthly data, use the summary that best represents the complete month
      let selectedSummary = previousSummariesData[0]; // Already ordered by date descending
      
      if (summaryType === 'monthly' && previousSummariesData.length > 1) {
        // For monthly data, use the summary that covers the complete month
        // Look for a summary that starts on the 1st of the month (most comprehensive)
        const firstOfMonthSummary = previousSummariesData.find(r => {
          const summaryDate = new Date(r.summary_date);
          return summaryDate.getDate() === 1;
        });
        
        if (firstOfMonthSummary) {
          selectedSummary = firstOfMonthSummary;
          console.log(`⚠️ [${requestId}] Multiple monthly summaries found, using first-of-month summary: ${selectedSummary.summary_date}`);
        } else {
          selectedSummary = previousSummariesData[0];
          console.log(`⚠️ [${requestId}] Multiple monthly summaries found, using most recent: ${selectedSummary.summary_date}`);
        }
      }
      
      previousData = {
        spend: selectedSummary.total_spend || 0,
        impressions: selectedSummary.total_impressions || 0,
        clicks: selectedSummary.total_clicks || 0,
        booking_step_1: selectedSummary.booking_step_1 || 0,
        booking_step_2: selectedSummary.booking_step_2 || 0,
        booking_step_3: selectedSummary.booking_step_3 || 0,
        reservations: selectedSummary.reservations || 0,
        reservation_value: selectedSummary.reservation_value || 0
      };
      
      console.log(`✅ [${requestId}] Previous data from summaries:`, {
        totalSpend: previousData.spend,
        totalImpressions: previousData.impressions,
        totalClicks: previousData.clicks,
        funnel: `${previousData.booking_step_1}→${previousData.booking_step_2}→${previousData.booking_step_3}→${previousData.reservations}`,
        summaryDate: selectedSummary.summary_date
      });
    } else {
      console.log(`❌ [${requestId}] No previous summaries data found - using default values`);
    }
    
    // Calculate changes
    const changes = {
      spend: calculateChange(currentData?.totalSpend || 0, previousData?.spend || 0, 'spend'),
      impressions: calculateChange(currentData?.totalImpressions || 0, previousData?.impressions || 0, 'impressions'),
      clicks: calculateChange(currentData?.totalClicks || 0, previousData?.clicks || 0, 'clicks'),
      booking_step_1: calculateChange(currentData?.totalBookingStep1 || 0, previousData?.booking_step_1 || 0, 'booking_step_1'),
      booking_step_2: calculateChange(currentData?.totalBookingStep2 || 0, previousData?.booking_step_2 || 0, 'booking_step_2'),
      booking_step_3: calculateChange(currentData?.totalBookingStep3 || 0, previousData?.booking_step_3 || 0, 'booking_step_3'),
      reservations: calculateChange(currentData?.totalReservations || 0, previousData?.reservations || 0, 'reservations'),
      reservation_value: calculateChange(currentData?.totalReservationValue || 0, previousData?.reservation_value || 0, 'reservation_value')
    };

    const response = {
      current: {
        spend: currentData?.totalSpend || 0,
        impressions: currentData?.totalImpressions || 0,
        clicks: currentData?.totalClicks || 0,
        booking_step_1: currentData?.totalBookingStep1 || 0,
        booking_step_2: currentData?.totalBookingStep2 || 0,
        booking_step_3: currentData?.totalBookingStep3 || 0,
        reservations: currentData?.totalReservations || 0,
        reservation_value: currentData?.totalReservationValue || 0
      },
      previous: {
        spend: previousData?.spend || 0,
        impressions: previousData?.impressions || 0,
        clicks: previousData?.clicks || 0,
        booking_step_1: previousData?.booking_step_1 || 0,
        booking_step_2: previousData?.booking_step_2 || 0,
        booking_step_3: previousData?.booking_step_3 || 0,
        reservations: previousData?.reservations || 0,
        reservation_value: previousData?.reservation_value || 0
      },
      changes: {
        spend: changes.spend || 0,
        impressions: changes.impressions || 0,
        clicks: changes.clicks || 0,
        booking_step_1: changes.booking_step_1 || 0,
        booking_step_2: changes.booking_step_2 || 0,
        booking_step_3: changes.booking_step_3 || 0,
        reservations: changes.reservations || 0,
        reservation_value: changes.reservation_value || 0
      },
      // Add metadata for debugging
      _metadata: {
        platformRequested: platform,
        platformUsed: dbPlatform,
        currentPlatform: dbPlatform,
        previousPlatform: dbPlatform,
        previousDataFound: previousSummariesData && previousSummariesData.length > 0
      }
    };

    console.log(`✅ [${requestId}] YoY Comparison Response:`, {
      currentSpend: response.current.spend,
      previousSpend: response.previous.spend,
      spendChange: response.changes.spend
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('YoY Comparison Error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}