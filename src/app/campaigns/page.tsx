'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Target,
  TrendingUp,
  DollarSign,
  Eye,
  Filter,
  Search,
  RefreshCw,
  Calendar,
  Activity,
  BarChart3,
  Download,
  SortAsc,
  SortDesc
} from 'lucide-react';
import { useAuth } from '../../components/AuthProvider';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';

type Campaign = Database['public']['Tables']['campaigns']['Row'];
type Client = Database['public']['Tables']['clients']['Row'];

interface CampaignStats {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  averageCtr: number;
  averageCpc: number;
  averageCpa: number;
  activeCampaigns: number;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date_range_start');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const { user, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user && !loading) {
      router.push('/auth/login');
      return;
    }

    if (profile?.role !== 'client') {
              router.push(profile?.role === 'admin' ? '/admin' : '/dashboard');
      return;
    }

    if (user) {
      loadCampaigns();
    }
  }, [user, profile, loading, router]);

  const loadCampaigns = async () => {
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

      // Get campaigns for this client
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('client_id', clientData.id)
        .order('date_range_start', { ascending: false });

      if (campaignsError) throw campaignsError;
      setCampaigns(campaignsData || []);
    } catch (error) {
      console.error('Error loading campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedCampaigns = campaigns
    .filter(campaign => {
      const matchesSearch = campaign.campaign_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           campaign.campaign_id.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
      
      let matchesDate = true;
      if (dateFilter !== 'all') {
        const campaignDate = new Date(campaign.date_range_start);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - campaignDate.getTime()) / (1000 * 60 * 60 * 24));
        
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
      
      return matchesSearch && matchesStatus && matchesDate;
    })
    .sort((a, b) => {
      let aValue: any = a[sortBy as keyof Campaign];
      let bValue: any = b[sortBy as keyof Campaign];
      
      // Handle date sorting
      if (sortBy.includes('date')) {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }
      
      // Handle numeric sorting
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      // Handle string sorting
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      return 0;
    });

  const getCampaignStats = (): CampaignStats => {
    const totalSpend = campaigns.reduce((sum, campaign) => sum + (campaign.spend || 0), 0);
    const totalImpressions = campaigns.reduce((sum, campaign) => sum + (campaign.impressions || 0), 0);
    const totalClicks = campaigns.reduce((sum, campaign) => sum + (campaign.clicks || 0), 0);
    const totalConversions = campaigns.reduce((sum, campaign) => sum + (campaign.conversions || 0), 0);
    const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const averageCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const averageCpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
    const activeCampaigns = campaigns.filter(campaign => campaign.status === 'ACTIVE').length;

    return {
      totalSpend,
      totalImpressions,
      totalClicks,
      totalConversions,
      averageCtr,
      averageCpc,
      averageCpa,
      activeCampaigns
    };
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const downloadCampaignData = async () => {
    // This would export campaign data to CSV
    console.log('Downloading campaign data...');
    // Implementation would go here
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner h-8 w-8 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading campaigns...</p>
        </div>
      </div>
    );
  }

  const stats = getCampaignStats();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Target className="h-8 w-8 text-primary-600" />
              <div className="ml-3">
                <h1 className="text-xl font-semibold text-gray-900">
                  Campaign Performance
                </h1>
                <p className="text-sm text-gray-600">
                  {client?.name} - Meta Ads Campaigns
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={downloadCampaignData}
                className="btn-secondary"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </button>
              <button
                onClick={() => router.push(profile?.role === 'admin' ? '/admin' : '/dashboard')}
                className="btn-primary"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Spend</p>
                <p className="text-2xl font-semibold text-gray-900">
                  ${stats.totalSpend.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Eye className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Impressions</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats.totalImpressions.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Target className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Clicks</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats.totalClicks.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Activity className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Campaigns</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats.activeCampaigns}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search campaigns..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
                <option value="DELETED">Deleted</option>
              </select>
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
                onClick={loadCampaigns}
                className="p-2 text-gray-600 hover:text-gray-900"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Campaigns Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('campaign_name')}
                      className="flex items-center space-x-1 hover:text-gray-700"
                    >
                      <span>Campaign</span>
                      {sortBy === 'campaign_name' && (
                        sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('status')}
                      className="flex items-center space-x-1 hover:text-gray-700"
                    >
                      <span>Status</span>
                      {sortBy === 'status' && (
                        sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('spend')}
                      className="flex items-center space-x-1 hover:text-gray-700"
                    >
                      <span>Spend</span>
                      {sortBy === 'spend' && (
                        sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('impressions')}
                      className="flex items-center space-x-1 hover:text-gray-700"
                    >
                      <span>Impressions</span>
                      {sortBy === 'impressions' && (
                        sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('clicks')}
                      className="flex items-center space-x-1 hover:text-gray-700"
                    >
                      <span>Clicks</span>
                      {sortBy === 'clicks' && (
                        sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('ctr')}
                      className="flex items-center space-x-1 hover:text-gray-700"
                    >
                      <span>CTR</span>
                      {sortBy === 'ctr' && (
                        sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('cpc')}
                      className="flex items-center space-x-1 hover:text-gray-700"
                    >
                      <span>CPC</span>
                      {sortBy === 'cpc' && (
                        sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('date_range_start')}
                      className="flex items-center space-x-1 hover:text-gray-700"
                    >
                      <span>Date Range</span>
                      {sortBy === 'date_range_start' && (
                        sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
                      )}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedCampaigns.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No campaigns found</h3>
                      <p className="text-gray-600">
                        {campaigns.length === 0 
                          ? "You don't have any campaigns yet. Generate a report to see campaign data."
                          : "No campaigns match your current filters."
                        }
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedCampaigns.map((campaign) => (
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>
                          <div>{new Date(campaign.date_range_start).toLocaleDateString()}</div>
                          <div className="text-gray-500">to {new Date(campaign.date_range_end).toLocaleDateString()}</div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">Average CTR</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.averageCtr.toFixed(2)}%</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Average CPC</p>
              <p className="text-2xl font-semibold text-gray-900">${stats.averageCpc.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Average CPA</p>
              <p className="text-2xl font-semibold text-gray-900">${stats.averageCpa.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Total Conversions</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalConversions.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 