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
  const [clicksBars, setClicksBars] = useState<number[]>([]);
  const [spendBars, setSpendBars] = useState<number[]>([]);
  const [conversionsBars, setConversionsBars] = useState<number[]>([]);
  const [ctrBars, setCtrBars] = useState<number[]>([]);
  
  // Add request deduplication
  const requestInProgress = useRef(false);
  const [isRequesting, setIsRequesting] = useState(false);

  const dateRange = useMemo(() => {
    // Calculate the last 7 days (excluding today) for daily chart data
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    const sevenDaysAgo = new Date(yesterday);
    sevenDaysAgo.setDate(yesterday.getDate() - 6); // 7 days total including yesterday
    
    return {
      start: sevenDaysAgo.toISOString().split('T')[0],
      end: yesterday.toISOString().split('T')[0] // Exclude today
    };
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
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          console.log('❌ MetaPerformanceLive: No session found');
          throw new Error('No session found');
        }
        console.log('✅ MetaPerformanceLive: Session found, proceeding with API call');

        console.log(`🔄 MetaPerformanceLive: Fetching data from fetch-live-data (consistent with dashboard cards)`);

        // Use same endpoint as dashboard cards for data consistency
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const currentMonth = {
          start: `${year}-${String(month).padStart(2, '0')}-01`,
          end: new Date(year, month, 0).toISOString().split('T')[0] // Last day of current month
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
            forceFresh: false, // ✅ FIXED: Use smart cache instead of bypassing
            reason: 'meta_performance_live_component'
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

          // Store daily data and fetch ONLY real historical points
          storeDailyData(s, cm, campaigns, json.debug?.source || 'api');
          // Try to fetch ONLY real daily data
          fetchDailyDataPoints().then((hasRealData) => {
            if (!hasRealData) {
              console.log('ℹ️ No real daily data available from component cache - showing empty chart');
              // Old setBars removed
            }
          });

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

  // Store daily data for current day
  const storeDailyData = async (stats: Stats, conversionMetrics: ConversionMetrics, campaigns: any[], dataSource: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      console.log('📊 Storing daily KPI data:', {
        date: today,
        totalClicks: stats.totalClicks,
        totalSpend: stats.totalSpend,
        campaignsCount: campaigns.length,
        dataSource
      });
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      // Try to break down monthly data into daily values for more accurate storage
      const currentDate = new Date();
      const daysInMonth = currentDate.getDate();
      
      // Calculate daily averages, but adjust for today specifically
      const avgDailyClicks = Math.round(stats.totalClicks / daysInMonth);
      const avgDailySpend = stats.totalSpend / daysInMonth;
      const avgDailyImpressions = Math.round(stats.totalImpressions / daysInMonth);
      const avgDailyConversions = Math.round(stats.totalConversions / daysInMonth);
      
      // For today, try to get more recent data (assume today represents 10-15% of monthly total)
      const todayFactor = Math.min(0.15, 1 / daysInMonth * 1.2); // Today might be slightly higher
      const estimatedTodayClicks = Math.round(stats.totalClicks * todayFactor);
      const estimatedTodaySpend = stats.totalSpend * todayFactor;
      
      await fetch('/api/daily-kpi-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          clientId,
          date: today,
          campaigns: campaigns,
          conversionMetrics: {
            ...conversionMetrics,
            // Scale conversion metrics to daily level
            click_to_call: Math.round((conversionMetrics.click_to_call || 0) * todayFactor),
            email_contacts: Math.round((conversionMetrics.email_contacts || 0) * todayFactor),
            reservations: Math.round((conversionMetrics.reservations || 0) * todayFactor),
            reservation_value: (conversionMetrics.reservation_value || 0) * todayFactor,
          },
          dataSource,
          estimatedDailyData: {
            avgDailyClicks,
            avgDailySpend,
            avgDailyImpressions,
            avgDailyConversions,
            estimatedTodayClicks,
            estimatedTodaySpend,
            daysInMonth
          }
        })
      });

      console.log('📊 Daily KPI data stored successfully for:', today);
    } catch (error) {
      console.warn('⚠️ Failed to store daily KPI data:', error);
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
      setDataSource(sharedData.debug?.source || 'dashboard-shared');
      setCacheAge(sharedData.debug?.cacheAge || null);
      setLoading(false);
      
      // 🔍 CRITICAL DEBUG: Log what we set in state
      console.log('📊 CRITICAL DEBUG - MetaPerformanceLive state after setting:', {
        statsSet: sharedData.stats,
        metricsSet: sharedData.conversionMetrics
      });
      
      // DISABLED: Fetch daily data only once, not on every shared data change
      // This prevents auto-refresh when switching between cards
      if (clicksBars.length === 0) {
        fetchDailyDataPoints().then((hasRealData) => {
          if (!hasRealData) {
            console.log('ℹ️ No real daily data available from shared data - showing empty chart');
          }
        });
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

  // Fetch daily data points for chart - DATABASE FIRST approach
  const fetchDailyDataPoints = async () => {
    try {
      console.log('📊 Fetching daily data from DATABASE for clientId:', clientId);
      console.log('📅 Date range:', dateRange);
      
      // Get data directly from database for the last 7 completed days
      const { data: dailyData, error } = await supabase
        .from('daily_kpi_data')
        .select('date, total_clicks, total_spend, total_conversions, average_ctr, data_source')
        .eq('client_id', clientId)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)
        .order('date', { ascending: true }); // Chronological order

      if (error) {
        console.error('❌ Database error fetching daily data:', error);
        setClicksBars([]);
        setSpendBars([]);
        setConversionsBars([]);
        setCtrBars([]);
        return false;
      }

      if (!dailyData || dailyData.length === 0) {
        console.log('⚠️ No daily data found in database for client:', clientId);
        console.log('📅 Expected date range:', dateRange);
        setClicksBars([]);
        setSpendBars([]);
        setConversionsBars([]);
        setCtrBars([]);
        return false;
      }

      console.log('✅ Found daily data in database:', {
        recordCount: dailyData.length,
        dateRange: {
          start: dailyData[0]?.date,
          end: dailyData[dailyData.length - 1]?.date
        },
        sources: Array.from(new Set(dailyData.map(d => d.data_source)))
      });

      // Data is already in chronological order, no need to reverse
      const clicksBarsData = dailyData.map((day: any, index: number) => {
        const clicks = day.total_clicks || 0;
        const spend = day.total_spend || 0;
        const conversions = day.total_conversions || 0;
        const ctr = day.average_ctr || 0;
        console.log(`📊 Day ${index + 1} (${day.date}): ${clicks} clicks, €${spend}, ${conversions} conversions, CTR: ${ctr}%`);
        return clicks;
      });
      
      const spendBarsData = dailyData.map(day => day.total_spend || 0);
      const conversionsBarsData = dailyData.map(day => day.total_conversions || 0);
      const ctrBarsData = dailyData.map(day => day.average_ctr || 0);

      console.log('📈 Using database daily data:', {
        totalDays: dailyData.length,
        clicksRange: {
          min: Math.min(...clicksBarsData),
          max: Math.max(...clicksBarsData)
        },
        spendRange: {
          min: Math.min(...spendBarsData),
          max: Math.max(...spendBarsData)
        },
        totalClicks: clicksBarsData.reduce((a: number, b: number) => a + b, 0),
        totalSpend: spendBarsData.reduce((a: number, b: number) => a + b, 0),
        dataSource: 'database',
        dates: dailyData.map(d => d.date)
      });

      setClicksBars(clicksBarsData);
      setSpendBars(spendBarsData);
      setConversionsBars(conversionsBarsData);
      setCtrBars(ctrBarsData);
      
      // Debug: Log what's being stored in each KPI array
      console.log('🔍 DEBUG: Data being stored in KPI arrays:');
      console.log('- clicksBars:', clicksBarsData);
      console.log('- spendBars:', spendBarsData);
      console.log('- conversionsBars:', conversionsBarsData);
      console.log('- ctrBars:', ctrBarsData);
      console.log('- dates:', dailyData.map(d => d.date));

      return true;

    } catch (error) {
      console.error('❌ Error fetching daily data from database:', error);
      setClicksBars([]);
      setSpendBars([]);
      setConversionsBars([]);
      setCtrBars([]);
      return false;
    }
  };

  // Generate daily data points for the last 7 days + current month
  // REMOVED: No more fallback data generation - only real database data

  const handleRefresh = () => {
    console.log('🔄 MetaPerformanceLive: Manual refresh requested');
    fetchSmartCacheData(true); // Force refresh
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
          
          {/* Last Updated */}
          <div className="text-xs text-muted">
            {lastUpdated ? `Ostatnia aktualizacja: ${lastUpdated}` : 'Ładowanie...'}
          </div>
        </div>
      </div>

      {(() => {
        // 🔍 CRITICAL DEBUG: Log what we're about to render
        console.log('🎨 CRITICAL DEBUG - MetaPerformanceLive render:', {
          hasStats: !!stats,
          stats: stats,
          willRenderKPI: !!stats,
          clicksValue: stats ? stats.totalClicks.toLocaleString('pl-PL') : 'no stats',
          spendValue: stats ? formatCurrency(stats.totalSpend) : 'no stats',
          conversionsValue: stats ? safeConversion(stats.totalConversions).toLocaleString('pl-PL') : 'no stats'
        });
        
        if (!stats) {
          console.log('❌ CRITICAL DEBUG - No stats available, not rendering KPICarousel');
          return <div className="text-center text-muted py-8">Brak danych do wyświetlenia</div>;
        }
        
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
                value: safeConversion(stats.totalConversions).toLocaleString('pl-PL'),
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