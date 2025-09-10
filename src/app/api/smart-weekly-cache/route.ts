import { NextRequest, NextResponse } from 'next/server';
import { getSmartWeekCacheData } from '../../../lib/smart-cache-helper';
import { authenticateRequest, createErrorResponse } from '../../../lib/auth-middleware';
import logger from '../../../lib/logger';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // 🔧 REMOVED: Authentication check - not required for this project
    logger.info('🔐 Weekly smart cache request (no auth required)');
    
    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { clientId, forceRefresh = false } = body;
    
    if (!clientId) {
      return createErrorResponse('Client ID required', 400);
    }
    
    logger.info('Data processing', {
      clientId,
      forceRefresh,
      authenticatedUser: 'auth-disabled'
    });
    
    // Use the shared weekly smart cache helper
    const result = await getSmartWeekCacheData(clientId, forceRefresh);
    
    const responseTime = Date.now() - startTime;
    
    logger.info('Weekly smart cache request completed', {
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
        authenticatedUser: 'auth-disabled',
        currency: 'PLN',
        period: 'current-week'
      }
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('❌ Weekly smart cache error:', error);
    
    logger.error('Weekly smart cache request failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime
    });
    
    return createErrorResponse(
      error instanceof Error ? error.message : 'Weekly smart cache failed',
      500
    );
  }
} 