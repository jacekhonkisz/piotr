'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  AlertCircle,
  BarChart3,
  RefreshCw,
  FileSpreadsheet,
  MousePointer,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import DemographicPieCharts from './DemographicPieCharts';
import PolandRegionMap, { type GeographicRow, type MapMetric } from './PolandRegionMap';
import { useMetricsConfig } from '../lib/useMetricsConfig';
import type { MetricSection } from '../lib/default-metrics-config';
import { hasConfiguredColumns } from '../lib/configured-report-columns';
import { formatPolishVoivodeshipName } from '../lib/polish-geo-display';

interface PlacementPerformance {
  placement: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpa?: number;
  cpp?: number;
  reservations?: number;
  reservation_value?: number;
}

interface DemographicPerformance {
  age: string;
  gender: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpp?: number;
  // Enhanced conversion metrics by demographics
  reservations: number;
  reservation_value: number;
  roas: number;
  cost_per_reservation: number;
  conversion_rate: number;
  booking_step_1: number;
  booking_step_2: number;
  booking_step_3: number;
  click_to_call: number;
  email_contacts: number;
}

interface AdRelevanceResult {
  ad_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  cpc?: number;
  reservations?: number;
  reservation_value?: number;
}

interface GeographicPerformance {
  countryCode?: string | null;
  countryName?: string;
  regionName?: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions?: number;
  reservations?: number;
  conversion_value?: number;
  reservation_value?: number;
}

interface MetaAdsTablesProps {
  dateStart: string;
  dateEnd: string;
  clientId?: string;
  campaignTotals?: {
    spend?: number;
    impressions?: number;
    clicks?: number;
    conversions?: number;
    conversion_value?: number;
  } | null;
  preloadedTablesData?: {
    placementPerformance?: PlacementPerformance[];
    demographicPerformance?: DemographicPerformance[];
    adRelevanceResults?: AdRelevanceResult[];
    geographicPerformance?: GeographicPerformance[];
  } | null;
  onDataLoaded?: (data: {
    placementPerformance: PlacementPerformance[];
    demographicPerformance: DemographicPerformance[];
    adRelevanceResults: AdRelevanceResult[];
    geographicPerformance: GeographicPerformance[];
  }) => void;
}

type MetaGeographicMetric = 'spend' | 'clicks' | 'impressions';

const META_TOP_REGIONS_LIMIT = 10;

const MetaAdsTables: React.FC<MetaAdsTablesProps> = ({ dateStart, dateEnd, clientId, preloadedTablesData, campaignTotals, onDataLoaded }) => {
  const [placementData, setPlacementData] = useState<PlacementPerformance[]>([]);
  const [demographicData, setDemographicData] = useState<DemographicPerformance[]>([]);
  const [geographicData, setGeographicData] = useState<GeographicRow[]>([]);
  const [geographicMetric, setGeographicMetric] = useState<MetaGeographicMetric>('clicks');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<string>('unknown');
  const [cacheAge, setCacheAge] = useState<number | null>(null);

  // Helper function to translate gender labels
  const translateGenderLabel = (label: string) => {
    switch (label.toLowerCase()) {
      case 'male': return 'Mężczyźni';
      case 'female': return 'Kobiety';
      case 'mężczyźni': return 'Mężczyźni'; // Already translated
      case 'kobiety': return 'Kobiety'; // Already translated
      case 'nieznane': return 'Nieznane';
      case 'unknown': return 'Nieznane';
      default: return 'Nieznane';
    }
  };

  // Helper function to translate age labels  
  const translateAgeLabel = (label: string) => {
    if (label === 'Nieznane' || label === 'Unknown' || label === 'unknown') return 'Nieznane';
    return label; // Age ranges like "25-34" don't need translation
  };
  // 🔧 FIX: Default to 'spend' since reservation_value not available in demographic breakdowns
  const [demographicMetric, setDemographicMetric] = useState<'impressions' | 'clicks' | 'spend'>('spend');
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({});
  const { config: metricsConfig, getMetricName, isMetricVisible } = useMetricsConfig(clientId || null, 'meta');
  const label = (section: MetricSection, key: string, fallback: string) =>
    getMetricName(section, key) || fallback;
  const visible = (section: MetricSection, key: string) => isMetricVisible(section, key);
  const sectionVisible = (section: MetricSection) => hasConfiguredColumns(metricsConfig, section);
  const geographicMetricOptions = [
    { value: 'spend' as const, key: 'totalSpend', fallback: 'Wydatki' },
    { value: 'clicks' as const, key: 'totalClicks', fallback: 'Kliknięcia' },
    { value: 'impressions' as const, key: 'totalImpressions', fallback: 'Wyświetlenia' },
  ];
  const effectiveGeographicMetric =
    geographicMetricOptions.some((option) => option.value === geographicMetric)
      ? geographicMetric
      : 'clicks';
  const getGeographicMetricValue = (row: GeographicRow, metric: MetaGeographicMetric) => {
    if (metric === 'spend') return row.spend || 0;
    if (metric === 'clicks') return row.clicks || 0;
    return row.impressions || 0;
  };
  const topRegionsByMetric = useMemo(
    () =>
      [...geographicData]
        .filter((row) => !row.countryCode || row.countryCode === 'PL')
        .filter((row) => row.regionName && row.regionName !== '(nieznane)')
        .sort(
          (a, b) =>
            getGeographicMetricValue(b, effectiveGeographicMetric) - getGeographicMetricValue(a, effectiveGeographicMetric),
        )
        .slice(0, META_TOP_REGIONS_LIMIT),
    [geographicData, effectiveGeographicMetric],
  );

  useEffect(() => {
    if (preloadedTablesData) {
      const placementPerformance = preloadedTablesData.placementPerformance || [];
      const demographicPerformance = preloadedTablesData.demographicPerformance || [];
      const adRelevanceResults = preloadedTablesData.adRelevanceResults || [];
      const geographicPerformance = preloadedTablesData.geographicPerformance || [];
      setPlacementData(placementPerformance);
      setDemographicData(demographicPerformance);
      setGeographicData(geographicPerformance as GeographicRow[]);
      setDataSource('sample-preview');
      setCacheAge(null);
      setLoading(false);
      onDataLoaded?.({ placementPerformance, demographicPerformance, adRelevanceResults, geographicPerformance });
      return;
    }

    console.log('📊 MetaAdsTables: Fetching data for client:', clientId, 'dates:', dateStart, 'to', dateEnd);
    fetchMetaTablesData();
  }, [dateStart, dateEnd, clientId, preloadedTablesData]); // 🔧 FIX: Add clientId to dependencies

  const fetchMetaTablesData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get the current session token from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch('/api/fetch-meta-tables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          dateRange: {
            start: dateStart,
            end: dateEnd
          }, 
          clientId 
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      console.log('📊 MetaAdsTables API response:', {
        success: result.success,
        source: result.debug?.source,
        demographicCount: result.data?.metaTables?.demographicPerformance?.length || 0,
        placementCount: result.data?.metaTables?.placementPerformance?.length || 0,
        geographicCount: result.data?.metaTables?.geographicPerformance?.length || 0,
        debugGeographicCount: result.debug?.geographicCount,
      });
      
      if (result.success) {
        // Set data source information for cache indicator
        setDataSource(result.debug?.source || 'unknown');
        setCacheAge(result.debug?.cacheAge || null);

        const placementArray = result.data.metaTables?.placementPerformance || [];
        const rawDemographicArray = result.data.metaTables?.demographicPerformance || [];
        const geographicArray = (result.data.metaTables?.geographicPerformance || []).map((item: any) => ({
          ...item,
          spend: typeof item.spend === 'string' ? parseFloat(item.spend) : (item.spend || 0),
          impressions: typeof item.impressions === 'string' ? parseInt(item.impressions, 10) : (item.impressions || 0),
          clicks: typeof item.clicks === 'string' ? parseInt(item.clicks, 10) : (item.clicks || 0),
          conversions: typeof item.conversions === 'string' ? parseInt(item.conversions, 10) : (item.conversions || item.reservations || 0),
          reservation_value: typeof item.reservation_value === 'string'
            ? parseFloat(item.reservation_value)
            : (item.reservation_value || item.conversion_value || 0),
        }));
        
        // 🔍 DEBUG: Log placement data to verify transformation
        console.log('🔍 PLACEMENT DATA DEBUG:', {
          placementCount: placementArray.length,
          firstPlacement: placementArray[0],
          hasPlacementField: placementArray[0]?.placement ? 'YES' : 'NO',
          rawFields: {
            publisher_platform: placementArray[0]?.publisher_platform,
            platform_position: placementArray[0]?.platform_position
          }
        });
        
        // Clean up demographic data to ensure Polish labels AND convert strings to numbers
        const demographicArray = rawDemographicArray.map((item: any) => ({
          ...item,
          // Gender is already translated in meta-api.ts, so just use it directly
          gender: item.gender || 'Nieznane',
          age: translateAgeLabel(item.age || 'Nieznane'),
          // 🔧 FIX: Convert string values to numbers (Meta API returns strings)
          spend: typeof item.spend === 'string' ? parseFloat(item.spend) : (item.spend || 0),
          impressions: typeof item.impressions === 'string' ? parseInt(item.impressions) : (item.impressions || 0),
          clicks: typeof item.clicks === 'string' ? parseInt(item.clicks) : (item.clicks || 0),
          cpm: typeof item.cpm === 'string' ? parseFloat(item.cpm) : (item.cpm || 0),
          cpc: typeof item.cpc === 'string' ? parseFloat(item.cpc) : (item.cpc || 0),
          ctr: typeof item.ctr === 'string' ? parseFloat(item.ctr) : (item.ctr || 0)
        }));
        
        setPlacementData(placementArray);
        setDemographicData(demographicArray);
        setGeographicData(geographicArray as GeographicRow[]);
        
        // Call the callback with the loaded data
        if (onDataLoaded) {
          onDataLoaded({
            placementPerformance: result.data.metaTables?.placementPerformance || [],
            demographicPerformance: result.data.metaTables?.demographicPerformance || [],
            adRelevanceResults: result.data.metaTables?.adRelevanceResults || [],
            geographicPerformance: geographicArray,
          });
        }
      } else {
        throw new Error(result.error || 'Failed to fetch data');
      }
    } catch (err) {
      console.error('Error fetching Meta tables data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header]}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatCurrency = (value: number) => {
    const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
    return `${numValue.toFixed(2)} zł`;
  };
  
  const formatPercentage = (value: number) => {
    const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
    return `${numValue.toFixed(2)}%`;
  };
  
  const formatNumber = (value: number) => {
    const numValue = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
    return numValue.toLocaleString();
  };

  // Enhanced ranking badge component with hover effects
  const RankingBadge = ({ rank, index }: { rank: number; index: number }) => {
    const [isHovered, setIsHovered] = useState(false);
    
    const getBadgeStyle = (index: number) => {
      const baseStyle = {
        width: '22px',
        height: '22px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '10px',
        fontWeight: 600,
        transition: 'all 0.2s ease',
        marginRight: '8px'
      };

      switch (index) {
        case 0:
          return {
            ...baseStyle,
            background: isHovered 
              ? 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)' 
              : 'linear-gradient(135deg, #FEF3C7 0%, #FCD34D 100%)',
            color: '#92400E',
            boxShadow: isHovered ? '0 2px 8px rgba(251, 191, 36, 0.3)' : '0 1px 3px rgba(251, 191, 36, 0.2)'
          };
        case 1:
          return {
            ...baseStyle,
            background: isHovered 
              ? 'linear-gradient(135deg, #E5E7EB 0%, #D1D5DB 100%)' 
              : 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)',
            color: '#374151',
            boxShadow: isHovered ? '0 2px 8px rgba(107, 114, 128, 0.3)' : '0 1px 3px rgba(107, 114, 128, 0.2)'
          };
        case 2:
          return {
            ...baseStyle,
            background: isHovered 
              ? 'linear-gradient(135deg, #FED7AA 0%, #FDBA74 100%)' 
              : 'linear-gradient(135deg, #FED7AA 0%, #FB923C 100%)',
            color: '#EA580C',
            boxShadow: isHovered ? '0 2px 8px rgba(251, 146, 60, 0.3)' : '0 1px 3px rgba(251, 146, 60, 0.2)'
          };
        default:
          return {
            ...baseStyle,
            background: isHovered 
              ? 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)' 
              : 'linear-gradient(135deg, #F9FAFB 0%, #F3F4F6 100%)',
            color: '#6B7280',
            boxShadow: isHovered ? '0 2px 8px rgba(107, 114, 128, 0.2)' : '0 1px 3px rgba(107, 114, 128, 0.1)'
          };
      }
    };

    return (
      <div
        style={getBadgeStyle(index)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        #{rank}
      </div>
    );
  };

  const toggleSectionExpansion = (sectionKey: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <RefreshCw className="h-8 w-8 text-gray-400 animate-spin" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Ładowanie danych z Meta Ads</h3>
          <p className="text-slate-600">Pobieranie najnowszych informacji o kampaniach...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="h-10 w-10 text-red-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-3">Błąd podczas ładowania danych</h3>
        <p className="text-slate-600 mb-6 max-w-md mx-auto">{error}</p>
        <button
          onClick={fetchMetaTablesData}
          className="bg-slate-900 text-white px-6 py-3 rounded-xl hover:bg-slate-800 transition-all duration-200 font-medium shadow-sm"
        >
          Spróbuj ponownie
        </button>
      </div>
    );
  }

  // Check if all tables have no data
  const hasNoData = placementData.length === 0 && demographicData.length === 0 && geographicData.length === 0;
  
  if (hasNoData && !loading) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <BarChart3 className="h-10 w-10 text-gray-400" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-3">Brak danych dla tego okresu</h3>
        <p className="text-slate-600 mb-6 max-w-md mx-auto">
          Nie znaleziono danych z Meta Ads API dla wybranego okresu ({dateStart} - {dateEnd}). 
          Sprawdź czy masz aktywne kampanie w tym czasie.
        </p>
        <div className="bg-gray-50 rounded-2xl p-4 max-w-md mx-auto" style={{ border: '1px solid #E7EAF3' }}>
          <p className="text-sm text-gray-700 font-medium">💡 Wskazówka: Spróbuj wybrać inny miesiąc lub sprawdź czy kampanie są aktywne.</p>
        </div>
      </div>
    );
  }

  // Format cache age for display
  const formatCacheAge = (ageMs: number | null) => {
    if (ageMs === null || ageMs === 0) return null;
    const minutes = Math.floor(ageMs / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h temu`;
    if (minutes > 0) return `${minutes}min temu`;
    return 'teraz';
  };

  const cacheAgeDisplay = formatCacheAge(cacheAge);

  return (
    <div className="space-y-4">
      {/* Cache Status Indicator */}
      {dataSource && (
        <div className="flex items-center justify-end gap-2 text-xs">
          <span className="text-slate-600">Źródło danych:</span>
          {dataSource === 'smart-cache' ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-md font-medium">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              Cache {cacheAgeDisplay && `(${cacheAgeDisplay})`}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-md font-medium">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
              Live API
            </span>
          )}
        </div>
      )}
      
      <div className="space-y-4">
        {sectionVisible('placement_table') && (
          <div
            id="meta-placements"
            className="scroll-mt-24 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <h3 className="mb-0.5 text-lg font-semibold text-slate-900">Najlepsze Miejsca Docelowe</h3>
                <p className="text-xs text-slate-500">
                  Skuteczność reklam według placementów
                  {placementData.length > 5 && !expandedSections['placement'] && ` • Pokazano top 5`}
                </p>
              </div>
              <button
                onClick={() => exportToCSV(placementData, 'placement-performance')}
                className="flex items-center space-x-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-all duration-200 hover:bg-slate-50 hover:text-slate-900"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>Eksportuj CSV</span>
              </button>
            </div>
            
            {placementData.length > 0 ? (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        {visible('placement_table', 'placement') && <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500">{label('placement_table', 'placement', 'Miejsce Docelowe')}</th>}
                        {visible('placement_table', 'totalSpend') && <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500">{label('placement_table', 'totalSpend', 'Wydatki')}</th>}
                        {visible('placement_table', 'totalImpressions') && <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500">{label('placement_table', 'totalImpressions', 'Wyświetlenia')}</th>}
                        {visible('placement_table', 'totalClicks') && <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500">{label('placement_table', 'totalClicks', 'Kliknięcia')}</th>}
                        {visible('placement_table', 'averageCtr') && <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500">{label('placement_table', 'averageCtr', 'Współczynnik kliknięć z linku')}</th>}
                        {visible('placement_table', 'averageCpc') && <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500">{label('placement_table', 'averageCpc', 'Koszt kliknięcia linku')}</th>}
                        {visible('placement_table', 'reservations') && <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500">{label('placement_table', 'reservations', 'Ilość rezerwacji')}</th>}
                        {visible('placement_table', 'reservation_value') && <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500">{label('placement_table', 'reservation_value', 'Wartość rezerwacji')}</th>}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {placementData
                        .sort((a, b) => b.spend - a.spend)
                        .slice(0, expandedSections['placement'] ? undefined : 5)
                        .map((placement, index) => (
                          <tr 
                            key={index} 
                            className={`hover:bg-slate-50 transition-colors ${index % 2 === 1 ? 'bg-slate-50/30' : ''}`}
                          >
                            {visible('placement_table', 'placement') && <td className="px-4 py-2.5">
                              <div className="flex items-center">
                                <RankingBadge rank={index + 1} index={index} />
                                <span className="text-[13px] font-medium text-slate-900">{placement.placement}</span>
                              </div>
                            </td>}
                            {visible('placement_table', 'totalSpend') && <td className="px-4 py-2.5 text-right">
                              <span className="text-[13px] font-semibold text-slate-900 tabular-nums">{formatCurrency(placement.spend)}</span>
                            </td>}
                            {visible('placement_table', 'totalImpressions') && <td className="px-4 py-2.5 text-right">
                              <span className="text-[13px] text-slate-900 tabular-nums">{formatNumber(placement.impressions)}</span>
                            </td>}
                            {visible('placement_table', 'totalClicks') && <td className="px-4 py-2.5 text-right">
                              <span className="text-[13px] text-slate-900 tabular-nums">{formatNumber(placement.clicks)}</span>
                            </td>}
                            {visible('placement_table', 'averageCtr') && <td className="px-4 py-2.5 text-right">
                              <span className="text-[13px] text-slate-900 tabular-nums">{formatPercentage(placement.ctr)}</span>
                            </td>}
                            {visible('placement_table', 'averageCpc') && <td className="px-4 py-2.5 text-right">
                              <span className="text-[13px] text-slate-900 tabular-nums">{formatCurrency(placement.cpc)}</span>
                            </td>}
                            {visible('placement_table', 'reservations') && <td className="px-4 py-2.5 text-right">
                              <span className="text-[13px] text-slate-900 tabular-nums">{placement.reservations || 0}</span>
                            </td>}
                            {visible('placement_table', 'reservation_value') && <td className="px-4 py-2.5 text-right">
                              <span className="text-[13px] text-slate-900 tabular-nums">{formatCurrency(placement.reservation_value || 0)}</span>
                            </td>}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* See More/Less Button for Placement */}
                {placementData.length > 5 && (
                  <div className="flex justify-center border-t border-gray-100 py-2.5">
                    <button
                      onClick={() => toggleSectionExpansion('placement')}
                      className="flex items-center space-x-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-all duration-200 hover:border-gray-400 hover:bg-gray-50"
                    >
                      {expandedSections['placement'] ? (
                        <>
                          <ChevronUp className="w-4 h-4" />
                          <span>Pokaż mniej</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4" />
                          <span>Zobacz więcej ({placementData.length - 5} więcej)</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <BarChart3 className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">Brak danych o miejscach docelowych</h3>
                <p className="text-slate-600">Nie znaleziono danych o miejscach docelowych dla wybranego okresu.</p>
              </div>
            )}
          </div>
        )}

        {sectionVisible('geographic_map') && (
          <div
            id="meta-regions"
            className="scroll-mt-24 space-y-4"
          >
            <PolandRegionMap
              data={geographicData}
              metric={effectiveGeographicMetric}
              sectionSubtitle="Wyniki według regionów i miast"
              metricOptions={geographicMetricOptions.map((option) => ({
                value: option.value as MapMetric,
                label: label('geographic_map', option.key, option.fallback),
              }))}
              onMetricChange={(nextMetric) => setGeographicMetric(nextMetric as MetaGeographicMetric)}
              platformLabel="Meta Ads"
              campaignTotals={campaignTotals ?? null}
            />

                  {topRegionsByMetric.length > 0 && (
                    <div id="meta-region-details" className="scroll-mt-24 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                      <div className="border-b border-slate-100 px-4 py-3">
                        <h3 className="text-sm font-semibold text-slate-900">Najlepsze regiony</h3>
                        <p className="text-xs text-slate-500">Regiony z najwyższymi wynikami dostarczenia reklam (top 10)</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500">
                                {label('geographic_map', 'region', 'Region')}
                              </th>
                              <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500">
                                {label('geographic_map', 'totalSpend', 'Wydatki')}
                              </th>
                              <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500">
                                {label('geographic_map', 'totalClicks', 'Kliknięcia')}
                              </th>
                              <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500">
                                {label('geographic_map', 'totalImpressions', 'Wyświetlenia')}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white">
                            {topRegionsByMetric.map((row, index) => (
                              <tr
                                key={`${row.regionName}-${index}`}
                                className={`hover:bg-slate-50 ${index % 2 === 1 ? 'bg-slate-50/30' : ''}`}
                              >
                                <td className="px-4 py-2.5 text-[13px] font-medium text-slate-900">
                                  {formatPolishVoivodeshipName(row)}
                                </td>
                                <td className="px-4 py-2.5 text-right text-[13px] tabular-nums text-slate-900">
                                  {formatCurrency(row.spend || 0)}
                                </td>
                                <td className="px-4 py-2.5 text-right text-[13px] tabular-nums text-slate-900">
                                  {formatNumber(row.clicks || 0)}
                                </td>
                                <td className="px-4 py-2.5 text-right text-[13px] tabular-nums text-slate-900">
                                  {formatNumber(row.impressions || 0)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
          </div>
        )}

        {sectionVisible('demographic_breakdown') && (
          <div
            id="meta-demographics"
            className="scroll-mt-24 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <h3 className="mb-0.5 text-lg font-semibold text-slate-900">Wyniki demograficzne</h3>
                <p className="text-xs text-slate-500">
                  Skuteczność reklam według demografii
                  {demographicData.length > 5 && !expandedSections['demographic'] && ` • Pokazano top 5`}
                </p>

              </div>
              <div className="flex items-center space-x-2">
                {/* Enhanced Metric Selector */}
                <div className="flex items-center space-x-1 rounded-lg bg-slate-100 p-0.5">
                  {visible('demographic_breakdown', 'totalSpend') && <button
                    onClick={() => setDemographicMetric('spend')}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                      demographicMetric === 'spend'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5">
                      <BarChart3 className="h-3.5 w-3.5" />
                      <span>{label('demographic_breakdown', 'totalSpend', 'Wydatki')}</span>
                    </div>
                  </button>}

                  {visible('demographic_breakdown', 'totalImpressions') && <button
                    onClick={() => setDemographicMetric('impressions')}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                      demographicMetric === 'impressions'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5">
                      <Eye className="h-3.5 w-3.5" />
                      <span>{label('demographic_breakdown', 'totalImpressions', 'Wyświetlenia')}</span>
                    </div>
                  </button>}

                  {visible('demographic_breakdown', 'totalClicks') && <button
                    onClick={() => setDemographicMetric('clicks')}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                      demographicMetric === 'clicks'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                    }`}
                    
                  >
                    <div className="flex items-center space-x-1.5">
                      <MousePointer className="h-3.5 w-3.5" />
                      <span>{label('demographic_breakdown', 'totalClicks', 'Kliknięcia')}</span>
                    </div>
                  </button>}
                </div>
                <button
                  onClick={() => exportToCSV(demographicData, 'demographic-performance')}
                  className="flex items-center space-x-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-all duration-200 hover:bg-slate-50 hover:text-slate-900"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>Eksportuj CSV</span>
                </button>
              </div>
            </div>
            
            {demographicData.length > 0 ? (
              <div>
                {/* Demographic Charts Section */}
                <div className="border-b border-slate-100 p-4">
                  <DemographicPieCharts data={demographicData} metric={demographicMetric} />
                </div>

                {/* Detailed Table Section */}
                <div className="p-4">
                  <div className="mb-3">
                    <h4 className="text-sm font-semibold text-slate-900">Szczegółowe dane demograficzne</h4>
                    <p className="text-xs text-slate-500">Tabela z wszystkimi danymi demograficznymi</p>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          {visible('demographic_breakdown', 'age') && <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500">{label('demographic_breakdown', 'age', 'Wiek')}</th>}
                          {visible('demographic_breakdown', 'gender') && <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500">{label('demographic_breakdown', 'gender', 'Płeć')}</th>}
                          {visible('demographic_breakdown', 'totalSpend') && <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500">{label('demographic_breakdown', 'totalSpend', 'Wydatki')}</th>}
                          {visible('demographic_breakdown', 'totalClicks') && <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500">{label('demographic_breakdown', 'totalClicks', 'Kliknięcia')}</th>}
                          {visible('demographic_breakdown', 'reservations') && <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500">{label('demographic_breakdown', 'reservations', 'Rezerwacje')}</th>}
                          {visible('demographic_breakdown', 'reservation_value') && <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500">{label('demographic_breakdown', 'reservation_value', 'Wartość Rezerwacji')}</th>}
                          {visible('demographic_breakdown', 'roas') && <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500">{label('demographic_breakdown', 'roas', 'ROAS')}</th>}
                          {visible('demographic_breakdown', 'cost_per_reservation') && <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500">{label('demographic_breakdown', 'cost_per_reservation', 'Koszt/Rezerwacja')}</th>}
                          {visible('demographic_breakdown', 'booking_step_1') && <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500">{label('demographic_breakdown', 'booking_step_1', 'Etap 1')}</th>}
                          {visible('demographic_breakdown', 'booking_step_2') && <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500">{label('demographic_breakdown', 'booking_step_2', 'Etap 2')}</th>}
                          {visible('demographic_breakdown', 'booking_step_3') && <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500">{label('demographic_breakdown', 'booking_step_3', 'Etap 3')}</th>}
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {demographicData
                          .sort((a, b) => b.reservation_value - a.reservation_value) // Sort by reservation value (highest first)
                          .slice(0, expandedSections['demographic'] ? undefined : 5)
                          .map((demographic, index) => (
                            <tr 
                              key={index} 
                              className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                              style={{ borderColor: '#E7EAF3', height: '56px' }}
                            >
                              {visible('demographic_breakdown', 'age') && <td className="px-4 py-4">
                                <div className="flex items-center">
                                  <RankingBadge rank={index + 1} index={index} />
                                  <span className="text-sm font-medium text-slate-900">{translateAgeLabel(demographic.age)}</span>
                                </div>
                              </td>}
                              {visible('demographic_breakdown', 'gender') && <td className="px-4 py-4">
                                <span className="text-sm text-slate-900">{translateGenderLabel(demographic.gender)}</span>
                              </td>}
                              {visible('demographic_breakdown', 'totalSpend') && <td className="px-4 py-4">
                                <span className="text-sm font-semibold text-slate-900">{formatCurrency(demographic.spend)}</span>
                              </td>}
                              {visible('demographic_breakdown', 'totalClicks') && <td className="px-4 py-4">
                                <span className="text-sm text-slate-900">{formatNumber(demographic.clicks)}</span>
                              </td>}
                              {visible('demographic_breakdown', 'reservations') && <td className="px-4 py-4">
                                <span className="text-sm font-bold text-blue-600">{formatNumber(demographic.reservations)}</span>
                              </td>}
                              {visible('demographic_breakdown', 'reservation_value') && <td className="px-4 py-4">
                                <span className="text-sm font-bold text-green-600">{formatCurrency(demographic.reservation_value)}</span>
                              </td>}
                              {visible('demographic_breakdown', 'roas') && <td className="px-4 py-4">
                                <span className={`text-sm font-semibold tabular-nums ${demographic.roas > 2 ? 'text-slate-900' : demographic.roas > 1 ? 'text-slate-700' : 'text-orange-600'}`}>
                                  {demographic.roas > 0 ? `${demographic.roas.toFixed(2)}x` : '-'}
                                </span>
                              </td>}
                              {visible('demographic_breakdown', 'cost_per_reservation') && <td className="px-4 py-4">
                                <span className="text-sm text-slate-900">
                                  {demographic.cost_per_reservation > 0 ? formatCurrency(demographic.cost_per_reservation) : '-'}
                                </span>
                              </td>}
                              {visible('demographic_breakdown', 'booking_step_1') && <td className="px-4 py-4">
                                <span className="text-sm text-gray-700">{formatNumber(demographic.booking_step_1)}</span>
                              </td>}
                              {visible('demographic_breakdown', 'booking_step_2') && <td className="px-4 py-4">
                                <span className="text-sm text-gray-700">{formatNumber(demographic.booking_step_2)}</span>
                              </td>}
                              {visible('demographic_breakdown', 'booking_step_3') && <td className="px-4 py-4">
                                <span className="text-sm text-gray-700">{formatNumber(demographic.booking_step_3)}</span>
                              </td>}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  {/* See More/Less Button for Demographic */}
                  {demographicData.length > 5 && (
                    <div className="flex justify-center py-4 border-t border-gray-100 mt-6">
                      <button
                        onClick={() => toggleSectionExpansion('demographic')}
                        className="flex items-center space-x-2 px-6 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 text-sm font-medium text-gray-700"
                      >
                        {expandedSections['demographic'] ? (
                          <>
                            <ChevronUp className="w-4 h-4" />
                            <span>Pokaż mniej</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4" />
                            <span>Zobacz więcej ({demographicData.length - 5} więcej)</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">Brak danych demograficznych</h3>
                <p className="text-slate-600">Nie znaleziono danych demograficznych dla wybranego okresu.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MetaAdsTables; 