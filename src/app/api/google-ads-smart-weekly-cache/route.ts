import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAdsSmartWeekCacheData } from '../../../lib/google-ads-smart-cache-helper';
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
    logger.info('🔐 Google Ads weekly smart cache request authenticated for user:', user.email);
    
    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { clientId, forceRefresh = false, periodId } = body;
    
    if (!clientId) {
      return createErrorResponse('Client ID required', 400);
    }
    
    logger.info('Google Ads weekly data processing', {
      clientId,
      forceRefresh,
      periodId,
      authenticatedUser: user.email
    });
    
    // Use the Google Ads weekly smart cache helper
    const result = await getGoogleAdsSmartWeekCacheData(clientId, forceRefresh, periodId);
    
    const responseTime = Date.now() - startTime;
    
    logger.info('Google Ads weekly smart cache request completed', {
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
        authenticatedUser: user.email,
        platform: 'google-ads',
        period: 'weekly'
      }
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('❌ Google Ads weekly smart cache error:', error);
    
    logger.error('Google Ads weekly smart cache request failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime
    });
    
    return createErrorResponse(
      error instanceof Error ? error.message : 'Google Ads weekly smart cache failed',
      500
    );
  }
}
