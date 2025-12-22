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
 * ✅ REFACTORED: Now uses direct function calls instead of HTTP requests
 * to avoid URL resolution issues in serverless environments.
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
          
          if (cacheAge < 2.5) {
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
      
      for (const client of clients) {
        const metaToken = client.system_user_token || client.meta_access_token;
        if (!metaToken || !client.ad_account_id) {
          metaWeeklySkipped++;
          continue;
        }
        
        try {
          const result = await getSmartWeekCacheData(client.id, true);
          if (result.success) {
            metaWeeklySuccess++;
          } else {
            metaWeeklySkipped++;
          }
        } catch (e) {
          metaWeeklyError++;
          logger.error(`Meta weekly error for ${client.name}:`, e);
        }
      }
      
      results.metaWeekly = { 
        status: 'success', 
        summary: { success: metaWeeklySuccess, skipped: metaWeeklySkipped, errors: metaWeeklyError }
      };
      logger.info('✅ Meta weekly cache completed', results.metaWeekly.summary);
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
      
      for (const client of clients) {
        if (!client.google_ads_customer_id || !client.google_ads_refresh_token) {
          googleMonthlySkipped++;
          continue;
        }
        
        try {
          await getGoogleAdsSmartCacheData(client.id, true);
          googleMonthlySuccess++;
        } catch (e) {
          googleMonthlyError++;
          logger.error(`Google monthly error for ${client.name}:`, e);
        }
      }
      
      results.googleAdsMonthly = { 
        status: 'success', 
        summary: { success: googleMonthlySuccess, skipped: googleMonthlySkipped, errors: googleMonthlyError }
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
      
      for (const client of clients) {
        if (!client.google_ads_customer_id || !client.google_ads_refresh_token) {
          googleWeeklySkipped++;
          continue;
        }
        
        try {
          await getGoogleAdsSmartWeekCacheData(client.id, true);
          googleWeeklySuccess++;
        } catch (e) {
          googleWeeklyError++;
          logger.error(`Google weekly error for ${client.name}:`, e);
        }
      }
      
      results.googleAdsWeekly = { 
        status: 'success', 
        summary: { success: googleWeeklySuccess, skipped: googleWeeklySkipped, errors: googleWeeklyError }
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
