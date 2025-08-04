'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Shield, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  RefreshCw,
  ArrowLeft,
  Activity,
  Calendar
} from 'lucide-react';
import { useAuth } from '../../../components/AuthProvider';
import { supabase } from '../../../lib/supabase';
import LoadingSpinner from '../../../components/LoadingSpinner';

interface TokenHealth {
  id: string;
  name: string;
  email: string;
  token_health_status: string;
  token_expires_at: string | null;
  last_token_validation: string | null;
  token_refresh_count: number;
  api_status: string;
  daysUntilExpiry: number;
  needsAttention: boolean;
}

export default function TokenHealthPage() {
  const [tokenHealth, setTokenHealth] = useState<TokenHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    healthy: 0,
    expiringSoon: 0,
    expired: 0,
    invalid: 0
  });
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/auth/login');
      return;
    }

    if (profile?.role !== 'admin') {
              router.push('/admin');
      return;
    }

    if (user && profile) {
      fetchTokenHealth();
    }
  }, [user, profile, authLoading, router]);

  const fetchTokenHealth = async () => {
    if (!user) return;

    try {
      const { data: clients, error } = await supabase
        .from('clients')
        .select('*')
        .eq('admin_id', user.id)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching clients:', error);
        throw error;
      }

      const healthData: TokenHealth[] = (clients || []).map(client => {
        const daysUntilExpiry = client.token_expires_at 
          ? Math.ceil((new Date(client.token_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : 999;

        const needsAttention = 
          client.token_health_status === 'expired' ||
          client.token_health_status === 'invalid' ||
          (client.token_health_status === 'expiring_soon' && daysUntilExpiry <= 7);

        return {
          id: client.id,
          name: client.name,
          email: client.email,
          token_health_status: client.token_health_status || 'unknown',
          token_expires_at: client.token_expires_at,
          last_token_validation: client.last_token_validation,
          token_refresh_count: client.token_refresh_count || 0,
          api_status: client.api_status || 'pending',
          daysUntilExpiry,
          needsAttention
        };
      });

      setTokenHealth(healthData);

      // Calculate stats
      const stats = {
        total: healthData.length,
        healthy: healthData.filter(h => h.token_health_status === 'valid').length,
        expiringSoon: healthData.filter(h => h.token_health_status === 'expiring_soon').length,
        expired: healthData.filter(h => h.token_health_status === 'expired').length,
        invalid: healthData.filter(h => h.token_health_status === 'invalid').length
      };

      setStats(stats);
    } catch (error) {
      console.error('Error fetching token health:', error);
      setTokenHealth([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshToken = async (clientId: string) => {
    setRefreshing(clientId);
    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      const response = await fetch(`/api/clients/${clientId}/refresh-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to refresh token');
      }

      // Refresh the token health data
      await fetchTokenHealth();
      alert('Token refreshed successfully!');
    } catch (error) {
      console.error('Error refreshing token:', error);
      alert('Failed to refresh token. Please try again.');
    } finally {
      setRefreshing(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'expiring_soon':
        return <Clock className="h-5 w-5 text-orange-500" />;
      case 'expired':
      case 'invalid':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'valid':
        return 'text-green-600 bg-green-100';
      case 'expiring_soon':
        return 'text-orange-600 bg-orange-100';
      case 'expired':
      case 'invalid':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'valid':
        return 'Healthy';
      case 'expiring_soon':
        return 'Expiring Soon';
      case 'expired':
        return 'Expired';
      case 'invalid':
        return 'Invalid';
      default:
        return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner text="Loading token health..." />
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
              <button
                onClick={() => router.push('/admin')}
                className="mr-4 p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <Shield className="h-8 w-8 text-primary-600" />
              <h1 className="ml-2 text-xl font-semibold text-gray-900">
                Token Health Dashboard
              </h1>
            </div>
            <button
              onClick={fetchTokenHealth}
              className="btn-secondary"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Tokens</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Healthy</p>
                <p className="text-2xl font-bold text-green-600">{stats.healthy}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Expiring Soon</p>
                <p className="text-2xl font-bold text-orange-600">{stats.expiringSoon}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Expired</p>
                <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Shield className="h-6 w-6 text-gray-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Invalid</p>
                <p className="text-2xl font-bold text-gray-600">{stats.invalid}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Token Health Table */}
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Token Status Overview</h2>
            <p className="text-sm text-gray-600 mt-1">
              Monitor and manage your clients&apos; Meta API token health
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Token Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expires
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Validated
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Refresh Count
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tokenHealth.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      <Shield className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-lg font-medium">No clients found</p>
                      <p className="text-sm">Token health information will appear here once clients are added.</p>
                    </td>
                  </tr>
                ) : (
                  tokenHealth.map((health) => (
                    <tr key={health.id} className={health.needsAttention ? 'bg-red-50' : 'hover:bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{health.name}</div>
                          <div className="text-sm text-gray-500">{health.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getStatusIcon(health.token_health_status)}
                          <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(health.token_health_status)}`}>
                            {getStatusText(health.token_health_status)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {health.token_expires_at ? (
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                              {new Date(health.token_expires_at).toLocaleDateString()}
                              {health.daysUntilExpiry <= 30 && (
                                <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                                  health.daysUntilExpiry <= 7 
                                    ? 'bg-red-100 text-red-800' 
                                    : 'bg-orange-100 text-orange-800'
                                }`}>
                                  {health.daysUntilExpiry} days
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">No expiry date</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {health.last_token_validation ? (
                          new Date(health.last_token_validation).toLocaleDateString()
                        ) : (
                          <span className="text-gray-400">Never</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <RefreshCw className="h-4 w-4 mr-1 text-gray-400" />
                          {health.token_refresh_count}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => refreshToken(health.id)}
                          disabled={refreshing === health.id}
                          className="text-blue-600 hover:text-blue-900 p-1 disabled:opacity-50"
                          title="Refresh Token"
                        >
                          {refreshing === health.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Attention Required Section */}
        {tokenHealth.some(h => h.needsAttention) && (
          <div className="mt-8 bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center">
              <AlertCircle className="h-6 w-6 text-red-600 mr-3" />
              <h3 className="text-lg font-medium text-red-900">Attention Required</h3>
            </div>
            <p className="mt-2 text-red-700">
              Some tokens require immediate attention. Please review and refresh tokens that are expired, invalid, or expiring soon.
            </p>
            <div className="mt-4">
              <button
                onClick={() => {
                  const needsAttention = tokenHealth.filter(h => h.needsAttention);
                  alert(`${needsAttention.length} tokens need attention. Please refresh them individually.`);
                }}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
              >
                View Details
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
} 