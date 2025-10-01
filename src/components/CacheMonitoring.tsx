'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  Database,
  TrendingUp,
  Server,
  Zap,
  Eye,
  Trash2
} from 'lucide-react';

interface CacheEntry {
  clientId: string;
  clientName: string;
  periodId: string;
  lastUpdated: string;
  ageMinutes: number;
  status: 'fresh' | 'stale';
}

interface CacheStats {
  tableName: string;
  displayName: string;
  totalEntries: number;
  freshEntries: number;
  staleEntries: number;
  oldestEntry: string | null;
  newestEntry: string | null;
  healthStatus: 'healthy' | 'warning' | 'critical';
  clients: CacheEntry[];
}

interface MonitoringData {
  timestamp: string;
  cacheStats: CacheStats[];
  summary: {
    totalCaches: number;
    healthyCaches: number;
    warningCaches: number;
    criticalCaches: number;
    totalEntries: number;
    freshEntries: number;
    staleEntries: number;
  };
}

export default function CacheMonitoring() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshMessage, setRefreshMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch monitoring data
  const fetchMonitoringData = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/admin/cache-monitoring', {
        headers: {
          'Authorization': 'Bearer admin' // Replace with actual auth token
        }
      });

      if (response.ok) {
        const monitoringData = await response.json();
        setData(monitoringData);
        setLastRefresh(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Manually refresh all caches
  const refreshAllCaches = async () => {
    try {
      setRefreshingAll(true);
      setRefreshMessage(null);
      
      console.log('🔄 Triggering manual cache refresh for all systems...');
      
      const response = await fetch('/api/admin/cache-monitoring/refresh-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Cache refresh completed:', result);
        
        setRefreshMessage({
          type: 'success',
          text: `Pomyślnie odświeżono ${result.summary.successful}/${result.summary.total} systemów cache`
        });
        
        // Refresh monitoring data to show updated cache status
        setTimeout(() => {
          fetchMonitoringData();
        }, 2000);
      } else {
        const error = await response.json();
        console.error('❌ Cache refresh failed:', error);
        
        setRefreshMessage({
          type: 'error',
          text: `Nie udało się odświeżyć cache: ${error.details || 'Nieznany błąd'}`
        });
      }
    } catch (error) {
      console.error('Failed to refresh all caches:', error);
      setRefreshMessage({
        type: 'error',
        text: `Błąd: ${error instanceof Error ? error.message : 'Nieznany błąd'}`
      });
    } finally {
      setRefreshingAll(false);
      
      // Clear message after 10 seconds
      setTimeout(() => {
        setRefreshMessage(null);
      }, 10000);
    }
  };

  // Initial load
  useEffect(() => {
    fetchMonitoringData();
  }, []);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMonitoringData();
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, []);

  // Format time ago
  const formatTimeAgo = (minutes: number): string => {
    if (minutes < 1) return 'Właśnie teraz';
    if (minutes < 60) return `${minutes}min temu`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h temu`;
    const days = Math.floor(hours / 24);
    return `${days}d temu`;
  };

  // Format date
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Nigdy';
    const date = new Date(dateString);
    return date.toLocaleString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Health status badge
  const HealthBadge = ({ status }: { status: 'healthy' | 'warning' | 'critical' }) => {
    const styles = {
      healthy: 'bg-green-100 text-green-800 border-green-200',
      warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      critical: 'bg-red-100 text-red-800 border-red-200'
    };

    const icons = {
      healthy: <CheckCircle className="h-4 w-4" />,
      warning: <AlertTriangle className="h-4 w-4" />,
      critical: <XCircle className="h-4 w-4" />
    };

    const labels = {
      healthy: 'Zdrowe',
      warning: 'Ostrzeżenie',
      critical: 'Krytyczne'
    };

    return (
      <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
        {icons[status]}
        <span>{labels[status]}</span>
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <div className="flex items-center justify-center">
          <RefreshCw className="h-6 w-6 text-gray-400 animate-spin" />
          <span className="ml-3 text-gray-600">Ładowanie danych monitorowania cache...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <div className="text-center text-gray-600">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
          <p>Nie udało się załadować danych monitorowania</p>
          <button
            onClick={fetchMonitoringData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Spróbuj ponownie
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl shadow-lg">
            <Activity className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Monitorowanie Cache</h2>
            <p className="text-sm text-gray-600">
              Monitorowanie w czasie rzeczywistym systemów inteligentnego cache
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchMonitoringData}
            disabled={refreshing}
            className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-all"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium">Odśwież Status</span>
          </button>
          <button
            onClick={refreshAllCaches}
            disabled={refreshingAll}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
          >
            <Zap className={`h-4 w-4 ${refreshingAll ? 'animate-pulse' : ''}`} />
            <span className="text-sm font-medium">
              {refreshingAll ? 'Odświeżanie wszystkich...' : 'Odśwież Wszystkie Cache'}
            </span>
          </button>
        </div>
      </div>

      {/* Last Updated */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Clock className="h-4 w-4 text-blue-600" />
          <span className="text-sm text-blue-900">
            Ostatnia aktualizacja: {formatDate(lastRefresh.toISOString())}
          </span>
        </div>
        <span className="text-xs text-blue-700 font-mono">
          Auto-refresh: 60s
        </span>
      </div>

      {/* Refresh Message */}
      {refreshMessage && (
        <div className={`rounded-lg p-4 flex items-start space-x-3 ${
          refreshMessage.type === 'success' 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          {refreshMessage.type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p className={`text-sm font-medium ${
              refreshMessage.type === 'success' ? 'text-green-900' : 'text-red-900'
            }`}>
              {refreshMessage.text}
            </p>
            {refreshMessage.type === 'success' && (
              <p className="text-xs text-green-700 mt-1">
                Dane cache zostaną zaktualizowane za kilka sekund...
              </p>
            )}
          </div>
          <button
            onClick={() => setRefreshMessage(null)}
            className={`text-sm font-medium ${
              refreshMessage.type === 'success' ? 'text-green-600 hover:text-green-800' : 'text-red-600 hover:text-red-800'
            }`}
          >
            ✕
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Caches */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Wszystkie Cache</p>
              <p className="text-3xl font-bold text-gray-900">{data.summary.totalCaches}</p>
            </div>
            <Database className="h-10 w-10 text-blue-500 opacity-20" />
          </div>
        </div>

        {/* Healthy Caches */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 mb-1">Zdrowe</p>
              <p className="text-3xl font-bold text-green-900">{data.summary.healthyCaches}</p>
            </div>
            <CheckCircle className="h-10 w-10 text-green-500 opacity-30" />
          </div>
        </div>

        {/* Fresh Entries */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 mb-1">Świeże</p>
              <p className="text-3xl font-bold text-blue-900">{data.summary.freshEntries}</p>
              <p className="text-xs text-blue-600 mt-1">
                {data.summary.totalEntries > 0 
                  ? `${Math.round((data.summary.freshEntries / data.summary.totalEntries) * 100)}%`
                  : '0%'
                } z całkowitej liczby
              </p>
            </div>
            <Zap className="h-10 w-10 text-blue-500 opacity-30" />
          </div>
        </div>

        {/* Stale Entries */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-amber-700 mb-1">Przestarzałe</p>
              <p className="text-3xl font-bold text-amber-900">{data.summary.staleEntries}</p>
              <p className="text-xs text-amber-600 mt-1">
                {data.summary.totalEntries > 0 
                  ? `${Math.round((data.summary.staleEntries / data.summary.totalEntries) * 100)}%`
                  : '0%'
                } z całkowitej liczby
              </p>
            </div>
            <Clock className="h-10 w-10 text-amber-500 opacity-30" />
          </div>
        </div>
      </div>

      {/* Cache Tables Details */}
      <div className="space-y-4">
        {data.cacheStats.map((cache) => (
          <div key={cache.tableName} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Cache Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Server className="h-6 w-6 text-gray-400" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{cache.displayName}</h3>
                    <p className="text-sm text-gray-500">Table: {cache.tableName}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <HealthBadge status={cache.healthStatus} />
                  <button
                    onClick={() => setExpandedTable(expandedTable === cache.tableName ? null : cache.tableName)}
                    className="flex items-center space-x-2 px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all"
                  >
                    <Eye className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {expandedTable === cache.tableName ? 'Ukryj' : 'Pokaż'} Szczegóły
                    </span>
                  </button>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-600 mb-1">Wszystkie Wpisy</p>
                  <p className="text-2xl font-bold text-gray-900">{cache.totalEntries}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-xs text-green-700 mb-1">Świeże ({cache.totalEntries > 0 ? Math.round((cache.freshEntries / cache.totalEntries) * 100) : 0}%)</p>
                  <p className="text-2xl font-bold text-green-900">{cache.freshEntries}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3">
                  <p className="text-xs text-amber-700 mb-1">Przestarzałe ({cache.totalEntries > 0 ? Math.round((cache.staleEntries / cache.totalEntries) * 100) : 0}%)</p>
                  <p className="text-2xl font-bold text-amber-900">{cache.staleEntries}</p>
                </div>
              </div>

              {/* Last Update Info */}
              {cache.newestEntry && (
                <div className="mt-3 flex items-center space-x-4 text-sm text-gray-600">
                  <span className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4" />
                    <span>Najnowsze: {formatDate(cache.newestEntry)}</span>
                  </span>
                  {cache.oldestEntry && (
                    <span className="flex items-center space-x-2">
                      <Clock className="h-4 w-4" />
                      <span>Najstarsze: {formatDate(cache.oldestEntry)}</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Expanded Details */}
            {expandedTable === cache.tableName && (
              <div className="p-6 bg-gray-50">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Wpisy Cache Klientów</h4>
                {cache.clients.length > 0 ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {cache.clients.map((client, index) => (
                      <div
                        key={`${client.clientId}-${client.periodId}`}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          client.status === 'fresh' ? 'bg-white border border-green-200' : 'bg-white border border-amber-200'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-2 h-2 rounded-full ${
                            client.status === 'fresh' ? 'bg-green-500' : 'bg-amber-500'
                          }`} />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{client.clientName}</p>
                            <p className="text-xs text-gray-500">Okres: {client.periodId}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="text-xs text-gray-600">Ostatnia Aktualizacja</p>
                            <p className="text-sm font-medium text-gray-900">{formatTimeAgo(client.ageMinutes)}</p>
                            <p className="text-xs text-gray-500">{formatDate(client.lastUpdated)}</p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            client.status === 'fresh' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {client.status === 'fresh' ? 'Świeże' : 'Przestarzałe'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Database className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Brak wpisów cache</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Health Recommendations */}
      {(data.summary.warningCaches > 0 || data.summary.criticalCaches > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-amber-900 mb-2">Rekomendacje Zdrowia</h3>
              <ul className="space-y-2 text-sm text-amber-800">
                {data.summary.criticalCaches > 0 && (
                  <li>• <strong>{data.summary.criticalCaches}</strong> cache w stanie krytycznym - rozważ wymuszenie odświeżenia</li>
                )}
                {data.summary.warningCaches > 0 && (
                  <li>• <strong>{data.summary.warningCaches}</strong> cache wymaga uwagi - monitoruj uważnie</li>
                )}
                {data.summary.staleEntries > data.summary.freshEntries && (
                  <li>• Więcej przestarzałych niż świeżych wpisów - odświeżanie w tle może wymagać zbadania</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* All Healthy Status */}
      {data.summary.healthyCaches === data.summary.totalCaches && data.summary.totalCaches > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <div>
              <h3 className="text-lg font-semibold text-green-900">All Systems Operational</h3>
              <p className="text-sm text-green-700">All cache systems are healthy and functioning properly.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

