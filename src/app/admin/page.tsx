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
import PDFViewer from '../../components/PDFViewer';
import NotesEditor from '../../components/NotesEditor';

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
        
        // Enhanced token status information
        if (tokenValidation.convertedToken) {
          statusMessage += ' 🔄 Token will be automatically converted to long-lived for permanent access.';
        } else if (tokenValidation.isLongLived) {
          statusMessage += ' ✅ Token is already long-lived (permanent).';
        } else if (tokenValidation.expiresAt) {
          const daysUntilExpiry = Math.ceil((tokenValidation.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysUntilExpiry <= 7) {
            statusMessage += ` ⚠️ Token expires in ${daysUntilExpiry} days - will be converted to long-lived.`;
          } else {
            statusMessage += ` ⏰ Token expires in ${daysUntilExpiry} days - will be converted to long-lived.`;
          }
        }
        
        setValidationStatus({ 
          status: 'valid', 
          message: statusMessage
        });
      } catch (campaignError) {
        // Campaign fetch failed, but credentials are still valid
        let statusMessage = `✅ Credentials valid! Account: ${accountValidation.account?.name || formData.ad_account_id}. Campaign access may be limited.`;
        
        // Enhanced token status information
        if (tokenValidation.convertedToken) {
          statusMessage += ' 🔄 Token will be automatically converted to long-lived for permanent access.';
        } else if (tokenValidation.isLongLived) {
          statusMessage += ' ✅ Token is already long-lived (permanent).';
        } else if (tokenValidation.expiresAt) {
          const daysUntilExpiry = Math.ceil((tokenValidation.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysUntilExpiry <= 7) {
            statusMessage += ` ⚠️ Token expires in ${daysUntilExpiry} days - will be converted to long-lived.`;
          } else {
            statusMessage += ` ⏰ Token expires in ${daysUntilExpiry} days - will be converted to long-lived.`;
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [generatingCredentials, setGeneratingCredentials] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  
  // Bulk operations state
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // PDF viewer state
  const [pdfViewer, setPdfViewer] = useState<{
    isOpen: boolean;
    reportId: string;
    reportName: string;
    clientName: string;
  }>({
    isOpen: false,
    reportId: '',
    reportName: '',
    clientName: ''
  });
  
  // Notes editor state
  const [notesEditor, setNotesEditor] = useState<{
    isOpen: boolean;
    clientId: string;
    clientName: string;
    initialContent: string;
  }>({
    isOpen: false,
    clientId: '',
    clientName: '',
    initialContent: ''
  });
  
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

  const sendReport = async (clientId: string) => {
    try {
      const client = clients.find(c => c.id === clientId);
      if (!client) return;

      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      const response = await fetch('/api/send-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          clientId: clientId,
          includePdf: false
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send report');
      }

      const result = await response.json();
      alert('Report sent successfully!');
    } catch (error) {
      console.error('Error sending report:', error);
      alert('Failed to send report. Please try again.');
    }
  };

  // Notes and PDF viewer functions
  const handleOpenNotes = (client: Client) => {
    setNotesEditor({
      isOpen: true,
      clientId: client.id,
      clientName: client.name || '',
      initialContent: client.notes || ''
    });
  };

  const handleSaveNote = async (content: string, noteType: string, tags: string[]) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      const response = await fetch(`/api/clients/${notesEditor.clientId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          content,
          noteType,
          tags
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save note');
      }

      // Update client notes in local state
      setClients(prevClients => 
        prevClients.map(client => 
          client.id === notesEditor.clientId 
            ? { ...client, notes: content }
            : client
        )
      );

      alert('Note saved successfully!');
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Failed to save note. Please try again.');
    }
  };

  const handleOpenPDFViewer = (client: Client) => {
    // For now, we'll use a placeholder report ID
    // In a real implementation, you'd get the latest report ID for this client
    setPdfViewer({
      isOpen: true,
      reportId: 'latest', // This would be the actual report ID
      reportName: `${client.name} Report`,
      clientName: client.name || ''
    });
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

  const handleBulkSendReports = async () => {
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
          action: 'send_reports',
          clientIds: selectedClients
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send reports');
      }

      const result = await response.json();
      console.log('Bulk send reports result:', result);
      
      setSelectedClients([]);
      await fetchClients();
      alert(`Successfully sent ${result.results.success.length} reports`);
    } catch (error) {
      console.error('Error in bulk send reports:', error);
      alert('Failed to send some reports. Please try again.');
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
              onBulkSendReports={handleBulkSendReports}
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
                            title="View PDF Report"
                            onClick={() => handleOpenPDFViewer(client)}
                            className="text-indigo-600 hover:text-indigo-900 p-1"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                          <button
                            title="Edit Notes"
                            onClick={() => handleOpenNotes(client)}
                            className="text-yellow-600 hover:text-yellow-900 p-1"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
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
                            title="Send Report"
                            onClick={() => sendReport(client.id)}
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

      {/* PDF Viewer Modal */}
      <PDFViewer
        isOpen={pdfViewer.isOpen}
        onClose={() => setPdfViewer({ ...pdfViewer, isOpen: false })}
        reportId={pdfViewer.reportId}
        reportName={pdfViewer.reportName}
        clientName={pdfViewer.clientName}
      />

      {/* Notes Editor Modal */}
      <NotesEditor
        isOpen={notesEditor.isOpen}
        onClose={() => setNotesEditor({ ...notesEditor, isOpen: false })}
        clientId={notesEditor.clientId}
        clientName={notesEditor.clientName}
        initialContent={notesEditor.initialContent}
        onSave={handleSaveNote}
      />
    </div>
  );
} 