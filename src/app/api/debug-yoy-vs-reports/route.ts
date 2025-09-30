import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from '../../../lib/auth-middleware';
import logger from '../../../lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper function to get previous year date range (same as YoY API)
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

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }

    const { clientId, currentDateRange } = await request.json();
    
    if (!clientId || !currentDateRange?.start || !currentDateRange?.end) {
      return NextResponse.json({ 
        error: 'Missing required parameters: clientId, currentDateRange.start, currentDateRange.end' 
      }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    // Calculate previous year range (same logic as YoY API)
    const previousYearRange = getPreviousYearDateRange(currentDateRange);

    logger.info('🔍 YoY vs Reports Comparison Debug:', {
      currentPeriod: `${currentDateRange.start} to ${currentDateRange.end}`,
      previousPeriod: `${previousYearRange.start} to ${previousYearRange.end}`,
      clientId
    });

    // 1. Fetch data using YoY logic (previous year period)
    let yoyData = null;
    try {
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? (process.env.NEXT_PUBLIC_APP_URL || '') 
        : 'http://localhost:3000';
      const yoyResponse = await fetch(`${baseUrl}/api/fetch-live-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          clientId,
          dateRange: previousYearRange,
          platform: 'meta',
          forceFresh: true
        })
      });
      
      if (yoyResponse.ok) {
        const yoyResult = await yoyResponse.json();
        if (yoyResult.success) {
          yoyData = yoyResult.data;
        }
      }
    } catch (error) {
      logger.error('Failed to fetch YoY data:', error);
    }

    // 2. Fetch data using Reports page logic (current period)
    let reportsData = null;
    try {
      const reportsResponse = await fetch(`${baseUrl}/api/fetch-live-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          clientId,
          dateRange: currentDateRange,
          platform: 'meta'
        })
      });
      
      if (reportsResponse.ok) {
        const reportsResult = await reportsResponse.json();
        if (reportsResult.success) {
          reportsData = reportsResult.data;
        }
      }
    } catch (error) {
      logger.error('Failed to fetch Reports data:', error);
    }

    // 3. Check database for both periods
    const { data: previousYearDB } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', clientId)
      .eq('platform', 'meta')
      .gte('summary_date', previousYearRange.start)
      .lte('summary_date', previousYearRange.end)
      .order('summary_date', { ascending: true });

    const { data: currentYearDB } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', clientId)
      .eq('platform', 'meta')
      .gte('summary_date', currentDateRange.start)
      .lte('summary_date', currentDateRange.end)
      .order('summary_date', { ascending: true });

    // 4. Calculate totals
    const yoyReservationValue = yoyData?.conversionMetrics?.reservation_value || 0;
    const reportsReservationValue = reportsData?.conversionMetrics?.reservation_value || 0;
    
    const previousYearDBTotal = previousYearDB?.reduce((sum, record) => sum + (record.reservation_value || 0), 0) || 0;
    const currentYearDBTotal = currentYearDB?.reduce((sum, record) => sum + (record.reservation_value || 0), 0) || 0;

    return NextResponse.json({
      success: true,
      comparison: {
        dateRanges: {
          current: `${currentDateRange.start} to ${currentDateRange.end}`,
          previousYear: `${previousYearRange.start} to ${previousYearRange.end}`
        },
        reservationValues: {
          yoyApiCall: {
            value: yoyReservationValue,
            source: 'YoY API calling fetch-live-data for previous year period',
            period: `${previousYearRange.start} to ${previousYearRange.end}`
          },
          reportsApiCall: {
            value: reportsReservationValue,
            source: 'Reports page calling fetch-live-data for current period',
            period: `${currentDateRange.start} to ${currentDateRange.end}`
          },
          databasePreviousYear: {
            value: previousYearDBTotal,
            source: 'Database records for previous year period',
            period: `${previousYearRange.start} to ${previousYearRange.end}`,
            recordCount: previousYearDB?.length || 0
          },
          databaseCurrentYear: {
            value: currentYearDBTotal,
            source: 'Database records for current period',
            period: `${currentDateRange.start} to ${currentDateRange.end}`,
            recordCount: currentYearDB?.length || 0
          }
        },
        analysis: {
          yoyVsReportsDifference: Math.abs(yoyReservationValue - reportsReservationValue),
          possibleCauses: [
            yoyReservationValue !== reportsReservationValue ? 'Different time periods being compared' : 'Same values - no issue',
            yoyReservationValue !== previousYearDBTotal ? 'YoY API vs Database mismatch for previous year' : 'YoY API matches database',
            reportsReservationValue !== currentYearDBTotal ? 'Reports API vs Database mismatch for current period' : 'Reports API matches database'
          ]
        }
      }
    });

  } catch (error) {
    logger.error('Error in YoY vs Reports comparison:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
