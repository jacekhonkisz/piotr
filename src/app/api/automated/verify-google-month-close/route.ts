import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import logger from '@/lib/logger';
import { verifyCronAuth, createUnauthorizedResponse } from '@/lib/cron-auth';
import {
  collectAuthoritativeGoogleMonth,
  buildGoogleAdsService,
  monthBounds,
  justClosedMonth,
  COMPLETENESS_TOLERANCE,
} from '@/lib/google-monthly-authoritative-collector';

/**
 * VERIFY & SELF-HEAL GOOGLE MONTH-CLOSE
 *
 * Safety net that runs AFTER end-of-month-collection + archival. For each Google
 * client it compares the stored monthly summary of the just-closed month against
 * the LIVE account-level spend (one cheap API call per client). Any row that is
 * missing, flagged incomplete, or diverges beyond the completeness tolerance is
 * automatically re-collected via the shared authoritative collector.
 *
 * Why this exists: the month-close collection is batched across many cron
 * invocations; if one batch fails to fire or a client times out, its stored
 * month would silently stay partial (the original staleness bug). This endpoint
 * detects and repairs that without human intervention, and surfaces an ALARM if
 * anything still can't be fixed.
 *
 * Scaling: batched via ?offset & ?limit. Checks are cheap; inline heals are
 * CAPPED per invocation (maxHeals) so a single run stays under the time budget.
 * Because it runs daily against the just-closed month, deferred heals converge
 * over subsequent runs, and ongoing drift is caught all month long.
 *
 * Query params: ?offset=0&limit=20&maxHeals=4&targetMonth=YYYY-MM&dryRun=1
 * Security: CRON_SECRET protected.
 */

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) return createUnauthorizedResponse();
  return await POST(request);
}

export async function POST(request: NextRequest) {
  if (!verifyCronAuth(request)) return createUnauthorizedResponse();
  const startTime = Date.now();

  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20);
    const maxHeals = Math.max(0, parseInt(searchParams.get('maxHeals') || '4', 10));
    const dryRun = searchParams.get('dryRun') === '1' || searchParams.get('dryRun') === 'true';
    const targetMonth = searchParams.get('targetMonth') || justClosedMonth();
    const { startDate, endDate } = monthBounds(targetMonth);

    logger.info(`🔎 Verify month-close ${targetMonth} (${startDate}→${endDate}) offset=${offset} limit=${limit} maxHeals=${maxHeals}${dryRun ? ' [dryRun]' : ''}`);

    // Shared Google Ads manager credentials.
    const { data: settingsData } = await supabaseAdmin
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'google_ads_client_id',
        'google_ads_client_secret',
        'google_ads_developer_token',
        'google_ads_manager_refresh_token',
        'google_ads_manager_customer_id',
      ]);
    const settings = Object.fromEntries((settingsData || []).map((s: any) => [s.key, s.value])) as Record<string, string>;

    const { count: totalClients } = await supabaseAdmin
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('google_ads_enabled', true)
      .not('google_ads_customer_id', 'is', null);

    const { data: clients, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, name, company, google_ads_customer_id, google_ads_refresh_token')
      .eq('google_ads_enabled', true)
      .not('google_ads_customer_id', 'is', null)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (clientError) {
      return NextResponse.json({ error: 'Failed to fetch clients', details: clientError.message }, { status: 500 });
    }
    if (!clients || clients.length === 0) {
      return NextResponse.json({ success: true, message: 'No clients in this batch', batch: { offset, limit } });
    }

    const results: Array<Record<string, unknown>> = [];
    let healed = 0;
    let healsRemaining = maxHeals;
    const alarms: string[] = [];

    for (const client of clients) {
      const clientName = client.company || client.name;
      try {
        const { data: stored } = await supabaseAdmin
          .from('campaign_summaries')
          .select('total_spend, data_source')
          .eq('client_id', client.id)
          .eq('platform', 'google')
          .eq('summary_type', 'monthly')
          .eq('summary_date', startDate)
          .maybeSingle();

        const service = buildGoogleAdsService(settings, client.google_ads_customer_id!, client.google_ads_refresh_token);

        let accountSpend = 0;
        try {
          const account = await service.getAccountPerformance(startDate, endDate);
          accountSpend = account?.spend || 0;
        } catch (e) {
          results.push({ client: clientName, status: 'check_error', note: (e as Error).message });
          alarms.push(`${clientName}: account check failed (${(e as Error).message})`);
          continue;
        }

        const storedSpend = stored ? Number((stored as any).total_spend) || 0 : 0;
        const storedSource = stored ? String((stored as any).data_source || '') : '';
        const ratio = accountSpend > 0 ? storedSpend / accountSpend : stored ? 1 : 0;

        let status: string;
        if (!stored) status = 'missing';
        else if (storedSource === 'google_ads_api_incomplete') status = 'incomplete';
        else if (accountSpend > 0 && (ratio < 1 - COMPLETENESS_TOLERANCE || ratio > 1 + COMPLETENESS_TOLERANCE)) status = 'stale';
        else status = 'ok';

        if (status === 'ok') {
          results.push({ client: clientName, status, storedSpend: storedSpend.toFixed(2), accountSpend: accountSpend.toFixed(2), pct: accountSpend > 0 ? `${(ratio * 100).toFixed(1)}%` : 'n/a' });
          continue;
        }

        // Needs remediation.
        if (dryRun) {
          results.push({ client: clientName, status: `${status} (dryRun, not healed)`, storedSpend: storedSpend.toFixed(2), accountSpend: accountSpend.toFixed(2) });
          alarms.push(`${clientName}: ${status} (stored ${storedSpend.toFixed(2)} vs account ${accountSpend.toFixed(2)})`);
          continue;
        }
        if (healsRemaining <= 0) {
          results.push({ client: clientName, status: `${status}_deferred`, storedSpend: storedSpend.toFixed(2), accountSpend: accountSpend.toFixed(2) });
          alarms.push(`${clientName}: ${status}, heal deferred (cap reached) — will retry next run`);
          continue;
        }

        healsRemaining--;
        const heal = await collectAuthoritativeGoogleMonth(supabaseAdmin, service, client.id, startDate, endDate);
        if (heal.status === 'saved' || heal.status === 'flagged_incomplete') {
          healed++;
          results.push({ client: clientName, status: `healed:${status}→${heal.status}`, before: storedSpend.toFixed(2), after: heal.spend.toFixed(2), accountSpend: heal.accountSpend.toFixed(2) });
          if (heal.status === 'flagged_incomplete') alarms.push(`${clientName}: re-collected but still incomplete (campaign ${heal.spend.toFixed(2)} vs account ${heal.accountSpend.toFixed(2)})`);
        } else {
          results.push({ client: clientName, status: `heal_failed:${heal.status}`, note: heal.error });
          alarms.push(`${clientName}: heal failed (${heal.status}${heal.error ? `: ${heal.error}` : ''})`);
        }
      } catch (e) {
        results.push({ client: clientName, status: 'error', note: (e as Error).message });
        alarms.push(`${clientName}: ${(e as Error).message}`);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const processedThrough = offset + clients.length;
    const hasMore = typeof totalClients === 'number' ? processedThrough < totalClients : clients.length === limit;

    if (alarms.length > 0) {
      logger.error(`🚨 MONTH-CLOSE VERIFY ALARM (${targetMonth}): ${alarms.length} issue(s):\n - ${alarms.join('\n - ')}`);
    } else {
      logger.info(`✅ Month-close verify batch clean (${targetMonth}): ${clients.length} clients OK`);
    }

    return NextResponse.json({
      success: true,
      targetMonth,
      dateRange: { start: startDate, end: endDate },
      batch: { offset, limit, processed: clients.length, totalClients: totalClients ?? null, hasMore, nextOffset: hasMore ? processedThrough : null },
      healed,
      healCap: maxHeals,
      alarmCount: alarms.length,
      alarms,
      duration: `${duration}s`,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('❌ verify-google-month-close failed:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
