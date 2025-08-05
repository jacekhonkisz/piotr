'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  responseTime: string;
  services: {
    database: 'healthy' | 'unhealthy';
    metaApi: 'healthy' | 'degraded' | 'unhealthy';
  };
  error?: string;
}

interface PerformanceMetrics {
  [key: string]: number;
}

export default function MonitoringDashboard() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({});
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const checkHealth = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      setHealthStatus(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Health check failed:', error);
      setHealthStatus({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        responseTime: '0ms',
        services: {
          database: 'unhealthy',
          metaApi: 'unhealthy'
        },
        error: 'Failed to connect to health endpoint'
      });
    } finally {
      setLoading(false);
    }
  };

  const getPerformanceMetrics = async () => {
    try {
      const response = await fetch('/api/metrics');
      const data = await response.json();
      
      if (data.success) {
        setPerformanceMetrics(data.metrics);
      } else {
        console.error('Failed to fetch metrics:', data.error);
      }
    } catch (error) {
      console.error('Failed to fetch performance metrics:', error);
    }
  };

  useEffect(() => {
    checkHealth();
    getPerformanceMetrics();
    
    // Set up periodic health checks
    const interval = setInterval(() => {
      checkHealth();
      getPerformanceMetrics();
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'unhealthy':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'healthy')
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Sprawny</span>;
    if (status === 'degraded')
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Obniżona wydajność</span>;
    if (status === 'unhealthy')
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Niesprawny</span>;
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Nieznany</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Monitorowanie systemu</h2>
        <button 
          onClick={checkHealth} 
          disabled={loading}
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Health Status */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center gap-2">
            {healthStatus && getStatusIcon(healthStatus.status)}
            Stan systemu
          </h3>
          <div className="mt-4">
            {healthStatus ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status ogólny</span>
                  {getStatusBadge(healthStatus.status)}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Baza danych</span>
                    {getStatusBadge(healthStatus.services.database)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Meta API</span>
                    {getStatusBadge(healthStatus.services.metaApi)}
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Czas odpowiedzi</span>
                  <span className="text-sm font-mono">{healthStatus.responseTime}</span>
                </div>
                
                {healthStatus.error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-800">{healthStatus.error}</p>
                  </div>
                )}
                
                <div className="text-xs text-gray-500">
                  Ostatnia aktualizacja: {lastUpdated?.toLocaleString()}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600">Ładowanie statusu zdrowia...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Wydajność metryk</h3>
          <div className="mt-4">
            <div className="space-y-3">
              {Object.entries(performanceMetrics).map(([metric, value]) => (
                <div key={metric} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 font-mono">{metric}</span>
                  <span className="text-sm font-mono">
                    {value.toFixed(0)}ms
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* System Information */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Informacje o systemie</h3>
          <div className="mt-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Środowisko</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {process.env.NEXT_PUBLIC_ENVIRONMENT || 'development'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Wersja</span>
                <span className="text-sm font-mono">1.0.0</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Czas działania</span>
                <span className="text-sm font-mono">
                  {healthStatus?.timestamp ? 
                    new Date(healthStatus.timestamp).toLocaleString() : 
                    'Nieznany'
                  }
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 