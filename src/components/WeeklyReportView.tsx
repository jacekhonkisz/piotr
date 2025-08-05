'use client';

import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  MousePointer,
  Eye,
  Target,
  DollarSign,
  Activity,
  Zap,
  Award,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import AnimatedCounter from './AnimatedCounter';

interface Campaign {
  id: string;
  campaign_id: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr?: number;
  cpc?: number;
  cpa?: number;
  frequency?: number;
  reach?: number;
  relevance_score?: number;
  landing_page_view?: number;
  ad_type?: string;
  objective?: string;
}

interface WeeklyReport {
  id: string;
  date_range_start: string;
  date_range_end: string;
  generated_at?: string;
  campaigns: Campaign[];
}

interface WeeklyReportViewProps {
  reports: { [key: string]: WeeklyReport };
  viewType?: 'monthly' | 'weekly' | 'all-time' | 'custom'; // Add viewType prop
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

const formatNumber = (num: number) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString('pl-PL');
};

const formatDate = (dateString: string) => {
  if (!dateString || dateString.trim() === '') {
    return 'Brak daty';
  }
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return 'Nieprawidłowa data';
  }
  
  return date.toLocaleDateString('pl-PL', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// Helper function to get week start and end dates
const getWeekDateRange = (year: number, week: number) => {
  const firstDayOfYear = new Date(year, 0, 1);
  const days = (week - 1) * 7;
  const startDate = new Date(firstDayOfYear.getTime() + days * 24 * 60 * 60 * 1000);
  const endDate = new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000);
  
  const formatDateForDisplay = (date: Date) => {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    return `${day.toString().padStart(2, '0')}.${month.toString().padStart(2, '0')}`;
  };
  
  return `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}.${year}`;
};

const getWeekNumber = (date: Date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

export default function WeeklyReportView({ reports, viewType = 'weekly' }: WeeklyReportViewProps) {
  const [expandedReports, setExpandedReports] = useState<{ [key: string]: boolean }>({});
  const reportIds = Object.keys(reports);

  const toggleReportExpansion = (reportId: string) => {
    setExpandedReports(prev => ({
      ...prev,
      [reportId]: !prev[reportId]
    }));
  };
  
  if (reportIds.length === 0) {
    return (
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 text-center border border-white/20">
        <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Brak Raportów</h3>
        <p className="text-gray-600">Nie znaleziono żadnych raportów do wyświetlenia.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {reportIds.map((reportId) => {
        const report = reports[reportId];
        if (!report) return null;
        const campaigns = report.campaigns || [];
        
        // Calculate weekly totals
        const totals = campaigns.reduce((acc, campaign) => ({
          spend: acc.spend + (campaign.spend || 0),
          impressions: acc.impressions + (campaign.impressions || 0),
          clicks: acc.clicks + (campaign.clicks || 0),
          conversions: acc.conversions + (campaign.conversions || 0),
          reach: acc.reach + (campaign.reach || 0),
          landingPageViews: acc.landingPageViews + (campaign.landing_page_view || 0)
        }), { 
          spend: 0, 
          impressions: 0, 
          clicks: 0, 
          conversions: 0, 
          reach: 0, 
          landingPageViews: 0 
        });

        // Calculate derived metrics
        const avgCTR = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
        const avgCPC = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
        const avgCPA = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
        const conversionRate = totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0;

        const startDate = new Date(report.date_range_start);
        const weekNumber = getWeekNumber(startDate);

        // Sort campaigns by clicks (descending) and separate top 5 from the rest
        const sortedCampaigns = [...campaigns].sort((a, b) => (b.clicks || 0) - (a.clicks || 0));
        const top5Campaigns = sortedCampaigns.slice(0, 5);
        const remainingCampaigns = sortedCampaigns.slice(5);
        const isExpanded = expandedReports[reportId] || false;

        // Determine report title based on report ID and view type
        let reportTitle = 'Raport';
        if (reportId === 'all-time') {
          reportTitle = 'Raport - Cały Okres';
        } else if (reportId === 'custom') {
          reportTitle = 'Raport - Własny Zakres';
        } else if (viewType === 'monthly') {
          reportTitle = 'Raport - Miesiąc';
        } else {
          reportTitle = `Raport - ${getWeekDateRange(startDate.getFullYear(), weekNumber)}`;
        }

        return (
          <div key={reportId} className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-700 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                    <Calendar className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">
                      {reportTitle}
                    </h2>
                    <p className="text-blue-100 text-lg">
                      {formatDate(report.date_range_start)} - {formatDate(report.date_range_end)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 text-blue-100">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">
                    {campaigns.length} {campaigns.length === 1 ? 'kampania' : 'kampanii'}
                  </span>
                </div>
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* Total Spend */}
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6 border border-purple-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-purple-500 rounded-lg">
                      <DollarSign className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-purple-600 mb-1">Całkowite Wydatki</p>
                    <p className="text-2xl font-bold text-purple-900">
                      <AnimatedCounter value={totals.spend} formatValue={formatCurrency} />
                    </p>
                  </div>
                </div>

                {/* Total Impressions */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-blue-500 rounded-lg">
                      <Eye className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-600 mb-1">Wyświetlenia</p>
                    <p className="text-2xl font-bold text-blue-900">
                      <AnimatedCounter value={totals.impressions} formatValue={formatNumber} />
                    </p>
                  </div>
                </div>

                {/* Total Clicks */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 border border-green-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-green-500 rounded-lg">
                      <MousePointer className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-600 mb-1">Kliknięcia</p>
                    <p className="text-2xl font-bold text-green-900">
                      <AnimatedCounter value={totals.clicks} formatValue={formatNumber} />
                    </p>
                  </div>
                </div>

                {/* Total Conversions */}
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-6 border border-orange-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-orange-500 rounded-lg">
                      <Target className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-orange-600 mb-1">Konwersje</p>
                    <p className="text-2xl font-bold text-orange-900">
                      <AnimatedCounter value={totals.conversions} formatValue={formatNumber} />
                    </p>
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* CTR */}
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-600">CTR</h3>
                    <Activity className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="relative w-12 h-12">
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-xs font-bold text-blue-600">{avgCTR.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900">{avgCTR.toFixed(2)}%</p>
                      <p className="text-xs text-gray-500">Click-through rate</p>
                    </div>
                  </div>
                </div>

                {/* CPC */}
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-600">CPC</h3>
                    <Zap className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(avgCPC)}</p>
                    <p className="text-xs text-gray-500">Cost per click</p>
                  </div>
                </div>

                {/* CPA */}
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-600">CPA</h3>
                    <Award className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(avgCPA)}</p>
                    <p className="text-xs text-gray-500">Cost per acquisition</p>
                  </div>
                </div>

                {/* Conversion Rate */}
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-600">CR</h3>
                    <TrendingUp className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="relative w-12 h-12">
                      <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                        <span className="text-xs font-bold text-green-600">{conversionRate.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900">{conversionRate.toFixed(2)}%</p>
                      <p className="text-xs text-gray-500">Conversion rate</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Campaigns Table */}
              {campaigns.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <h3 className="text-lg font-semibold text-gray-900">Kampanie Tygodniowe</h3>
                    <p className="text-sm text-gray-600">
                      Top 5 kampanii według kliknięć • {campaigns.length} aktywnych kampanii
                    </p>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Nazwa Kampanii
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Wydatki
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Wyświetlenia
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Kliknięcia
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Konwersje
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            CTR
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            CPC
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {/* Top 5 Campaigns */}
                        {top5Campaigns.map((campaign, index) => {
                          const ctr = campaign.impressions > 0 ? (campaign.clicks / campaign.impressions) * 100 : 0;
                          const cpc = campaign.clicks > 0 ? campaign.spend / campaign.clicks : 0;
                          
                          return (
                            <tr key={`${reportId}-${campaign.campaign_id}`} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center space-x-3">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold ${
                                    index === 0 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' :
                                    index === 1 ? 'bg-gradient-to-r from-gray-300 to-gray-400' :
                                    index === 2 ? 'bg-gradient-to-r from-orange-400 to-orange-500' :
                                    'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-700'
                                  }`}>
                                    #{index + 1}
                                  </div>
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">
                                      {campaign.campaign_name}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      {campaign.objective || 'N/A'}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatCurrency(campaign.spend)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatNumber(campaign.impressions)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                                {formatNumber(campaign.clicks)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatNumber(campaign.conversions)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {ctr.toFixed(2)}%
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatCurrency(cpc)}
                              </td>
                            </tr>
                          );
                        })}

                        {/* Remaining Campaigns (Collapsible) */}
                        {remainingCampaigns.length > 0 && (
                          <>
                            {/* Collapsible Section */}
                            {isExpanded && remainingCampaigns.map((campaign) => {
                              const ctr = campaign.impressions > 0 ? (campaign.clicks / campaign.impressions) * 100 : 0;
                              const cpc = campaign.clicks > 0 ? campaign.spend / campaign.clicks : 0;
                              
                              return (
                                <tr key={`${reportId}-${campaign.campaign_id}`} className="hover:bg-gray-50 bg-gray-25">
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center space-x-3">
                                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100 text-gray-600 text-sm font-bold">
                                        •
                                      </div>
                                      <div>
                                        <div className="text-sm font-medium text-gray-700">
                                          {campaign.campaign_name}
                                        </div>
                                        <div className="text-sm text-gray-500">
                                          {campaign.objective || 'N/A'}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                    {formatCurrency(campaign.spend)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                    {formatNumber(campaign.impressions)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                    {formatNumber(campaign.clicks)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                    {formatNumber(campaign.conversions)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                    {ctr.toFixed(2)}%
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                    {formatCurrency(cpc)}
                                  </td>
                                </tr>
                              );
                            })}

                            {/* Toggle Button */}
                            <tr className="bg-gray-50 hover:bg-gray-100 cursor-pointer" onClick={() => toggleReportExpansion(reportId)}>
                              <td colSpan={7} className="px-6 py-4">
                                <div className="flex items-center justify-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors">
                                  {isExpanded ? (
                                    <>
                                      <ChevronUp className="h-4 w-4" />
                                      <span className="text-sm font-medium">Ukryj pozostałe kampanie ({remainingCampaigns.length})</span>
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="h-4 w-4" />
                                      <span className="text-sm font-medium">Pokaż wszystkie kampanie ({remainingCampaigns.length} więcej)</span>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {campaigns.length === 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                  <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Brak Kampanii</h3>
                  <p className="text-gray-600">
                    Nie znaleziono aktywnych kampanii w tym tygodniu.
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
} 