'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  BarChart3, 
  FileText,
  Download,
  Calendar,
  TrendingUp,
  DollarSign,
  Target,
  Eye as EyeIcon,
  Activity,
  RefreshCw,
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../../components/AuthProvider';
import { supabase } from '../../../lib/supabase';
import { getReportById } from '../../../lib/database';
import type { Database } from '../../../lib/database.types';

type Report = Database['public']['Tables']['reports']['Row'];
type Campaign = Database['public']['Tables']['campaigns']['Row'];
type Client = Database['public']['Tables']['clients']['Row'];

interface ReportWithCampaigns extends Report {
  campaigns: Campaign[];
}

export default function IndividualReportPage() {
  const [report, setReport] = useState<ReportWithCampaigns | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, profile } = useAuth();
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    if (!user && !loading) {
      router.push('/auth/login');
      return;
    }

    if (profile?.role !== 'client') {
              router.push(profile?.role === 'admin' ? '/admin' : '/dashboard');
      return;
    }

    if (user && params.id) {
      loadReport(params.id as string);
    }
  }, [user, profile, params.id, router]);

  const loadReport = async (reportId: string) => {
    try {
      setLoading(true);
      setError(null);

      // First get the client data
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('email', user!.email || '')
        .single();

      if (clientError || !clientData) {
        setError('Client not found');
        return;
      }

      setClient(clientData);

      // For live data reports, fetch from Meta API
      if (reportId.startsWith('live-data-')) {
        const response = await fetch('/api/fetch-live-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({
            dateRange: {
              start: '2024-01-01', // Get all historical data
              end: new Date().toISOString().split('T')[0]
            }
          })
        });

        if (!response.ok) {
          throw new Error('Failed to fetch live data');
        }

        const liveData = await response.json();
        
        if (liveData.success && liveData.data) {
          // Create a synthetic report from live data
          // Extract month and year from report ID (format: live-data-YYYY-MM)
          const idParts = reportId.split('-');
          const year = parseInt(idParts[2] || '2024');
          const month = parseInt(idParts[3] || '1');
          const monthStart = new Date(year || new Date().getFullYear(), (month || 1) - 1, 1);
          const monthEnd = new Date(year || new Date().getFullYear(), month || 1, 0);
          
          const syntheticReport: ReportWithCampaigns = {
            id: reportId,
            client_id: clientData.id,
            date_range_start: monthStart.toISOString().split('T')[0] || '',
            date_range_end: monthEnd.toISOString().split('T')[0] || '',
            generated_at: new Date().toISOString(),
            generation_time_ms: 0,
            email_sent: false,
            email_sent_at: null,
            file_size_bytes: null,
            file_url: null,
            created_at: new Date().toISOString(),
            campaigns: liveData.data.campaigns.map((campaign: any) => ({
              id: campaign.campaign_id,
              client_id: clientData.id,
              campaign_id: campaign.campaign_id,
              campaign_name: campaign.campaign_name,
              date_range_start: monthStart.toISOString().split('T')[0] || '',
              date_range_end: monthEnd.toISOString().split('T')[0] || '',
              impressions: Math.floor(campaign.impressions / 6), // Distribute across months
              clicks: Math.floor(campaign.clicks / 6), // Distribute across months
              spend: campaign.spend > 0 ? campaign.spend / 6 : 0, // Only distribute if there's actual spend
              conversions: Math.floor(campaign.conversions / 6), // Distribute across months
              ctr: campaign.ctr, // Keep CTR the same
              cpc: campaign.cpc, // Keep CPC the same
              cpp: campaign.cpp,
              frequency: campaign.frequency,
              reach: Math.floor(campaign.reach / 6), // Distribute across months
              status: 'ACTIVE',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }))
          };

          setReport(syntheticReport);
        } else {
          setError('Failed to fetch live data from Meta API');
        }
      } else {
        // For stored reports, get from database
        const reportWithCampaigns = await getReportById(reportId);
        
        if (!reportWithCampaigns) {
          setError('Report not found');
          return;
        }

        // Verify that this report belongs to the current client
        if (reportWithCampaigns.client_id !== clientData.id) {
          setError('Access denied - this report does not belong to your account');
          return;
        }

        setReport(reportWithCampaigns);
      }
    } catch (error) {
      console.error('Error loading report:', error);
      setError('Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const getReportStats = () => {
    if (!report) return null;

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

  const downloadReport = async () => {
    console.log('Downloading report:', report?.id);
    // TODO: Implement report download functionality
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

  const getStatusIcon = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'ACTIVE':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'PAUSED':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'PAUSED':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-red-100 text-red-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner h-8 w-8 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Report Not Found</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/reports')}
            className="btn-primary"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Reports
          </button>
        </div>
      </div>
    );
  }

  if (!report) {
    return null;
  }

  const stats = getReportStats();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/reports')}
                className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <BarChart3 className="h-8 w-8 text-primary-600" />
              <div className="ml-3">
                <h1 className="text-xl font-semibold text-gray-900">
                  {report.id.startsWith('live-data-') ? 'Live Campaign Report' : 'Report Details'}
                </h1>
                <p className="text-sm text-gray-600">
                  {client?.name} - {new Date(report.date_range_start).toLocaleDateString()} to {new Date(report.date_range_end).toLocaleDateString()}
                  {report.id.startsWith('live-data-') && ' (Live Data from Meta API)'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {report.id.startsWith('live-data-') && (
                <button
                  onClick={() => loadReport(report.id)}
                  className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Refresh live data"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </button>
              )}
              <button
                onClick={downloadReport}
                className="btn-secondary"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Report
              </button>
              <button
                onClick={() => router.push(profile?.role === 'admin' ? '/admin' : '/dashboard')}
                className="btn-secondary"
              >
                                  {profile?.role === 'admin' ? 'Admin' : 'Dashboard'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Report Summary */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-600">Date Range</p>
                <p className="font-medium">
                  {new Date(report.date_range_start).toLocaleDateString()} - {new Date(report.date_range_end).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Generated</p>
                <p className="font-medium">
                  {new Date(report.generated_at).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Campaigns</p>
                <p className="font-medium">{report.campaigns.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p className="font-medium">
                  {report.email_sent ? 'Email Sent' : 'Generated'}
                </p>
              </div>
            </div>

            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 border-l-4 border-blue-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-800">Total Spend</p>
                      <p className="text-2xl font-bold text-blue-900">
                        {formatCurrency(stats.totalSpend)}
                      </p>
                    </div>
                    <DollarSign className="h-8 w-8 text-blue-600" />
                  </div>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4 border-l-4 border-green-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-800">Impressions</p>
                      <p className="text-2xl font-bold text-green-900">
                        {formatNumber(stats.totalImpressions)}
                      </p>
                    </div>
                    <EyeIcon className="h-8 w-8 text-green-600" />
                  </div>
                </div>

                <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg p-4 border-l-4 border-yellow-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-yellow-800">Clicks</p>
                      <p className="text-2xl font-bold text-yellow-900">
                        {formatNumber(stats.totalClicks)}
                      </p>
                    </div>
                    <Target className="h-8 w-8 text-yellow-600" />
                  </div>
                </div>

                <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4 border-l-4 border-purple-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-800">CTR</p>
                      <p className="text-2xl font-bold text-purple-900">
                        {stats.averageCtr.toFixed(2)}%
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-purple-600" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Campaign Performance Table */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Campaign Performance</h2>
              <div className="flex items-center text-sm text-gray-600">
                <Activity className="h-4 w-4 mr-1" />
                {report.campaigns.length} campaigns
              </div>
            </div>

            {report.campaigns.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Campaign
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
                    {report.campaigns.map((campaign) => (
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(campaign.spend || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatNumber(campaign.impressions || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatNumber(campaign.clicks || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {campaign.ctr ? `${campaign.ctr.toFixed(2)}%` : '0%'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(campaign.cpc || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No campaigns found</h3>
                <p className="text-gray-600">This report doesn&apos;t contain any campaign data.</p>
              </div>
            )}
          </div>

          {/* Additional Report Metrics */}
          {stats && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Summary</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Average CPC</span>
                    <span className="font-semibold">{formatCurrency(stats.averageCpc)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Total Conversions</span>
                    <span className="font-semibold">{formatNumber(stats.totalConversions)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Campaign Count</span>
                    <span className="font-semibold">{stats.campaignCount}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-600">Generation Time</span>
                    <span className="font-semibold">
                      {report.generation_time_ms ? `${report.generation_time_ms}ms` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Report Information</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Report ID</span>
                    <span className="font-mono text-sm">{report.id}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Client</span>
                    <span className="font-semibold">{client?.name}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Email Status</span>
                    <span className="font-semibold">
                      {report.email_sent ? 'Sent' : 'Not Sent'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-600">File Size</span>
                    <span className="font-semibold">
                      {report.file_size_bytes ? `${(report.file_size_bytes / 1024).toFixed(2)} KB` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 