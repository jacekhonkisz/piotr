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
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../../../components/AuthProvider';
import { supabase } from '../../../lib/supabase';
import LoadingSpinner from '../../../components/LoadingSpinner';

interface SystemSetting {
  key: string;
  value: any;
  description: string | null;
}

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
  
  const [showPassword, setShowPassword] = useState(false);
  const [emailTestStatus, setEmailTestStatus] = useState<'not_configured' | 'testing' | 'success' | 'error'>('not_configured');
  const [emailTestMessage, setEmailTestMessage] = useState('');
  const [lastBulkSend, setLastBulkSend] = useState<BulkEmailLog | null>(null);
  const [bulkSendLogs, setBulkSendLogs] = useState<BulkEmailLog[]>([]);

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
        setEmailTestMessage('Test email sent successfully!');
        
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
            value: 'Test email sent successfully!',
            updated_at: new Date().toISOString()
          })
          .eq('key', 'email_test_result');
          
      } else {
        setEmailTestStatus('error');
        setEmailTestMessage(result.error || 'Failed to send test email');
        
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
            value: result.error || 'Failed to send test email',
            updated_at: new Date().toISOString()
          })
          .eq('key', 'email_test_result');
      }
      
    } catch (error) {
      setEmailTestStatus('error');
      setEmailTestMessage('Network error occurred');
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
        return 'Connected';
      case 'error':
        return 'Connection Failed';
      case 'testing':
        return 'Testing...';
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
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-3 rounded-2xl shadow-lg">
                <Settings className="h-8 w-8 text-white" />
              </div>
              <div className="ml-4">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  Admin Settings
                </h1>
                <p className="text-sm text-gray-600">Manage system configuration, email settings, and reporting preferences</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/admin')}
              className="group nav-premium-button hover:border-blue-300"
            >
              <div className="flex items-center">
                <ArrowLeft className="h-4 w-4 mr-2 text-gray-600 group-hover:text-blue-600 transition-colors" />
                <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">Back to Admin</span>
              </div>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Email Configuration */}
          <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl ring-1 ring-black/5 p-8 hover:shadow-3xl transition-all duration-300 ease-out">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-2xl shadow-lg">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Email Configuration</h2>
                  <p className="text-sm text-gray-600">Configure SMTP settings and email providers</p>
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
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Server className="w-4 h-4 text-blue-500" />
                  Email Provider
                </label>
                <select
                  value={emailConfig.email_provider}
                  onChange={(e) => setEmailConfig(prev => ({ ...prev, email_provider: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50 backdrop-blur-sm transition-all duration-200"
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
                      <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <Globe className="w-4 h-4 text-blue-500" />
                        SMTP Host
                      </label>
                      <input
                        type="text"
                        value={emailConfig.smtp_host}
                        onChange={(e) => setEmailConfig(prev => ({ ...prev, smtp_host: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50 backdrop-blur-sm transition-all duration-200"
                        placeholder="smtp.gmail.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <Server className="w-4 h-4 text-blue-500" />
                        SMTP Port
                      </label>
                      <input
                        type="number"
                        value={emailConfig.smtp_port}
                        onChange={(e) => setEmailConfig(prev => ({ ...prev, smtp_port: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50 backdrop-blur-sm transition-all duration-200"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-blue-500" />
                        Username
                      </label>
                      <input
                        type="text"
                        value={emailConfig.smtp_username}
                        onChange={(e) => setEmailConfig(prev => ({ ...prev, smtp_username: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50 backdrop-blur-sm transition-all duration-200"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <Lock className="w-4 h-4 text-blue-500" />
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={emailConfig.smtp_password}
                          onChange={(e) => setEmailConfig(prev => ({ ...prev, smtp_password: e.target.value }))}
                          className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50 backdrop-blur-sm transition-all duration-200"
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
                      Use SSL/TLS
                    </label>
                  </div>
                </>
              )}

              {emailConfig.email_provider === 'sendgrid' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Key className="w-4 h-4 text-blue-500" />
                    SendGrid API Key
                  </label>
                  <input
                    type="password"
                    value={emailConfig.sendgrid_api_key}
                    onChange={(e) => setEmailConfig(prev => ({ ...prev, sendgrid_api_key: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50 backdrop-blur-sm transition-all duration-200"
                    placeholder="SG.xxxxxxxxxxxxxxxxxxxxx"
                  />
                </div>
              )}

              {emailConfig.email_provider === 'mailgun' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Key className="w-4 h-4 text-blue-500" />
                    Mailgun API Key
                  </label>
                  <input
                    type="password"
                    value={emailConfig.mailgun_api_key}
                    onChange={(e) => setEmailConfig(prev => ({ ...prev, mailgun_api_key: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50 backdrop-blur-sm transition-all duration-200"
                    placeholder="key-xxxxxxxxxxxxxxxxxxxxx"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-blue-500" />
                    From Name
                  </label>
                  <input
                    type="text"
                    value={emailConfig.email_from_name}
                    onChange={(e) => setEmailConfig(prev => ({ ...prev, email_from_name: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50 backdrop-blur-sm transition-all duration-200"
                    placeholder="Your Company"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-500" />
                    From Email
                  </label>
                  <input
                    type="email"
                    value={emailConfig.email_from_address}
                    onChange={(e) => setEmailConfig(prev => ({ ...prev, email_from_address: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50 backdrop-blur-sm transition-all duration-200"
                    placeholder="reports@yourcompany.com"
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
                  {saving ? 'Saving...' : 'Save Email Settings'}
                </button>
                <button
                  onClick={testEmailConfiguration}
                  disabled={testingEmail}
                  className="group nav-premium-button hover:border-blue-300 flex items-center gap-2 px-6 py-3"
                >
                  <TestTube className="w-4 h-4 text-gray-600 group-hover:text-blue-600 transition-colors" />
                  <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">
                    {testingEmail ? 'Testing...' : 'Test Email'}
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
                <h2 className="text-xl font-bold text-gray-900">Reporting Settings</h2>
                <p className="text-sm text-gray-600">Configure report generation and delivery</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-green-500" />
                  Default Reporting Frequency
                </label>
                <select
                  value={reportingConfig.default_reporting_frequency}
                  onChange={(e) => setReportingConfig(prev => ({ ...prev, default_reporting_frequency: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white/50 backdrop-blur-sm transition-all duration-200"
                >
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="on_demand">On Demand</option>
                </select>
              </div>

              {reportingConfig.default_reporting_frequency === 'monthly' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-green-500" />
                    Day of Month
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={reportingConfig.default_reporting_day}
                    onChange={(e) => setReportingConfig(prev => ({ ...prev, default_reporting_day: parseInt(e.target.value) }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white/50 backdrop-blur-sm transition-all duration-200"
                  />
                </div>
              )}

              {reportingConfig.default_reporting_frequency === 'weekly' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-green-500" />
                    Day of Week
                  </label>
                  <select
                    value={reportingConfig.default_reporting_weekday}
                    onChange={(e) => setReportingConfig(prev => ({ ...prev, default_reporting_weekday: parseInt(e.target.value) }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white/50 backdrop-blur-sm transition-all duration-200"
                  >
                    <option value={1}>Monday</option>
                    <option value={2}>Tuesday</option>
                    <option value={3}>Wednesday</option>
                    <option value={4}>Thursday</option>
                    <option value={5}>Friday</option>
                    <option value={6}>Saturday</option>
                    <option value={7}>Sunday</option>
                  </select>
                </div>
              )}

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
                  Enable bulk report sending
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
                  Enable automatic report generation
                </label>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Database className="w-4 h-4 text-green-500" />
                  Report Retention (days)
                </label>
                <input
                  type="number"
                  min="30"
                  max="3650"
                  value={reportingConfig.report_retention_days}
                  onChange={(e) => setReportingConfig(prev => ({ ...prev, report_retention_days: parseInt(e.target.value) }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white/50 backdrop-blur-sm transition-all duration-200"
                />
              </div>

              {/* Last Bulk Send Info */}
              {lastBulkSend && (
                <div className="bg-green-50/50 p-6 rounded-xl border border-green-100">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-green-500" />
                    Last Bulk Send
                  </h4>
                  <div className="text-sm text-gray-600 space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-green-400" />
                      <span>Date: {new Date(lastBulkSend.started_at).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        lastBulkSend.status === 'completed' ? 'bg-green-500' :
                        lastBulkSend.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                      }`}></div>
                      <span>Status: {lastBulkSend.status}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Send className="w-4 h-4 text-green-400" />
                      <span>Sent: {lastBulkSend.successful_sends}/{lastBulkSend.total_recipients}</span>
                    </div>
                    {lastBulkSend.failed_sends > 0 && (
                      <div className="flex items-center gap-2 text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        <span>Errors: {lastBulkSend.failed_sends}</span>
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
                  {saving ? 'Saving...' : 'Save Reporting Settings'}
                </button>
                <button
                  onClick={sendBulkReports}
                  disabled={sendingBulkReports || !reportingConfig.bulk_report_send_enabled}
                  className="btn-premium flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                >
                  <Send className="w-4 h-4" />
                  {sendingBulkReports ? 'Sending...' : 'Send All Reports Now'}
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
                <h2 className="text-xl font-bold text-gray-900">Client Management</h2>
                <p className="text-sm text-gray-600">Configure client onboarding and permissions</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-purple-500" />
                  Default Client Status
                </label>
                <select
                  value={clientConfig.default_client_status}
                  onChange={(e) => setClientConfig(prev => ({ ...prev, default_client_status: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white/50 backdrop-blur-sm transition-all duration-200"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
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
                  Automatically assign tokens to new clients
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
                  Require admin approval for new clients
                </label>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-500" />
                  Max Clients per Admin
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={clientConfig.max_clients_per_admin}
                  onChange={(e) => setClientConfig(prev => ({ ...prev, max_clients_per_admin: parseInt(e.target.value) }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white/50 backdrop-blur-sm transition-all duration-200"
                />
              </div>

              <button
                onClick={() => saveSettings('client')}
                disabled={saving}
                className="btn-premium flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Client Settings'}
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
                <h2 className="text-xl font-bold text-gray-900">Security Settings</h2>
                <p className="text-sm text-gray-600">Manage authentication and access controls</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-red-500" />
                  Session Timeout (hours)
                </label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={securityConfig.session_timeout_hours}
                  onChange={(e) => setSecurityConfig(prev => ({ ...prev, session_timeout_hours: parseInt(e.target.value) }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white/50 backdrop-blur-sm transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-red-500" />
                  Require Password Change (days)
                </label>
                <input
                  type="number"
                  min="30"
                  max="365"
                  value={securityConfig.require_password_change_days}
                  onChange={(e) => setSecurityConfig(prev => ({ ...prev, require_password_change_days: parseInt(e.target.value) }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white/50 backdrop-blur-sm transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-red-500" />
                  Max Login Attempts
                </label>
                <input
                  type="number"
                  min="3"
                  max="10"
                  value={securityConfig.max_login_attempts}
                  onChange={(e) => setSecurityConfig(prev => ({ ...prev, max_login_attempts: parseInt(e.target.value) }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white/50 backdrop-blur-sm transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  Lockout Duration (minutes)
                </label>
                <input
                  type="number"
                  min="5"
                  max="1440"
                  value={securityConfig.lockout_duration_minutes}
                  onChange={(e) => setSecurityConfig(prev => ({ ...prev, lockout_duration_minutes: parseInt(e.target.value) }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white/50 backdrop-blur-sm transition-all duration-200"
                />
              </div>

              <button
                onClick={() => saveSettings('security')}
                disabled={saving}
                className="btn-premium flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Security Settings'}
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
                <h2 className="text-xl font-bold text-gray-900">Recent Bulk Email Logs</h2>
                <p className="text-sm text-gray-600">Track email delivery performance</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Operation
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sent
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Errors
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
                        {log.operation_type.replace(/_/g, ' ')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          log.status === 'completed' ? 'bg-green-100 text-green-800' :
                          log.status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {log.status}
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
      </main>
    </div>
  );
} 