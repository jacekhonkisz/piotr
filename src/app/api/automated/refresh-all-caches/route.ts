import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '../../../../lib/logger';
import { verifyCronAuth, createUnauthorizedResponse } from '../../../../lib/cron-auth';
import { getSmartCacheData, getSmartWeekCacheData } from '../../../../lib/smart-cache-helper';
import { getGoogleAdsSmartCacheData, getGoogleAdsSmartWeekCacheData } from '../../../../lib/google-ads-smart-cache-helper';

/**
 * Unified cache refresh endpoint - refreshes all cache types in one job
 * This solves the Vercel Hobby plan limitation of 1 cron job
 * 
 * Schedule: Every 3 hours
 * Replaces: Individual cache refresh cron jobs
 * Security: Protected with CRON_SECRET authentication
 * 
 * ✅ REFACTORED v2: Now uses direct function calls instead of HTTP requests
 * to avoid URL resolution issues in serverless environments.
 * VERSION: 2025-12-22-v2
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getCurrentMonthInfo() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    periodId: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  };
}

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
    logger.info('🔄 Unified cache refresh started (DIRECT CALLS)', { 
      endpoint: '/api/automated/refresh-all-caches',
      timestamp: new Date().toISOString()
    });

    const currentMonth = getCurrentMonthInfo();

    // Get all active clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, meta_access_token, system_user_token, ad_account_id, google_ads_customer_id, google_ads_refresh_token, api_status')
      .eq('api_status', 'valid');

    if (clientsError) {
      throw new Error(`Failed to get clients: ${clientsError.message}`);
    }

    if (!clients || clients.length === 0) {
      logger.info('No active clients found');
      return NextResponse.json({
        success: true,
        message: 'No active clients found',
        summary: { totalCacheTypes: 4, successful: 0, failed: 0 }
      });
    }

    logger.info(`📊 Processing ${clients.length} clients for cache refresh`);

    // 1. META MONTHLY CACHE
    try {
      logger.info('📊 Refreshing Meta monthly cache...');
      let metaMonthlySuccess = 0, metaMonthlySkipped = 0, metaMonthlyError = 0;
      
      for (const client of clients) {
        const metaToken = client.system_user_token || client.meta_access_token;
        if (!metaToken || !client.ad_account_id) {
          metaMonthlySkipped++;
          continue;
        }
        
        try {
          // Check cache freshness first
          const { data: cachedData } = await supabase
            .from('current_month_cache')
            .select('last_updated')
            .eq('client_id', client.id)
            .eq('period_id', currentMonth.periodId)
            .single();
          
          const now = Date.now();
          const cacheAge = cachedData ? (now - new Date(cachedData.last_updated).getTime()) / (1000 * 60 * 60) : 999;
          
          // 🔧 FIX: Reduced skip threshold from 2.5h to 1.5h to prevent stale cache gaps
          // With 3-hour cron schedule, this ensures proactive refresh before TTL expires
          if (cacheAge < 1.5) {
            metaMonthlySkipped++;
            continue;
          }
          
          await getSmartCacheData(client.id, true, 'meta');
          metaMonthlySuccess++;
        } catch (e) {
          metaMonthlyError++;
          logger.error(`Meta monthly error for ${client.name}:`, e);
        }
      }
      
      results.metaMonthly = { 
        status: 'success', 
        summary: { success: metaMonthlySuccess, skipped: metaMonthlySkipped, errors: metaMonthlyError }
      };
      logger.info('✅ Meta monthly cache completed', results.metaMonthly.summary);
    } catch (error) {
      results.metaMonthly = { status: 'error', error: error instanceof Error ? error.message : 'Unknown' };
      logger.error('❌ Meta monthly cache failed:', error);
    }

    // Small delay between cache types
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 2. META WEEKLY CACHE  
    try {
      logger.info('📊 Refreshing Meta weekly cache...');
      let metaWeeklySuccess = 0, metaWeeklySkipped = 0, metaWeeklyError = 0;
      const weeklyErrors: any[] = [];
      
      // 🔧 FIX: Import week utils to log current week info
      const { getCurrentWeekInfo } = await import('../../../../lib/week-utils');
      const currentWeekInfo = getCurrentWeekInfo();
      logger.info('📅 Current week info for refresh:', {
        periodId: currentWeekInfo.periodId,
        startDate: currentWeekInfo.startDate,
        endDate: currentWeekInfo.endDate
      });
      
      for (const client of clients) {
        const metaToken = client.system_user_token || client.meta_access_token;
        if (!metaToken || !client.ad_account_id) {
          logger.info(`⏭️ Skipping ${client.name} - no Meta token or ad account`);
          metaWeeklySkipped++;
          continue;
        }
        
        try {
          logger.info(`🔄 Refreshing weekly cache for ${client.name}...`);
          const result = await getSmartWeekCacheData(client.id, true);
          
          if (result.success) {
            metaWeeklySuccess++;
            logger.info(`✅ Weekly cache refreshed for ${client.name}`, {
              source: result.source,
              hasCampaigns: !!(result.data?.campaigns?.length)
            });
          } else {
            // 🔧 FIX: Log WHY it wasn't successful
            metaWeeklySkipped++;
            const reason = (result as any).shouldUseDatabase 
              ? 'shouldUseDatabase flag set (not current week?)' 
              : 'Unknown reason';
            logger.warn(`⚠️ Weekly cache returned success=false for ${client.name}:`, {
              reason,
              periodId: (result as any).periodId,
              shouldUseDatabase: (result as any).shouldUseDatabase
            });
            weeklyErrors.push({ client: client.name, reason });
          }
        } catch (e) {
          metaWeeklyError++;
          const errorMsg = e instanceof Error ? e.message : 'Unknown error';
          logger.error(`❌ Meta weekly error for ${client.name}:`, errorMsg);
          weeklyErrors.push({ client: client.name, error: errorMsg });
        }
      }
      
      results.metaWeekly = { 
        status: metaWeeklyError > 0 || metaWeeklySkipped === clients.length ? 'warning' : 'success', 
        summary: { success: metaWeeklySuccess, skipped: metaWeeklySkipped, errors: metaWeeklyError },
        weeklyErrors: weeklyErrors.length > 0 ? weeklyErrors : undefined
      };
      logger.info('✅ Meta weekly cache completed', results.metaWeekly.summary);
      if (weeklyErrors.length > 0) {
        logger.warn('⚠️ Weekly cache had issues:', weeklyErrors);
      }
    } catch (error) {
      results.metaWeekly = { status: 'error', error: error instanceof Error ? error.message : 'Unknown' };
      logger.error('❌ Meta weekly cache failed:', error);
    }

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 3. GOOGLE ADS MONTHLY CACHE
    try {
      logger.info('📊 Refreshing Google Ads monthly cache...');
      let googleMonthlySuccess = 0, googleMonthlySkipped = 0, googleMonthlyError = 0;
      const googleMonthlyErrors: any[] = [];
      
      // 🔧 FIX: Check if manager refresh token exists in system settings
      // This allows clients without individual refresh tokens to still use Google Ads
      const { data: managerTokenSetting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'google_ads_manager_refresh_token')
        .single();
      
      const hasManagerToken = !!(managerTokenSetting?.value);
      logger.info('📊 Google Ads manager token status:', { hasManagerToken });
      
      for (const client of clients) {
        // 🔧 FIX: Only require customer_id - refresh token can come from manager or client
        if (!client.google_ads_customer_id) {
          googleMonthlySkipped++;
          continue;
        }
        
        // Check if we have ANY valid refresh token (manager OR client)
        const hasRefreshToken = hasManagerToken || !!client.google_ads_refresh_token;
        if (!hasRefreshToken) {
          logger.info(`⏭️ Skipping ${client.name} - no Google Ads refresh token available`);
          googleMonthlySkipped++;
          continue;
        }
        
        try {
          logger.info(`🔄 Refreshing Google Ads monthly cache for ${client.name}...`);
          const result = await getGoogleAdsSmartCacheData(client.id, true);
          if (result.success) {
            googleMonthlySuccess++;
            logger.info(`✅ Google Ads monthly cache refreshed for ${client.name}`);
          } else {
            googleMonthlySkipped++;
            logger.warn(`⚠️ Google Ads monthly cache returned success=false for ${client.name}`);
            googleMonthlyErrors.push({ client: client.name, reason: 'success=false' });
          }
        } catch (e) {
          googleMonthlyError++;
          const errorMsg = e instanceof Error ? e.message : 'Unknown error';
          logger.error(`❌ Google monthly error for ${client.name}:`, errorMsg);
          googleMonthlyErrors.push({ client: client.name, error: errorMsg });
        }
      }
      
      results.googleAdsMonthly = { 
        status: googleMonthlyError > 0 ? 'warning' : 'success', 
        summary: { success: googleMonthlySuccess, skipped: googleMonthlySkipped, errors: googleMonthlyError },
        hasManagerToken,
        errors: googleMonthlyErrors.length > 0 ? googleMonthlyErrors : undefined
      };
      logger.info('✅ Google Ads monthly cache completed', results.googleAdsMonthly.summary);
    } catch (error) {
      results.googleAdsMonthly = { status: 'error', error: error instanceof Error ? error.message : 'Unknown' };
      logger.error('❌ Google Ads monthly cache failed:', error);
    }

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 4. GOOGLE ADS WEEKLY CACHE
    try {
      logger.info('📊 Refreshing Google Ads weekly cache...');
      let googleWeeklySuccess = 0, googleWeeklySkipped = 0, googleWeeklyError = 0;
      const googleWeeklyErrors: any[] = [];
      
      // 🔧 FIX: Re-use the manager token status from monthly refresh (already checked above)
      // If we don't have it yet (shouldn't happen), check again
      let hasManagerTokenForWeekly = (results.googleAdsMonthly as any)?.hasManagerToken;
      if (hasManagerTokenForWeekly === undefined) {
        const { data: managerTokenSetting } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'google_ads_manager_refresh_token')
          .single();
        hasManagerTokenForWeekly = !!(managerTokenSetting?.value);
      }
      
      for (const client of clients) {
        // 🔧 FIX: Only require customer_id - refresh token can come from manager or client
        if (!client.google_ads_customer_id) {
          googleWeeklySkipped++;
          continue;
        }
        
        // Check if we have ANY valid refresh token (manager OR client)
        const hasRefreshToken = hasManagerTokenForWeekly || !!client.google_ads_refresh_token;
        if (!hasRefreshToken) {
          logger.info(`⏭️ Skipping ${client.name} weekly - no Google Ads refresh token available`);
          googleWeeklySkipped++;
          continue;
        }
        
        try {
          logger.info(`🔄 Refreshing Google Ads weekly cache for ${client.name}...`);
          const result = await getGoogleAdsSmartWeekCacheData(client.id, true);
          if (result.success) {
            googleWeeklySuccess++;
            logger.info(`✅ Google Ads weekly cache refreshed for ${client.name}`);
          } else {
            googleWeeklySkipped++;
            logger.warn(`⚠️ Google Ads weekly cache returned success=false for ${client.name}`);
            googleWeeklyErrors.push({ client: client.name, reason: 'success=false' });
          }
        } catch (e) {
          googleWeeklyError++;
          const errorMsg = e instanceof Error ? e.message : 'Unknown error';
          logger.error(`❌ Google weekly error for ${client.name}:`, errorMsg);
          googleWeeklyErrors.push({ client: client.name, error: errorMsg });
        }
      }
      
      results.googleAdsWeekly = { 
        status: googleWeeklyError > 0 ? 'warning' : 'success', 
        summary: { success: googleWeeklySuccess, skipped: googleWeeklySkipped, errors: googleWeeklyError },
        errors: googleWeeklyErrors.length > 0 ? googleWeeklyErrors : undefined
      };
      logger.info('✅ Google Ads weekly cache completed', results.googleAdsWeekly.summary);
    } catch (error) {
      results.googleAdsWeekly = { status: 'error', error: error instanceof Error ? error.message : 'Unknown' };
      logger.error('❌ Google Ads weekly cache failed:', error);
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
      version: '2025-12-22-v2-direct-calls',
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
