'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { RefreshCw, Clock, Database, Target } from 'lucide-react';
import { supabase } from '../lib/supabase';

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

// ✅ UNIFIED: Uses same field names as Meta for consistency
interface GoogleAdsConversionMetrics {
  click_to_call: number;         // ✅ UNIFIED: Primary field for phone clicks
  email_contacts: number;        // ✅ UNIFIED: Primary field for form/email contacts
  form_submissions?: number;     // Google-specific (backward compat)
  phone_calls?: number;          // Google-specific (backward compat)
  email_clicks?: number;         // Google-specific (backward compat)
  phone_clicks?: number;         // Google-specific (backward compat)
  booking_step_1: number;
  booking_step_2: number;
  booking_step_3: number;
  reservations: number;
  reservation_value: number;
  roas?: number;                 // ✅ UNIFIED: Added roas
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
  
  const requestInProgress = useRef(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [waitingForSharedData, setWaitingForSharedData] = useState(false);
  
  // Month-over-month comparison state
  const [previousMonthStats, setPreviousMonthStats] = useState<{
    totalSpend: number;
    totalClicks: number;
    totalConversions: number;
  } | null>(null);

  // Fetch previous month data for comparison
  const fetchPreviousMonthComparison = useCallback(async () => {
    try {
      const now = new Date();
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const previousMonthStr = previousMonth.toISOString().split('T')[0]!;
      
      console.log('📊 GoogleAds: Fetching previous month data for comparison:', previousMonthStr);
      
      const { data, error } = await supabase
        .from('campaign_summaries')
        .select('total_spend, total_clicks, total_conversions')
        .eq('client_id', clientId)
        .eq('summary_type', 'monthly')
        .eq('platform', 'google')
        .eq('summary_date', previousMonthStr)
        .single();
      
      if (!error && data) {
        setPreviousMonthStats({
          totalSpend: data.total_spend || 0,
          totalClicks: data.total_clicks || 0,
          totalConversions: data.total_conversions || 0
        });
        console.log('✅ GoogleAds: Previous month data loaded:', data);
      } else {
        console.log('ℹ️ GoogleAds: No previous month data available for comparison');
      }
    } catch (error) {
      console.warn('⚠️ GoogleAds: Failed to fetch previous month data:', error);
    }
  }, [clientId]);

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
      
      // ✅ UNIFIED: Placeholder data structure uses unified field names
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
          click_to_call: 0,        // ✅ UNIFIED
          email_contacts: 0,       // ✅ UNIFIED
          booking_step_1: 0,
          booking_step_2: 0,
          booking_step_3: 0,
          reservations: 0,
          reservation_value: 0,
          roas: 0,                 // ✅ UNIFIED
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


  const handleRefresh = useCallback(() => {
    console.log('🔄 GoogleAdsPerformanceLive: Manual refresh requested');
    fetchGoogleAdsData(true);
    fetchPreviousMonthComparison();
  }, [fetchGoogleAdsData, fetchPreviousMonthComparison]);
  
  // Calculate month-over-month change
  const calculateChange = (current: number, previous: number): { value: number; isPositive: boolean } => {
    if (previous === 0) return { value: 0, isPositive: true };
    const change = ((current - previous) / previous) * 100;
    return { value: Math.abs(change), isPositive: change >= 0 };
  };

  // 🚀 OPTIMIZED: Process shared data from dashboard - USE SHARED DATA FIRST!
  useEffect(() => {
    console.log('📡 GoogleAdsPerformanceLive useEffect triggered:', {
      hasSharedData: !!sharedData,
      hasStats: !!sharedData?.stats,
      debugSource: sharedData?.debug?.source
    });

    // 🚀 PERFORMANCE: If shared data is available, use it immediately and skip component fetch
    if (sharedData && sharedData.stats) {
      console.log('✅ GoogleAdsPerformanceLive: Using shared data from dashboard, skipping component fetch');
      setWaitingForSharedData(false);
      
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
                               sharedData.debug?.reason?.includes('google');
      
        console.log('🔍 GoogleAds data validation:', {
          hasValidData,
          currentHasValidData,
          isGoogleAdsUpdate,
          willUpdate: hasValidData || !currentHasValidData || isGoogleAdsUpdate
        });
      
        if (hasValidData || !currentHasValidData || isGoogleAdsUpdate) {
          console.log('✅ GoogleAdsPerformanceLive: Updating with shared data');
          // Use shared data from dashboard
          setStats(sharedData.stats);
          setMetrics(sharedData.conversionMetrics);
          setLastUpdated(sharedData.lastUpdated || new Date().toLocaleTimeString('pl-PL'));
          setDataSource(sharedData.debug?.source || 'cache');  // 🔧 SIMPLIFIED: Consistent source naming
          setCacheAge(sharedData.debug?.cacheAge || null);
          setLoading(false);
          
          // Fetch previous month comparison data
          if (!previousMonthStats) {
            fetchPreviousMonthComparison();
          }
        
          // 🚀 CRITICAL: Mark that we have data, so we don't make unnecessary API calls
          requestInProgress.current = false;
          setIsRequesting(false);
        
          return; // ← EXIT EARLY! Don't wait for other fetches
        } else {
          console.log('⚠️ GoogleAdsPerformanceLive: Keeping current valid data instead of empty shared data');
          setLoading(false); // Still stop loading
        }
      
      return; // Don't fetch placeholder data if we have shared data
    } else {
      // No shared data yet - we might be waiting for it
      console.log('ℹ️ GoogleAdsPerformanceLive: No valid shared data yet, waiting');
      setWaitingForSharedData(true);
    }
  }, [sharedData, stats]);

  // Initialize with placeholder data only if no shared data and not waiting
  useEffect(() => {
    // 🚀 OPTIMIZATION: Only fetch if we don't have shared data AND not already requesting
    if (!sharedData && !waitingForSharedData && !isRequesting && !requestInProgress.current && clientId) {
      console.log('ℹ️ GoogleAdsPerformanceLive: No shared data available, will initialize with placeholder (fetch disabled in component)');
      // 🔧 DISABLED: Component should NOT fetch data independently
      // The dashboard provides all data via sharedData prop
      // If you need this component to work independently, uncomment:
      // fetchGoogleAdsData(false);
    }
  }, [clientId, isRequesting, sharedData, waitingForSharedData]);

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
      ) : !stats && (
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