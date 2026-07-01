/**
 * Client Data Initializer
 *
 * Orchestrates the "make the portal ready" work that runs right after a new
 * client is created (or when an admin re-triggers it):
 *
 *   1. Warm the CURRENT period smart caches (month + week) so the dashboard the
 *      client first sees is populated instead of showing all zeros.
 *   2. Collect HISTORICAL monthly + weekly summaries (last ~12 months / 53 weeks)
 *      used for period comparisons.
 *
 * It also exposes progress so the admin UI can monitor when the portal is ready.
 * Live progress (phases/errors) is kept in an in-process registry, while the
 * authoritative "ready" signal is always derived from what is actually stored in
 * the database, so the status is correct even after a server restart.
 */

import { createClient } from '@supabase/supabase-js';
import logger from './logger';
import { getSmartCacheData, getSmartWeekCacheData } from './smart-cache-helper';
import {
  getGoogleAdsSmartCacheData,
  getGoogleAdsSmartWeekCacheData,
} from './google-ads-smart-cache-helper';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type InitPhase =
  | 'pending'
  | 'current_period'
  | 'historical'
  | 'completed'
  | 'failed';

export interface ClientInitJob {
  clientId: string;
  phase: InitPhase;
  startedAt: string;
  finishedAt?: string;
  steps: {
    currentMonth: StepState;
    currentWeek: StepState;
    historicalMonthly: StepState;
    historicalWeekly: StepState;
  };
  errors: string[];
}

type StepStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped';
interface StepState {
  status: StepStatus;
  detail?: string;
}

// In-process registry of running/finished initialization jobs.
// Survives the lifetime of the server process (good enough for live monitoring);
// the DB-derived readiness below is the source of truth across restarts.
const jobs = new Map<string, ClientInitJob>();

function newJob(clientId: string): ClientInitJob {
  return {
    clientId,
    phase: 'pending',
    startedAt: new Date().toISOString(),
    steps: {
      currentMonth: { status: 'pending' },
      currentWeek: { status: 'pending' },
      historicalMonthly: { status: 'pending' },
      historicalWeekly: { status: 'pending' },
    },
    errors: [],
  };
}

export function getInitializationJob(clientId: string): ClientInitJob | null {
  return jobs.get(clientId) || null;
}

function getCurrentPeriodIds() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthPeriodId = `${year}-${String(month).padStart(2, '0')}`;
  return { monthPeriodId };
}

interface ClientPlatformInfo {
  id: string;
  name: string;
  hasMeta: boolean;
  hasGoogle: boolean;
  reportingFrequency: string;
}

async function loadClientPlatformInfo(clientId: string): Promise<ClientPlatformInfo | null> {
  const { data: client, error } = await supabase
    .from('clients')
    .select(
      'id, name, ad_account_id, meta_access_token, system_user_token, google_ads_enabled, google_ads_customer_id, reporting_frequency'
    )
    .eq('id', clientId)
    .single();

  if (error || !client) {
    return null;
  }

  const hasMeta = !!(
    client.ad_account_id &&
    ((client as any).system_user_token || client.meta_access_token)
  );
  const hasGoogle = !!(client.google_ads_enabled && client.google_ads_customer_id);

  return {
    id: client.id,
    name: client.name,
    hasMeta,
    hasGoogle,
    reportingFrequency: (client.reporting_frequency as string) || 'monthly',
  };
}

/** Phase 1: warm the current period so the portal is immediately usable. */
async function runCurrentPeriodPhase(job: ClientInitJob, info: ClientPlatformInfo): Promise<void> {
  job.phase = 'current_period';

  await runStep(job.steps.currentMonth, async () => {
    const details: string[] = [];
    if (info.hasMeta) {
      await getSmartCacheData(info.id, true, 'meta');
      details.push('meta');
    }
    if (info.hasGoogle) {
      await getGoogleAdsSmartCacheData(info.id, true);
      details.push('google');
    }
    if (details.length === 0) {
      throw new Error('No configured platforms');
    }
    return details.join(' + ');
  }, job);

  // Current week only matters when the client reports weekly.
  if (info.reportingFrequency === 'weekly') {
    await runStep(job.steps.currentWeek, async () => {
      const details: string[] = [];
      if (info.hasMeta) {
        await getSmartWeekCacheData(info.id, true);
        details.push('meta');
      }
      if (info.hasGoogle) {
        await getGoogleAdsSmartWeekCacheData(info.id, true);
        details.push('google');
      }
      return details.join(' + ');
    }, job);
  } else {
    job.steps.currentWeek = { status: 'skipped', detail: 'not a weekly client' };
  }
}

/** Phase 2: collect historical summaries used for period comparisons. */
async function runHistoricalPhase(job: ClientInitJob): Promise<void> {
  job.phase = 'historical';

  try {
    const { BackgroundDataCollector } = await import('./background-data-collector');
    const collector = BackgroundDataCollector.getInstance();

    await runStep(job.steps.historicalMonthly, async () => {
      await collector.collectMonthlySummariesForSingleClient(job.clientId);
      return 'last 12 months';
    }, job);

    await runStep(job.steps.historicalWeekly, async () => {
      await collector.collectWeeklySummariesForSingleClient(job.clientId);
      return 'last 53 weeks';
    }, job);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    job.errors.push(`Historical collection failed to start: ${msg}`);
    job.steps.historicalMonthly.status = 'error';
    job.steps.historicalWeekly.status = 'error';
    logger.error(`❌ [init] Historical collection failed for ${job.clientId}:`, error);
  }
}

function finalizeJob(job: ClientInitJob, name: string): void {
  const failed = Object.values(job.steps).some((s) => s.status === 'error');
  job.phase = failed ? 'failed' : 'completed';
  job.finishedAt = new Date().toISOString();

  logger.info(`✅ [init] Data initialization finished for ${name} (${job.clientId})`, {
    phase: job.phase,
    errors: job.errors,
  });
}

/**
 * Run the full initialization for a single client. Resolves only when all work
 * has finished (callers that don't want to wait should not await this).
 */
export async function initializeClientData(clientId: string): Promise<ClientInitJob> {
  const job = newJob(clientId);
  jobs.set(clientId, job);

  const info = await loadClientPlatformInfo(clientId);
  if (!info) {
    job.phase = 'failed';
    job.finishedAt = new Date().toISOString();
    job.errors.push('Client not found');
    return job;
  }

  logger.info(`🚀 [init] Starting data initialization for ${info.name} (${clientId})`, {
    hasMeta: info.hasMeta,
    hasGoogle: info.hasGoogle,
    frequency: info.reportingFrequency,
  });

  await runCurrentPeriodPhase(job, info);
  await runHistoricalPhase(job);
  finalizeJob(job, info.name);

  return job;
}

/**
 * Reliable variant for the new-client request path on serverless: AWAIT the
 * current-period warm (so the dashboard's default view is guaranteed populated
 * before we respond), then kick off the slower historical backfill without
 * blocking. The weekly `collect-*-summaries` crons act as a backstop if the
 * backgrounded historical phase is cut short by the runtime.
 */
export async function initializeCurrentPeriodThenBackfill(clientId: string): Promise<ClientInitJob> {
  const job = newJob(clientId);
  jobs.set(clientId, job);

  const info = await loadClientPlatformInfo(clientId);
  if (!info) {
    job.phase = 'failed';
    job.finishedAt = new Date().toISOString();
    job.errors.push('Client not found');
    return job;
  }

  logger.info(`🚀 [init] Warming current period for ${info.name} (${clientId})`, {
    hasMeta: info.hasMeta,
    hasGoogle: info.hasGoogle,
    frequency: info.reportingFrequency,
  });

  // Awaited: the portal's default (current) period must be ready on return.
  await runCurrentPeriodPhase(job, info);

  // Not awaited: historical comparisons can fill in afterwards / via cron.
  runHistoricalPhase(job)
    .then(() => finalizeJob(job, info.name))
    .catch((error) => {
      logger.error(`❌ [init] Background historical phase failed for ${clientId}:`, error);
    });

  return job;
}

async function runStep(
  step: StepState,
  fn: () => Promise<string | void>,
  job: ClientInitJob
): Promise<void> {
  step.status = 'running';
  try {
    const detail = await fn();
    step.status = 'done';
    if (detail) step.detail = detail;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    step.status = 'error';
    step.detail = msg;
    job.errors.push(msg);
    logger.warn(`⚠️ [init] Step failed for ${job.clientId}: ${msg}`);
  }
}

export interface ClientDataReadiness {
  ready: boolean;
  currentMonthReady: boolean;
  platforms: { meta: boolean; google: boolean };
  currentMonth: { meta: boolean; google: boolean };
  historical: { monthlySummaries: number; weeklySummaries: number };
}

/**
 * Derive readiness from what is actually stored in the database. This is the
 * authoritative "is the portal ready?" signal.
 */
export async function computeClientDataReadiness(clientId: string): Promise<ClientDataReadiness> {
  const { monthPeriodId } = getCurrentPeriodIds();

  const info = await loadClientPlatformInfo(clientId);
  const hasMeta = info?.hasMeta ?? false;
  const hasGoogle = info?.hasGoogle ?? false;

  // Current-period caches (these power the dashboard's default view)
  const [metaMonthRes, googleMonthRes, monthlyCountRes, weeklyCountRes] = await Promise.all([
    hasMeta
      ? supabase
          .from('current_month_cache')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .eq('period_id', monthPeriodId)
      : Promise.resolve({ count: 0 } as any),
    hasGoogle
      ? supabase
          .from('google_ads_current_month_cache')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .eq('period_id', monthPeriodId)
      : Promise.resolve({ count: 0 } as any),
    supabase
      .from('campaign_summaries')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('summary_type', 'monthly'),
    supabase
      .from('campaign_summaries')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('summary_type', 'weekly'),
  ]);

  const metaCurrentMonth = hasMeta ? (metaMonthRes.count || 0) > 0 : true;
  const googleCurrentMonth = hasGoogle ? (googleMonthRes.count || 0) > 0 : true;
  const currentMonthReady = metaCurrentMonth && googleCurrentMonth && (hasMeta || hasGoogle);

  return {
    ready: currentMonthReady,
    currentMonthReady,
    platforms: { meta: hasMeta, google: hasGoogle },
    currentMonth: {
      meta: hasMeta ? (metaMonthRes.count || 0) > 0 : false,
      google: hasGoogle ? (googleMonthRes.count || 0) > 0 : false,
    },
    historical: {
      monthlySummaries: monthlyCountRes.count || 0,
      weeklySummaries: weeklyCountRes.count || 0,
    },
  };
}

export interface ClientDataStatus extends ClientDataReadiness {
  job: ClientInitJob | null;
  // High-level status the UI can display directly.
  status: 'not_started' | 'collecting' | 'ready' | 'failed';
  message: string;
}

export async function getClientDataStatus(clientId: string): Promise<ClientDataStatus> {
  const [readiness, job] = await Promise.all([
    computeClientDataReadiness(clientId),
    Promise.resolve(getInitializationJob(clientId)),
  ]);

  let status: ClientDataStatus['status'];
  let message: string;

  if (readiness.ready) {
    status = 'ready';
    message = 'Portal gotowy – dane bieżącego okresu są dostępne.';
  } else if (job && (job.phase === 'current_period' || job.phase === 'historical' || job.phase === 'pending')) {
    status = 'collecting';
    message =
      job.phase === 'historical'
        ? 'Pobieranie danych historycznych...'
        : 'Przygotowywanie danych bieżącego okresu...';
  } else if (job && job.phase === 'failed') {
    status = 'failed';
    message = job.errors[0] || 'Inicjalizacja danych nie powiodła się.';
  } else {
    status = 'not_started';
    message = 'Zbieranie danych nie zostało jeszcze uruchomione.';
  }

  return { ...readiness, job, status, message };
}
