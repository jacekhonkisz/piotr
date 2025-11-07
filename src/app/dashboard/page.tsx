'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { 
  BarChart3, 
  Download,
  Target,
  RefreshCw,
  AlertCircle,
  LogOut,
  User,
  ArrowUpRight,
  Trash2
} from 'lucide-react';
import { useAuth } from '../../components/AuthProvider';
import { supabase } from '../../lib/supabase';

import type { Database } from '../../lib/database.types';
import { DashboardLoading } from '../../components/LoadingSpinner';
import { getCurrentMonthInfo } from '../../lib/date-utils';
import AdsDataToggle from '../../components/AdsDataToggle';
// Removed unified-data-fetcher import - using StandardizedDataFetcher instead
import { DataSourceIndicator } from '../../components/DataSourceIndicator';
import { MonthlyFromDailyCalculator } from '../../lib/monthly-from-daily-calculator';
import { StandardizedDataFetcher } from '../../lib/standardized-data-fetcher';

import AnimatedMetricsCharts from '../../components/AnimatedMetricsCharts';
import MetaPerformanceLive from '../../components/MetaPerformanceLive';
// GoogleAdsPerformanceLive imported dynamically to avoid Google Ads API browser issues
const GoogleAdsPerformanceLive = dynamic(() => import('../../components/GoogleAdsPerformanceLive'), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-gray-200 h-32 rounded-lg"></div>
}) as React.ComponentType<any>;


import ClientSelector from '../../components/ClientSelector';
import WelcomeSection from '../../components/WelcomeSection';


type Client = Database['public']['Tables']['clients']['Row'];
type Report = Database['public']['Tables']['reports']['Row'];
type Campaign = Database['public']['Tables']['campaigns']['Row'];

// 🔧 STANDARDIZED: Now using StandardizedDataFetcher as single source of truth

interface ClientDashboardData {
  client: Client;
  reports: Report[];
  campaigns: Campaign[];
  stats: {
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    averageCtr: number;
    averageCpc: number;
  };
  conversionMetrics: {
    click_to_call: number;
    email_contacts: number;
    booking_step_1: number;
    reservations: number;
    reservation_value: number;
    roas: number;
    cost_per_reservation: number;
    booking_step_2: number;
    booking_step_3: number;
  };
  // 🔧 DATA SOURCE TRACKING: Same as reports page
  debug?: {
    source?: string;
    cachePolicy?: string;
    responseTime?: number;
    campaigns?: any[];
    reason?: string;
  };
  validation?: {
    actualSource?: string;
    expectedSource?: string;
  };
  lastUpdated?: string;
}

interface CachedData {
  data: ClientDashboardData;
  timestamp: number;
  dataSource: 'cache' | 'stale-cache' | 'live-api-cached' | 'database';
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [clientData, setClientData] = useState<ClientDashboardData | null>(null);
  const [refreshingData, setRefreshingData] = useState(false);
  const [dataSource, setDataSource] = useState<string>('database');
  const [dashboardInitialized, setDashboardInitialized] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('Ładowanie dashboardu...');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [activeAdsProvider, setActiveAdsProvider] = useState<'meta' | 'google'>('meta');
  const [loadingSafetyTimeout, setLoadingSafetyTimeout] = useState<NodeJS.Timeout | null>(null);
  const [renderKey, setRenderKey] = useState(0);
  
  // 🔧 DATA SOURCE VALIDATION: Track data source information for debugging (same as reports)
  const [dataSourceInfo, setDataSourceInfo] = useState<{
    validation?: any;
    debug?: any;
    lastUpdated?: string;
  }>({});

  // 📊 PREVIOUS MONTH COMPARISON: Track previous month conversion metrics for AnimatedMetricsCharts
  const [previousMonthConversionMetrics, setPreviousMonthConversionMetrics] = useState<{
    booking_step_1: number;
    reservations: number;
    reservation_value: number;
  }>({
    booking_step_1: 0,
    reservations: 0,
    reservation_value: 0
  });

  // Handle tab switching - reload data when switching between platforms
  const handleTabSwitch = async (provider: 'meta' | 'google') => {
    console.log('🔄 TAB SWITCH CALLED:', {
      requestedProvider: provider,
      currentProvider: activeAdsProvider,
      hasSelectedClient: !!selectedClient,
      hasClientData: !!clientData,
      clientDataClient: !!clientData?.client,
      willSwitch: provider !== activeAdsProvider && (!!selectedClient || !!clientData?.client)
    });
    
    // 🔧 FIX: Use clientData.client if selectedClient is null
    const currentClient = selectedClient || clientData?.client;
    
    if (provider === activeAdsProvider || !currentClient) {
      console.log('🔄 TAB SWITCH BLOCKED:', {
        sameProvider: provider === activeAdsProvider,
        noClient: !currentClient,
        selectedClient: !!selectedClient,
        clientDataClient: !!clientData?.client
      });
      return;
    }
    
    console.log('🔄 TAB SWITCH: Switching from', activeAdsProvider, 'to', provider);
    
    // 🔧 CRITICAL FIX: Set refreshing state BEFORE switching provider
    setRefreshingData(true);
    
    // 🔧 FIX: Clear old data immediately to prevent showing stale numbers
    // This fixes the issue where old data flashes before new data loads
    if (clientData) {
      setClientData(prev => ({
        ...prev!,
        stats: undefined,  // ← Force loading state
        conversionMetrics: undefined,
        campaigns: []
      }));
      console.log('🧹 Cleared old data to prevent stale numbers during tab switch');
    }
    
    // Clear any existing API call trackers to prevent blocking
    if ((window as any).apiCallTracker) {
      Object.keys((window as any).apiCallTracker).forEach(key => {
        if (key.includes(currentClient.id)) {
          delete (window as any).apiCallTracker[key];
        }
      });
      console.log('🧹 Cleared API call trackers for dashboard switch');
    }
    
    // Switch provider first
    setActiveAdsProvider(provider);
    
    // 🔧 CRITICAL: Wait for state update before loading data
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 🚀 PERFORMANCE OPTIMIZATION: Load data with cache-preferred mode for instant display
    if (currentClient) {
      console.log('🔄 TAB SWITCH: Loading data for provider (CACHE-FIRST):', provider);
      const newData = await loadMainDashboardData(currentClient, provider, true); // ← Add cacheFirst flag
      
      console.log('🔄 TAB SWITCH: Received data:', {
        hasData: !!newData,
        dataSource: newData?.debug?.source,
        reason: (newData?.debug as any)?.reason,
        hasStats: !!newData?.stats,
        statsClicks: newData?.stats?.totalClicks,
        statsSpend: newData?.stats?.totalSpend,
        provider: provider,
        expectedForGoogle: provider === 'google' ? 'Should be 15800 spend, 7400 clicks' : 'N/A'
      });
    
      if (newData && clientData) {
        // 🔧 CRITICAL FIX: Update clientData immediately with new data
        const updatedClientData = {
          ...clientData,
          campaigns: newData.campaigns || [],
          stats: newData.stats,
          conversionMetrics: newData.conversionMetrics,
          debug: newData.debug,
          lastUpdated: (newData as any).lastUpdated || new Date().toISOString()
        };
        
        console.log('🔄 TAB SWITCH: Setting updated client data:', {
          hasStats: !!updatedClientData.stats,
          statsSpend: updatedClientData.stats?.totalSpend,
          debugSource: updatedClientData.debug?.source,
          provider: provider
        });
        
        setClientData(updatedClientData);
        setDataSource(newData.debug?.source || 'unknown');
        
        // 🔧 FIX: Update dataSourceInfo for the new provider
        setDataSourceInfo({
          validation: newData.validation,
          debug: newData.debug,
          lastUpdated: new Date().toISOString()
        });
        
        // 📊 Fetch previous month conversion metrics for the new provider
        fetchPreviousMonthConversionMetrics(currentClient);
      }
    }
    
    setRefreshingData(false);
  };

  // Google Ads campaigns data will be loaded from clientData.campaigns when activeAdsProvider is 'google'

  const { user, profile, authLoading, signOut } = useAuth();
  const router = useRouter();
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/auth/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleClientChange = async (client: Client) => {
    console.log('🚀 DASHBOARD: handleClientChange called for client:', client.id);
    setSelectedClient(client);
    setLoading(true);
    setLoadingMessage('Ładowanie danych klienta...');
    setLoadingProgress(25);
    
    // Clear any existing safety timeout
    if (loadingSafetyTimeout) {
      clearTimeout(loadingSafetyTimeout);
    }
    
    // Set safety timeout to prevent infinite loading (20 seconds max)
    const safetyTimeout = setTimeout(() => {
      console.warn('⚠️ SAFETY TIMEOUT: Force stopping loading after 20 seconds');
      setLoading(false);
      setLoadingMessage('Timeout - spróbuj ponownie');
      setLoadingProgress(0);
    }, 20000);
    setLoadingSafetyTimeout(safetyTimeout);
    
    // 🔧 INTELLIGENT TAB SELECTION: Set appropriate tab based on client configuration
    const hasMetaAds = client.meta_access_token && client.ad_account_id;
    const hasGoogleAds = client.google_ads_enabled && client.google_ads_customer_id;
    
    console.log('🔍 CLIENT TAB SELECTION:', {
      clientName: client.name,
      hasMetaAds,
      hasGoogleAds,
      currentTab: activeAdsProvider
    });
    
    // Set the appropriate tab based on client configuration
    if (hasMetaAds && !hasGoogleAds) {
      // Client only has Meta Ads
      setActiveAdsProvider('meta');
      console.log('📡 Setting tab to Meta Ads (only platform configured)');
    } else if (hasGoogleAds && !hasMetaAds) {
      // Client only has Google Ads
      setActiveAdsProvider('google');
      console.log('📡 Setting tab to Google Ads (only platform configured)');
    } else if (hasMetaAds && hasGoogleAds) {
      // Client has both - keep current tab or default to Meta
      if (activeAdsProvider !== 'meta' && activeAdsProvider !== 'google') {
        setActiveAdsProvider('meta');
        console.log('📡 Setting tab to Meta Ads (both platforms, defaulting to Meta)');
      }
    } else {
      // Client has no platforms configured
      console.warn('⚠️ Client has no advertising platforms configured');
    }
    
    // Clear cache for the new client to ensure fresh data
    clearCache();
    
    try {
      setLoadingMessage('Pobieranie danych z API...');
      setLoadingProgress(50);
      
      // Load data for the new client
      const mainDashboardData = await loadMainDashboardData(client);
      
      setLoadingMessage('Ładowanie raportów...');
      setLoadingProgress(75);
      
      const { data: reports } = await supabase
        .from('reports')
        .select('*')
        .eq('client_id', client.id)
        .order('generated_at', { ascending: false })
        .limit(10);

      setLoadingMessage('Finalizowanie...');
      setLoadingProgress(90);

      const dashboardData = {
        client: client,
        reports: reports || [],
        campaigns: mainDashboardData?.campaigns || [],
        stats: mainDashboardData?.stats || {
          totalSpend: 0,
          totalImpressions: 0,
          totalClicks: 0,
          totalConversions: 0,
          averageCtr: 0,
          averageCpc: 0
        },
        conversionMetrics: mainDashboardData?.conversionMetrics || {
          click_to_call: 0,
          email_contacts: 0,
          booking_step_1: 0,
          reservations: 0,
          reservation_value: 0,
          roas: 0,
          cost_per_reservation: 0,
          booking_step_2: 0
        },
        // Add debug info for components
        debug: mainDashboardData?.debug || { source: 'fallback', reason: 'No data loaded' },
        lastUpdated: new Date().toISOString()
      };

      setClientData(dashboardData);
      setDataSource(mainDashboardData?.debug?.source || 'database');
      
      // 📊 Fetch previous month conversion metrics for comparison
      fetchPreviousMonthConversionMetrics(client);
      
      setLoadingProgress(100);
      setLoadingMessage('Gotowe!');
      
      // Small delay to show completion
      setTimeout(() => {
        setLoading(false);
        setLoadingMessage('Ładowanie dashboardu...');
        setLoadingProgress(0);
        
        // Clear safety timeout on successful completion
        if (loadingSafetyTimeout) {
          clearTimeout(loadingSafetyTimeout);
          setLoadingSafetyTimeout(null);
        }
      }, 500);
    } catch (error) {
      console.error('Error loading client data:', error);
      setLoadingMessage('Błąd ładowania danych');
      
      // Ensure loading state is always resolved
      setTimeout(() => {
        setLoading(false);
        setLoadingMessage('Ładowanie dashboardu...');
        setLoadingProgress(0);
        
        // Clear safety timeout on error completion
        if (loadingSafetyTimeout) {
          clearTimeout(loadingSafetyTimeout);
          setLoadingSafetyTimeout(null);
        }
      }, 2000);
    }
  };

  const getCacheKey = () => `dashboard_cache_${user?.email || 'anonymous'}_${selectedClient?.id || 'default'}_v4`;

  // Note: Smart caching is now handled by the API layer, no need for localStorage
  const saveToCache = (_data: ClientDashboardData, _source: 'cache' | 'stale-cache' | 'live-api-cached' | 'database') => {
    // Smart caching is now handled by the API - this function is kept for compatibility
    console.log('📦 Smart caching handled by API, skipping localStorage cache');
  };

  const clearCache = () => {
    localStorage.removeItem(getCacheKey());
  };

  const clearAllClientCaches = () => {
    // Clear all client-specific caches for the current user
    if (user?.email) {
      const keys = Object.keys(localStorage);
      const userCacheKeys = keys.filter(key => key.startsWith(`dashboard_cache_${user.email}_`));
      userCacheKeys.forEach(key => {
        localStorage.removeItem(key);
        console.log(`🗑️ Cleared cache: ${key}`);
      });
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      loadingRef.current = false;
      
      // Clear safety timeout on unmount
      if (loadingSafetyTimeout) {
        clearTimeout(loadingSafetyTimeout);
      }
    };
  }, [loadingSafetyTimeout]);

  useEffect(() => {
    if (loadingRef.current || authLoading || !user) {
      if (!user && !authLoading) {
        router.replace('/auth/login');
      }
      return;
    }

    if (!profile) {
      const timeout = setTimeout(() => {
        if (!profile && user) {
          setDashboardInitialized(true);
          setLoading(false);
        }
      }, 2000);
      return () => clearTimeout(timeout);
    }

    if (user && profile && !dashboardInitialized) {
      setDashboardInitialized(true);
      
      if (profile.role === 'admin') {
        // Admin users can access dashboard - load first client's data
        console.log('👑 DASHBOARD: Admin user accessing dashboard');
        loadClientDashboardWithCache();
        return;
      } else {
        // Regular users load their specific client data
        loadClientDashboardWithCache();
        return;
      }
    }

    // Remove this block - it was causing infinite loops
    // Dashboard loading is handled in the initialization block above
    
    return;
  }, [user, profile, dashboardInitialized, authLoading]);

  const loadClientDashboardWithCache = async () => {
    console.log('🚀 DASHBOARD: loadClientDashboardWithCache called');
    if (loadingRef.current) {
      console.log('⚠️ DASHBOARD: Loading already in progress, returning');
      return;
    }
    
    loadingRef.current = true;
    setLoading(true);
    
    try {
      // Check if we have cached data
      console.log('🔍 DASHBOARD: Checking localStorage cache...');
      const cached = localStorage.getItem(getCacheKey());
      console.log('📦 DASHBOARD: Cache found:', !!cached);
      if (cached) {
        try {
          const cacheData: CachedData = JSON.parse(cached);
          const cacheAge = Date.now() - cacheData.timestamp;
          const maxCacheAge = 5 * 60 * 1000; // 5 minutes
          
          console.log('⏰ DASHBOARD: Cache age:', Math.round(cacheAge / 1000), 'seconds');
          console.log('⏰ DASHBOARD: Max cache age:', Math.round(maxCacheAge / 1000), 'seconds');
          if (cacheAge < maxCacheAge) {
            console.log('✅ DASHBOARD: Using cached dashboard data');
            console.log('📊 DASHBOARD: Cached data stats:', cacheData.data?.stats);
            setClientData(cacheData.data);
            setDataSource(cacheData.dataSource);
            setLoading(false);
            return;
          } else {
            console.log('❌ DASHBOARD: Cache expired, will load fresh data');
          }
        } catch (error) {
          console.error('Error parsing cached data:', error);
        }
      }
      
      // No valid cache, load fresh data
      console.log('🔄 DASHBOARD: No valid cache, loading fresh data');
      await loadClientDashboard();
    } catch (error) {
      console.error('Error loading dashboard with cache:', error);
      setLoading(false);
    } finally {
      loadingRef.current = false;
    }
  };

  const loadClientDashboard = async () => {
    console.log('🚀 DASHBOARD: loadClientDashboard called');
    try {
      if (!user!.email) {
        return;
      }
      
      let clientData;
      let clientError;
      
      if (user!.role === 'admin') {
        // For admin users, get all clients and use the selected client or first one
        const { data: clients, error: error } = await supabase
          .from('clients')
          .select('*')
          .eq('admin_id', user!.id);
        
        clientError = error;
        
        if (clients && clients.length > 0) {
          // Use selected client or first client
          clientData = selectedClient || clients[0];
        }
      } else {
        // For regular users, get their specific client
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('email', user!.email)
          .single();
        
        clientData = data;
        clientError = error;
      }

      if (clientError || !clientData) {
        return;
      }

      // Load main dashboard data (campaigns, stats, conversion metrics)
      const mainDashboardData = await loadMainDashboardData(clientData);
      
      // Get reports
      const { data: reports, error: reportsError } = await supabase
        .from('reports')
        .select('*')
        .eq('client_id', clientData.id)
        .order('generated_at', { ascending: false })
        .limit(10);

      if (reportsError) {
        console.error('Error fetching reports:', reportsError);
      }

      const dashboardData = {
        client: clientData,
        reports: reports || [],
        campaigns: mainDashboardData?.campaigns || [],
        stats: mainDashboardData?.stats || {
          totalSpend: 0,
          totalImpressions: 0,
          totalClicks: 0,
          totalConversions: 0,
          averageCtr: 0,
          averageCpc: 0
        },
        conversionMetrics: mainDashboardData?.conversionMetrics || {
          click_to_call: 0,
          email_contacts: 0,
          booking_step_1: 0,
          reservations: 0,
          reservation_value: 0,
          roas: 0,
          cost_per_reservation: 0,
          booking_step_2: 0
        }
      };

      setClientData(dashboardData);
      setDataSource('live-api-cached');
      setLoading(false); // 🔧 FIX: Properly set loading to false
      
      // Force re-render to ensure display updates
      setRenderKey(prev => prev + 1);
      
      // 📊 Fetch previous month conversion metrics for comparison
      fetchPreviousMonthConversionMetrics(clientData);
      
      // Note: Smart caching is now handled by the API, no need for localStorage cache
    } catch (error) {
      console.error('Error loading client dashboard:', error);
      setLoading(false); // 🔧 FIX: Set loading to false on error too
      // 🔧 FIX: Remove potential loop - don't call another load function
      // await loadClientDashboardFromDatabase();
    }
  };

  const loadClientDashboardFromDatabase = async () => {
    try {
      if (!user!.email) {
        return;
      }
      
      let clientData;
      let clientError;
      
      if (user!.role === 'admin') {
        // For admin users, get all clients and use the selected client or first one
        const { data: clients, error: error } = await supabase
          .from('clients')
          .select('*')
          .eq('admin_id', user!.id);
        
        clientError = error;
        
        if (clients && clients.length > 0) {
          // Use selected client or first client
          clientData = selectedClient || clients[0];
        }
      } else {
        // For regular users, get their specific client
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('email', user!.email)
          .single();
        
        clientData = data;
        clientError = error;
      }

      if (clientError || !clientData) {
        return;
      }

      // Get past months data (exclude current month)
      const today = new Date();
      // Use UTC to avoid timezone issues
      const startOfCurrentMonth = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));
      const startOfCurrentMonthStr = startOfCurrentMonth.toISOString().split('T')[0];
      
      console.log('📅 Loading past months data (before:', startOfCurrentMonthStr, ')');
      
      // Get campaigns from past months only
      const { data: pastCampaigns, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('client_id', clientData.id)
        .lt('date_range_start', startOfCurrentMonthStr) // Only past months
        .order('date_range_start', { ascending: false })
        .limit(50);

      if (campaignsError) {
        console.error('Error fetching past campaigns:', campaignsError);
        return;
      }

      // Get reports
      const { data: reports, error: reportsError } = await supabase
        .from('reports')
        .select('*')
        .eq('client_id', clientData.id)
        .order('generated_at', { ascending: false })
        .limit(10);

      if (reportsError) {
        console.error('Error fetching reports:', reportsError);
        return;
      }

      // Calculate stats from past months data
      const stats = (pastCampaigns || []).reduce((acc, campaign) => {
        acc.totalSpend += campaign.spend || 0;
        acc.totalImpressions += campaign.impressions || 0;
        acc.totalClicks += campaign.clicks || 0;
        acc.totalConversions += campaign.conversions || 0;
        return acc;
      }, {
        totalSpend: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalConversions: 0,
        averageCtr: 0,
        averageCpc: 0
      });

      // Calculate averages
      if (stats.totalImpressions > 0) {
        stats.averageCtr = (stats.totalClicks / stats.totalImpressions) * 100;
      }
      if (stats.totalClicks > 0) {
        stats.averageCpc = stats.totalSpend / stats.totalClicks;
      }

      // Create conversion metrics from past campaigns
      const conversionMetrics = (pastCampaigns || []).reduce((acc, campaign: any) => {
        acc.click_to_call += campaign.click_to_call || 0;
        acc.email_contacts += campaign.email_contacts || 0;
        acc.booking_step_1 += campaign.booking_step_1 || 0;
        acc.reservations += campaign.reservations || 0;
        acc.reservation_value += campaign.reservation_value || 0;
        acc.booking_step_2 += campaign.booking_step_2 || 0;
        acc.booking_step_3 += campaign.booking_step_3 || 0;
        acc.roas += campaign.roas || 0;
        acc.cost_per_reservation += campaign.cost_per_reservation || 0;
        return acc;
      }, {
        click_to_call: 0,
        email_contacts: 0,
        booking_step_1: 0,
        reservations: 0,
        reservation_value: 0,
        roas: 0,
        cost_per_reservation: 0,
        booking_step_2: 0,
        booking_step_3: 0
      });

      const finalDashboardData = {
        client: clientData,
        reports: reports || [],
        campaigns: pastCampaigns || [],
        stats: stats,
        conversionMetrics: conversionMetrics
      };

      setClientData(finalDashboardData);
      setDataSource('database');
      saveToCache(finalDashboardData, 'database');
      
      // Force re-render to ensure display updates
      setRenderKey(prev => prev + 1);
      
      console.log('📊 Loaded past months data:', {
        campaigns: pastCampaigns?.length || 0,
        totalSpend: stats.totalSpend,
        totalClicks: stats.totalClicks
      });
    } catch (error) {
      console.error('Error loading client dashboard from database:', error);
    }
  };


  const loadMainDashboardData = async (
    currentClient: any, 
    forceProvider?: 'meta' | 'google',
    cacheFirst: boolean = false // 🚀 NEW: Cache-first mode for instant tab switching
  ) => {
    console.log('🚀 DASHBOARD: loadMainDashboardData called for client:', currentClient?.id);
    console.log('🔄 DASHBOARD: Force refresh timestamp:', Date.now());
    console.log('⚡ DASHBOARD: Cache-first mode:', cacheFirst);
    try {
      // 🔧 USE SAME DATE LOGIC AS SMART CACHE HELPER: Ensures proper cache detection
      const currentMonthInfo = getCurrentMonthInfo();
      const dateRange = {
        start: currentMonthInfo.startDate as string,
        end: (currentMonthInfo.endDate || new Date().toISOString().split('T')[0]) as string
      };
      
      console.log('📅 Dashboard using smart cache date range:', {
        periodId: currentMonthInfo.periodId,
        dateRange,
        year: currentMonthInfo.year,
        month: currentMonthInfo.month,
        cacheFirst
      });
      
      // 🔧 REMOVED: Authentication check - not required for this project
      // Dashboard will use StandardizedDataFetcher without authentication

      // 🔧 UNIFIED APPROACH: Use same logic as reports page
      const hasMetaAds = currentClient.meta_access_token && currentClient.ad_account_id;
      const hasGoogleAds = currentClient.google_ads_enabled && currentClient.google_ads_customer_id;
      
      console.log('🔍 DASHBOARD: Client configuration check:', {
        clientId: currentClient.id,
        hasMetaAds,
        hasGoogleAds,
        activeProvider: activeAdsProvider,
        forceProvider
      });

      // 🔧 UNIFIED DATA FETCHING: Use same approach as reports page
      let effectiveProvider = forceProvider || activeAdsProvider;
      
      // Auto-switch provider based on client configuration (same as reports)
      if (hasMetaAds && !hasGoogleAds) {
        effectiveProvider = 'meta';
        setActiveAdsProvider('meta');
      } else if (hasGoogleAds && !hasMetaAds) {
        effectiveProvider = 'google';
        setActiveAdsProvider('google');
      }

      console.log('🔧 DASHBOARD: Using unified data fetching with provider:', effectiveProvider);

      try {
        // 🔧 STANDARDIZED: Use appropriate fetcher based on platform
        console.log('🎯 Using STANDARDIZED DATA FETCHER for consistent results');
        
        let result;
        
        if (effectiveProvider === 'google') {
          // Use separate Google Ads system
                console.log('🎯🎯🎯 Using GoogleAdsStandardizedDataFetcher for dashboard...');
                console.log('🎯🎯🎯 GOOGLE FETCH: cacheFirst =', cacheFirst);
                console.log('🎯🎯🎯 GOOGLE FETCH: Current client:', currentClient.id);
                
                // 🔧 FIX: Get session token for Google Ads too
                const { data: { session } } = await supabase.auth.getSession();
                console.log('🎯🎯🎯 GOOGLE FETCH: Session retrieved, has token:', !!session?.access_token);
          
          // 🔧 FIX: Always use GoogleAdsStandardizedDataFetcher (same as reports page)
          // This ensures we check daily_kpi_data FIRST, then smart cache, then database, then live API
          // The standardized fetcher handles cache-first logic internally
          console.log('🔧 DASHBOARD: Using GoogleAdsStandardizedDataFetcher (same as reports page)');
          console.log('🔧 DASHBOARD: This ensures daily_kpi_data is checked FIRST for accuracy');
          
          // Use Google Ads fetcher (same logic as reports page)
          if (typeof window === 'undefined') {
            // Server-side: use fetcher directly
            const { GoogleAdsStandardizedDataFetcher } = await import('../../lib/google-ads-standardized-data-fetcher');
            
            result = await GoogleAdsStandardizedDataFetcher.fetchData({
              clientId: currentClient.id,
              dateRange,
              reason: cacheFirst ? 'google-ads-dashboard-tab-switch' : 'google-ads-dashboard-standardized-load',
              sessionToken: session?.access_token
            });
          } else {
            // Client-side: redirect to API endpoint with authentication (same as reports page)
            const response = await fetch('/api/fetch-google-ads-live-data', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}`
              },
              body: JSON.stringify({
                clientId: currentClient.id,
                dateRange,
                reason: cacheFirst ? 'google-ads-dashboard-tab-switch' : 'google-ads-dashboard-standardized-load'
              })
            });
            
            if (!response.ok) {
              throw new Error(`Google Ads API call failed: ${response.status}`);
            }
            
            result = await response.json();
          }
        } else {
          // Use Meta system
          console.log('🎯🎯🎯 Using StandardizedDataFetcher for Meta dashboard...');
          console.log('🎯🎯🎯 META FETCH: cacheFirst =', cacheFirst);
          
          // 🔧 FIX: Get session token like reports page does
          const { data: { session } } = await supabase.auth.getSession();
          
          // 🚀 PERFORMANCE: Use smart cache API directly for cache-first mode
          if (cacheFirst) {
            console.log('⚡ CACHE-FIRST MODE: Using Meta smart cache API directly');
            const cacheResponse = await fetch('/api/fetch-live-data', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}` // ← CRITICAL: Add auth for cache API!
              },
              body: JSON.stringify({
                clientId: currentClient.id,
                forceRefresh: false // ← Always use cache for instant loading
              })
            });
            
            console.log('📡 CACHE-FIRST: Meta cache response status:', cacheResponse.status);
            
            if (cacheResponse.ok) {
              const cacheResult = await cacheResponse.json();
              console.log('📡 CACHE-FIRST: Meta cache result:', {
                success: cacheResult.success,
                hasData: !!cacheResult.data,
                dataKeys: cacheResult.data ? Object.keys(cacheResult.data) : [],
                hasStats: !!cacheResult.data?.stats,
                hasCampaigns: !!cacheResult.data?.campaigns
              });
              
              // 🔧 CRITICAL: Validate cache data is complete before accepting it
              const hasCacheData = cacheResult.success && cacheResult.data;
              const hasValidStats = cacheResult.data?.stats && (
                typeof cacheResult.data.stats.totalSpend === 'number' ||
                typeof cacheResult.data.stats.totalClicks === 'number' ||
                typeof cacheResult.data.stats.totalImpressions === 'number'
              );
              const hasValidMetrics = cacheResult.data?.conversionMetrics && (
                typeof cacheResult.data.conversionMetrics.reservations === 'number'
              );
              const hasCampaigns = Array.isArray(cacheResult.data?.campaigns);
              
              console.log('🔍 CACHE-FIRST: Meta cache data validation:', {
                hasCacheData,
                hasValidStats,
                hasValidMetrics,
                hasCampaigns,
                statsValues: cacheResult.data?.stats,
                isComplete: hasCacheData && hasValidStats && hasValidMetrics
              });
              
              if (hasCacheData && hasValidStats && hasValidMetrics) {
                console.log('✅ CACHE-FIRST: Loaded COMPLETE Meta data from smart cache - SKIPPING live API call!');
                result = {
                  success: true,
                  data: cacheResult.data,
                  debug: {
                    source: 'meta-cache',  // 🔧 SIMPLIFIED: Consistent source naming
                    reason: 'dashboard-tab-switch-cache-first',
                    cachePolicy: 'prefer-cache',
                    responseTime: cacheResult.debug?.responseTime || cacheResult.responseTime || 0
                  },
                  validation: {
                    actualSource: 'meta-cache',
                    expectedSource: 'meta-cache',
                    isConsistent: true
                  }
                };
              } else {
                console.warn('⚠️ CACHE-FIRST: Meta cache data incomplete or invalid, will fallback:', {
                  hasData: hasCacheData,
                  hasStats: hasValidStats,
                  hasMetrics: hasValidMetrics,
                  reason: !hasCacheData ? 'no data' : !hasValidStats ? 'invalid stats' : 'invalid metrics'
                });
              }
            } else {
              console.warn('⚠️ CACHE-FIRST: Meta cache response NOT OK:', cacheResponse.status, await cacheResponse.text());
            }
          }
          
          // Fallback to standard fetcher if cache-first failed or not requested
          console.log('🔍 CACHE-FIRST META: Checking if fallback needed:', {
            hasResult: !!result,
            resultSuccess: result?.success,
            resultSource: result?.debug?.source,
            willFallback: !result || !result.success
          });
          
          if (!result || !result.success) {
            console.log('⚠️ CACHE-FIRST META: Falling back to standard fetcher');
          result = await StandardizedDataFetcher.fetchData({
            clientId: currentClient.id,
            dateRange,
            platform: 'meta',
              reason: cacheFirst ? 'meta-dashboard-tab-switch' : 'meta-dashboard-standardized-load-force-refresh',
              sessionToken: session?.access_token // ← CRITICAL FIX: Pass session token like reports page!
          });
          }
        }

        if (result.success && result.data) {
          console.log('✅ DASHBOARD: Unified fetch successful:', {
            campaignCount: result.data.campaigns?.length || 0,
            source: result.debug?.source,
            cachePolicy: result.debug?.cachePolicy,
            hasStats: !!result.data.stats,
            statsDetails: result.data.stats,
            hasConversionMetrics: !!result.data.conversionMetrics,
            conversionMetricsDetails: result.data.conversionMetrics
          });

          // Update data source tracking (same as reports)
          setDataSourceInfo({
            validation: result.validation,
            debug: result.debug,
            lastUpdated: new Date().toISOString()
          });

          // 🔧 FIXED: Use StandardizedDataFetcher results directly (already calculated)
          const campaigns = result.data.campaigns || [];
          
          // Use pre-calculated stats from StandardizedDataFetcher
          const stats = result.data.stats || {
            totalSpend: 0,
            totalImpressions: 0, 
            totalClicks: 0,
            totalConversions: 0,
            averageCtr: 0,
            averageCpc: 0
          };

          console.log('📊 DASHBOARD: Using StandardizedDataFetcher stats:', {
            totalSpend: stats.totalSpend,
            totalClicks: stats.totalClicks,
            totalImpressions: stats.totalImpressions,
            totalConversions: stats.totalConversions,
            campaignCount: campaigns.length,
            source: 'standardized-fetcher',
            debug: result.debug
          });

          // Use pre-calculated derived metrics from StandardizedDataFetcher
          const averageCtr = stats.averageCtr || 0;
          const averageCpc = stats.averageCpc || 0;

          // 🔧 FIXED: Use pre-calculated conversion metrics from StandardizedDataFetcher
          const conversionMetrics = result.data.conversionMetrics || {
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

          console.log('🎯 DASHBOARD: Using StandardizedDataFetcher conversion metrics:', {
            reservations: conversionMetrics.reservations,
            reservation_value: conversionMetrics.reservation_value,
            click_to_call: conversionMetrics.click_to_call,
            source: 'standardized-fetcher'
          });

          // 🔍 DEBUG: Calculate total booking steps for verification
          const totalBookingSteps = 
            (conversionMetrics.click_to_call || 0) + 
            (conversionMetrics.email_contacts || 0) + 
            (conversionMetrics.booking_step_1 || 0) + 
            (conversionMetrics.booking_step_2 || 0) + 
            (conversionMetrics.booking_step_3 || 0) + 
            (conversionMetrics.reservations || 0);
          
          console.log('🔍 DASHBOARD: Total booking steps calculation:', {
            totalBookingSteps,
            statsTotalConversions: stats.totalConversions,
            difference: totalBookingSteps - stats.totalConversions
          });
                
                return {
            campaigns,
            stats: { ...stats, averageCtr, averageCpc },
            conversionMetrics,
            debug: result.debug,
            validation: result.validation
                };
              } else {
          throw new Error('Standardized fetch failed: No data returned');
        }
      } catch (error) {
        console.error('❌ DASHBOARD: Unified fetch error:', error);
        console.error('❌ DASHBOARD: Error details:', {
          errorMessage: error instanceof Error ? error.message : 'Unknown',
          errorStack: error instanceof Error ? error.stack : 'No stack',
          clientId: currentClient?.id,
          dateRange,
          provider: effectiveProvider
        });
        
        // Fallback to empty data (same as reports)
                return {
          campaigns: [],
                  stats: {
                    totalSpend: 0,
                    totalImpressions: 0,
            totalClicks: 0,
                    totalConversions: 0,
                    averageCtr: 0,
                    averageCpc: 0
                  },
                  conversionMetrics: {
            click_to_call: 0,
            email_contacts: 0,
                    booking_step_1: 0,
                    booking_step_2: 0,
                    booking_step_3: 0,
                    reservations: 0,
                    reservation_value: 0,
            roas: 0,
                    cost_per_reservation: 0
                  },
                  debug: {
            source: 'error-fallback',
            error: error instanceof Error ? error.message : 'Unknown error'
                  }
                };
        }
        
      // Default return for all code paths
        return {
          campaigns: [],
          stats: {
            totalSpend: 0,
            totalImpressions: 0,
            totalClicks: 0,
            totalConversions: 0,
            averageCtr: 0,
            averageCpc: 0
          },
          conversionMetrics: {
            click_to_call: 0,
            email_contacts: 0,
            booking_step_1: 0,
          booking_step_2: 0,
          booking_step_3: 0,
            reservations: 0,
            reservation_value: 0,
            roas: 0,
          cost_per_reservation: 0
        }
      };
    } catch (error) {
      console.error('❌ DASHBOARD: loadMainDashboardData error:', error);
        return {
          campaigns: [],
          stats: {
            totalSpend: 0,
            totalImpressions: 0,
            totalClicks: 0,
            totalConversions: 0,
            averageCtr: 0,
            averageCpc: 0
          },
          conversionMetrics: {
            click_to_call: 0,
            email_contacts: 0,
            booking_step_1: 0,
          booking_step_2: 0,
          booking_step_3: 0,
            reservations: 0,
            reservation_value: 0,
            roas: 0,
          cost_per_reservation: 0
        }
      };
    }
  };

  // 📊 FETCH PREVIOUS MONTH CONVERSION METRICS: For AnimatedMetricsCharts comparison
  const fetchPreviousMonthConversionMetrics = async (currentClient: Client) => {
    try {
      const now = new Date();
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const previousMonthStr = previousMonth.toISOString().split('T')[0];
      
      console.log('📊 FETCHING PREVIOUS MONTH CONVERSION METRICS:', {
        clientId: currentClient.id,
        clientName: currentClient.name,
        platform: activeAdsProvider,
        previousMonth: previousMonthStr,
        query: {
          table: 'campaign_summaries',
          filters: {
            client_id: currentClient.id,
            summary_type: 'monthly',
            platform: activeAdsProvider,
            summary_date: previousMonthStr
          }
        }
      });
      
      // First, let's check what data exists for this client
      const { data: allData, error: checkError } = await supabase
        .from('campaign_summaries')
        .select('*')
        .eq('client_id', currentClient.id)
        .eq('summary_type', 'monthly')
        .order('summary_date', { ascending: false })
        .limit(5);
      
      console.log('📊 ALL MONTHLY SUMMARIES FOR CLIENT:', {
        count: allData?.length || 0,
        summaries: allData?.map(d => ({
          date: d.summary_date,
          platform: d.platform,
          booking_step_1: d.booking_step_1,
          reservations: d.reservations,
          reservation_value: d.reservation_value
        }))
      });
      
      const { data, error } = await supabase
        .from('campaign_summaries')
        .select('booking_step_1, reservations, reservation_value, summary_date, platform')
        .eq('client_id', currentClient.id)
        .eq('summary_type', 'monthly')
        .eq('platform', activeAdsProvider)
        .eq('summary_date', previousMonthStr)
        .single();
      
      console.log('📊 PREVIOUS MONTH QUERY RESULT:', {
        found: !!data,
        error: error?.message,
        data: data
      });
      
      if (!error && data) {
        setPreviousMonthConversionMetrics({
          booking_step_1: data.booking_step_1 || 0,
          reservations: data.reservations || 0,
          reservation_value: data.reservation_value || 0
        });
        console.log('✅ Previous month conversion metrics loaded:', data);
      } else {
        console.warn('⚠️ No previous month data found:', {
          error: error?.message,
          searchedFor: {
            client: currentClient.id,
            platform: activeAdsProvider,
            month: previousMonthStr
          }
        });
        setPreviousMonthConversionMetrics({
          booking_step_1: 0,
          reservations: 0,
          reservation_value: 0
        });
      }
    } catch (error) {
      console.error('❌ Failed to fetch previous month conversion metrics:', error);
      setPreviousMonthConversionMetrics({
        booking_step_1: 0,
        reservations: 0,
        reservation_value: 0
      });
    }
  };

  // 📊 CALCULATE MONTH-OVER-MONTH CHANGE: For AnimatedMetricsCharts
  const calculateMonthOverMonthChange = (current: number, previous: number): number => {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  const refreshLiveData = async () => {
    if (!user || loadingRef.current || refreshingData) return;
    
    setRefreshingData(true);
    setLoadingMessage('Odświeżanie danych...');
    setLoadingProgress(25);
    
    try {
      // Clear localStorage cache to force fresh data
      clearCache();
      
      // Reload dashboard data
      await loadClientDashboard();
      
      setLoadingMessage('Dane odświeżone pomyślnie');
      setLoadingProgress(100);
      
      setTimeout(() => {
        setRefreshingData(false);
        setLoadingMessage('');
        setLoadingProgress(0);
      }, 1000);
    } catch (error) {
      console.error('Error refreshing data:', error);
      setRefreshingData(false);
      setLoadingMessage('');
      setLoadingProgress(0);
    }
  };

  // useEffect hooks and component logic
  useEffect(() => {
    if (!dashboardInitialized && user && profile && !authLoading) {
      console.log('🚀 DASHBOARD: Initializing dashboard...');
      setDashboardInitialized(true);
      loadClientDashboardWithCache();
    }
  }, [user, profile, dashboardInitialized, authLoading]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (loadingSafetyTimeout) {
        clearTimeout(loadingSafetyTimeout);
      }
    };
  }, [loadingSafetyTimeout]);

  // Auto-refresh every 5 minutes when not loading
  useEffect(() => {
    if (!loading && !refreshingData && clientData) {
      const interval = setInterval(() => {
        console.log('🔄 Auto-refresh triggered');
        loadClientDashboardWithCache();
      }, 5 * 60 * 1000); // 5 minutes

      return () => clearInterval(interval);
    }
    return undefined; // Explicit return for all code paths
  }, [loading, refreshingData, clientData]);

  // Format currency helper
  const formatCurrency = (amount: number): string => {
      return new Intl.NumberFormat('pl-PL', {
        style: 'currency',
      currency: 'PLN'
      }).format(amount);
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('pl-PL').format(num);
  };

  // Only show loading if:
  // 1. Auth is still loading (initial load)
  // 2. Dashboard data is loading AND we don't have any client data yet
  // Don't show loading if we're just refreshing data (refreshingData handles that)
  if (authLoading || (loading && !clientData)) {
    return <DashboardLoading />;
  }

    return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-6 sm:py-8" role="main" aria-label="Dashboard główny">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded-md z-50">
          Przejdź do głównej treści
        </a>
        {/* Welcome Section */}
        <WelcomeSection
          user={user}
          profile={profile}
          client={clientData?.client || selectedClient}
          isLoading={loading}
        />

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 md:mb-8 space-y-4 sm:space-y-0" id="main-content">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl font-bold text-slate-900 mb-2" id="dashboard-title">
              Dashboard
            </h1>
            <p className="text-slate-600 text-sm sm:text-base">
              Przegląd wyników kampanii reklamowych
            </p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row md:flex-row items-stretch sm:items-center space-y-3 sm:space-y-0 sm:space-x-3 md:space-x-4">
            {/* View Detailed Reports Button */}
            <button
              onClick={() => router.push('/reports')}
              className="flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 sm:px-6 md:px-8 py-3 sm:py-3 md:py-4 min-h-[44px] rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5 font-medium text-sm sm:text-base"
            >
              <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>Szczegółowe raporty</span>
            </button>

            {/* Refresh Data Button */}
            <button
              onClick={refreshLiveData}
              disabled={refreshingData}
              className="flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 disabled:bg-gray-100 text-gray-700 disabled:text-gray-400 px-4 sm:px-6 md:px-8 py-3 sm:py-3 md:py-4 min-h-[44px] rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 font-medium text-sm sm:text-base"
            >
              <RefreshCw className={`h-4 w-4 sm:h-5 sm:w-5 ${refreshingData ? 'animate-spin' : ''}`} />
              <span>{refreshingData ? 'Odświeżanie...' : 'Odśwież dane'}</span>
            </button>
            
            {/* Data Source Indicator - same as reports */}
            {dataSourceInfo.debug && (
              <div className="bg-white px-3 py-2 rounded-lg border shadow-sm">
                <DataSourceIndicator 
                  validation={dataSourceInfo.validation} 
                  debug={dataSourceInfo.debug} 
                />
                {dataSourceInfo.lastUpdated && (
                  <div className="text-xs text-slate-500 mt-1">
                    Aktualizacja: {new Date(dataSourceInfo.lastUpdated).toLocaleTimeString()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
              
        {/* Client Selector for Admin */}
        {profile?.role === 'admin' && (
          <div className="mb-8">
            <ClientSelector
              onClientChange={handleClientChange}
              currentClient={selectedClient}
              userRole={profile.role}
            />
          </div>
        )}

        {/* Data Source Diagnostic (only shown when all metrics are 0) */}
        {clientData && clientData.stats && clientData.stats.totalSpend === 0 && clientData.stats.totalClicks === 0 && clientData.stats.totalImpressions === 0 && (
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6 mb-6 shadow-lg">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-yellow-900 mb-2">
                  Brak danych dla bieżącego okresu
                </h3>
                <p className="text-yellow-800 text-sm mb-3">
                  Dashboard nie wyświetla danych, ponieważ system nie znalazł informacji o kampaniach dla wybranego okresu.
                </p>
                {dataSourceInfo.debug && (
                  <div className="bg-yellow-100 rounded-lg p-4 mt-3">
                    <p className="text-xs font-mono text-yellow-900 mb-2">
                      <strong>Źródło danych:</strong> {dataSourceInfo.debug.source || 'unknown'}
                    </p>
                    <p className="text-xs font-mono text-yellow-900">
                      <strong>Przyczyna:</strong> {dataSourceInfo.debug.reason || 'No reason provided'}
                    </p>
                  </div>
                )}
                <div className="mt-4 space-y-2 text-sm text-yellow-800">
                  <p><strong>Możliwe przyczyny:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Brak danych w tabeli <code className="bg-yellow-200 px-1 rounded">daily_kpi_data</code> dla bieżącego miesiąca</li>
                    <li>System wciąż zbiera dane z Meta Ads API</li>
                    <li>Cache systemowy jest pusty i wymaga odświeżenia</li>
                    <li>Brak aktywnych kampanii w wybranym okresie</li>
                  </ul>
                </div>
                <div className="mt-4 pt-4 border-t border-yellow-300">
                  <p className="text-sm text-yellow-900 mb-2">
                    <strong>Zalecane działania:</strong>
                  </p>
                  <ol className="list-decimal list-inside space-y-1 ml-2 text-sm text-yellow-800">
                    <li>Sprawdź czy w tabeli <code className="bg-yellow-200 px-1 rounded">daily_kpi_data</code> są dane dla {getCurrentMonthInfo().periodId}</li>
                    <li>Zweryfikuj czy klient ma skonfigurowany dostęp do Meta Ads API</li>
                    <li>Użyj przycisku "Odśwież dane" aby wymusić ponowne pobranie</li>
                    <li>Sprawdź stronę raportów - jeśli tam też są 0, to problem jest w źródle danych</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Dashboard Content */}
        {clientData && clientData.stats && (
          <div className="space-y-8">
            {/* Key Metrics Cards */}
            <div className="flex justify-center">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 max-w-6xl w-full" role="region" aria-labelledby="metrics-heading">
              <h2 id="metrics-heading" className="sr-only">Kluczowe metryki kampanii</h2>
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1" role="article" aria-labelledby="spend-metric" key={`spend-${renderKey}-${activeAdsProvider}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-semibold text-slate-600 uppercase tracking-wide" id="spend-metric">
                    Wydatki {activeAdsProvider === 'google' && <span className="text-xs">(Google)</span>}
                  </div>
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Target className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                  {(() => {
                    console.log('💰 DASHBOARD: Rendering Spend:', {
                      provider: activeAdsProvider,
                      spend: clientData.stats.totalSpend,
                      formatted: formatCurrency(clientData.stats.totalSpend)
                    });
                    return formatCurrency(clientData.stats.totalSpend);
                  })()}
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  Bieżący miesiąc
                </div>
              </div>
              
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1" role="article" aria-labelledby="impressions-metric" key={`impressions-${renderKey}-${activeAdsProvider}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-semibold text-slate-600 uppercase tracking-wide" id="impressions-metric">
                    Wyświetlenia {activeAdsProvider === 'google' && <span className="text-xs">(Google)</span>}
                  </div>
                  <div className="p-2 bg-green-100 rounded-lg">
                    <ArrowUpRight className="h-5 w-5 text-green-600" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                  {(() => {
                    console.log('👁️ DASHBOARD: Rendering Impressions:', {
                      provider: activeAdsProvider,
                      impressions: clientData.stats.totalImpressions,
                      formatted: formatNumber(clientData.stats.totalImpressions)
                    });
                    return formatNumber(clientData.stats.totalImpressions);
                  })()}
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  Bieżący miesiąc
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1" role="article" aria-labelledby="clicks-metric" key={`clicks-${renderKey}-${activeAdsProvider}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-semibold text-slate-600 uppercase tracking-wide" id="clicks-metric">
                    Kliknięcia {activeAdsProvider === 'google' && <span className="text-xs">(Google)</span>}
                  </div>
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Target className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                  {(() => {
                    console.log('🖱️ DASHBOARD: Rendering Clicks:', {
                      provider: activeAdsProvider,
                      clicks: clientData.stats.totalClicks,
                      formatted: formatNumber(clientData.stats.totalClicks)
                    });
                    return formatNumber(clientData.stats.totalClicks);
                  })()}
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  Bieżący miesiąc
                </div>
              </div>
              
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1" role="article" aria-labelledby="conversions-metric" key={`conversions-card-${renderKey}-${activeAdsProvider}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-semibold text-slate-600 uppercase tracking-wide" id="conversions-metric">
                    Konwersje {activeAdsProvider === 'google' && <span className="text-xs">(Google)</span>}
                  </div>
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Target className="h-5 w-5 text-orange-600" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums" key={`conversions-value-${renderKey}-${activeAdsProvider}`}>
                  {(() => {
                    const allBookingSteps = 
                      (clientData.conversionMetrics.click_to_call || 0) + 
                      (clientData.conversionMetrics.email_contacts || 0) + 
                      (clientData.conversionMetrics.booking_step_1 || 0) + 
                      (clientData.conversionMetrics.booking_step_2 || 0) + 
                      (clientData.conversionMetrics.booking_step_3 || 0) + 
                      (clientData.conversionMetrics.reservations || 0);
                    
                    console.log('🎯 DASHBOARD DISPLAY: Rendering conversions:', {
                      provider: activeAdsProvider,
                      allBookingSteps,
                      formatted: formatNumber(allBookingSteps),
                      renderKey,
                      timestamp: Date.now(),
                      conversionMetrics: clientData.conversionMetrics
                    });
                    
                    return formatNumber(allBookingSteps);
                  })()}
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  Bieżący miesiąc
                </div>
              </div>
              </div>
            </div>

            {/* Platform Toggle */}
            <div className="flex justify-center" role="region" aria-labelledby="platform-toggle-heading">
              <h3 id="platform-toggle-heading" className="sr-only">Wybór platformy reklamowej</h3>
              <div className="flex bg-gray-100/50 rounded-xl p-1 w-full sm:w-auto max-w-md" role="tablist" aria-label="Wybór platformy reklamowej">
                <button
                  onClick={() => handleTabSwitch('meta')}
                  className={`flex-1 sm:flex-none px-6 md:px-8 py-3 min-h-[44px] rounded-lg text-sm md:text-base font-medium transition-all duration-200 ${
                    activeAdsProvider === 'meta'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  disabled={!(clientData.client.meta_access_token && clientData.client.ad_account_id)}
                  role="tab"
                  aria-selected={activeAdsProvider === 'meta'}
                  aria-controls="platform-content"
                  aria-label="Przełącz na dane Meta Ads"
                >
                  Meta Ads
                </button>
                <button
                  onClick={() => handleTabSwitch('google')}
                  className={`flex-1 sm:flex-none px-6 md:px-8 py-3 min-h-[44px] rounded-lg text-sm md:text-base font-medium transition-all duration-200 ${
                    activeAdsProvider === 'google'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  disabled={!(clientData.client.google_ads_enabled && clientData.client.google_ads_customer_id)}
                  role="tab"
                  aria-selected={activeAdsProvider === 'google'}
                  aria-controls="platform-content"
                  aria-label="Przełącz na dane Google Ads"
                >
                  Google Ads
                </button>
              </div>
            </div>

            {/* Performance Charts Section */}
            <div id="platform-content" role="tabpanel" aria-labelledby={`${activeAdsProvider}-tab`}>
            {activeAdsProvider === 'meta' ? (
              <MetaPerformanceLive
                clientId={clientData.client.id}
                currency="PLN"
                sharedData={clientData}
              />
            ) : (
              <GoogleAdsPerformanceLive
                clientId={clientData.client.id}
                currency="PLN"
                sharedData={{
                  stats: clientData.stats,
                  conversionMetrics: {
                    form_submissions: clientData.conversionMetrics.booking_step_1,
                    phone_calls: clientData.conversionMetrics.click_to_call,
                    email_clicks: clientData.conversionMetrics.email_contacts,
                    phone_clicks: clientData.conversionMetrics.click_to_call,
                    booking_step_1: clientData.conversionMetrics.booking_step_1,
                    booking_step_2: clientData.conversionMetrics.booking_step_2,
                    booking_step_3: clientData.conversionMetrics.booking_step_3,
                    reservations: clientData.conversionMetrics.reservations,
                    reservation_value: clientData.conversionMetrics.reservation_value,
                    cost_per_reservation: clientData.conversionMetrics.cost_per_reservation
                  },
                  debug: clientData.debug,
                  lastUpdated: clientData.lastUpdated
                }}
              />
            )}
            </div>

            {/* Conversion Metrics Section */}
            <AnimatedMetricsCharts
              leads={{
                current: clientData.conversionMetrics.booking_step_1,
                previous: previousMonthConversionMetrics.booking_step_1,
                change: calculateMonthOverMonthChange(
                  clientData.conversionMetrics.booking_step_1,
                  previousMonthConversionMetrics.booking_step_1
                )
              }}
              reservations={{
                current: clientData.conversionMetrics.reservations,
                previous: previousMonthConversionMetrics.reservations,
                change: calculateMonthOverMonthChange(
                  clientData.conversionMetrics.reservations,
                  previousMonthConversionMetrics.reservations
                )
              }}
              reservationValue={{
                current: clientData.conversionMetrics.reservation_value,
                previous: previousMonthConversionMetrics.reservation_value,
                change: calculateMonthOverMonthChange(
                  clientData.conversionMetrics.reservation_value,
                  previousMonthConversionMetrics.reservation_value
                )
              }}
              isLoading={loading}
            />

          </div>
        )}

        {/* Empty State */}
        {!clientData && !loading && (
          <div className="text-center py-20">
            <AlertCircle className="h-16 w-16 text-gray-300 mx-auto mb-6" />
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              Brak danych do wyświetlenia
            </h3>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              Nie znaleziono danych dla wybranego klienta lub okresu.
            </p>
            <button
              onClick={refreshLiveData}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
            >
              Spróbuj ponownie
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
