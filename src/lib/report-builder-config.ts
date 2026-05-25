import type { MetricSection } from './default-metrics-config';
import type { MetricPlatform } from './metric-registry';
import type { MetricConfigItem } from './default-metrics-config';
import { getRegistryField } from './metric-registry';

export type VisualizationType = 'scorecard' | 'bar' | 'line' | 'table' | 'map' | 'pie';
export type SortDirection = 'asc' | 'desc';

export interface ReportBuilderFilter {
  fieldKey: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte';
  value: string | number | boolean;
}

export interface ReportBuilderConfig {
  id: string;
  clientId: string;
  platform: MetricPlatform;
  section: MetricSection;
  visualization: VisualizationType;
  dimensions: string[];
  metrics: string[];
  filters: ReportBuilderFilter[];
  sort?: {
    fieldKey: string;
    direction: SortDirection;
  };
  limit?: number;
}

export interface BuilderCompatibilityIssue {
  fieldKey: string;
  reason: string;
}

export function legacyMetricsToBuilderConfig(params: {
  clientId: string;
  platform: MetricPlatform;
  section: MetricSection;
  items: MetricConfigItem[];
  visualization?: VisualizationType;
}): ReportBuilderConfig {
  const visible = params.items
    .filter((item) => item.section === params.section && item.visible)
    .sort((a, b) => a.order - b.order);

  const dimensions = visible
    .filter((item) => getRegistryField(item.key)?.kind === 'dimension')
    .map((item) => item.key);

  const metrics = visible
    .filter((item) => getRegistryField(item.key)?.kind !== 'dimension')
    .map((item) => item.key);

  return {
    id: `${params.platform}:${params.section}`,
    clientId: params.clientId,
    platform: params.platform,
    section: params.section,
    visualization: params.visualization || inferVisualization(params.section),
    dimensions,
    metrics,
    filters: [],
    sort: inferDefaultSort(metrics),
    limit: inferDefaultLimit(params.section),
  };
}

export function validateBuilderConfig(config: ReportBuilderConfig): BuilderCompatibilityIssue[] {
  const issues: BuilderCompatibilityIssue[] = [];

  for (const fieldKey of [...config.dimensions, ...config.metrics]) {
    const field = getRegistryField(fieldKey);
    if (!field) {
      issues.push({ fieldKey, reason: 'Unknown registry field' });
      continue;
    }
    if (!field.platforms.includes(config.platform)) {
      issues.push({ fieldKey, reason: `Not supported by ${config.platform}` });
    }
    if (!field.sections.includes(config.section)) {
      issues.push({ fieldKey, reason: `Not supported in ${config.section}` });
    }
  }

  return issues;
}

function inferVisualization(section: MetricSection): VisualizationType {
  switch (section) {
    case 'kpi_cards':
    case 'report_summary':
    case 'contact':
      return 'scorecard';
    case 'charts':
      return 'bar';
    case 'geographic_map':
      return 'map';
    case 'demographic_breakdown':
      return 'pie';
    default:
      return 'table';
  }
}

function inferDefaultSort(metrics: string[]): ReportBuilderConfig['sort'] {
  const preferred = ['reservation_value', 'conversion_value', 'total_conversion_value', 'totalSpend', 'totalConversions', 'totalClicks'];
  const fieldKey = preferred.find((key) => metrics.includes(key));
  return fieldKey ? { fieldKey, direction: 'desc' } : undefined;
}

function inferDefaultLimit(section: MetricSection): number | undefined {
  if (section === 'keyword_table' || section === 'search_terms_table') return 10;
  if (section === 'placement_table' || section === 'device_table') return 10;
  return undefined;
}
