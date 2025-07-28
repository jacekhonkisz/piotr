'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Eye, 
  Download,
  Calendar,
  Target,
  Activity,
  RefreshCw,
  FileText,
  Building,
  Mail,
  Clock,
  AlertCircle,
  LogOut
} from 'lucide-react';
import { useAuth } from '../../components/AuthProvider';
import { supabase } from '../../lib/supabase';
import { getAdminDashboardStats, getClientDashboardData } from '../../lib/database';
import type { Database } from '../../lib/database.types';
import LoadingSpinner from '../../components/LoadingSpinner';

type Client = Database['public']['Tables']['clients']['Row'];
type Report = Database['public']['Tables']['reports']['Row'];
type Campaign = Database['public']['Tables']['campaigns']['Row'];

interface DashboardStats {
  totalClients?: number;
  totalReports?: number;
  activeClients?: number;
  totalSpend?: number;
}

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

// Cache duration: 1 hour (3600000 milliseconds)
const CACHE_DURATION = 60 * 60 * 1000;

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [adminStats, setAdminStats] = useState<DashboardStats>({});
  const [clientData, setClientData] = useState<ClientDashboardData | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [refreshingData, setRefreshingData] = useState(false);
  const [dataSource, setDataSource] = useState<'live' | 'database'>('database');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dashboardInitialized, setDashboardInitialized] = useState(false);
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

  // Load data from cache if available and not expired
  const loadFromCache = (): ClientDashboardData | null => {
    try {
      const cached = localStorage.getItem(getCacheKey());
      if (!cached) return null;

      const parsedCache: CachedData = JSON.parse(cached);
      const now = Date.now();
      
      // Check if cache is still valid (less than 1 hour old)
      if (now - parsedCache.timestamp < CACHE_DURATION) {
        console.log('Loading data from cache (age:', Math.round((now - parsedCache.timestamp) / 1000 / 60), 'minutes)');
        setDataSource(parsedCache.dataSource);
        setLastUpdated(new Date(parsedCache.timestamp));
        return parsedCache.data;
      } else {
        console.log('Cache expired, will fetch fresh data');
        localStorage.removeItem(getCacheKey());
        return null;
      }
    } catch (error) {
      console.error('Error loading from cache:', error);
      localStorage.removeItem(getCacheKey());
      return null;
    }
  };

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

  // One-time cache clear for testing the fix
  useEffect(() => {
    const hasTestedDateFix = localStorage.getItem('date_range_fix_tested');
    if (!hasTestedDateFix) {
      console.log('🔧 Clearing old cache for date range fix...');
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('dashboard_cache_')) {
          localStorage.removeItem(key);
        }
      });
      localStorage.setItem('date_range_fix_tested', 'true');
    }
  }, []); // Only run once

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
        loadAdminDashboard();
      } else {
        loadClientDashboardWithCache();
      }
    }
  }, [user, profile, authLoading, dashboardInitialized, router]);

  const loadAdminDashboard = async () => {
    if (loadingRef.current) return;
    
    try {
      loadingRef.current = true;
      setLoading(true);
      console.log('Loading admin dashboard');
      const stats = await getAdminDashboardStats(user!.id);
      
      if (mountedRef.current) {
        setAdminStats(stats);
      }
    } catch (error) {
      console.error('Error loading admin dashboard:', error);
    } finally {
      loadingRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const loadClientDashboardWithCache = async (forceRefresh = false) => {
    if (loadingRef.current) return;
    
    try {
      loadingRef.current = true;
      setLoading(true);
      
      // Try to load from cache first (unless force refresh)
      if (!forceRefresh) {
        const cachedData = loadFromCache();
        if (cachedData && mountedRef.current) {
          setClientData(cachedData);
          setLoading(false);
          loadingRef.current = false;
          return;
        }
      }

      // If no cache or force refresh, fetch fresh data
      console.log('Loading fresh client dashboard data...');
      await loadClientDashboard(forceRefresh);
    } catch (error) {
      console.error('Error loading client dashboard with cache:', error);
    } finally {
      loadingRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const loadClientDashboard = async (forceRefresh = false) => {
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

      // Fetch live data from Meta API
      const response = await fetch('/api/fetch-live-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToUse.access_token}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({
          dateRange: {
            start: '2024-01-01', // Broader range to capture all historical data
            end: new Date().toISOString().split('T')[0]
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to fetch live data:', error);
        
        // Fallback to database data if API fails
        await loadClientDashboardFromDatabase();
        return;
      }

      const result = await response.json();
      console.log('Live data fetched successfully:', result);
      
      // Check for Meta API errors in debug info
      if (result.debug?.hasMetaApiError) {
        console.warn('⚠️ Meta API Error detected:', result.debug.metaApiError);
        alert(`Meta API Issue: ${result.debug.metaApiError}\n\nThis might explain why data shows zeros. Please check your Meta Ads account permissions and token.`);
      }

      // Also get reports from database
      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .eq('email', user!.email || '')
        .single();

      if (clientData) {
        const { data: reports } = await supabase
          .from('reports')
          .select('*')
          .eq('client_id', clientData.id)
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
        
        // Save to cache
        saveToCache(dashboardData, 'live');
      }
    } catch (error) {
      console.error('Error loading client dashboard:', error);
      // Fallback to database data
      await loadClientDashboardFromDatabase();
    }
  };

  const loadClientDashboardFromDatabase = async () => {
    try {
      console.log('Loading dashboard data from database (fallback)');
      
      // Get client data first
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('email', user!.email || '')
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

  const generateNewReport = async () => {
    if (!clientData) return;

    setGeneratingReport(true);
    try {
      const response = await fetch('/api/generate-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRange: {
            start: '2024-01-01', // Broader range to capture all historical data
            end: new Date().toISOString().split('T')[0]
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate report');
      }

      const result = await response.json();
      console.log('Report generated:', result);
      
      // Clear cache and reload dashboard data
      clearCache();
      await loadClientDashboardWithCache(true);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setGeneratingReport(false);
    }
  };

  const refreshLiveData = async () => {
    if (!user || loadingRef.current || refreshingData) return;
    
    setRefreshingData(true);
    try {
      // Clear cache and force refresh
      clearCache();
      await loadClientDashboardWithCache(true);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner text="Loading dashboard..." />
      </div>
    );
  }

  if (profile?.role === 'admin') {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center">
                <BarChart3 className="h-8 w-8 text-primary-600" />
                <h1 className="ml-2 text-xl font-semibold text-gray-900">
                  Admin Dashboard
                </h1>
              </div>
              <div className="flex items-center">
                <button
                  onClick={() => router.push('/admin')}
                  className="btn-primary"
                >
                  Manage Clients
                </button>
                <button
                  onClick={handleLogout}
                  className="ml-2 btn-secondary"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Log Out
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Clients</p>
                  <p className="text-2xl font-semibold text-gray-900">{adminStats.totalClients}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <FileText className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Reports</p>
                  <p className="text-2xl font-semibold text-gray-900">{adminStats.totalReports}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Activity className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Clients</p>
                  <p className="text-2xl font-semibold text-gray-900">{adminStats.activeClients}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Spend</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    ${adminStats.totalSpend?.toLocaleString() || '0'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => router.push('/admin')}
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <Users className="h-5 w-5 text-blue-600 mr-3" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">Manage Clients</p>
                  <p className="text-sm text-gray-600">Add, edit, or remove clients</p>
                </div>
              </button>

              <button
                onClick={() => router.push('/admin/reports')}
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <FileText className="h-5 w-5 text-green-600 mr-3" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">View Reports</p>
                  <p className="text-sm text-gray-600">Browse all client reports</p>
                </div>
              </button>

              <button
                onClick={() => router.push('/admin/settings')}
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <BarChart3 className="h-5 w-5 text-purple-600 mr-3" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">System Settings</p>
                  <p className="text-sm text-gray-600">Configure system preferences</p>
                </div>
              </button>
            </div>
          </div>
        </main>
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
                <p className="text-sm text-gray-600">Meta Ads Performance Reports</p>
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
                onClick={generateNewReport}
                disabled={generatingReport}
                className="btn-primary"
              >
                {generatingReport ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Report
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
                    ${clientData.stats.totalSpend.toLocaleString()}
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

        {/* Recent Reports */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Reports</h2>
            <button
              onClick={() => router.push('/reports')}
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              View All
            </button>
          </div>
          
          {clientData.reports.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No reports yet</h3>
              <p className="text-gray-600 mb-4">Generate your first report to see performance data.</p>
              <button
                onClick={generateNewReport}
                disabled={generatingReport}
                className="btn-primary"
              >
                {generatingReport ? 'Generating...' : 'Generate First Report'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {clientData.reports.slice(0, 5).map((report) => (
                <div key={report.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center">
                    <Calendar className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {new Date(report.date_range_start).toLocaleDateString()} - {new Date(report.date_range_end).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-600">
                        Generated {new Date(report.generated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => router.push(`/reports/${report.id}`)}
                      className="text-primary-600 hover:text-primary-700 p-1"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button className="text-gray-600 hover:text-gray-700 p-1">
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
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