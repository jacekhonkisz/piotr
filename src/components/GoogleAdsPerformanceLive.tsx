'use client';

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import KPICarousel, { KPI } from './KPICarousel';
import { RefreshCw, Clock, Database, Target } from 'lucide-react';

interface GoogleAdsPerformanceLiveProps {
  clientId: string;
  currency?: string;
  sharedData?: {
    stats: GoogleAdsStats;
    conversionMetrics: GoogleAdsConversionMetrics;
    debug?: any;
    lastUpdated?: string;
  } | null;
}

interface GoogleAdsStats {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  averageCtr: number;
  averageCpc: number;
}

interface GoogleAdsConversionMetrics {
  form_submissions: number;
  phone_calls: number;
  email_clicks: number;
  phone_clicks: number;
  booking_step_1: number;
  booking_step_2: number;
  booking_step_3: number;
  reservations: number;
  reservation_value: number;
  cost_per_reservation: number;
}

// Global cache for Google Ads data
const globalComponentRequestCache = new Map<string, Promise<any>>();
const globalComponentDataCache = new Map<string, { data: any; timestamp: number }>();
const activeRequests = new Set<string>();
const componentInstances = new Set<number>();
const COMPONENT_CACHE_DURATION = 10000; // 10 seconds cache

export default function GoogleAdsPerformanceLive({ clientId, currency = 'PLN', sharedData }: GoogleAdsPerformanceLiveProps) {
  // Same state structure as Meta component
  const [stats, setStats] = useState<GoogleAdsStats | null>(null);
  const [metrics, setMetrics] = useState<GoogleAdsConversionMetrics | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [dataSource, setDataSource] = useState<string>('');
  const [cacheAge, setCacheAge] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [clicksBars, setClicksBars] = useState<number[]>([]);
  const [spendBars, setSpendBars] = useState<number[]>([]);
  const [conversionsBars, setConversionsBars] = useState<number[]>([]);
  const [ctrBars, setCtrBars] = useState<number[]>([]);
  
  const requestInProgress = useRef(false);
  const [isRequesting, setIsRequesting] = useState(false);

  const dateRange = useMemo(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    const sevenDaysAgo = new Date(yesterday);
    sevenDaysAgo.setDate(yesterday.getDate() - 6);
    
    return {
      start: sevenDaysAgo.toISOString().split('T')[0],
      end: yesterday.toISOString().split('T')[0]
    };
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatCacheAge = (ageMs: number) => {
    const ageMinutes = Math.floor(ageMs / (1000 * 60));
    const ageHours = Math.floor(ageMinutes / 60);
    
    if (ageHours > 0) {
      return `${ageHours}h ${ageMinutes % 60}min`;
    }
    return `${ageMinutes}min`;
  };

  // Mock Google Ads data fetching (placeholder for future API integration)
  const fetchGoogleAdsData = useCallback(async (forceRefresh = false) => {
    if (requestInProgress.current) {
      console.log('⏳ GoogleAdsPerformanceLive: Request already in progress, skipping');
      return;
    }

    const cacheKey = `google_ads_performance_${clientId}`;
    
    // For now, we'll just set empty/placeholder data
    // This will be replaced with actual Google Ads API calls
    requestInProgress.current = true;
    setIsRequesting(true);
    setLoading(true);

    try {
      console.log('🔄 GoogleAdsPerformanceLive: Setting placeholder data for client:', clientId);
      
      // Placeholder data structure - will be replaced with real API data
      const placeholderData = {
        stats: {
          totalSpend: 0,
          totalImpressions: 0,
          totalClicks: 0,
          totalConversions: 0,
          averageCtr: 0,
          averageCpc: 0
        },
        conversionMetrics: {
          form_submissions: 0,
          phone_calls: 0,
          email_clicks: 0,
          phone_clicks: 0,
          booking_step_1: 0,
          booking_step_2: 0,
          booking_step_3: 0,
          reservations: 0,
          reservation_value: 0,
          cost_per_reservation: 0
        },
        lastUpdated: new Date().toISOString()
      };

      setStats(placeholderData.stats);
      setMetrics(placeholderData.conversionMetrics);
      setLastUpdated(new Date().toLocaleTimeString('pl-PL'));
      setDataSource('placeholder');
      setCacheAge(0);
      setLoading(false);

      return placeholderData;
    } catch (error) {
      console.error('❌ GoogleAdsPerformanceLive: Failed to fetch data:', error);
      setLoading(false);
      return null;
    } finally {
      requestInProgress.current = false;
      setIsRequesting(false);
    }
  }, [clientId]);

  // Fetch placeholder daily data points for charts
  const fetchDailyDataPoints = useCallback(async () => {
    try {
      // Empty arrays for now - will be populated with real data
      const emptyData = Array.from({ length: 7 }, () => 0);

      setClicksBars(emptyData);
      setSpendBars(emptyData);
      setConversionsBars(emptyData);
      setCtrBars(emptyData);

      return true;
    } catch (error) {
      console.error('❌ Failed to fetch daily Google Ads data:', error);
      return false;
    }
  }, [dateRange]);

  const handleRefresh = useCallback(() => {
    console.log('🔄 GoogleAdsPerformanceLive: Manual refresh requested');
    fetchGoogleAdsData(true);
  }, [fetchGoogleAdsData]);

  // 🔧 FIX: Process shared data from dashboard (like MetaPerformanceLive does)
  useEffect(() => {
    if (sharedData && sharedData.stats) {
      console.log('📡 CRITICAL DEBUG - GoogleAdsPerformanceLive received sharedData:', {
        hasStats: !!sharedData.stats,
        stats: sharedData.stats,
        hasConversionMetrics: !!sharedData.conversionMetrics,
        conversionMetrics: sharedData.conversionMetrics,
        debugSource: sharedData.debug?.source,
        lastUpdated: sharedData.lastUpdated
      });

      // 🔧 PREVENT DATA LOSS: Don't overwrite good data with empty/zero data
      const hasValidData = sharedData.stats && (
        sharedData.stats.totalClicks > 0 || 
        sharedData.stats.totalSpend > 0 || 
        sharedData.stats.totalImpressions > 0
      );
      
      const currentHasValidData = stats && (
        stats.totalClicks > 0 || 
        stats.totalSpend > 0 || 
        stats.totalImpressions > 0
      );
      
      // 🔧 FIX: Always update if it's Google Ads data, even if values are small
      const isGoogleAdsUpdate = sharedData.debug?.source?.includes('google') || 
                               sharedData.debug?.source === 'database' ||
                               sharedData.debug?.reason?.includes('Google');
      
      console.log('🔍 GoogleAds Data Update Decision:', {
        hasValidData,
        currentHasValidData,
        isGoogleAdsUpdate,
        willUpdate: hasValidData || !currentHasValidData || isGoogleAdsUpdate,
        sharedDataSpend: sharedData.stats?.totalSpend,
        currentSpend: stats?.totalSpend
      });
      
      if (hasValidData || !currentHasValidData || isGoogleAdsUpdate) {
        // Use shared data from dashboard
        setStats(sharedData.stats);
        setMetrics(sharedData.conversionMetrics);
        setLastUpdated(sharedData.lastUpdated || new Date().toLocaleTimeString('pl-PL'));
        setDataSource(sharedData.debug?.source || 'dashboard-shared');
        setCacheAge(sharedData.debug?.cacheAge || null);
        setLoading(false);

        console.log('📊 CRITICAL DEBUG - GoogleAdsPerformanceLive state after setting:', {
          statsSet: sharedData.stats,
          metricsSet: sharedData.conversionMetrics,
          hasValidData,
          currentHasValidData
        });
      } else {
        console.log('🚫 PREVENTED DATA OVERWRITE: Keeping current valid data instead of empty shared data');
      }
      
      return; // Don't fetch placeholder data if we have shared data
    }
  }, [sharedData, stats]);

  // Initialize with placeholder data only if no shared data
  useEffect(() => {
    if (!sharedData && !isRequesting && !requestInProgress.current && clientId) {
      console.log('🔄 GoogleAdsPerformanceLive: Initializing with placeholder data (no shared data)');
      fetchGoogleAdsData(false);
    }
  }, [clientId, isRequesting, fetchGoogleAdsData, sharedData]);

  // Component instance tracking
  useEffect(() => {
    const instanceId = Math.random();
    componentInstances.add(instanceId);
    console.log('🔄 GoogleAdsPerformanceLive: Component mounted, total instances:', componentInstances.size, 'clientId:', clientId);
    
    return () => {
      componentInstances.delete(instanceId);
      console.log('🗑️ GoogleAdsPerformanceLive: Component unmounted, remaining instances:', componentInstances.size);
      requestInProgress.current = false;
      setIsRequesting(false);
    };
  }, [clientId]);

  useEffect(() => {
    if (clicksBars.length === 0 && !loading) {
      fetchDailyDataPoints();
    }
  }, [loading, clicksBars.length, fetchDailyDataPoints]);

  // Same structure as Meta component
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-semibold text-text">Wydajność kampanii Google Ads</h3>
          <p className="text-sm text-muted">Dane z inteligentnego cache (aktualizacja co 3h)</p>
        </div>
        <div className="flex items-center space-x-3">
          {/* Data Source Indicator */}
          <div className="flex items-center space-x-2 text-xs">
            {dataSource === 'cache' && (
              <div className="flex items-center space-x-1 text-orange">
                <Database className="w-3 h-3" />
                <span>Cache</span>
              </div>
            )}
            {dataSource === 'placeholder' && (
              <div className="flex items-center space-x-1 text-warning-500">
                <Target className="w-3 h-3" />
                <span>Brak danych</span>
              </div>
            )}
            {cacheAge && (
              <div className="flex items-center space-x-1 text-muted">
                <Clock className="w-3 h-3" />
                <span>{formatCacheAge(cacheAge)}</span>
              </div>
            )}
          </div>
          
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 text-muted hover:text-text hover:bg-page rounded-lg transition-colors disabled:opacity-50"
            title="Odśwież dane"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          {/* Last Updated */}
          <div className="text-xs text-muted">
            {lastUpdated ? `Ostatnia aktualizacja: ${lastUpdated}` : 'Ładowanie...'}
          </div>
        </div>
      </div>

      {stats && (() => {
        // 🔍 CRITICAL DEBUG: Log what we're about to render
        console.log('🎨 CRITICAL DEBUG - GoogleAdsPerformanceLive render:', {
          hasStats: !!stats,
          stats: stats,
          willRenderKPI: !!stats,
          clicksValue: stats ? stats.totalClicks.toLocaleString('pl-PL') : 'no stats',
          spendValue: stats ? formatCurrency(stats.totalSpend) : 'no stats',
          conversionsValue: stats ? stats.totalConversions.toLocaleString('pl-PL') : 'no stats'
        });

        return (
          <KPICarousel
            items={[
              {
                id: 'clicks',
                label: 'Kliknięcia',
                value: stats.totalClicks.toLocaleString('pl-PL'),
                sublabel: 'Bieżący miesiąc',
                bars: clicksBars,
                dateForMarker: new Date().toISOString()
              },
            {
              id: 'spend',
              label: 'Wydatki',
              value: formatCurrency(stats.totalSpend),
              sublabel: 'Bieżący miesiąc',
              bars: spendBars,
              dateForMarker: new Date().toISOString()
            },
            {
              id: 'conversions',
              label: 'Konwersje',
              value: stats.totalConversions.toLocaleString('pl-PL'),
              sublabel: 'Bieżący miesiąc',
              bars: conversionsBars,
              dateForMarker: new Date().toISOString()
            }
          ] as KPI[]}
          variant="light"
        />
        );
      })()}
    </div>
  );
} 