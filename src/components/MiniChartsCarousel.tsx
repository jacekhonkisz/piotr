"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedGaugeChart from "./AnimatedGaugeChart";
import AnimatedLineChart from "./AnimatedLineChart";

interface MiniChartsCarouselProps {
  bars: number[];
  ctrPercent: number; // e.g., 1.2 for 1.2%
  spend: number;
}

const slides = ["activity", "gauge", "trend"] as const;
export type SlideKey = typeof slides[number];

export default function MiniChartsCarousel({ bars, ctrPercent, spend }: MiniChartsCarouselProps) {
  const [active, setActive] = useState<SlideKey>("activity");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Create a pseudo time series from bars
  const lineData = useMemo(() => {
    const today = new Date();
    const arr = bars.slice(0, 24).map((h, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (24 - i));
      const value = Math.round((h / 100) * 1000);
      return { date: d.toISOString(), value };
    });
    return arr;
  }, [bars]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActive((prev): SlideKey => {
        const idx = slides.indexOf(prev);
        return slides[(idx + 1) % slides.length] as SlideKey;
      });
    }, 6000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const go = (dir: -1 | 1) => {
    setActive((prev): SlideKey => {
      const idx = slides.indexOf(prev);
      return slides[(idx + dir + slides.length) % slides.length] as SlideKey;
    });
  };

  return (
    <div className="relative bg-white/60 rounded-xl border border-slate-200/60 p-4 overflow-hidden">
      <div className="absolute top-2 right-2 flex gap-1">
        {slides.map((s) => (
          <button
            key={s}
            aria-label={`slide-${s}`}
            onClick={() => setActive(s)}
            className={`h-1.5 w-6 rounded-full transition-colors ${active === s ? "bg-slate-800" : "bg-slate-300"}`}
          />
        ))}
      </div>

      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-slate-700">
          {active === "activity" && "Aktywność"}
          {active === "gauge" && "CTR (cel)"}
          {active === "trend" && "Trend aktywności"}
        </div>
        <div className="flex gap-2">
          <button onClick={() => go(-1)} className="text-slate-500 hover:text-slate-700 text-sm">‹</button>
          <button onClick={() => go(1)} className="text-slate-500 hover:text-slate-700 text-sm">›</button>
        </div>
      </div>

      <div className="h-[180px]">
        <AnimatePresence mode="wait">
          {active === "activity" && (
            <motion.div
              key="activity"
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="h-full"
            >
              <div className="flex items-end h-full gap-[6px] pt-2">
                {bars.map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0, opacity: 0.2 }}
                    animate={{ height: `${h}%`, opacity: 1 }}
                    transition={{ delay: i * 0.01, duration: 0.25 }}
                    className="w-[3px] rounded-sm bg-slate-800/80"
                  />
                ))}
              </div>
            </motion.div>
          )}

          {active === "gauge" && (
            <motion.div
              key="gauge"
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="flex items-center justify-center h-full"
            >
              <AnimatedGaugeChart
                value={ctrPercent}
                maxValue={4}
                title="Średni CTR"
                subtitle={`Budżet: ${spend.toLocaleString('pl-PL')} zł`}
                color="#0f172a"
                size="md"
                showPercentage={true}
              />
            </motion.div>
          )}

          {active === "trend" && (
            <motion.div
              key="trend"
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="h-full"
            >
              <AnimatedLineChart
                data={lineData}
                title="Aktywność"
                color="#0f172a"
                height={160}
                showTarget={false}
                formatValue={(v) => Math.round(v).toLocaleString('pl-PL')}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
} 