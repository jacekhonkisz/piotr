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
  LogOut,
  Shield
} from 'lucide-react';
import { useAuth } from '../../components/AuthProvider';
import { supabase } from '../../lib/supabase';
import { MetaAPIService } from '../../lib/meta-api';
import type { Database } from '../../lib/database.types';
import LoadingSpinner from '../../components/LoadingSpinner';
import CredentialsModal from '../../components/CredentialsModal';
import EditClientModal from '../../components/EditClientModal';
import SearchFilters from '../../components/SearchFilters';
import BulkActions from '../../components/BulkActions';



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
    system_user_token: '',
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
    // Check if Ad Account ID is provided (required)
    if (!formData.ad_account_id) {
      setValidationStatus({ status: 'invalid', message: 'Meta Ad Account ID is required' });
      return;
    }
    
    // Check if at least one token is provided
    if (!formData.meta_access_token && !formData.system_user_token) {
      setValidationStatus({ status: 'invalid', message: 'Please provide either a Meta Access Token (60 days) or System User Token (permanent)' });
      return;
    }
    
    // Use System User token if provided (permanent), otherwise use regular access token (60 days)
    const tokenToUse = formData.system_user_token || formData.meta_access_token;
    const tokenType = formData.system_user_token ? 'System User Token (Permanent)' : 'Meta Access Token (60 days)';

    setValidating(true);
    setValidationStatus({ status: 'validating', message: `Validating ${tokenType}...` });

    try {
      const metaService = new MetaAPIService(tokenToUse);
      
      // Step 1: Validate and convert the access token to long-lived
      const tokenValidation = await metaService.validateAndConvertToken();
      
      if (!tokenValidation.valid) {
        let errorMessage = `Token validation failed: ${tokenValidation.error}`;
        
        // Provide helpful guidance based on error type
        if (tokenValidation.error?.includes('expired')) {
          errorMessage += '\n💡 Tip: Use a System User token for permanent access that never expires.';
        } else if (tokenValidation.error?.includes('permissions')) {
          errorMessage += '\n💡 Tip: Make sure your token has ads_read and ads_management permissions.';
        } else if (tokenValidation.error?.includes('invalid')) {
          errorMessage += '\n💡 Tip: Check that your token starts with "EAA" and is copied correctly.';
        }
        
        setValidationStatus({ 
          status: 'invalid', 
          message: errorMessage
        });
        return;
      }

      // Step 2: Validate the specific ad account ID
      const accountValidation = await metaService.validateAdAccount(formData.ad_account_id);
      
      if (!accountValidation.valid) {
        let errorMessage = `Ad Account validation failed: ${accountValidation.error}`;
        
        // Provide helpful guidance
        if (accountValidation.error?.includes('not found')) {
          errorMessage += '\n💡 Tip: Check your Ad Account ID format (should be like "act_123456789").';
        } else if (accountValidation.error?.includes('access denied')) {
          errorMessage += '\n💡 Tip: Make sure your token has access to this ad account.';
        }
        
        setValidationStatus({ 
          status: 'invalid', 
          message: errorMessage
        });
        return;
      }

      // Step 3: Test campaign access (optional but good to verify)
      try {
        const campaigns = await metaService.getCampaigns(formData.ad_account_id.replace('act_', ''));
        
        let statusMessage = `✅ Connection successful! Account: ${accountValidation.account?.name || formData.ad_account_id}. Found ${campaigns.length} campaigns.`;
        
        // Enhanced token status information with user-friendly guidance
        if (tokenValidation.convertedToken) {
          statusMessage += '\n🔄 Your token will be automatically converted to permanent access (no expiration).';
        } else if (tokenValidation.isLongLived) {
          statusMessage += '\n✅ Perfect! Your token is already permanent (System User token).';
        } else if (tokenValidation.expiresAt) {
          const daysUntilExpiry = Math.ceil((tokenValidation.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysUntilExpiry <= 7) {
            statusMessage += `\n⚠️ Token expires in ${daysUntilExpiry} days - will be converted to permanent access.`;
          } else {
            statusMessage += `\n⏰ Token expires in ${daysUntilExpiry} days - will be converted to permanent access.`;
          }
        }
        
        setValidationStatus({ 
          status: 'valid', 
          message: statusMessage
        });
      } catch (campaignError) {
        // Campaign fetch failed, but credentials are still valid
        let statusMessage = `✅ Connection successful! Account: ${accountValidation.account?.name || formData.ad_account_id}. Campaign access may be limited.`;
        
        // Enhanced token status information with user-friendly guidance
        if (tokenValidation.convertedToken) {
          statusMessage += '\n🔄 Your token will be automatically converted to permanent access (no expiration).';
        } else if (tokenValidation.isLongLived) {
          statusMessage += '\n✅ Perfect! Your token is already permanent (System User token).';
        } else if (tokenValidation.expiresAt) {
          const daysUntilExpiry = Math.ceil((tokenValidation.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysUntilExpiry <= 7) {
            statusMessage += `\n⚠️ Token expires in ${daysUntilExpiry} days - will be converted to permanent access.`;
          } else {
            statusMessage += `\n⏰ Token expires in ${daysUntilExpiry} days - will be converted to permanent access.`;
          }
        }
        
        setValidationStatus({ 
          status: 'valid', 
          message: statusMessage
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
        system_user_token: '',
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
          
                    {/* Meta API Setup Section */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Key className="h-5 w-5 mr-2 text-blue-600" />
              Meta API Setup (Permanent Access)
            </h3>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start">
                <Shield className="h-5 w-5 mr-2 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900 mb-1">💡 Recommended: System User Token</h4>
                  <p className="text-sm text-blue-800 mb-2">
                    For permanent access that never expires, use a System User token from the client's Business Manager.
                  </p>
                  <button
                    type="button"
                    onClick={() => window.open('https://business.facebook.com/', '_blank')}
                    className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                  >
                    Open Business Manager
                  </button>
                </div>
              </div>
            </div>

            {/* Required Ad Account ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meta Ad Account ID *
              </label>
              <input
                type="text"
                required
                value={formData.ad_account_id}
                onChange={(e) => setFormData({...formData, ad_account_id: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., act_123456789"
              />
              <p className="text-xs text-gray-500 mt-1">
                Find this in Ads Manager → Account Settings
              </p>
            </div>

            {/* Token Choice Section */}
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <Key className="h-4 w-4 mr-2" />
                Choose Your Token Type (Select One)
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Option 1: System User Token */}
                <div className={`border-2 rounded-lg p-4 transition-colors ${
                  formData.system_user_token ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                }`}>
                  <div className="flex items-center mb-2">
                    <Shield className="h-4 w-4 mr-2 text-blue-600" />
                    <label className="text-sm font-medium text-gray-700">
                      System User Token (Recommended)
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type="password"
                      value={formData.system_user_token}
                      onChange={(e) => setFormData({...formData, system_user_token: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Paste System User token for permanent access"
                    />
                    {formData.system_user_token && formData.system_user_token.startsWith('EAA') && (
                      <div className="absolute right-2 top-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    ✅ Permanent access, never expires
                  </p>
                </div>

                {/* Option 2: Meta Access Token */}
                <div className={`border-2 rounded-lg p-4 transition-colors ${
                  formData.meta_access_token && !formData.system_user_token ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-300'
                }`}>
                  <div className="flex items-center mb-2">
                    <Clock className="h-4 w-4 mr-2 text-orange-600" />
                    <label className="text-sm font-medium text-gray-700">
                      Meta Access Token (60 days)
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type="password"
                      value={formData.meta_access_token}
                      onChange={(e) => setFormData({...formData, meta_access_token: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="EAA... (starts with EAA)"
                    />
                    {formData.meta_access_token && formData.meta_access_token.startsWith('EAA') && (
                      <div className="absolute right-2 top-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    ⏰ Expires in 60 days, requires renewal
                  </p>
                </div>
              </div>
            </div>



            {/* Token Choice Status */}
            {(formData.meta_access_token || formData.system_user_token) && (
              <div className="mt-4 p-3 bg-gray-50 rounded-md">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Selected Token Status:</h4>
                <div className="space-y-2">
                  {formData.system_user_token && (
                    <div className={`flex items-center text-sm p-2 rounded ${
                      formData.system_user_token.startsWith('EAA') 
                        ? 'text-green-700 bg-green-50 border border-green-200' 
                        : 'text-yellow-700 bg-yellow-50 border border-yellow-200'
                    }`}>
                      {formData.system_user_token.startsWith('EAA') ? (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      ) : (
                        <AlertCircle className="h-4 w-4 mr-2" />
                      )}
                      <span>
                        {formData.system_user_token.startsWith('EAA') 
                          ? '✅ System User Token Selected (Permanent Access)' 
                          : '⚠️ System User token should start with "EAA" for Meta API'
                        }
                      </span>
                    </div>
                  )}
                  
                  {formData.meta_access_token && !formData.system_user_token && (
                    <div className={`flex items-center text-sm p-2 rounded ${
                      formData.meta_access_token.startsWith('EAA') 
                        ? 'text-green-700 bg-green-50' 
                        : 'text-yellow-700 bg-yellow-50'
                    }`}>
                      {formData.meta_access_token.startsWith('EAA') ? (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      ) : (
                        <AlertCircle className="h-4 w-4 mr-2" />
                      )}
                      <span>
                        {formData.meta_access_token.startsWith('EAA') 
                          ? '✅ Meta Access Token Selected (60-day access)' 
                          : '⚠️ Meta Access token should start with "EAA" for Meta API'
                        }
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Validation Section */}
            <div className="bg-gray-50 p-4 rounded-md mt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700 flex items-center">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Test Connection & Validate Token
                </span>
                <button
                  type="button"
                  onClick={validateMetaCredentials}
                  disabled={validating || !formData.ad_account_id || (!formData.meta_access_token && !formData.system_user_token)}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {validating ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Test Connection
                    </>
                  )}
                </button>
              </div>
              
              {validationStatus.status !== 'idle' && (
                <div className={`text-sm p-3 rounded-md border ${
                  validationStatus.status === 'valid' ? 'bg-green-50 text-green-800 border-green-200' :
                  validationStatus.status === 'invalid' ? 'bg-red-50 text-red-800 border-red-200' :
                  'bg-yellow-50 text-yellow-800 border-yellow-200'
                }`}>
                  <div className="flex items-start">
                    {validationStatus.status === 'valid' ? (
                      <CheckCircle className="h-5 w-5 mr-2 mt-0.5 text-green-600" />
                    ) : validationStatus.status === 'invalid' ? (
                      <AlertCircle className="h-5 w-5 mr-2 mt-0.5 text-red-600" />
                    ) : (
                      <Clock className="h-5 w-5 mr-2 mt-0.5 text-yellow-600" />
                    )}
                    <div>
                      {validationStatus.message}
                    </div>
                  </div>
                </div>
              )}
            </div>

                         {/* Quick Help */}
             <div className="mt-4 p-3 bg-gray-50 rounded-md">
               <h4 className="text-sm font-medium text-gray-700 mb-2">🔧 Token Choice Guide:</h4>
               <div className="text-xs text-gray-600 space-y-1">
                 <p>• <strong>Meta Ad Account ID</strong> (Required): Your ad account identifier</p>
                 <p>• <strong>Choose ONE token type:</strong></p>
                 <div className="ml-4 space-y-1">
                   <p>🛡️ <strong>System User Token:</strong> Permanent access, never expires (Recommended)</p>
                   <p>⏰ <strong>Meta Access Token:</strong> 60-day access, requires manual renewal</p>
                 </div>
               </div>
               <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                 <strong>💡 Tip:</strong> System User tokens are preferred for permanent access. If you have one, use it!
               </div>
             </div>
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [generatingCredentials, setGeneratingCredentials] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  
  // Bulk operations state
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // PDF viewer state

  

  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [frequencyFilter, setFrequencyFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });
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

  // Refetch clients when search/filter/sort changes
  useEffect(() => {
    if (user && profile) {
      fetchClients(1); // Reset to first page when filters change
    }
  }, [searchTerm, statusFilter, frequencyFilter, sortBy, sortOrder]);

  const fetchClients = async (page = 1) => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      console.log('Fetching clients for user:', user.id);
      
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        sortOrder
      });

      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('status', statusFilter);
      if (frequencyFilter) params.append('frequency', frequencyFilter);

      const response = await fetch(`/api/clients?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch clients');
      }

      const result = await response.json();
      setClients(result.clients || []);
      setPagination(result.pagination);
    } catch (error) {
      console.error('Error fetching clients:', error);
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

  const updateClient = async (clientId: string, updates: Partial<Client>) => {
    if (!user) return;

    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      // Use the server-side API endpoint
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update client');
      }

      const result = await response.json();
      console.log('Client updated successfully:', result);

      await fetchClients();
    } catch (error) {
      console.error('Error updating client:', error);
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







  // Bulk operations functions
  const handleSelectAll = () => {
    if (selectedClients.length === clients.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients(clients.map(client => client.id));
    }
  };

  const handleClearSelection = () => {
    setSelectedClients([]);
  };

  const handleBulkDelete = async () => {
    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      const response = await fetch('/api/clients/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'delete',
          clientIds: selectedClients
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete clients');
      }

      const result = await response.json();
      console.log('Bulk delete result:', result);
      
      setSelectedClients([]);
      await fetchClients();
      alert(`Successfully deleted ${result.results.success.length} clients`);
    } catch (error) {
      console.error('Error in bulk delete:', error);
      alert('Failed to delete some clients. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };



  const handleBulkRegenerateCredentials = async () => {
    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      const response = await fetch('/api/clients/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'regenerate_credentials',
          clientIds: selectedClients
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to regenerate credentials');
      }

      const result = await response.json();
      console.log('Bulk regenerate credentials result:', result);
      
      setSelectedClients([]);
      await fetchClients();
      alert(`Successfully regenerated credentials for ${result.results.success.length} clients`);
    } catch (error) {
      console.error('Error in bulk regenerate credentials:', error);
      alert('Failed to regenerate some credentials. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkGenerateReports = async () => {
    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      const response = await fetch('/api/clients/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'generate_reports',
          clientIds: selectedClients
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate reports');
      }

      const result = await response.json();
      console.log('Bulk generate reports result:', result);
      
      setSelectedClients([]);
      await fetchClients();
      alert(`Successfully generated ${result.results.success.length} reports`);
    } catch (error) {
      console.error('Error in bulk generate reports:', error);
      alert('Failed to generate some reports. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkChangeFrequency = async (frequency: string) => {
    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      const response = await fetch('/api/clients/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'change_frequency',
          clientIds: selectedClients,
          frequency
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to change frequency');
      }

      const result = await response.json();
      console.log('Bulk change frequency result:', result);
      
      setSelectedClients([]);
      await fetchClients();
      alert(`Successfully changed frequency for ${result.results.success.length} clients`);
    } catch (error) {
      console.error('Error in bulk change frequency:', error);
      alert('Failed to change frequency for some clients. Please try again.');
    } finally {
      setIsProcessing(false);
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
      case 'expiring_soon':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
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
      case 'expiring_soon':
        return 'Expiring Soon';
      default:
        return 'Unknown';
    }
  };

  const getTokenHealthIcon = (healthStatus: string) => {
    switch (healthStatus) {
      case 'valid':
        return <CheckCircle className="h-3 w-3 text-green-600" />;
      case 'expiring_soon':
        return <AlertCircle className="h-3 w-3 text-orange-500" />;
      case 'expired':
        return <AlertCircle className="h-3 w-3 text-red-600" />;
      case 'invalid':
        return <X className="h-3 w-3 text-red-600" />;
      default:
        return <Clock className="h-3 w-3 text-gray-400" />;
    }
  };

  const getTokenHealthText = (healthStatus: string) => {
    switch (healthStatus) {
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
                onClick={() => router.push('/admin/token-health')}
                className="btn-secondary mr-2"
              >
                <Shield className="h-4 w-4 mr-2" />
                Token Health
              </button>
              <button
                onClick={() => router.push('/admin/reports')}
                className="btn-primary mr-2"
              >
                <FileText className="h-4 w-4 mr-2" />
                View All Reports
              </button>
              <button
                onClick={() => router.push('/admin/email-logs')}
                className="btn-secondary mr-2"
              >
                <Mail className="h-4 w-4 mr-2" />
                Email Logs
              </button>
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
        {/* Search and Filters */}
        <SearchFilters
          onSearchChange={setSearchTerm}
          onStatusFilterChange={setStatusFilter}
          onFrequencyFilterChange={setFrequencyFilter}
          onSortChange={(sortBy, sortOrder) => {
            setSortBy(sortBy);
            setSortOrder(sortOrder);
          }}
          currentSearch={searchTerm}
          currentStatusFilter={statusFilter}
          currentFrequencyFilter={frequencyFilter}
          currentSortBy={sortBy}
          currentSortOrder={sortOrder}
        />

        {clients.length === 0 ? (
          <div className="text-center py-12">
            <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || statusFilter || frequencyFilter ? 'No clients found' : 'No clients yet'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || statusFilter || frequencyFilter 
                ? 'Try adjusting your search or filter criteria.' 
                : 'Click \'Add Client\' to get started.'}
            </p>
            {!searchTerm && !statusFilter && !frequencyFilter && (
              <button
                onClick={() => setShowAddModal(true)}
                className="btn-primary"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Client
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            {/* Bulk Actions */}
            <BulkActions
              selectedClients={selectedClients}
              totalClients={clients.length}
              onSelectAll={handleSelectAll}
              onClearSelection={handleClearSelection}
              onBulkDelete={handleBulkDelete}

              onBulkRegenerateCredentials={handleBulkRegenerateCredentials}
              onBulkGenerateReports={handleBulkGenerateReports}
              onBulkChangeFrequency={handleBulkChangeFrequency}
              isProcessing={isProcessing}
            />
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={selectedClients.length === clients.length && clients.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      API Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Token Health
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
                        <input
                          type="checkbox"
                          checked={selectedClients.includes(client.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedClients([...selectedClients, client.id]);
                            } else {
                              setSelectedClients(selectedClients.filter(id => id !== client.id));
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
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
                        <div className="flex items-center">
                          {getTokenHealthIcon(client.token_health_status || 'unknown')}
                          <span className="ml-2 text-sm text-gray-900">
                            {getTokenHealthText(client.token_health_status || 'unknown')}
                          </span>
                          {client.token_expires_at && (
                            <div className="text-xs text-gray-500 ml-2">
                              {new Date(client.token_expires_at).toLocaleDateString()}
                            </div>
                          )}
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
                            title="Edit Client"
                            onClick={() => {
                              setEditingClient(client);
                              setShowEditModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-900 p-1"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            title="View Reports"
                            onClick={() => router.push(`/reports?clientId=${client.id}`)}
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
            
            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="bg-white px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} clients
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => fetchClients(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-700">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => fetchClients(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <AddClientModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={addClient}
      />

      <EditClientModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingClient(null);
        }}
        onUpdate={updateClient}
        client={editingClient}
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