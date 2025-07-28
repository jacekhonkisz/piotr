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
  X
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

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportWithCampaigns[]>([]);
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportWithCampaigns | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
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
      // Get client data
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

      // Use optimized database function
      const reportsWithCampaigns = await getReportsWithCampaigns(clientData.id, 20);
      setReports(reportsWithCampaigns);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = reports.filter(report => {
    const matchesSearch = report.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.date_range_start.includes(searchTerm) ||
                         report.date_range_end.includes(searchTerm);
    
    let matchesDate = true;
    if (dateFilter !== 'all') {
      const reportDate = new Date(report.generated_at);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - reportDate.getTime()) / (1000 * 60 * 60 * 24));
      
      switch (dateFilter) {
        case 'last7days':
          matchesDate = diffDays <= 7;
          break;
        case 'last30days':
          matchesDate = diffDays <= 30;
          break;
        case 'last90days':
          matchesDate = diffDays <= 90;
          break;
      }
    }
    
    return matchesSearch && matchesDate;
  });

  const getReportStats = (report: ReportWithCampaigns) => {
    const totalSpend = report.campaigns.reduce((sum, campaign) => sum + (campaign.spend || 0), 0);
    const totalImpressions = report.campaigns.reduce((sum, campaign) => sum + (campaign.impressions || 0), 0);
    const totalClicks = report.campaigns.reduce((sum, campaign) => sum + (campaign.clicks || 0), 0);
    const totalConversions = report.campaigns.reduce((sum, campaign) => sum + (campaign.conversions || 0), 0);
    const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const averageCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

    return {
      totalSpend,
      totalImpressions,
      totalClicks,
      totalConversions,
      averageCtr,
      averageCpc,
      campaignCount: report.campaigns.length
    };
  };

  const viewReport = (report: ReportWithCampaigns) => {
    setSelectedReport(report);
    setShowReportModal(true);
  };

  const downloadReport = async (report: Report) => {
    // This would generate and download a PDF report
    console.log('Downloading report:', report.id);
    // Implementation would go here
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
              <FileText className="h-8 w-8 text-primary-600" />
              <div className="ml-3">
                <h1 className="text-xl font-semibold text-gray-900">
                  Meta Ads Reports
                </h1>
                <p className="text-sm text-gray-600">
                  {client?.name} - Performance Analytics
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="btn-secondary"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search reports..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Time</option>
                <option value="last7days">Last 7 Days</option>
                <option value="last30days">Last 30 Days</option>
                <option value="last90days">Last 90 Days</option>
              </select>
              <button
                onClick={loadReports}
                className="p-2 text-gray-600 hover:text-gray-900"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Reports Grid */}
        {filteredReports.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No reports found</h3>
            <p className="text-gray-600 mb-6">
              {reports.length === 0 
                ? "You don't have any reports yet. Generate your first report from the dashboard."
                : "No reports match your current filters."
              }
            </p>
            {reports.length === 0 && (
              <button
                onClick={() => router.push('/dashboard')}
                className="btn-primary"
              >
                Go to Dashboard
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredReports.map((report) => {
              const stats = getReportStats(report);
              return (
                <div key={report.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <div className="p-6">
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

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <DollarSign className="h-4 w-4 text-green-600" />
                        </div>
                        <p className="text-lg font-semibold text-gray-900">
                          ${stats.totalSpend.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-600">Total Spend</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <EyeIcon className="h-4 w-4 text-blue-600" />
                        </div>
                        <p className="text-lg font-semibold text-gray-900">
                          {stats.totalImpressions.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-600">Impressions</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <Target className="h-4 w-4 text-yellow-600" />
                        </div>
                        <p className="text-lg font-semibold text-gray-900">
                          {stats.totalClicks.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-600">Clicks</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <TrendingUp className="h-4 w-4 text-purple-600" />
                        </div>
                        <p className="text-lg font-semibold text-gray-900">
                          {stats.averageCtr.toFixed(2)}%
                        </p>
                        <p className="text-xs text-gray-600">CTR</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                      <span>{stats.campaignCount} campaigns</span>
                      <span>{report.generation_time_ms ? `${report.generation_time_ms}ms` : 'Generated'}</span>
                    </div>

                    {/* Actions */}
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
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Report Detail Modal */}
      {showReportModal && selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Report Details</h2>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Report Header */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Date Range</p>
                    <p className="font-medium">
                      {new Date(selectedReport.date_range_start).toLocaleDateString()} - {new Date(selectedReport.date_range_end).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Generated</p>
                    <p className="font-medium">
                      {new Date(selectedReport.generated_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Campaigns</p>
                    <p className="font-medium">{selectedReport.campaigns.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <p className="font-medium">
                      {selectedReport.email_sent ? 'Email Sent' : 'Generated'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Campaign Performance */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Campaign Performance</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Campaign
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Spend
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Impressions
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Clicks
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
                      {selectedReport.campaigns.map((campaign) => (
                        <tr key={campaign.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {campaign.campaign_name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {campaign.campaign_id}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              campaign.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                              campaign.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {campaign.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ${campaign.spend?.toLocaleString() || '0'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {campaign.impressions?.toLocaleString() || '0'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {campaign.clicks?.toLocaleString() || '0'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {campaign.ctr ? `${campaign.ctr.toFixed(2)}%` : '0%'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ${campaign.cpc?.toFixed(2) || '0'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(getReportStats(selectedReport)).map(([key, value]) => (
                    <div key={key}>
                      <p className="text-xs text-gray-600 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </p>
                      <p className="font-medium">
                        {typeof value === 'number' && key.includes('Spend') ? `$${value.toLocaleString()}` :
                         typeof value === 'number' && key.includes('Ctr') ? `${value.toFixed(2)}%` :
                         typeof value === 'number' ? value.toLocaleString() : value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={() => downloadReport(selectedReport)}
                className="btn-secondary"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Report
              </button>
              <button
                onClick={() => setShowReportModal(false)}
                className="btn-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 