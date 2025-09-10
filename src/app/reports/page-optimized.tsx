'use client';

import React, { useState, useEffect } from 'react';
import { 
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Clock,
  BarChart3,
  Database as DatabaseIcon,
  Zap
} from 'lucide-react';
import { useAuth } from '../../components/AuthProvider';
import { StandardizedDataFetcher } from '../../lib/standardized-data-fetcher';
import { getMonthBoundaries, getWeekBoundaries } from '../../lib/date-range-utils';
import type { Database } from '../../lib/database.types';

type Client = Database['public']['Tables']['clients']['Row'];

interface DataSourceIndicator {
  source: 'cache' | 'database' | 'api' | 'integrated';
  loadTime: number;
  cacheAge?: number;
}

export default function OptimizedReportsPage() {
  const { user, profile } = useAuth();
  
  // State
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [viewType, setViewType] = useState<'monthly' | 'weekly'>('monthly');
  const [currentPeriod, setCurrentPeriod] = useState('');
  const [currentReport, setCurrentReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<DataSourceIndicator | null>(null);

  /**
   * Initialize current period
   */
  useEffect(() => {
    const now = new Date();
    if (viewType === 'monthly') {
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      setCurrentPeriod(period);
    }
  }, [viewType]);

  /**
   * Load period data using integrated cache manager
   */
  const loadPeriodDataOptimized = async () => {
    if (!selectedClient || !currentPeriod) return;

    setLoading(true);
    setError(null);
    const startTime = performance.now();

    try {
      const dateRange = generateDateRange(currentPeriod, viewType);
      
      console.log('🚀 Loading optimized data for:', {
        client: selectedClient.company,
        period: currentPeriod,
        dateRange
      });

      const result = await StandardizedDataFetcher.fetchData({
        clientId: selectedClient.id,
        dateRange,
        platform: 'meta',
        reason: 'optimized-reports-page'
      });
      const loadTime = performance.now() - startTime;

      if (result.success) {
        setCurrentReport(result.data);
        setDataSource(getDataSourceIndicator(result, loadTime));
        
        console.log('✅ Optimized data loaded:', {
          source: result.debug?.source || 'unknown',
          loadTime: `${loadTime.toFixed(2)}ms`,
          dataSize: result.data ? Object.keys(result.data).length : 0
        });
      } else {
        throw new Error('Failed to load data');
      }
    } catch (err: any) {
      console.error('❌ Error loading optimized data:', err);
      setError(err.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Generate date range from period ID
   */
  const generateDateRange = (periodId: string, type: 'monthly' | 'weekly') => {
    if (type === 'monthly') {
      const parts = periodId.split('-');
      const yearStr = parts[0];
      const monthStr = parts[1];
      if (!yearStr || !monthStr) {
        throw new Error(`Invalid monthly period ID: ${periodId}`);
      }
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);
      if (isNaN(year) || isNaN(month)) {
        throw new Error(`Invalid monthly period ID: ${periodId}`);
      }
      return getMonthBoundaries(year, month);
    } else {
      // Weekly logic
      const parts = periodId.split('-W');
      const yearStr = parts[0];
      const weekStr = parts[1];
      if (!yearStr || !weekStr) {
        throw new Error(`Invalid weekly period ID: ${periodId}`);
      }
      const year = parseInt(yearStr);
      const week = parseInt(weekStr);
      if (isNaN(year) || isNaN(week)) {
        throw new Error(`Invalid weekly period ID: ${periodId}`);
      }
      const firstDayOfYear = new Date(year, 0, 1);
      const days = (week - 1) * 7;
      const weekStartDate = new Date(firstDayOfYear.getTime() + days * 24 * 60 * 60 * 1000);
      return getWeekBoundaries(weekStartDate);
    }
  };

  /**
   * Get data source indicator for UI feedback
   */
  const getDataSourceIndicator = (result: any, loadTime: number): DataSourceIndicator => {
    return {
      source: result.source || 'integrated',
      loadTime,
      cacheAge: result.cacheAge
    };
  };

  /**
   * Navigate to previous/next period
   */
  const navigatePeriod = (direction: 'prev' | 'next') => {
    if (!currentPeriod) return;
    
    if (viewType === 'monthly') {
      const parts = currentPeriod.split('-');
      const yearStr = parts[0];
      const monthStr = parts[1];
      
      if (!yearStr || !monthStr) {
        console.error('Invalid period format:', currentPeriod);
        return;
      }
      
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);
      
      if (isNaN(year) || isNaN(month)) {
        console.error('Invalid period format:', currentPeriod);
        return;
      }
      
      const date = new Date(year, month - 1); // month is 0-indexed
      
      if (direction === 'prev') {
        date.setMonth(date.getMonth() - 1);
      } else {
        date.setMonth(date.getMonth() + 1);
      }
      
      const newPeriod = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      setCurrentPeriod(newPeriod);
    }
  };

  // Auto-load data when dependencies change
  useEffect(() => {
    loadPeriodDataOptimized();
  }, [selectedClient, currentPeriod]);

  // Mock client for demo (replace with actual client selector)
  useEffect(() => {
    if (profile && !selectedClient) {
      setSelectedClient({
        id: 'demo-client',
        company: 'Demo Client',
        admin_id: profile.id,
        api_status: 'valid' as const,
        ad_account_id: 'demo-account',
        contact_emails: ['demo@example.com'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        credentials_generated_at: null,
        notes: null,
        logo_url: null,
        last_sync: null,
        is_active: true,
        timezone: 'UTC',
        currency: 'USD',
        business_id: null,
        app_secret: null
      } as unknown as Client);
    }
  }, [profile, selectedClient]);

  if (!user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          📊 Optimized Reports Dashboard
        </h1>

        {/* Performance Indicator */}
        {dataSource && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {dataSource.source === 'cache' && <Clock className="h-5 w-5 text-green-600" />}
                {dataSource.source === 'database' && <DatabaseIcon className="h-5 w-5 text-blue-600" />}
                {dataSource.source === 'api' && <Zap className="h-5 w-5 text-orange-600" />}
                {dataSource.source === 'integrated' && <BarChart3 className="h-5 w-5 text-purple-600" />}
                
                <span className="font-medium text-gray-900">
                  Data Source: {dataSource.source.toUpperCase()}
                </span>
              </div>
              
              <div className="text-sm text-gray-600">
                Load Time: {dataSource.loadTime.toFixed(2)}ms
                {dataSource.cacheAge && (
                  <span className="ml-2">
                    (Cache: {Math.round(dataSource.cacheAge / 1000)}s old)
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* View Type Toggle */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setViewType('monthly')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewType === 'monthly'
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Calendar className="h-4 w-4 inline mr-2" />
                Monthly
              </button>
              <button
                onClick={() => setViewType('weekly')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewType === 'weekly'
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <CalendarDays className="h-4 w-4 inline mr-2" />
                Weekly
              </button>
            </div>

            <button
              onClick={loadPeriodDataOptimized}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Period Navigation */}
          <div className="flex items-center justify-center space-x-4">
            <button
              onClick={() => navigatePeriod('prev')}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            <span className="font-medium text-gray-900 min-w-[120px] text-center">
              {currentPeriod}
            </span>
            
            <button
              onClick={() => navigatePeriod('next')}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        {loading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading optimized data...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
            <div className="flex items-center space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span className="text-red-800 font-medium">Error</span>
            </div>
            <p className="text-red-700 mt-2">{error}</p>
          </div>
        )}

        {currentReport && !loading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Report Data ({viewType})
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600">Campaigns</div>
                <div className="text-2xl font-bold text-gray-900">
                  {currentReport.campaigns?.length || 0}
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600">Total Spend</div>
                <div className="text-2xl font-bold text-gray-900">
                  ${(currentReport.total_spend || 0).toLocaleString()}
                </div>
              </div>
              

            </div>

            <div className="text-xs text-gray-500">
              <div>Period: {currentReport.date_range_start} to {currentReport.date_range_end}</div>
              <div>Last Updated: {new Date(currentReport.last_updated || Date.now()).toLocaleString()}</div>
              <div>Data Source: {dataSource?.source}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 