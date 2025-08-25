'use client';

import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Eye, Mail, Calendar, User } from 'lucide-react';
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

export default function CalendarEmailPreviewModal({
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

  // Filter reports for the selected date
  const reportsForDate = scheduledReports.filter(report => {
    const reportDate = new Date(report.scheduled_date);
    const selectedDateStr = selectedDate.toDateString();
    return reportDate.toDateString() === selectedDateStr;
  });

  const currentReport = reportsForDate[currentReportIndex];

  // OPTIMIZED: Load clients data only once when modal opens, not on every report change
  useEffect(() => {
    if (isOpen && reportsForDate.length > 0 && Object.keys(clients).length === 0) {
      loadClientsData();
    }
  }, [isOpen, reportsForDate]);

  // OPTIMIZED: Load report data only when current report changes and data not already loaded
  useEffect(() => {
    if (currentReport && !reportData[currentReport.id]) {
      loadReportData(currentReport);
    }
  }, [currentReport]);

  const loadClientsData = async () => {
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
  };

  const loadReportData = async (report: ScheduledReport) => {
    if (reportData[report.id]) return; // Already loaded

    setLoading(true);
    try {
      // Calculate the date range for this report
      const dateRange = calculateDateRange(report);
      
      console.log('🧪 Testing PDF generation for report:', {
        reportId: report.id,
        clientId: report.client_id,
        clientName: report.client_name,
        dateRange,
        reportType: report.report_type
      });

      // Check for pre-generated report first
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        console.warn('⚠️ Authentication issue - checking for generated report only:', {
          sessionError: sessionError?.message,
          hasSession: !!session,
          hasToken: !!session?.access_token
        });
        
        // Try to get generated report without auth (for status display)
        try {
          const generatedReportResponse = await fetch(`/api/generated-reports?clientId=${report.client_id}&reportType=${report.report_type}&periodStart=${dateRange.start}&periodEnd=${dateRange.end}`);
          
          if (generatedReportResponse.ok) {
            const { report: generatedReport } = await generatedReportResponse.json();
            if (generatedReport) {
              console.log('✅ Found generated report:', generatedReport.status);
              setReportData(prev => ({
                ...prev,
                [report.id]: {
                  campaigns: [],
                  totals: {
                    spend: generatedReport.total_spend,
                    impressions: generatedReport.total_impressions,
                    clicks: generatedReport.total_clicks,
                    conversions: generatedReport.total_conversions,
                    ctr: generatedReport.ctr,
                    cpc: generatedReport.cpc,
                    cpm: generatedReport.cpm
                  },
                  metaTables: null,
                  dateRange,
                  pdfTested: generatedReport.status === 'completed',
                  pdfSize: generatedReport.pdf_size_bytes || 0,
                  pdfError: generatedReport.status === 'failed' ? generatedReport.error_message : null,
                  cached: true,
                  polishSummary: generatedReport.polish_summary,
                  polishSubject: generatedReport.polish_subject
                }
              }));
              return;
            }
          }
        } catch (generatedReportError) {
          console.warn('Could not check for generated report:', generatedReportError instanceof Error ? generatedReportError.message : 'Unknown error');
        }
        
        // Check if period has ended to determine appropriate message
        const isPeriodEnded = (() => {
          if (!dateRange.end) return false;
          const endDate = new Date(dateRange.end);
          const now = new Date();
          endDate.setHours(23, 59, 59, 999);
          now.setHours(0, 0, 0, 0);
          return endDate < now;
        })();
        console.log('📅 Period analysis:', {
          periodEnd: dateRange.end,
          isPeriodEnded,
          today: new Date().toISOString().split('T')[0]
        });
        
        // Use mock data if no session and no generated report
        const mockReportData = {
          campaigns: [],
          totals: {
            spend: 12500.50,
            impressions: 250000,
            clicks: 5000,
            conversions: 150,
            ctr: 2.0,
            cpc: 2.5,
            cpm: 50.0
          },
          metaTables: null
        };

        // Determine appropriate error message based on period status
        let errorMessage;
        if (!isPeriodEnded) {
          // Calculate when the report will be generated based on type
          const getGenerationDate = () => {
            if (!dateRange.end) return 'niebawem';
            const endDate = new Date(dateRange.end);
            
            if (report.report_type === 'monthly') {
              // Monthly reports generated on 1st day of next month at 2 AM
              const nextMonth = new Date(endDate);
              nextMonth.setMonth(nextMonth.getMonth() + 1, 1); // 1st day of next month
              nextMonth.setHours(2, 0, 0, 0); // 2 AM
              return nextMonth.toLocaleDateString('pl-PL') + ' o 2:00';
            } else {
              // Weekly reports generated on Monday after the week ends at 2 AM
              const nextMonday = new Date(endDate);
              nextMonday.setDate(endDate.getDate() + 1); // Day after week ends
              // Find next Monday
              const dayOfWeek = nextMonday.getDay();
              const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek); // 0 = Sunday
              nextMonday.setDate(nextMonday.getDate() + daysUntilMonday - 1);
              nextMonday.setHours(2, 0, 0, 0); // 2 AM
              return nextMonday.toLocaleDateString('pl-PL') + ' o 2:00';
            }
          };
          
          const generationDate = getGenerationDate();
          const periodEndFormatted = dateRange.end ? new Date(dateRange.end).toLocaleDateString('pl-PL') : 'okresu';
          
          errorMessage = `Raport zostanie wygenerowany ${generationDate} (po zakończeniu okresu ${periodEndFormatted})`;
        } else {
          errorMessage = sessionError ? `Auth error: ${sessionError.message}` : 'Zaloguj się jako admin aby sprawdzić status raportu';
        }

        setReportData(prev => ({
          ...prev,
          [report.id]: {
            ...mockReportData,
            dateRange,
            pdfTested: !isPeriodEnded ? 'pending' : false,
            pdfSize: 0,
            pdfError: isPeriodEnded ? errorMessage : null,
            pdfInfo: !isPeriodEnded ? errorMessage : null,
            cached: false
          }
        }));
        return;
      }

      // Check if period has ended before attempting PDF generation
      const isPeriodEnded = (() => {
        if (!dateRange.end) return false;
        const endDate = new Date(dateRange.end);
        const now = new Date();
        endDate.setHours(23, 59, 59, 999);
        now.setHours(0, 0, 0, 0);
        return endDate < now;
      })();

      // If period hasn't ended, show waiting message
      if (!isPeriodEnded) {
        console.log('⏳ Period not yet completed, showing waiting message');
        
        // Calculate when the report will be generated
        const getGenerationDate = () => {
          if (!dateRange.end) return 'niebawem';
          const endDate = new Date(dateRange.end);
          
          if (report.report_type === 'monthly') {
            // Monthly reports generated on 1st day of next month at 2 AM
            const nextMonth = new Date(endDate);
            nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
            nextMonth.setHours(2, 0, 0, 0);
            return nextMonth.toLocaleDateString('pl-PL') + ' o 2:00';
          } else {
            // Weekly reports generated on Monday after the week ends at 2 AM
            const nextMonday = new Date(endDate);
            nextMonday.setDate(endDate.getDate() + 1);
            const dayOfWeek = nextMonday.getDay();
            const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
            nextMonday.setDate(nextMonday.getDate() + daysUntilMonday - 1);
            nextMonday.setHours(2, 0, 0, 0);
            return nextMonday.toLocaleDateString('pl-PL') + ' o 2:00';
          }
        };
        
        const generationDate = getGenerationDate();
        const periodEndFormatted = dateRange.end ? new Date(dateRange.end).toLocaleDateString('pl-PL') : 'okresu';
        
        const mockReportData = {
          campaigns: [],
          totals: {
            spend: 0,
            impressions: 0,
            clicks: 0,
            conversions: 0,
            ctr: 0,
            cpc: 0,
            cpm: 0
          },
          metaTables: null
        };

        setReportData(prev => ({
          ...prev,
          [report.id]: {
            ...mockReportData,
            dateRange,
            pdfTested: 'pending',
            pdfSize: 0,
            pdfError: null,
            pdfInfo: `Raport zostanie wygenerowany ${generationDate} (po zakończeniu okresu ${periodEndFormatted})`,
            cached: false
          }
        }));
        return;
      }

      // Test PDF generation with actual API call
      console.log('🔄 Testing PDF generation API...');
      const pdfTestResponse = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          clientId: report.client_id,
          dateRange,
          // Pass empty arrays to trigger data fetching from database
          campaigns: [],
          totals: null,
          client: null,
          metaTables: null
        })
      });

      let pdfTestResult = {
        pdfTested: false,
        pdfSize: 0,
        pdfError: null as string | null
      };

      if (pdfTestResponse.ok) {
        const pdfBuffer = await pdfTestResponse.arrayBuffer();
        pdfTestResult = {
          pdfTested: true,
          pdfSize: pdfBuffer.byteLength,
          pdfError: null as string | null
        };
        console.log('✅ PDF generation test successful:', {
          size: pdfBuffer.byteLength,
          sizeKB: Math.round(pdfBuffer.byteLength / 1024)
        });
      } else {
        let errorMessage = 'PDF generation failed';
        try {
          const errorData = await pdfTestResponse.json();
          errorMessage = errorData.error || `HTTP ${pdfTestResponse.status}: ${pdfTestResponse.statusText}`;
        } catch (parseError) {
          // If JSON parsing fails, it's likely an HTML error page
          if (pdfTestResponse.status === 401) {
            errorMessage = 'Authentication required - please login as admin';
          } else if (pdfTestResponse.status === 404) {
            errorMessage = 'PDF generation API endpoint not found (404)';
          } else if (pdfTestResponse.status === 500) {
            errorMessage = 'Server error (500) - check server logs';
          } else {
            errorMessage = `HTTP ${pdfTestResponse.status}: ${pdfTestResponse.statusText}`;
          }
          
          console.error('❌ API Response parsing failed:', {
            status: pdfTestResponse.status,
            statusText: pdfTestResponse.statusText,
            parseError: parseError
          });
        }
        
        pdfTestResult = {
          pdfTested: false,
          pdfSize: 0,
          pdfError: errorMessage
        };
        console.error('❌ PDF generation test failed:', {
          status: pdfTestResponse.status,
          statusText: pdfTestResponse.statusText,
          error: errorMessage
        });
      }

      // For preview purposes, use reasonable mock data but include PDF test results
      const mockReportData = {
        campaigns: [],
        totals: {
          spend: 12500.50,
          impressions: 250000,
          clicks: 5000,
          conversions: 150,
          ctr: 2.0,
          cpc: 2.5,
          cpm: 50.0
        },
        metaTables: null
      };

      setReportData(prev => ({
        ...prev,
        [report.id]: {
          ...mockReportData,
          dateRange,
          ...pdfTestResult
        }
      }));

    } catch (error) {
      console.error('Error testing report data and PDF:', error);
      
      // Store error information
      const dateRange = calculateDateRange(report);
      setReportData(prev => ({
        ...prev,
        [report.id]: {
          campaigns: [],
          totals: {
            spend: 0,
            impressions: 0,
            clicks: 0,
            conversions: 0,
            ctr: 0,
            cpc: 0,
            cpm: 0
          },
          metaTables: null,
          dateRange,
          pdfTested: false,
          pdfError: error instanceof Error ? error.message : 'Unknown error'
        }
      }));
    } finally {
      setLoading(false);
    }
  };

  // Helper functions (same as reports page)
  const getWeekNumber = (date: Date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  const generatePeriodId = (date: Date, type: 'monthly' | 'weekly') => {
    if (type === 'monthly') {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    } else {
      // For weekly, use proper ISO week format
      const year = date.getFullYear();
      const week = getWeekNumber(date);
      return `${year}-W${String(week).padStart(2, '0')}`;
    }
  };

  const calculateDateRange = (report: ScheduledReport) => {
    if (report.reportPeriodStart && report.reportPeriodEnd) {
      return {
        start: report.reportPeriodStart,
        end: report.reportPeriodEnd
      };
    }

    // Use the EXACT SAME logic as reports page to ensure consistency
    const now = new Date();
    
    if (report.report_type === 'monthly') {
      // Generate current month period ID using reports page logic
      const currentMonthPeriodId = generatePeriodId(now, 'monthly');
      const [year, month] = currentMonthPeriodId.split('-').map(Number);
      
      // Check if this is the current month (same logic as reports page)
      const currentDate = new Date();
      const isCurrentMonth = year === currentDate.getFullYear() && month === (currentDate.getMonth() + 1);
      
      if (isCurrentMonth) {
        // For current month, use today as the end date (same as reports page)
        const startDate = new Date(Date.UTC(year, month - 1, 1));
        const endDate = new Date(); // Today
        
        return {
          start: startDate.toISOString().split('T')[0] || '',
          end: endDate.toISOString().split('T')[0] || ''
        };
      } else {
        // For past months, use the full month (same as reports page)
        return getMonthBoundaries(year || new Date().getFullYear(), month || 1);
      }
    } else if (report.report_type === 'weekly') {
      // Generate current week period ID using reports page logic
      const currentWeekPeriodId = generatePeriodId(now, 'weekly');
      const [year, weekStr] = currentWeekPeriodId.split('-W');
      const week = parseInt(weekStr || '1');
      
      // Proper ISO week calculation (same as reports page)
      const yearNum = parseInt(year || new Date().getFullYear().toString());
      
      // January 4th is always in week 1 of the ISO year
      const jan4 = new Date(yearNum, 0, 4);
      
      // Find the Monday of week 1
      const startOfWeek1 = new Date(jan4);
      startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
      
      // Calculate the start date of the target week
      const weekStartDate = new Date(startOfWeek1);
      weekStartDate.setDate(startOfWeek1.getDate() + (week - 1) * 7);
      
      return getWeekBoundaries(weekStartDate);
    }

    // Default to last 30 days
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 30);
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    };
  };

  const navigateToReport = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentReportIndex > 0) {
      setCurrentReportIndex(currentReportIndex - 1);
    } else if (direction === 'next' && currentReportIndex < reportsForDate.length - 1) {
      setCurrentReportIndex(currentReportIndex + 1);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateRange = (dateRange: { start: string; end: string }) => {
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    if (daysDiff === 7) {
      return `Tydzień ${startDate.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })} - ${endDate.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
    } else if (daysDiff >= 28 && daysDiff <= 31) {
      return startDate.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
    } else {
      return `${startDate.toLocaleDateString('pl-PL')} - ${endDate.toLocaleDateString('pl-PL')}`;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!isOpen) return null;

  if (reportsForDate.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                {formatDate(selectedDate.toISOString())}
              </h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="text-center py-8">
              <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Brak zaplanowanych raportów na ten dzień.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentClient = currentReport ? clients[currentReport.client_id] : undefined;
  const currentReportData = currentReport ? reportData[currentReport.id] : undefined;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Raporty na {formatDate(selectedDate.toISOString())}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation Header */}
          <div className="flex items-center justify-between mb-6 p-4 bg-gray-50 rounded-lg">
            <button
              onClick={() => navigateToReport('prev')}
              disabled={currentReportIndex === 0}
              className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="text-center">
              <div className="text-sm text-gray-600">
                Raport {currentReportIndex + 1} z {reportsForDate.length}
              </div>
              <div className="font-medium text-gray-900">
                {currentClient?.name || 'Ładowanie...'}
              </div>
            </div>
            
            <button
              onClick={() => navigateToReport('next')}
              disabled={currentReportIndex === reportsForDate.length - 1}
              className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Current Report Details */}
          {currentReport && currentClient && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Klient</label>
                    <div className="flex items-center mt-1">
                      <User className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-gray-900">{currentClient.name}</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-600">Email</label>
                    <div className="flex items-center mt-1">
                      <Mail className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-gray-900">{currentClient.email}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600">Status</label>
                    <div className="mt-1">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(currentReport.status)}`}>
                        {currentReport.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Typ raportu</label>
                    <div className="mt-1 text-gray-900 capitalize">{currentReport.report_type}</div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-600">Częstotliwość</label>
                    <div className="mt-1 text-gray-900">{currentReport.frequency}</div>
                  </div>

                  {currentReportData && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Okres raportu</label>
                      <div className="mt-1 text-gray-900">
                        {formatDateRange(currentReportData.dateRange)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Contact Emails */}
              {currentClient.contact_emails && currentClient.contact_emails.length > 1 && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Dodatkowe adresy email</label>
                  <div className="mt-1">
                    {currentClient.contact_emails
                      .filter((email: string) => email !== currentClient.email)
                      .map((email: string, index: number) => (
                        <span key={index} className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded mr-2 mb-1">
                          {email}
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* PDF Generation Status */}
              {currentReportData && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-600">Status Raportu PDF</label>
                    {currentReportData.pdfTested === true ? (
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        ✅ Gotowy
                      </span>
                    ) : currentReportData.pdfTested === 'pending' ? (
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        ⏳ Oczekuje
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                        ❌ Błąd
                      </span>
                    )}
                  </div>
                  
                  {currentReportData.pdfTested === true ? (
                    <div className="text-sm text-gray-700">
                      <div>📎 Rozmiar PDF: {Math.round(currentReportData.pdfSize / 1024)} KB</div>
                      <div>📧 Załącznik email: Meta_Ads_Performance_Report_{new Date().toISOString().split('T')[0]}.pdf</div>
                    </div>
                  ) : currentReportData.pdfTested === 'pending' ? (
                    <div className="text-sm text-blue-700">
                      <div>📅 {currentReportData.pdfInfo}</div>
                      <div className="mt-2 text-xs text-gray-600">
                        💡 Możesz sprawdzić podgląd email - raport zostanie automatycznie dołączony po wygenerowaniu
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-red-700">
                      ⚠️ Błąd: {currentReportData.pdfError || 'Unknown error'}
                    </div>
                  )}
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
          clientId={currentReport.client_id}
          clientName={currentClient.name}
          dateRange={currentReportData.dateRange}
          customMessage=""
          campaigns={currentReportData.campaigns}
          totals={currentReportData.totals}
          client={currentClient}
          metaTables={currentReportData.metaTables}
        />
      )}
    </div>
  );
} 