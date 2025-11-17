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
 * Schedule: Every Sunday at 2 AM (weekly)
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
    logger.info('🤖 Starting automated weekly summaries collection for all clients...');

    const collector = BackgroundDataCollector.getInstance();
    
    // This will:
    // 1. Fetch all active clients
    // 2. For each client:
    //    - Collect Meta weekly data (53 weeks + current)
    //    - Collect Google Ads weekly data (53 weeks + current) if enabled
    // 3. Store in campaign_summaries with platform='meta' or 'google'
    await collector.collectWeeklySummaries();

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

