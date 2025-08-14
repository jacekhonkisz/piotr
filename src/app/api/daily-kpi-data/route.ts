import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';
import { authenticateRequest } from '../../../lib/auth-middleware';
import logger from '../../../lib/logger';

// GET: Fetch daily KPI data for carousel
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
    }

    logger.debug('Debug info', {
      authorization: request.headers.get('authorization'),
      contentType: request.headers.get('content-type'),
      userAgent: request.headers.get('user-agent'),
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer')
    });

    // Verify authentication
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      logger.error('Error occurred', {
        error: authResult.error,
        statusCode: authResult.statusCode,
        hasAuthHeader: !!request.headers.get('authorization')
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Data processing', clientId);

    // Calculate date range for PREVIOUS 7 COMPLETED days only (excluding today)
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    const sevenDaysAgo = new Date(yesterday);
    sevenDaysAgo.setDate(yesterday.getDate() - 6); // 7 days total including yesterday
    
    const startDate = sevenDaysAgo.toISOString().split('T')[0];
    const endDate = yesterday.toISOString().split('T')[0];

    logger.info('📅 Date range for completed days:', {
      startDate,
      endDate,
      today: today.toISOString().split('T')[0],
      daysRequested: 7
    });

    // Query ONLY stored daily KPI data from database (no live data)
    logger.debug('Debug info', {
      client_id: clientId,
      startDate,
      endDate
    });
    
    const { data: dailyData, error } = await supabaseAdmin
      .from('daily_kpi_data')
      .select('*')
      .eq('client_id', clientId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    logger.info('Data processing', {
      error: error,
      dataLength: dailyData?.length || 0,
      rawData: dailyData
    });

    if (error) {
      console.error('❌ Error fetching daily KPI data:', error);
      return NextResponse.json({ error: 'Failed to fetch daily KPI data' }, { status: 500 });
    }

    // Only return REAL data from database - no estimates, no fallbacks
    const realDataOnly = (dailyData || []).filter(day => 
      day.data_source === 'api' || day.data_source === 'database'
    );

    logger.info('Data processing', {
      totalRecords: dailyData?.length || 0,
      realDataRecords: realDataOnly.length,
      dateRange: {
        start: realDataOnly[0]?.date,
        end: realDataOnly[realDataOnly.length - 1]?.date
      },
      sampleData: realDataOnly.slice(0, 2).map(d => ({
        date: d.date,
        clicks: d.total_clicks,
        spend: d.total_spend,
        source: d.data_source
      }))
    });

    // Transform data for the carousel
    const transformedData = {
      success: true,
      data: realDataOnly,
      metadata: {
        totalDays: realDataOnly.length,
        dateRange: {
          start: realDataOnly[0]?.date,
          end: realDataOnly[realDataOnly.length - 1]?.date
        },
        dataType: 'completed_days_only',
        excludesToday: true
      },
      lastUpdated: new Date().toISOString()
    };

    logger.info('Success', {
      clientId,
      totalDays: transformedData.metadata.totalDays,
      dateRange: transformedData.metadata.dateRange
    });

    return NextResponse.json(transformedData);

  } catch (error) {
    console.error('❌ Daily KPI data fetch error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST: Store/Update daily KPI data
export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
    }

    // Verify authentication (admin only for manual data insertion)
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      clientId,
      date,
      campaigns, // Array of campaign data from Meta API
      conversionMetrics,
      dataSource = 'api'
    } = body;

    if (!clientId || !date) {
      return NextResponse.json({ error: 'Client ID and date are required' }, { status: 400 });
    }

    logger.info('Data processing', { clientId, date, dataSource });

    // FIXED: Handle both campaign aggregation and direct daily values from MetaPerformanceLive
    const { estimatedDailyData } = body;
    
    let aggregatedData = {
      total_clicks: 0,
      total_impressions: 0,
      total_spend: 0,
      total_conversions: 0,
      campaigns_count: 0
    };

    if (estimatedDailyData && estimatedDailyData.calculationMethod === 'monthly_total_divided_by_days_elapsed') {
      // Use pre-calculated daily values from MetaPerformanceLive (FIXED VERSION)
      logger.info('Data processing', estimatedDailyData);
      
      aggregatedData = {
        total_clicks: Math.round(estimatedDailyData.avgDailyClicks || 0),
        total_impressions: Math.round(estimatedDailyData.avgDailyImpressions || 0),
        total_spend: Number(estimatedDailyData.avgDailySpend || 0),
        total_conversions: Math.round(estimatedDailyData.avgDailyConversions || 0),
        campaigns_count: campaigns?.length || 0
      };
    } else if (campaigns && Array.isArray(campaigns)) {
      // Legacy: Aggregate campaign data (for actual daily API calls)
      aggregatedData.campaigns_count = campaigns.length;
      
      campaigns.forEach((campaign: any) => {
        aggregatedData.total_clicks += Number(campaign.clicks || 0);
        aggregatedData.total_impressions += Number(campaign.impressions || 0);
        aggregatedData.total_spend += Number(campaign.spend || 0);
        aggregatedData.total_conversions += Number(campaign.conversions || 0);
      });
    }

    logger.info('Data processing', {
      date,
      method: estimatedDailyData?.calculationMethod || 'campaign_aggregation',
      ...aggregatedData
    });

    // Calculate derived metrics
    const calculated_ctr = aggregatedData.total_impressions > 0 
      ? (aggregatedData.total_clicks / aggregatedData.total_impressions) * 100 
      : 0;
    
    const calculated_cpc = aggregatedData.total_clicks > 0 
      ? aggregatedData.total_spend / aggregatedData.total_clicks 
      : 0;
    
    const calculated_roas = aggregatedData.total_spend > 0 
      ? (conversionMetrics?.reservation_value || 0) / aggregatedData.total_spend 
      : 0;
    
    const calculated_cost_per_reservation = (conversionMetrics?.reservations || 0) > 0 
      ? aggregatedData.total_spend / (conversionMetrics?.reservations || 1) 
      : 0;

    // Upsert the record using direct SQL
    const { data, error } = await supabaseAdmin
      .from('daily_kpi_data')
      .upsert({
        client_id: clientId,
        date: date,
        total_clicks: aggregatedData.total_clicks,
        total_impressions: aggregatedData.total_impressions,
        total_spend: aggregatedData.total_spend,
        total_conversions: aggregatedData.total_conversions,
        click_to_call: conversionMetrics?.click_to_call || 0,
        email_contacts: conversionMetrics?.email_contacts || 0,
        booking_step_1: conversionMetrics?.booking_step_1 || 0,
        reservations: conversionMetrics?.reservations || 0,
        reservation_value: conversionMetrics?.reservation_value || 0,
        booking_step_2: conversionMetrics?.booking_step_2 || 0,
        average_ctr: calculated_ctr,
        average_cpc: calculated_cpc,
        roas: calculated_roas,
        cost_per_reservation: calculated_cost_per_reservation,
        campaigns_count: aggregatedData.campaigns_count,
        data_source: dataSource,
        last_updated: new Date().toISOString()
      })
      .select();

    if (error) {
      console.error('❌ Error storing daily KPI data:', error);
      return NextResponse.json({ error: 'Failed to store daily KPI data' }, { status: 500 });
    }

    logger.info('Success', {
      clientId,
      date,
      recordId: data?.[0]?.id,
      clicks: aggregatedData.total_clicks,
      spend: aggregatedData.total_spend
    });

    return NextResponse.json({
      success: true,
      recordId: data?.[0]?.id,
      message: 'Daily KPI data stored successfully'
    });

  } catch (error) {
    console.error('❌ Daily KPI data store error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE: Clean up old data
export async function DELETE(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
    }

    const authResult = await authenticateRequest(request);
    if (!authResult.success || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
    }

    logger.info('🧹 Cleaning up old daily KPI data...');

    // Calculate cutoff date (current month start - 7 days)
    const currentDate = new Date();
    const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const cutoffDate = new Date(currentMonthStart);
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    // Delete old records
    const { error } = await supabaseAdmin
      .from('daily_kpi_data')
      .delete()
      .lt('date', cutoffDate.toISOString().split('T')[0]);

    if (error) {
      console.error('❌ Error cleaning up daily KPI data:', error);
      return NextResponse.json({ error: 'Failed to clean up old data' }, { status: 500 });
    }

    logger.info('✅ Daily KPI data cleanup completed');

    return NextResponse.json({
      success: true,
      message: 'Old daily KPI data cleaned up successfully'
    });

  } catch (error) {
    console.error('❌ Daily KPI data cleanup error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 