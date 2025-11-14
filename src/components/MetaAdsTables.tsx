'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Award,
  AlertCircle,
  BarChart3,
  RefreshCw,
  FileSpreadsheet,
  MousePointer,
  Eye,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import DemographicPieCharts from './DemographicPieCharts';

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

interface MetaAdsTablesProps {
  dateStart: string;
  dateEnd: string;
  clientId?: string;
  onDataLoaded?: (data: {
    placementPerformance: PlacementPerformance[];
    demographicPerformance: DemographicPerformance[];
    adRelevanceResults: AdRelevanceResult[];
  }) => void;
}

const MetaAdsTables: React.FC<MetaAdsTablesProps> = ({ dateStart, dateEnd, clientId, onDataLoaded }) => {
  const [placementData, setPlacementData] = useState<PlacementPerformance[]>([]);
  const [demographicData, setDemographicData] = useState<DemographicPerformance[]>([]);
  const [adRelevanceData, setAdRelevanceData] = useState<AdRelevanceResult[]>([]);
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
  const [activeTab, setActiveTab] = useState<'placement' | 'demographic' | 'adRelevance'>('placement');
  // 🔧 FIX: Default to 'spend' since reservation_value not available in demographic breakdowns
  const [demographicMetric, setDemographicMetric] = useState<'impressions' | 'clicks' | 'spend'>('spend');
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    console.log('📊 MetaAdsTables: Fetching data for client:', clientId, 'dates:', dateStart, 'to', dateEnd);
    fetchMetaTablesData();
  }, [dateStart, dateEnd, clientId]); // 🔧 FIX: Add clientId to dependencies

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
        placementCount: result.data?.metaTables?.placementPerformance?.length || 0
      });
      
      if (result.success) {
        // Set data source information for cache indicator
        setDataSource(result.debug?.source || 'unknown');
        setCacheAge(result.debug?.cacheAge || null);

        const placementArray = result.data.metaTables?.placementPerformance || [];
        const rawDemographicArray = result.data.metaTables?.demographicPerformance || [];
        const adRelevanceArray = result.data.metaTables?.adRelevanceResults || [];
        
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
        setAdRelevanceData(adRelevanceArray);
        
        // Call the callback with the loaded data
        if (onDataLoaded) {
          onDataLoaded({
            placementPerformance: result.data.metaTables?.placementPerformance || [],
            demographicPerformance: result.data.metaTables?.demographicPerformance || [],
            adRelevanceResults: result.data.metaTables?.adRelevanceResults || []
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
    const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
    return numValue.toLocaleString();
  };

  // Enhanced ranking badge component with hover effects
  const RankingBadge = ({ rank, index }: { rank: number; index: number }) => {
    const [isHovered, setIsHovered] = useState(false);
    
    const getBadgeStyle = (index: number) => {
      const baseStyle = {
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: 600,
        transition: 'all 0.2s ease',
        marginRight: '12px'
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
  const hasNoData = placementData.length === 0 && demographicData.length === 0 && adRelevanceData.length === 0;
  
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
    <div className="space-y-8">
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
          <BarChart3 className="h-4 w-4" />
          <span>Najlepsze Miejsca Docelowe</span>
        </button>
        <button
          onClick={() => setActiveTab('demographic')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === 'demographic'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Wyniki Demograficzne</span>
        </button>
        <button
          onClick={() => setActiveTab('adRelevance')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === 'adRelevance'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Award className="h-4 w-4" />
          <span>Trafność Reklam i Wyniki</span>
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
        {activeTab === 'placement' && (
          <div>
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-1">Najlepsze Miejsca Docelowe</h3>
                <p className="text-sm text-slate-600">
                  Skuteczność reklam według placementów
                  {placementData.length > 5 && !expandedSections['placement'] && ` • Pokazano top 5`}
                </p>
              </div>
              <button
                onClick={() => exportToCSV(placementData, 'placement-performance')}
                className="flex items-center space-x-2 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium"
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
                        <th className="px-6 py-4 text-left text-sm font-medium text-slate-700">
                          Miejsce Docelowe
                        </th>
                        <th className="px-6 py-4 text-right text-sm font-medium text-slate-700">
                          Wydatki
                        </th>
                        <th className="px-6 py-4 text-right text-sm font-medium text-slate-700">
                          Wyświetlenia
                        </th>
                        <th className="px-6 py-4 text-right text-sm font-medium text-slate-700">
                          Kliknięcia
                        </th>
                        <th className="px-6 py-4 text-right text-sm font-medium text-slate-700">
                          CTR
                        </th>
                        <th className="px-6 py-4 text-right text-sm font-medium text-slate-700">
                          CPC
                        </th>
                        <th className="px-6 py-4 text-right text-sm font-medium text-slate-700">
                          Ilość rezerwacji
                        </th>
                        <th className="px-6 py-4 text-right text-sm font-medium text-slate-700">
                          Wartość rezerwacji
                        </th>
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
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <RankingBadge rank={index + 1} index={index} />
                                <span className="text-sm font-medium text-slate-900">{placement.placement}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="text-sm font-semibold text-slate-900 tabular-nums">{formatCurrency(placement.spend)}</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="text-sm text-slate-900 tabular-nums">{formatNumber(placement.impressions)}</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="text-sm text-slate-900 tabular-nums">{formatNumber(placement.clicks)}</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="text-sm text-slate-900 tabular-nums">{formatPercentage(placement.ctr)}</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="text-sm text-slate-900 tabular-nums">{formatCurrency(placement.cpc)}</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="text-sm text-slate-900 tabular-nums">{placement.reservations || 0}</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="text-sm text-slate-900 tabular-nums">{formatCurrency(placement.reservation_value || 0)}</span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* See More/Less Button for Placement */}
                {placementData.length > 5 && (
                  <div className="flex justify-center py-4 border-t border-gray-100">
                    <button
                      onClick={() => toggleSectionExpansion('placement')}
                      className="flex items-center space-x-2 px-6 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 text-sm font-medium text-gray-700"
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

        {activeTab === 'demographic' && (
          <div>
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-1">Wyniki Demograficzne</h3>
                <p className="text-sm text-slate-600">
                  Skuteczność reklam według demografii
                  {demographicData.length > 5 && !expandedSections['demographic'] && ` • Pokazano top 5`}
                </p>

              </div>
              <div className="flex items-center space-x-4">
                {/* Enhanced Metric Selector */}
                <div className="flex items-center space-x-2 bg-slate-100 rounded-xl p-1">
                  <button
                    onClick={() => setDemographicMetric('spend')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      demographicMetric === 'spend'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <BarChart3 className="h-4 w-4" />
                      <span>Wydatki</span>
                    </div>
                  </button>

                  <button
                    onClick={() => setDemographicMetric('impressions')}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      demographicMetric === 'impressions'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Eye className="h-4 w-4" />
                      <span>Wyświetlenia</span>
                    </div>
                  </button>

                  <button
                    onClick={() => setDemographicMetric('clicks')}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      demographicMetric === 'clicks'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                    }`}
                    
                  >
                    <div className="flex items-center space-x-2">
                      <MousePointer className="h-4 w-4" />
                      <span>Kliknięcia</span>
                    </div>
                  </button>
                </div>
                <button
                  onClick={() => exportToCSV(demographicData, 'demographic-performance')}
                  className="flex items-center space-x-2 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 px-4 py-2 rounded-lg transition-all duration-200 font-medium"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>Eksportuj CSV</span>
                </button>
              </div>
            </div>
            
            {demographicData.length > 0 ? (
              <div>
                {/* Demographic Charts Section */}
                <div className="p-6 border-b border-slate-100">
                  <DemographicPieCharts data={demographicData} metric={demographicMetric} />
                </div>

                {/* Detailed Table Section */}
                <div className="p-6">
                  <div className="mb-6">
                    <h4 className="text-lg font-bold text-slate-900 mb-2">Szczegółowe Dane Demograficzne</h4>
                    <p className="text-sm text-slate-600">Tabela z wszystkimi danymi demograficznymi</p>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Wiek
                          </th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Płeć
                          </th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Wydatki
                          </th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Kliknięcia
                          </th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Rezerwacje
                          </th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Wartość Rezerwacji
                          </th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            ROAS
                          </th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Koszt/Rezerwacja
                          </th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Etap 1
                          </th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Etap 2
                          </th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Etap 3
                          </th>
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
                              <td className="px-4 py-4">
                                <div className="flex items-center">
                                  <RankingBadge rank={index + 1} index={index} />
                                  <span className="text-sm font-medium text-slate-900">{translateAgeLabel(demographic.age)}</span>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <span className="text-sm text-slate-900">{translateGenderLabel(demographic.gender)}</span>
                              </td>
                              <td className="px-4 py-4">
                                <span className="text-sm font-semibold text-slate-900">{formatCurrency(demographic.spend)}</span>
                              </td>
                              <td className="px-4 py-4">
                                <span className="text-sm text-slate-900">{formatNumber(demographic.clicks)}</span>
                              </td>
                              <td className="px-4 py-4">
                                <span className="text-sm font-bold text-blue-600">{formatNumber(demographic.reservations)}</span>
                              </td>
                              <td className="px-4 py-4">
                                <span className="text-sm font-bold text-green-600">{formatCurrency(demographic.reservation_value)}</span>
                              </td>
                              <td className="px-4 py-4">
                                <span className={`text-sm font-semibold tabular-nums ${demographic.roas > 2 ? 'text-slate-900' : demographic.roas > 1 ? 'text-slate-700' : 'text-orange-600'}`}>
                                  {demographic.roas > 0 ? `${demographic.roas.toFixed(2)}x` : '-'}
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <span className="text-sm text-slate-900">
                                  {demographic.cost_per_reservation > 0 ? formatCurrency(demographic.cost_per_reservation) : '-'}
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <span className="text-sm text-gray-700">{formatNumber(demographic.booking_step_1)}</span>
                              </td>
                              <td className="px-4 py-4">
                                <span className="text-sm text-gray-700">{formatNumber(demographic.booking_step_2)}</span>
                              </td>
                              <td className="px-4 py-4">
                                <span className="text-sm text-gray-700">{formatNumber(demographic.booking_step_3)}</span>
                              </td>
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

        {activeTab === 'adRelevance' && (
          <div>
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-1">Trafność Reklam i Wyniki</h3>
                <p className="text-sm text-slate-600">
                  Skuteczność reklam według relevance
                  {adRelevanceData.length > 5 && !expandedSections['adRelevance'] && ` • Pokazano top 5`}
                </p>
              </div>
              <button
                onClick={() => exportToCSV(adRelevanceData, 'ad-relevance-results')}
                className="flex items-center space-x-2 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 px-4 py-2 rounded-lg transition-all duration-200 font-medium"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>Eksportuj CSV</span>
              </button>
            </div>
            
            {adRelevanceData.length > 0 ? (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Nazwa Reklamy
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Wydatki
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Wyświetlenia
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Kliknięcia
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          CPC
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Ilość rezerwacji
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Wartość rezerwacji
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {adRelevanceData
                        .sort((a, b) => b.spend - a.spend)
                        .slice(0, expandedSections['adRelevance'] ? undefined : 5)
                        .map((ad, index) => (
                          <tr 
                            key={index} 
                            className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                            style={{ borderColor: '#E7EAF3', height: '56px' }}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <RankingBadge rank={index + 1} index={index} />
                                <span className="text-sm font-medium text-slate-900">{ad.ad_name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm font-semibold text-slate-900">{formatCurrency(ad.spend)}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-slate-900">{formatNumber(ad.impressions)}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-slate-900">{formatNumber(ad.clicks)}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-slate-900">{ad.cpc ? formatCurrency(ad.cpc) : 'N/A'}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-slate-900">{formatNumber(ad.reservations || 0)}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-slate-900">{formatCurrency(ad.reservation_value || 0)}</span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* See More/Less Button for Ad Relevance */}
                {adRelevanceData.length > 5 && (
                  <div className="flex justify-center py-4 border-t border-gray-100">
                    <button
                      onClick={() => toggleSectionExpansion('adRelevance')}
                      className="flex items-center space-x-2 px-6 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 text-sm font-medium text-gray-700"
                    >
                      {expandedSections['adRelevance'] ? (
                        <>
                          <ChevronUp className="w-4 h-4" />
                          <span>Pokaż mniej</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4" />
                          <span>Zobacz więcej ({adRelevanceData.length - 5} więcej)</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <Award className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">Brak danych o trafności</h3>
                <p className="text-slate-600">Nie znaleziono danych o trafności reklam dla wybranego okresu.</p>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default MetaAdsTables; 