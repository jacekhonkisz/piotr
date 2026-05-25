/**
 * Google Ads: per–conversion-action aggregates for dynamic metric keys (dyn_google_*).
 * Shared by metrics discovery, live-data API, and metrics-snapshot.
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from '@/lib/google-ads-api';
import { stableGoogleDynamicKey } from '@/lib/dynamic-conversion-discovery';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type GoogleDynamicConversionRow = {
  id: string;
  label: string;
  key: string;
  count: number;
  value: number;
};

export async function fetchGoogleDynamicConversionRowsWithService(
  googleAdsService: GoogleAdsAPIService,
  dateStart: string,
  dateEnd: string
): Promise<{
  rows: GoogleDynamicConversionRow[];
  fetchOk: boolean;
  skipReason?: string;
}> {
  const agg = await googleAdsService.getAggregatedConversionActionsByName(dateStart, dateEnd);
  if (!agg.fetchOk) {
    return { rows: [], fetchOk: false, skipReason: agg.error || 'google_query_failed' };
  }

  const rows = agg.actions.map((a) => ({
    id: a.name,
    label: a.name,
    key: stableGoogleDynamicKey(a.name),
    count: a.conversions,
    value: a.value,
  }));

  return { rows, fetchOk: true };
}

export async function fetchGoogleDynamicConversionRows(
  clientId: string,
  dateStart: string,
  dateEnd: string
): Promise<{
  rows: GoogleDynamicConversionRow[];
  fetchOk: boolean;
  skipReason?: string;
}> {
  const { data: clientRow, error: clientErr } = await supabase
    .from('clients')
    .select('google_ads_enabled, google_ads_customer_id, google_ads_refresh_token')
    .eq('id', clientId)
    .single();

  if (clientErr || !clientRow?.google_ads_enabled || !clientRow?.google_ads_customer_id) {
    return { rows: [], fetchOk: true, skipReason: 'google_not_configured' };
  }

  const { data: settingsData, error: settingsError } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', [
      'google_ads_client_id',
      'google_ads_client_secret',
      'google_ads_developer_token',
      'google_ads_manager_refresh_token',
      'google_ads_manager_customer_id',
    ]);

  if (settingsError || !settingsData?.length) {
    return { rows: [], fetchOk: false, skipReason: 'google_system_settings_missing' };
  }

  const settings = settingsData.reduce(
    (acc: Record<string, string>, s: { key: string; value: string }) => {
      acc[s.key] = s.value;
      return acc;
    },
    {}
  );

  const refreshToken =
    settings.google_ads_manager_refresh_token || clientRow.google_ads_refresh_token;
  if (!refreshToken) {
    return { rows: [], fetchOk: false, skipReason: 'google_refresh_token_missing' };
  }

  const googleAdsService = new GoogleAdsAPIService({
    refreshToken,
    clientId: settings.google_ads_client_id ?? '',
    clientSecret: settings.google_ads_client_secret ?? '',
    developmentToken: settings.google_ads_developer_token ?? '',
    customerId: clientRow.google_ads_customer_id,
    managerCustomerId: settings.google_ads_manager_customer_id,
  });

  const validation = await googleAdsService.validateCredentials();
  if (!validation.valid) {
    return {
      rows: [],
      fetchOk: false,
      skipReason: validation.error || 'google_credentials_invalid',
    };
  }

  return fetchGoogleDynamicConversionRowsWithService(googleAdsService, dateStart, dateEnd);
}

export function googleDynamicRowsToMetricMap(rows: GoogleDynamicConversionRow[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const r of rows) {
    m[r.key] = r.count;
  }
  return m;
}
