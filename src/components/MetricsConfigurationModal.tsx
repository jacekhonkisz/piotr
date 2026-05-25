'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { X, Loader2, Save, Database } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  ALL_METRIC_KEYS_FOR_DISCOVERY,
  DEFAULT_METRICS_CONFIG,
  isMetricSupportedForPlatform,
  SECTION_LABELS,
  type MetricSection,
  type MetricConfigItem,
} from '../lib/default-metrics-config';
import { getRegistryField } from '../lib/metric-registry';
import { filterDiscoveryCatalogKeys } from '../lib/real-metrics-filter';

type Platform = 'meta' | 'google';
type UsageFilter = 'all' | 'used' | 'unused';
type PeriodMode = 'current' | 'last_closed';
type PlatformView = 'both' | 'meta' | 'google';

interface DynamicConversionRow {
  id: string;
  label: string;
  /** Matches `key` in the main metrics table and in saved config */
  key: string;
  count: number;
  value?: number;
}

interface DiscoveryResponse {
  catalogKeys: string[];
  /** Human labels for dyn_meta_* / dyn_google_* keys */
  labelByKey?: Record<string, string>;
  periods: {
    recent: { label: string; start: string; end: string };
  };
  meta: {
    recent: Record<string, number>;
    fetchOk: { recent: boolean };
    dynamicConversions?: DynamicConversionRow[];
    dynamicConversionsFetchOk?: boolean;
  };
  google: {
    recent: Record<string, number>;
    fetchOk: { recent: boolean };
    dynamicConversions?: DynamicConversionRow[];
    dynamicConversionsFetchOk?: boolean;
    dynamicConversionsSkipReason?: string;
  };
}

function fmtVal(n: number): string {
  if (Number.isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return n.toLocaleString('pl-PL', { maximumFractionDigits: 0 });
  return n.toLocaleString('pl-PL', { maximumFractionDigits: 2 });
}

function fmtValWithFetchStatus(n: number, fetchOk: boolean): string {
  if (!fetchOk) return 'Błąd API';
  return fmtVal(n);
}

function chartItem(metrics: MetricConfigItem[], key: string): MetricConfigItem | undefined {
  return metrics.find((m) => m.section === 'charts' && m.key === key);
}

function metricItemAnySection(metrics: MetricConfigItem[], key: string): MetricConfigItem | undefined {
  return metrics.find((m) => m.key === key);
}

function isMetricUsedAnywhere(metrics: MetricConfigItem[], key: string): boolean {
  return metrics.some((m) => m.key === key && m.visible);
}

function supportsPlatform(key: string, platform: Platform): boolean {
  return isMetricSupportedForPlatform(key, platform);
}

const SECTION_SHORT_LABELS: Record<string, string> = {
  kpi_cards: 'KPI',
  charts: 'Wykresy',
  funnel: 'Lejek',
  contact: 'Kontakt',
  report_summary: 'Podsumowanie',
  campaign_table: 'Tabela kampanii',
  placement_table: 'Placementy',
  demographic_breakdown: 'Demografia',
  geographic_map: 'Mapa',
  device_table: 'Urządzenia',
  keyword_table: 'Słowa kluczowe',
  search_terms_table: 'Search terms',
};

const SECTION_ORDER: MetricSection[] = [
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

function metricUsedSections(metrics: MetricConfigItem[], key: string): string[] {
  const labels = metrics
    .filter((m) => m.key === key && m.visible)
    .map((m) => SECTION_SHORT_LABELS[m.section] || m.section);
  return Array.from(new Set(labels));
}

interface MetricsConfigurationModalProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  metaMetrics: MetricConfigItem[];
  googleMetrics: MetricConfigItem[];
  setMetaMetrics: React.Dispatch<React.SetStateAction<MetricConfigItem[]>>;
  setGoogleMetrics: React.Dispatch<React.SetStateAction<MetricConfigItem[]>>;
  onMarkDirty: () => void;
  onSave: () => Promise<void>;
  saving: boolean;
}

export default function MetricsConfigurationModal({
  open,
  onClose,
  clientId,
  clientName,
  metaMetrics,
  googleMetrics,
  setMetaMetrics,
  setGoogleMetrics,
  onMarkDirty,
  onSave,
  saving,
}: MetricsConfigurationModalProps) {
  const [loading, setLoading] = useState(false);
  const [discovery, setDiscovery] = useState<DiscoveryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usageFilter, setUsageFilter] = useState<UsageFilter>('all');
  const [periodMode, setPeriodMode] = useState<PeriodMode>('current');
  const [platformView, setPlatformView] = useState<PlatformView>('both');
  const onMarkDirtyRef = useRef(onMarkDirty);
  onMarkDirtyRef.current = onMarkDirty;

  const loadDiscovery = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    setDiscovery(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(
        `/api/metrics-config/discovery?clientId=${clientId}&mode=${periodMode}`,
        {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data: DiscoveryResponse = await res.json();
      setDiscovery(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się pobrać danych');
      setDiscovery(null);
    } finally {
      setLoading(false);
    }
  }, [clientId, periodMode]);

  useEffect(() => {
    if (open && clientId) {
      loadDiscovery();
    }
  }, [open, clientId, loadDiscovery]);

  useEffect(() => {
    if (!open) setUsageFilter('all');
  }, [open]);

  useEffect(() => {
    if (!open) setPeriodMode('current');
  }, [open]);

  useEffect(() => {
    if (!open) setPlatformView('both');
  }, [open]);

  const chartDefaultsByKey = useMemo(() => {
    const m = new Map<string, MetricConfigItem>();
    for (const item of DEFAULT_METRICS_CONFIG) {
      if (item.section === 'charts' && !m.has(item.key)) {
        m.set(item.key, item);
      }
    }
    return m;
  }, []);

  const defaultsBySectionAndKey = useMemo(() => {
    const m = new Map<string, MetricConfigItem>();
    for (const item of DEFAULT_METRICS_CONFIG) {
      m.set(`${item.section}::${item.key}`, item);
    }
    return m;
  }, []);

  const fallbackLabelByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const item of DEFAULT_METRICS_CONFIG) {
      if (!m.has(item.key)) {
        m.set(item.key, item.defaultName);
      }
    }
    return m;
  }, []);

  const toggleMetricUsage = (platform: Platform, key: string) => {
    if (platform === 'meta' && key.startsWith('dyn_google_')) return;
    if (platform === 'google' && key.startsWith('dyn_meta_')) return;
    if (!supportsPlatform(key, platform)) return;
    const registryField = getRegistryField(key);
    const targetSection = registryField?.sections[0] || 'charts';

    const setter = platform === 'meta' ? setMetaMetrics : setGoogleMetrics;
    const labelFromDiscovery = discovery?.labelByKey?.[key];
    setter((prev) => {
      const currentlyUsed = prev.some((m) => m.key === key && m.visible);

      // Turn OFF: disable metric in all sections for this platform.
      if (currentlyUsed) {
        return prev.map((m) => (m.key === key ? { ...m, visible: false } : m));
      }

      // Turn ON: enable the first registry-supported section for this field.
      const chartIdx = prev.findIndex((m) => m.section === targetSection && m.key === key);
      if (chartIdx >= 0) {
        return prev.map((m, idx) =>
          idx === chartIdx ? { ...m, visible: true } : m
        );
      }

      // If metric is not present in that section yet, assign it there and turn on.
      const anyItem = prev.find((m) => m.key === key);
      const fallbackDefault =
        defaultsBySectionAndKey.get(`${targetSection}::${key}`) ||
        chartDefaultsByKey.get(key);
      const maxChartOrder = prev.reduce((mx, m) => {
        if (m.section !== targetSection) return mx;
        return Math.max(mx, Number.isFinite(m.order) ? m.order : mx);
      }, -1);

      const newChartItem: MetricConfigItem = {
        key,
        section: targetSection,
        defaultName:
          fallbackDefault?.defaultName ||
          anyItem?.defaultName ||
          labelFromDiscovery ||
          key,
        customName: anyItem?.customName ?? null,
        visible: true,
        order: maxChartOrder + 1,
        format: fallbackDefault?.format || anyItem?.format || 'number',
        description: fallbackDefault?.description || anyItem?.description || '',
      };

      return [...prev, newChartItem];
    });
    onMarkDirty();
  };

  const toggleMetricSection = (
    platform: Platform,
    key: string,
    section: MetricSection
  ) => {
    if (platform === 'meta' && key.startsWith('dyn_google_')) return;
    if (platform === 'google' && key.startsWith('dyn_meta_')) return;
    if (!supportsPlatform(key, platform)) return;
    const registryField = getRegistryField(key);
    if (registryField && !registryField.sections.includes(section)) return;

    const labelFromDiscovery = discovery?.labelByKey?.[key];
    const setter = platform === 'meta' ? setMetaMetrics : setGoogleMetrics;
    setter((prev) => {
      const idx = prev.findIndex((m) => m.key === key && m.section === section);
      if (idx >= 0) {
        return prev.map((m, i) => (i === idx ? { ...m, visible: !m.visible } : m));
      }

      const anyItem = prev.find((m) => m.key === key);
      const defaultItem = defaultsBySectionAndKey.get(`${section}::${key}`);
      const maxSectionOrder = prev.reduce((mx, m) => {
        if (m.section !== section) return mx;
        return Math.max(mx, Number.isFinite(m.order) ? m.order : mx);
      }, -1);

      const newItem: MetricConfigItem = {
        key,
        section,
        defaultName:
          defaultItem?.defaultName ||
          anyItem?.defaultName ||
          labelFromDiscovery ||
          key,
        customName: anyItem?.customName ?? null,
        visible: true,
        order: maxSectionOrder + 1,
        format: defaultItem?.format || anyItem?.format || 'number',
        description: defaultItem?.description || anyItem?.description || '',
      };

      return [...prev, newItem];
    });
    onMarkDirty();
  };

  const catalogRaw =
    discovery?.catalogKeys?.length ? discovery.catalogKeys : ALL_METRIC_KEYS_FOR_DISCOVERY;

  // Always keep dynamically detected keys visible in the main table,
  // even when their current value is 0 (so user can still enable them).
  const discoveredDynamicKeys = useMemo(() => {
    if (!discovery) return [] as string[];
    return [
      ...(discovery.meta.dynamicConversions ?? []).map((r) => r.key),
      ...(discovery.google.dynamicConversions ?? []).map((r) => r.key),
    ];
  }, [discovery]);

  const catalogFiltered =
    discovery && !loading
      ? filterDiscoveryCatalogKeys(
          catalogRaw,
          discovery.meta.recent,
          discovery.google.recent,
          {},
          {}
        )
      : catalogRaw;

  const metaChartsOrdered = useMemo(
    () =>
      metaMetrics
        .filter((m) => m.section === 'charts')
        .sort((a, b) => a.order - b.order)
        .map((m) => m.key),
    [metaMetrics]
  );

  const rowKeysSorted = useMemo(() => {
    const allConfigKeys = new Set([
      ...metaMetrics.map((m) => m.key),
      ...googleMetrics.map((m) => m.key),
    ]);
    const chartKeys = new Set([
      ...metaMetrics.filter((m) => m.section === 'charts').map((m) => m.key),
      ...googleMetrics.filter((m) => m.section === 'charts').map((m) => m.key),
    ]);
    const combinedKeys = Array.from(
      new Set([
        ...catalogFiltered,
        ...discoveredDynamicKeys,
        ...Array.from(chartKeys),
        ...Array.from(allConfigKeys),
      ])
    );
    const orderMap = new Map(metaChartsOrdered.map((k, i) => [k, i]));
    return combinedKeys.sort((a, b) => {
      const oa = orderMap.get(a) ?? 9999;
      const ob = orderMap.get(b) ?? 9999;
      return oa - ob;
    });
  }, [catalogFiltered, discoveredDynamicKeys, metaChartsOrdered, metaMetrics, googleMetrics]);

  const metaFetchFailed = discovery && !discovery.meta.fetchOk.recent;
  const googleFetchFailed = discovery && !discovery.google.fetchOk.recent;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="metrics-modal-title"
    >
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 id="metrics-modal-title" className="text-lg font-semibold text-gray-900">
              Metryki — {clientName}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              W jednej tabeli: wartości z API (bieżący lub ostatni zamknięty miesiąc) oraz widoczność
              osobno dla Meta i Google. Akcje i konwersje spoza stałego katalogu trafiają do tej samej
              tabeli pod stałymi kluczami <span className="font-mono text-[11px]">dyn_meta_…</span> /{' '}
              <span className="font-mono text-[11px]">dyn_google_…</span> — można je włączać w sekcjach i
              zapisywać. Poniżej skrócony podgląd surowych identyfikatorów z API.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Zamknij"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          {loading && (
            <div className="flex items-center gap-2 text-gray-500 py-12 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
              Ładowanie snapshotów Meta i Google…
            </div>
          )}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
              {error}
            </div>
          )}
          {googleFetchFailed && !loading && discovery && (
            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
              Google Ads: brak danych z API w tym podglądzie (sprawdź połączenie konta lub logi
              serwera). Kolumny Google mogą być puste.
            </div>
          )}
          {metaFetchFailed && !loading && discovery && (
            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
              Meta Ads: brak danych z API w tym podglądzie (sprawdź połączenie konta lub logi
              serwera). Kolumny Meta mogą być puste.
            </div>
          )}
          {!loading && !error && discovery && rowKeysSorted.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xs text-gray-500 mr-2">Filtr:</div>
                <div className="inline-flex rounded-lg border border-gray-200 bg-white overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setUsageFilter('all')}
                    className={`px-3 py-1.5 text-xs font-medium ${
                      usageFilter === 'all'
                        ? 'bg-[#1F3D8A] text-white'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Wszystkie
                  </button>
                  <button
                    type="button"
                    onClick={() => setUsageFilter('used')}
                    className={`px-3 py-1.5 text-xs font-medium border-l border-gray-200 ${
                      usageFilter === 'used'
                        ? 'bg-[#1F3D8A] text-white'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Tylko używane
                  </button>
                  <button
                    type="button"
                    onClick={() => setUsageFilter('unused')}
                    className={`px-3 py-1.5 text-xs font-medium border-l border-gray-200 ${
                      usageFilter === 'unused'
                        ? 'bg-[#1F3D8A] text-white'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Tylko nieużywane
                  </button>
                </div>
                <div className="text-xs text-gray-400">
                  (Status = użycie w sekcjach; checkbox = używaj / nie używaj metryki)
                </div>
                {!loading && discovery && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-gray-500">Monitor API:</span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                        discovery.meta.fetchOk.recent
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      Meta: {discovery.meta.fetchOk.recent ? 'OK (0 = realny wynik)' : 'Błąd pobrania'}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                        discovery.google.fetchOk.recent
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      Google: {discovery.google.fetchOk.recent ? 'OK (0 = realny wynik)' : 'Błąd pobrania'}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <div className="text-xs text-gray-500">Platforma:</div>
                  <div className="inline-flex rounded-lg border border-gray-200 bg-white overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setPlatformView('both')}
                      className={`px-3 py-1.5 text-xs font-medium ${
                        platformView === 'both'
                          ? 'bg-[#1F3D8A] text-white'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Obie
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlatformView('meta')}
                      className={`px-3 py-1.5 text-xs font-medium border-l border-gray-200 ${
                        platformView === 'meta'
                          ? 'bg-[#1F3D8A] text-white'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Meta
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlatformView('google')}
                      className={`px-3 py-1.5 text-xs font-medium border-l border-gray-200 ${
                        platformView === 'google'
                          ? 'bg-[#1F3D8A] text-white'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Google
                    </button>
                  </div>
                </div>

                <div className="ml-auto flex items-center gap-2">
                  <div className="text-xs text-gray-500">Okres:</div>
                  <div className="inline-flex rounded-lg border border-gray-200 bg-white overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setPeriodMode('current')}
                      className={`px-3 py-1.5 text-xs font-medium ${
                        periodMode === 'current'
                          ? 'bg-[#1F3D8A] text-white'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Bieżący (API)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPeriodMode('last_closed')}
                      className={`px-3 py-1.5 text-xs font-medium border-l border-gray-200 ${
                        periodMode === 'last_closed'
                          ? 'bg-[#1F3D8A] text-white'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Ostatni zamknięty
                    </button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="min-w-[720px] w-full text-xs sm:text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th
                      className="text-left font-medium px-3 py-2 sticky left-0 bg-gray-50 z-10 min-w-[140px]"
                      scope="col"
                    >
                      Metryka
                    </th>
                    {(platformView === 'both' || platformView === 'meta') && (
                      <>
                        <th
                          className="text-right font-medium px-2 py-2 whitespace-nowrap"
                          title={discovery.periods.recent.label}
                          scope="col"
                        >
                          Meta — {periodMode === 'current' ? 'bieżący' : 'ostatni'}
                        </th>
                        <th
                          className="text-center font-medium px-2 py-2 whitespace-nowrap w-[88px]"
                          scope="col"
                        >
                          Status Meta
                        </th>
                        <th
                          className="text-center font-medium px-2 py-2 whitespace-nowrap w-[88px]"
                          scope="col"
                        >
                          Użyj Meta
                        </th>
                      </>
                    )}

                    {(platformView === 'both' || platformView === 'google') && (
                      <>
                        <th
                          className="text-right font-medium px-2 py-2 whitespace-nowrap"
                          title={discovery.periods.recent.label}
                          scope="col"
                        >
                          Google — {periodMode === 'current' ? 'bieżący' : 'ostatni'}
                        </th>
                        <th
                          className="text-center font-medium px-2 py-2 whitespace-nowrap w-[88px]"
                          scope="col"
                        >
                          Status Google
                        </th>
                        <th
                          className="text-center font-medium px-2 py-2 whitespace-nowrap w-[88px]"
                          scope="col"
                        >
                          Użyj Google
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rowKeysSorted
                    .filter((key) => {
                      const isUsed =
                        isMetricUsedAnywhere(metaMetrics, key) ||
                        isMetricUsedAnywhere(googleMetrics, key);
                      if (usageFilter === 'used') return isUsed;
                      if (usageFilter === 'unused') return !isUsed;
                      return true;
                    })
                    .map((key) => {
                    const mMeta = chartItem(metaMetrics, key);
                    const mGoogle = chartItem(googleMetrics, key);
                    const metaUsed = isMetricUsedAnywhere(metaMetrics, key);
                    const googleUsed = isMetricUsedAnywhere(googleMetrics, key);
                    const metaUsedSections = metricUsedSections(metaMetrics, key);
                    const googleUsedSections = metricUsedSections(googleMetrics, key);
                    const anyMeta = metricItemAnySection(metaMetrics, key);
                    const anyGoogle = metricItemAnySection(googleMetrics, key);
                    const metaVisibleSectionSet = new Set(
                      metaMetrics
                        .filter((m) => m.key === key && m.visible)
                        .map((m) => m.section)
                    );
                    const googleVisibleSectionSet = new Set(
                      googleMetrics
                        .filter((m) => m.key === key && m.visible)
                        .map((m) => m.section)
                    );
                    const allItemsForKey = [
                      ...metaMetrics.filter((m) => m.key === key),
                      ...googleMetrics.filter((m) => m.key === key),
                    ];
                    const visibleItemsForKey = allItemsForKey.filter((m) => m.visible);
                    const customName =
                      visibleItemsForKey.find((m) => (m.customName || '').trim())?.customName ||
                      allItemsForKey.find((m) => (m.customName || '').trim())?.customName;
                    const defaultName =
                      visibleItemsForKey.find((m) => (m.defaultName || '').trim())?.defaultName ||
                      allItemsForKey.find((m) => (m.defaultName || '').trim())?.defaultName;
                    const isDynGoogleOnly = key.startsWith('dyn_google_');
                    const isDynMetaOnly = key.startsWith('dyn_meta_');
                    const registryField = getRegistryField(key);
                    const metaSupported = supportsPlatform(key, 'meta') && !isDynGoogleOnly;
                    const googleSupported = supportsPlatform(key, 'google') && !isDynMetaOnly;
                    let label =
                      customName ||
                      defaultName ||
                      discovery?.labelByKey?.[key] ||
                      fallbackLabelByKey.get(key) ||
                      key;
                    if (
                      !customName &&
                      (key === 'booking_step_1' || key === 'booking_step_2' || key === 'booking_step_3')
                    ) {
                      const mf = metaMetrics.find((m) => m.key === key && m.section === 'funnel');
                      const gf = googleMetrics.find((m) => m.key === key && m.section === 'funnel');
                      const mLab = mf ? ((mf.customName || '').trim() || mf.defaultName) : '';
                      const gLab = gf ? ((gf.customName || '').trim() || gf.defaultName) : '';
                      if (platformView === 'meta' && mLab) label = mLab;
                      else if (platformView === 'google' && gLab) label = gLab;
                      else if (mLab && gLab) label = mLab !== gLab ? `${mLab} · ${gLab}` : mLab;
                      else label = gLab || mLab || label;
                    }
                    return (
                      <tr key={key} className="hover:bg-gray-50/80">
                        <td className="px-3 py-2 sticky left-0 bg-white align-top">
                          <div className="text-sm font-medium text-gray-900">{label}</div>
                          <div className="flex flex-wrap items-center gap-1 mt-0.5">
                            <span className="text-[11px] text-gray-400 font-mono leading-tight">{key}</span>
                            {registryField && (
                              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                                {registryField.kind === 'dimension' ? 'wymiar' : 'metryka'}
                              </span>
                            )}
                          </div>
                        </td>
                        {(platformView === 'both' || platformView === 'meta') && (
                          <>
                            <td className="text-right px-2 py-2 tabular-nums text-gray-900 align-middle">
                              {isDynGoogleOnly ? (
                                <span className="text-gray-300">—</span>
                              ) : (
                                fmtValWithFetchStatus(
                                  discovery.meta.recent[key] ?? 0,
                                  !!discovery.meta.fetchOk.recent
                                )
                              )}
                            </td>
                            <td className="text-center px-2 py-2 align-middle">
                              {!metaSupported ? (
                                <span className="text-[10px] text-gray-400">Niedostępne dla Meta</span>
                              ) : (
                                <div className="flex flex-col items-center gap-1">
                                  <span
                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                      metaUsed
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-gray-100 text-gray-600'
                                    }`}
                                  >
                                    {metaUsed ? 'Używana' : 'Nieużywana'}
                                  </span>
                                  <span className="text-[10px] text-gray-400 text-center leading-tight">
                                    {metaUsedSections.length
                                      ? `Sekcje: ${metaUsedSections.join(', ')}`
                                      : 'Sekcje: —'}
                                  </span>
                                  <details className="text-[10px] text-left">
                                    <summary className="cursor-pointer text-[#1F3D8A] hover:underline">
                                      Ustaw sekcje
                                    </summary>
                                    <div className="mt-1 p-2 rounded border border-gray-200 bg-white shadow-sm min-w-[180px]">
                                      {SECTION_ORDER.filter((section) => !registryField || registryField.sections.includes(section)).map((section) => (
                                        <label
                                          key={`meta-${key}-${section}`}
                                          className="flex items-center gap-2 py-0.5"
                                        >
                                          <input
                                            type="checkbox"
                                            className="h-3.5 w-3.5 rounded border-gray-300 text-[#1F3D8A] focus:ring-[#1F3D8A]"
                                            checked={metaVisibleSectionSet.has(section)}
                                            onChange={() => toggleMetricSection('meta', key, section)}
                                          />
                                          <span className="text-[10px] text-gray-700">
                                            {SECTION_LABELS[section]}
                                          </span>
                                        </label>
                                      ))}
                                    </div>
                                  </details>
                                </div>
                              )}
                            </td>
                            <td className="text-center px-2 py-2 align-middle">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 text-[#1F3D8A] focus:ring-[#1F3D8A] disabled:opacity-40"
                                checked={metaUsed}
                                disabled={!metaSupported}
                                onChange={() => toggleMetricUsage('meta', key)}
                                aria-label={`Użyj metryki (Meta) — ${label}`}
                              />
                            </td>
                          </>
                        )}

                        {(platformView === 'both' || platformView === 'google') && (
                          <>
                            <td className="text-right px-2 py-2 tabular-nums text-gray-900 align-middle">
                              {isDynMetaOnly ? (
                                <span className="text-gray-300">—</span>
                              ) : (
                                fmtValWithFetchStatus(
                                  discovery.google.recent[key] ?? 0,
                                  !!discovery.google.fetchOk.recent
                                )
                              )}
                            </td>
                            <td className="text-center px-2 py-2 align-middle">
                              {!googleSupported ? (
                                <span className="text-[10px] text-gray-400">Niedostępne dla Google</span>
                              ) : (
                                <div className="flex flex-col items-center gap-1">
                                  <span
                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                      googleUsed
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-gray-100 text-gray-600'
                                    }`}
                                  >
                                    {googleUsed ? 'Używana' : 'Nieużywana'}
                                  </span>
                                  <span className="text-[10px] text-gray-400 text-center leading-tight">
                                    {googleUsedSections.length
                                      ? `Sekcje: ${googleUsedSections.join(', ')}`
                                      : 'Sekcje: —'}
                                  </span>
                                  <details className="text-[10px] text-left">
                                    <summary className="cursor-pointer text-[#1F3D8A] hover:underline">
                                      Ustaw sekcje
                                    </summary>
                                    <div className="mt-1 p-2 rounded border border-gray-200 bg-white shadow-sm min-w-[180px]">
                                      {SECTION_ORDER.filter((section) => !registryField || registryField.sections.includes(section)).map((section) => (
                                        <label
                                          key={`google-${key}-${section}`}
                                          className="flex items-center gap-2 py-0.5"
                                        >
                                          <input
                                            type="checkbox"
                                            className="h-3.5 w-3.5 rounded border-gray-300 text-[#1F3D8A] focus:ring-[#1F3D8A]"
                                            checked={googleVisibleSectionSet.has(section)}
                                            onChange={() => toggleMetricSection('google', key, section)}
                                          />
                                          <span className="text-[10px] text-gray-700">
                                            {SECTION_LABELS[section]}
                                          </span>
                                        </label>
                                      ))}
                                    </div>
                                  </details>
                                </div>
                              )}
                            </td>
                            <td className="text-center px-2 py-2 align-middle">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 text-[#1F3D8A] focus:ring-[#1F3D8A] disabled:opacity-40"
                                checked={googleUsed}
                                disabled={!googleSupported}
                                onChange={() => toggleMetricUsage('google', key)}
                                aria-label={`Użyj metryki (Google) — ${label}`}
                              />
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}
          {!loading && !error && discovery && (
            <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-0.5">
                Wykryte z API (poza standardowym katalogiem)
              </h3>
              <p className="text-xs text-gray-600 mb-3">
                Te same wartości są już w głównej tabeli powyżej (wiersze z kluczami{' '}
                <code className="text-[10px]">dyn_meta_…</code> / <code className="text-[10px]">dyn_google_…</code>
                ). Poniżej podgląd do szybkiej weryfikacji nazw zwróconych przez API — nie trzeba
                dodawać ich ręcznie w kodzie.
              </p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {(platformView === 'both' || platformView === 'meta') && (
                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-800">Meta — action_type</span>
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          discovery.meta.dynamicConversionsFetchOk
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {discovery.meta.dynamicConversionsFetchOk ? 'API' : 'Brak / błąd'}
                      </span>
                    </div>
                    {(discovery.meta.dynamicConversions?.length ?? 0) > 0 &&
                      (discovery.meta.dynamicConversions ?? []).every((row) => (row.count ?? 0) <= 0) && (
                        <p className="text-[11px] text-amber-800 mb-2">
                          Wszystkie wykryte akcje mają 0 w tym okresie. Spróbuj przełączyć okres na{' '}
                          <span className="font-medium">Ostatni zamknięty</span>.
                        </p>
                      )}
                    {(discovery.meta.dynamicConversions?.length ?? 0) === 0 ? (
                      <p className="text-xs text-gray-500">
                        Brak niezerowych wpisów w tablicy <code className="text-[10px]">actions</code>{' '}
                        w kampaniach dla tego okresu (albo dane bez surowych akcji, np. tylko cache).
                      </p>
                    ) : (
                      <div className="max-h-56 overflow-y-auto text-xs">
                        <table className="w-full">
                          <thead>
                            <tr className="text-left text-gray-500 border-b border-gray-100">
                              <th className="py-1 pr-2 font-medium">Typ akcji</th>
                              <th className="py-1 pr-2 font-medium text-[10px] font-mono">Klucz (tabela)</th>
                              <th className="py-1 text-right font-medium w-20">Suma</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(discovery.meta.dynamicConversions ?? []).map((row) => (
                              <tr key={row.id} className="border-b border-gray-50">
                                <td className="py-1 pr-2 font-mono text-[11px] text-gray-800 break-all">
                                  {row.label}
                                </td>
                                <td className="py-1 pr-2 font-mono text-[10px] text-gray-500 break-all">
                                  {row.key}
                                </td>
                                <td className="py-1 text-right tabular-nums text-gray-900">
                                  {fmtVal(row.count)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
                {(platformView === 'both' || platformView === 'google') && (
                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-800">
                        Google — konwersje (nazwa akcji)
                      </span>
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          discovery.google.dynamicConversionsFetchOk
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {discovery.google.dynamicConversionsFetchOk ? 'API' : 'Błąd / brak'}
                      </span>
                    </div>
                    {!discovery.google.dynamicConversionsFetchOk &&
                      discovery.google.dynamicConversionsSkipReason && (
                        <p className="text-[10px] text-amber-800 mb-2">
                          {discovery.google.dynamicConversionsSkipReason}
                        </p>
                      )}
                    {(discovery.google.dynamicConversions?.length ?? 0) > 0 &&
                      (discovery.google.dynamicConversions ?? []).every((row) => (row.count ?? 0) <= 0) && (
                        <p className="text-[11px] text-amber-800 mb-2">
                          Wszystkie wykryte konwersje mają 0 w tym okresie. Spróbuj przełączyć okres na{' '}
                          <span className="font-medium">Ostatni zamknięty</span>.
                        </p>
                      )}
                    {(discovery.google.dynamicConversions?.length ?? 0) === 0 ? (
                      <p className="text-xs text-gray-500">
                        Brak danych albo konto Google nie jest skonfigurowane dla tego klienta.
                      </p>
                    ) : (
                      <div className="max-h-56 overflow-y-auto text-xs">
                        <table className="w-full">
                          <thead>
                            <tr className="text-left text-gray-500 border-b border-gray-100">
                              <th className="py-1 pr-2 font-medium">Konwersja</th>
                              <th className="py-1 pr-2 font-medium text-[10px] font-mono">Klucz (tabela)</th>
                              <th className="py-1 text-right font-medium w-16">Szt.</th>
                              <th className="py-1 text-right font-medium w-24">Wartość</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(discovery.google.dynamicConversions ?? []).map((row) => (
                              <tr key={row.id} className="border-b border-gray-50">
                                <td className="py-1 pr-2 text-[11px] text-gray-800 break-all">
                                  {row.label}
                                </td>
                                <td className="py-1 pr-2 font-mono text-[10px] text-gray-500 break-all">
                                  {row.key}
                                </td>
                                <td className="py-1 text-right tabular-nums text-gray-900">
                                  {fmtVal(row.count)}
                                </td>
                                <td className="py-1 text-right tabular-nums text-gray-700">
                                  {fmtVal(row.value ?? 0)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          {!loading && !error && discovery && rowKeysSorted.length === 0 && (
            <p className="text-sm text-gray-500 py-8 text-center border border-dashed border-gray-200 rounded-xl">
              Brak metryk z niezerowymi wartościami z API w ostatnim zamkniętym miesiącu ani w miesiącu
              wcześniejszym (Meta / Google).
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 px-4 sm:px-6 py-4 border-t border-gray-100 bg-gray-50/80 shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500 mr-auto">
            <Database className="h-3.5 w-3.5 text-[#1F3D8A] shrink-0" />
            <span>
              Źródło: snapshot API ({periodMode === 'current' ? 'bieżący miesiąc do dziś' : 'ostatni zamknięty miesiąc'})
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Zamknij
          </button>
          <button
            type="button"
            onClick={() => onSave()}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#1F3D8A] rounded-lg hover:bg-[#162d66] disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Zapisz konfigurację
          </button>
        </div>
      </div>
    </div>
  );
}
