'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Eye, 
  Download,
  Calendar,
  Target,
  Activity,
  RefreshCw,
  FileText,
  Building,
  Mail,
  Clock,
  AlertCircle,
  LogOut
} from 'lucide-react';
import { useAuth } from '../../components/AuthProvider';
import { supabase } from '../../lib/supabase';
import { getAdminDashboardStats, getClientDashboardData } from '../../lib/database';
import type { Database } from '../../lib/database.types';
import LoadingSpinner from '../../components/LoadingSpinner';

type Client = Database['public']['Tables']['clients']['Row'];
type Report = Database['public']['Tables']['reports']['Row'];
type Campaign = Database['public']['Tables']['campaigns']['Row'];

interface DashboardStats {
  totalClients?: number;
  totalReports?: number;
  activeClients?: number;
  totalSpend?: number;
}

interface ClientDashboardData {
  client: Client;
  reports: Report[];
  campaigns: Campaign[];
  stats: {
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    averageCtr: number;
    averageCpc: number;
  };
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [adminStats, setAdminStats] = useState<DashboardStats>({});
  const [clientData, setClientData] = useState<ClientDashboardData | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const { user, profile, authLoading, signOut } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/auth/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  useEffect(() => {
    console.log('Dashboard useEffect triggered:', { 
      user: user?.email, 
      profile: profile?.role, 
      loading: authLoading, 
      hasUser: !!user, 
      hasProfile: !!profile 
    });

    // Don't do anything while auth is still loading
    if (authLoading) {
      console.log('Auth still loading, waiting...');
      return;
    }

    // Redirect to login if no user
    if (!user) {
      console.log('No user and auth not loading, redirecting to login');
      router.replace('/auth/login');
      return;
    }

    // Wait for profile to load if user exists but profile doesn't
    if (user && !profile) {
      console.log('User exists but no profile, waiting for profile...');
      // Set a timeout to prevent infinite waiting
      const profileTimeout = setTimeout(() => {
        console.log('Profile loading timeout, redirecting to login');
        router.replace('/auth/login');
      }, 10000); // 10 second timeout

      return () => clearTimeout(profileTimeout);
    }

    // Load dashboard data if user and profile are available
    if (user && profile) {
      console.log('User and profile loaded, loading dashboard for role:', profile.role);
      if (profile.role === 'admin') {
        loadAdminDashboard();
      } else {
        loadClientDashboard();
      }
    }
  }, [user, profile, authLoading, router]);

  const loadAdminDashboard = async () => {
    try {
      setLoading(true);
      console.log('Loading admin dashboard for user:', user!.id);
      const stats = await getAdminDashboardStats(user!.id);
      console.log('Admin dashboard stats loaded:', stats);
      setAdminStats(stats);
    } catch (error) {
      console.error('Error loading admin dashboard:', error);
      // You could add a toast notification here
    } finally {
      setLoading(false);
    }
  };

  const loadClientDashboard = async () => {
    try {
      setLoading(true);
      
      console.log('Loading client dashboard for user:', user!.email);
      
      // Get client data first
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('email', user!.email || '')
        .single();

      if (clientError || !clientData) {
        console.error('Client not found:', clientError);
        return;
      }

      console.log('Client data found:', clientData.id);

      // Use optimized database function
      const dashboardData = await getClientDashboardData(clientData.id);
      console.log('Dashboard data loaded:', {
        reportsCount: dashboardData.reports.length,
        campaignsCount: dashboardData.campaigns.length
      });

      // Calculate stats efficiently
      const stats = dashboardData.campaigns.reduce((acc, campaign) => {
        acc.totalSpend += campaign.spend || 0;
        acc.totalImpressions += campaign.impressions || 0;
        acc.totalClicks += campaign.clicks || 0;
        acc.totalConversions += campaign.conversions || 0;
        return acc;
      }, {
        totalSpend: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalConversions: 0
      });

      const averageCtr = stats.totalImpressions > 0 ? (stats.totalClicks / stats.totalImpressions) * 100 : 0;
      const averageCpc = stats.totalClicks > 0 ? stats.totalSpend / stats.totalClicks : 0;

      setClientData({
        client: dashboardData.client,
        reports: dashboardData.reports.slice(0, 10), // Limit to 10 most recent
        campaigns: dashboardData.campaigns.slice(0, 50), // Limit to 50 most recent
        stats: {
          ...stats,
          averageCtr,
          averageCpc
        }
      });
    } catch (error) {
      console.error('Error loading client dashboard:', error);
      // You could add a toast notification here
    } finally {
      setLoading(false);
    }
  };

  const generateNewReport = async () => {
    if (!clientData) return;

    setGeneratingReport(true);
    try {
      const response = await fetch('/api/generate-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRange: {
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            end: new Date().toISOString().split('T')[0]
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate report');
      }

      const result = await response.json();
      console.log('Report generated:', result);
      
      // Reload dashboard data
      await loadClientDashboard();
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setGeneratingReport(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner text="Loading dashboard..." />
      </div>
    );
  }

  if (profile?.role === 'admin') {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center">
                <BarChart3 className="h-8 w-8 text-primary-600" />
                <h1 className="ml-2 text-xl font-semibold text-gray-900">
                  Admin Dashboard
                </h1>
              </div>
              <div className="flex items-center">
                <button
                  onClick={() => router.push('/admin')}
                  className="btn-primary"
                >
                  Manage Clients
                </button>
                <button
                  onClick={handleLogout}
                  className="ml-2 btn-secondary"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Log Out
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Clients</p>
                  <p className="text-2xl font-semibold text-gray-900">{adminStats.totalClients}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <FileText className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Reports</p>
                  <p className="text-2xl font-semibold text-gray-900">{adminStats.totalReports}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Activity className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Clients</p>
                  <p className="text-2xl font-semibold text-gray-900">{adminStats.activeClients}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Spend</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    ${adminStats.totalSpend?.toLocaleString() || '0'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => router.push('/admin')}
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <Users className="h-5 w-5 text-blue-600 mr-3" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">Manage Clients</p>
                  <p className="text-sm text-gray-600">Add, edit, or remove clients</p>
                </div>
              </button>

              <button
                onClick={() => router.push('/admin/reports')}
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <FileText className="h-5 w-5 text-green-600 mr-3" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">View Reports</p>
                  <p className="text-sm text-gray-600">Browse all client reports</p>
                </div>
              </button>

              <button
                onClick={() => router.push('/admin/settings')}
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <BarChart3 className="h-5 w-5 text-purple-600 mr-3" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">System Settings</p>
                  <p className="text-sm text-gray-600">Configure system preferences</p>
                </div>
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Client Dashboard
  if (!clientData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Client not found</h3>
          <p className="text-gray-600">Please contact your administrator.</p>
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
                  {clientData.client.name} Dashboard
                </h1>
                <p className="text-sm text-gray-600">Meta Ads Performance Reports</p>
              </div>
            </div>
            <div className="flex items-center">
              <button
                onClick={generateNewReport}
                disabled={generatingReport}
                className="btn-primary"
              >
                {generatingReport ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Report
                  </>
                )}
              </button>
              <button
                onClick={handleLogout}
                className="ml-2 btn-secondary"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Log Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Client Info */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="h-12 w-12 bg-primary-100 rounded-full flex items-center justify-center">
                <Building className="h-6 w-6 text-primary-600" />
              </div>
              <div className="ml-4">
                <h2 className="text-lg font-semibold text-gray-900">{clientData.client.name}</h2>
                <div className="flex items-center text-sm text-gray-600">
                  <Mail className="h-4 w-4 mr-1" />
                  {clientData.client.email}
                </div>
                {clientData.client.company && (
                  <div className="text-sm text-gray-500">{clientData.client.company}</div>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Last Report</div>
              <div className="text-lg font-semibold text-gray-900">
                {clientData.client.last_report_date ? 
                  new Date(clientData.client.last_report_date).toLocaleDateString() : 
                  'No reports yet'
                }
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Spend</p>
                <p className="text-2xl font-semibold text-gray-900">
                  ${clientData.stats.totalSpend.toLocaleString()}
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
                  {clientData.stats.totalImpressions.toLocaleString()}
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
                  {clientData.stats.totalClicks.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">CTR</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {clientData.stats.averageCtr.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Reports */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Reports</h2>
            <button
              onClick={() => router.push('/reports')}
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              View All
            </button>
          </div>
          
          {clientData.reports.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No reports yet</h3>
              <p className="text-gray-600 mb-4">Generate your first report to see performance data.</p>
              <button
                onClick={generateNewReport}
                disabled={generatingReport}
                className="btn-primary"
              >
                {generatingReport ? 'Generating...' : 'Generate First Report'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {clientData.reports.slice(0, 5).map((report) => (
                <div key={report.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center">
                    <Calendar className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {new Date(report.date_range_start).toLocaleDateString()} - {new Date(report.date_range_end).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-600">
                        Generated {new Date(report.generated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => router.push(`/reports/${report.id}`)}
                      className="text-primary-600 hover:text-primary-700 p-1"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button className="text-gray-600 hover:text-gray-700 p-1">
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Campaigns */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Campaigns</h2>
            <button
              onClick={() => router.push('/campaigns')}
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              View All
            </button>
          </div>
          
          {clientData.campaigns.length === 0 ? (
            <div className="text-center py-8">
              <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No campaigns found</h3>
              <p className="text-gray-600">Campaign data will appear here once reports are generated.</p>
            </div>
          ) : (
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
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {clientData.campaigns.slice(0, 5).map((campaign) => (
                    <tr key={campaign.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{campaign.campaign_name}</div>
                        <div className="text-sm text-gray-500">{campaign.campaign_id}</div>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 