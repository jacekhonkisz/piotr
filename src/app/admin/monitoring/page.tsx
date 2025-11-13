'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Activity,
  Heart,
  Shield,
  Database,
  Clock,
  RefreshCw,
  ArrowLeft,
  Zap,
  Users,
  TrendingUp,
  AlertTriangle,
  Settings
} from 'lucide-react';
import { useAuth } from '../../../components/AuthProvider';
import { supabase } from '../../../lib/supabase';
import { AdminLoading } from '../../../components/LoadingSpinner';
import CacheMonitoring from '../../../components/CacheMonitoring';
import AdminNavbar from '../../../components/AdminNavbar';

interface GoogleAdsConfig {
  google_ads_developer_token: string;
  google_ads_manager_customer_id: string;
  google_ads_client_id: string;
  google_ads_client_secret: string;
  google_ads_enabled: boolean;
}

export default function AdminMonitoringPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [systemHealth, setSystemHealth] = useState<'healthy' | 'warning' | 'critical' | 'unknown'>('unknown');
  
  // Token health state
  const [tokenHealthData, setTokenHealthData] = useState<any[]>([]);
  const [loadingTokenHealth, setLoadingTokenHealth] = useState(false);
  const [liveTokenHealth, setLiveTokenHealth] = useState<any>(null);
  const [loadingLiveHealth, setLoadingLiveHealth] = useState(false);
  
  // Cache management state
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [loadingCacheStats, setLoadingCacheStats] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  
  // Monitoring state
  const [systemMetrics, setSystemMetrics] = useState<any>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  
  // Google Ads config for health calculation
  const [googleAdsConfig, setGoogleAdsConfig] = useState<GoogleAdsConfig>({
    google_ads_developer_token: '',
    google_ads_manager_customer_id: '',
    google_ads_client_id: '',
    google_ads_client_secret: '',
    google_ads_enabled: true
  });

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/auth/login');
        return;
      }
      
      if (profile?.role !== 'admin') {
        router.push('/admin');
        return;
      }
      
    loadMonitoringData();
    }
  }, [user, profile, authLoading]);

  const loadMonitoringData = async () => {
    try {
      setLoading(true);
      
      // Load Google Ads config for health checks
      const { data: settingsData, error: settingsError } = await supabase
        .from('system_settings')
        .select('*')
        .filter('key', 'like', 'google_ads_%');
      
      if (!settingsError && settingsData) {
        settingsData.forEach(setting => {
          const key = setting.key as keyof GoogleAdsConfig;
          if (key in googleAdsConfig) {
            setGoogleAdsConfig(prev => ({
              ...prev,
              [key]: setting.value
            }));
          }
        });
      }
      
      // Load monitoring data
      await Promise.all([
        loadSystemMetrics(),
        loadTokenHealthData(),
        loadLiveTokenHealth(),
        loadCacheStats()
      ]);
      
    } catch (error) {
      console.error('Error loading monitoring data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSystemMetrics = async () => {
    try {
      setLoadingMetrics(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      
      // Use comprehensive system-health endpoint
      const response = await fetch('/api/monitoring/system-health', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setSystemMetrics(result.data);
          setSystemHealth(result.data.overallHealth.status);
        }
      } else {
        setSystemHealth('critical');
      }
    } catch (error) {
      console.error('Error loading system metrics:', error);
      setSystemHealth('critical');
    } finally {
      setLoadingMetrics(false);
    }
  };

  // Remove calculateSystemHealth - we now get it from the API

  const loadTokenHealthData = async () => {
    try {
      setLoadingTokenHealth(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch('/api/clients', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setTokenHealthData(result.clients || []);
      }
    } catch (error) {
      console.error('Error loading token health data:', error);
    } finally {
      setLoadingTokenHealth(false);
    }
  };

  const loadLiveTokenHealth = async () => {
    try {
      setLoadingLiveHealth(true);
      const response = await fetch('/api/admin/live-token-health');

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setLiveTokenHealth(result.summary);
        }
      }
    } catch (error) {
      console.error('Error loading live token health:', error);
    } finally {
      setLoadingLiveHealth(false);
    }
  };

  const loadCacheStats = async () => {
    try {
      setLoadingCacheStats(true);
      const response = await fetch('/api/admin/daily-metrics-cache-stats');
      if (response.ok) {
        const stats = await response.json();
        setCacheStats(stats);
      }
    } catch (error) {
      console.error('Error loading cache stats:', error);
    } finally {
      setLoadingCacheStats(false);
    }
  };

  const clearDailyMetricsCache = async (clientId?: string) => {
    try {
      setClearingCache(true);
      const url = clientId 
        ? `/api/admin/clear-daily-metrics-cache?clientId=${clientId}`
        : '/api/admin/clear-daily-metrics-cache';
      
      const response = await fetch(url, { method: 'POST' });
      if (response.ok) {
        await loadCacheStats();
        alert(clientId ? `Cache cleared for client ${clientId}` : 'All daily metrics cache cleared');
      } else {
        throw new Error('Failed to clear cache');
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      alert('Error clearing cache');
    } finally {
      setClearingCache(false);
    }
  };

  if (authLoading || loading) {
    return <AdminLoading text="Ładowanie monitoringu..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Admin Navbar */}
      <AdminNavbar />

      <main className="max-w-6xl xl:max-w-7xl 2xl:max-w-8xl mx-auto px-6 lg:px-8 xl:px-12 2xl:px-16 py-8">
        {/* System Metrics Section */}
        <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl ring-1 ring-black/5 p-8 mb-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-3 rounded-2xl shadow-lg">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Metryki systemu</h2>
                <p className="text-sm text-gray-600">Przegląd zdrowia systemu i wydajności</p>
              </div>
            </div>
            <button
              onClick={loadSystemMetrics}
              disabled={loadingMetrics}
              className="group nav-premium-button hover:border-green-300 flex items-center gap-2 px-4 py-2"
            >
              <RefreshCw className={`w-4 h-4 text-gray-600 group-hover:text-green-600 transition-colors ${loadingMetrics ? 'animate-spin' : ''}`} />
              <span className="text-sm font-medium text-gray-700 group-hover:text-green-700">
                {loadingMetrics ? 'Ładowanie...' : 'Odśwież'}
              </span>
            </button>
      </div>

          {systemMetrics ? (
            <div className="space-y-6">
              {/* Overall Health Score */}
              <div className={`bg-white/50 rounded-xl p-6 border-2 ${
                systemHealth === 'healthy' ? 'border-green-300 bg-green-50/30' :
                systemHealth === 'warning' ? 'border-orange-300 bg-orange-50/30' :
                systemHealth === 'critical' ? 'border-red-300 bg-red-50/30' :
                'border-gray-300'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Heart className={`w-10 h-10 ${
                      systemHealth === 'healthy' ? 'text-green-500' :
                      systemHealth === 'warning' ? 'text-orange-500' :
                      systemHealth === 'critical' ? 'text-red-500' :
                      'text-gray-500'
                    }`} />
                  <div>
                      <h3 className="text-2xl font-bold text-gray-900">Status systemu</h3>
                      <p className="text-sm text-gray-600">
                        Wynik zdrowia: {systemMetrics.overallHealth.score}/100
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-3xl font-bold ${
                      systemHealth === 'healthy' ? 'text-green-600' :
                      systemHealth === 'warning' ? 'text-orange-600' :
                      systemHealth === 'critical' ? 'text-red-600' :
                      'text-gray-600'
                    }`}>
                      {systemHealth === 'healthy' ? 'Zdrowy' :
                       systemHealth === 'warning' ? 'Ostrzeżenie' :
                       systemHealth === 'critical' ? 'Krytyczny' :
                       'Nieznany'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Ostatnie sprawdzenie: {new Date(systemMetrics.overallHealth.lastCheck).toLocaleTimeString('pl-PL')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Diagnostic Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Database Health */}
                <div className={`bg-white/50 rounded-xl p-6 border ${
                  systemMetrics.database.status === 'healthy' ? 'border-green-200' :
                  systemMetrics.database.status === 'warning' ? 'border-orange-200' :
                  'border-red-200'
                }`}>
                  <div className="flex items-center gap-3 mb-3">
                    <Database className={`w-5 h-5 ${
                      systemMetrics.database.status === 'healthy' ? 'text-green-500' :
                      systemMetrics.database.status === 'warning' ? 'text-orange-500' :
                      'text-red-500'
                    }`} />
                    <span className="text-sm font-semibold text-gray-700">Baza danych</span>
                  </div>
                  <div className={`text-2xl font-bold mb-1 ${
                    systemMetrics.database.status === 'healthy' ? 'text-green-600' :
                    systemMetrics.database.status === 'warning' ? 'text-orange-600' :
                    'text-red-600'
                  }`}>
                    {systemMetrics.database.status === 'healthy' ? 'Zdrowa' :
                     systemMetrics.database.status === 'warning' ? 'Wolna' :
                     'Błąd'}
                  </div>
                  <div className="text-xs text-gray-600">
                    Czas odpowiedzi: <span className="font-semibold">{systemMetrics.database.responseTime}ms</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {systemMetrics.database.responseTime < 500 ? 'Optymalna wydajność' :
                     systemMetrics.database.responseTime < 1000 ? 'Akceptowalna wydajność' :
                     'Wymaga optymalizacji'}
                  </div>
                </div>
                
                {/* Data Freshness */}
                <div className={`bg-white/50 rounded-xl p-6 border ${
                  systemMetrics.dataFreshness.status === 'healthy' ? 'border-green-200' :
                  systemMetrics.dataFreshness.status === 'warning' ? 'border-orange-200' :
                  'border-red-200'
                }`}>
                  <div className="flex items-center gap-3 mb-3">
                    <Clock className={`w-5 h-5 ${
                      systemMetrics.dataFreshness.status === 'healthy' ? 'text-green-500' :
                      systemMetrics.dataFreshness.status === 'warning' ? 'text-orange-500' :
                      'text-red-500'
                    }`} />
                    <span className="text-sm font-semibold text-gray-700">Świeżość danych</span>
                    </div>
                  <div className={`text-2xl font-bold mb-1 ${
                    systemMetrics.dataFreshness.status === 'healthy' ? 'text-green-600' :
                    systemMetrics.dataFreshness.status === 'warning' ? 'text-orange-600' :
                    'text-red-600'
                  }`}>
                    {systemMetrics.dataFreshness.hoursSinceUpdate < 24 ? 'Aktualne' :
                     systemMetrics.dataFreshness.hoursSinceUpdate < 48 ? 'Stare' :
                     'Przestarzałe'}
                  </div>
                  <div className="text-xs text-gray-600">
                    Ostatnia aktualizacja: <span className="font-semibold">{systemMetrics.dataFreshness.hoursSinceUpdate}h temu</span>
                    </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {systemMetrics.dataFreshness.status === 'healthy' ? 'Dane są aktualne' :
                     systemMetrics.dataFreshness.status === 'warning' ? 'Rozważ odświeżenie' :
                     'Wymagane odświeżenie'}
                  </div>
                </div>

                {/* Cache Health */}
                <div className={`bg-white/50 rounded-xl p-6 border ${
                  systemMetrics.cacheHealth.status === 'healthy' ? 'border-green-200' :
                  systemMetrics.cacheHealth.status === 'warning' ? 'border-orange-200' :
                  'border-red-200'
                }`}>
                  <div className="flex items-center gap-3 mb-3">
                    <Zap className={`w-5 h-5 ${
                      systemMetrics.cacheHealth.status === 'healthy' ? 'text-green-500' :
                      systemMetrics.cacheHealth.status === 'warning' ? 'text-orange-500' :
                      'text-red-500'
                    }`} />
                    <span className="text-sm font-semibold text-gray-700">Zdrowie cache</span>
                  </div>
                  <div className={`text-2xl font-bold mb-1 ${
                    systemMetrics.cacheHealth.status === 'healthy' ? 'text-green-600' :
                    systemMetrics.cacheHealth.status === 'warning' ? 'text-orange-600' :
                    'text-red-600'
                  }`}>
                    {systemMetrics.cacheHealth.entriesCount}
                  </div>
                  <div className="text-xs text-gray-600">
                    Wpisy: {systemMetrics.cacheHealth.entriesCount} | Stare: {systemMetrics.cacheHealth.staleEntriesCount}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Śr. wiek: {systemMetrics.cacheHealth.averageAge.toFixed(1)}h
                  </div>
                </div>

                {/* System Load */}
                <div className={`bg-white/50 rounded-xl p-6 border ${
                  systemMetrics.systemLoad.status === 'healthy' ? 'border-green-200' :
                  systemMetrics.systemLoad.status === 'warning' ? 'border-orange-200' :
                  'border-red-200'
                }`}>
                  <div className="flex items-center gap-3 mb-3">
                    <Activity className={`w-5 h-5 ${
                      systemMetrics.systemLoad.status === 'healthy' ? 'text-green-500' :
                      systemMetrics.systemLoad.status === 'warning' ? 'text-orange-500' :
                      'text-red-500'
                    }`} />
                    <span className="text-sm font-semibold text-gray-700">Obciążenie</span>
              </div>
                  <div className={`text-2xl font-bold mb-1 ${
                    systemMetrics.systemLoad.status === 'healthy' ? 'text-green-600' :
                    systemMetrics.systemLoad.status === 'warning' ? 'text-orange-600' :
                    'text-red-600'
                  }`}>
                    {systemMetrics.systemLoad.activeClients}
                  </div>
                  <div className="text-xs text-gray-600">
                    Aktywni klienci: {systemMetrics.systemLoad.activeClients}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Raporty (24h): {systemMetrics.systemLoad.recentReports}
                  </div>
                </div>
                </div>
                
              {/* Additional Diagnostic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                  <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Database className="w-5 h-5 text-blue-600" />
                    Diagnostyka bazy danych
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status połączenia:</span>
                      <span className={`font-semibold ${
                        systemMetrics.database.status === 'healthy' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {systemMetrics.database.status === 'healthy' ? 'Połączona' : 'Błąd'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Czas odpowiedzi:</span>
                      <span className="font-semibold text-blue-600">{systemMetrics.database.responseTime}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Wydajność:</span>
                      <span className="font-semibold text-gray-900">
                        {systemMetrics.database.responseTime < 200 ? 'Doskonała' :
                         systemMetrics.database.responseTime < 500 ? 'Dobra' :
                         systemMetrics.database.responseTime < 1000 ? 'Akceptowalna' :
                         'Wymaga optymalizacji'}
                    </span>
                    </div>
                  </div>
                  </div>
                  
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
                  <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    Aktywność systemu
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Aktywni klienci:</span>
                      <span className="font-semibold text-green-600">{systemMetrics.systemLoad.activeClients}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Raporty (24h):</span>
                      <span className="font-semibold text-purple-600">{systemMetrics.systemLoad.recentReports}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Współczynnik błędów:</span>
                      <span className="font-semibold text-gray-900">{systemMetrics.systemLoad.errorRate}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Ładowanie metryk...</p>
            </div>
          )}
        </div>

        {/* Live Token Health Section - NEW! */}
        <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl ring-1 ring-black/5 p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500 p-3 rounded-2xl shadow-lg animate-pulse">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  Live Token Validation - META Platform
                  <span className="px-3 py-1 text-xs font-semibold bg-green-100 text-green-700 rounded-full">NEW</span>
                  <span className="px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full">META ONLY</span>
                </h2>
                <p className="text-sm text-gray-600">🔍 Real-time Meta API token testing (Google Ads separate)</p>
              </div>
            </div>
            <button
              onClick={loadLiveTokenHealth}
              disabled={loadingLiveHealth}
              className="group nav-premium-button hover:border-green-300 flex items-center gap-2 px-4 py-2"
            >
              <RefreshCw className={`w-4 h-4 text-gray-600 group-hover:text-green-600 transition-colors ${loadingLiveHealth ? 'animate-spin' : ''}`} />
              <span className="text-sm font-medium text-gray-700 group-hover:text-green-700">
                {loadingLiveHealth ? 'Testing API...' : 'Test All Tokens'}
              </span>
            </button>
          </div>

          {/* Live Health Summary */}
          {liveTokenHealth && (
            <div className="mb-6">
              <div className={`bg-white/50 rounded-xl p-6 border-2 ${
                liveTokenHealth.overallHealth === 'healthy' ? 'border-green-300 bg-green-50/30' :
                liveTokenHealth.overallHealth === 'warning' ? 'border-orange-300 bg-orange-50/30' :
                'border-red-300 bg-red-50/30'
              }`}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-2xl font-bold text-green-600">{liveTokenHealth.healthyClients}</div>
                    <div className="text-xs text-gray-600">✅ Healthy (API Tested)</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-orange-600">{liveTokenHealth.warningClients}</div>
                    <div className="text-xs text-gray-600">⚠️ Warnings</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">{liveTokenHealth.criticalClients}</div>
                    <div className="text-xs text-gray-600">❌ Critical (Failed)</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-600">{liveTokenHealth.totalClients}</div>
                    <div className="text-xs text-gray-600">Total Tested</div>
                  </div>
                </div>
                <div className="mt-4 text-xs text-gray-500">
                  Last tested: {new Date(liveTokenHealth.timestamp).toLocaleString('pl-PL')}
                </div>
              </div>

              {/* Live Test Results */}
              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">🧪 API Test Results (Live Validation)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {liveTokenHealth.clients.map((client: any) => (
                    <div
                      key={client.clientId}
                      className={`bg-white rounded-lg p-4 border-2 ${
                        client.overall === 'healthy' ? 'border-green-200' :
                        client.overall === 'warning' ? 'border-orange-200' :
                        'border-red-200'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 text-sm truncate">
                            {client.clientName}
                          </h4>
                          <div className="flex items-center gap-1 mt-1">
                            {client.platform === 'meta' && (
                              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">Meta</span>
                            )}
                            {client.platform === 'google' && (
                              <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">Google Ads</span>
                            )}
                            {client.platform === 'both' && (
                              <>
                                <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">Meta</span>
                                <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">Google</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ml-2 ${
                          client.metaToken.status === 'valid' ? 'bg-green-500' :
                          client.metaToken.status === 'invalid' ? 'bg-red-500' :
                          'bg-gray-400'
                        }`} />
                      </div>
                      
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Meta API Test:</span>
                          <span className={`font-semibold ${
                            client.metaToken.tested ? 
                              (client.metaToken.status === 'valid' ? 'text-green-600' : 'text-red-600') 
                              : 'text-gray-500'
                          }`}>
                            {client.metaToken.tested ? 
                              (client.metaToken.status === 'valid' ? '✅ PASSED' : '❌ FAILED')
                              : client.platform === 'google' ? '○ Google Only' : '○ Not Tested'}
                          </span>
                        </div>
                        
                        {client.metaToken.tokenAge !== undefined && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Token Age:</span>
                            <span className={`font-semibold ${
                              client.metaToken.tokenAge > 45 ? 'text-orange-600' :
                              client.metaToken.tokenAge > 30 ? 'text-yellow-600' :
                              'text-green-600'
                            }`}>
                              {client.metaToken.tokenAge} days
                            </span>
                          </div>
                        )}
                        
                        {client.metaToken.error && (
                          <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
                            <div className="text-red-700 font-medium">Error:</div>
                            <div className="text-red-600">{client.metaToken.error}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {loadingLiveHealth && !liveTokenHealth && (
            <div className="text-center py-12">
              <RefreshCw className="w-16 h-16 text-green-500 mx-auto mb-4 animate-spin" />
              <p className="text-gray-600 font-medium">Testing all client tokens with Meta API...</p>
              <p className="text-sm text-gray-500 mt-2">This performs real API calls to verify tokens</p>
            </div>
          )}

          {!liveTokenHealth && !loadingLiveHealth && (
            <div className="text-center py-12 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-dashed border-blue-300">
              <Shield className="w-16 h-16 text-blue-400 mx-auto mb-4" />
              <p className="text-gray-700 font-medium mb-2">Click "Test All Tokens" to validate Meta API access</p>
              <p className="text-sm text-gray-600">This will test each Meta token with real API calls</p>
              <p className="text-xs text-gray-500 mt-2">Note: This tests META tokens only. Google Ads shown separately.</p>
            </div>
          )}
        </div>

        {/* Token Health Section (Database View) */}
        <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl ring-1 ring-black/5 p-8 mb-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-2xl shadow-lg">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Token Configuration</h2>
                <p className="text-sm text-gray-600">Database view - credentials configured (not API-tested)</p>
              </div>
            </div>
            <button
              onClick={loadTokenHealthData}
              disabled={loadingTokenHealth}
              className="group nav-premium-button hover:border-blue-300 flex items-center gap-2 px-4 py-2"
            >
              <RefreshCw className={`w-4 h-4 text-gray-600 group-hover:text-blue-600 transition-colors ${loadingTokenHealth ? 'animate-spin' : ''}`} />
              <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">
                {loadingTokenHealth ? 'Ładowanie...' : 'Odśwież'}
                    </span>
            </button>
                  </div>
                  
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {tokenHealthData.map((client) => (
              <div key={client.id} className={`bg-white/50 rounded-xl p-6 border-2 transition-all duration-200 hover:shadow-lg ${
                client.token_health_status === 'valid' ? 'border-green-200 hover:border-green-300' :
                client.token_health_status === 'expiring_soon' ? 'border-orange-200 hover:border-orange-300' :
                'border-red-200 hover:border-red-300'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 truncate flex-1 mr-2">{client.name}</h3>
                  <div className={`w-4 h-4 rounded-full flex-shrink-0 ${
                    client.token_health_status === 'valid' ? 'bg-green-500 animate-pulse' :
                    client.token_health_status === 'expiring_soon' ? 'bg-orange-500 animate-pulse' :
                    'bg-red-500'
                  }`}></div>
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-gray-600">Status tokena:</span>
                      <span className={`font-semibold px-2 py-0.5 rounded-full text-xs ${
                        client.token_health_status === 'valid' ? 'bg-green-100 text-green-700' :
                        client.token_health_status === 'expiring_soon' ? 'bg-orange-100 text-orange-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {client.token_health_status === 'valid' ? 'Zdrowy' :
                         client.token_health_status === 'expiring_soon' ? 'Wygasa' :
                         client.token_health_status === 'expired' ? 'Wygasł' : 'Błąd'}
                    </span>
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-gray-200">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-gray-600">Meta API:</span>
                    <span className={`font-medium ${
                        client.api_status === 'valid' ? 'text-green-600' : 'text-red-600'
                    }`}>
                        {client.api_status === 'valid' ? '✓ Aktywny' : '✗ Nieaktywny'}
                    </span>
                    </div>
                    {client.meta_token_expiry && (
                      <div className="text-xs text-gray-500 mt-1">
                        Wygasa: {new Date(client.meta_token_expiry).toLocaleDateString('pl-PL')}
                      </div>
                    )}
                  </div>

                  {client.google_ads_enabled && (
                    <div className="pt-2 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Google Ads:</span>
                        <span className={`font-medium ${
                          client.google_ads_customer_id ? 'text-green-600' : 'text-gray-400'
                        }`}>
                          {client.google_ads_customer_id ? '✓ Skonfigurowane' : '○ Brak'}
                        </span>
                      </div>
                      {client.google_ads_customer_id && (
                        <div className="text-xs text-gray-500 mt-1 truncate">
                          ID: {client.google_ads_customer_id}
                        </div>
                      )}
                    </div>
                  )}

                  {client.last_data_fetch && (
                    <div className="pt-2 border-t border-gray-200">
                      <div className="text-xs text-gray-500">
                        Ostatnie dane: {new Date(client.last_data_fetch).toLocaleString('pl-PL', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {tokenHealthData.length === 0 && !loadingTokenHealth && (
            <div className="text-center py-12">
              <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Brak danych tokenów</p>
              </div>
          )}
              </div>

        {/* Cache Management Section */}
        <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl ring-1 ring-black/5 p-8 mb-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-3 rounded-2xl shadow-lg">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Zarządzanie cache</h2>
                <p className="text-sm text-gray-600">Monitoruj i zarządzaj wydajnością cache dziennych metryk</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={loadCacheStats}
                disabled={loadingCacheStats}
                className="group nav-premium-button hover:border-emerald-300 flex items-center gap-2 px-4 py-2"
              >
                <RefreshCw className={`w-4 h-4 text-gray-600 group-hover:text-emerald-600 transition-colors ${loadingCacheStats ? 'animate-spin' : ''}`} />
                <span className="text-sm font-medium text-gray-700 group-hover:text-emerald-700">
                  {loadingCacheStats ? 'Ładowanie...' : 'Odśwież'}
                </span>
              </button>
            </div>
          </div>

          {cacheStats ? (
            <div className="space-y-6">
              {/* Cache Statistics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-2xl border border-emerald-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-emerald-500 p-2 rounded-lg">
                      <Database className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-2xl font-bold text-emerald-600">{cacheStats.size || 0}</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">Wpisy cache</h3>
                  <p className="text-sm text-gray-600">Aktywne wpisy cache</p>
                      </div>

                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-blue-500 p-2 rounded-lg">
                      <Clock className="w-5 h-5 text-white" />
                      </div>
                    <span className="text-2xl font-bold text-blue-600">3h</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">TTL cache</h3>
                  <p className="text-sm text-gray-600">Czas życia</p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-2xl border border-purple-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-purple-500 p-2 rounded-lg">
                      <Zap className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-2xl font-bold text-purple-600">Szybko</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">Wydajność</h3>
                  <p className="text-sm text-gray-600">Współczynnik trafień cache</p>
                </div>
              </div>

              {/* Cache Keys */}
              {cacheStats.keys && cacheStats.keys.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Aktywne klucze cache</h3>
                  <div className="bg-gray-50 rounded-xl p-4 max-h-64 overflow-y-auto">
                    <div className="space-y-2">
                      {cacheStats.keys.map((key: string, index: number) => (
                        <div key={index} className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
                          <code className="text-sm text-gray-700 font-mono">{key}</code>
                          <button
                            onClick={() => {
                              const clientId = key.split('_')[2];
                              if (clientId) clearDailyMetricsCache(clientId);
                            }}
                            disabled={clearingCache}
                            className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                          >
                            Clear
                          </button>
                    </div>
                  ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Cache Actions */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                <div>
                  <h3 className="font-semibold text-gray-900">Akcje cache</h3>
                  <p className="text-sm text-gray-600">Zarządzaj danymi cache i wydajnością</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => clearDailyMetricsCache()}
                    disabled={clearingCache}
                    className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <Database className="w-4 h-4" />
                    {clearingCache ? 'Czyszczenie...' : 'Wyczyść cały cache'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              {loadingCacheStats ? (
                <div className="flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
                  <span className="ml-3 text-gray-600">Ładowanie statystyk cache...</span>
                </div>
              ) : (
                <>
                  <Database className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Brak danych cache</p>
                </>
              )}
            </div>
          )}
          </div>

        {/* Cache Monitoring Component */}
        <div className="mt-8">
          <CacheMonitoring />
        </div>
      </main>
    </div>
  );
} 
