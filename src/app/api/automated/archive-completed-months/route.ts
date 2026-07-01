import { NextRequest, NextResponse } from 'next/server';
import { DataLifecycleManager } from '../../../../lib/data-lifecycle-manager';
import logger from '../../../../lib/logger';
import { verifyCronAuth, createUnauthorizedResponse } from '../../../../lib/cron-auth';

// Archival is DB-only (reads caches, writes campaign_summaries) but loops all
// clients, so give it headroom on plans that support longer functions.
// NOTE: this cron is scheduled AFTER the end-of-month-collection batches so the
// authoritative Google monthly rows already exist and are not clobbered here
// (see DataLifecycleManager.archiveGoogleAdsMonthlyData's authoritative guard).
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

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
    logger.info('Automated monthly archival started', { endpoint: '/api/automated/archive-completed-months' });
    
    const lifecycleManager = DataLifecycleManager.getInstance();
    await lifecycleManager.archiveCompletedMonths();
    
    const responseTime = Date.now() - startTime;
    
    logger.info('Automated monthly archival completed', { responseTime });
    
    return NextResponse.json({
      success: true,
      message: 'Monthly data archival completed successfully',
      responseTime
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.error('❌ Automated monthly archival failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });
    
    logger.error('Automated monthly archival failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime
    });
    
    return NextResponse.json({ 
      success: false,
      error: 'Monthly archival failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 