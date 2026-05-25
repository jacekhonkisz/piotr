/**
 * Contract Drift Check Cron
 *
 * Nightly drift detection: for each Meta and Google client, compares the
 * canonical stored monthly summary (or daily-kpi aggregate as fallback)
 * against a fresh live API baseline using the report metric contract.
 *
 * Period: previous full calendar month (e.g. running on May 2 → checks April).
 *
 * Security: Requires CRON_SECRET in Authorization header.
 *
 * Output: JSON summary + persisted record in `drift_checks` table when present
 *         (table is optional; absence is logged but does not fail the job).
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchUnifiedReport } from '@/lib/unified-report-fetcher';
import { compareToBaseline } from '@/lib/report-payload-validator';
import logger from '@/lib/logger';
import type { Platform } from '@/lib/report-metric-contract';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface DriftRow {
  platform: Platform;
  client_id: string;
  client_name: string;
  source: string;
  score: number;
  failed_metrics: string[];
}

function previousMonthRange(): { start: string; end: string; tag: string } {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const target = new Date(Date.UTC(year, month - 1, 1));
  const targetYear = target.getUTCFullYear();
  const targetMonth = target.getUTCMonth();
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const mm = String(targetMonth + 1).padStart(2, '0');
  return {
    start: `${targetYear}-${mm}-01`,
    end: `${targetYear}-${mm}-${String(lastDay).padStart(2, '0')}`,
    tag: `${targetYear}-${mm}`
  };
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    if (!process.env.CRON_SECRET) {
      return Response.json(
        { success: false, error: 'CRON_SECRET not configured' },
        { status: 500 }
      );
    }
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return Response.json(
        { success: false, error: 'unauthorized' },
        { status: 401 }
      );
    }

    const period = previousMonthRange();
    logger.info('🔎 drift-check starting', { period: period.tag });

    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id,name,ad_account_id,meta_access_token,google_ads_customer_id,google_ads_enabled')
      .order('name');

    if (clientsError) {
      throw clientsError;
    }

    const metaClients = (clients ?? []).filter(
      (c) => !!c.ad_account_id && !!c.meta_access_token
    );
    const googleClients = (clients ?? []).filter(
      (c) => !!c.google_ads_customer_id && !!c.google_ads_enabled
    );

    const driftRows: DriftRow[] = [];
    let metaScoreSum = 0;
    let metaCount = 0;
    let googleScoreSum = 0;
    let googleCount = 0;

    const evaluatePair = async (
      platform: Platform,
      clientId: string,
      clientName: string
    ): Promise<DriftRow | null> => {
      const baseline = await fetchUnifiedReport({
        clientId,
        dateRange: { start: period.start, end: period.end },
        platform,
        reason: 'drift-check-baseline',
        forceFresh: true
      });
      if (!baseline.success || !baseline.payload) {
        logger.warn('drift-check: baseline missing', {
          platform,
          clientId,
          chain: baseline.debug.chain
        });
        return null;
      }

      const stored = await fetchUnifiedReport({
        clientId,
        dateRange: { start: period.start, end: period.end },
        platform,
        reason: 'drift-check-stored'
      });
      if (!stored.success || !stored.payload) {
        logger.warn('drift-check: stored missing', {
          platform,
          clientId,
          chain: stored.debug.chain
        });
        return null;
      }

      const comparison = compareToBaseline(baseline.payload, stored.payload);
      const failedMetrics = comparison.diffs
        .filter((d) => !d.pass)
        .map((d) => d.metric);

      return {
        platform,
        client_id: clientId,
        client_name: clientName,
        source: stored.payload.source,
        score: Math.round(comparison.score * 10) / 10,
        failed_metrics: failedMetrics
      };
    };

    for (const client of metaClients) {
      const row = await evaluatePair('meta', client.id, client.name);
      if (row) {
        driftRows.push(row);
        metaScoreSum += row.score;
        metaCount += 1;
      }
    }

    for (const client of googleClients) {
      const row = await evaluatePair('google', client.id, client.name);
      if (row) {
        driftRows.push(row);
        googleScoreSum += row.score;
        googleCount += 1;
      }
    }

    const summary = {
      period_tag: period.tag,
      generated_at: new Date().toISOString(),
      meta: {
        clients: metaCount,
        avg_score: metaCount > 0 ? Math.round((metaScoreSum / metaCount) * 10) / 10 : null
      },
      google: {
        clients: googleCount,
        avg_score:
          googleCount > 0 ? Math.round((googleScoreSum / googleCount) * 10) / 10 : null
      },
      failing_clients: driftRows.filter((r) => r.score < 100),
      total_clients_evaluated: driftRows.length,
      duration_ms: Date.now() - startTime
    };

    logger.info('🔎 drift-check summary', summary);

    // Best-effort persistence; ignore if table does not exist yet.
    const { error: insertError } = await supabase.from('drift_checks').insert({
      period_tag: period.tag,
      meta_avg_score: summary.meta.avg_score,
      google_avg_score: summary.google.avg_score,
      meta_clients: summary.meta.clients,
      google_clients: summary.google.clients,
      failing_count: summary.failing_clients.length,
      details: driftRows
    });
    if (insertError) {
      logger.warn('drift-check: could not persist (table missing or perms?)', {
        message: insertError.message
      });
    }

    return Response.json({ success: true, summary });
  } catch (error) {
    logger.error('drift-check failed', { error: error instanceof Error ? error.message : 'unknown' });
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
