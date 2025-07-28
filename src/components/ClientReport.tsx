'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Users, 
  Target,
  DollarSign,
  RefreshCw
} from 'lucide-react';
import MetaAPIService from '../lib/meta-api';

interface CampaignInsights {
  campaign_id: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpp?: number;
  frequency?: number;
  reach?: number;
  date_start: string;
  date_stop: string;
}

interface AccountSummary {
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  average_ctr: number;
  average_cpc: number;
  average_cpa: number;
  active_campaigns: number;
  total_campaigns: number;
}

interface ClientReport {
  account_summary: AccountSummary;
  campaigns: CampaignInsights[];
  date_range: {
    start: string;
    end: string;
  };
  generated_at: string;
}

interface ClientReportProps {
  clientId: string;
  accessToken: string;
  adAccountId: string;
  onClose: () => void;
}

export default function ClientReport({ clientId, accessToken, adAccountId, onClose }: ClientReportProps) {
  const [report, setReport] = useState<ClientReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    end: new Date().toISOString().split('T')[0], // today
  });

  const generateReport = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const metaAPI = new MetaAPIService(accessToken);
      const reportData = await metaAPI.generateClientReport(
        adAccountId,
        dateRange.start || '',
        dateRange.end || ''
      );
      setReport(reportData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateReport();
  }, [clientId, accessToken, adAccountId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatPercentage = (num: number) => {
    return `${num.toFixed(2)}%`;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-center p-12">
            <div className="spinner h-8 w-8"></div>
            <span className="ml-3 text-gray-600">Generating report...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
          <div className="p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <BarChart3 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Report Generation Failed</h3>
              <p className="text-gray-600 mb-6">{error}</p>
              <div className="flex space-x-3">
                <button
                  onClick={generateReport}
                  className="btn-primary"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </button>
                <button
                  onClick={onClose}
                  className="btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Meta Ads Report</h2>
            <p className="text-gray-600">
              {new Date(report.date_range.start).toLocaleDateString()} - {new Date(report.date_range.end).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Date Range:</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="form-input text-sm"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="form-input text-sm"
              />
            </div>
            <button
              onClick={generateReport}
              className="btn-primary btn-sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
            <button
              onClick={onClose}
              className="btn-secondary btn-sm"
            >
              Close
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="p-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="card">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <DollarSign className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Spend</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(report.account_summary.total_spend)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="flex items-center">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Target className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Conversions</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatNumber(report.account_summary.total_conversions)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="flex items-center">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <BarChart3 className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Avg. CPA</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(report.account_summary.average_cpa)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="flex items-center">
                  <div className="p-3 bg-orange-100 rounded-lg">
                    <Users className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Active Campaigns</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {report.account_summary.active_campaigns}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Impressions</span>
                    <span className="font-semibold">{formatNumber(report.account_summary.total_impressions)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Clicks</span>
                    <span className="font-semibold">{formatNumber(report.account_summary.total_clicks)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">CTR</span>
                    <span className="font-semibold">{formatPercentage(report.account_summary.average_ctr)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Avg. CPC</span>
                    <span className="font-semibold">{formatCurrency(report.account_summary.average_cpc)}</span>
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Campaign Overview</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Campaigns</span>
                    <span className="font-semibold">{report.account_summary.total_campaigns}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Active Campaigns</span>
                    <span className="font-semibold">{report.account_summary.active_campaigns}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Inactive Campaigns</span>
                    <span className="font-semibold">
                      {report.account_summary.total_campaigns - report.account_summary.active_campaigns}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Report Generated</span>
                    <span className="font-semibold">
                      {new Date(report.generated_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Campaigns Table */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Campaign Performance</h3>
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Conversions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {report.campaigns.map((campaign) => (
                      <tr key={campaign.campaign_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {campaign.campaign_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {campaign.campaign_id}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(campaign.spend)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatNumber(campaign.impressions)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatNumber(campaign.clicks)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatPercentage(campaign.ctr)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(campaign.cpc)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatNumber(campaign.conversions)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 