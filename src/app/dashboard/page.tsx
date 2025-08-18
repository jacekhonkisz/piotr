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
import LoadingSpinner from '../../components/LoadingSpinner';

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

  // Mock Google Ads campaigns data
  const mockGoogleAdsCampaigns = [
    {
      id: 'gads-1',
      campaign_name: '[PBM] HOT | Remarketing | www i SM',
      campaign_id: '2385172329403015',
      spend: 70,
      clicks: 49,
      ctr: 1.03,
      impressions: 4756
    },
    {
      id: 'gads-2', 
      campaign_name: '[PBM] Hot | Remarketing dynamiczny',
      campaign_id: '2385358331190015',
      spend: 23,
      clicks: 19,
      ctr: 1.41,
      impressions: 1348
    },
    {
      id: 'gads-3',
      campaign_name: '[PBM] Cold | Aktywność | Fani FB', 
      campaign_id: '2385762175720015',
      spend: 5,
      clicks: 15,
      ctr: 3.70,
      impressions: 405
    },
    {
      id: 'gads-4',
      campaign_name: '[PBM] Kampania Advantage+ | Ogólna | Lux V3 - 30% Kampania',
      campaign_id: '1202021372357001016',
      spend: 109,
      clicks: 334,
      ctr: 2.77,
      impressions: 12050
    },
    {
      id: 'gads-5',
      campaign_name: '[PBM] Ruch | Profil Instagramowy',
      campaign_id: '1202161348620101016',
      spend: 5,
      clicks: 7,
      ctr: 2.54,
      impressions: 276
    }
  ];

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
    setSelectedClient(client);
    setLoading(true);
    setLoadingMessage('Ładowanie danych klienta...');
    setLoadingProgress(25);
    
    // Clear cache for the new client to ensure fresh data
    clearCache();
    
    try {
      setLoadingMessage('Pobieranie danych z Meta API...');
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
        campaigns: mainDashboardData.campaigns,
        stats: mainDashboardData.stats,
        conversionMetrics: mainDashboardData.conversionMetrics,
        // Add debug info for components
        debug: mainDashboardData.debug,
        lastUpdated: new Date().toISOString()
      };

      setClientData(dashboardData);
      setDataSource(mainDashboardData.debug?.source || 'database');
      
      setLoadingProgress(100);
      setLoadingMessage('Gotowe!');
      
      // Small delay to show completion
      setTimeout(() => {
        setLoading(false);
        setLoadingMessage('Ładowanie dashboardu...');
        setLoadingProgress(0);
      }, 500);
    } catch (error) {
      console.error('Error loading client data:', error);
      setLoadingMessage('Błąd ładowania danych');
      setTimeout(() => {
        setLoading(false);
        setLoadingMessage('Ładowanie dashboardu...');
        setLoadingProgress(0);
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
    };
  }, []);

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
    if (loadingRef.current) return;
    
    loadingRef.current = true;
    setLoading(true);
    
    try {
      // Check if we have cached data
      const cached = localStorage.getItem(getCacheKey());
      if (cached) {
        try {
          const cacheData: CachedData = JSON.parse(cached);
          const cacheAge = Date.now() - cacheData.timestamp;
          const maxCacheAge = 5 * 60 * 1000; // 5 minutes
          
          if (cacheAge < maxCacheAge) {
            console.log('📦 Using cached dashboard data');
            setClientData(cacheData.data);
            setDataSource(cacheData.dataSource);
            setLoading(false);
            return;
          }
        } catch (error) {
          console.error('Error parsing cached data:', error);
        }
      }
      
      // No valid cache, load fresh data
      await loadClientDashboard();
    } catch (error) {
      console.error('Error loading dashboard with cache:', error);
      setLoading(false);
    } finally {
      loadingRef.current = false;
    }
  };

  const loadClientDashboard = async () => {
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
        campaigns: mainDashboardData.campaigns,
        stats: mainDashboardData.stats,
        conversionMetrics: mainDashboardData.conversionMetrics
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

  const loadMainDashboardData = async (currentClient: any) => {
    try {
      // Use the same date range logic as smart cache helper to ensure proper cache detection
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const dateRange = {
        start: `${year}-${String(month).padStart(2, '0')}-01`,
        end: new Date(year, month, 0).toISOString().split('T')[0] // Last day of current month
      };
      
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

      // Increased timeout to 30 seconds for smart cache system
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn('⚠️ Dashboard API call timed out after 30 seconds');
        controller.abort();
      }, 30000);
      
      // Use fetch-live-data with smart caching enabled (no force refresh)
      const response = await fetch('/api/fetch-live-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          clientId: currentClient.id,
          dateRange: dateRange,
          forceFresh: true  // 🔧 TEMPORARY: Force live data for booking steps testing
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn('⚠️ Dashboard API call failed:', response.status, response.statusText);
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
            campaigns: [], // Add empty campaigns to debug
            source: 'session-error-fallback'
          }
        };
      }

      const monthData = await response.json();
      
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
        console.log('🚀 ✅ SMART CACHE HIT! Dashboard loaded from fresh cache in', monthData.debug.responseTime + 'ms');
      } else if (monthData.debug?.source === 'stale-cache') {
        console.log('⚡ ✅ SMART CACHE STALE! Dashboard loaded from stale cache in', monthData.debug.responseTime + 'ms');
      } else if (monthData.debug?.source === 'live-api-cached') {
        console.log('🔄 ✅ LIVE API + CACHE! Dashboard fetched fresh data and cached it in', monthData.debug.responseTime + 'ms');
      } else {
        console.log('🐌 ❌ NO SMART CACHE! Dashboard loaded from', monthData.debug?.source, 'in', monthData.debug.responseTime + 'ms');
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
      
      if (monthData.success && monthData.data?.campaigns) {
        const campaigns = monthData.data.campaigns.map((campaign: any) => ({
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

        return {
          campaigns,
          stats: {
            totalSpend,
            totalImpressions,
            totalClicks,
            totalConversions,
            averageCtr,
            averageCpc
          },
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
    } catch (error) {
      console.error('❌ Error loading dashboard data:', error);
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
          source: 'catch-error-fallback'
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
        <LoadingSpinner text={loadingMessage} progress={loadingProgress} />
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

        {/* Ads Provider Toggle - Simple without container */}
        <div className="flex justify-center mb-8">
          <div className="relative bg-stroke p-1 rounded-lg">
            <div className="flex space-x-1">
              {/* Meta Ads Tab */}
              <button
                onClick={() => setActiveAdsProvider('meta')}
                className={`relative px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeAdsProvider === 'meta'
                    ? 'text-white shadow-sm'
                    : 'text-muted hover:text-text'
                }`}
              >
                {activeAdsProvider === 'meta' && (
                  <div className="absolute inset-0 bg-navy rounded-md" />
                )}
                <span className="relative flex items-center space-x-2">
                  <BarChart3 className="w-4 h-4" />
                  <span>Meta Ads</span>
                </span>
              </button>

              {/* Google Ads Tab */}
              <button
                onClick={() => setActiveAdsProvider('google')}
                className={`relative px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeAdsProvider === 'google'
                    ? 'text-white shadow-sm'
                    : 'text-muted hover:text-text'
                }`}
              >
                {activeAdsProvider === 'google' && (
                  <div className="absolute inset-0 bg-orange rounded-md" />
                )}
                <span className="relative flex items-center space-x-2">
                  <Target className="w-4 h-4" />
                  <span>Google Ads</span>
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Modern Bar Chart - Main Metrics */}
        <div className="mb-8">
          {activeAdsProvider === 'meta' ? (
            <MetaPerformanceLive
              clientId={clientData.client.id}
              sharedData={{
                stats: clientData.stats,
                conversionMetrics: clientData.conversionMetrics,
                debug: clientData.debug,
                lastUpdated: clientData.lastUpdated || new Date().toISOString()
              }}
            />
          ) : (
            <GoogleAdsPerformanceLive
              clientId={clientData.client.id}
            />
          )}
        </div>

        {/* Performance Metrics - 3 Animated Cards */}
        <div className="mb-8">
          <AnimatedMetricsCharts
            leads={{
              current: activeAdsProvider === 'meta' 
                ? (clientData.conversionMetrics?.click_to_call || 0) + (clientData.conversionMetrics?.email_contacts || 0)
                : 28, // Mock Google Ads leads data
              previous: activeAdsProvider === 'meta'
                ? Math.round((((clientData.conversionMetrics?.click_to_call || 0) + (clientData.conversionMetrics?.email_contacts || 0)) * 0.85))
                : 24,
              change: activeAdsProvider === 'meta' ? 15.0 : 16.7
            }}
            reservations={{
              current: activeAdsProvider === 'meta'
                ? clientData.conversionMetrics?.reservations || 0
                : 8, // Mock Google Ads reservations
              previous: activeAdsProvider === 'meta'
                ? Math.round(((clientData.conversionMetrics?.reservations || 0) * 0.92))
                : 7,
              change: activeAdsProvider === 'meta' ? 8.7 : 14.3
            }}
            reservationValue={{
              current: activeAdsProvider === 'meta'
                ? clientData.conversionMetrics?.reservation_value || 0
                : 12500, // Mock Google Ads reservation value
              previous: activeAdsProvider === 'meta'
                ? Math.round(((clientData.conversionMetrics?.reservation_value || 0) * 0.88))
                : 11000,
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
            const campaigns = activeAdsProvider === 'meta' ? clientData.campaigns : mockGoogleAdsCampaigns;
            
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
                {campaigns.slice(0, 5).map((campaign) => (
                  <div key={campaign.id} className="flex items-center justify-between p-4 bg-page rounded-xl hover:bg-stroke/30 transition-all duration-200 border border-transparent hover:border-stroke group">
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
                          {campaign.ctr ? `${campaign.ctr.toFixed(2)}%` : '0%'}
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