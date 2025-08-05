'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Calendar, FileText, Send, Eye, ChevronDown, Download } from 'lucide-react';


interface GenerateReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  clientEmail: string;
}

type DateRangeType = 'monthly' | 'quarterly' | 'custom';

interface MonthOption {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
}

interface DateRange {
  start: string;
  end: string;
}

export default function GenerateReportModal({ 
  isOpen, 
  onClose, 
  clientId, 
  clientName, 
  clientEmail
}: GenerateReportModalProps) {
  const [selectedRange, setSelectedRange] = useState<DateRangeType>('monthly');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [monthOptions, setMonthOptions] = useState<MonthOption[]>([]);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<DateRange>(() => {
    const today = new Date();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return {
      start: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`,
      end: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(lastDayOfMonth.getDate()).padStart(2, '0')}`
    };
  });
  const [generating, setGenerating] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [isExistingReport, setIsExistingReport] = useState(false);

  // Generate month options for the last 12 months


  // Reset modal state when it opens
  useEffect(() => {
    if (isOpen) {
      console.log('📅 Modal opened, resetting state...');
      setSelectedRange('monthly');
      setSelectedMonth('');
      setMonthOptions([]);
      setCurrentMonthIndex(0);
      setShowMonthDropdown(false);
      setGenerating(false);
      setReportGenerated(false);
      setPdfUrl(null);
      setError(null);
      setSending(false);
      setEmailSent(false);
      setIsExistingReport(false);
      
      // Reset custom date range to current month
      const today = new Date();
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const currentMonthRange = {
        start: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`,
        end: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(lastDayOfMonth.getDate()).padStart(2, '0')}`
      };
      setCustomDateRange(currentMonthRange);
      console.log('📅 Reset custom date range to current month:', currentMonthRange);
      
      // Generate fresh month options and set default immediately
      const months: MonthOption[] = [];
      
      // Generate last 12 months from today
      for (let i = 0; i < 12; i++) {
        const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const year = date.getFullYear();
        const month = date.getMonth();
        
        const lastDayOfMonth = new Date(year, month + 1, 0);
        
        const monthNames = [
          'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
          'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
        ];
        
        months.push({
          id: `${year}-${String(month + 1).padStart(2, '0')}`,
          label: `${monthNames[month]} ${year}`,
          startDate: `${year}-${String(month + 1).padStart(2, '0')}-01`,
          endDate: `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayOfMonth.getDate()).padStart(2, '0')}`
        });
      }
      
      setMonthOptions(months);
      
      // Set current month as default selection immediately
      if (months.length > 0) {
        const currentMonthId = months[0]?.id || '';
        setSelectedMonth(currentMonthId);
        setCurrentMonthIndex(0);
        console.log('📅 Set default selected month immediately:', currentMonthId);
      }
    }
  }, [isOpen]);

  // Force date inputs to update when customDateRange changes
  useEffect(() => {
    if (isOpen && selectedRange === 'custom') {
      console.log('📅 Custom date range updated:', customDateRange);
    }
  }, [isOpen, selectedRange, customDateRange]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showMonthDropdown && !target.closest('.month-dropdown')) {
        setShowMonthDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMonthDropdown]);

  const getDateRange = useCallback(() => {
    console.log('📅 getDateRange called with:', { selectedRange, selectedMonth, monthOptions: monthOptions.length });
    
    if (selectedRange === 'quarterly') {
      const today = new Date();
      const currentQuarter = Math.floor(today.getMonth() / 3);
      const quarterStart = new Date(today.getFullYear(), currentQuarter * 3, 1);
      const quarterEnd = new Date(today.getFullYear(), (currentQuarter + 1) * 3, 0);
      const result = {
        start: `${quarterStart.getFullYear()}-${String(quarterStart.getMonth() + 1).padStart(2, '0')}-01`,
        end: `${quarterEnd.getFullYear()}-${String(quarterEnd.getMonth() + 1).padStart(2, '0')}-${String(quarterEnd.getDate()).padStart(2, '0')}`
      };
      console.log('📅 Quarterly date range:', result);
      return result;
    } else if (selectedRange === 'monthly' && selectedMonth) {
      const selectedOption = monthOptions.find(option => option.id === selectedMonth);
      if (selectedOption) {
        console.log('📅 Monthly date range from selected option:', selectedOption);
        return {
          start: selectedOption.startDate,
          end: selectedOption.endDate
        };
      }
    } else if (selectedRange === 'custom') {
      console.log('📅 Custom date range:', customDateRange);
      console.log('📅 Custom date range start:', customDateRange.start);
      console.log('📅 Custom date range end:', customDateRange.end);
      return customDateRange;
    }
    
    // Fallback to current month
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const result = {
      start: `${year}-${String(month + 1).padStart(2, '0')}-01`,
      end: `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayOfMonth.getDate()).padStart(2, '0')}`
    };
    console.log('📅 Fallback date range:', result);
    return result;
  }, [selectedRange, selectedMonth, monthOptions, customDateRange]);

  const getRangeLabel = (): string => {
    if (selectedRange === 'quarterly') {
      return 'This Quarter';
    } else if (selectedRange === 'monthly' && selectedMonth) {
      const selectedOption = monthOptions.find(option => option.id === selectedMonth);
      return selectedOption?.label || 'Monthly Range';
    } else if (selectedRange === 'custom') {
      return 'Custom Range';
    }
    return 'Custom Range';
  };

  const generateReport = async () => {
    console.log('📅 Generate Report button clicked');
    console.log('📅 Current state:', { selectedRange, selectedMonth, monthOptions: monthOptions.length });
    
    setGenerating(true);
    setError(null);
    setIsExistingReport(false);
    
    try {
      // Get current session for API calls
      const { supabase } = await import('../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No access token available');
      }

      const dateRange = getDateRange();
      
      console.log('📅 Generate Report Modal - Sending date range:', dateRange);
      console.log('📅 Generate Report Modal - Selected range type:', selectedRange);
      console.log('📅 Generate Report Modal - Selected month:', selectedMonth);
      console.log('📅 Generate Report Modal - Custom date range:', customDateRange);
      console.log('📅 Generate Report Modal - Date range object type:', typeof dateRange);
      console.log('📅 Generate Report Modal - Date range has start:', !!dateRange?.start);
      console.log('📅 Generate Report Modal - Date range has end:', !!dateRange?.end);
      console.log('📅 Generate Report Modal - Date range start value:', dateRange?.start);
      console.log('📅 Generate Report Modal - Date range end value:', dateRange?.end);
      console.log('📅 Generate Report Modal - Custom date range start:', customDateRange?.start);
      console.log('📅 Generate Report Modal - Custom date range end:', customDateRange?.end);
      console.log('📅 Generate Report Modal - Full request body:', JSON.stringify({
        clientId,
        dateRange
      }, null, 2));
      
      // First, generate the report data
      const response = await fetch('/api/generate-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          clientId,
          dateRange
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate report');
      }

      const reportData = await response.json();
      
      // Check if this is an existing report
      if (reportData.report?.is_existing) {
        setIsExistingReport(true);
      }

      // Then generate PDF with Meta Ads tables data
      const pdfResponse = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          clientId,
          dateRange,
          metaTables: reportData.report?.meta_tables // Pass Meta Ads tables data from report generation
        })
      });

      if (!pdfResponse.ok) {
        const errorData = await pdfResponse.json();
        throw new Error(errorData.error || 'Failed to generate PDF');
      }

      // Store the PDF blob for viewing
      const pdfBlob = await pdfResponse.blob();
      const pdfUrl = URL.createObjectURL(pdfBlob);
      setPdfUrl(pdfUrl);
      setReportGenerated(true);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const sendReport = async () => {
    setSending(true);
    setError(null);
    
    try {
      // Get current session for API calls
      const { supabase } = await import('../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No access token available');
      }

      const dateRange = getDateRange();
      
      const response = await fetch('/api/send-interactive-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          clientId,
          dateRange,
          emailRecipient: clientEmail,
          emailSubject: `Raport Meta Ads - ${getRangeLabel()}`,
          emailMessage: `Dzień dobry,\n\nW załączniku znajdziesz interaktywny raport Meta Ads za okres ${getRangeLabel()}.\n\nPozdrawiamy,\nZespół Premium Analytics`
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send report');
      }

      setEmailSent(true);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send report');
    } finally {
      setSending(false);
    }
  };

  const resetModal = () => {
    setSelectedRange('monthly');
    setSelectedMonth('');
    setCurrentMonthIndex(0);
    setShowMonthDropdown(false);
    setGenerating(false);
    setReportGenerated(false);
    setPdfUrl(null);
    setShowPreview(true);
    setError(null);
    setSending(false);
    setEmailSent(false);
    setIsExistingReport(false);
  };

  const handleClose = () => {
    // Clean up PDF URL
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }
    resetModal();
    onClose();
  };



  const selectMonthByIndex = (index: number) => {
    if (index >= 0 && index < monthOptions.length) {
      setCurrentMonthIndex(index);
      setSelectedMonth(monthOptions[index]?.id || '');
      setShowMonthDropdown(false);
    }
  };

  const toggleMonthDropdown = () => {
    setShowMonthDropdown(!showMonthDropdown);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className={`bg-white rounded-xl shadow-xl ${showPreview ? 'max-w-7xl' : 'max-w-4xl'} w-full mx-4 max-h-[90vh] overflow-hidden`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Generate Report</h2>
            <p className="text-gray-600">Client: {clientName}</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                // Regenerate month options
                const today = new Date();
                const months: MonthOption[] = [];
                
                for (let i = 0; i < 12; i++) {
                  const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
                  const year = date.getFullYear();
                  const month = date.getMonth();
                  
                  const lastDayOfMonth = new Date(year, month + 1, 0);
                  
                  const monthNames = [
                    'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
                    'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
                  ];
                  
                  months.push({
                    id: `${year}-${String(month + 1).padStart(2, '0')}`,
                    label: `${monthNames[month]} ${year}`,
                    startDate: `${year}-${String(month + 1).padStart(2, '0')}-01`,
                    endDate: `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayOfMonth.getDate()).padStart(2, '0')}`
                  });
                }
                
                setMonthOptions(months);
                if (months.length > 0) {
                  setSelectedMonth(months[0]?.id || '');
                  setCurrentMonthIndex(0);
                }
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2"
            >
              <FileText className="h-4 w-4" />
              <span>Odśwież</span>
            </button>
            <button
              onClick={generateReport}
              disabled={generating || (selectedRange === 'monthly' && !selectedMonth) || (selectedRange === 'custom' && (!customDateRange.start || !customDateRange.end))}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              <FileText className="h-4 w-4" />
              <span>Generuj PDF</span>
            </button>
            <button
              onClick={sendReport}
              disabled={sending || emailSent || !reportGenerated}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              <Send className="h-4 w-4" />
              <span>Wyślij Raport</span>
            </button>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {!reportGenerated ? (
            // Step 1: Date Range Selection
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Report Period</h3>
                
                {/* Range Type Selection */}
                <div className="flex space-x-3 mb-6">
                  <button
                    onClick={() => setSelectedRange('monthly')}
                    className={`px-4 py-2 rounded-lg border-2 transition-all duration-200 ${
                      selectedRange === 'monthly'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <Calendar className="h-4 w-4 inline mr-2" />
                    Monthly Reports
                  </button>
                  <button
                    onClick={() => setSelectedRange('quarterly')}
                    className={`px-4 py-2 rounded-lg border-2 transition-all duration-200 ${
                      selectedRange === 'quarterly'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <Calendar className="h-4 w-4 inline mr-2" />
                    This Quarter
                  </button>
                  <button
                    onClick={() => setSelectedRange('custom')}
                    className={`px-4 py-2 rounded-lg border-2 transition-all duration-200 ${
                      selectedRange === 'custom'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <Calendar className="h-4 w-4 inline mr-2" />
                    Custom Range
                  </button>
                </div>

                {/* Monthly Rolling View */}
                {selectedRange === 'monthly' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-center">
                      {/* Month Dropdown */}
                      <div className="relative w-full max-w-xs month-dropdown">
                        <button
                          onClick={toggleMonthDropdown}
                          className="w-full p-4 rounded-xl border-2 border-blue-200 bg-white hover:border-blue-300 transition-all duration-200 flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-3">
                            <Calendar className="h-5 w-5 text-blue-600" />
                            <span className="text-lg font-semibold text-gray-900">
                              {monthOptions[currentMonthIndex]?.label || 'Loading...'}
                            </span>
                          </div>
                          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${showMonthDropdown ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown Menu */}
                        {showMonthDropdown && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-64 overflow-y-auto">
                            {monthOptions.map((month, index) => (
                              <button
                                key={month.id}
                                onClick={() => selectMonthByIndex(index)}
                                className={`w-full p-3 text-left hover:bg-gray-50 transition-colors flex items-center space-x-3 ${
                                  index === currentMonthIndex
                                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-500'
                                    : 'text-gray-700'
                                } ${index === 0 ? 'rounded-t-xl' : ''} ${index === monthOptions.length - 1 ? 'rounded-b-xl' : ''}`}
                              >
                                <Calendar className="h-4 w-4 flex-shrink-0" />
                                <div className="flex-1">
                                  <div className="text-sm font-medium">{month.label}</div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {month.startDate} to {month.endDate}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Instruction Text */}
                    <p className="text-center text-sm text-gray-500">
                      Kliknij miesiąc, aby wybrać z listy dostępnych okresów
                    </p>
                  </div>
                )}

                {/* Custom Date Range */}
                {selectedRange === 'custom' && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-700">Select Custom Date Range</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                        <input
                          key={`start-date-${customDateRange.start}`}
                          type="date"
                          defaultValue={customDateRange.start}
                          onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                        <input
                          key={`end-date-${customDateRange.end}`}
                          type="date"
                          defaultValue={customDateRange.end}
                          onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Selected Range Display */}
                {getDateRange().start && getDateRange().end && (
                  <div className="bg-blue-50 rounded-xl p-4">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">
                        {getRangeLabel()}: {getDateRange().start} to {getDateRange().end}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              {/* Close Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            // Step 2: PDF Preview and Send
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Report Generated Successfully</h3>
                <span className="text-sm text-green-600 bg-green-100 px-3 py-1 rounded-full">
                  {getRangeLabel()}
                </span>
              </div>

              {isExistingReport && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-center space-x-2">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-blue-700 text-sm font-medium">Existing Report Retrieved</p>
                      <p className="text-blue-600 text-xs">This report was already generated for the selected date range. We&apos;ve retrieved the existing data instead of creating a new one.</p>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              {emailSent && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-green-700 text-sm">Report sent successfully to {clientEmail}</p>
                </div>
              )}

              {/* PDF Preview Section */}
              {pdfUrl && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-md font-medium text-gray-900">Report Preview</h4>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setShowPreview(!showPreview)}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                      >
                        <Eye className="h-4 w-4" />
                        <span>{showPreview ? 'Hide Preview' : 'Show Preview'}</span>
                      </button>
                      <button
                        onClick={() => window.open(pdfUrl, '_blank')}
                        className="px-3 py-1 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2"
                      >
                        <Eye className="h-4 w-4" />
                        <span>Open in New Tab</span>
                      </button>
                      <button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = pdfUrl;
                          link.download = `meta-ads-report-${getRangeLabel()}.pdf`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="px-3 py-1 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
                      >
                        <Download className="h-4 w-4" />
                        <span>Download</span>
                      </button>
                    </div>
                  </div>

                  {/* PDF Preview iframe - Always visible when PDF is available */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                    <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-4 w-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">Interactive PDF Report</span>
                      </div>
                    </div>
                    <div className="relative" style={{ height: '600px' }}>
                      <iframe
                        src={`${pdfUrl}#toolbar=1&navpanes=1&scrollbar=1`}
                        className="w-full h-full border-0"
                        title="PDF Report Preview"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setReportGenerated(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={sendReport}
                  disabled={sending || emailSent}
                  className="px-6 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  {sending ? (
                    <>
                      <div className="spinner h-4 w-4"></div>
                      <span>Sending...</span>
                    </>
                  ) : emailSent ? (
                    <>
                      <span>Sent ✓</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>Send Report</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 