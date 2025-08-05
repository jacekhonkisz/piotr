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
import { Users, Eye, MousePointer, DollarSign } from 'lucide-react';

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
}

interface DemographicPieChartsProps {
  data: DemographicPerformance[];
  metric: 'impressions' | 'clicks';
}

export default function DemographicPieCharts({ data, metric }: DemographicPieChartsProps) {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Process data for gender distribution
  const processGenderData = () => {
    const genderMap = new Map<string, number>();
    
    data.forEach(item => {
      const gender = item.gender || 'Unknown';
      const value = item[metric];
      genderMap.set(gender, (genderMap.get(gender) || 0) + value);
    });

    const total = Array.from(genderMap.values()).reduce((sum, value) => sum + value, 0);
    
    return {
      labels: Array.from(genderMap.keys()),
      data: Array.from(genderMap.values()),
      total,
      percentages: Array.from(genderMap.values()).map(value => ((value / total) * 100).toFixed(1))
    };
  };

  // Process data for age group distribution
  const processAgeData = () => {
    const ageMap = new Map<string, number>();
    
    data.forEach(item => {
      const age = item.age || 'Unknown';
      const value = item[metric];
      ageMap.set(age, (ageMap.get(age) || 0) + value);
    });

    const total = Array.from(ageMap.values()).reduce((sum, value) => sum + value, 0);
    
    return {
      labels: Array.from(ageMap.keys()),
      data: Array.from(ageMap.values()),
      total,
      percentages: Array.from(ageMap.values()).map(value => ((value / total) * 100).toFixed(1))
    };
  };

  const genderData = processGenderData();
  const ageData = processAgeData();

  // Color schemes
  const genderColors = ['#8B5CF6', '#3B82F6', '#6B7280']; // Purple, Blue, Gray
  const ageColors = ['#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444', '#6B7280']; // Orange, Green, Blue, Purple, Red, Gray

  const getMetricLabel = () => {
    switch (metric) {
      case 'impressions': return 'Wyświetlenia';
      case 'clicks': return 'Kliknięcia';
      default: return 'Metryka';
    }
  };

  const getMetricIcon = () => {
    switch (metric) {
      case 'impressions': return Eye;
      case 'clicks': return MousePointer;
      default: return Eye;
    }
  };

  const formatValue = (value: number) => {
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

  const MetricIcon = getMetricIcon();

  return (
    <div ref={containerRef} className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isVisible ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="text-center"
      >
        <div className="inline-flex items-center space-x-3 bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-3 rounded-2xl border border-purple-100">
          <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl">
            <MetricIcon className="h-5 w-5 text-white" />
          </div>
          <h3 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Podział {getMetricLabel()} według Demografii
          </h3>
        </div>
        <p className="text-gray-600 mt-2">Analiza skuteczności reklam według płci i grup wiekowych</p>
      </motion.div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Gender Distribution Chart */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={isVisible ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 p-6 hover:shadow-2xl transition-all duration-300"
        >
          <div className="text-center mb-6">
            <h4 className="text-lg font-bold text-gray-900 mb-2">Podział według Płci</h4>
            <p className="text-sm text-gray-600">Udział {getMetricLabel().toLowerCase()} według płci</p>
          </div>
          
          <div className="h-64 mb-6">
            <Pie
              data={{
                labels: genderData.labels,
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
          </div>

          {/* Legend with values */}
          <div className="space-y-3">
            {genderData.labels.map((label, index) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, x: -20 }}
                animate={isVisible ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.4 + index * 0.1, duration: 0.5 }}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: genderColors[index] }}
                  />
                  <span className="font-medium text-gray-900 capitalize">{label}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-900">
                    {formatValue(genderData.data[index] || 0)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {genderData.percentages[index]}%
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Age Group Distribution Chart */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={isVisible ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 p-6 hover:shadow-2xl transition-all duration-300"
        >
          <div className="text-center mb-6">
            <h4 className="text-lg font-bold text-gray-900 mb-2">Podział według Grup Wiekowych</h4>
            <p className="text-sm text-gray-600">Udział {getMetricLabel().toLowerCase()} według wieku</p>
          </div>
          
          <div className="h-64 mb-6">
            <Pie
              data={{
                labels: ageData.labels,
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
          </div>

          {/* Legend with values */}
          <div className="space-y-3">
            {ageData.labels.map((label, index) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, x: -20 }}
                animate={isVisible ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.6 + index * 0.1, duration: 0.5 }}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: ageColors[index] }}
                  />
                  <span className="font-medium text-gray-900">{label}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-900">
                    {formatValue(ageData.data[index] || 0)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {ageData.percentages[index]}%
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Summary Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isVisible ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.8 }}
        className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-100"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-2xl font-bold text-purple-600">
              {formatValue(genderData.total)}
            </div>
            <div className="text-sm text-gray-600">Łączne {getMetricLabel().toLowerCase()}</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-pink-600">
              {genderData.labels.length}
            </div>
            <div className="text-sm text-gray-600">Kategorie płci</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-indigo-600">
              {ageData.labels.length}
            </div>
            <div className="text-sm text-gray-600">Grupy wiekowe</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
} 