'use client';

import React, { useState, useEffect } from 'react';
import { 
  Target,
  Monitor,
  AlertCircle,
  BarChart3,
  RefreshCw,
  FileSpreadsheet,
  MousePointer,
  Eye,
  ChevronDown,
  ChevronUp,
  Search,
  Smartphone,
  Users
} from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import GoogleAdsDemographicPieCharts from './GoogleAdsDemographicPieCharts';

interface GoogleAdsPlacementPerformance {
  network: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conversionValue: number;
  roas: number;
}

interface GoogleAdsDemographicPerformance {
  ageRange: string;
  gender: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conversionValue: number;
  roas: number;
}

interface GoogleAdsDevicePerformance {
  device: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conversionValue: number;
  roas: number;
}

interface GoogleAdsKeywordPerformance {
  keyword: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conversionValue: number;
  roas: number;
}

interface GoogleAdsTablesProps {
  dateStart: string;
  dateEnd: string;
  clientId: string;
  onDataLoaded?: (tablesData: any) => void;
}

const GoogleAdsTables: React.FC<GoogleAdsTablesProps> = ({ dateStart, dateEnd, clientId, onDataLoaded }) => {
  const [placementData, setPlacementData] = useState<GoogleAdsPlacementPerformance[]>([]);
  const [deviceData, setDeviceData] = useState<GoogleAdsDevicePerformance[]>([]);
  const [keywordData, setKeywordData] = useState<GoogleAdsKeywordPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'placement' | 'device' | 'keywords'>('placement');
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({});
  const [retryKey, setRetryKey] = useState(0);
  const [isRequestInProgress, setIsRequestInProgress] = useState(false);

  // Transform Google Ads API data into table format
  const transformGoogleAdsDataToTables = (apiData: any) => {
    console.log('🔄 Transforming Google Ads API data to tables format');
    console.log('🔍 Transform input apiData:', {
      hasCampaigns: !!apiData.campaigns,
      campaignCount: apiData.campaigns?.length || 0,
      hasGoogleAdsTables: !!apiData.googleAdsTables,
      googleAdsTablesKeys: apiData.googleAdsTables ? Object.keys(apiData.googleAdsTables) : 'none',
      sampleGoogleAdsTable: apiData.googleAdsTables
    });
    
    // Extract data from API response
    const campaigns = apiData.campaigns || [];
    const googleAdsTables = apiData.googleAdsTables || {};
    const networkPerformance = googleAdsTables.networkPerformance || [];
    const devicePerformance = googleAdsTables.devicePerformance || [];
    const keywordPerformance = googleAdsTables.keywordPerformance || [];

    console.log('🔍 Extracted table data:', {
      networkCount: networkPerformance.length,
      deviceCount: devicePerformance.length,
      keywordCount: keywordPerformance.length,
      sampleDeviceData: devicePerformance[0],
      sampleKeywordData: keywordPerformance[0]
    });
    
    // Transform network/placement data - use real API data if available, otherwise aggregate from campaigns
    let placementPerformance: GoogleAdsPlacementPerformance[] = [];
    
    if (networkPerformance.length > 0) {
      // Use real network performance data from API
      placementPerformance = networkPerformance.map((network: any) => ({
        network: network.network || network.adNetworkType || 'Unknown Network',
        spend: network.spend || 0,
        impressions: network.impressions || 0,
        clicks: network.clicks || 0,
        ctr: network.ctr || 0,
        cpc: network.cpc || 0,
        conversions: network.conversions || 0,
        conversionValue: network.conversionValue || network.conversion_value || 0,
        roas: network.roas || 0
      }));
    } else {
      // No fallback fake data - show empty if no real network data available
      placementPerformance = [];
    }

    // Demographics removed - not available through Google Ads API

    // Transform device data
    const transformedDevicePerformance: GoogleAdsDevicePerformance[] = devicePerformance.map((device: any) => ({
      device: device.device || 'Nieznane',
      spend: device.spend || 0,
      impressions: device.impressions || 0,
      clicks: device.clicks || 0,
      ctr: device.ctr || 0,
      cpc: device.cpc || 0,
      conversions: device.conversions || 0,
      conversionValue: device.conversionValue || device.conversion_value || 0,
      roas: device.roas || 0
    }));

    // Transform keyword data
    const transformedKeywordPerformance: GoogleAdsKeywordPerformance[] = keywordPerformance.map((keyword: any) => ({
      keyword: keyword.keyword || 'Nieznane',
      spend: keyword.spend || 0,
      impressions: keyword.impressions || 0,
      clicks: keyword.clicks || 0,
      ctr: keyword.ctr || 0,
      cpc: keyword.cpc || 0,
      conversions: keyword.conversions || 0,
      conversionValue: keyword.conversionValue || keyword.conversion_value || 0,
      roas: keyword.roas || 0
    }));

    // Return only real data - no fallback fake data
    const result = {
      placementPerformance: placementPerformance,
      demographicPerformance: [], // Empty - not available through Google Ads API
      devicePerformance: transformedDevicePerformance,
      keywordPerformance: transformedKeywordPerformance
    };

    console.log('🔍 Transform result:', {
      placementCount: result.placementPerformance.length,
      deviceCount: result.devicePerformance.length,
      keywordCount: result.keywordPerformance.length,
      sampleDevice: result.devicePerformance[0],
      sampleKeyword: result.keywordPerformance[0]
    });

    return result;
  };

  useEffect(() => {
    console.log('🔄 useEffect triggered with:', { dateStart, dateEnd, clientId, retryKey });

  const fetchGoogleAdsTablesData = async () => {
    try {
      // Prevent duplicate requests
      if (isRequestInProgress) {
        console.log('🚫 Request already in progress, skipping duplicate');
        return;
      }
      
      console.log('🚀 Starting Google Ads tables data fetch...');
      setIsRequestInProgress(true);
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No authentication token available');
      }

      console.log('🔍 Fetching Google Ads tables data for period:', dateStart, 'to', dateEnd);

      // Fetch real Google Ads data using the existing API endpoint
      console.log('📡 Making API request to /api/fetch-google-ads-live-data');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      const response = await fetch('/api/fetch-google-ads-live-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          clientId: clientId,
          dateRange: {
            start: dateStart,
            end: dateEnd
          },
          includeTableData: true
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      console.log('📡 API response received:', response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📊 Google Ads tables API response:', data);
      console.log('🔍 CRITICAL DEBUG - Raw response structure:', {
        hasSuccess: 'success' in data,
        success: data.success,
        hasData: 'data' in data,
        dataType: typeof data.data,
        dataKeys: data.data ? Object.keys(data.data) : 'no data object',
        fullResponse: JSON.stringify(data, null, 2)
      });
      console.log('🔍 GoogleAdsTables: Checking response structure:', {
        hasSuccess: 'success' in data,
        success: data.success,
        hasData: 'data' in data,
        dataKeys: data.data ? Object.keys(data.data) : 'no data',
        hasGoogleAdsTables: data.data?.googleAdsTables ? 'yes' : 'no',
        googleAdsTablesKeys: data.data?.googleAdsTables ? Object.keys(data.data.googleAdsTables) : 'none'
      });

      // Extract the actual data from API response
      const apiData = data.success ? data.data : data;
      console.log('🔍 GoogleAdsTables: Using apiData:', {
        hasCampaigns: !!apiData.campaigns,
        campaignCount: apiData.campaigns?.length || 0,
        hasGoogleAdsTables: !!apiData.googleAdsTables,
        googleAdsTablesStructure: apiData.googleAdsTables ? Object.keys(apiData.googleAdsTables) : 'none'
      });

      // Transform the API data into table format
      console.log('🔄 About to transform Google Ads data:', apiData);
      const transformedData = transformGoogleAdsDataToTables(apiData);
      console.log('✅ Transformed data:', transformedData);

      setPlacementData(transformedData.placementPerformance);
      setDeviceData(transformedData.devicePerformance);
      setKeywordData(transformedData.keywordPerformance);
      
      console.log('✅ State updated with:', {
        placementCount: transformedData.placementPerformance.length,
        deviceCount: transformedData.devicePerformance.length,
        keywordCount: transformedData.keywordPerformance.length
      });

      if (onDataLoaded) {
        onDataLoaded(transformedData);
      }

    } catch (err) {
      console.error('❌ Error fetching Google Ads tables data:', err);
      
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
      setError(err instanceof Error ? err.message : 'Failed to load Google Ads data');
      }
    } finally {
      console.log('🏁 CRITICAL: Google Ads tables fetch completed, setting loading to false');
      console.log('🏁 CRITICAL: About to call setLoading(false)');
      setLoading(false);
      setIsRequestInProgress(false);
      console.log('🏁 CRITICAL: setLoading(false) called successfully');
    }
  };

    // Reset data and show loading when any dependency changes
    setLoading(true);
    setError(null);
    setPlacementData([]);
    setDeviceData([]);
    setKeywordData([]);
    
    fetchGoogleAdsTablesData();
  }, [dateStart, dateEnd, clientId, retryKey]);

  const retryFetch = () => {
    setRetryKey(prev => prev + 1); // This will trigger useEffect to re-run
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${dateStart}_to_${dateEnd}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN'
    }).format(amount);
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('pl-PL').format(num);
  };

  const formatPercentage = (num: number): string => {
    return `${num.toFixed(2)}%`;
  };

  // Show loading if explicitly loading OR if we have no data yet (initial state)
  const hasAnyData = placementData.length > 0 || deviceData.length > 0 || keywordData.length > 0;
  const shouldShowLoading = loading || (!hasAnyData && !error);

  console.log('🔍 Render state check:', {
    loading,
    hasAnyData,
    error,
    shouldShowLoading,
    placementCount: placementData.length,
    deviceCount: deviceData.length,
    keywordCount: keywordData.length
  });

  if (shouldShowLoading) {
    console.log('📊 Showing loading state');
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center justify-center space-x-3">
          <RefreshCw className="w-5 h-5 text-slate-900 animate-spin" />
          <span className="text-slate-600">Ładowanie danych Google Ads...</span>
        </div>
      </div>
    );
  }

  if (error) {
    console.log('❌ Showing error state:', error);
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center space-x-3 text-orange-600 mb-4">
          <AlertCircle className="w-5 h-5" />
          <span>Błąd: {error}</span>
        </div>
        <button
          onClick={retryFetch}
          className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 shadow-sm rounded-lg transition-all duration-200 font-medium"
        >
          Spróbuj ponownie
        </button>
      </div>
    );
  }

  console.log('✅ Rendering main Google Ads tables component');

  return (
    <div className="space-y-8">
      {/* Tab Navigation - Premium Design */}
      <div className="flex space-x-2 bg-slate-100 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('placement')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === 'placement'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Target className="h-4 w-4" />
          <span>Sieci reklamowe</span>
        </button>
        <button
          onClick={() => setActiveTab('device')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === 'device'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Smartphone className="h-4 w-4" />
          <span>Urządzenia</span>
        </button>
        <button
          onClick={() => setActiveTab('keywords')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === 'keywords'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Search className="h-4 w-4" />
          <span>Słowa kluczowe</span>
        </button>
      </div>

      {/* Table Content - Premium Card Design */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
      >


        {/* Placement/Network Performance Tab */}
        {activeTab === 'placement' && (
          <div>
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-semibold text-slate-900 mb-1">Sieci Reklamowe</h3>
                <p className="text-sm text-slate-600">
                  Wydajność kampanii według sieci reklamowych Google Ads
                </p>
              </div>
            </div>

            {placementData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Sieć</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Wydatki</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Wyświetlenia</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Kliknięcia</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">CTR</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">CPC</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Ilość rezerwacji</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Wartość rezerwacji</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">ROAS</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {placementData.map((network, index) => (
                      <tr key={index} className={`${index % 2 === 1 ? 'bg-slate-50/30' : ''} hover:bg-slate-50`}>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">{network.network}</td>
                        <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatCurrency(network.spend)}</td>
                        <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatNumber(network.impressions)}</td>
                        <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatNumber(network.clicks)}</td>
                        <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatPercentage(network.ctr)}</td>
                        <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatCurrency(network.cpc)}</td>
                        <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatNumber(network.conversions)}</td>
                        <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatCurrency(network.conversionValue)}</td>
                        <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{network.roas.toFixed(2)}x</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                Brak danych sieci reklamowych dla wybranego okresu.
              </div>
            )}
          </div>
        )}

        {/* Device Performance Tab */}
        {activeTab === 'device' && (
          <div>
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-semibold text-slate-900 mb-1">Wydajność Urządzeń</h3>
                <p className="text-sm text-slate-600">
                  Wydajność kampanii według typów urządzeń
                </p>
              </div>
            </div>

            {deviceData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Urządzenie</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Wydatki</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Wyświetlenia</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Kliknięcia</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">CTR</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">CPC</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Ilość rezerwacji</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Wartość rezerwacji</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">ROAS</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {deviceData.map((device, index) => (
                      <tr key={index} className={`${index % 2 === 1 ? 'bg-slate-50/30' : ''} hover:bg-slate-50`}>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">{device.device}</td>
                        <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatCurrency(device.spend)}</td>
                        <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatNumber(device.impressions)}</td>
                        <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatNumber(device.clicks)}</td>
                        <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatPercentage(device.ctr)}</td>
                        <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatCurrency(device.cpc)}</td>
                        <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatNumber(device.conversions)}</td>
                        <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatCurrency(device.conversionValue)}</td>
                        <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{device.roas.toFixed(2)}x</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
            <div className="text-center py-8 text-slate-500">
                Brak danych urządzeń dla wybranego okresu.
              </div>
            )}
          </div>
        )}

        {/* Keywords Performance Tab */}
        {activeTab === 'keywords' && (
          <div>
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-semibold text-slate-900 mb-1">Słowa Kluczowe</h3>
                <p className="text-sm text-slate-600">
                  Wydajność najważniejszych słów kluczowych
                </p>
              </div>
            </div>

            {keywordData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Słowo Kluczowe</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Wydatki</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Wyświetlenia</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Kliknięcia</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">CTR</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">CPC</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Konwersje</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">ROAS</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {keywordData.map((keyword, index) => (
                      <tr key={index} className={`${index % 2 === 1 ? 'bg-slate-50/30' : ''} hover:bg-slate-50`}>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">{keyword.keyword}</td>
                        <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatCurrency(keyword.spend)}</td>
                        <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatNumber(keyword.impressions)}</td>
                        <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatNumber(keyword.clicks)}</td>
                        <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatPercentage(keyword.ctr)}</td>
                        <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatCurrency(keyword.cpc)}</td>
                        <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatNumber(keyword.conversions)}</td>
                        <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{keyword.roas.toFixed(2)}x</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                Brak danych słów kluczowych dla wybranego okresu.
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default GoogleAdsTables; 