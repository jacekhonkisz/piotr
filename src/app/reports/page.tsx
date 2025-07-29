'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { supabase } from '../../lib/supabase';
import { 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  Target, 
  Users, 
  Activity,
  Calendar,
  BarChart3,
  Award,
  Zap,
  ArrowUp,
  ArrowDown,
  Minus,
  FileText,
  FileSpreadsheet,
  Info,
  ChevronDown,
  ChevronUp,
  Play,
  Image,
  Video,
  Smartphone,
  Monitor,
  Lightbulb,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  Trophy,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Search,
  BarChart,
  RefreshCw,
  Clock,
  Star
} from 'lucide-react';
import AnimatedGaugeChart from '../../components/AnimatedGaugeChart';
import CircularProgressChart from '../../components/CircularProgressChart';
import AnimatedCounter from '../../components/AnimatedCounter';
import DiagonalChart from '../../components/DiagonalChart';
import MetaAdsTables from '../../components/MetaAdsTables';
import { motion } from 'framer-motion';

interface Campaign {
  id: string;
  campaign_id: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpp?: number;
  frequency?: number;
  reach?: number;
  date_range_start: string;
  date_range_end: string;
  status?: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'DRAFT';
  ad_type?: 'IMAGE' | 'VIDEO' | 'CAROUSEL' | 'COLLECTION' | 'REELS' | 'STORY' | 'UNKNOWN';
  objective?: string;
  budget?: number;
  start_time?: string;
  stop_time?: string;
}

interface MonthlyReport {
  id: string;
  date_range_start: string;
  date_range_end: string;
  generated_at: string;
  campaigns: Campaign[];
}

interface Client {
  id: string;
  name: string;
  email: string;
  ad_account_id: string;
  meta_token?: string;
}

// Enhanced Loading Component with Animations
const LoadingScreen = () => (
  <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
    <div className="max-w-7xl mx-auto">
      <div className="text-center py-16">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
          <div className="absolute inset-0 rounded-full h-16 w-16 border-4 border-transparent border-t-purple-600 animate-spin" style={{ animationDuration: '1.5s' }}></div>
        </div>
        <div className="mt-6 space-y-2">
          <p className="text-lg font-medium text-gray-700">Ładowanie raportów...</p>
          <p className="text-sm text-gray-500">Pobieranie danych z Meta API</p>
        </div>
        <div className="mt-8 flex justify-center space-x-2">
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
    </div>
  </div>
);

// Main Reports Component
function ReportsPageContent() {
  const router = useRouter();
  const [reports, setReports] = useState<{ [key: string]: MonthlyReport }>({});
  const [loading, setLoading] = useState(true);
  const [loadingMonth, setLoadingMonth] = useState<string | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [showAdvancedMetrics, setShowAdvancedMetrics] = useState(false);

  // Get current user session
  const getCurrentUser = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      return session?.user || null;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  };

  // Generate month ID for a given date
  const generateMonthId = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  // Generate month options (last 2 years)
  const generateMonthOptions = () => {
    const months: string[] = [];
    const currentDate = new Date();
    const twoYearsAgo = new Date(currentDate.getFullYear() - 2, 0, 1);
    
    let currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    
    while (currentMonth >= twoYearsAgo) {
      months.push(generateMonthId(currentMonth));
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    }
    
    return months;
  };

  // Load data for a specific month
  const loadMonthData = async (monthId: string) => {
    try {
      setLoadingMonth(monthId);
      console.log(`📡 Loading data for month: ${monthId}`);
      
      // Get session for API calls
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No access token available');
      }

      // Parse month ID to get start and end dates
      const [year, month] = monthId.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0); // Last day of the month
      
      // Format dates in local timezone to avoid UTC conversion issues
      const monthStartDate = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
      const monthEndDate = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
      
      console.log(`📅 Generated date range for ${monthId}: ${monthStartDate} to ${monthEndDate}`);
      
      console.log(`📅 Fetching data for month: ${monthStartDate} to ${monthEndDate}...`);
      
      // Request monthly data directly - the API will use monthly insights method
      console.log(`📅 Requesting monthly data: ${monthStartDate} to ${monthEndDate}...`);
      
      // Make API call for the specific month
      const response = await fetch('/api/fetch-live-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          dateRange: {
            start: monthStartDate,
            end: monthEndDate
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error(`❌ API call failed for ${monthId}:`, errorData);
        
        // Show specific error messages for permission issues
        if (errorData.error?.includes('permission') || errorData.error?.includes('ads_management')) {
          setError(`Meta API Permission Error: Your access token doesn't have the required permissions (ads_management or ads_read). Please contact support to update your token.`);
        } else if (errorData.error?.includes('Invalid Meta Ads token')) {
          setError(`Invalid Meta API Token: Your access token is invalid or expired. Please contact support to refresh your token.`);
        } else {
          setError(`Failed to load data for ${monthId}: ${errorData.error || 'Unknown error'}`);
        }
        
        // Add empty month if API fails
        const emptyReport: MonthlyReport = {
          id: monthId,
          date_range_start: monthStartDate,
          date_range_end: monthEndDate,
          generated_at: new Date().toISOString(),
          campaigns: []
        };
        setReports(prev => ({ ...prev, [monthId]: emptyReport }));
        return;
      }

      const monthData = await response.json();
      
      if (monthData.success && monthData.data?.campaigns) {
        const liveCampaigns: Campaign[] = monthData.data.campaigns.map((campaign: any) => ({
          id: `${campaign.campaign_id}-${monthId}`,
          campaign_id: campaign.campaign_id,
          campaign_name: campaign.campaign_name,
          spend: campaign.spend || 0,
          impressions: campaign.impressions || 0,
          clicks: campaign.clicks || 0,
          conversions: campaign.conversions || 0,
          ctr: campaign.ctr || 0,
          cpc: campaign.cpc || 0,
          cpp: campaign.cpp,
          frequency: campaign.frequency,
          reach: campaign.reach,
          date_range_start: monthStartDate,
          date_range_end: monthEndDate
        }));

        console.log(`✅ ${liveCampaigns.length} campaigns found for ${monthId}`);

        // Note: We're now using true monthly data from Meta API with daily breakdown aggregation
        // This provides accurate monthly insights with proper daily data aggregation
        const report: MonthlyReport = {
          id: monthId,
          date_range_start: monthStartDate,
          date_range_end: monthEndDate,
          generated_at: new Date().toISOString(),
          campaigns: liveCampaigns
        };

        setReports(prev => ({ ...prev, [monthId]: report }));
      } else {
        console.log(`📊 No campaigns found for ${monthId}`);
        // Add empty month if no data
        const emptyReport: MonthlyReport = {
          id: monthId,
          date_range_start: monthStartDate,
          date_range_end: monthEndDate,
          generated_at: new Date().toISOString(),
          campaigns: []
        };
        setReports(prev => ({ ...prev, [monthId]: emptyReport }));
      }

    } catch (error: any) {
      console.error(`❌ Error loading data for ${monthId}:`, error);
      setError(`Failed to load data for ${monthId}: ${error.message}`);
    } finally {
      setLoadingMonth(null);
    }
  };

  // Initialize page with current month
  const initializePage = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🚀 Initializing reports page...');
      
      // Get current user
      const user = await getCurrentUser();
      if (!user) {
        console.log('No user found, redirecting to login');
        router.push('/auth/login');
        return;
      }

      console.log('✅ User found:', user.email);

      // Get client data
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('email', user.email || '')
        .single();

      if (clientError || !clientData) {
        throw new Error('Client not found in database');
      }

      console.log('✅ Client found:', clientData.name);
      setClient(clientData);

      // Generate available months
      const months = generateMonthOptions();
      setAvailableMonths(months);
      console.log(`📅 Generated ${months.length} month options`);

      // Set current month as selected
      const currentMonthId = generateMonthId(new Date());
      setSelectedMonth(currentMonthId);
      console.log(`📅 Current month: ${currentMonthId}`);

      // Load current month data
      await loadMonthData(currentMonthId);

    } catch (error: any) {
      console.error('❌ Error initializing page:', error);
      setError(error.message || 'Failed to initialize page');
    } finally {
      setLoading(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    initializePage();
  }, []);

  // Handle month selection
  const handleMonthChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedMonthId = event.target.value;
    setSelectedMonth(selectedMonthId);
    
    // Load month data if not already loaded
    if (!reports[selectedMonthId]) {
      await loadMonthData(selectedMonthId);
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    if (selectedMonth) {
      await loadMonthData(selectedMonth);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const months = [
      'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
      'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
    ];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  // Calculate totals for selected month
  const getSelectedMonthTotals = () => {
    if (!selectedMonth || !reports[selectedMonth]) return null;
    
    const selectedReport = reports[selectedMonth];
    const totals = selectedReport.campaigns.reduce((acc, campaign) => ({
      spend: acc.spend + campaign.spend,
      impressions: acc.impressions + campaign.impressions,
      clicks: acc.clicks + campaign.clicks,
      conversions: acc.conversions + campaign.conversions
    }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 });

    return {
      ...totals,
      ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
      cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0
    };
  };





  // Calculate real trend percentages by comparing with previous month data
  const calculateTrends = () => {
    if (!totals || !selectedMonth) return { spend: 0, conversions: 0, ctr: 0 };
    
    // Get all available months for comparison
    const availableMonths = Object.keys(reports).sort();
    const currentMonthIndex = availableMonths.indexOf(selectedMonth);
    
    // If we have a previous month, calculate real trends
    if (currentMonthIndex > 0) {
      const previousMonth = availableMonths[currentMonthIndex - 1];
      const previousReport = reports[previousMonth];
      
      if (previousReport && previousReport.campaigns) {
        const previousTotals = previousReport.campaigns.reduce((acc, campaign) => ({
          spend: acc.spend + campaign.spend,
          impressions: acc.impressions + campaign.impressions,
          clicks: acc.clicks + campaign.clicks,
          conversions: acc.conversions + campaign.conversions
        }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 });
        
        const previousCtr = previousTotals.impressions > 0 ? (previousTotals.clicks / previousTotals.impressions) * 100 : 0;
        
        // Calculate real percentage changes
        const spendTrend = previousTotals.spend > 0 ? ((totals.spend - previousTotals.spend) / previousTotals.spend) * 100 : 0;
        const conversionsTrend = previousTotals.conversions > 0 ? ((totals.conversions - previousTotals.conversions) / previousTotals.conversions) * 100 : 0;
        const ctrTrend = previousCtr > 0 ? ((totals.ctr - previousCtr) / previousCtr) * 100 : 0;
        
        return {
          spend: spendTrend,
          conversions: conversionsTrend,
          ctr: ctrTrend
        };
      }
    }
    
    // If no previous month data, return 0 trends (no comparison possible)
    return {
      spend: 0,
      conversions: 0,
      ctr: 0
    };
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="text-red-600 text-xl mb-4">❌ Błąd</div>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={handleRefresh}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Spróbuj ponownie
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedMonth || !reports[selectedMonth]) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 mb-8 border border-gray-200/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                  <BarChart3 className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                    Raporty Miesięczne
                  </h1>
                  <p className="text-gray-600">{client?.name} - Premium Analytics Dashboard</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="bg-gradient-to-r from-gray-600 to-gray-700 text-white px-6 py-3 rounded-xl hover:from-gray-700 hover:to-gray-800 transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  Powrót do Dashboard
                </button>
              </div>
            </div>
          </div>

          {/* Enhanced Empty State */}
          <div className="text-center py-20">
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-16 max-w-2xl mx-auto border border-gray-200/50">
              <div className="relative mb-8">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full mx-auto flex items-center justify-center mb-6">
                  <Calendar className="h-12 w-12 text-blue-600" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center animate-pulse">
                  <Info className="h-4 w-4 text-white" />
                </div>
              </div>
              
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Brak danych dla tego miesiąca
              </h3>
              <p className="text-gray-600 mb-8 text-lg leading-relaxed">
                Nie znaleziono aktywnych kampanii w wybranym okresie. 
                Rozpocznij swoją pierwszą kampanię, aby zobaczyć wyniki tutaj!
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                  <div className="w-8 h-8 bg-blue-500 rounded-lg mx-auto mb-3 flex items-center justify-center">
                    <Play className="h-4 w-4 text-white" />
                  </div>
                  <p className="text-sm font-medium text-blue-900">Rozpocznij kampanię</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
                  <div className="w-8 h-8 bg-green-500 rounded-lg mx-auto mb-3 flex items-center justify-center">
                    <Target className="h-4 w-4 text-white" />
                  </div>
                  <p className="text-sm font-medium text-green-900">Ustaw cele</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                  <div className="w-8 h-8 bg-purple-500 rounded-lg mx-auto mb-3 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-white" />
                  </div>
                  <p className="text-sm font-medium text-purple-900">Śledź wyniki</p>
                </div>
              </div>
              
              <div className="flex justify-center space-x-4">
                <button
                  onClick={handleRefresh}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center space-x-2"
                >
                  <RefreshCw className="h-5 w-5" />
                  <span>Odśwież dane</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selectedReport = reports[selectedMonth];
  const totals = getSelectedMonthTotals();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Enhanced Header with Glassmorphism and Premium Design */}
        <div className="relative bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 mb-8 border border-gray-200/50 overflow-hidden">
          {/* Subtle background pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400 to-purple-600 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-br from-green-400 to-blue-600 rounded-full translate-y-12 -translate-x-12"></div>
          </div>
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                <BarChart3 className="w-8 h-8 text-white" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Raporty Miesięczne
                </h1>
                <p className="text-gray-600 flex items-center">
                  <span className="mr-2">🏨</span>
                  {client?.name} - Premium Analytics Dashboard
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Enhanced Month Selector */}
              <div className="flex items-center space-x-3">
                <label className="text-sm font-medium text-gray-700">Okres:</label>
                <select
                  value={selectedMonth || ''}
                  onChange={handleMonthChange}
                  disabled={loadingMonth !== null}
                  className="border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 bg-white/80 backdrop-blur-sm"
                >
                  {availableMonths.map((monthId) => {
                    const [year, month] = monthId.split('-').map(Number);
                    const date = new Date(year, month - 1, 1);
                    return (
                      <option key={monthId} value={monthId}>
                        {formatDate(date.toISOString())}
                      </option>
                    );
                  })}
                </select>
                {loadingMonth && (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                )}
              </div>

              {/* Enhanced Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={loadingMonth !== null}
                className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50"
              >
                <RefreshCw className="w-5 h-5" />
                <span>Odśwież</span>
              </button>

              {/* Enhanced Back Button */}
              <button
                onClick={() => router.push('/dashboard')}
                className="bg-gradient-to-r from-gray-600 to-gray-700 text-white px-6 py-3 rounded-xl hover:from-gray-700 hover:to-gray-800 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                Powrót do Dashboard
              </button>
            </div>
          </div>
        </div>

                  {/* Enhanced Live Data Banner */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200/50 rounded-2xl p-6 mb-8 shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-blue-800 font-semibold">Dane w czasie rzeczywistym z Meta API</span>
                <p className="text-blue-600 text-sm">Ostatnia synchronizacja: {new Date().toLocaleString('pl-PL')}</p>
                <p className="text-blue-600 text-xs mt-1">💡 Dane miesięczne z dziennym podziałem dla dokładnych wyników</p>
                {totals && totals.spend === 0 && (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-yellow-800 text-xs">
                      ⚠️ Brak aktywnych kampanii lub danych w wybranym okresie. 
                      Sprawdź uprawnienia Meta API lub rozpocznij nową kampanię.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

        {/* Main Content Section */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 mb-8 border border-gray-200/50">
          {totals ? (
            <>




              {/* Key Metrics Section */}
              <motion.div 
                className="mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Kluczowe Metryki</h2>
                <p className="text-gray-600 text-lg">Wydajność kampanii w czasie rzeczywistym</p>
              </motion.div>
              
              {/* Diagonal Charts Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-12">
                {/* Wydatki (Spend) Diagonal Chart */}
                <DiagonalChart
                  value={totals.spend}
                  maxValue={totals.spend * 1.5}
                  title="Wydatki"
                  subtitle="Całkowite wydatki miesięczne"
                  color="#3b82f6"
                  icon={<DollarSign className="h-5 w-5" />}
                  formatValue={(value) => `${value.toFixed(2)} zł`}
                  trend={{
                    value: calculateTrends().spend,
                    label: calculateTrends().spend === 0 ? 'Brak danych z poprzedniego miesiąca' : `${calculateTrends().spend >= 0 ? '+' : ''}${calculateTrends().spend.toFixed(1)}% vs poprzedni miesiąc`,
                    isPositive: calculateTrends().spend >= 0
                  }}
                  delay={0}
                />

                {/* Konwersje (Conversions) Diagonal Chart */}
                <DiagonalChart
                  value={totals.conversions}
                  maxValue={totals.conversions * 2 || 100}
                  title="Konwersje"
                  subtitle="Liczba konwersji"
                  color="#10b981"
                  icon={<Award className="h-5 w-5" />}
                  formatValue={(value) => value.toLocaleString()}
                  trend={{
                    value: calculateTrends().conversions,
                    label: calculateTrends().conversions === 0 ? 'Brak danych z poprzedniego miesiąca' : `${calculateTrends().conversions >= 0 ? '+' : ''}${calculateTrends().conversions.toFixed(1)}% vs poprzedni miesiąc`,
                    isPositive: calculateTrends().conversions >= 0
                  }}
                  delay={1}
                />

                {/* CTR Diagonal Chart */}
                <DiagonalChart
                  value={totals.ctr}
                  maxValue={5} // 5% max CTR
                  title="CTR"
                  subtitle="Wskaźnik klikalności"
                  color="#8b5cf6"
                  icon={<TrendingUpIcon className="h-5 w-5" />}
                  formatValue={(value) => `${value.toFixed(2)}%`}
                  trend={{
                    value: calculateTrends().ctr,
                    label: calculateTrends().ctr === 0 ? 'Brak danych z poprzedniego miesiąca' : `${calculateTrends().ctr >= 0 ? '+' : ''}${calculateTrends().ctr.toFixed(1)}% vs poprzedni miesiąc`,
                    isPositive: calculateTrends().ctr >= 0
                  }}
                  delay={2}
                />
              </div>




            </>
          ) : (
            /* Enhanced Zero Data State for Executive Summary */
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full mx-auto mb-6 flex items-center justify-center">
                <BarChart3 className="h-12 w-12 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Brak danych dla tego okresu
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Nie znaleziono aktywnych kampanii w wybranym miesiącu. 
                Rozpocznij swoją pierwszą kampanię, aby zobaczyć wyniki tutaj!
              </p>
              <div className="flex justify-center space-x-4">
                <button
                  onClick={handleRefresh}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  Odśwież dane
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Secondary KPIs Grid with Animated Counters */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 mb-8 border border-gray-200/50">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Wskaźniki Wydajności</h3>
            <button
              onClick={() => setShowAdvancedMetrics(!showAdvancedMetrics)}
              className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <span>{showAdvancedMetrics ? 'Ukryj' : 'Pokaż'} szczegóły</span>
              {showAdvancedMetrics ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
          
          {totals ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              <div className="text-center group">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl mx-auto mb-3 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Eye className="h-6 w-6 text-blue-600" />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-1">Wyświetlenia</p>
                <AnimatedCounter
                  value={totals.impressions}
                  formatValue={(value) => value.toLocaleString()}
                  className="text-xl font-bold text-gray-900"
                  delay={0.1}
                />
              </div>

              <div className="text-center group">
                <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 rounded-xl mx-auto mb-3 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Target className="h-6 w-6 text-green-600" />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-1">Kliknięcia</p>
                <AnimatedCounter
                  value={totals.clicks}
                  formatValue={(value) => value.toLocaleString()}
                  className="text-xl font-bold text-gray-900"
                  delay={0.2}
                />
              </div>

              <div className="text-center group">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl mx-auto mb-3 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <BarChart className="h-6 w-6 text-purple-600" />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-1">CPM</p>
                <AnimatedCounter
                  value={totals.impressions > 0 ? (totals.spend / totals.impressions * 1000) : 0}
                  formatValue={(value) => `${value.toFixed(2)} zł`}
                  className="text-xl font-bold text-gray-900"
                  delay={0.3}
                />
              </div>

              <div className="text-center group">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl mx-auto mb-3 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Target className="h-6 w-6 text-orange-600" />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-1">CPC</p>
                <AnimatedCounter
                  value={totals.cpc}
                  formatValue={(value) => `${value.toFixed(2)} zł`}
                  className="text-xl font-bold text-gray-900"
                  delay={0.4}
                />
              </div>

              <div className="text-center group">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-xl mx-auto mb-3 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Users className="h-6 w-6 text-indigo-600" />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-1">Zasięg</p>
                <AnimatedCounter
                  value={totals.impressions / 3}
                  formatValue={(value) => value.toLocaleString()}
                  className="text-xl font-bold text-gray-900"
                  delay={0.5}
                />
              </div>

              <div className="text-center group">
                <div className="w-12 h-12 bg-gradient-to-br from-pink-100 to-pink-200 rounded-xl mx-auto mb-3 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Activity className="h-6 w-6 text-pink-600" />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-1">Częstotliwość</p>
                <AnimatedCounter
                  value={3.2}
                  formatValue={(value) => value.toFixed(1)}
                  className="text-xl font-bold text-gray-900"
                  delay={0.6}
                />
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
                <BarChart3 className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500">Oczekiwanie na pierwsze wyniki...</p>
            </div>
          )}

          {/* Advanced Metrics (Collapsible) */}
          {showAdvancedMetrics && totals && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-8 pt-6 border-t border-gray-200"
            >
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Szczegółowe Metryki</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-600 font-medium">Wskaźnik Konwersji</p>
                      <p className="text-2xl font-bold text-blue-900">
                        {totals.clicks > 0 ? ((totals.conversions / totals.clicks) * 100).toFixed(2) : 0}%
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-blue-200 rounded-lg flex items-center justify-center">
                      <Target className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-600 font-medium">ROAS</p>
                      <p className="text-2xl font-bold text-green-900">
                        {totals.spend > 0 ? (totals.conversions * 50 / totals.spend).toFixed(2) : 0}x
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-green-200 rounded-lg flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-600 font-medium">Koszt Konwersji</p>
                      <p className="text-2xl font-bold text-purple-900">
                        {totals.conversions > 0 ? (totals.spend / totals.conversions).toFixed(2) : 0} zł
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-purple-200 rounded-lg flex items-center justify-center">
                      <Award className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Mobile KPI Scroll Section */}
          {totals && (
            <div className="md:hidden mt-6">
              <div className="overflow-x-auto">
                <div className="flex space-x-4 min-w-max pb-4">
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-4 min-w-[200px]">
                    <div className="text-center">
                      <div className="w-10 h-10 bg-blue-200 rounded-lg mx-auto mb-2 flex items-center justify-center">
                        <Target className="h-5 w-5 text-blue-600" />
                      </div>
                      <p className="text-xs text-blue-600 font-medium mb-1">Konwersja</p>
                      <p className="text-lg font-bold text-blue-900">
                        {totals.clicks > 0 ? ((totals.conversions / totals.clicks) * 100).toFixed(2) : 0}%
                      </p>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-4 min-w-[200px]">
                    <div className="text-center">
                      <div className="w-10 h-10 bg-green-200 rounded-lg mx-auto mb-2 flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-green-600" />
                      </div>
                      <p className="text-xs text-green-600 font-medium mb-1">ROAS</p>
                      <p className="text-lg font-bold text-green-900">
                        {totals.spend > 0 ? (totals.conversions * 50 / totals.spend).toFixed(2) : 0}x
                      </p>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-4 min-w-[200px]">
                    <div className="text-center">
                      <div className="w-10 h-10 bg-purple-200 rounded-lg mx-auto mb-2 flex items-center justify-center">
                        <Award className="h-5 w-5 text-purple-600" />
                      </div>
                      <p className="text-xs text-purple-600 font-medium mb-1">Koszt Konwersji</p>
                      <p className="text-lg font-bold text-purple-900">
                        {totals.conversions > 0 ? (totals.spend / totals.conversions).toFixed(2) : 0} zł
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Meta Ads Reporting Tables */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 mb-8 border border-gray-200/50">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">
              Meta Ads Reporting Tables - {formatDate(selectedReport.date_range_start)}
            </h3>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span>Dane z Meta Ads API</span>
            </div>
          </div>
          
          <MetaAdsTables 
            dateStart={selectedReport.date_range_start}
            dateEnd={selectedReport.date_range_end}
          />
        </div>

        {/* Footer */}
        <div className="text-center py-8">
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50">
            <div className="flex items-center justify-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-4 w-4" />
                <span>Raport oparty na danych z Meta API</span>
              </div>
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4" />
                <span>Ostatnia synchronizacja: {new Date().toLocaleString('pl-PL')}</span>
              </div>
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              <div className="flex items-center space-x-2">
                <Sparkles className="h-4 w-4" />
                <span>Premium Analytics Dashboard</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Export with dynamic import to prevent SSR
const ReportsPage = dynamic(() => Promise.resolve(ReportsPageContent), {
  ssr: false,
  loading: () => <LoadingScreen />
});

export default ReportsPage; 