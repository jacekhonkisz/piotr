import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '../../../../lib/logger';
import { verifyCronAuth, createUnauthorizedResponse } from '../../../../lib/cron-auth';
import { getSmartCacheData, getSmartWeekCacheData } from '../../../../lib/smart-cache-helper';
import { getGoogleAdsSmartCacheData, getGoogleAdsSmartWeekCacheData } from '../../../../lib/google-ads-smart-cache-helper';
import { getCurrentWeekInfo } from '../../../../lib/week-utils';

/**
 * UNIFIED CACHE REFRESH — STALEST-FIRST, BATCHED (v3)
 *
 * Previous versions looped ALL clients × 4 cache types in a single invocation.
 * With 10+ clients that exceeded the serverless time limit, so the function was
 * killed mid-loop and clients at the tail of the list were never refreshed
 * (observed: same clients stale for days while others refreshed every cycle).
 *
 * v3 design (scales to 40+ clients):
 * - Each invocation refreshes at most `?limit` clients (default 10), doing ALL
 *   4 cache types per client (Meta monthly/weekly, Google monthly/weekly).
 * - STALEST-FIRST: clients are ordered by their oldest applicable cache age,
 *   so any client missed by a previous run automatically becomes top priority.
 *   Unlike fixed offset slices, repeated failures cannot starve the same client.
 * - Freshness skip (<1.5h) applies to EVERY cache type, so fresh clients cost
 *   nothing and the budget is spent where it matters.
 * - Soft time budget: no new client is started after 240s so the invocation
 *   always exits cleanly instead of being killed mid-write.
 * - SLA alarm: after the run, any client whose applicable cache is still older
 *   than 6h is reported via an ALARM log for monitoring.
 *
 * Schedule: several identical staggered cron entries per cycle (see vercel.json).
 * Security: CRON_SECRET protected.
 */

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const FRESHNESS_SKIP_HOURS = 1.5;
const SOFT_BUDGET_MS = 240_000;
const SLA_HOURS = 6;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type CacheType = 'metaMonthly' | 'metaWeekly' | 'googleMonthly' | 'googleWeekly';

const CACHE_TABLES: Record<CacheType, string> = {
  metaMonthly: 'current_month_cache',
  metaWeekly: 'current_week_cache',
  googleMonthly: 'google_ads_current_month_cache',
  googleWeekly: 'google_ads_current_week_cache',
};

function hoursSince(iso: string | null | undefined): number {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60);
}

/** last_updated per client for one cache table + period. */
async function getCacheAges(table: string, periodId: string): Promise<Map<string, string>> {
  const { data } = await supabase
    .from(table)
    .select('client_id, last_updated')
    .eq('period_id', periodId);
  const map = new Map<string, string>();
  for (const row of data || []) {
    map.set((row as any).client_id, (row as any).last_updated);
  }
  return map;
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) return createUnauthorizedResponse();
  // For Vercel cron jobs - they only support GET requests
  return await POST(request);
}

export async function POST(request: NextRequest) {
  if (!verifyCronAuth(request)) return createUnauthorizedResponse();
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '10', 10) || 10);

    const now = new Date();
    const monthPeriodId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const weekPeriodId = getCurrentWeekInfo().periodId;

    logger.info('🔄 Cache refresh v3 (stalest-first) started', { limit, monthPeriodId, weekPeriodId });

    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, meta_access_token, system_user_token, ad_account_id, google_ads_customer_id, google_ads_refresh_token, api_status')
      .eq('api_status', 'valid');

    if (clientsError) throw new Error(`Failed to get clients: ${clientsError.message}`);
    if (!clients || clients.length === 0) {
      return NextResponse.json({ success: true, message: 'No active clients found' });
    }

    const { data: managerTokenSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'google_ads_manager_refresh_token')
      .single();
    const hasManagerToken = !!managerTokenSetting?.value;

    // Bulk-load cache freshness for all 4 tables.
    const [metaMonthlyAges, metaWeeklyAges, googleMonthlyAges, googleWeeklyAges] = await Promise.all([
      getCacheAges(CACHE_TABLES.metaMonthly, monthPeriodId),
      getCacheAges(CACHE_TABLES.metaWeekly, weekPeriodId),
      getCacheAges(CACHE_TABLES.googleMonthly, monthPeriodId),
      getCacheAges(CACHE_TABLES.googleWeekly, weekPeriodId),
    ]);

    // Build per-client work items: which cache types apply and how stale each is.
    interface WorkItem {
      client: (typeof clients)[number];
      staleTypes: CacheType[];
      oldestAgeHours: number;
      ages: Partial<Record<CacheType, number>>;
    }

    const workItems: WorkItem[] = [];
    for (const client of clients) {
      const metaApplicable = !!((client.system_user_token || client.meta_access_token) && client.ad_account_id);
      const googleApplicable = !!(client.google_ads_customer_id && (hasManagerToken || client.google_ads_refresh_token));

      const ages: Partial<Record<CacheType, number>> = {};
      if (metaApplicable) {
        ages.metaMonthly = hoursSince(metaMonthlyAges.get(client.id));
        ages.metaWeekly = hoursSince(metaWeeklyAges.get(client.id));
      }
      if (googleApplicable) {
        ages.googleMonthly = hoursSince(googleMonthlyAges.get(client.id));
        ages.googleWeekly = hoursSince(googleWeeklyAges.get(client.id));
      }

      const staleTypes = (Object.keys(ages) as CacheType[]).filter(
        (t) => (ages[t] ?? 0) >= FRESHNESS_SKIP_HOURS
      );
      if (staleTypes.length === 0) continue;

      workItems.push({
        client,
        staleTypes,
        oldestAgeHours: Math.max(...staleTypes.map((t) => ages[t] ?? 0)),
        ages,
      });
    }

    // STALEST-FIRST: clients with the oldest cache get refreshed first.
    workItems.sort((a, b) => b.oldestAgeHours - a.oldestAgeHours);
    const selected = workItems.slice(0, limit);
    const deferred = workItems.slice(limit);

    logger.info(`📊 ${clients.length} clients, ${workItems.length} need refresh; processing ${selected.length} (stalest first), deferring ${deferred.length}`);

    const REFRESHERS: Record<CacheType, (clientId: string) => Promise<any>> = {
      metaMonthly: (id) => getSmartCacheData(id, true, 'meta'),
      metaWeekly: (id) => getSmartWeekCacheData(id, true),
      googleMonthly: (id) => getGoogleAdsSmartCacheData(id, true),
      googleWeekly: (id) => getGoogleAdsSmartWeekCacheData(id, true),
    };

    const results: Array<Record<string, unknown>> = [];
    let refreshedTypes = 0;
    let errorTypes = 0;
    let budgetStopped = false;

    for (const item of selected) {
      if (Date.now() - startTime > SOFT_BUDGET_MS) {
        budgetStopped = true;
        results.push({ client: item.client.name, status: 'deferred_budget', oldestAgeHours: item.oldestAgeHours.toFixed(1) });
        continue;
      }

      const perType: Record<string, string> = {};
      for (const type of item.staleTypes) {
        try {
          await REFRESHERS[type](item.client.id);
          perType[type] = 'refreshed';
          refreshedTypes++;
        } catch (e) {
          perType[type] = `error: ${(e as Error).message}`;
          errorTypes++;
          logger.error(`❌ ${type} refresh failed for ${item.client.name}:`, (e as Error).message);
        }
      }
      results.push({
        client: item.client.name,
        oldestAgeHours: item.oldestAgeHours === Infinity ? 'never' : item.oldestAgeHours.toFixed(1),
        ...perType,
      });
    }

    // SLA WATCHDOG: recheck freshness after the run; anything still beyond the
    // SLA is a signal that refresh capacity/schedule is insufficient or a
    // client persistently fails — surfaced as an ALARM log for monitoring.
    const [mmA, mwA, gmA, gwA] = await Promise.all([
      getCacheAges(CACHE_TABLES.metaMonthly, monthPeriodId),
      getCacheAges(CACHE_TABLES.metaWeekly, weekPeriodId),
      getCacheAges(CACHE_TABLES.googleMonthly, monthPeriodId),
      getCacheAges(CACHE_TABLES.googleWeekly, weekPeriodId),
    ]);
    const alarms: string[] = [];
    for (const client of clients) {
      const metaApplicable = !!((client.system_user_token || client.meta_access_token) && client.ad_account_id);
      const googleApplicable = !!(client.google_ads_customer_id && (hasManagerToken || client.google_ads_refresh_token));
      const breaches: string[] = [];
      if (metaApplicable) {
        if (hoursSince(mmA.get(client.id)) > SLA_HOURS) breaches.push('metaMonthly');
        if (hoursSince(mwA.get(client.id)) > SLA_HOURS) breaches.push('metaWeekly');
      }
      if (googleApplicable) {
        if (hoursSince(gmA.get(client.id)) > SLA_HOURS) breaches.push('googleMonthly');
        if (hoursSince(gwA.get(client.id)) > SLA_HOURS) breaches.push('googleWeekly');
      }
      if (breaches.length > 0) {
        alarms.push(`${client.name}: ${breaches.join(', ')} older than ${SLA_HOURS}h`);
      }
    }
    if (alarms.length > 0) {
      logger.error(`🚨 CACHE STALENESS ALARM: ${alarms.length} client(s) beyond ${SLA_HOURS}h SLA:\n - ${alarms.join('\n - ')}`);
    }

    const totalTime = Date.now() - startTime;
    logger.info('✅ Cache refresh v3 completed', { refreshedTypes, errorTypes, deferred: deferred.length, budgetStopped, alarmCount: alarms.length, totalTime });

    return NextResponse.json({
      success: true,
      version: 'v3-stalest-first',
      limit,
      periods: { month: monthPeriodId, week: weekPeriodId },
      summary: {
        clientsTotal: clients.length,
        clientsNeedingRefresh: workItems.length,
        clientsProcessed: selected.length,
        clientsDeferred: deferred.length,
        cacheTypesRefreshed: refreshedTypes,
        cacheTypesErrored: errorTypes,
        budgetStopped,
      },
      alarmCount: alarms.length,
      alarms,
      results,
      totalTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    logger.error('❌ Cache refresh v3 failed', { error: error instanceof Error ? error.message : 'Unknown error', totalTime });
    return NextResponse.json(
      { success: false, error: 'Cache refresh failed', details: error instanceof Error ? error.message : 'Unknown error', totalTime },
      { status: 500 }
    );
  }
}
