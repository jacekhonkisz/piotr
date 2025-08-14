'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  DoughnutController,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  DoughnutController
);

interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
  }[];
}

interface MonthlyReportChartProps {
  type: 'bar' | 'doughnut';
  data: ChartData;
  title: string;
  height?: number;
}

export default function MonthlyReportChart({ type, data, title, height = 300 }: MonthlyReportChartProps) {
  const [isVisible, setIsVisible] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (chartRef.current) {
      observer.observe(chartRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: isVisible ? 1500 : 0,
      easing: 'easeOutQuart' as const,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12,
            weight: 'normal' as const,
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        padding: 12,
        titleFont: {
          size: 14,
          weight: 'bold' as const,
        },
        bodyFont: {
          size: 13,
        },
      },
    },
    scales: type === 'bar' ? {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 12,
            weight: 'normal' as const,
          },
          color: '#6B7280',
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
          drawBorder: false,
        },
        ticks: {
          font: {
            size: 12,
            weight: 'normal' as const,
          },
          color: '#6B7280',
          callback: function(value: any) {
            if (value >= 1000) {
              return (value / 1000).toFixed(1) + 'k';
            }
            return value;
          },
        },
      },
    } : undefined,
  };

  // Enhanced data with animation properties
  const enhancedData = {
    ...data,
    datasets: data.datasets.map(dataset => ({
      ...dataset,
      animation: {
        delay: (context: any) => context.dataIndex * 100,
      },
    })),
  };

  return (
    <div 
      ref={chartRef}
      className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow duration-300"
      style={{ height }}
    >
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="relative" style={{ height: height - 80 }}>
        {isVisible && (
          <>
            {type === 'bar' && (
              <Bar 
                data={enhancedData} 
                options={chartOptions}
                plugins={[
                  {
                    id: 'customAnimation',
                    beforeDraw: (chart) => {
                      const { ctx, chartArea } = chart;
                      if (!chartArea) return;
                      
                      // Add subtle gradient background
                      const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                      gradient.addColorStop(0, 'rgba(59, 130, 246, 0.02)');
                      gradient.addColorStop(1, 'rgba(59, 130, 246, 0.05)');
                      
                      ctx.fillStyle = gradient;
                      ctx.fillRect(chartArea.left, chartArea.top, chartArea.width, chartArea.height);
                    },
                  },
                ]}
              />
            )}
            {type === 'doughnut' && (
              <Doughnut 
                data={enhancedData} 
                options={{
                  ...chartOptions,
                  cutout: '60%',
                  plugins: {
                    ...chartOptions.plugins,
                    legend: {
                      ...chartOptions.plugins.legend,
                      position: 'bottom' as const,
                    },
                  },
                }}
                plugins={[
                  {
                    id: 'doughnutAnimation',
                    beforeDraw: (chart) => {
                      const { ctx, chartArea } = chart;
                      if (!chartArea) return;
                      
                      // Add center text for doughnut charts
                      const centerX = (chartArea.left + chartArea.right) / 2;
                      const centerY = (chartArea.top + chartArea.bottom) / 2;
                      
                      ctx.save();
                      ctx.textAlign = 'center';
                      ctx.textBaseline = 'middle';
                      ctx.font = '16px Inter, sans-serif';
                      ctx.fillStyle = '#374151';
                      ctx.fillText('Performance', centerX, centerY - 10);
                      ctx.font = '12px Inter, sans-serif';
                      ctx.fillStyle = '#6B7280';
                      ctx.fillText('Overview', centerX, centerY + 10);
                      ctx.restore();
                    },
                  },
                ]}
              />
            )}
          </>
        )}
        
        {/* Loading placeholder */}
        {!isVisible && (
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse space-y-4 w-full">
              <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
              <div className="space-y-2">
                <div className="h-32 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 