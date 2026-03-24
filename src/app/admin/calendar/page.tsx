'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Calendar,
  ChevronLeft,
  ChevronRight,
  Mail,
  Clock,
  Users,
  Send,
  AlertCircle,
  CheckCircle,
  Eye,
  X,
  RefreshCw,
  Shield,
  ShieldCheck,
  TestTube,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../../components/AuthProvider';
import { supabase } from '../../../lib/supabase';
import { AdminLoading } from '../../../components/LoadingSpinner';
import CalendarEmailPreviewModal from '../../../components/CalendarEmailPreviewModal';
import { getMonthBoundaries, getWeekBoundaries } from '../../../lib/date-range-utils';

// Types
interface Client {
  id: string;
  name: string;
  email: string;
  reporting_frequency: 'monthly' | 'weekly' | 'on_demand';
  send_day: number | null;
  api_status: string;
}

interface ScheduledReport {
  id: string;
  client_id: string;
  client_name: string;
  client_email: string;
  scheduled_date: string;
  report_type: 'monthly' | 'weekly' | 'custom';
  frequency: string;
  status: 'scheduled' | 'sent' | 'failed' | 'pending';
  created_at: string;
  sent_at?: string | null;
  error_message?: string | null;
  isActual?: boolean; // Added for distinction
  reportPeriodStart?: string; // Added for potential reports
  reportPeriodEnd?: string; // Added for potential reports
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  scheduledReports: ScheduledReport[];
}

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

// Main Calendar Component
export default function AdminCalendarPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [viewMode, setViewMode] = useState<'month' | 'list'>('month');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showCalendarEmailPreview, setShowCalendarEmailPreview] = useState(false);

  // Email Review Mode state
  const [reviewMode, setReviewMode] = useState<boolean | null>(null);
  const [reviewEmail, setReviewEmail] = useState('kontakt@piotrbajerlein.pl');
  const [reviewToggling, setReviewToggling] = useState(false);
  const [hasCustomSmtp, setHasCustomSmtp] = useState(false);
  const [smtpUser, setSmtpUser] = useState<string | null>(null);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);
  const [testClientId, setTestClientId] = useState('');
  const [showTestModal, setShowTestModal] = useState(false);

  const getAuthToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  }, []);

  const loadReviewMode = useCallback(async () => {
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/admin/email-review-mode', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReviewMode(data.reviewMode);
        setReviewEmail(data.reviewEmail);
        setHasCustomSmtp(data.hasCustomSmtp);
        setSmtpUser(data.smtpUser);
      }
    } catch (err) {
      console.error('Failed to load review mode:', err);
    }
  }, [getAuthToken]);

  const toggleReviewMode = useCallback(async () => {
    if (reviewMode === null) return;
    setReviewToggling(true);
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/admin/email-review-mode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ enabled: !reviewMode })
      });
      if (res.ok) {
        const data = await res.json();
        setReviewMode(data.reviewMode);
      }
    } catch (err) {
      console.error('Failed to toggle review mode:', err);
    } finally {
      setReviewToggling(false);
    }
  }, [reviewMode, getAuthToken]);

  const sendTestEmail = useCallback(async (clientId?: string) => {
    setTestSending(true);
    setTestResult(null);
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/admin/test-report-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ clientId: clientId || testClientId || undefined, includePdf: true })
      });
      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.success
          ? `Test wysłany do ${data.sentTo}${data.pdfIncluded ? ` z PDF (${(data.pdfSize / 1024).toFixed(0)} KB)` : ' (bez PDF)'}`
          : `Błąd: ${data.error}`,
        details: data
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: `Błąd: ${err instanceof Error ? err.message : 'Nieznany błąd'}`
      });
    } finally {
      setTestSending(false);
    }
  }, [getAuthToken, testClientId]);

  // Function to cleanup old errors (older than 3 days)
  const cleanupOldErrors = useCallback(async () => {
    try {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const cutoffDate = threeDaysAgo.toISOString().split('T')[0];

      console.log('🧹 Cleaning up errors older than:', cutoffDate);

      const { data, error } = await supabase
        .from('email_scheduler_logs')
        .update({ error_message: null })
        .not('error_message', 'is', null)
        .lt('created_at', cutoffDate);

      if (error) {
        console.warn('⚠️ Error cleanup warning:', error);
      } else {
        console.log('✅ Cleaned up old error messages');
      }
    } catch (error) {
      console.warn('⚠️ Failed to cleanup old errors:', error);
    }
  }, []);

  // Define functions first to avoid circular dependencies
  const loadScheduledReports = useCallback(async () => {
    try {
      // Clean up old errors first
      await cleanupOldErrors();
      
      // Get start and end of current month view
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0);


      // First, get actual scheduled reports from email_scheduler_logs
      const { data: scheduledData, error: scheduledError } = await supabase
        .from('email_scheduler_logs')
        .select(`
          id,
          client_id,
          operation_type,
          frequency,
          report_period_start,
          report_period_end,
          email_sent,
          email_sent_at,
          error_message,
          created_at,
          clients!inner(
            name,
            email
          )
        `)
        .gte('report_period_start', startOfMonth.toISOString().split('T')[0])
        .lte('report_period_end', endOfMonth.toISOString().split('T')[0])
        .order('report_period_start', { ascending: true });

      if (scheduledError) {
        console.error('❌ Error loading scheduled reports:', scheduledError);
        throw scheduledError;
      }


      // Get client configurations to generate potential future schedules
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, email, reporting_frequency, send_day, api_status')
        .eq('api_status', 'valid')
        .neq('reporting_frequency', 'on_demand')
        .order('name');

      if (clientsError) {
        console.error('❌ Error loading clients:', clientsError);
        throw clientsError;
      }


      // Convert actual scheduled reports
      const actualReports: ScheduledReport[] = (scheduledData || []).map(item => ({
        id: item.id,
        client_id: item.client_id || '',
        client_name: (item.clients as any)?.name || 'Nieznany klient',
        client_email: (item.clients as any)?.email || '',
        scheduled_date: item.report_period_start,
        report_type: item.frequency as any,
        frequency: item.frequency,
        status: item.email_sent ? 'sent' : (item.error_message ? 'failed' : 'pending'),
        created_at: item.created_at,
        sent_at: item.email_sent_at,
        error_message: item.error_message,
        isActual: true
      }));

      // Generate potential future schedules based on client configurations
      const potentialReports: ScheduledReport[] = [];
      const today = new Date();
      
      clientsData?.forEach(client => {
        if (client.reporting_frequency === 'on_demand') return;
        
        // Generate schedules for the next 3 months
        for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
          const targetMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
          
          if (client.reporting_frequency === 'monthly') {
            // Monthly reports - send on the specified day of month
            const sendDay = client.send_day || 5;
            const sendDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), sendDay);
            
            // Fix timezone issue: ensure we get the correct date string
            const year = targetMonth.getFullYear();
            const month = targetMonth.getMonth();
            const sendDateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(sendDay).padStart(2, '0')}`;
            
            // Only include future dates
            if (sendDate > today) {
              // For calendar view, monthly reports cover the PREVIOUS month before send date
              // Calculate the previous month from the send date
              const reportMonth = new Date(sendDate.getFullYear(), sendDate.getMonth() - 1, 1);
              const year = reportMonth.getFullYear();
              const month = reportMonth.getMonth() + 1; // getMonth() is 0-based, so add 1
              
              // Always use full month boundaries for calendar view
              const dateRange = getMonthBoundaries(year, month);
              
              const reportPeriodStart = new Date(dateRange.start);
              const reportPeriodEnd = new Date(dateRange.end);
              
              potentialReports.push({
                id: `potential_${client.id}_${targetMonth.getTime()}`,
                client_id: client.id,
                client_name: client.name,
                client_email: client.email,
                scheduled_date: sendDateString,
                report_type: 'monthly',
                frequency: 'monthly',
                status: 'pending',
                created_at: new Date().toISOString(),
                isActual: false,
                reportPeriodStart: reportPeriodStart.toISOString().split('T')[0]!,
                reportPeriodEnd: reportPeriodEnd.toISOString().split('T')[0]!
              });
            }
          } else if (client.reporting_frequency === 'weekly') {
            // Weekly reports - send on the specified day of week
            const weekStart = new Date(targetMonth);
            weekStart.setDate(1);
            
            // Find the first occurrence of the specified weekday in this month
            const targetWeekday = client.send_day || 1; // Monday = 1
            const currentWeekday = weekStart.getDay();
            const daysToAdd = (targetWeekday - currentWeekday + 7) % 7;
            const firstSendDate = new Date(weekStart);
            firstSendDate.setDate(weekStart.getDate() + daysToAdd);
            
            // Generate weekly schedules for this month
            for (let week = 0; week < 4; week++) {
              const sendDate = new Date(firstSendDate);
              sendDate.setDate(firstSendDate.getDate() + (week * 7));
              
              // Only include future dates
              if (sendDate > today) {
                // For weekly reports, cover the PREVIOUS week before send date
                // Calculate the previous week from the send date
                const reportWeekStart = new Date(sendDate);
                reportWeekStart.setDate(sendDate.getDate() - 7); // Go back 7 days
                
                // Find the Monday of that week (ISO week starts on Monday)
                const dayOfWeek = reportWeekStart.getDay();
                const daysFromMonday = (dayOfWeek + 6) % 7; // Convert Sunday=0 to Monday=0 reference
                reportWeekStart.setDate(reportWeekStart.getDate() - daysFromMonday);
                
                const dateRange = getWeekBoundaries(reportWeekStart);
                const reportPeriodStart = new Date(dateRange.start);
                const reportPeriodEnd = new Date(dateRange.end);
                
                potentialReports.push({
                  id: `potential_${client.id}_${sendDate.getTime()}`,
                  client_id: client.id,
                  client_name: client.name,
                  client_email: client.email,
                  scheduled_date: sendDate.toISOString().split('T')[0]!,
                  report_type: 'weekly',
                  frequency: 'weekly',
                  status: 'pending',
                  created_at: new Date().toISOString(),
                  isActual: false,
                  reportPeriodStart: reportPeriodStart.toISOString().split('T')[0]!,
                  reportPeriodEnd: reportPeriodEnd.toISOString().split('T')[0]!
                });
              }
            }
          }
        }
      });

      // Combine actual and potential reports
      const allReports = [...actualReports, ...potentialReports];
      
      // Sort by scheduled date
      allReports.sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());


      setScheduledReports(allReports);
      // DON'T call generateCalendarDays here - let useEffect handle it
    } catch (error) {
      console.error('Error loading scheduled reports:', error);
    }
  }, [currentDate]); // Only depend on currentDate

  const loadClients = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, email, reporting_frequency, send_day, api_status')
        .eq('api_status', 'valid')
        .order('name');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  }, []); // No dependencies - clients don't change based on date

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadScheduledReports(),
        loadClients()
      ]);
    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      setLoading(false);
    }
  }, [loadScheduledReports, loadClients]); // Depend on the memoized functions

  // Auth check - FIXED: Prevent production auto-refresh loops
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/auth/login');
        return;
      }
      
      if (profile?.role !== 'admin') {
        router.push('/admin');
        return;
      }
      
      loadData();
      loadReviewMode();
    }
  }, [user, profile, authLoading, router]); // FIXED: Removed currentDate dependency to prevent production loops

  const generateCalendarDays = useCallback((reports: ScheduledReport[]) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Get first day of month and adjust for week starting on Monday
    const firstDay = new Date(year, month, 1);
    const startOfWeek = new Date(firstDay);
    const dayOfWeek = firstDay.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startOfWeek.setDate(firstDay.getDate() + mondayOffset);
    
    // Generate 42 days (6 weeks)
    const days: CalendarDay[] = [];
    const today = new Date();
    
    for (let i = 0; i < 42; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      
      const dayReports = reports.filter(report => {
        const reportDate = new Date(report.scheduled_date);
        return reportDate.toDateString() === date.toDateString();
      });
      
      days.push({
        date,
        isCurrentMonth: date.getMonth() === month,
        isToday: date.toDateString() === today.toDateString(),
        scheduledReports: dayReports
      });
    }
    
    setCalendarDays(days);
  }, [currentDate]); // FIXED: Memoize with currentDate dependency

  // REMOVED: Problematic memoization that was causing infinite loop

  // Update calendar display when month changes (without reloading data)
  useEffect(() => {
    if (scheduledReports.length > 0) {
      generateCalendarDays(scheduledReports);
    }
  }, [scheduledReports, generateCalendarDays]); // FIXED: Use proper dependencies to prevent production issues



  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDayClick = (day: CalendarDay) => {
    setSelectedDate(day.date);
    
    // If there are scheduled reports for this day, show email preview
    if (day.scheduledReports && day.scheduledReports.length > 0) {
      setShowCalendarEmailPreview(true);
    } else {
      // Otherwise, show create modal
      setShowCreateModal(true);
    }
  };

  const handleScheduleCreated = () => {
    // Auto-refresh disabled - user must manually refresh to see new schedules
    setShowCreateModal(false);
    setSelectedDate(null);
  };



  const sendManualReport = async (clientId: string) => {
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/admin/send-manual-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ clientId })
      });

      if (!response.ok) {
        throw new Error('Failed to send report');
      }

      const modeNote = reviewMode
        ? `\n\nTryb weryfikacji: raport został wysłany do ${reviewEmail} do ręcznej weryfikacji.`
        : '';
      alert(`Raport został wysłany pomyślnie.${modeNote}\nOdśwież stronę aby zobaczyć aktualizacje.`);
    } catch (error) {
      console.error('Error sending manual report:', error);
      alert('Nie udało się wysłać raportu');
    }
  };

  // Create Schedule Form Component
  const CreateScheduleForm = ({ 
    onClose, 
    onScheduleCreated, 
    clients, 
    selectedDate 
  }: { 
    onClose: () => void; 
    onScheduleCreated: () => void; 
    clients: Client[]; 
    selectedDate: Date | null; 
  }) => {
    const [formData, setFormData] = useState({
      clientId: '',
      reportType: 'monthly' as 'monthly' | 'weekly' | 'custom',
      scheduledDate: selectedDate ? selectedDate.toISOString().split('T')[0] : '',
      description: '',
      customPeriodStart: '',
      customPeriodEnd: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.clientId || !formData.scheduledDate) {
        setError('Proszę wypełnić wszystkie wymagane pola');
        return;
      }

      setLoading(true);
      setError('');

      try {
        const response = await fetch('/api/admin/schedule-report', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clientId: formData.clientId,
            scheduledDate: formData.scheduledDate,
            reportType: formData.reportType,
            description: formData.description,
            customPeriodStart: formData.reportType === 'custom' ? formData.customPeriodStart : undefined,
            customPeriodEnd: formData.reportType === 'custom' ? formData.customPeriodEnd : undefined
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create schedule');
        }

        onScheduleCreated();
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Wystąpił błąd podczas tworzenia harmonogramu');
      } finally {
        setLoading(false);
      }
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Klient *
          </label>
          <select
            value={formData.clientId}
            onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            required
          >
            <option value="">Wybierz klienta</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>
                {client.name} ({client.email})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Data wysyłki *
          </label>
          <input
            type="date"
            value={formData.scheduledDate}
            onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Typ raportu *
          </label>
          <select
            value={formData.reportType}
            onChange={(e) => setFormData({ ...formData, reportType: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            required
          >
            <option value="monthly">Miesięczny</option>
            <option value="weekly">Tygodniowy</option>
            <option value="custom">Niestandardowy</option>
          </select>
        </div>

        {formData.reportType === 'custom' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Okres od *
                </label>
                <input
                  type="date"
                  value={formData.customPeriodStart}
                  onChange={(e) => setFormData({ ...formData, customPeriodStart: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2">
                  Okres do *
                </label>
                <input
                  type="date"
                  value={formData.customPeriodEnd}
                  onChange={(e) => setFormData({ ...formData, customPeriodEnd: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Opis (opcjonalnie)
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            rows={3}
            placeholder="Dodatkowe informacje o raporcie..."
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Anuluj
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? 'Tworzenie...' : 'Utwórz harmonogram'}
          </button>
        </div>
      </form>
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-3 w-3" />;
      case 'failed':
        return <AlertCircle className="h-3 w-3" />;
      case 'pending':
        return <Clock className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  if (authLoading || loading) {
    return <AdminLoading text="Ładowanie kalendarza..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg shadow-xl border-b border-gray-200/50 sticky top-0 z-40">
        <div className="max-w-7xl xl:max-w-8xl 2xl:max-w-9xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 sm:py-6 space-y-4 sm:space-y-0">
            <div className="flex items-center">
              <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-2 sm:p-3 rounded-xl sm:rounded-2xl shadow-lg">
                <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
              <div className="ml-3 sm:ml-4">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">Kalendarz wysyłek</h1>
                <p className="text-sm sm:text-base text-gray-600">Zarządzaj harmonogramem wysyłki raportów</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:space-x-3 w-full sm:w-auto">
              <button
                onClick={() => router.push('/admin')}
                className="group nav-premium-button hover:border-indigo-300 min-h-[44px] flex-1 sm:flex-none"
              >
                <div className="flex items-center justify-center">
                  <ChevronLeft className="h-4 w-4 mr-1 sm:mr-2 text-gray-600 group-hover:text-indigo-600 transition-colors" />
                  <span className="text-xs sm:text-sm font-medium text-gray-700 group-hover:text-indigo-700">Panel główny</span>
                </div>
              </button>
              <button
                onClick={() => loadData()}
                disabled={loading}
                className="group nav-premium-button hover:border-orange-300 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] flex-1 sm:flex-none"
              >
                <div className="flex items-center justify-center">
                  <RefreshCw className={`h-4 w-4 mr-1 sm:mr-2 text-gray-600 group-hover:text-orange-600 transition-colors ${loading ? 'animate-spin' : ''}`} />
                  <span className="text-xs sm:text-sm font-medium text-gray-700 group-hover:text-orange-700">Odśwież</span>
                </div>
              </button>
              <button
                onClick={() => router.push('/admin')}
                className="group nav-premium-button hover:border-blue-300 min-h-[44px] flex-1 sm:flex-none"
              >
                <div className="flex items-center justify-center">
                  <Users className="h-4 w-4 mr-1 sm:mr-2 text-gray-600 group-hover:text-blue-600 transition-colors" />
                  <span className="text-xs sm:text-sm font-medium text-gray-700 group-hover:text-blue-700 hidden sm:inline">Klienci</span>
                  <span className="text-xs sm:text-sm font-medium text-gray-700 group-hover:text-blue-700 sm:hidden">Kl.</span>
                </div>
              </button>
              <button
                onClick={() => router.push('/admin/email-schedule')}
                className="group nav-premium-button hover:border-green-300 min-h-[44px] flex-1 sm:flex-none"
              >
                <div className="flex items-center justify-center">
                  <Mail className="h-4 w-4 mr-1 sm:mr-2 text-gray-600 group-hover:text-green-600 transition-colors" />
                  <span className="text-xs sm:text-sm font-medium text-gray-700 group-hover:text-green-700 hidden sm:inline">Harmonogram e-mail</span>
                  <span className="text-xs sm:text-sm font-medium text-gray-700 group-hover:text-green-700 sm:hidden">Email</span>
                </div>
              </button>
              <button
                onClick={() => router.push('/admin/templates')}
                className="group nav-premium-button hover:border-purple-300 min-h-[44px] flex-1 sm:flex-none"
              >
                <div className="flex items-center justify-center">
                  <Mail className="h-4 w-4 mr-1 sm:mr-2 text-gray-600 group-hover:text-purple-600 transition-colors" />
                  <span className="text-xs sm:text-sm font-medium text-gray-700 group-hover:text-purple-700 hidden sm:inline">Szablony</span>
                  <span className="text-xs sm:text-sm font-medium text-gray-700 group-hover:text-purple-700 sm:hidden">Szab.</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl xl:max-w-8xl 2xl:max-w-9xl mx-auto px-6 lg:px-8 xl:px-12 2xl:px-16 py-8">
        {/* Email Review Mode Banner */}
        {reviewMode !== null && (
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl ring-1 ring-black/5 p-6 mb-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">

              {/* Mode cards — left side */}
              <div className="flex flex-col sm:flex-row gap-3 flex-1">
                {/* Card: Weryfikacja */}
                <div className={`relative flex-1 rounded-xl border-2 p-4 transition-all cursor-default ${
                  reviewMode
                    ? 'border-amber-400 bg-amber-50 shadow-md shadow-amber-100'
                    : 'border-gray-200 bg-gray-50 opacity-50'
                }`}>
                  {reviewMode && (
                    <span className="absolute -top-2.5 left-3 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                      aktywny
                    </span>
                  )}
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`p-1.5 rounded-lg ${reviewMode ? 'bg-amber-100' : 'bg-gray-100'}`}>
                      <Shield className={`h-4 w-4 ${reviewMode ? 'text-amber-600' : 'text-gray-400'}`} />
                    </div>
                    <span className={`font-semibold text-sm ${reviewMode ? 'text-amber-900' : 'text-gray-400'}`}>
                      Tryb weryfikacji
                    </span>
                  </div>
                  <p className={`text-xs leading-relaxed ${reviewMode ? 'text-amber-700' : 'text-gray-400'}`}>
                    Każdy raport trafia najpierw do <strong>{reviewEmail}</strong>. Sprawdzasz PDF, treść i dane — potem ręcznie przesyłasz do klienta.
                  </p>
                  <p className={`text-[11px] mt-2 font-medium ${reviewMode ? 'text-amber-500' : 'text-gray-300'}`}>
                    Idealne do testowania i kontroli jakości
                  </p>
                </div>

                {/* Card: Bezpośredni */}
                <div className={`relative flex-1 rounded-xl border-2 p-4 transition-all cursor-default ${
                  !reviewMode
                    ? 'border-green-400 bg-green-50 shadow-md shadow-green-100'
                    : 'border-gray-200 bg-gray-50 opacity-50'
                }`}>
                  {!reviewMode && (
                    <span className="absolute -top-2.5 left-3 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                      aktywny
                    </span>
                  )}
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`p-1.5 rounded-lg ${!reviewMode ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <ShieldCheck className={`h-4 w-4 ${!reviewMode ? 'text-green-600' : 'text-gray-400'}`} />
                    </div>
                    <span className={`font-semibold text-sm ${!reviewMode ? 'text-green-900' : 'text-gray-400'}`}>
                      Tryb bezpośredni
                    </span>
                  </div>
                  <p className={`text-xs leading-relaxed ${!reviewMode ? 'text-green-700' : 'text-gray-400'}`}>
                    Raport trafia <strong>bezpośrednio do klienta</strong> na jego adres e-mail. Bez pośredniego kroku weryfikacji.
                  </p>
                  <p className={`text-[11px] mt-2 font-medium ${!reviewMode ? 'text-green-500' : 'text-gray-300'}`}>
                    Produkcja — gdy wszystko jest sprawdzone
                  </p>
                </div>
              </div>

              {/* Toggle + test button — right side */}
              <div className="flex flex-col items-center gap-4 min-w-[140px]">
                {/* Toggle switch */}
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {reviewMode ? 'Weryfikacja' : 'Bezpośredni'}
                  </span>
                  <button
                    onClick={toggleReviewMode}
                    disabled={reviewToggling}
                    aria-label={reviewMode ? 'Wyłącz tryb weryfikacji' : 'Włącz tryb weryfikacji'}
                    className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed ${
                      reviewMode
                        ? 'bg-amber-500 focus:ring-amber-400'
                        : 'bg-green-500 focus:ring-green-400'
                    }`}
                  >
                    <span
                      className={`inline-flex h-7 w-7 transform items-center justify-center rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out ${
                        reviewMode ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    >
                      {reviewToggling ? (
                        <Loader2 className="h-3.5 w-3.5 text-gray-400 animate-spin" />
                      ) : reviewMode ? (
                        <Shield className="h-3.5 w-3.5 text-amber-500" />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                      )}
                    </span>
                  </button>
                  {hasCustomSmtp && smtpUser && (
                    <span className="text-[10px] text-gray-400 text-center">SMTP: {smtpUser}</span>
                  )}
                </div>

                {/* Test button */}
                <button
                  onClick={() => setShowTestModal(true)}
                  className="group flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-purple-300 transition-all text-sm font-medium text-gray-600 hover:text-purple-700 w-full justify-center"
                >
                  <TestTube className="h-4 w-4 text-gray-400 group-hover:text-purple-500 transition-colors" />
                  Wyślij test
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Test Email Modal */}
        {showTestModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => { setShowTestModal(false); setTestResult(null); }}></div>
              <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white">
                      <TestTube className="h-5 w-5" />
                      <h3 className="text-lg font-semibold">Test wysyłki e-mail z PDF</h3>
                    </div>
                    <button onClick={() => { setShowTestModal(false); setTestResult(null); }} className="text-white/80 hover:text-white">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  <div>
                    <p className="text-sm text-gray-600 mb-4">
                      Wyślij testowy e-mail z raportem PDF aby zweryfikować czy system działa poprawnie.
                      {reviewMode && (
                        <span className="block mt-1 text-amber-700 font-medium">
                          Tryb weryfikacji: e-mail trafi do {reviewEmail}
                        </span>
                      )}
                    </p>

                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Wybierz klienta (opcjonalnie — dla danych PDF)
                    </label>
                    <select
                      value={testClientId}
                      onChange={(e) => setTestClientId(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="">Bez klienta (test bez PDF)</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>
                          {client.name} ({client.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* SMTP Info */}
                  <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Provider:</span>
                      <span className="font-medium">{hasCustomSmtp ? `Custom SMTP (${smtpUser})` : 'Resend / Gmail'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tryb:</span>
                      <span className={`font-medium ${reviewMode ? 'text-amber-700' : 'text-green-700'}`}>
                        {reviewMode ? 'Weryfikacja' : 'Bezpośredni'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Odbiorca:</span>
                      <span className="font-medium">{reviewMode ? reviewEmail : (testClientId ? 'e-mail klienta' : reviewEmail)}</span>
                    </div>
                  </div>

                  {/* Result */}
                  {testResult && (
                    <div className={`rounded-xl p-4 ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                      <div className="flex items-start gap-2">
                        {testResult.success ? (
                          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className={`text-sm font-medium ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                            {testResult.success ? 'Test zakończony sukcesem!' : 'Test nieudany'}
                          </p>
                          <p className={`text-sm mt-1 ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                            {testResult.message}
                          </p>
                          {testResult.details?.provider && (
                            <p className="text-xs text-gray-500 mt-1">
                              Provider: {testResult.details.provider} | ID: {testResult.details.messageId || 'n/a'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={() => { setShowTestModal(false); setTestResult(null); }}
                      className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50"
                    >
                      Zamknij
                    </button>
                    <button
                      onClick={() => sendTestEmail()}
                      disabled={testSending}
                      className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                      {testSending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Wysyłanie...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Wyślij test
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Calendar Controls */}
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl ring-1 ring-black/5 p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={handlePrevMonth}
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h2 className="text-2xl font-bold text-gray-900">
                {currentDate.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}
              </h2>
              <button
                onClick={handleNextMonth}
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  viewMode === 'month' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Miesiąc
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Lista
              </button>
            </div>
          </div>

          {viewMode === 'month' && (
            <>
              {/* Calendar Header */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nie'].map(day => (
                  <div key={day} className="p-3 text-center text-sm font-medium text-gray-600">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => (
                  <div
                    key={index}
                    onClick={() => handleDayClick(day)}
                    className={`
                      min-h-[100px] p-2 border border-gray-200 rounded-lg cursor-pointer transition-all hover:bg-blue-50 hover:border-blue-300
                      ${!day.isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'bg-white'}
                      ${day.isToday ? 'ring-2 ring-blue-500 bg-blue-50' : ''}
                    `}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-sm font-medium ${day.isToday ? 'text-blue-700' : ''}`}>
                        {day.date.getDate()}
                      </span>
                      {day.scheduledReports.length > 0 && (
                        <span className="bg-blue-100 text-blue-700 text-xs px-1 rounded">
                          {day.scheduledReports.length}
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-1">
                      {day.scheduledReports.slice(0, 2).map(report => (
                        <div
                          key={report.id}
                          className={`text-xs p-1 rounded flex items-center space-x-1 ${
                            report.isActual ? getStatusColor(report.status) : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {report.isActual ? getStatusIcon(report.status) : <Calendar className="h-2 w-2" />}
                          <span className="truncate">{report.client_name}</span>
                        </div>
                      ))}
                      {day.scheduledReports.length > 2 && (
                        <div className="text-xs text-gray-500">
                          +{day.scheduledReports.length - 2} więcej
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {viewMode === 'list' && (
            <div className="space-y-4">
              {scheduledReports.map(report => (
                <div key={report.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        report.status === 'sent' ? 'bg-green-500' :
                        report.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                      }`}></div>
                      <div>
                        <h3 className="font-medium text-gray-900">{report.client_name}</h3>
                        <p className="text-sm text-gray-600">{report.client_email}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(report.scheduled_date).toLocaleDateString('pl-PL')}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">{getReportTypeLabel(report.report_type)}</p>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {report.status === 'pending' && (
                          <>
                            <button
                              onClick={() => sendManualReport(report.client_id)}
                              className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Wyślij teraz"
                            >
                              <Send className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        <button
                          className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
                          title="Zobacz szczegóły"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {report.error_message && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-700">
                        <AlertCircle className="h-4 w-4 inline mr-1" />
                        {report.error_message}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-6 mb-8">
          <div className="bg-white/80 backdrop-blur-lg rounded-xl shadow-lg ring-1 ring-black/5 p-6">
            <div className="flex items-center">
              <div className="bg-green-100 p-3 rounded-xl">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Wysłane</p>
                <p className="text-2xl font-bold text-gray-900">
                  {scheduledReports.filter(r => r.status === 'sent' && r.isActual).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-lg rounded-xl shadow-lg ring-1 ring-black/5 p-6">
            <div className="flex items-center">
              <div className="bg-yellow-100 p-3 rounded-xl">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Oczekujące</p>
                <p className="text-2xl font-bold text-gray-900">
                  {scheduledReports.filter(r => r.status === 'pending' && r.isActual).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-lg rounded-xl shadow-lg ring-1 ring-black/5 p-6">
            <div className="flex items-center">
              <div className="bg-red-100 p-3 rounded-xl">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Błędy</p>
                <p className="text-2xl font-bold text-gray-900">
                  {scheduledReports.filter(r => r.status === 'failed' && r.isActual).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-lg rounded-xl shadow-lg ring-1 ring-black/5 p-6">
            <div className="flex items-center">
              <div className="bg-purple-100 p-3 rounded-xl">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Planowane</p>
                <p className="text-2xl font-bold text-gray-900">
                  {scheduledReports.filter(r => !r.isActual).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-lg rounded-xl shadow-lg ring-1 ring-black/5 p-6">
            <div className="flex items-center">
              <div className="bg-blue-100 p-3 rounded-xl">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Aktywni klienci</p>
                <p className="text-2xl font-bold text-gray-900">{clients.length}</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Create Schedule Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowCreateModal(false)}></div>
            <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Nowy harmonogram wysyłki
                  </h3>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="p-6">
                <CreateScheduleForm 
                  onClose={() => setShowCreateModal(false)}
                  onScheduleCreated={handleScheduleCreated}
                  clients={clients}
                  selectedDate={selectedDate}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Email Preview Modal */}
      {showCalendarEmailPreview && selectedDate && (
        <CalendarEmailPreviewModal
          key="stable-calendar-email-preview-modal"
          isOpen={showCalendarEmailPreview}
          onClose={() => setShowCalendarEmailPreview(false)}
          selectedDate={selectedDate}
          scheduledReports={scheduledReports}
        />
      )}
    </div>
  );
} 