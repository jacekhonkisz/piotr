/**
 * Period Transition Cron Job
 * 
 * Automatically handles cache transitions when periods end:
 * - Archives expired monthly caches
 * - Archives expired weekly caches
 * - Prevents stale data being labeled as "current"
 * 
 * Should run at midnight on period boundaries:
 * - Every 1st of month at 00:00 (month transitions)
 * - Every Monday at 00:00 (week transitions)
 * 
 * Security: Requires CRON_SECRET in Authorization header
 */

import { PeriodTransitionHandler } from '@/lib/period-transition-handler';
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
    
    logger.info('🔄 Starting period transition check...');
    
    const results = await PeriodTransitionHandler.handleTransition();
    
    const executionTime = Date.now() - startTime;
    const totalArchived = results.monthTransition.archived + results.weekTransition.archived;
    const totalErrors = results.monthTransition.errors + results.weekTransition.errors;
    
    logger.info('✅ Period transition check completed', {
      executionTime: `${executionTime}ms`,
      totalArchived,
      totalErrors,
      results
    });
    
    return Response.json({ 
      success: totalErrors === 0,
      timestamp: new Date().toISOString(),
      executionTime,
      totalArchived,
      totalErrors,
      details: results
    });
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logger.error('❌ Critical error in period transition:', error);
    
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

