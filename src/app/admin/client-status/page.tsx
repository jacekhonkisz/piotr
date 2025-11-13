'use client';

import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Search,
  Eye,
  Settings,
  TrendingUp,
  Database,
  Clock
} from 'lucide-react';
import DataFreshnessIndicator from '../../../components/DataFreshnessIndicator';
import { AdminLoading } from '../../../components/LoadingSpinner';

interface ClientStatus {
  id: string;
  name: string;
  email: string;
  credentials: {
    meta: {
      hasToken: boolean;
      hasAdAccount: boolean;
      tokenValid: boolean;
      accountValid: boolean;
      error: string | null;
    };
    googleAds: {
      enabled: boolean;
      hasCustomerId: boolean;
      systemCredentialsAvailable: boolean;
    };
  };
  dataComparison: {
    cache: {
      exists: boolean;
      ageHours: number | null;
      totalSpend: number;
      lastUpdated: string | null;
    };
    live: {
      success: boolean;
      totalSpend: number;
      campaignCount: number;
      fetchTime: number | null;
      error: string | null;
    };
    comparison: {
      spendDifference: number | null;
      percentageDifference: number | null;
      status: string;
    };
  };
  issues: string[];
  recommendations: string[];
  overallStatus: 'healthy' | 'warning' | 'critical';
}

export default function ClientStatusDashboard() {
  const [clients, setClients] = useState<ClientStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientStatus | null>(null);
  const [verifyingClient, setVerifyingClient] = useState<string | null>(null);

  useEffect(() => {
    loadClientStatuses();
  }, []);

  const loadClientStatuses = async () => {
    setLoading(true);
    try {
      // This would typically call your API to get all client statuses
      // For now, we'll simulate with some sample data
      const response = await fetch('/api/admin/client-statuses');
      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
      }
    } catch (error) {
      console.error('Failed to load client statuses:', error);
    } finally {
      setLoading(false);
    }
  };

  const verifyClientData = async (clientId: string, clientName: string) => {
    setVerifyingClient(clientId);
    try {
      const response = await fetch('/api/admin/verify-client-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId,
          forceLive: true
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update the client in the list with new verification data
        setClients(prev => prev.map(client => 
          client.id === clientId 
            ? { ...client, ...data.verification, overallStatus: calculateOverallStatus(data.verification) }
            : client
        ));
      }
    } catch (error) {
      console.error('Failed to verify client data:', error);
    } finally {
      setVerifyingClient(null);
    }
  };

  const calculateOverallStatus = (verification: any): 'healthy' | 'warning' | 'critical' => {
    const { credentials, dataComparison, issues } = verification;
    
    // Critical issues
    if (!credentials.meta.tokenValid || !credentials.meta.accountValid) {
      return 'critical';
    }
    
    if (dataComparison.comparison.status === 'SIGNIFICANT_DIFFERENCE') {
      return 'critical';
    }
    
    // Warning issues
    if (issues.length > 0) {
      return 'warning';
    }
    
    if (dataComparison.cache.ageHours > 6) {
      return 'warning';
    }
    
    return 'healthy';
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusIcon = (status: 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'critical':
        return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusColor = (status: 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'healthy':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'critical':
        return 'bg-red-50 border-red-200';
    }
  };

  if (loading) {
    return <AdminLoading text="Ładowanie statusu klientów..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Client Status Dashboard
          </h1>
          <p className="text-gray-600">
            Monitor client data integrity, API credentials, and system health
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {clients.filter(c => c.overallStatus === 'healthy').length}
                </div>
                <div className="text-sm text-gray-600">Healthy Clients</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {clients.filter(c => c.overallStatus === 'warning').length}
                </div>
                <div className="text-sm text-gray-600">Need Attention</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <div className="flex items-center gap-3">
              <XCircle className="w-8 h-8 text-red-500" />
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {clients.filter(c => c.overallStatus === 'critical').length}
                </div>
                <div className="text-sm text-gray-600">Critical Issues</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <div className="flex items-center gap-3">
              <Database className="w-8 h-8 text-blue-500" />
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {clients.length}
                </div>
                <div className="text-sm text-gray-600">Total Clients</div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Controls */}
        <div className="bg-white rounded-lg p-6 shadow-sm border mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search clients by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={loadClientStatuses}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh All
            </button>
          </div>
        </div>

        {/* Client List */}
        <div className="space-y-4">
          {filteredClients.map((client) => (
            <div
              key={client.id}
              className={`bg-white rounded-lg border-2 shadow-sm ${getStatusColor(client.overallStatus)}`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    {getStatusIcon(client.overallStatus)}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {client.name}
                      </h3>
                      <p className="text-gray-600">{client.email}</p>
                      
                      {/* Data Freshness */}
                      <div className="mt-2">
                        <DataFreshnessIndicator
                          lastUpdated={client.dataComparison.cache.lastUpdated}
                          onRefresh={() => verifyClientData(client.id, client.name)}
                          isLoading={verifyingClient === client.id}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => verifyClientData(client.id, client.name)}
                      disabled={verifyingClient === client.id}
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50 flex items-center gap-1"
                    >
                      <RefreshCw className={`w-4 h-4 ${verifyingClient === client.id ? 'animate-spin' : ''}`} />
                      Verify
                    </button>
                    <button
                      onClick={() => setSelectedClient(client)}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      Details
                    </button>
                  </div>
                </div>

                {/* Quick Status Overview */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Meta API:</span>
                    {client.credentials.meta.tokenValid && client.credentials.meta.accountValid ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Cache:</span>
                    {client.dataComparison.cache.exists ? (
                      client.dataComparison.cache.ageHours! < 6 ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      )
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Data Accuracy:</span>
                    {client.dataComparison.comparison.status === 'ACCURATE' ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : client.dataComparison.comparison.status === 'MINOR_DIFFERENCE' ? (
                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                </div>

                {/* Issues Summary */}
                {client.issues.length > 0 && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <span className="text-sm font-medium text-red-700">
                        {client.issues.length} Issue{client.issues.length > 1 ? 's' : ''} Found
                      </span>
                    </div>
                    <ul className="text-sm text-red-600 space-y-1">
                      {client.issues.slice(0, 2).map((issue, index) => (
                        <li key={index}>• {issue}</li>
                      ))}
                      {client.issues.length > 2 && (
                        <li className="text-red-500">• +{client.issues.length - 2} more issues</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {filteredClients.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No clients found</h3>
            <p className="text-gray-600">
              {searchTerm ? 'Try adjusting your search terms' : 'No clients available'}
            </p>
          </div>
        )}
      </div>

      {/* Client Details Modal */}
      {selectedClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedClient.name} - Detailed Status
                </h2>
                <button
                  onClick={() => setSelectedClient(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Detailed status content would go here */}
              <div className="text-gray-600">
                Detailed client verification results and recommendations would be displayed here.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
