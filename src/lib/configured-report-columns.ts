import {
  getMetricName,
  getVisibleMetrics,
  type MetricConfigItem,
  type MetricSection,
} from './default-metrics-config';
import { getRegistryField, type RegistryField, type RegistryFieldKind } from './metric-registry';

export interface ConfiguredReportColumn {
  key: string;
  label: string;
  kind: RegistryFieldKind;
  field?: RegistryField;
  order: number;
  format: MetricConfigItem['format'];
}

export function getConfiguredColumns(
  config: MetricConfigItem[],
  section: MetricSection,
  options?: {
    keys?: string[];
    kind?: RegistryFieldKind;
  }
): ConfiguredReportColumn[] {
  const allowedKeys = options?.keys ? new Set(options.keys) : null;

  return getVisibleMetrics(config, section)
    .filter((item) => !allowedKeys || allowedKeys.has(item.key))
    .map((item) => {
      const field = getRegistryField(item.key);
      return {
        key: item.key,
        label: getMetricName(config, section, item.key),
        kind: field?.kind || 'metric',
        field,
        order: item.order,
        format: item.format,
      };
    })
    .filter((column) => !options?.kind || column.kind === options.kind)
    .sort((a, b) => a.order - b.order);
}

export function hasConfiguredColumns(
  config: MetricConfigItem[],
  section: MetricSection,
  keys?: string[]
): boolean {
  return getConfiguredColumns(config, section, { keys }).length > 0;
}
