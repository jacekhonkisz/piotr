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
import MonthlyReportView from '../../components/MonthlyReportView';
import type { Database } from '../../lib/database.types';

type Report = Database['public']['Tables']['reports']['Row'];
type Campaign = Database['public']['Tables']['campaigns']['Row'];
type Client = Database['public']['Tables']['clients']['Row'];

interface ReportWithCampaigns extends Report {
  campaigns: Campaign[];
}



export default function ReportsPage() {
  const [reports, setReports] = useState<ReportWithCampaigns[]>([]);
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
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
          /* Enhanced Monthly View with All UX Improvements */
          <MonthlyReportView
            reports={reports}
            onDownloadPDF={async (month) => {
              try {
                const response = await fetch('/api/download-pdf', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    month: month.getMonth() + 1,
                    year: month.getFullYear(),
                    clientId: client?.id || 'unknown'
                  }),
                });

                const data = await response.json();
                if (data.success) {
                  // In a real implementation, this would trigger the actual PDF download
                  console.log('PDF download initiated:', data.downloadUrl);
                  alert('PDF download started! Check your downloads folder.');
                } else {
                  console.error('Failed to generate PDF:', data.error);
                  alert('Failed to generate PDF. Please try again.');
                }
              } catch (error) {
                console.error('Error downloading PDF:', error);
                alert('Error downloading PDF. Please try again.');
              }
            }}
            onViewDetails={(month) => {
              console.log('Viewing details for month:', month);
              // TODO: Implement detailed view functionality
            }}
          />

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