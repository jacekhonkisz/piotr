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
import { Users } from 'lucide-react';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, Title);

interface DemographicPerformance {
  age: string;
  gender: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpp?: number;
  // Enhanced conversion metrics by demographics
  reservations: number;
  reservation_value: number;
  roas: number;
  cost_per_reservation: number;
  conversion_rate: number;
  booking_step_1: number;
  booking_step_2: number;
  booking_step_3: number;
  click_to_call: number;
  email_contacts: number;
}

interface DemographicPieChartsProps {
  data: DemographicPerformance[];
  metric: 'impressions' | 'clicks' | 'spend' | 'reservations' | 'roas' | 'reservation_value';
}

export default function DemographicPieCharts({ data, metric }: DemographicPieChartsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Add debugging logs
  console.log('🔍 DemographicPieCharts render:', {
    dataLength: data?.length || 0,
    metric,
    sampleData: data?.slice(0, 2),
    uniqueGenders: [...new Set(data?.map(d => d.gender) || [])],
    uniqueAges: [...new Set(data?.map(d => d.age) || [])]
  });

  // Process data for gender distribution
  const processGenderData = () => {
    const genderMap = new Map<string, number>();
    
    // 🔧 DIAGNOSTIC: Log first item to see structure
    if (data && data.length > 0) {
      console.log('🔍 DEMOGRAPHIC DATA STRUCTURE:', {
        firstItem: data[0],
        allKeys: Object.keys(data[0] || {}),
        metric: metric,
        metricValue: data[0]?.[metric],
        sampleGender: data[0]?.gender,
        sampleAge: data[0]?.age
      });
    }
    
    data.forEach(item => {
      const gender = item.gender || 'Nieznane';
      const value = item[metric] || 0; // 🔧 FIX: Default to 0 if undefined
      
      console.log('🔍 Processing item:', {
        gender,
        age: item.age,
        metric,
        value,
        rawItem: item
      });
      
      genderMap.set(gender, (genderMap.get(gender) || 0) + value);
    });

    const total = Array.from(genderMap.values()).reduce((sum, value) => sum + value, 0);
    
    const result = {
      labels: Array.from(genderMap.keys()),
      data: Array.from(genderMap.values()),
      total,
      percentages: Array.from(genderMap.values()).map(value => total > 0 ? ((value / total) * 100).toFixed(1) : '0')
    };

    console.log('🔍 Processed gender data:', result);
    return result;
  };

  // Process data for age group distribution
  const processAgeData = () => {
    const ageMap = new Map<string, number>();
    
    data.forEach(item => {
      const age = item.age || 'Nieznane';
      const value = item[metric] || 0; // 🔧 FIX: Default to 0 if undefined
      ageMap.set(age, (ageMap.get(age) || 0) + value);
    });

    const total = Array.from(ageMap.values()).reduce((sum, value) => sum + value, 0);
    
    const result = {
      labels: Array.from(ageMap.keys()),
      data: Array.from(ageMap.values()),
      total,
      percentages: Array.from(ageMap.values()).map(value => total > 0 ? ((value / total) * 100).toFixed(1) : '0')
    };

    console.log('🔍 Processed age data:', result);
    return result;
  };

  const genderData = processGenderData();
  const ageData = processAgeData();

  // Helper function to translate gender labels
  const translateGenderLabel = (label: string) => {
    switch (label.toLowerCase()) {
      case 'male': return 'Mężczyźni';
      case 'female': return 'Kobiety';
      case 'mężczyźni': return 'Mężczyźni'; // Already translated
      case 'kobiety': return 'Kobiety'; // Already translated
      case 'nieznane': return 'Nieznane';
      case 'unknown': return 'Nieznane';
      default: return label; // Return as-is if already in Polish
    }
  };

  // Helper function to translate age labels  
  const translateAgeLabel = (label: string) => {
    if (label === 'Nieznane' || label === 'Unknown' || label === 'unknown') return 'Nieznane';
    return label; // Age ranges like "25-34" don't need translation
  };

  // Color schemes
  const genderColors = ['#8B5CF6', '#3B82F6', '#6B7280']; // Purple, Blue, Gray
  const ageColors = ['#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444', '#6B7280']; // Orange, Green, Blue, Purple, Red, Gray

  const getMetricLabel = () => {
    switch (metric) {
      case 'impressions': return 'Wyświetlenia';
      case 'clicks': return 'Kliknięcia';
      case 'spend': return 'Wydatki';
      case 'reservations': return 'Rezerwacje';
      case 'roas': return 'ROAS';
      case 'reservation_value': return 'Wartość rezerwacji';
      default: return 'Metryka';
    }
  };

  const formatValue = (value: number) => {
    if (metric === 'reservation_value' || metric === 'spend') {
      return new Intl.NumberFormat('pl-PL', {
        style: 'currency',
        currency: 'PLN'
      }).format(value);
    }
    return value.toLocaleString();
  };

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
            family: 'Inter, sans-serif',
            size: 12,
            weight: 'normal' as const
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          label: (context: any) => {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = total > 0 ? (value / total) * 100 : 0;
            return `${label}: ${formatValue(value)} (${percentage.toFixed(1)}%)`;
          }
        }
      }
    }
  };

  // Add debugging for chart rendering
  console.log('🔍 Rendering charts with:', {
    genderDataLabels: genderData.labels,
    genderDataValues: genderData.data,
    ageDataLabels: ageData.labels,
    ageDataValues: ageData.data,
  });

  return (
    <div ref={containerRef} className="space-y-4">
      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Gender Distribution Chart */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-slate-950">Płeć</h4>
            <p className="text-xs text-slate-500">Udział {getMetricLabel().toLowerCase()} według płci</p>
          </div>

          <div className="mb-3 h-48">
            {genderData.data.length > 0 ? (
              <Pie
                data={{
                  labels: genderData.labels.map(translateGenderLabel),
                  datasets: [{
                    data: genderData.data,
                    backgroundColor: genderColors,
                    borderColor: genderColors.map(color => color + '80'),
                    borderWidth: 2,
                    hoverBorderWidth: 3,
                  }]
                }}
                options={chartOptions}
              />
            ) : (
              <div className="flex h-48 items-center justify-center rounded-lg bg-slate-50">
                <div className="text-center">
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Users className="h-4 w-4 text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-900 mb-1">Brak danych demograficznych</p>
                  <p className="text-xs text-gray-500">Meta API nie zwróciło danych o demografii</p>
                </div>
              </div>
            )}
          </div>

          {/* Legend with values */}
          <div className="space-y-1.5">
            {genderData.labels.map((label, index) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-2 transition-colors hover:bg-slate-100"
              >
                <div className="flex items-center space-x-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: genderColors[index] }}
                  />
                  <span className="text-xs font-medium capitalize text-slate-800">{translateGenderLabel(label)}</span>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-900">
                    {formatValue(genderData.data[index] || 0)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {genderData.percentages[index]}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Age Group Distribution Chart */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-slate-950">Wiek</h4>
            <p className="text-xs text-slate-500">Udział {getMetricLabel().toLowerCase()} według wieku</p>
          </div>

          <div className="mb-3 h-48">
            {ageData.data.length > 0 ? (
              <Pie
                data={{
                  labels: ageData.labels.map(translateAgeLabel),
                  datasets: [{
                    data: ageData.data,
                    backgroundColor: ageColors,
                    borderColor: ageColors.map(color => color + '80'),
                    borderWidth: 2,
                    hoverBorderWidth: 3,
                  }]
                }}
                options={chartOptions}
              />
            ) : (
              <div className="flex h-48 items-center justify-center rounded-lg bg-slate-50">
                <div className="text-center">
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Users className="h-4 w-4 text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-900 mb-1">Brak danych demograficznych</p>
                  <p className="text-xs text-gray-500">Meta API nie zwróciło danych o demografii</p>
                </div>
              </div>
            )}
          </div>

          {/* Legend with values */}
          <div className="space-y-1.5">
            {ageData.labels.map((label, index) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-2 transition-colors hover:bg-slate-100"
              >
                <div className="flex items-center space-x-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: ageColors[index] }}
                  />
                  <span className="text-xs font-medium text-slate-800">{translateAgeLabel(label)}</span>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-900">
                    {formatValue(ageData.data[index] || 0)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {ageData.percentages[index]}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-base font-semibold text-slate-900 tabular-nums">
              {formatValue(genderData.total)}
            </div>
            <div className="text-[11px] text-slate-500">Łączne {getMetricLabel().toLowerCase()}</div>
          </div>
          <div>
            <div className="text-base font-semibold text-slate-900 tabular-nums">
              {genderData.labels.length}
            </div>
            <div className="text-[11px] text-slate-500">Kategorie płci</div>
          </div>
          <div>
            <div className="text-base font-semibold text-slate-900 tabular-nums">
              {ageData.labels.length}
            </div>
            <div className="text-[11px] text-slate-500">Grupy wiekowe</div>
          </div>
        </div>
      </div>
    </div>
  );
} 