import { NextRequest, NextResponse } from 'next/server';
import { BackgroundDataCollector } from '@/lib/background-data-collector';
import logger from '@/lib/logger';
import { authenticateRequest, createErrorResponse } from '../../../../lib/auth-middleware';

/**
 * MANUAL WEEKLY COLLECTION FOR SINGLE CLIENT
 * 
 * Collects weekly summaries for ONE specific client
 * Useful for manual data population or debugging
 * 
 * Usage: POST /api/manual/collect-client-weekly
 * Body: { "clientId": "ab0b4c7e-2bf0-46bc-b455-b18ef6942baa" }
 * Requires: Admin authentication
 */

export async function POST(request: NextRequest) {
  // 🔒 SECURITY: Admin authentication required
  const authResult = await authenticateRequest(request);
  if (!authResult.authenticated || authResult.user?.role !== 'admin') {
    return createErrorResponse('Admin access required', 403);
  }

  const startTime = Date.now();

  try {
    const body = await request.json();
    const { clientId } = body;

    if (!clientId) {
      return NextResponse.json({
        success: false,
        error: 'Missing clientId in request body',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    logger.info(`🤖 Starting manual weekly collection for client: ${clientId}`);

    const collector = BackgroundDataCollector.getInstance();
    
    // Collect weekly summaries for this specific client
    await collector.collectWeeklySummariesForSingleClient(clientId);

    const responseTime = Date.now() - startTime;

    logger.info(`✅ Weekly collection completed for client ${clientId} in ${(responseTime / 1000).toFixed(2)}s`);

    return NextResponse.json({
      success: true,
      message: `Weekly summaries collected for client ${clientId}`,
      details: 'Collected 53 weeks + current week for both Meta and Google Ads',
      responseTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;

    console.error('❌ Manual weekly collection failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });

    logger.error('Manual weekly collection failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime
    });

    return NextResponse.json({
      success: false,
      error: 'Weekly collection failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

