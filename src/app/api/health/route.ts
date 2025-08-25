import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '../../../lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const startTime = Date.now();
  const healthChecks = {
    database: false,
    cronJobs: false,
    metaAPI: false,
    overall: false
  };

  try {
    // 1. Database Health Check (Fast - just ping)
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('count')
        .limit(1);
      
      if (error) throw error;
      healthChecks.database = true;
      logger.info('✅ Database health check passed');
    } catch (error) {
      logger.error('❌ Database health check failed:', error);
      healthChecks.database = false;
    }

    // 2. Cron Job Health Check (Fast - just check recent logs)
    try {
      // Quick check for recent cron job activity
      const { data: cronStatus } = await supabase
        .from('system_logs')
        .select('created_at')
        .eq('type', 'cron_job')
        .order('created_at', { ascending: false })
        .limit(1); // Only need 1 record to know jobs are running

              if (cronStatus && cronStatus.length > 0 && cronStatus[0]?.created_at) {
          const lastJobTime = new Date(cronStatus[0].created_at);
          const now = new Date();
          const hoursSinceJob = (now.getTime() - lastJobTime.getTime()) / (1000 * 60 * 60);
          
          // More lenient: jobs should run within 48 hours (not 24)
          healthChecks.cronJobs = hoursSinceJob < 48;
          
          if (healthChecks.cronJobs) {
            logger.info(`✅ Cron job health check: Last job ${hoursSinceJob.toFixed(1)} hours ago`);
          } else {
            logger.warn(`⚠️ Cron job health check: Last job ${hoursSinceJob.toFixed(1)} hours ago (too old)`);
          }
        } else {
          healthChecks.cronJobs = false;
          logger.warn('⚠️ No cron job logs found');
        }
    } catch (error) {
      logger.error('❌ Cron job health check failed:', error);
      healthChecks.cronJobs = false;
    }

    // 3. Meta API Health Check (Fast - just check if we can reach it)
    try {
      // Use AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
      const testResponse = await fetch('https://graph.facebook.com/v18.0/me', {
        method: 'GET',
        headers: {
          'User-Agent': 'MetaAdsReporting/1.0'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Even if we get an error response, the API is reachable
      healthChecks.metaAPI = true;
      logger.info('✅ Meta API connectivity check passed');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.warn('⚠️ Meta API check timed out after 3 seconds');
      } else {
        logger.error('❌ Meta API connectivity check failed:', error);
      }
      healthChecks.metaAPI = false;
    }

    // 4. Overall Health Assessment (More lenient)
    // Consider healthy if database is working (core functionality)
    // Cron jobs are important but not critical for basic operation
    healthChecks.overall = healthChecks.database; // Only database is required for "healthy"

    // 5. Get System Statistics (Fast - parallel queries)
    let systemStats = {};
    try {
      const [clientResult, cacheResult] = await Promise.all([
        supabase
          .from('clients')
          .select('count')
          .eq('api_status', 'valid'),
        supabase
          .from('current_month_cache')
          .select('count')
      ]);

      systemStats = {
        activeClients: clientResult.data?.[0]?.count || 0,
        cachedRecords: cacheResult.data?.[0]?.count || 0,
        lastHealthCheck: new Date().toISOString()
      };
    } catch (error) {
      logger.error('❌ Failed to get system stats:', error);
    }

    const responseTime = Date.now() - startTime;

    // 6. Determine HTTP Status (More lenient)
    // Return 200 if database is working (core functionality available)
    // Return 503 only if database is completely down
    const statusCode = healthChecks.database ? 200 : 503;

    logger.info('🏥 Health check completed', {
      overall: healthChecks.overall,
      responseTime,
      checks: healthChecks
    });

    return NextResponse.json({
      status: healthChecks.database ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      responseTime,
      checks: healthChecks,
      system: systemStats,
      version: process.env.npm_package_version || '0.1.0',
      notes: {
        database: 'Core functionality - required for healthy status',
        cronJobs: 'Background jobs - important but not critical',
        metaAPI: 'External connectivity - informational only'
      }
    }, { status: statusCode });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('❌ Health check failed:', error);
    
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown error',
      checks: healthChecks
    }, { status: 500 });
  }
} 