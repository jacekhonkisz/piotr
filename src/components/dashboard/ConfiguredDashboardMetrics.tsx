'use client';

import React, { useMemo } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Coins,
  CreditCard,
  Eye,
  MousePointerClick,
  Percent,
  Target,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { useMetricsConfig } from '../../lib/useMetricsConfig';
import type { MetricConfigItem, MetricSection } from '../../lib/default-metrics-config';
import { getRegistryField } from '../../lib/metric-registry';

// ── Types ───────────────────────────────────────────────────────────────
type ActivityMetricKey =
  | 'totalSpend'
  | 'totalImpressions'
  | 'totalClicks'
  | 'averageCtr'
  | 'averageCpc';
type BusinessMetricKey =
  | 'reservations'
  | 'reservation_value'
  | 'roas'
  | 'cost_per_reservation';
type DashboardMetricKey = ActivityMetricKey | BusinessMetricKey;

interface ConfiguredDashboardMetricsProps {
  clientId: string;
  platform: 'meta' | 'google';
  currentSnapshot: Record<string, number>;
  /** Previous-MONTH snapshot — used for KPI deltas and as fallback comparison source. */
  previousMonthSnapshot?: Record<string, number> | null;
  /** Same-period-prior-year snapshot — preferred comparison source for YoY layout. */
  previousYearSnapshot?: Record<string, number> | null;
  periodLabel: string;
  /** Label for the previous-year column. */
  previousYearLabel?: string;
  /** Label for the previous-month column (used as fallback when YoY data is missing). */
  previousMonthLabel?: string;
  isLoading?: boolean;
  /** Optional re-render key to force animation/reset when client switches. */
  renderKey?: number | string;
  /** When provided, renders the "Otwórz szczegółowe raporty" CTA. */
  onOpenReports?: () => void;
}

// ── Formatters & helpers ────────────────────────────────────────────────
const safeNumber = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })
    .format(amount)
    .replace(/\s/g, '\u00A0');

const formatNumber = (num: number): string =>
  new Intl.NumberFormat('pl-PL').format(num);

const formatSignedPercent = (value: number) =>
  `${value > 0 ? '+' : ''}${new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)}%`;

const formatAbsolutePercent = (value: number) =>
  `${new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.abs(value))}%`;

const formatMetricValue = (key: string, value: number | null): string => {
  if (value == null) return '—';
  const field = getRegistryField(key);
  const format = field?.format;
  if (format === 'currency' || key === 'reservation_value' || key === 'cost_per_reservation' || key === 'totalSpend' || key === 'averageCpc') {
    return formatCurrency(value);
  }
  if (format === 'percentage' || key === 'averageCtr') {
    return `${new Intl.NumberFormat('pl-PL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)}%`;
  }
  if (key === 'roas') {
    return new Intl.NumberFormat('pl-PL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
  return formatNumber(Math.round(value));
};

// ── Metric definitions (single source-of-truth visual layout) ───────────
type IconType = typeof Target;
type LucideIconProps = React.ComponentProps<typeof Target>;

const businessMetricDefs: Array<{
  key: BusinessMetricKey;
  fallbackLabel: string;
  icon: IconType;
  iconClass: string;
  iconBgClass: string;
  lowerIsBetter?: boolean;
}> = [
  { key: 'reservations', fallbackLabel: 'Rezerwacje', icon: CalendarDays, iconClass: 'text-blue-700', iconBgClass: 'bg-blue-50' },
  { key: 'reservation_value', fallbackLabel: 'Wartość rezerwacji', icon: CreditCard, iconClass: 'text-emerald-700', iconBgClass: 'bg-emerald-50' },
  { key: 'roas', fallbackLabel: 'ROAS', icon: TrendingUp, iconClass: 'text-purple-700', iconBgClass: 'bg-purple-50' },
  { key: 'cost_per_reservation', fallbackLabel: 'Koszt rezerwacji', icon: WalletCards, iconClass: 'text-rose-700', iconBgClass: 'bg-rose-50', lowerIsBetter: true },
];

const activityMetricDefs: Array<{
  key: ActivityMetricKey;
  fallbackLabel: string;
  icon: IconType;
  iconClass: string;
  iconBgClass: string;
}> = [
  { key: 'totalSpend', fallbackLabel: 'Wydatki', icon: Coins, iconClass: 'text-blue-700', iconBgClass: 'bg-blue-50' },
  { key: 'totalImpressions', fallbackLabel: 'Wyświetlenia', icon: Eye, iconClass: 'text-emerald-700', iconBgClass: 'bg-emerald-50' },
  { key: 'totalClicks', fallbackLabel: 'Kliknięcia', icon: MousePointerClick, iconClass: 'text-purple-700', iconBgClass: 'bg-purple-50' },
  { key: 'averageCtr', fallbackLabel: 'CTR', icon: Percent, iconClass: 'text-teal-700', iconBgClass: 'bg-teal-50' },
  { key: 'averageCpc', fallbackLabel: 'CPC', icon: Coins, iconClass: 'text-indigo-700', iconBgClass: 'bg-indigo-50' },
];

const ICON_BY_KEY: Record<string, { icon: IconType; iconClass: string; iconBgClass: string }> = {
  totalSpend: { icon: Coins, iconClass: 'text-blue-700', iconBgClass: 'bg-blue-50' },
  totalImpressions: { icon: Eye, iconClass: 'text-emerald-700', iconBgClass: 'bg-emerald-50' },
  totalClicks: { icon: MousePointerClick, iconClass: 'text-purple-700', iconBgClass: 'bg-purple-50' },
  totalConversions: { icon: Target, iconClass: 'text-amber-700', iconBgClass: 'bg-amber-50' },
  averageCtr: { icon: Percent, iconClass: 'text-teal-700', iconBgClass: 'bg-teal-50' },
  averageCpc: { icon: Coins, iconClass: 'text-indigo-700', iconBgClass: 'bg-indigo-50' },
  reservations: { icon: CalendarDays, iconClass: 'text-blue-700', iconBgClass: 'bg-blue-50' },
  reservation_value: { icon: CreditCard, iconClass: 'text-emerald-700', iconBgClass: 'bg-emerald-50' },
  roas: { icon: TrendingUp, iconClass: 'text-purple-700', iconBgClass: 'bg-purple-50' },
  cost_per_reservation: { icon: WalletCards, iconClass: 'text-rose-700', iconBgClass: 'bg-rose-50' },
  click_to_call: { icon: Target, iconClass: 'text-violet-700', iconBgClass: 'bg-violet-50' },
  email_contacts: { icon: Target, iconClass: 'text-yellow-700', iconBgClass: 'bg-yellow-50' },
  booking_step_1: { icon: ArrowUpRight, iconClass: 'text-blue-700', iconBgClass: 'bg-blue-50' },
  booking_step_2: { icon: ArrowUpRight, iconClass: 'text-blue-700', iconBgClass: 'bg-blue-50' },
  booking_step_3: { icon: ArrowUpRight, iconClass: 'text-blue-700', iconBgClass: 'bg-blue-50' },
};

const iconFor = (key: string) =>
  ICON_BY_KEY[key] ?? { icon: Target, iconClass: 'text-slate-700', iconBgClass: 'bg-slate-50' };

// ── Component ───────────────────────────────────────────────────────────
export default function ConfiguredDashboardMetrics({
  clientId,
  platform,
  currentSnapshot,
  previousMonthSnapshot = null,
  previousYearSnapshot = null,
  periodLabel,
  previousYearLabel,
  previousMonthLabel,
  isLoading = false,
  renderKey,
  onOpenReports,
}: ConfiguredDashboardMetricsProps) {
  const { config, getMetricName, getVisibleMetrics } = useMetricsConfig(clientId, platform);

  // ── Comparison source resolution ─────────────────────────────────────
  // Prefer prior-YEAR (YoY); fall back to prior-MONTH so platforms without
  // long historical data (e.g. Google Ads) still render the comparison layout
  // identical to platforms that do (e.g. Meta).
  const previousYearSpendValue = previousYearSnapshot ? safeNumber(previousYearSnapshot.totalSpend) : null;
  const hasYearData =
    !!previousYearSnapshot && previousYearSpendValue !== null && previousYearSpendValue > 0;

  const previousMonthSpendValue = previousMonthSnapshot ? safeNumber(previousMonthSnapshot.totalSpend) : null;
  const hasMonthData =
    !!previousMonthSnapshot && previousMonthSpendValue !== null && previousMonthSpendValue > 0;

  type ComparisonMode = 'year' | 'month' | 'none';
  const comparisonMode: ComparisonMode = hasYearData ? 'year' : hasMonthData ? 'month' : 'none';
  const comparisonSnapshot: Record<string, number> | null =
    comparisonMode === 'year' ? previousYearSnapshot : comparisonMode === 'month' ? previousMonthSnapshot : null;
  const comparisonLabel =
    comparisonMode === 'year'
      ? previousYearLabel ?? 'Poprzedni rok'
      : comparisonMode === 'month'
      ? previousMonthLabel ?? 'Poprzedni miesiąc'
      : 'Brak danych';
  const comparisonSectionTitle =
    comparisonMode === 'year'
      ? 'Porównanie rok do roku'
      : comparisonMode === 'month'
      ? 'Porównanie z poprzednim miesiącem'
      : 'Wyniki biznesowe';
  const comparisonDescriptionSuffix =
    comparisonMode === 'year'
      ? 'w stosunku do analogicznego okresu rok temu'
      : comparisonMode === 'month'
      ? 'w stosunku do poprzedniego miesiąca'
      : 'w stosunku do okresu porównawczego';

  const visibleKpiCards: MetricConfigItem[] = useMemo(
    () => getVisibleMetrics('kpi_cards'),
    [getVisibleMetrics]
  );

  // Label resolution priority (mirrors what users intuitively expect from the
  // admin Metryki page: "rename anywhere, see it on the dashboard"):
  //   1. customName from the KPI Cards section (the section the dashboard is
  //      built from — highest priority so admins can rename "in-place").
  //   2. customName from the Contact/Report-summary section the metric
  //      semantically belongs to (so admins editing only "raport" still see
  //      the rename on the dashboard).
  //   3. customName from any other section as a last resort.
  //   4. defaultName from the same section (kpi_cards first, then semantic
  //      section), then the hardcoded fallback.
  const getDashboardMetricLabel = (key: DashboardMetricKey, fallback: string) => {
    const sectionForLookup: MetricSection = key === 'cost_per_reservation' ? 'contact' : 'report_summary';
    const kpiCustom = config.find((item) => item.section === 'kpi_cards' && item.key === key && item.customName)?.customName;
    if (kpiCustom) return kpiCustom;
    const semanticCustom = config.find((item) => item.section === sectionForLookup && item.key === key && item.customName)?.customName;
    if (semanticCustom) return semanticCustom;
    const anyCustom = config.find((item) => item.key === key && item.customName)?.customName;
    if (anyCustom) return anyCustom;
    const kpiLabel = getMetricName('kpi_cards', key);
    if (kpiLabel && kpiLabel !== key) return kpiLabel;
    const configuredLabel = getMetricName(sectionForLookup, key);
    return configuredLabel && configuredLabel !== key ? configuredLabel : fallback;
  };

  const getMetricValue = (
    key: string,
    snapshot?: Record<string, number> | null
  ): number | null => (snapshot ? safeNumber(snapshot[key]) : null);

  const buildDelta = (
    current: number | null,
    previous: number | null,
    lowerIsBetter?: boolean,
    neutral?: boolean
  ) => {
    if (current == null || previous == null) {
      return { label: '—', tone: 'text-slate-500', improved: false, percent: null as number | null };
    }
    if (previous === 0 && current > 0) {
      return { label: 'nowe', tone: neutral ? 'text-slate-600' : 'text-emerald-600', improved: !neutral, percent: null as number | null };
    }
    if (previous === 0 && current === 0) {
      return { label: '0,0%', tone: 'text-slate-500', improved: false, percent: 0 };
    }
    const rawPercent = ((current - previous) / previous) * 100;
    const improved = lowerIsBetter ? rawPercent < 0 : rawPercent > 0;
    const tone = neutral ? 'text-slate-600' : improved ? 'text-emerald-600' : rawPercent === 0 ? 'text-slate-500' : 'text-rose-600';
    return { label: formatSignedPercent(rawPercent), tone, improved, percent: rawPercent };
  };

  // Business metrics — compared against the resolved comparison snapshot
  // (prior-year when available, otherwise prior-month).
  const businessMetrics = businessMetricDefs.map((definition, index) => {
    const current = getMetricValue(definition.key, currentSnapshot);
    const previous = getMetricValue(definition.key, comparisonSnapshot);
    return {
      ...definition,
      order: index,
      label: getDashboardMetricLabel(definition.key, definition.fallbackLabel),
      current,
      previous,
      delta: buildDelta(current, previous, definition.lowerIsBetter),
    };
  });

  // ── Najważniejsze zmiany / highlights ──
  const spendFallbackMetricDef = activityMetricDefs[0]; // totalSpend
  const spendFallbackMetric = spendFallbackMetricDef
    ? {
        ...spendFallbackMetricDef,
        order: 99,
        label: getDashboardMetricLabel(spendFallbackMetricDef.key, spendFallbackMetricDef.fallbackLabel),
        current: getMetricValue(spendFallbackMetricDef.key, currentSnapshot),
        previous: getMetricValue(spendFallbackMetricDef.key, comparisonSnapshot),
        delta: buildDelta(
          getMetricValue(spendFallbackMetricDef.key, currentSnapshot),
          getMetricValue(spendFallbackMetricDef.key, comparisonSnapshot),
          false,
          true
        ),
        neutralDelta: true as const,
      }
    : undefined;

  type BusinessMetric = (typeof businessMetrics)[number];
  type HighlightMetric = BusinessMetric | NonNullable<typeof spendFallbackMetric>;

  const isDashboardMetric = (m: HighlightMetric | undefined): m is HighlightMetric => Boolean(m);
  const isMeaningfulHighlight = (m: HighlightMetric) =>
    m.current !== null &&
    m.previous !== null &&
    (m.delta.label === 'nowe' || (m.delta.percent !== null && Math.abs(m.delta.percent) >= 0.1));

  const getBusinessMetricByKey = (key: BusinessMetricKey) =>
    businessMetrics.find((m) => m.key === key && isMeaningfulHighlight(m));

  const primaryHighlights = [
    getBusinessMetricByKey('reservation_value'),
    getBusinessMetricByKey('reservations'),
  ].filter(isDashboardMetric);

  const roasHighlight = getBusinessMetricByKey('roas');
  const costPerReservationHighlight = getBusinessMetricByKey('cost_per_reservation');
  const efficiencyHighlight =
    roasHighlight && costPerReservationHighlight
      ? Math.abs(roasHighlight.delta.percent ?? 0) >= Math.abs(costPerReservationHighlight.delta.percent ?? 0)
        ? roasHighlight
        : costPerReservationHighlight
      : roasHighlight || costPerReservationHighlight;

  const spendHighlight =
    spendFallbackMetric && isMeaningfulHighlight(spendFallbackMetric) ? spendFallbackMetric : undefined;

  const highlights = [
    ...primaryHighlights,
    efficiencyHighlight,
    roasHighlight,
    costPerReservationHighlight,
    spendHighlight,
  ]
    .filter((m, i, all): m is HighlightMetric => {
      if (!m) return false;
      return all.findIndex((it) => it?.key === m.key) === i;
    })
    .slice(0, 3);

  const getHighlightTone = (m: HighlightMetric) => {
    if (('neutralDelta' in m && m.neutralDelta) || m.delta.label === '—') {
      return { icon: 'bg-slate-100 text-slate-600', value: 'text-slate-700', border: 'border-slate-200/80' };
    }
    return m.delta.improved
      ? { icon: 'bg-emerald-50 text-emerald-700', value: 'text-emerald-700', border: 'border-emerald-100' }
      : { icon: 'bg-rose-50 text-rose-700', value: 'text-rose-700', border: 'border-rose-100' };
  };

  const getHighlightDescription = (m: HighlightMetric) => {
    if (m.delta.label === 'nowe') {
      return `nowe — ${m.label} pojawił(a) się ${comparisonDescriptionSuffix}.`;
    }
    if (m.delta.percent === null) {
      return `— — ${m.label} nie ma pełnego porównania ${comparisonDescriptionSuffix}.`;
    }
    const absoluteDelta = formatAbsolutePercent(m.delta.percent);
    const direction = m.delta.percent >= 0 ? 'increase' : 'decrease';
    let phrase: string;
    if (m.key === 'reservation_value') {
      phrase = direction === 'increase' ? `${m.label} wzrosła o ${absoluteDelta}` : `${m.label} spadła o ${absoluteDelta}`;
    } else if (m.key === 'reservations') {
      phrase = direction === 'increase' ? `${m.label} wzrosły o ${absoluteDelta}` : `${m.label} spadły o ${absoluteDelta}`;
    } else if (m.key === 'roas' || m.key === 'cost_per_reservation') {
      phrase = direction === 'increase' ? `${m.label} wzrósł o ${absoluteDelta}` : `${m.label} spadł o ${absoluteDelta}`;
    } else {
      phrase = direction === 'increase' ? `${m.label} wzrosły o ${absoluteDelta}` : `${m.label} spadły o ${absoluteDelta}`;
    }
    return `${m.delta.label} — ${phrase} ${comparisonDescriptionSuffix}.`;
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6" key={renderKey}>
      {/* KPI cards — configurable from /admin/metrics-config (kpi_cards section) */}
      {visibleKpiCards.length > 0 && (
        <section
          className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 sm:p-6"
          aria-labelledby="kpi-cards-title"
        >
          <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="kpi-cards-title" className="text-base font-bold text-slate-950">
                Karty KPI
              </h2>
              <p className="mt-1 text-sm text-slate-500">{periodLabel}</p>
            </div>
            <span className="text-xs font-medium text-slate-400">
              {visibleKpiCards.length} {visibleKpiCards.length === 1 ? 'metryka' : 'metryki'}
            </span>
          </div>
          <div className={`grid gap-4 ${visibleKpiCards.length <= 3 ? 'md:grid-cols-2 xl:grid-cols-3' : 'md:grid-cols-2 xl:grid-cols-4'}`}>
            {visibleKpiCards.map((cfg) => {
              const meta = iconFor(cfg.key);
              const Icon = meta.icon;
              const value = getMetricValue(cfg.key, currentSnapshot);
              const prev = getMetricValue(cfg.key, previousMonthSnapshot);
              const delta = buildDelta(value, prev);
              const label = cfg.customName || cfg.defaultName;
              return (
                <article
                  key={`kpi-${cfg.key}`}
                  className="flex flex-col gap-3 rounded-2xl bg-slate-50/70 p-4 ring-1 ring-slate-100"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${meta.iconBgClass}`}>
                      <Icon className={`h-5 w-5 ${meta.iconClass}`} />
                    </div>
                    {prev !== null && (
                      <span className={`whitespace-nowrap text-xs font-bold ${delta.tone}`}>{delta.label}</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">{label}</p>
                    <p className="mt-1 whitespace-nowrap text-2xl font-bold text-slate-950 tabular-nums">
                      {isLoading ? '—' : formatMetricValue(cfg.key, value)}
                    </p>
                    {prev !== null && (
                      <p className="mt-1 text-xs text-slate-400">
                        Poprz. miesiąc: <span className="tabular-nums">{formatMetricValue(cfg.key, prev)}</span>
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/*
        Comparison + Najważniejsze zmiany — always rendered (parity across platforms).
        Comparison source is prior-year when available, prior-month otherwise.
      */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.85fr)]">
        <section
          className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 sm:p-6"
          aria-labelledby="comparison-title"
        >
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="comparison-title" className="text-base font-bold text-slate-950">
                {comparisonSectionTitle}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {comparisonMode === 'none'
                  ? periodLabel
                  : `${periodLabel} vs ${comparisonLabel}`}
              </p>
            </div>
            <div className="flex items-center gap-5 text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#062b6f]" />
                {periodLabel}
              </span>
              {comparisonMode !== 'none' && (
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  {comparisonLabel}
                </span>
              )}
            </div>
          </div>
          <div className="space-y-4">
            {businessMetrics.map((metric) => {
              const Icon = metric.icon;
              const current = metric.current;
              const previous = metric.previous;
              const currentAbs = Math.abs(current ?? 0);
              const previousAbs = Math.abs(previous ?? 0);
              const maxValue = Math.max(currentAbs, previousAbs);
              const currentWidth = current !== null && maxValue > 0 ? (currentAbs / maxValue) * 100 : 0;
              const previousWidth = previous !== null && maxValue > 0 ? (previousAbs / maxValue) * 100 : 0;

              return (
                <div
                  key={`comparison-${metric.key}`}
                  className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-4 border-b border-slate-100 pb-4 last:border-b-0 last:pb-0"
                >
                  <div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${metric.iconBgClass}`}>
                    <Icon className={`h-5 w-5 ${metric.iconClass}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <p className="text-sm font-bold text-slate-900">{metric.label}</p>
                      <p className={`whitespace-nowrap text-sm font-bold ${metric.delta.tone}`}>{metric.delta.label}</p>
                    </div>
                    <div className="space-y-2.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="h-2.5 min-w-0 flex-1 rounded-full bg-slate-100">
                          <div className="h-2.5 rounded-full bg-[#062b6f]" style={{ width: `${currentWidth}%` }} />
                        </div>
                        <span className="w-24 shrink-0 whitespace-nowrap text-right text-xs font-semibold text-slate-900 tabular-nums sm:w-32">
                          {formatMetricValue(metric.key, current)}
                        </span>
                      </div>
                      {comparisonMode !== 'none' && (
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="h-2.5 min-w-0 flex-1 rounded-full bg-slate-100">
                            <div className="h-2.5 rounded-full bg-slate-300" style={{ width: `${previousWidth}%` }} />
                          </div>
                          <span className="w-24 shrink-0 whitespace-nowrap text-right text-xs font-semibold text-slate-500 tabular-nums sm:w-32">
                            {formatMetricValue(metric.key, previous)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section
          className="rounded-3xl bg-white/80 p-5 ring-1 ring-slate-200/70 sm:p-6"
          aria-labelledby="highlights-title"
        >
          <h2
            id="highlights-title"
            className="text-lg font-bold tracking-tight text-slate-950 sm:text-xl xl:text-lg 2xl:text-xl"
          >
            Najważniejsze zmiany
          </h2>
          <div className="mt-5 space-y-5 sm:mt-6">
            {(highlights.length > 0 ? highlights : businessMetrics.slice(0, 3)).map((metric) => {
              const tone = getHighlightTone(metric as HighlightMetric);
              const Icon = (metric as HighlightMetric).icon;
              return (
                <div
                  key={`highlight-${metric.key}`}
                  className={`flex min-w-0 gap-4 border-b pb-5 last:border-b-0 last:pb-0 ${tone.border}`}
                >
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone.icon}`}>
                    <Icon className="h-5 w-5 sm:h-6 sm:w-6 xl:h-5 xl:w-5 2xl:h-6 2xl:w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <p className="text-base font-semibold leading-tight text-slate-900 xl:text-[15px] 2xl:text-base">
                        {(metric as HighlightMetric).label}
                      </p>
                      <p className={`text-base font-bold leading-tight xl:text-[15px] 2xl:text-base ${tone.value}`}>
                        {(metric as HighlightMetric).delta.label}
                      </p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-[15px] xl:text-sm 2xl:text-[15px]">
                      {getHighlightDescription(metric as HighlightMetric)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Reports CTA */}
      {onOpenReports && (
        <section className="flex flex-col gap-4 rounded-2xl bg-blue-50/70 px-5 py-4 ring-1 ring-blue-100/80 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100/80 text-[#062b6f]">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-950">Chcesz zobaczyć szczegóły?</h2>
              <p className="mt-1 text-sm text-slate-600">
                Pełne kampanie, konwersje, demografia i umiejscowienia są dostępne w szczegółowych raportach.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenReports}
            className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-2 rounded-xl bg-[#062b6f] px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-950/10 transition hover:bg-[#05255f]"
          >
            Otwórz szczegółowe raporty
            <ArrowRight className="h-4 w-4" />
          </button>
        </section>
      )}
    </div>
  );
}
