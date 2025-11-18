import { NextRequest, NextResponse } from 'next/server';
import { BackgroundDataCollector } from '@/lib/background-data-collector';
import logger from '@/lib/logger';
import { verifyCronAuth, createUnauthorizedResponse } from '@/lib/cron-auth';

/**
 * ADMIN TRIGGER: Manual Weekly Collection for Specific Client
 * 
 * Collects weekly summaries for ONE specific client
 * Protected with CRON_SECRET or Vercel cron header
 * 
 * Usage: POST /api/admin/trigger-weekly-collection
 * Body: { "clientId": "ab0b4c7e-2bf0-46bc-b455-b18ef6942baa" }
 * Header: Authorization: Bearer ${CRON_SECRET}
 */

export async function POST(request: NextRequest) {
  // 🔒 SECURITY: Verify cron authentication (allows Vercel cron header OR CRON_SECRET)
  if (!verifyCronAuth(request)) {
    return createUnauthorizedResponse();
  }

  const startTime = Date.now();

  try {
    const body = await request.json();
    const { clientId } = body;

    if (!clientId) {
      return NextResponse.json({
        success: false,
        error: 'Missing clientId in request body',
        usage: 'POST with body: { "clientId": "client-uuid" }',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    logger.info(`🤖 Admin triggered: Manual weekly collection for client: ${clientId}`);

    const collector = BackgroundDataCollector.getInstance();
    
    // Collect weekly summaries for this specific client
    // This will collect 53 weeks + current week for both Meta and Google Ads
    await collector.collectWeeklySummariesForSingleClient(clientId);

    const responseTime = Date.now() - startTime;

    logger.info(`✅ Manual weekly collection completed for client ${clientId} in ${(responseTime / 1000).toFixed(2)}s`);

    return NextResponse.json({
      success: true,
      message: `Weekly summaries collected for client ${clientId}`,
      details: {
        collected: '53 weeks + current week',
        platforms: ['Meta Ads', 'Google Ads'],
        responseTimeMs: responseTime
      },
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

// Also allow GET for Vercel cron jobs
export async function GET(request: NextRequest) {
  // Default to Belmonte Hotel if no clientId provided
  const searchParams = request.nextUrl.searchParams;
  const clientId = searchParams.get('clientId') || 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';

  // Create a new request with the clientId in the body
  const mockRequest = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({ clientId })
  });

  return POST(mockRequest as NextRequest);
}

