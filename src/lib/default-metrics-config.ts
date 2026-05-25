import {
  REGISTRY_DIMENSIONS,
  REGISTRY_METRICS,
  getRegistryKeysForDiscovery,
  type MetricSection,
  type MetricPlatform,
  type RegistryFieldFormat,
  getRegistryField,
} from './metric-registry';

export type { MetricSection } from './metric-registry';
export type MetricFormat = RegistryFieldFormat;

export interface MetricConfigItem {
  key: string;
  section: MetricSection;
  defaultName: string;
  customName: string | null;
  visible: boolean;
  order: number;
  format: MetricFormat;
  description: string;
}

// ── Master list of every fetchable metric ──────────────────
interface MetricDef {
  key: string;
  defaultName: string;
  format: MetricFormat;
  description: string;
}

const ALL_METRICS: MetricDef[] = REGISTRY_METRICS.map((field) => ({
  key: field.key,
  defaultName: field.label,
  format: field.format,
  description: field.description,
}));

/** Keys used by `/api/metrics-config/discovery` to list the full catalog. */
export const ALL_METRIC_KEYS_FOR_DISCOVERY: string[] = getRegistryKeysForDiscovery();

// Which metrics are visible by default in each section
const DEFAULT_VISIBLE: Record<MetricSection, Set<string>> = {
  kpi_cards:       new Set(['totalSpend', 'totalImpressions', 'totalClicks']),
  charts:          new Set(['booking_step_1', 'reservations', 'reservation_value']),
  funnel:          new Set(['booking_step_1', 'booking_step_2', 'booking_step_3', 'reservations', 'reservation_value', 'total_conversion_value', 'roas']),
  contact:         new Set(['click_to_call', 'email_contacts', 'reservations', 'total_conversion_value', 'offline_reservations', 'offline_value', 'total_value_with_offline', 'cost_percentage', 'cost_per_reservation']),
  report_summary:  new Set(['totalSpend', 'totalImpressions', 'totalClicks', 'averageCtr', 'averageCpc', 'reservations', 'reservation_value', 'total_conversion_value', 'roas']),
  campaign_table:  new Set(['campaign_name', 'totalSpend', 'totalImpressions', 'totalClicks', 'totalConversions', 'averageCtr', 'averageCpc', 'reservations', 'reservation_value', 'roas']),
  placement_table: new Set(['placement', 'totalSpend', 'totalImpressions', 'totalClicks', 'averageCtr', 'averageCpc', 'reservations', 'reservation_value']),
  demographic_breakdown: new Set(['age', 'gender', 'totalSpend', 'totalImpressions', 'totalClicks', 'averageCtr', 'averageCpc', 'reservations', 'reservation_value', 'roas']),
  geographic_map: new Set(['city', 'region', 'totalSpend', 'totalClicks', 'totalConversions', 'conversion_value']),
  device_table: new Set(['device', 'totalSpend', 'totalImpressions', 'totalClicks', 'averageCtr', 'averageCpc', 'totalConversions', 'conversion_value', 'roas']),
  keyword_table: new Set(['keyword', 'totalSpend', 'totalImpressions', 'totalClicks', 'averageCtr', 'averageCpc']),
  search_terms_table: new Set(['search_term', 'match_type', 'campaign_name', 'ad_group_name', 'totalSpend', 'totalImpressions', 'totalClicks', 'averageCtr', 'averageCpc']),
};

// Custom names per section where the label should differ from the master default
const SECTION_NAME_OVERRIDES: Partial<Record<MetricSection, Record<string, string>>> = {
  charts: {
    booking_step_1: 'Pozyskane leady',
  },
  funnel: {
    booking_step_3: 'Zainicjowane przejścia do kasy',
  },
  report_summary: {
    averageCtr: 'CTR',
    averageCpc: 'CPC',
    averageCpa: 'CPA',
    total_conversion_value: 'Łączna wartość konwersji',
  },
  campaign_table: {
    totalSpend: 'Wydatki',
    totalImpressions: 'Wyświetlenia',
    totalClicks: 'Kliknięcia',
    totalConversions: 'Konwersje',
    averageCtr: 'CTR',
    averageCpc: 'CPC',
    roas: 'ROAS',
  },
  placement_table: {
    totalSpend: 'Wydatki',
    totalImpressions: 'Wyświetlenia',
    totalClicks: 'Kliknięcia',
    averageCtr: 'CTR',
    averageCpc: 'CPC',
  },
  demographic_breakdown: {
    totalSpend: 'Wydatki',
    totalImpressions: 'Wyświetlenia',
    totalClicks: 'Kliknięcia',
    averageCtr: 'CTR',
    averageCpc: 'CPC',
  },
  geographic_map: {
    totalSpend: 'Wydatki',
    totalClicks: 'Kliknięcia',
    totalConversions: 'Konwersje',
  },
  device_table: {
    totalSpend: 'Wydatki',
    totalImpressions: 'Wyświetlenia',
    totalClicks: 'Kliknięcia',
    averageCtr: 'CTR',
    averageCpc: 'CPC',
  },
  keyword_table: {
    totalSpend: 'Wydatki',
    totalImpressions: 'Wyświetlenia',
    totalClicks: 'Kliknięcia',
    averageCtr: 'CTR',
    averageCpc: 'CPC',
  },
  search_terms_table: {
    totalSpend: 'Wydatki',
    totalImpressions: 'Wyświetlenia',
    totalClicks: 'Kliknięcia',
    averageCtr: 'CTR',
    averageCpc: 'CPC',
  },
};

function dimensionDefsForSection(section: MetricSection): MetricDef[] {
  return REGISTRY_DIMENSIONS
    .filter((field) => field.sections.includes(section))
    .map((field) => ({
      key: field.key,
      defaultName: field.label,
      format: field.format,
      description: field.description,
    }));
}

const SECTION_EXTRA: Partial<Record<MetricSection, MetricDef[]>> = {
  campaign_table: dimensionDefsForSection('campaign_table'),
  placement_table: dimensionDefsForSection('placement_table'),
  demographic_breakdown: dimensionDefsForSection('demographic_breakdown'),
  geographic_map: dimensionDefsForSection('geographic_map'),
  device_table: dimensionDefsForSection('device_table'),
  keyword_table: dimensionDefsForSection('keyword_table'),
  search_terms_table: dimensionDefsForSection('search_terms_table'),
};

const ALL_SECTIONS: MetricSection[] = [
  'kpi_cards',
  'charts',
  'funnel',
  'contact',
  'report_summary',
  'campaign_table',
  'placement_table',
  'demographic_breakdown',
  'geographic_map',
  'device_table',
  'keyword_table',
  'search_terms_table',
];

function buildSectionMetrics(section: MetricSection): MetricConfigItem[] {
  const pool: MetricDef[] = [
    ...(SECTION_EXTRA[section] ?? []),
    ...ALL_METRICS,
  ];

  const visibleSet = DEFAULT_VISIBLE[section];
  const nameOverrides = SECTION_NAME_OVERRIDES[section] ?? {};

  // Visible items come first, then hidden ones
  const visibleItems = pool.filter((m) => visibleSet.has(m.key));
  const hiddenItems = pool.filter((m) => !visibleSet.has(m.key));
  const ordered = [...visibleItems, ...hiddenItems];

  return ordered.map((m, i) => ({
    key: m.key,
    section,
    defaultName: nameOverrides[m.key] ?? m.defaultName,
    customName: null,
    visible: visibleSet.has(m.key),
    order: i,
    format: m.format,
    description: m.description,
  }));
}

// Generate the full default config — every section gets ALL metrics
export const DEFAULT_METRICS_CONFIG: MetricConfigItem[] = ALL_SECTIONS.flatMap(buildSectionMetrics);

export const SECTION_LABELS: Record<MetricSection, string> = {
  kpi_cards: 'Karty KPI (dashboard)',
  charts: 'Wykresy porównawcze (dashboard)',
  funnel: 'Lejek konwersji (raport)',
  contact: 'Kontakt i konwersje (raport)',
  campaign_table: 'Kolumny tabeli kampanii (raport)',
  report_summary: 'Podsumowanie raportu',
  placement_table: 'Placementy / sieci (raport)',
  demographic_breakdown: 'Demografia (raport)',
  geographic_map: 'Mapa i lokalizacje (Google)',
  device_table: 'Urządzenia (Google)',
  keyword_table: 'Słowa kluczowe (Google)',
  search_terms_table: 'Wyszukiwane hasła (Google)',
};

export const SECTION_DESCRIPTIONS: Record<MetricSection, string> = {
  kpi_cards: 'Główne karty metryczne widoczne u góry dashboardu',
  charts: 'Wykresy z animacją porównujące bieżący i poprzedni miesiąc',
  funnel: 'Kroki lejka konwersji na stronie raportów',
  contact: 'Metryki kontaktowe i kosztowe na stronie raportów',
  campaign_table: 'Kolumny widoczne w tabeli kampanii na stronie raportów',
  report_summary: 'Karty podsumowujące na górze raportu tygodniowego/miesięcznego',
  placement_table: 'Kolumny i metryki w tabelach placementów / sieci reklamowych',
  demographic_breakdown: 'Metryki dostępne w wykresach i tabelach demografii',
  geographic_map: 'Metryki dostępne w mapie Polski i tabeli miast Google Ads',
  device_table: 'Kolumny w tabeli urządzeń Google Ads',
  keyword_table: 'Kolumny w tabeli słów kluczowych Google Ads',
  search_terms_table: 'Kolumny w tabeli wyszukiwanych haseł Google Ads',
};

export function getDefaultConfigForSection(section: MetricSection): MetricConfigItem[] {
  return DEFAULT_METRICS_CONFIG
    .filter((m) => m.section === section)
    .sort((a, b) => a.order - b.order);
}

function isPersistedDynamicMetricKey(key: string): boolean {
  return key.startsWith('dyn_meta_') || key.startsWith('dyn_google_');
}

export function mergeWithDefaults(saved: MetricConfigItem[]): MetricConfigItem[] {
  const savedMap = new Map(saved.map((m) => [`${m.section}::${m.key}`, m]));

  const merged = DEFAULT_METRICS_CONFIG.map((defaultItem) => {
    const key = `${defaultItem.section}::${defaultItem.key}`;
    const savedItem = savedMap.get(key);
    if (savedItem) {
      return { ...defaultItem, ...savedItem };
    }
    return { ...defaultItem };
  });

  const defaultKeys = new Set(
    DEFAULT_METRICS_CONFIG.map((d) => `${d.section}::${d.key}`)
  );
  const seenExtra = new Set<string>();
  const extras: MetricConfigItem[] = [];
  for (const item of saved) {
    const composite = `${item.section}::${item.key}`;
    if (
      !defaultKeys.has(composite) &&
      isPersistedDynamicMetricKey(item.key) &&
      !seenExtra.has(composite)
    ) {
      seenExtra.add(composite);
      extras.push(item);
    }
  }

  return [...merged, ...extras];
}

export function getMetricName(
  config: MetricConfigItem[],
  section: MetricSection,
  key: string
): string {
  const item = config.find((m) => m.section === section && m.key === key);
  if (!item) {
    const def = DEFAULT_METRICS_CONFIG.find(
      (m) => m.section === section && m.key === key
    );
    return def?.defaultName ?? key;
  }
  return item.customName || item.defaultName;
}

export function isMetricVisible(
  config: MetricConfigItem[],
  section: MetricSection,
  key: string
): boolean {
  const item = config.find((m) => m.section === section && m.key === key);
  if (!item) return true;
  return item.visible;
}

export function getVisibleMetrics(
  config: MetricConfigItem[],
  section: MetricSection
): MetricConfigItem[] {
  return config
    .filter((m) => m.section === section && m.visible)
    .sort((a, b) => a.order - b.order);
}

export function isMetricSupportedForPlatform(key: string, platform: MetricPlatform): boolean {
  const field = getRegistryField(key);
  if (!field) {
    return key.startsWith(`dyn_${platform}_`);
  }
  return field.platforms.includes(platform);
}

/** Google Ads funnel: default display names Booking step 1–3 (aligned UI/PDF/email). */
const GOOGLE_FUNNEL_BOOKING_DEFAULT_LABELS: Record<string, string> = {
  booking_step_1: 'Booking step 1',
  booking_step_2: 'Booking step 2',
  booking_step_3: 'Booking step 3',
};

export function normalizeConfigForPlatform(
  config: MetricConfigItem[],
  platform: MetricPlatform
): MetricConfigItem[] {
  return config.map((item) => {
    const base: MetricConfigItem = isMetricSupportedForPlatform(item.key, platform)
      ? item
      : { ...item, visible: false };

    if (
      platform === 'google' &&
      item.section === 'funnel' &&
      GOOGLE_FUNNEL_BOOKING_DEFAULT_LABELS[item.key]
    ) {
      return {
        ...base,
        defaultName: GOOGLE_FUNNEL_BOOKING_DEFAULT_LABELS[item.key]!,
      };
    }
    return base;
  });
}
