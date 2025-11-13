'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { 
  ArrowLeft, 
  Download, 
  Mail, 
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Filter,
  Archive
} from 'lucide-react';
import { useAuth } from '../../../components/AuthProvider';
import AdminNavbar from '../../../components/AdminNavbar';


interface SentReport {
  id: string;
  client_id: string;
  report_id: string;
  sent_at: string;
  report_period: string;
  pdf_url: string;
  recipient_email: string;
  status: string;
  file_size_bytes?: number;
  meta?: any;
  clients: {
    id: string;
    name: string;
    email: string;
    company?: string;
  };
  reports: {
    id: string;
    date_range_start: string;
    date_range_end: string;
  };
}

interface Client {
  id: string;
  name: string;
  email: string;
  company?: string;
  ad_account_id: string;
  api_status: string;
}

interface GroupedReports {
  [key: string]: SentReport[];
}

export default function AdminSentReportsPage() {
  const [sentReports, setSentReports] = useState<SentReport[]>([]);
  const [groupedReports, setGroupedReports] = useState<GroupedReports>({});
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<'date' | 'client'>('date');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [dateFilter, setDateFilter] = useState<string>('');


  const { user, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user || profile?.role !== 'admin') {
      router.push('/auth/login');
      return;
    }
    fetchSentReports();
    fetchClients();
  }, [user, profile, selectedClient, groupBy, dateFilter]);

  const fetchSentReports = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const params = new URLSearchParams();
      if (selectedClient !== 'all') params.append('clientId', selectedClient);
      params.append('groupBy', groupBy);
      if (dateFilter) params.append('dateFilter', dateFilter);

      const response = await fetch(`/api/sent-reports?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSentReports(data.sentReports || []);
        setGroupedReports(data.groupedReports || {});
      }
    } catch (error) {
      console.error('Error fetching sent reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch('/api/clients', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };



  const handleDownload = async (sentReport: SentReport) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch(`/api/sent-reports/${sentReport.id}/download`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        // Create a temporary link and trigger download
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.download = data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Error downloading:', error);
    }
  };

  const handleResend = async (sentReport: SentReport) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch(`/api/sent-reports/${sentReport.id}/resend`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        alert('Report resent successfully!');
        await fetchSentReports(); // Refresh the list
      }
    } catch (error) {
      console.error('Error resending:', error);
    }
  };

  const toggleGroup = (groupKey: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey);
    } else {
      newExpanded.add(groupKey);
    }
    setExpandedGroups(newExpanded);
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pl-PL');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'delivered':
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'bounced':
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'sent':
        return 'Wysłany';
      case 'delivered':
        return 'Dostarczony';
      case 'failed':
        return 'Błąd';
      case 'bounced':
        return 'Odbity';
      default:
        return 'Nieznany';
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Nieznany';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Ładowanie wysłanych raportów...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Navbar */}
      <AdminNavbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <label className="text-sm font-medium text-gray-700">Filtry:</label>
            </div>
            
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-700">Klient:</label>
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Wszyscy klienci</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} ({client.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-700">Grupuj po:</label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as 'date' | 'client')}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="date">Dacie wysyłki</option>
                <option value="client">Kliencie</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-700">Data:</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={fetchSentReports}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm flex items-center space-x-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Odśwież</span>
            </button>
          </div>
        </div>

        {/* Reports List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              Wysłane Raporty ({sentReports.length} raportów)
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Raporty wysłane do klientów jako PDF - tylko ostatnie 12 miesięcy
            </p>
          </div>
          
          {sentReports.length === 0 ? (
            <div className="text-center py-12">
              <Archive className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Brak wysłanych raportów</h3>
              <p className="text-gray-600">
                {selectedClient === 'all' 
                  ? 'Nie znaleziono żadnych wysłanych raportów w ostatnich 12 miesiącach.'
                  : 'Nie znaleziono wysłanych raportów dla tego klienta w ostatnich 12 miesiącach.'
                }
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {Object.entries(groupedReports).map(([groupKey, reports]) => (
                <div key={groupKey} className="p-6">
                  <button
                    onClick={() => toggleGroup(groupKey)}
                    className="flex items-center justify-between w-full text-left hover:bg-gray-50 p-2 rounded-md transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      {expandedGroups.has(groupKey) ? (
                        <ChevronDown className="h-5 w-5 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-500" />
                      )}
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">{groupKey}</h3>
                        <p className="text-sm text-gray-600">{reports.length} raportów</p>
                      </div>
                    </div>
                  </button>
                  
                  {expandedGroups.has(groupKey) && (
                    <div className="mt-4 space-y-3">
                      {reports.map((report) => (
                        <div key={report.id} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                                <span className="text-sm font-medium text-primary-600">
                                  {report.clients.name?.charAt(0) || 'K'}
                                </span>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {report.clients.name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {report.clients.email}
                                </div>
                                <div className="text-xs text-gray-400">
                                  {report.report_period} • {formatDateTime(report.sent_at)}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <div className="flex items-center">
                                {getStatusIcon(report.status)}
                                <span className="ml-2 text-sm text-gray-900">
                                  {getStatusText(report.status)}
                                </span>
                              </div>
                              
                              <div className="flex items-center space-x-1">
                                <button
                                  title="Pobierz PDF"
                                  onClick={() => handleDownload(report)}
                                  className="text-blue-600 hover:text-blue-900 p-2 rounded-md hover:bg-gray-100"
                                >
                                  <Download className="h-4 w-4" />
                                </button>
                                <button
                                  title="Wyślij ponownie"
                                  onClick={() => handleResend(report)}
                                  className="text-green-600 hover:text-green-900 p-2 rounded-md hover:bg-gray-100"
                                >
                                  <Mail className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                          
                          {report.file_size_bytes && (
                            <div className="mt-2 text-xs text-gray-500">
                              Rozmiar: {formatFileSize(report.file_size_bytes)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>


    </div>
  );
} 