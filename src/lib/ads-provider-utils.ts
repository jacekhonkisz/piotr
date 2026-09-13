export type AdsProvider = 'meta' | 'google';

export interface ClientAdsConfig {
  meta_access_token?: string | null;
  ad_account_id?: string | null;
  google_ads_enabled?: boolean | null;
  google_ads_customer_id?: string | null;
}

/** Display flags from client_dashboard_config. Missing/true = show if connected. */
export interface ReportPlatformFlags {
  metaEnabled?: boolean | null;
  googleEnabled?: boolean | null;
}

export const DEFAULT_REPORT_PLATFORM_FLAGS: Required<Pick<ReportPlatformFlags, 'metaEnabled' | 'googleEnabled'>> = {
  metaEnabled: true,
  googleEnabled: true,
};

export function hasMetaAds(
  client: ClientAdsConfig | null | undefined,
  flags?: ReportPlatformFlags | null
): boolean {
  if (!(client?.meta_access_token && client?.ad_account_id)) return false;
  if (flags?.metaEnabled === false) return false;
  return true;
}

export function hasGoogleAds(
  client: ClientAdsConfig | null | undefined,
  flags?: ReportPlatformFlags | null
): boolean {
  if (!(client?.google_ads_enabled && client?.google_ads_customer_id)) return false;
  if (flags?.googleEnabled === false) return false;
  return true;
}

/** Prefer Google when it is both connected and visible in reports; otherwise Meta. */
export function getDefaultAdsProvider(
  client: ClientAdsConfig | null | undefined,
  flags?: ReportPlatformFlags | null
): AdsProvider {
  if (hasGoogleAds(client, flags)) return 'google';
  if (hasMetaAds(client, flags)) return 'meta';
  return 'meta';
}

type DashboardConfigReader = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{
          data: { meta_enabled?: boolean | null; google_enabled?: boolean | null } | null;
        }>;
      };
    };
  };
};

export async function getClientReportPlatformFlags(
  supabase: DashboardConfigReader,
  clientId: string
): Promise<Required<Pick<ReportPlatformFlags, 'metaEnabled' | 'googleEnabled'>>> {
  const { data } = await supabase
    .from('client_dashboard_config')
    .select('meta_enabled, google_enabled')
    .eq('client_id', clientId)
    .maybeSingle();

  return {
    metaEnabled: data?.meta_enabled ?? true,
    googleEnabled: data?.google_enabled ?? true,
  };
}
