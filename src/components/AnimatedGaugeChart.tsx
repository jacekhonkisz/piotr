'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';

interface AnimatedGaugeChartProps {
  value: number;
  maxValue: number;
  title: string;
  subtitle?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
  targetValue?: number;
  formatValue?: (value: number) => string;
}

export default function AnimatedGaugeChart({
  value,
  maxValue,
  title,
  subtitle,
  color = '#6366f1',
  size = 'md',
  showPercentage = true,
  targetValue,
  formatValue = (value) => value.toLocaleString()
}: AnimatedGaugeChartProps) {
  const [isVisible, setIsVisible] = useState(false);
  const controls = useAnimation();
  const ref = useRef<HTMLDivElement>(null);

  const sizeConfig = {
    sm: { width: 200, height: 120, bars: 40, barWidth: 3, barHeight: 20 },
    md: { width: 280, height: 160, bars: 50, barWidth: 4, barHeight: 28 },
    lg: { width: 360, height: 200, bars: 60, barWidth: 5, barHeight: 35 }
  };

  const config = sizeConfig[size];
  const percentage = Math.min((value / maxValue) * 100, 100);
  const filledBars = Math.floor((percentage / 100) * config.bars);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          setIsVisible(true);
          controls.start({ 
            scale: 1,
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

  return (
    <motion.div
      ref={ref}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={controls}
      className="relative flex flex-col items-center"
      style={{ width: config.width, height: config.height + 80 }}
    >
      {/* Gauge SVG */}
      <div className="relative" style={{ width: config.width, height: config.height }}>
        <svg
          width={config.width}
          height={config.height}
          viewBox={`0 0 ${config.width} ${config.height}`}
          className="overflow-visible"
        >
          {/* Background and animated bars */}
          {Array.from({ length: config.bars }).map((_, index) => {
            const angle = (index / (config.bars - 1)) * 180; // 0 to 180 degrees
            const radian = (angle - 90) * (Math.PI / 180); // Convert to radians, offset by -90°
            const radius = config.width / 2 - config.barHeight - 10;
            const x = config.width / 2 + Math.cos(radian) * radius;
            const y = config.height - 20 + Math.sin(radian) * radius;
            
            const isFilled = index < filledBars;
            const opacity = isFilled ? 1 : 0.1;
            
            return (
              <motion.rect
                key={index}
                x={x - config.barWidth / 2}
                y={y - config.barHeight / 2}
                width={config.barWidth}
                height={config.barHeight}
                rx={config.barWidth / 2}
                fill={color}
                initial={{ opacity: 0.1 }}
                animate={isVisible ? { 
                  opacity,
                  transition: { 
                    delay: index * 0.03,
                    duration: 0.4,
                    ease: "easeOut"
                  }
                } : {}}
                transform={`rotate(${angle} ${x} ${y})`}
              />
            );
          })}
        </svg>

        {/* Center content */}
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ top: '40%' }}
        >
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={isVisible ? { 
              scale: 1, 
              opacity: 1,
              transition: { delay: 0.8, duration: 0.5 }
            } : {}}
            className="text-center"
          >
            <div className="text-gray-500 text-sm mb-2 font-medium">
              {title}
            </div>
            <div 
              className="font-bold text-gray-900 mb-1"
              style={{ fontSize: size === 'lg' ? '2.5rem' : size === 'md' ? '2rem' : '1.5rem' }}
            >
              {showPercentage ? `${percentage.toFixed(1)}%` : formatValue(value)}
            </div>
            {subtitle && (
              <div className="text-gray-400 text-xs">
                {subtitle}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Bottom info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={isVisible ? { 
          opacity: 1, 
          y: 0,
          transition: { delay: 1, duration: 0.5 }
        } : {}}
        className="mt-4 text-center"
      >
        {targetValue && (
          <div className="text-xs text-amber-600 font-medium">
            Target: {formatValue(targetValue)}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
} 