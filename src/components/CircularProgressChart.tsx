'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';

interface CircularProgressChartProps {
  value: number;
  maxValue: number;
  title: string;
  subtitle?: string;
  color?: string;
  backgroundColor?: string;
  size?: number;
  strokeWidth?: number;
  formatValue?: (value: number) => string;
  showTotal?: boolean;
}

export default function CircularProgressChart({
  value,
  maxValue,
  title,
  subtitle,
  color = '#6366f1',
  backgroundColor = '#e5e7eb',
  size = 280,
  strokeWidth = 8,
  formatValue = (value) => value.toLocaleString(),
  showTotal = false
}: CircularProgressChartProps) {
  const [isVisible, setIsVisible] = useState(false);
  const controls = useAnimation();
  const ref = useRef<HTMLDivElement>(null);

  const percentage = Math.min((value / maxValue) * 100, 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * radius; // Half circle
  const strokeDasharray = `${circumference} ${circumference}`;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Generate bars for the semi-circular progress
  const totalBars = 60;
  const filledBars = Math.floor((percentage / 100) * totalBars);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
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
      className="relative flex flex-col items-center bg-white rounded-2xl p-8"
      style={{ width: size + 40, minHeight: size + 100 }}
    >
      {/* Title */}
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
        {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
      </div>

      {/* Circular Progress with Bars */}
      <div className="relative" style={{ width: size, height: size / 2 + 40 }}>
        <svg
          width={size}
          height={size / 2 + 40}
          viewBox={`0 0 ${size} ${size / 2 + 40}`}
          className="overflow-visible"
        >
          {/* Animated bars */}
          {Array.from({ length: totalBars }).map((_, index) => {
            const angle = (index / (totalBars - 1)) * 180; // 0 to 180 degrees
            const radian = (angle - 90) * (Math.PI / 180);
            const innerRadius = radius - 20;
            const outerRadius = radius + 10;
            
            const x1 = size / 2 + Math.cos(radian) * innerRadius;
            const y1 = size / 2 + Math.sin(radian) * innerRadius;
            const x2 = size / 2 + Math.cos(radian) * outerRadius;
            const y2 = size / 2 + Math.sin(radian) * outerRadius;
            
            const isFilled = index < filledBars;
            const barColor = isFilled ? color : backgroundColor;
            const opacity = isFilled ? 1 : 0.3;
            
            return (
              <motion.line
                key={index}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={barColor}
                strokeWidth={3}
                strokeLinecap="round"
                initial={{ opacity: 0.3 }}
                animate={isVisible ? { 
                  opacity,
                  transition: { 
                    delay: index * 0.02,
                    duration: 0.4,
                    ease: "easeOut"
                  }
                } : {}}
              />
            );
          })}
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-8">
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={isVisible ? { 
              scale: 1, 
              opacity: 1,
              transition: { delay: 0.8, duration: 0.5 }
            } : {}}
            className="text-center"
          >
            <div className="text-gray-500 text-sm font-medium mb-2">
              {showTotal ? 'Total Amount Raised' : title}
            </div>
            <div className="text-4xl font-bold text-gray-900">
              {formatValue(value)}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
} 