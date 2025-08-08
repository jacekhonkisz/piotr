'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import KPICarousel, { KPI } from './KPICarousel';

interface MetaPerformanceLiveProps {
  clientId: string;
  pollMs?: number;
  currency?: string;
}

interface Stats {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  averageCtr: number; // percent
  averageCpc: number;
}

interface ConversionMetrics {
  click_to_call: number;
  email_contacts: number;
  reservations: number;
  reservation_value: number;
}

export default function MetaPerformanceLive({ clientId, pollMs = 60000, currency = 'PLN' }: MetaPerformanceLiveProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [metrics, setMetrics] = useState<ConversionMetrics | null>(null);
  const [bars, setBars] = useState<number[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const dateRange = useMemo(() => {
    const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const end = new Date().toISOString().split('T')[0];
    return { start, end };
  }, []);

  const formatCurrency = (amount: number) => {
    if (currency === 'PLN') {
      return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  };

  const fetchLive = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch('/api/fetch-live-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          clientId,
          dateRange,
          _t: Date.now(),
          forceRefresh: true
        })
      });

      if (!response.ok) return;
      const json = await response.json();

      const s: Stats = json.data?.stats || null;
      const cm: ConversionMetrics = json.data?.conversionMetrics || null;
      const campaigns: any[] = json.data?.campaigns || [];

      // Build a thin-bar sparkline from campaign spend/clicks mix to show activity variety
      const values = campaigns
        .map((c) => Number(c.clicks || 0) + Number(c.conversions || 0) + Number(c.spend || 0) / 10)
        .filter((v) => Number.isFinite(v));

      // Ensure we always have some bars to render
      const barCount = 48;
      const normalized: number[] = [];
      const max = Math.max(1, ...values);
      for (let i = 0; i < barCount; i++) {
        const v = values[i % Math.max(values.length, 1)] || 0;
        const h = Math.max(0.05, Math.min(1, (v / max)));
        normalized.push(h);
      }

      setStats(s);
      setMetrics(cm);
      setBars(normalized);
      setLastUpdated(new Date().toLocaleTimeString('pl-PL'));
    } catch (err) {
      // silent fail; UI shows last successful values
      console.error('MetaPerformanceLive fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLive();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(fetchLive, pollMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [clientId, pollMs]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Wydajność kampanii Meta Ads</h3>
          <p className="text-sm text-slate-600">Porównanie i podgląd bieżących metryk</p>
        </div>
        <div className="text-xs text-slate-500">{lastUpdated ? `Ostatnia aktualizacja: ${lastUpdated}` : 'Ładowanie...'}</div>
      </div>

      {stats && (
        <KPICarousel
          items={[
            {
              id: 'ctr',
              label: 'Średni CTR',
              value: `${stats.averageCtr.toFixed(1)}%`,
              sublabel: 'Bieżący miesiąc',
              bars,
              dateForMarker: new Date().toISOString()
            },
            {
              id: 'clicks',
              label: 'Kliknięcia',
              value: stats.totalClicks.toLocaleString('pl-PL'),
              sublabel: 'Bieżący miesiąc',
              bars,
              dateForMarker: new Date().toISOString()
            },
            {
              id: 'spend',
              label: 'Wydatki',
              value: formatCurrency(stats.totalSpend),
              sublabel: 'Bieżący miesiąc',
              bars,
              dateForMarker: new Date().toISOString()
            },
            {
              id: 'conversions',
              label: 'Konwersje',
              value: stats.totalConversions.toLocaleString('pl-PL'),
              sublabel: 'Bieżący miesiąc',
              bars,
              dateForMarker: new Date().toISOString()
            }
          ] as KPI[]}
          variant="light"
        />
      )}
    </div>
  );
} 