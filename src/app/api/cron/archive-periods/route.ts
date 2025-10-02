/**
 * Automated Period Archival Cron Job
 * 
 * This endpoint should be called:
 * - Every 1st of the month at 1 AM (archive completed months)
 * - Every Monday at 1 AM (archive completed weeks)
 * 
 * Security: Requires CRON_SECRET in Authorization header
 */

import { DataLifecycleManager } from '@/lib/data-lifecycle-manager';
import { NextRequest } from 'next/server';
import logger from '@/lib/logger';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // 🔒 SECURITY: Verify cron secret
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
    
    if (!process.env.CRON_SECRET) {
      logger.error('❌ CRON_SECRET not configured');
      return Response.json({ 
        success: false,
        error: 'CRON_SECRET not configured' 
      }, { status: 500 });
    }
    
    if (authHeader !== expectedAuth) {
      logger.warn('🚫 Unauthorized cron attempt', {
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        timestamp: new Date().toISOString()
      });
      return Response.json({ 
        success: false,
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    logger.info('🚀 Starting automated period archival...');
    
    const lifecycle = DataLifecycleManager.getInstance();
    const results = {
      monthsArchived: 0,
      weeksArchived: 0,
      dataCleanedUp: false,
      errors: [] as string[]
    };
    
    // 1. Archive completed months
    try {
      await lifecycle.archiveCompletedMonths();
      results.monthsArchived = 1;
      logger.info('✅ Monthly archival completed');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('❌ Monthly archival failed:', error);
      results.errors.push(`Monthly archival: ${errorMsg}`);
    }
    
    // 2. Archive completed weeks
    try {
      await lifecycle.archiveCompletedWeeks();
      results.weeksArchived = 1;
      logger.info('✅ Weekly archival completed');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('❌ Weekly archival failed:', error);
      results.errors.push(`Weekly archival: ${errorMsg}`);
    }
    
    // 3. Cleanup old data (beyond retention period)
    try {
      await lifecycle.cleanupOldData();
      results.dataCleanedUp = true;
      logger.info('✅ Data cleanup completed');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('❌ Data cleanup failed:', error);
      results.errors.push(`Data cleanup: ${errorMsg}`);
    }
    
    const executionTime = Date.now() - startTime;
    
    logger.info('🎉 Automated period archival completed', {
      executionTime: `${executionTime}ms`,
      results
    });
    
    return Response.json({ 
      success: results.errors.length === 0,
      timestamp: new Date().toISOString(),
      executionTime,
      results
    });
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logger.error('❌ Critical error in period archival:', error);
    
    return Response.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      executionTime
    }, { status: 500 });
  }
}

// Export runtime configuration for Vercel Edge
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

