export type AdsProvider = 'meta' | 'google';

export interface ClientAdsConfig {
  meta_access_token?: string | null;
  ad_account_id?: string | null;
  google_ads_enabled?: boolean | null;
  google_ads_customer_id?: string | null;
}

export function hasMetaAds(client: ClientAdsConfig | null | undefined): boolean {
  return !!(client?.meta_access_token && client?.ad_account_id);
}

export function hasGoogleAds(client: ClientAdsConfig | null | undefined): boolean {
  return !!(client?.google_ads_enabled && client?.google_ads_customer_id);
}

/** Prefer Google when configured; otherwise Meta. */
export function getDefaultAdsProvider(client: ClientAdsConfig | null | undefined): AdsProvider {
  if (hasGoogleAds(client)) return 'google';
  if (hasMetaAds(client)) return 'meta';
  return 'meta';
}
