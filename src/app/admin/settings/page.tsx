'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Settings,
  Mail,
  BarChart3,
  Users,
  Shield,
  Save,
  TestTube,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  Eye,
  EyeOff,
  Send,
  ArrowLeft,
  Server,
  Lock,
  Zap,
  Database,
  Key,
  Globe,
  Calendar,
  UserCheck,
  ShieldCheck,
  Activity,
  Monitor,
  Heart,
  TrendingUp,
  AlertTriangle,
  Search
} from 'lucide-react';
import { useAuth } from '../../../components/AuthProvider';
import { supabase } from '../../../lib/supabase';
import LoadingSpinner from '../../../components/LoadingSpinner';



interface EmailConfig {
  smtp_host: string;
  smtp_port: string;
  smtp_username: string;
  smtp_password: string;
  smtp_secure: boolean;
  email_from_name: string;
  email_from_address: string;
  email_provider: string;
  sendgrid_api_key: string;
  mailgun_api_key: string;
}

interface ReportingConfig {
  default_reporting_frequency: string;
  default_reporting_day: number;
  default_reporting_weekday: number;
  bulk_report_send_enabled: boolean;
  auto_report_generation: boolean;
  report_retention_days: number;
}

interface ClientConfig {
  default_client_status: string;
  auto_assign_tokens: boolean;
  client_approval_required: boolean;
  max_clients_per_admin: number;
}

interface SecurityConfig {
  session_timeout_hours: number;
  require_password_change_days: number;
  max_login_attempts: number;
  lockout_duration_minutes: number;
}

interface GoogleAdsConfig {
  google_ads_developer_token: string;
  google_ads_manager_customer_id: string;
  google_ads_client_id: string;
  google_ads_client_secret: string;
  google_ads_enabled: boolean;
}

interface BulkEmailLog {
  id: string;
  operation_type: string;
  total_recipients: number;
  successful_sends: number;
  failed_sends: number;
  status: string;
  started_at: string;
  completed_at: string | null;
}

export default function AdminSettingsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [sendingBulkReports, setSendingBulkReports] = useState(false);
  

  const [emailConfig, setEmailConfig] = useState<EmailConfig>({
    smtp_host: '',
    smtp_port: '587',
    smtp_username: '',
    smtp_password: '',
    smtp_secure: true,
    email_from_name: '',
    email_from_address: '',
    email_provider: 'smtp',
    sendgrid_api_key: '',
    mailgun_api_key: ''
  });
  
  const [reportingConfig, setReportingConfig] = useState<ReportingConfig>({
    default_reporting_frequency: 'monthly',
    default_reporting_day: 5,
    default_reporting_weekday: 1,
    bulk_report_send_enabled: true,
    auto_report_generation: true,
    report_retention_days: 365
  });
  
  const [clientConfig, setClientConfig] = useState<ClientConfig>({
    default_client_status: 'active',
    auto_assign_tokens: false,
    client_approval_required: false,
    max_clients_per_admin: 100
  });
  
  const [securityConfig, setSecurityConfig] = useState<SecurityConfig>({
    session_timeout_hours: 24,
    require_password_change_days: 90,
    max_login_attempts: 5,
    lockout_duration_minutes: 30
  });
  
  const [googleAdsConfig, setGoogleAdsConfig] = useState<GoogleAdsConfig>({
    google_ads_developer_token: '',
    google_ads_manager_customer_id: '',
    google_ads_client_id: '',
    google_ads_client_secret: '',
    google_ads_enabled: true
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [emailTestStatus, setEmailTestStatus] = useState<'not_configured' | 'testing' | 'success' | 'error'>('not_configured');
  const [emailTestMessage, setEmailTestMessage] = useState('');
  const [lastBulkSend, setLastBulkSend] = useState<BulkEmailLog | null>(null);
  const [bulkSendLogs, setBulkSendLogs] = useState<BulkEmailLog[]>([]);
  
  // Token health state
  const [tokenHealthData, setTokenHealthData] = useState<any[]>([]);
  const [loadingTokenHealth, setLoadingTokenHealth] = useState(false);
  
  // Email logs state
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [loadingEmailLogs, setLoadingEmailLogs] = useState(false);
  const [emailLogSearch, setEmailLogSearch] = useState('');
  
  // Cache management state (Week 3 enhancement)
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [loadingCacheStats, setLoadingCacheStats] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  
  // Monitoring state
  const [systemMetrics, setSystemMetrics] = useState<any>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

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
      
      loadSettings();
    }
  }, [user, profile, authLoading, router]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      // Load system settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('system_settings')
        .select('*')
        .order('key');
      
      if (settingsError) throw settingsError;
      
      // Parse settings into config objects
      const emailSettings = settingsData?.filter(s => s.key.startsWith('smtp_') || s.key.startsWith('email_') || s.key.startsWith('sendgrid_') || s.key.startsWith('mailgun_'));
      const reportingSettings = settingsData?.filter(s => s.key.startsWith('default_') || s.key.startsWith('bulk_') || s.key.startsWith('auto_') || s.key.startsWith('report_'));
      const clientSettings = settingsData?.filter(s => s.key.startsWith('default_client_') || s.key.startsWith('auto_assign_') || s.key.startsWith('client_') || s.key.startsWith('max_clients_'));
      const securitySettings = settingsData?.filter(s => s.key.startsWith('session_') || s.key.startsWith('require_') || s.key.startsWith('max_login_') || s.key.startsWith('lockout_'));
      const googleAdsSettings = settingsData?.filter(s => s.key.startsWith('google_ads_'));
      
      // Update email config
      emailSettings?.forEach(setting => {
        const key = setting.key as keyof EmailConfig;
        if (key in emailConfig) {
          setEmailConfig(prev => ({
            ...prev,
            [key]: setting.value
          }));
        }
      });
      
      // Update reporting config
      reportingSettings?.forEach(setting => {
        const key = setting.key as keyof ReportingConfig;
        if (key in reportingConfig) {
          setReportingConfig(prev => ({
            ...prev,
            [key]: setting.value
          }));
        }
      });
      
      // Update client config
      clientSettings?.forEach(setting => {
        const key = setting.key as keyof ClientConfig;
        if (key in clientConfig) {
          setClientConfig(prev => ({
            ...prev,
            [key]: setting.value
          }));
        }
      });
      
      // Update security config
      securitySettings?.forEach(setting => {
        const key = setting.key as keyof SecurityConfig;
        if (key in securityConfig) {
          setSecurityConfig(prev => ({
            ...prev,
            [key]: setting.value
          }));
        }
      });
      
      // Update Google Ads config
      googleAdsSettings?.forEach(setting => {
        const key = setting.key as keyof GoogleAdsConfig;
        if (key in googleAdsConfig) {
          setGoogleAdsConfig(prev => ({
            ...prev,
            [key]: setting.value
          }));
        }
      });
      
      // Load email test status
      const emailTestSetting = settingsData?.find(s => s.key === 'email_test_status');
      if (emailTestSetting && emailTestSetting.value) {
        setEmailTestStatus(emailTestSetting.value as 'not_configured' | 'testing' | 'success' | 'error');
      }
      
      const emailTestResult = settingsData?.find(s => s.key === 'email_test_result');
      if (emailTestResult && emailTestResult.value) {
        setEmailTestMessage(emailTestResult.value as string);
      }
      
      // Load bulk email logs
      await loadBulkEmailLogs();
      
      // Load additional data for new sections
      loadTokenHealthData();
      loadEmailLogs();
      loadSystemMetrics();
      loadCacheStats(); // Week 3 enhancement
      
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBulkEmailLogs = async () => {
    try {
      const { data: logs, error } = await supabase
        .from('email_logs_bulk')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      setBulkSendLogs((logs as BulkEmailLog[]) || []);
      setLastBulkSend((logs?.[0] as BulkEmailLog) || null);
    } catch (error) {
      console.error('Error loading bulk email logs:', error);
    }
  };

  const loadTokenHealthData = async () => {
    try {
      setLoadingTokenHealth(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch('/api/clients', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setTokenHealthData(result.clients || []);
      }
    } catch (error) {
      console.error('Error loading token health data:', error);
    } finally {
      setLoadingTokenHealth(false);
    }
  };

  const loadEmailLogs = async () => {
    try {
      setLoadingEmailLogs(true);
      const { data: logs, error } = await supabase
        .from('email_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      setEmailLogs(logs || []);
    } catch (error) {
      console.error('Error loading email logs:', error);
    } finally {
      setLoadingEmailLogs(false);
    }
  };

  // Cache management functions (Week 3 enhancement)
  const loadCacheStats = async () => {
    try {
      setLoadingCacheStats(true);
      const response = await fetch('/api/admin/daily-metrics-cache-stats');
      if (response.ok) {
        const stats = await response.json();
        setCacheStats(stats);
      }
    } catch (error) {
      console.error('Error loading cache stats:', error);
    } finally {
      setLoadingCacheStats(false);
    }
  };

  const clearDailyMetricsCache = async (clientId?: string) => {
    try {
      setClearingCache(true);
      const url = clientId 
        ? `/api/admin/clear-daily-metrics-cache?clientId=${clientId}`
        : '/api/admin/clear-daily-metrics-cache';
      
      const response = await fetch(url, { method: 'POST' });
      if (response.ok) {
        await loadCacheStats(); // Refresh stats
        alert(clientId ? `Cache cleared for client ${clientId}` : 'All daily metrics cache cleared');
      } else {
        throw new Error('Failed to clear cache');
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      alert('Error clearing cache');
    } finally {
      setClearingCache(false);
    }
  };

  const loadSystemMetrics = async () => {
    try {
      setLoadingMetrics(true);
      const response = await fetch('/api/health');
      if (response.ok) {
        const metrics = await response.json();
        setSystemMetrics(metrics);
      }
    } catch (error) {
      console.error('Error loading system metrics:', error);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const saveSettings = async (section: string) => {
    try {
      setSaving(true);
      
      let settingsToUpdate: { key: string; value: any }[] = [];
      
      switch (section) {
        case 'email':
          settingsToUpdate = [
            { key: 'smtp_host', value: emailConfig.smtp_host },
            { key: 'smtp_port', value: emailConfig.smtp_port },
            { key: 'smtp_username', value: emailConfig.smtp_username },
            { key: 'smtp_password', value: emailConfig.smtp_password },
            { key: 'smtp_secure', value: emailConfig.smtp_secure },
            { key: 'email_from_name', value: emailConfig.email_from_name },
            { key: 'email_from_address', value: emailConfig.email_from_address },
            { key: 'email_provider', value: emailConfig.email_provider },
            { key: 'sendgrid_api_key', value: emailConfig.sendgrid_api_key },
            { key: 'mailgun_api_key', value: emailConfig.mailgun_api_key }
          ];
          break;
          
        case 'reporting':
          settingsToUpdate = [
            { key: 'default_reporting_frequency', value: reportingConfig.default_reporting_frequency },
            { key: 'default_reporting_day', value: reportingConfig.default_reporting_day },
            { key: 'default_reporting_weekday', value: reportingConfig.default_reporting_weekday },
            { key: 'bulk_report_send_enabled', value: reportingConfig.bulk_report_send_enabled },
            { key: 'auto_report_generation', value: reportingConfig.auto_report_generation },
            { key: 'report_retention_days', value: reportingConfig.report_retention_days }
          ];
          break;
          
        case 'client':
          settingsToUpdate = [
            { key: 'default_client_status', value: clientConfig.default_client_status },
            { key: 'auto_assign_tokens', value: clientConfig.auto_assign_tokens },
            { key: 'client_approval_required', value: clientConfig.client_approval_required },
            { key: 'max_clients_per_admin', value: clientConfig.max_clients_per_admin }
          ];
          break;
          
        case 'security':
          settingsToUpdate = [
            { key: 'session_timeout_hours', value: securityConfig.session_timeout_hours },
            { key: 'require_password_change_days', value: securityConfig.require_password_change_days },
            { key: 'max_login_attempts', value: securityConfig.max_login_attempts },
            { key: 'lockout_duration_minutes', value: securityConfig.lockout_duration_minutes }
          ];
          break;
          
        case 'google_ads':
          settingsToUpdate = [
            { key: 'google_ads_developer_token', value: googleAdsConfig.google_ads_developer_token },
            { key: 'google_ads_manager_customer_id', value: googleAdsConfig.google_ads_manager_customer_id },
            { key: 'google_ads_client_id', value: googleAdsConfig.google_ads_client_id },
            { key: 'google_ads_client_secret', value: googleAdsConfig.google_ads_client_secret },
            { key: 'google_ads_enabled', value: googleAdsConfig.google_ads_enabled }
          ];
          break;
      }
      
      // Update settings in database
      for (const setting of settingsToUpdate) {
        const { error } = await supabase
          .from('system_settings')
          .update({ value: setting.value })
          .eq('key', setting.key);
        
        if (error) throw error;
      }
      
      // Reload settings to get updated values
      await loadSettings();
      
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const testEmailConfiguration = async () => {
    try {
      setTestingEmail(true);
      setEmailTestStatus('testing');
      
      const response = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailConfig),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setEmailTestStatus('success');
        setEmailTestMessage('Email testowy wysłany pomyślnie!');
        
        // Update test status in database
        await supabase
          .from('system_settings')
          .update({ 
            value: 'success',
            updated_at: new Date().toISOString()
          })
          .eq('key', 'email_test_status');
          
        await supabase
          .from('system_settings')
          .update({ 
            value: 'Email testowy wysłany pomyślnie!',
            updated_at: new Date().toISOString()
          })
          .eq('key', 'email_test_result');
          
      } else {
        setEmailTestStatus('error');
        setEmailTestMessage(result.error || 'Nie udało się wysłać emaila testowego');
        
        // Update test status in database
        await supabase
          .from('system_settings')
          .update({ 
            value: 'error',
            updated_at: new Date().toISOString()
          })
          .eq('key', 'email_test_status');
          
        await supabase
          .from('system_settings')
          .update({ 
            value: result.error || 'Nie udało się wysłać emaila testowego',
            updated_at: new Date().toISOString()
          })
          .eq('key', 'email_test_result');
      }
      
    } catch (error) {
      setEmailTestStatus('error');
      setEmailTestMessage('Wystąpił błąd sieci');
    } finally {
      setTestingEmail(false);
    }
  };

  const sendBulkReports = async () => {
    try {
      setSendingBulkReports(true);
      
      const response = await fetch('/api/admin/send-bulk-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.json();
      
      if (response.ok) {
        // Reload bulk email logs
        await loadBulkEmailLogs();
      } else {
        console.error('Error sending bulk reports:', result.error);
      }
      
    } catch (error) {
      console.error('Error sending bulk reports:', error);
    } finally {
      setSendingBulkReports(false);
    }
  };

  const getEmailStatusIcon = () => {
    switch (emailTestStatus) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'testing':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getEmailStatusText = () => {
    switch (emailTestStatus) {
      case 'success':
        return 'Połączony';
      case 'error':
        return 'Błąd połączenia';
      case 'testing':
        return 'Testowanie...';
      default:
        return 'Not Configured';
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Enhanced Header with Premium Styling */}
      <header className="bg-white/80 backdrop-blur-lg shadow-xl border-b border-gray-200/50 sticky top-0 z-40">
        <div className="max-w-7xl xl:max-w-8xl 2xl:max-w-9xl mx-auto px-6 lg:px-8 xl:px-12 2xl:px-16">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-3 rounded-2xl shadow-lg">
                <Settings className="h-8 w-8 text-white" />
              </div>
              <div className="ml-4">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  Ustawienia administratora
                </h1>
                <p className="text-sm text-gray-600">Zarządzaj konfiguracją systemu, ustawieniami email i preferencjami raportów</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/admin')}
              className="group nav-premium-button hover:border-blue-300"
            >
              <div className="flex items-center">
                <ArrowLeft className="h-4 w-4 mr-2 text-gray-600 group-hover:text-blue-600 transition-colors" />
                <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">Powrót do Admina</span>
              </div>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl xl:max-w-7xl 2xl:max-w-8xl mx-auto px-6 lg:px-8 xl:px-12 2xl:px-16 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Email Configuration */}
          <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl ring-1 ring-black/5 p-8 hover:shadow-3xl transition-all duration-300 ease-out">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-2xl shadow-lg">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Konfiguracja Email</h2>
                  <p className="text-sm text-gray-600">Skonfiguruj ustawienia SMTP i dostawców email</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getEmailStatusIcon()}
                <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                  emailTestStatus === 'success' ? 'bg-green-100 text-green-700' :
                  emailTestStatus === 'error' ? 'bg-red-100 text-red-700' :
                  emailTestStatus === 'testing' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {getEmailStatusText()}
                </span>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Server className="w-4 h-4 text-blue-500" />
                  Dostawca email
                </label>
                <select
                  value={emailConfig.email_provider}
                  onChange={(e) => setEmailConfig(prev => ({ ...prev, email_provider: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 transition-all duration-200"
                >
                  <option value="smtp">SMTP</option>
                  <option value="sendgrid">SendGrid</option>
                  <option value="mailgun">Mailgun</option>
                </select>
              </div>

              {emailConfig.email_provider === 'smtp' && (
                <>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <Globe className="w-4 h-4 text-blue-500" />
                        Host SMTP
                      </label>
                      <input
                        type="text"
                        value={emailConfig.smtp_host}
                        onChange={(e) => setEmailConfig(prev => ({ ...prev, smtp_host: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 transition-all duration-200"
                        placeholder="smtp.gmail.com"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <Server className="w-4 h-4 text-blue-500" />
                        Port SMTP
                      </label>
                      <input
                        type="number"
                        value={emailConfig.smtp_port}
                        onChange={(e) => setEmailConfig(prev => ({ ...prev, smtp_port: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 transition-all duration-200"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-blue-500" />
                        Nazwa użytkownika
                      </label>
                      <input
                        type="text"
                        value={emailConfig.smtp_username}
                        onChange={(e) => setEmailConfig(prev => ({ ...prev, smtp_username: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 transition-all duration-200"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <Lock className="w-4 h-4 text-blue-500" />
                        Hasło
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={emailConfig.smtp_password}
                          onChange={(e) => setEmailConfig(prev => ({ ...prev, smtp_password: e.target.value }))}
                          className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 transition-all duration-200"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                    <input
                      type="checkbox"
                      id="smtp_secure"
                      checked={emailConfig.smtp_secure}
                      onChange={(e) => setEmailConfig(prev => ({ ...prev, smtp_secure: e.target.checked }))}
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                    />
                    <label htmlFor="smtp_secure" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-blue-500" />
                      Użyj SSL/TLS
                    </label>
                  </div>
                </>
              )}

              {emailConfig.email_provider === 'sendgrid' && (
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Key className="w-4 h-4 text-blue-500" />
                    SendGrid API Key
                  </label>
                  <input
                    type="password"
                    value={emailConfig.sendgrid_api_key}
                    onChange={(e) => setEmailConfig(prev => ({ ...prev, sendgrid_api_key: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 transition-all duration-200"
                    placeholder="SG.xxxxxxxxxxxxxxxxxxxxx"
                  />
                </div>
              )}

              {emailConfig.email_provider === 'mailgun' && (
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Key className="w-4 h-4 text-blue-500" />
                    Mailgun API Key
                  </label>
                  <input
                    type="password"
                    value={emailConfig.mailgun_api_key}
                    onChange={(e) => setEmailConfig(prev => ({ ...prev, mailgun_api_key: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 transition-all duration-200"
                    placeholder="key-xxxxxxxxxxxxxxxxxxxxx"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-blue-500" />
                    Nazwa nadawcy
                  </label>
                  <input
                    type="text"
                    value={emailConfig.email_from_name}
                    onChange={(e) => setEmailConfig(prev => ({ ...prev, email_from_name: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 transition-all duration-200"
                    placeholder="Twoja firma"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-500" />
                    Email nadawcy
                  </label>
                  <input
                    type="email"
                    value={emailConfig.email_from_address}
                    onChange={(e) => setEmailConfig(prev => ({ ...prev, email_from_address: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 transition-all duration-200"
                    placeholder="raporty@twojafirma.com"
                  />
                </div>
              </div>

              {emailTestMessage && (
                <div className={`p-3 rounded-md text-sm ${
                  emailTestStatus === 'success' ? 'bg-green-50 text-green-700' :
                  emailTestStatus === 'error' ? 'bg-red-50 text-red-700' :
                  'bg-blue-50 text-blue-700'
                }`}>
                  {emailTestMessage}
                </div>
              )}

              <div className="flex gap-4 pt-6">
                <button
                  onClick={() => saveSettings('email')}
                  disabled={saving}
                  className="btn-premium-success flex items-center gap-2 px-6 py-3"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Zapisywanie...' : 'Zapisz ustawienia email'}
                </button>
                <button
                  onClick={testEmailConfiguration}
                  disabled={testingEmail}
                  className="group nav-premium-button hover:border-blue-300 flex items-center gap-2 px-6 py-3"
                >
                  <TestTube className="w-4 h-4 text-gray-600 group-hover:text-blue-600 transition-colors" />
                  <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">
                    {testingEmail ? 'Testowanie...' : 'Testuj email'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Reporting Settings */}
          <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl ring-1 ring-black/5 p-8 hover:shadow-3xl transition-all duration-300 ease-out">
            <div className="flex items-center gap-4 mb-8">
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-3 rounded-2xl shadow-lg">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Ustawienia raportów</h2>
                <p className="text-sm text-gray-600">Skonfiguruj generowanie i dostarczanie raportów</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-green-500" />
                  Domyślna częstotliwość raportów
                </label>
                <select
                  value={reportingConfig.default_reporting_frequency}
                  onChange={(e) => setReportingConfig(prev => ({ ...prev, default_reporting_frequency: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white text-gray-900 transition-all duration-200"
                >
                  <option value="monthly">Miesięczny</option>
                  <option value="weekly">Tygodniowy</option>
                  <option value="on_demand">Na żądanie</option>
                </select>
              </div>

              {reportingConfig.default_reporting_frequency === 'monthly' && (
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-green-500" />
                    Dzień miesiąca
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={reportingConfig.default_reporting_day}
                    onChange={(e) => setReportingConfig(prev => ({ ...prev, default_reporting_day: parseInt(e.target.value) }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white text-gray-900 transition-all duration-200"
                  />
                </div>
              )}

              {reportingConfig.default_reporting_frequency === 'weekly' && (
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-green-500" />
                    Day of Week
                  </label>
                  <select
                    value={reportingConfig.default_reporting_weekday}
                    onChange={(e) => setReportingConfig(prev => ({ ...prev, default_reporting_weekday: parseInt(e.target.value) }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white text-gray-900 transition-all duration-200"
                  >
                    <option value={1}>Poniedziałek</option>
                    <option value={2}>Wtorek</option>
                    <option value={3}>Środa</option>
                    <option value={4}>Czwartek</option>
                    <option value={5}>Piątek</option>
                    <option value={6}>Sobota</option>
                    <option value={7}>Niedziela</option>
                  </select>
                </div>
              )}

              {/* Calendar Integration */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <h4 className="text-sm font-semibold text-blue-900">Kalendarz raportów</h4>
                  </div>
                  <button
                    onClick={() => router.push('/admin/calendar')}
                    className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Otwórz kalendarz
                  </button>
                </div>
                <p className="text-xs text-blue-700">
                  📅 Zobacz harmonogram automatycznych raportów w kalendarzu. Wszyscy klienci z konfiguracją &quot;{reportingConfig.default_reporting_frequency}&quot; będą otrzymywać raporty 
                  {reportingConfig.default_reporting_frequency === 'monthly' 
                    ? ` ${reportingConfig.default_reporting_day}. dnia każdego miesiąca`
                    : ` w każdy ${['', 'poniedziałek', 'wtorek', 'środę', 'czwartek', 'piątek', 'sobotę', 'niedzielę'][reportingConfig.default_reporting_weekday]}`
                  }.
                </p>
              </div>

              <div className="flex items-center gap-3 p-4 bg-green-50/50 rounded-xl border border-green-100">
                <input
                  type="checkbox"
                  id="bulk_report_send_enabled"
                  checked={reportingConfig.bulk_report_send_enabled}
                  onChange={(e) => setReportingConfig(prev => ({ ...prev, bulk_report_send_enabled: e.target.checked }))}
                  className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500 focus:ring-2"
                />
                <label htmlFor="bulk_report_send_enabled" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Send className="w-4 h-4 text-green-500" />
                  Włącz masowe wysyłanie raportów
                </label>
              </div>

              <div className="flex items-center gap-3 p-4 bg-green-50/50 rounded-xl border border-green-100">
                <input
                  type="checkbox"
                  id="auto_report_generation"
                  checked={reportingConfig.auto_report_generation}
                  onChange={(e) => setReportingConfig(prev => ({ ...prev, auto_report_generation: e.target.checked }))}
                  className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500 focus:ring-2"
                />
                <label htmlFor="auto_report_generation" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-green-500" />
                  Włącz automatyczne generowanie raportów
                </label>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Database className="w-4 h-4 text-green-500" />
                  Przechowywanie raportów (dni)
                </label>
                <input
                  type="number"
                  min="30"
                  max="3650"
                  value={reportingConfig.report_retention_days}
                  onChange={(e) => setReportingConfig(prev => ({ ...prev, report_retention_days: parseInt(e.target.value) }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white text-gray-900 transition-all duration-200"
                />
              </div>

              {/* Last Bulk Send Info */}
              {lastBulkSend && (
                <div className="bg-green-50/50 p-6 rounded-xl border border-green-100">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-green-500" />
                    Ostatnie masowe wysłanie
                  </h4>
                  <div className="text-sm text-gray-600 space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-green-400" />
                      <span>Data: {new Date(lastBulkSend.started_at).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        lastBulkSend.status === 'completed' ? 'bg-green-500' :
                        lastBulkSend.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                      }`}></div>
                      <span>Status: {lastBulkSend.status === 'completed' ? 'Zakończone' : lastBulkSend.status === 'failed' ? 'Nieudane' : lastBulkSend.status === 'running' ? 'W trakcie' : lastBulkSend.status}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Send className="w-4 h-4 text-green-400" />
                      <span>Wysłane: {lastBulkSend.successful_sends}/{lastBulkSend.total_recipients}</span>
                    </div>
                    {lastBulkSend.failed_sends > 0 && (
                      <div className="flex items-center gap-2 text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        <span>Błędy: {lastBulkSend.failed_sends}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-6">
                <button
                  onClick={() => saveSettings('reporting')}
                  disabled={saving}
                  className="btn-premium-success flex items-center gap-2 px-6 py-3"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Zapisywanie...' : 'Zapisz ustawienia raportów'}
                </button>
                <button
                  onClick={sendBulkReports}
                  disabled={sendingBulkReports || !reportingConfig.bulk_report_send_enabled}
                  className="btn-premium flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                >
                  <Send className="w-4 h-4" />
                  {sendingBulkReports ? 'Wysyłanie...' : 'Wyślij wszystkie raporty teraz'}
                </button>
              </div>
            </div>
          </div>

          {/* Client Management Settings */}
          <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl ring-1 ring-black/5 p-8 hover:shadow-3xl transition-all duration-300 ease-out">
            <div className="flex items-center gap-4 mb-8">
              <div className="bg-gradient-to-br from-purple-500 to-pink-600 p-3 rounded-2xl shadow-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Zarządzanie klientami</h2>
                <p className="text-sm text-gray-600">Skonfiguruj wdrażanie klientów i uprawnienia</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-purple-500" />
                  Domyślny status klienta
                </label>
                <select
                  value={clientConfig.default_client_status}
                  onChange={(e) => setClientConfig(prev => ({ ...prev, default_client_status: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white text-gray-900 transition-all duration-200"
                >
                  <option value="active">Aktywny</option>
                  <option value="inactive">Nieaktywny</option>
                  <option value="suspended">Zawieszony</option>
                </select>
              </div>

              <div className="flex items-center gap-3 p-4 bg-purple-50/50 rounded-xl border border-purple-100">
                <input
                  type="checkbox"
                  id="auto_assign_tokens"
                  checked={clientConfig.auto_assign_tokens}
                  onChange={(e) => setClientConfig(prev => ({ ...prev, auto_assign_tokens: e.target.checked }))}
                  className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 focus:ring-2"
                />
                <label htmlFor="auto_assign_tokens" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Key className="w-4 h-4 text-purple-500" />
                  Automatycznie przypisuj tokeny nowym klientom
                </label>
              </div>

              <div className="flex items-center gap-3 p-4 bg-purple-50/50 rounded-xl border border-purple-100">
                <input
                  type="checkbox"
                  id="client_approval_required"
                  checked={clientConfig.client_approval_required}
                  onChange={(e) => setClientConfig(prev => ({ ...prev, client_approval_required: e.target.checked }))}
                  className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 focus:ring-2"
                />
                <label htmlFor="client_approval_required" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-500" />
                  Wymagaj zatwierdzenia administratora dla nowych klientów
                </label>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-500" />
                  Maksymalna liczba klientów na administratora
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={clientConfig.max_clients_per_admin}
                  onChange={(e) => setClientConfig(prev => ({ ...prev, max_clients_per_admin: parseInt(e.target.value) }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white text-gray-900 transition-all duration-200"
                />
              </div>

              <button
                onClick={() => saveSettings('client')}
                disabled={saving}
                className="btn-premium flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Zapisywanie...' : 'Zapisz ustawienia klientów'}
              </button>
            </div>
          </div>

          {/* Security Settings */}
          <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl ring-1 ring-black/5 p-8 hover:shadow-3xl transition-all duration-300 ease-out">
            <div className="flex items-center gap-4 mb-8">
              <div className="bg-gradient-to-br from-red-500 to-rose-600 p-3 rounded-2xl shadow-lg">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Ustawienia bezpieczeństwa</h2>
                <p className="text-sm text-gray-600">Zarządzaj uwierzytelnianiem i kontrolą dostępu</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-red-500" />
                  Limit czasu sesji (godziny)
                </label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={securityConfig.session_timeout_hours}
                  onChange={(e) => setSecurityConfig(prev => ({ ...prev, session_timeout_hours: parseInt(e.target.value) }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white text-gray-900 transition-all duration-200"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-red-500" />
                  Wymagaj zmiany hasła (dni)
                </label>
                <input
                  type="number"
                  min="30"
                  max="365"
                  value={securityConfig.require_password_change_days}
                  onChange={(e) => setSecurityConfig(prev => ({ ...prev, require_password_change_days: parseInt(e.target.value) }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white text-gray-900 transition-all duration-200"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-red-500" />
                  Maksymalna liczba prób logowania
                </label>
                <input
                  type="number"
                  min="3"
                  max="10"
                  value={securityConfig.max_login_attempts}
                  onChange={(e) => setSecurityConfig(prev => ({ ...prev, max_login_attempts: parseInt(e.target.value) }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white text-gray-900 transition-all duration-200"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  Czas blokady (minuty)
                </label>
                <input
                  type="number"
                  min="5"
                  max="1440"
                  value={securityConfig.lockout_duration_minutes}
                  onChange={(e) => setSecurityConfig(prev => ({ ...prev, lockout_duration_minutes: parseInt(e.target.value) }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white text-gray-900 transition-all duration-200"
                />
              </div>

              <button
                onClick={() => saveSettings('security')}
                disabled={saving}
                className="btn-premium flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Zapisywanie...' : 'Zapisz ustawienia bezpieczeństwa'}
              </button>
            </div>
          </div>

          {/* Google Ads Configuration */}
          <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl ring-1 ring-black/5 p-8 hover:shadow-3xl transition-all duration-300 ease-out">
            <div className="flex items-center gap-4 mb-8">
              <div className="bg-gradient-to-br from-blue-500 to-cyan-600 p-3 rounded-2xl shadow-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Google Ads API</h2>
                <p className="text-sm text-gray-600">Skonfiguruj dane uwierzytelniające i ustawienia Google Ads API</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-3 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                <input
                  type="checkbox"
                  id="google_ads_enabled"
                  checked={googleAdsConfig.google_ads_enabled}
                  onChange={(e) => setGoogleAdsConfig(prev => ({ ...prev, google_ads_enabled: e.target.checked }))}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                />
                <label htmlFor="google_ads_enabled" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  Włącz integrację Google Ads
                </label>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Key className="w-4 h-4 text-blue-500" />
                  Token dewelopera
                </label>
                <input
                  type="password"
                  value={googleAdsConfig.google_ads_developer_token}
                  onChange={(e) => setGoogleAdsConfig(prev => ({ ...prev, google_ads_developer_token: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 transition-all duration-200"
                  placeholder="Twój token dewelopera Google Ads"
                />
                <p className="text-xs text-gray-500 mt-1">Your Google Ads API developer token for API access</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  ID klienta menedżera
                </label>
                <input
                  type="text"
                  value={googleAdsConfig.google_ads_manager_customer_id}
                  onChange={(e) => setGoogleAdsConfig(prev => ({ ...prev, google_ads_manager_customer_id: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 transition-all duration-200"
                  placeholder="XXX-XXX-XXXX"
                />
                <p className="text-xs text-gray-500 mt-1">ID klienta konta menedżera (format: XXX-XXX-XXXX)</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-500" />
                    OAuth Client ID
                  </label>
                  <input
                    type="text"
                    value={googleAdsConfig.google_ads_client_id}
                    onChange={(e) => setGoogleAdsConfig(prev => ({ ...prev, google_ads_client_id: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 transition-all duration-200"
                    placeholder="ID klienta OAuth"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-blue-500" />
                    OAuth Client Secret
                  </label>
                  <input
                    type="password"
                    value={googleAdsConfig.google_ads_client_secret}
                    onChange={(e) => setGoogleAdsConfig(prev => ({ ...prev, google_ads_client_secret: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 transition-all duration-200"
                    placeholder="Sekret klienta OAuth"
                  />
                </div>
              </div>

              <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-600" />
                  Instrukcje konfiguracji
                </h4>
                <div className="text-xs text-blue-700 space-y-1">
                  <p>1. Przejdź do <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-800">Google Cloud Console</a></p>
                  <p>2. Utwórz lub wybierz projekt</p>
                  <p>3. Włącz Google Ads API</p>
                  <p>4. Utwórz dane uwierzytelniające OAuth 2.0</p>
                  <p>5. Dodaj swoją domenę do autoryzowanych źródeł</p>
                  <p>6. Skopiuj ID klienta i sekret klienta tutaj</p>
                </div>
              </div>

              <button
                onClick={() => saveSettings('google_ads')}
                disabled={saving}
                className="btn-premium flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
              >
                                <Save className="w-4 h-4" />
                {saving ? 'Zapisywanie...' : 'Zapisz ustawienia Google Ads'}
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Email Logs */}
        {bulkSendLogs.length > 0 && (
          <div className="mt-8 bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl ring-1 ring-black/5 p-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="bg-gradient-to-br from-gray-500 to-gray-600 p-3 rounded-2xl shadow-lg">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Ostatnie logi masowych emailów</h2>
                <p className="text-sm text-gray-600">Śledź wydajność dostarczania emailów</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Operacja
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Wysłane
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Błędy
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white/50 divide-y divide-gray-200">
                  {bulkSendLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(log.started_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.operation_type.replace(/_/g, ' ') === 'bulk report send' ? 'Masowe wysyłanie raportów' : log.operation_type.replace(/_/g, ' ')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          log.status === 'completed' ? 'bg-green-100 text-green-800' :
                          log.status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {log.status === 'completed' ? 'Zakończone' : log.status === 'failed' ? 'Nieudane' : log.status === 'running' ? 'W trakcie' : log.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.successful_sends}/{log.total_recipients}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.failed_sends}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Token Health Section */}
        <div className="mt-8 bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl ring-1 ring-black/5 p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-2xl shadow-lg">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Stan tokenów</h2>
                <p className="text-sm text-gray-600">Monitoruj stan tokenów wszystkich klientów</p>
              </div>
            </div>
            <button
              onClick={loadTokenHealthData}
              disabled={loadingTokenHealth}
              className="group nav-premium-button hover:border-blue-300 flex items-center gap-2 px-4 py-2"
            >
              <RefreshCw className={`w-4 h-4 text-gray-600 group-hover:text-blue-600 transition-colors ${loadingTokenHealth ? 'animate-spin' : ''}`} />
              <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">
                {loadingTokenHealth ? 'Ładowanie...' : 'Odśwież'}
              </span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {tokenHealthData.map((client) => (
              <div key={client.id} className="bg-white/50 rounded-xl p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">{client.name}</h3>
                  <div className={`w-3 h-3 rounded-full ${
                    client.token_health_status === 'valid' ? 'bg-green-500' :
                    client.token_health_status === 'expiring_soon' ? 'bg-orange-500' :
                    'bg-red-500'
                  }`}></div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className={`font-medium ${
                      client.token_health_status === 'valid' ? 'text-green-600' :
                      client.token_health_status === 'expiring_soon' ? 'text-orange-600' :
                      'text-red-600'
                    }`}>
                      {client.token_health_status === 'valid' ? 'Zdrowy' :
                       client.token_health_status === 'expiring_soon' ? 'Wkrótce wygaśnie' :
                       client.token_health_status === 'expired' ? 'Wygasł' : 'Nieprawidłowy'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">API Status:</span>
                    <span className={`font-medium ${
                      client.api_status === 'valid' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {client.api_status === 'valid' ? 'Połączony' : 'Rozłączony'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {tokenHealthData.length === 0 && !loadingTokenHealth && (
            <div className="text-center py-12">
              <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No token data available</p>
            </div>
          )}
        </div>

        {/* Cache Management Section (Week 3 Enhancement) */}
        <div className="mt-8 bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl ring-1 ring-black/5 p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-3 rounded-2xl shadow-lg">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Zarządzanie cache</h2>
                <p className="text-sm text-gray-600">Monitoruj i zarządzaj wydajnością cache dziennych metryk</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={loadCacheStats}
                disabled={loadingCacheStats}
                className="group nav-premium-button hover:border-emerald-300 flex items-center gap-2 px-4 py-2"
              >
                <RefreshCw className={`w-4 h-4 text-gray-600 group-hover:text-emerald-600 transition-colors ${loadingCacheStats ? 'animate-spin' : ''}`} />
                <span className="text-sm font-medium text-gray-700 group-hover:text-emerald-700">
                  {loadingCacheStats ? 'Ładowanie...' : 'Odśwież'}
                </span>
              </button>
            </div>
          </div>

          {cacheStats ? (
            <div className="space-y-6">
              {/* Cache Statistics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-2xl border border-emerald-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-emerald-500 p-2 rounded-lg">
                      <Database className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-2xl font-bold text-emerald-600">{cacheStats.size || 0}</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">Wpisy cache</h3>
                  <p className="text-sm text-gray-600">Aktywne wpisy cache</p>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-blue-500 p-2 rounded-lg">
                      <Clock className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-2xl font-bold text-blue-600">3h</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">TTL cache</h3>
                  <p className="text-sm text-gray-600">Czas życia</p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-2xl border border-purple-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-purple-500 p-2 rounded-lg">
                      <Zap className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-2xl font-bold text-purple-600">Szybko</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">Wydajność</h3>
                  <p className="text-sm text-gray-600">Współczynnik trafień cache</p>
                </div>
              </div>

              {/* Cache Keys */}
              {cacheStats.keys && cacheStats.keys.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Aktywne klucze cache</h3>
                  <div className="bg-gray-50 rounded-xl p-4 max-h-64 overflow-y-auto">
                    <div className="space-y-2">
                      {cacheStats.keys.map((key: string, index: number) => (
                        <div key={index} className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
                          <code className="text-sm text-gray-700 font-mono">{key}</code>
                          <button
                            onClick={() => {
                              const clientId = key.split('_')[2]; // Extract client ID from cache key
                              if (clientId) clearDailyMetricsCache(clientId);
                            }}
                            disabled={clearingCache}
                            className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                          >
                            Clear
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Cache Actions */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                <div>
                  <h3 className="font-semibold text-gray-900">Akcje cache</h3>
                  <p className="text-sm text-gray-600">Zarządzaj danymi cache i wydajnością</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => clearDailyMetricsCache()}
                    disabled={clearingCache}
                    className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <Database className="w-4 h-4" />
                    {clearingCache ? 'Czyszczenie...' : 'Wyczyść cały cache'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              {loadingCacheStats ? (
                <div className="flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
                  <span className="ml-3 text-gray-600">Ładowanie statystyk cache...</span>
                </div>
              ) : (
                <>
                  <Database className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No cache data available</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Email Logs Section */}
        <div className="mt-8 bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl ring-1 ring-black/5 p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-purple-500 to-pink-600 p-3 rounded-2xl shadow-lg">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Logi e-mail</h2>
                <p className="text-sm text-gray-600">Śledź dostarczanie emailów i wydajność</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Szukaj logów..."
                  value={emailLogSearch}
                  onChange={(e) => setEmailLogSearch(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white/50"
                />
              </div>
              <button
                onClick={loadEmailLogs}
                disabled={loadingEmailLogs}
                className="group nav-premium-button hover:border-purple-300 flex items-center gap-2 px-4 py-2"
              >
                <RefreshCw className={`w-4 h-4 text-gray-600 group-hover:text-purple-600 transition-colors ${loadingEmailLogs ? 'animate-spin' : ''}`} />
                <span className="text-sm font-medium text-gray-700 group-hover:text-purple-700">
                  {loadingEmailLogs ? 'Ładowanie...' : 'Odśwież'}
                </span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Znacznik czasu
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Odbiorca
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Temat
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Typ
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white/50 divide-y divide-gray-200">
                {emailLogs
                  .filter(log => 
                    !emailLogSearch || 
                    log.recipient?.toLowerCase().includes(emailLogSearch.toLowerCase()) ||
                    log.subject?.toLowerCase().includes(emailLogSearch.toLowerCase())
                  )
                  .slice(0, 20)
                  .map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.recipient}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {log.subject}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          log.status === 'sent' ? 'bg-green-100 text-green-800' :
                          log.status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {log.status === 'completed' ? 'Zakończone' : log.status === 'failed' ? 'Nieudane' : log.status === 'running' ? 'W trakcie' : log.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.email_type || 'report'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {emailLogs.length === 0 && !loadingEmailLogs && (
            <div className="text-center py-12">
              <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Nie znaleziono logów email</p>
            </div>
          )}
        </div>

        {/* System Monitoring Section */}
        <div className="mt-8 bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl ring-1 ring-black/5 p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-3 rounded-2xl shadow-lg">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Monitorowanie</h2>
                <p className="text-sm text-gray-600">Metryki zdrowia systemu i wydajności</p>
              </div>
            </div>
            <button
              onClick={loadSystemMetrics}
              disabled={loadingMetrics}
              className="group nav-premium-button hover:border-green-300 flex items-center gap-2 px-4 py-2"
            >
              <RefreshCw className={`w-4 h-4 text-gray-600 group-hover:text-green-600 transition-colors ${loadingMetrics ? 'animate-spin' : ''}`} />
              <span className="text-sm font-medium text-gray-700 group-hover:text-green-700">
                {loadingMetrics ? 'Ładowanie...' : 'Odśwież'}
              </span>
            </button>
          </div>

          {systemMetrics ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
              <div className="bg-white/50 rounded-xl p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-2">
                  <Heart className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-medium text-gray-700">Status systemu</span>
                </div>
                <div className="text-2xl font-bold text-green-600">Zdrowy</div>
                <div className="text-xs text-gray-500">Wszystkie systemy działają</div>
              </div>

              <div className="bg-white/50 rounded-xl p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  <span className="text-sm font-medium text-gray-700">Aktywni klienci</span>
                </div>
                <div className="text-2xl font-bold text-blue-600">{systemMetrics.activeClients || '0'}</div>
                <div className="text-xs text-gray-500">Aktualnie połączeni</div>
              </div>

              <div className="bg-white/50 rounded-xl p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-5 h-5 text-purple-500" />
                  <span className="text-sm font-medium text-gray-700">Raporty dzisiaj</span>
                </div>
                <div className="text-2xl font-bold text-purple-600">{systemMetrics.reportsToday || '0'}</div>
                <div className="text-xs text-gray-500">Wygenerowane dzisiaj</div>
              </div>

              <div className="bg-white/50 rounded-xl p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  <span className="text-sm font-medium text-gray-700">Błędy API</span>
                </div>
                <div className="text-2xl font-bold text-orange-600">{systemMetrics.apiErrors || '0'}</div>
                <div className="text-xs text-gray-500">Ostatnie 24 godziny</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Monitor className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Loading system metrics...</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 