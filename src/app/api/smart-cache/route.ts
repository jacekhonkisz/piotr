import { NextRequest, NextResponse } from 'next/server';
import { getSmartCacheData } from '../../../lib/smart-cache-helper';
import { authenticateRequest, createErrorResponse } from '../../../lib/auth-middleware';
import logger from '../../../lib/logger';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // ✅ FIX: Allow service role token OR CRON_SECRET for automated cron jobs
    const authHeader = request.headers.get('authorization');
    const isServiceRole = authHeader?.includes(process.env.SUPABASE_SERVICE_ROLE_KEY || '') ||
                          authHeader === `Bearer ${process.env.CRON_SECRET}`;
    
    let user = null;
    
    if (!isServiceRole) {
      // Authenticate regular user requests
      const authResult = await authenticateRequest(request);
      if (!authResult.success || !authResult.user) {
        return createErrorResponse(authResult.error || 'Authentication failed', 401);
      }
      user = authResult.user;
      logger.info('🔐 Smart cache request authenticated for user:', user.email);
    } else {
      logger.info('🤖 Smart cache request from automated service (cron job)');
    }
    
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
      authenticatedUser: user?.email || 'automated-service'
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
        authenticatedUser: user?.email || 'automated-service'
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