'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  AlertCircle,
  Clock,
  BarChart3,
  TrendingUp,
  Database as DatabaseIcon,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import WeeklyReportView from '../../components/WeeklyReportView';
import InteractivePDFButton from '../../components/InteractivePDFButton';
import MetaAdsTables from '../../components/MetaAdsTables';
import { useAuth } from '../../components/AuthProvider';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';

type Client = Database['public']['Tables']['clients']['Row'];

interface Campaign {
  id: string;
  campaign_id: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr?: number;
  cpc?: number;
  cpa?: number;
  frequency?: number;
  reach?: number;
  relevance_score?: number;
  landing_page_view?: number;
  ad_type?: string;
  objective?: string;
}

interface MonthlyReport {
  id: string;
  date_range_start: string;
  date_range_end: string;
  generated_at?: string;
  campaigns: Campaign[];
}

interface WeeklyReport {
  id: string;
  date_range_start: string;
  date_range_end: string;
  generated_at?: string;
  campaigns: Campaign[];
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: 'long'
  });
};

// Helper function to get week start and end dates
const getWeekDateRange = (year: number, week: number) => {
  const firstDayOfYear = new Date(year, 0, 1);
  const days = (week - 1) * 7;
  const startDate = new Date(firstDayOfYear.getTime() + days * 24 * 60 * 60 * 1000);
  const endDate = new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000);
  
  const formatDateForDisplay = (date: Date) => {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    return `${day.toString().padStart(2, '0')}.${month.toString().padStart(2, '0')}`;
  };
  
  return `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}.${year}`;
};



// Loading Screen Component
const LoadingScreen = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
      <p className="text-lg text-gray-600">Ładowanie raportów...</p>
    </div>
  </div>
);

// Main Reports Component
function ReportsPageContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [reports, setReports] = useState<{ [key: string]: MonthlyReport | WeeklyReport }>({});
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
  const [loadingPeriod, setLoadingPeriod] = useState<string | null>(null);
  const [viewType, setViewType] = useState<'monthly' | 'weekly'>('monthly');
  const [apiCallInProgress, setApiCallInProgress] = useState(false);
  const [metaTablesData, setMetaTablesData] = useState<{
    placementPerformance: any[];
    demographicPerformance: any[];
    adRelevanceResults: any[];
  } | null>(null);
  
  // Add refs to prevent duplicate calls
  const loadingRef = useRef(false);
  const clientLoadingRef = useRef(false);
  const mountedRef = useRef(false);
  const initialClientLoadRef = useRef(false);

  // Get current user and profile
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

  // Get client data based on user role and query parameters
  const getClientData = async (currentUser: any, profileData: any) => {
    // Check if we have a clientId in the URL (for admin users viewing specific client)
    const urlParams = new URLSearchParams(window.location.search);
    const clientIdFromUrl = urlParams.get('clientId');
    
    if (profileData.role === 'admin' && clientIdFromUrl) {
      // Admin viewing specific client
      console.log('🔍 Admin viewing specific client:', clientIdFromUrl);
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientIdFromUrl)
        .eq('admin_id', currentUser.id) // Ensure admin owns this client
        .single();

      if (clientError) {
        console.error('Admin client fetch error:', clientError);
        throw new Error('Client not found or access denied');
      }
      
      return clientData;
    } else if (profileData.role === 'client') {
      // Client viewing their own data
      console.log('🔍 Client viewing their own data');
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('email', currentUser.email) // Match by email for client users
        .single();

      if (clientError) {
        console.error('Client data fetch error:', clientError);
        throw new Error('Failed to load client data');
      }
      
      return clientData;
    } else {
      throw new Error('Invalid user role or missing client ID');
    }
  };

  // Generate period ID for a given date
  const generatePeriodId = (date: Date, type: 'monthly' | 'weekly') => {
    if (type === 'monthly') {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    } else {
      // For weekly, use ISO week format
      const year = date.getFullYear();
      const week = getWeekNumber(date);
      return `${year}-W${String(week).padStart(2, '0')}`;
    }
  };

  // Get ISO week number
  const getWeekNumber = (date: Date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  // Generate period options based on view type
  const generatePeriodOptions = (type: 'monthly' | 'weekly') => {
    const periods: string[] = [];
    // Use current date as reference
    const currentDate = new Date();
    const limit = type === 'monthly' ? 24 : 52; // 2 years for monthly, 1 year for weekly
    
    for (let i = 0; i < limit; i++) {
      let periodDate: Date;
      
      if (type === 'monthly') {
        periodDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      } else {
        periodDate = new Date(currentDate.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
      }
      
      periods.push(generatePeriodId(periodDate, type));
    }
    
    return periods;
  };

  // Load data for a specific period with explicit client data
  const loadPeriodDataWithClient = async (periodId: string, clientData: Client) => {
    console.log(`📊 Loading ${viewType} data for period: ${periodId} with explicit client`, { periodId, clientId: clientData.id });
    
    // Prevent duplicate calls
    if (loadingRef.current || apiCallInProgress) {
      console.log('⚠️ Already loading data, skipping duplicate call');
      return;
    }

    // Check if we already have this data
    if (reports[periodId]) {
      console.log('✅ Data already loaded for this period, skipping API call');
      return;
    }

    // Check if this period is in the future (which won't have data)
    const [year, month] = periodId.split('-').map(Number);
    const periodDate = new Date(year || new Date().getFullYear(), (month || 1) - 1, 1);
    const currentDate = new Date();
    
    if (periodDate > currentDate) {
      console.log('⚠️ Period is in the future, showing empty data');
      const emptyReport: MonthlyReport | WeeklyReport = {
        id: periodId,
        date_range_start: periodDate.toISOString().split('T')[0] || '',
        date_range_end: new Date(year || new Date().getFullYear(), month || 1, 0).toISOString().split('T')[0] || '',
        generated_at: new Date().toISOString(),
        campaigns: []
      };
      setReports(prev => ({ ...prev, [periodId]: emptyReport }));
      return;
    }

    // Declare date variables at function level
    let periodStartDate = '';
    let periodEndDate = '';

    try {
      loadingRef.current = true;
      setApiCallInProgress(true);
      setLoadingPeriod(periodId);
      console.log(`📡 Loading data for ${viewType} period: ${periodId}`);
      console.log(`👤 Using explicit client:`, clientData);
      
      // Get session for API calls
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No access token available');
      }

      let startDate: Date, endDate: Date;

      if (viewType === 'monthly') {
        // Parse month ID to get start and end dates
        const [year, month] = periodId.split('-').map(Number);
        startDate = new Date(year || new Date().getFullYear(), (month || 1) - 1, 1);
        endDate = new Date(year || new Date().getFullYear(), month || 1, 0); // Last day of the month
        
        console.log(`📅 Monthly date parsing:`, {
          periodId,
          year,
          month,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });
      } else {
        // Parse week ID to get start and end dates
        const [year, weekStr] = periodId.split('-W');
        const week = parseInt(weekStr || '1');
        const firstDayOfYear = new Date(parseInt(year || new Date().getFullYear().toString()), 0, 1);
        const days = (week - 1) * 7;
        startDate = new Date(firstDayOfYear.getTime() + days * 24 * 60 * 60 * 1000);
        endDate = new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000);
      }
      
      // Format dates in local timezone to avoid UTC conversion issues
      periodStartDate = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
      periodEndDate = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
      
      console.log(`📅 Generated date range for ${periodId}: ${periodStartDate} to ${periodEndDate}`);
      
      // ALWAYS fetch fresh data from Meta API (no database caching)
      console.log(`📡 ALWAYS fetching fresh data from Meta API...`);
    
      // Skip API call for demo clients
      console.log(`🔍 Client ID check: ${clientData?.id} (demo-client-id: ${clientData?.id === 'demo-client-id'})`);
      if (clientData?.id === 'demo-client-id') {
        console.log(`🎭 Demo client, skipping API call and showing demo data`);
        
        // Show demo data for demo client
        const demoCampaigns: Campaign[] = [
          {
            id: `demo-campaign-1-${periodId}`,
            campaign_id: 'demo-campaign-1',
            campaign_name: 'Summer Sale Campaign',
            spend: 2450.75,
            impressions: 125000,
            clicks: 3125,
            conversions: 156,
            ctr: 2.5,
            cpc: 0.78,
            cpa: 15.71,
            frequency: 2.34,
            reach: 53420,
            landing_page_view: 2845,
            ad_type: 'IMAGE',
            objective: 'CONVERSIONS'
          },
          {
            id: `demo-campaign-2-${periodId}`,
            campaign_id: 'demo-campaign-2',
            campaign_name: 'Brand Awareness Drive',
            spend: 1875.50,
            impressions: 98750,
            clicks: 2468,
            conversions: 89,
            ctr: 2.1,
            cpc: 0.76,
            cpa: 21.07,
            frequency: 1.89,
            reach: 52230,
            landing_page_view: 2156,
            ad_type: 'VIDEO',
            objective: 'LEAD_GENERATION'
          }
        ];

        const demoReport: MonthlyReport | WeeklyReport = {
          id: periodId,
          date_range_start: periodStartDate,
          date_range_end: periodEndDate,
          generated_at: new Date().toISOString(),
          campaigns: demoCampaigns
        };

        console.log('💾 Setting demo report in state:', demoReport);
        setReports(prev => {
          const newState = { ...prev, [periodId]: demoReport };
          console.log('💾 New reports state:', newState);
          return newState;
        });
        return;
      }
    
      // Make API call for the specific period
      const requestBody = {
        dateRange: {
          start: periodStartDate,
          end: periodEndDate
        },
        clientId: clientData.id // Always send the client ID for real clients
      };
      console.log('📡 Making API call with request body:', requestBody);
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('API call timeout after 20 seconds')), 20000);
      });
      
      console.log('⏱️ Starting API call with timeout...');
      
      // Race between the fetch and timeout
      const response = await Promise.race([
        fetch('/api/fetch-live-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify(requestBody)
        }),
        timeoutPromise
      ]) as Response;
      
      console.log('📡 API call completed, processing response...');

      console.log('📡 API response received:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error(`❌ API call failed for ${periodId}:`, errorData);
        
        // Show specific error messages for permission issues
        if (errorData.error?.includes('permission') || errorData.error?.includes('ads_management')) {
          setError(`Meta API Permission Error: Your access token doesn't have the required permissions (ads_management or ads_read). Please contact support to update your token.`);
        } else if (errorData.error?.includes('Invalid Meta Ads token')) {
          setError(`Invalid Meta API Token: Your access token is invalid or expired. Please contact support to refresh your token.`);
        } else {
          setError(`Failed to load data for ${periodId}: ${errorData.error || 'Unknown error'}`);
        }
        
        // Add empty period if API fails
        const emptyReport: MonthlyReport | WeeklyReport = {
          id: periodId,
          date_range_start: periodStartDate,
          date_range_end: periodEndDate,
          generated_at: new Date().toISOString(),
          campaigns: []
        };

        console.log(`💾 Setting empty report for failed ${periodId}:`, emptyReport);
        setReports(prev => ({ ...prev, [periodId]: emptyReport }));
        return;
      }

      let data;
      try {
        data = await response.json();
        console.log(`✅ API call successful for ${periodId}:`, data);
        console.log(`📊 Raw API response structure:`, {
          hasSuccess: !!data.success,
          hasData: !!data.data,
          dataKeys: data.data ? Object.keys(data.data) : [],
          campaignsInData: data.data?.campaigns?.length || 0,
          campaignsDirect: data.campaigns?.length || 0
        });
      } catch (error) {
        console.error('❌ Failed to parse API response:', error);
        const responseText = await response.text();
        console.log('📄 Raw response text:', responseText);
        throw new Error('Failed to parse API response');
      }
      console.log(`📊 Campaigns count: ${data.campaigns?.length || 0}`);
      console.log(`📊 Data structure:`, {
        hasData: !!data,
        hasCampaigns: !!data.campaigns,
        campaignsLength: data.campaigns?.length || 0,
        dataKeys: Object.keys(data || {})
      });

      // Transform API response to our report format
      // The API returns data in a nested structure: { success: true, data: { campaigns: [...] } }
      const rawCampaigns = data.data?.campaigns || data.campaigns || [];
      
      console.log(`📊 Processing campaigns:`, {
        hasData: !!data,
        hasDataProperty: !!data.data,
        campaignsFromData: data.data?.campaigns?.length || 0,
        campaignsDirect: data.campaigns?.length || 0,
        rawCampaigns: rawCampaigns.length
      });
      
      // Transform campaigns to match frontend interface
      const campaigns: Campaign[] = rawCampaigns.map((campaign: any, index: number) => ({
        id: campaign.campaign_id || `campaign-${index}`,
        campaign_id: campaign.campaign_id || '',
        campaign_name: campaign.campaign_name || 'Unknown Campaign',
        spend: parseFloat(campaign.spend || '0'),
        impressions: parseInt(campaign.impressions || '0'),
        clicks: parseInt(campaign.clicks || '0'),
        conversions: parseInt(campaign.conversions || '0'),
        ctr: parseFloat(campaign.ctr || '0'),
        cpc: parseFloat(campaign.cpc || '0'),
        cpa: campaign.cpa ? parseFloat(campaign.cpa) : undefined,
        frequency: campaign.frequency ? parseFloat(campaign.frequency) : undefined,
        reach: campaign.reach ? parseInt(campaign.reach) : undefined,
        relevance_score: campaign.relevance_score ? parseFloat(campaign.relevance_score) : undefined,
        landing_page_view: campaign.landing_page_view ? parseInt(campaign.landing_page_view) : undefined,
        ad_type: campaign.ad_type || undefined,
        objective: campaign.objective || undefined
      }));
      
      console.log(`📊 Transformed campaigns:`, campaigns.length, 'campaigns');
      if (campaigns.length > 0) {
        console.log(`📊 Sample campaign:`, campaigns[0]);
      }
      
      const report: MonthlyReport | WeeklyReport = {
        id: periodId,
        date_range_start: periodStartDate,
        date_range_end: periodEndDate,
        generated_at: new Date().toISOString(),
        campaigns: campaigns
      };

      console.log(`💾 Setting successful report for ${periodId}:`, report);
      setReports(prev => {
        const newState = { ...prev, [periodId]: report };
        console.log('💾 Updated reports state:', {
          periodId,
          totalReports: Object.keys(newState).length,
          allPeriods: Object.keys(newState)
        });
        return newState;
      });

    } catch (error) {
      console.error(`❌ Error loading ${viewType} data for ${periodId}:`, error);
      
      // Check if it's a timeout error
      if (error instanceof Error && error.message.includes('timeout')) {
        setError(`API request timed out for ${periodId}. This might be due to Meta API being slow or the date range having no data. Please try again or select a different period.`);
      }
      
      // Show fallback data if API fails
      console.log('🔄 Showing fallback data due to API error');
      const fallbackCampaigns: Campaign[] = [
        {
          id: `fallback-1-${periodId}`,
          campaign_id: 'fallback-1',
          campaign_name: 'Fallback Campaign (API Error)',
          spend: 1000.00,
          impressions: 50000,
          clicks: 1000,
          conversions: 50,
          ctr: 2.0,
          cpc: 1.0,
          cpa: 20.0,
          frequency: 1.5,
          reach: 33333,
          landing_page_view: 800,
          ad_type: 'IMAGE',
          objective: 'CONVERSIONS'
        }
      ];

      const fallbackReport: MonthlyReport | WeeklyReport = {
        id: periodId,
        date_range_start: periodStartDate || '',
        date_range_end: periodEndDate || '',
        generated_at: new Date().toISOString(),
        campaigns: fallbackCampaigns
      };

      console.log('💾 Setting fallback report:', fallbackReport);
      setReports(prev => ({ ...prev, [periodId]: fallbackReport }));
      
      setError(`API Error: ${error instanceof Error ? error.message : 'Unknown error'}. Showing fallback data.`);
    } finally {
      loadingRef.current = false;
      setApiCallInProgress(false);
      setLoadingPeriod(null);
    }
  };

  // Load data for a specific period
  const loadPeriodData = async (periodId: string) => {
    console.log(`📊 Loading ${viewType} data for period: ${periodId}`, { periodId, client: client?.id });
    
    // Guard: Ensure client is loaded before making API calls
    if (!client || !client.id) {
      console.warn('⚠️ Client not loaded yet, skipping API call');
      return;
    }

    // Use the explicit client function to avoid race conditions
    await loadPeriodDataWithClient(periodId, client);
  };

  // Handle period change
  const handlePeriodChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newPeriod = event.target.value;
    console.log('📅 Period changed to:', newPeriod);
    setSelectedPeriod(newPeriod);
    
    // Only load data if we don't already have it and client is loaded
    if (newPeriod && !reports[newPeriod] && client) {
      console.log('📊 Loading data for new period:', newPeriod);
      loadPeriodData(newPeriod);
    } else if (newPeriod && reports[newPeriod]) {
      console.log('✅ Data already available for period:', newPeriod);
    } else if (newPeriod && !client) {
      console.log('⚠️ Client not loaded yet, cannot load period data');
    }
  };

  // Handle view type change
  const handleViewTypeChange = (newViewType: 'monthly' | 'weekly') => {
    setViewType(newViewType);
    setReports({}); // Clear existing reports
    const newPeriods = generatePeriodOptions(newViewType);
    setAvailablePeriods(newPeriods);
    
    if (newPeriods.length > 0) {
      const firstPeriod = newPeriods[0];
      if (firstPeriod) {
        setSelectedPeriod(firstPeriod);
        loadPeriodData(firstPeriod);
      }
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    if (!selectedPeriod || !client) {
      console.log('⚠️ Cannot refresh: no period selected or client not loaded');
      return;
    }
    
    console.log('🔄 Refreshing data for period:', selectedPeriod);
    
    // Clear existing data for this period
    setReports(prev => {
      const newReports = { ...prev };
      delete newReports[selectedPeriod];
      return newReports;
    });
    
    // Reset loading state and load fresh data
    loadingRef.current = false;
    loadPeriodData(selectedPeriod);
  };

  // Get selected report
  const selectedReport = selectedPeriod ? reports[selectedPeriod] : null;

  // Debug selected report
  console.log('🔍 Selected report debug:', {
    selectedPeriod,
    hasSelectedReport: !!selectedReport,
    reportId: selectedReport?.id,
    campaignsCount: selectedReport?.campaigns?.length || 0,
    campaigns: selectedReport?.campaigns || [],
    allReports: Object.keys(reports),
    reportsState: reports
  });

  // Calculate totals for selected period
  const getSelectedPeriodTotals = () => {
    if (!selectedReport || !selectedReport.campaigns.length) {
      console.log('⚠️ No selected report or no campaigns, returning zeros');
      return {
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        ctr: 0,
        cpc: 0,
        cpa: 0
      };
    }

    console.log('📊 Calculating totals from campaigns:', selectedReport.campaigns);
    
    const totals = selectedReport.campaigns.reduce((acc, campaign) => ({
      spend: acc.spend + (campaign.spend || 0),
      impressions: acc.impressions + (campaign.impressions || 0),
      clicks: acc.clicks + (campaign.clicks || 0),
      conversions: acc.conversions + (campaign.conversions || 0)
    }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 });

    // Calculate derived metrics
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
    const cpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0;

    const result = { ...totals, ctr, cpc, cpa };
    console.log('📊 Calculated totals:', result);
    return result;
  };

  // Initialize reports on component mount
  useEffect(() => {
    if (mountedRef.current) {
      console.log('⚠️ Component already mounted, skipping initialization');
      return;
    }
    
    mountedRef.current = true;
    const initializeReports = async () => {
      console.log('🔄 Initializing reports...');
      
      // Prevent duplicate initialization
      if (clientLoadingRef.current) {
        console.log('⚠️ Already initializing reports, skipping duplicate call');
        return;
      }
      
      clientLoadingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        // Get current user and profile
        const currentUser = await getCurrentUser();
        if (!currentUser) {
          router.push('/auth/login');
          return;
        }

        // Get user profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', currentUser.id)
          .single();

        if (profileError) throw profileError;
        setProfile(profileData);

        // Get client data
        const clientData = await getClientData(currentUser, profileData);
        setClient(clientData);
        console.log('✅ Client loaded successfully:', {
          id: clientData.id,
          name: clientData.name,
          email: clientData.email,
          adAccountId: clientData.ad_account_id,
          hasMetaToken: !!clientData.meta_access_token
        });
        initialClientLoadRef.current = true;

        // Generate period options
        const periods = generatePeriodOptions(viewType);
        setAvailablePeriods(periods);

        // Set initial period and load data
        if (periods.length > 0) {
          const initialPeriod = periods[0];
          if (initialPeriod) {
            console.log('📅 Setting initial period:', initialPeriod);
            setSelectedPeriod(initialPeriod);
            // Load data immediately with the client data we just loaded
            console.log('📊 Loading initial data for period:', initialPeriod);
            loadPeriodDataWithClient(initialPeriod, clientData);
          }
        } else {
          console.log('⚠️ No periods generated');
        }

        // Small delay to ensure state is fully updated
        setTimeout(() => {
          console.log('✅ Initialization complete, viewType effects can now run');
        }, 100);

      } catch (error) {
        console.error('Error initializing reports:', error);
        setError(`Failed to initialize reports: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        clientLoadingRef.current = false;
        setLoading(false);
      }
    };

    initializeReports();
  }, [router]);

  // Cleanup function to reset refs on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      loadingRef.current = false;
      clientLoadingRef.current = false;
      initialClientLoadRef.current = false;
    };
  }, []);

  // Monitor state changes
  useEffect(() => {
    console.log('🔄 State changed - reports:', Object.keys(reports), 'selectedPeriod:', selectedPeriod);
  }, [reports, selectedPeriod]);

  // Update periods when view type changes
  useEffect(() => {
    // Skip during initial load
    if (loading) {
      console.log('⚠️ Still loading, skipping viewType update');
      return;
    }
    
    if (!client) {
      console.log('⚠️ Client not loaded yet, skipping viewType update');
      return;
    }
    
    // Skip if this is the initial client load (handled in initializeReports)
    if (!initialClientLoadRef.current) {
      console.log('⚠️ Initial client load not complete, skipping viewType update');
      return;
    }
    
    // Skip if we're still in the initial loading process
    if (clientLoadingRef.current) {
      console.log('⚠️ Client loading in progress, skipping viewType update');
      return;
    }
    
    console.log('🔄 View type changed, updating periods...');
    const periods = generatePeriodOptions(viewType);
    setAvailablePeriods(periods);
    
    if (periods.length > 0) {
      const initialPeriod = periods[0];
      if (initialPeriod) {
        setSelectedPeriod(initialPeriod);
        // Only load data if we don't already have it
        if (!reports[initialPeriod]) {
          console.log('📊 Loading data for new view type period:', initialPeriod);
          loadPeriodData(initialPeriod);
        } else {
          console.log('✅ Data already available for new view type period:', initialPeriod);
        }
      }
    }
  }, [viewType, client, loading]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error Loading Data</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 mb-6 border border-white/20">
          <div className="flex flex-col lg:flex-row items-center justify-between space-y-4 lg:space-y-0">
            <div className="flex items-center space-x-4">
              <div className="p-4 bg-gradient-to-br from-blue-600 to-purple-700 rounded-2xl shadow-xl">
                <BarChart3 className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Raporty {viewType === 'monthly' ? 'Miesięczne' : 'Tygodniowe'}
                </h1>
                <div className="flex items-center space-x-2 mt-2">
                  <div className="p-1 bg-orange-100 rounded-lg">
                    <span className="text-xs">🏠</span>
                  </div>
                  <p className="text-gray-600 font-medium">{client?.name} - Premium Analytics Dashboard</p>
                  <div className="flex items-center space-x-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    <span>Aktualizacja: 04.08.2025, 11:44</span>
                  </div>
                </div>
              </div>
            </div>
            
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

        {/* View Type Selector */}
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-6 mb-6 border border-white/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Typ Widoku</h2>
                <p className="text-sm text-gray-500">Wybierz sposób wyświetlania danych</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center space-x-6">
            <button
              onClick={() => handleViewTypeChange('monthly')}
              className={`flex items-center space-x-3 px-6 py-4 rounded-xl transition-all duration-300 ${
                viewType === 'monthly'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Calendar className="w-5 h-5" />
              <span className="font-medium">Miesięczny</span>
              {viewType === 'monthly' && <ToggleRight className="w-5 h-5" />}
              {viewType !== 'monthly' && <ToggleLeft className="w-5 h-5" />}
            </button>

            <button
              onClick={() => handleViewTypeChange('weekly')}
              className={`flex items-center space-x-3 px-6 py-4 rounded-xl transition-all duration-300 ${
                viewType === 'weekly'
                  ? 'bg-gradient-to-r from-green-600 to-teal-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <CalendarDays className="w-5 h-5" />
              <span className="font-medium">Tygodniowy</span>
              {viewType === 'weekly' && <ToggleRight className="w-5 h-5" />}
              {viewType !== 'weekly' && <ToggleLeft className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Period Selector */}
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-6 mb-6 border border-white/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <CalendarDays className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Wybór Okresu</h2>
                <p className="text-sm text-gray-500">Wybierz {viewType === 'monthly' ? 'miesiąc' : 'tydzień'} do analizy</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={handleRefresh}
                disabled={loadingPeriod !== null}
                className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 transform hover:scale-105 text-sm"
              >
                <RefreshCw className={`w-4 h-4 ${loadingPeriod ? 'animate-spin' : ''}`} />
                <span>Odśwież</span>
              </button>
              
              {selectedPeriod && reports[selectedPeriod] && reports[selectedPeriod].campaigns.length > 0 && (
                <InteractivePDFButton
                  clientId={client?.id || ''}
                  dateStart={selectedReport?.date_range_start || ''}
                  dateEnd={selectedReport?.date_range_end || ''}
                  className="inline-block"
                  campaigns={selectedReport?.campaigns || []}
                  totals={getSelectedPeriodTotals()}
                  client={client}
                  metaTables={metaTablesData}
                />
              )}
            </div>
          </div>

          {/* Period Slider with Navigation */}
          <div className="flex items-center justify-center space-x-4 md:space-x-6">
            {/* Left Navigation Button */}
            <button
              onClick={() => {
                if (selectedPeriod) {
                  const currentIndex = availablePeriods.indexOf(selectedPeriod);
                  if (currentIndex < availablePeriods.length - 1) {
                    const nextPeriod = availablePeriods[currentIndex + 1];
                    if (nextPeriod) {
                      setSelectedPeriod(nextPeriod);
                      if (!reports[nextPeriod]) {
                        loadPeriodData(nextPeriod);
                      }
                    }
                  }
                }
              }}
              disabled={!selectedPeriod || availablePeriods.indexOf(selectedPeriod || '') >= availablePeriods.length - 1 || loadingPeriod !== null}
              className="p-3 md:p-4 bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl md:rounded-2xl hover:from-gray-200 hover:to-gray-300 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-30 disabled:cursor-not-allowed transform hover:scale-105"
            >
              <ChevronLeft className="w-6 h-6 md:w-8 md:h-8 text-gray-600" />
            </button>

            {/* Center Period Display with Dropdown */}
            <div className="relative flex-1 max-w-sm md:max-w-md">
              <div className="relative">
                <select
                  value={selectedPeriod || ''}
                  onChange={handlePeriodChange}
                  disabled={loadingPeriod !== null}
                  className="w-full border-2 border-gray-200 rounded-xl md:rounded-2xl px-6 md:px-8 py-4 md:py-5 text-lg md:text-xl font-bold text-center focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 bg-white/80 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer appearance-none"
                >
                  {availablePeriods.map((periodId) => {
                    if (viewType === 'monthly') {
                      const [year, month] = periodId.split('-').map(Number);
                      if (year && month) {
                        const date = new Date(year, month - 1, 1);
                        return (
                          <option key={periodId} value={periodId}>
                            {formatDate(date.toISOString())}
                          </option>
                        );
                      }
                    } else {
                      const [year, weekStr] = periodId.split('-W');
                      const week = parseInt(weekStr || '1');
                      return (
                        <option key={periodId} value={periodId}>
                          {getWeekDateRange(parseInt(year || new Date().getFullYear().toString()), week)}
                        </option>
                      );
                    }
                    return null;
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
                {loadingPeriod && (
                  <div className="absolute left-2 md:left-4 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 md:h-5 md:w-5 border-2 md:border-3 border-blue-200 border-t-blue-600"></div>
                  </div>
                )}
              </div>
              
              {/* Period indicator dots */}
              <div className="flex justify-center space-x-1.5 md:space-x-2 mt-3">
                {availablePeriods.slice(0, 12).map((periodId) => {
                  let periodName = '';
                  
                  if (viewType === 'monthly') {
                    const [year, month] = periodId.split('-').map(Number);
                    if (year && month) {
                      const date = new Date(year, month - 1, 1);
                      periodName = formatDate(date.toISOString());
                    }
                  } else {
                    const [year, weekStr] = periodId.split('-W');
                    const week = parseInt(weekStr || '1');
                    periodName = getWeekDateRange(parseInt(year || new Date().getFullYear().toString()), week);
                  }
                  
                  return (
                    <div
                      key={periodId}
                      className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full transition-all duration-300 cursor-pointer group relative ${
                        selectedPeriod === periodId 
                          ? 'bg-blue-600 scale-125' 
                          : 'bg-gray-300 hover:bg-gray-400 hover:scale-110'
                      }`}
                      title={periodName}
                    >
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                        {periodName}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  );
                })}
                {availablePeriods.length > 12 && (
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-gray-300 flex items-center justify-center">
                    <span className="text-xs text-gray-500">+</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Navigation Button */}
            <button
              onClick={() => {
                if (selectedPeriod) {
                  const currentIndex = availablePeriods.indexOf(selectedPeriod);
                  if (currentIndex > 0) {
                    const prevPeriod = availablePeriods[currentIndex - 1];
                    if (prevPeriod) {
                      setSelectedPeriod(prevPeriod);
                      if (!reports[prevPeriod]) {
                        loadPeriodData(prevPeriod);
                      }
                    }
                  }
                }
              }}
              disabled={!selectedPeriod || availablePeriods.indexOf(selectedPeriod || '') <= 0 || loadingPeriod !== null}
              className="p-3 md:p-4 bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl md:rounded-2xl hover:from-gray-200 hover:to-gray-300 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-30 disabled:cursor-not-allowed transform hover:scale-105"
            >
              <ChevronRight className="w-6 h-6 md:w-8 md:h-8 text-gray-600" />
            </button>
          </div>

          {/* Period Navigation Info */}
          <div className="text-center mt-3">
            <p className="text-xs text-gray-400">
              Użyj strzałek do nawigacji lub kliknij okres, aby wybrać z listy
            </p>
          </div>
        </div>

        {/* Report Content */}
        {loadingPeriod && (
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 mb-6 border border-white/20">
            <div className="flex items-center justify-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-200 border-t-blue-600"></div>
              <p className="text-lg text-gray-600">Ładowanie danych {viewType === 'monthly' ? 'miesięcznych' : 'tygodniowych'}...</p>
            </div>
          </div>
        )}

        {selectedReport && !loadingPeriod && (
          <>
            <WeeklyReportView
              reports={{ [selectedPeriod]: selectedReport }}
              viewType={viewType}
            />
            
            {/* Meta Ads Tables Section */}
            <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-6 mb-6 border border-white/20">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Meta Ads Analytics</h2>
                    <p className="text-sm text-gray-500">Szczegółowe analizy z Meta Ads API</p>
                  </div>
                </div>
              </div>
              
              <MetaAdsTables
                dateStart={selectedReport.date_range_start}
                dateEnd={selectedReport.date_range_end}
                clientId={client?.id || ''}
                onDataLoaded={setMetaTablesData}
              />
            </div>
          </>
        )}

        {!selectedReport && !loadingPeriod && selectedPeriod && (
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 mb-6 border border-white/20">
            <div className="text-center">
              <DatabaseIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Brak danych</h3>
              <p className="text-gray-600">
                Nie znaleziono danych dla wybranego okresu {viewType === 'monthly' ? 'miesięcznego' : 'tygodniowego'}.
              </p>
            </div>
          </div>
        )}
      </div>
      {/* Debug Button */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        <button
          onClick={async () => {
            if (!client) {
              alert('Client not loaded');
              return;
            }
            
            console.log('🔍 Debug: Testing API directly...');
            console.log('🔍 Client:', client);
            
            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (!session?.access_token) {
                alert('No session token');
                return;
              }
              
              const response = await fetch('/api/debug-meta', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                  clientId: client.id
                })
              });
              
              console.log('🔍 Debug response status:', response.status);
              
              if (!response.ok) {
                const errorText = await response.text();
                console.error('🔍 Debug API error:', errorText);
                alert(`API Error: ${response.status} - ${errorText}`);
                return;
              }
              
              const data = await response.json();
              console.log('🔍 Debug API response:', data);
              alert(`Debug complete! Check console for details.\nSteps: ${Object.keys(data.steps || {}).length}`);
              
            } catch (error) {
              console.error('🔍 Debug error:', error);
              alert(`Debug error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg block w-full"
        >
          Debug API
        </button>
        
        <button
          onClick={async () => {
            console.log('🔍 Testing Meta API connectivity...');
            
            try {
              const response = await fetch('/api/test-meta-simple');
              console.log('🔍 Connectivity test response status:', response.status);
              
              if (!response.ok) {
                const errorText = await response.text();
                console.error('🔍 Connectivity test error:', errorText);
                alert(`Connectivity Error: ${response.status} - ${errorText}`);
                return;
              }
              
              const data = await response.json();
              console.log('🔍 Connectivity test response:', data);
              alert(`Connectivity test complete!\nResponse time: ${data.tests?.responseTime || 'unknown'}\nStatus: ${data.tests?.status || 'unknown'}`);
              
            } catch (error) {
              console.error('🔍 Connectivity test error:', error);
              alert(`Connectivity error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow-lg block w-full"
        >
          Test Connectivity
        </button>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoadingScreen />;
  }

  return <ReportsPageContent />;
} 