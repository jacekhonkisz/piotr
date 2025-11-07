import { NextResponse } from 'next/server';
import { BackgroundDataCollector } from '@/lib/background-data-collector';
import logger from '@/lib/logger';

/**
 * AUTOMATED MONTHLY SUMMARIES COLLECTION
 * 
 * Collects monthly campaign summaries for ALL clients (Meta & Google Ads)
 * Runs automatically via cron job
 * 
 * Schedule: 1st of every month at 3 AM
 * 
 * What it does:
 * - Fetches all active clients
 * - Collects last 12 months for both Meta and Google Ads
 * - Stores monthly summaries in campaign_summaries table
 * - Platform-separated (meta vs google)
 * 
 * Usage:
 * - Automated: Vercel cron (1st of month)
 * - Manual: GET/POST /api/automated/collect-monthly-summaries
 */

export async function GET() {
  // For Vercel cron jobs - they only support GET requests
  return await POST();
}

export async function POST() {
  const startTime = Date.now();

  try {
    logger.info('🤖 Starting automated monthly summaries collection for all clients...');

    const collector = BackgroundDataCollector.getInstance();
    
    // This will:
    // 1. Fetch all active clients
    // 2. For each client:
    //    - Collect Meta monthly data (last 12 months)
    //    - Collect Google Ads monthly data (last 12 months) if enabled
    // 3. Store in campaign_summaries with platform='meta' or 'google'
    await collector.collectMonthlySummaries();

    const responseTime = Date.now() - startTime;

    logger.info(`✅ Monthly summaries collection completed in ${(responseTime / 1000).toFixed(2)}s`);

    return NextResponse.json({
      success: true,
      message: 'Monthly summaries collection completed for all clients',
      details: 'Collected last 12 months for both Meta and Google Ads',
      responseTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;

    console.error('❌ Automated monthly summaries collection failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });

    logger.error('Automated monthly summaries collection failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime
    });

    return NextResponse.json({
      success: false,
      error: 'Monthly summaries collection failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

