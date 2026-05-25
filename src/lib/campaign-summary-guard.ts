const SPEND_THRESHOLD = 1;
const IMPRESSIONS_THRESHOLD = 10;

export type MetaSummaryTotals = {
  spend?: number;
  impressions?: number;
  clicks?: number;
};

export type MetaSummaryWritePayload = {
  totals: MetaSummaryTotals;
  campaigns?: unknown;
  /** Campaign rows returned by Meta insights for the period (0 = API empty). */
  liveApiCampaignCount?: number;
};

export type MetaSummaryGuardResult = {
  allowed: boolean;
  reason: string;
  markers: string[];
};

/** Detect populate-script / placeholder campaign rows. */
export function detectSyntheticCampaignMarkers(campaignData: unknown): string[] {
  const markers: string[] = [];
  if (!Array.isArray(campaignData) || campaignData.length === 0) {
    return markers;
  }

  const names = campaignData.map((c) =>
    String((c as Record<string, unknown>).campaign_name || (c as Record<string, unknown>).campaignName || '')
  );
  const ids = campaignData.map((c) =>
    String((c as Record<string, unknown>).campaign_id || (c as Record<string, unknown>).campaignId || '')
  );

  if (names.some((n) => / - Campaign \d+$/i.test(n))) {
    markers.push('generic_campaign_names');
  }
  if (ids.some((id) => id.startsWith('campaign_'))) {
    markers.push('synthetic_campaign_ids');
  }
  if (campaignData.length <= 4 && names.length > 0 && names.every((n) => /Campaign \d/i.test(n))) {
    markers.push('likely_populate_script');
  }

  return markers;
}

/** Meta campaign IDs from Graph API are numeric (typically 15+ digits). */
export function isRealMetaCampaignId(campaignId: unknown): boolean {
  const raw = String(campaignId ?? '').trim();
  if (!raw || raw.startsWith('campaign_')) return false;
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 10 && digits === raw.replace(/[^0-9]/g, '');
}

function hasMeaningfulTotals(totals: MetaSummaryTotals): boolean {
  const spend = Number(totals.spend || 0);
  const impressions = Number(totals.impressions || 0);
  return spend > SPEND_THRESHOLD || impressions > IMPRESSIONS_THRESHOLD;
}

/**
 * Refuse to persist Meta monthly/weekly summaries when live API had no insights
 * but payloads still carry synthetic placeholder campaigns or non-zero totals.
 */
export function validateMetaCampaignSummaryWrite(
  payload: MetaSummaryWritePayload
): MetaSummaryGuardResult {
  const campaigns = Array.isArray(payload.campaigns) ? payload.campaigns : [];
  const markers = detectSyntheticCampaignMarkers(campaigns);
  const liveCount =
    payload.liveApiCampaignCount !== undefined ? payload.liveApiCampaignCount : campaigns.length;
  const liveApiEmpty = liveCount === 0;
  const totals = payload.totals || {};
  const meaningfulTotals = hasMeaningfulTotals(totals);
  const hasRealCampaignId = campaigns.some((c) =>
    isRealMetaCampaignId(
      (c as Record<string, unknown>).campaign_id || (c as Record<string, unknown>).campaignId
    )
  );

  if (meaningfulTotals && liveApiEmpty) {
    return {
      allowed: false,
      reason: 'live_meta_api_empty_with_nonzero_totals',
      markers,
    };
  }

  if (meaningfulTotals && markers.length > 0 && !hasRealCampaignId) {
    return {
      allowed: false,
      reason: 'synthetic_campaign_data_without_real_meta_ids',
      markers,
    };
  }

  if (meaningfulTotals && liveApiEmpty && markers.length > 0) {
    return {
      allowed: false,
      reason: 'phantom_period_synthetic_and_empty_api',
      markers,
    };
  }

  return { allowed: true, reason: 'ok', markers };
}

export function logBlockedMetaSummaryWrite(
  context: string,
  clientId: string,
  summaryDate: string,
  result: MetaSummaryGuardResult
): void {
  console.warn(
    `[campaign-summary-guard] Blocked Meta campaign_summaries write (${context})`,
    { clientId, summaryDate, reason: result.reason, markers: result.markers }
  );
}
