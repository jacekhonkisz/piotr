'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';

interface DistributionItem {
  name: string;
  value: number;
  percentage: number;
  color?: string;
}

interface DistributionChartProps {
  data: DistributionItem[];
  title: string;
  subtitle?: string;
  totalValue?: number;
  formatValue?: (value: number) => string;
  showControls?: boolean;
  onRefresh?: () => void;
}

export default function DistributionChart({
  data,
  title,
  subtitle,
  totalValue,
  formatValue = (value) => value.toLocaleString(),
  showControls = true,
  onRefresh
}: DistributionChartProps) {
  const [isVisible, setIsVisible] = useState(false);
  const controls = useAnimation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          controls.start({ 
            opacity: 1,
            transition: { duration: 0.6, ease: "easeOut" }
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

  const colors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
    '#3b82f6', '#06b6d4', '#84cc16', '#f97316', '#ef4444'
  ];

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
        {showControls && (
          <div className="flex items-center space-x-2">
            <button
              onClick={onRefresh}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Odśwież"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Filtruj"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {data.map((item, index) => (
          <motion.div
            key={item.name}
            initial={{ opacity: 0, x: -20 }}
            animate={isVisible ? { 
              opacity: 1, 
              x: 0,
              transition: { delay: index * 0.1, duration: 0.5 }
            } : {}}
            className="flex items-center space-x-4"
          >
            {/* Color indicator */}
            <div 
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color || colors[index % colors.length] }}
            />
            
            {/* Item name */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
            </div>
            
            {/* Percentage */}
            <div className="text-sm font-medium text-gray-600 w-12 text-right">
              {item.percentage.toFixed(0)}%
            </div>
            
            {/* Value */}
            <div className="text-sm font-bold text-gray-900 w-20 text-right">
              {formatValue(item.value)}
            </div>
            
            {/* Animated bar */}
            <div className="flex-1 max-w-40">
              <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ 
                    backgroundColor: item.color || colors[index % colors.length],
                    boxShadow: `0 0 8px ${item.color || colors[index % colors.length]}30`
                  }}
                  initial={{ width: 0 }}
                  animate={isVisible ? { width: `${item.percentage}%` } : {}}
                  transition={{ 
                    delay: index * 0.1 + 0.3, 
                    duration: 1.2, 
                    ease: "easeOut" 
                  }}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {totalValue && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={isVisible ? { 
            opacity: 1, 
            scale: 1,
            transition: { delay: 0.5, duration: 0.5 }
          } : {}}
          className="mt-6 pt-4 border-t border-gray-200"
        >
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">Łączna wartość</p>
            <p className="text-2xl font-bold text-gray-900">{formatValue(totalValue)}</p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
} 