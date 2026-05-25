'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Target,
  Monitor,
  AlertCircle,
  BarChart3,
  FileSpreadsheet,
  MousePointer,
  Eye,
  ChevronDown,
  ChevronUp,
  Search,
  Smartphone,
  Users,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import GoogleAdsDemographicPieCharts from './GoogleAdsDemographicPieCharts';
import PolandRegionMap, { type GeographicRow, type MapMetric } from './PolandRegionMap';
import { formatPolishCityName, formatPolishVoivodeshipName } from '../lib/polish-geo-display';
import { mergeGoogleAdsDevicePerformanceRows } from '../lib/google-ads-device-pl';
import { useMetricsConfig } from '../lib/useMetricsConfig';
import type { MetricSection } from '../lib/default-metrics-config';
import { hasConfiguredColumns } from '../lib/configured-report-columns';

// Each row carries EXACTLY one of `gender` or `ageRange` (never both) because
// Google Ads API does not provide an age×gender cross-tab. The pie chart
// renderer filters on which dimension is set before aggregating, which avoids
// double-counting a "Nieznane" bucket.
interface GoogleAdsDemographicPerformance {
  gender?: string;
  ageRange?: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conversionValue: number;
  reservations?: number;
  reservation_value?: number;
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
  // 🔧 NEW: Accept pre-loaded tables data to avoid duplicate API calls
  preloadedTablesData?: {
    networkPerformance?: any[];
    devicePerformance?: any[];
    keywordPerformance?: any[];
    searchTermPerformance?: any[];
    qualityMetrics?: any[];
    demographicPerformance?: any[];
    geographicPerformance?: any[];
  } | null;
  /**
   * Optional campaign-level totals so the Poland map can compute and display
   * a "Nieznana lokalizacja" bucket equal to the gap between campaign totals
   * and the `geographic_view` aggregate.
   */
  campaignTotals?: {
    spend?: number;
    clicks?: number;
    conversions?: number;
    conversion_value?: number;
  } | null;
}

interface SearchTermPerformance {
  search_term: string;
  match_type: string;
  campaign_name: string;
  ad_group_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conversion_value: number;
  roas: number;
}

const TOP_CONVERTING_KEYWORDS_AND_TERMS = 10;

const GoogleAdsTables: React.FC<GoogleAdsTablesProps> = ({ dateStart, dateEnd, clientId, onDataLoaded, preloadedTablesData, campaignTotals }) => {
  const [deviceData, setDeviceData] = useState<GoogleAdsDevicePerformance[]>([]);
  const [keywordData, setKeywordData] = useState<GoogleAdsKeywordPerformance[]>([]);
  const [searchTermData, setSearchTermData] = useState<SearchTermPerformance[]>([]);
  const [demographicData, setDemographicData] = useState<GoogleAdsDemographicPerformance[]>([]);
  const [demographicMetric, setDemographicMetric] = useState<'conversionValue' | 'clicks' | 'impressions'>('conversionValue');
  const [geographicData, setGeographicData] = useState<GeographicRow[]>([]);
  const [geographicMetric, setGeographicMetric] = useState<'spend' | 'clicks' | 'conversion_value'>('conversion_value');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Tabs were removed in favor of stacked sections so every Google Ads
  // breakdown shows under "Szczegóły Kampanii" without extra clicks.
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({});
  const [retryKey, setRetryKey] = useState(0);
  const [isRequestInProgress, setIsRequestInProgress] = useState(false);
  const { config: metricsConfig, getMetricName, isMetricVisible } = useMetricsConfig(clientId || null, 'google');
  const label = (section: MetricSection, key: string, fallback: string) =>
    getMetricName(section, key) || fallback;
  const visible = (section: MetricSection, key: string) => isMetricVisible(section, key);
  const sectionVisible = (section: MetricSection) => hasConfiguredColumns(metricsConfig, section);
  const geographicMetricOptions = [
    { value: 'conversion_value' as const, key: 'conversion_value', fallback: 'Wartość konwersji' },
    { value: 'clicks' as const, key: 'totalClicks', fallback: 'Kliknięcia' },
    { value: 'spend' as const, key: 'totalSpend', fallback: 'Wydatki' },
  ].filter((option) => visible('geographic_map', option.key));
  const effectiveGeographicMetric =
    geographicMetricOptions.some((option) => option.value === geographicMetric)
      ? geographicMetric
      : geographicMetricOptions[0]?.value || geographicMetric;
  const demographicMetricOptions = [
    { value: 'conversionValue' as const, key: 'reservation_value', fallback: 'Wartość konwersji' },
    { value: 'clicks' as const, key: 'totalClicks', fallback: 'Kliknięcia' },
    { value: 'impressions' as const, key: 'totalImpressions', fallback: 'Wyświetlenia' },
  ].filter((option) => visible('demographic_breakdown', option.key));
  const effectiveDemographicMetric =
    demographicMetricOptions.some((option) => option.value === demographicMetric)
      ? demographicMetric
      : demographicMetricOptions[0]?.value || demographicMetric;

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
    const googleAdsTables = apiData.googleAdsTables || {};
    const devicePerformance = googleAdsTables.devicePerformance || [];
    const keywordPerformance = googleAdsTables.keywordPerformance || [];
    const searchTermPerformance = googleAdsTables.searchTermPerformance || [];
    const demographicPerformance = googleAdsTables.demographicPerformance || [];
    const geographicPerformance = googleAdsTables.geographicPerformance || [];

    console.log('🔍 Extracted table data:', {
      deviceCount: devicePerformance.length,
      keywordCount: keywordPerformance.length,
      sampleDeviceData: devicePerformance[0],
      sampleKeywordData: keywordPerformance[0]
    });

    // Transform demographics from getDemographicPerformance (gender_view + age_range_view).
    // Rows are tagged with exactly one of `gender` or `ageRange`; we preserve
    // that tagging so the pie chart renderer can filter per dimension.
    const transformedDemographicPerformance: GoogleAdsDemographicPerformance[] = demographicPerformance.map((row: any) => ({
      gender: row.gender,
      ageRange: row.ageRange ?? row.age,
      spend: row.spend || 0,
      impressions: row.impressions || 0,
      clicks: row.clicks || 0,
      ctr: row.ctr || 0,
      cpc: row.cpc || 0,
      conversions: row.conversions || 0,
      conversionValue: row.conversion_value ?? row.conversionValue ?? row.reservation_value ?? 0,
      reservations: row.reservations ?? row.conversions ?? 0,
      reservation_value: row.reservation_value ?? row.conversion_value ?? 0,
      roas: row.roas || 0,
    }));

    // Merge rows that resolve to the same Polish device label (e.g. CTV from
    // mixed enum/cache shapes) and recompute CTR/CPC/ROAS from totals.
    const transformedDevicePerformance: GoogleAdsDevicePerformance[] = mergeGoogleAdsDevicePerformanceRows(
      devicePerformance.map((device: any) => ({
        device: device.device ?? device.deviceType,
        spend: device.spend || 0,
        impressions: device.impressions || 0,
        clicks: device.clicks || 0,
        conversions: device.conversions || 0,
        conversionValue: device.conversionValue || device.conversion_value || 0,
      })),
    );

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

    const result = {
      // Sieci reklamowe UI removed; keep empty array for callers expecting the key.
      placementPerformance: [],
      demographicPerformance: transformedDemographicPerformance,
      devicePerformance: transformedDevicePerformance,
      keywordPerformance: transformedKeywordPerformance,
      searchTermPerformance: searchTermPerformance,
      // Geographic rows already arrive in the right shape from
      // getGeographicPerformance - we just pass them through.
      geographicPerformance: geographicPerformance as GeographicRow[]
    };

    console.log('🔍 Transform result:', {
      deviceCount: result.devicePerformance.length,
      keywordCount: result.keywordPerformance.length,
      searchTermCount: result.searchTermPerformance.length,
      demographicCount: result.demographicPerformance.length,
      geographicCount: result.geographicPerformance.length,
      sampleDevice: result.devicePerformance[0],
      sampleKeyword: result.keywordPerformance[0],
      sampleDemographic: result.demographicPerformance[0],
      sampleGeographic: result.geographicPerformance[0]
    });

    return result;
  };

  useEffect(() => {
    console.log('🔄 useEffect triggered with:', { dateStart, dateEnd, clientId, retryKey, hasPreloadedData: !!preloadedTablesData });

    let cancelled = false;

    // When the parent already has tables (e.g. smart cache / live standardized fetch),
    // apply them every time deps change — avoids duplicate fetches and prevents a stuck
    // loading state when Strict Mode re-runs the effect after `usedPreloadedData` was true.
    if (preloadedTablesData) {
      console.log('⚡ Using preloaded Google Ads tables data (no API call needed)');
      const transformedData = transformGoogleAdsDataToTables({ googleAdsTables: preloadedTablesData });

      setDeviceData(transformedData.devicePerformance);
      setKeywordData(transformedData.keywordPerformance);
      setSearchTermData(transformedData.searchTermPerformance);
      setDemographicData(transformedData.demographicPerformance);
      setGeographicData(transformedData.geographicPerformance);
      setLoading(false);
      setError(null);
      setIsRequestInProgress(false);

      if (onDataLoaded) {
        onDataLoaded({
          placementPerformance: [],
          devicePerformance: transformedData.devicePerformance,
          keywordPerformance: transformedData.keywordPerformance,
          searchTermPerformance: transformedData.searchTermPerformance,
          demographicPerformance: transformedData.demographicPerformance,
          geographicPerformance: transformedData.geographicPerformance,
        });
      }
      return () => {
        cancelled = true;
      };
    }

  const fetchGoogleAdsTablesData = async () => {
    try {
      console.log('🚀 Starting Google Ads tables data fetch (no preloaded data available)...');
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
      if (cancelled) return;
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

      if (cancelled) return;

      setDeviceData(transformedData.devicePerformance);
      setKeywordData(transformedData.keywordPerformance);
      setSearchTermData(transformedData.searchTermPerformance || []);
      setDemographicData(transformedData.demographicPerformance || []);
      setGeographicData(transformedData.geographicPerformance || []);
      
      console.log('✅ State updated with:', {
        deviceCount: transformedData.devicePerformance.length,
        keywordCount: transformedData.keywordPerformance.length,
        demographicCount: transformedData.demographicPerformance.length,
        geographicCount: transformedData.geographicPerformance.length,
      });

      if (onDataLoaded) {
        onDataLoaded(transformedData);
      }

    } catch (err) {
      if (cancelled) return;
      console.error('❌ Error fetching Google Ads tables data:', err);
      
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
      setError(err instanceof Error ? err.message : 'Failed to load Google Ads data');
      }
    } finally {
      console.log('🏁 CRITICAL: Google Ads tables fetch completed, setting loading to false');
      console.log('🏁 CRITICAL: About to call setLoading(false)');
      if (!cancelled) {
        setLoading(false);
        setIsRequestInProgress(false);
      }
      console.log('🏁 CRITICAL: setLoading(false) called successfully');
    }
  };

    setLoading(true);
    setError(null);
    setDeviceData([]);
    setKeywordData([]);
    setSearchTermData([]);
    setDemographicData([]);
    setGeographicData([]);

    fetchGoogleAdsTablesData();

    return () => {
      cancelled = true;
    };
  }, [dateStart, dateEnd, clientId, retryKey, preloadedTablesData]);

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

  const formatGeographicRegionName = (row: GeographicRow): string => {
    if (row.countryCode && row.countryCode !== 'PL') {
      return row.regionName?.trim() || row.countryName || row.countryCode;
    }
    return formatPolishVoivodeshipName(row);
  };

  const topCitiesByClicks = useMemo(
    () =>
      [...geographicData]
        .filter((r) => r.cityName && r.cityName !== '(nieznane)')
        .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
        .slice(0, 15),
    [geographicData],
  );

  const topKeywordsByConversions = useMemo(
    () =>
      [...keywordData]
        .sort((a, b) => (b.conversions || 0) - (a.conversions || 0))
        .slice(0, TOP_CONVERTING_KEYWORDS_AND_TERMS),
    [keywordData],
  );

  const topSearchTermsByConversions = useMemo(
    () =>
      [...searchTermData]
        .sort((a, b) => (b.conversions || 0) - (a.conversions || 0))
        .slice(0, TOP_CONVERTING_KEYWORDS_AND_TERMS),
    [searchTermData],
  );

  // Show loading if explicitly loading OR if we have no data yet (initial state)
  const hasAnyData =
    deviceData.length > 0 ||
    keywordData.length > 0 ||
    searchTermData.length > 0 ||
    demographicData.length > 0 ||
    geographicData.length > 0;
  // Only the explicit loading flag drives the spinner; empty breakdown rows are valid.
  const shouldShowLoading = loading;

  console.log('🔍 Render state check:', {
    loading,
    hasAnyData,
    error,
    shouldShowLoading,
    deviceCount: deviceData.length,
    keywordCount: keywordData.length
  });

  if (shouldShowLoading) {
    return null;
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

  // All sections render stacked below "Szczegóły Kampanii". Order: devices,
  // geographic map, demographics, then top keywords and search terms (by
  // conversions). Each section gets its own card so visual separation is preserved.
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-5"
    >

        {/* Device Performance Section */}
        {sectionVisible('device_table') && (
        <div id="google-devices" className="order-3 scroll-mt-24 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <h3 className="mb-0.5 text-lg font-semibold text-slate-900">Wydajność Urządzeń</h3>
                <p className="text-xs text-slate-500">
                  Wydajność kampanii według typów urządzeń
                </p>
              </div>
            </div>

            {deviceData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      {visible('device_table', 'device') && <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500">{label('device_table', 'device', 'Urządzenie')}</th>}
                      {visible('device_table', 'totalSpend') && <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500">{label('device_table', 'totalSpend', 'Wydatki')}</th>}
                      {visible('device_table', 'totalImpressions') && <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500">{label('device_table', 'totalImpressions', 'Wyświetlenia')}</th>}
                      {visible('device_table', 'totalClicks') && <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500">{label('device_table', 'totalClicks', 'Kliknięcia')}</th>}
                      {visible('device_table', 'averageCtr') && <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500">{label('device_table', 'averageCtr', 'CTR')}</th>}
                      {visible('device_table', 'averageCpc') && <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500">{label('device_table', 'averageCpc', 'CPC')}</th>}
                      {visible('device_table', 'totalConversions') && <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500">{label('device_table', 'totalConversions', 'Konwersje')}</th>}
                      {visible('device_table', 'conversion_value') && <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500">{label('device_table', 'conversion_value', 'Wartość konwersji')}</th>}
                      {visible('device_table', 'roas') && <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500">{label('device_table', 'roas', 'ROAS')}</th>}
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {deviceData.map((device, index) => (
                      <tr key={index} className={`${index % 2 === 1 ? 'bg-slate-50/30' : ''} hover:bg-slate-50`}>
                        {visible('device_table', 'device') && <td className="px-4 py-2.5 text-[13px] font-medium text-slate-900">{device.device}</td>}
                        {visible('device_table', 'totalSpend') && <td className="px-4 py-2.5 text-right text-[13px] text-slate-900 tabular-nums">{formatCurrency(device.spend)}</td>}
                        {visible('device_table', 'totalImpressions') && <td className="px-4 py-2.5 text-right text-[13px] text-slate-900 tabular-nums">{formatNumber(device.impressions)}</td>}
                        {visible('device_table', 'totalClicks') && <td className="px-4 py-2.5 text-right text-[13px] text-slate-900 tabular-nums">{formatNumber(device.clicks)}</td>}
                        {visible('device_table', 'averageCtr') && <td className="px-4 py-2.5 text-right text-[13px] text-slate-900 tabular-nums">{formatPercentage(device.ctr)}</td>}
                        {visible('device_table', 'averageCpc') && <td className="px-4 py-2.5 text-right text-[13px] text-slate-900 tabular-nums">{formatCurrency(device.cpc)}</td>}
                        {visible('device_table', 'totalConversions') && <td className="px-4 py-2.5 text-right text-[13px] text-slate-900 tabular-nums">{formatNumber(device.conversions)}</td>}
                        {visible('device_table', 'conversion_value') && <td className="px-4 py-2.5 text-right text-[13px] text-slate-900 tabular-nums">{formatCurrency(device.conversionValue)}</td>}
                        {visible('device_table', 'roas') && <td className="px-4 py-2.5 text-right text-[13px] text-slate-900 tabular-nums">{device.roas.toFixed(2)}x</td>}
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

        {/* Geographic: integrated map + city details */}
        {sectionVisible('geographic_map') && (
        <div id="google-regions" className="order-1 scroll-mt-24 space-y-4">
            <PolandRegionMap
              data={geographicData}
              metric={effectiveGeographicMetric}
              metricOptions={geographicMetricOptions.map((option) => ({
                value: option.value as MapMetric,
                label: label('geographic_map', option.key, option.fallback),
              }))}
              onMetricChange={(nextMetric) => setGeographicMetric(nextMetric as typeof geographicMetric)}
              platformLabel="Google Ads"
              campaignTotals={campaignTotals ?? null}
            />

            {topCitiesByClicks.length > 0 && (
                  <div id="google-cities" className="scroll-mt-24 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                    <div className="border-b border-slate-100 px-4 py-3">
                      <h3 className="text-sm font-semibold text-slate-900">Najlepiej konwertujące miasta</h3>
                      <p className="text-xs text-slate-500">
                        Miasta z największą liczbą kliknięć (top 15)
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50">
                          <tr>
                            {visible('geographic_map', 'city') && <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500">{label('geographic_map', 'city', 'Miasto')}</th>}
                            {visible('geographic_map', 'region') && <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500">{label('geographic_map', 'region', 'Województwo')}</th>}
                            {visible('geographic_map', 'totalSpend') && <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500">{label('geographic_map', 'totalSpend', 'Wydatki')}</th>}
                            {visible('geographic_map', 'totalClicks') && <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500">{label('geographic_map', 'totalClicks', 'Kliknięcia')}</th>}
                            {visible('geographic_map', 'conversion_value') && <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500">{label('geographic_map', 'conversion_value', 'Wartość konwersji')}</th>}
                          </tr>
                        </thead>
                        <tbody className="bg-white">
                          {topCitiesByClicks.map((row, index) => {
                              const spend = row.spend || 0;
                              const convVal = row.conversion_value || 0;
                              return (
                                <tr key={`${row.cityName}-${row.regionCode}-${index}`} className={`${index % 2 === 1 ? 'bg-slate-50/30' : ''} hover:bg-slate-50`}>
                                  {visible('geographic_map', 'city') && <td className="px-4 py-2.5 text-[13px] font-medium text-slate-900">{formatPolishCityName(row.cityName)}</td>}
                                  {visible('geographic_map', 'region') && <td className="px-4 py-2.5 text-[13px] text-slate-600">{formatGeographicRegionName(row)}</td>}
                                  {visible('geographic_map', 'totalSpend') && <td className="px-4 py-2.5 text-right text-[13px] text-slate-900 tabular-nums">{formatCurrency(spend)}</td>}
                                  {visible('geographic_map', 'totalClicks') && <td className="px-4 py-2.5 text-right text-[13px] text-slate-900 tabular-nums">{formatNumber(row.clicks || 0)}</td>}
                                  {visible('geographic_map', 'conversion_value') && <td className="px-4 py-2.5 text-right text-[13px] text-slate-900 tabular-nums">{formatCurrency(convVal)}</td>}
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
            )}
        </div>
        )}

        {/* Demographics: age + gender */}
        {sectionVisible('demographic_breakdown') && (
        <div id="google-demographics" className="order-4 scroll-mt-24 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <h3 className="mb-0.5 text-lg font-semibold text-slate-900">Wyniki demograficzne</h3>
                <p className="text-xs text-slate-500">
                  Podział według płci i grup wiekowych
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-medium text-slate-500">Metryka:</span>
                <select
                  value={effectiveDemographicMetric}
                  onChange={(e) => setDemographicMetric(e.target.value as typeof demographicMetric)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  {demographicMetricOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {label('demographic_breakdown', option.key, option.fallback)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-4">
              {demographicData.length > 0 ? (
                <GoogleAdsDemographicPieCharts
                  data={demographicData as any}
                  metric={effectiveDemographicMetric}
                />
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <p>Brak danych demograficznych dla wybranego okresu.</p>
                  <p className="text-xs mt-2 text-slate-400">
                    Dane demograficzne pojawiają się dla kampanii z targetowaniem demograficznym (Display, Video, Performance Max, Discovery).
                  </p>
                </div>
              )}
            </div>
        </div>
        )}

        {/* Keywords — top 10 by conversions (after demographics) */}
        {sectionVisible('keyword_table') && (
        <div id="advanced-data" className="order-5 scroll-mt-24 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <h3 className="mb-0.5 text-lg font-semibold text-slate-900">Słowa Kluczowe</h3>
                <p className="text-xs text-slate-500">
                  Top {TOP_CONVERTING_KEYWORDS_AND_TERMS} słów kluczowych według liczby konwersji
                </p>
              </div>
            </div>

            {keywordData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      {visible('keyword_table', 'keyword') && <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500">{label('keyword_table', 'keyword', 'Słowo Kluczowe')}</th>}
                      {visible('keyword_table', 'totalSpend') && <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">{label('keyword_table', 'totalSpend', 'Wydatki')}</th>}
                      {visible('keyword_table', 'totalImpressions') && <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">{label('keyword_table', 'totalImpressions', 'Wyświetlenia')}</th>}
                      {visible('keyword_table', 'totalClicks') && <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">{label('keyword_table', 'totalClicks', 'Kliknięcia')}</th>}
                      {visible('keyword_table', 'averageCtr') && <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">{label('keyword_table', 'averageCtr', 'CTR')}</th>}
                      {visible('keyword_table', 'averageCpc') && <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">{label('keyword_table', 'averageCpc', 'CPC')}</th>}
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {topKeywordsByConversions.map((keyword, index) => (
                      <tr key={`${keyword.keyword}-${index}`} className={`${index % 2 === 1 ? 'bg-slate-50/30' : ''} hover:bg-slate-50`}>
                        {visible('keyword_table', 'keyword') && <td className="px-4 py-2.5 text-[13px] font-medium text-slate-900">{keyword.keyword}</td>}
                        {visible('keyword_table', 'totalSpend') && <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatCurrency(keyword.spend)}</td>}
                        {visible('keyword_table', 'totalImpressions') && <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatNumber(keyword.impressions)}</td>}
                        {visible('keyword_table', 'totalClicks') && <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatNumber(keyword.clicks)}</td>}
                        {visible('keyword_table', 'averageCtr') && <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatPercentage(keyword.ctr)}</td>}
                        {visible('keyword_table', 'averageCpc') && <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatCurrency(keyword.cpc)}</td>}
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

        {/* Search terms — top by conversions */}
        {sectionVisible('search_terms_table') && (
        <div className="order-6 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <h3 className="mb-0.5 text-lg font-semibold text-slate-900">Wyszukiwane hasła (Search Terms)</h3>
                <p className="text-xs text-slate-500">
                  Top {TOP_CONVERTING_KEYWORDS_AND_TERMS} zapytań według liczby konwersji — rzeczywiste wyszukiwania, które uruchomiły reklamy
                </p>
              </div>
            </div>

            {searchTermData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      {visible('search_terms_table', 'search_term') && <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{label('search_terms_table', 'search_term', 'Wyszukiwane hasło')}</th>}
                      {visible('search_terms_table', 'match_type') && <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{label('search_terms_table', 'match_type', 'Typ dopasowania')}</th>}
                      {visible('search_terms_table', 'campaign_name') && <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{label('search_terms_table', 'campaign_name', 'Kampania')}</th>}
                      {visible('search_terms_table', 'ad_group_name') && <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{label('search_terms_table', 'ad_group_name', 'Grupa reklam')}</th>}
                      {visible('search_terms_table', 'totalSpend') && <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">{label('search_terms_table', 'totalSpend', 'Wydatki')}</th>}
                      {visible('search_terms_table', 'totalImpressions') && <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">{label('search_terms_table', 'totalImpressions', 'Wyświetlenia')}</th>}
                      {visible('search_terms_table', 'totalClicks') && <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">{label('search_terms_table', 'totalClicks', 'Kliknięcia')}</th>}
                      {visible('search_terms_table', 'averageCtr') && <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">{label('search_terms_table', 'averageCtr', 'CTR')}</th>}
                      {visible('search_terms_table', 'averageCpc') && <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">{label('search_terms_table', 'averageCpc', 'CPC')}</th>}
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {topSearchTermsByConversions.map((term, index) => (
                      <tr key={`${term.search_term}-${term.campaign_name}-${index}`} className={`${index % 2 === 1 ? 'bg-slate-50/30' : ''} hover:bg-slate-50`}>
                        {visible('search_terms_table', 'search_term') && <td className="px-6 py-4 text-sm font-medium text-slate-900">{term.search_term}</td>}
                        {visible('search_terms_table', 'match_type') && <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded">
                            {term.match_type}
                          </span>
                        </td>}
                        {visible('search_terms_table', 'campaign_name') && <td className="px-6 py-4 text-sm text-slate-600">{term.campaign_name}</td>}
                        {visible('search_terms_table', 'ad_group_name') && <td className="px-6 py-4 text-sm text-slate-600">{term.ad_group_name}</td>}
                        {visible('search_terms_table', 'totalSpend') && <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatCurrency(term.spend)}</td>}
                        {visible('search_terms_table', 'totalImpressions') && <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatNumber(term.impressions)}</td>}
                        {visible('search_terms_table', 'totalClicks') && <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatNumber(term.clicks)}</td>}
                        {visible('search_terms_table', 'averageCtr') && <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatPercentage(term.ctr)}</td>}
                        {visible('search_terms_table', 'averageCpc') && <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatCurrency(term.cpc)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                Brak danych wyszukiwanych haseł dla wybranego okresu.
              </div>
            )}
        </div>
        )}
    </motion.div>
  );
};

export default GoogleAdsTables; 