'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  ArrowLeft,
  BarChart3,
  FileText,
  Calendar,
  Download,
  Mail,
  Eye,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { useAuth } from '../../../../../components/AuthProvider';
import { supabase } from '../../../../../lib/supabase';
import type { Database } from '../../../../../lib/database.types';
import LoadingSpinner from '../../../../../components/LoadingSpinner';

type Client = Database['public']['Tables']['clients']['Row'];
type Report = Database['public']['Tables']['reports']['Row'];

export default function ClientReportsPage() {
  const [client, setClient] = useState<Client | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingReport, setGeneratingReport] = useState(false);
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
      router.push('/dashboard');
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
      console.log('Fetching client reports for ID:', clientId);
      
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

  const generateReport = async () => {
    if (!client) return;

    setGeneratingReport(true);
    try {
      console.log('Generating report for client:', client.name);
      
      // Create a new report record
      const { error: reportError } = await supabase
        .from('reports')
        .insert({
          client_id: client.id,
          date_range_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          date_range_end: new Date().toISOString().split('T')[0],
          generated_at: new Date().toISOString(),
          generation_time_ms: 0,
          email_sent: false
        });

      if (reportError) throw reportError;

      await fetchClientData();
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setGeneratingReport(false);
    }
  };

  const sendReportEmail = async (reportId: string) => {
    try {
      console.log('Sending report email for report ID:', reportId);
      
      // Update report to mark as sent
      const { error: updateError } = await supabase
        .from('reports')
        .update({
          email_sent: true,
          email_sent_at: new Date().toISOString()
        })
        .eq('id', reportId);

      if (updateError) throw updateError;

      await fetchClientData();
    } catch (error) {
      console.error('Error sending report email:', error);
    }
  };

  const downloadReport = async (reportId: string) => {
    try {
      console.log('Downloading report ID:', reportId);
      // This would integrate with your PDF generation and download logic
      alert('Download functionality would be implemented here');
    } catch (error) {
      console.error('Error downloading report:', error);
    }
  };

  const getReportStatusIcon = (emailSent: boolean) => {
    if (emailSent) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    } else {
      return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getReportStatusText = (emailSent: boolean) => {
    return emailSent ? 'Sent' : 'Not Sent';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner text="Loading client reports..." />
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
                onClick={() => router.push(`/admin/clients/${clientId}`)}
                className="mr-4 text-gray-400 hover:text-gray-600"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <BarChart3 className="h-8 w-8 text-primary-600" />
              <h1 className="ml-2 text-xl font-semibold text-gray-900">
                Reports: {client.name}
              </h1>
            </div>
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
              {generatingReport ? 'Generating...' : 'Generate New Report'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Client Info Card */}
        <div className="bg-white shadow-sm rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{client.name}</h2>
              <p className="text-sm text-gray-600">{client.email}</p>
              {client.company && (
                <p className="text-sm text-gray-600">{client.company}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Ad Account</p>
              <p className="text-sm font-mono text-gray-900">{client.ad_account_id}</p>
            </div>
          </div>
        </div>

        {/* Reports List */}
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Report History</h3>
            <p className="text-sm text-gray-600">
              {reports.length} report{reports.length !== 1 ? 's' : ''} generated
            </p>
          </div>

          {reports.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No reports yet</h3>
              <p className="text-gray-600 mb-6">Generate your first report to get started.</p>
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
                {generatingReport ? 'Generating...' : 'Generate First Report'}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date Range
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Generated
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {new Date(report.date_range_start).toLocaleDateString()} - {new Date(report.date_range_end).toLocaleDateString()}
                        </div>
                        <div className="text-sm text-gray-500">
                          {Math.ceil((new Date(report.date_range_end).getTime() - new Date(report.date_range_start).getTime()) / (1000 * 60 * 60 * 24))} days
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(report.generated_at).toLocaleDateString()}
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(report.generated_at).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getReportStatusIcon(report.email_sent)}
                          <span className="ml-2 text-sm text-gray-900">
                            {getReportStatusText(report.email_sent)}
                          </span>
                        </div>
                        {report.email_sent_at && (
                          <div className="text-xs text-gray-500 mt-1">
                            Sent: {new Date(report.email_sent_at).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            title="View Report"
                            onClick={() => router.push(`/reports/${report.id}`)}
                            className="text-primary-600 hover:text-primary-900 p-1"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            title="Download Report"
                            onClick={() => downloadReport(report.id)}
                            className="text-blue-600 hover:text-blue-900 p-1"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            title="Send Email"
                            onClick={() => sendReportEmail(report.id)}
                            disabled={report.email_sent}
                            className="text-green-600 hover:text-green-900 p-1 disabled:opacity-50"
                          >
                            <Mail className="h-4 w-4" />
                          </button>
                        </div>
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