"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type KPI = {
  id: string;
  label: string;
  value: string | number;
  sublabel?: string;
  trendYoY?: number;
  bars: number[]; // 0..1 or raw
  dateForMarker?: string; // ISO date
};

export type KPICarouselProps = {
  items: KPI[];
  variant?: "light" | "dark";
  autoMs?: number; // default 8000
};

// Easing from spec
const easeOutCustom: number[] = [0.22, 0.61, 0.36, 1];

function normalizeBars(values: number[]): number[] {
  if (!values || values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max <= 0) return values.map(() => 0.02); // edge-case zeros → thin line
  // If already in 0..1 range
  if (max <= 1 && min >= 0) return values.map((v) => Math.max(0.02, v));
  return values.map((v) => Math.max(0.02, (v - min) / (max - min)));
}

export default function KPICarousel({ items, variant = "light", autoMs = 8000 }: KPICarouselProps) {
  const [index, setIndex] = useState(0);
  const hoverRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const next = () => setIndex((i) => (i + 1) % items.length);
  const prev = () => setIndex((i) => (i - 1 + items.length) % items.length);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!hoverRef.current) next();
    }, autoMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [items.length, autoMs]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!items || items.length === 0) return null;
  const safeIdx = Math.max(0, Math.min(index, items.length - 1));
  const current = items[safeIdx];

  return (
    <section
      className="relative"
      aria-roledescription="carousel"
      aria-label="KPI carousel"
      onMouseEnter={() => (hoverRef.current = true)}
      onMouseLeave={() => (hoverRef.current = false)}
    >
      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={current?.id}
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -40, opacity: 0 }}
            transition={{ duration: 0.35, ease: easeOutCustom as any }}
          >
            {current && (
              <KpiSlide
                kpi={current}
                variant={variant}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* dots */}
      <div className="mt-4 flex items-center justify-center gap-2" role="tablist" aria-label="KPI pager">
        {items.map((_, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === index}
            aria-label={`Przejdź do slajdu ${i + 1}`}
            onClick={() => setIndex(i)}
            className={`h-1.5 w-6 rounded-full transition-colors ${i === index ? "bg-secondary-600" : "bg-slate-300"}`}
          />
        ))}
      </div>
    </section>
  );
}

function KpiSlide({ kpi, variant = "light" }: { kpi: KPI; variant?: "light" | "dark" }) {
  const bars = useMemo(() => normalizeBars(kpi.bars), [kpi.bars]);
  const prefersReduced = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Count-up for numeric values
  const [displayValue, setDisplayValue] = useState<string>(String(kpi.value));
  useEffect(() => {
    const num = typeof kpi.value === "number" ? kpi.value : Number(String(kpi.value).replace(/[^0-9.,-]/g, '').replace(',', '.'));
    if (Number.isNaN(num)) {
      setDisplayValue(String(kpi.value));
      return;
    }
    if (prefersReduced) {
      setDisplayValue(new Intl.NumberFormat('pl-PL').format(Math.round(num)));
      return;
    }
    let raf: number | null = null;
    const duration = 900;
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 2);
      const v = Math.round(num * eased);
      setDisplayValue(new Intl.NumberFormat('pl-PL').format(v));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [kpi.value, prefersReduced]);

  return (
    <div
      className={`relative grid grid-cols-12 gap-0 rounded-lg border shadow-sm p-0 md:p-0 hover:shadow-md transition-all duration-200 ${
        variant === "dark" ? "bg-secondary-800 border-secondary-700" : "bg-slate-50 border-slate-200"
      }`}
      aria-label={`${kpi.label}: ${String(kpi.value)}`}
    >
      {/* left navy panel */}
      <div className="col-span-12 md:col-span-5 bg-secondary-600 text-white rounded-t-lg md:rounded-l-lg md:rounded-tr-none flex items-center justify-center p-6 md:p-8">
        <div className="text-center md:text-left w-full">
          <div className="text-sm md:text-base opacity-90">{kpi.label}</div>
          <div className="mt-2 text-5xl md:text-6xl font-semibold leading-none">{displayValue}</div>
          {kpi.sublabel && <div className="mt-3 text-xs md:text-sm opacity-80">{kpi.sublabel}</div>}
        </div>
      </div>

      {/* right chart area */}
      <div className="col-span-12 md:col-span-7 rounded-b-lg md:rounded-r-lg md:rounded-bl-none bg-slate-50 p-4 md:p-6 h-44 relative">
        <DailyBarCarousel data={kpi.bars} kpi={kpi} />
      </div>
    </div>
  );
}

const DailyBarCarousel = React.memo(function DailyBarCarousel({ data, kpi }: { data: number[]; kpi: KPI }) {
  const [highlightedDayIndex, setHighlightedDayIndex] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoAdvanceMs = 3000; // 3 seconds per highlight

  // Filter and prepare data
  const validData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.filter(d => typeof d === 'number' && !isNaN(d) && isFinite(d));
  }, [data]);

  const normalizedData = useMemo(() => {
    if (validData.length === 0) return [];
    return normalizeBars(validData);
  }, [validData]);

  // Auto-advance through days
  useEffect(() => {
    if (normalizedData.length <= 1) return;
    
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setHighlightedDayIndex(prev => (prev + 1) % normalizedData.length);
    }, autoAdvanceMs);
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [normalizedData.length, autoAdvanceMs]);

  // Format value based on KPI type
  const formatValue = useCallback((value: number, kpiId: string) => {
    switch (kpiId) {
      case 'clicks':
        return value.toLocaleString('pl-PL');
      case 'spend':
        return `${value.toFixed(0)} PLN`;
      case 'conversions':
        return value.toString();
      default:
        return value.toLocaleString('pl-PL');
    }
  }, []);

  // Early return for no data
  if (!validData || validData.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
        Brak danych historycznych
      </div>
    );
  }

  const highlightedValue = validData[highlightedDayIndex] || 0;
  const highlightedNormalizedValue = normalizedData[highlightedDayIndex] || 0;
  const dayNumber = highlightedDayIndex + 1;

  // Generate date for actual data days (index 0 = oldest day, highest index = yesterday)
  const getDateForDay = (dayIndex: number) => {
    // Data is ordered chronologically: index 0 = oldest day, last index = yesterday
    // We fetch 7 days of data, so index 0 = 6 days ago, index 6 = yesterday (1 day ago)
    const totalDays = validData.length;
    if (totalDays === 0) return '';
    
    const today = new Date();
    // Calculate days back: if we have 7 days, index 0 = 6 days ago, index 6 = yesterday (1 day ago)
    const daysBack = totalDays - dayIndex;
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - daysBack);
    
    return targetDate.toLocaleDateString('pl-PL', { 
      day: 'numeric',
      month: 'short'
    }).replace(' ', ' ');
  };

  return (
    <div className="relative w-full h-full flex flex-col p-2">
      {/* Value display for highlighted day */}
      <div className="flex items-start justify-between mb-0">
        <div>
          {/* Removed date from left corner */}
        </div>
        <motion.div
          key={`${highlightedDayIndex}-actual-value`}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="text-right"
        >
          <div className="text-2xl font-bold text-slate-900">
            {formatValue(highlightedValue, kpi.id)}
          </div>
          <div className="text-sm text-slate-500 mt-1">
            {getDateForDay(highlightedDayIndex).replace('sie', 'sierpnia')}
          </div>
        </motion.div>
      </div>
      
      {/* All bars container - moved much higher */}
      <div className="flex items-end justify-center gap-3 px-2 relative z-10 -mt-11" style={{ height: '120px' }}>
        {normalizedData.map((normalizedValue, index) => {
          const isHighlighted = index === highlightedDayIndex;
          const barHeight = Math.max(normalizedValue * 122, 21); // 75% bigger (70 * 1.75 ≈ 122, 12 * 1.75 ≈ 21)
          
          return (
            <div key={index} className="flex flex-col items-center relative z-20">
              {/* Bar with fixed height calculation */}
              <motion.div
                className={`rounded-full transition-all duration-500 cursor-pointer relative z-30 ${
                  isHighlighted 
                    ? 'bg-slate-900' 
                    : 'bg-slate-300'
                }`}
                style={{ 
                  width: isHighlighted ? '14px' : '10px',
                  height: `${barHeight}px`,
                }}
                animate={{
                  scale: isHighlighted ? 1.0 : 0.9,
                  opacity: isHighlighted ? 1 : 0.7
                }}
                transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
                onClick={() => setHighlightedDayIndex(index)}
              />
              
              {/* Date below highlighted bar */}
              <div className="h-4 flex items-center justify-center mt-1 relative z-30">
                {isHighlighted && (
                  <motion.div
                    initial={{ opacity: 0, y: -3 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="text-xs font-medium text-slate-900 whitespace-nowrap"
                  >
                    {getDateForDay(index)}
                  </motion.div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Progress indicator dots - moved lower */}
      <div className="flex justify-center mt-3">
        <div className="flex items-center gap-1.5">
          {normalizedData.map((_, index) => (
            <motion.div
              key={index}
              className={`rounded-full transition-all duration-300 ${
                index === highlightedDayIndex ? 'bg-slate-900' : 'bg-slate-300'
              }`}
              animate={{
                width: index === highlightedDayIndex ? '16px' : '6px',
                height: '6px'
              }}
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}); 