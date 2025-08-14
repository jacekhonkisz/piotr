import { NextRequest, NextResponse } from 'next/server';
import { DataLifecycleManager } from '../../../lib/data-lifecycle-manager';
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
    
    // Only admins can check data lifecycle status
    if (user.role !== 'admin') {
      return createErrorResponse('Access denied - admin only', 403);
    }
    
    logger.info('Data processing', user.email);
    
    const lifecycleManager = DataLifecycleManager.getInstance();
    const status = await lifecycleManager.getLifecycleStatus();
    
    const responseTime = Date.now() - startTime;
    
    logger.info('Data lifecycle status retrieved', {
      requestedBy: user.email,
      responseTime
    });
    
    return NextResponse.json({
      success: true,
      status,
      responseTime
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.error('❌ Data lifecycle status request failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime
    });
    
    logger.error('Data lifecycle status request failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime
    });
    
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to get lifecycle status',
      500
    );
  }
} 