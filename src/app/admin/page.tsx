'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  BarChart3, 
  Plus,
  Trash2,
  Eye,
  RefreshCw,
  FileText,
  Mail,
  Building,
  AlertCircle,
  CheckCircle,
  Clock,
  X,
  Key,
  UserPlus,
  Send,
  LogOut
} from 'lucide-react';
import { useAuth } from '../../components/AuthProvider';
import { supabase } from '../../lib/supabase';
import { MetaAPIService } from '../../lib/meta-api';
import type { Database } from '../../lib/database.types';
import LoadingSpinner from '../../components/LoadingSpinner';
import CredentialsModal from '../../components/CredentialsModal';

type Client = Database['public']['Tables']['clients']['Row'];

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (client: Partial<Client>) => Promise<void>;
}

function AddClientModal({ isOpen, onClose, onAdd }: AddClientModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    ad_account_id: '',
    meta_access_token: '',
    reporting_frequency: 'monthly' as const,
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<{
    status: 'idle' | 'validating' | 'valid' | 'invalid';
    message: string;
  }>({ status: 'idle', message: '' });
  const [submitError, setSubmitError] = useState<string>('');

  const validateMetaCredentials = async () => {
    if (!formData.ad_account_id || !formData.meta_access_token) {
      setValidationStatus({ status: 'invalid', message: 'Please fill in both Ad Account ID and Access Token' });
      return;
    }

    setValidating(true);
    setValidationStatus({ status: 'validating', message: 'Validating and converting Meta Ads credentials...' });

    try {
      const metaService = new MetaAPIService(formData.meta_access_token);
      
      // Step 1: Validate and convert the access token to long-lived
      const tokenValidation = await metaService.validateAndConvertToken();
      
      if (!tokenValidation.valid) {
        setValidationStatus({ 
          status: 'invalid', 
          message: `Token validation failed: ${tokenValidation.error}` 
        });
        return;
      }

      // Step 2: Validate the specific ad account ID
      const accountValidation = await metaService.validateAdAccount(formData.ad_account_id);
      
      if (!accountValidation.valid) {
        setValidationStatus({ 
          status: 'invalid', 
          message: `Ad Account validation failed: ${accountValidation.error}` 
        });
        return;
      }

      // Step 3: Test campaign access (optional but good to verify)
      try {
        const campaigns = await metaService.getCampaigns(formData.ad_account_id.replace('act_', ''));
        
        let statusMessage = `✅ Credentials valid! Account: ${accountValidation.account?.name || formData.ad_account_id}. Found ${campaigns.length} campaigns.`;
        
        if (tokenValidation.convertedToken) {
          statusMessage += ' 🔄 Token will be automatically converted to long-lived for permanent access.';
        } else if (tokenValidation.isLongLived) {
          statusMessage += ' ✅ Token is already long-lived (permanent).';
        }
        
        setValidationStatus({ 
          status: 'valid', 
          message: statusMessage
        });
      } catch (campaignError) {
        // Campaign fetch failed, but credentials are still valid
        let statusMessage = `✅ Credentials valid! Account: ${accountValidation.account?.name || formData.ad_account_id}.`;
        
        if (tokenValidation.convertedToken) {
          statusMessage += ' 🔄 Token will be automatically converted to long-lived for permanent access.';
        } else if (tokenValidation.isLongLived) {
          statusMessage += ' ✅ Token is already long-lived (permanent).';
        }
        
        setValidationStatus({ 
          status: 'valid', 
          message: `✅ Credentials valid! Account: ${accountValidation.account?.name || formData.ad_account_id}. Campaign access may be limited.` 
        });
      }

    } catch (error) {
      setValidationStatus({ 
        status: 'invalid', 
        message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setSubmitError('');
    
    if (validationStatus.status !== 'valid') {
      setValidationStatus({ status: 'invalid', message: 'Please validate your Meta Ads credentials first' });
      return;
    }

    setLoading(true);
    try {
      await onAdd(formData);
      setFormData({
        name: '',
        email: '',
        company: '',
        ad_account_id: '',
        meta_access_token: '',
        reporting_frequency: 'monthly',
        notes: ''
      });
      setValidationStatus({ status: 'idle', message: '' });
      setSubmitError('');
      onClose();
    } catch (error) {
      console.error('Error adding client:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to add client. Please try again.';
      setSubmitError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Add New Client</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Enter company name"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contact Email *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="contact@company.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meta Ad Account ID *
            </label>
            <input
              type="text"
              required
              value={formData.ad_account_id}
              onChange={(e) => setFormData({...formData, ad_account_id: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="act_123456789"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meta Access Token *
            </label>
            <input
              type="password"
              required
              value={formData.meta_access_token}
              onChange={(e) => setFormData({...formData, meta_access_token: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Enter Meta access token"
            />
          </div>

          {/* Validation Section */}
          <div className="bg-gray-50 p-3 rounded-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Meta Ads Credentials</span>
              <button
                type="button"
                onClick={validateMetaCredentials}
                disabled={validating || !formData.ad_account_id || !formData.meta_access_token}
                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {validating ? 'Validating...' : 'Validate'}
              </button>
            </div>
            
            {validationStatus.status !== 'idle' && (
              <div className={`text-sm p-2 rounded ${
                validationStatus.status === 'valid' ? 'bg-green-100 text-green-800' :
                validationStatus.status === 'invalid' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {validationStatus.message}
              </div>
            )}
          </div>
          
          {/* Submit Error Display */}
          {submitError && (
            <div className="bg-red-100 text-red-800 text-sm p-3 rounded-md">
              <div className="flex items-center">
                <AlertCircle className="h-4 w-4 mr-2" />
                {submitError}
              </div>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reporting Frequency
            </label>
            <select
              value={formData.reporting_frequency}
              onChange={(e) => setFormData({...formData, reporting_frequency: e.target.value as any})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="on_demand">On Demand</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={3}
              placeholder="Optional notes about this client"
            />
          </div>
          
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || validationStatus.status !== 'valid'}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [generatingCredentials, setGeneratingCredentials] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  const [credentialsModal, setCredentialsModal] = useState<{
    isOpen: boolean;
    credentials: { username: string; password: string } | null;
    clientName: string;
    clientEmail: string;
  }>({
    isOpen: false,
    credentials: null,
    clientName: '',
    clientEmail: ''
  });
  const { user, profile, loading: authLoading, signOut } = useAuth();
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
    // Don't do anything while auth is still loading
    if (authLoading) {
      return;
    }

    // Redirect to login if no user
    if (!user) {
      router.push('/auth/login');
      return;
    }

    // Redirect if not admin
    if (profile?.role !== 'admin') {
      router.push('/dashboard');
      return;
    }

    // Load clients if user and profile are available
    if (user && profile) {
      fetchClients();
    } else {
      // If we don't have user/profile but auth is not loading, stop loading
      setLoading(false);
    }
  }, [user, profile, authLoading, router]);

  const fetchClients = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      console.log('Fetching clients for user:', user.id);
      const { data: clientsData, error } = await supabase
        .from('clients')
        .select('*')
        .eq('admin_id', user.id)
        .order('name', { ascending: true });

      if (error) {
        console.error('Supabase error fetching clients:', error);
        throw error;
      }
      
      console.log('Clients fetched successfully:', clientsData?.length || 0, 'clients');
      setClients(clientsData || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
      // Set empty array on error to prevent infinite loading
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  const generateSecurePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const generateUsername = (email: string) => {
    return email; // Use email as username
  };

  const addClient = async (clientData: Partial<Client>) => {
    if (!user) return;

    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      // Use the server-side API endpoint
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(clientData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add client');
      }

      const result = await response.json();
      
      // Show credentials modal to admin
      if (result.credentials) {
        setCredentialsModal({
          isOpen: true,
          credentials: result.credentials,
          clientName: clientData.name || '',
          clientEmail: clientData.email || ''
        });
      }

      await fetchClients();
    } catch (error) {
      console.error('Error adding client:', error);
      throw error;
    }
  };

  const regenerateCredentials = async (clientId: string) => {
    setGeneratingCredentials(clientId);
    try {
      const client = clients.find(c => c.id === clientId);
      if (!client) return;

      const newPassword = generateSecurePassword();
      const newUsername = generateUsername(client.email);

      // Update client user password
      const { error: authError } = await supabase.auth.admin.updateUserById(
        client.id, // This should be the user ID, not client ID - we need to fix this
        { password: newPassword }
      );

      if (authError) throw authError;

      // Update client record
      const { error: clientError } = await supabase
        .from('clients')
        .update({
          generated_password: newPassword,
          generated_username: newUsername,
          credentials_generated_at: new Date().toISOString()
        })
        .eq('id', clientId);

      if (clientError) throw clientError;

      await fetchClients();
    } catch (error) {
      console.error('Error regenerating credentials:', error);
    } finally {
      setGeneratingCredentials(null);
    }
  };

  const generateReport = async (clientId: string) => {
    setGeneratingReport(clientId);
    try {
      const client = clients.find(c => c.id === clientId);
      if (!client) return;

      const metaService = new MetaAPIService(client.meta_access_token);
      
      // Generate report for last 30 days
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      await metaService.generateClientReport(
        client.ad_account_id.replace('act_', ''),
        startDate || '',
        endDate || ''
      );

      // Store report in database
      const { error: reportError } = await supabase
        .from('reports')
        .insert({
          client_id: clientId,
          date_range_start: startDate || '',
          date_range_end: endDate || '',
          generated_at: new Date().toISOString(),
          generation_time_ms: 0, // We could track this
          email_sent: false
        });

      if (reportError) throw reportError;

      // Update client's last report date
      await supabase
        .from('clients')
        .update({ last_report_date: new Date().toISOString() })
        .eq('id', clientId);

      await fetchClients();
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setGeneratingReport(null);
    }
  };

  const deleteClient = async (clientId: string) => {
    if (!confirm('Are you sure you want to delete this client? This will also delete their user account from Supabase.')) return;

    try {
      console.log('Starting client deletion for ID:', clientId);
      
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      console.log('Session token obtained, making delete request...');

      // Use the server-side API endpoint for deletion with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('Delete response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete client');
      }

      const result = await response.json();
      console.log('Delete result:', result.message);
      
      await fetchClients();
    } catch (error: any) {
      console.error('Error deleting client:', error);
      if (error.name === 'AbortError') {
        alert('Delete request timed out. Please try again.');
      } else {
        alert('Failed to delete client. Please try again.');
      }
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'invalid':
      case 'expired':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'valid':
        return 'Active';
      case 'pending':
        return 'Pending';
      case 'invalid':
        return 'Invalid';
      case 'expired':
        return 'Expired';
      default:
        return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner text="Loading clients..." />
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
                Client Management
              </h1>
            </div>
            <div className="flex items-center">
              <button
                onClick={() => setShowAddModal(true)}
                className="btn-primary"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Client
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
        {clients.length === 0 ? (
          <div className="text-center py-12">
            <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No clients yet</h3>
            <p className="text-gray-600 mb-6">Click 'Add Client' to get started.</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </button>
          </div>
        ) : (
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Credentials
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Report
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {clients.map((client) => (
                    <tr key={client.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-primary-600">
                              {client.name?.charAt(0) || 'C'}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{client.name}</div>
                            <div className="text-sm text-gray-500 flex items-center">
                              <Mail className="h-3 w-3 mr-1" />
                              {client.email}
                            </div>
                            {client.company && (
                              <div className="text-xs text-gray-400 flex items-center">
                                <Building className="h-3 w-3 mr-1" />
                                {client.company}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getStatusIcon(client.api_status || 'pending')}
                          <span className="ml-2 text-sm text-gray-900">
                            {getStatusText(client.api_status || 'pending')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          <div className="flex items-center">
                            <Key className="h-3 w-3 mr-1" />
                            {client.generated_username || 'Not generated'}
                          </div>
                          {client.credentials_generated_at && (
                            <div className="text-xs text-gray-500">
                              Generated: {new Date(client.credentials_generated_at).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {client.last_report_date ? (
                            new Date(client.last_report_date).toLocaleDateString()
                          ) : (
                            <span className="text-gray-400">No reports yet</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            title="View Reports"
                            onClick={() => router.push(`/admin/clients/${client.id}/reports`)}
                            className="text-primary-600 hover:text-primary-900 p-1"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            title="Generate Report"
                            onClick={() => generateReport(client.id)}
                            disabled={generatingReport === client.id}
                            className="text-blue-600 hover:text-blue-900 p-1 disabled:opacity-50"
                          >
                            {generatingReport === client.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <FileText className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            title="Regenerate Credentials"
                            onClick={() => regenerateCredentials(client.id)}
                            disabled={generatingCredentials === client.id}
                            className="text-green-600 hover:text-green-900 p-1 disabled:opacity-50"
                          >
                            {generatingCredentials === client.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <UserPlus className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            title="Send Credentials"
                            className="text-purple-600 hover:text-purple-900 p-1"
                          >
                            <Send className="h-4 w-4" />
                          </button>
                          <button
                            title="Delete Client"
                            onClick={() => deleteClient(client.id)}
                            className="text-red-600 hover:text-red-900 p-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <AddClientModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={addClient}
      />

      {credentialsModal.credentials && (
        <CredentialsModal
          isOpen={credentialsModal.isOpen}
          onClose={() => setCredentialsModal({ ...credentialsModal, isOpen: false })}
          credentials={credentialsModal.credentials}
          clientName={credentialsModal.clientName}
          clientEmail={credentialsModal.clientEmail}
        />
      )}
    </div>
  );
} 