import { NextRequest, NextResponse } from 'next/server';
import { getSmartWeekCacheData } from '../../../lib/smart-cache-helper';
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
      logger.info('🔐 Weekly smart cache request authenticated for user:', user.email);
    } else {
      logger.info('🤖 Weekly smart cache request from automated service (cron job)');
    }
    
    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { clientId, forceRefresh = false } = body;
    
    if (!clientId) {
      return createErrorResponse('Client ID required', 400);
    }
    
    logger.info('Data processing', {
      clientId,
      forceRefresh,
      authenticatedUser: user?.email || 'automated-service'
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
        authenticatedUser: user?.email || 'automated-service',
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