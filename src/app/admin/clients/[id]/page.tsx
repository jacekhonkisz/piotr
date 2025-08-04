'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  ArrowLeft,
  BarChart3,
  Mail,
  Building,
  Calendar,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  Edit,
  Trash2,
  Eye,
  Send
} from 'lucide-react';
import { useAuth } from '../../../../components/AuthProvider';
import { supabase } from '../../../../lib/supabase';
import type { Database } from '../../../../lib/database.types';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import EditClientModal from '../../../../components/EditClientModal';

type Client = Database['public']['Tables']['clients']['Row'];
type Report = Database['public']['Tables']['reports']['Row'];

export default function ClientDetailPage() {
  const [client, setClient] = useState<Client | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [sendingPDF, setSendingPDF] = useState<string | null>(null);
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;

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
              router.push('/admin');
      return;
    }

    // Load client data if user and profile are available
    if (user && profile && clientId) {
      fetchClientData();
    } else {
      // If we don't have user/profile but auth is not loading, stop loading
      setLoading(false);
    }
  }, [user, profile, authLoading, router, clientId]);

  const fetchClientData = async () => {
    if (!user || !clientId) {
      setLoading(false);
      return;
    }

    try {
      console.log('Fetching client data for ID:', clientId);
      
      // Fetch client details
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .eq('admin_id', user.id)
        .single();

      if (clientError) {
        console.error('Supabase error fetching client:', clientError);
        throw clientError;
      }
      
      setClient(clientData);

      // Fetch client reports
      const { data: reportsData, error: reportsError } = await supabase
        .from('reports')
        .select('*')
        .eq('client_id', clientId)
        .order('generated_at', { ascending: false });

      if (reportsError) {
        console.error('Supabase error fetching reports:', reportsError);
        throw reportsError;
      }
      
      setReports(reportsData || []);
      
    } catch (error) {
      console.error('Error fetching client data:', error);
      // Set empty data on error to prevent infinite loading
      setClient(null);
      setReports([]);
    } finally {
      setLoading(false);
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

      await fetchClientData();
    } catch (error) {
      console.error('Error updating client:', error);
      throw error;
    }
  };

  const generateReport = async () => {
    if (!client) return;

    setGeneratingReport(true);
    try {
      // This would integrate with your report generation logic
      console.log('Generating report for client:', client.name);
      
      // For now, just create a placeholder report
      const { error: reportError } = await supabase
        .from('reports')
        .insert({
          client_id: client.id,
          date_range_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          date_range_end: new Date().toISOString().split('T')[0],
          generated_at: new Date().toISOString(),
          generation_time_ms: 0,
          email_sent: false
        } as Database['public']['Tables']['reports']['Insert']);

      if (reportError) throw reportError;

      await fetchClientData();
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setGeneratingReport(false);
    }
  };

  const deleteClient = async () => {
    if (!client || !confirm('Are you sure you want to delete this client? This action cannot be undone.')) return;

    try {
      console.log('Starting client deletion for ID:', client.id);
      
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      // Use the server-side API endpoint for deletion
      const response = await fetch(`/api/clients/${client.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete client');
      }

      const result = await response.json();
      console.log('Delete result:', result.message);
      
      router.push('/admin');
    } catch (error: any) {
      console.error('Error deleting client:', error);
      alert('Failed to delete client. Please try again.');
    }
  };

  const sendPDFReport = async (reportId: string) => {
    if (!user || !client) {
      return;
    }

    try {
      setSendingPDF(reportId);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No access token available');
      }

      // Get the report to extract month information
      const report = reports.find(r => r.id === reportId);
      if (!report) {
        throw new Error('Report not found');
      }

      // Send interactive report

      const response = await fetch('/api/send-interactive-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          clientId: client.id,
          dateRange: {
            start: report.date_range_start,
            end: report.date_range_end
          },
          emailRecipient: client.email,
          emailSubject: `Raport Meta Ads - ${new Date(report.date_range_start).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}`,
          emailMessage: `Dzień dobry,\n\nW załączniku znajdziesz interaktywny raport Meta Ads za okres ${new Date(report.date_range_start).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}.\n\nPozdrawiamy,\nZespół Premium Analytics`
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send PDF report');
      }

      await response.json();
      alert(`PDF report sent successfully to ${client.email}`);

    } catch (error) {
      console.error('Error sending PDF report:', error);
      alert(`Failed to send PDF report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSendingPDF(null);
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
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'expiring_soon':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'expired':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'invalid':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
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
        <LoadingSpinner text="Loading client details..." />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Client Not Found</h2>
          <p className="text-gray-600 mb-4">The client you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.</p>
          <button
            onClick={() => router.push('/admin')}
            className="btn-primary"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </button>
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
              <button
                onClick={() => router.push('/admin')}
                className="mr-4 text-gray-400 hover:text-gray-600"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <BarChart3 className="h-8 w-8 text-primary-600" />
              <h1 className="ml-2 text-xl font-semibold text-gray-900">
                Client Details: {client.name}
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowEditModal(true)}
                className="btn-secondary"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Client
              </button>
              <button
                onClick={deleteClient}
                className="btn-danger"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Client
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Client Information */}
          <div className="lg:col-span-2">
            <div className="bg-white shadow-sm rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Client Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                  <p className="text-sm text-gray-900">{client.name}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 text-gray-400 mr-2" />
                    <p className="text-sm text-gray-900">{client.email}</p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                  <div className="flex items-center">
                    <Building className="h-4 w-4 text-gray-400 mr-2" />
                    <p className="text-sm text-gray-900">{client.company || 'Not specified'}</p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ad Account ID</label>
                  <p className="text-sm text-gray-900 font-mono">{client.ad_account_id}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reporting Frequency</label>
                  <p className="text-sm text-gray-900 capitalize">{client.reporting_frequency.replace('_', ' ')}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Report</label>
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                    <p className="text-sm text-gray-900">
                      {client.last_report_date ? 
                        new Date(client.last_report_date).toLocaleDateString() : 
                        'No reports yet'
                      }
                    </p>
                  </div>
                </div>
              </div>
              
              {client.notes && (
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md">{client.notes}</p>
                </div>
              )}
            </div>

            {/* Token Health */}
            <div className="bg-white shadow-sm rounded-lg p-6 mt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Token Health</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Status</label>
                  <div className="flex items-center">
                    {getStatusIcon(client.api_status || 'pending')}
                    <span className="ml-2 text-sm text-gray-900">
                      {getStatusText(client.api_status || 'pending')}
                    </span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Token Health</label>
                  <div className="flex items-center">
                    {getTokenHealthIcon(client.token_health_status || 'unknown')}
                    <span className="ml-2 text-sm text-gray-900">
                      {getTokenHealthText(client.token_health_status || 'unknown')}
                    </span>
                  </div>
                </div>
                
                {client.token_expires_at && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Token Expires</label>
                    <p className="text-sm text-gray-900">
                      {new Date(client.token_expires_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
                
                {client.last_token_validation && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Validated</label>
                    <p className="text-sm text-gray-900">
                      {new Date(client.last_token_validation).toLocaleDateString()}
                    </p>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Refresh Count</label>
                  <p className="text-sm text-gray-900">{client.token_refresh_count || 0}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Created</label>
                  <p className="text-sm text-gray-900">
                    {new Date(client.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Reports Section */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow-sm rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Reports</h2>
                <button
                  onClick={generateReport}
                  disabled={generatingReport}
                  className="btn-primary"
                >
                  {generatingReport ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  {generatingReport ? 'Generating...' : 'Generate Report'}
                </button>
              </div>
              
              {reports.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No reports generated yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reports.map((report) => (
                    <div key={report.id} className="border border-gray-200 rounded-md p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {new Date(report.date_range_start).toLocaleDateString()} - {new Date(report.date_range_end).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-gray-500">
                            Generated: {new Date(report.generated_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => router.push(`/reports/${report.id}`)}
                            className="text-primary-600 hover:text-primary-900"
                            title="View Report"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => sendPDFReport(report.id)}
                            disabled={sendingPDF === report.id}
                            className="text-green-600 hover:text-green-900 disabled:opacity-50"
                            title="Send PDF Report"
                          >
                            {sendingPDF === report.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
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
      </main>

      <EditClientModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onUpdate={updateClient}
        client={client}
      />
    </div>
  );
} 