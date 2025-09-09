'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  Title,
} from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { motion } from 'framer-motion';
import { Eye, MousePointer, Target, BarChart3 } from 'lucide-react';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, Title);

interface GoogleAdsDemographicPerformance {
  ageRange: string;
  gender: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conversionValue: number;
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

  const MetricIcon = () => {
    switch (metric) {
      case 'impressions': return Eye;
      case 'clicks': return MousePointer;
      case 'conversions': return Target;
      case 'roas': return BarChart3;
      case 'conversionValue': return BarChart3;
      default: return BarChart3;
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

  // Helper function to translate gender labels
  const translateGenderLabel = (label: string) => {
    switch (label.toLowerCase()) {
      case 'male': return 'Mężczyźni';
      case 'female': return 'Kobiety';
      case 'nieznane': return 'Nieznane';
      case 'unknown': return 'Nieznane';
      default: return 'Nieznane';
    }
  };

  // Helper function to translate age labels  
  const translateAgeLabel = (label: string) => {
    if (label === 'Nieznane' || label === 'Unknown' || label === 'unknown') return 'Nieznane';
    return label; // Age ranges like "25-34" don't need translation
  };

  // Process data for gender breakdown
  const genderData = React.useMemo(() => {
    const genderMap = new Map<string, number>();
    
    data.forEach(item => {
      const value = getMetricValue(item);
      const currentValue = genderMap.get(item.gender) || 0;
      genderMap.set(item.gender, currentValue + value);
    });

    const labels = Array.from(genderMap.keys());
    const values = Array.from(genderMap.values());
    const total = values.reduce((sum, val) => sum + val, 0);

    return {
      labels: labels.map(translateGenderLabel),
      datasets: [{
        data: values,
        backgroundColor: ['#6366f1', '#8b5cf6', '#6b7280'],
        borderWidth: 0,
      }],
      total,
      originalLabels: labels // Keep original labels for legend mapping
    };
  }, [data, metric]);

  // Process data for age breakdown
  const ageData = React.useMemo(() => {
    const ageMap = new Map<string, number>();
    
    data.forEach(item => {
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
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 20,
          usePointStyle: true,
          font: {
            size: 12,
          },
        },
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

  const Icon = MetricIcon();

  return (
    <div ref={containerRef} className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center space-x-3 bg-slate-50 px-6 py-3 rounded-xl border border-slate-200">
          <div className="p-2 bg-slate-900 rounded-lg">
            <Icon className="h-5 w-5 text-white" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900">
            Podział {getMetricLabel()} według Demografii
          </h3>
        </div>
        <p className="text-slate-600 mt-2">Analiza skuteczności reklam według płci i grup wiekowych</p>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Gender Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h4 className="text-lg font-semibold text-slate-900 mb-4 text-center">
            Podział według Płci
          </h4>
          <p className="text-sm text-slate-600 mb-6 text-center">
            Udział {getMetricLabel().toLowerCase()} według płci
          </p>
          <div className="h-80">
            <Pie data={genderData} options={chartOptions} />
          </div>
          
          {/* Gender Legend */}
          <div className="mt-6 space-y-3">
                      {genderData.labels.map((label, index) => {
            const value = genderData.datasets[0]?.data[index] ?? 0;
            const percentage = genderData.total > 0 ? ((value / genderData.total) * 100).toFixed(1) : '0.0';
            const color = genderData.datasets[0]?.backgroundColor?.[index] ?? '#6b7280';
            
            return (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm font-medium text-slate-700 capitalize">
                    {label}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-900 tabular-nums">
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
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h4 className="text-lg font-semibold text-slate-900 mb-4 text-center">
            Podział według Grup Wiekowych
          </h4>
          <p className="text-sm text-slate-600 mb-6 text-center">
            Udział {getMetricLabel().toLowerCase()} według wieku
          </p>
          <div className="h-80">
            <Pie data={ageData} options={chartOptions} />
          </div>
          
          {/* Age Legend */}
          <div className="mt-6 space-y-3">
                      {ageData.labels.map((label, index) => {
            const value = ageData.datasets[0]?.data[index] ?? 0;
            const percentage = ageData.total > 0 ? ((value / ageData.total) * 100).toFixed(1) : '0.0';
            const color = ageData.datasets[0]?.backgroundColor?.[index] ?? '#6b7280';
            
            return (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm font-medium text-slate-700">
                    {label}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-900 tabular-nums">
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

      {/* Summary Stats */}
      <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-2xl font-semibold text-slate-900 tabular-nums">
              {formatValue(genderData.total)}
            </div>
            <div className="text-sm text-slate-600">Łączne {getMetricLabel().toLowerCase()}</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-slate-900 tabular-nums">
              {genderData.labels.length}
            </div>
            <div className="text-sm text-slate-600">Kategorie płci</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-slate-900 tabular-nums">
              {ageData.labels.length}
            </div>
            <div className="text-sm text-slate-600">Grupy wiekowe</div>
          </div>
        </div>
      </div>
    </div>
  );
} 