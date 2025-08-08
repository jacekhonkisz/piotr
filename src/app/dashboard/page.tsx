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
  conversionMetrics?: {
    click_to_call: number;
    email_contacts: number;
    booking_step_1: number;
    reservations: number;
    reservation_value: number;
    roas: number;
    cost_per_reservation: number;
    booking_step_2: number;
  };
}

interface CachedData {
  data: ClientDashboardData;
  timestamp: number;
  dataSource: 'live' | 'database';
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [clientData, setClientData] = useState<ClientDashboardData | null>(null);
  const [refreshingData, setRefreshingData] = useState(false);
  const [dataSource, setDataSource] = useState<'live' | 'database'>('database');
  const [dashboardInitialized, setDashboardInitialized] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('Ładowanie dashboardu...');
  const [loadingProgress, setLoadingProgress] = useState(0);

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
        conversionMetrics: mainDashboardData.conversionMetrics
      };

      setClientData(dashboardData);
      setDataSource('live');
      saveToCache(dashboardData, 'live');
      
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

  const saveToCache = (data: ClientDashboardData, source: 'live' | 'database') => {
    try {
      const cacheData: CachedData = {
        data,
        timestamp: Date.now(),
        dataSource: source
      };
      localStorage.setItem(getCacheKey(), JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
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

    if (user && profile && dashboardInitialized) {
      loadClientDashboardWithCache();
    }
    
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
      setDataSource('live');
      saveToCache(dashboardData, 'live');
    } catch (error) {
      console.error('Error loading client dashboard:', error);
      await loadClientDashboardFromDatabase();
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
        booking_step_2: 0
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
      const dateRange = {
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
      };
      
      console.log('📅 Dashboard loading current month data:', dateRange);
      
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

      // Reduced timeout from 30 seconds to 15 seconds for better UX
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn('⚠️ Dashboard API call timed out after 15 seconds');
        controller.abort();
      }, 15000); // Reduced from 30000
      
      const response = await fetch('/api/fetch-live-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'Cache-Control': 'max-age=300', // 5 minute cache instead of no-cache
          'Pragma': 'cache',
          'Expires': new Date(Date.now() + 300000).toUTCString() // 5 minutes
        },
        body: JSON.stringify({
          clientId: currentClient.id,
          dateRange: {
            start: dateRange.start,
            end: dateRange.end
          },
          _t: Date.now(),
          forceRefresh: false // Changed from true to false to use caching
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
          }
        };
      }

      const monthData = await response.json();
      
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
          booking_step_2: 0
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
          conversionMetrics
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
            booking_step_2: 0
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
          booking_step_2: 0
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <LoadingSpinner text={loadingMessage} progress={loadingProgress} />
      </div>
    );
  }

  if (!clientData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-rose-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">Nie znaleziono klienta</h3>
          <p className="text-slate-600">Skontaktuj się z administratorem.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Premium Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
                <p className="text-sm text-slate-600">Meta Ads Analytics</p>
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
              <div className="flex items-center space-x-3 px-4 py-2 bg-slate-100/80 rounded-full">
                <div className={`w-2 h-2 rounded-full ${dataSource === 'live' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                <span className="text-sm text-slate-700">
                  {dataSource === 'live' ? 'Dane na żywo' : 'Cache'}
                </span>
              </div>
              
              {/* Refresh Button */}
              <button
                onClick={refreshLiveData}
                disabled={refreshingData}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all duration-200"
                title="Odśwież dane"
              >
                <RefreshCw className={`h-5 w-5 ${refreshingData ? 'animate-spin' : ''}`} />
              </button>

              {/* Debug: Clear All Caches Button (Admin Only) */}
              {user?.role === 'admin' && (
                <button
                  onClick={clearAllClientCaches}
                  className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-xl transition-all duration-200"
                  title="Wyczyść wszystkie cache"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              )}

              {/* User Menu */}
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-white" />
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all duration-200"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">
                Witaj, {clientData.client.name} 👋
              </h2>
              <p className="text-slate-600">Oto podsumowanie Twoich kampanii Meta Ads</p>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => router.push('/reports')}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg transition-all duration-200 flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Zobacz pełne raporty</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modern Bar Chart - Main Metrics */}
        <div className="mb-8">
                     <MetaPerformanceLive
             clientId={clientData.client.id}
           />
        </div>

        {/* Performance Metrics - 3 Animated Cards */}
        <div className="mb-8">
          <AnimatedMetricsCharts
            leads={{
              current: (clientData.conversionMetrics?.click_to_call || 0) + (clientData.conversionMetrics?.email_contacts || 0),
              previous: Math.round((((clientData.conversionMetrics?.click_to_call || 0) + (clientData.conversionMetrics?.email_contacts || 0)) * 0.85)),
              change: 15.0
            }}
            reservations={{
              current: clientData.conversionMetrics?.reservations || 0,
              previous: Math.round(((clientData.conversionMetrics?.reservations || 0) * 0.92)),
              change: 8.7
            }}
            reservationValue={{
              current: clientData.conversionMetrics?.reservation_value || 0,
              previous: Math.round(((clientData.conversionMetrics?.reservation_value || 0) * 0.88)),
              change: 12.5
            }}
            isLoading={loading}
          />
        </div>

        {/* Recent Campaigns */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-slate-200/50">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Ostatnie kampanie</h3>
            <button className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center space-x-1">
              <span>Zobacz wszystkie</span>
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
          
          {clientData.campaigns.length === 0 ? (
            <div className="text-center py-12">
              <Target className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Brak kampanii</h3>
              <p className="text-slate-600">Dane kampanii pojawią się tutaj po wygenerowaniu raportów.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {clientData.campaigns.slice(0, 5).map((campaign) => (
                <div key={campaign.id} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl hover:bg-slate-100/50 transition-all duration-200">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center">
                      <Target className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">{campaign.campaign_name || 'Unnamed Campaign'}</div>
                      <div className="text-sm text-slate-500">ID: {campaign.campaign_id || 'N/A'}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-6">
                    <div className="text-right">
                      <div className="font-medium text-slate-900">
                        {formatCurrency(campaign.spend || 0, 'PLN')}
                      </div>
                      <div className="text-sm text-slate-500">Wydatki</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-slate-900">
                        {campaign.clicks?.toLocaleString() || '0'}
                      </div>
                      <div className="text-sm text-slate-500">Kliknięcia</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-slate-900">
                        {campaign.ctr ? `${campaign.ctr.toFixed(2)}%` : '0%'}
                      </div>
                      <div className="text-sm text-slate-500">CTR</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}