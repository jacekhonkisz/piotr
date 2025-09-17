'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight, Eye, Mail, Calendar, User, RefreshCw } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import EmailPreviewModal from './EmailPreviewModal';
import { getMonthBoundaries, getWeekBoundaries } from '../lib/date-range-utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ScheduledReport {
  id: string;
  client_id: string;
  client_name: string;
  client_email: string;
  scheduled_date: string;
  report_type: 'monthly' | 'weekly' | 'custom';
  frequency: string;
  status: 'scheduled' | 'sent' | 'failed' | 'pending';
  reportPeriodStart?: string;
  reportPeriodEnd?: string;
}

interface Client {
  id: string;
  name: string;
  email: string;
  contact_emails: string[];
}

interface CalendarEmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  scheduledReports: ScheduledReport[];
}

// Helper function to get Polish labels for status
const getStatusLabel = (status: string) => {
  switch (status) {
    case 'sent':
      return 'wysłany';
    case 'failed':
      return 'błąd';
    case 'pending':
      return 'oczekujący';
    case 'scheduled':
      return 'zaplanowany';
    default:
      return status;
  }
};

// Helper function to get Polish labels for report types
const getReportTypeLabel = (reportType: string) => {
  switch (reportType) {
    case 'monthly':
      return 'miesięczny';
    case 'weekly':
      return 'tygodniowy';
    case 'custom':
      return 'niestandardowy';
    default:
      return reportType;
  }
};

const CalendarEmailPreviewModal = React.memo(function CalendarEmailPreviewModal({
  isOpen,
  onClose,
  selectedDate,
  scheduledReports
}: CalendarEmailPreviewModalProps) {

  const [currentReportIndex, setCurrentReportIndex] = useState(0);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<{ [key: string]: Client }>({});
  const [reportData, setReportData] = useState<{ [key: string]: any }>({});

  // OPTIMIZED: Memoize filtered reports to prevent recalculation
  const reportsForDate = useMemo(() => {
    if (!scheduledReports || !selectedDate) return [];
    
    const selectedDateStr = selectedDate.toDateString();
    return scheduledReports.filter(report => {
      const reportDate = new Date(report.scheduled_date);
    return reportDate.toDateString() === selectedDateStr;
  });
  }, [scheduledReports.length, selectedDate.getTime()]); // FIXED: Use length instead of full array reference

  const currentReport = reportsForDate[currentReportIndex];

  // OPTIMIZED: Memoize current client to prevent unnecessary re-renders
  const currentClient = useMemo(() => {
    return currentReport ? clients[currentReport.client_id] : undefined;
  }, [currentReport, clients]);

  // OPTIMIZED: Only load data when modal opens, reset index
  useEffect(() => {
    if (isOpen) {
      setCurrentReportIndex(0);
      setShowEmailPreview(false);
      
      // Load clients data if not already loaded
      if (reportsForDate.length > 0 && Object.keys(clients).length === 0) {
      loadClientsData();
      }
    }
  }, [isOpen]); // MINIMAL DEPENDENCIES: Only trigger on modal open/close

  // OPTIMIZED: Load report data only when current report changes and data not already loaded
  useEffect(() => {
    if (currentReport && !reportData[currentReport.id]) {
      loadReportData(currentReport);
    }
  }, [currentReport]); // Only depend on currentReport

  const loadClientsData = useCallback(async () => {
    try {
      const clientIds = reportsForDate.map(report => report.client_id);
      const uniqueClientIds = Array.from(new Set(clientIds));

      const { data: clientsData, error } = await supabase
        .from('clients')
        .select('*')
        .in('id', uniqueClientIds);

      if (error) throw error;

      const clientsMap: { [key: string]: Client } = {};
      clientsData?.forEach(client => {
        clientsMap[client.id] = client;
      });
      setClients(clientsMap);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  }, [reportsForDate]);

  const loadReportData = useCallback(async (report: ScheduledReport) => {
    if (reportData[report.id]) return; // Already loaded

    setLoading(true);
    try {
      let dateRange: { start: string; end: string };
      
      if (report.reportPeriodStart && report.reportPeriodEnd) {
        // Use provided date range
        dateRange = {
          start: report.reportPeriodStart,
          end: report.reportPeriodEnd
        };
      } else {
        // Calculate date range based on report type and scheduled date
        const scheduledDate = new Date(report.scheduled_date);
            
            if (report.report_type === 'monthly') {
          // For monthly reports, get the previous month
          const monthBoundaries = getMonthBoundaries(scheduledDate.getFullYear(), scheduledDate.getMonth() - 1);
          dateRange = {
            start: monthBoundaries.start,
            end: monthBoundaries.end
          };
        } else if (report.report_type === 'weekly') {
          // For weekly reports, get the previous week
          const weekStart = new Date(scheduledDate);
          weekStart.setDate(scheduledDate.getDate() - 7);
          const weekBoundaries = getWeekBoundaries(weekStart);
          dateRange = {
            start: weekBoundaries.start,
            end: weekBoundaries.end
          };
        } else {
          // Default to previous month for custom reports
          const monthBoundaries = getMonthBoundaries(scheduledDate.getFullYear(), scheduledDate.getMonth() - 1);
          dateRange = {
            start: monthBoundaries.start,
            end: monthBoundaries.end
          };
        }
      }

      setReportData(prev => ({
        ...prev,
        [report.id]: {
          clientId: report.client_id,
          clientName: report.client_name,
          dateRange,
          reportType: report.report_type
        }
      }));
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  }, [reportData]);

  const navigateToReport = useCallback((direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentReportIndex > 0) {
      setCurrentReportIndex(currentReportIndex - 1);
    } else if (direction === 'next' && currentReportIndex < reportsForDate.length - 1) {
      setCurrentReportIndex(currentReportIndex + 1);
    }
  }, [currentReportIndex, reportsForDate.length]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDateRange = (dateRange: any) => {
    if (!dateRange) return 'Brak danych';
    return `${dateRange.start} do ${dateRange.end}`;
  };

  if (!isOpen) return null;

  if (reportsForDate.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Brak raportów</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <p className="text-gray-600 text-center py-8">
              Brak zaplanowanych raportów na {selectedDate.toLocaleDateString('pl-PL')}.
            </p>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentReportData = currentReport ? reportData[currentReport.id] : undefined;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              Podgląd raportów - {selectedDate.toLocaleDateString('pl-PL')}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigateToReport('prev')}
              disabled={currentReportIndex === 0}
              className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Poprzedni</span>
            </button>
            
            <span className="text-sm text-gray-600">
                Raport {currentReportIndex + 1} z {reportsForDate.length}
            </span>
            
            <button
              onClick={() => navigateToReport('next')}
              disabled={currentReportIndex === reportsForDate.length - 1}
              className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Następny</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Current Report Details */}
          {currentReport && currentClient && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Klient</label>
                    <div className="flex items-center space-x-2 mt-1">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-900">{currentClient.name}</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-600">Email główny</label>
                    <div className="flex items-center space-x-2 mt-1">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-900">{currentClient.email}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600">Status</label>
                    <div className="mt-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(currentReport.status)}`}>
                        {getStatusLabel(currentReport.status)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Data wysyłki</label>
                    <div className="flex items-center space-x-2 mt-1">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-900">{new Date(currentReport.scheduled_date).toLocaleDateString('pl-PL')}</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-600">Typ raportu</label>
                    <div className="mt-1">
                      <span className="text-gray-900">{getReportTypeLabel(currentReport.report_type)}</span>
                    </div>
                  </div>

                  {currentReportData && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Okres raportu</label>
                      <div className="mt-1">
                        <span className="text-gray-900">{formatDateRange(currentReportData.dateRange)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Contact Emails */}
              {currentClient && currentClient.contact_emails && currentClient.contact_emails.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Dodatkowe adresy email</label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {currentClient.contact_emails.map((email, index) => (
                      <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {email}
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* Loading State */}
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Ładowanie danych raportu...</span>
                </div>
              )}

              {/* Preview Button */}
              <div className="flex justify-center pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowEmailPreview(true)}
                  disabled={loading || !currentReportData}
                  className="flex items-center space-x-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Ładowanie...</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-5 h-5" />
                      <span>Podgląd Email</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Email Preview Modal */}
      {showEmailPreview && currentReport && currentClient && currentReportData && (
        <EmailPreviewModal
          isOpen={showEmailPreview}
          onClose={() => setShowEmailPreview(false)}
          clientId={currentReportData.clientId}
          clientName={currentReportData.clientName}
          dateRange={currentReportData.dateRange}
          customMessage=""
          campaigns={[]}
          totals={{}}
          client={currentClient}
          metaTables={[]}
        />
      )}
    </div>
  );
});

export default CalendarEmailPreviewModal;