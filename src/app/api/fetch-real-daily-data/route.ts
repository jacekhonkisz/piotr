import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, canAccessClient } from '../../../lib/auth-middleware';
import { DailyDataFetcher } from '../../../lib/daily-data-fetcher';
import { supabase } from '../../../lib/supabase';
import logger from '../../../lib/logger';

export async function POST(request: NextRequest) {
  try {
    logger.info('🔄 REAL DAILY DATA FETCH API STARTED');
    
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }

    const { user } = authResult;
    const { clientId } = await request.json();

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }

    // Get client data to check access
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientError || !clientData) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Check if user can access this client
    if (!canAccessClient(user, clientData.email)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    console.log(`📊 Fetching REAL daily data for client: ${clientData.name}`);

    // Use the new DailyDataFetcher to get REAL daily data from Meta API
    const dailyData = await DailyDataFetcher.updateRealDailyData(clientId);

    logger.info('✅ REAL daily data fetch completed successfully');

    return NextResponse.json({
      success: true,
      data: dailyData,
      message: `Successfully fetched and stored ${dailyData.length} days of REAL daily data`,
      dataSource: 'meta-api-daily',
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ REAL daily data fetch failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch real daily data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint to check current daily data status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }

    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }

    // Get current daily data status - ALL sources, not just meta-api-daily
    const { data: dailyData, error } = await supabase
      .from('daily_kpi_data')
      .select('*')
      .eq('client_id', clientId)
      // Remove the data_source filter to get ALL daily data
      // .eq('data_source', 'meta-api-daily')
      .order('date', { ascending: false })
      .limit(7);

    if (error) {
      return NextResponse.json({ error: 'Failed to check daily data status' }, { status: 500 });
    }

    const hasRealData = dailyData && dailyData.length > 0;
    const latestDate = hasRealData ? dailyData[0]?.date : null;

    return NextResponse.json({
      success: true,
      hasRealDailyData: hasRealData,
      recordCount: dailyData?.length || 0,
      latestDate: latestDate,
      data: dailyData || [],
      lastUpdated: hasRealData ? dailyData[0]?.last_updated : null
    });

  } catch (error) {
    console.error('❌ Daily data status check failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to check daily data status'
    }, { status: 500 });
  }
} 