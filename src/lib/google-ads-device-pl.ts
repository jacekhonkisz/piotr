/**
 * Polish labels for Google Ads device segment (device_view / segment.device).
 * Accepts API enums, numeric codes, or legacy English strings from older cache rows.
 *
 * Numeric codes follow `google.ads.googleads.v22.enums.DeviceEnum.Device` (proto):
 * UNSPECIFIED=0, UNKNOWN=1, MOBILE=2, TABLET=3, DESKTOP=4, OTHER=5, CONNECTED_TV=6.
 * The client library sometimes surfaces the enum as a number (e.g. 6) instead of
 * the string `CONNECTED_TV`, which previously leaked into the UI as "6".
 */

/** Coerce protobuf / JSON `segments.device` to a string token before label mapping. */
export function coerceGoogleAdsDeviceSegment(raw: unknown): string {
  if (raw == null || raw === '') return 'UNKNOWN';
  if (typeof raw === 'number' || typeof raw === 'bigint') return String(raw);
  if (typeof raw === 'boolean') return raw ? '1' : '0';
  if (typeof raw === 'string') return raw.trim();
  if (typeof raw === 'object' && raw !== null) {
    const o = raw as Record<string, unknown>;
    if (typeof o.name === 'string' && o.name.trim()) return o.name.trim();
    if (typeof o.device === 'string' && o.device.trim()) return o.device.trim();
    if (typeof o.type === 'string' && o.type.trim()) return o.type.trim();
    if (typeof o.type === 'number' || typeof o.type === 'bigint') return String(o.type);
  }
  const s = String(raw).trim();
  if (!s || s === '[object Object]') return 'UNKNOWN';
  return s;
}

export type GoogleAdsDevicePerfLike = {
  device?: string | null;
  deviceType?: string | null;
  spend?: number;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  conversionValue?: number;
  conversion_value?: number;
  ctr?: number;
  cpc?: number;
  roas?: number;
};

/** Merge rows that map to the same Polish device label (e.g. CTV from `6` vs `CONNECTED_TV` vs cache dupes). */
export function mergeGoogleAdsDevicePerformanceRows<T extends GoogleAdsDevicePerfLike>(rows: T[]) {
  type Out = T & {
    device: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    conversionValue: number;
    ctr: number;
    cpc: number;
    roas: number;
  };

  const map = new Map<
    string,
    { spend: number; impressions: number; clicks: number; conversions: number; conversionValue: number }
  >();

  for (const row of rows) {
    const label = googleAdsDeviceLabelPl(row.device ?? row.deviceType)
      .trim()
      .replace(/\s+/g, ' ');
    const spend = Number(row.spend) || 0;
    const impressions = Number(row.impressions) || 0;
    const clicks = Number(row.clicks) || 0;
    const conversions = Number(row.conversions) || 0;
    const conversionValue = Number(row.conversionValue ?? row.conversion_value) || 0;

    const cur = map.get(label);
    if (!cur) {
      map.set(label, { spend, impressions, clicks, conversions, conversionValue });
    } else {
      cur.spend += spend;
      cur.impressions += impressions;
      cur.clicks += clicks;
      cur.conversions += conversions;
      cur.conversionValue += conversionValue;
    }
  }

  return Array.from(map.entries())
    .map(([device, s]) => {
      const ctr = s.impressions > 0 ? (s.clicks / s.impressions) * 100 : 0;
      const cpc = s.clicks > 0 ? s.spend / s.clicks : 0;
      const roas = s.spend > 0 ? s.conversionValue / s.spend : 0;
      return {
        device,
        spend: s.spend,
        impressions: s.impressions,
        clicks: s.clicks,
        conversions: s.conversions,
        conversionValue: s.conversionValue,
        ctr,
        cpc,
        roas,
      } as Out;
    })
    .sort((a, b) => b.spend - a.spend);
}

export function googleAdsDeviceLabelPl(deviceType: unknown): string {
  if (deviceType == null) return 'Nieznane';
  const raw = coerceGoogleAdsDeviceSegment(deviceType);
  if (!raw) return 'Nieznane';

  const upper = raw.toUpperCase().replace(/[\s-]+/g, '_');

  const fromEnum: Record<string, string> = {
    MOBILE: 'Telefony komórkowe',
    DESKTOP: 'Komputery',
    TABLET: 'Tablety',
    CONNECTED_TV: 'Telewizory (CTV)',
    OTHER: 'Inne',
    UNKNOWN: 'Nieznane',
    UNSPECIFIED: 'Nieokreślone',
    // Proto numeric values (string form from API / JSON)
    '0': 'Nieokreślone',
    '1': 'Nieznane',
    '2': 'Telefony komórkowe',
    '3': 'Tablety',
    '4': 'Komputery',
    '5': 'Inne',
    '6': 'Telewizory (CTV)',
  };

  if (fromEnum[upper]) return fromEnum[upper];
  if (fromEnum[raw]) return fromEnum[raw];

  const en = raw.toLowerCase();
  const fromEn: Record<string, string> = {
    mobile: 'Telefony komórkowe',
    desktop: 'Komputery',
    tablet: 'Tablety',
    'connected tv': 'Telewizory (CTV)',
    other: 'Inne',
    unknown: 'Nieznane',
  };
  if (fromEn[en]) return fromEn[en];

  return raw;
}
