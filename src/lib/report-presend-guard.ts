/**
 * REPORT PRE-SEND GUARD
 *
 * Wraps a planned outgoing report payload in a final consistency check.
 *
 * For each (clientId, platform, dateRange) requested, the guard:
 *   1) Fetches a fresh live API baseline.
 *   2) Compares the candidate payload against the baseline.
 *   3) Returns a decision: allow | warn | block.
 *
 * Block reasons are logged so we have an audit trail of refused sends.
 */

import { fetchUnifiedReport } from './unified-report-fetcher';
import {
  CompareResult,
  DEFAULT_THRESHOLDS,
  ValidationThresholds,
  compareToBaseline
} from './report-payload-validator';
import { ReportPayload } from './report-metric-contract';
import logger from './logger';

export type GuardDecision = 'allow' | 'warn' | 'block';

export interface GuardResult {
  decision: GuardDecision;
  score: number;
  comparison: CompareResult | null;
  baselineSource: ReportPayload['source'] | null;
  reason: string;
}

export interface GuardOptions {
  thresholds?: ValidationThresholds;
  warnAtScore?: number;
  blockAtScore?: number;
  sessionToken?: string;
}

const DEFAULT_WARN_AT = 95;
const DEFAULT_BLOCK_AT = 85;

export async function evaluatePreSend(
  candidate: ReportPayload,
  options: GuardOptions = {}
): Promise<GuardResult> {
  const warnAt = options.warnAtScore ?? DEFAULT_WARN_AT;
  const blockAt = options.blockAtScore ?? DEFAULT_BLOCK_AT;
  const thresholds = options.thresholds ?? DEFAULT_THRESHOLDS;

  const baseline = await fetchUnifiedReport(
    {
      clientId: candidate.client_id,
      dateRange: candidate.date_range,
      platform: candidate.platform,
      reason: 'presend-guard',
      forceFresh: true
    },
    { sessionToken: options.sessionToken }
  );

  if (!baseline.success || !baseline.payload) {
    logger.warn('Pre-send guard: baseline unavailable, allowing send', {
      clientId: candidate.client_id,
      platform: candidate.platform
    });
    return {
      decision: 'allow',
      score: 0,
      comparison: null,
      baselineSource: null,
      reason: 'baseline_unavailable'
    };
  }

  const comparison = compareToBaseline(baseline.payload, candidate, thresholds);
  const score = comparison.score;

  let decision: GuardDecision = 'allow';
  if (score < blockAt) decision = 'block';
  else if (score < warnAt) decision = 'warn';

  if (decision !== 'allow') {
    logger.warn('Pre-send guard: report payload deviates from live baseline', {
      clientId: candidate.client_id,
      platform: candidate.platform,
      score,
      decision,
      failingMetrics: comparison.diffs.filter((d) => !d.pass).map((d) => d.metric)
    });
  }

  return {
    decision,
    score,
    comparison,
    baselineSource: baseline.source ?? null,
    reason: decision === 'allow'
      ? 'within_threshold'
      : decision === 'warn'
        ? 'score_below_warn_threshold'
        : 'score_below_block_threshold'
  };
}
