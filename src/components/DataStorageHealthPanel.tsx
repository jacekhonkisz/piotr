'use client';

import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  FileText,
  TrendingDown,
  AlertCircle,
  Package
} from 'lucide-react';

interface DataStorageHealthReport {
  timestamp: string;
  overall: {
    status: 'healthy' | 'warning' | 'critical';
    score: number;
    totalPeriods: number;
    healthyPeriods: number;
    issuesFound: number;
  };
  campaignDataIssues: {
    totalWithEmptyData: number;
    totalWithData: number;
    percentageHealthy: number;
    criticalIssue: boolean;
  };
  recentPeriods: Array<{
    clientName: string;
    period: string;
    summaryType: 'weekly' | 'monthly';
    totalSpend: number;
    campaignCount: number;
    hasCampaignData: boolean;
    status: 'healthy' | 'warning' | 'critical';
    issue?: string;
  }>;
  belmonteSpecific?: {
    periodsFound: number;
    emptyDataCount: number;
    lastMonthStatus: string;
    lastWeekStatus: string;
  };
  recommendations: string[];
}

export default function DataStorageHealthPanel() {
  const [data, setData] = useState<DataStorageHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const fetchHealthData = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/admin/data-storage-health');
      
      if (response.ok) {
        const healthData = await response.json();
        setData(healthData);
      }
    } catch (error) {
      console.error('Failed to fetch data storage health:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchHealthData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const StatusBadge = ({ status }: { status: 'healthy' | 'warning' | 'critical' }) => {
    const styles = {
      healthy: 'bg-green-100 text-green-800 border-green-300',
      warning: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      critical: 'bg-red-100 text-red-800 border-red-300'
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
      <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold border ${styles[status]}`}>
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
          <span className="ml-3 text-gray-600">Ładowanie stanu zdrowia danych...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <div className="text-center text-gray-600">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
          <p>Nie udało się załadować danych</p>
          <button
            onClick={fetchHealthData}
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`p-3 rounded-xl shadow-lg ${
            data.overall.status === 'critical' 
              ? 'bg-gradient-to-br from-red-500 to-red-600'
              : data.overall.status === 'warning'
              ? 'bg-gradient-to-br from-yellow-500 to-yellow-600'
              : 'bg-gradient-to-br from-green-500 to-green-600'
          }`}>
            <Database className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Zdrowie Przechowywania Danych</h2>
            <p className="text-sm text-gray-600">
              Monitorowanie kompletności danych kampanii (zgodnie z audytem)
            </p>
          </div>
        </div>
        <button
          onClick={fetchHealthData}
          disabled={refreshing}
          className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="text-sm font-medium">Odśwież</span>
        </button>
      </div>

      {/* Overall Health Score */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Ogólny Stan Zdrowia</h3>
            <p className="text-sm text-gray-600">Ostatnie 3 miesiące danych</p>
          </div>
          <StatusBadge status={data.overall.status} />
        </div>

        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Wynik Zdrowia</p>
            <p className="text-3xl font-bold text-gray-900">{data.overall.score}%</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-blue-700 mb-1">Wszystkie Okresy</p>
            <p className="text-3xl font-bold text-blue-900">{data.overall.totalPeriods}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm text-green-700 mb-1">Zdrowe</p>
            <p className="text-3xl font-bold text-green-900">{data.overall.healthyPeriods}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <p className="text-sm text-red-700 mb-1">Problemy</p>
            <p className="text-3xl font-bold text-red-900">{data.overall.issuesFound}</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative pt-1">
          <div className="flex mb-2 items-center justify-between">
            <div>
              <span className="text-xs font-semibold inline-block text-gray-700">
                Kompletność Danych Kampanii
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold inline-block text-gray-700">
                {data.campaignDataIssues.percentageHealthy.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
            <div
              style={{ width: `${data.campaignDataIssues.percentageHealthy}%` }}
              className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                data.campaignDataIssues.percentageHealthy >= 80
                  ? 'bg-green-500'
                  : data.campaignDataIssues.percentageHealthy >= 50
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Critical Campaign Data Issues */}
      {data.campaignDataIssues.criticalIssue && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6">
          <div className="flex items-start space-x-3">
            <XCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-900 mb-2">
                🚨 KRYTYCZNY PROBLEM: Puste tablice campaign_data
              </h3>
              <div className="space-y-2 text-sm text-red-800">
                <p>
                  <strong>{data.campaignDataIssues.totalWithEmptyData}</strong> okresów ma puste tablice campaign_data 
                  pomimo posiadania danych o wydatkach!
                </p>
                <p>
                  <strong>Tylko {data.campaignDataIssues.totalWithData}</strong> okresów zawiera szczegóły kampanii.
                </p>
                <p className="text-xs mt-2 text-red-700">
                  To jest ten sam problem zidentyfikowany w audycie Belmonte - agregaty są poprawne, 
                  ale szczegóły kampanii są utracone.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Belmonte Specific Status */}
      {data.belmonteSpecific && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start space-x-3">
            <Package className="h-6 w-6 text-blue-600 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">
                📊 Status Belmonte Hotel
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-3">
                  <p className="text-xs text-gray-600 mb-1">Znalezione okresy</p>
                  <p className="text-xl font-bold text-gray-900">{data.belmonteSpecific.periodsFound}</p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <p className="text-xs text-gray-600 mb-1">Puste dane</p>
                  <p className="text-xl font-bold text-red-600">{data.belmonteSpecific.emptyDataCount}</p>
                </div>
              </div>
              <div className="mt-3 space-y-2 text-sm text-blue-800">
                <p><strong>Ostatni miesiąc:</strong> {data.belmonteSpecific.lastMonthStatus}</p>
                <p><strong>Ostatni tydzień:</strong> {data.belmonteSpecific.lastWeekStatus}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <div className={`rounded-xl p-6 border-2 ${
          data.campaignDataIssues.criticalIssue
            ? 'bg-red-50 border-red-300'
            : 'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-start space-x-3">
            <AlertCircle className={`h-6 w-6 flex-shrink-0 mt-0.5 ${
              data.campaignDataIssues.criticalIssue ? 'text-red-600' : 'text-blue-600'
            }`} />
            <div className="flex-1">
              <h3 className={`text-lg font-semibold mb-3 ${
                data.campaignDataIssues.criticalIssue ? 'text-red-900' : 'text-blue-900'
              }`}>
                Rekomendacje
              </h3>
              <ul className={`space-y-2 text-sm ${
                data.campaignDataIssues.criticalIssue ? 'text-red-800' : 'text-blue-800'
              }`}>
                {data.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="font-mono text-xs mt-0.5">▸</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Recent Periods Details (expandable) */}
      <div className="bg-white rounded-xl border border-gray-200">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <FileText className="h-5 w-5 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900">
              Ostatnie Okresy ({data.recentPeriods.length})
            </h3>
          </div>
          <span className="text-sm text-gray-600">
            {showDetails ? 'Ukryj' : 'Pokaż'} szczegóły
          </span>
        </button>

        {showDetails && (
          <div className="px-6 pb-6 space-y-2 max-h-96 overflow-y-auto">
            {data.recentPeriods.map((period, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  period.status === 'critical'
                    ? 'bg-red-50 border-red-200'
                    : period.status === 'warning'
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-green-50 border-green-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{period.clientName}</p>
                    <p className="text-sm text-gray-600">
                      {period.period} ({period.summaryType}) - {period.totalSpend.toFixed(2)} PLN
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Kampanie: {period.campaignCount}
                    </p>
                    {period.issue && (
                      <p className="text-xs text-red-600 mt-1 font-medium">⚠️ {period.issue}</p>
                    )}
                  </div>
                  <StatusBadge status={period.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}



