'use client';

import React, { useState, useEffect } from 'react';

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

  // Animate values on mount and when data changes
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    if (!isLoading) {
      const duration = 1500;
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

  // Create thin vertical bars for progress indicator (like the image)
  const createProgressBar = (current: number, previous: number, color: string, maxBars: number = 40) => {
    const percentage = getProgressPercentage(current, previous);
    const filledBars = Math.round((percentage / 100) * maxBars);
    
    return (
      <div className="flex space-x-0.5 h-3">
        {Array.from({ length: maxBars }, (_, index) => (
          <div 
            key={index}
            className={`w-1 rounded-sm transition-all duration-1000 ease-out ${
              index < filledBars 
                ? color
                : 'bg-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Pozyskane leady */}
      <div className="bg-gray-50 rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-medium text-gray-900">
            Pozyskane leady
          </h3>
          <span className="text-sm text-gray-500">Bieżący miesiąc</span>
        </div>
        
        <div className="border-b border-gray-300 mb-6"></div>

        <div className="mb-6">
          <div className="text-5xl font-bold text-gray-900 tracking-tight mb-2">
            {isLoading ? (
              <div className="h-16 bg-gray-200 rounded animate-pulse"></div>
            ) : (
              formatNumber(animatedValues.leads)
            )}
          </div>
          <div className="text-sm text-gray-500">
            vs {formatNumber(leads.previous)} poprzedni miesiąc
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative">
          {createProgressBar(leads.current, leads.previous, 'bg-blue-600')}
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>0</span>
            <span>{formatNumber(leads.previous)}</span>
          </div>
        </div>
      </div>

      {/* Rezerwacje */}
      <div className="bg-gray-50 rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-medium text-gray-900">
            Rezerwacje
          </h3>
          <span className="text-sm text-gray-500">Bieżący miesiąc</span>
        </div>
        
        <div className="border-b border-gray-300 mb-6"></div>

        <div className="mb-6">
          <div className="text-5xl font-bold text-gray-900 tracking-tight mb-2">
            {isLoading ? (
              <div className="h-16 bg-gray-200 rounded animate-pulse"></div>
            ) : (
              formatNumber(animatedValues.reservations)
            )}
          </div>
          <div className="text-sm text-gray-500">
            vs {formatNumber(reservations.previous)} poprzedni miesiąc
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative">
          {createProgressBar(reservations.current, reservations.previous, 'bg-green-600')}
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>0</span>
            <span>{formatNumber(reservations.previous)}</span>
          </div>
        </div>
      </div>

      {/* Wartość rezerwacji */}
      <div className="bg-gray-50 rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-medium text-gray-900">
            Wartość rezerwacji
          </h3>
          <span className="text-sm text-gray-500">Bieżący miesiąc</span>
        </div>
        
        <div className="border-b border-gray-300 mb-6"></div>

        <div className="mb-6">
          <div className="text-5xl font-bold text-gray-900 tracking-tight mb-2">
            {isLoading ? (
              <div className="h-16 bg-gray-200 rounded animate-pulse"></div>
            ) : (
              formatCurrency(animatedValues.reservationValue)
            )}
          </div>
          <div className="text-sm text-gray-500">
            vs {formatCurrency(reservationValue.previous)} poprzedni miesiąc
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative">
          {createProgressBar(reservationValue.current, reservationValue.previous, 'bg-orange-600')}
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>0 zł</span>
            <span>{formatCurrency(reservationValue.previous)}</span>
          </div>
        </div>
      </div>
    </div>
  );
} 