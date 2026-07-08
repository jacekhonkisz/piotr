'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  Building2,
  CalendarDays,
  RefreshCw,
  AlertCircle,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../components/AuthProvider';
import { supabase } from '../../lib/supabase';

import type { Database } from '../../lib/database.types';
import { DashboardLoading } from '../../components/LoadingSpinner';
import {
  buildGoogleMetricSnapshot,
  buildMetaMetricSnapshot,
} from '../../lib/metric-snapshot';
import { StandardizedDataFetcher } from '../../lib/standardized-data-fetcher';
import {
  getDefaultAdsProvider,
  hasGoogleAds,
  hasMetaAds,
} from '../../lib/ads-provider-utils';
import ClientSelector from '../../components/ClientSelector';
import ConfiguredDashboardMetrics from '../../components/dashboard/ConfiguredDashboardMetrics';


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
  /** dyn_meta_* / dyn_google_* counts aligned with metrics config (from API) */
  dynamicMetricValues?: Record<string, number>;
}

interface CachedData {
  data: ClientDashboardData;
  timestamp: number;
  dataSource: 'cache' | 'stale-cache' | 'live-api-cached' | 'database';
}

interface PreviousYearSnapshotState {
  clientId: string;
  platform: 'meta' | 'google';
  start: string;
  end: string;
  snapshot: Record<string, number>;
}

interface DashboardPeriod {
  current: { start: string; end: string; label: string; monthLabel: string };
  previousMonth: { start: string; end: string; label: string };
  previousYear: { start: string; end: string; label: string };
}

interface PreviousMonthSnapshotState {
  clientId: string;
  platform: 'meta' | 'google';
  start: string;
  end: string;
  snapshot: Record<string, number>;
}

const MONTH_NAMES = [
  'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
  'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'
];

const MONTH_NAMES_GENITIVE = [
  'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
  'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'
];

const pad2 = (value: number) => String(value).padStart(2, '0');

const toIsoDate = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const getDaysInMonth = (year: number, monthIndex: number) =>
  new Date(year, monthIndex + 1, 0).getDate();

const formatPeriodLabel = (start: Date, end: Date) => {
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.getDate()}-${end.getDate()} ${MONTH_NAMES_GENITIVE[end.getMonth()]} ${end.getFullYear()}`;
  }

  return `${start.getDate()} ${MONTH_NAMES_GENITIVE[start.getMonth()]} ${start.getFullYear()} - ${end.getDate()} ${MONTH_NAMES_GENITIVE[end.getMonth()]} ${end.getFullYear()}`;
};

const getDashboardPeriod = (reference = new Date()): DashboardPeriod => {
  const year = reference.getFullYear();
  const monthIndex = reference.getMonth();
  const day = reference.getDate();
  const currentStart = new Date(year, monthIndex, 1);
  const currentEnd = new Date(year, monthIndex, day);
  const previousYear = year - 1;
  const previousYearEndDay = Math.min(day, getDaysInMonth(previousYear, monthIndex));
  const previousYearStart = new Date(previousYear, monthIndex, 1);
  const previousYearEnd = new Date(previousYear, monthIndex, previousYearEndDay);
  const previousMonthIndex = monthIndex === 0 ? 11 : monthIndex - 1;
  const previousMonthYear = monthIndex === 0 ? year - 1 : year;
  const previousMonthStart = new Date(previousMonthYear, previousMonthIndex, 1);
  const previousMonthEnd = new Date(previousMonthYear, previousMonthIndex + 1, 0);

  return {
    current: {
      start: toIsoDate(currentStart),
      end: toIsoDate(currentEnd),
      label: formatPeriodLabel(currentStart, currentEnd),
      monthLabel: `${MONTH_NAMES[monthIndex]} ${year}`,
    },
    previousMonth: {
      start: toIsoDate(previousMonthStart),
      end: toIsoDate(previousMonthEnd),
      label: formatPeriodLabel(previousMonthStart, previousMonthEnd),
    },
    previousYear: {
      start: toIsoDate(previousYearStart),
      end: toIsoDate(previousYearEnd),
      label: formatPeriodLabel(previousYearStart, previousYearEnd),
    },
  };
};

const safeNumber = (value: unknown): number | null => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [clientData, setClientData] = useState<ClientDashboardData | null>(null);
  const [refreshingData, setRefreshingData] = useState(false);
  const [, setDataSource] = useState<string>('database');
  const [dashboardInitialized, setDashboardInitialized] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [, setLoadingMessage] = useState('Ładowanie dashboardu...');
  const [, setLoadingProgress] = useState(0);
  const [activeAdsProvider, setActiveAdsProvider] = useState<'meta' | 'google'>('google');
  const [loadingSafetyTimeout, setLoadingSafetyTimeout] = useState<NodeJS.Timeout | null>(null);
  const [renderKey, setRenderKey] = useState(0);
  
  // 🔧 DATA SOURCE VALIDATION: Track data source information for debugging (same as reports)
  const [dataSourceInfo, setDataSourceInfo] = useState<{
    validation?: any;
    debug?: any;
    lastUpdated?: string;
  }>({});

  // Same-period-last-year snapshot for the executive YoY comparison.
  const [previousYearSnapshotState, setPreviousYearSnapshotState] = useState<PreviousYearSnapshotState | null>(null);
  const [previousMonthSnapshotState, setPreviousMonthSnapshotState] = useState<PreviousMonthSnapshotState | null>(null);
  const previousMonthSnapshotRequestRef = useRef(0);

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
    setPreviousYearSnapshotState(null);
    
    // 🔧 FIX: Clear old data immediately to prevent showing stale numbers
    // This fixes the issue where old data flashes before new data loads
    if (clientData) {
      setClientData(prev => ({
        ...prev!,
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
        
        fetchPreviousYearComparisonSnapshot(currentClient, provider);
        fetchPreviousMonthComparisonSnapshot(currentClient, provider);
      }
    }
    
    setRefreshingData(false);
  };

  // Google Ads campaigns data will be loaded from clientData.campaigns when activeAdsProvider is 'google'

  const { user, profile, authLoading, signOut } = useAuth();
  const router = useRouter();
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);
  const previousYearSnapshotRequestRef = useRef(0);
  const dashboardPeriod = useMemo(() => getDashboardPeriod(), []);

  const metricsClientId = clientData?.client?.id || selectedClient?.id || null;

  const currentMonthSnapshot = useMemo(() => {
    if (!clientData?.stats || clientData.conversionMetrics == null) return {};
    const dyn = clientData.dynamicMetricValues;
    return activeAdsProvider === 'google'
      ? buildGoogleMetricSnapshot(clientData.stats, clientData.conversionMetrics as any, dyn)
      : buildMetaMetricSnapshot(clientData.stats, clientData.conversionMetrics as any, dyn);
  }, [
    clientData?.stats,
    clientData?.conversionMetrics,
    clientData?.dynamicMetricValues,
    activeAdsProvider,
  ]);

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
    
    // 🔧 CRITICAL FIX: Reset ALL loading states BEFORE switching clients
    // This prevents any blocking from previous operations
    loadingRef.current = false;
    setRefreshingData(false);
    
    // 🔧 CRITICAL FIX: Clear API call trackers to ensure fresh data load
    if ((window as any).apiCallTracker) {
      (window as any).apiCallTracker = {};
      console.log('🧹 Cleared ALL API call trackers for client switch');
    }
    
    // 🔧 CRITICAL FIX: Clear old clientData immediately to prevent stale values showing
    setClientData(null);
    
    // Now set the new client and loading states
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
    
    const defaultProvider = getDefaultAdsProvider(client);
    console.log('🔍 CLIENT TAB SELECTION:', {
      clientName: client.name,
      hasMetaAds: hasMetaAds(client),
      hasGoogleAds: hasGoogleAds(client),
      defaultProvider,
    });
    setActiveAdsProvider(defaultProvider);
    
    // Clear cache for the new client to ensure fresh data
    clearCache();
    
    try {
      setLoadingMessage('Pobieranie danych z API...');
      setLoadingProgress(50);
      
      // Load data for the new client
      const mainDashboardData = await loadMainDashboardData(client, defaultProvider);
      
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
        dynamicMetricValues: mainDashboardData?.dynamicMetricValues,
        // Add debug info for components
        debug: mainDashboardData?.debug || { source: 'fallback', reason: 'No data loaded' },
        lastUpdated: new Date().toISOString()
      };

      setClientData(dashboardData);
      setDataSource(mainDashboardData?.debug?.source || 'database');
      
      fetchPreviousYearComparisonSnapshot(client);
      fetchPreviousMonthComparisonSnapshot(client);
      
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
            
            // Fetch same-period-last-year comparison even when using cache
            if (cacheData.data?.client) {
              fetchPreviousYearComparisonSnapshot(cacheData.data.client);
              fetchPreviousMonthComparisonSnapshot(cacheData.data.client);
            }
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

      const defaultProvider = getDefaultAdsProvider(clientData);
      setActiveAdsProvider(defaultProvider);

      const mainDashboardData = await loadMainDashboardData(clientData, defaultProvider);
      
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
        },
        dynamicMetricValues: mainDashboardData?.dynamicMetricValues,
      };

      setClientData(dashboardData);
      setDataSource('live-api-cached');
      setLoading(false); // 🔧 FIX: Properly set loading to false
      
      // Force re-render to ensure display updates
      setRenderKey(prev => prev + 1);
      
      fetchPreviousYearComparisonSnapshot(clientData);
      fetchPreviousMonthComparisonSnapshot(clientData);
      
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

      // Canonical contract v1 (Meta): clicks = inline_link_clicks ?? clicks.
      // Matches Meta Business Suite "Link clicks" — what clients see in Ads Manager.
      const stats = (pastCampaigns || []).reduce((acc, campaign: any) => {
        acc.totalSpend += campaign.spend || 0;
        acc.totalImpressions += campaign.impressions || 0;
        acc.totalClicks += Number(campaign.inline_link_clicks ?? campaign.clicks ?? 0);
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
      const dateRange = {
        start: dashboardPeriod.current.start,
        end: dashboardPeriod.current.end
      };
      
      console.log('📅 Dashboard using month-to-date date range:', {
        dateRange,
        cacheFirst
      });
      
      // 🔧 REMOVED: Authentication check - not required for this project
      // Dashboard will use StandardizedDataFetcher without authentication

      const clientHasMetaAds = hasMetaAds(currentClient);
      const clientHasGoogleAds = hasGoogleAds(currentClient);

      console.log('🔍 DASHBOARD: Client configuration check:', {
        clientId: currentClient.id,
        hasMetaAds: clientHasMetaAds,
        hasGoogleAds: clientHasGoogleAds,
        activeProvider: activeAdsProvider,
        forceProvider,
      });

      let effectiveProvider = forceProvider || activeAdsProvider;

      if (clientHasMetaAds && !clientHasGoogleAds) {
        effectiveProvider = 'meta';
        setActiveAdsProvider('meta');
      } else if (clientHasGoogleAds && !clientHasMetaAds) {
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
                // 🔧 FIX: Pass the dashboard period explicitly. Without it the API
                // defaulted to "last 30 days", showing different numbers after a
                // tab switch than after a fresh load (month-to-date).
                dateRange,
                reason: 'standardized-dashboard-tab-switch',
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
            dynamicMetricValues: (result.data as { dynamicMetricValues?: Record<string, number> })
              ?.dynamicMetricValues,
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
                  dynamicMetricValues: {},
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
        },
        dynamicMetricValues: {},
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
        },
        dynamicMetricValues: {},
      };
    }
  };

  const fetchPreviousMonthComparisonSnapshot = async (currentClient: Client, platform?: 'meta' | 'google') => {
    const resolvedPlatform = platform || activeAdsProvider;
    const requestId = previousMonthSnapshotRequestRef.current + 1;
    previousMonthSnapshotRequestRef.current = requestId;
    setPreviousMonthSnapshotState(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const qs = new URLSearchParams({
        clientId: currentClient.id,
        platform: resolvedPlatform,
        start: dashboardPeriod.previousMonth.start,
        end: dashboardPeriod.previousMonth.end,
      });
      const res = await fetch(`/api/metrics-snapshot?${qs.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (requestId !== previousMonthSnapshotRequestRef.current) {
        return;
      }
      if (data.success && data.snapshot && typeof data.snapshot === 'object' && Object.keys(data.snapshot).length > 0) {
        setPreviousMonthSnapshotState({
          clientId: currentClient.id,
          platform: resolvedPlatform,
          start: dashboardPeriod.previousMonth.start,
          end: dashboardPeriod.previousMonth.end,
          snapshot: data.snapshot as Record<string, number>,
        });
      } else {
        setPreviousMonthSnapshotState(null);
      }
    } catch (error) {
      console.error('❌ Failed to fetch previous month metrics snapshot:', error);
      if (requestId === previousMonthSnapshotRequestRef.current) {
        setPreviousMonthSnapshotState(null);
      }
    }
  };

  const fetchPreviousYearComparisonSnapshot = async (currentClient: Client, platform?: 'meta' | 'google') => {
    const resolvedPlatform = platform || activeAdsProvider;
    const requestId = previousYearSnapshotRequestRef.current + 1;
    previousYearSnapshotRequestRef.current = requestId;
    setPreviousYearSnapshotState(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const qs = new URLSearchParams({
        clientId: currentClient.id,
        platform: resolvedPlatform,
        start: dashboardPeriod.previousYear.start,
        end: dashboardPeriod.previousYear.end,
      });
      const res = await fetch(`/api/metrics-snapshot?${qs.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (requestId !== previousYearSnapshotRequestRef.current) {
        return;
      }
      if (data.success && data.snapshot && typeof data.snapshot === 'object' && Object.keys(data.snapshot).length > 0) {
        setPreviousYearSnapshotState({
          clientId: currentClient.id,
          platform: resolvedPlatform,
          start: dashboardPeriod.previousYear.start,
          end: dashboardPeriod.previousYear.end,
          snapshot: data.snapshot as Record<string, number>,
        });
      } else {
        setPreviousYearSnapshotState(null);
      }
    } catch (error) {
      console.error('❌ Failed to fetch previous year metrics snapshot:', error);
      if (requestId === previousYearSnapshotRequestRef.current) {
        setPreviousYearSnapshotState(null);
      }
    }
  };

  const refreshLiveData = async () => {
    const currentClient = selectedClient || clientData?.client || null;
    console.log('🔄🔄🔄 REFRESH FUNCTION CALLED - FIRST LINE 🔄🔄🔄');
    console.log('🔄 REFRESH BUTTON CLICKED:', {
      hasUser: !!user,
      loadingRef: loadingRef.current,
      refreshingData,
      hasSelectedClient: !!currentClient,
      selectedClientId: currentClient?.id,
      timestamp: new Date().toISOString()
    });
    
    if (!user || loadingRef.current || refreshingData || !currentClient) {
      console.log('❌ REFRESH BLOCKED:', {
        noUser: !user,
        loading: loadingRef.current,
        alreadyRefreshing: refreshingData,
        noClient: !currentClient
      });
      return;
    }
    
    setRefreshingData(true);
    setLoadingMessage('Odświeżanie danych z API...');
    setLoadingProgress(25);
    console.log('✅ REFRESH STARTED');
    
    try {
      // Clear localStorage cache
      clearCache();
      
      setLoadingProgress(50);
      setLoadingMessage('Pobieranie świeżych danych z API...');
      
      const dateRange = {
        start: dashboardPeriod.current.start,
        end: dashboardPeriod.current.end
      };
      
      // Get session token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      // Force live API fetch and database update for both platforms
      const hasMetaAds = currentClient.meta_access_token && currentClient.ad_account_id;
      const hasGoogleAds = currentClient.google_ads_enabled && currentClient.google_ads_customer_id;
      
      const refreshPromises: Promise<any>[] = [];
      
      // Force refresh Google Ads if configured
      if (hasGoogleAds) {
        console.log('🔄 REFRESH: Calling Google Ads API with:', {
          clientId: currentClient.id,
          dateRange,
          hasSessionToken: !!session?.access_token
        });
        setLoadingMessage('Pobieranie danych Google Ads z API...');
        const googleRefreshPromise = fetch('/api/fetch-google-ads-live-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            clientId: currentClient.id,
            dateRange,
            forceFresh: true, // Force live API fetch (bypasses database and cache)
            bypassAllCache: true, // Bypass all caches
            clearCache: true, // Clear cache before fetching
            reason: 'dashboard-refresh-button' // ✅ Mark as refresh button request
          })
        }).then(async response => {
          console.log('📡 Google Ads API Response:', {
            status: response.status,
            ok: response.ok,
            statusText: response.statusText
          });
          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Google Ads API Error:', errorText);
            throw new Error(`Google Ads refresh failed: ${response.status} - ${errorText}`);
          }
          const json = await response.json();
          console.log('✅ Google Ads API Success:', {
            success: json.success,
            hasData: !!json.data,
            campaignCount: json.data?.campaigns?.length || 0,
            totalConversions: json.data?.stats?.totalConversions || 0
          });
          return json;
        }).catch(error => {
          console.error('❌ Google Ads Refresh Error:', error);
          throw error;
        });
        refreshPromises.push(googleRefreshPromise);
      }
      
      // Force refresh Meta Ads if configured
      if (hasMetaAds) {
        console.log('🔄 REFRESH: Calling Meta Ads API with:', {
          clientId: currentClient.id,
          dateRange,
          hasSessionToken: !!session?.access_token
        });
        setLoadingMessage('Pobieranie danych Meta Ads z API...');
        const metaRefreshPromise = fetch('/api/fetch-live-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            clientId: currentClient.id,
            dateRange,
            forceFresh: true, // Force live API fetch
            bypassAllCache: true, // Bypass all caches
            clearCache: true, // Clear cache before fetching
            reason: 'dashboard-refresh-button' // ✅ Mark as refresh button request
          })
        }).then(async response => {
          console.log('📡 Meta Ads API Response:', {
            status: response.status,
            ok: response.ok,
            statusText: response.statusText
          });
          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Meta Ads API Error:', errorText);
            throw new Error(`Meta Ads refresh failed: ${response.status} - ${errorText}`);
          }
          const json = await response.json();
          console.log('✅ Meta Ads API Success:', {
            success: json.success,
            hasData: !!json.data,
            campaignCount: json.data?.campaigns?.length || 0
          });
          return json;
        }).catch(error => {
          console.error('❌ Meta Ads Refresh Error:', error);
          throw error;
        });
        refreshPromises.push(metaRefreshPromise);
      }
      
      // Wait for all API calls to complete
      console.log('⏳ REFRESH: Waiting for API calls to complete...', {
        promiseCount: refreshPromises.length
      });
      const refreshResults = await Promise.allSettled(refreshPromises);
      
      console.log('📊 REFRESH: API calls completed:', {
        total: refreshResults.length,
        fulfilled: refreshResults.filter(r => r.status === 'fulfilled').length,
        rejected: refreshResults.filter(r => r.status === 'rejected').length
      });
      
      // Check if any refresh failed
      const failedRefreshes = refreshResults.filter(r => r.status === 'rejected');
      if (failedRefreshes.length > 0) {
        console.error('❌ REFRESH: Some refresh calls failed:', failedRefreshes);
        failedRefreshes.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.error(`  Failed ${index}:`, result.reason);
          }
        });
        // Don't zero out data - just show warning
        setLoadingMessage('Część danych nie została odświeżona');
      } else {
        console.log('✅ REFRESH: All API calls succeeded');
      }
      
      setLoadingProgress(75);
      setLoadingMessage('Aktualizowanie dashboardu...');
      
      // Wait a moment for database/cache to update after API calls
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Clear localStorage cache to force fresh load
      clearCache();
      
      const freshData = await loadMainDashboardData(currentClient, activeAdsProvider, false);
      setClientData(prev => ({
        ...prev!,
        campaigns: freshData.campaigns || prev?.campaigns || [],
        stats: freshData.stats || prev?.stats,
        conversionMetrics: freshData.conversionMetrics || prev?.conversionMetrics,
        dynamicMetricValues: freshData.dynamicMetricValues || prev?.dynamicMetricValues,
        debug: freshData.debug || prev?.debug,
        validation: freshData.validation || prev?.validation,
        lastUpdated: new Date().toISOString()
      }));
      fetchPreviousYearComparisonSnapshot(currentClient, activeAdsProvider);
      fetchPreviousMonthComparisonSnapshot(currentClient, activeAdsProvider);
      setRenderKey(prev => prev + 1);
      
      setLoadingMessage('Dane odświeżone pomyślnie');
      setLoadingProgress(100);
      
      setTimeout(() => {
        setRefreshingData(false);
        setLoadingMessage('');
        setLoadingProgress(0);
      }, 1000);
    } catch (error) {
      console.error('Error refreshing data:', error);
      // Don't zero out data on error - keep existing data
      setLoadingMessage('Błąd podczas odświeżania - dane nie zostały zmienione');
      setRefreshingData(false);
      setTimeout(() => {
      setLoadingMessage('');
      setLoadingProgress(0);
      }, 2000);
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
  const activeClient = clientData?.client || selectedClient;
  const clientName = activeClient?.name || 'Dashboard';
  const lastUpdatedLabel = dataSourceInfo.lastUpdated || clientData?.lastUpdated;
  const previousYearSnapshot =
    previousYearSnapshotState &&
    activeClient &&
    previousYearSnapshotState.clientId === activeClient.id &&
    previousYearSnapshotState.platform === activeAdsProvider &&
    previousYearSnapshotState.start === dashboardPeriod.previousYear.start &&
    previousYearSnapshotState.end === dashboardPeriod.previousYear.end
      ? previousYearSnapshotState.snapshot
      : null;

  const previousMonthSnapshot =
    previousMonthSnapshotState &&
    activeClient &&
    previousMonthSnapshotState.clientId === activeClient.id &&
    previousMonthSnapshotState.platform === activeAdsProvider &&
    previousMonthSnapshotState.start === dashboardPeriod.previousMonth.start &&
    previousMonthSnapshotState.end === dashboardPeriod.previousMonth.end
      ? previousMonthSnapshotState.snapshot
      : null;

  // Header subtitle mirrors the comparison mode chosen inside
  // <ConfiguredDashboardMetrics />: prefer prior-year, otherwise prior-month.
  const previousYearSpend = previousYearSnapshot
    ? safeNumber(previousYearSnapshot.totalSpend)
    : null;
  const previousMonthSpend = previousMonthSnapshot
    ? safeNumber(previousMonthSnapshot.totalSpend)
    : null;
  const headerComparisonMode: 'year' | 'month' | 'none' =
    previousYearSnapshot !== null && previousYearSpend !== null && previousYearSpend > 0
      ? 'year'
      : previousMonthSnapshot !== null && previousMonthSpend !== null && previousMonthSpend > 0
      ? 'month'
      : 'none';

  // Only show loading if:
  // 1. Auth is still loading (initial load)
  // 2. Dashboard data is loading AND we don't have any client data yet
  // Don't show loading if we're just refreshing data (refreshingData handles that)
  if (authLoading || (loading && !clientData)) {
    return <DashboardLoading />;
  }

  return (
    <div className="min-h-screen bg-[#f5f8fc]">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8" role="main" aria-label="Dashboard główny">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded-md z-50">
          Przejdź do głównej treści
        </a>

        <header className="mb-8 flex flex-col gap-3 border-b border-slate-200/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-200">
              {activeClient?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={activeClient.logo_url} alt={`${clientName} logo`} className="h-full w-full object-contain p-1.5" />
              ) : (
                <Building2 className="h-5 w-5 text-slate-500" />
              )}
            </div>
            <div>
              <p className="text-base font-semibold text-slate-950">{clientName}</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={refreshLiveData}
              disabled={refreshingData}
              className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshingData ? 'animate-spin' : ''}`} />
              {refreshingData ? 'Odświeżanie...' : 'Odśwież'}
            </button>
            <button
              onClick={() => router.push('/reports')}
              className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl bg-[#062b6f] px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-950/10 transition hover:bg-[#05255f]"
            >
              <BarChart3 className="h-4 w-4" />
              <span>Szczegółowe raporty</span>
            </button>
            {profile && (
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
              >
                <LogOut className="h-4 w-4" />
                Wyloguj
              </button>
            )}
          </div>
        </header>
              
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

        {clientData && clientData.stats && (
          <div className="space-y-6" id="main-content">
            <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Dashboard</h1>
                <p className="mt-2 text-sm font-medium text-slate-500">
                  {headerComparisonMode === 'year'
                    ? 'Bieżący miesiąc do dziś · porównanie rok do roku'
                    : headerComparisonMode === 'month'
                    ? 'Bieżący miesiąc do dziś · porównanie z poprzednim miesiącem'
                    : 'Bieżący miesiąc do dziś'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {headerComparisonMode === 'year'
                    ? `${dashboardPeriod.current.label} vs ${dashboardPeriod.previousYear.label}`
                    : headerComparisonMode === 'month'
                    ? `${dashboardPeriod.current.label} vs ${dashboardPeriod.previousMonth.label}`
                    : dashboardPeriod.current.label}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="inline-flex rounded-2xl bg-slate-100/80 p-1 ring-1 ring-slate-200/80" role="tablist" aria-label="Wybór platformy reklamowej">
                  <button
                    type="button"
                    onClick={() => handleTabSwitch('meta')}
                    disabled={!(clientData.client.meta_access_token && clientData.client.ad_account_id)}
                    className={`rounded-xl px-6 py-3 text-sm font-semibold transition ${
                      activeAdsProvider === 'meta'
                        ? 'bg-[#062b6f] text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40'
                    }`}
                    role="tab"
                    aria-selected={activeAdsProvider === 'meta'}
                  >
                    Meta Ads
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabSwitch('google')}
                    disabled={!(clientData.client.google_ads_enabled && clientData.client.google_ads_customer_id)}
                    className={`rounded-xl px-6 py-3 text-sm font-semibold transition ${
                      activeAdsProvider === 'google'
                        ? 'bg-[#062b6f] text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40'
                    }`}
                    role="tab"
                    aria-selected={activeAdsProvider === 'google'}
                  >
                    Google Ads
                  </button>
                </div>
                <div className="inline-flex min-h-[46px] items-center gap-2 rounded-2xl bg-white/80 px-5 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200/80">
                  <CalendarDays className="h-4 w-4 text-slate-500" />
                  {dashboardPeriod.current.monthLabel}
                </div>
              </div>
            </section>

            <section className="flex justify-end text-sm text-slate-500">
              {lastUpdatedLabel && (
                <span>Ostatnia aktualizacja: {new Date(lastUpdatedLabel).toLocaleString('pl-PL')}</span>
              )}
            </section>

            {metricsClientId && (
              <ConfiguredDashboardMetrics
                clientId={metricsClientId}
                platform={activeAdsProvider}
                currentSnapshot={currentMonthSnapshot}
                previousMonthSnapshot={previousMonthSnapshot}
                previousYearSnapshot={previousYearSnapshot}
                periodLabel={dashboardPeriod.current.label}
                previousYearLabel={dashboardPeriod.previousYear.label}
                previousMonthLabel={dashboardPeriod.previousMonth.label}
                isLoading={refreshingData}
                renderKey={renderKey}
                onOpenReports={() => router.push('/reports')}
              />
            )}
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
              type="button"
              onClick={(e) => {
                console.log('🔴 RETRY BUTTON CLICKED');
                e.preventDefault();
                e.stopPropagation();
                refreshLiveData();
              }}
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
