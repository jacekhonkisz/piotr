'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
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
  booking_step_1: number;
  booking_step_2: number;
  booking_step_3: number;
  reservations: number;
  reservation_value: number;
  roas: number;
  cost_per_reservation: number;
}

// Smart cache response format - data comes directly from the API

// Global request cache at module level to prevent duplicate requests across component instances
const globalComponentRequestCache = new Map<string, Promise<any>>();
const globalComponentDataCache = new Map<string, { data: any; timestamp: number }>();
const activeRequests = new Set<string>(); // Track active requests to prevent race conditions
const componentInstances = new Set<number>(); // Track component instances for debugging
const COMPONENT_CACHE_DURATION = 10000; // 10 seconds cache for component level


    // Safe conversion helper function
    const safeConversion = (value: any): number => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') return parseFloat(value) || 0;
      if (Array.isArray(value)) return value.reduce((sum, item) => sum + safeConversion(item), 0);
      if (typeof value === 'object' && value !== null) {
        // Try to extract numeric values from object
        const keys = ['total', 'count', 'value', 'amount'];
        for (const key of keys) {
          if (value[key] !== undefined) {
            return safeConversion(value[key]);
          }
        }
        return 0;
      }
      return 0;
    };
    
export default function MetaPerformanceLive({ clientId, currency = 'PLN', sharedData }: MetaPerformanceLiveProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [metrics, setMetrics] = useState<ConversionMetrics | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [dataSource, setDataSource] = useState<string>('');
  const [cacheAge, setCacheAge] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  // Add request deduplication
  const requestInProgress = useRef(false);
  const [isRequesting, setIsRequesting] = useState(false);
  
  // Month-over-month comparison state
  const [previousMonthStats, setPreviousMonthStats] = useState<{
    totalSpend: number;
    totalClicks: number;
    totalConversions: number;
  } | null>(null);

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
    
    // PRIORITY 1: Use shared data from dashboard if available (prevents duplicate API calls)
    if (!forceRefresh && sharedData && sharedData.stats && sharedData.conversionMetrics) {
      console.log('🎯 MetaPerformanceLive: Using shared data from dashboard (NO API CALL NEEDED)');
      
      setStats(sharedData.stats);
      setMetrics(sharedData.conversionMetrics);
      setLastUpdated(sharedData.lastUpdated || new Date().toISOString());
      setDataSource(sharedData.debug?.source || 'shared-data');
      setCacheAge(sharedData.debug?.cacheAge || null);
      
      // Generate daily data points for the last 7 days + current month
      // REMOVED: No more fallback data generation - only real database data
      
      setLoading(false);
      return;
    }
    
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
        
        // Try to fetch ONLY real daily data
        fetchDailyDataPoints().then((hasRealData) => {
          if (!hasRealData) {
            console.log('ℹ️ No real daily data available from global cache - showing empty chart');
            // Old setBars removed
          }
        });
        
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
        
        // Try to fetch ONLY real daily data
        fetchDailyDataPoints().then((hasRealData) => {
          if (!hasRealData) {
            console.log('ℹ️ No real daily data available from global request - showing empty chart');
            // Old setBars removed
          }
        });
        
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
        // 🔧 REMOVED: Authentication check - not required for this project
        console.log('✅ MetaPerformanceLive: Using StandardizedDataFetcher directly (no auth required)');

        console.log(`🔄 MetaPerformanceLive: Using StandardizedDataFetcher for consistent data`);

        // Use StandardizedDataFetcher directly (same as dashboard)
        const { StandardizedDataFetcher } = await import('../lib/standardized-data-fetcher');
        
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const currentMonth = {
          start: `${year}-${String(month).padStart(2, '0')}-01`,
          end: new Date(year, month, 0).toISOString().split('T')[0] || `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate().toString().padStart(2, '0')}` // Last day of current month with fallback
        };

        const result = await StandardizedDataFetcher.fetchData({
          clientId,
          dateRange: currentMonth,
          platform: 'meta',
          reason: 'meta_performance_live_component'
        });

        if (!result.success || !result.data) {
          console.warn('MetaPerformanceLive: No data received from StandardizedDataFetcher:', result);
          throw new Error('No data received from StandardizedDataFetcher');
        }
        
        console.log('✅ MetaPerformanceLive: StandardizedDataFetcher returned data:', {
          source: result.debug?.source,
          campaignCount: result.data.campaigns?.length || 0
        });
        
        return result;
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

      // 🚨 DIAGNOSTIC: Detect and warn about zero data
      if (s.totalSpend === 0 && s.totalImpressions === 0 && s.totalClicks === 0) {
        console.error('🚨 ZERO DATA DETECTED IN FRONTEND!');
        console.error('🚨 All metrics are 0 - check backend logs for Meta API issues');
        console.error('🚨 Debug info:', {
          source: json.debug?.source || json.source,
          cacheAge: json.debug?.cacheAge,
          hasData: !!json.data,
          hasStats: !!json.data.stats,
          statsKeys: json.data.stats ? Object.keys(json.data.stats) : 'N/A'
        });
      }
      
      const cm: ConversionMetrics = json.data.conversionMetrics || {
        click_to_call: 0,
        email_contacts: 0,
        booking_step_1: 0,
        booking_step_2: 0,
        booking_step_3: 0,
        reservations: 0,
        reservation_value: 0,
        roas: 0,
        cost_per_reservation: 0
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

      console.log('🔄 MetaPerformanceLive: Setting component state with real data:', {
        averageCtr: s.averageCtr,
        totalSpend: s.totalSpend,
        totalClicks: s.totalClicks
      });
      
      setStats(s);
      setMetrics(cm);
      setLastUpdated(new Date().toLocaleTimeString('pl-PL'));
      
      // Set data source information from smart cache response
      setDataSource(json.debug?.source || json.source || 'smart-cache');
      setCacheAge(json.debug?.cacheAge || null);

      // Fetch previous month data for comparison
      fetchPreviousMonthComparison();

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
    return null; // Default return for async function
  }, [clientId]); // Add dependency array for useCallback

  // Fetch previous month data for comparison
  const fetchPreviousMonthComparison = async () => {
    try {
      const now = new Date();
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const previousMonthStr = previousMonth.toISOString().split('T')[0];
      
      console.log('📊 Fetching previous month data for comparison:', previousMonthStr);
      
      const { data, error } = await supabase
        .from('campaign_summaries')
        .select('total_spend, total_clicks, total_conversions')
        .eq('client_id', clientId)
        .eq('summary_type', 'monthly')
        .eq('platform', 'meta')
        .eq('summary_date', previousMonthStr)
        .single();
      
      if (!error && data) {
        setPreviousMonthStats({
          totalSpend: data.total_spend || 0,
          totalClicks: data.total_clicks || 0,
          totalConversions: data.total_conversions || 0
        });
        console.log('✅ Previous month data loaded:', data);
      } else {
        console.log('ℹ️ No previous month data available for comparison');
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch previous month data:', error);
    }
  };

  // Use shared data if available, otherwise fetch independently - DISABLE AUTO-REFRESH
  useEffect(() => {
    if (sharedData) {
      console.log('🔄 MetaPerformanceLive: Using shared data from dashboard', {
        source: sharedData.debug?.source || 'dashboard',
        cacheAge: sharedData.debug?.cacheAge || 0
      });
      
      // 🔍 CRITICAL DEBUG: Log what MetaPerformanceLive receives
      console.log('📡 CRITICAL DEBUG - MetaPerformanceLive received sharedData:', {
        hasStats: !!sharedData.stats,
        stats: sharedData.stats,
        hasConversionMetrics: !!sharedData.conversionMetrics,
        conversionMetrics: sharedData.conversionMetrics,
        debugSource: sharedData.debug?.source,
        lastUpdated: sharedData.lastUpdated
      });
      
      // Use shared data from dashboard
      setStats(sharedData.stats);
      setMetrics(sharedData.conversionMetrics);
      setLastUpdated(sharedData.lastUpdated || new Date().toLocaleTimeString('pl-PL'));
      setDataSource(sharedData.debug?.source || 'cache');  // 🔧 SIMPLIFIED: Consistent source naming
      setCacheAge(sharedData.debug?.cacheAge || null);
      setLoading(false);
      
      // 🔍 CRITICAL DEBUG: Log what we set in state
      console.log('📊 CRITICAL DEBUG - MetaPerformanceLive state after setting:', {
        statsSet: sharedData.stats,
        metricsSet: sharedData.conversionMetrics
      });
      
      // Fetch previous month comparison data
      if (!previousMonthStats) {
        fetchPreviousMonthComparison();
      }
      
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

  const handleRefresh = () => {
    console.log('🔄 MetaPerformanceLive: Manual refresh requested');
    fetchSmartCacheData(true); // Force refresh
    fetchPreviousMonthComparison(); // Also refresh comparison data
  };
  
  // Calculate month-over-month change
  const calculateChange = (current: number, previous: number): { value: number; isPositive: boolean } => {
    if (previous === 0) return { value: 0, isPositive: true };
    const change = ((current - previous) / previous) * 100;
    return { value: Math.abs(change), isPositive: change >= 0 };
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-semibold text-text">Wydajność kampanii Meta Ads</h3>
          <p className="text-sm text-muted">Dane z inteligentnego cache (aktualizacja co 3h)</p>
        </div>
        <div className="flex items-center space-x-3">
          {/* Data Source Indicator */}
          <div className="flex items-center space-x-2 text-xs">
            {dataSource === 'cache' && (
              <div className="flex items-center space-x-1 text-success-500">
                <Database className="w-3 h-3" />
                <span>Cache</span>
              </div>
            )}
            {dataSource === 'stale-cache' && (
              <div className="flex items-center space-x-1 text-warning-500">
                <Clock className="w-3 h-3" />
                <span>Odświeżanie</span>
              </div>
            )}
            {dataSource === 'force-refresh' && (
              <div className="flex items-center space-x-1 text-navy">
                <RefreshCw className="w-3 h-3" />
                <span>Świeże</span>
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

      {      null}
    </div>
  );
} 