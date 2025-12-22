import { NextRequest, NextResponse } from 'next/server';
import logger from '../../../../lib/logger';
import { verifyCronAuth, createUnauthorizedResponse } from '../../../../lib/cron-auth';

/**
 * Unified cache refresh endpoint - refreshes all cache types in one job
 * This solves the Vercel Hobby plan limitation of 1 cron job
 * 
 * Schedule: Every 3 hours
 * Replaces: Individual cache refresh cron jobs
 * Security: Protected with CRON_SECRET authentication
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
  const results: any = {
    metaMonthly: { status: 'pending' },
    metaWeekly: { status: 'pending' },
    googleAdsMonthly: { status: 'pending' },
    googleAdsWeekly: { status: 'pending' }
  };

  try {
    logger.info('🔄 Unified cache refresh started', { 
      endpoint: '/api/automated/refresh-all-caches',
      timestamp: new Date().toISOString()
    });

    // Get the correct base URL for API calls
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : (process.env.NODE_ENV === 'production' 
        ? 'https://piotr-33s37fogt-jachonkisz-gmailcoms-projects.vercel.app'
        : 'http://localhost:3000');

    // Refresh all caches sequentially with delays to avoid overwhelming the system
    const cacheEndpoints = [
      { name: 'metaMonthly', path: '/api/automated/refresh-current-month-cache', delay: 0 },
      { name: 'metaWeekly', path: '/api/automated/refresh-current-week-cache', delay: 5000 },
      { name: 'googleAdsMonthly', path: '/api/automated/refresh-google-ads-current-month-cache', delay: 5000 },
      { name: 'googleAdsWeekly', path: '/api/automated/refresh-google-ads-current-week-cache', delay: 5000 }
    ];

    for (const endpoint of cacheEndpoints) {
      try {
        // Delay between refreshes to avoid rate limits
        if (endpoint.delay > 0) {
          await new Promise(resolve => setTimeout(resolve, endpoint.delay));
        }

        logger.info(`📊 Refreshing ${endpoint.name}...`);
        
        const response = await fetch(`${baseUrl}${endpoint.path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // ✅ FIX: Use CRON_SECRET for internal cron calls (verifyCronAuth expects this)
            'Authorization': `Bearer ${process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          results[endpoint.name] = {
            status: 'success',
            summary: data.summary || {},
            responseTime: data.responseTime
          };
          logger.info(`✅ ${endpoint.name} refresh completed`, data.summary);
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        logger.error(`❌ ${endpoint.name} refresh failed`, {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        results[endpoint.name] = {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    const totalTime = Date.now() - startTime;
    
    // Calculate summary
    const summary = {
      totalCacheTypes: 4,
      successful: Object.values(results).filter((r: any) => r.status === 'success').length,
      failed: Object.values(results).filter((r: any) => r.status === 'error').length,
      totalTime
    };

    logger.info('✅ Unified cache refresh completed', summary);

    return NextResponse.json({
      success: true,
      message: 'All cache refresh operations completed',
      summary,
      details: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    
    logger.error('❌ Unified cache refresh failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      totalTime
    });

    return NextResponse.json({
      success: false,
      error: 'Unified cache refresh failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      results,
      totalTime
    }, { status: 500 });
  }
}

