import { NextRequest, NextResponse } from 'next/server';
import { getUnifiedSmartCacheData, getUnifiedSmartWeekCacheData } from '../../../lib/unified-smart-cache-helper';
import { authenticateRequest, createErrorResponse } from '../../../lib/auth-middleware';
import logger from '../../../lib/logger';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createErrorResponse(authResult.error || 'Authentication failed', 401);
    }
    
    const user = authResult.user;
    logger.info('🔐 Unified smart cache request authenticated for user:', user.email);
    
    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { clientId, forceRefresh = false, period = 'monthly', periodId } = body;
    
    if (!clientId) {
      return createErrorResponse('Client ID required', 400);
    }
    
    logger.info('Unified data processing', {
      clientId,
      forceRefresh,
      period,
      periodId,
      authenticatedUser: user.email
    });
    
    // Use the appropriate unified smart cache helper based on period
    let result;
    if (period === 'weekly') {
      result = await getUnifiedSmartWeekCacheData(clientId, forceRefresh, periodId);
    } else {
      result = await getUnifiedSmartCacheData(clientId, forceRefresh);
    }
    
    const responseTime = Date.now() - startTime;
    
    logger.info('Unified smart cache request completed', {
      clientId,
      responseTime,
      source: result.source,
      fromCache: result.data.fromCache,
      period
    });
    
    return NextResponse.json({
      success: true,
      data: result.data,
      debug: {
        source: result.source,
        responseTime,
        cacheAge: result.data.cacheAge,
        authenticatedUser: user.email,
        platform: 'unified',
        period,
        hasMetaData: !!result.data.meta,
        hasGoogleAdsData: !!result.data.googleAds
      }
    });
    
  } catch (error) {
    console.error('❌ Unified smart cache error:', error);
    
    const responseTime = Date.now() - startTime;
    
    logger.error('Unified smart cache request failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime
    });
    
    return createErrorResponse(
      error instanceof Error ? error.message : 'Unified smart cache request failed',
      500
    );
  }
}
