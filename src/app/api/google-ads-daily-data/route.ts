import { NextRequest, NextResponse } from 'next/server';
import { GoogleAdsDailyDataFetcher } from '../../../lib/google-ads-daily-data-fetcher';
import { authenticateRequest, createErrorResponse } from '../../../lib/auth-middleware';
import logger from '../../../lib/logger';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createErrorResponse(authResult.error || 'Authentication failed', 401);
    }
    
    const user = authResult.user;
    logger.info('🔐 Google Ads daily data request authenticated for user:', user.email);
    
    // Get client ID from query params
    const url = new URL(request.url);
    const clientId = url.searchParams.get('clientId');
    
    if (!clientId) {
      return createErrorResponse('Client ID required', 400);
    }
    
    logger.info('Google Ads daily data processing', {
      clientId,
      authenticatedUser: user.email
    });
    
    // Try to get cached data first
    let dailyData = await GoogleAdsDailyDataFetcher.getCachedDailyData(clientId);
    let dataSource = 'cache';
    
    if (!dailyData || dailyData.length === 0) {
      logger.info('No cached Google Ads daily data found, fetching fresh data...');
      try {
        dailyData = await GoogleAdsDailyDataFetcher.fetchRealDailyData(clientId);
        dataSource = 'live-api';
      } catch (fetchError) {
        logger.warn('Failed to fetch fresh Google Ads daily data:', fetchError);
        dailyData = [];
        dataSource = 'empty';
      }
    }
    
    const responseTime = Date.now() - startTime;
    
    logger.info('Google Ads daily data request completed', {
      clientId,
      responseTime,
      dataPoints: dailyData.length,
      source: dataSource
    });
    
    return NextResponse.json({
      success: true,
      data: dailyData,
      debug: {
        source: dataSource,
        responseTime,
        dataPoints: dailyData.length,
        authenticatedUser: user.email,
        platform: 'google-ads'
      }
    });
    
  } catch (error) {
    console.error('❌ Google Ads daily data error:', error);
    
    const responseTime = Date.now() - startTime;
    
    logger.error('Google Ads daily data request failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime
    });
    
    return createErrorResponse(
      error instanceof Error ? error.message : 'Google Ads daily data request failed',
      500
    );
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createErrorResponse(authResult.error || 'Authentication failed', 401);
    }
    
    const user = authResult.user;
    logger.info('🔐 Google Ads daily data POST request authenticated for user:', user.email);
    
    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { clientId, forceRefresh = false } = body;
    
    if (!clientId) {
      return createErrorResponse('Client ID required', 400);
    }
    
    logger.info('Google Ads daily data processing (POST)', {
      clientId,
      forceRefresh,
      authenticatedUser: user.email
    });
    
    let dailyData;
    let dataSource;
    
    if (forceRefresh) {
      logger.info('Force refresh requested, fetching fresh Google Ads daily data...');
      try {
        dailyData = await GoogleAdsDailyDataFetcher.fetchRealDailyData(clientId);
        dataSource = 'live-api-forced';
      } catch (fetchError) {
        logger.warn('Failed to fetch fresh Google Ads daily data, falling back to cache:', fetchError);
        dailyData = await GoogleAdsDailyDataFetcher.getCachedDailyData(clientId);
        dataSource = 'cache-fallback';
      }
    } else {
      // Try cached first
      dailyData = await GoogleAdsDailyDataFetcher.getCachedDailyData(clientId);
      dataSource = 'cache';
      
      if (!dailyData || dailyData.length === 0) {
        logger.info('No cached Google Ads daily data found, fetching fresh data...');
        try {
          dailyData = await GoogleAdsDailyDataFetcher.fetchRealDailyData(clientId);
          dataSource = 'live-api';
        } catch (fetchError) {
          logger.warn('Failed to fetch fresh Google Ads daily data:', fetchError);
          dailyData = [];
          dataSource = 'empty';
        }
      }
    }
    
    const responseTime = Date.now() - startTime;
    
    logger.info('Google Ads daily data POST request completed', {
      clientId,
      responseTime,
      dataPoints: dailyData.length,
      source: dataSource,
      forceRefresh
    });
    
    return NextResponse.json({
      success: true,
      data: dailyData,
      debug: {
        source: dataSource,
        responseTime,
        dataPoints: dailyData.length,
        authenticatedUser: user.email,
        platform: 'google-ads',
        forceRefresh
      }
    });
    
  } catch (error) {
    console.error('❌ Google Ads daily data POST error:', error);
    
    const responseTime = Date.now() - startTime;
    
    logger.error('Google Ads daily data POST request failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime
    });
    
    return createErrorResponse(
      error instanceof Error ? error.message : 'Google Ads daily data POST request failed',
      500
    );
  }
}
