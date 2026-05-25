import {
  DEFAULT_METRICS_CONFIG,
  SECTION_DESCRIPTIONS,
  SECTION_LABELS,
  type MetricConfigItem,
  type MetricSection,
} from './default-metrics-config';

export type ReportAreaId = 'dashboard' | 'report' | 'tables' | 'changes' | 'advanced';
export type MetricDiffStatus = 'default' | 'changed' | 'added' | 'hidden';

export interface ReportArea {
  id: ReportAreaId;
  label: string;
  description: string;
  sections: MetricSection[];
}

export interface MetricChange {
  id: string;
  section: MetricSection;
  key: string;
  label: string;
  status: MetricDiffStatus;
  description: string;
}

export const BASE_TEMPLATE_NAME = 'Standard hotel report';

export const REPORT_AREAS: ReportArea[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Client dashboard cards and comparison charts.',
    sections: ['kpi_cards', 'charts'],
  },
  {
    id: 'report',
    label: 'Report',
    description: 'The default report layout, funnel, contact metrics, and campaign table.',
    sections: ['report_summary', 'funnel', 'contact', 'campaign_table'],
  },
  {
    id: 'tables',
    label: 'Tables',
    description: 'Breakdowns for placements, demographics, locations, devices, keywords, and search terms.',
    sections: [
      'placement_table',
      'demographic_breakdown',
      'geographic_map',
      'device_table',
      'keyword_table',
      'search_terms_table',
    ],
  },
  {
    id: 'changes',
    label: 'Changes',
    description: 'Review local changes from the standard template.',
    sections: [],
  },
  {
    id: 'advanced',
    label: 'Metrics',
    description: 'Search all configurable metric keys in one place.',
    sections: [
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
    ],
  },
];

export function getAreaById(areaId: ReportAreaId): ReportArea {
  return REPORT_AREAS.find((area) => area.id === areaId) ?? REPORT_AREAS[0]!;
}

export function getSectionTitle(section: MetricSection): string {
  switch (section) {
    case 'kpi_cards':
      return 'KPI Cards';
    case 'charts':
      return 'Dashboard Charts';
    case 'report_summary':
      return 'Report Summary';
    case 'funnel':
      return 'Conversion Funnel';
    case 'contact':
      return 'Contact & Conversions';
    case 'campaign_table':
      return 'Campaign Table';
    case 'placement_table':
      return 'Placements';
    case 'demographic_breakdown':
      return 'Demographics';
    case 'geographic_map':
      return 'Locations';
    case 'device_table':
      return 'Devices';
    case 'keyword_table':
      return 'Keywords';
    case 'search_terms_table':
      return 'Search Terms';
    default:
      return SECTION_LABELS[section];
  }
}

export function getSectionDescription(section: MetricSection): string {
  switch (section) {
    case 'kpi_cards':
      return 'Main numbers shown at the top of the client dashboard.';
    case 'charts':
      return 'Comparison charts used on the client dashboard.';
    case 'report_summary':
      return 'Headline cards at the top of weekly and monthly reports.';
    case 'funnel':
      return 'Online conversion path in the client report.';
    case 'contact':
      return 'Contact, reservation, and offline estimate metrics.';
    case 'campaign_table':
      return 'Columns visible in the campaign performance table.';
    default:
      return SECTION_DESCRIPTIONS[section];
  }
}

export function getSectionMetrics(config: MetricConfigItem[], section: MetricSection): MetricConfigItem[] {
  return config
    .filter((metric) => metric.section === section)
    .sort((a, b) => a.order - b.order);
}

export function getMetricId(section: MetricSection, key: string): string {
  return `${section}::${key}`;
}

export function getBaseMetric(section: MetricSection, key: string): MetricConfigItem | undefined {
  return DEFAULT_METRICS_CONFIG.find((metric) => metric.section === section && metric.key === key);
}

export function getMetricDiffStatus(metric: MetricConfigItem): MetricDiffStatus {
  const base = getBaseMetric(metric.section, metric.key);
  const hasCustomName = Boolean(metric.customName && metric.customName.trim());

  if (!base) {
    return metric.visible ? 'added' : 'changed';
  }

  if (base.visible && !metric.visible) return 'hidden';
  if (!base.visible && metric.visible) return 'added';

  const orderChanged = base.order !== metric.order;
  const formatChanged = base.format !== metric.format;
  const labelChanged = hasCustomName;
  const visibilityChanged = base.visible !== metric.visible;

  if (orderChanged || formatChanged || labelChanged || visibilityChanged) {
    return 'changed';
  }

  return 'default';
}

export function getMetricChangeDescription(metric: MetricConfigItem): string {
  const base = getBaseMetric(metric.section, metric.key);
  const label = metric.customName || metric.defaultName;
  const status = getMetricDiffStatus(metric);

  if (!base) return `${label} was added outside the standard template.`;
  if (status === 'added') return `${label} was added for this client.`;
  if (status === 'hidden') return `${base.defaultName} is hidden for this client.`;

  const changes: string[] = [];
  if (metric.customName) changes.push(`renamed to “${metric.customName}”`);
  if (base.order !== metric.order) changes.push(`moved from position ${base.order + 1} to ${metric.order + 1}`);
  if (base.format !== metric.format) changes.push(`format changed from ${base.format} to ${metric.format}`);
  if (base.visible !== metric.visible) changes.push(metric.visible ? 'made visible' : 'hidden');

  return changes.length ? `${base.defaultName} ${changes.join(', ')}.` : `${label} matches the standard template.`;
}

export function getClientChanges(config: MetricConfigItem[]): MetricChange[] {
  const changes: MetricChange[] = [];
  for (const metric of config) {
    const status = getMetricDiffStatus(metric);
    if (status !== 'default') {
      changes.push({
        id: getMetricId(metric.section, metric.key),
        section: metric.section,
        key: metric.key,
        label: metric.customName || metric.defaultName,
        status,
        description: getMetricChangeDescription(metric),
      });
    }
  }
  return changes;
}

export function getClientChangeSummary(config: MetricConfigItem[]): Record<MetricDiffStatus, number> {
  return config.reduce(
    (summary, metric) => {
      const status = getMetricDiffStatus(metric);
      summary[status] += 1;
      return summary;
    },
    { default: 0, changed: 0, added: 0, hidden: 0 } as Record<MetricDiffStatus, number>
  );
}

export function getVisibleMetricsForSection(
  config: MetricConfigItem[],
  section: MetricSection
): MetricConfigItem[] {
  return getSectionMetrics(config, section).filter((metric) => metric.visible);
}

export function getHiddenMetricsForSection(
  config: MetricConfigItem[],
  section: MetricSection
): MetricConfigItem[] {
  return getSectionMetrics(config, section).filter((metric) => !metric.visible);
}

export function updateMetricInSection(
  config: MetricConfigItem[],
  section: MetricSection,
  key: string,
  updater: (metric: MetricConfigItem) => MetricConfigItem
): MetricConfigItem[] {
  return config.map((metric) =>
    metric.section === section && metric.key === key ? updater(metric) : metric
  );
}

export function setMetricCustomName(
  config: MetricConfigItem[],
  section: MetricSection,
  key: string,
  nextName: string
): MetricConfigItem[] {
  return updateMetricInSection(config, section, key, (metric) => {
    const trimmed = nextName.trim();
    return {
      ...metric,
      customName: !trimmed || trimmed === metric.defaultName ? null : trimmed,
    };
  });
}

export function toggleMetricVisibility(
  config: MetricConfigItem[],
  section: MetricSection,
  key: string
): MetricConfigItem[] {
  return updateMetricInSection(config, section, key, (metric) => ({
    ...metric,
    visible: !metric.visible,
  }));
}

export function addMetricToSection(
  config: MetricConfigItem[],
  section: MetricSection,
  key: string
): MetricConfigItem[] {
  const sectionItems = getSectionMetrics(config, section);
  const existing = sectionItems.find((metric) => metric.key === key);
  const nextOrder = sectionItems.reduce((max, metric) => Math.max(max, metric.order), -1) + 1;

  if (existing) {
    return updateMetricInSection(config, section, key, (metric) => ({
      ...metric,
      visible: true,
      order: metric.visible ? metric.order : nextOrder,
    }));
  }

  const base = getBaseMetric(section, key);
  if (!base) return config;

  return [
    ...config,
    {
      ...base,
      visible: true,
      order: nextOrder,
    },
  ];
}

export function reorderMetricInSection(
  config: MetricConfigItem[],
  section: MetricSection,
  fromIndex: number,
  toIndex: number
): MetricConfigItem[] {
  const sectionItems = getSectionMetrics(config, section);
  const otherItems = config.filter((metric) => metric.section !== section);
  const reordered = [...sectionItems];
  const [moved] = reordered.splice(fromIndex, 1);
  if (!moved) return config;
  reordered.splice(toIndex, 0, moved);
  return [...otherItems, ...reordered.map((metric, order) => ({ ...metric, order }))];
}

export function moveMetricInSection(
  config: MetricConfigItem[],
  section: MetricSection,
  key: string,
  direction: 'up' | 'down'
): MetricConfigItem[] {
  const items = getSectionMetrics(config, section);
  const fromIndex = items.findIndex((metric) => metric.key === key);
  if (fromIndex < 0) return config;
  const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
  if (toIndex < 0 || toIndex >= items.length) return config;
  return reorderMetricInSection(config, section, fromIndex, toIndex);
}

export function revertMetricToTemplate(
  config: MetricConfigItem[],
  section: MetricSection,
  key: string
): MetricConfigItem[] {
  const base = getBaseMetric(section, key);
  if (!base) {
    return config.filter((metric) => !(metric.section === section && metric.key === key));
  }
  return updateMetricInSection(config, section, key, () => ({ ...base }));
}

export function resetPlatformToTemplate(): MetricConfigItem[] {
  return DEFAULT_METRICS_CONFIG.map((metric) => ({ ...metric }));
}

export function getAvailableMetricsForSection(
  config: MetricConfigItem[],
  section: MetricSection,
  query: string
): MetricConfigItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  return getSectionMetrics(config, section)
    .filter((metric) => {
      if (!normalizedQuery) return true;
      const haystack = [
        metric.key,
        metric.defaultName,
        metric.customName ?? '',
        metric.description,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    })
    .sort((a, b) => {
      if (a.visible !== b.visible) return a.visible ? 1 : -1;
      const aBase = getBaseMetric(a.section, a.key);
      const bBase = getBaseMetric(b.section, b.key);
      if (Boolean(aBase?.visible) !== Boolean(bBase?.visible)) return aBase?.visible ? -1 : 1;
      return a.order - b.order;
    });
}
