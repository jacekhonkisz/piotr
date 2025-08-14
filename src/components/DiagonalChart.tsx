'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';

interface DiagonalChartProps {
  value: number;
  maxValue: number;
  title: string;
  subtitle?: string;
  color?: string;
  icon?: React.ReactNode;
  formatValue?: (value: number) => string;
  trend?: {
    value: number;
    label: string;
    isPositive: boolean;
  };
  delay?: number; // Add delay prop for staggered animations
}

export default function DiagonalChart({
  value,
  maxValue,
  title,
  subtitle,
  color = '#6366f1',
  icon,
  formatValue = (value) => value.toLocaleString(),
  trend,
  delay = 0
}: DiagonalChartProps) {
  const [isVisible, setIsVisible] = useState(false);
  const controls = useAnimation();
  const ref = useRef<HTMLDivElement>(null);

  const percentage = Math.min((value / maxValue) * 100, 100);
  const size = 200; // Increased size for bigger charts
  const radius = size / 2 - 15;
  const totalBars = 36; // Slightly more bars for better detail
  const filledBars = Math.floor((percentage / 100) * totalBars);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          controls.start({ 
            scale: 1,
            opacity: 1,
            transition: { 
              duration: 0.8, 
              ease: "easeOut",
              delay: delay * 0.1 // Stagger animations
            }
          });
        }
      },
      { threshold: 0.2 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [controls, delay]);

  return (
    <motion.div
      ref={ref}
      initial={{ scale: 0.95, opacity: 0, y: 20 }}
      animate={controls}
      className="relative bg-white/95 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border border-white/20 overflow-hidden group hover:shadow-3xl transition-all duration-500 hover:scale-[1.02] flex flex-col"
      style={{ minHeight: '450px' }} // Increased height for bigger charts
    >
      {/* Icon in corner - moved to top */}
      {icon && (
        <motion.div
          className="absolute top-6 right-6 w-12 h-12 rounded-2xl flex items-center justify-center opacity-90 shadow-lg"
          style={{ backgroundColor: `${color}20` }} // Lighter background
          initial={{ scale: 0, rotate: -180 }}
          animate={isVisible ? { scale: 1, rotate: 0 } : {}}
          transition={{ delay: delay * 0.1 + 0.3, duration: 0.6, ease: "backOut" }}
        >
          <div style={{ color: color }} className="drop-shadow-sm">
            {icon}
          </div>
        </motion.div>
      )}

      {/* Title */}
      <motion.div 
        className="text-center mb-8"
        initial={{ opacity: 0, y: 10 }}
        animate={isVisible ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: delay * 0.1 + 0.2, duration: 0.5 }}
      >
        <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
        {subtitle && <p className="text-sm text-gray-600 leading-relaxed">{subtitle}</p>}
      </motion.div>

      {/* Chart Container with proper spacing */}
      <div className="relative flex justify-center mb-8 flex-1">
        <div className="relative" style={{ width: size, height: size / 2 + 20 }}>
          <svg
            width={size}
            height={size / 2 + 20}
            viewBox={`0 0 ${size} ${size / 2 + 20}`}
            className="overflow-visible"
          >
            {/* Background bars - more visible */}
            {Array.from({ length: totalBars }).map((_, index) => {
              const angle = (index / (totalBars - 1)) * 180; // 0 to 180 degrees
              const radian = (angle - 90) * (Math.PI / 180);
              const innerRadius = radius - 12;
              const outerRadius = radius + 12;
              
              const x1 = size / 2 + Math.cos(radian) * innerRadius;
              const y1 = size / 2 + Math.sin(radian) * innerRadius;
              const x2 = size / 2 + Math.cos(radian) * outerRadius;
              const y2 = size / 2 + Math.sin(radian) * outerRadius;
              
              return (
                <line
                  key={`bg-${index}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#e5e7eb"
                  strokeWidth={2}
                  strokeLinecap="round"
                  opacity={0.6}
                />
              );
            })}

            {/* Animated bars - more prominent */}
            {Array.from({ length: totalBars }).map((_, index) => {
              const angle = (index / (totalBars - 1)) * 180; // 0 to 180 degrees
              const radian = (angle - 90) * (Math.PI / 180);
              const innerRadius = radius - 12;
              const outerRadius = radius + 12;
              
              const x1 = size / 2 + Math.cos(radian) * innerRadius;
              const y1 = size / 2 + Math.sin(radian) * innerRadius;
              const x2 = size / 2 + Math.cos(radian) * outerRadius;
              const y2 = size / 2 + Math.sin(radian) * outerRadius;
              
              const isFilled = index < filledBars;
              const barColor = isFilled ? color : 'transparent';
              
              return (
                <motion.line
                  key={`fill-${index}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={barColor}
                  strokeWidth={3}
                  strokeLinecap="round"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={isVisible ? { 
                    opacity: isFilled ? 1 : 0,
                    scale: 1,
                    transition: { 
                      delay: delay * 0.1 + 0.4 + (index * 0.02),
                      duration: 0.3,
                      ease: "easeOut"
                    }
                  } : {}}
                />
              );
            })}
          </svg>

          {/* Center content - positioned at the actual center of the semi-circular chart */}
          <div 
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{
              top: `${size / 2}px`, // Position at the center of the semi-circle
              left: '50%',
              transform: 'translateX(-50%)'
            }}
          >
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={isVisible ? { 
                scale: 1, 
                opacity: 1,
                transition: { delay: delay * 0.1 + 0.8, duration: 0.6, ease: "backOut" }
              } : {}}
              className="text-center"
            >
              <div className="text-3xl font-bold text-gray-900 drop-shadow-sm">
                {formatValue(value)}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Trend indicator - positioned at bottom with clear separation */}
      {trend && (
        <motion.div
          className="flex items-center justify-center mt-6"
          initial={{ opacity: 0, y: 10 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: delay * 0.1 + 1.0, duration: 0.5 }}
        >
          <div className={`flex items-center space-x-2 text-sm font-medium px-3 py-1.5 rounded-full ${
            trend.label.includes('Brak danych') 
              ? 'text-gray-600 bg-gray-50 border border-gray-200'
              : trend.isPositive 
                ? 'text-green-700 bg-green-50 border border-green-200' 
                : 'text-red-700 bg-red-50 border border-red-200'
          }`}>
            <motion.div
              initial={{ rotate: 0 }}
              animate={isVisible ? { rotate: trend.isPositive ? 0 : 180 } : {}}
              transition={{ delay: delay * 0.1 + 1.2, duration: 0.4 }}
              className="text-base"
            >
              {trend.label.includes('Brak danych') ? '—' : (trend.isPositive ? '↗' : '↘')}
            </motion.div>
            <span className="text-xs">{trend.label}</span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
} 