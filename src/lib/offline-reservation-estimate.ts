/**
 * Offline reservation estimate (20% rule) — single place for business logic.
 *
 * ## Default (all clients except Belmonte)
 * Micro total = Google + Meta: **phone clicks + email clicks only** (form submits / booking_step_1 are excluded).
 *
 * ## Belmonte-only exception (matched by client **name** `/belmonte/i`)
 * **Google Ads** micro-conversions are **not** included. Meta-only.
 *
 * ### Source of truth (Meta Ads Manager campaign export)
 * Offline micro pool = **sum of the two “PBM” custom conversion columns** (spreadsheet cols I + K),
 * i.e. specific `offsite_conversion.custom.<pixel_event_id>` rows in Insights `actions[]` — **not**
 * `booking_step_1` (omni_search volume), **not** combined Google+Meta.
 *
 * Default pair (Belmonte account; verify in Events Manager / export):
 * - Col I–style: `offsite_conversion.custom.627242345844289`
 * - Col K–style: `offsite_conversion.custom.543726880630162` (sum matched 5 vs export in audit)
 *
 * Override without code deploy: `BELMONTE_OFFLINE_MICRO_ACTION_TYPES` = comma-separated full `action_type` strings.
 *
 * ### Belmonte offline **value** (Piotr model)
 * Uses **10 × average online reservation value**, not `round(20% × micro) × avg`.
 *
 * All other clients: Google + Meta contact micros (email, phone) per platform — forms excluded.
 */
export function isBelmonteClient(clientName: string): boolean {
  return /belmonte/i.test((clientName || '').trim());
}

/** Meta `action_type` strings for Belmonte PBM micro columns (I + K) — see module docstring. */
export function getBelmonteOfflineMicroActionTypes(): string[] {
  const raw = (typeof process !== 'undefined' && process.env?.BELMONTE_OFFLINE_MICRO_ACTION_TYPES)?.trim();
  if (raw) {
    return raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }
  return [
    'offsite_conversion.custom.627242345844289',
    'offsite_conversion.custom.543726880630162'
  ];
}

/**
 * Sum PBM offline micro conversions from Meta campaign insights rows (must include `actions[]`).
 * Matches Ads Manager export columns I + K when action_type IDs are configured correctly.
 */
export function sumBelmonteOfflineMicroFromMetaCampaigns(campaigns: any[]): number {
  if (!Array.isArray(campaigns) || campaigns.length === 0) return 0;
  const want = new Set(getBelmonteOfflineMicroActionTypes());
  let total = 0;
  for (const c of campaigns) {
    const actions = c.actions;
    if (!Array.isArray(actions)) continue;
    for (const a of actions) {
      const t = String(a.action_type || '').toLowerCase();
      if (want.has(t)) {
        const v = parseInt(String(a.value || '0'), 10);
        if (!isNaN(v) && v >= 0) total += v;
      }
    }
  }
  return total;
}

/**
 * Potential offline **value** for Belmonte: 10 × average online reservation value (PLN).
 * Aligns with manual audit: ~38k when avg ≈ 3.8k and online value 235k / 60 purchases.
 */
export function getBelmontePotentialOfflineValue(averageReservationValue: number): number {
  const avg = Number(averageReservationValue) || 0;
  return 10 * avg;
}

export type OfflineMicroParts = {
  /** Ignored in offline totals (forms excluded). */
  googleFormSubmits: number;
  googleEmail: number;
  googlePhone: number;
  /** Ignored in offline totals (forms excluded). */
  metaFormSubmits: number;
  metaEmail: number;
  metaPhone: number;
};

export type PlatformConversionMetrics = {
  booking_step_1?: number;
  email_contacts?: number;
  click_to_call?: number;
};

/**
 * Build micro parts from per-platform conversion metrics (same shape as StandardizedDataFetcher).
 * Form submits are not used in the offline micro total (always 0 here).
 */
export function offlineMicroPartsFromPlatformMetrics(
  google: PlatformConversionMetrics | null | undefined,
  meta: PlatformConversionMetrics | null | undefined
): OfflineMicroParts {
  const g = google || {};
  const m = meta || {};
  return {
    googleFormSubmits: 0,
    googleEmail: Number(g.email_contacts) || 0,
    googlePhone: Number(g.click_to_call) || 0,
    metaFormSubmits: 0,
    metaEmail: Number(m.email_contacts) || 0,
    metaPhone: Number(m.click_to_call) || 0
  };
}

/**
 * Sum micro fields from campaign rows when `platform` is present (`google` | `meta`).
 * Rows without `platform` are treated as Meta (common for legacy Meta-only feeds).
 */
export function offlineMicroPartsFromCampaigns(campaigns: any[]): OfflineMicroParts {
  const google = campaigns.filter((c) => String(c.platform || '').toLowerCase() === 'google');
  const meta = campaigns.filter((c) => String(c.platform || '').toLowerCase() === 'meta');
  const other = campaigns.filter((c) => {
    const p = String(c.platform || '').toLowerCase();
    return p !== 'google' && p !== 'meta';
  });

  const sumRows = (rows: any[]) =>
    rows.reduce(
      (acc, c) => ({
        email: acc.email + (Number(c.email_contacts) || 0),
        phone: acc.phone + (Number(c.click_to_call) || 0)
      }),
      { email: 0, phone: 0 }
    );

  const g = sumRows(google);
  const m = sumRows(meta);
  const o = sumRows(other);

  return {
    googleFormSubmits: 0,
    googleEmail: g.email,
    googlePhone: g.phone,
    metaFormSubmits: 0,
    metaEmail: m.email + o.email,
    metaPhone: m.phone + o.phone
  };
}

export type OfflineModelOptions = {
  /** Meta campaign rows with raw `actions[]` (Insights). Required for Belmonte PBM I+K totals. */
  metaCampaigns?: any[] | null;
};

/**
 * Total micro conversions used for Math.round(x * 0.2) offline reservation estimate.
 * Belmonte: prefer sum of configured PBM custom `action_type`s on `metaCampaigns`; fallback email+phone.
 */
export function getMicroConversionsForOfflineModel(
  clientName: string,
  parts: OfflineMicroParts,
  options?: OfflineModelOptions
): number {
  const gEmail = Number(parts.googleEmail) || 0;
  const gPhone = Number(parts.googlePhone) || 0;
  const mEmail = Number(parts.metaEmail) || 0;
  const mPhone = Number(parts.metaPhone) || 0;

  if (isBelmonteClient(clientName)) {
    const fromActions = sumBelmonteOfflineMicroFromMetaCampaigns(options?.metaCampaigns || []);
    if (fromActions > 0) {
      return fromActions;
    }
    return mEmail + mPhone;
  }
  return gEmail + gPhone + mEmail + mPhone;
}
