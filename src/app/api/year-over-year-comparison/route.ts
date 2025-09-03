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
  };
  previous: {
    spend: number;
    impressions: number;
    clicks: number;
    reservations: number;
    reservation_value: number;
  };
  changes: {
    spend: number;
    impressions: number;
    clicks: number;
    reservations: number;
    reservation_value: number;
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
  }), {
    spend: 0,
    impressions: 0,
    clicks: 0,
    reservations: 0,
    reservation_value: 0,
  });
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
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

    // Validate if year-over-year comparison is appropriate for this date range
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    const daysDifference = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Only allow year-over-year for complete monthly periods (28+ days)
    if (daysDifference < 28) {
      logger.info('❌ Year-over-year comparison blocked for short period', {
        clientId,
        dateRange,
        daysDifference,
        reason: 'Period too short for meaningful year-over-year comparison'
      });
      
      return NextResponse.json({
        current: { spend: 0, impressions: 0, clicks: 0, reservations: 0, reservation_value: 0 },
        previous: { spend: 0, impressions: 0, clicks: 0, reservations: 0, reservation_value: 0 },
        changes: { spend: 0, impressions: 0, clicks: 0, reservations: 0, reservation_value: 0 },
        blocked: true,
        reason: 'Year-over-year comparisons are only shown for complete monthly periods'
      });
    }
    
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

    // Fetch current year data from campaign_summaries
    const { data: currentSummaries, error: currentError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', clientId)
      .gte('summary_date', dateRange.start)
      .lte('summary_date', dateRange.end);

    if (currentError) {
      logger.error('Error fetching current year data:', currentError);
      return NextResponse.json({ error: 'Failed to fetch current year data' }, { status: 500 });
    }

    // Fetch previous year data from campaign_summaries
    const { data: previousSummaries, error: previousError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', clientId)
      .gte('summary_date', previousYearRange.start)
      .lte('summary_date', previousYearRange.end);

    if (previousError) {
      logger.error('Error fetching previous year data:', previousError);
      return NextResponse.json({ error: 'Failed to fetch previous year data' }, { status: 500 });
    }

    // Aggregate current year data
    const currentData = currentSummaries?.reduce((acc: any, summary: any) => ({
      spend: acc.spend + (summary.total_spend || 0),
      impressions: acc.impressions + (summary.total_impressions || 0),
      clicks: acc.clicks + (summary.total_clicks || 0),
      reservations: acc.reservations + (summary.reservations || 0),
      reservation_value: acc.reservation_value + (summary.reservation_value || 0),
    }), {
      spend: 0,
      impressions: 0,
      clicks: 0,
      reservations: 0,
      reservation_value: 0,
    }) || {
      spend: 0,
      impressions: 0,
      clicks: 0,
      reservations: 0,
      reservation_value: 0,
    };

    // Aggregate previous year data
    const previousData = previousSummaries?.reduce((acc: any, summary: any) => ({
      spend: acc.spend + (summary.total_spend || 0),
      impressions: acc.impressions + (summary.total_impressions || 0),
      clicks: acc.clicks + (summary.total_clicks || 0),
      reservations: acc.reservations + (summary.reservations || 0),
      reservation_value: acc.reservation_value + (summary.reservation_value || 0),
    }), {
      spend: 0,
      impressions: 0,
      clicks: 0,
      reservations: 0,
      reservation_value: 0,
    }) || {
      spend: 0,
      impressions: 0,
      clicks: 0,
      reservations: 0,
      reservation_value: 0,
    };

    // Calculate percentage changes
    const changes = {
      spend: calculatePercentageChange(currentData.spend, previousData.spend),
      impressions: calculatePercentageChange(currentData.impressions, previousData.impressions),
      clicks: calculatePercentageChange(currentData.clicks, previousData.clicks),
      reservations: calculatePercentageChange(currentData.reservations, previousData.reservations),
      reservation_value: calculatePercentageChange(currentData.reservation_value, previousData.reservation_value),
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
      reservationsChange: changes.reservations.toFixed(1) + '%'
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
