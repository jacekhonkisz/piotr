'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';

interface DataPoint {
  date: string;
  value: number;
  target?: number;
}

interface AnimatedLineChartProps {
  data: DataPoint[];
  title: string;
  subtitle?: string;
  color?: string;
  targetColor?: string;
  height?: number;
  showTarget?: boolean;
  formatValue?: (value: number) => string;
}

export default function AnimatedLineChart({
  data,
  title,
  subtitle,
  color = '#6366f1',
  targetColor = '#f59e0b',
  height = 300,
  showTarget = false,
  formatValue = (value) => value.toLocaleString()
}: AnimatedLineChartProps) {
  const [isVisible, setIsVisible] = useState(false);
  const controls = useAnimation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry && entry.isIntersecting) {
          setIsVisible(true);
          controls.start({ 
            opacity: 1,
            transition: { duration: 0.8, ease: "easeOut" }
          });
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [controls]);

  if (!data || data.length === 0) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="h-64 bg-gray-50 rounded-xl flex items-center justify-center">
          <p className="text-gray-500">Brak danych</p>
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value), ...(showTarget ? data.map(d => d.target || 0) : [0]));
  const minValue = Math.min(...data.map(d => d.value), ...(showTarget ? data.map(d => d.target || 0) : [0]));
  const range = maxValue - minValue;

  const getY = (value: number) => {
    return height - ((value - minValue) / range) * (height - 40);
  };

  const getX = (index: number) => {
    return (index / (data.length - 1)) * (100 - 10) + 5; // 5% padding on each side
  };

  const createPath = (dataPoints: DataPoint[], valueKey: 'value' | 'target') => {
    return dataPoints
      .map((point, index) => {
        const x = getX(index);
        const y = getY(point[valueKey] || 0);
        return `${index === 0 ? 'M' : 'L'} ${x}% ${y}`;
      })
      .join(' ');
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={controls}
      className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
        </div>
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
            <span className="text-gray-600">Aktualne</span>
          </div>
          {showTarget && (
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: targetColor }}></div>
              <span className="text-gray-600">Cel</span>
            </div>
          )}
        </div>
      </div>

      <div className="relative" style={{ height }}>
        <svg
          className="w-full h-full"
          viewBox={`0 0 100 ${height}`}
          preserveAspectRatio="none"
        >
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((percent) => (
            <line
              key={percent}
              x1="5%"
              y1={height * (percent / 100)}
              x2="95%"
              y2={height * (percent / 100)}
              stroke="#e5e7eb"
              strokeWidth="1"
              opacity="0.5"
            />
          ))}

          {/* Target line */}
          {showTarget && (
            <motion.path
              d={createPath(data, 'target')}
              stroke={targetColor}
              strokeWidth="2"
              fill="none"
              strokeDasharray="5,5"
              initial={{ pathLength: 0 }}
              animate={isVisible ? { pathLength: 1 } : {}}
              transition={{ duration: 1.5, delay: 0.3 }}
            />
          )}

          {/* Main data line */}
          <motion.path
            d={createPath(data, 'value')}
            stroke={color}
            strokeWidth="3"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={isVisible ? { pathLength: 1 } : {}}
            transition={{ duration: 1.5, delay: 0.5 }}
          />

          {/* Data points */}
          {data.map((point, index) => (
            <motion.circle
              key={index}
              cx={`${getX(index)}%`}
              cy={getY(point.value)}
              r="4"
              fill={color}
              initial={{ scale: 0, opacity: 0 }}
              animate={isVisible ? { scale: 1, opacity: 1 } : {}}
              transition={{ delay: 0.8 + index * 0.1, duration: 0.3 }}
            />
          ))}
        </svg>

        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 pointer-events-none">
          {[maxValue, maxValue * 0.75, maxValue * 0.5, maxValue * 0.25, minValue].map((value, index) => (
            <div key={index} className="transform -translate-y-1/2">
              {formatValue(value)}
            </div>
          ))}
        </div>

        {/* X-axis labels */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-500">
          {data.map((point, index) => (
            <div key={index} className="transform -translate-x-1/2">
              {new Date(point.date).toLocaleDateString('pl-PL', { month: 'short', day: 'numeric' })}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
} 