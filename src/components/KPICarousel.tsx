"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
            className={`h-1.5 w-6 rounded-full transition-colors ${i === index ? "bg-brand-blue" : "bg-brand-blue50"}`}
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
      className={`relative grid grid-cols-12 gap-6 rounded-2xl border shadow-sm p-0 md:p-0 ${
        variant === "dark" ? "bg-secondary-800 border-secondary-700" : "bg-ui-card border-ui-border"
      }`}
      aria-label={`${kpi.label}: ${String(kpi.value)}`}
    >
      {/* left dark panel */}
      <div className="col-span-12 md:col-span-5 bg-brand-blue text-white rounded-t-2xl md:rounded-l-2xl md:rounded-tr-none flex items-center justify-center p-6 md:p-8">
        <div className="text-center md:text-left w-full">
          <div className="text-sm md:text-base opacity-90">{kpi.label}</div>
          <div className="mt-2 text-5xl md:text-6xl font-semibold leading-none">{displayValue}</div>
          {kpi.sublabel && <div className="mt-3 text-xs md:text-sm opacity-80">{kpi.sublabel}</div>}
        </div>
      </div>

      {/* right spark bars area */}
      <div className="col-span-12 md:col-span-7 rounded-b-2xl md:rounded-r-2xl md:rounded-bl-none overflow-hidden bg-yellow-100 p-4 md:p-6">
        <WavySparkline data={bars} />
      </div>
    </div>
  );
}

function WavySparkline({ data }: { data: number[] }) {
  // Use fixed viewBox and scale via preserveAspectRatio to avoid measurement glitches
  const WIDTH = 800;
  const HEIGHT = 220;
  const MARGIN_X = 24;
  const MARGIN_Y = 28;
  const count = Math.min(36, Math.max(16, data.length || 24));

  const points = useMemo(() => {
    const values = normalizeBars(
      data.length ? data.slice(-count) : Array.from({ length: count }, (_, i) => 0.6 + 0.35 * Math.sin(i / 2))
    );
    const stepX = (WIDTH - MARGIN_X * 2) / (values.length - 1);
    const usableH = HEIGHT - MARGIN_Y * 2;
    return values.map((v, i) => {
      const x = MARGIN_X + i * stepX;
      const y = HEIGHT - MARGIN_Y - (v * 0.85 + 0.05) * usableH; // keep within margins
      return { x, y };
    });
  }, [data]);

  const d = useMemo(() => {
    if (points.length === 0) return '';
    let path = `M ${points[0]!.x} ${points[0]!.y}`;
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1]!;
      const p1 = points[i]!;
      const xc = (p0.x + p1.x) / 2;
      const yc = (p0.y + p1.y) / 2;
      path += ` Q ${p0.x} ${p0.y}, ${xc} ${yc}`;
    }
    // final smooth to the last point
    const last = points[points.length - 1]!;
    path += ` T ${last.x} ${last.y}`;
    return path;
  }, [points]);

  const lastPoint = points.length > 0 ? points[points.length - 1]! : { x: WIDTH - MARGIN_X, y: HEIGHT / 2 };

  return (
    <div className="relative h-[160px] md:h-[200px]">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height="100%" preserveAspectRatio="none" className="absolute inset-0">
        <motion.path
          d={d}
          fill="none"
          stroke="#111827" /* slate-900 */
          strokeWidth={3}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: [0.22, 0.61, 0.36, 1] }}
        />

        {/* end dot */}
        <motion.circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r={5}
          fill="#111827"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.0, duration: 0.25 }}
        />
      </svg>
    </div>
  );
} 