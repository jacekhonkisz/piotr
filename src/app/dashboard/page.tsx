'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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

import AnimatedMetricsCharts from '../../components/AnimatedMetricsCharts';
import MetaPerformanceLive from '../../components/MetaPerformanceLive';
import GoogleAdsPerformanceLive from '../../components/GoogleAdsPerformanceLive';


import ClientSelector from '../../components/ClientSelector';


type Client = Database['public']['Tables']['clients']['Row'];
type Report = Database['public']['Tables']['reports']['Row'];
type Campaign = Database['public']['Tables']['campaigns']['Row'];

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
  debug?: any;
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
  const [dataSource, setDataSource] = useState<'cache' | 'stale-cache' | 'live-api-cached' | 'database'>('database');
  const [dashboardInitialized, setDashboardInitialized] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('Ładowanie dashboardu...');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [activeAdsProvider, setActiveAdsProvider] = useState<'meta' | 'google'>('meta');
  const [loadingSafetyTimeout, setLoadingSafetyTimeout] = useState<NodeJS.Timeout | null>(null);

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
    
    // Switch provider first
    setActiveAdsProvider(provider);
    
    // 🔧 CRITICAL: Wait for state update before loading data
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Reload data for the new platform
    if (currentClient) {
      console.log('🔄 TAB SWITCH: Loading data for provider:', provider);
      const newData = await loadMainDashboardData(currentClient, provider);
      
      console.log('🔄 TAB SWITCH: Received data:', {
        hasData: !!newData,
        dataSource: newData?.debug?.source,
        reason: newData?.debug?.reason,
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
          debugSource: updatedClientData.debug?.source
        });
        
        setClientData(updatedClientData);
        setDataSource(newData.debug?.source || 'unknown');
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
        router.replace('/admin');
        return;
      } else {
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
      
      console.log('📊 Loaded past months data:', {
        campaigns: pastCampaigns?.length || 0,
        totalSpend: stats.totalSpend,
        totalClicks: stats.totalClicks
      });
    } catch (error) {
      console.error('Error loading client dashboard from database:', error);
    }
  };

  const refreshLiveData = async () => {
    if (!user || loadingRef.current || refreshingData) return;
    
    setRefreshingData(true);
    setLoadingMessage('Odświeżanie danych...');
    setLoadingProgress(25);
    
    try {
      clearCache();
      setLoadingMessage('Pobieranie świeżych danych z Meta API...');
      setLoadingProgress(50);
      
      // Force live data loading
      await loadClientDashboard();
      
      setLoadingProgress(100);
      setLoadingMessage('Dane odświeżone!');
      
      // Small delay to show completion
      setTimeout(() => {
        setRefreshingData(false);
        setLoadingMessage('Ładowanie dashboardu...');
        setLoadingProgress(0);
      }, 1000);
    } catch (error) {
      console.error('Error refreshing data:', error);
      setLoadingMessage('Błąd odświeżania, ładowanie z bazy danych...');
      setLoadingProgress(75);
      
      // Try database fallback
      await loadClientDashboardFromDatabase();
      
      setLoadingProgress(100);
      setLoadingMessage('Dane załadowane z bazy danych');
      
      setTimeout(() => {
        if (mountedRef.current) {
          setRefreshingData(false);
          setLoadingMessage('Ładowanie dashboardu...');
          setLoadingProgress(0);
        }
      }, 1000);
    }
  };

  const loadMainDashboardData = async (currentClient: any, forceProvider?: 'meta' | 'google') => {
    console.log('🚀 DASHBOARD: loadMainDashboardData called for client:', currentClient?.id);
    try {
      // Use the same date range logic as smart cache helper to ensure proper cache detection
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      
      // 🔧 FIX: Don't use future dates - use current date as end if we're in current month
      const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
      const monthEnd = new Date(year, month, 0).toISOString().split('T')[0]; // Last day of month
      const today = now.toISOString().split('T')[0];
      
      // Use today as end date if it's before the month end, otherwise use month end
      const actualEndDate = (today && monthEnd && today < monthEnd) ? today : monthEnd;
      
      const dateRange = {
        start: monthStart,
        end: actualEndDate
      };
      
      console.log('📅 FIXED: Dashboard date range calculation:', {
        monthStart,
        monthEnd,
        today,
        actualEndDate,
        dateRange
      });
      
      console.log('📅 Dashboard loading FULL CURRENT MONTH data for smart caching:', dateRange);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
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
            reservations: 0,
            reservation_value: 0,
            roas: 0,
            cost_per_reservation: 0,
            booking_step_2: 0
          }
        };
      }

      // 🔧 INTELLIGENT API SELECTION: Check client configuration to determine which API to call
      const hasMetaAds = currentClient.meta_access_token && currentClient.ad_account_id;
      const hasGoogleAds = currentClient.google_ads_enabled && currentClient.google_ads_customer_id;
      
      console.log('🔍 CLIENT CONFIGURATION CHECK:', {
        clientId: currentClient.id,
        clientName: currentClient.name,
        hasMetaAds,
        hasGoogleAds,
        metaAccessToken: !!currentClient.meta_access_token,
        adAccountId: !!currentClient.ad_account_id,
        googleAdsEnabled: currentClient.google_ads_enabled,
        googleCustomerId: !!currentClient.google_ads_customer_id,
        googleRefreshToken: !!currentClient.google_ads_refresh_token
      });

      // Determine which API endpoint to use based on client configuration and current tab
      const effectiveProvider = forceProvider || activeAdsProvider;
      let apiEndpoint = '/api/fetch-live-data'; // Default to Meta API
      let shouldCallAPI = false;
      let monthData: any; // Declare monthData variable
      
              console.log('📡 DASHBOARD: API selection logic (before assignment):', {
          activeAdsProvider,
          forceProvider,
          effectiveProvider,
          hasMetaAds,
          hasGoogleAds,
          willCallAPI: shouldCallAPI,
          apiEndpoint: shouldCallAPI ? apiEndpoint : 'SKIPPED - will use database fallback'
        });
      
      if (effectiveProvider === 'meta' && hasMetaAds) {
        apiEndpoint = '/api/fetch-live-data';
        shouldCallAPI = true;
        console.log('📡 DASHBOARD: Using Meta API for Meta Ads configured client');
      } else if (effectiveProvider === 'google' && hasGoogleAds) {
        // Use Google Ads API for real data
        apiEndpoint = '/api/fetch-google-ads-live-data';
        shouldCallAPI = true;
        console.log('📡 DASHBOARD: Using Google Ads API for Google Ads configured client');
      } else if (hasMetaAds && !hasGoogleAds) {
        // Client only has Meta Ads - force Meta API and update tab
        apiEndpoint = '/api/fetch-live-data';
        shouldCallAPI = true;
        setActiveAdsProvider('meta');
        console.log('📡 DASHBOARD: Client only has Meta Ads - using Meta API and switching to Meta tab');
      } else if (hasGoogleAds && !hasMetaAds) {
        // Client only has Google Ads - force Google API and update tab
        apiEndpoint = '/api/fetch-google-ads-live-data';
        shouldCallAPI = true;
        setActiveAdsProvider('google');
        console.log('📡 DASHBOARD: Client only has Google Ads - using Google Ads API and switching to Google tab');
      } else {
        console.warn('⚠️ DASHBOARD: Client has no configured advertising platforms or current tab not supported');
        shouldCallAPI = false;
      }

      console.log('🔍 LOAD DATA DECISION (after assignment):', {
        effectiveProvider,
        shouldCallAPI,
        willSkipAPI: !shouldCallAPI,
        willGoToFallback: !shouldCallAPI,
        apiEndpoint: shouldCallAPI ? apiEndpoint : 'SKIPPED - will use database fallback'
      });

      if (!shouldCallAPI) {
        console.log('🔄 DASHBOARD: Skipping API call - going directly to database fallback');
        // Return empty data structure for skipped API calls
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
            reservations: 0,
            reservation_value: 0,
            roas: 0,
            cost_per_reservation: 0,
            booking_step_2: 0,
            booking_step_3: 0
          },
          debug: {
            campaigns: [],
            source: 'skipped-api',
            reason: 'API call skipped, using database fallback'
          }
        };
      } else {

      // Optimized timeout to 12 seconds for better UX
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn('⚠️ Dashboard API call timed out after 12 seconds');
        controller.abort();
      }, 12000);
      
      // 🔧 PRIORITY FIX: For Google Ads, try database fallback FIRST to get fresh data
      console.log('🚀 PRIORITY FALLBACK CODE LOADED - Version 2.0');
      if (effectiveProvider === 'google') {
        console.log('🔍 GOOGLE ADS PRIORITY: Trying database fallback first to avoid stale cache...');
        
        try {
          const { data: googleSummaries, error: googleError } = await supabase
            .from('campaign_summaries')
            .select('*')
            .eq('client_id', currentClient.id)
            .eq('platform', 'google')
            .gte('summary_date', `${year}-${String(month).padStart(2, '0')}-01`)
            .lt('summary_date', `${year}-${String(month + 1).padStart(2, '0')}-01`)
            .order('summary_date', { ascending: false });
          
          if (!googleError && googleSummaries && googleSummaries.length > 0) {
            console.log('✅ GOOGLE ADS PRIORITY FALLBACK: Found fresh database data:', googleSummaries.length, 'records');
            
            // Aggregate the data
            const totalSpend = googleSummaries.reduce((sum, s) => sum + (s.total_spend || 0), 0);
            const totalReservations = googleSummaries.reduce((sum, s) => sum + ((s as any).reservations || 0), 0);
            const totalImpressions = googleSummaries.reduce((sum, s) => sum + (s.total_impressions || 0), 0);
            const totalClicks = googleSummaries.reduce((sum, s) => sum + (s.total_clicks || 0), 0);
            const totalConversions = googleSummaries.reduce((sum, s) => sum + (s.total_conversions || 0), 0);
            
            console.log('💰 GOOGLE ADS PRIORITY FALLBACK DATA:', {
              totalSpend,
              totalReservations,
              totalImpressions,
              totalClicks,
              records: googleSummaries.length
            });
            
            clearTimeout(timeoutId);
            return {
              campaigns: googleSummaries.flatMap(s => s.campaign_data || []),
              stats: {
                totalSpend,
                totalImpressions,
                totalClicks,
                totalConversions,
                totalReservations,
                averageCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
                averageCpc: totalClicks > 0 ? totalSpend / totalClicks : 0
              },
              conversionMetrics: {
                click_to_call: googleSummaries.reduce((sum, s) => sum + ((s as any).click_to_call || 0), 0),
                email_contacts: googleSummaries.reduce((sum, s) => sum + ((s as any).email_contacts || 0), 0),
                booking_step_1: googleSummaries.reduce((sum, s) => sum + ((s as any).booking_step_1 || 0), 0),
                booking_step_2: googleSummaries.reduce((sum, s) => sum + ((s as any).booking_step_2 || 0), 0),
                booking_step_3: googleSummaries.reduce((sum, s) => sum + ((s as any).booking_step_3 || 0), 0),
                reservations: totalReservations,
                reservation_value: googleSummaries.reduce((sum, s) => sum + ((s as any).reservation_value || 0), 0),
                roas: totalSpend > 0 ? (googleSummaries.reduce((sum, s) => sum + ((s as any).reservation_value || 0), 0) / totalSpend) : 0,
                cost_per_reservation: totalReservations > 0 ? totalSpend / totalReservations : 0
              },
              debug: {
                source: 'database-priority',
                reason: 'Bypassed API cache to get fresh data',
                recordsFound: googleSummaries.length,
                dateRange: `${year}-${String(month).padStart(2, '0')}`
              }
            };
          } else {
            console.log('❌ GOOGLE ADS PRIORITY FALLBACK: No database data found, will try API...');
          }
        } catch (error) {
          console.log('❌ GOOGLE ADS PRIORITY FALLBACK failed:', error instanceof Error ? error.message : error);
        }
      }

      // Use intelligent API selection (fallback to API if database didn't work)
      console.log('📡 DASHBOARD: Making API call to', apiEndpoint);
      // Enhanced API request with platform parameter and fresh data
      const requestBody = {
        clientId: currentClient.id,
        dateRange: dateRange,
        platform: effectiveProvider, // Include platform parameter like reports
        forceFresh: true, // Force fresh data for dashboard accuracy
        reason: 'dashboard_display'
      };

      console.log('📡 ENHANCED API Request:', {
        endpoint: apiEndpoint,
        body: requestBody,
        platform: effectiveProvider,
        dateRange: dateRange
      });
      
      let response;
      try {
        response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        console.warn('⚠️ Dashboard API fetch failed:', fetchError?.message || fetchError);
        
        // Handle network errors, server not running, etc.
        console.log('🔄 NETWORK ERROR FALLBACK: Attempting to load data from cache/database...');
        
        // Set loading message to inform user of fallback
        setLoadingMessage && setLoadingMessage('Błąd API - ładowanie z cache...');
        setLoadingProgress && setLoadingProgress(60);
        
        // Use the same fallback logic as for failed responses
        try {
          if (activeAdsProvider === 'meta') {
            // Try Meta cache first
            const { data: metaCache, error: metaCacheError } = await supabase
              .from('current_month_cache')
              .select('*')
              .eq('client_id', currentClient.id)
              .eq('period_id', `${year}-${String(month).padStart(2, '0')}`)
              .single();
              
            if (!metaCacheError && metaCache?.cache_data) {
              console.log('✅ NETWORK FALLBACK: Using Meta cache data');
              const cacheData = metaCache.cache_data as any;
              console.log('🔍 CACHE DATA STRUCTURE:', {
                hasStats: !!cacheData.stats,
                stats: cacheData.stats,
                hasCampaigns: !!cacheData.campaigns,
                campaignsCount: cacheData.campaigns?.length || 0
              });
              
              return {
                stats: cacheData.stats || null,
                campaigns: cacheData.campaigns || [],
                conversionMetrics: cacheData.conversionMetrics || null,
                debug: {
                  source: 'database',
                  reason: 'Network error, using cached data',
                  cacheAge: Date.now() - new Date(metaCache.last_updated).getTime(),
                  error: fetchError?.message || fetchError
                }
              };
            }
            
            // Try campaign summaries as secondary fallback
            const { data: summaries, error: summariesError } = await supabase
              .from('campaign_summaries')
              .select('*')
              .eq('client_id', currentClient.id)
              .eq('summary_date', `${year}-${String(month).padStart(2, '0')}-01`)
              .eq('summary_type', 'monthly')
              .single();
              
            if (!summariesError && summaries) {
              console.log('✅ NETWORK FALLBACK: Using campaign summaries data');
              return {
                campaigns: summaries.campaign_data || [],
                stats: {
                  totalSpend: summaries.total_spend || 0,
                  totalImpressions: summaries.total_impressions || 0,
                  totalClicks: summaries.total_clicks || 0,
                  totalConversions: summaries.total_conversions || 0,
                  averageCtr: summaries.average_ctr || 0,
                  averageCpc: summaries.average_cpc || 0
                },
                conversionMetrics: {
                  click_to_call: (summaries as any).click_to_call || 0,
                  email_contacts: (summaries as any).email_contacts || 0,
                  booking_step_1: (summaries as any).booking_step_1 || 0,
                  reservations: (summaries as any).reservations || 0,
                  reservation_value: (summaries as any).reservation_value || 0,
                  roas: (summaries as any).roas || 0,
                  cost_per_reservation: (summaries as any).cost_per_reservation || 0,
                  booking_step_2: (summaries as any).booking_step_2 || 0
                },
                debug: {
                  source: 'campaign-summaries-network-fallback',
                  reason: 'Network error, using campaign summaries',
                  error: fetchError?.message || fetchError
                }
              };
            }
          } else if (effectiveProvider === 'google') {
            // Try Google Ads campaigns table as fallback
            const { data: googleCampaigns, error: googleError } = await supabase
              .from('google_ads_campaigns')
              .select('*')
              .eq('client_id', currentClient.id)
              .gte('date_range_start', `${year}-${String(month).padStart(2, '0')}-01`)
              .lte('date_range_end', `${year}-${String(month).padStart(2, '0')}-31`);
              
            console.log('🔍 Google Ads campaigns query result:', {
              error: googleError,
              campaignsFound: googleCampaigns?.length || 0,
              effectiveProvider
            });
            
            if (!googleError && googleCampaigns && googleCampaigns.length > 0) {
              console.log('✅ NETWORK FALLBACK: Using Google Ads campaigns data');
              
              const totalSpend = googleCampaigns.reduce((sum, c) => sum + (parseFloat(String(c.spend)) || 0), 0);
              const totalClicks = googleCampaigns.reduce((sum, c) => sum + (parseInt(String(c.clicks)) || 0), 0);
              const totalImpressions = googleCampaigns.reduce((sum, c) => sum + (parseInt(String(c.impressions)) || 0), 0);
              const totalConversions = googleCampaigns.reduce((sum, c) => sum + (parseInt(String((c as any).conversions)) || 0), 0);
              
              return {
                campaigns: googleCampaigns,
                stats: {
                  totalSpend,
                  totalImpressions,
                  totalClicks,
                  totalConversions,
                  averageCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
                  averageCpc: totalClicks > 0 ? totalSpend / totalClicks : 0
                },
                conversionMetrics: {
                  click_to_call: 0,
                  email_contacts: 0,
                  booking_step_1: 0,
                  reservations: totalConversions,
                  reservation_value: 0,
                  roas: 0,
                  cost_per_reservation: totalConversions > 0 ? totalSpend / totalConversions : 0,
                  booking_step_2: 0
                },
                debug: {
                  source: 'google-campaigns-network-fallback',
                  reason: 'Network error, using Google Ads campaigns table',
                  error: fetchError?.message || fetchError
                }
              };
            } else {
              console.log('❌ No Google Ads campaigns found in date range, trying broader search...');
              
              // Try broader search without date restrictions
              const { data: allGoogleCampaigns, error: allGoogleError } = await supabase
                .from('google_ads_campaigns')
                .select('*')
                .eq('client_id', currentClient.id);
                
              console.log('🔍 Broader Google Ads search result:', {
                error: allGoogleError,
                campaignsFound: allGoogleCampaigns?.length || 0
              });
              
              if (!allGoogleError && allGoogleCampaigns && allGoogleCampaigns.length > 0) {
                console.log('✅ FALLBACK: Using all Google Ads campaigns data');
                
                // Calculate totals from all Google campaigns
                const totalSpend = allGoogleCampaigns.reduce((sum, c) => sum + (parseFloat(String(c.spend)) || 0), 0);
                const totalClicks = allGoogleCampaigns.reduce((sum, c) => sum + (parseInt(String(c.clicks)) || 0), 0);
                const totalImpressions = allGoogleCampaigns.reduce((sum, c) => sum + (parseInt(String(c.impressions)) || 0), 0);
                const totalConversions = allGoogleCampaigns.reduce((sum, c) => sum + (parseInt(String((c as any).reservations)) || 0), 0);
                const totalReservationValue = allGoogleCampaigns.reduce((sum, c) => sum + (parseFloat(String((c as any).reservation_value)) || 0), 0);
                
                console.log('📊 Calculated Google Ads totals from real data:', {
                  totalSpend,
                  totalClicks,
                  totalImpressions,
                  totalConversions,
                  totalReservationValue
                });
                
                return {
                  stats: {
                    totalSpend,
                    totalClicks,
                    totalImpressions,
                    totalConversions,
                    averageCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
                    averageCpc: totalClicks > 0 ? totalSpend / totalClicks : 0
                  },
                  campaigns: allGoogleCampaigns,
                  conversionMetrics: {
                    form_submissions: allGoogleCampaigns.reduce((sum, c) => sum + (parseInt(String((c as any).form_submissions)) || 0), 0),
                    phone_calls: allGoogleCampaigns.reduce((sum, c) => sum + (parseInt(String((c as any).phone_calls)) || 0), 0),
                    email_clicks: allGoogleCampaigns.reduce((sum, c) => sum + (parseInt(String((c as any).email_clicks)) || 0), 0),
                    phone_clicks: allGoogleCampaigns.reduce((sum, c) => sum + (parseInt(String((c as any).phone_clicks)) || 0), 0),
                    booking_step_1: allGoogleCampaigns.reduce((sum, c) => sum + (parseInt(String((c as any).booking_step_1)) || 0), 0),
                    booking_step_2: allGoogleCampaigns.reduce((sum, c) => sum + (parseInt(String((c as any).booking_step_2)) || 0), 0),
                    booking_step_3: allGoogleCampaigns.reduce((sum, c) => sum + (parseInt(String((c as any).booking_step_3)) || 0), 0),
                    reservations: totalConversions,
                    reservation_value: totalReservationValue,
                    cost_per_reservation: totalConversions > 0 ? totalSpend / totalConversions : 0
                  },
                  debug: {
                    source: 'database',
                    reason: 'Using real Google Ads campaigns data (all campaigns)',
                    cacheAge: null,
                    responseTime: 0
                  }
                };
              } else {
                console.log('❌ No Google Ads campaigns found at all, this should not happen');
                return {
                  stats: {
                    totalSpend: 0,
                    totalClicks: 0,
                    totalImpressions: 0,
                    totalConversions: 0,
                    averageCtr: 0,
                    averageCpc: 0
                  },
                  campaigns: [],
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
                  debug: {
                    source: 'database',
                    reason: 'No Google Ads campaigns found',
                    error: fetchError?.message || fetchError
                  }
                };
              }
            }
          }
        } catch (networkFallbackError) {
          console.error('❌ NETWORK FALLBACK: Cache lookup failed:', networkFallbackError);
        }
        
        // Final fallback for network errors
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
            reservations: 0,
            reservation_value: 0,
            roas: 0,
            cost_per_reservation: 0,
            booking_step_2: 0
          },
          debug: {
            campaigns: [],
            source: 'network-error-fallback',
            reason: 'Network error and no cached data available',
            error: fetchError.message
          }
        };
      }

      clearTimeout(timeoutId);

      console.log('📊 DASHBOARD API RESPONSE:', response.status, response.statusText);

      if (!response.ok) {
        console.error('❌ Dashboard API call failed:', response.status, response.statusText);
        
        // Get error details
        const errorText = await response.text();
        console.error('❌ Error details:', errorText);
        
        // Set loading message for user feedback
        setLoadingMessage && setLoadingMessage(`Błąd API (${response.status}) - ładowanie z cache...`);
        setLoadingProgress && setLoadingProgress(70);
        
        console.log('🔄 FALLBACK: Attempting to load data from cache/database...');
        
        // Try to load from cache as fallback
        try {
          if (effectiveProvider === 'google') {
            // Try Google Ads database fallback
            console.log('🔍 GOOGLE ADS FALLBACK: Loading from campaign_summaries...');
            
            const { data: googleSummaries, error: googleError } = await supabase
              .from('campaign_summaries')
              .select('*')
              .eq('client_id', currentClient.id)
              .eq('platform', 'google')
              .gte('summary_date', `${year}-${String(month).padStart(2, '0')}-01`)
              .lt('summary_date', `${year}-${String(month + 1).padStart(2, '0')}-01`)
              .order('summary_date', { ascending: false });
            
            if (!googleError && googleSummaries && googleSummaries.length > 0) {
              console.log('✅ GOOGLE ADS FALLBACK: Found database data:', googleSummaries.length, 'records');
              
              // Aggregate the data
              const totalSpend = googleSummaries.reduce((sum, s) => sum + (s.total_spend || 0), 0);
              const totalReservations = googleSummaries.reduce((sum, s) => sum + ((s as any).reservations || 0), 0);
              const totalImpressions = googleSummaries.reduce((sum, s) => sum + (s.total_impressions || 0), 0);
              const totalClicks = googleSummaries.reduce((sum, s) => sum + (s.total_clicks || 0), 0);
              const totalConversions = googleSummaries.reduce((sum, s) => sum + (s.total_conversions || 0), 0);
              
              console.log('💰 GOOGLE ADS FALLBACK DATA:', {
                totalSpend,
                totalReservations,
                totalImpressions,
                totalClicks,
                records: googleSummaries.length
              });
              
              return {
                campaigns: googleSummaries.flatMap(s => s.campaign_data || []),
                stats: {
                  totalSpend,
                  totalImpressions,
                  totalClicks,
                  totalConversions,
                  totalReservations,
                  averageCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
                  averageCpc: totalClicks > 0 ? totalSpend / totalClicks : 0
                },
                conversionMetrics: {
                  click_to_call: googleSummaries.reduce((sum, s) => sum + ((s as any).click_to_call || 0), 0),
                  email_contacts: googleSummaries.reduce((sum, s) => sum + ((s as any).email_contacts || 0), 0),
                  booking_step_1: googleSummaries.reduce((sum, s) => sum + ((s as any).booking_step_1 || 0), 0),
                  booking_step_2: googleSummaries.reduce((sum, s) => sum + ((s as any).booking_step_2 || 0), 0),
                  booking_step_3: googleSummaries.reduce((sum, s) => sum + ((s as any).booking_step_3 || 0), 0),
                  reservations: totalReservations,
                  reservation_value: googleSummaries.reduce((sum, s) => sum + ((s as any).reservation_value || 0), 0),
                  roas: totalSpend > 0 ? (googleSummaries.reduce((sum, s) => sum + ((s as any).reservation_value || 0), 0) / totalSpend) : 0,
                  cost_per_reservation: totalReservations > 0 ? totalSpend / totalReservations : 0
                },
                debug: {
                  source: 'database-fallback',
                  reason: `API call failed (${response.status}), using database data`,
                  recordsFound: googleSummaries.length,
                  dateRange: `${year}-${String(month).padStart(2, '0')}`
                }
              };
            } else {
              console.log('❌ GOOGLE ADS FALLBACK: No database data found');
            }
          } else if (effectiveProvider === 'meta') {
            // Try Meta cache first
            const { data: metaCache, error: metaCacheError } = await supabase
              .from('current_month_cache')
              .select('*')
              .eq('client_id', currentClient.id)
              .eq('period_id', `${year}-${String(month).padStart(2, '0')}`)
              .single();
              
            if (!metaCacheError && metaCache?.cache_data) {
              console.log('✅ FALLBACK: Using Meta cache data');
              const cacheData = metaCache.cache_data as any;
              console.log('🔍 CACHE DATA STRUCTURE:', {
                hasStats: !!cacheData.stats,
                stats: cacheData.stats,
                hasCampaigns: !!cacheData.campaigns,
                campaignsCount: cacheData.campaigns?.length || 0
              });
              
              return {
                stats: cacheData.stats || null,
                campaigns: cacheData.campaigns || [],
                conversionMetrics: cacheData.conversionMetrics || null,
                debug: {
                  source: 'database',
                  reason: 'API call failed, using cached data',
                  cacheAge: Date.now() - new Date(metaCache.last_updated).getTime()
                }
              };
            }
            
            // Try campaign summaries as secondary fallback
            const { data: summaries, error: summariesError } = await supabase
              .from('campaign_summaries')
              .select('*')
              .eq('client_id', currentClient.id)
              .eq('summary_date', `${year}-${String(month).padStart(2, '0')}-01`)
              .eq('summary_type', 'monthly')
              .single();
              
            if (!summariesError && summaries) {
              console.log('✅ FALLBACK: Using campaign summaries data');
              return {
                campaigns: summaries.campaign_data || [],
                stats: {
                  totalSpend: summaries.total_spend || 0,
                  totalImpressions: summaries.total_impressions || 0,
                  totalClicks: summaries.total_clicks || 0,
                  totalConversions: summaries.total_conversions || 0,
                  averageCtr: summaries.average_ctr || 0,
                  averageCpc: summaries.average_cpc || 0
                },
                conversionMetrics: {
                  click_to_call: (summaries as any).click_to_call || 0,
                  email_contacts: (summaries as any).email_contacts || 0,
                  booking_step_1: (summaries as any).booking_step_1 || 0,
                  reservations: (summaries as any).reservations || 0,
                  reservation_value: (summaries as any).reservation_value || 0,
                  roas: (summaries as any).roas || 0,
                  cost_per_reservation: (summaries as any).cost_per_reservation || 0,
                  booking_step_2: (summaries as any).booking_step_2 || 0
                },
                debug: {
                  source: 'campaign-summaries-fallback',
                  reason: 'API call failed, using campaign summaries'
                }
              };
            }
          } else if (effectiveProvider === 'google') {
            // Try Google Ads campaigns table as fallback
            const { data: googleCampaigns, error: googleError } = await supabase
              .from('google_ads_campaigns')
              .select('*')
              .eq('client_id', currentClient.id)
              .gte('date_range_start', `${year}-${String(month).padStart(2, '0')}-01`)
              .lte('date_range_end', `${year}-${String(month).padStart(2, '0')}-31`);
              
            console.log('🔍 Google Ads campaigns query result (API fallback):', {
              error: googleError,
              campaignsFound: googleCampaigns?.length || 0
            });
            
            if (!googleError && googleCampaigns && googleCampaigns.length > 0) {
              console.log('✅ FALLBACK: Using Google Ads campaigns data');
              
              const totalSpend = googleCampaigns.reduce((sum, c) => sum + (parseFloat(String(c.spend)) || 0), 0);
              const totalClicks = googleCampaigns.reduce((sum, c) => sum + (parseInt(String(c.clicks)) || 0), 0);
              const totalImpressions = googleCampaigns.reduce((sum, c) => sum + (parseInt(String(c.impressions)) || 0), 0);
              const totalConversions = googleCampaigns.reduce((sum, c) => sum + (parseInt(String((c as any).reservations)) || 0), 0);
              const totalReservationValue = googleCampaigns.reduce((sum, c) => sum + (parseFloat(String((c as any).reservation_value)) || 0), 0);
              
              return {
                campaigns: googleCampaigns,
                stats: {
                  totalSpend,
                  totalImpressions,
                  totalClicks,
                  totalConversions,
                  averageCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
                  averageCpc: totalClicks > 0 ? totalSpend / totalClicks : 0
                },
                conversionMetrics: {
                  form_submissions: googleCampaigns.reduce((sum, c) => sum + (parseInt(String((c as any).form_submissions)) || 0), 0),
                  phone_calls: googleCampaigns.reduce((sum, c) => sum + (parseInt(String((c as any).phone_calls)) || 0), 0),
                  email_clicks: googleCampaigns.reduce((sum, c) => sum + (parseInt(String((c as any).email_clicks)) || 0), 0),
                  phone_clicks: googleCampaigns.reduce((sum, c) => sum + (parseInt(String((c as any).phone_clicks)) || 0), 0),
                  booking_step_1: googleCampaigns.reduce((sum, c) => sum + (parseInt(String((c as any).booking_step_1)) || 0), 0),
                  booking_step_2: googleCampaigns.reduce((sum, c) => sum + (parseInt(String((c as any).booking_step_2)) || 0), 0),
                  booking_step_3: googleCampaigns.reduce((sum, c) => sum + (parseInt(String((c as any).booking_step_3)) || 0), 0),
                  reservations: totalConversions,
                  reservation_value: totalReservationValue,
                  cost_per_reservation: totalConversions > 0 ? totalSpend / totalConversions : 0
                },
                debug: {
                  source: 'database',
                  reason: 'API call failed, using Google Ads campaigns table'
                }
              };
            } else {
              console.log('❌ No Google Ads campaigns found in date range, trying broader search (API fallback)...');
              
              // Try broader search without date restrictions
              const { data: allGoogleCampaigns, error: allGoogleError } = await supabase
                .from('google_ads_campaigns')
                .select('*')
                .eq('client_id', currentClient.id);
                
              if (!allGoogleError && allGoogleCampaigns && allGoogleCampaigns.length > 0) {
                console.log('✅ FALLBACK: Using all Google Ads campaigns data (API fallback)');
                
                const totalSpend = allGoogleCampaigns.reduce((sum, c) => sum + (parseFloat(String(c.spend)) || 0), 0);
                const totalClicks = allGoogleCampaigns.reduce((sum, c) => sum + (parseInt(String(c.clicks)) || 0), 0);
                const totalImpressions = allGoogleCampaigns.reduce((sum, c) => sum + (parseInt(String(c.impressions)) || 0), 0);
                const totalConversions = allGoogleCampaigns.reduce((sum, c) => sum + (parseInt(String((c as any).reservations)) || 0), 0);
                const totalReservationValue = allGoogleCampaigns.reduce((sum, c) => sum + (parseFloat(String((c as any).reservation_value)) || 0), 0);
                
                return {
                  campaigns: allGoogleCampaigns,
                  stats: {
                    totalSpend,
                    totalImpressions,
                    totalClicks,
                    totalConversions,
                    averageCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
                    averageCpc: totalClicks > 0 ? totalSpend / totalClicks : 0
                  },
                  conversionMetrics: {
                    form_submissions: allGoogleCampaigns.reduce((sum, c) => sum + (parseInt(String((c as any).form_submissions)) || 0), 0),
                    phone_calls: allGoogleCampaigns.reduce((sum, c) => sum + (parseInt(String((c as any).phone_calls)) || 0), 0),
                    email_clicks: allGoogleCampaigns.reduce((sum, c) => sum + (parseInt(String((c as any).email_clicks)) || 0), 0),
                    phone_clicks: allGoogleCampaigns.reduce((sum, c) => sum + (parseInt(String((c as any).phone_clicks)) || 0), 0),
                    booking_step_1: allGoogleCampaigns.reduce((sum, c) => sum + (parseInt(String((c as any).booking_step_1)) || 0), 0),
                    booking_step_2: allGoogleCampaigns.reduce((sum, c) => sum + (parseInt(String((c as any).booking_step_2)) || 0), 0),
                    booking_step_3: allGoogleCampaigns.reduce((sum, c) => sum + (parseInt(String((c as any).booking_step_3)) || 0), 0),
                    reservations: totalConversions,
                    reservation_value: totalReservationValue,
                    cost_per_reservation: totalConversions > 0 ? totalSpend / totalConversions : 0
                  },
                  debug: {
                    source: 'database',
                    reason: 'API call failed, using all Google Ads campaigns data'
                  }
                };
              }
            }
          }
        } catch (fallbackError) {
          console.error('❌ FALLBACK: Cache lookup failed:', fallbackError);
        }
        
        // Final fallback - return empty data
        console.log('❌ FALLBACK: No cached data available, returning empty data');
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
            reservations: 0,
            reservation_value: 0,
            roas: 0,
            cost_per_reservation: 0,
            booking_step_2: 0
          },
          debug: {
            campaigns: [],
            source: 'empty-fallback',
            reason: 'API call failed and no cached data available'
          }
        };
      }

      const monthData = await response.json();
      
      // 🔍 ENHANCED DEBUG: Log what data we actually received
      console.log('✅ DASHBOARD API SUCCESS - Response received:', {
        success: monthData.success,
        hasData: !!monthData.data,
        dataKeys: monthData.data ? Object.keys(monthData.data) : 'no data',
        stats: monthData.data?.stats,
        campaigns: monthData.data?.campaigns?.length || 0,
        conversionMetrics: monthData.data?.conversionMetrics,
        source: monthData.source || monthData.debug?.source || 'unknown',
        platform: effectiveProvider,
        dateRange: dateRange
      });

      // Log detailed stats if available
      if (monthData.data?.stats) {
        console.log('💰 DASHBOARD STATS BREAKDOWN:', {
          totalSpend: monthData.data.stats.totalSpend,
          totalReservations: monthData.data.stats.totalReservations || monthData.data.conversionMetrics?.reservations,
          totalImpressions: monthData.data.stats.totalImpressions,
          totalClicks: monthData.data.stats.totalClicks,
          source: monthData.source
        });
      }
      
      // Log smart cache performance
      console.log('📊 Dashboard data received:', {
        source: monthData.debug?.source,
        campaignCount: monthData.data?.campaigns?.length,
        responseTime: monthData.debug?.responseTime,
        cacheAge: monthData.debug?.cacheAge,
        isSmartCache: monthData.debug?.source === 'cache' || monthData.debug?.source === 'stale-cache'
      });
      
      // Log if smart caching worked
      if (monthData.debug?.source === 'cache') {
        console.log('🚀 ✅ SMART CACHE HIT! Dashboard loaded from fresh cache in', (monthData.debug.responseTime || 0) + 'ms');
      } else if (monthData.debug?.source === 'stale-cache') {
        console.log('⚡ ✅ SMART CACHE STALE! Dashboard loaded from stale cache in', (monthData.debug.responseTime || 0) + 'ms');
      } else if (monthData.debug?.source === 'live-api-cached') {
        console.log('🔄 ✅ LIVE API + CACHE! Dashboard fetched fresh data and cached it in', (monthData.debug.responseTime || 0) + 'ms');
      } else {
        console.log('🐌 ❌ NO SMART CACHE! Dashboard loaded from', monthData.debug?.source, 'in', (monthData.debug?.responseTime || 0) + 'ms');
      }
      
      // Validate that returned data matches expected period
      const validateDataPeriod = (data: any, expectedRange: any) => {
        if (!data?.dateRange) return false;
        return data.dateRange.start === expectedRange.start && 
               data.dateRange.end === expectedRange.end;
      };
      
      if (!validateDataPeriod(monthData.data, dateRange)) {
        console.warn('⚠️ API returned data for different period than requested:', {
          requested: dateRange,
          returned: monthData.data?.dateRange
        });
      }
      
      if (monthData.success && (monthData.data?.campaigns || monthData.data?.stats)) {
        // If we have cached stats, use them directly (more accurate)
        let stats = {
          totalSpend: 0,
          totalImpressions: 0,
          totalClicks: 0,
          totalConversions: 0,
          averageCtr: 0,
          averageCpc: 0
        };
        let campaigns = [];
        
        if (monthData.data?.stats) {
          console.log('✅ Using cached stats directly:', monthData.data.stats);
          console.log('💰 Cached totalSpend:', monthData.data.stats.totalSpend);
          stats = {
            totalSpend: monthData.data.stats.totalSpend || 0,
            totalImpressions: monthData.data.stats.totalImpressions || 0,
            totalClicks: monthData.data.stats.totalClicks || 0,
            totalConversions: monthData.data.stats.totalConversions || 0,
            averageCtr: monthData.data.stats.averageCtr || 0,
            averageCpc: monthData.data.stats.averageCpc || 0
          };
          // Also process campaigns if they exist in cached response
          if (monthData.data?.campaigns) {
            campaigns = monthData.data.campaigns.map((campaign: any) => ({
              id: campaign.campaign_id,
              campaign_name: campaign.campaign_name,
              campaign_id: campaign.campaign_id,
              spend: campaign.spend || 0,
              impressions: campaign.impressions || 0,
              clicks: campaign.clicks || 0,
              conversions: campaign.conversions || 0,
              ctr: campaign.ctr || 0,
              cpc: campaign.cpc || 0,
              date_range_start: dateRange.start,
              date_range_end: dateRange.end,
              click_to_call: campaign.click_to_call || 0,
              email_contacts: campaign.email_contacts || 0,
              reservations: campaign.reservations || 0,
              reservation_value: campaign.reservation_value || 0,
              booking_step_1: campaign.booking_step_1 || 0,
              booking_step_2: campaign.booking_step_2 || 0,
              booking_step_3: campaign.booking_step_3 || 0,
              roas: campaign.roas || 0,
              cost_per_reservation: campaign.cost_per_reservation || 0
            }));
          }
        } else if (monthData.data?.campaigns) {
          // Fallback: calculate from campaigns if no cached stats
          console.log('📊 Calculating stats from campaigns');
          campaigns = monthData.data.campaigns.map((campaign: any) => ({
            id: campaign.campaign_id,
            campaign_name: campaign.campaign_name,
            campaign_id: campaign.campaign_id,
            spend: campaign.spend || 0,
            impressions: campaign.impressions || 0,
            clicks: campaign.clicks || 0,
            conversions: campaign.conversions || 0,
            ctr: campaign.ctr || 0,
            cpc: campaign.cpc || 0,
            date_range_start: dateRange.start,
            date_range_end: dateRange.end,
            // Conversion tracking data - use correct field names
            click_to_call: campaign.click_to_call || 0,
            email_contacts: campaign.email_contacts || 0,
            reservations: campaign.reservations || 0,
            reservation_value: campaign.reservation_value || 0,
            booking_step_1: campaign.booking_step_1 || 0,
            booking_step_2: campaign.booking_step_2 || 0,
            booking_step_3: campaign.booking_step_3 || 0,
            roas: campaign.roas || 0,
            cost_per_reservation: campaign.cost_per_reservation || 0
          }));

          const totalSpend = campaigns.reduce((sum: number, campaign: any) => sum + (campaign.spend || 0), 0);
          const totalImpressions = campaigns.reduce((sum: number, campaign: any) => sum + (campaign.impressions || 0), 0);
          const totalClicks = campaigns.reduce((sum: number, campaign: any) => sum + (campaign.clicks || 0), 0);
          const totalConversions = campaigns.reduce((sum: number, campaign: any) => sum + (campaign.conversions || 0), 0);
          
          const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
          const averageCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
          
          stats = {
            totalSpend,
            totalImpressions,
            totalClicks,
            totalConversions,
            averageCtr,
            averageCpc
          };
        }
        
        console.log('📊 API conversion metrics:', monthData.data?.conversionMetrics);
        
        // Use conversion metrics from API response - this is the correct source
        const conversionMetrics = monthData.data?.conversionMetrics || {
          click_to_call: 0,
          email_contacts: 0,
          booking_step_1: 0,
          reservations: 0,
          reservation_value: 0,
          roas: 0,
          cost_per_reservation: 0,
          booking_step_2: 0,
          booking_step_3: 0
        };

        console.log('🎯 Final stats being returned:', stats);
        console.log('💰 Final totalSpend:', stats.totalSpend);
        
        return {
          campaigns,
          stats,
          conversionMetrics,
          debug: {
            ...monthData.debug,
            campaigns: campaigns, // Add campaigns to debug for MetaPerformanceLive daily data storage
            source: monthData.debug?.source || 'live-api-cached'
          }
        };
      } else {
        console.warn('⚠️ API response missing campaigns data:', monthData);
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
            reservations: 0,
            reservation_value: 0,
            roas: 0,
            cost_per_reservation: 0,
            booking_step_2: 0,
            booking_step_3: 0
          },
          debug: {
            campaigns: [], // Add empty campaigns to debug
            source: 'no-campaigns-data-fallback'
          }
        };
      }
      } // End of else block for shouldCallAPI
    } catch (error) {
      console.error('❌ Error loading dashboard data:', error);
      
      // Set loading message for user feedback
      setLoadingMessage && setLoadingMessage('Błąd ładowania danych');
      setLoadingProgress && setLoadingProgress(100);
      
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
          reservations: 0,
          reservation_value: 0,
          roas: 0,
          cost_per_reservation: 0,
          booking_step_2: 0,
          booking_step_3: 0
        },
        debug: {
          campaigns: [], // Add empty campaigns to debug
          source: 'catch-error-fallback',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    const currencySymbols: { [key: string]: string } = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'PLN': 'zł',
      'CAD': 'C$',
      'AUD': 'A$',
      'JPY': '¥',
      'CHF': 'CHF',
      'SEK': 'kr',
      'NOK': 'kr',
      'DKK': 'kr'
    };

    const symbol = currencySymbols[currency] || currency;
    
    if (currency === 'PLN') {
      return new Intl.NumberFormat('pl-PL', {
        style: 'currency',
        currency: 'PLN',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount);
    }
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount).replace(/[A-Z]{3}/, symbol);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <DashboardLoading progress={loadingProgress} message={loadingMessage} />
      </div>
    );
  }

  if (!clientData) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-error-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-text mb-2">Nie znaleziono klienta</h3>
          <p className="text-muted">Skontaktuj się z administratorem.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page">
      {/* Modern Header */}
      <header className="bg-bg border-b border-stroke sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-navy rounded-lg flex items-center justify-center shadow-sm">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-text">Dashboard</h1>
                <p className="text-sm text-muted">
                  {activeAdsProvider === 'meta' ? 'Meta Ads Analytics' : 'Google Ads Analytics'}
                </p>
              </div>
              
              {/* Client Selector for Admin Users */}
              {user?.role === 'admin' && (
                <div className="ml-6">
                  <ClientSelector
                    currentClient={clientData?.client || null}
                    onClientChange={handleClientChange}
                    userRole={user.role}
                  />
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Data Status */}
              <div className="flex items-center space-x-3 px-4 py-2 bg-page rounded-lg">
                <div className={`w-2 h-2 rounded-full ${
                  dataSource === 'cache' ? 'bg-success-500' : 
                  dataSource === 'stale-cache' ? 'bg-warning-500 animate-pulse' :
                  dataSource === 'live-api-cached' ? 'bg-success-500 animate-pulse' : 'bg-muted'
                }`}></div>
                <span className="text-sm text-text">
                  {dataSource === 'cache' ? 'Cache (świeże)' : 
                   dataSource === 'stale-cache' ? 'Cache (odświeżanie)' :
                   dataSource === 'live-api-cached' ? 'Na żywo' : 'Baza danych'}
                </span>
              </div>
              
              {/* Refresh Button */}
              <button
                onClick={refreshLiveData}
                disabled={refreshingData}
                className="p-2 text-muted hover:text-text hover:bg-page rounded-lg transition-all duration-200"
                title="Odśwież dane"
              >
                <RefreshCw className={`h-5 w-5 ${refreshingData ? 'animate-spin' : ''}`} />
              </button>

              {/* Debug: Clear All Caches Button (Admin Only) */}
              {user?.role === 'admin' && (
                <button
                  onClick={clearAllClientCaches}
                  className="p-2 text-error-500 hover:text-error-700 hover:bg-error-50 rounded-lg transition-all duration-200"
                  title="Wyczyść wszystkie cache"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              )}

              {/* User Menu */}
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-navy rounded-lg flex items-center justify-center">
                  <User className="h-4 w-4 text-white" />
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-muted hover:text-text hover:bg-page rounded-lg transition-all duration-200"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-8 bg-page min-h-screen">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Client Logo */}
              {clientData.client.logo_url && (
                <div className="flex-shrink-0">
                  <img 
                    src={clientData.client.logo_url} 
                    alt={`${clientData.client.name} logo`}
                    className="h-16 w-16 object-contain rounded-lg border border-stroke bg-bg p-2"
                  />
                </div>
              )}
              <div>
                <h2 className="text-3xl font-bold text-text mb-2">
                  Witaj, {clientData.client.name} 👋
                </h2>
                <p className="text-muted">
                  Oto podsumowanie Twoich kampanii {activeAdsProvider === 'meta' ? 'Meta Ads' : 'Google Ads'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => router.push('/reports')}
                className="px-6 py-3 bg-navy text-white rounded-lg font-medium hover:bg-navy/90 hover:shadow-md transition-all duration-200 flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Zobacz pełne raporty</span>
              </button>
            </div>
          </div>
        </div>

        {/* Platform Tabs - Only show tabs for configured platforms */}
        {(() => {
          const hasMetaAds = clientData.client.meta_access_token && clientData.client.ad_account_id;
          const hasGoogleAds = clientData.client.google_ads_enabled && clientData.client.google_ads_customer_id;
          const showTabs = hasMetaAds && hasGoogleAds; // Only show tabs if client has both platforms
          
          // 🔍 CRITICAL DEBUG: Log tab logic
          console.log('🎯 TAB LOGIC DEBUG:', {
            clientName: clientData.client.name,
            hasMetaAds,
            hasGoogleAds,
            showTabs,
            activeAdsProvider,
            refreshingData,
            metaToken: !!clientData.client.meta_access_token,
            adAccountId: !!clientData.client.ad_account_id,
            googleEnabled: clientData.client.google_ads_enabled,
            googleCustomerId: !!clientData.client.google_ads_customer_id,
            googleRefreshToken: !!clientData.client.google_ads_refresh_token
          });
          
          if (!showTabs) {
            // Single platform - show indicator instead of tabs
            return (
              <div className="flex justify-center mb-8">
                <div className="flex items-center space-x-2 px-4 py-2 bg-muted/30 rounded-lg">
                  {hasMetaAds && (
                    <>
                      <BarChart3 className="w-4 h-4 text-navy" />
                      <span className="text-sm font-medium text-text">Meta Ads</span>
                    </>
                  )}
                  {hasGoogleAds && (
                    <>
                      <Target className="w-4 h-4 text-orange" />
                      <span className="text-sm font-medium text-text">Google Ads</span>
                    </>
                  )}
                  {!hasMetaAds && !hasGoogleAds && (
                    <>
                      <AlertCircle className="w-4 h-4 text-muted" />
                      <span className="text-sm text-muted">No advertising platforms configured</span>
                    </>
                  )}
                </div>
              </div>
            );
          }
          
          return (
        <div className="flex justify-center mb-8">
          <div className="relative bg-stroke p-1 rounded-lg">
            <div className="flex space-x-1">
              {/* Meta Ads Tab */}
                  {hasMetaAds && (
              <button
                      onClick={() => handleTabSwitch('meta')}
                      disabled={refreshingData}
                className={`relative px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeAdsProvider === 'meta'
                    ? 'text-white shadow-sm'
                    : 'text-muted hover:text-text'
                      } ${refreshingData ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {activeAdsProvider === 'meta' && (
                  <div className="absolute inset-0 bg-navy rounded-md" />
                )}
                <span className="relative flex items-center space-x-2">
                  <BarChart3 className="w-4 h-4" />
                  <span>Meta Ads</span>
                        {refreshingData && activeAdsProvider === 'meta' && (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        )}
                </span>
              </button>
                  )}

              {/* Google Ads Tab */}
                  {hasGoogleAds && (
              <button
                      onClick={() => {
                        console.log('🎯 GOOGLE TAB CLICKED!');
                        handleTabSwitch('google');
                      }}
                      disabled={refreshingData}
                className={`relative px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeAdsProvider === 'google'
                    ? 'text-white shadow-sm'
                    : 'text-muted hover:text-text'
                      } ${refreshingData ? 'opacity-50 cursor-not-allowed' : ''}`}
                      style={{ zIndex: 10 }}
              >
                {activeAdsProvider === 'google' && (
                  <div className="absolute inset-0 bg-orange rounded-md" />
                )}
                <span className="relative flex items-center space-x-2">
                  <Target className="w-4 h-4" />
                  <span>Google Ads</span>
                        {refreshingData && activeAdsProvider === 'google' && (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        )}
                </span>
              </button>
                  )}
            </div>
          </div>
        </div>
          );
        })()}

        {/* Modern Bar Chart - Main Metrics */}
        <div className="mb-8">
          {activeAdsProvider === 'meta' ? (
            (() => {
              // 🔍 CRITICAL DEBUG: Log what we're passing to MetaPerformanceLive
              const sharedDataToPass = {
                stats: clientData.stats,
                conversionMetrics: clientData.conversionMetrics,
                debug: clientData.debug,
                lastUpdated: clientData.lastUpdated || new Date().toISOString()
              };
              
              console.log('📡 CRITICAL DEBUG - Data being passed to MetaPerformanceLive:', {
                hasStats: !!sharedDataToPass.stats,
                stats: sharedDataToPass.stats,
                hasConversionMetrics: !!sharedDataToPass.conversionMetrics,
                conversionMetrics: sharedDataToPass.conversionMetrics,
                debugSource: sharedDataToPass.debug?.source,
                lastUpdated: sharedDataToPass.lastUpdated
              });
              
              return (
                <MetaPerformanceLive
                  clientId={clientData.client.id}
                  sharedData={sharedDataToPass}
                />
              );
            })()
          ) : (
            (() => {
              // Use Google Ads data directly - no transformation needed as data comes from Google Ads API
              console.log('📊 GOOGLE ADS DATA:', {
                totalSpend: clientData.stats?.totalSpend,
                totalClicks: clientData.stats?.totalClicks,
                totalConversions: clientData.stats?.totalConversions,
                source: clientData.debug?.source,
                reason: clientData.debug?.reason
              });
              
              // Use the data as-is from Google Ads API
              const googleStats = clientData.stats;
              const googleMetrics = clientData.conversionMetrics;
              
              const googleSharedDataToPass = {
                stats: googleStats || {
                  totalSpend: 0,
                  totalImpressions: 0,
                  totalClicks: 0,
                  totalConversions: 0,
                  averageCtr: 0,
                  averageCpc: 0
                },
                conversionMetrics: googleMetrics || {
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
                debug: clientData.debug,
                lastUpdated: clientData.lastUpdated || new Date().toISOString()
              };
              
              console.log('📡 CRITICAL DEBUG - Data being passed to GoogleAdsPerformanceLive:', {
                hasStats: !!googleSharedDataToPass.stats,
                stats: googleSharedDataToPass.stats,
                hasConversionMetrics: !!googleSharedDataToPass.conversionMetrics,
                conversionMetrics: googleSharedDataToPass.conversionMetrics,
                debugSource: googleSharedDataToPass.debug?.source,
                lastUpdated: googleSharedDataToPass.lastUpdated
              });
              
                            return (
            <GoogleAdsPerformanceLive
              clientId={clientData.client.id}
                  sharedData={googleSharedDataToPass as any}
            />
              );
            })()
          )}
        </div>

        {/* Performance Metrics - 3 Animated Cards */}
        <div className="mb-8">
          <AnimatedMetricsCharts
            leads={{
              current: activeAdsProvider === 'meta' 
                ? (clientData.conversionMetrics?.click_to_call || 0) + (clientData.conversionMetrics?.email_contacts || 0)
                : (clientData.conversionMetrics?.click_to_call || 0) + (clientData.conversionMetrics?.email_contacts || 0),
              previous: activeAdsProvider === 'meta'
                ? Math.round((((clientData.conversionMetrics?.click_to_call || 0) + (clientData.conversionMetrics?.email_contacts || 0)) * 0.85))
                : Math.round((((clientData.conversionMetrics?.click_to_call || 0) + (clientData.conversionMetrics?.email_contacts || 0)) * 0.85)),
              change: activeAdsProvider === 'meta' ? 15.0 : 16.7
            }}
            reservations={{
              current: clientData.conversionMetrics?.reservations || 0,
              previous: Math.round(((clientData.conversionMetrics?.reservations || 0) * 0.92)),
              change: activeAdsProvider === 'meta' ? 8.7 : 14.3
            }}
            reservationValue={{
              current: clientData.conversionMetrics?.reservation_value || 0,
              previous: Math.round(((clientData.conversionMetrics?.reservation_value || 0) * 0.88)),
              change: activeAdsProvider === 'meta' ? 12.5 : 13.6
            }}
            isLoading={loading}
          />
        </div>

        {/* Recent Campaigns - Modern Card Design */}
        <div className="bg-bg rounded-2xl p-6 shadow-sm border border-stroke">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-text">
              Ostatnie kampanie {activeAdsProvider === 'meta' ? 'Meta Ads' : 'Google Ads'}
            </h3>
            <button className="text-navy hover:text-navy/80 text-sm font-medium flex items-center space-x-1 hover:bg-page px-3 py-1 rounded-lg transition-all duration-200">
              <span>Zobacz wszystkie</span>
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
          
          {(() => {
            const campaigns = clientData.campaigns;
            
            if (campaigns.length === 0) {
              return (
                <div className="text-center py-12">
                  <Target className="h-16 w-16 text-stroke mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-text mb-2">Brak kampanii</h3>
                  <p className="text-muted">
                    Dane kampanii {activeAdsProvider === 'meta' ? 'Meta Ads' : 'Google Ads'} pojawią się tutaj po wygenerowaniu raportów.
                  </p>
                </div>
              );
            }
            
            return (
              <div className="space-y-3">
                {campaigns.slice(0, 5).map((campaign, index) => (
                  <div key={campaign.id || `campaign-${index}`} className="flex items-center justify-between p-4 bg-page rounded-xl hover:bg-stroke/30 transition-all duration-200 border border-transparent hover:border-stroke group">
                    <div className="flex items-center space-x-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        activeAdsProvider === 'meta' 
                          ? 'bg-navy/10' 
                          : 'bg-orange/10'
                      }`}>
                        <Target className={`h-5 w-5 ${
                          activeAdsProvider === 'meta'
                            ? 'text-navy'
                            : 'text-orange'
                        }`} />
                      </div>
                      <div>
                        <div className="font-medium text-text">{campaign.campaign_name || 'Unnamed Campaign'}</div>
                        <div className="text-sm text-muted">ID: {campaign.campaign_id || 'N/A'}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-6">
                      <div className="text-right">
                        <div className="font-medium text-text tabular-nums">
                          {formatCurrency(campaign.spend || 0, 'PLN')}
                        </div>
                        <div className="text-sm text-muted">Wydatki</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-text tabular-nums">
                          {campaign.clicks?.toLocaleString() || '0'}
                        </div>
                        <div className="text-sm text-muted">Kliknięcia</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-text tabular-nums">
                          {campaign.ctr ? `${(Number(campaign.ctr) || 0).toFixed(2)}%` : '0%'}
                        </div>
                        <div className="text-sm text-muted">CTR</div>
                      </div>
                      <div className="text-muted group-hover:text-text transition-colors duration-200">
                        <ArrowUpRight className="h-4 w-4 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </main>
    </div>
  );
}