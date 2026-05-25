'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  CalendarCheck,
  ChevronDown,
  Eye,
  MapPin,
  MousePointerClick,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import {
  POLAND_MAP_VIEW_BOX,
  POLAND_VOIVODESHIPS,
  VOIVODESHIP_BY_CODE,
  heatmapColor,
  type VoivodeshipShape,
} from '@/lib/poland-voivodeships';
import { formatPolishCityName, formatPolishCountryName, resolvePolishVoivodeshipCode } from '@/lib/polish-geo-display';

// Shape that matches GoogleAdsGeographicPerformance from src/lib/google-ads-api.ts.
// We accept the loose any-typed payload that flows through the API route so
// this component does not need a separate transformation step.
export interface GeographicRow {
  cityName?: string;
  regionName?: string;
  regionCode?: string | null;
  countryName?: string | null;
  countryCode?: string | null;
  spend?: number;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  reservations?: number;
  conversion_value?: number;
  reservation_value?: number;
  roas?: number;
}

export type MapMetric = 'spend' | 'clicks' | 'impressions' | 'conversions' | 'conversion_value';

export interface RegionMetricOption {
  value: MapMetric;
  label: string;
}

interface PolandRegionMapProps {
  data: GeographicRow[];
  /** Which metric drives the heatmap intensity. */
  metric?: MapMetric;
  /** Optional title rendered above the map. */
  title?: string;
  /** Optional title rendered in the main card header. */
  sectionTitle?: string;
  /** Optional subtitle rendered in the main card header. */
  sectionSubtitle?: string;
  /** Existing metric selector options from report configuration. */
  metricOptions?: RegionMetricOption[];
  /** Existing metric state setter from the parent report. */
  onMetricChange?: (metric: MapMetric) => void;
  /** Platform label used in the campaign-total reconciliation header. */
  platformLabel?: string;
  /**
   * Optional account/campaign totals for the same period. When provided, the
   * map renders a "Nieznana lokalizacja" bucket equal to
   * `campaignTotals[metric] - sum(geographic_view[metric])` so the side panel
   * reconciles back to the campaign-level KPI even though Google's
   * `geographic_view` does not return rows for every conversion.
   */
  campaignTotals?: {
    spend?: number;
    impressions?: number;
    clicks?: number;
    conversions?: number;
    conversion_value?: number;
  } | null;
}

interface RegionAggregate {
  code: string;
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_value: number;
  cities: { name: string; spend: number; impressions: number; clicks: number; conversions: number; conversion_value: number }[];
}

interface CountryAggregate {
  code: string;
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_value: number;
}

const formatPLN = (v: number): string =>
  new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(v);
const formatInt = (v: number): string => new Intl.NumberFormat('pl-PL').format(Math.round(v));

const METRIC_LABELS: Record<MapMetric, string> = {
  spend: 'Wydatki',
  impressions: 'Wyświetlenia',
  clicks: 'Kliknięcia',
  conversions: 'Konwersje',
  conversion_value: 'Wartość konwersji',
};

const METRIC_GENITIVE_LABELS: Record<MapMetric, string> = {
  spend: 'wydatków',
  impressions: 'wyświetleń',
  clicks: 'kliknięć',
  conversions: 'konwersji',
  conversion_value: 'wartości konwersji',
};

const METRIC_ICONS: Record<MapMetric, LucideIcon> = {
  spend: WalletCards,
  impressions: Eye,
  clicks: MousePointerClick,
  conversions: CalendarCheck,
  conversion_value: BarChart3,
};

const TOP_REGION_BAR_COLORS = ['#071842', '#1f5fbf', '#4f8ee8', '#8db8f7', '#bfdbfe'];

const PolandRegionMap: React.FC<PolandRegionMapProps> = ({
  data,
  metric = 'conversion_value',
  title = 'Wydajność wg regionów',
  sectionTitle = 'Regiony',
  sectionSubtitle = 'Wyniki według regionów i miast',
  metricOptions,
  onMetricChange,
  platformLabel = 'Google Ads',
  campaignTotals = null,
}) => {
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  /** When true, anchor tooltip to the right edge (hover was on left half of map). */
  const [tooltipAlignEnd, setTooltipAlignEnd] = useState(true);
  const mapAreaRef = useRef<HTMLDivElement>(null);

  const updateTooltipSideFromPathElement = useCallback((pathEl: Element) => {
    const container = mapAreaRef.current;
    if (!container) return;
    const cr = container.getBoundingClientRect();
    const pr = pathEl.getBoundingClientRect();
    const pathCenterX = (pr.left + pr.right) / 2;
    const containerCenterX = (cr.left + cr.right) / 2;
    // Hovered region sits on the left → park card on the right; vice versa.
    setTooltipAlignEnd(pathCenterX < containerCenterX);
  }, []);

  /**
   * Aggregate per voivodeship code. Rows whose `regionCode` is null (e.g.
   * non-Polish geo, or a Polish region we couldn't normalize) are bucketed
   * separately under '__unmatched__' and listed beside the map.
   */
  const {
    byCode,
    unmatchedPoland,
    foreignByCountry,
    maxValue,
    totalMetric,
    geographicViewTotal,
    unknownLocationMetric,
  } = useMemo(() => {
    const acc = new Map<string, RegionAggregate>();
    const foreignByCountry = new Map<string, CountryAggregate>();
    const unmatchedPoland: RegionAggregate = {
      code: '__unmatched__',
      name: 'Polska - inne / nieznane',
      spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0,
      cities: [],
    };

    for (const row of data || []) {
      const isForeign = !!row.countryCode && row.countryCode !== 'PL';
      if (isForeign) {
        const countryKey = row.countryCode || row.countryName || '__foreign__';
        const country = foreignByCountry.get(countryKey) ?? {
          code: countryKey,
          name: row.countryName || row.countryCode || 'Zagranica / Nieznane',
          spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0,
        };
        country.spend += row.spend || 0;
        country.impressions += row.impressions || 0;
        country.clicks += row.clicks || 0;
        country.conversions += row.conversions || 0;
        country.conversion_value += row.conversion_value || row.reservation_value || 0;
        foreignByCountry.set(countryKey, country);
        continue;
      }

      const code = resolvePolishVoivodeshipCode(row);
      const target = code && VOIVODESHIP_BY_CODE[code]
        ? acc.get(code) ?? ({
          code,
          name: VOIVODESHIP_BY_CODE[code]!.name,
          spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0,
          cities: [],
        } as RegionAggregate)
        : unmatchedPoland;

      target.spend += row.spend || 0;
      target.impressions += row.impressions || 0;
      target.clicks += row.clicks || 0;
      target.conversions += row.conversions || 0;
      target.conversion_value += row.conversion_value || row.reservation_value || 0;

      if (row.cityName && row.cityName !== '(nieznane)') {
        target.cities.push({
          name: formatPolishCityName(row.cityName),
          spend: row.spend || 0,
          impressions: row.impressions || 0,
          clicks: row.clicks || 0,
          conversions: row.conversions || 0,
          conversion_value: row.conversion_value || row.reservation_value || 0,
        });
      }

      if (code && VOIVODESHIP_BY_CODE[code]) {
        acc.set(code, target);
      }
    }

    // Sort cities within each region for the tooltip top-list
    for (const region of acc.values()) {
      region.cities.sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0));
    }

    const values = Array.from(acc.values()).map((r) => r[metric] ?? 0);
    const maxValue = values.length > 0 ? Math.max(...values) : 0;
    const foreignTotal = Array.from(foreignByCountry.values()).reduce((s, country) => s + (country[metric] ?? 0), 0);
    const geographicViewTotal = values.reduce((s, v) => s + v, 0) + (unmatchedPoland[metric] ?? 0) + foreignTotal;

    // When the parent supplies campaign-level totals, surface the gap as
    // "Nieznana lokalizacja" — Google's geographic_view does not return rows
    // for every conversion (anonymized geo, PMax automation, view-through),
    // so this bucket is what makes the map total reconcile to the KPI.
    const campaignMetricTotal = campaignTotals?.[metric];
    const unknownLocationMetric =
      typeof campaignMetricTotal === 'number'
        ? Math.max(0, campaignMetricTotal - geographicViewTotal)
        : 0;
    const totalMetric =
      typeof campaignMetricTotal === 'number'
        ? campaignMetricTotal
        : geographicViewTotal;

    return {
      byCode: acc,
      unmatchedPoland,
      foreignByCountry,
      maxValue,
      totalMetric,
      geographicViewTotal,
      unknownLocationMetric,
    };
  }, [data, metric, campaignTotals]);

  const hovered = hoveredCode ? byCode.get(hoveredCode) : null;
  const hoveredShape: VoivodeshipShape | null = hoveredCode
    ? VOIVODESHIP_BY_CODE[hoveredCode] ?? null
    : null;
  const isMetaMap = platformLabel.toLowerCase().includes('meta');
  const formatMetricValue = (v: number, metricKey: MapMetric) => {
    if (!Number.isFinite(v)) return '—';
    return metricKey === 'spend' || metricKey === 'conversion_value' ? formatPLN(v) : formatInt(v);
  };
  const tooltipMetrics: MapMetric[] = isMetaMap
    ? (['spend', 'clicks', 'impressions'] as MapMetric[]).sort((a, b) => {
        if (a === metric) return -1;
        if (b === metric) return 1;
        return 0;
      })
    : ['conversion_value', 'clicks', 'spend'];

  const topRegionsLimit = 5;
  const topRegions = useMemo(() => {
    return Array.from(byCode.values())
      .filter((r) => (r[metric] ?? 0) > 0)
      .sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0))
      .slice(0, topRegionsLimit);
  }, [byCode, metric, topRegionsLimit]);

  const foreignRows = useMemo(() => {
    return Array.from(foreignByCountry.values())
      .filter((country) => (country[metric] ?? 0) > 0)
      .sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0))
      .slice(0, 5);
  }, [foreignByCountry, metric]);

  const formatMetric = (v: number) => formatMetricValue(v, metric);
  const activeMetricLabel =
    metricOptions?.find((option) => option.value === metric)?.label ?? METRIC_LABELS[metric];
  const metricSelectorOptions = metricOptions?.length
    ? metricOptions
    : [{ value: metric, label: activeMetricLabel }];
  const ActiveMetricIcon = METRIC_ICONS[metric] ?? BarChart3;
  const topRegionMax = topRegions[0]?.[metric] ?? 0;
  const hasGeographicRows = (data?.length ?? 0) > 0;
  const locationRowsExceedCampaignTotal =
    !!campaignTotals &&
    hasGeographicRows &&
    geographicViewTotal > totalMetric + 0.0001;
  const summaryTotalValue = hasGeographicRows || campaignTotals ? formatMetric(totalMetric) : '—';
  const summaryLocationValue = hasGeographicRows ? formatMetric(geographicViewTotal) : '—';
  const summaryLocationLabel = locationRowsExceedCampaignTotal
    ? 'suma wierszy lokalizacji'
    : 'z czego z lokalizacji';
  const geographicCoverage = totalMetric > 0 ? geographicViewTotal / totalMetric : 1;
  const hasLowGeographicCoverage =
    !!campaignTotals &&
    totalMetric > 0 &&
    geographicViewTotal > 0 &&
    geographicCoverage < 0.05;
  const hasNoGeographicMetricAssignment =
    !!campaignTotals &&
    totalMetric > 0 &&
    geographicViewTotal === 0 &&
    unknownLocationMetric > 0;

  return (
    <section className="overflow-hidden rounded-[1.65rem] border border-slate-200/80 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-slate-950">{sectionTitle}</h3>
          <p className="mt-1 text-sm text-slate-500">{sectionSubtitle}</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="text-[11px] font-semibold text-slate-500">Metryka:</span>
          <div className="relative">
            <ActiveMetricIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-700" />
            <select
              value={metric}
              onChange={(e) => onMetricChange?.(e.target.value as MapMetric)}
              disabled={!onMetricChange}
              aria-label="Wybierz metrykę mapy regionów"
              className="h-10 min-w-[13rem] appearance-none rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-sm font-semibold text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.05)] outline-none transition hover:border-blue-200 hover:bg-blue-50/30 focus:border-blue-300 focus:ring-4 focus:ring-blue-100 disabled:cursor-default disabled:opacity-100"
            >
              {metricSelectorOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-7 px-5 py-6 sm:px-7 lg:grid-cols-[minmax(0,1.6fr)_minmax(310px,0.95fr)]">
        {/* Map */}
        <div className="min-w-0">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#071842] shadow-[0_8px_18px_rgba(7,24,66,0.18)]">
              <MapPin className="h-5 w-5 text-white" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-950">{title}</h4>
              <p className="mt-0.5 text-xs leading-5 text-slate-500">
                Mapa cieplna — {activeMetricLabel.toLowerCase()} wg województw; zagranica w podsumowaniu
              </p>
            </div>
          </div>

          <div ref={mapAreaRef} className="relative min-h-[290px] overflow-visible">
            {/* Slightly inset + max width so the hover card does not cover the whole country */}
            <div className="flex justify-center px-0 pb-3 pt-2 sm:px-3 sm:pb-4">
              <div className="w-[94%] max-w-[min(100%,590px)]">
                {!hasGeographicRows ? (
                  <div className="flex min-h-[290px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/70 px-6 text-center">
                    <MapPin className="mb-3 h-8 w-8 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-700">Brak danych geograficznych dla wybranego okresu.</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Dane pojawiają się, gdy kampanie wyświetlają się użytkownikom o znanej lokalizacji.
                    </p>
                  </div>
                ) : (
                  <svg
                    viewBox={POLAND_MAP_VIEW_BOX}
                    className="w-full h-auto drop-shadow-[0_18px_30px_rgba(15,23,42,0.08)]"
                    role="img"
                    aria-label={`Mapa Polski - ${activeMetricLabel} wg województw`}
                  >
                    {POLAND_VOIVODESHIPS.map((v) => {
                      const agg = byCode.get(v.code);
                      const value = agg ? (agg[metric] ?? 0) : 0;
                      const normalized = maxValue > 0 ? value / maxValue : 0;
                      const fill = heatmapColor(normalized, value > 0);
                      const isHovered = hoveredCode === v.code;
                      return (
                        <motion.path
                          key={v.code}
                          data-voiv={v.code}
                          d={v.path}
                          fill={fill}
                          stroke={isHovered ? '#071842' : 'rgba(15,39,66,0.2)'}
                          strokeWidth={isHovered ? 2 : 1}
                          style={{ cursor: agg ? 'pointer' : 'default', transition: 'stroke 120ms, stroke-width 120ms, fill 120ms' }}
                          onMouseEnter={(e) => {
                            setHoveredCode(v.code);
                            updateTooltipSideFromPathElement(e.currentTarget);
                          }}
                          onMouseLeave={() => setHoveredCode((c) => (c === v.code ? null : c))}
                        />
                      );
                    })}
                  </svg>
                )}
              </div>
            </div>

            {/* Hover tooltip — flips left/right so it stays off the hovered region */}
            {hovered && hoveredShape && (
              <div
                className={`absolute top-3 z-10 max-w-sm w-[min(100%,20rem)] sm:top-4 bg-white/95 backdrop-blur-sm rounded-xl border border-slate-200 shadow-lg p-3 sm:p-4 text-sm pointer-events-none ${
                  tooltipAlignEnd ? 'right-3 sm:right-4 left-auto' : 'left-3 sm:left-4 right-auto'
                }`}
              >
                <div className="font-semibold text-slate-900 mb-2">{hovered.name}</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-600">
                  {tooltipMetrics.map((metricKey) => (
                    <React.Fragment key={metricKey}>
                      <div className={metricKey === metric ? 'font-semibold text-slate-800' : undefined}>
                        {METRIC_LABELS[metricKey]}:
                      </div>
                      <div className={`text-right tabular-nums font-medium text-slate-900 ${metricKey === metric ? 'font-semibold' : ''}`}>
                        {formatMetricValue(hovered[metricKey] ?? 0, metricKey)}
                      </div>
                    </React.Fragment>
                  ))}
                </div>
                {hovered.cities.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                      Top miasta wg {activeMetricLabel.toLowerCase()}
                    </div>
                    <div className="space-y-0.5">
                      {hovered.cities.slice(0, 3).map((c) => (
                        <div key={c.name} className="flex justify-between text-xs">
                          <span className="text-slate-700">{c.name}</span>
                          <span className="tabular-nums text-slate-900 font-medium">
                            {formatMetric(c[metric] ?? 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="mt-3 flex items-center justify-center gap-3 text-[11px] font-medium text-slate-500">
            <span>Niska wartość</span>
            <div className="h-2 w-44 overflow-hidden rounded-full bg-gradient-to-r from-[#dbeafe] via-[#5b9bed] to-[#071842]" />
            <span>Wysoka wartość</span>
          </div>
        </div>

        {/* Side panel - summary + top voivodeships */}
        <div className="min-w-0">
          <div className="rounded-2xl bg-gradient-to-br from-blue-50 via-slate-50 to-white p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              {campaignTotals ? `Łącznie (kampanie ${platformLabel})` : 'Łącznie (Polska + zagranica)'}
            </div>
            <div className="mt-2 text-3xl font-bold tracking-tight tabular-nums text-slate-950">{summaryTotalValue}</div>
            <div className="mt-1 text-xs text-slate-500 tabular-nums">
              {summaryLocationLabel}: {summaryLocationValue}
            </div>
            {locationRowsExceedCampaignTotal && (
              <div className="mt-1 text-[11px] leading-4 text-slate-400">
                Wiersze lokalizacji nie sumują się do KPI kampanii.
              </div>
            )}
          </div>

          {(hasNoGeographicMetricAssignment || hasLowGeographicCoverage) && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
              <strong>Brak wiarygodnego podziału geograficznego dla tej metryki.</strong>{' '}
              {hasNoGeographicMetricAssignment
                ? `API zwróciło 0 ${METRIC_GENITIVE_LABELS[metric]} z lokalizacji, mimo że kampanie mają ${formatMetric(totalMetric)}.`
                : `API przypisało geograficznie tylko ${formatMetric(geographicViewTotal)} z ${formatMetric(totalMetric)} (${(geographicCoverage * 100).toFixed(1)}%).`}
              {' '}Mapa dla tej metryki nie powinna być traktowana jako realny podział województw.
            </div>
          )}

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div className="text-sm font-bold text-slate-900">Najlepsze regiony</div>
              <div className="text-xs font-medium text-slate-500">{activeMetricLabel}</div>
            </div>
            {topRegions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-500">
                Brak danych dla wybranego okresu.
              </div>
            ) : (
              <div className="space-y-3">
                {topRegions.map((r, idx) => {
                  const value = r[metric] ?? 0;
                  const pct = topRegionMax > 0 ? Math.max(6, (value / topRegionMax) * 100) : 0;
                  const barColor = TOP_REGION_BAR_COLORS[idx] ?? TOP_REGION_BAR_COLORS[TOP_REGION_BAR_COLORS.length - 1];
                  return (
                    <div
                      key={r.code}
                      onMouseEnter={() => {
                        setHoveredCode(r.code);
                        const path = mapAreaRef.current?.querySelector(`path[data-voiv="${CSS.escape(r.code)}"]`);
                        if (path) updateTooltipSideFromPathElement(path);
                        else setTooltipAlignEnd(true);
                      }}
                      onMouseLeave={() => setHoveredCode(null)}
                      className="grid cursor-pointer grid-cols-[1.6rem_minmax(5.8rem,0.9fr)_minmax(4rem,1fr)_auto] items-center gap-3 rounded-xl py-0.5 transition-colors hover:bg-blue-50/50"
                    >
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${idx === 0 ? 'bg-[#071842] text-white' : 'bg-blue-100 text-blue-800'}`}>
                        {idx + 1}
                      </span>
                      <span className="truncate text-sm font-medium text-slate-800">{r.name.toLowerCase()}</span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${pct.toFixed(1)}%`, backgroundColor: barColor }}
                        />
                      </span>
                      <span className="text-right text-sm font-bold tabular-nums text-slate-900">{formatMetric(value)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {(unmatchedPoland[metric] ?? 0) > 0 && (
            <div className="mt-5 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
              <strong>Polska niedopasowana:</strong>{' '}
              {formatMetric(unmatchedPoland[metric] ?? 0)} w wierszach, których {platformLabel}
              nie przypisał jednoznacznie do województwa.
            </div>
          )}

          {foreignRows.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Zagranica — {activeMetricLabel}
              </div>
              <div className="space-y-2">
                {foreignRows.map((country) => {
                  const value = country[metric] ?? 0;
                  return (
                    <div key={country.code} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs">
                      <span className="truncate font-medium text-slate-700">
                        {formatPolishCountryName({ countryCode: country.code, countryName: country.name })}
                      </span>
                      <span className="font-bold tabular-nums text-slate-900">{formatMetric(value)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {campaignTotals && unknownLocationMetric > 0 && (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-700">Nieznana lokalizacja</span>
                <span className="font-bold tabular-nums text-slate-900">{formatMetric(unknownLocationMetric)}</span>
              </div>
              <div className="mt-1 text-slate-500">
                Nieprzypisane przez API
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default PolandRegionMap;
