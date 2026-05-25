'use client';

import React, { useRef } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  Title,
} from 'chart.js';
import { Pie } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, Title);

// Each row carries EXACTLY one of `gender` or `ageRange`. See
// GoogleAdsAPIService.getDemographicPerformance for why - gender_view and
// age_range_view are independent resources in the Google Ads API and cannot
// be cross-tabbed. The pie chart aggregation below filters per dimension to
// avoid a "Nieznane" double-count.
interface GoogleAdsDemographicPerformance {
  ageRange?: string;
  gender?: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conversionValue: number;
  reservations?: number;
  reservation_value?: number;
  roas: number;
}

interface GoogleAdsDemographicPieChartsProps {
  data: GoogleAdsDemographicPerformance[];
  metric: 'impressions' | 'clicks' | 'conversions' | 'roas' | 'conversionValue';
}

export default function GoogleAdsDemographicPieCharts({ data, metric }: GoogleAdsDemographicPieChartsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const getMetricLabel = () => {
    switch (metric) {
      case 'impressions': return 'Wyświetlenia';
      case 'clicks': return 'Kliknięcia';
      case 'conversions': return 'Konwersje';
      case 'roas': return 'ROAS';
      case 'conversionValue': return 'Wartość konwersji';
      default: return 'Metryka';
    }
  };

  const getMetricValue = (item: GoogleAdsDemographicPerformance) => {
    switch (metric) {
      case 'impressions': return item.impressions;
      case 'clicks': return item.clicks;
      case 'conversions': return item.conversions;
      case 'roas': return item.roas;
      case 'conversionValue': return item.conversionValue;
      default: return 0;
    }
  };

  const formatValue = (value: number): string => {
    if (metric === 'roas') {
      return `${value.toFixed(2)}x`;
    }
    if (metric === 'conversionValue') {
      return new Intl.NumberFormat('pl-PL', {
        style: 'currency',
        currency: 'PLN'
      }).format(value);
    }
    return new Intl.NumberFormat('pl-PL').format(value);
  };

  // Map gender bucket keys to Polish chart labels. Rows from the API layer
  // already use Polish (Mężczyźni / Kobiety / Nieznane); older caches may
  // still have English or enum strings. Do NOT default unknown strings to
  // "Nieznane" — that collapsed every real segment into one label.
  /** Single bucket for unknown / unspecified / undetermined (Google Ads). */
  const GENDER_UNKNOWN_LABEL = 'Nieznane / nieokreślone';

  const translateGenderLabel = (label: string): string => {
    const raw = label.trim();
    if (!raw) return GENDER_UNKNOWN_LABEL;
    const upper = raw.toUpperCase();
    if (upper === 'MĘŻCZYŹNI' || upper === 'MĘŻCZYZNA') return 'Mężczyźni';
    if (upper === 'KOBIETY' || upper === 'KOBIETA') return 'Kobiety';
    if (
      upper === 'NIEZNANE' ||
      upper === 'UNKNOWN' ||
      upper === 'UNSPECIFIED' ||
      upper === 'UNDETERMINED'
    ) {
      return GENDER_UNKNOWN_LABEL;
    }
    if (upper === 'MALE') return 'Mężczyźni';
    if (upper === 'FEMALE') return 'Kobiety';

    const lower = raw.toLowerCase();
    if (lower === 'male') return 'Mężczyźni';
    if (lower === 'female') return 'Kobiety';

    if (raw === '10') return 'Mężczyźni';
    if (raw === '11') return 'Kobiety';
    if (raw === '20' || raw === '0' || raw === '1') return GENDER_UNKNOWN_LABEL;

    return raw;
  };

  // Helper function to translate age labels  
  const translateAgeLabel = (label: string) => {
    if (label === 'Nieznane' || label === 'Unknown' || label === 'unknown') return 'Nieznane';
    return label; // Age ranges like "25-34" don't need translation
  };

  // Process data for gender breakdown.
  // Only rows tagged with a `gender` value participate; age-only rows are
  // skipped so we never produce a phantom "Nieznane" bucket from them.
  const genderData = React.useMemo(() => {
    const genderMap = new Map<string, number>();

    data.forEach((item) => {
      if (!item.gender) return;
      const value = getMetricValue(item);
      const canonical = translateGenderLabel(item.gender);
      genderMap.set(canonical, (genderMap.get(canonical) || 0) + value);
    });

    const labels = Array.from(genderMap.keys()).sort((a, b) => {
      const rank = (g: string) =>
        g === 'Mężczyźni' ? 0 : g === 'Kobiety' ? 1 : g === GENDER_UNKNOWN_LABEL ? 2 : 3;
      return rank(a) - rank(b) || a.localeCompare(b, 'pl');
    });
    const values = labels.map((l) => genderMap.get(l) ?? 0);
    const total = values.reduce((sum, val) => sum + val, 0);

    return {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: ['#6366f1', '#8b5cf6', '#6b7280', '#94a3b8', '#cbd5e1'],
          borderWidth: 0,
        },
      ],
      total,
    };
  }, [data, metric]);

  // Process data for age breakdown - same dimension-filter rationale as above.
  const ageData = React.useMemo(() => {
    const ageMap = new Map<string, number>();

    data.forEach(item => {
      if (!item.ageRange) return;
      const value = getMetricValue(item);
      const currentValue = ageMap.get(item.ageRange) || 0;
      ageMap.set(item.ageRange, currentValue + value);
    });

    const labels = Array.from(ageMap.keys());
    const values = Array.from(ageMap.values());
    const total = values.reduce((sum, val) => sum + val, 0);

    return {
      labels: labels.map(translateAgeLabel),
      datasets: [{
        data: values,
        backgroundColor: ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#6b7280', '#f97316'],
        borderWidth: 0,
      }],
      total,
      originalLabels: labels // Keep original labels for legend mapping
    };
  }, [data, metric]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      // Custom HTML legends below each chart — hide Chart.js legend to avoid
      // duplicate rows (same slice shown twice with different text).
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const value = context.raw;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${context.label}: ${formatValue(value)} (${percentage}%)`;
          }
        }
      }
    },
  };

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        Brak danych demograficznych dla wybranego okresu
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-4">
      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Gender Chart */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h4 className="text-sm font-semibold text-slate-950">
            Płeć
          </h4>
          <p className="mb-3 text-xs text-slate-500">
            Udział {getMetricLabel().toLowerCase()} według płci
          </p>
          <div className="h-48">
            <Pie data={genderData} options={chartOptions} />
          </div>
          
          {/* Gender Legend */}
          <div className="mt-3 space-y-1.5">
            {genderData.labels.map((label, index) => {
            const value = genderData.datasets[0]?.data[index] ?? 0;
            const percentage = genderData.total > 0 ? ((value / genderData.total) * 100).toFixed(1) : '0.0';
            const color = genderData.datasets[0]?.backgroundColor?.[index] ?? '#6b7280';
            
            return (
              <div key={label} className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-2">
                <div className="flex items-center space-x-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs font-medium text-slate-700">
                    {label}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-900 tabular-nums">
                    {formatValue(value)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {percentage}%
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>

        {/* Age Chart */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h4 className="text-sm font-semibold text-slate-950">
            Wiek
          </h4>
          <p className="mb-3 text-xs text-slate-500">
            Udział {getMetricLabel().toLowerCase()} według wieku
          </p>
          <div className="h-48">
            <Pie data={ageData} options={chartOptions} />
          </div>
          
          {/* Age Legend */}
          <div className="mt-3 space-y-1.5">
            {ageData.labels.map((label, index) => {
            const value = ageData.datasets[0]?.data[index] ?? 0;
            const percentage = ageData.total > 0 ? ((value / ageData.total) * 100).toFixed(1) : '0.0';
            const color = ageData.datasets[0]?.backgroundColor?.[index] ?? '#6b7280';
            
            return (
              <div key={label} className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-2">
                <div className="flex items-center space-x-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs font-medium text-slate-700">
                    {label}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-900 tabular-nums">
                    {formatValue(value)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {percentage}%
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
} 