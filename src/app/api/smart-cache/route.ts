import { NextRequest, NextResponse } from 'next/server';
import { getSmartCacheData } from '../../../lib/smart-cache-helper';
import { authenticateRequest, createErrorResponse } from '../../../lib/auth-middleware';
import logger from '../../../lib/logger';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // 🔧 REMOVED: Authentication check - not required for this project
    logger.info('🔐 Smart cache request (no auth required)');
    
    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { clientId, platform = 'meta', forceRefresh = false, dateRange } = body;
    
    if (!clientId) {
      return createErrorResponse('Client ID required', 400);
    }
    
    logger.info('Data processing', {
      clientId,
      platform,
      forceRefresh,
      dateRange,
      authenticatedUser: 'auth-disabled'
    });
    
    // 🔧 FIX: Handle dateRange parameter for specific period requests
    let result;
    if (dateRange) {
      // For specific date ranges, use the appropriate cache function
      const { getSmartCacheDataForPeriod } = await import('../../../lib/smart-cache-helper');
      result = await getSmartCacheDataForPeriod(clientId, dateRange, platform, forceRefresh);
    } else {
      // For current period, use the existing function
      result = await getSmartCacheData(clientId, forceRefresh, platform);
    }
    
    const responseTime = Date.now() - startTime;
    
    logger.info('Smart cache request completed', {
      clientId,
      responseTime,
      source: result.source,
      fromCache: result.data.fromCache
    });
    
    return NextResponse.json({
      success: true,
      data: result.data,
      debug: {
        source: result.source,
        responseTime,
        cacheAge: result.data.cacheAge,
        authenticatedUser: 'auth-disabled'
      }
    });
    
  } catch (error) {
    console.error('❌ Smart cache error:', error);
    
    const responseTime = Date.now() - startTime;
    
    logger.error('Smart cache request failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime
    });
    
    return createErrorResponse(
      error instanceof Error ? error.message : 'Smart cache request failed',
      500
    );
  }
} 