'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { getCurrentMonthLabel } from '../lib/date-utils';

interface AnimatedMetricsChartsProps {
  leads: {
    current: number;
    previous: number;
    change: number;
  };
  reservations: {
    current: number;
    previous: number;
    change: number;
  };
  reservationValue: {
    current: number;
    previous: number;
    change: number;
  };
  isLoading?: boolean;
}

export default function AnimatedMetricsCharts({
  leads,
  reservations,
  reservationValue,
  isLoading = false
}: AnimatedMetricsChartsProps) {
  const [animatedValues, setAnimatedValues] = useState({
    leads: 0,
    reservations: 0,
    reservationValue: 0
  });

  const [hairlineVisible, setHairlineVisible] = useState(false);
  const [ticksVisible, setTicksVisible] = useState(false);

  // Get current month label dynamically (e.g., "listopad '25")
  const currentMonthLabel = useMemo(() => getCurrentMonthLabel(), []);

  // Animate values on mount and when data changes
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    if (!isLoading) {
      // Hairline animation
      setTimeout(() => setHairlineVisible(true), 100);
      
      // Number count-up animation
      const duration = 600;
      const steps = 60;
      const stepDuration = duration / steps;

      const animateValue = (start: number, end: number, setter: (value: number) => void) => {
        const increment = (end - start) / steps;
        let current = start;
        let step = 0;

        const interval = setInterval(() => {
          step++;
          current += increment;
          
          if (step >= steps) {
            current = end;
            clearInterval(interval);
          }
          
          setter(Math.round(current));
        }, stepDuration);

        return interval;
      };

      const intervals = [
        animateValue(0, leads.current, (value) => setAnimatedValues(prev => ({ ...prev, leads: value }))),
        animateValue(0, reservations.current, (value) => setAnimatedValues(prev => ({ ...prev, reservations: value }))),
        animateValue(0, reservationValue.current, (value) => setAnimatedValues(prev => ({ ...prev, reservationValue: value })))
      ];

      // Ticks animation after numbers
      setTimeout(() => setTicksVisible(true), duration + 200);

      cleanup = () => intervals.forEach(clearInterval);
    }

    return () => {
      if (cleanup) cleanup();
    };
  }, [leads.current, reservations.current, reservationValue.current, isLoading]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getProgressPercentage = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.min((current / previous) * 100, 100);
  };

  // Create tick-rail progress indicator
  const createTickRail = (current: number, previous: number, color: string, maxTicks: number = 36) => {
    const percentage = getProgressPercentage(current, previous);
    const filledTicks = Math.round((percentage / 100) * maxTicks);
    
    return (
      <div className="relative">
        <div className="flex space-x-0.5 h-4 sm:h-5 mb-2">
          {Array.from({ length: maxTicks }, (_, index) => (
            <div 
              key={index}
              className={`w-0.5 sm:w-1 rounded-sm transition-all duration-300 ease-out ${
                index < filledTicks 
                  ? color
                  : 'bg-navy-30'
              }`}
              style={{
                animationDelay: `${index * 8}ms`,
                animation: ticksVisible ? 'tick-stagger 0.24s ease-out forwards' : 'none',
                opacity: ticksVisible ? 1 : 0,
                transform: ticksVisible ? 'scaleY(1)' : 'scaleY(0)'
              }}
            />
          ))}
        </div>
        <div className="flex justify-between text-xs sm:text-sm text-muted">
          <span>0</span>
          <span>{formatNumber(previous)}</span>
        </div>
      </div>
    );
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return '▲';
    if (change < 0) return '▼';
    return '—';
  };

  const getChangeColor = (change: number) => {
    // Use monochromatic navy for all changes (ultra-clean editorial look)
    return 'text-navy';
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
      {/* Pozyskane leady */}
      <div className="bg-bg rounded-2xl p-4 sm:p-6 md:p-7 shadow-sm border border-stroke hover:shadow-md transition-all duration-200 cursor-default w-full">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-muted">
            Pozyskane leady
          </h3>
          <span className="text-xs text-muted opacity-60">{currentMonthLabel}</span>
        </div>
        
        {/* Hairline */}
        <div 
          className="hairline mb-3 transition-all duration-180 ease-out"
          style={{
            transform: hairlineVisible ? 'scaleX(1)' : 'scaleX(0)',
            transformOrigin: 'left'
          }}
        />

        <div className="mb-4 sm:mb-6">
          <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-text tracking-tight mb-2 tabular-nums" style={{ letterSpacing: '-0.01em' }}>
            {isLoading ? (
              <div className="h-12 sm:h-14 md:h-16 bg-stroke rounded animate-pulse"></div>
            ) : (
              formatNumber(animatedValues.leads)
            )}
          </div>
          <div className={`text-sm ${getChangeColor(leads.change)} flex items-center space-x-1`}>
            <span>vs {formatNumber(leads.previous)} poprzedni miesiąc</span>
            <span className="text-xs">{leads.change > 0 ? '+' : leads.change < 0 ? '-' : ''}{getChangeIcon(leads.change)}</span>
          </div>
        </div>

        {/* Tick-rail */}
        {createTickRail(leads.current, leads.previous, 'bg-navy')}
      </div>

      {/* Rezerwacje */}
      <div className="bg-bg rounded-2xl p-4 sm:p-6 md:p-7 shadow-sm border border-stroke hover:shadow-md transition-all duration-200 cursor-default w-full">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-muted">
            Rezerwacje
          </h3>
          <span className="text-xs text-muted opacity-60">{currentMonthLabel}</span>
        </div>
        
        {/* Hairline */}
        <div 
          className="hairline mb-3 transition-all duration-180 ease-out"
          style={{
            transform: hairlineVisible ? 'scaleX(1)' : 'scaleX(0)',
            transformOrigin: 'left'
          }}
        />

        <div className="mb-4 sm:mb-6">
          <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-text tracking-tight mb-2 tabular-nums" style={{ letterSpacing: '-0.01em' }}>
            {isLoading ? (
              <div className="h-12 sm:h-14 md:h-16 bg-stroke rounded animate-pulse"></div>
            ) : (
              formatNumber(animatedValues.reservations)
            )}
          </div>
          <div className={`text-sm ${getChangeColor(reservations.change)} flex items-center space-x-1`}>
            <span>vs {formatNumber(reservations.previous)} poprzedni miesiąc</span>
            <span className="text-xs">{reservations.change > 0 ? '+' : reservations.change < 0 ? '-' : ''}{getChangeIcon(reservations.change)}</span>
          </div>
        </div>

        {/* Tick-rail */}
        {createTickRail(reservations.current, reservations.previous, 'bg-navy')}
      </div>

      {/* Wartość rezerwacji */}
      <div className="bg-bg rounded-2xl p-4 sm:p-6 md:p-7 shadow-sm border border-stroke hover:shadow-md transition-all duration-200 cursor-default w-full">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-muted">
            Wartość rezerwacji
          </h3>
          <span className="text-xs text-muted opacity-60">{currentMonthLabel}</span>
        </div>
        
        {/* Hairline */}
        <div 
          className="hairline mb-3 transition-all duration-180 ease-out"
          style={{
            transform: hairlineVisible ? 'scaleX(1)' : 'scaleX(0)',
            transformOrigin: 'left'
          }}
        />

        <div className="mb-4 sm:mb-6">
          <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-text tracking-tight mb-2 tabular-nums" style={{ letterSpacing: '-0.01em' }}>
            {isLoading ? (
              <div className="h-12 sm:h-14 md:h-16 bg-stroke rounded animate-pulse"></div>
            ) : (
              formatCurrency(animatedValues.reservationValue)
            )}
          </div>
          <div className={`text-sm ${getChangeColor(reservationValue.change)} flex items-center space-x-1`}>
            <span>vs {formatCurrency(reservationValue.previous)} poprzedni miesiąc</span>
            <span className="text-xs">{reservationValue.change > 0 ? '+' : reservationValue.change < 0 ? '-' : ''}{getChangeIcon(reservationValue.change)}</span>
          </div>
        </div>

        {/* Tick-rail with orange color for value */}
        {createTickRail(reservationValue.current, reservationValue.previous, 'bg-orange')}
      </div>
    </div>
  );
} 