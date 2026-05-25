/**
 * Canonical Google Ads „E-mail” / „Telefon” counts for dashboards, cache, and reports.
 *
 * Source of truth: `GoogleAdsAPIService.getCampaignData` → `getConversionBreakdown` →
 * `parseGoogleAdsConversions` in `google-ads-actions-parser.ts` (all_conversions, strict
 * `isGoogleAdsEmailAddressClickConversion` / `isGoogleAdsPhoneOrCallConversion`).
 *
 * Use these helpers whenever reading Google rows (campaign JSON, summary rows, legacy DB
 * columns) so `email_contacts` / `click_to_call` win over `total_*` / `*_clicks` aliases.
 */

export function googleEmailContactsFromRow(r: Record<string, unknown> | null | undefined): number {
  if (!r || typeof r !== 'object') return 0;
  const v = r.email_contacts ?? r.total_email_clicks ?? r.email_clicks;
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

export function googlePhoneContactsFromRow(r: Record<string, unknown> | null | undefined): number {
  if (!r || typeof r !== 'object') return 0;
  const v = r.click_to_call ?? r.total_phone_clicks ?? r.phone_clicks;
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

export function sumGoogleEmailContactsFromCampaigns(campaigns: Array<Record<string, unknown>>): number {
  let s = 0;
  for (const c of campaigns) s += googleEmailContactsFromRow(c);
  return s;
}

export function sumGooglePhoneContactsFromCampaigns(campaigns: Array<Record<string, unknown>>): number {
  let s = 0;
  for (const c of campaigns) s += googlePhoneContactsFromRow(c);
  return s;
}
