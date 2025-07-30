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
  Star,
  CalendarDays,
  SlidersHorizontal
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
  const [profile, setProfile] = useState<{ role: string } | null>(null);

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
    // Guard: Ensure client is loaded before making API calls
    if (!client) {
      console.warn('⚠️ Client not loaded yet, skipping API call');
      return;
    }

    try {
      setLoadingMonth(monthId);
      console.log(`📡 Loading data for month: ${monthId}`);
      console.log(`👤 Current client:`, client);
      
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
      
      // First, try to load existing report from database
      console.log(`📊 Checking for existing report in database...`);
      
      if (!client?.id || client.id === 'demo-client-id') {
        // Skip database check for demo client
        console.log(`🎭 Demo client, skipping database check`);
      } else {
        const { data: existingReports, error: reportsError } = await supabase
          .from('reports')
          .select('*')
          .eq('client_id', client.id)
          .eq('date_range_start', monthStartDate)
          .eq('date_range_end', monthEndDate)
          .order('generated_at', { ascending: false })
          .limit(1);

        if (!reportsError && existingReports && existingReports.length > 0) {
          console.log(`✅ Found existing report in database`);
          const existingReport = existingReports[0];
          
          // Get campaigns for this report
          const { data: existingCampaigns, error: campaignsError } = await supabase
            .from('campaigns')
            .select('*')
            .eq('client_id', client.id)
            .eq('date_range_start', monthStartDate)
            .eq('date_range_end', monthEndDate);

        const campaigns: Campaign[] = existingCampaigns?.map((campaign: any) => ({
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
          date_range_end: monthEndDate,
          status: campaign.status,
          objective: campaign.objective
        })) || [];

        const report: MonthlyReport = {
          id: monthId,
          date_range_start: monthStartDate,
          date_range_end: monthEndDate,
          generated_at: existingReport.generated_at,
          campaigns: campaigns
        };

        setReports(prev => ({ ...prev, [monthId]: report }));
        return;
      }
    }

    // If no existing report, fetch from API
    console.log(`📅 No existing report found, fetching from Meta API...`);
    
    // Skip API call for demo clients
    if (client?.id === 'demo-client-id') {
      console.log(`🎭 Demo client, skipping API call and showing demo data`);
      
      // Show demo data for demo client
      const demoCampaigns: Campaign[] = [
        {
          id: `demo-campaign-1-${monthId}`,
          campaign_id: 'demo-campaign-1',
          campaign_name: 'Summer Sale Campaign',
          spend: 2450.75,
          impressions: 125000,
          clicks: 3125,
          conversions: 156,
          ctr: 2.5,
          cpc: 0.78,
          cpp: 19.61,
          frequency: 3.2,
          reach: 39062,
          date_range_start: monthStartDate,
          date_range_end: monthEndDate,
          status: 'ACTIVE',
          ad_type: 'IMAGE',
          objective: 'CONVERSIONS'
        },
        {
          id: `demo-campaign-2-${monthId}`,
          campaign_id: 'demo-campaign-2',
          campaign_name: 'Brand Awareness',
          spend: 1800.50,
          impressions: 89000,
          clicks: 1780,
          conversions: 89,
          ctr: 2.0,
          cpc: 1.01,
          cpp: 20.23,
          frequency: 2.8,
          reach: 31786,
          date_range_start: monthStartDate,
          date_range_end: monthEndDate,
          status: 'ACTIVE',
          ad_type: 'VIDEO',
          objective: 'BRAND_AWARENESS'
        },
        {
          id: `demo-campaign-3-${monthId}`,
          campaign_id: 'demo-campaign-3',
          campaign_name: 'Lead Generation',
          spend: 3200.25,
          impressions: 156000,
          clicks: 4680,
          conversions: 234,
          ctr: 3.0,
          cpc: 0.68,
          cpp: 20.51,
          frequency: 4.1,
          reach: 38049,
          date_range_start: monthStartDate,
          date_range_end: monthEndDate,
          status: 'ACTIVE',
          ad_type: 'CAROUSEL',
          objective: 'LEAD_GENERATION'
        }
      ];

      const demoReport: MonthlyReport = {
        id: monthId,
        date_range_start: monthStartDate,
        date_range_end: monthEndDate,
        generated_at: new Date().toISOString(),
        campaigns: demoCampaigns
      };

      setReports(prev => ({ ...prev, [monthId]: demoReport }));
      return;
    }
    
    // Make API call for the specific month
    const requestBody = {
      dateRange: {
        start: monthStartDate,
        end: monthEndDate
      },
      clientId: client.id // Always send the client ID for real clients
    };
    console.log('📡 Making API call with request body:', requestBody);
    const response = await fetch('/api/fetch-live-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(requestBody)
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

        // Store the report in database (only for real clients, not demo)
        if (client?.id !== 'demo-client-id') {
          try {
            console.log(`💾 Storing report in database...`);
            const reportResponse = await fetch('/api/reports', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                clientId: client?.id,
                dateRangeStart: monthStartDate,
                dateRangeEnd: monthEndDate,
                reportData: {
                  campaigns: liveCampaigns
                }
              })
            });

            if (reportResponse.ok) {
              console.log(`✅ Report stored in database`);
            } else {
              console.warn(`⚠️ Failed to store report in database`);
            }
          } catch (storeError) {
            console.warn(`⚠️ Error storing report:`, storeError);
          }
        }

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

  // Effect to load month data when client and selected month are ready
  useEffect(() => {
    if (client && selectedMonth && !reports[selectedMonth]) {
      console.log('🔄 Client and month ready, loading data...');
      loadMonthData(selectedMonth);
    }
  }, [client, selectedMonth]);

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

      // Get user profile to check role
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        throw new Error('Failed to fetch user profile');
      }

      console.log('✅ User profile:', profileData);
      setProfile(profileData);

      // Check for clientId in URL params
      const urlParams = new URLSearchParams(window.location.search);
      const clientIdFromUrl = urlParams.get('clientId');
      console.log('🔍 URL clientId:', clientIdFromUrl);

      if (profileData?.role === 'admin' && clientIdFromUrl) {
        // Admin viewing specific client's reports
        console.log('👨‍💼 Admin viewing specific client:', clientIdFromUrl);
        
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('*')
          .eq('id', clientIdFromUrl)
          .single();

        if (clientError || !clientData) {
          throw new Error('Client not found in database');
        }

        console.log('✅ Client found for admin view:', clientData.name);
        setClient(clientData);
      } else if (profileData?.role === 'admin') {
        // Admin without specific client - show demo data
        console.log('👨‍💼 Admin user detected, showing demo data');
        
        const demoClient: Client = {
          id: 'demo-client-id',
          name: 'Demo Client',
          email: user.email || 'admin@example.com',
          ad_account_id: 'demo-ad-account-123'
        };
        
        setClient(demoClient);
      } else if (profileData?.role === 'client') {
        // Regular client - get their own data
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
      } else {
        throw new Error('Invalid user role');
      }

      // Generate available months
      const months = generateMonthOptions();
      setAvailableMonths(months);
      console.log(`📅 Generated ${months.length} month options`);

      // Set current month as selected
      const currentMonthId = generateMonthId(new Date());
      setSelectedMonth(currentMonthId);
      console.log(`📅 Current month: ${currentMonthId}`);

      // Note: loadMonthData will be called by useEffect when client and selectedMonth are ready

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
    
    // Note: loadMonthData will be called by useEffect when selectedMonth changes
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Premium Header with Enhanced Glassmorphism */}
        <div className="relative bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 mb-8 border border-white/20 overflow-hidden">
          {/* Premium background patterns */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-blue-400 to-purple-600 rounded-full -translate-y-20 translate-x-20 blur-xl"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-br from-green-400 to-blue-600 rounded-full translate-y-16 -translate-x-16 blur-xl"></div>
            <div className="absolute top-1/2 left-1/2 w-24 h-24 bg-gradient-to-br from-purple-400 to-pink-600 rounded-full -translate-x-12 -translate-y-12 blur-lg"></div>
          </div>
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="relative p-4 bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-600 rounded-2xl shadow-xl">
                <BarChart3 className="w-10 h-10 text-white" />
                <div className="absolute -top-2 -right-2 w-4 h-4 bg-yellow-400 rounded-full animate-pulse shadow-lg"></div>
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 bg-clip-text text-transparent">
                  Raporty Miesięczne
                </h1>
                <p className="text-gray-600 flex items-center text-lg">
                  <span className="mr-3">🏨</span>
                  {client?.name} - Premium Analytics Dashboard
                  {selectedMonth && reports[selectedMonth]?.campaigns.some(c => c.campaign_id.startsWith('demo-')) && (
                    <span className="ml-3 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                      🎭 Demo Mode
                    </span>
                  )}
                  {client?.id === 'demo-client-id' && (
                    <span className="ml-3 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200">
                      👨‍💼 Admin View
                    </span>
                  )}
                  {client?.id && client.id !== 'demo-client-id' && new URLSearchParams(window.location.search).get('clientId') && (
                    <span className="ml-3 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800 border border-purple-200">
                      👨‍💼 Admin Viewing Client
                    </span>
                  )}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Subtle Live Data Indicator */}
              <div className="flex items-center space-x-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl px-4 py-2 border border-blue-200/50">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-blue-700 font-medium">Aktualizacja: {new Date().toLocaleString('pl-PL', { 
                  day: '2-digit', 
                  month: '2-digit', 
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</span>
              </div>

              {/* Enhanced Back Button */}
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => router.push(profile?.role === 'admin' ? '/admin' : '/dashboard')}
                  className="bg-gradient-to-r from-gray-600 to-gray-700 text-white px-6 py-3 rounded-xl hover:from-gray-700 hover:to-gray-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  {profile?.role === 'admin' ? 'Back to Admin' : 'Powrót do Dashboard'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Premium Period Selector - Compact Slider Design */}
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-6 mb-6 border border-white/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <CalendarDays className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Wybór Okresu</h2>
                <p className="text-sm text-gray-500">Wybierz miesiąc do analizy</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={handleRefresh}
                disabled={loadingMonth !== null}
                className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 transform hover:scale-105 text-sm"
              >
                <RefreshCw className={`w-4 h-4 ${loadingMonth ? 'animate-spin' : ''}`} />
                <span>Odśwież</span>
              </button>
            </div>
          </div>

          {/* Compact Month Slider with Navigation */}
          <div className="flex items-center justify-center space-x-4 md:space-x-6">
            {/* Left Navigation Button */}
            <button
              onClick={() => {
                if (selectedMonth) {
                  const currentIndex = availableMonths.indexOf(selectedMonth);
                  if (currentIndex < availableMonths.length - 1) {
                    const nextMonth = availableMonths[currentIndex + 1];
                    setSelectedMonth(nextMonth);
                    if (!reports[nextMonth]) {
                      loadMonthData(nextMonth);
                    }
                  }
                }
              }}
              disabled={!selectedMonth || availableMonths.indexOf(selectedMonth || '') >= availableMonths.length - 1 || loadingMonth !== null}
              className="p-3 md:p-4 bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl md:rounded-2xl hover:from-gray-200 hover:to-gray-300 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-30 disabled:cursor-not-allowed transform hover:scale-105"
            >
              <ChevronLeft className="w-6 h-6 md:w-8 md:h-8 text-gray-600" />
            </button>

            {/* Center Month Display with Dropdown */}
            <div className="relative flex-1 max-w-sm md:max-w-md">
              <div className="relative">
                <select
                  value={selectedMonth || ''}
                  onChange={handleMonthChange}
                  disabled={loadingMonth !== null}
                  className="w-full border-2 border-gray-200 rounded-xl md:rounded-2xl px-6 md:px-8 py-4 md:py-5 text-lg md:text-xl font-bold text-center focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 bg-white/80 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer appearance-none"
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
                
                {/* Calendar icon inside the selector */}
                <div className="absolute left-4 md:left-6 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <Calendar className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                </div>
                
                {/* Custom dropdown arrow */}
                <div className="absolute right-4 md:right-6 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <ChevronDown className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                </div>
                
                {/* Loading indicator */}
                {loadingMonth && (
                  <div className="absolute left-2 md:left-4 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 md:h-5 md:w-5 border-2 md:border-3 border-blue-200 border-t-blue-600"></div>
                  </div>
                )}
              </div>
              
              {/* Enhanced Month indicator dots with tooltips */}
              <div className="flex justify-center space-x-1.5 md:space-x-2 mt-3">
                {availableMonths.slice(0, 12).map((monthId, index) => {
                  const [year, month] = monthId.split('-').map(Number);
                  const date = new Date(year, month - 1, 1);
                  const monthName = formatDate(date.toISOString());
                  
                  return (
                    <div
                      key={monthId}
                      className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full transition-all duration-300 cursor-pointer group relative ${
                        selectedMonth === monthId 
                          ? 'bg-blue-600 scale-125' 
                          : 'bg-gray-300 hover:bg-gray-400 hover:scale-110'
                      }`}
                      title={monthName}
                    >
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                        {monthName}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  );
                })}
                {availableMonths.length > 12 && (
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-gray-300 flex items-center justify-center">
                    <span className="text-xs text-gray-500">+</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Navigation Button */}
            <button
              onClick={() => {
                if (selectedMonth) {
                  const currentIndex = availableMonths.indexOf(selectedMonth);
                  if (currentIndex > 0) {
                    const prevMonth = availableMonths[currentIndex - 1];
                    setSelectedMonth(prevMonth);
                    if (!reports[prevMonth]) {
                      loadMonthData(prevMonth);
                    }
                  }
                }
              }}
              disabled={!selectedMonth || availableMonths.indexOf(selectedMonth || '') <= 0 || loadingMonth !== null}
              className="p-3 md:p-4 bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl md:rounded-2xl hover:from-gray-200 hover:to-gray-300 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-30 disabled:cursor-not-allowed transform hover:scale-105"
            >
              <ChevronRight className="w-6 h-6 md:w-8 md:h-8 text-gray-600" />
            </button>
          </div>

          {/* Subtle Month Navigation Info */}
          <div className="text-center mt-3">
            <p className="text-xs text-gray-400">
              Użyj strzałek do nawigacji lub kliknij miesiąc, aby wybrać z listy
            </p>
          </div>
        </div>

        {/* Premium Key Metrics Section with Enhanced Glassmorphism */}
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 mb-8 border border-white/20 relative overflow-hidden">
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-transparent to-purple-50/30"></div>
          
          {totals ? (
            <>
              {/* Enhanced Key Metrics Header */}
              <motion.div 
                className="relative mb-10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <div className="flex items-center space-x-4 mb-4">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                    <Trophy className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-blue-900 bg-clip-text text-transparent">
                      Kluczowe Metryki
                    </h2>
                    <p className="text-gray-600 text-lg">Wydajność kampanii w czasie rzeczywistym</p>
                  </div>
                </div>
                
                {/* Subtle divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
              </motion.div>
              
              {/* Enhanced Diagonal Charts Row with Premium Spacing */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
                {/* Wydatki (Spend) Diagonal Chart */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.1 }}
                >
                  <DiagonalChart
                    value={totals.spend}
                    maxValue={totals.spend * 1.5}
                    title="Wydatki"
                    subtitle="Całkowite wydatki miesięczne"
                    color="#3b82f6"
                    icon={<DollarSign className="h-6 w-6" />}
                    formatValue={(value) => `${value.toFixed(2)} zł`}
                    trend={{
                      value: calculateTrends().spend,
                      label: calculateTrends().spend === 0 ? 'Brak danych z poprzedniego miesiąca' : `${calculateTrends().spend >= 0 ? '+' : ''}${calculateTrends().spend.toFixed(1)}% vs poprzedni miesiąc`,
                      isPositive: calculateTrends().spend >= 0
                    }}
                    delay={0}
                  />
                </motion.div>

                {/* Konwersje (Conversions) Diagonal Chart */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                >
                  <DiagonalChart
                    value={totals.conversions}
                    maxValue={totals.conversions * 2 || 100}
                    title="Konwersje"
                    subtitle="Liczba konwersji"
                    color="#10b981"
                    icon={<Award className="h-6 w-6" />}
                    formatValue={(value) => value.toLocaleString()}
                    trend={{
                      value: calculateTrends().conversions,
                      label: calculateTrends().conversions === 0 ? 'Brak danych z poprzedniego miesiąca' : `${calculateTrends().conversions >= 0 ? '+' : ''}${calculateTrends().conversions.toFixed(1)}% vs poprzedni miesiąc`,
                      isPositive: calculateTrends().conversions >= 0
                    }}
                    delay={1}
                  />
                </motion.div>

                {/* CTR Diagonal Chart */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                >
                  <DiagonalChart
                    value={totals.ctr}
                    maxValue={5} // 5% max CTR
                    title="CTR"
                    subtitle="Wskaźnik klikalności"
                    color="#8b5cf6"
                    icon={<TrendingUpIcon className="h-6 w-6" />}
                    formatValue={(value) => `${value.toFixed(2)}%`}
                    trend={{
                      value: calculateTrends().ctr,
                      label: calculateTrends().ctr === 0 ? 'Brak danych z poprzedniego miesiąca' : `${calculateTrends().ctr >= 0 ? '+' : ''}${calculateTrends().ctr.toFixed(1)}% vs poprzedni miesiąc`,
                      isPositive: calculateTrends().ctr >= 0
                    }}
                    delay={2}
                  />
                </motion.div>
              </div>
            </>
          ) : (
            /* Enhanced Zero Data State with Premium Design */
            <div className="text-center py-16">
              <motion.div 
                className="w-32 h-32 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full mx-auto mb-8 flex items-center justify-center shadow-xl"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.6, ease: "backOut" }}
              >
                <BarChart3 className="h-16 w-16 text-blue-600" />
              </motion.div>
              <motion.h3 
                className="text-2xl font-bold text-gray-900 mb-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                Brak danych dla tego okresu
              </motion.h3>
              <motion.p 
                className="text-gray-600 mb-8 max-w-md mx-auto text-lg"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                Nie znaleziono aktywnych kampanii w wybranym miesiącu. 
                Rozpocznij swoją pierwszą kampanię, aby zobaczyć wyniki tutaj!
              </motion.p>
              <motion.div 
                className="flex justify-center space-x-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
              >
                <button
                  onClick={handleRefresh}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  Odśwież dane
                </button>
              </motion.div>
            </div>
          )}
        </div>

        {/* Premium Secondary KPIs Grid with Enhanced Glassmorphism */}
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 mb-8 border border-white/20 relative overflow-hidden">
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-green-50/30 via-transparent to-blue-50/30"></div>
          
          <div className="relative flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-gradient-to-br from-green-500 to-blue-600 rounded-xl shadow-lg">
                <BarChart className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-green-900 bg-clip-text text-transparent">
                  Wskaźniki Wydajności
                </h3>
                <p className="text-gray-600">Szczegółowe metryki kampanii</p>
              </div>
            </div>
            <button
              onClick={() => setShowAdvancedMetrics(!showAdvancedMetrics)}
              className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 transition-colors bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2 hover:bg-white/70"
            >
              <span>{showAdvancedMetrics ? 'Ukryj' : 'Pokaż'} szczegóły</span>
              {showAdvancedMetrics ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
          
          {totals ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
              <motion.div 
                className="text-center group relative"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl mx-auto mb-4 flex items-center justify-center group-hover:scale-110 transition-all duration-300 shadow-lg group-hover:shadow-xl">
                  <Eye className="h-8 w-8 text-blue-600" />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-2 flex items-center justify-center">
                  Wyświetlenia
                  <div className="ml-1 w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help group relative">
                    <Info className="w-4 h-4" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                      Liczba wyświetleń reklam
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </p>
                <AnimatedCounter
                  value={totals.impressions}
                  formatValue={(value) => value.toLocaleString()}
                  className="text-2xl font-bold text-gray-900"
                  delay={0.1}
                />
              </motion.div>

              <motion.div 
                className="text-center group relative"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-green-200 rounded-2xl mx-auto mb-4 flex items-center justify-center group-hover:scale-110 transition-all duration-300 shadow-lg group-hover:shadow-xl">
                  <Target className="h-8 w-8 text-green-600" />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-2 flex items-center justify-center">
                  Kliknięcia
                  <div className="ml-1 w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help group relative">
                    <Info className="w-4 h-4" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                      Liczba kliknięć w reklamy
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </p>
                <AnimatedCounter
                  value={totals.clicks}
                  formatValue={(value) => value.toLocaleString()}
                  className="text-2xl font-bold text-gray-900"
                  delay={0.2}
                />
              </motion.div>

              <motion.div 
                className="text-center group relative"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-purple-200 rounded-2xl mx-auto mb-4 flex items-center justify-center group-hover:scale-110 transition-all duration-300 shadow-lg group-hover:shadow-xl">
                  <BarChart className="h-8 w-8 text-purple-600" />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-2 flex items-center justify-center">
                  CPM
                  <div className="ml-1 w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help group relative">
                    <Info className="w-4 h-4" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                      Koszt za 1000 wyświetleń
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </p>
                <AnimatedCounter
                  value={totals.impressions > 0 ? (totals.spend / totals.impressions * 1000) : 0}
                  formatValue={(value) => `${value.toFixed(2)} zł`}
                  className="text-2xl font-bold text-gray-900"
                  delay={0.3}
                />
              </motion.div>

              <motion.div 
                className="text-center group relative"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-orange-200 rounded-2xl mx-auto mb-4 flex items-center justify-center group-hover:scale-110 transition-all duration-300 shadow-lg group-hover:shadow-xl">
                  <Target className="h-8 w-8 text-orange-600" />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-2 flex items-center justify-center">
                  CPC
                  <div className="ml-1 w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help group relative">
                    <Info className="w-4 h-4" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                      Koszt za kliknięcie
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </p>
                <AnimatedCounter
                  value={totals.cpc}
                  formatValue={(value) => `${value.toFixed(2)} zł`}
                  className="text-2xl font-bold text-gray-900"
                  delay={0.4}
                />
              </motion.div>

              <motion.div 
                className="text-center group relative"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-2xl mx-auto mb-4 flex items-center justify-center group-hover:scale-110 transition-all duration-300 shadow-lg group-hover:shadow-xl">
                  <Users className="h-8 w-8 text-indigo-600" />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-2 flex items-center justify-center">
                  Zasięg
                  <div className="ml-1 w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help group relative">
                    <Info className="w-4 h-4" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                      Liczba unikalnych użytkowników
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </p>
                <AnimatedCounter
                  value={totals.impressions / 3}
                  formatValue={(value) => value.toLocaleString()}
                  className="text-2xl font-bold text-gray-900"
                  delay={0.5}
                />
              </motion.div>

              <motion.div 
                className="text-center group relative"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
              >
                <div className="w-16 h-16 bg-gradient-to-br from-pink-100 to-pink-200 rounded-2xl mx-auto mb-4 flex items-center justify-center group-hover:scale-110 transition-all duration-300 shadow-lg group-hover:shadow-xl">
                  <Activity className="h-8 w-8 text-pink-600" />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-2 flex items-center justify-center">
                  Częstotliwość
                  <div className="ml-1 w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help group relative">
                    <Info className="w-4 h-4" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                      Średnia liczba wyświetleń na użytkownika
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </p>
                <AnimatedCounter
                  value={totals.impressions > 0 ? 3.0 : 0}
                  formatValue={(value) => value.toFixed(1)}
                  className="text-2xl font-bold text-gray-900"
                  delay={0.6}
                />
              </motion.div>
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

        {/* Premium Meta Ads Reporting Tables */}
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 mb-8 border border-white/20 relative overflow-hidden">
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/30 via-transparent to-purple-50/30"></div>
          
          <div className="relative flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                <FileSpreadsheet className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-indigo-900 bg-clip-text text-transparent">
                  Meta Ads Reporting Tables
                </h3>
                <p className="text-gray-600">{formatDate(selectedReport.date_range_start)}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-600 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              <span>Dane z Meta Ads API</span>
              {selectedMonth && reports[selectedMonth]?.campaigns.some(c => c.campaign_id.startsWith('demo-')) && (
                <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                  🎭 Demo
                </span>
              )}
            </div>
          </div>
          
          <MetaAdsTables 
            dateStart={selectedReport.date_range_start}
            dateEnd={selectedReport.date_range_end}
            clientId={client?.id === 'demo-client-id' ? undefined : client?.id}
          />
        </div>

        {/* Premium Footer */}
        <div className="text-center py-8">
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-xl">
            <div className="flex items-center justify-center space-x-6 text-sm text-gray-600">
              <div className="flex items-center space-x-2 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                <span className="font-medium">Raport oparty na danych z Meta API</span>
              </div>
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              <div className="flex items-center space-x-2 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2">
                <Clock className="h-4 w-4 text-green-600" />
                <span className="font-medium">Ostatnia synchronizacja: {new Date().toLocaleString('pl-PL')}</span>
              </div>
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              <div className="flex items-center space-x-2 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                <span className="font-medium">Premium Analytics Dashboard</span>
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