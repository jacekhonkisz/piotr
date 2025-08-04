'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Eye, 
  Download,
  Target,
  Activity,
  RefreshCw,
  FileText,
  Building,
  Mail,
  Clock,
  AlertCircle,
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../components/AuthProvider';
import { supabase } from '../../lib/supabase';
import { getClientDashboardData } from '../../lib/database';
import type { Database } from '../../lib/database.types';
import LoadingSpinner from '../../components/LoadingSpinner';

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
}

interface CachedData {
  data: ClientDashboardData;
  timestamp: number;
  dataSource: 'live' | 'database';
}

// Cache duration: 5 minutes for live data (300000 milliseconds)


export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [clientData, setClientData] = useState<ClientDashboardData | null>(null);

  const [refreshingData, setRefreshingData] = useState(false);
  const [dataSource, setDataSource] = useState<'live' | 'database'>('database');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dashboardInitialized, setDashboardInitialized] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { user, profile, authLoading, signOut } = useAuth();
  const router = useRouter();

  // Prevent multiple concurrent loads
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

  // Get cache key for current user
  const getCacheKey = () => `dashboard_cache_${user?.email || 'anonymous'}`;



  // Save data to cache
  const saveToCache = (data: ClientDashboardData, source: 'live' | 'database') => {
    try {
      const cacheData: CachedData = {
        data,
        timestamp: Date.now(),
        dataSource: source
      };
      localStorage.setItem(getCacheKey(), JSON.stringify(cacheData));
      setLastUpdated(new Date());
      console.log('Data saved to cache with source:', source);
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  };

  // Clear cache for current user
  const clearCache = () => {
    localStorage.removeItem(getCacheKey());
    console.log('Cache cleared');
  };

  // Force cache clear for live data testing
  useEffect(() => {
    console.log('🧹 Clearing all dashboard cache for live data testing...');
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('dashboard_cache_')) {
        localStorage.removeItem(key);
        console.log('🗑️ Cleared cache:', key);
      }
    });
  }, []); // Clear cache on every load for testing

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      loadingRef.current = false;
    };
  }, []);

  // Simplified dashboard loading effect
  useEffect(() => {
    // Skip if already initializing, auth loading, or no user
    if (loadingRef.current || authLoading || !user) {
      if (!user && !authLoading) {
        console.log('No user, redirecting to login');
        router.replace('/auth/login');
      }
      return;
    }

    // If we have user but no profile yet, wait a bit more (but not infinitely)
    if (!profile) {
      const timeout = setTimeout(() => {
        if (!profile && user) {
          console.log('Profile loading took too long, proceeding anyway');
          setDashboardInitialized(true);
          setLoading(false);
        }
      }, 2000); // Much shorter timeout

      return () => clearTimeout(timeout);
    }

    // Initialize dashboard once we have user and profile
    if (user && profile && !dashboardInitialized) {
      console.log('Initializing dashboard for role:', profile.role);
      setDashboardInitialized(true);
      
      if (profile.role === 'admin') {
        // Redirect admins to admin page instead of showing dashboard
        router.replace('/admin');
        return;
      } else {
        loadClientDashboardWithCache();
      }
    }
  }, [user, profile, authLoading, dashboardInitialized, router]);



  const loadClientDashboardWithCache = async () => {
    if (loadingRef.current) return;
    
    try {
      loadingRef.current = true;
      setLoading(true);
      
      // Always try to fetch live data first (real-time from Meta API)
      console.log('🔄 Loading live data from Meta API...');
      await loadClientDashboard();
    } catch (error) {
      console.error('Error loading client dashboard:', error);
      // Only fallback to database if live data completely fails
      console.log('⚠️ Live data failed, falling back to database...');
      await loadClientDashboardFromDatabase();
    } finally {
      loadingRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const loadClientDashboard = async () => {
    try {
      console.log('Loading client dashboard for user:', user!.email);
      
      // Get session token for API call - try refreshing first
      console.log('🔄 Refreshing session...');
      const { data: refreshedSession, error: refreshError } = await supabase.auth.refreshSession();
      
      const sessionToUse = refreshedSession?.session || (await supabase.auth.getSession()).data.session;
      
      console.log('🔑 Dashboard session check:', {
        hasSession: !!sessionToUse,
        hasAccessToken: !!sessionToUse?.access_token,
        tokenPreview: sessionToUse?.access_token ? sessionToUse.access_token.substring(0, 20) + '...' : 'none',
        refreshError: refreshError?.message
      });
      
      if (!sessionToUse?.access_token) {
        console.error('No session token available');
        return;
      }

      // Get client data first to get the client ID
      // For client users, find by email; for admin users, find by admin_id
      if (!user!.email) {
        console.error('User email is required');
        return;
      }
      
      const { data: currentClient } = await supabase
        .from('clients')
        .select('*')
        .eq(user!.role === 'admin' ? 'admin_id' : 'email', user!.role === 'admin' ? user!.id : user!.email)
        .single();

      if (!currentClient) {
        console.error('No client data found for user:', user!.email);
        return;
      }

      // Fetch live data from Meta API with cache busting
      const response = await fetch('/api/fetch-live-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToUse.access_token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        body: JSON.stringify({
          clientId: currentClient.id,
          dateRange: {
            start: '2024-01-01', // Broader range to capture all historical data
            end: new Date().toISOString().split('T')[0]
          },
          _t: Date.now() // Cache busting timestamp
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to fetch live data:', error);
        
        // Throw error to trigger fallback in parent function
        throw new Error(`API failed: ${error.error || 'Unknown error'}`);
      }

      const result = await response.json();
      console.log('Live data fetched successfully:', result);
      console.log('🔍 Currency from main API call:', result.data?.client?.currency);
      console.log('🔍 Full client data from main API:', result.data?.client);
      
      // Check for Meta API errors in debug info
      if (result.debug?.hasMetaApiError) {
        console.warn('⚠️ Meta API Error detected:', result.debug.metaApiError);
        alert(`Meta API Issue: ${result.debug.metaApiError}\n\nThis might explain why data shows zeros. Please check your Meta Ads account permissions and token.`);
      }

      // Get reports from database using the current client
      const { data: reports } = await supabase
        .from('reports')
        .select('*')
        .eq('client_id', currentClient.id)
        .order('generated_at', { ascending: false })
        .limit(10);

      const dashboardData = {
        client: result.data.client,
        reports: reports || [],
        campaigns: result.data.campaigns.map((campaign: any) => ({
          id: campaign.campaign_id,
          campaign_id: campaign.campaign_id,
          campaign_name: campaign.campaign_name,
          spend: campaign.spend,
          impressions: campaign.impressions,
          clicks: campaign.clicks,
          conversions: campaign.conversions,
          ctr: campaign.ctr,
          cpc: campaign.cpc,
          date_range_start: result.data.dateRange.start,
          date_range_end: result.data.dateRange.end
        })),
        stats: result.data.stats
      };

      setClientData(dashboardData);
      setDataSource('live');
      setLastUpdated(new Date());
      
      // Save to cache with live data
      saveToCache(dashboardData, 'live');
      
      console.log('✅ Live data loaded successfully:', {
        totalSpend: dashboardData.stats.totalSpend,
        totalImpressions: dashboardData.stats.totalImpressions,
        totalClicks: dashboardData.stats.totalClicks,
        campaignsCount: dashboardData.campaigns.length
      });
    } catch (error) {
      console.error('Error loading client dashboard:', error);
      // Fallback to database data
      await loadClientDashboardFromDatabase();
    }
  };

  const loadClientDashboardFromDatabase = async () => {
    try {
      console.log('Loading dashboard data from database (fallback)');
      
      // Get client data first - find by email for client users, admin_id for admin users
      if (!user!.email) {
        console.error('User email is required');
        return;
      }
      
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq(user!.role === 'admin' ? 'admin_id' : 'email', user!.role === 'admin' ? user!.id : user!.email)
        .single();

      if (clientError || !clientData) {
        console.error('Client not found:', clientError);
        return;
      }

      console.log('Client data found:', clientData.id);

      // Use optimized database function
      const dashboardData = await getClientDashboardData(clientData.id);
      console.log('Dashboard data loaded from database:', {
        reportsCount: dashboardData.reports.length,
        campaignsCount: dashboardData.campaigns.length
      });

      // Calculate stats efficiently
      const stats = dashboardData.campaigns.reduce((acc, campaign) => {
        acc.totalSpend += campaign.spend || 0;
        acc.totalImpressions += campaign.impressions || 0;
        acc.totalClicks += campaign.clicks || 0;
        acc.totalConversions += campaign.conversions || 0;
        return acc;
      }, {
        totalSpend: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalConversions: 0
      });

      const averageCtr = stats.totalImpressions > 0 ? (stats.totalClicks / stats.totalImpressions) * 100 : 0;
      const averageCpc = stats.totalClicks > 0 ? stats.totalSpend / stats.totalClicks : 0;

      const finalDashboardData = {
        client: dashboardData.client,
        reports: dashboardData.reports.slice(0, 10), // Limit to 10 most recent
        campaigns: dashboardData.campaigns.slice(0, 50), // Limit to 50 most recent
        stats: {
          ...stats,
          averageCtr,
          averageCpc
        }
      };

      setClientData(finalDashboardData);
      setDataSource('database');
      
      // Save to cache
      saveToCache(finalDashboardData, 'database');
    } catch (error) {
      console.error('Error loading client dashboard from database:', error);
    }
  };



  const refreshLiveData = async () => {
    if (!user || loadingRef.current || refreshingData) return;
    
    setRefreshingData(true);
    try {
      // Clear cache and force refresh
      clearCache();
      await loadClientDashboardWithCache();
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      if (mountedRef.current) {
        setRefreshingData(false);
      }
    }
  };

  // Format last updated time
  const formatLastUpdated = () => {
    if (!lastUpdated) return '';
    const now = new Date();
    const diffMs = now.getTime() - lastUpdated.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins === 0) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    return lastUpdated.toLocaleDateString();
  };

  // State for current month data
  const [currentMonthData, setCurrentMonthData] = useState<{
    campaigns: any[];
    stats: {
      totalSpend: number;
      totalImpressions: number;
      totalClicks: number;
      totalConversions: number;
      averageCtr: number;
      averageCpc: number;
      roas: number;
      campaignCount: number;
    } | null;
    currency: string;
  }>({ campaigns: [], stats: null, currency: 'USD' });

  // Load data for current month from Meta API
  const loadCurrentMonthData = async (month: Date) => {
    try {
      const year = month.getFullYear();
      const monthNum = month.getMonth();
      
      // Generate date range for the month
      const startDate = new Date(year, monthNum, 1);
      const endDate = new Date(year, monthNum + 1, 0); // Last day of the month
      
      const monthStartDate = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
      const monthEndDate = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
      
      console.log(`📅 Loading dashboard data for ${monthStartDate} to ${monthEndDate}`);
      
      // Get session for API calls
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.log('No session token available');
        return;
      }

      // Get client data to get the client ID
      // For client users, find by email; for admin users, find by admin_id
      if (!user!.email) {
        console.error('User email is required');
        return;
      }
      
      const { data: currentClient } = await supabase
        .from('clients')
        .select('*')
        .eq(user!.role === 'admin' ? 'admin_id' : 'email', user!.role === 'admin' ? user!.id : user!.email)
        .single();

      if (!currentClient) {
        console.error('No client data found for user:', user!.email);
        return;
      }

      // Fetch data from Meta API for this month with cache busting
      const response = await fetch('/api/fetch-live-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        body: JSON.stringify({
          clientId: currentClient.id,
          dateRange: {
            start: monthStartDate,
            end: monthEndDate
          },
          _t: Date.now() // Cache busting timestamp
        })
      });

      if (!response.ok) {
        console.log(`API call failed for ${monthStartDate} to ${monthEndDate}`);
        // Set empty data instead of null
        setCurrentMonthData({
          campaigns: [],
          stats: {
            totalSpend: 0,
            totalImpressions: 0,
            totalClicks: 0,
            totalConversions: 0,
            averageCtr: 0,
            averageCpc: 0,
            roas: 0,
            campaignCount: 0
          },
          currency: 'USD'
        });
        return;
      }

      const monthData = await response.json();
      
      if (monthData.success && monthData.data?.campaigns) {
        const campaigns = monthData.data.campaigns.map((campaign: any) => ({
          id: campaign.campaign_id,
          campaign_id: campaign.campaign_id,
          campaign_name: campaign.campaign_name,
          spend: campaign.spend || 0,
          impressions: campaign.impressions || 0,
          clicks: campaign.clicks || 0,
          conversions: campaign.conversions || 0,
          ctr: campaign.ctr || 0,
          cpc: campaign.cpc || 0,
          date_range_start: monthStartDate,
          date_range_end: monthEndDate
        }));

        // Calculate stats
        const totalSpend = campaigns.reduce((sum: number, campaign: any) => sum + (campaign.spend || 0), 0);
        const totalImpressions = campaigns.reduce((sum: number, campaign: any) => sum + (campaign.impressions || 0), 0);
        const totalClicks = campaigns.reduce((sum: number, campaign: any) => sum + (campaign.clicks || 0), 0);
        const totalConversions = campaigns.reduce((sum: number, campaign: any) => sum + (campaign.conversions || 0), 0);
        
        const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
        const averageCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
        const roas = totalConversions > 0 ? (totalConversions * 50 / totalSpend) : 0;

        // Get currency from the API response
        const currency = monthData.data?.client?.currency || 'USD';
        console.log(`💰 Using currency from API response: ${currency}`);
        console.log('🔍 Full monthData response:', monthData);
        console.log('🔍 Client data from API:', monthData.data?.client);

        setCurrentMonthData({
          campaigns,
          stats: {
            totalSpend,
            totalImpressions,
            totalClicks,
            totalConversions,
            averageCtr,
            averageCpc,
            roas,
            campaignCount: campaigns.length
          },
          currency
        });
      } else {
        // No data for this month - set empty stats
        setCurrentMonthData({
          campaigns: [],
          stats: {
            totalSpend: 0,
            totalImpressions: 0,
            totalClicks: 0,
            totalConversions: 0,
            averageCtr: 0,
            averageCpc: 0,
            roas: 0,
            campaignCount: 0
          },
          currency: 'USD'
        });
      }
    } catch (error) {
      console.error('Error loading current month data:', error);
      // Set empty data on error
      setCurrentMonthData({
        campaigns: [],
        stats: {
          totalSpend: 0,
          totalImpressions: 0,
          totalClicks: 0,
          totalConversions: 0,
          averageCtr: 0,
          averageCpc: 0,
          roas: 0,
          campaignCount: 0
        },
        currency: 'USD'
      });
    }
  };

  // Load data when month changes
  useEffect(() => {
    if (clientData && currentMonth) {
      loadCurrentMonthData(currentMonth);
    }
  }, [currentMonth, clientData]);



  // Navigate to previous/next month (unlimited)
  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'next') {
      newMonth.setMonth(newMonth.getMonth() + 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() - 1);
    }
    setCurrentMonth(newMonth);
  };

  // Generate month options for dropdown (last 2 years + future 6 months)
  const generateMonthOptions = () => {
    const months: { value: string; label: string }[] = [];
    const currentDate = new Date();
    const twoYearsAgo = new Date(currentDate.getFullYear() - 2, 0, 1);
    const sixMonthsAhead = new Date(currentDate.getFullYear(), currentDate.getMonth() + 6, 1);
    
    let currentMonth = new Date(twoYearsAgo);
    
    while (currentMonth <= sixMonthsAhead) {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const monthId = `${year}-${String(month).padStart(2, '0')}`;
      const monthName = getCurrentMonthName(currentMonth);
      months.push({ value: monthId, label: monthName });
      currentMonth = new Date(year, month, 1);
    }
    
    return months;
  };

  // Get month name for any date
  const getCurrentMonthName = (date: Date = currentMonth || new Date()) => {
    const months = [
      'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
      'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
    ];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  // Handle month selection from dropdown
  const handleMonthChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const [year, month] = event.target.value.split('-').map(Number);
    if (year && month) {
      const newMonth = new Date(year, month - 1, 1);
      setCurrentMonth(newMonth);
    }
  };

  // Format currency based on the account currency
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
    
    // Special handling for PLN to ensure proper formatting
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner text="Loading dashboard..." />
      </div>
    );
  }



  // Client Dashboard
  if (!clientData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Client not found</h3>
          <p className="text-gray-600">Please contact your administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-primary-600" />
              <div className="ml-3">
                <h1 className="text-xl font-semibold text-gray-900">
                  {clientData.client.name} Dashboard
                </h1>
                <p className="text-sm text-gray-600">Meta Ads Performance Analytics</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* Data Source and Last Updated Indicator */}
              <div className="flex items-center text-sm">
                <div className={`w-2 h-2 rounded-full mr-2 ${dataSource === 'live' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                <div className="flex flex-col">
                  <span className="text-gray-600">
                    {dataSource === 'live' ? 'Live Data' : 'Database'}
                  </span>
                  {lastUpdated && (
                    <span className="text-xs text-gray-500">
                      Updated {formatLastUpdated()}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Refresh Button */}
              <button
                onClick={refreshLiveData}
                disabled={refreshingData}
                className="btn-secondary"
                title="Refresh live data from Meta API (clears 1-hour cache)"
              >
                {refreshingData ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Data
                  </>
                )}
              </button>
              

              <button
                onClick={handleLogout}
                className="btn-secondary"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Log Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Data Source Notice */}
        <div className={`border rounded-lg p-4 mb-6 ${
          dataSource === 'live' 
            ? 'bg-green-50 border-green-200' 
            : 'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className={`w-2 h-2 rounded-full ${
                  dataSource === 'live' ? 'bg-green-500 animate-pulse' : 'bg-blue-500'
                }`}></div>
              </div>
              <div className="ml-3">
                <p className={`text-sm ${
                  dataSource === 'live' ? 'text-green-800' : 'text-blue-800'
                }`}>
                  <strong>
                    {dataSource === 'live' ? 'Live Data:' : 'Cached Data:'}
                  </strong>{' '}
                  {dataSource === 'live' 
                    ? 'Showing real-time campaign performance from Meta Ads API'
                    : 'Showing cached data from database. Data refreshes automatically every hour.'
                  }
                </p>
                {lastUpdated && (
                  <p className={`text-xs mt-1 ${
                    dataSource === 'live' ? 'text-green-600' : 'text-blue-600'
                  }`}>
                    Last updated: {formatLastUpdated()}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center text-xs text-gray-500">
              <Clock className="h-3 w-3 mr-1" />
              <span>Auto-refresh: 1 hour</span>
            </div>
          </div>
        </div>
        
        {/* Client Info */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="h-12 w-12 bg-primary-100 rounded-full flex items-center justify-center">
                <Building className="h-6 w-6 text-primary-600" />
              </div>
              <div className="ml-4">
                <h2 className="text-lg font-semibold text-gray-900">{clientData.client.name}</h2>
                <div className="flex items-center text-sm text-gray-600">
                  <Mail className="h-4 w-4 mr-1" />
                  {clientData.client.email}
                </div>
                {clientData.client.company && (
                  <div className="text-sm text-gray-500">{clientData.client.company}</div>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Last Report</div>
              <div className="text-lg font-semibold text-gray-900">
                {clientData.client.last_report_date ? 
                  new Date(clientData.client.last_report_date).toLocaleDateString() : 
                  'No reports yet'
                }
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Spend</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {formatCurrency(clientData.stats.totalSpend, currentMonthData.currency)}
                  </p>
                </div>
              </div>
              {dataSource === 'live' && (
                <div className="flex items-center text-xs text-green-600">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1 animate-pulse"></div>
                  LIVE
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Eye className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Impressions</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {clientData.stats.totalImpressions.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Target className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Clicks</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {clientData.stats.totalClicks.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">CTR</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {clientData.stats.averageCtr.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Performance Overview - Redesigned "One Glance" Version */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
          {/* Header with Month Navigation */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              <h2 className="text-2xl font-bold text-gray-900">Podsumowanie Miesięczne</h2>
              
              {/* Month Navigation */}
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => navigateMonth('prev')}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Poprzedni miesiąc"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-600" />
                </button>
                
                {/* Month Picker Dropdown */}
                <select
                  value={`${currentMonth?.getFullYear() || new Date().getFullYear()}-${String((currentMonth?.getMonth() || new Date().getMonth()) + 1).padStart(2, '0')}`}
                  onChange={handleMonthChange}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {generateMonthOptions().map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                
                <button 
                  onClick={() => navigateMonth('next')}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Następny miesiąc"
                >
                  <ChevronRight className="h-5 w-5 text-gray-600" />
                </button>
              </div>
            </div>
            
            <button
              onClick={() => router.push('/reports')}
              className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center"
            >
              Pokaż więcej
              <ChevronRight className="h-4 w-4 ml-1" />
            </button>
          </div>
          
          {clientData.reports.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Brak raportów</h3>
              <p className="text-gray-600 mb-4">Raporty są generowane automatycznie na podstawie wydajności kampanii.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Debug Info - Remove this after fixing */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-yellow-800 mb-2">Debug Info:</h4>
                <div className="text-sm text-yellow-700 space-y-1">
                  <div>Current Month: {getCurrentMonthName(currentMonth || new Date())} ({currentMonth?.getFullYear() || new Date().getFullYear()}-{currentMonth ? currentMonth.getMonth() + 1 : new Date().getMonth() + 1})</div>
                  <div>Meta API Campaigns: {currentMonthData.campaigns.length}</div>
                  <div>Meta API Stats: {currentMonthData.stats ? 'Loaded' : 'Loading...'}</div>
                  <div>Data Source: Meta API (Live)</div>
                </div>
              </div>

              {/* Top KPI Stats - 6 Key Metrics */}
              {(() => {
                const stats = currentMonthData.stats;
                
                if (!stats) {
                  return (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">Ładowanie danych z Meta API...</p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
                    {/* Wydatki */}
                    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-300 group relative">
                      <div className="flex items-center justify-between mb-2">
                        <DollarSign className="h-5 w-5 text-blue-600" />
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      </div>
                      <div className="text-2xl font-bold text-gray-900 mb-1">
                        {formatCurrency(stats?.totalSpend || 0, currentMonthData.currency)}
                      </div>
                      <div className="text-sm text-gray-600">Wydatki</div>
                      <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-900 text-white text-xs rounded-lg p-2 -mt-2 ml-2 pointer-events-none z-10">
                        Całkowite wydatki na reklamy w tym miesiącu
                      </div>
                    </div>

                    {/* Wyświetlenia */}
                    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-300 group relative">
                      <div className="flex items-center justify-between mb-2">
                        <Eye className="h-5 w-5 text-green-600" />
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      </div>
                      <div className="text-2xl font-bold text-gray-900 mb-1">
                        {((stats?.totalImpressions || 0) / 1000).toFixed(1)}k
                      </div>
                      <div className="text-sm text-gray-600">Wyświetlenia</div>
                      <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-900 text-white text-xs rounded-lg p-2 -mt-2 ml-2 pointer-events-none z-10">
                        Liczba wyświetleń reklam (w tysiącach)
                      </div>
                    </div>

                    {/* Kliknięcia */}
                    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-300 group relative">
                      <div className="flex items-center justify-between mb-2">
                        <Target className="h-5 w-5 text-yellow-600" />
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      </div>
                      <div className="text-2xl font-bold text-gray-900 mb-1">
                        {(stats?.totalClicks || 0).toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600">Kliknięcia</div>
                      <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-900 text-white text-xs rounded-lg p-2 -mt-2 ml-2 pointer-events-none z-10">
                        Całkowita liczba kliknięć w reklamy
                      </div>
                    </div>

                    {/* CTR */}
                    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-300 group relative">
                      <div className="flex items-center justify-between mb-2">
                        <TrendingUp className="h-5 w-5 text-purple-600" />
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      </div>
                      <div className="text-2xl font-bold text-gray-900 mb-1">
                        {(stats?.averageCtr || 0).toFixed(2)}%
                      </div>
                      <div className="text-sm text-gray-600">CTR</div>
                      <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-900 text-white text-xs rounded-lg p-2 -mt-2 ml-2 pointer-events-none z-10">
                        Click-Through Rate - procent kliknięć od wyświetleń
                      </div>
                    </div>

                    {/* CPC */}
                    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-300 group relative">
                      <div className="flex items-center justify-between mb-2">
                        <Target className="h-5 w-5 text-orange-600" />
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      </div>
                      <div className="text-2xl font-bold text-gray-900 mb-1">
                        {formatCurrency(stats?.averageCpc || 0, currentMonthData.currency)}
                      </div>
                      <div className="text-sm text-gray-600">CPC</div>
                      <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-900 text-white text-xs rounded-lg p-2 -mt-2 ml-2 pointer-events-none z-10">
                        Cost Per Click - koszt za kliknięcie
                      </div>
                    </div>

                    {/* Konwersje */}
                    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-300 group relative">
                      <div className="flex items-center justify-between mb-2">
                        <Activity className="h-5 w-5 text-red-600" />
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      </div>
                      <div className="text-2xl font-bold text-gray-900 mb-1">
                        {(stats?.totalConversions || 0).toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600">Konwersje</div>
                      <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-900 text-white text-xs rounded-lg p-2 -mt-2 ml-2 pointer-events-none z-10">
                        Liczba konwersji/leadów z kampanii
                      </div>
                    </div>

                    {/* ROAS */}
                    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-300 group relative">
                      <div className="flex items-center justify-between mb-2">
                        <BarChart3 className="h-5 w-5 text-indigo-600" />
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      </div>
                      <div className="text-2xl font-bold text-gray-900 mb-1">
                        {(stats?.roas || 0).toFixed(1)}
                      </div>
                      <div className="text-sm text-gray-600">ROAS</div>
                      <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-900 text-white text-xs rounded-lg p-2 -mt-2 ml-2 pointer-events-none z-10">
                        Return on Ad Spend - zwrot z wydatków reklamowych
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Central Chart Section */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Trendy: Wydatki vs Kliknięcia</h3>
                  <div className="flex items-center space-x-2">
                    <button className="px-3 py-1 bg-white text-blue-600 rounded-lg text-sm font-medium border border-blue-200">
                      Wydatki
                    </button>
                    <button className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm font-medium">
                      Kliknięcia
                    </button>
                    <button className="px-3 py-1 bg-white text-blue-600 rounded-lg text-sm font-medium border border-blue-200">
                      CTR
                    </button>
                  </div>
                </div>
                
                {/* Placeholder for animated chart */}
                <div className="h-64 bg-white rounded-lg flex items-center justify-center border border-blue-200">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 text-blue-400 mx-auto mb-4" />
                    <p className="text-gray-600">Wykres trendów - animowany po przełączeniu okresu</p>
                    <p className="text-sm text-gray-500 mt-2">Łagodne przejścia z framer-motion</p>
                  </div>
                </div>
              </div>

              {/* Last Report Box */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center mr-4">
                      <FileText className="h-5 w-5 text-primary-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Ostatni raport</h4>
                      <p className="text-sm text-gray-600">
                        {new Date(clientData.reports[0]?.generated_at || Date.now()).toLocaleDateString('pl-PL')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => router.push('/reports')}
                      className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      title="Podgląd raportu"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button 
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Pobierz raport"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                {/* Mini Stats */}
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    <span>Ostatnia aktualizacja: {formatLastUpdated()}</span>
                  </div>
                  <div className="flex items-center">
                    <Target className="h-3 w-3 mr-1" />
                    <span>{currentMonthData.stats?.campaignCount || 0} kampanii w tym miesiącu</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Recent Campaigns */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Campaigns</h2>
            <button
              onClick={() => router.push('/campaigns')}
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              View All
            </button>
          </div>
          
          {clientData.campaigns.length === 0 ? (
            <div className="text-center py-8">
              <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No campaigns found</h3>
              <p className="text-gray-600">Campaign data will appear here once reports are generated.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Campaign
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Spend
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Impressions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Clicks
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      CTR
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {clientData.campaigns.slice(0, 5).map((campaign) => (
                    <tr key={campaign.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{campaign.campaign_name}</div>
                        <div className="text-sm text-gray-500">{campaign.campaign_id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${campaign.spend?.toLocaleString() || '0'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {campaign.impressions?.toLocaleString() || '0'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {campaign.clicks?.toLocaleString() || '0'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {campaign.ctr ? `${campaign.ctr.toFixed(2)}%` : '0%'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 