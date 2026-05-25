/**
 * REPORT PAYLOAD VALIDATOR
 *
 * Validates a ReportPayload against the metric contract and against an
 * optional baseline (typically a fresh live API payload).
 *
 * Used in:
 *  - test/audit scripts (today)
 *  - pre-send guard (next phase)
 */

import {
  ReportCoreMetrics,
  ReportConversionMetrics,
  ReportPayload
} from './report-metric-contract';

export interface ValidationIssue {
  code: string;
  message: string;
  metric?: string;
  severity: 'error' | 'warning';
}

export interface ValidationThresholds {
  spend_pct: number;
  impressions_pct: number;
  clicks_pct: number;
  conversions_abs: number;
  reservation_value_pct: number;
  ctr_abs: number;
  cpc_abs: number;
}

export const DEFAULT_THRESHOLDS: ValidationThresholds = {
  spend_pct: 1.0,
  impressions_pct: 1.0,
  clicks_pct: 1.0,
  conversions_abs: 1,
  reservation_value_pct: 2.0,
  ctr_abs: 0.05,
  cpc_abs: 0.05
};

function pctDiff(a: number, b: number): number {
  const denom = Math.max(Math.abs(a), Math.abs(b), 1);
  return (Math.abs(a - b) / denom) * 100;
}

function isNonNegativeNumber(n: any): boolean {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

export function validateContract(payload: ReportPayload): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (payload.contract_version !== 'v1') {
    issues.push({
      code: 'BAD_VERSION',
      message: `Expected contract v1, got ${payload.contract_version}`,
      severity: 'error'
    });
  }

  const checkBlock = (label: string, block: ReportCoreMetrics | ReportConversionMetrics) => {
    for (const [k, v] of Object.entries(block)) {
      if (!isNonNegativeNumber(v)) {
        issues.push({
          code: 'BAD_NUMERIC',
          metric: `${label}.${k}`,
          message: `Non-numeric or negative value for ${label}.${k}: ${v}`,
          severity: 'error'
        });
      }
    }
  };

  checkBlock('core', payload.core);
  checkBlock('conversion', payload.conversion);

  // Funnel sanity: warning only.
  if (
    payload.conversion.booking_step_1 > 0 &&
    payload.conversion.booking_step_2 > payload.conversion.booking_step_1
  ) {
    issues.push({
      code: 'FUNNEL_INVERSION',
      metric: 'booking_step_2',
      message: 'booking_step_2 > booking_step_1',
      severity: 'warning'
    });
  }
  if (
    payload.conversion.booking_step_2 > 0 &&
    payload.conversion.booking_step_3 > payload.conversion.booking_step_2
  ) {
    issues.push({
      code: 'FUNNEL_INVERSION',
      metric: 'booking_step_3',
      message: 'booking_step_3 > booking_step_2',
      severity: 'warning'
    });
  }
  if (
    payload.conversion.booking_step_3 > 0 &&
    payload.conversion.reservations > payload.conversion.booking_step_3
  ) {
    issues.push({
      code: 'FUNNEL_INVERSION',
      metric: 'reservations',
      message: 'reservations > booking_step_3',
      severity: 'warning'
    });
  }

  return issues;
}

export interface DiffResult {
  metric: string;
  baseline: number;
  observed: number;
  delta: number;
  pct: number;
  pass: boolean;
}

export interface CompareResult {
  passed: number;
  total: number;
  score: number;
  diffs: DiffResult[];
}

export function compareToBaseline(
  baseline: ReportPayload,
  observed: ReportPayload,
  thresholds: ValidationThresholds = DEFAULT_THRESHOLDS
): CompareResult {
  const diffs: DiffResult[] = [];

  const pctMetric = (label: string, b: number, o: number, threshold: number) => {
    const d = pctDiff(b, o);
    diffs.push({
      metric: label,
      baseline: b,
      observed: o,
      delta: o - b,
      pct: d,
      pass: d <= threshold
    });
  };

  const absMetric = (label: string, b: number, o: number, threshold: number) => {
    const delta = Math.abs(o - b);
    diffs.push({
      metric: label,
      baseline: b,
      observed: o,
      delta: o - b,
      pct: pctDiff(b, o),
      pass: delta <= threshold
    });
  };

  pctMetric('total_spend', baseline.core.total_spend, observed.core.total_spend, thresholds.spend_pct);
  pctMetric('total_impressions', baseline.core.total_impressions, observed.core.total_impressions, thresholds.impressions_pct);
  pctMetric('total_clicks', baseline.core.total_clicks, observed.core.total_clicks, thresholds.clicks_pct);
  absMetric('total_conversions', baseline.core.total_conversions, observed.core.total_conversions, thresholds.conversions_abs);
  absMetric('average_ctr', baseline.core.average_ctr, observed.core.average_ctr, thresholds.ctr_abs);
  absMetric('average_cpc', baseline.core.average_cpc, observed.core.average_cpc, thresholds.cpc_abs);

  absMetric('click_to_call', baseline.conversion.click_to_call, observed.conversion.click_to_call, thresholds.conversions_abs);
  absMetric('email_contacts', baseline.conversion.email_contacts, observed.conversion.email_contacts, thresholds.conversions_abs);
  absMetric('booking_step_1', baseline.conversion.booking_step_1, observed.conversion.booking_step_1, thresholds.conversions_abs);
  absMetric('booking_step_2', baseline.conversion.booking_step_2, observed.conversion.booking_step_2, thresholds.conversions_abs);
  absMetric('booking_step_3', baseline.conversion.booking_step_3, observed.conversion.booking_step_3, thresholds.conversions_abs);
  absMetric('reservations', baseline.conversion.reservations, observed.conversion.reservations, thresholds.conversions_abs);
  pctMetric('reservation_value', baseline.conversion.reservation_value, observed.conversion.reservation_value, thresholds.reservation_value_pct);
  pctMetric('roas', baseline.conversion.roas, observed.conversion.roas, thresholds.reservation_value_pct);
  pctMetric('cost_per_reservation', baseline.conversion.cost_per_reservation, observed.conversion.cost_per_reservation, thresholds.reservation_value_pct);

  const passed = diffs.filter((d) => d.pass).length;
  return {
    passed,
    total: diffs.length,
    score: diffs.length ? (passed / diffs.length) * 100 : 0,
    diffs
  };
}
