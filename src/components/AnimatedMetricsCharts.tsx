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
  clientId?: string;
  platform?: 'meta' | 'google';
}

export default function AnimatedMetricsCharts({
  leads,
  reservations,
  reservationValue,
  isLoading = false,
  clientId,
  platform = 'meta'
}: AnimatedMetricsChartsProps) {
  const [animatedValues, setAnimatedValues] = useState({
    leads: 0,
    reservations: 0,
    reservationValue: 0
  });

  const [hairlineVisible, setHairlineVisible] = useState(false);
  const [ticksVisible, setTicksVisible] = useState(false);

  // Self-fetched previous month data (bypasses parent state issues)
  const [selfFetchedPrev, setSelfFetchedPrev] = useState<{
    booking_step_1: number;
    reservations: number;
    reservation_value: number;
  } | null>(null);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    fetch(`/api/previous-month-metrics?clientId=${clientId}&platform=${platform}`)
      .then(res => res.json())
      .then(data => {
        if (!cancelled && data) {
          setSelfFetchedPrev({
            booking_step_1: data.booking_step_1 || 0,
            reservations: data.reservations || 0,
            reservation_value: data.reservation_value || 0
          });
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [clientId, platform]);

  // Use self-fetched data if parent passed zeros but we have real data
  const resolvedLeads = useMemo(() => {
    if (selfFetchedPrev && leads.previous === 0 && selfFetchedPrev.booking_step_1 > 0) {
      const prev = selfFetchedPrev.booking_step_1;
      return { current: leads.current, previous: prev, change: prev > 0 ? ((leads.current - prev) / prev) * 100 : 0 };
    }
    return leads;
  }, [leads, selfFetchedPrev]);

  const resolvedReservations = useMemo(() => {
    if (selfFetchedPrev && reservations.previous === 0 && selfFetchedPrev.reservations > 0) {
      const prev = selfFetchedPrev.reservations;
      return { current: reservations.current, previous: prev, change: prev > 0 ? ((reservations.current - prev) / prev) * 100 : 0 };
    }
    return reservations;
  }, [reservations, selfFetchedPrev]);

  const resolvedReservationValue = useMemo(() => {
    if (selfFetchedPrev && reservationValue.previous === 0 && selfFetchedPrev.reservation_value > 0) {
      const prev = selfFetchedPrev.reservation_value;
      return { current: reservationValue.current, previous: prev, change: prev > 0 ? ((reservationValue.current - prev) / prev) * 100 : 0 };
    }
    return reservationValue;
  }, [reservationValue, selfFetchedPrev]);

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
        animateValue(0, resolvedLeads.current, (value) => setAnimatedValues(prev => ({ ...prev, leads: value }))),
        animateValue(0, resolvedReservations.current, (value) => setAnimatedValues(prev => ({ ...prev, reservations: value }))),
        animateValue(0, resolvedReservationValue.current, (value) => setAnimatedValues(prev => ({ ...prev, reservationValue: value })))
      ];

      // Ticks animation after numbers
      setTimeout(() => setTicksVisible(true), duration + 200);

      cleanup = () => intervals.forEach(clearInterval);
    }

    return () => {
      if (cleanup) cleanup();
    };
  }, [resolvedLeads.current, resolvedReservations.current, resolvedReservationValue.current, isLoading]);

  const formatNumber = (num: number) => {
    return num.toLocaleString('pl-PL');
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
          <div className={`text-sm ${getChangeColor(resolvedLeads.change)} flex items-center space-x-1`}>
            <span>vs {formatNumber(resolvedLeads.previous)} poprzedni miesiąc</span>
            <span className="text-xs">{resolvedLeads.change > 0 ? '+' : resolvedLeads.change < 0 ? '-' : ''}{getChangeIcon(resolvedLeads.change)}</span>
          </div>
        </div>

        {/* Tick-rail */}
        {createTickRail(resolvedLeads.current, resolvedLeads.previous, 'bg-navy')}
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
          <div className={`text-sm ${getChangeColor(resolvedReservations.change)} flex items-center space-x-1`}>
            <span>vs {formatNumber(resolvedReservations.previous)} poprzedni miesiąc</span>
            <span className="text-xs">{resolvedReservations.change > 0 ? '+' : resolvedReservations.change < 0 ? '-' : ''}{getChangeIcon(resolvedReservations.change)}</span>
          </div>
        </div>

        {/* Tick-rail */}
        {createTickRail(resolvedReservations.current, resolvedReservations.previous, 'bg-navy')}
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
          <div className={`text-sm ${getChangeColor(resolvedReservationValue.change)} flex items-center space-x-1`}>
            <span>vs {formatCurrency(resolvedReservationValue.previous)} poprzedni miesiąc</span>
            <span className="text-xs">{resolvedReservationValue.change > 0 ? '+' : resolvedReservationValue.change < 0 ? '-' : ''}{getChangeIcon(resolvedReservationValue.change)}</span>
          </div>
        </div>

        {/* Tick-rail with orange color for value */}
        {createTickRail(resolvedReservationValue.current, resolvedReservationValue.previous, 'bg-orange')}
      </div>
    </div>
  );
} 