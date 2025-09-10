'use client';

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import KPICarousel, { KPI } from './KPICarousel';
import { RefreshCw, Clock, Database, Target } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DailyMetricsCache } from '../lib/daily-metrics-cache';
import { DataSourceIndicator } from './DataSourceIndicator';

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
  
  // Daily metrics cache state
  const [dailyMetricsSource, setDailyMetricsSource] = useState<{
    source: string;
    completeness?: number;
    cacheAge?: number;
    fromCache: boolean;
  } | null>(null);
  
  const requestInProgress = useRef(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [waitingForSharedData, setWaitingForSharedData] = useState(false);

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

  // 🔧 STANDARDIZED: Fetch daily data using smart cache (same pattern as Meta component)
  const fetchDailyDataPoints = useCallback(async () => {
    try {
      console.log('📊 GoogleAdsPerformanceLive: Fetching daily data using smart cache for clientId:', clientId);
      
      // Calculate date range for last 7 days (same as Meta component)
      const today = new Date();
      const last7Days = [];
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i - 1); // -1 to exclude today
        const dateStr = date.toISOString().split('T')[0];
        last7Days.push(dateStr);
      }
      
      const startDate = last7Days[0];
      const endDate = last7Days[last7Days.length - 1];
      
      if (!startDate || !endDate) {
        console.error('❌ Invalid date range for Google Ads daily metrics cache');
        const emptyData = Array.from({ length: 7 }, () => 0);
        setClicksBars(emptyData);
        setSpendBars(emptyData);
        setConversionsBars(emptyData);
        setCtrBars(emptyData);
        return false;
      }
      
      const dateRange = { start: startDate, end: endDate };
      console.log('📅 Google Ads date range:', dateRange);
      
      // Use daily metrics cache (same pattern as Meta component)
      const result = await DailyMetricsCache.getDailyMetrics(
        clientId, 
        dateRange, 
        'google'
      );
      
      // Update daily metrics source info
      setDailyMetricsSource({
        source: result.source,
        completeness: result.completeness,
        cacheAge: result.cacheAge,
        fromCache: result.fromCache
      });
      
      if (result.success && result.data.length > 0) {
        console.log(`✅ GoogleAdsPerformanceLive: Got ${result.data.length} daily data points from ${result.source} (${Math.round((result.completeness || 0) * 100)}% complete)`);
        
        // Map daily data to arrays (same logic as before)
        const clicksData = last7Days.map(date => {
          const dayData = result.data.find(d => d.date === date);
          return dayData ? dayData.total_clicks : 0;
        });
        
        const spendData = last7Days.map(date => {
          const dayData = result.data.find(d => d.date === date);
          return dayData ? dayData.total_spend : 0;
        });
        
        const conversionsData = last7Days.map(date => {
          const dayData = result.data.find(d => d.date === date);
          return dayData ? dayData.total_conversions : 0;
        });
        
        const ctrData = last7Days.map(date => {
          const dayData = result.data.find(d => d.date === date);
          if (!dayData || dayData.total_impressions === 0) return 0;
          return (dayData.total_clicks / dayData.total_impressions) * 100;
        });

        setClicksBars(clicksData);
        setSpendBars(spendData);
        setConversionsBars(conversionsData);
        setCtrBars(ctrData);

        console.log('📊 GoogleAdsPerformanceLive: Set smart cache daily data bars:', {
          source: result.source,
          clicks: clicksData,
          spend: spendData,
          conversions: conversionsData,
          ctr: ctrData,
          completeness: Math.round((result.completeness || 0) * 100) + '%'
        });

        return true;
      } else {
        console.log('ℹ️ No Google Ads daily data available from smart cache - using empty arrays');
        const emptyData = Array.from({ length: 7 }, () => 0);
        setClicksBars(emptyData);
        setSpendBars(emptyData);
        setConversionsBars(emptyData);
        setCtrBars(emptyData);
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to fetch Google Ads daily data from smart cache:', error);
      const emptyData = Array.from({ length: 7 }, () => 0);
      setClicksBars(emptyData);
      setSpendBars(emptyData);
      setConversionsBars(emptyData);
      setCtrBars(emptyData);
      return false;
    }
  }, [clientId]);

  const handleRefresh = useCallback(() => {
    console.log('🔄 GoogleAdsPerformanceLive: Manual refresh requested');
    fetchGoogleAdsData(true);
  }, [fetchGoogleAdsData]);

  // 🔧 FIX: Process shared data from dashboard (like MetaPerformanceLive does)
  useEffect(() => {
    console.log('📡 CRITICAL DEBUG - GoogleAdsPerformanceLive useEffect triggered:', {
      hasSharedData: !!sharedData,
      hasStats: !!sharedData?.stats,
      sharedDataStats: sharedData?.stats,
      debugSource: sharedData?.debug?.source
    });

    if (sharedData) {
      setWaitingForSharedData(false);
      
      if (sharedData.stats) {
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
          setLoading(false); // Still stop loading even if we don't update data
        }
      } else {
        // SharedData exists but no stats - still stop loading to avoid "Brak danych"
        console.log('📡 SharedData exists but no stats - stopping loading state');
        setLoading(false);
      }
      
      return; // Don't fetch placeholder data if we have shared data
    } else {
      // No shared data yet - we might be waiting for it
      console.log('📡 No sharedData yet - checking if we should wait');
      setWaitingForSharedData(true);
    }
  }, [sharedData, stats]);

  // Initialize with placeholder data only if no shared data and not waiting
  useEffect(() => {
    if (!sharedData && !waitingForSharedData && !isRequesting && !requestInProgress.current && clientId) {
      console.log('🔄 GoogleAdsPerformanceLive: Initializing with placeholder data (no shared data)');
      fetchGoogleAdsData(false);
    }
  }, [clientId, isRequesting, fetchGoogleAdsData, sharedData, waitingForSharedData]);

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
            {dataSource === 'placeholder' && !waitingForSharedData && (
              <div className="flex items-center space-x-1 text-warning-500">
                <Target className="w-3 h-3" />
                <span>Brak danych</span>
              </div>
            )}
            {waitingForSharedData && (
              <div className="flex items-center space-x-1 text-muted">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Ładowanie...</span>
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
          
          {/* Last Updated - Only visible in development mode */}
          {process.env.NODE_ENV === 'development' && (
            <div className="text-xs text-muted">
              {lastUpdated ? `Ostatnia aktualizacja: ${lastUpdated}` : 'Ładowanie...'}
            </div>
          )}
        </div>
      </div>

      {loading || waitingForSharedData ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-3">
            <RefreshCw className="w-5 h-5 animate-spin text-orange" />
            <span className="text-muted">
              {waitingForSharedData ? 'Ładowanie danych Google Ads...' : 'Ładowanie...'}
            </span>
          </div>
        </div>
      ) : stats ? (() => {
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
          <div>
            {/* Enhanced Daily Metrics Data Source Indicator (Week 3) */}
            {dailyMetricsSource && (
              <div className="mb-4">
                <div className="text-sm text-gray-600 mb-2">Daily Metrics:</div>
                <DataSourceIndicator 
                  debug={{
                    source: dailyMetricsSource.source,
                    responseTime: dailyMetricsSource.cacheAge
                  }}
                  showCacheAge={true}
                  cacheAge={dailyMetricsSource.cacheAge}
                  completeness={dailyMetricsSource.completeness}
                  onRefresh={() => {
                    console.log('🔄 Manual refresh requested for Google Ads daily metrics');
                    fetchDailyDataPoints();
                  }}
                  isRefreshing={loading}
                />
              </div>
            )}
            
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
                value: (() => {
                  const allBookingSteps = 
                    (metrics?.form_submissions || 0) + 
                    (metrics?.phone_calls || 0) + 
                    (metrics?.email_clicks || 0) + 
                    (metrics?.phone_clicks || 0) + 
                    (metrics?.booking_step_1 || 0) + 
                    (metrics?.booking_step_2 || 0) + 
                    (metrics?.booking_step_3 || 0) + 
                    (metrics?.reservations || 0);
                  
                  console.log('🎯 GoogleAdsPerformanceLive: All booking steps calculation:', {
                    form_submissions: metrics?.form_submissions || 0,
                    phone_calls: metrics?.phone_calls || 0,
                    email_clicks: metrics?.email_clicks || 0,
                    phone_clicks: metrics?.phone_clicks || 0,
                    booking_step_1: metrics?.booking_step_1 || 0,
                    booking_step_2: metrics?.booking_step_2 || 0,
                    booking_step_3: metrics?.booking_step_3 || 0,
                    reservations: metrics?.reservations || 0,
                    total: allBookingSteps,
                    statsTotalConversions: stats?.totalConversions || 0
                  });
                  
                  return allBookingSteps.toLocaleString('pl-PL');
                })(),
                sublabel: 'Bieżący miesiąc',
                bars: conversionsBars,
                dateForMarker: new Date().toISOString()
              }
            ] as KPI[]}
              variant="light"
            />
          </div>
        );
      })() : (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Target className="h-16 w-16 text-stroke mx-auto mb-4" />
            <h3 className="text-lg font-medium text-text mb-2">Brak danych Google Ads</h3>
            <p className="text-muted">
              Dane Google Ads pojawią się tutaj po skonfigurowaniu konta.
            </p>
          </div>
        </div>
      )}
    </div>
  );
} 