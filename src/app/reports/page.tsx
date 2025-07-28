'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  BarChart3, 
  FileText,
  Download,
  Eye,
  Calendar,
  TrendingUp,
  DollarSign,
  Target,
  Eye as EyeIcon,
  Users,
  Activity,
  RefreshCw,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  ArrowUp,
  ArrowDown,
  BarChart,
  PieChart,
  LineChart,
  Zap,
  Award,
  TrendingDown
} from 'lucide-react';
import { useAuth } from '../../components/AuthProvider';
import { supabase } from '../../lib/supabase';
import { getReportsWithCampaigns } from '../../lib/database';
import type { Database } from '../../lib/database.types';

type Report = Database['public']['Tables']['reports']['Row'];
type Campaign = Database['public']['Tables']['campaigns']['Row'];
type Client = Database['public']['Tables']['clients']['Row'];

interface ReportWithCampaigns extends Report {
  campaigns: Campaign[];
}

interface MonthlyStats {
  month: string;
  year: number;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  averageCtr: number;
  averageCpc: number;
  campaignCount: number;
  reportCount: number;
  topCampaigns: Campaign[];
  performanceChange: {
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
  };
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportWithCampaigns[]>([]);
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
  // Modal functionality removed - reports now open in dedicated pages
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats | null>(null);
  const [viewMode, setViewMode] = useState<'monthly' | 'detailed'>('monthly');
  const { user, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user && !loading) {
      router.push('/auth/login');
      return;
    }

    if (profile?.role !== 'client') {
      router.push('/dashboard');
      return;
    }

    if (user) {
      loadReports();
    }
  }, [user, profile, loading, router]);

  useEffect(() => {
    if (reports.length > 0) {
      calculateMonthlyStats();
    }
  }, [reports, currentMonth]);

  const loadReports = async () => {
    try {
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('email', user!.email || '')
        .single();

      if (clientError || !clientData) {
        console.error('Client not found:', clientError);
        return;
      }

      setClient(clientData);
      const reportsWithCampaigns = await getReportsWithCampaigns(clientData.id, 100);
      setReports(reportsWithCampaigns);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMonthlyStats = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // Get reports for the current month
    const monthReports = reports.filter(report => {
      const reportDate = new Date(report.date_range_start);
      return reportDate.getFullYear() === year && reportDate.getMonth() === month;
    });

    // Get reports for the previous month for comparison
    const prevMonth = new Date(year, month - 1, 1);
    const prevMonthReports = reports.filter(report => {
      const reportDate = new Date(report.date_range_start);
      return reportDate.getFullYear() === prevMonth.getFullYear() && 
             reportDate.getMonth() === prevMonth.getMonth();
    });

    // Calculate current month stats
    const currentStats = monthReports.reduce((acc, report) => {
      const reportStats = getReportStats(report);
      return {
        totalSpend: acc.totalSpend + reportStats.totalSpend,
        totalImpressions: acc.totalImpressions + reportStats.totalImpressions,
        totalClicks: acc.totalClicks + reportStats.totalClicks,
        totalConversions: acc.totalConversions + reportStats.totalConversions,
        campaignCount: acc.campaignCount + reportStats.campaignCount,
        reportCount: acc.reportCount + 1
      };
    }, {
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      campaignCount: 0,
      reportCount: 0
    });

    // Calculate previous month stats
    const prevStats = prevMonthReports.reduce((acc, report) => {
      const reportStats = getReportStats(report);
      return {
        totalSpend: acc.totalSpend + reportStats.totalSpend,
        totalImpressions: acc.totalImpressions + reportStats.totalImpressions,
        totalClicks: acc.totalClicks + reportStats.totalClicks,
        totalConversions: acc.totalConversions + reportStats.totalConversions,
      };
    }, {
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
    });

    // Get top campaigns for the month
    const allCampaigns = monthReports.flatMap(report => report.campaigns);
    const topCampaigns = allCampaigns
      .sort((a, b) => (b.spend || 0) - (a.spend || 0))
      .slice(0, 5);

    const stats: MonthlyStats = {
      month: currentMonth.toLocaleDateString('en-US', { month: 'long' }),
      year,
      totalSpend: currentStats.totalSpend,
      totalImpressions: currentStats.totalImpressions,
      totalClicks: currentStats.totalClicks,
      totalConversions: currentStats.totalConversions,
      averageCtr: currentStats.totalImpressions > 0 ? (currentStats.totalClicks / currentStats.totalImpressions) * 100 : 0,
      averageCpc: currentStats.totalClicks > 0 ? currentStats.totalSpend / currentStats.totalClicks : 0,
      campaignCount: currentStats.campaignCount,
      reportCount: currentStats.reportCount,
      topCampaigns,
      performanceChange: {
        spend: prevStats.totalSpend > 0 ? ((currentStats.totalSpend - prevStats.totalSpend) / prevStats.totalSpend) * 100 : 0,
        impressions: prevStats.totalImpressions > 0 ? ((currentStats.totalImpressions - prevStats.totalImpressions) / prevStats.totalImpressions) * 100 : 0,
        clicks: prevStats.totalClicks > 0 ? ((currentStats.totalClicks - prevStats.totalClicks) / prevStats.totalClicks) * 100 : 0,
        ctr: prevStats.totalImpressions > 0 ? 
          (((currentStats.totalClicks / currentStats.totalImpressions) - (prevStats.totalClicks / prevStats.totalImpressions)) / (prevStats.totalClicks / prevStats.totalImpressions)) * 100 : 0
      }
    };

    setMonthlyStats(stats);
  };

  const getReportStats = (report: ReportWithCampaigns) => {
    const totalSpend = report.campaigns.reduce((sum, campaign) => sum + (campaign.spend || 0), 0);
    const totalImpressions = report.campaigns.reduce((sum, campaign) => sum + (campaign.impressions || 0), 0);
    const totalClicks = report.campaigns.reduce((sum, campaign) => sum + (campaign.clicks || 0), 0);
    const totalConversions = report.campaigns.reduce((sum, campaign) => sum + (campaign.conversions || 0), 0);

    return {
      totalSpend,
      totalImpressions,
      totalClicks,
      totalConversions,
      campaignCount: report.campaigns.length
    };
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'next') {
      newMonth.setMonth(newMonth.getMonth() + 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() - 1);
    }
    setCurrentMonth(newMonth);
  };

  const getMonthReports = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    return reports.filter(report => {
      const reportDate = new Date(report.date_range_start);
      return reportDate.getFullYear() === year && reportDate.getMonth() === month;
    });
  };

  const viewReport = (report: ReportWithCampaigns) => {
    router.push(`/reports/${report.id}`);
  };

  const downloadReport = async (report: Report) => {
    console.log('Downloading report:', report.id);
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
    return <TrendingUp className="h-4 w-4 text-gray-500" />;
  };

  const getPerformanceColor = (change: number) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner h-8 w-8 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading reports...</p>
        </div>
      </div>
    );
  }

  const monthReports = getMonthReports();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-primary-600" />
              <div className="ml-3">
                <h1 className="text-xl font-semibold text-gray-900">
                  Monthly Performance Reports
                </h1>
                <p className="text-sm text-gray-600">
                  {client?.name} - Campaign Analytics & Insights
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('monthly')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'monthly' 
                      ? 'bg-white text-primary-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Monthly View
                </button>
                <button
                  onClick={() => setViewMode('detailed')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'detailed' 
                      ? 'bg-white text-primary-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Detailed Reports
                </button>
              </div>
              <button
                onClick={() => router.push('/dashboard')}
                className="btn-secondary"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {viewMode === 'monthly' ? (
          /* Monthly View */
          <div className="space-y-8">
            {/* Month Navigation */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => navigateMonth('prev')}
                  className="p-3 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-gray-900">
                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h2>
                  <p className="text-gray-600 mt-1">
                    {monthReports.length} report{monthReports.length !== 1 ? 's' : ''} • {monthlyStats?.campaignCount || 0} campaigns
                  </p>
                </div>

                <button
                  onClick={() => navigateMonth('next')}
                  className="p-3 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </div>
            </div>

            {monthlyStats && monthReports.length > 0 ? (
              <>
                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Spend</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatCurrency(monthlyStats.totalSpend)}
                        </p>
                        <div className="flex items-center mt-2">
                          {getPerformanceIcon(monthlyStats.performanceChange.spend)}
                          <span className={`text-sm font-medium ml-1 ${getPerformanceColor(monthlyStats.performanceChange.spend)}`}>
                            {Math.abs(monthlyStats.performanceChange.spend).toFixed(1)}%
                          </span>
                          <span className="text-xs text-gray-500 ml-1">vs last month</span>
                        </div>
                      </div>
                      <div className="p-3 bg-blue-100 rounded-lg">
                        <DollarSign className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Impressions</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatNumber(monthlyStats.totalImpressions)}
                        </p>
                        <div className="flex items-center mt-2">
                          {getPerformanceIcon(monthlyStats.performanceChange.impressions)}
                          <span className={`text-sm font-medium ml-1 ${getPerformanceColor(monthlyStats.performanceChange.impressions)}`}>
                            {Math.abs(monthlyStats.performanceChange.impressions).toFixed(1)}%
                          </span>
                          <span className="text-xs text-gray-500 ml-1">vs last month</span>
                        </div>
                      </div>
                      <div className="p-3 bg-green-100 rounded-lg">
                        <EyeIcon className="h-6 w-6 text-green-600" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-yellow-500">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Clicks</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatNumber(monthlyStats.totalClicks)}
                        </p>
                        <div className="flex items-center mt-2">
                          {getPerformanceIcon(monthlyStats.performanceChange.clicks)}
                          <span className={`text-sm font-medium ml-1 ${getPerformanceColor(monthlyStats.performanceChange.clicks)}`}>
                            {Math.abs(monthlyStats.performanceChange.clicks).toFixed(1)}%
                          </span>
                          <span className="text-xs text-gray-500 ml-1">vs last month</span>
                        </div>
                      </div>
                      <div className="p-3 bg-yellow-100 rounded-lg">
                        <Target className="h-6 w-6 text-yellow-600" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-purple-500">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">CTR</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {monthlyStats.averageCtr.toFixed(2)}%
                        </p>
                        <div className="flex items-center mt-2">
                          {getPerformanceIcon(monthlyStats.performanceChange.ctr)}
                          <span className={`text-sm font-medium ml-1 ${getPerformanceColor(monthlyStats.performanceChange.ctr)}`}>
                            {Math.abs(monthlyStats.performanceChange.ctr).toFixed(1)}%
                          </span>
                          <span className="text-xs text-gray-500 ml-1">vs last month</span>
                        </div>
                      </div>
                      <div className="p-3 bg-purple-100 rounded-lg">
                        <TrendingUp className="h-6 w-6 text-purple-600" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Performance Insights */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Top Performing Campaigns</h3>
                      <Award className="h-5 w-5 text-yellow-500" />
                    </div>
                    <div className="space-y-4">
                      {monthlyStats.topCampaigns.map((campaign, index) => (
                        <div key={campaign.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center mr-3">
                              <span className="text-sm font-semibold text-primary-600">#{index + 1}</span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{campaign.campaign_name}</p>
                              <p className="text-sm text-gray-600">{campaign.campaign_id}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">{formatCurrency(campaign.spend || 0)}</p>
                            <p className="text-sm text-gray-600">{campaign.clicks || 0} clicks</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Monthly Summary</h3>
                      <BarChart className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-gray-600">Average CPC</span>
                        <span className="font-semibold">{formatCurrency(monthlyStats.averageCpc)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-gray-600">Total Conversions</span>
                        <span className="font-semibold">{formatNumber(monthlyStats.totalConversions)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-gray-600">Active Campaigns</span>
                        <span className="font-semibold">{monthlyStats.campaignCount}</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-gray-600">Reports Generated</span>
                        <span className="font-semibold">{monthlyStats.reportCount}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Monthly Reports List */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900">Monthly Reports</h3>
                    <Calendar className="h-5 w-5 text-gray-400" />
                  </div>
                  <div className="space-y-4">
                    {monthReports.map((report) => (
                      <div key={report.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex items-center">
                          <div className="p-2 bg-primary-100 rounded-lg mr-4">
                            <FileText className="h-5 w-5 text-primary-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {new Date(report.date_range_start).toLocaleDateString()} - {new Date(report.date_range_end).toLocaleDateString()}
                            </p>
                            <p className="text-sm text-gray-600">
                              Generated {new Date(report.generated_at).toLocaleDateString()} • {report.campaigns.length} campaigns
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => viewReport(report)}
                            className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => downloadReport(report)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              /* No Reports for Month */
              <div className="text-center py-16">
                <div className="bg-white rounded-xl shadow-sm p-12 max-w-md mx-auto">
                  <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-6" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    No Reports for {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h3>
                  <p className="text-gray-600 mb-6">
                    No reports were generated for this month. Reports are automatically created based on your campaign performance.
                  </p>
                  <div className="flex justify-center space-x-4">
                    <button
                      onClick={() => navigateMonth('prev')}
                      className="btn-secondary"
                    >
                      Previous Month
                    </button>
                    <button
                      onClick={() => navigateMonth('next')}
                      className="btn-secondary"
                    >
                      Next Month
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Detailed Reports View */
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">All Reports</h2>
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search reports..."
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <button
                    onClick={loadReports}
                    className="p-2 text-gray-600 hover:text-gray-900"
                  >
                    <RefreshCw className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              {reports.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No reports found</h3>
                  <p className="text-gray-600">Reports are automatically generated based on your campaign performance.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {reports.map((report) => {
                    const stats = getReportStats(report);
                    return (
                      <div key={report.id} className="bg-gray-50 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center">
                            <Calendar className="h-5 w-5 text-gray-400 mr-2" />
                            <span className="text-sm font-medium text-gray-900">
                              {new Date(report.date_range_start).toLocaleDateString()} - {new Date(report.date_range_end).toLocaleDateString()}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(report.generated_at).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div className="text-center">
                            <div className="flex items-center justify-center mb-1">
                              <DollarSign className="h-4 w-4 text-green-600" />
                            </div>
                            <p className="text-lg font-semibold text-gray-900">
                              {formatCurrency(stats.totalSpend)}
                            </p>
                            <p className="text-xs text-gray-600">Total Spend</p>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center mb-1">
                              <Target className="h-4 w-4 text-yellow-600" />
                            </div>
                            <p className="text-lg font-semibold text-gray-900">
                              {formatNumber(stats.totalClicks)}
                            </p>
                            <p className="text-xs text-gray-600">Clicks</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                          <span>{stats.campaignCount} campaigns</span>
                          <span>{report.generation_time_ms ? `${report.generation_time_ms}ms` : 'Generated'}</span>
                        </div>

                        <div className="flex space-x-2">
                          <button
                            onClick={() => viewReport(report)}
                            className="flex-1 flex items-center justify-center px-3 py-2 bg-primary-600 text-white text-sm rounded-md hover:bg-primary-700"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Details
                          </button>
                          <button
                            onClick={() => downloadReport(report)}
                            className="px-3 py-2 text-gray-600 hover:text-gray-900"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modal functionality removed - reports now open in dedicated pages */}
    </div>
  );
} 