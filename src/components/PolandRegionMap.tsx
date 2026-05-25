'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
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
  conversion_value?: number;
  reservation_value?: number;
  roas?: number;
}

interface PolandRegionMapProps {
  data: GeographicRow[];
  /** Which metric drives the heatmap intensity. */
  metric?: 'spend' | 'clicks' | 'conversions' | 'conversion_value';
  /** Optional title rendered above the map. */
  title?: string;
  /**
   * Optional account/campaign totals for the same period. When provided, the
   * map renders a "Nieznana lokalizacja" bucket equal to
   * `campaignTotals[metric] - sum(geographic_view[metric])` so the side panel
   * reconciles back to the campaign-level KPI even though Google's
   * `geographic_view` does not return rows for every conversion.
   */
  campaignTotals?: {
    spend?: number;
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
  cities: { name: string; spend: number; clicks: number; conversions: number; conversion_value: number }[];
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

const METRIC_LABELS: Record<NonNullable<PolandRegionMapProps['metric']>, string> = {
  spend: 'Wydatki',
  clicks: 'Kliknięcia',
  conversions: 'Konwersje',
  conversion_value: 'Wartość konwersji',
};

const PolandRegionMap: React.FC<PolandRegionMapProps> = ({
  data,
  metric = 'conversion_value',
  title = 'Wydajność wg regionów',
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

  // Top 5 regions for the side panel
  const topRegions = useMemo(() => {
    return Array.from(byCode.values())
      .filter((r) => (r[metric] ?? 0) > 0)
      .sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0))
      .slice(0, 5);
  }, [byCode, metric]);

  const foreignRows = useMemo(() => {
    return Array.from(foreignByCountry.values())
      .filter((country) => (country[metric] ?? 0) > 0)
      .sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0))
      .slice(0, 5);
  }, [foreignByCountry, metric]);

  const formatMetric = (v: number) =>
    metric === 'spend' || metric === 'conversion_value' ? formatPLN(v) : formatInt(v);

  return (
    <div className="bg-white rounded-2xl border border-slate-200">
      <div className="flex items-center justify-between p-6 border-b border-slate-100">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-slate-900 rounded-lg">
            <MapPin className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-600">
              Mapa cieplna — {METRIC_LABELS[metric].toLowerCase()} wg województw; zagranica w podsumowaniu
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider text-slate-500">
            {campaignTotals ? 'Łącznie (kampanie Google Ads)' : 'Łącznie (Polska + zagranica)'}
          </div>
          <div className="text-2xl font-semibold tabular-nums text-slate-900">{formatMetric(totalMetric)}</div>
          {campaignTotals && unknownLocationMetric > 0 && (
            <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
              z czego z lokalizacji: {formatMetric(geographicViewTotal)}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
        {/* Map */}
        <div className="lg:col-span-2">
          <div ref={mapAreaRef} className="relative bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
            {/* Slightly inset + max width so the hover card does not cover the whole country */}
            <div className="flex justify-center px-2 pt-3 pb-2 sm:px-4 sm:pt-4 sm:pb-3">
              <div className="w-[90%] max-w-[min(100%,520px)] sm:max-w-[540px] lg:max-w-[560px]">
                <svg
                  viewBox={POLAND_MAP_VIEW_BOX}
                  className="w-full h-auto"
                  role="img"
                  aria-label={`Mapa Polski - ${METRIC_LABELS[metric]} wg województw`}
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
                        stroke={isHovered ? '#0f172a' : '#94a3b8'}
                        strokeWidth={isHovered ? 2 : 1}
                        style={{ cursor: agg ? 'pointer' : 'default', transition: 'stroke 120ms, stroke-width 120ms' }}
                        onMouseEnter={(e) => {
                          setHoveredCode(v.code);
                          updateTooltipSideFromPathElement(e.currentTarget);
                        }}
                        onMouseLeave={() => setHoveredCode((c) => (c === v.code ? null : c))}
                      />
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* Hover tooltip — flips left/right so it stays off the hovered region */}
            {hovered && hoveredShape && (
              <div
                className={`absolute top-3 z-10 max-w-sm w-[min(100%,20rem)] sm:top-4 bg-white/95 backdrop-blur-sm rounded-lg border border-slate-200 shadow-md p-3 sm:p-4 text-sm pointer-events-none ${
                  tooltipAlignEnd ? 'right-3 sm:right-4 left-auto' : 'left-3 sm:left-4 right-auto'
                }`}
              >
                <div className="font-semibold text-slate-900 mb-2">{hovered.name}</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-600">
                  <div>Wydatki:</div>
                  <div className="text-right tabular-nums font-medium text-slate-900">{formatPLN(hovered.spend)}</div>
                  <div>Kliknięcia:</div>
                  <div className="text-right tabular-nums font-medium text-slate-900">{formatInt(hovered.clicks)}</div>
                  <div>Konwersje:</div>
                  <div className="text-right tabular-nums font-medium text-slate-900">{formatInt(hovered.conversions)}</div>
                  <div>Wartość konwersji:</div>
                  <div className="text-right tabular-nums font-medium text-slate-900">{formatPLN(hovered.conversion_value)}</div>
                </div>
                {hovered.cities.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                      Top miasta wg {METRIC_LABELS[metric].toLowerCase()}
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
          <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
            <span>0</span>
            <div className="flex-1 mx-4 h-2 rounded-full overflow-hidden flex">
              {[0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => (
                <div
                  key={t}
                  className="flex-1"
                  style={{ backgroundColor: heatmapColor(t, true) }}
                />
              ))}
            </div>
            <span>{formatMetric(maxValue)}</span>
          </div>
        </div>

        {/* Side panel - Top 5 voivodeships */}
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-3">
            Top 5 województw — {METRIC_LABELS[metric]}
          </div>
          {topRegions.length === 0 ? (
            <div className="text-sm text-slate-500 py-6 text-center bg-slate-50 rounded-lg border border-slate-200">
              Brak danych dla wybranego okresu.
            </div>
          ) : (
            <div className="space-y-2">
              {topRegions.map((r, idx) => {
                const value = r[metric] ?? 0;
                const pct = totalMetric > 0 ? (value / totalMetric) * 100 : 0;
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
                    className="bg-slate-50 rounded-lg p-3 border border-slate-200 cursor-pointer transition-colors hover:bg-slate-100"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono text-slate-500 w-5">#{idx + 1}</span>
                        <span className="text-sm font-medium text-slate-900">{r.name}</span>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-slate-900">
                        {formatMetric(value)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-900"
                        style={{ width: `${pct.toFixed(1)}%` }}
                      />
                    </div>
                    <div className="text-xs text-slate-500 mt-1 tabular-nums">{pct.toFixed(1)}%</div>
                  </div>
                );
              })}
            </div>
          )}

          {(unmatchedPoland[metric] ?? 0) > 0 && (
            <div className="mt-4 text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <strong className="text-amber-900">Polska niedopasowana:</strong>{' '}
              {formatMetric(unmatchedPoland[metric] ?? 0)} w wierszach, których Google Ads
              nie przypisał jednoznacznie do województwa.
            </div>
          )}

          {foreignRows.length > 0 && (
            <div className="mt-4">
              <div className="text-xs uppercase tracking-wider text-slate-500 mb-3">
                Zagranica — {METRIC_LABELS[metric]}
              </div>
              <div className="space-y-2">
                {foreignRows.map((country) => {
                  const value = country[metric] ?? 0;
                  const pct = totalMetric > 0 ? (value / totalMetric) * 100 : 0;
                  return (
                    <div key={country.code} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-900">
                          {formatPolishCountryName({ countryCode: country.code, countryName: country.name })}
                        </span>
                        <span className="text-sm font-semibold tabular-nums text-slate-900">
                          {formatMetric(value)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-slate-500" style={{ width: `${pct.toFixed(1)}%` }} />
                      </div>
                      <div className="text-xs text-slate-500 mt-1 tabular-nums">{pct.toFixed(1)}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {campaignTotals && unknownLocationMetric > 0 && (
            <div className="mt-4">
              <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">
                Nieznana lokalizacja
              </div>
              <div className="bg-slate-50 rounded-lg p-3 border border-dashed border-slate-300">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-900">
                    Bez przypisania geograficznego
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-slate-900">
                    {formatMetric(unknownLocationMetric)}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-400"
                    style={{
                      width: `${
                        totalMetric > 0
                          ? ((unknownLocationMetric / totalMetric) * 100).toFixed(1)
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <div className="text-xs text-slate-500 mt-1 tabular-nums">
                  {totalMetric > 0
                    ? ((unknownLocationMetric / totalMetric) * 100).toFixed(1)
                    : '0.0'}
                  % wartości kampanii
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PolandRegionMap;
