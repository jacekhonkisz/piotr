'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  BarChart3, 
  Plus, 
  Users, 
  Settings,
  Eye,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock,
  X
} from 'lucide-react';
import { useAuth } from '../../../components/AuthProvider';
import { supabase } from '../../../lib/supabase';
import MetaAPIService from '../../../lib/meta-api';
import type { Database } from '../../../lib/database.types';

type Client = Database['public']['Tables']['clients']['Row'];

export default function AdminClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newClient, setNewClient] = useState({
    name: '',
    email: '',
    company: '',
    meta_access_token: '',
    ad_account_id: '',
    reporting_frequency: 'monthly' as const,
  });
  const [validationLoading, setValidationLoading] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; error?: string } | null>(null);
  const [availableAdAccounts, setAvailableAdAccounts] = useState<any[]>([]);

  const { user, profile } = useAuth();
  const router = useRouter();

  // Redirect if not admin
  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [profile, router]);

  // Fetch clients
  useEffect(() => {
    if (user && profile?.role === 'admin') {
      fetchClients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile]);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('admin_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateMetaToken = async () => {
    if (!newClient.meta_access_token) {
      setValidationResult({ valid: false, error: 'Access token is required' });
      return;
    }

    setValidationLoading(true);
    setValidationResult(null);
    setAvailableAdAccounts([]);

    try {
      const metaAPI = new MetaAPIService(newClient.meta_access_token);
      const validation = await metaAPI.validateToken();
      
      if (validation.valid) {
        const adAccounts = await metaAPI.getAdAccounts();
        setAvailableAdAccounts(adAccounts);
        setValidationResult({ valid: true });
      } else {
        setValidationResult(validation);
      }
    } catch (error) {
      setValidationResult({ valid: false, error: 'Failed to validate token' });
    } finally {
      setValidationLoading(false);
    }
  };

  const addClient = async () => {
    if (!user || !validationResult?.valid) return;

    try {
      const { error } = await supabase
        .from('clients')
        .insert({
          admin_id: user.id!,
          name: newClient.name,
          email: newClient.email,
          company: newClient.company,
          meta_access_token: newClient.meta_access_token,
          ad_account_id: newClient.ad_account_id,
          reporting_frequency: newClient.reporting_frequency,
          api_status: 'valid',
        });

      if (error) throw error;

      setShowAddModal(false);
      setNewClient({
        name: '',
        email: '',
        company: '',
        meta_access_token: '',
        ad_account_id: '',
        reporting_frequency: 'monthly',
      });
      setValidationResult(null);
      setAvailableAdAccounts([]);
      fetchClients();
    } catch (error) {
      console.error('Error adding client:', error);
    }
  };

  const deleteClient = async (clientId: string) => {
    if (!confirm('Are you sure you want to delete this client? This will also delete all their reports.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);

      if (error) throw error;
      fetchClients();
    } catch (error) {
      console.error('Error deleting client:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid':
        return <CheckCircle className="h-4 w-4 text-success-600" />;
      case 'invalid':
      case 'expired':
        return <AlertCircle className="h-4 w-4 text-error-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-warning-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
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
              <h1 className="ml-2 text-xl font-semibold text-gray-900">
                Meta Ads Reporting - Admin
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => setShowAddModal(true)}
                className="btn-primary"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Client
              </button>
              <div className="h-8 w-8 bg-gray-300 rounded-full"></div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Client Management
          </h2>
          <p className="text-gray-600">
            Manage your clients and their Meta Ads API access
          </p>
        </div>

        {/* Clients List */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Clients ({clients.length})
              </h3>
            </div>
          </div>
          <div className="card-body p-0">
            {clients.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No clients yet</h3>
                <p className="text-gray-600 mb-6">Add your first client to start generating reports</p>
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="btn-primary"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Client
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {clients.map((client) => (
                  <div key={client.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <h4 className="text-lg font-medium text-gray-900">{client.name}</h4>
                          <div className="ml-2 flex items-center">
                            {getStatusIcon(client.api_status)}
                            <span className={`ml-1 text-sm font-medium ${
                              client.api_status === 'valid' ? 'text-success-600' :
                              client.api_status === 'invalid' || client.api_status === 'expired' ? 'text-error-600' :
                              'text-warning-600'
                            }`}>
                              {client.api_status}
                            </span>
                          </div>
                        </div>
                        <p className="text-gray-600 mt-1">{client.email}</p>
                        {client.company && (
                          <p className="text-sm text-gray-500 mt-1">{client.company}</p>
                        )}
                        <div className="flex items-center mt-2 text-sm text-gray-500">
                          <span>Reports: {client.reporting_frequency}</span>
                          <span className="mx-2">•</span>
                          <span>Account: {client.ad_account_id}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <button className="btn-secondary btn-sm">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button className="btn-secondary btn-sm">
                          <Settings className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => deleteClient(client.id)}
                          className="btn-danger btn-sm"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add Client Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Add New Client</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="form-label">Client Name</label>
                <input
                  type="text"
                  value={newClient.name}
                  onChange={(e) => setNewClient(prev => ({ ...prev, name: e.target.value }))}
                  className="form-input"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="form-label">Email</label>
                <input
                  type="email"
                  value={newClient.email}
                  onChange={(e) => setNewClient(prev => ({ ...prev, email: e.target.value }))}
                  className="form-input"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label className="form-label">Company (Optional)</label>
                <input
                  type="text"
                  value={newClient.company}
                  onChange={(e) => setNewClient(prev => ({ ...prev, company: e.target.value }))}
                  className="form-input"
                  placeholder="Company Name"
                />
              </div>

              <div>
                <label className="form-label">Meta Access Token</label>
                <textarea
                  value={newClient.meta_access_token}
                  onChange={(e) => setNewClient(prev => ({ ...prev, meta_access_token: e.target.value }))}
                  className="form-input h-20 resize-none"
                  placeholder="Paste Meta Business API access token here..."
                />
                <button
                  onClick={validateMetaToken}
                  disabled={validationLoading || !newClient.meta_access_token}
                  className="btn-secondary btn-sm mt-2"
                >
                  {validationLoading ? 'Validating...' : 'Validate Token'}
                </button>
              </div>

              {validationResult && (
                <div className={`p-3 rounded-md ${
                  validationResult.valid ? 'bg-success-50 text-success-800' : 'bg-error-50 text-error-800'
                }`}>
                  <div className="flex">
                    {validationResult.valid ? (
                      <CheckCircle className="h-5 w-5 text-success-400 mr-2" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-error-400 mr-2" />
                    )}
                    <p className="text-sm">
                      {validationResult.valid ? 'Token is valid!' : validationResult.error}
                    </p>
                  </div>
                </div>
              )}

              {availableAdAccounts.length > 0 && (
                <div>
                  <label className="form-label">Ad Account</label>
                  <select
                    value={newClient.ad_account_id}
                    onChange={(e) => setNewClient(prev => ({ ...prev, ad_account_id: e.target.value }))}
                    className="form-input"
                  >
                    <option value="">Select an ad account</option>
                    {availableAdAccounts.map((account) => (
                      <option key={account.id} value={account.account_id}>
                        {account.name} ({account.account_id})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="form-label">Reporting Frequency</label>
                <select
                  value={newClient.reporting_frequency}
                  onChange={(e) => setNewClient(prev => ({ ...prev, reporting_frequency: e.target.value as any }))}
                  className="form-input"
                >
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="on_demand">On Demand</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
              <button 
                onClick={() => setShowAddModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button 
                onClick={addClient}
                disabled={!validationResult?.valid || !newClient.name || !newClient.email || !newClient.ad_account_id}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Client
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 