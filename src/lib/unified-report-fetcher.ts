/**
 * UNIFIED REPORT FETCHER
 *
 * Single entry point for "give me a contract-conforming ReportPayload for
 * (clientId, dateRange, platform)".
 *
 * Source-selection policy:
 *   - period contains today  -> live API (matches dashboard expectations)
 *   - past period            -> stored campaign_summaries (canonical),
 *                              fallback to daily_kpi_aggregate, then live API
 *   - custom range           -> daily_kpi_aggregate, fallback to live API
 *
 * All consumers (PDF, email, scheduled jobs, admin tools) MUST use this
 * fetcher rather than re-implementing source selection.
 */

import { supabaseAdmin } from './supabase';
import type { Platform, ReportPayload } from './report-metric-contract';
import {
  adaptCampaignSummary,
  adaptDailyKpiAggregate,
  adaptGoogleLiveApi,
  adaptMetaLiveApi
} from './report-adapters';
import { validateContract, ValidationIssue } from './report-payload-validator';
import logger from './logger';

export type ReportPeriodKind = 'monthly' | 'weekly' | 'custom';

export interface UnifiedReportRequest {
  clientId: string;
  dateRange: { start: string; end: string };
  platform: Platform;
  reason: string;
  periodKind?: ReportPeriodKind;
  forceFresh?: boolean;
}

export interface UnifiedReportResult {
  success: boolean;
  payload?: ReportPayload;
  source?: ReportPayload['source'];
  validationIssues: ValidationIssue[];
  debug: {
    chain: string[];
    error?: string;
  };
}

function isCurrentPeriod(dateRange: { start: string; end: string }): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return dateRange.start <= today && today <= dateRange.end;
}

async function getClient(clientId: string): Promise<{ id: string; name: string } | null> {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from('clients')
    .select('id,name')
    .eq('id', clientId)
    .maybeSingle();
  return data ?? null;
}

async function tryStoredSummary(req: UnifiedReportRequest, clientName: string): Promise<ReportPayload | null> {
  if (!supabaseAdmin) return null;
  const summaryDate = req.dateRange.start;
  const { data } = await supabaseAdmin
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', req.clientId)
    .eq('platform', req.platform)
    .eq('summary_date', summaryDate)
    .maybeSingle();
  if (!data) return null;
  return adaptCampaignSummary({
    clientId: req.clientId,
    clientName,
    platform: req.platform,
    dateRange: req.dateRange,
    summary: data
  });
}

async function tryDailyKpi(req: UnifiedReportRequest, clientName: string): Promise<ReportPayload | null> {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from('daily_kpi_data')
    .select('*')
    .eq('client_id', req.clientId)
    .gte('date', req.dateRange.start)
    .lte('date', req.dateRange.end);
  if (!data || data.length === 0) return null;
  const filtered = req.platform === 'meta'
    ? data.filter((row: any) => !row.platform || row.platform === 'meta')
    : data.filter((row: any) => row.platform === 'google');
  if (!filtered.length) return null;
  return adaptDailyKpiAggregate({
    clientId: req.clientId,
    clientName,
    platform: req.platform,
    dateRange: req.dateRange,
    rows: filtered
  });
}

async function tryLiveApi(
  req: UnifiedReportRequest,
  clientName: string,
  sessionToken: string | undefined
): Promise<ReportPayload | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || 'http://localhost:3000';
  const endpoint = req.platform === 'meta'
    ? `${baseUrl}/api/fetch-live-data`
    : `${baseUrl}/api/fetch-google-ads-live-data`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;

  const body: Record<string, unknown> = {
    clientId: req.clientId,
    dateRange: req.dateRange,
    reason: req.reason
  };
  if (req.platform === 'meta') {
    body.platform = 'meta';
    if (req.forceFresh) {
      body.forceFresh = true;
      body.bypassAllCache = true;
    }
  } else if (req.forceFresh) {
    body.forceFresh = true;
    body.bypassAllCache = true;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) return null;
  const json = await response.json().catch(() => null);
  if (!json?.success || !json?.data) return null;

  if (req.platform === 'meta') {
    return adaptMetaLiveApi({
      clientId: req.clientId,
      clientName,
      dateRange: req.dateRange,
      campaigns: json.data.campaigns || [],
      accountInsights: json.data.accountInsights
    });
  }
  return adaptGoogleLiveApi({
    clientId: req.clientId,
    clientName,
    dateRange: req.dateRange,
    stats: json.data.stats,
    conversionMetrics: json.data.conversionMetrics
  });
}

export async function fetchUnifiedReport(
  req: UnifiedReportRequest,
  options: { sessionToken?: string } = {}
): Promise<UnifiedReportResult> {
  const chain: string[] = [];
  try {
    const client = await getClient(req.clientId);
    if (!client) {
      return {
        success: false,
        validationIssues: [],
        debug: { chain, error: 'client_not_found' }
      };
    }

    const isCurrent = isCurrentPeriod(req.dateRange);
    const periodKind: ReportPeriodKind = req.periodKind ?? 'monthly';
    const order: Array<'live' | 'summary' | 'daily'> =
      req.forceFresh
        ? ['live', 'summary', 'daily']
        : isCurrent
          ? ['live', 'summary', 'daily']
          : periodKind === 'custom'
            ? ['daily', 'summary', 'live']
            : ['summary', 'daily', 'live'];

    let payload: ReportPayload | null = null;
    for (const step of order) {
      chain.push(step);
      if (step === 'live') {
        payload = await tryLiveApi(req, client.name, options.sessionToken);
      } else if (step === 'summary') {
        payload = await tryStoredSummary(req, client.name);
      } else {
        payload = await tryDailyKpi(req, client.name);
      }
      if (payload) break;
    }

    if (!payload) {
      return {
        success: false,
        validationIssues: [],
        debug: { chain, error: 'no_source_returned_data' }
      };
    }

    const issues = validateContract(payload);
    if (issues.some((i) => i.severity === 'error')) {
      logger.warn('UnifiedReportFetcher: contract validation errors', {
        clientId: req.clientId,
        platform: req.platform,
        issues
      });
    }

    return {
      success: true,
      payload,
      source: payload.source,
      validationIssues: issues,
      debug: { chain }
    };
  } catch (error) {
    return {
      success: false,
      validationIssues: [],
      debug: { chain, error: error instanceof Error ? error.message : 'unknown_error' }
    };
  }
}
