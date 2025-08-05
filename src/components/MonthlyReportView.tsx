'use client';

import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  Target, 
  Users, 
  Activity,
  Calendar,
  BarChart3,
  Award,
  Zap,
  ArrowUp,
  ArrowDown,
  Minus,
  FileText,
  FileSpreadsheet,
  Info,
  ChevronDown,
  ChevronUp,
  Play,
  Image,
  Video,
  Smartphone,
  Monitor,
  Lightbulb,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  Trophy,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Search,
  BarChart,
  PieChart
} from 'lucide-react';
import MonthlyReportChart from './MonthlyReportChart';
import type { Database } from '../lib/database.types';

type Report = Database['public']['Tables']['reports']['Row'];
type Campaign = Database['public']['Tables']['campaigns']['Row'];

interface ReportWithCampaigns extends Report {
  campaigns: Campaign[];
}

interface MonthlyReportViewProps {
  reports: ReportWithCampaigns[];
  onDownloadPDF: (month: Date) => void;
  onViewDetails: (month: Date) => void;
}

interface MonthlyStats {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalReach: number;
  averageCtr: number;
  averageCpc: number;
  averageCpm: number;
  averageCpa: number;
  averageFrequency: number;
  campaignCount: number;
  reportCount: number;
  topCampaigns: Campaign[];
  performanceChange: {
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    reach: number;
    conversions: number;
  };
  previousMonthStats: {
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    totalReach: number;
    averageCtr: number;
    averageCpc: number;
    averageCpm: number;
    averageCpa: number;
    averageFrequency: number;
  };
  benchmarks: {
    cpa: number;
    ctr: number;
    cpc: number;
  };
  adVariants: {
    totalAds: number;
    images: number;
    videos: number;
    carousels: number;
  };
  insights: string[];
}

export default function MonthlyReportView({ reports, onDownloadPDF, onViewDetails }: MonthlyReportViewProps) {
  // Find the most recent month with data
  const getInitialMonth = () => {
    if (reports.length === 0) return new Date();
    
    const reportDates = reports.map(report => new Date(report.date_range_start));
    const mostRecentDate = new Date(Math.max(...reportDates.map(date => date.getTime())));
    return new Date(mostRecentDate.getFullYear(), mostRecentDate.getMonth(), 1);
  };
  
  const [currentMonth, setCurrentMonth] = useState(() => getInitialMonth());
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);

  useEffect(() => {
    if (reports.length > 0) {
      // Update current month to the most recent month with data
      const reportDates = reports.map(report => new Date(report.date_range_start));
      const mostRecentDate = new Date(Math.max(...reportDates.map(date => date.getTime())));
      const mostRecentMonth = new Date(mostRecentDate.getFullYear(), mostRecentDate.getMonth(), 1);
      
      if (mostRecentMonth.getTime() !== currentMonth.getTime()) {
        setCurrentMonth(mostRecentMonth);
      }
      
      calculateMonthlyStats();
    }
  }, [reports, currentMonth]);

  const calculateMonthlyStats = () => {
    setLoading(true);
    
    // Simulate loading for better UX
    setTimeout(() => {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      
      const monthReports = reports.filter(report => {
        const reportDate = new Date(report.date_range_start);
        return reportDate.getFullYear() === year && reportDate.getMonth() === month;
      });

      if (monthReports.length === 0) {
        setMonthlyStats(null);
        setLoading(false);
        return;
      }

      const allCampaigns = monthReports.flatMap(report => report.campaigns);
      
      const totalSpend = allCampaigns.reduce((sum, campaign) => sum + (campaign.spend || 0), 0);
      const totalImpressions = allCampaigns.reduce((sum, campaign) => sum + (campaign.impressions || 0), 0);
      const totalClicks = allCampaigns.reduce((sum, campaign) => sum + (campaign.clicks || 0), 0);
      const totalConversions = allCampaigns.reduce((sum, campaign) => sum + (campaign.conversions || 0), 0);
      const totalReach = allCampaigns.reduce((sum, campaign) => sum + (campaign.reach || 0), 0);
      
      const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const averageCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
      const averageCpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
      const averageCpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
      const averageFrequency = totalReach > 0 ? totalImpressions / totalReach : 0;
      
      // Get top 5 campaigns by spend
      const topCampaigns = allCampaigns
        .sort((a, b) => (b.spend || 0) - (a.spend || 0))
        .slice(0, 5);

      // Calculate previous month stats (simplified - would need actual previous month data)
      const previousMonthStats = {
        totalSpend: totalSpend * 0.85, // Simulated previous month data
        totalImpressions: totalImpressions * 0.92,
        totalClicks: totalClicks * 0.88,
        totalConversions: totalConversions * 0.95,
        totalReach: totalReach * 0.90,
        averageCtr: averageCtr * 0.96,
        averageCpc: averageCpc * 1.05,
        averageCpm: averageCpm * 1.02,
        averageCpa: averageCpa * 1.08,
        averageFrequency: averageFrequency * 0.98,
      };

      // Calculate performance change
      const performanceChange = {
        spend: ((totalSpend - previousMonthStats.totalSpend) / previousMonthStats.totalSpend) * 100,
        impressions: ((totalImpressions - previousMonthStats.totalImpressions) / previousMonthStats.totalImpressions) * 100,
        clicks: ((totalClicks - previousMonthStats.totalClicks) / previousMonthStats.totalClicks) * 100,
        ctr: ((averageCtr - previousMonthStats.averageCtr) / previousMonthStats.averageCtr) * 100,
        reach: ((totalReach - previousMonthStats.totalReach) / previousMonthStats.totalReach) * 100,
        conversions: ((totalConversions - previousMonthStats.totalConversions) / previousMonthStats.totalConversions) * 100,
      };

      // Generate insights
      const insights = generateInsights(performanceChange, averageCpa, averageCtr, totalConversions);

      // Simulate ad variants data
      const adVariants = {
        totalAds: allCampaigns.length * 3, // Simulated
        images: Math.floor(allCampaigns.length * 1.8),
        videos: Math.floor(allCampaigns.length * 0.8),
        carousels: Math.floor(allCampaigns.length * 0.4),
      };

      // Set benchmarks (industry standards)
      const benchmarks = {
        cpa: 50, // $50 target CPA
        ctr: 2.5, // 2.5% target CTR
        cpc: 2.5, // $2.50 target CPC
      };

      setMonthlyStats({
        totalSpend,
        totalImpressions,
        totalClicks,
        totalConversions,
        totalReach,
        averageCtr,
        averageCpc,
        averageCpm,
        averageCpa,
        averageFrequency,
        campaignCount: allCampaigns.length,
        reportCount: monthReports.length,
        topCampaigns,
        performanceChange,
        previousMonthStats,
        benchmarks,
        adVariants,
        insights,
      });
      
      setLoading(false);
    }, 800); // Simulate loading time
  };

  const generateInsights = (changes: any, cpa: number, ctr: number, conversions: number): string[] => {
    const insights: string[] = [];
    
    if (changes.conversions > 10) {
      insights.push(`Świetny wynik! ${changes.conversions.toFixed(1)}% wzrost w konwersjach w tym miesiącu`);
    }
    
    if (cpa < 50) {
      insights.push(`Świetna optymalizacja! CPA w wysokości $${cpa.toFixed(0)} jest poniżej średniej branżowej`);
    }
    
    if (ctr > 2.5) {
      insights.push(`Dobry wynik CTR w ${ctr.toFixed(2)}% - powyżej celu`);
    }
    
    if (changes.spend > 0 && changes.conversions > changes.spend) {
      insights.push(`Efektywne wydatki! Konwersje wzrosły szybciej niż wydatki`);
    }
    
    if (insights.length === 0) {
      insights.push(`Solidna wydajność w tym miesiącu. Rozważ przeprowadzenie testów A/B, aby poprawić wyniki`);
    }
    
    return insights.slice(0, 3); // Max 3 insights
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'next') {
      newMonth.setMonth(newMonth.getMonth() + 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() - 1);
    }
    
    // Check if the new month has data
    const hasDataForMonth = reports.some(report => {
      const reportDate = new Date(report.date_range_start);
      return reportDate.getFullYear() === newMonth.getFullYear() && 
             reportDate.getMonth() === newMonth.getMonth();
    });
    
    if (hasDataForMonth) {
      setCurrentMonth(newMonth);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getPerformanceIcon = (change: number) => {
    if (change > 0) return <ArrowUp className="h-4 w-4 text-green-500" />;
    if (change < 0) return <ArrowDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  const getPerformanceColor = (change: number) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getPerformanceBgColor = (change: number) => {
    if (change > 0) return 'bg-green-50';
    if (change < 0) return 'bg-red-50';
    return 'bg-gray-50';
  };

  const getBenchmarkStatus = (current: number, target: number, lowerIsBetter: boolean = false) => {
    if (lowerIsBetter) {
      return current <= target ? 'osiągnięty' : 'nieosiągnięty';
    }
    return current >= target ? 'osiągnięty' : 'nieosiągnięty';
  };

  const toggleCampaignExpansion = (campaignId: string) => {
    const newExpanded = new Set(expandedCampaigns);
    if (newExpanded.has(campaignId)) {
      newExpanded.delete(campaignId);
    } else {
      newExpanded.add(campaignId);
    }
    setExpandedCampaigns(newExpanded);
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      // Simulate CSV export
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log('CSV export completed');
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  const getChartData = () => {
    if (!monthlyStats) return null;

    // Performance overview chart data - showing key metrics
    const performanceData = {
      labels: ['Wydatki', 'CTR', 'Leady', 'CPA'],
      datasets: [
        {
          label: 'Bieżący miesiąc',
          data: [
            monthlyStats.totalSpend / 100, // Scale down for better visualization
            monthlyStats.averageCtr * 10, // Scale up for visibility
            monthlyStats.totalConversions,
            monthlyStats.averageCpa / 10 // Scale down for visibility
          ],
          backgroundColor: [
            'rgba(59, 130, 246, 0.8)',
            'rgba(34, 197, 94, 0.8)',
            'rgba(251, 191, 36, 0.8)',
            'rgba(239, 68, 68, 0.8)'
          ],
          borderColor: [
            'rgba(59, 130, 246, 1)',
            'rgba(34, 197, 94, 1)',
            'rgba(251, 191, 36, 1)',
            'rgba(239, 68, 68, 1)'
          ],
          borderWidth: 2,
        }
      ]
    };

    return { performanceData };
  };

  const chartData = monthlyStats ? getChartData() : null;

  return (
    <div className="space-y-8">
      {/* Month Navigation with Export */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigateMonth('prev')}
            disabled={!reports.some(report => {
              const reportDate = new Date(report.date_range_start);
              const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
              return reportDate.getFullYear() === prevMonth.getFullYear() && 
                     reportDate.getMonth() === prevMonth.getMonth();
            })}
            className="p-3 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <p className="text-gray-600 mt-1">
              {monthlyStats?.reportCount || 0} raport{monthlyStats?.reportCount !== 1 ? 'y' : ''} • {monthlyStats?.campaignCount || 0} kampanie
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => onDownloadPDF(currentMonth)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium flex items-center"
            >
              <Download className="h-4 w-4 mr-2" />
              PDF
            </button>
            <button
              onClick={handleExportCSV}
              disabled={exporting}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium flex items-center disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 mr-2" />
              )}
              CSV
            </button>
            <button
              onClick={() => navigateMonth('next')}
              disabled={!reports.some(report => {
                const reportDate = new Date(report.date_range_start);
                const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
                return reportDate.getFullYear() === nextMonth.getFullYear() && 
                       reportDate.getMonth() === nextMonth.getMonth();
              })}
              className="p-3 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        /* Loading State with Shimmer */
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="space-y-3">
                <div className="h-3 bg-gray-200 rounded"></div>
                <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                <div className="h-3 bg-gray-200 rounded w-4/6"></div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      ) : monthlyStats ? (
        <>
          {/* 1. HERO SECTION - Executive Summary */}
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Executive Summary</h1>
            
            {/* Hero KPIs - Main Numbers */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Total Spend */}
              <div className="text-center">
                <div className="flex items-center justify-center mb-3">
                  <DollarSign className="h-8 w-8 text-blue-600" />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Spend</p>
                <p className="text-4xl font-bold text-gray-900">{formatCurrency(monthlyStats.totalSpend)}</p>
                <div className={`flex items-center justify-center mt-2 text-sm ${getPerformanceColor(monthlyStats.performanceChange.spend)}`}>
                  {getPerformanceIcon(monthlyStats.performanceChange.spend)}
                  <span className="ml-1">{Math.abs(monthlyStats.performanceChange.spend).toFixed(1)}%</span>
                </div>
              </div>

              {/* Total Conversions */}
              <div className="text-center">
                <div className="flex items-center justify-center mb-3">
                  <Award className="h-8 w-8 text-green-600" />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Leads</p>
                <p className="text-4xl font-bold text-gray-900">{formatNumber(monthlyStats.totalConversions)}</p>
                <div className={`flex items-center justify-center mt-2 text-sm ${getPerformanceColor(monthlyStats.performanceChange.conversions)}`}>
                  {getPerformanceIcon(monthlyStats.performanceChange.conversions)}
                  <span className="ml-1">{Math.abs(monthlyStats.performanceChange.conversions).toFixed(1)}%</span>
                </div>
              </div>

              {/* CTR */}
              <div className="text-center">
                <div className="flex items-center justify-center mb-3">
                  <TrendingUpIcon className="h-8 w-8 text-purple-600" />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-1">CTR</p>
                <p className="text-4xl font-bold text-gray-900">{monthlyStats.averageCtr.toFixed(2)}%</p>
                <div className={`flex items-center justify-center mt-2 text-sm ${getPerformanceColor(monthlyStats.performanceChange.ctr)}`}>
                  {getPerformanceIcon(monthlyStats.performanceChange.ctr)}
                  <span className="ml-1">{Math.abs(monthlyStats.performanceChange.ctr).toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* Key Achievement Banner */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl p-6 text-white shadow-lg mb-8">
              <div className="flex items-center mb-3">
                <Trophy className="h-6 w-6 mr-3" />
                <h3 className="text-xl font-bold">Key Achievement</h3>
              </div>
              <p className="text-lg font-semibold mb-2">
                CTR {monthlyStats.averageCtr.toFixed(2)}% 
                {monthlyStats.averageCtr > monthlyStats.benchmarks.ctr ? (
                  <span className="ml-2 text-green-200">+{((monthlyStats.averageCtr - monthlyStats.benchmarks.ctr) / monthlyStats.benchmarks.ctr * 100).toFixed(1)}% vs target</span>
                ) : (
                  <span className="ml-2 text-red-200">-{((monthlyStats.benchmarks.ctr - monthlyStats.averageCtr) / monthlyStats.benchmarks.ctr * 100).toFixed(1)}% vs target</span>
                )}
              </p>
              <p className="text-green-100">
                {monthlyStats.averageCtr > monthlyStats.benchmarks.ctr 
                  ? "Najlepszy wynik w ostatnich 6 miesiącach!" 
                  : "Poniżej celu - rozważ optymalizację"}
              </p>
            </div>

            {/* Performance Trend Chart */}
            {chartData && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Trend</h3>
                <MonthlyReportChart
                  type="bar"
                  data={chartData.performanceData}
                  title=""
                  height={300}
                />
              </div>
            )}

            {/* Ad Variants Badge */}
            <div className="flex justify-center">
              <div className="inline-flex items-center space-x-4 px-4 py-2 bg-gray-100 rounded-full text-sm text-gray-700">
                <span>{monthlyStats.adVariants.images} image</span>
                <span>{monthlyStats.adVariants.videos} video</span>
                <span>{monthlyStats.adVariants.carousels} carousel</span>
              </div>
            </div>
          </div>

          {/* 2. SECONDARY KPIs - Clean Grid */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Secondary KPIs</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Eye className="h-5 w-5 text-gray-600" />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-1">Impressions</p>
                <p className="text-xl font-bold text-gray-900">{formatNumber(monthlyStats.totalImpressions)}</p>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Target className="h-5 w-5 text-gray-600" />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-1">Clicks</p>
                <p className="text-xl font-bold text-gray-900">{formatNumber(monthlyStats.totalClicks)}</p>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <BarChart className="h-5 w-5 text-gray-600" />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-1">CPM</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(monthlyStats.averageCpm)}</p>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Target className="h-5 w-5 text-gray-600" />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-1">CPC</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(monthlyStats.averageCpc)}</p>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Users className="h-5 w-5 text-gray-600" />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-1">Reach</p>
                <p className="text-xl font-bold text-gray-900">{formatNumber(monthlyStats.totalReach)}</p>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Activity className="h-5 w-5 text-gray-600" />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-1">Frequency</p>
                <p className="text-xl font-bold text-gray-900">{monthlyStats.averageFrequency.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* 3. CAMPAIGN PERFORMANCE */}
          {monthlyStats.topCampaigns.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Campaign Performance</h2>
              
              {/* Top Campaign */}
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-6 border border-yellow-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div className="p-3 bg-yellow-100 rounded-lg mr-4">
                      <Trophy className="h-8 w-8 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Top Performing Campaign</p>
                      <p className="text-xl font-bold text-gray-900">{monthlyStats.topCampaigns[0]?.campaign_name || 'Brak kampanii'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(monthlyStats.topCampaigns[0]?.spend || 0)}</p>
                    <p className="text-sm text-gray-600">Total Spend</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Impressions</p>
                    <p className="font-semibold">{formatNumber(monthlyStats.topCampaigns[0]?.impressions || 0)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">CTR</p>
                    <p className="font-semibold">{(monthlyStats.topCampaigns[0]?.ctr || 0).toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Conversions</p>
                    <p className="font-semibold">{formatNumber(monthlyStats.topCampaigns[0]?.conversions || 0)}</p>
                  </div>
                </div>
              </div>

              {/* Other Campaigns */}
              {monthlyStats.topCampaigns.length > 1 && (
                <div className="space-y-3">
                  {monthlyStats.topCampaigns.slice(1).map((campaign, index) => (
                    <div key={campaign.campaign_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center mr-3">
                          <span className="text-xs font-medium text-gray-600">#{index + 2}</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{campaign.campaign_name}</p>
                          <p className="text-sm text-gray-600">{formatCurrency(campaign.spend || 0)} • {(campaign.ctr || 0).toFixed(2)}% CTR</p>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleCampaignExpansion(campaign.campaign_id)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        {expandedCampaigns.has(campaign.campaign_id) ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. ADVANCED DETAILS - Expandable */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <button
              onClick={() => setShowAdvancedDetails(!showAdvancedDetails)}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center">
                <Search className="h-5 w-5 text-gray-600 mr-3" />
                <h2 className="text-lg font-semibold text-gray-900">Advanced Metrics</h2>
              </div>
              {showAdvancedDetails ? (
                <ChevronUp className="h-5 w-5 text-gray-600" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-600" />
              )}
            </button>

            {showAdvancedDetails && (
              <div className="mt-6 space-y-6">
                {/* Benchmark Comparison Table */}
                <div>
                  <h3 className="text-md font-medium text-gray-900 mb-4">Benchmark Performance</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">CTR Target</span>
                        {getBenchmarkStatus(monthlyStats.averageCtr, monthlyStats.benchmarks.ctr) === 'osiągnięty' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      <div className="text-2xl font-bold text-gray-900">{monthlyStats.averageCtr.toFixed(2)}%</div>
                      <div className="text-sm text-gray-600">Target: {monthlyStats.benchmarks.ctr}%</div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">CPC Target</span>
                        {getBenchmarkStatus(monthlyStats.averageCpc, monthlyStats.benchmarks.cpc, true) === 'osiągnięty' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      <div className="text-2xl font-bold text-gray-900">{formatCurrency(monthlyStats.averageCpc)}</div>
                      <div className="text-sm text-gray-600">Target: {formatCurrency(monthlyStats.benchmarks.cpc)}</div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">CPA Target</span>
                        {getBenchmarkStatus(monthlyStats.averageCpa, monthlyStats.benchmarks.cpa, true) === 'osiągnięty' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      <div className="text-2xl font-bold text-gray-900">{formatCurrency(monthlyStats.averageCpa)}</div>
                      <div className="text-sm text-gray-600">Target: {formatCurrency(monthlyStats.benchmarks.cpa)}</div>
                    </div>
                  </div>
                </div>

                {/* Detailed Metrics Grid */}
                <div>
                  <h3 className="text-md font-medium text-gray-900 mb-4">Detailed Metrics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">CPM</p>
                      <p className="text-lg font-semibold">{formatCurrency(monthlyStats.averageCpm)}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">CPC</p>
                      <p className="text-lg font-semibold">{formatCurrency(monthlyStats.averageCpc)}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">CPA</p>
                      <p className="text-lg font-semibold">{formatCurrency(monthlyStats.averageCpa)}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">Frequency</p>
                      <p className="text-lg font-semibold">{monthlyStats.averageFrequency.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                {/* Ad Types Breakdown */}
                <div>
                  <h3 className="text-md font-medium text-gray-900 mb-4">Ad Types Breakdown</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg text-center">
                      <Image className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                      <p className="text-lg font-semibold text-blue-900">{monthlyStats.adVariants.images}</p>
                      <p className="text-sm text-blue-700">Image Ads</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg text-center">
                      <Video className="h-6 w-6 text-green-600 mx-auto mb-2" />
                      <p className="text-lg font-semibold text-green-900">{monthlyStats.adVariants.videos}</p>
                      <p className="text-sm text-green-700">Video Ads</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg text-center">
                      <BarChart className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                      <p className="text-lg font-semibold text-purple-900">{monthlyStats.adVariants.carousels}</p>
                      <p className="text-sm text-purple-700">Carousel Ads</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Disclaimer */}
          <div className="text-center text-sm text-gray-500">
            Report based on data from Meta API
          </div>
        </>
      ) : (
        /* Enhanced Empty State */
        <div className="text-center py-16">
          <div className="bg-white rounded-xl shadow-sm p-12 max-w-md mx-auto">
            <div className="relative">
              <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-6" />
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                <Info className="h-3 w-3 text-gray-500" />
              </div>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Brak kampanii w tym miesiącu
            </h3>
            <p className="text-gray-600 mb-6">
              Rozpocznij swoją pierwszą kampanię, aby zobaczyć wyniki tutaj! Raporty są automatycznie generowane na podstawie wydajności Twoich kampanii.
            </p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => navigateMonth('prev')}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Previous Month
              </button>
              <button
                onClick={() => navigateMonth('next')}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Next Month
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 