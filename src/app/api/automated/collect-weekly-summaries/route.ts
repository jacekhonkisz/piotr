import { NextRequest, NextResponse } from 'next/server';
import { BackgroundDataCollector } from '@/lib/background-data-collector';
import logger from '@/lib/logger';
import { verifyCronAuth, createUnauthorizedResponse } from '@/lib/cron-auth';

/**
 * AUTOMATED WEEKLY SUMMARIES COLLECTION
 * 
 * Collects weekly campaign summaries for ALL clients (Meta & Google Ads)
 * Runs automatically via cron job
 * 
 * Schedule: Every Sunday at 3 AM (weekly)
 * Security: Protected with CRON_SECRET authentication
 * 
 * What it does:
 * - Fetches all active clients
 * - Collects last 53 weeks + current week for both Meta and Google Ads
 * - Stores weekly summaries in campaign_summaries table
 * - Platform-separated (meta vs google)
 * 
 * Usage:
 * - Automated: Vercel cron (every Sunday, requires CRON_SECRET)
 * - Manual: GET/POST /api/automated/collect-weekly-summaries
 */

export async function GET(request: NextRequest) {
  // 🔒 SECURITY: Verify cron authentication
  if (!verifyCronAuth(request)) {
    return createUnauthorizedResponse();
  }
  
  // For Vercel cron jobs - they only support GET requests
  return await POST(request);
}

export async function POST(request: NextRequest) {
  // 🔒 SECURITY: Verify cron authentication
  if (!verifyCronAuth(request)) {
    return createUnauthorizedResponse();
  }
  const startTime = Date.now();

  try {
    // 🧪 TEST: Check if filtering by client name
    const searchParams = request.nextUrl.searchParams;
    const testClient = searchParams.get('testClient'); // e.g., ?testClient=belmonte
    const startWeek = parseInt(searchParams.get('startWeek') || '0'); // Week offset to start from
    const endWeek = parseInt(searchParams.get('endWeek') || '53'); // Week offset to end at
    
    if (testClient) {
      logger.info(`🧪 TEST MODE: Collecting for client matching '${testClient}' only...`);
    } else {
      logger.info('🤖 Starting automated weekly summaries collection for all clients...');
    }
    
    if (startWeek !== 0 || endWeek !== 53) {
      logger.info(`📅 Week range: ${startWeek} to ${endWeek} (collecting ${endWeek - startWeek + 1} weeks)`);
    }

    const collector = BackgroundDataCollector.getInstance();
    
    // This will:
    // 1. Fetch all active clients (or filtered client if testClient provided)
    // 2. For each client:
    //    - Collect Meta weekly data (week range: startWeek to endWeek)
    //    - Collect Google Ads weekly data if enabled
    // 3. Store in campaign_summaries with platform='meta' or 'google'
    await collector.collectWeeklySummaries(testClient || undefined, startWeek, endWeek);

    const responseTime = Date.now() - startTime;

    logger.info(`✅ Weekly summaries collection completed in ${(responseTime / 1000).toFixed(2)}s`);

    return NextResponse.json({
      success: true,
      message: 'Weekly summaries collection completed for all clients',
      details: 'Collected 53 weeks + current week for both Meta and Google Ads',
      responseTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;

    console.error('❌ Automated weekly summaries collection failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });

    logger.error('Automated weekly summaries collection failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime
    });

    return NextResponse.json({
      success: false,
      error: 'Weekly summaries collection failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

