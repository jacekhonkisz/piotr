'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
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
  Database as DatabaseIcon,
  Code,
  Target
} from 'lucide-react';
import WeeklyReportView from '../../components/WeeklyReportView';
import InteractivePDFButton from '../../components/InteractivePDFButton';
import AdsDataToggle from '../../components/AdsDataToggle';
import GoogleAdsTables from '../../components/GoogleAdsTables';
import MetaAdsTables from '../../components/MetaAdsTables';
import GoogleAdsExpandableCampaignTable from '../../components/GoogleAdsExpandableCampaignTable';
import ClientSelector from '../../components/ClientSelector';

import { useAuth } from '../../components/AuthProvider';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';
import { getMonthBoundaries, getWeekBoundaries, getISOWeekStartDate, getWeeksInYear } from '../../lib/date-range-utils';
import { isCurrentWeekPeriod, parseWeekPeriodId } from '../../lib/week-utils';

type Client = Database['public']['Tables']['clients']['Row'];

// Helper function to format date ranges for display
const formatDateRange = (start: string, end: string): string => {
  if (!start || !end) return '';
  
  const startDate = new Date(start);
  const endDate = new Date(end);
  
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return 'Nieprawidłowy zakres dat';
  }
  
  return `${startDate.toLocaleDateString('pl-PL')} - ${endDate.toLocaleDateString('pl-PL')}`;
};

// 🔧 DATA SOURCE INDICATOR: Component to show which data source is being used
const DataSourceIndicator = ({ validation, debug }: { 
  validation?: any; 
  debug?: any; 
}) => {
  if (!validation && !debug) return null;

  const getSourceColor = (source: string) => {
    // Handle fresh cache sources (monthly and weekly)
    if (source.includes('cache') && !source.includes('stale') && !source.includes('miss')) {
      return 'bg-green-100 text-green-800'; // Fresh cache
    }
    
    // Handle stale cache sources (monthly and weekly)  
    if (source.includes('stale') || source.includes('cache-miss')) {
      return 'bg-yellow-100 text-yellow-800'; // Stale cache
    }
    
    // Handle database sources
    if (source.includes('database') || source.includes('historical')) {
      return 'bg-blue-100 text-blue-800'; // Database
    }
    
    // Handle live API sources (but not if it contains 'cache' which indicates cached live data)
    if ((source.includes('live') || source.includes('api') || source.includes('refresh')) && !source.includes('cache')) {
      return 'bg-red-100 text-red-800'; // Live API
    }
    
    // Specific cases
    switch (source) {
      case 'smart-cache-fresh': case 'weekly-cache': case 'monthly-cache': 
        return 'bg-green-100 text-green-800';
      case 'smart-cache-stale': case 'stale-weekly-cache': case 'stale-monthly-cache':
        return 'bg-yellow-100 text-yellow-800';
      case 'database': case 'database-historical': 
        return 'bg-blue-100 text-blue-800';
      case 'live-api': case 'force-weekly-refresh': case 'force-monthly-refresh':
        return 'bg-red-100 text-red-800';
      default: 
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSourceIcon = (source: string) => {
    // Handle fresh cache sources (monthly and weekly)
    if (source.includes('cache') && !source.includes('stale') && !source.includes('miss')) {
      return '🟢'; // Fresh cache
    }
    
    // Handle stale cache sources (monthly and weekly)
    if (source.includes('stale') || source.includes('cache-miss')) {
      return '🟡'; // Stale cache
    }
    
    // Handle database sources
    if (source.includes('database') || source.includes('historical')) {
      return '🔵'; // Database
    }
    
    // Handle live API sources (but not if it contains 'cache' which indicates cached live data)
    if ((source.includes('live') || source.includes('api') || source.includes('refresh')) && !source.includes('cache')) {
      return '🔴'; // Live API
    }
    
    // Specific cases
    switch (source) {
      case 'smart-cache-fresh': case 'weekly-cache': case 'monthly-cache':
        return '🟢';
      case 'smart-cache-stale': case 'stale-weekly-cache': case 'stale-monthly-cache':
        return '🟡';
      case 'database': case 'database-historical':
        return '🔵';
      case 'live-api': case 'force-weekly-refresh': case 'force-monthly-refresh':
        return '🔴';
      default:
        return '⚪';
    }
  };

  const source = debug?.source || validation?.actualSource || 'unknown';
  const cachePolicy = debug?.cachePolicy || 'unknown';
  const potentialBypass = validation?.potentialCacheBypassed;

  return (
    <div className="mb-4 p-3 rounded-lg border bg-gray-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Źródło danych:</span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSourceColor(source)}`}>
            {getSourceIcon(source)} {source}
          </span>
          {potentialBypass && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              ⚠️ Potencjalne ominięcie cache
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500">
          Polityka: {cachePolicy}
        </div>
      </div>
      {validation && (
        <div className="mt-2 text-xs text-gray-600">
          Oczekiwane: {validation.expectedSource} | Rzeczywiste: {validation.actualSource}
          {validation.cacheFirstEnforced && ' | Cache-first: włączone'}
          {source.includes('weekly') && ' | Typ: Tygodniowy'}
          {source.includes('monthly') && ' | Typ: Miesięczny'}
        </div>
      )}
    </div>
  );
};

// 🔧 STANDARDIZED DATA FETCHING: Use StandardizedDataFetcher for all report data requests
const fetchReportDataUnified = async (params: {
  dateRange: { start: string; end: string };
  clientId: string;
  platform?: string;
  forceFresh?: boolean;
  reason?: string;
  session?: any;
}) => {
  const { dateRange, clientId, platform = 'meta', forceFresh = false, reason, session } = params;
  
  console.log('📡 🔧 STANDARDIZED DATA FETCH (REPORTS):', {
    dateRange,
    clientId,
    platform,
    forceFresh,
    reason,
    timestamp: new Date().toISOString()
  });

  console.log('🎯 STANDARDIZED REPORTS FETCH: Using consistent logic for all periods');

  try {
    let result;
    
    if (platform === 'google') {
      // Use separate Google Ads system (server-side only)
      console.log('🎯 Using GoogleAdsStandardizedDataFetcher for Google Ads reports...');
      
      if (typeof window === 'undefined') {
        // Server-side: use Google Ads fetcher directly
        const { GoogleAdsStandardizedDataFetcher } = await import('../../lib/google-ads-standardized-data-fetcher');
        
        result = await GoogleAdsStandardizedDataFetcher.fetchData({
          clientId,
          dateRange,
          reason: reason || 'google-ads-reports-standardized',
          sessionToken: session?.access_token
        });
      } else {
        // Client-side: redirect to API endpoint with authentication
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data: { session: clientSession } } = await supabase.auth.getSession();
        
        const response = await fetch('/api/fetch-google-ads-live-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${clientSession?.access_token || ''}`
          },
          body: JSON.stringify({
            clientId,
            dateRange,
            reason: reason || 'google-ads-reports-standardized'
          })
        });
        
        if (!response.ok) {
          throw new Error(`Google Ads API call failed: ${response.status}`);
        }
        
        result = await response.json();
      }
    } else {
      // Use Meta system
      console.log('🎯 Using StandardizedDataFetcher for Meta reports...');
      const { StandardizedDataFetcher } = await import('../../lib/standardized-data-fetcher');
      
      result = await StandardizedDataFetcher.fetchData({
        clientId,
        dateRange,
        platform: 'meta',
        reason: reason || 'meta-reports-standardized',
        sessionToken: session?.access_token
      });
    }
    
    // Transform StandardizedDataFetcher result to match expected format
    if (result.success && result.data) {
      const transformedResult = {
        success: true,
        data: {
          campaigns: result.data.campaigns || [],
          stats: result.data.stats,
          conversionMetrics: result.data.conversionMetrics,
          dataSourceValidation: {
            // ✅ FIX: Use actual validation from fetcher, not hardcoded values
            expectedSource: result.validation?.expectedSource || 'unknown',
            actualSource: result.validation?.actualSource || result.debug?.source || 'unknown',
            isConsistent: result.validation?.isConsistent || false
          }
        },
        debug: {
          source: result.debug?.source || 'standardized-fetcher',
          // ✅ FIX: Use actual cache policy from fetcher, better default for unknown
          cachePolicy: result.debug?.cachePolicy || (platform === 'google' ? 'google-ads-smart-cache' : 'database-first-standardized'),
          responseTime: result.debug?.responseTime || 0,
          reason: result.debug?.reason || reason,
          periodType: result.debug?.periodType || 'unknown'
        },
        validation: result.validation
      };
      
      console.log('✅ STANDARDIZED REPORTS FETCH SUCCESS:', {
        source: transformedResult.debug.source,
        periodType: transformedResult.debug.periodType,
        totalSpend: transformedResult.data.stats?.totalSpend,
        reservations: transformedResult.data.conversionMetrics?.reservations
      });
      
      return transformedResult;
    } else {
      throw new Error('StandardizedDataFetcher returned no data');
    }
    
  } catch (error) {
    console.error('❌ Standardized reports fetch failed:', error);
    throw error;
  }
};



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
  
  // Conversion tracking metrics
  click_to_call?: number;
  email_contacts?: number;
  booking_step_1?: number;
  reservations?: number;
  reservation_value?: number;
  booking_step_2?: number;
  booking_step_3?: number;
}

interface MonthlyReport {
  id: string;
  date_range_start: string;
  date_range_end: string;
  generated_at?: string;
  campaigns: Campaign[];
  conversionMetrics?: {
    click_to_call: number;
    email_contacts: number;
    booking_step_1: number;
    reservations: number;
    reservation_value: number;
    booking_step_2: number;
    booking_step_3: number;
    roas: number;
    cost_per_reservation: number;
    reach: number;
    offline_reservations: number;
    offline_value: number;
  };
}

interface WeeklyReport {
  id: string;
  date_range_start: string;
  date_range_end: string;
  generated_at?: string;
  campaigns: Campaign[];
  conversionMetrics?: {
    click_to_call: number;
    email_contacts: number;
    booking_step_1: number;
    reservations: number;
    reservation_value: number;
    booking_step_2: number;
    booking_step_3: number;
    roas: number;
    cost_per_reservation: number;
    reach: number;
    offline_reservations: number;
    offline_value: number;
  };
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: 'long'
  });
};

// Helper function to get week start and end dates - STANDARDIZED TO ISO
const getWeekDateRange = (year: number, week: number) => {
  // 🔧 STANDARDIZED: Use the same ISO week calculation as API and WeeklyReportView
  const yearNum = year;
  
  // January 4th is always in week 1 of the ISO year (SAME AS API)
  const jan4 = new Date(yearNum, 0, 4);
  
  // Find the Monday of week 1 (SAME AS API)
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  
  // Calculate the start date of the target week (SAME AS API)
  const weekStartDate = new Date(startOfWeek1);
  weekStartDate.setDate(startOfWeek1.getDate() + (week - 1) * 7);
  
  // Use timezone-safe date calculation (adds 6 days)
  const endDate = new Date(weekStartDate);
  endDate.setDate(weekStartDate.getDate() + 6);
  
  const formatDateForDisplay = (date: Date) => {
    // Use timezone-safe formatting to avoid UTC conversion issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${day}.${month}`;
  };
  
  const result = `${formatDateForDisplay(weekStartDate)} - ${formatDateForDisplay(endDate)}.${year}`;
  // Helper function for consistent date formatting
  const formatDateForAPI = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  console.log(`🔧 DROPDOWN ISO: Week ${week} of ${year} = ${result} (startDate: ${formatDateForAPI(weekStartDate)}, endDate: ${formatDateForAPI(endDate)})`);
  
  return result;
};



import { ReportsLoading } from '../../components/LoadingSpinner';

// Main Reports Component
function ReportsPageContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [reports, setReports] = useState<{ [key: string]: MonthlyReport | WeeklyReport }>({});
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
  const [loadingPeriod, setLoadingPeriod] = useState<string | null>(null);
  const [viewType, setViewType] = useState<'monthly' | 'weekly' | 'all-time' | 'custom'>('monthly');
  const [apiCallInProgress, setApiCallInProgress] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: ''
  });
  const [isGeneratingCustomReport, setIsGeneratingCustomReport] = useState(false);
  const [isGeneratingDevReport, setIsGeneratingDevReport] = useState(false);
  const [isGeneratingAllTimeReport, setIsGeneratingAllTimeReport] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [metaTablesData, setMetaTablesData] = useState<{
    placementPerformance: any[];
    demographicPerformance: any[];
    adRelevanceResults: any[];
  } | null>(null);
  const [activeAdsProvider, setActiveAdsProvider] = useState<'meta' | 'google'>('meta');
  
  // 🔧 DATA SOURCE VALIDATION: Track data source information for debugging
  const [dataSourceInfo, setDataSourceInfo] = useState<{
    validation?: any;
    debug?: any;
    lastUpdated?: string;
  }>({});

  // Loading timeout mechanism to prevent infinite loading states
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (loadingPeriod) {
      console.log(`⏰ Setting 60-second timeout for loading period: ${loadingPeriod}`);
      timeoutId = setTimeout(() => {
        console.log(`⏰ TIMEOUT: Clearing loading state for ${loadingPeriod} after 120 seconds`);
        setLoadingPeriod(null);
        setApiCallInProgress(false);
        loadingRef.current = false;
        setError(`Loading timeout: ${activeAdsProvider} API request took too long. Please try again.`);
      }, 120000); // 120 seconds timeout for Google Ads (slower than Meta)
    }
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [loadingPeriod, activeAdsProvider]);

  // Auto-set provider based on available platforms
  useEffect(() => {
    if (selectedClient) {
      const hasMetaAds = selectedClient.meta_access_token && selectedClient.ad_account_id;
      const hasGoogleAds = selectedClient.google_ads_enabled && selectedClient.google_ads_customer_id;
      
      // If only Google Ads is available, switch to it
      if (!hasMetaAds && hasGoogleAds) {
        setActiveAdsProvider('google');
      }
      // If only Meta Ads is available, ensure we're on Meta (default)
      else if (hasMetaAds && !hasGoogleAds) {
        setActiveAdsProvider('meta');
      }
      // If both are available, keep current selection or default to Meta
    }
  }, [selectedClient]);

  // Refresh data when provider changes
  useEffect(() => {
    if (selectedPeriod && selectedClient) {
      console.log(`🔄 Provider changed to ${activeAdsProvider}, refreshing data for period: ${selectedPeriod}`);
      
      // 🔧 CRITICAL FIX: Use setTimeout to ensure state updates are processed
      const switchProvider = async () => {
        // Clear any existing loading state first
        setLoadingPeriod(null);
        setApiCallInProgress(false);
        loadingRef.current = false;
        
        // Clear current report to force refresh
        setReports(prev => {
          const newReports = { ...prev };
          delete newReports[selectedPeriod];
          return newReports;
        });
        
        // Clear ALL API call trackers for this client to allow fresh calls
        if ((window as any).apiCallTracker) {
          Object.keys((window as any).apiCallTracker).forEach(key => {
            if (key.includes(selectedClient.id)) {
              delete (window as any).apiCallTracker[key];
            }
          });
          console.log('🧹 Cleared ALL API call trackers for client:', selectedClient.id);
        }
        
        // Wait for state updates to complete
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Set loading state after clearing
        setLoadingPeriod(selectedPeriod);
        
        // Force fresh data load with new provider
        console.log(`🔄 FORCING FRESH DATA LOAD for ${activeAdsProvider} provider`);
        await loadPeriodDataWithClient(selectedPeriod, selectedClient, true); // Force clear cache
      };
      
      switchProvider();
    }
  }, [activeAdsProvider]);

  // Note: Mock Google Ads data removed - now using real API calls

  
  // Add refs to prevent duplicate calls
  const loadingRef = useRef(false);
  const clientLoadingRef = useRef(false);
  const mountedRef = useRef(false);
  const initialClientLoadRef = useRef(false);

  // Handle client change for admin users
  const handleClientChange = async (newClient: Client) => {
    console.log('🔄 Client changed in reports:', newClient.name);
    setSelectedClient(newClient);
    
    // Clear existing reports for the new client
    setReports({});
    
    // Reload data for the current period with the new client
    if (selectedPeriod) {
      console.log('📊 Reloading data for new client:', newClient.name);
      await loadPeriodDataWithClient(selectedPeriod, newClient);
    }
  };

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
    const clientIdFromUrl = urlParams.get('clientId') || urlParams.get('clientid');
    
    if (profileData.role === 'admin') {
      if (clientIdFromUrl) {
      // Admin viewing specific client
      console.log('🔍 Admin viewing specific client:', clientIdFromUrl);
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientIdFromUrl)
        .single();

      if (clientError) {
        console.error('Admin client fetch error:', clientError);
        throw new Error('Client not found or access denied');
      }
      
      return clientData;
      } else {
        // Admin without specific client - find first client with recent data
        console.log('🔍 Admin without clientId - finding client with recent data');
        
        // Get current month range for data check
        const now = new Date();
        const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const today = now.toISOString().split('T')[0];
        
        // Find clients with data in current month
        const { data: clientsWithData, error: dataError } = await supabase
          .from('daily_kpi_data')
          .select('client_id, clients!inner(*)')
          .gte('date', currentMonthStart)
          .lte('date', today)
          .order('date', { ascending: false })
          .limit(1);
        
        if (!dataError && clientsWithData && clientsWithData.length > 0) {
          const clientWithData = clientsWithData[0]?.clients;
          if (clientWithData) {
            console.log(`✅ Found client with current month data: ${clientWithData.name}`);
            return clientWithData;
          }
        }
        
        // Fallback: Find client with any recent data (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
        
        const { data: recentDataClients, error: recentError } = await supabase
          .from('daily_kpi_data')
          .select('client_id, clients!inner(*)')
          .gte('date', thirtyDaysAgoStr)
          .order('date', { ascending: false })
          .limit(1);
        
        if (!recentError && recentDataClients && recentDataClients.length > 0) {
          const clientWithRecentData = recentDataClients[0]?.clients;
          if (clientWithRecentData) {
            console.log(`✅ Found client with recent data: ${clientWithRecentData.name}`);
            return clientWithRecentData;
          }
        }
        
        // Final fallback: First available client
        console.log('🔄 No clients with recent data, using first available client');
        const { data: fallbackClient, error: fallbackError } = await supabase
          .from('clients')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(1)
          .single();
        
        if (fallbackError) {
          throw new Error('Failed to load any client data');
        }
        
        console.log(`⚠️ Using fallback client: ${fallbackClient.name} (may not have current data)`);
        return fallbackClient;
      }
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
      // For weekly, use proper ISO week format
      const year = date.getFullYear();
      const week = getWeekNumber(date);
      return `${year}-W${String(week).padStart(2, '0')}`;
    }
  };

  // Load all-time data by fetching month by month
  const loadAllTimeData = async () => {
    console.log('🚀 loadAllTimeData function called!');
    
    if (!selectedClient) {
      console.log('⚠️ Selected client not loaded yet, cannot load all-time data');
      return;
    }

    console.log('📊 Loading all-time data for client:', {
      id: selectedClient.id,
      name: selectedClient.name,
      email: selectedClient.email,
      adAccountId: selectedClient.ad_account_id,
      hasMetaToken: !!selectedClient.meta_access_token,
      tokenLength: selectedClient.meta_access_token?.length || 0
    });
    
    // Prevent duplicate calls (but allow all-time to override)
    if (loadingRef.current || apiCallInProgress) {
      console.log('⚠️ Already loading data, but this is all-time request - proceeding anyway');
      // For all-time requests, we want to proceed even if other data is loading
      // Reset the loading state to allow all-time to proceed
      loadingRef.current = false;
      setApiCallInProgress(false);
    }

    try {
      loadingRef.current = true;
      setApiCallInProgress(true);
      setLoadingPeriod('all-time');
      setIsGeneratingAllTimeReport(true);
      setError(null); // Clear any previous errors
      
      // Get session for API calls
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No access token available');
      }

      // For all-time, we need to determine the effective start date
      // First, get campaign creation dates to find the earliest campaign
      console.log('🔍 Getting campaign creation dates to determine effective start date...');
      
      const adAccountId = selectedClient.ad_account_id.startsWith('act_') 
        ? selectedClient.ad_account_id.substring(4)
        : selectedClient.ad_account_id;
      
      // Get campaigns to find earliest creation date with better error handling
      let earliestCampaignDate = null;
      let campaignsData = null;
      
      try {
        const campaignsResponse = await fetch(`https://graph.facebook.com/v18.0/act_${adAccountId}/campaigns?access_token=${selectedClient.meta_access_token}&fields=id,name,created_time,status`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (campaignsResponse.ok) {
          campaignsData = await campaignsResponse.json();
          if (campaignsData.data && campaignsData.data.length > 0) {
            console.log(`📊 Found ${campaignsData.data.length} campaigns in account`);
            
            // Find the earliest campaign creation date
            const campaignDates = campaignsData.data.map((c: any) => new Date(c.created_time));
            earliestCampaignDate = new Date(Math.min(...campaignDates));
            console.log(`📅 Earliest campaign created: ${earliestCampaignDate.toISOString().split('T')[0]}`);
            
            // Log campaign details for debugging
            campaignsData.data.forEach((campaign: any) => {
              const createdDate = new Date(campaign.created_time);
              console.log(`📊 Campaign: ${campaign.name} (${campaign.id}) - Created: ${createdDate.toISOString().split('T')[0]}, Status: ${campaign.status}`);
            });
          } else {
            console.log('⚠️ No campaigns found in account');
          }
        } else {
          console.log(`⚠️ Failed to fetch campaigns: ${campaignsResponse.status} ${campaignsResponse.statusText}`);
        }
      } catch (campaignError) {
        console.log('⚠️ Error fetching campaigns:', campaignError);
        // Continue with fallback logic
      }

      // Calculate effective start date with improved logic
      const currentDate = new Date();
      const maxPastDate = new Date();
      maxPastDate.setMonth(maxPastDate.getMonth() - 37); // Meta API limit: 37 months
      
      // Get client's business start date (when they were created in the system)
      const clientStartDate = new Date(selectedClient.created_at);
      console.log(`📅 Client business start date: ${clientStartDate.toISOString().split('T')[0]}`);
      console.log(`📅 Meta API limit date: ${maxPastDate.toISOString().split('T')[0]}`);
      
      // Use the earliest campaign date if available, otherwise use client start date
      let effectiveStartDate;
      if (earliestCampaignDate) {
        // Use the earliest campaign date as the start date
        effectiveStartDate = earliestCampaignDate;
        console.log(`📅 Using campaign-based start date: ${effectiveStartDate.toISOString().split('T')[0]}`);
      } else {
        // Fallback to client start date
        effectiveStartDate = clientStartDate;
        console.log(`📅 Using client-based start date: ${effectiveStartDate.toISOString().split('T')[0]}`);
      }
      
      // Use the 37-month Meta API limit as the effective start date for all-time requests
      // This ensures we get the maximum available data without hitting API limits
      const metaApiLimitDate = new Date();
      metaApiLimitDate.setMonth(metaApiLimitDate.getMonth() - 37);
      
      // For all-time requests, ALWAYS use the 37-month limit to avoid API errors
      // This is the maximum historical data available from Meta API
      effectiveStartDate = metaApiLimitDate;
      
      console.log(`📅 All-time date calculation (37-month limit enforced):`, {
        originalEffectiveStart: effectiveStartDate.toISOString().split('T')[0],
        metaApiLimit: metaApiLimitDate.toISOString().split('T')[0],
        finalStart: effectiveStartDate.toISOString().split('T')[0],
        reason: 'Using 37-month Meta API limit for all-time requests'
      });
      
      console.log(`📅 Effective start date: ${effectiveStartDate.toISOString().split('T')[0]}`);
      
      // Format dates properly for API
      const formatDateForAPI = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDate = formatDateForAPI(effectiveStartDate);
      const endDate = formatDateForAPI(currentDate);
      
      console.log(`📅 OPTIMIZED: Fetching all-time data in single API call from ${startDate} to ${endDate}`);
      console.log(`📅 Business perspective: Fetching from earliest available date (37-month Meta API limit)`);
      console.log(`📅 API limitation: Meta API only allows data from last 37 months - cannot go further back`);
      
      // Additional validation to ensure we're within API limits
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      const currentDateObj = new Date();
      const validationMaxPastDate = new Date();
      validationMaxPastDate.setMonth(validationMaxPastDate.getMonth() - 37);
      
      console.log(`📅 Date validation:`, {
        startDate,
        endDate,
        startDateObj: startDateObj.toISOString(),
        endDateObj: endDateObj.toISOString(),
        currentDateObj: currentDateObj.toISOString(),
        validationMaxPastDate: validationMaxPastDate.toISOString(),
        isStartWithinLimit: startDateObj >= validationMaxPastDate,
        isEndNotFuture: endDateObj <= currentDateObj,
        daysDiff: Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)) + 1
      });
      
      // OPTIMIZATION: Single API call instead of month-by-month
      const requestBody = {
        dateRange: {
          start: startDate,
          end: endDate
        },
        clientId: selectedClient.id,
        // forceFresh: true, // 🔧 REMOVED: Let system decide database vs live API
        reason: 'booking_steps_testing_all_time'
      };
      
      console.log(`📡 Making OPTIMIZED single API call for entire date range:`, requestBody);
      
      // 🎯 USE STANDARDIZED DATA FETCHER (loadAllTimeData)
      console.log('🎯 Using StandardizedDataFetcher for all-time data...');
      
      const response = await fetchReportDataUnified({
        dateRange: {
          start: startDate,
          end: endDate
        },
        clientId: selectedClient.id,
        platform: activeAdsProvider,
        forceFresh: false, // Use cached data for all-time reports (was causing rate limits)
        reason: 'all-time-standardized-cached',
        session
      });

      console.log(`✅ StandardizedDataFetcher all-time response:`, {
        success: response.success,
        source: response.debug?.source,
        cachePolicy: response.debug?.cachePolicy
      });

      if (response.success) {
        const data = response;
        console.log(`📊 Optimized all-time data result:`, {
          hasData: !!data,
          hasDataProperty: !!data.data,
          campaignsInData: data.data?.campaigns?.length || 0,
          campaignsDirect: data.data?.campaigns?.length || 0,
          dataKeys: Object.keys(data || {})
        });
        
        const allCampaigns = data.data?.campaigns || [];
        
        console.log(`📊 All-time data collection complete. Total campaigns found: ${allCampaigns.length}`);
        
        // Transform campaigns to match expected format
        const transformedCampaigns: Campaign[] = allCampaigns.map((campaign: any, index: number) => {
          // Parse conversion tracking data from actions array
          let click_to_call = 0;
          let email_contacts = 0;
          let reservations = 0;
          let reservation_value = 0;
          let booking_step_1 = 0;
          let booking_step_2 = 0;
          let booking_step_3 = 0;

          if (campaign.actions && Array.isArray(campaign.actions)) {
            campaign.actions.forEach((action: any) => {
              const actionType = action.action_type;
              const value = parseInt(action.value || '0');
              
              // 1. Potencjalne kontakty telefoniczne
              if (actionType.includes('click_to_call')) {
                click_to_call += value;
              }
              
              // 2. Potencjalne kontakty email
              if (actionType.includes('link_click') || actionType.includes('mailto') || actionType.includes('email')) {
                email_contacts += value;
              }
              
              // 3. Kroki rezerwacji – Etap 1 (search event in Booking Engine)
              if (actionType.includes('booking_step_1') || actionType.includes('search')) {
                booking_step_1 += value;
              }
              
              // 4. Rezerwacje (zakończone rezerwacje) - Conservative: Specific purchase events only
              if (actionType === 'purchase' || 
                  actionType.includes('fb_pixel_purchase') ||
                  actionType.includes('offsite_conversion.custom.fb_pixel_purchase')) {
                reservations += value;
              }
              
              // 8. Etap 2 rezerwacji - View content event in Booking Engine
              if (actionType.includes('booking_step_2') || 
                  actionType.includes('view_content')) {
                booking_step_2 += value;
              }
              
              // 9. Etap 3 rezerwacji - Initiate checkout event in Booking Engine
              if (actionType.includes('booking_step_3') || 
                  actionType.includes('initiate_checkout')) {
                booking_step_3 += value;
              }
            });
          }

          // 5. Wartość rezerwacji - Extract from action_values
          if (campaign.action_values && Array.isArray(campaign.action_values)) {
            campaign.action_values.forEach((actionValue: any) => {
              if (actionValue.action_type === 'purchase' || actionValue.action_type.includes('purchase')) {
                reservation_value = parseFloat(actionValue.value || '0');
              }
            });
          }

          return {
            id: campaign.campaign_id || `campaign-${index}`,
            campaign_id: campaign.campaign_id || '',
            campaign_name: campaign.campaign_name || campaign.name || 'Unknown Campaign',
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
            objective: campaign.objective || undefined,
            // Conversion tracking fields (parsed from actions)
            click_to_call,
            email_contacts,
            reservations,
            reservation_value,
            booking_step_1,
            booking_step_2,
            booking_step_3
          };
        });
        
        console.log(`📊 Transformed ${transformedCampaigns.length} campaigns for all-time view`);
        
        // Calculate totals for validation
        const totalSpend = transformedCampaigns.reduce((sum, campaign) => sum + campaign.spend, 0);
        const totalImpressions = transformedCampaigns.reduce((sum, campaign) => sum + campaign.impressions, 0);
        const totalClicks = transformedCampaigns.reduce((sum, campaign) => sum + campaign.clicks, 0);
        
        console.log(`📊 Aggregated totals: ${totalSpend.toFixed(2)} PLN, ${totalImpressions.toLocaleString()} impressions, ${totalClicks.toLocaleString()} clicks`);
        
        // Create the all-time report with improved validation
        const report: MonthlyReport | WeeklyReport = {
          id: 'all-time',
          date_range_start: startDate,
          date_range_end: endDate,
          generated_at: new Date().toISOString(),
          campaigns: transformedCampaigns
        };

        console.log('💾 Setting all-time report:', report);
        console.log('📊 Report details:', {
          id: report.id,
          date_range_start: report.date_range_start,
          date_range_end: report.date_range_end,
          campaignsCount: report.campaigns.length,
          totalSpend: totalSpend.toFixed(2),
          totalImpressions: totalImpressions.toLocaleString(),
          totalClicks: totalClicks.toLocaleString(),
          hasValidDates: !!(report.date_range_start && report.date_range_end)
        });
        
        // Validate that we have meaningful data
        if (transformedCampaigns.length === 0) {
          console.log('⚠️ No campaigns found in the date range - this might be normal if no campaigns were active');
        } else if (totalSpend === 0) {
          console.log('⚠️ Campaigns found but no spend data - this might indicate campaigns were paused or had no activity');
        } else {
          console.log('✅ Successfully loaded all-time data with meaningful spend information');
        }
        
        setReports(prev => {
          const newReports = { ...prev, 'all-time': report };
          console.log('💾 Updated reports state:', newReports);
          return newReports;
        });

      } else {
        console.log(`⚠️ Standardized fetch failed:`, response.debug?.reason);
        console.log(`❌ Error details:`, response.debug);
        
        // Fallback to empty report
        const emptyReport: MonthlyReport | WeeklyReport = {
          id: 'all-time',
          date_range_start: startDate,
          date_range_end: endDate,
          generated_at: new Date().toISOString(),
          campaigns: []
        };
        
        console.log('💾 Setting empty all-time report due to API failure');
        setReports(prev => ({ ...prev, 'all-time': emptyReport }));
      }

    } catch (error) {
      console.error('❌ Error loading all-time data:', error);
      
      // Show a more user-friendly error message with specific guidance
      let errorMessage = 'Failed to load all-time data';
      let errorDetails = '';
      
      if (error instanceof Error) {
        if (error.message.includes('Meta API Error')) {
          errorMessage = 'Meta API error: Unable to fetch campaign data';
          errorDetails = 'This might be due to token permissions, API limits, or no campaigns in the date range.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Request timed out: Meta API is taking too long to respond';
          errorDetails = 'Please try again. If the problem persists, the date range might be too large.';
        } else if (error.message.includes('No access token')) {
          errorMessage = 'Authentication error: No access token available';
          errorDetails = 'Please refresh the page and try again.';
        } else {
          errorMessage = `Error: ${error.message}`;
          errorDetails = 'Please check your internet connection and try again.';
        }
      }
      
      console.log(`❌ Error details: ${errorMessage} - ${errorDetails}`);
      setError(`${errorMessage}. ${errorDetails}`);
      
      // Show empty report instead of completely failing
      const emptyReport: MonthlyReport | WeeklyReport = {
        id: 'all-time',
        date_range_start: '',
        date_range_end: '',
        generated_at: new Date().toISOString(),
        campaigns: []
      };
      
      console.log('💾 Setting empty all-time report due to error');
      setReports(prev => ({ ...prev, 'all-time': emptyReport }));
    } finally {
      loadingRef.current = false;
      setApiCallInProgress(false);
      setLoadingPeriod(null);
      setIsGeneratingAllTimeReport(false);
    }
  };

  // Load custom date range data
  const loadCustomDateData = async (startDate: string, endDate: string) => {
    if (!client) {
      console.log('⚠️ Client not loaded yet, cannot load custom date data');
      return;
    }

    console.log('📊 Loading custom date data:', { startDate, endDate });
    
    // Prevent duplicate calls
    if (loadingRef.current || apiCallInProgress) {
      console.log('⚠️ Already loading data, skipping duplicate call');
      return;
    }

    try {
      loadingRef.current = true;
      setApiCallInProgress(true);
      setLoadingPeriod('custom');
      setIsGeneratingCustomReport(true);
      
      // Get session for API calls
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No access token available');
      }

      const requestBody = {
        dateRange: {
          start: startDate,
          end: endDate
        },
        clientId: client.id
      };
      
      console.log('📡 Making custom date API call with request body:', requestBody);
      
      // Determine API endpoint based on active provider
      // 🎯 USE STANDARDIZED DATA FETCHER (loadCustomDateData)
      console.log('🎯 Using StandardizedDataFetcher for custom date data...');
      
      const data = await fetchReportDataUnified({
        dateRange: requestBody.dateRange,
        clientId: requestBody.clientId,
        platform: activeAdsProvider,
        forceFresh: false,
        reason: 'custom-date-standardized',
        session
      });

      if (!data.success) {
        throw new Error(data.debug?.reason || 'Failed to load custom date data');
      }
      const rawCampaigns = data.data?.campaigns || data.data?.campaigns || [];
      
      const campaigns: Campaign[] = rawCampaigns.map((campaign: any, index: number) => {
        // Use already-parsed conversion tracking data from API response
        // The Meta API service already processes the actions and action_values
        const click_to_call = campaign.click_to_call || 0;
        const email_contacts = campaign.email_contacts || 0;
        const reservations = campaign.reservations || 0;
        const reservation_value = campaign.reservation_value || 0;
        const booking_step_1 = campaign.booking_step_1 || 0;
        const booking_step_2 = campaign.booking_step_2 || 0;
        const booking_step_3 = campaign.booking_step_3 || 0;

        return {
          id: campaign.campaign_id || `campaign-${index}`,
          campaign_id: campaign.campaign_id || '',
          campaign_name: campaign.campaign_name || campaign.name || 'Unknown Campaign',
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
          objective: campaign.objective || undefined,
          // Conversion tracking fields (parsed from actions)
          click_to_call,
          email_contacts,
          reservations,
          reservation_value,
          booking_step_1,
          booking_step_2,
          booking_step_3
        };
      });
      
      const report: MonthlyReport | WeeklyReport = {
        id: 'custom',
        date_range_start: startDate,
        date_range_end: endDate,
        generated_at: new Date().toISOString(),
        campaigns: campaigns
      };

      console.log('💾 Setting custom date report:', report);
      setReports(prev => ({ ...prev, 'custom': report }));

    } catch (error) {
      console.error('❌ Error loading custom date data:', error);
      
      // Show a more user-friendly error message
      let errorMessage = 'Failed to load custom date data';
      if (error instanceof Error) {
        if (error.message.includes('Meta API Error')) {
          errorMessage = 'Meta API error: The date range might be too large or there might be no data for this period.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Request timed out: The Meta API is taking too long to respond. Please try again.';
        } else {
          errorMessage = `Error: ${error.message}`;
        }
      }
      
      setError(errorMessage);
      
      // Show empty report instead of completely failing
      const emptyReport: MonthlyReport | WeeklyReport = {
        id: 'custom',
        date_range_start: startDate,
        date_range_end: endDate,
        generated_at: new Date().toISOString(),
        campaigns: []
      };
      
      console.log('💾 Setting empty custom report due to error');
      setReports(prev => ({ ...prev, 'custom': emptyReport }));
    } finally {
      loadingRef.current = false;
      setApiCallInProgress(false);
      setLoadingPeriod(null);
      setIsGeneratingCustomReport(false);
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
  const generatePeriodOptions = (type: 'monthly' | 'weekly' | 'all-time' | 'custom') => {
    if (type === 'all-time' || type === 'custom') {
      return []; // No periods for all-time and custom
    }
    
    const periods: string[] = [];
    const currentDate = new Date();
    const limit = type === 'monthly' ? 24 : 52; // 2 years for monthly, 1 year for weekly
    
    console.log(`📅 Generating periods using actual current date: ${currentDate.toISOString().split('T')[0]}`);
    
    for (let i = 0; i < limit; i++) {
      let periodDate: Date;
      
      if (type === 'monthly') {
        // For monthly, go back from current month
        periodDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      } else {
        // For weekly, use proper ISO week calculation (standardized)
        // Instead of simple Monday-based weeks, use ISO week boundaries
        
        // Get current ISO week
        const currentWeekNumber = getWeekNumber(currentDate);
        const currentYear = currentDate.getFullYear();
        
        // Calculate the target week number (go back i weeks from current)
        let targetWeek = currentWeekNumber - i;
        let targetYear = currentYear;
        
        // Handle year boundaries (ISO weeks can span years)
        if (targetWeek <= 0) {
          targetYear = currentYear - 1;
          targetWeek = getWeeksInYear(targetYear) + targetWeek;
        }
        
        // Calculate the actual date for this ISO week
        periodDate = getISOWeekStartDate(targetYear, targetWeek);
        
        console.log(`📅 ISO Weekly period ${i}: targetYear=${targetYear}, targetWeek=${targetWeek}, periodDate=${periodDate.toISOString().split('T')[0]}`);
      }
      
      // Validate that the period is not in the future
      if (periodDate > currentDate) {
        console.log(`⚠️ Skipping future period: ${generatePeriodId(periodDate, type)}`);
        continue;
      }
      
      // 🔧 REALISTIC DATE VALIDATION: Skip periods outside reasonable historical limits
      // Use system date but validate against Meta API limits (37 months back)
      const maxPastDate = new Date(currentDate);
      maxPastDate.setMonth(maxPastDate.getMonth() - 37); // Meta API limit: 37 months back
      
      // Only skip periods that are too far in the past (beyond Meta API limits)
      if (periodDate < maxPastDate) {
        console.log(`⚠️ Skipping period too far in the past: ${generatePeriodId(periodDate, type)}`, {
          periodDate: periodDate.toISOString().split('T')[0],
          currentDate: currentDate.toISOString().split('T')[0],
          maxPastDate: maxPastDate.toISOString().split('T')[0]
        });
        continue;
      }
      
      const periodId = generatePeriodId(periodDate, type);
      periods.push(periodId);
      
      // Special logging for the first few periods (current and recent)
      if (i < 3) {
        console.log(`📅 Generated period ${i} (${type}): ${periodId} from date ${periodDate.toISOString().split('T')[0]}`);
      }
    }
    
    console.log(`📅 Generated ${periods.length} periods for ${type} view`);
    console.log(`📅 First 5 ${type} periods:`, periods.slice(0, 5));
    return periods;
  };

  // Load data for a specific period with explicit client data
  const loadPeriodDataWithClient = async (periodId: string, clientData: Client, forceClearCache: boolean = false) => {
    // 🔧 FORCE CORRECT VIEW TYPE: Auto-fix view type mismatch to prevent January dates
    const detectedViewType = periodId.includes('-W') ? 'weekly' : 'monthly';
    if (viewType !== detectedViewType) {
      console.warn(`⚠️ VIEW TYPE MISMATCH: Period ${periodId} is ${detectedViewType} but current view is ${viewType}`);
      console.warn(`🔧 AUTO-FIXING: Switching to ${detectedViewType} view to prevent January dates`);
      
      // Force switch to correct view type
      setViewType(detectedViewType);
      
      // Don't continue with wrong view type - let the re-render handle it
      return;
    }
    
    console.log(`📊 Loading ${viewType} data for period: ${periodId} with explicit client`, { periodId, clientId: clientData.id, forceClearCache });
    
    // CRITICAL: Prevent ALL duplicate calls with multiple layers of protection
    const callKey = `${periodId}-${activeAdsProvider}-${clientData.id}`;
    
    // Layer 1: Check loading refs (but allow if forcing clear cache)
    if (!forceClearCache && (loadingRef.current || apiCallInProgress)) {
      console.log('🚫 BLOCKED: Already loading data (Layer 1)', {
        loadingRef: loadingRef.current,
        apiCallInProgress,
        periodId,
        activeAdsProvider,
        forceClearCache
      });
      return;
    }
    
    // Layer 2: Check recent calls (prevent calls within 2 seconds, but allow if forcing clear cache)
    const now = Date.now();
    if (!(window as any).apiCallTracker) (window as any).apiCallTracker = {};
    
    if (!forceClearCache && (window as any).apiCallTracker[callKey] && (now - (window as any).apiCallTracker[callKey]) < 2000) {
      console.log('🚫 BLOCKED: Recent call detected (Layer 2)', { 
        periodId, 
        activeAdsProvider,
        timeSinceLastCall: now - (window as any).apiCallTracker[callKey],
        forceClearCache
      });
      return;
    }
    
    // Layer 3: Check if we already have this data and it's not forced
    // 🔧 TEMPORARY FIX: Force refresh for all weekly data to clear corrupted cache
    const forceWeeklyRefresh = viewType === 'weekly';
    const existingReport = reports[periodId];
    if (!forceClearCache && !forceWeeklyRefresh && existingReport && existingReport.campaigns && existingReport.campaigns.length > 0) {
      console.log('🚫 BLOCKED: Data already exists (Layer 3)', {
        periodId,
        campaignCount: existingReport.campaigns.length
      });
      return;
    }
    
    if (forceWeeklyRefresh) {
      console.log('🔧 FORCING WEEKLY REFRESH: Clearing corrupted cached data for', periodId);
      // Clear the corrupted data to force fresh API call
      setReports(prev => {
        const newState = { ...prev };
        delete newState[periodId];
        return newState;
      });
    }
    
    // Track this call immediately
    (window as any).apiCallTracker[callKey] = now;
    console.log('✅ ALLOWED: API call proceeding', { periodId, activeAdsProvider, callKey });

    // Check if this is the current period (month or week)
    const isCurrentPeriod = (() => {
      if (viewType === 'monthly') {
        const [year, month] = periodId.split('-').map(Number);
        const currentDate = new Date();
        return year === currentDate.getFullYear() && month === (currentDate.getMonth() + 1);
      } else if (viewType === 'weekly') {
        return isCurrentWeekPeriod(periodId);
      }
      return false;
    })();

    // For previous periods, check if we already have this data
    // 🔧 DISABLED: Allow API calls for historical weeks to get fresh database data
    // if (!isCurrentPeriod && reports[periodId]) {
    //   console.log('✅ Data already loaded for previous period, skipping API call');
    //   return;
    // }

    if (isCurrentPeriod) {
      console.log(`🔄 Current ${viewType.slice(0, -2)} detected - using SMART CACHING system`);
      // Let smart caching handle current period data optimization
    } else {
      console.log(`📚 Previous ${viewType.slice(0, -2)} detected - will use stored data if available`);
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

    // 🔧 REALISTIC DATE VALIDATION: Prevent API calls for periods beyond realistic data range
    // Use system date but validate against reasonable historical limits
    const maxPastDate = new Date(currentDate);
    maxPastDate.setMonth(maxPastDate.getMonth() - 37); // Meta API limit: 37 months back
    
    // Only block periods that are too far in the past (beyond Meta API limits)
    if (periodDate < maxPastDate) {
      console.log('⚠️ Period is too far in the past (beyond Meta API limits), showing empty data', {
        periodId,
        periodDate: periodDate.toISOString().split('T')[0],
        currentDate: currentDate.toISOString().split('T')[0],
        maxPastDate: maxPastDate.toISOString().split('T')[0]
      });
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
      console.log(`🎯 Data source: ${isCurrentPeriod ? 'LIVE API (current period)' : 'API (previous period)'}`);
      
      // Get session for API calls
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No access token available');
      }

      let dateRange: { start: string; end: string };

      if (viewType === 'monthly') {
        // Parse month ID to get start and end dates
        const [year, month] = periodId.split('-').map(Number);
        
        // Check if this is the current month
        const currentDate = new Date();
        const isCurrentMonth = year === currentDate.getFullYear() && month === (currentDate.getMonth() + 1);
        
        // 🔧 FIX: Always use full month boundaries for consistency
        // The API will handle date validation and capping internally
        dateRange = getMonthBoundaries(year || new Date().getFullYear(), month || 1);
        
        console.log(`📅 Month date parsing (STANDARDIZED):`, {
          periodId,
          year,
          month,
          startDate: dateRange.start,
          endDate: dateRange.end,
          isCurrentMonth: isCurrentMonth,
          note: 'Using full month boundaries - API handles date validation'
        });
      } else {
        // Parse week ID to get start and end dates using standardized week calculation
        const [year, weekStr] = periodId.split('-W');
        const week = parseInt(weekStr || '1');
        const yearNum = parseInt(year || new Date().getFullYear().toString());
        
        // 🔧 FIX: Use standardized week calculation from week-utils
        const { parseWeekPeriodId } = await import('../../lib/week-utils');
        const weekInfo = parseWeekPeriodId(periodId);
        
        dateRange = {
          start: weekInfo.startDate,
          end: weekInfo.endDate
        };
        
        console.log(`📅 Standardized Week parsing for ${periodId}:`, {
          periodId,
          year: yearNum,
          week,
          dateRange,
          calculatedStart: dateRange.start,
          calculatedEnd: dateRange.end,
          calculationMethod: 'STANDARDIZED week-utils'
        });
      }
      
      // Use standardized date formatting
      periodStartDate = dateRange.start;
      periodEndDate = dateRange.end;
      
      console.log(`📅 Generated date range for ${periodId}: ${periodStartDate} to ${periodEndDate}`);
      
      // Fetch data from Meta API (current month always fresh, previous months may be cached)
      console.log(`📡 Fetching data from Meta API...`);
    
      // All clients now use real data - demo client logic removed for production deployment
      console.log(`🔍 Client ID: ${clientData?.id} - using real data`);
      if (false) { // Demo logic disabled for production
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
        clientId: clientData.id, // Always send the client ID for real clients
        platform: activeAdsProvider, // Include platform for database lookup
        ...(forceClearCache && { 
          [activeAdsProvider === 'google' ? 'forceRefresh' : 'forceFresh']: true 
        }) // Use correct force parameter based on provider
      };
      
      // 🚨 CRITICAL DEBUG: Verify what dates are being sent to API
      console.log('🚨 CRITICAL API REQUEST:', {
        periodId,
        viewType,
        periodStartDate,
        periodEndDate,
        requestBody,
        isWeekly: viewType === 'weekly',
        isCurrentPeriod,
        forceClearCache
      });
      
            // 🎯 DATA SOURCE DECISION DEBUG
      console.log('🎯 DATA SOURCE DECISION:', {
        periodId,
        isCurrentPeriod,
        viewType,
        forceClearCache,
        expectedSource: isCurrentPeriod ? 'SMART_CACHE' : 'DATABASE',
        reason: isCurrentPeriod ? 'Current period uses smart cache' : 'Historical period uses database'
      });
      
      console.log('📡 Making API call with request body:', requestBody);
      
      console.log('⏱️ Starting API call (no timeout - allowing full completion)...');
      
      // Add specific loading message for current vs historical periods
      if (isCurrentPeriod) {
        console.log(`📅 Current ${viewType.slice(0, -2)} detected - using smart cache (should be fast)`);
      } else {
        console.log(`📅 Previous ${viewType.slice(0, -2)} detected - using database (should be fast)`);
      }
      
      // 🎯 USE STANDARDIZED DATA FETCHER (loadPeriodDataWithClient)
      console.log('🎯 Using StandardizedDataFetcher for period data...');
      
      const response = await fetchReportDataUnified({
        dateRange,
        clientId: clientData.id,
        platform: activeAdsProvider,
        forceFresh: forceClearCache,
        reason: `period-${periodId}-standardized`,
        session
      });
      
      console.log('✅ StandardizedDataFetcher completed, processing response...');

      console.log('✅ StandardizedDataFetcher response:', {
        success: response.success,
        source: response.debug?.source,
        cachePolicy: response.debug?.cachePolicy
      });

      if (!response.success) {
        const errorReason = response.debug?.reason || 'Unknown error';
        console.error(`❌ StandardizedDataFetcher failed for ${periodId}:`, errorReason);
        
        // Show error message
        setError(`Failed to load ${activeAdsProvider} data for ${periodId}: ${errorReason}`);
        
        // Add empty period if fetch fails
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

      const data = response; // fetchReportDataUnified already returns processed data
      console.log(`✅ StandardizedDataFetcher successful for ${periodId}:`, data);
      console.log(`🎯 STANDARDIZED DATA received for ${periodId}`);
        
        // 🔧 DATA SOURCE TRACKING: Store validation info for UI display
        if (data.data?.dataSourceValidation || data.debug) {
          setDataSourceInfo({
            validation: data.data?.dataSourceValidation,
            debug: data.debug,
            lastUpdated: new Date().toISOString()
          });
        }
        
        // 🔧 DEBUG: Check if API returned empty campaigns despite cache having data
      const apiCampaigns = data.data?.campaigns || data.data?.campaigns || [];
        console.log(`🔍 API RESPONSE ANALYSIS:`, {
          periodId,
          apiSuccess: data.success,
          apiCampaignCount: apiCampaigns.length,
        apiFromCache: 'standardized-fetch',
        apiDateRange: 'standardized-fetch',
          expectedCacheData: '11 campaigns, 1723.33 PLN (from audit)',
          possibleIssue: apiCampaigns.length === 0 ? 'API not returning cached data properly' : 'API data looks good'
        });
        
        // 🚨 CRITICAL DEBUG: Check what the API actually returned
        console.log(`🚨 CRITICAL API RESPONSE:`, {
          periodId,
          activeAdsProvider,
          responseSuccess: data.success,
        apiDateRange: 'standardized-fetch',
        apiFromCache: 'standardized-fetch',
        apiLastUpdated: 'standardized-fetch',
        apiSource: data.debug?.source || 'standardized-fetch',
        campaignsCount: data.data?.campaigns?.length || data.data?.campaigns?.length || 0,
          totalSpend: data.data?.stats?.totalSpend || 'not available',
          isCurrentPeriod: isCurrentPeriod,
        hasError: !data.success,
        errorMessage: data.debug?.reason || 'none'
        });
        
        // 🔍 GOOGLE ADS SPECIFIC DEBUG
        if (activeAdsProvider === 'google') {
          console.log('🔍 GOOGLE ADS SPECIFIC DEBUG:', {
          success: data.success,
          source: data.debug?.source,
          cachePolicy: data.debug?.cachePolicy,
            hasDataProperty: !!data.data,
            dataKeys: data.data ? Object.keys(data.data) : [],
            campaignsInData: data.data?.campaigns?.length || 0,
            statsInData: data.data?.stats ? Object.keys(data.data.stats) : [],
            totalSpendInStats: data.data?.stats?.totalSpend
          });
        }
        
        console.log(`📊 Raw API response structure:`, {
          hasSuccess: !!data.success,
          hasData: !!data.data,
          dataKeys: data.data ? Object.keys(data.data) : [],
          campaignsInData: data.data?.campaigns?.length || 0,
        isPartialData: false,
        hasTimeoutError: false
      });

      // Transform API response to our report format  
      const rawCampaigns = data.data?.campaigns || [];
      console.log(`📊 Campaigns count: ${rawCampaigns.length}`);
      console.log(`📊 Data structure:`, {
        hasData: !!data,
        hasCampaigns: !!rawCampaigns,
        campaignsLength: rawCampaigns.length || 0,
        dataKeys: Object.keys(data || {})
      });
      
      console.log(`📊 Processing campaigns:`, {
        hasData: !!data,
        hasDataProperty: !!data.data,
        campaignsFromData: data.data?.campaigns?.length || 0,
        rawCampaigns: rawCampaigns.length
      });
      
      // 🔍 DEBUG: Check raw campaign data structure
      if (rawCampaigns.length > 0) {
        console.log(`🔍 RAW CAMPAIGN DATA DEBUG - Sample from API:`, {
          campaignName: rawCampaigns[0]?.campaign_name,
          spend: rawCampaigns[0]?.spend,
          click_to_call: rawCampaigns[0]?.click_to_call,
          email_contacts: rawCampaigns[0]?.email_contacts,
          booking_step_1: rawCampaigns[0]?.booking_step_1,
          reservations: rawCampaigns[0]?.reservations,
          reservation_value: rawCampaigns[0]?.reservation_value,
          booking_step_2: rawCampaigns[0]?.booking_step_2,
          booking_step_3: rawCampaigns[0]?.booking_step_3,
          allKeys: Object.keys(rawCampaigns[0] || {})
        });
      }
      
      // 🔧 ENHANCED: Check if we have conversionMetrics from the enhanced API
      const hasEnhancedConversionMetrics = !!data.data?.conversionMetrics;
      const enhancedConversionMetrics = data.data?.conversionMetrics;
      
      console.log(`🔧 Enhanced conversion metrics check:`, {
        hasEnhancedConversionMetrics,
        enhancedConversionMetrics: enhancedConversionMetrics ? Object.keys(enhancedConversionMetrics) : 'none',
        source: data.debug?.source || 'unknown'
      });
      
      // Transform campaigns to match frontend interface
      const campaigns: Campaign[] = rawCampaigns.map((campaign: any, index: number) => {
        // 🔧 FIXED: Always use campaign-level data, enhanced metrics are applied separately
        // The bug was applying enhanced totals to EACH campaign instead of using them as totals
        const click_to_call = campaign.click_to_call || 0;
        const email_contacts = campaign.email_contacts || 0;
        const reservations = campaign.reservations || 0;
        const reservation_value = campaign.reservation_value || 0;
        const booking_step_1 = campaign.booking_step_1 || 0;
        const booking_step_2 = campaign.booking_step_2 || 0;
        const booking_step_3 = campaign.booking_step_3 || 0;

        return {
          id: campaign.campaign_id || campaign.campaignId || `campaign-${index}`,
          campaign_id: campaign.campaign_id || campaign.campaignId || '',
          campaign_name: campaign.campaign_name || campaign.campaignName || campaign.name || 'Unknown Campaign',
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
          objective: campaign.objective || undefined,
          // Conversion tracking fields (parsed from actions)
          click_to_call,
          email_contacts,
          reservations,
          reservation_value,
          booking_step_1,
          booking_step_2,
          booking_step_3
        };
      });
      
      console.log(`📊 Transformed campaigns:`, campaigns.length, 'campaigns');
      
      // 🔧 ENHANCED: Log conversion metrics summary
      if (hasEnhancedConversionMetrics && enhancedConversionMetrics) {
        console.log(`🔧 ENHANCED CONVERSION METRICS SUMMARY:`, {
          reservations: enhancedConversionMetrics.reservations || 0,
          reservation_value: enhancedConversionMetrics.reservation_value || 0,
          booking_step_1: enhancedConversionMetrics.booking_step_1 || 0,
          booking_step_2: enhancedConversionMetrics.booking_step_2 || 0,
          booking_step_3: enhancedConversionMetrics.booking_step_3 || 0,
          source: data.debug?.source || 'unknown'
        });
      }
      
      if (campaigns.length > 0) {
        console.log(`📊 Sample campaign:`, campaigns[0]);
        console.log(`🔍 CONVERSION DATA DEBUG - Sample campaign:`, {
          campaignName: campaigns[0]?.campaign_name,
          click_to_call: campaigns[0]?.click_to_call,
          email_contacts: campaigns[0]?.email_contacts,
          booking_step_1: campaigns[0]?.booking_step_1,
          reservations: campaigns[0]?.reservations,
          reservation_value: campaigns[0]?.reservation_value,
          booking_step_2: campaigns[0]?.booking_step_2,
          booking_step_3: campaigns[0]?.booking_step_3
        });
        
        // 🔍 DATA FRESHNESS AUDIT
        console.log(`🕐 DATA FRESHNESS AUDIT:`, {
          dataSource: data.debug?.source || 'unknown',
          generatedAt: new Date().toISOString(),
          isFromCache: false,
          cacheAge: 'standardized-fetch',
          totalCampaigns: campaigns.length,
          totalSpend: campaigns.reduce((sum, c) => sum + c.spend, 0),
          dateRange: `${periodStartDate} to ${periodEndDate}`,
          isCurrentWeek: (() => {
            const currentDate = new Date();
            const currentYear = currentDate.getFullYear();
            const currentWeekNumber = getWeekNumber(currentDate);
            const currentWeekId = `${currentYear}-W${currentWeekNumber}`;
            return periodId === currentWeekId;
          })(),
          shouldBeFreshData: (() => {
            const currentDate = new Date();
            const currentYear = currentDate.getFullYear();
            const currentWeekNumber = getWeekNumber(currentDate);
            const currentWeekId = `${currentYear}-W${currentWeekNumber}`;
            return periodId === currentWeekId ? 'YES - Current week' : 'NO - Historical';
          })()
        });
      }
      
      // 🚨 FIX: For weekly reports, ALWAYS use the calculated dates, not API response dates
      // The API might return wrong date ranges for weekly data
      let correctStartDate, correctEndDate;
      
      if (viewType === 'weekly') {
        // For weekly reports, use the calculated dates from the period parsing
        correctStartDate = periodStartDate;
        correctEndDate = periodEndDate;
        console.log(`🔧 WEEKLY OVERRIDE: Using calculated dates for ${periodId}`, {
          calculatedStart: periodStartDate,
          calculatedEnd: periodEndDate,
          reason: 'Weekly reports must use exact week boundaries',
          spend: campaigns.reduce((sum, c) => sum + c.spend, 0),
          campaignCount: campaigns.length
        });
      } else {
        // For monthly reports, use the period dates (StandardizedDataFetcher doesn't return dateRange)
        correctStartDate = periodStartDate;
        correctEndDate = periodEndDate;
      }
      
      console.log(`🔧 REPORT OBJECT FIX:`, {
        periodId,
        originalStart: periodStartDate,
        originalEnd: periodEndDate,
        usingStart: correctStartDate,
        usingEnd: correctEndDate,
        viewType: viewType,
        dateSource: viewType === 'weekly' ? 'calculated' : 'api_or_calculated'
      });
      
      const report: MonthlyReport | WeeklyReport = {
        id: periodId,
        date_range_start: correctStartDate,
        date_range_end: correctEndDate,
        generated_at: new Date().toISOString(),
        campaigns: campaigns,
        conversionMetrics: {
          ...data.data?.conversionMetrics,
          reach: 0,
          offline_reservations: 0,
          offline_value: 0
        }
      };

      console.log(`💾 Setting successful report for ${periodId}:`, report);
      console.log(`💾 Report campaigns count:`, report.campaigns.length);
      console.log(`💾 Report conversionMetrics:`, report.conversionMetrics);
      if (report.campaigns.length > 0) {
        console.log(`💾 Sample campaign:`, report.campaigns[0]);
      }
      console.log(`🎯 ${isCurrentPeriod ? 'LIVE API DATA' : 'API DATA'} set for ${periodId} with ${campaigns.length} campaigns`);
      
      setReports(prev => {
        const newState = { ...prev, [periodId]: report };
        console.log('💾 Updated reports state:', {
          periodId,
          totalReports: Object.keys(newState).length,
          allPeriods: Object.keys(newState),
          dataSource: isCurrentPeriod ? 'LIVE API' : 'API',
          selectedPeriodData: newState[periodId]?.campaigns?.length || 0
        });
        return newState;
      });
    } catch (error) {
      console.error(`❌ Error loading ${viewType} data for ${periodId}:`, error);
      
      // Check if this is current month
      const isCurrentMonth = (() => {
        if (viewType === 'monthly') {
          const [year, month] = periodId.split('-').map(Number);
          const currentDate = new Date();
          return year === currentDate.getFullYear() && month === (currentDate.getMonth() + 1);
        }
        return false;
      })();
      
      // Check if it's a timeout error
      if (error instanceof Error && error.message.includes('timeout')) {
        setError(`API request timed out for ${periodId}. This might be due to Meta API being slow or the date range having no data. Please try again or select a different period.`);
      }
      
      if (isCurrentMonth) {
        // For current month, provide better error handling and retry option
        console.log('🔄 Current month API failed - providing retry option');
        const emptyReport: MonthlyReport | WeeklyReport = {
          id: periodId,
          date_range_start: periodStartDate || '',
          date_range_end: periodEndDate || '',
          generated_at: new Date().toISOString(),
          campaigns: []
        };

        console.log('💾 Setting empty report for current month API failure:', emptyReport);
        setReports(prev => ({ ...prev, [periodId]: emptyReport }));
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('timeout')) {
          setError(`Current month data loading timed out. This can happen with live Meta API calls. Please try refreshing the page or contact support if the issue persists.`);
        } else {
          setError(`API Error for current month: ${errorMessage}. Please try again or contact support.`);
        }
      } else {
        // For previous months, show fallback data if API fails
        console.log('🔄 Previous month API failed - showing fallback data');
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

        console.log('💾 Setting fallback report for previous month:', fallbackReport);
        setReports(prev => ({ ...prev, [periodId]: fallbackReport }));
        
        setError(`API Error: ${error instanceof Error ? error.message : 'Unknown error'}. Showing fallback data.`);
      }
    } finally {
      loadingRef.current = false;
      setApiCallInProgress(false);
      setLoadingPeriod(null);
    }
  };

  // Load data for a specific period
  const loadPeriodData = async (periodId: string) => {
    console.log(`📊 Loading ${viewType} data for period: ${periodId}`, { periodId, client: selectedClient?.id });
    
    // Guard: Ensure selectedClient is loaded before making API calls
    if (!selectedClient || !selectedClient.id) {
      console.warn('⚠️ Selected client not loaded yet, skipping API call');
      return;
    }

    // Use the explicit client function to avoid race conditions
    await loadPeriodDataWithClient(periodId, selectedClient);
  };

  // Load data for a specific period with cache clearing (removed to fix ESLint)

    // Dev function to generate fresh report bypassing cache - uses EXACTLY the same logic as loadPeriodDataWithClient
  const generateDevReport = async () => {
    if (!selectedClient) {
      console.log('⚠️ Selected client not loaded yet, cannot generate dev report');
      return;
    }

    console.log('🔧 DEV: Generating fresh report bypassing cache for client:', selectedClient.name);
    
    // Prevent duplicate calls
    if (loadingRef.current || apiCallInProgress) {
      console.log('⚠️ Already loading data, skipping duplicate dev call');
      return;
    }

    // Use the exact same logic as loadPeriodDataWithClient but with forceFresh: true
    if (viewType === 'all-time') {
      // For all-time, use the same logic as loadAllTimeData
      console.log('🔧 DEV: Using all-time logic with force fresh');
      await loadAllTimeData();
    } else if (viewType === 'custom') {
      // For custom, use the same logic as loadCustomDateData
      if (!customDateRange.start || !customDateRange.end) {
        setError('Proszę wybrać zakres dat dla raportu deweloperskiego');
        return;
      }
      console.log('🔧 DEV: Using custom date logic with force fresh');
      await loadCustomDateData(customDateRange.start, customDateRange.end);
    } else {
      // For monthly/weekly, use the same logic as loadPeriodDataWithClient
      if (!selectedPeriod) {
        setError('Proszę wybrać okres dla raportu deweloperskiego');
        return;
      }
      
      console.log('🔧 DEV: Using period logic with force fresh for period:', selectedPeriod);
      
      // Use the exact same logic as loadPeriodDataWithClient but with forceFresh: true
      const loadPeriodDataWithClientDev = async (periodId: string, clientData: Client) => {
        console.log(`🔧 DEV: Loading ${viewType} data for period: ${periodId} with force fresh`, { periodId, clientId: clientData.id });
        
        // Prevent duplicate calls
        if (loadingRef.current || apiCallInProgress) {
          console.log('⚠️ Already loading data, skipping duplicate dev call');
          return;
        }

        // Note: isCurrentMonth logic removed as it was unused

        // Check if this period is in the future (same logic as original)
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

        // 🔧 REALISTIC DATE VALIDATION: Prevent API calls for periods beyond realistic data range (DEV)
        // Use system date but validate against reasonable historical limits
        const maxPastDate = new Date(currentDate);
        maxPastDate.setMonth(maxPastDate.getMonth() - 37); // Meta API limit: 37 months back
        
        // Only block periods that are too far in the past (beyond Meta API limits)
        if (periodDate < maxPastDate) {
          console.log('🔧 DEV: Period is too far in the past (beyond Meta API limits), showing empty data', {
            periodId,
            periodDate: periodDate.toISOString().split('T')[0],
            currentDate: currentDate.toISOString().split('T')[0],
            maxPastDate: maxPastDate.toISOString().split('T')[0]
          });
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

        // Declare date variables at function level (same as original)
        let periodStartDate = '';
        let periodEndDate = '';

        try {
          loadingRef.current = true;
          setApiCallInProgress(true);
          setIsGeneratingDevReport(true);
          setError(null);
          setLoadingPeriod(periodId);
          console.log(`🔧 DEV: Loading data for ${viewType} period: ${periodId}`);
          console.log(`👤 Using explicit client:`, clientData);
          console.log(`🎯 Data source: DEV FRESH API (bypassing cache)`);
          
          // Get session for API calls
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) {
            throw new Error('No access token available');
          }

          let dateRange: { start: string; end: string };

          if (viewType === 'monthly') {
            // Parse month ID to get start and end dates (EXACTLY same logic as original)
            const [year, month] = periodId.split('-').map(Number);
            
            // Check if this is the current month (same logic as original)
            const currentDate = new Date();
            const isCurrentMonth = year === currentDate.getFullYear() && month === (currentDate.getMonth() + 1);
            
            if (isCurrentMonth) {
              // 🔧 FIX: For current month, cap end date to today to avoid future date API errors
              const monthBoundaries = getMonthBoundaries(year || new Date().getFullYear(), month || 1);
              const todayISO = new Date().toISOString().split('T')[0];
              const today: string = todayISO || new Date().toISOString().substring(0, 10); // Ensure string type
              
              dateRange = {
                start: monthBoundaries.start,
                end: today // Cap to today to avoid "future date" API errors (e.g., Sept 1-8 if today is Sept 8)
              };
              
              console.log(`🔧 DEV: Current month date parsing (FIXED):`, {
                periodId,
                year,
                month,
                startDate: dateRange.start,
                endDate: dateRange.end,
                isCurrentMonth: true,
                note: 'Capped end date to today to avoid future date API errors'
              });
            } else {
              // For past months: use the full month boundaries
              dateRange = getMonthBoundaries(year || new Date().getFullYear(), month || 1);
              
              console.log(`🔧 DEV: Past month date parsing:`, {
                periodId,
                year,
                month,
                startDate: dateRange.start,
                endDate: dateRange.end,
                isCurrentMonth: false,
                note: 'Using full month boundaries for past months'
              });
            }
          } else {
            // Parse week ID to get start and end dates using proper ISO week calculation (same logic as original)
            const [year, weekStr] = periodId.split('-W');
            const week = parseInt(weekStr || '1');
            
            // Proper ISO week calculation - find the start date of the given ISO week
            const yearNum = parseInt(year || new Date().getFullYear().toString());
            
            // January 4th is always in week 1 of the ISO year
            const jan4 = new Date(yearNum, 0, 4);
            
            // Find the Monday of week 1
            const startOfWeek1 = new Date(jan4);
            startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
            
            // Calculate the start date of the target week
            const weekStartDate = new Date(startOfWeek1);
            weekStartDate.setDate(startOfWeek1.getDate() + (week - 1) * 7);
            
            dateRange = getWeekBoundaries(weekStartDate);
            
            console.log(`🔧 DEV: ISO Week parsing for ${periodId}:`, {
              periodId,
              year: yearNum,
              week,
              jan4: jan4.toISOString().split('T')[0],
              startOfWeek1: startOfWeek1.toISOString().split('T')[0],
              weekStartDate: weekStartDate.toISOString().split('T')[0],
              dateRange
            });
          }
          
          // Use standardized date formatting (same logic as original)
          periodStartDate = dateRange.start;
          periodEndDate = dateRange.end;
          
          console.log(`🔧 DEV: Generated date range for ${periodId}: ${periodStartDate} to ${periodEndDate}`);
          
          // Fetch data with smart routing - current periods from API, historical from database
          console.log(`🔧 DEV: Fetching data with smart routing (current: API, historical: database)...`);
        
          // All clients now use real data - demo client logic removed for production deployment
          console.log(`🔍 Client ID: ${clientData?.id} - using real data`);
          if (false) { // Demo logic disabled for production
            console.log(`🎭 Demo client, skipping API call and showing demo data`);
            
            // Show demo data for demo client (same logic as original)
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
        
          // Make API call for the specific period - FIXED: Respect database for historical periods
          // Check if this is the current period (month or week)
          const isCurrentPeriod = (() => {
            if (viewType === 'monthly') {
              const [year, month] = periodId.split('-').map(Number);
              const currentDate = new Date();
              return year === currentDate.getFullYear() && month === (currentDate.getMonth() + 1);
            } else if (viewType === 'weekly') {
              return isCurrentWeekPeriod(periodId);
            }
            return false;
          })();
          
          const requestBody = {
            dateRange: {
              start: periodStartDate,
              end: periodEndDate
            },
            clientId: clientData.id, // Always send the client ID for real clients
            // FIXED: Let smart routing decide database vs live API based on data availability
            // ...(isCurrentPeriod && { forceFresh: true }) // REMOVED: Causing live API calls for August 2025
          };
          console.log('🔧 DEV: Making API call with smart routing:', {
            ...requestBody,
            isCurrentPeriod,
            willForceFresh: isCurrentPeriod,
            expectedSource: isCurrentPeriod ? 'LIVE_API' : 'DATABASE'
          });
          
          console.log('⏱️ Starting API call (no timeout - allowing full completion)...');
          
          // 🎯 USE STANDARDIZED DATA FETCHER (dev function)
          console.log('🎯 Using StandardizedDataFetcher for dev fresh data...');
          
          const response = await fetchReportDataUnified({
            dateRange,
            clientId: clientData.id,
            platform: activeAdsProvider,
            forceFresh: true, // Dev function always forces fresh
            reason: `dev-${periodId}-standardized`,
            session
          });
          
          console.log('✅ StandardizedDataFetcher completed, processing response...');

          console.log('✅ StandardizedDataFetcher response:', {
            success: response.success,
            source: response.debug?.source,
            cachePolicy: response.debug?.cachePolicy
          });

          if (!response.success) {
            const errorReason = response.debug?.reason || 'Unknown error';
            console.error(`❌ StandardizedDataFetcher failed for ${periodId}:`, errorReason);
            
            setError(`Failed to load ${activeAdsProvider} data for ${periodId}: ${errorReason}`);
            
            // Add empty period if fetch fails
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

          const data = response; // fetchReportDataUnified already returns processed data
          console.log(`✅ StandardizedDataFetcher successful for ${periodId}:`, data);
          console.log(`🎯 DEV STANDARDIZED DATA received for ${periodId}`);
          console.log(`📊 Standardized response structure:`, {
              hasSuccess: !!data.success,
              hasData: !!data.data,
              dataKeys: data.data ? Object.keys(data.data) : [],
              campaignsInData: data.data?.campaigns?.length || 0,
            source: data.debug?.source
          });
          console.log(`📊 Campaigns count: ${data.data?.campaigns?.length || 0}`);
          console.log(`📊 Data structure:`, {
            hasData: !!data,
            hasCampaigns: !!data.data?.campaigns,
            campaignsLength: data.data?.campaigns?.length || 0,
            dataKeys: Object.keys(data || {})
          });

          // Transform API response to our report format (same logic as original)
          const rawCampaigns = data.data?.campaigns || data.data?.campaigns || [];
          
          console.log(`📊 Processing campaigns:`, {
            hasData: !!data,
            hasDataProperty: !!data.data,
            campaignsFromData: data.data?.campaigns?.length || 0,
            campaignsDirect: data.data?.campaigns?.length || 0,
            rawCampaigns: rawCampaigns.length
          });
          
          // Transform campaigns to match frontend interface (same logic as original)
          const campaigns: Campaign[] = rawCampaigns.map((campaign: any, index: number) => {
            // Use already-parsed conversion tracking data from API response
            const click_to_call = campaign.click_to_call || 0;
            const email_contacts = campaign.email_contacts || 0;
            const reservations = campaign.reservations || 0;
            const reservation_value = campaign.reservation_value || 0;
            const booking_step_1 = campaign.booking_step_1 || 0;
            const booking_step_2 = campaign.booking_step_2 || 0;
            const booking_step_3 = campaign.booking_step_3 || 0;

            return {
              id: campaign.campaign_id || `campaign-${index}`,
              campaign_id: campaign.campaign_id || '',
              campaign_name: campaign.campaign_name || campaign.name || 'Unknown Campaign',
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
              objective: campaign.objective || undefined,
              // Conversion tracking fields (parsed from actions)
              click_to_call,
              email_contacts,
              reservations,
              reservation_value,
              booking_step_1,
              booking_step_2,
              booking_step_3
            };
          });
          
          console.log(`📊 Transformed campaigns:`, campaigns.length, 'campaigns');
          if (campaigns.length > 0) {
            console.log(`📊 Sample campaign:`, campaigns[0]);
          }
          
          // 🚨 FIX: Use period dates (StandardizedDataFetcher doesn't return dateRange)
          const correctStartDate = periodStartDate;
          const correctEndDate = periodEndDate;
          
          console.log(`🔧 REPORT OBJECT FIX:`, {
            periodId,
            originalStart: periodStartDate,
            originalEnd: periodEndDate,
            apiReturnedStart: 'standardized-fetch',
            apiReturnedEnd: 'standardized-fetch',
            usingStart: correctStartDate,
            usingEnd: correctEndDate,
            isUsingAPIResponse: false
          });
          
          const report: MonthlyReport | WeeklyReport = {
            id: periodId,
            date_range_start: correctStartDate,
            date_range_end: correctEndDate,
            generated_at: new Date().toISOString(),
            campaigns: campaigns
          };

          console.log(`💾 Setting successful dev report for ${periodId}:`, report);
          console.log(`🎯 DEV FRESH API DATA set for ${periodId} with ${campaigns.length} campaigns`);
          setReports(prev => {
            const newState = { ...prev, [periodId]: report };
            console.log('💾 Updated reports state:', {
              periodId,
              totalReports: Object.keys(newState).length,
              allPeriods: Object.keys(newState),
              dataSource: 'DEV FRESH API'
            });
            return newState;
          });

          // Generate PDF with fresh data (same logic as InteractivePDFButton)
          console.log('🔧 DEV: Generating PDF with fresh data...');
          try {
            const totals = campaigns.reduce((acc, campaign) => ({
              spend: acc.spend + (campaign.spend || 0),
              impressions: acc.impressions + (campaign.impressions || 0),
              clicks: acc.clicks + (campaign.clicks || 0),
              conversions: acc.conversions + (campaign.conversions || 0)
            }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 });

            // Calculate derived metrics
            const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
            const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
            const cpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
            const calculatedTotals = { ...totals, ctr, cpc, cpa };

            // Fetch Meta tables data for PDF generation
            console.log('🔧 DEV: Fetching Meta tables data for PDF...');
            let metaTablesData = null;
            try {
              const metaTablesResponse = await fetch('/api/fetch-meta-tables', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                  dateRange: {
                    start: periodStartDate,
                    end: periodEndDate
                  },
                  clientId: clientData.id
                })
              });

              if (metaTablesResponse.ok) {
                const metaTablesResult = await metaTablesResponse.json();
                if (metaTablesResult.success) {
                  metaTablesData = metaTablesResult.data.metaTables; // Extract just the metaTables part
                  console.log('✅ DEV: Meta tables data fetched for PDF:', {
                    placementCount: metaTablesData.placementPerformance?.length || 0,
                    demographicCount: metaTablesData.demographicPerformance?.length || 0,
                    adRelevanceCount: metaTablesData.adRelevanceResults?.length || 0
                  });
                }
              }
            } catch (metaError) {
              console.error('⚠️ DEV: Failed to fetch Meta tables for PDF:', metaError);
            }

            const pdfRequestBody = {
              clientId: clientData.id,
              dateRange: {
                start: periodStartDate,
                end: periodEndDate
              }
              // Removed direct data - PDF will use smart caching for consistency
            };

            console.log('🔧 DEV: Making PDF generation request:', pdfRequestBody);

            const pdfResponse = await fetch('/api/generate-pdf', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify(pdfRequestBody)
            });

            if (!pdfResponse.ok) {
              const errorData = await pdfResponse.json().catch(() => ({}));
              console.error('❌ PDF generation failed:', errorData);
              throw new Error(errorData.error || `PDF generation failed: ${pdfResponse.status}`);
            }

            // Get the PDF blob
            const pdfBlob = await pdfResponse.blob();
            
            // Create download link
            const url = window.URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `dev-raport-meta-ads-${periodStartDate}-${periodEndDate}.pdf`;
            
            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up
            window.URL.revokeObjectURL(url);

            console.log('✅ DEV: PDF generated and downloaded successfully!');
          } catch (pdfError) {
            console.error('❌ Error generating PDF in dev mode:', pdfError);
            // Don't throw error, just log it - the data refresh was successful
          }

        } catch (error) {
          console.error(`❌ Error loading ${viewType} data for ${periodId}:`, error);
          
          // Check if this is current month (same logic as original)
          const isCurrentMonth = (() => {
            if (viewType === 'monthly') {
              const [year, month] = periodId.split('-').map(Number);
              const currentDate = new Date();
              return year === currentDate.getFullYear() && month === (currentDate.getMonth() + 1);
            }
            return false;
          })();
          
          // Check if it's a timeout error (same logic as original)
          if (error instanceof Error && error.message.includes('timeout')) {
            setError(`API request timed out for ${periodId}. This might be due to Meta API being slow or the date range having no data. Please try again or select a different period.`);
          }
          
          if (isCurrentMonth) {
            // For current month, don't show fallback data - show empty state instead (same logic as original)
            console.log('🔄 Current month API failed - showing empty state instead of fallback data');
            const emptyReport: MonthlyReport | WeeklyReport = {
              id: periodId,
              date_range_start: periodStartDate || '',
              date_range_end: periodEndDate || '',
              generated_at: new Date().toISOString(),
              campaigns: []
            };

            console.log('💾 Setting empty report for current month API failure:', emptyReport);
            setReports(prev => ({ ...prev, [periodId]: emptyReport }));
            
            setError(`API Error for current month: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again or contact support.`);
          } else {
            // For previous months, show fallback data if API fails (same logic as original)
            console.log('🔄 Previous month API failed - showing fallback data');
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

            console.log('💾 Setting fallback report for previous month:', fallbackReport);
            setReports(prev => ({ ...prev, [periodId]: fallbackReport }));
            
            setError(`API Error: ${error instanceof Error ? error.message : 'Unknown error'}. Showing fallback data.`);
          }
        } finally {
          loadingRef.current = false;
          setApiCallInProgress(false);
          setLoadingPeriod(null);
          setIsGeneratingDevReport(false);
        }
      };
      
      // Call the dev version of the function
      await loadPeriodDataWithClientDev(selectedPeriod, selectedClient);
    }
  };

  // Handle period change
  const handlePeriodChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newPeriod = event.target.value;
    console.log('📅 Period changed to:', newPeriod);
    setSelectedPeriod(newPeriod);
    
    // Only load data if we don't already have it and selectedClient is loaded
    if (newPeriod && !reports[newPeriod] && selectedClient) {
      console.log('📊 Loading data for new period:', newPeriod);
      loadPeriodData(newPeriod);
    } else if (newPeriod && reports[newPeriod]) {
      console.log('✅ Data already available for period:', newPeriod);
    } else if (newPeriod && !selectedClient) {
      console.log('⚠️ Selected client not loaded yet, cannot load period data');
    }
  };

  // Handle view type change
  const handleViewTypeChange = (newViewType: 'monthly' | 'weekly' | 'all-time' | 'custom') => {
    console.log('🔄 View type changed to:', newViewType);
    
    // 🚨 TEMPORARY FIX: Clear ALL state for weekly reports to fix date corruption
    if (newViewType === 'weekly') {
      console.log('🚨 WEEKLY VIEW: Clearing all state to fix date corruption');
      setReports({});
      setSelectedPeriod('');
      setAvailablePeriods([]);
    }
    
    setViewType(newViewType);
    setReports({}); // Clear existing reports
    
    if (newViewType === 'all-time' || newViewType === 'custom') {
      // For all-time and custom, we don't use periods
      setAvailablePeriods([]);
      setSelectedPeriod('');
      
      if (newViewType === 'all-time' && selectedClient) {
        console.log('🚀 Calling loadAllTimeData from handleViewTypeChange');
        // Load all-time data immediately
        loadAllTimeData();
      } else if (newViewType === 'all-time' && !selectedClient) {
        console.log('⚠️ Cannot load all-time data: selected client not loaded');
      }
    } else {
      // For monthly and weekly, use period-based approach
      const newPeriods = generatePeriodOptions(newViewType);
      setAvailablePeriods(newPeriods);
      
      if (newPeriods.length > 0) {
        const firstPeriod = newPeriods[0];
        if (firstPeriod) {
          setSelectedPeriod(firstPeriod);
          loadPeriodData(firstPeriod);
        }
      }
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    if (!selectedClient) {
      console.log('⚠️ Cannot refresh: selected client not loaded');
      return;
    }
    
    if (viewType === 'all-time') {
      console.log('🔄 Refreshing all-time data');
      setReports(prev => {
        const newReports = { ...prev };
        delete newReports['all-time'];
        return newReports;
      });
      loadingRef.current = false;
      loadAllTimeData();
    } else if (viewType === 'custom') {
      console.log('🔄 Refreshing custom date data');
      if (customDateRange.start && customDateRange.end) {
        setReports(prev => {
          const newReports = { ...prev };
          delete newReports['custom'];
          return newReports;
        });
        loadingRef.current = false;
        loadCustomDateData(customDateRange.start, customDateRange.end);
      } else {
        setError('Proszę wybrać zakres dat przed odświeżeniem');
      }
    } else if (selectedPeriod) {
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
    } else {
      console.log('⚠️ Cannot refresh: no period selected');
    }
  };

  // Get selected report
  const selectedReport = viewType === 'all-time' 
    ? reports['all-time'] 
    : viewType === 'custom' 
    ? reports['custom'] 
    : selectedPeriod 
    ? reports[selectedPeriod] 
    : null;

  console.log('🔍 Selected report logic:', {
    viewType,
    selectedPeriod,
    allTimeReport: reports['all-time'],
    customReport: reports['custom'],
    periodReport: selectedPeriod ? reports[selectedPeriod] : null,
    finalSelectedReport: selectedReport,
    allReportKeys: Object.keys(reports)
  });

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
    console.log('🔍 getSelectedPeriodTotals called');
    console.log('🔍 selectedReport:', selectedReport);
    console.log('🔍 campaigns length:', selectedReport?.campaigns?.length || 0);
    
    if (!selectedReport || !selectedReport.campaigns.length) {
      console.log('⚠️ No selected report or no campaigns, returning zeros');
      console.log('⚠️ selectedReport exists:', !!selectedReport);
      console.log('⚠️ campaigns array:', selectedReport?.campaigns);
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
        setSelectedClient(clientData); // Set selected client for admin switching
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
          // Use the first period (current month) as the initial period
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

  // DISABLED: Monitor state changes to prevent excessive logging
  // This was causing console spam every time state changed
  // useEffect(() => {
  //   console.log('🔄 State changed - reports:', Object.keys(reports), 'selectedPeriod:', selectedPeriod);
  // }, [reports, selectedPeriod]);

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
  }, [viewType, selectedClient]);

  // Keyboard support for period navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return; // Don't interfere with form inputs
      }

      if ((viewType === 'monthly' || viewType === 'weekly') && selectedPeriod && availablePeriods.length > 0) {
        const currentIndex = availablePeriods.indexOf(selectedPeriod);
        
        if (e.key === 'ArrowLeft' && currentIndex < availablePeriods.length - 1) {
          e.preventDefault();
          const nextPeriod = availablePeriods[currentIndex + 1];
          if (nextPeriod) {
            setSelectedPeriod(nextPeriod);
            if (!reports[nextPeriod]) {
              loadPeriodData(nextPeriod);
            }
          }
        } else if (e.key === 'ArrowRight' && currentIndex > 0) {
          e.preventDefault();
          const prevPeriod = availablePeriods[currentIndex - 1];
          if (prevPeriod) {
            setSelectedPeriod(prevPeriod);
            if (!reports[prevPeriod]) {
              loadPeriodData(prevPeriod);
            }
          }
        } else if ((e.key === 'Enter' || e.key === ' ') && !dropdownOpen) {
          e.preventDefault();
          setDropdownOpen(true);
        } else if (e.key === 'Escape' && dropdownOpen) {
          e.preventDefault();
          setDropdownOpen(false);
        }
      }

      // Dev mode shortcut
      if (process.env.NODE_ENV === 'development' && e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        generateDevReport();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewType, selectedPeriod, availablePeriods, reports, dropdownOpen, generateDevReport]);

  if (loading) {
    return <ReportsLoading />;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F7F9FC' }}>
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

      {/* All-Time Data Loading Modal */}
      {isGeneratingAllTimeReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-lg mx-4 shadow-xl">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              <h3 className="text-lg font-semibold text-gray-900">Ładowanie danych z cache</h3>
              <div className="text-sm text-gray-600 text-center space-y-2">
                <p>
                  Ładujemy dane z ostatnich 37 miesięcy z cache systemu.
                </p>
                <p className="text-xs text-gray-500">
                  <strong>Uwaga:</strong> Meta API ogranicza dostęp do danych do ostatnich 37 miesięcy. 
                  Nie można pobrać starszych danych z powrotu.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
                  <p className="text-xs text-blue-800">
                    <strong>Zakres danych:</strong> {(() => {
                      const currentDate = new Date();
                      const startDate = new Date();
                      startDate.setMonth(startDate.getMonth() - 37);
                      return `${startDate.toLocaleDateString('pl-PL')} - ${currentDate.toLocaleDateString('pl-PL')}`;
                    })()}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 text-xs text-gray-500">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span>Łączenie z API...</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 sm:py-8">
                {/* Header */}
        <div className="border-b border-gray-200 pb-4 sm:pb-6 mb-6 sm:mb-8">
          <div className="flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
              {/* Client Logo */}
              {selectedClient?.logo_url && (
                <div className="flex-shrink-0">
                  <img 
                    src={selectedClient.logo_url} 
                    alt={`${selectedClient?.name} logo`}
                    className="h-10 w-10 sm:h-12 sm:w-12 object-contain rounded-lg border border-gray-200 bg-white p-1"
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900 mb-1 truncate">
                  Raporty {
                    viewType === 'monthly' ? 'Miesięczne' :
                    viewType === 'weekly' ? 'Tygodniowe' :
                    viewType === 'all-time' ? 'Całego Okresu' :
                    'Własnego Zakresu'
                  }
                </h1>
                <div className="text-sm text-gray-600 truncate">
                  {activeAdsProvider === 'meta' ? 'Meta Ads' : 'Google Ads'}
                </div>
                  <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 text-xs sm:text-sm text-gray-600 mt-2">
                    <span className="truncate">{selectedClient?.name}</span>
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      <span className="text-xs">Aktualizacja: {new Date().toLocaleString('pl-PL')}</span>
                    </div>
                    {process.env.NODE_ENV === 'development' && (
                      <div className="flex items-center space-x-1 bg-orange-100 text-orange-800 px-2 py-1 rounded-md border border-orange-200 w-fit">
                        <Code className="w-3 h-3" />
                        <span className="text-xs font-medium">DEV MODE</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Client Selector for Admin Users */}
                  {profile?.role === 'admin' && (
                    <div className="mt-2">
                      <ClientSelector
                        currentClient={selectedClient}
                        onClientChange={handleClientChange}
                        userRole={profile.role}
                      />
                    </div>
                  )}
                </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.push(profile?.role === 'admin' ? '/admin' : '/dashboard')}
                className="text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2 rounded-lg transition-all duration-200 hover:shadow-sm bg-blue-800 hover:bg-blue-900 text-white min-h-[40px] sm:min-h-[44px]"
              >
                <span className="hidden sm:inline">{profile?.role === 'admin' ? 'Powrót do Admina' : 'Powrót do Dashboard'}</span>
                <span className="sm:hidden">Powrót</span>
              </button>
            </div>
          </div>
        </div>

        {/* Premium Unified Toolbar - No Container */}
        <div className="mb-8">
          
          {/* Desktop Layout (≥1280px) - Two Rows */}
          <div className="hidden xl:block">
            {/* First Row: Left and Right Controls */}
            <div className="grid grid-cols-[1fr_auto_1fr] gap-6 items-center mb-6">
              
              {/* Left: View Type Selector */}
              <div className="flex items-center space-x-2">
            <button
              onClick={() => handleViewTypeChange('monthly')}
                  className={`flex items-center space-x-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                viewType === 'monthly'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Miesięczny</span>
            </button>

            <button
              onClick={() => handleViewTypeChange('weekly')}
                  className={`flex items-center space-x-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                viewType === 'weekly'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              <span>Tygodniowy</span>
            </button>

            <button
              onClick={() => handleViewTypeChange('all-time')}
                  className={`flex items-center space-x-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                viewType === 'all-time'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              } ${isGeneratingAllTimeReport ? 'opacity-75 cursor-not-allowed' : ''}`}
              title="Pokaż dane z ostatnich 37 miesięcy (ograniczenie Meta API)"
              disabled={isGeneratingAllTimeReport}
            >
              {isGeneratingAllTimeReport ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <BarChart3 className="w-4 h-4" />
              )}
              <span>{isGeneratingAllTimeReport ? 'Pobieranie...' : 'Cały Okres'}</span>
            </button>

            <button
              onClick={() => handleViewTypeChange('custom')}
                  className={`flex items-center space-x-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                viewType === 'custom'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Własny Zakres</span>
            </button>
          </div>



              {/* Center: Empty for spacing */}
              <div></div>

              {/* Right: Actions - Aligned with View Type Buttons */}
              <div className="flex flex-col items-end space-y-4">
              <div className="flex items-center space-x-3">
                  <button
                    onClick={handleRefresh}
                    disabled={loadingPeriod !== null}
                    className="flex items-center space-x-2 px-4 py-3 bg-white text-slate-900 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-700 transition-all duration-200 disabled:opacity-50 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#BFD2FF]"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingPeriod ? 'animate-spin' : ''}`} />
                    <span>Odśwież</span>
                  </button>
                  
                  {selectedReport && selectedReport.campaigns.length > 0 && (
                    <InteractivePDFButton
                      clientId={client?.id || ''}
                      dateStart={selectedReport?.date_range_start || ''}
                      dateEnd={selectedReport?.date_range_end || ''}
                      className="px-6 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all duration-200 text-sm font-medium shadow-sm"
                      campaigns={selectedReport?.campaigns || []}
                      totals={getSelectedPeriodTotals()}
                      client={client}
                      metaTables={metaTablesData}
                    />
                  )}
              </div>


              </div>
              </div>

            {/* Second Row: Period Picker and Ads Source Toggle - Centered */}
            <div className="flex justify-center">
              <div className="flex flex-col items-center space-y-4">
                {(viewType === 'monthly' || viewType === 'weekly') ? (
                  <div className="flex items-center space-x-4">
                    {/* Previous Button */}
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
                      className="w-12 h-16 flex items-center justify-center bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 hover:border-gray-300 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed group"
                      aria-label="Poprzedni miesiąc"
                    >
                      <ChevronLeft className="w-6 h-6 text-slate-700 group-hover:text-slate-900" />
                </button>

                    {/* Period Display - Much Bigger */}
                    <div className="relative">
                      <select
                        value={selectedPeriod || ''}
                        onChange={handlePeriodChange}
                        disabled={loadingPeriod !== null}
                        className="min-w-[280px] h-16 border-2 border-slate-200 rounded-2xl px-6 text-xl font-bold text-center text-[#0B1220] focus:outline-none focus:ring-4 focus:ring-[#BFD2FF] focus:border-slate-700 disabled:opacity-50 cursor-pointer appearance-none bg-white shadow-sm"
                        role="group"
                        aria-label="Wybierz okres"
                      >
                        {availablePeriods.map((periodId) => {
                          if (viewType === 'monthly') {
                            const [year, month] = periodId.split('-').map(Number);
                            if (year && month) {
                              const date = new Date(year, month - 1, 1);
                              const displayText = formatDate(date.toISOString());
                              return (
                                <option key={periodId} value={periodId} className="text-[#0B1220] bg-white text-lg">
                                  {displayText}
                                </option>
                              );
                            }
                          } else {
                            const [year, weekStr] = periodId.split('-W');
                            const week = parseInt(weekStr || '1');
                            const displayText = getWeekDateRange(parseInt(year || new Date().getFullYear().toString()), week);
                            return (
                              <option key={periodId} value={periodId} className="text-[#0B1220] bg-white text-lg">
                                {displayText}
                              </option>
                            );
                          }
                          return null;
                        })}
                      </select>
                      
                      <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <ChevronDown className="w-5 h-5 text-slate-700" />
            </div>

                      {loadingPeriod && (
                        <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#BFD2FF] border-t-[#1F3D8A]"></div>
              </div>
            )}
                    </div>

                    {/* Next Button */}
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
                      className="w-12 h-16 flex items-center justify-center bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 hover:border-gray-300 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed group"
                      aria-label="Następny miesiąc"
                    >
                      <ChevronRight className="w-6 h-6 text-slate-700 group-hover:text-slate-900" />
                    </button>
                  </div>
                ) : (
                  <div className="h-16 flex items-center text-slate-700 text-lg font-medium">
                    {viewType === 'all-time' ? 'Wszystkie dostępne dane' : 'Wybierz zakres dat poniżej'}
          </div>
        )}

                                {/* Ads Source Toggle - Below Period Picker */}
                {selectedReport && (() => {
                  // Check which platforms are configured for this client
                  const hasMetaAds = selectedClient?.meta_access_token && selectedClient?.ad_account_id;
                  const hasGoogleAds = selectedClient?.google_ads_enabled && selectedClient?.google_ads_customer_id;
                  const showToggle = hasMetaAds && hasGoogleAds; // Only show toggle if client has both platforms
                  
                  // If only one platform, show indicator instead of toggle
                  if (!showToggle) {
                    const singlePlatform = hasMetaAds ? 'meta' : 'google';
                    return (
                      <div className="flex justify-center mb-4">
                        <div className="flex items-center space-x-2 px-4 py-2 bg-slate-100 rounded-lg">
                          {hasMetaAds && (
                            <>
                              <BarChart3 className="w-4 h-4 text-blue-600" />
                              <span className="text-sm font-medium text-slate-700">Meta Ads</span>
                            </>
                          )}
                          {hasGoogleAds && (
                            <>
                              <Target className="w-4 h-4 text-green-600" />
                              <span className="text-sm font-medium text-slate-700">Google Ads</span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  }
                  
                  // Show toggle for dual-platform clients
                  return (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setActiveAdsProvider('meta')}
                        className={`relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                          activeAdsProvider === 'meta'
                            ? 'text-white shadow-sm'
                            : 'text-slate-700 hover:text-slate-900'
                        }`}
                      >
                        {activeAdsProvider === 'meta' && (
                          <motion.div
                            layoutId="activeAdsTab"
                            className="absolute inset-0 bg-slate-900 rounded-xl"
                            initial={false}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          />
                        )}
                        <span className="relative flex items-center space-x-2">
                          <BarChart3 className="w-4 h-4" />
                          <span>Meta Ads</span>
                        </span>
                      </button>

                      <button
                        onClick={() => setActiveAdsProvider('google')}
                        className={`relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                          activeAdsProvider === 'google'
                            ? 'text-white shadow-sm'
                            : 'text-slate-700 hover:text-slate-900'
                        }`}
                      >
                        {activeAdsProvider === 'google' && (
                          <motion.div
                            layoutId="activeAdsTab"
                            className="absolute inset-0 bg-slate-900 rounded-xl"
                            initial={false}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          />
                        )}
                        <span className="relative flex items-center space-x-2">
                          <Target className="w-4 h-4" />
                          <span>Google Ads</span>
                        </span>
                      </button>
                    </div>
                  );
                })()}
              </div>
              </div>
            </div>
            
          {/* Tablet Layout (992-1279px) - Two Rows */}
          <div className="hidden lg:block xl:hidden">
            {/* First Row: Filters + Actions */}
            <div className="flex items-center justify-between mb-4">
              {/* Left: View Type Selector */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleViewTypeChange('monthly')}
                  className={`flex items-center space-x-2 px-3 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    viewType === 'monthly'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  <span>Miesięczny</span>
                </button>

                <button
                  onClick={() => handleViewTypeChange('weekly')}
                  className={`flex items-center space-x-2 px-3 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    viewType === 'weekly'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <CalendarDays className="w-4 h-4" />
                  <span>Tygodniowy</span>
                </button>
              
              <button
                  onClick={() => handleViewTypeChange('all-time')}
                  className={`flex items-center space-x-2 px-3 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    viewType === 'all-time'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                  } ${isGeneratingAllTimeReport ? 'opacity-75 cursor-not-allowed' : ''}`}
                  disabled={isGeneratingAllTimeReport}
                >
                  {isGeneratingAllTimeReport ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <BarChart3 className="w-4 h-4" />
                  )}
                  <span>{isGeneratingAllTimeReport ? 'Pobieranie...' : 'Cały Okres'}</span>
              </button>
              
                <button
                  onClick={() => handleViewTypeChange('custom')}
                  className={`flex items-center space-x-2 px-3 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    viewType === 'custom'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  <span>Własny Zakres</span>
                </button>
              </div>
            
              {/* Right: Actions - Aligned with View Type Buttons */}
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleRefresh}
                  disabled={loadingPeriod !== null}
                  className="flex items-center space-x-2 px-3 py-3 bg-white text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-700 transition-all duration-200 disabled:opacity-50 text-sm font-semibold"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingPeriod ? 'animate-spin' : ''}`} />
                  <span>Odśwież</span>
                </button>
              
              {selectedReport && selectedReport.campaigns.length > 0 && (
                  <InteractivePDFButton
                    clientId={client?.id || ''}
                    dateStart={selectedReport?.date_range_start || ''}
                    dateEnd={selectedReport?.date_range_end || ''}
                      className="px-4 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all duration-200 text-sm font-medium shadow-sm"
                    campaigns={selectedReport?.campaigns || []}
                    totals={getSelectedPeriodTotals()}
                    client={client}
                    metaTables={metaTablesData}
                  />
              )}
            </div>
          </div>

            {/* Second Row: Period Picker and Ads Source Toggle - Centered */}
            <div className="flex flex-col items-center space-y-4">
              {(viewType === 'monthly' || viewType === 'weekly') ? (
                <div className="flex items-center space-x-3">
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
                    className="w-9 h-11 flex items-center justify-center bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
            >
                    <ChevronLeft className="w-5 h-5 text-slate-700" />
            </button>

              <div className="relative">
                <select
                  value={selectedPeriod || ''}
                  onChange={handlePeriodChange}
                  disabled={loadingPeriod !== null}
                      className="min-w-[200px] h-11 border border-slate-200 rounded-xl px-4 text-base font-semibold text-center text-[#0B1220] focus:outline-none focus:ring-2 focus:ring-[#BFD2FF] focus:border-slate-700 disabled:opacity-50 cursor-pointer appearance-none bg-white"
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
                
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <ChevronDown className="w-4 h-4 text-slate-700" />
                          </div>
                        </div>

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
                    className="w-9 h-11 flex items-center justify-center bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-5 h-5 text-slate-700" />
                  </button>
                </div>
              ) : (
                <div className="h-11 flex items-center text-slate-700 text-sm font-medium">
                  {viewType === 'all-time' ? 'Wszystkie dostępne dane' : 'Wybierz zakres dat poniżej'}
                </div>
              )}

              {/* Ads Source Toggle - Below Period Picker */}
              {selectedReport && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setActiveAdsProvider('meta')}
                    className={`relative flex items-center space-x-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                      activeAdsProvider === 'meta'
                        ? 'text-white shadow-sm'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    {activeAdsProvider === 'meta' && (
                      <motion.div
                        layoutId="activeAdsTabTablet"
                        className="absolute inset-0 bg-slate-900 rounded-lg"
                        initial={false}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                    <span className="relative flex items-center space-x-2">
                      <BarChart3 className="w-4 h-4" />
                      <span>Meta Ads</span>
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveAdsProvider('google')}
                    className={`relative flex items-center space-x-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                      activeAdsProvider === 'google'
                        ? 'text-white shadow-sm'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    {activeAdsProvider === 'google' && (
                      <motion.div
                        layoutId="activeAdsTabTablet"
                        className="absolute inset-0 bg-slate-900 rounded-lg"
                        initial={false}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                    <span className="relative flex items-center space-x-2">
                      <Target className="w-4 h-4" />
                      <span>Google Ads</span>
                    </span>
                  </button>
                  </div>
                )}
            </div>
              </div>
              
          {/* Mobile Layout (<768px) */}
          <div className="block lg:hidden space-y-4">
                        {/* Period Picker First - Much Bigger and Most Important */}
            {(viewType === 'monthly' || viewType === 'weekly') && (
              <div className="flex flex-col items-center space-y-4">
                <div className="flex items-center space-x-4">
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
                    className="w-12 h-12 sm:h-16 flex items-center justify-center bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed min-h-[44px]"
                  >
                    <ChevronLeft className="w-6 h-6 text-slate-700" />
                  </button>

                  <div className="relative">
                    <select
                      value={selectedPeriod || ''}
                      onChange={handlePeriodChange}
                      disabled={loadingPeriod !== null}
                      className="min-w-[200px] sm:min-w-[240px] h-12 sm:h-16 border-2 border-slate-200 rounded-2xl px-4 sm:px-6 text-lg sm:text-xl font-bold text-center text-[#0B1220] focus:outline-none focus:ring-4 focus:ring-[#BFD2FF] focus:border-slate-700 disabled:opacity-50 cursor-pointer appearance-none bg-white shadow-sm min-h-[44px]"
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
                    
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <ChevronDown className="w-5 h-5 text-slate-700" />
            </div>
          </div>

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
                    className="w-12 h-12 sm:h-16 flex items-center justify-center bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed min-h-[44px]"
                  >
                    <ChevronRight className="w-6 h-6 text-slate-700" />
                  </button>
        </div>

                {/* Ads Source Toggle - Below Period Picker */}
        {selectedReport && (
                  <div className="flex items-center space-x-2">
                <button
                  onClick={() => setActiveAdsProvider('meta')}
                      className={`relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                    activeAdsProvider === 'meta'
                      ? 'text-white shadow-sm'
                          : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {activeAdsProvider === 'meta' && (
                    <motion.div
                          layoutId="activeAdsTabMobile"
                          className="absolute inset-0 bg-slate-900 rounded-xl"
                      initial={false}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                  <span className="relative flex items-center space-x-2">
                    <BarChart3 className="w-4 h-4" />
                    <span>Meta Ads</span>
                  </span>
                </button>

                <button
                  onClick={() => setActiveAdsProvider('google')}
                      className={`relative flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                    activeAdsProvider === 'google'
                      ? 'text-white shadow-sm'
                          : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {activeAdsProvider === 'google' && (
                    <motion.div
                          layoutId="activeAdsTabMobile"
                          className="absolute inset-0 bg-slate-900 rounded-xl"
                      initial={false}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                  <span className="relative flex items-center space-x-2">
                    <Target className="w-4 h-4" />
                    <span>Google Ads</span>
                  </span>
                </button>
              </div>
                )}
          </div>
        )}

            {/* View Type Segments - Higher Positioned */}
            <div className="flex flex-wrap items-center justify-center gap-2">
            <button
                onClick={() => handleViewTypeChange('monthly')}
                className={`flex items-center space-x-2 px-3 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  viewType === 'monthly'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Miesięczny</span>
            </button>

            <button
                onClick={() => handleViewTypeChange('weekly')}
                className={`flex items-center space-x-2 px-3 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  viewType === 'weekly'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                <span>Tygodniowy</span>
              </button>

              <button
                onClick={() => handleViewTypeChange('all-time')}
                className={`flex items-center space-x-2 px-3 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  viewType === 'all-time'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                } ${isGeneratingAllTimeReport ? 'opacity-75 cursor-not-allowed' : ''}`}
                disabled={isGeneratingAllTimeReport}
              >
                {isGeneratingAllTimeReport ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <BarChart3 className="w-4 h-4" />
                )}
                <span>{isGeneratingAllTimeReport ? 'Pobieranie...' : 'Cały Okres'}</span>
              </button>

              <button
                onClick={() => handleViewTypeChange('custom')}
                className={`flex items-center space-x-2 px-3 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  viewType === 'custom'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Własny Zakres</span>
            </button>
          </div>



            {/* Actions */}
            <div className="flex flex-col items-center space-y-3">
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleRefresh}
                  disabled={loadingPeriod !== null}
                  className="flex items-center space-x-2 px-3 py-3 bg-white text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-700 transition-all duration-200 disabled:opacity-50 text-sm font-semibold"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingPeriod ? 'animate-spin' : ''}`} />
                  <span>Odśwież</span>
                </button>

                {selectedReport && selectedReport.campaigns.length > 0 && (
                  <InteractivePDFButton
                    clientId={client?.id || ''}
                    dateStart={selectedReport?.date_range_start || ''}
                    dateEnd={selectedReport?.date_range_end || ''}
                    className="px-4 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all duration-200 text-sm font-medium shadow-sm"
                    campaigns={selectedReport?.campaigns || []}
                    totals={getSelectedPeriodTotals()}
                    client={client}
                    metaTables={metaTablesData}
                  />
                )}
              </div>

              {/* Dev Button - Below other actions */}
              {process.env.NODE_ENV === 'development' && (
                <button
                  onClick={generateDevReport}
                  disabled={loadingPeriod !== null || apiCallInProgress}
                  className="flex items-center space-x-2 h-10 px-4 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-all duration-200 disabled:opacity-50 text-sm font-medium border-2 border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-300"
                  title="Generate fresh report and PDF bypassing cache (Dev only)"
                >
                  <Code className={`w-4 h-4 ${isGeneratingDevReport ? 'animate-spin' : ''}`} />
                  <span>{isGeneratingDevReport ? 'Generating...' : 'DEV: Fresh Report + PDF'}</span>
                </button>
              )}
            </div>
          </div>
          </div>

        {/* Live Data Status Strip - Only visible in development mode */}
        {process.env.NODE_ENV === 'development' && (() => {
          if (viewType === 'monthly' && selectedPeriod) {
                const [year, month] = selectedPeriod.split('-').map(Number);
                const currentDate = new Date();
                const isCurrentMonth = year === currentDate.getFullYear() && month === (currentDate.getMonth() + 1);
                
            if (isCurrentMonth) {
                  return (
                <div className="flex justify-center mb-6">
                  <div className="flex items-center space-x-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs font-medium text-green-800">Dane na żywo</span>
                    <span className="text-xs text-green-600">• Ostatnia aktualizacja: {new Date().toLocaleString('pl-PL')}</span>
                  </div>
                    </div>
                  );
                }
              }
              return null;
            })()}

        {/* Dev Panel - Hidden by default, accessible via keyboard shortcut */}
        {process.env.NODE_ENV === 'development' && (
          <div className="fixed top-4 right-4 z-50">
            <button
              onClick={generateDevReport}
              disabled={loadingPeriod !== null || apiCallInProgress}
              className="w-8 h-8 bg-orange-600 text-white rounded-full hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center justify-center shadow-lg"
              title="DEV: Fresh Report + PDF (Ctrl+Shift+D)"
            >
              <Code className={`w-4 h-4 ${isGeneratingDevReport ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}

        {/* All Time Warning */}
        {viewType === 'all-time' && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <strong>Uwaga:</strong> Widok &quot;Cały Okres&quot; pobiera dane z ostatnich 37 miesięcy (ograniczenie Meta API). 
                  Starsze dane nie są dostępne z powrotu z powodu ograniczeń API.
                </p>
                <p className="text-xs text-yellow-600 mt-1">
                  Zakres: {(() => {
                    const currentDate = new Date();
                    const startDate = new Date();
                    startDate.setMonth(startDate.getMonth() - 37);
                    return `${startDate.toLocaleDateString('pl-PL')} - ${currentDate.toLocaleDateString('pl-PL')}`;
                  })()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Custom Date Range Selector */}
        {viewType === 'custom' && (
          <div className="bg-white rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Własny Zakres Dat</h2>
                  <p className="text-sm text-gray-600">Wybierz początek i koniec okresu analizy</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Data Początkowa</label>
                                  <input
                    type="date"
                    value={customDateRange.start}
                    onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    max={new Date().toISOString().split('T')[0]}
                  />
              </div>

              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Data Końcowa</label>
                                  <input
                    type="date"
                    value={customDateRange.end}
                    onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    max={new Date().toISOString().split('T')[0]}
                  />
              </div>

              <div className="flex-shrink-0 space-x-3 flex">
                <button
                  onClick={() => {
                    if (customDateRange.start && customDateRange.end) {
                      if (new Date(customDateRange.start) >= new Date(customDateRange.end)) {
                        setError('Data początkowa musi być wcześniejsza niż data końcowa');
                        return;
                      }
                      loadCustomDateData(customDateRange.start, customDateRange.end);
                    } else {
                      setError('Proszę wybrać datę początkową i końcową');
                    }
                  }}
                  disabled={!customDateRange.start || !customDateRange.end || isGeneratingCustomReport}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isGeneratingCustomReport ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <BarChart3 className="w-4 h-4" />
                  )}
                  <span>{isGeneratingCustomReport ? 'Generowanie...' : 'Generuj Raport'}</span>
                </button>

              </div>
            </div>

            {customDateRange.start && customDateRange.end && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>Wybrany zakres:</strong> {new Date(customDateRange.start).toLocaleDateString('pl-PL')} - {new Date(customDateRange.end).toLocaleDateString('pl-PL')}
                </p>
              </div>
            )}
          </div>
        )}



        {/* Report Content */}
        {loadingPeriod && (
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 mb-6 border border-white/20">
            <div className="flex items-center justify-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-200 border-t-blue-600"></div>
              <p className="text-lg text-gray-600">
                Ładowanie danych {
                  viewType === 'monthly' ? 'miesięcznych' :
                  viewType === 'weekly' ? 'tygodniowych' :
                  viewType === 'all-time' ? 'całego okresu' :
                  'własnego zakresu'
                }...
              </p>
            </div>
          </div>
        )}

        {selectedReport && !loadingPeriod && (
          <>
            {/* 🔧 DATA SOURCE INDICATOR: Show which data source is being used */}
            <DataSourceIndicator 
              validation={dataSourceInfo.validation} 
              debug={dataSourceInfo.debug} 
            />
            
            {(() => {
              const totals = getSelectedPeriodTotals();
              
              // Use the real report data regardless of provider
              // The API routing now handles fetching the correct data
              const reportData = selectedReport;
              
              return (
                <WeeklyReportView
                  reports={{ 
                    [viewType === 'all-time' ? 'all-time' : 
                     viewType === 'custom' ? 'custom' : 
                     `${viewType}-${selectedPeriod}`]: reportData 
                  }}
                  viewType={viewType}
                  clientData={selectedClient ? {
                    id: selectedClient.id,
                    name: selectedClient.name,
                    email: selectedClient.email
                  } : undefined}
                  platform={activeAdsProvider}
                />
              );
            })()}
            
            {/* Conditional Ads Tables Section */}
            {selectedReport.date_range_start && selectedReport.date_range_end && (
              <div className="mt-8">
                {activeAdsProvider === 'meta' ? (
                  <MetaAdsTables
                    key={`meta-ads-${activeAdsProvider}-${selectedReport.date_range_start}-${selectedReport.date_range_end}`}
                    dateStart={selectedReport.date_range_start}
                    dateEnd={selectedReport.date_range_end}
                    clientId={client?.id || ''}
                    onDataLoaded={(data) => {
                      setMetaTablesData(data);
                      console.log('Meta Ads tables data loaded:', data);
                    }}
                  />
                ) : (
                  <>
                    <GoogleAdsTables
                      key={`google-ads-${activeAdsProvider}-${selectedReport.date_range_start}-${selectedReport.date_range_end}`}
                      dateStart={selectedReport.date_range_start}
                      dateEnd={selectedReport.date_range_end}
                      clientId={client?.id || ''}
                      onDataLoaded={(data) => {
                        console.log('Google Ads tables data loaded:', data);
                        // Clear loading state when Google Ads data is loaded
                        setLoadingPeriod(null);
                        setApiCallInProgress(false);
                      }}
                    />
                    
                    {/* RMF R.20, R.30, R.40: Campaign Hierarchy with Ad Groups and Ads */}
                    {selectedReport && selectedReport.campaigns && selectedReport.campaigns.length > 0 && (
                      <div className="mt-8">
                        <GoogleAdsExpandableCampaignTable
                          campaigns={selectedReport.campaigns.map((campaign: any) => ({
                            campaignId: campaign.campaign_id || '',
                            campaignName: campaign.campaign_name || 'Unknown Campaign',
                            status: campaign.status || 'ACTIVE',
                            spend: campaign.spend || 0,
                            impressions: campaign.impressions || 0,
                            clicks: campaign.clicks || 0,
                            ctr: campaign.ctr || 0,
                            cpc: campaign.cpc || 0,
                            conversions: campaign.conversions || campaign.reservations || 0,
                            reservation_value: campaign.reservation_value || 0,
                            roas: campaign.roas || 0
                          }))}
                          clientId={client?.id || ''}
                          dateStart={selectedReport.date_range_start}
                          dateEnd={selectedReport.date_range_end}
                          currency="PLN"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

          </>
        )}

        {!selectedReport && !loadingPeriod && (
          <div className="bg-white rounded-lg p-8 mb-8">
            <div className="text-center">
              <DatabaseIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Brak danych</h3>
              <p className="text-gray-600">
                {viewType === 'all-time' && 'Nie znaleziono danych dla całego okresu.'}
                {viewType === 'custom' && 'Nie znaleziono danych dla wybranego zakresu dat.'}
                {(viewType === 'monthly' || viewType === 'weekly') && selectedPeriod && 
                  `Nie znaleziono danych dla wybranego okresu ${viewType === 'monthly' ? 'miesięcznego' : 'tygodniowego'}.`
                }
                {(viewType === 'monthly' || viewType === 'weekly') && !selectedPeriod && 
                  'Proszę wybrać okres do analizy.'
                }
              </p>
            </div>
          </div>
        )}




      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return <ReportsLoading />;
  }

  if (!user) {
    return <ReportsLoading />;
  }

  return <ReportsPageContent />;
} 