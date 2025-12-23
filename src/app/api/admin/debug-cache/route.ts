import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/admin/debug-cache
 * 
 * Diagnostic endpoint to help identify cache refresh issues
 * Returns detailed information about cache state and period calculations
 */
export async function GET(request: NextRequest) {
  try {
    // Get current week/month info
    const { getCurrentWeekInfo, parseWeekPeriodId, isCurrentWeekPeriod } = await import('../../../../lib/week-utils');
    const currentWeek = getCurrentWeekInfo();
    
    const now = new Date();
    const currentMonth = {
      periodId: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      year: now.getFullYear(),
      month: now.getMonth() + 1
    };

    // Get cache entries with their period_ids
    const { data: monthlyCache, error: monthlyError } = await supabase
      .from('current_month_cache')
      .select('client_id, period_id, last_updated, clients(name)')
      .order('last_updated', { ascending: false });

    const { data: weeklyCache, error: weeklyError } = await supabase
      .from('current_week_cache')
      .select('client_id, period_id, last_updated, clients(name)')
      .order('last_updated', { ascending: false });

    // Get Google Ads cache entries (no join to avoid filtering)
    const { data: googleMonthlyCache, error: googleMonthlyError } = await supabase
      .from('google_ads_current_month_cache')
      .select('client_id, period_id, last_updated')
      .order('last_updated', { ascending: false });

    // Use left join to avoid filtering out entries without matching clients
    const { data: googleWeeklyCache, error: googleWeeklyError } = await supabase
      .from('google_ads_current_week_cache')
      .select('client_id, period_id, last_updated')
      .order('last_updated', { ascending: false });

    // Analyze monthly cache
    const monthlyAnalysis = {
      totalEntries: monthlyCache?.length || 0,
      currentPeriodEntries: monthlyCache?.filter(e => e.period_id === currentMonth.periodId).length || 0,
      periodIdDistribution: {} as Record<string, number>,
      freshEntries: 0,
      staleEntries: 0
    };

    const nowTime = Date.now();
    const CACHE_TTL = 3 * 60 * 60 * 1000; // 3 hours

    monthlyCache?.forEach(entry => {
      monthlyAnalysis.periodIdDistribution[entry.period_id] = 
        (monthlyAnalysis.periodIdDistribution[entry.period_id] || 0) + 1;
      
      const age = nowTime - new Date(entry.last_updated).getTime();
      if (age < CACHE_TTL) {
        monthlyAnalysis.freshEntries++;
      } else {
        monthlyAnalysis.staleEntries++;
      }
    });

    // Analyze weekly cache
    const weeklyAnalysis = {
      totalEntries: weeklyCache?.length || 0,
      currentPeriodEntries: weeklyCache?.filter(e => e.period_id === currentWeek.periodId).length || 0,
      periodIdDistribution: {} as Record<string, number>,
      freshEntries: 0,
      staleEntries: 0,
      oldestEntry: null as any,
      newestEntry: null as any
    };

    weeklyCache?.forEach(entry => {
      weeklyAnalysis.periodIdDistribution[entry.period_id] = 
        (weeklyAnalysis.periodIdDistribution[entry.period_id] || 0) + 1;
      
      const age = nowTime - new Date(entry.last_updated).getTime();
      if (age < CACHE_TTL) {
        weeklyAnalysis.freshEntries++;
      } else {
        weeklyAnalysis.staleEntries++;
      }
    });

    if (weeklyCache && weeklyCache.length > 0) {
      weeklyAnalysis.newestEntry = weeklyCache[0];
      weeklyAnalysis.oldestEntry = weeklyCache[weeklyCache.length - 1];
    }

    // Test isCurrentWeekPeriod function with cache entries
    const weeklyPeriodChecks = Object.keys(weeklyAnalysis.periodIdDistribution).map(periodId => ({
      periodId,
      isCurrentWeek: isCurrentWeekPeriod(periodId),
      count: weeklyAnalysis.periodIdDistribution[periodId]
    }));

    // Get client count with Google Ads configuration status
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, api_status, google_ads_enabled, google_ads_customer_id, google_ads_refresh_token, ad_account_id, meta_access_token, system_user_token')
      .eq('api_status', 'valid');

    // Check for Google Ads manager token in system settings
    const { data: googleAdsManagerToken, error: managerTokenError } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'google_ads_manager_refresh_token')
      .single();

    const hasManagerToken = !!(googleAdsManagerToken?.value);

    // Analyze Google Ads configuration
    const googleAdsAnalysis = {
      hasManagerToken,
      clientsWithGoogleAdsEnabled: clients?.filter(c => c.google_ads_enabled).length || 0,
      clientsWithCustomerId: clients?.filter(c => c.google_ads_customer_id).length || 0,
      clientsWithIndividualToken: clients?.filter(c => c.google_ads_refresh_token).length || 0,
      clientsWithAnyToken: clients?.filter(c => c.google_ads_refresh_token || hasManagerToken).length || 0,
      clientsReadyForCaching: clients?.filter(c => 
        c.google_ads_customer_id && (c.google_ads_refresh_token || hasManagerToken)
      ).length || 0,
      clientDetails: clients?.map(c => ({
        name: c.name,
        googleAdsEnabled: c.google_ads_enabled,
        hasCustomerId: !!c.google_ads_customer_id,
        hasIndividualToken: !!c.google_ads_refresh_token,
        canUseManagerToken: hasManagerToken,
        isReadyForGoogleAdsCaching: !!(c.google_ads_customer_id && (c.google_ads_refresh_token || hasManagerToken))
      })) || [],
      diagnosis: !hasManagerToken && clients?.every(c => !c.google_ads_refresh_token) ?
        '❌ CRITICAL: No Google Ads refresh tokens available (neither manager nor individual)' :
        clients?.filter(c => c.google_ads_customer_id && (c.google_ads_refresh_token || hasManagerToken)).length === 0 ?
        '⚠️ WARNING: No clients have Google Ads customer_id configured' :
        '✅ OK: Google Ads caching should work'
    };

    // Analyze Meta configuration
    const metaAnalysis = {
      clientsWithMetaToken: clients?.filter(c => c.meta_access_token || c.system_user_token).length || 0,
      clientsWithAdAccount: clients?.filter(c => c.ad_account_id).length || 0,
      clientsReadyForCaching: clients?.filter(c => 
        c.ad_account_id && (c.meta_access_token || c.system_user_token)
      ).length || 0
    };

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      currentDate: {
        isoDate: now.toISOString(),
        dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
        date: now.toLocaleDateString()
      },
      currentPeriods: {
        month: currentMonth,
        week: currentWeek
      },
      clients: {
        total: clients?.length || 0,
        active: clients?.filter(c => c.api_status === 'valid').length || 0,
        meta: metaAnalysis,
        googleAds: googleAdsAnalysis
      },
      monthlyCache: {
        ...monthlyAnalysis,
        expectedPeriodId: currentMonth.periodId,
        hasMismatch: monthlyAnalysis.currentPeriodEntries < monthlyAnalysis.totalEntries
      },
      weeklyCache: {
        ...weeklyAnalysis,
        expectedPeriodId: currentWeek.periodId,
        hasMismatch: weeklyAnalysis.currentPeriodEntries < weeklyAnalysis.totalEntries,
        periodChecks: weeklyPeriodChecks,
        diagnosis: weeklyAnalysis.freshEntries === 0 ? 
          '⚠️ CRITICAL: No fresh weekly cache entries - cron may be failing' :
          weeklyAnalysis.freshEntries < weeklyAnalysis.totalEntries ?
          '⚠️ WARNING: Some weekly cache entries are stale' :
          '✅ OK: Weekly cache entries are fresh'
      },
      googleAdsMonthlyCache: {
        totalEntries: googleMonthlyCache?.length || 0,
        periodIdDistribution: googleMonthlyCache?.reduce((acc, e) => {
          acc[e.period_id] = (acc[e.period_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {},
        diagnosis: !googleMonthlyCache?.length ?
          '⚠️ WARNING: No Google Ads monthly cache entries - check if clients have google_ads_customer_id configured' :
          '✅ OK: Google Ads monthly cache has entries'
      },
      googleAdsWeeklyCache: {
        totalEntries: googleWeeklyCache?.length || 0,
        periodIdDistribution: googleWeeklyCache?.reduce((acc, e) => {
          acc[e.period_id] = (acc[e.period_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {},
        diagnosis: !googleWeeklyCache?.length ?
          '⚠️ WARNING: No Google Ads weekly cache entries' :
          '✅ OK: Google Ads weekly cache has entries'
      },
      errors: {
        monthly: monthlyError?.message,
        weekly: weeklyError?.message,
        googleMonthly: googleMonthlyError?.message,
        googleWeekly: googleWeeklyError?.message,
        clients: clientsError?.message,
        managerToken: managerTokenError?.message
      }
    });

  } catch (error) {
    console.error('❌ Debug cache error:', error);
    return NextResponse.json({
      error: 'Failed to debug cache',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

