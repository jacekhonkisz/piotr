export type CanonicalConversionMetric =
  | 'booking_step_1'
  | 'booking_step_2'
  | 'booking_step_3'
  | 'click_to_call'
  | 'email_contacts'
  | 'reservations'
  | 'reservation_value';

export type PlatformConversionMappings = Partial<
  Record<CanonicalConversionMetric, string[]>
>;

export interface ClientConversionMappings {
  meta?: PlatformConversionMappings;
  google?: PlatformConversionMappings;
}

const CANONICAL_METRICS = new Set<CanonicalConversionMetric>([
  'booking_step_1',
  'booking_step_2',
  'booking_step_3',
  'click_to_call',
  'email_contacts',
  'reservations',
  'reservation_value',
]);

function normalizePlatformMappings(value: unknown): PlatformConversionMappings | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const normalized: PlatformConversionMappings = {};
  for (const [metric, actionTypes] of Object.entries(value)) {
    if (!CANONICAL_METRICS.has(metric as CanonicalConversionMetric)) continue;
    if (!Array.isArray(actionTypes)) continue;
    const cleaned = Array.from(
      new Set(
        actionTypes
          .map((actionType) => String(actionType || '').trim())
          .filter(Boolean)
      )
    );
    if (cleaned.length > 0) {
      normalized[metric as CanonicalConversionMetric] = cleaned;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

/** Validate untrusted JSON while preserving an empty object as “use defaults”. */
export function normalizeClientConversionMappings(value: unknown): ClientConversionMappings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const meta = normalizePlatformMappings(raw.meta);
  const google = normalizePlatformMappings(raw.google);
  return {
    ...(meta ? { meta } : {}),
    ...(google ? { google } : {}),
  };
}

export function getMappedActionTypes(
  mappings: ClientConversionMappings | undefined,
  platform: 'meta' | 'google',
  metric: CanonicalConversionMetric
): string[] | undefined {
  const values = mappings?.[platform]?.[metric];
  return values && values.length > 0 ? values : undefined;
}
