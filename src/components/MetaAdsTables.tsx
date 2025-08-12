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
  cpp?: number;
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
}

interface AdRelevanceResult {
  ad_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  cpp?: number;
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
  const [activeTab, setActiveTab] = useState<'placement' | 'demographic' | 'adRelevance'>('placement');
  const [demographicMetric, setDemographicMetric] = useState<'impressions' | 'clicks'>('impressions');
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    fetchMetaTablesData();
  }, [dateStart, dateEnd]);

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
      
      if (result.success) {
        console.log('🔍 MetaAdsTables received data:', {
          placementDataLength: result.data.metaTables?.placementPerformance?.length || 0,
          demographicDataLength: result.data.metaTables?.demographicPerformance?.length || 0,
          adRelevanceDataLength: result.data.metaTables?.adRelevanceResults?.length || 0,
          sampleDemographicData: result.data.metaTables?.demographicPerformance?.slice(0, 2),
          fullDemographicData: result.data.metaTables?.demographicPerformance
        });
        
        console.log('🔍 MetaAdsTables FULL RESULT:', result);
        console.log('🔍 MetaAdsTables result.data:', result.data);
        console.log('🔍 MetaAdsTables result.data.metaTables:', result.data?.metaTables);
        console.log('🔍 MetaAdsTables result.data keys:', Object.keys(result.data || {}));
        console.log('🔍 MetaAdsTables placement data type:', typeof result.data.metaTables?.placementPerformance, Array.isArray(result.data.metaTables?.placementPerformance));
        console.log('🔍 MetaAdsTables demographic data type:', typeof result.data.metaTables?.demographicPerformance, Array.isArray(result.data.metaTables?.demographicPerformance));
        console.log('🔍 MetaAdsTables ad relevance data type:', typeof result.data.metaTables?.adRelevanceResults, Array.isArray(result.data.metaTables?.adRelevanceResults));

        const placementArray = result.data.metaTables?.placementPerformance || [];
        const demographicArray = result.data.metaTables?.demographicPerformance || [];
        const adRelevanceArray = result.data.metaTables?.adRelevanceResults || [];
        
        console.log('🔍 MetaAdsTables BEFORE setState:', {
          placementArray: placementArray.length,
          demographicArray: demographicArray.length, 
          adRelevanceArray: adRelevanceArray.length,
          placementSample: placementArray.slice(0, 2),
          demographicSample: demographicArray.slice(0, 2),
          adRelevanceSample: adRelevanceArray.slice(0, 2)
        });
        
        setPlacementData(placementArray);
        setDemographicData(demographicArray);
        setAdRelevanceData(adRelevanceArray);
        
        console.log('🔍 MetaAdsTables AFTER setState - checking for empty state condition');
        
        // Log if demographic data is missing
        if (!result.data.metaTables?.demographicPerformance || result.data.metaTables.demographicPerformance.length === 0) {
          console.log('⚠️ No demographic data received from Meta API');
        }
        
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

  const formatCurrency = (value: number) => `${value.toFixed(2)} zł`;
  const formatPercentage = (value: number) => `${value.toFixed(2)}%`;
  const formatNumber = (value: number) => value.toLocaleString();

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
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Ładowanie danych z Meta Ads</h3>
          <p className="text-gray-600">Pobieranie najnowszych informacji o kampaniach...</p>
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
        <h3 className="text-xl font-bold text-gray-900 mb-3">Błąd podczas ładowania danych</h3>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">{error}</p>
        <button
          onClick={fetchMetaTablesData}
          className="bg-blue-600 text-white px-6 py-3 rounded-2xl hover:bg-blue-700 transition-all duration-200 font-medium shadow-sm hover:shadow-md"
          style={{ borderRadius: '16px' }}
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
        <h3 className="text-xl font-bold text-gray-900 mb-3">Brak danych dla tego okresu</h3>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          Nie znaleziono danych z Meta Ads API dla wybranego okresu ({dateStart} - {dateEnd}). 
          Sprawdź czy masz aktywne kampanie w tym czasie.
        </p>
        <div className="bg-gray-50 rounded-2xl p-4 max-w-md mx-auto" style={{ border: '1px solid #E7EAF3' }}>
          <p className="text-sm text-gray-700 font-medium">💡 Wskazówka: Spróbuj wybrać inny miesiąc lub sprawdź czy kampanie są aktywne.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Tab Navigation - Clean Design */}
      <div className="flex space-x-2 bg-white p-2 rounded-2xl" style={{ border: '1px solid #E7EAF3' }}>
        <button
          onClick={() => setActiveTab('placement')}
          className={`flex items-center space-x-3 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
            activeTab === 'placement'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
          style={{ borderRadius: '16px' }}
        >
          <BarChart3 className="h-4 w-4" />
          <span>Top Placement Performance</span>
        </button>
        <button
          onClick={() => setActiveTab('demographic')}
          className={`flex items-center space-x-3 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
            activeTab === 'demographic'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
          style={{ borderRadius: '16px' }}
        >
          <Users className="h-4 w-4" />
          <span>Demographic Performance</span>
        </button>
        <button
          onClick={() => setActiveTab('adRelevance')}
          className={`flex items-center space-x-3 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
            activeTab === 'adRelevance'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
          style={{ borderRadius: '16px' }}
        >
          <Award className="h-4 w-4" />
          <span>Ad Relevance & Results</span>
        </button>
      </div>

      {/* Table Content - Clean Card Design */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-2xl overflow-hidden"
        style={{ border: '1px solid #E7EAF3' }}
      >
        {activeTab === 'placement' && (
          <div>
            <div className="flex items-center justify-between p-6" style={{ borderBottom: '1px solid #E7EAF3' }}>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">Top Placement Performance</h3>
                <p className="text-sm text-gray-600">
                  Skuteczność reklam według placementów
                  {placementData.length > 5 && !expandedSections['placement'] && ` • Pokazano top 5`}
                </p>
              </div>
              <button
                onClick={() => exportToCSV(placementData, 'placement-performance')}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-2xl hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
                style={{ borderRadius: '16px' }}
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span className="font-medium">Export CSV</span>
              </button>
            </div>
            
            {placementData.length > 0 ? (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Placement
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Spend
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Impressions
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Clicks
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          CTR
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          CPC
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          CPA (CPP)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {placementData
                        .sort((a, b) => b.spend - a.spend)
                        .slice(0, expandedSections['placement'] ? undefined : 5)
                        .map((placement, index) => (
                          <tr 
                            key={index} 
                            className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                            style={{ borderColor: '#E7EAF3', height: '56px' }}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <RankingBadge rank={index + 1} index={index} />
                                <span className="text-sm font-medium text-gray-900">{placement.placement}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm font-semibold text-gray-900">{formatCurrency(placement.spend)}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-gray-900">{formatNumber(placement.impressions)}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-gray-900">{formatNumber(placement.clicks)}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-gray-900">{formatPercentage(placement.ctr)}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-gray-900">{formatCurrency(placement.cpc)}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-gray-900">{placement.cpp ? formatCurrency(placement.cpp) : 'N/A'}</span>
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
                <h3 className="text-lg font-medium text-gray-900 mb-2">Brak danych o placementach</h3>
                <p className="text-gray-600">Nie znaleziono danych o placementach dla wybranego okresu.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'demographic' && (
          <div>
            <div className="flex items-center justify-between p-6" style={{ borderBottom: '1px solid #E7EAF3' }}>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">Demographic Performance</h3>
                <p className="text-sm text-gray-600">
                  Skuteczność reklam według demografii
                  {demographicData.length > 5 && !expandedSections['demographic'] && ` • Pokazano top 5`}
                </p>

              </div>
              <div className="flex items-center space-x-4">
                {/* Metric Selector */}
                <div className="flex items-center space-x-2 bg-gray-50 rounded-xl p-1" style={{ border: '1px solid #E7EAF3' }}>
                  <button
                    onClick={() => setDemographicMetric('impressions')}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      demographicMetric === 'impressions'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white'
                    }`}
                    style={{ borderRadius: '16px' }}
                  >
                    <div className="flex items-center space-x-2">
                      <Eye className="h-4 w-4" />
                      <span>Wyświetlenia</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setDemographicMetric('clicks')}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      demographicMetric === 'clicks'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white'
                    }`}
                    style={{ borderRadius: '16px' }}
                  >
                    <div className="flex items-center space-x-2">
                      <MousePointer className="h-4 w-4" />
                      <span>Kliknięcia</span>
                    </div>
                  </button>
                </div>
                <button
                  onClick={() => exportToCSV(demographicData, 'demographic-performance')}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-2xl hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
                  style={{ borderRadius: '16px' }}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span className="font-medium">Export CSV</span>
                </button>
              </div>
            </div>
            
            {demographicData.length > 0 ? (
              <div>
                {/* Demographic Charts Section */}
                <div className="p-6" style={{ borderBottom: '1px solid #E7EAF3' }}>
                  {(() => {
                    console.log('🔍 Rendering DemographicPieCharts with:', {
                      dataLength: demographicData.length,
                      metric: demographicMetric,
                      sampleData: demographicData.slice(0, 2)
                    });
                    return null;
                  })()}
                  <DemographicPieCharts data={demographicData} metric={demographicMetric} />
                </div>

                {/* Detailed Table Section */}
                <div className="p-6">
                  <div className="mb-6">
                    <h4 className="text-lg font-bold text-gray-900 mb-2">Szczegółowe Dane Demograficzne</h4>
                    <p className="text-sm text-gray-600">Tabela z wszystkimi danymi demograficznymi</p>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Wiek
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Płeć
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Spend
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Impressions
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Clicks
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            CTR
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            CPC
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {demographicData
                          .sort((a, b) => b[demographicMetric] - a[demographicMetric])
                          .slice(0, expandedSections['demographic'] ? undefined : 5)
                          .map((demographic, index) => (
                            <tr 
                              key={index} 
                              className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                              style={{ borderColor: '#E7EAF3', height: '56px' }}
                            >
                              <td className="px-6 py-4">
                                <div className="flex items-center">
                                  <RankingBadge rank={index + 1} index={index} />
                                  <span className="text-sm font-medium text-gray-900">{demographic.age}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-sm text-gray-900">{demographic.gender}</span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-sm font-semibold text-gray-900">{formatCurrency(demographic.spend)}</span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-sm text-gray-900">{formatNumber(demographic.impressions)}</span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-sm text-gray-900">{formatNumber(demographic.clicks)}</span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-sm text-gray-900">{formatPercentage(demographic.ctr)}</span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-sm text-gray-900">{formatCurrency(demographic.cpc)}</span>
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
                <h3 className="text-lg font-medium text-gray-900 mb-2">Brak danych demograficznych</h3>
                <p className="text-gray-600">Nie znaleziono danych demograficznych dla wybranego okresu.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'adRelevance' && (
          <div>
            <div className="flex items-center justify-between p-6" style={{ borderBottom: '1px solid #E7EAF3' }}>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">Ad Relevance & Results</h3>
                <p className="text-sm text-gray-600">
                  Skuteczność reklam według relevance
                  {adRelevanceData.length > 5 && !expandedSections['adRelevance'] && ` • Pokazano top 5`}
                </p>
              </div>
              <button
                onClick={() => exportToCSV(adRelevanceData, 'ad-relevance-results')}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-2xl hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
                style={{ borderRadius: '16px' }}
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span className="font-medium">Export CSV</span>
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
                          Spend
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Impressions
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Clicks
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          CPP
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
                                <span className="text-sm font-medium text-gray-900">{ad.ad_name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm font-semibold text-gray-900">{formatCurrency(ad.spend)}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-gray-900">{formatNumber(ad.impressions)}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-gray-900">{formatNumber(ad.clicks)}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-gray-900">{ad.cpp ? formatCurrency(ad.cpp) : 'N/A'}</span>
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
                <h3 className="text-lg font-medium text-gray-900 mb-2">Brak danych o relevance</h3>
                <p className="text-gray-600">Nie znaleziono danych o relevance reklam dla wybranego okresu.</p>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default MetaAdsTables; 