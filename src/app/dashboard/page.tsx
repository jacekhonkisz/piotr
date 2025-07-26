'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Download,
  Plus,
  ChevronRight,
  Calendar,
  DollarSign,
  Target,
  LogOut
} from 'lucide-react';
import { useAuth } from '../../components/AuthProvider';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';

type Client = Database['public']['Tables']['clients']['Row'];
type Report = Database['public']['Tables']['reports']['Row'];

interface DashboardData {
  totalSpend: number;
  totalLeads: number;
  costPerLead: number;
  activeClients: number;
  recentReports: (Report & { client: Client })[];
  upcomingReports: Client[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const { user, profile, signOut } = useAuth();
  const router = useRouter();

  // Add timeout for loading
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        console.log('Loading timeout reached, showing fallback');
        setLoadingTimeout(true);
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    console.log('Dashboard useEffect - user:', user?.email, 'profile:', profile?.role, 'loading:', loading);
    
    if (!user) {
      console.log('No user, redirecting to login');
      router.push('/auth/login');
      return;
    }

    // If we have a user but no profile yet, wait for profile to load
    if (user && !profile && !loading) {
      console.log('User exists but no profile, waiting for profile...');
      return;
    }

    if (profile) {
      console.log('Profile loaded, fetching dashboard data');
      fetchDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, loading, router]);

  const fetchDashboardData = async () => {
    if (!user || !profile) return;

    console.log('Fetching dashboard data for:', user.email, 'role:', profile.role);

    try {
      if (profile.role === 'admin') {
        console.log('Fetching admin data...');
        // Admin view: aggregate data from all clients
        const { data: clients, error: clientsError } = await supabase
          .from('clients')
          .select('*')
          .eq('admin_id', user.id!);

        if (clientsError) {
          console.error('Error fetching clients:', clientsError);
          throw clientsError;
        }

        console.log('Clients fetched:', clients?.length || 0);

        // Get campaign data for all clients
        const clientIds = clients?.map(c => c.id) || [];
        const { data: campaigns, error: campaignsError } = await supabase
          .from('campaigns')
          .select('*')
          .in('client_id', clientIds)
          .gte('date_range_start', '2024-12-01')
          .lte('date_range_end', '2024-12-31');

        if (campaignsError) throw campaignsError;

        // Get recent reports
        const { data: reports, error: reportsError } = await supabase
          .from('reports')
          .select(`
            *,
            client:clients(*)
          `)
          .in('client_id', clientIds)
          .order('created_at', { ascending: false })
          .limit(5);

        if (reportsError) throw reportsError;

        // Calculate metrics
        const totalSpend = campaigns?.reduce((sum, campaign) => sum + Number(campaign.spend), 0) || 0;
        const totalLeads = campaigns?.reduce((sum, campaign) => sum + Number(campaign.conversions), 0) || 0;
        const costPerLead = totalLeads > 0 ? totalSpend / totalLeads : 0;

        setData({
          totalSpend,
          totalLeads,
          costPerLead,
          activeClients: clients?.length || 0,
          recentReports: reports as any || [],
          upcomingReports: clients?.slice(0, 4) || [],
        });

      } else {
        // Client view: show only their data
        const { data: clientRecord, error: clientError } = await supabase
          .from('clients')
          .select('*')
          .eq('email', user.email!)
          .single();

        if (clientError) throw clientError;

        const { data: campaigns, error: campaignsError } = await supabase
          .from('campaigns')
          .select('*')
          .eq('client_id', clientRecord.id)
          .gte('date_range_start', '2024-12-01')
          .lte('date_range_end', '2024-12-31');

        if (campaignsError) throw campaignsError;

        const { data: reports, error: reportsError } = await supabase
          .from('reports')
          .select(`
            *,
            client:clients(*)
          `)
          .eq('client_id', clientRecord.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (reportsError) throw reportsError;

        const totalSpend = campaigns?.reduce((sum, campaign) => sum + Number(campaign.spend), 0) || 0;
        const totalLeads = campaigns?.reduce((sum, campaign) => sum + Number(campaign.conversions), 0) || 0;
        const costPerLead = totalLeads > 0 ? totalSpend / totalLeads : 0;

        setData({
          totalSpend,
          totalLeads,
          costPerLead,
          activeClients: 1,
          recentReports: reports as any || [],
          upcomingReports: [clientRecord],
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Set empty data to prevent infinite loading
      setData({
        totalSpend: 0,
        totalLeads: 0,
        costPerLead: 0,
        activeClients: 0,
        recentReports: [],
        upcomingReports: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/auth/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (loadingTimeout) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Data not available
          </h2>
          <p className="text-gray-600">
            Could not load dashboard data within the expected time. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No data available</h2>
          <p className="text-gray-600">Unable to load dashboard data</p>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-primary-600" />
              <h1 className="ml-2 text-xl font-semibold text-gray-900">
                Meta Ads Reporting
                {profile?.role === 'admin' && (
                  <span className="ml-2 text-sm bg-primary-100 text-primary-800 px-2 py-1 rounded-full">
                    Admin
                  </span>
                )}
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              {profile?.role === 'admin' && (
                <>
                  <Link href="/admin/clients" className="btn-primary">
                    <Plus className="h-4 w-4 mr-2" />
                    Manage Clients
                  </Link>
                </>
              )}
              <div className="relative">
                <button className="flex items-center space-x-2 text-gray-700 hover:text-gray-900">
                  <div className="h-8 w-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-primary-600">
                      {profile?.full_name?.charAt(0) || profile?.email?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <button 
                onClick={handleSignOut}
                className="btn-secondary"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {profile?.full_name || profile?.email?.split('@')[0]}
          </h2>
          <p className="text-gray-600">
            {profile?.role === 'admin' 
              ? "Here's your Meta Ads reporting overview for all clients"
              : "Here's your Meta Ads reporting overview for this month"
            }
          </p>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Spend */}
          <div className="card card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Spend</p>
                <p className="text-3xl font-bold text-gray-900">{formatCurrency(data.totalSpend)}</p>
                <div className="flex items-center mt-2">
                  <TrendingUp className="h-4 w-4 text-success-600 mr-1" />
                  <span className="text-sm text-success-600 font-medium">Current Month</span>
                </div>
              </div>
              <DollarSign className="h-8 w-8 text-gray-400" />
            </div>
          </div>

          {/* Leads Generated */}
          <div className="card card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Leads Generated</p>
                <p className="text-3xl font-bold text-gray-900">{formatNumber(data.totalLeads)}</p>
                <div className="flex items-center mt-2">
                  <TrendingUp className="h-4 w-4 text-success-600 mr-1" />
                  <span className="text-sm text-success-600 font-medium">Conversions</span>
                </div>
              </div>
              <Target className="h-8 w-8 text-gray-400" />
            </div>
          </div>

          {/* Cost per Lead */}
          <div className="card card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Cost per Lead</p>
                <p className="text-3xl font-bold text-gray-900">{formatCurrency(data.costPerLead)}</p>
                <div className="flex items-center mt-2">
                  <span className="text-sm text-gray-500">Average CPA</span>
                </div>
              </div>
              <BarChart3 className="h-8 w-8 text-gray-400" />
            </div>
          </div>

          {/* Active Clients */}
          <div className="card card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">
                  {profile?.role === 'admin' ? 'Active Clients' : 'Account Status'}
                </p>
                <p className="text-3xl font-bold text-gray-900">
                  {profile?.role === 'admin' ? data.activeClients : 'Active'}
                </p>
                <div className="flex items-center mt-2">
                  <span className="text-sm text-gray-500">
                    {profile?.role === 'admin' ? 'Total managed' : 'Reporting enabled'}
                  </span>
                </div>
              </div>
              <Users className="h-8 w-8 text-gray-400" />
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent Reports */}
          <div className="lg:col-span-2">
            <div className="card">
              <div className="card-header">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Reports</h3>
                  <Link href="/reports" className="text-primary-600 hover:text-primary-500 text-sm font-medium">
                    View all
                  </Link>
                </div>
              </div>
              <div className="card-body p-0">
                {data.recentReports.length === 0 ? (
                  <div className="text-center py-12">
                    <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No reports yet</h3>
                    <p className="text-gray-600">Reports will appear here once generated</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {data.recentReports.map((report) => (
                      <div key={report.id} className="p-6 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center">
                              <h4 className="text-sm font-medium text-gray-900">
                                {profile?.role === 'admin' ? report.client.name : 'Your Report'}
                              </h4>
                              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">
                                sent
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              {new Date(report.date_range_start).toLocaleDateString()} - {new Date(report.date_range_end).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center space-x-3">
                            <button className="btn-secondary btn-sm">
                              <Download className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions & Upcoming */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
              </div>
              <div className="card-body">
                <div className="space-y-3">
                  {profile?.role === 'admin' ? (
                    <>
                      <Link href="/admin/clients" className="w-full btn-primary text-left flex items-center justify-between">
                        <span>Manage Clients</span>
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                      <button className="w-full btn-secondary text-left flex items-center justify-between">
                        <span>Generate Reports</span>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="w-full btn-primary text-left flex items-center justify-between">
                        <span>Download Report</span>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <button className="w-full btn-secondary text-left flex items-center justify-between">
                        <span>View Campaign Details</span>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  <button className="w-full btn-secondary text-left flex items-center justify-between">
                    <span>Account Settings</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Next Actions */}
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-gray-900">
                  {profile?.role === 'admin' ? 'Client Reports' : 'Next Report'}
                </h3>
              </div>
              <div className="card-body">
                <div className="space-y-4">
                  {data.upcomingReports.map((client) => (
                    <div key={client.id} className="flex items-center">
                      <Calendar className="h-4 w-4 text-gray-400 mr-3" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {profile?.role === 'admin' ? client.name : 'Monthly Report'}
                        </p>
                        <p className="text-xs text-gray-500">Next: Jan 1, 2025</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 