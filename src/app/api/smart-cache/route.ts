import { NextRequest, NextResponse } from 'next/server';
import { getSmartCacheData } from '../../../lib/smart-cache-helper';
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
    logger.info('🔐 Smart cache request authenticated for user:', user.email);
    
    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { clientId, forceRefresh = false } = body;
    
    if (!clientId) {
      return createErrorResponse('Client ID required', 400);
    }
    
    logger.info('Data processing', {
      clientId,
      forceRefresh,
      authenticatedUser: user.email
    });
    
    // Use the shared smart cache helper
    const result = await getSmartCacheData(clientId, forceRefresh);
    
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
        authenticatedUser: user.email
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