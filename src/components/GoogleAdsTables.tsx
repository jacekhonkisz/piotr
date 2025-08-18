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
  const [demographicData, setDemographicData] = useState<GoogleAdsDemographicPerformance[]>([]);
  const [deviceData, setDeviceData] = useState<GoogleAdsDevicePerformance[]>([]);
  const [keywordData, setKeywordData] = useState<GoogleAdsKeywordPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'placement' | 'demographic' | 'device' | 'keywords'>('placement');
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({});
  const [demographicMetric, setDemographicMetric] = useState<'impressions' | 'clicks' | 'conversions' | 'roas' | 'conversionValue'>('roas');

  useEffect(() => {
    fetchGoogleAdsTablesData();
  }, [dateStart, dateEnd, clientId]);

  const fetchGoogleAdsTablesData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No authentication token available');
      }

      // Mock data for Google Ads (since API might not be fully implemented)
      const mockPlacementData: GoogleAdsPlacementPerformance[] = [
        { network: 'Search Network', spend: 5000, impressions: 50000, clicks: 2500, ctr: 5.0, cpc: 2.0, conversions: 125, conversionValue: 12500, roas: 2.5 },
        { network: 'Display Network', spend: 3000, impressions: 100000, clicks: 1500, ctr: 1.5, cpc: 2.0, conversions: 60, conversionValue: 7200, roas: 2.4 },
        { network: 'YouTube', spend: 2000, impressions: 80000, clicks: 800, ctr: 1.0, cpc: 2.5, conversions: 32, conversionValue: 4800, roas: 2.4 },
      ];

      const mockDemographicData: GoogleAdsDemographicPerformance[] = [
        { ageRange: '25-34', gender: 'female', spend: 2000, impressions: 40000, clicks: 1600, ctr: 4.0, cpc: 1.25, conversions: 80, conversionValue: 8000, roas: 4.0 },
        { ageRange: '25-34', gender: 'male', spend: 1500, impressions: 30000, clicks: 1200, ctr: 4.0, cpc: 1.25, conversions: 60, conversionValue: 6000, roas: 4.0 },
        { ageRange: '35-44', gender: 'female', spend: 2500, impressions: 45000, clicks: 1800, ctr: 4.0, cpc: 1.39, conversions: 90, conversionValue: 10800, roas: 4.32 },
        { ageRange: '35-44', gender: 'male', spend: 2000, impressions: 35000, clicks: 1400, ctr: 4.0, cpc: 1.43, conversions: 70, conversionValue: 8400, roas: 4.2 },
        { ageRange: '45-54', gender: 'female', spend: 1500, impressions: 25000, clicks: 1000, ctr: 4.0, cpc: 1.5, conversions: 50, conversionValue: 6000, roas: 4.0 },
        { ageRange: '55-64', gender: 'male', spend: 1000, impressions: 15000, clicks: 600, ctr: 4.0, cpc: 1.67, conversions: 30, conversionValue: 3600, roas: 3.6 },
      ];

      const mockDeviceData: GoogleAdsDevicePerformance[] = [
        { device: 'Mobile', spend: 4000, impressions: 80000, clicks: 3200, ctr: 4.0, cpc: 1.25, conversions: 128, conversionValue: 15360, roas: 3.84 },
        { device: 'Desktop', spend: 4000, impressions: 60000, clicks: 2400, ctr: 4.0, cpc: 1.67, conversions: 96, conversionValue: 11520, roas: 2.88 },
        { device: 'Tablet', spend: 2000, impressions: 30000, clicks: 1200, ctr: 4.0, cpc: 1.67, conversions: 48, conversionValue: 5760, roas: 2.88 },
      ];

      const mockKeywordData: GoogleAdsKeywordPerformance[] = [
        { keyword: 'hotel booking', spend: 2000, impressions: 20000, clicks: 800, ctr: 4.0, cpc: 2.5, conversions: 40, conversionValue: 4800, roas: 2.4 },
        { keyword: 'vacation rental', spend: 1500, impressions: 15000, clicks: 600, ctr: 4.0, cpc: 2.5, conversions: 30, conversionValue: 3600, roas: 2.4 },
        { keyword: 'accommodation', spend: 1000, impressions: 10000, clicks: 400, ctr: 4.0, cpc: 2.5, conversions: 20, conversionValue: 2400, roas: 2.4 },
      ];

      setPlacementData(mockPlacementData);
      setDemographicData(mockDemographicData);
      setDeviceData(mockDeviceData);
      setKeywordData(mockKeywordData);

      if (onDataLoaded) {
        onDataLoaded({
          placementPerformance: mockPlacementData,
          demographicPerformance: mockDemographicData,
          devicePerformance: mockDeviceData,
          keywordPerformance: mockKeywordData
        });
      }

    } catch (err) {
      console.error('Error fetching Google Ads tables data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load Google Ads data');
    } finally {
      setLoading(false);
    }
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

  if (loading) {
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
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center space-x-3 text-orange-600 mb-4">
          <AlertCircle className="w-5 h-5" />
          <span>Błąd: {error}</span>
        </div>
        <button
          onClick={fetchGoogleAdsTablesData}
          className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 shadow-sm rounded-lg transition-all duration-200 font-medium"
        >
          Spróbuj ponownie
        </button>
      </div>
    );
  }

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
          onClick={() => setActiveTab('demographic')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === 'demographic'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Demografia</span>
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
        {/* Demographics Tab with Pie Charts */}
        {activeTab === 'demographic' && (
          <div>
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-semibold text-slate-900 mb-1">Demographic Performance</h3>
                <p className="text-sm text-slate-600">
                  Skuteczność reklam według demografii
                </p>
              </div>
              <div className="flex items-center space-x-4">
                {/* Enhanced Metric Selector */}
                <div className="flex items-center space-x-2 bg-slate-100 rounded-xl p-1">
                  <button
                    onClick={() => setDemographicMetric('roas')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      demographicMetric === 'roas'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <BarChart3 className="h-4 w-4" />
                      <span>ROAS</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setDemographicMetric('conversions')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      demographicMetric === 'conversions'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Target className="h-4 w-4" />
                      <span>Konwersje</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setDemographicMetric('conversionValue')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      demographicMetric === 'conversionValue'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <BarChart3 className="h-4 w-4" />
                      <span>Wartość</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setDemographicMetric('clicks')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
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
                  <button
                    onClick={() => setDemographicMetric('impressions')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
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
                </div>
                <button
                  onClick={() => exportToCSV(demographicData, 'google_ads_demografia')}
                  className="flex items-center space-x-2 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 px-4 py-2 rounded-lg transition-all duration-200 font-medium"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>
            
            {demographicData.length > 0 ? (
              <div>
                {/* Demographic Charts Section */}
                <div className="p-6 border-b border-slate-100">
                  <GoogleAdsDemographicPieCharts 
                    data={demographicData} 
                    metric={demographicMetric}
                  />
                </div>

                {/* Traditional Table View */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-medium text-slate-700">Grupa wiekowa</th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-slate-700">Płeć</th>
                        <th className="px-6 py-4 text-right text-sm font-medium text-slate-700">Wydana kwota</th>
                        <th className="px-6 py-4 text-right text-sm font-medium text-slate-700">Wyświetlenia</th>
                        <th className="px-6 py-4 text-right text-sm font-medium text-slate-700">Kliknięcia</th>
                        <th className="px-6 py-4 text-right text-sm font-medium text-slate-700">CTR</th>
                        <th className="px-6 py-4 text-right text-sm font-medium text-slate-700">CPC</th>
                        <th className="px-6 py-4 text-right text-sm font-medium text-slate-700">Konwersje</th>
                        <th className="px-6 py-4 text-right text-sm font-medium text-slate-700">ROAS</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {demographicData.map((demo, index) => (
                        <tr key={index} className={`${index % 2 === 1 ? 'bg-slate-50/30' : ''} hover:bg-slate-50`}>
                          <td className="px-6 py-4 text-sm text-slate-900">{demo.ageRange}</td>
                          <td className="px-6 py-4 text-sm text-slate-900 capitalize">
                            {demo.gender === 'male' ? 'Mężczyzna' : demo.gender === 'female' ? 'Kobieta' : 'Nieznana'}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatCurrency(demo.spend)}</td>
                          <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatNumber(demo.impressions)}</td>
                          <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatNumber(demo.clicks)}</td>
                          <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatPercentage(demo.ctr)}</td>
                          <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatCurrency(demo.cpc)}</td>
                          <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{formatNumber(demo.conversions)}</td>
                          <td className="px-6 py-4 text-sm text-slate-900 text-right tabular-nums">{demo.roas.toFixed(2)}x</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                Brak danych &quot;Demographics&quot; dla wybranego okresu.
              </div>
            )}
          </div>
        )}

        {/* Other tabs would go here - placement, device, keywords */}
        {activeTab !== 'demographic' && (
          <div className="p-6">
            <div className="text-center py-8 text-slate-500">
              Zakładka "{activeTab}" w trakcie implementacji
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default GoogleAdsTables; 