'use client';

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import KPICarousel, { KPI } from './KPICarousel';
import { RefreshCw, Clock, Database } from 'lucide-react';

interface MetaPerformanceLiveProps {
  clientId: string;
  currency?: string;
  sharedData?: {
    stats: Stats;
    conversionMetrics: ConversionMetrics;
    debug?: any;
    lastUpdated?: string;
  } | null;
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

// Smart cache response format - data comes directly from the API

// Global request cache at module level to prevent duplicate requests across component instances
const globalComponentRequestCache = new Map<string, Promise<any>>();
const globalComponentDataCache = new Map<string, { data: any; timestamp: number }>();
const activeRequests = new Set<string>(); // Track active requests to prevent race conditions
const componentInstances = new Set<number>(); // Track component instances for debugging
const COMPONENT_CACHE_DURATION = 10000; // 10 seconds cache for component level

export default function MetaPerformanceLive({ clientId, currency = 'PLN', sharedData }: MetaPerformanceLiveProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [metrics, setMetrics] = useState<ConversionMetrics | null>(null);
  const [bars, setBars] = useState<number[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [dataSource, setDataSource] = useState<string>('smart-cache');
  const [cacheAge, setCacheAge] = useState<number | null>(null);
  
  // Add request deduplication
  const requestInProgress = useRef(false);
  const [isRequesting, setIsRequesting] = useState(false);

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

  const formatCacheAge = (ageMs: number) => {
    if (ageMs < 60000) return `${Math.round(ageMs / 1000)}s`;
    if (ageMs < 3600000) return `${Math.round(ageMs / 60000)}m`;
    return `${Math.round(ageMs / 3600000)}h`;
  };

  const fetchSmartCacheData = useCallback(async (forceRefresh: boolean = false) => {
    const cacheKey = `${clientId}_smart_cache`;
    
    // Check if request is already active (prevent race conditions)
    if (activeRequests.has(cacheKey)) {
      console.log('🚫 MetaPerformanceLive: Request already active, skipping duplicate call');
      return;
    }
    
    // Check global component cache first
    if (!forceRefresh) {
      const cachedData = globalComponentDataCache.get(cacheKey);
      if (cachedData && (Date.now() - cachedData.timestamp) < COMPONENT_CACHE_DURATION) {
        console.log('🔄 MetaPerformanceLive: Using global component cache, skipping API call');
        // Set data from cache
        const { stats, metrics, lastUpdated, dataSource, cacheAge } = cachedData.data;
        setStats(stats);
        setMetrics(metrics);
        setLastUpdated(lastUpdated);
        setDataSource(dataSource);
        setCacheAge(cacheAge);
        setLoading(false);
        return;
      }
    }
    
    // Check if same request is already in progress globally
    if (!forceRefresh && globalComponentRequestCache.has(cacheKey)) {
      console.log('🔄 MetaPerformanceLive: Joining existing global request');
      try {
        const result = await globalComponentRequestCache.get(cacheKey);
        const { stats, metrics, lastUpdated, dataSource, cacheAge } = result;
        setStats(stats);
        setMetrics(metrics);
        setLastUpdated(lastUpdated);
        setDataSource(dataSource);
        setCacheAge(cacheAge);
        setLoading(false);
        return;
      } catch (error) {
        console.error('❌ MetaPerformanceLive: Error joining existing request:', error);
      }
    }
    
    // Prevent duplicate requests at instance level
    if (requestInProgress.current && !forceRefresh) {
      console.log('🚫 MetaPerformanceLive: Request already in progress for this instance, skipping');
      return;
    }
    
    console.log('🚀 MetaPerformanceLive: Starting NEW data fetch...');
    
    // Mark request as active
    activeRequests.add(cacheKey);
    requestInProgress.current = true;
    setIsRequesting(true);
    
    try {
      setLoading(true);
      
      // Add to global request cache to prevent duplicates
      globalComponentRequestCache.set(cacheKey, (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          console.log('❌ MetaPerformanceLive: No session found');
          throw new Error('No session found');
        }
        console.log('✅ MetaPerformanceLive: Session found, proceeding with API call');

        console.log(`🔄 MetaPerformanceLive: Fetching data from fetch-live-data (consistent with dashboard cards)`);

        // Use same endpoint as dashboard cards for data consistency
        const currentMonth = {
          start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
          end: new Date().toISOString().split('T')[0]
        };

        const response = await fetch('/api/fetch-live-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            clientId,
            dateRange: currentMonth,
            forceRefresh
          })
        });

        if (!response.ok) {
          if (response.status === 401) {
            console.warn('MetaPerformanceLive: Authentication failed (401), attempting retry with fresh session...');
            // Try to get fresh session and retry once
            const { data: { session: freshSession } } = await supabase.auth.getSession();
            if (freshSession?.access_token) {
              console.log('🔄 MetaPerformanceLive: Retrying with fresh session token');
              const retryResponse = await fetch('/api/fetch-live-data', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${freshSession.access_token}`
                },
                body: JSON.stringify({
                  clientId,
                  dateRange: currentMonth,
                  forceRefresh
                })
              });
              
              if (retryResponse.ok) {
                console.log('✅ MetaPerformanceLive: Retry succeeded');
                return await retryResponse.json();
              } else {
                console.error('❌ MetaPerformanceLive: Retry also failed:', retryResponse.status);
                throw new Error(`API retry failed: ${retryResponse.status}`);
              }
            } else {
              console.error('❌ MetaPerformanceLive: No fresh session available for retry');
              throw new Error('Authentication failed - no fresh session');
            }
          } else {
            console.warn('MetaPerformanceLive: Fetch-live-data API response not ok:', response.status);
            throw new Error(`API response not ok: ${response.status}`);
          }
        }

        const json = await response.json();
        
        if (!json.success || !json.data) {
          console.warn('MetaPerformanceLive: No data received from fetch-live-data:', json);
          throw new Error('No data received from fetch-live-data');
        }
        
        return json;
      })());
      
      // Get the result from the cached promise
      const json = await globalComponentRequestCache.get(cacheKey);
      
      console.log('🔍 MetaPerformanceLive: Fetch-live-data response received:', {
        success: json.success,
        hasData: !!json.data,
        dataKeys: json.data ? Object.keys(json.data) : [],
        debug: json.debug,
        source: json.source
      });

      // Fetch-live-data returns data in nested structure - use it directly!
      console.log('🔍 MetaPerformanceLive: Checking data structure...');
      console.log('🔍 MetaPerformanceLive: json.data exists:', !!json.data);
      console.log('🔍 MetaPerformanceLive: json.data.stats exists:', !!json.data.stats);
      console.log('🔍 MetaPerformanceLive: json.data.stats type:', typeof json.data.stats);
      console.log('🔍 MetaPerformanceLive: json.data.stats keys:', json.data.stats ? Object.keys(json.data.stats) : 'N/A');
      
      const s: Stats = json.data.stats || {
        totalSpend: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalConversions: 0,
        averageCtr: 0,
        averageCpc: 0
      };
      
      // Log what we're actually getting
      console.log('🔍 MetaPerformanceLive: Raw stats from API:', json.data.stats);
      console.log('🔍 MetaPerformanceLive: Extracted stats object:', s);
      
      const cm: ConversionMetrics = json.data.conversionMetrics || {
        click_to_call: 0,
        email_contacts: 0,
        reservations: 0,
        reservation_value: 0
      };
      
      // Log what we're actually getting
      console.log('🔍 MetaPerformanceLive: Raw conversion metrics from API:', json.data.conversionMetrics);
      console.log('🔍 MetaPerformanceLive: Extracted conversion metrics:', cm);
      
      // For campaigns, we need to check if they exist in the response
      const campaigns: any[] = json.data.campaigns || [];
      
      console.log('🔍 MetaPerformanceLive: Data extracted:', {
        stats: s,
        conversionMetrics: cm,
        campaignsCount: campaigns.length,
        hasStats: !!s,
        hasConversionMetrics: !!cm,
        rawStats: json.data.stats,
        averageCtr: s.averageCtr,
        totalSpend: s.totalSpend,
        totalClicks: s.totalClicks
      });

      // Build a thin-bar sparkline from campaign spend/clicks mix to show activity variety
      let values: number[] = [];
      
      if (campaigns && campaigns.length > 0) {
        values = campaigns
          .map((c) => Number(c.clicks || 0) + Number(c.conversions || 0) + Number(c.spend || 0) / 10)
          .filter((v) => Number.isFinite(v));
      }
      
      // Ensure we always have some bars to render (fallback to static data if no campaigns)
      const barCount = 48;
      const normalized: number[] = [];
      
      if (values.length > 0) {
        const max = Math.max(1, ...values);
        for (let i = 0; i < barCount; i++) {
          const v = values[i % values.length] || 0;
          const h = Math.max(0.05, Math.min(1, (v / max)));
          normalized.push(h);
        }
      } else {
        // Fallback: create static bars when no campaign data is available
        for (let i = 0; i < barCount; i++) {
          const h = Math.max(0.05, Math.min(1, (0.3 + Math.sin(i * 0.2) * 0.2)));
          normalized.push(h);
        }
      }

      console.log('🔄 MetaPerformanceLive: Setting component state with real data:', {
        averageCtr: s.averageCtr,
        totalSpend: s.totalSpend,
        totalClicks: s.totalClicks
      });
      
      setStats(s);
      setMetrics(cm);
      setBars(normalized);
      setLastUpdated(new Date().toLocaleTimeString('pl-PL'));
      
      // Set data source information from smart cache response
      setDataSource(json.debug?.source || json.source || 'smart-cache');
      setCacheAge(json.debug?.cacheAge || null);

      console.log(`✅ MetaPerformanceLive: Data loaded from ${json.debug?.source || json.source} (cache age: ${json.debug?.cacheAge ? formatCacheAge(json.debug.cacheAge) : 'N/A'})`);

      // Cache the successful result globally for other component instances
      const resultData = { stats: s, metrics: cm, lastUpdated: new Date().toLocaleTimeString('pl-PL'), dataSource: json.debug?.source || json.source || 'smart-cache', cacheAge: json.debug?.cacheAge || null };
      globalComponentDataCache.set(cacheKey, {
        data: resultData,
        timestamp: Date.now()
      });
      
      return resultData;

    } catch (err) {
      console.error('❌ MetaPerformanceLive smart cache fetch error:', err);
      console.error('❌ Error details:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : 'No stack trace',
        error: err
      });
    } finally {
      setLoading(false);
      requestInProgress.current = false;
      setIsRequesting(false);
      // Clean up active request tracking
      activeRequests.delete(cacheKey);
      globalComponentRequestCache.delete(cacheKey);
    }
  }, [clientId]); // Add dependency array for useCallback

  const handleRefresh = () => {
    console.log('🔄 MetaPerformanceLive: Manual refresh requested');
    fetchSmartCacheData(true); // Force refresh
  };

  // Use shared data if available, otherwise fetch independently
  useEffect(() => {
    if (sharedData) {
      console.log('🔄 MetaPerformanceLive: Using shared data from dashboard', {
        source: sharedData.debug?.source || 'dashboard',
        cacheAge: sharedData.debug?.cacheAge || 0
      });
      
      // Use shared data from dashboard
      setStats(sharedData.stats);
      setMetrics(sharedData.conversionMetrics);
      setLastUpdated(sharedData.lastUpdated || new Date().toLocaleTimeString('pl-PL'));
      setDataSource(sharedData.debug?.source || 'dashboard-shared');
      setCacheAge(sharedData.debug?.cacheAge || null);
      setLoading(false);
      
      // Generate bars for visualization
      const normalizeValue = (value: number, max: number) => Math.max(0.1, Math.min(1, value / max));
      const maxSpend = Math.max(sharedData.stats.totalSpend, 1000);
      const normalized = Array.from({length: 12}, () => 
        normalizeValue(Math.random() * sharedData.stats.totalSpend, maxSpend)
      );
      setBars(normalized);
      
    } else if (!isRequesting && !requestInProgress.current && clientId) {
      console.log('🔄 MetaPerformanceLive: No shared data, fetching independently');
      fetchSmartCacheData(false); // Use cached data first
    }
  }, [clientId, sharedData, isRequesting, fetchSmartCacheData]);

  // Component instance tracking and cleanup on unmount
  useEffect(() => {
    const instanceId = Math.random();
    componentInstances.add(instanceId);
    console.log('🔄 MetaPerformanceLive: Component mounted, total instances:', componentInstances.size, 'clientId:', clientId);
    
    return () => {
      componentInstances.delete(instanceId);
      console.log('🗑️ MetaPerformanceLive: Component unmounted, remaining instances:', componentInstances.size);
      // Reset request tracking on unmount
      requestInProgress.current = false;
      setIsRequesting(false);
    };
  }, [clientId]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Wydajność kampanii Meta Ads</h3>
          <p className="text-sm text-slate-600">Dane z inteligentnego cache (aktualizacja co 3h)</p>
        </div>
        <div className="flex items-center space-x-3">
          {/* Data Source Indicator */}
          <div className="flex items-center space-x-2 text-xs">
            {dataSource === 'cache' && (
              <div className="flex items-center space-x-1 text-green-600">
                <Database className="w-3 h-3" />
                <span>Cache</span>
              </div>
            )}
            {dataSource === 'stale-cache' && (
              <div className="flex items-center space-x-1 text-yellow-600">
                <Clock className="w-3 h-3" />
                <span>Stale Cache</span>
              </div>
            )}
            {dataSource === 'force-refresh' && (
              <div className="flex items-center space-x-1 text-blue-600">
                <RefreshCw className="w-3 h-3" />
                <span>Fresh</span>
              </div>
            )}
            {cacheAge && (
              <div className="flex items-center space-x-1 text-gray-500">
                <Clock className="w-3 h-3" />
                <span>{formatCacheAge(cacheAge)} old</span>
              </div>
            )}
          </div>
          
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
            title="Odśwież dane"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          {/* Last Updated */}
          <div className="text-xs text-gray-500">
            {lastUpdated ? `Ostatnia aktualizacja: ${lastUpdated}` : 'Ładowanie...'}
          </div>
        </div>
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

      {/* Cache Information */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <div className="text-xs text-gray-600">
          <div className="flex items-center justify-between">
            <span>💡 Inteligentny cache: Dane są aktualizowane co 3 godziny automatycznie</span>
            <span className="text-green-600 font-medium">✓ Brak niepotrzebnych API wywołań</span>
          </div>
          <div className="mt-1 text-gray-500">
            Źródło: {dataSource === 'cache' ? 'Cache (szybkie)' : dataSource === 'force-refresh' ? 'Meta API (świeże)' : 'Baza danych'}
            {cacheAge && ` • Wiek: ${formatCacheAge(cacheAge)}`}
          </div>
        </div>
      </div>
    </div>
  );
} 