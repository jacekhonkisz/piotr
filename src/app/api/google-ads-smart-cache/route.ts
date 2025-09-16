import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAdsSmartCacheData } from '../../../lib/google-ads-smart-cache-helper';
import { authenticateRequest, createErrorResponse } from '../../../lib/auth-middleware';
import logger from '../../../lib/logger';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // 🔓 AUTH DISABLED: Skip authentication as requested
    console.log('🔓 Authentication disabled for Google Ads smart cache API');
    logger.info('🔓 Google Ads smart cache API authentication disabled - allowing direct access');
    
    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { clientId, forceRefresh = false } = body;
    
    if (!clientId) {
      return createErrorResponse('Client ID required', 400);
    }
    
    logger.info('Google Ads data processing', {
      clientId,
      forceRefresh,
      authDisabled: true
    });
    
    // Use the Google Ads smart cache helper
    const result = await getGoogleAdsSmartCacheData(clientId, forceRefresh);
    
    const responseTime = Date.now() - startTime;
    
    logger.info('Google Ads smart cache request completed', {
      clientId,
      responseTime,
      source: result.source,
      fromCache: result.data?.fromCache
    });
    
    return NextResponse.json({
      success: true,
      data: result.data,
      debug: {
        source: result.source,
        responseTime,
        cacheAge: result.data?.cacheAge,
        authenticatedUser: 'auth-disabled',
        platform: 'google-ads'
      }
    });
    
  } catch (error) {
    console.error('❌ Google Ads smart cache error:', error);
    
    const responseTime = Date.now() - startTime;
    
    logger.error('Google Ads smart cache request failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime
    });
    
    return createErrorResponse(
      error instanceof Error ? error.message : 'Google Ads smart cache request failed',
      500
    );
  }
}
