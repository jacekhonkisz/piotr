'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Award,
  AlertCircle,
  BarChart3,
  RefreshCw,
  FileSpreadsheet,
  TrendingUp,
  MousePointer,
  Eye,
  DollarSign,
  Target,
  Zap
} from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';

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
  quality_ranking: string;
  engagement_rate_ranking: string;
  conversion_rate_ranking: string;
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
        body: JSON.stringify({ dateStart, dateEnd, clientId })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setPlacementData(result.data.placementPerformance || []);
        setDemographicData(result.data.demographicPerformance || []);
        setAdRelevanceData(result.data.adRelevanceResults || []);
        
        // Call the callback with the loaded data
        if (onDataLoaded) {
          onDataLoaded({
            placementPerformance: result.data.placementPerformance || [],
            demographicPerformance: result.data.demographicPerformance || [],
            adRelevanceResults: result.data.adRelevanceResults || []
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

  const getRankingLabel = (ranking: string) => {
    switch (ranking) {
      case 'ABOVE_AVERAGE':
        return { label: 'Above Average', color: 'text-white', bgColor: 'bg-gradient-to-r from-green-500 to-emerald-500' };
      case 'AVERAGE':
        return { label: 'Average', color: 'text-white', bgColor: 'bg-gradient-to-r from-yellow-500 to-orange-500' };
      case 'BELOW_AVERAGE':
        return { label: 'Below Average', color: 'text-white', bgColor: 'bg-gradient-to-r from-red-500 to-pink-500' };
      default:
        return { label: 'Unknown', color: 'text-gray-700', bgColor: 'bg-gradient-to-r from-gray-200 to-gray-300' };
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <RefreshCw className="h-8 w-8 animate-spin text-white" />
            </div>
            <div className="absolute inset-0 w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full opacity-20 animate-ping"></div>
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
        <div className="w-20 h-20 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
          <AlertCircle className="h-10 w-10 text-white" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-3">Błąd podczas ładowania danych</h3>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">{error}</p>
        <button
          onClick={fetchMetaTablesData}
          className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 font-medium"
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
        <div className="w-20 h-20 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
          <BarChart3 className="h-10 w-10 text-white" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-3">Brak danych dla tego okresu</h3>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          Nie znaleziono danych z Meta Ads API dla wybranego okresu ({dateStart} - {dateEnd}). 
          Sprawdź czy masz aktywne kampanie w tym czasie.
        </p>
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 max-w-md mx-auto border border-blue-100">
          <p className="text-sm text-blue-700 font-medium">💡 Wskazówka: Spróbuj wybrać inny miesiąc lub sprawdź czy kampanie są aktywne.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation - Premium Design */}
      <div className="flex space-x-2 bg-gradient-to-r from-gray-50 to-gray-100 p-2 rounded-xl shadow-sm border border-gray-200">
        <button
          onClick={() => setActiveTab('placement')}
          className={`flex items-center space-x-3 px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
            activeTab === 'placement'
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg transform scale-105'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white hover:shadow-md'
          }`}
        >
          <div className={`p-1.5 rounded-md ${activeTab === 'placement' ? 'bg-white/20' : 'bg-blue-100'}`}>
            <BarChart3 className="h-4 w-4" />
          </div>
          <span>Top Placement Performance</span>
        </button>
        <button
          onClick={() => setActiveTab('demographic')}
          className={`flex items-center space-x-3 px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
            activeTab === 'demographic'
              ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg transform scale-105'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white hover:shadow-md'
          }`}
        >
          <div className={`p-1.5 rounded-md ${activeTab === 'demographic' ? 'bg-white/20' : 'bg-purple-100'}`}>
            <Users className="h-4 w-4" />
          </div>
          <span>Demographic Performance</span>
        </button>
        <button
          onClick={() => setActiveTab('adRelevance')}
          className={`flex items-center space-x-3 px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
            activeTab === 'adRelevance'
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg transform scale-105'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white hover:shadow-md'
          }`}
        >
          <div className={`p-1.5 rounded-md ${activeTab === 'adRelevance' ? 'bg-white/20' : 'bg-emerald-100'}`}>
            <Award className="h-4 w-4" />
          </div>
          <span>Ad Relevance & Results</span>
        </button>
      </div>

      {/* Table Content - Premium Card Design */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden border border-white/20 hover:shadow-3xl transition-all duration-300"
      >
        {activeTab === 'placement' && (
          <div>
            <div className="flex items-center justify-between p-8 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 backdrop-blur-sm border-b border-blue-100/50">
              <div>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-blue-900 bg-clip-text text-transparent mb-2">Top Placement Performance</h3>
                <p className="text-gray-600">Skuteczność reklam według placementów</p>
              </div>
              <button
                onClick={() => exportToCSV(placementData, 'placement-performance')}
                className="flex items-center space-x-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <FileSpreadsheet className="h-5 w-5" />
                <span className="font-medium">Export CSV</span>
              </button>
            </div>
            
            {placementData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-gray-50/90 to-gray-100/90 backdrop-blur-sm border-b border-gray-200/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-blue-100 rounded-md">
                            <Target className="h-3 w-3 text-blue-600" />
                          </div>
                          <span>Placement</span>
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-green-100 rounded-md">
                            <DollarSign className="h-3 w-3 text-green-600" />
                          </div>
                          <span>Spend</span>
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-purple-100 rounded-md">
                            <Eye className="h-3 w-3 text-purple-600" />
                          </div>
                          <span>Impressions</span>
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-orange-100 rounded-md">
                            <MousePointer className="h-3 w-3 text-orange-600" />
                          </div>
                          <span>Clicks</span>
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-red-100 rounded-md">
                            <TrendingUp className="h-3 w-3 text-red-600" />
                          </div>
                          <span>CTR</span>
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-yellow-100 rounded-md">
                            <Zap className="h-3 w-3 text-yellow-600" />
                          </div>
                          <span>CPC</span>
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-indigo-100 rounded-md">
                            <Award className="h-3 w-3 text-indigo-600" />
                          </div>
                          <span>CPA (CPP)</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white/95 backdrop-blur-sm divide-y divide-gray-100/50">
                    {placementData
                      .sort((a, b) => b.spend - a.spend)
                      .map((placement, index) => (
                        <tr key={index} className="hover:bg-gradient-to-r hover:from-blue-50/80 hover:to-indigo-50/80 transition-all duration-300 group hover:shadow-sm">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mr-4 shadow-sm ${
                                index === 0 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' :
                                index === 1 ? 'bg-gradient-to-r from-gray-300 to-gray-400' :
                                index === 2 ? 'bg-gradient-to-r from-orange-400 to-orange-500' :
                                'bg-gradient-to-r from-blue-100 to-blue-200'
                              }`}>
                                <span className={`text-sm font-bold ${
                                  index <= 2 ? 'text-white' : 'text-blue-700'
                                }`}>#{index + 1}</span>
                              </div>
                              <span className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">{placement.placement}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-lg font-bold text-green-600">{formatCurrency(placement.spend)}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-base font-semibold text-gray-800">{formatNumber(placement.impressions)}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-base font-semibold text-gray-800">{formatNumber(placement.clicks)}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-base font-semibold text-red-600">{formatPercentage(placement.ctr)}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-base font-semibold text-yellow-600">{formatCurrency(placement.cpc)}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-base font-semibold text-indigo-600">
                              {placement.cpp ? formatCurrency(placement.cpp) : '–'}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="h-8 w-8 text-blue-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Brak danych o placementach</h4>
                <p className="text-gray-600 mb-3">Nie znaleziono danych dla tego okresu</p>
                <div className="bg-blue-50 rounded-lg p-3 max-w-sm mx-auto border border-blue-100">
                  <p className="text-sm text-blue-700">💡 Spróbuj wybrać inny miesiąc z aktywnymi kampaniami</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'demographic' && (
          <div>
            <div className="flex items-center justify-between p-6 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">Demographic Performance</h3>
                <p className="text-sm text-gray-600">Skuteczność reklam według wieku i płci</p>
              </div>
              <button
                onClick={() => exportToCSV(demographicData, 'demographic-performance')}
                className="flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white px-4 py-3 rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span className="font-medium">Export CSV</span>
              </button>
            </div>
            
            {demographicData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-purple-50 to-pink-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-purple-100 rounded-md">
                            <Users className="h-3 w-3 text-purple-600" />
                          </div>
                          <span>Age Group</span>
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-pink-100 rounded-md">
                            <Users className="h-3 w-3 text-pink-600" />
                          </div>
                          <span>Gender</span>
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-green-100 rounded-md">
                            <DollarSign className="h-3 w-3 text-green-600" />
                          </div>
                          <span>Spend</span>
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-purple-100 rounded-md">
                            <Eye className="h-3 w-3 text-purple-600" />
                          </div>
                          <span>Impressions</span>
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-orange-100 rounded-md">
                            <MousePointer className="h-3 w-3 text-orange-600" />
                          </div>
                          <span>Clicks</span>
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-red-100 rounded-md">
                            <TrendingUp className="h-3 w-3 text-red-600" />
                          </div>
                          <span>CTR</span>
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-yellow-100 rounded-md">
                            <Zap className="h-3 w-3 text-yellow-600" />
                          </div>
                          <span>CPC</span>
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-indigo-100 rounded-md">
                            <Award className="h-3 w-3 text-indigo-600" />
                          </div>
                          <span>CPA (CPP)</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {demographicData
                      .sort((a, b) => (a.cpp || 0) - (b.cpp || 0))
                      .map((demo, index) => (
                        <tr key={index} className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 transition-all duration-200 group">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-semibold text-gray-900 group-hover:text-purple-700 transition-colors">{demo.age}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-semibold text-gray-900 group-hover:text-pink-700 transition-colors">{demo.gender}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-lg font-bold text-green-600">{formatCurrency(demo.spend)}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-base font-semibold text-gray-800">{formatNumber(demo.impressions)}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-base font-semibold text-gray-800">{formatNumber(demo.clicks)}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-base font-semibold text-red-600">{formatPercentage(demo.ctr)}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-base font-semibold text-yellow-600">{formatCurrency(demo.cpc)}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-base font-semibold text-indigo-600">
                              {demo.cpp ? formatCurrency(demo.cpp) : '–'}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-purple-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Brak danych demograficznych</h4>
                <p className="text-gray-600 mb-3">Nie znaleziono danych dla tego okresu</p>
                <div className="bg-purple-50 rounded-lg p-3 max-w-sm mx-auto border border-purple-100">
                  <p className="text-sm text-purple-700">💡 Spróbuj wybrać inny miesiąc z aktywnymi kampaniami</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'adRelevance' && (
          <div>
            <div className="flex items-center justify-between p-6 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">Ad Relevance & Results</h3>
                <p className="text-sm text-gray-600">Jakość reklam i wyniki według Meta</p>
              </div>
              <button
                onClick={() => exportToCSV(adRelevanceData, 'ad-relevance-results')}
                className="flex items-center space-x-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-4 py-3 rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span className="font-medium">Export CSV</span>
              </button>
            </div>
            
            {adRelevanceData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-emerald-50 to-teal-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-emerald-100 rounded-md">
                            <Award className="h-3 w-3 text-emerald-600" />
                          </div>
                          <span>Ad Name</span>
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-green-100 rounded-md">
                            <DollarSign className="h-3 w-3 text-green-600" />
                          </div>
                          <span>Spend</span>
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-purple-100 rounded-md">
                            <Eye className="h-3 w-3 text-purple-600" />
                          </div>
                          <span>Impressions</span>
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-orange-100 rounded-md">
                            <MousePointer className="h-3 w-3 text-orange-600" />
                          </div>
                          <span>Clicks</span>
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-indigo-100 rounded-md">
                            <Target className="h-3 w-3 text-indigo-600" />
                          </div>
                          <span>CPA (CPP)</span>
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-blue-100 rounded-md">
                            <Award className="h-3 w-3 text-blue-600" />
                          </div>
                          <span>Quality Ranking</span>
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-yellow-100 rounded-md">
                            <TrendingUp className="h-3 w-3 text-yellow-600" />
                          </div>
                          <span>Engagement Ranking</span>
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-red-100 rounded-md">
                            <Zap className="h-3 w-3 text-red-600" />
                          </div>
                          <span>Conversion Ranking</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {adRelevanceData
                      .sort((a, b) => b.spend - a.spend)
                      .map((ad, index) => {
                        const qualityRanking = getRankingLabel(ad.quality_ranking);
                        const engagementRanking = getRankingLabel(ad.engagement_rate_ranking);
                        const conversionRanking = getRankingLabel(ad.conversion_rate_ranking);
                        
                        return (
                          <tr key={index} className="hover:bg-gradient-to-r hover:from-emerald-50 hover:to-teal-50 transition-all duration-200 group">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mr-4 shadow-sm ${
                                  index === 0 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' :
                                  index === 1 ? 'bg-gradient-to-r from-teal-400 to-teal-500' :
                                  index === 2 ? 'bg-gradient-to-r from-cyan-400 to-cyan-500' :
                                  'bg-gradient-to-r from-emerald-100 to-emerald-200'
                                }`}>
                                  <span className={`text-sm font-bold ${
                                    index <= 2 ? 'text-white' : 'text-emerald-700'
                                  }`}>#{index + 1}</span>
                                </div>
                                <span className="text-sm font-semibold text-gray-900 group-hover:text-emerald-700 transition-colors">{ad.ad_name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-lg font-bold text-green-600">{formatCurrency(ad.spend)}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-base font-semibold text-gray-800">{formatNumber(ad.impressions)}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-base font-semibold text-gray-800">{formatNumber(ad.clicks)}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-base font-semibold text-indigo-600">
                                {ad.cpp ? formatCurrency(ad.cpp) : '–'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-sm ${qualityRanking.bgColor} ${qualityRanking.color}`}>
                                {qualityRanking.label}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-sm ${engagementRanking.bgColor} ${engagementRanking.color}`}>
                                {engagementRanking.label}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-sm ${conversionRanking.bgColor} ${conversionRanking.color}`}>
                                {conversionRanking.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gradient-to-r from-emerald-100 to-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Award className="h-8 w-8 text-emerald-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Brak danych o jakości reklam</h4>
                <p className="text-gray-600 mb-3">Nie znaleziono danych dla tego okresu</p>
                <div className="bg-emerald-50 rounded-lg p-3 max-w-sm mx-auto border border-emerald-100">
                  <p className="text-sm text-emerald-700">💡 Spróbuj wybrać inny miesiąc z aktywnymi kampaniami</p>
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default MetaAdsTables; 