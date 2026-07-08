'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { 
  Calendar, 
  Clock, 
  Mail, 
  AlertCircle, 
  CheckCircle, 
  RefreshCw,
  Send,
  Eye
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Client {
  id: string;
  name: string;
  email: string;
  reporting_frequency: 'monthly' | 'weekly' | 'on_demand';
  send_day: number;
  last_report_sent_at: string | null;
  next_report_scheduled_at: string | null;
  email_send_count: number;
  api_status: string;
}

interface EmailSchedulerLog {
  id: string;
  client_id: string;
  operation_type: 'scheduled' | 'manual' | 'retry';
  frequency: string;
  send_day: number;
  report_period_start: string;
  report_period_end: string;
  email_sent: boolean;
  email_sent_at: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
}

export default function EmailSchedulePage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [clients, setClients] = useState<Client[]>([]);
  const [schedulerLogs, setSchedulerLogs] = useState<EmailSchedulerLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingManual, setSendingManual] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || profile?.role !== 'admin')) {
      router.push('/auth/login');
      return;
    }

    if (user && profile?.role === 'admin') {
      loadData();
    }
  }, [user, profile, authLoading, router]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select(`
          id,
          name,
          email,
          reporting_frequency,
          send_day,
          last_report_sent_at,
          next_report_scheduled_at,
          email_send_count,
          api_status
        `)
        .eq('admin_id', user?.id)
        .order('name');

      if (clientsError) throw clientsError;

      // Load recent scheduler logs
      const { data: logsData, error: logsError } = await supabase
        .from('email_scheduler_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (logsError) throw logsError;
      setSchedulerLogs(logsData || []);

      const enrichedClients = (clientsData || []).map((client) => {
        const successfulLogs = (logsData || []).filter(
          (log) => log.client_id === client.id && log.email_sent
        );
        const latestSentAt = successfulLogs.reduce<string | null>((latest, log) => {
          const sentAt = log.email_sent_at || log.created_at;
          if (!sentAt) return latest;
          if (!latest || new Date(sentAt) > new Date(latest)) return sentAt;
          return latest;
        }, client.last_report_sent_at);

        return {
          ...client,
          last_report_sent_at: latestSentAt,
          email_send_count: Math.max(client.email_send_count || 0, successfulLogs.length),
        };
      });

      setClients(enrichedClients);

    } catch (error) {
      console.error('Error loading email schedule data:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendManualReport = async (clientId: string) => {
    try {
      setSendingManual(clientId);
      
      const response = await fetch('/api/admin/send-manual-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await supabase.auth.getSession().then(s => s.data.session?.access_token)}`
        },
        body: JSON.stringify({ clientId })
      });

      if (!response.ok) {
        throw new Error('Failed to send manual report');
      }

      // Reload data to show updated status
      await loadData();
      
    } catch (error) {
      console.error('Error sending manual report:', error);
      alert('Failed to send manual report. Please try again.');
    } finally {
      setSendingManual(null);
    }
  };

  const getNextScheduledDateObject = (client: Client): Date | null => {
    if (client.reporting_frequency === 'on_demand') {
      return null;
    }

    if (client.next_report_scheduled_at) {
      return new Date(client.next_report_scheduled_at);
    }

    const today = new Date();
    const currentDay = today.getDate();
    const currentWeekday = today.getDay();

    if (client.reporting_frequency === 'monthly') {
      if (currentDay >= client.send_day) {
        return new Date(today.getFullYear(), today.getMonth() + 1, client.send_day);
      }
      return new Date(today.getFullYear(), today.getMonth(), client.send_day);
    }

    if (client.reporting_frequency === 'weekly') {
      const weekday = currentWeekday === 0 ? 7 : currentWeekday;
      const daysUntilNext = client.send_day - weekday;
      const nextDate = new Date(today);
      nextDate.setDate(today.getDate() + (daysUntilNext <= 0 ? daysUntilNext + 7 : daysUntilNext));
      return nextDate;
    }

    return null;
  };

  const formatScheduleDate = (date: Date): string =>
    date.toLocaleDateString('pl-PL');

  const getNextScheduledDate = (client: Client): string => {
    const nextDate = getNextScheduledDateObject(client);
    if (!nextDate) {
      return client.reporting_frequency === 'on_demand' ? 'On Demand' : 'Unknown';
    }
    return formatScheduleDate(nextDate);
  };

  const toLocalDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getCurrentDuePeriod = (client: Client): { start: string; end: string } | null => {
    const today = new Date();

    if (client.reporting_frequency === 'monthly') {
      if (today.getDate() < client.send_day) return null;

      const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      return {
        start: toLocalDateKey(previousMonth),
        end: toLocalDateKey(lastDayOfMonth),
      };
    }

    if (client.reporting_frequency === 'weekly') {
      const weekday = today.getDay() === 0 ? 7 : today.getDay();
      if (weekday < client.send_day) return null;

      const daysBackToMonday = today.getDay() === 0 ? 6 : today.getDay() - 1;
      const lastMonday = new Date(today);
      lastMonday.setDate(today.getDate() - daysBackToMonday - 7);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);

      return {
        start: toLocalDateKey(lastMonday),
        end: toLocalDateKey(lastSunday),
      };
    }

    return null;
  };

  const periodsMatch = (
    logStart: string,
    logEnd: string,
    dueStart: string,
    dueEnd: string
  ): boolean => {
    if (logStart === dueStart && logEnd === dueEnd) return true;

    const startDiff = Math.abs(
      new Date(`${logStart}T12:00:00`).getTime() - new Date(`${dueStart}T12:00:00`).getTime()
    );
    const endDiff = Math.abs(
      new Date(`${logEnd}T12:00:00`).getTime() - new Date(`${dueEnd}T12:00:00`).getTime()
    );
    return startDiff <= 24 * 60 * 60 * 1000 && endDiff <= 24 * 60 * 60 * 1000;
  };

  const getFrequencyLabel = (frequency: string, sendDay: number): string => {
    if (frequency === 'on_demand') return 'On Demand';
    if (frequency === 'monthly') return `Monthly (${sendDay}${getDaySuffix(sendDay)})`;
    if (frequency === 'weekly') {
      const weekdays = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      return `Weekly (${weekdays[sendDay]})`;
    }
    return frequency;
  };

  const getDaySuffix = (day: number): string => {
    if (day >= 11 && day <= 13) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  const isOverdue = (client: Client): boolean => {
    if (client.reporting_frequency === 'on_demand') return false;

    const duePeriod = getCurrentDuePeriod(client);
    if (!duePeriod) return false;

    const sentForPeriod = schedulerLogs.some(
      (log) =>
        log.client_id === client.id &&
        log.email_sent &&
        periodsMatch(
          log.report_period_start,
          log.report_period_end,
          duePeriod.start,
          duePeriod.end
        )
    );

    return !sentForPeriod;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading email schedule...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Email Schedule Management</h1>
              <p className="text-gray-600">Manage automated email reporting schedules for all clients</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.push('/admin/calendar')}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-lg hover:bg-purple-700 transition-colors flex items-center"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Kalendarz wysyłek
              </button>
              <button
                onClick={() => router.push('/admin')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Powrót do klientów
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Clients</p>
                <p className="text-2xl font-bold text-gray-900">{clients.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Mail className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Monthly Reports</p>
                <p className="text-2xl font-bold text-gray-900">
                  {clients.filter(c => c.reporting_frequency === 'monthly').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Weekly Reports</p>
                <p className="text-2xl font-bold text-gray-900">
                  {clients.filter(c => c.reporting_frequency === 'weekly').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <AlertCircle className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Overdue</p>
                <p className="text-2xl font-bold text-gray-900">
                  {clients.filter(isOverdue).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Client Schedule Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Client Email Schedules</h2>
              <button
                onClick={loadData}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Frequency
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Next Scheduled
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Sent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Sent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {clients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{client.name}</div>
                        <div className="text-sm text-gray-500">{client.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {getFrequencyLabel(client.reporting_frequency, client.send_day)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getNextScheduledDate(client)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {client.last_report_sent_at 
                        ? new Date(client.last_report_sent_at).toLocaleDateString()
                        : 'Never'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {client.email_send_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isOverdue(client) ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Overdue
                        </span>
                      ) : client.api_status === 'valid' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          {client.api_status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => sendManualReport(client.id)}
                          disabled={sendingManual === client.id || client.reporting_frequency === 'on_demand'}
                          className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 disabled:opacity-50"
                        >
                          {sendingManual === client.id ? (
                            <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Send className="h-3 w-3 mr-1" />
                          )}
                          Send Now
                        </button>
                        <button
                          onClick={() => {
                            // TODO: Implement logs view functionality
                            console.log('View logs for client:', client.name);
                          }}
                          className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-gray-700 bg-gray-100 hover:bg-gray-200"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Logs
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-8 bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Email Activity</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Operation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Period
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {schedulerLogs.slice(0, 10).map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(log.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {clients.find(c => c.id === log.client_id)?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        log.operation_type === 'manual' ? 'bg-purple-100 text-purple-800' :
                        log.operation_type === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {log.operation_type.charAt(0).toUpperCase() + log.operation_type.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.report_period_start} to {log.report_period_end}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {log.email_sent ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Sent
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Failed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
} 