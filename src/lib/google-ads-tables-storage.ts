/**
 * Helpers for reading and writing the persistent `google_ads_tables_data`
 * cache (one row per client + date range).
 *
 * The Google Ads data flow has several entry points (live API route,
 * monthly smart cache, weekly smart cache, historical `campaign_summaries`
 * loader, standardized fetcher, PDF generator). They all expect the same
 * `googleAdsTables` shape:
 *
 *   {
 *     networkPerformance,
 *     devicePerformance,
 *     keywordPerformance,
 *     searchTermPerformance,
 *     qualityMetrics,
 *     demographicPerformance,
 *     geographicPerformance,
 *   }
 *
 * Production DB column names use `network_performance`,
 * `keyword_performance`, and `quality_score_metrics`. This module
 * normalizes both directions so callers can stay agnostic of the
 * storage layout.
 *
 * Reading is cheap; the helper is safe to call even if the table is
 * empty for the requested period (returns `null`). Writes are best-effort
 * (`upsert`) so a transient DB failure never blocks the live response.
 */

import { createClient } from '@supabase/supabase-js';
import logger from './logger';
import type { GoogleAdsAPIService } from './google-ads-api';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface GoogleAdsTablesPayload {
  networkPerformance: any[];
  devicePerformance: any[];
  keywordPerformance: any[];
  searchTermPerformance: any[];
  qualityMetrics: any[];
  demographicPerformance: any[];
  geographicPerformance: any[];
}

export const EMPTY_GOOGLE_ADS_TABLES: GoogleAdsTablesPayload = {
  networkPerformance: [],
  devicePerformance: [],
  keywordPerformance: [],
  searchTermPerformance: [],
  qualityMetrics: [],
  demographicPerformance: [],
  geographicPerformance: [],
};

function toArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  return [];
}

/**
 * Returns true when at least one breakdown contains rows. Used by callers
 * that want to fall through to a live API call when the persisted row
 * exists but is entirely empty (e.g. stub written for a failed fetch).
 */
export function hasAnyGoogleAdsTablesRows(tables: GoogleAdsTablesPayload | null | undefined): boolean {
  if (!tables) return false;
  return (
    toArray((tables as any).networkPerformance).length > 0 ||
    toArray((tables as any).devicePerformance).length > 0 ||
    toArray((tables as any).keywordPerformance).length > 0 ||
    toArray((tables as any).searchTermPerformance).length > 0 ||
    toArray((tables as any).demographicPerformance).length > 0 ||
    toArray((tables as any).geographicPerformance).length > 0
  );
}

/**
 * Read the stored breakdowns for a (client, dateRange) pair. Returns
 * `null` when no row exists. Returns an empty-but-shaped object when the
 * row exists but contains no rows so callers can distinguish "never
 * fetched" from "fetched, no data".
 */
export async function loadGoogleAdsTablesFromDatabase(
  clientId: string,
  dateStart: string,
  dateEnd: string,
): Promise<GoogleAdsTablesPayload | null> {
  try {
    let { data, error } = await supabase
      .from('google_ads_tables_data')
      .select(
        'network_performance, device_performance, keyword_performance, search_term_performance, demographic_performance, geographic_performance, quality_score_metrics, last_updated',
      )
      .eq('client_id', clientId)
      .eq('date_range_start', dateStart)
      .eq('date_range_end', dateEnd)
      .maybeSingle();

    // Older production databases do not have search_term_performance yet.
    // Retry without it so the rest of the breakdowns still load.
    if (error?.message?.includes('search_term_performance')) {
      const fallback = await supabase
        .from('google_ads_tables_data')
        .select(
          'network_performance, device_performance, keyword_performance, demographic_performance, geographic_performance, quality_score_metrics, last_updated',
        )
        .eq('client_id', clientId)
        .eq('date_range_start', dateStart)
        .eq('date_range_end', dateEnd)
        .maybeSingle();
      data = fallback.data as typeof data;
      error = fallback.error;
    }

    if (error) {
      logger.warn('⚠️ google_ads_tables_data lookup failed', {
        clientId,
        dateStart,
        dateEnd,
        error: error.message,
      });
      return null;
    }

    if (!data) return null;

    const tables: GoogleAdsTablesPayload = {
      networkPerformance: toArray((data as any).network_performance),
      devicePerformance: toArray((data as any).device_performance),
      keywordPerformance: toArray((data as any).keyword_performance),
      searchTermPerformance: toArray((data as any).search_term_performance),
      qualityMetrics: toArray((data as any).quality_score_metrics),
      demographicPerformance: toArray((data as any).demographic_performance),
      geographicPerformance: toArray((data as any).geographic_performance),
    };

    logger.info('📦 google_ads_tables_data hit', {
      clientId,
      dateStart,
      dateEnd,
      counts: {
        networks: tables.networkPerformance.length,
        devices: tables.devicePerformance.length,
        keywords: tables.keywordPerformance.length,
        demographics: tables.demographicPerformance.length,
        regions: tables.geographicPerformance.length,
      },
    });

    return tables;
  } catch (err) {
    logger.warn('⚠️ google_ads_tables_data unexpected error', { err });
    return null;
  }
}

/**
 * Persist a fresh breakdown payload so subsequent loads (historical
 * lookups, /api/fetch-google-ads-tables, PDF generation) can skip the
 * live Google Ads API round trip.
 *
 * Best-effort: a write failure is logged but never thrown — the caller
 * already has the live payload to return to the UI.
 */
export async function persistGoogleAdsTables(
  clientId: string,
  dateStart: string,
  dateEnd: string,
  tables: GoogleAdsTablesPayload | null | undefined,
  _source: string = 'live_api',
): Promise<void> {
  if (!tables) return;

  try {
    const payload = {
      client_id: clientId,
      date_range_start: dateStart,
      date_range_end: dateEnd,
      network_performance: tables.networkPerformance as any,
      device_performance: tables.devicePerformance as any,
      keyword_performance: tables.keywordPerformance as any,
      search_term_performance: tables.searchTermPerformance as any,
      demographic_performance: tables.demographicPerformance as any,
      geographic_performance: tables.geographicPerformance as any,
      quality_score_metrics: tables.qualityMetrics as any,
      last_updated: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let { error } = await supabase
      .from('google_ads_tables_data')
      .upsert(payload, { onConflict: 'client_id,date_range_start,date_range_end' });

    if (error?.message?.includes('search_term_performance')) {
      const { search_term_performance: _searchTermPerformance, ...fallbackPayload } = payload;
      const fallback = await supabase
        .from('google_ads_tables_data')
        .upsert(fallbackPayload, { onConflict: 'client_id,date_range_start,date_range_end' });
      error = fallback.error;
    }

    if (error) {
      logger.warn('⚠️ persistGoogleAdsTables upsert failed', {
        clientId,
        dateStart,
        dateEnd,
        error: error.message,
      });
    } else {
      logger.info('💾 persistGoogleAdsTables stored breakdowns', {
        clientId,
        dateStart,
        dateEnd,
        counts: {
          networks: tables.networkPerformance.length,
          devices: tables.devicePerformance.length,
          keywords: tables.keywordPerformance.length,
          demographics: tables.demographicPerformance.length,
          regions: tables.geographicPerformance.length,
        },
      });
    }
  } catch (err) {
    logger.warn('⚠️ persistGoogleAdsTables unexpected error', { err });
  }
}

/**
 * Fetch breakdowns from the live Google Ads API and persist them in one
 * shot. Returns the normalized payload or null if the fetch fails so the
 * caller can decide whether to fall back to an empty payload.
 */
export async function fetchAndStoreGoogleAdsTables(
  googleAdsService: GoogleAdsAPIService,
  clientId: string,
  dateStart: string,
  dateEnd: string,
): Promise<GoogleAdsTablesPayload | null> {
  try {
    const raw = await googleAdsService.getGoogleAdsTables(dateStart, dateEnd);
    const tables: GoogleAdsTablesPayload = {
      networkPerformance: toArray((raw as any)?.networkPerformance),
      devicePerformance: toArray((raw as any)?.devicePerformance),
      keywordPerformance: toArray((raw as any)?.keywordPerformance),
      searchTermPerformance: toArray((raw as any)?.searchTermPerformance),
      qualityMetrics: toArray((raw as any)?.qualityMetrics),
      demographicPerformance: toArray((raw as any)?.demographicPerformance),
      geographicPerformance: toArray((raw as any)?.geographicPerformance),
    };

    await persistGoogleAdsTables(clientId, dateStart, dateEnd, tables);
    return tables;
  } catch (err) {
    logger.warn('⚠️ fetchAndStoreGoogleAdsTables failed', {
      clientId,
      dateStart,
      dateEnd,
      err: err instanceof Error ? err.message : err,
    });
    return null;
  }
}

/**
 * Normalize a `googleAdsTables`-shaped object that came from another
 * source (smart cache, live route, …) so consumers always see the full
 * payload shape and never need defensive `|| []` checks downstream.
 */
export function normalizeGoogleAdsTables(input: any): GoogleAdsTablesPayload {
  if (!input || typeof input !== 'object') return { ...EMPTY_GOOGLE_ADS_TABLES };
  return {
    networkPerformance: toArray(input.networkPerformance),
    devicePerformance: toArray(input.devicePerformance),
    keywordPerformance: toArray(input.keywordPerformance),
    searchTermPerformance: toArray(input.searchTermPerformance),
    qualityMetrics: toArray(input.qualityMetrics),
    demographicPerformance: toArray(input.demographicPerformance),
    geographicPerformance: toArray(input.geographicPerformance),
  };
}
