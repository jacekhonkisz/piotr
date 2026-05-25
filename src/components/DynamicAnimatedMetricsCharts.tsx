'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { getCurrentMonthLabel } from '../lib/date-utils';
import type { MetricConfigItem, MetricFormat } from '../lib/default-metrics-config';

function formatDisplay(format: MetricFormat, value: number): string {
  if (format === 'currency') {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }
  if (format === 'percentage') {
    return `${value.toFixed(2).replace('.', ',')}%`;
  }
  return value.toLocaleString('pl-PL');
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

export interface DynamicAnimatedMetricsChartsProps {
  chartMetrics: MetricConfigItem[];
  current: Record<string, number>;
  previous: Record<string, number>;
  isLoading?: boolean;
  /** Shown when chartMetrics is empty (e.g. after filtering to API-backed values only). */
  emptyStateMessage?: string;
}

export default function DynamicAnimatedMetricsCharts({
  chartMetrics,
  current,
  previous,
  isLoading = false,
  emptyStateMessage,
}: DynamicAnimatedMetricsChartsProps) {
  const currentMonthLabel = useMemo(() => getCurrentMonthLabel(), []);
  const [animated, setAnimated] = useState<Record<string, number>>({});
  const [hairlineVisible, setHairlineVisible] = useState(false);
  const [ticksVisible, setTicksVisible] = useState(false);

  const keys = useMemo(
    () => chartMetrics.map((m) => m.key).join(','),
    [chartMetrics]
  );

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    if (!isLoading && chartMetrics.length) {
      setTimeout(() => setHairlineVisible(true), 100);

      const duration = 600;
      const steps = 60;
      const stepDuration = duration / steps;

      const intervals: ReturnType<typeof setInterval>[] = [];

      for (const cfg of chartMetrics) {
        const end = Number(current[cfg.key]) || 0;
        const increment = end / steps;
        let step = 0;
        let cur = 0;
        const key = cfg.key;
        const id = setInterval(() => {
          step++;
          cur += increment;
          if (step >= steps) {
            cur = end;
            clearInterval(id);
          }
          setAnimated((prev) => ({ ...prev, [key]: cur }));
        }, stepDuration);
        intervals.push(id);
      }

      setTimeout(() => setTicksVisible(true), duration + 200);
      cleanup = () => intervals.forEach(clearInterval);
    }

    return () => {
      if (cleanup) cleanup();
    };
  }, [keys, isLoading, chartMetrics, current]);

  const getProgressPercentage = (cur: number, prev: number) => {
    if (prev === 0) return cur > 0 ? 100 : 0;
    return Math.min((cur / prev) * 100, 100);
  };

  const createTickRail = (
    cur: number,
    prev: number,
    color: string,
    fmt: MetricFormat,
    maxTicks = 36
  ) => {
    const percentage = getProgressPercentage(cur, prev);
    const filledTicks = Math.round((percentage / 100) * maxTicks);
    return (
      <div className="relative">
        <div className="flex space-x-0.5 h-4 sm:h-5 mb-2">
          {Array.from({ length: maxTicks }, (_, index) => (
            <div
              key={index}
              className={`w-0.5 sm:w-1 rounded-sm transition-all duration-300 ease-out ${
                index < filledTicks ? color : 'bg-navy-30'
              }`}
              style={{
                animationDelay: `${index * 8}ms`,
                animation: ticksVisible ? 'tick-stagger 0.24s ease-out forwards' : 'none',
                opacity: ticksVisible ? 1 : 0,
                transform: ticksVisible ? 'scaleY(1)' : 'scaleY(0)',
              }}
            />
          ))}
        </div>
        <div className="flex justify-between text-xs sm:text-sm text-muted">
          <span>0</span>
          <span>{formatDisplay(fmt, prev)}</span>
        </div>
      </div>
    );
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return '▲';
    if (change < 0) return '▼';
    return '—';
  };

  const getChangeColor = () => 'text-navy';

  const visibleCount = chartMetrics.length;
  const gridClass =
    visibleCount <= 1
      ? 'grid-cols-1 max-w-md mx-auto'
      : visibleCount === 2
        ? 'grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto'
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  if (visibleCount === 0) {
    return (
      <p className="text-sm text-muted text-center py-6 border border-dashed border-stroke rounded-2xl">
        {emptyStateMessage ??
          'Brak wybranych metryk wykresów. Skonfiguruj je w Metryki (panel administratora).'}
      </p>
    );
  }

  return (
    <div className={`grid ${gridClass} gap-4 sm:gap-6 w-full`}>
      {chartMetrics.map((cfg, idx) => {
        const cur = Number(current[cfg.key]) || 0;
        const prev = Number(previous[cfg.key]) || 0;
        const change = pctChange(cur, prev);
        const label = cfg.customName || cfg.defaultName;
        const tickColor = idx % 3 === 2 ? 'bg-orange' : 'bg-navy';
        const shown = animated[cfg.key] ?? 0;

        return (
          <div
            key={cfg.key}
            className="bg-bg rounded-2xl p-4 sm:p-6 md:p-7 shadow-sm border border-stroke hover:shadow-md transition-all duration-200 cursor-default w-full min-w-0"
          >
            <div className="flex items-center justify-between mb-3 gap-2">
              <h3 className="text-sm font-medium text-muted truncate">{label}</h3>
              <span className="text-xs text-muted opacity-60 shrink-0">{currentMonthLabel}</span>
            </div>

            <div
              className="hairline mb-3 transition-all duration-180 ease-out"
              style={{
                transform: hairlineVisible ? 'scaleX(1)' : 'scaleX(0)',
                transformOrigin: 'left',
              }}
            />

            <div className="mb-4 sm:mb-6">
              <div
                className="text-3xl sm:text-4xl md:text-5xl font-bold text-text tracking-tight mb-2 tabular-nums break-words"
                style={{ letterSpacing: '-0.01em' }}
              >
                {isLoading ? (
                  <div className="h-12 sm:h-14 md:h-16 bg-stroke rounded animate-pulse" />
                ) : (
                  formatDisplay(cfg.format, shown)
                )}
              </div>
              <div className={`text-sm ${getChangeColor()} flex flex-wrap items-center gap-x-1`}>
                <span>
                  vs {formatDisplay(cfg.format, prev)} poprzedni miesiąc
                </span>
                <span className="text-xs">
                  {change > 0 ? '+' : change < 0 ? '-' : ''}
                  {getChangeIcon(change)}
                </span>
              </div>
            </div>

            {createTickRail(cur, prev, tickColor, cfg.format)}
          </div>
        );
      })}
    </div>
  );
}
