'use client';

import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface BarChartData {
  month: string;
  value: number;
  previousValue?: number;
  change?: number;
}

interface ModernBarChartProps {
  data: BarChartData[];
  title: string;
  subtitle?: string;
  valueFormatter?: (value: number) => string;
  color?: string;
  height?: number;
  animate?: boolean;
  showTrend?: boolean;
}

export default function ModernBarChart({
  data,
  title,
  subtitle,
  valueFormatter = (value) => value.toLocaleString(),
  color = '#2771FF',
  height = 400,
  animate = true,
  showTrend = true
}: ModernBarChartProps) {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [animatedBars, setAnimatedBars] = useState<boolean[]>(new Array(data.length).fill(false));
  const chartRef = useRef<HTMLDivElement>(null);

  // Find max value for scaling
  const maxValue = Math.max(...data.map(d => Math.max(d.value, d.previousValue || 0)));

  // Animate bars sequentially
  useEffect(() => {
    if (!animate) {
      setAnimatedBars(new Array(data.length).fill(true));
      return;
    }

    const timer = setTimeout(() => {
      const animateBars = () => {
        setAnimatedBars(prev => {
          const newBars = [...prev];
          const nextIndex = newBars.findIndex(bar => !bar);
          if (nextIndex !== -1) {
            newBars[nextIndex] = true;
            setTimeout(animateBars, 150); // 150ms delay between bars
          }
          return newBars;
        });
      };
      animateBars();
    }, 300);

    return () => clearTimeout(timer);
  }, [data.length, animate]);

  const getBarHeight = (value: number) => {
    if (maxValue === 0) return 0;
    return (value / maxValue) * 100;
  };

  const getBarColor = (_index: number, isHovered: boolean) => {
    if (isHovered) {
      return color === '#2771FF' ? '#1E40AF' : color === '#FF9900' ? '#EA580C' : color;
    }
    return color;
  };

  const formatChange = (change: number) => {
    if (change > 0) {
      return (
        <div className="flex items-center text-green-600 text-sm font-medium">
          <TrendingUp className="h-3 w-3 mr-1" />
          <span>+{change.toFixed(1)}%</span>
        </div>
      );
    } else if (change < 0) {
      return (
        <div className="flex items-center text-red-600 text-sm font-medium">
          <TrendingDown className="h-3 w-3 mr-1" />
          <span>{change.toFixed(1)}%</span>
        </div>
      );
    }
    return (
      <div className="flex items-center text-gray-500 text-sm font-medium">
        <span>0%</span>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200/50">
      {/* Header */}
      <div className="mb-8">
        <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
        {subtitle && (
          <p className="text-sm text-slate-600">{subtitle}</p>
        )}
      </div>

      {/* Chart Container */}
      <div 
        ref={chartRef}
        className="relative"
        style={{ height: `${height}px` }}
      >
        {/* Grid Lines */}
        <div className="absolute inset-0 flex flex-col justify-between">
          {[0, 25, 50, 75, 100].map((percent) => (
            <div
              key={percent}
              className="border-t border-slate-100"
              style={{ top: `${percent}%` }}
            />
          ))}
        </div>

        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-slate-500 pr-4">
          {[100, 75, 50, 25, 0].map((percent) => (
            <div key={percent} className="text-right">
              {valueFormatter((maxValue * percent) / 100)}
            </div>
          ))}
        </div>

        {/* Bars */}
        <div className="absolute left-16 right-0 top-0 bottom-0 flex items-end justify-between px-4">
          {data.map((item, index) => {
            const barHeight = getBarHeight(item.value);
            const isHovered = hoveredBar === index;
            const isAnimated = animatedBars[index];
            
            return (
              <div
                key={`${item.month}-${index}`}
                className="relative flex flex-col items-center group"
                style={{ width: `${100 / data.length}%` }}
                onMouseEnter={() => setHoveredBar(index)}
                onMouseLeave={() => setHoveredBar(null)}
              >
                {/* Value Label */}
                {isHovered && (
                  <div className="absolute bottom-full mb-2 px-3 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg shadow-lg z-10 whitespace-nowrap">
                    {valueFormatter(item.value)}
                    {showTrend && item.change !== undefined && (
                      <div className="mt-1">
                        {formatChange(item.change)}
                      </div>
                    )}
                  </div>
                )}

                {/* Bar */}
                <div
                  className="w-full rounded-t-lg transition-all duration-500 ease-out cursor-pointer relative group"
                  style={{
                    height: isAnimated ? `${barHeight}%` : '0%',
                    backgroundColor: getBarColor(index, isHovered),
                    minHeight: '4px',
                    boxShadow: isHovered 
                      ? '0 4px 12px rgba(0, 0, 0, 0.15)' 
                      : '0 2px 4px rgba(0, 0, 0, 0.1)'
                  }}
                >
                  {/* Hover effect overlay */}
                  {isHovered && (
                    <div className="absolute inset-0 bg-white/20 rounded-t-lg" />
                  )}
                </div>

                {/* Month Label */}
                <div className="mt-4 text-sm font-medium text-slate-700 text-center">
                  {item.month}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      {showTrend && (
        <div className="mt-6 pt-6 border-t border-slate-100">
          <div className="flex items-center justify-center space-x-6 text-sm text-slate-600">
            <div className="flex items-center space-x-2">
              <div 
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: color }}
              />
              <span>Bieżący okres</span>
            </div>
            {data.some(d => d.previousValue) && (
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-slate-300 rounded-sm" />
                <span>Poprzedni okres</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 