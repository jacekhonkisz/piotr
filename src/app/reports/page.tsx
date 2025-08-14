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
  Database as DatabaseIcon,
  Code
} from 'lucide-react';
import WeeklyReportView from '../../components/WeeklyReportView';
import InteractivePDFButton from '../../components/InteractivePDFButton';
import MetaAdsTables from '../../components/MetaAdsTables';
import ClientSelector from '../../components/ClientSelector';
import SendCustomReportModal from '../../components/SendCustomReportModal';
import { useAuth } from '../../components/AuthProvider';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';
import { getMonthBoundaries, getWeekBoundaries, getISOWeekStartDate, getWeeksInYear } from '../../lib/date-range-utils';

type Client = Database['public']['Tables']['clients']['Row'];

// Helper function to format date ranges for display
const formatDateRange = (startDate: string, endDate: string): string => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  if (daysDiff === 7) {
    return `Tydzień ${start.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })} - ${end.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  } else if (daysDiff >= 28 && daysDiff <= 31) {
    return start.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
  } else {
    return `${start.toLocaleDateString('pl-PL')} - ${end.toLocaleDateString('pl-PL')}`;
  }
};

// Helper function to safely extract client email
const getClientEmail = (client: any): string => {
  // First try email field
  if (client.email && typeof client.email === 'string') {
    return client.email;
  }
  // Then try contact_emails array
  if (Array.isArray(client.contact_emails) && client.contact_emails.length > 0) {
    return client.contact_emails[0];
  }
  // Fallback
  return 'brak@email.com';
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
  
  // Use the same getWeekBoundaries logic as API (adds 6 days with UTC)
  const endDate = new Date(weekStartDate);
  endDate.setUTCDate(weekStartDate.getUTCDate() + 6);
  
  const formatDateForDisplay = (date: Date) => {
    // Use toISOString to get consistent formatting like API
    const isoString = date.toISOString().split('T')[0] || '';
    const [, monthStr, dayStr] = isoString.split('-');
    return `${dayStr}.${monthStr}`;
  };
  
  const result = `${formatDateForDisplay(weekStartDate)} - ${formatDateForDisplay(endDate)}.${year}`;
  console.log(`🔧 DROPDOWN ISO: Week ${week} of ${year} = ${result} (startDate: ${weekStartDate.toISOString().split('T')[0]}, endDate: ${endDate.toISOString().split('T')[0]})`);
  
  return result;
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
  const [metaTablesData, setMetaTablesData] = useState<{
    placementPerformance: any[];
    demographicPerformance: any[];
    adRelevanceResults: any[];
  } | null>(null);
  const [showSendEmailModal, setShowSendEmailModal] = useState(false);
  const [showCustomEmailModal, setShowCustomEmailModal] = useState(false);
  
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
      console.log(`📅 Business perspective: Fetching from earliest campaign creation date`);
      console.log(`📅 API limitation: Meta API only allows data from last 37 months`);
      
      // OPTIMIZATION: Single API call instead of month-by-month
      const requestBody = {
        dateRange: {
          start: startDate,
          end: endDate
        },
        clientId: selectedClient.id
      };
      
      console.log(`📡 Making OPTIMIZED single API call for entire date range:`, requestBody);
      
      const response = await fetch('/api/fetch-live-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(requestBody)
      });

      console.log(`📡 Response for optimized all-time call:`, {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`📊 Optimized all-time data result:`, {
          hasData: !!data,
          hasDataProperty: !!data.data,
          campaignsInData: data.data?.campaigns?.length || 0,
          campaignsDirect: data.campaigns?.length || 0,
          dataKeys: Object.keys(data || {})
        });
        
        const allCampaigns = data.data?.campaigns || data.campaigns || [];
        
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
              
              // 3. Kroki rezerwacji – Etap 1
              if (actionType.includes('booking_step_1') || actionType.includes('initiate_checkout')) {
                booking_step_1 += value;
              }
              
              // 4. Rezerwacje (zakończone rezerwacje)
              if (actionType === 'purchase' || actionType.includes('purchase') || actionType.includes('reservation')) {
                reservations += value;
              }
              
              // 8. Etap 2 rezerwacji
              if (actionType.includes('booking_step_2') || actionType.includes('add_to_cart')) {
                booking_step_2 += value;
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
            objective: campaign.objective || undefined,
            // Conversion tracking fields (parsed from actions)
            click_to_call,
            email_contacts,
            reservations,
            reservation_value,
            booking_step_1,
            booking_step_2
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
        console.log(`⚠️ Optimized API call failed`);
        try {
          const errorData = await response.json();
          console.log(`❌ Error details for optimized call:`, errorData);
        } catch (e) {
          console.log(`❌ Could not parse error response for optimized call`);
        }
        
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
        throw new Error(errorData.error || 'Failed to load custom date data');
      }

      const data = await response.json();
      const rawCampaigns = data.data?.campaigns || data.campaigns || [];
      
      const campaigns: Campaign[] = rawCampaigns.map((campaign: any, index: number) => {
        // Use already-parsed conversion tracking data from API response
        // The Meta API service already processes the actions and action_values
        const click_to_call = campaign.click_to_call || 0;
        const email_contacts = campaign.email_contacts || 0;
        const reservations = campaign.reservations || 0;
        const reservation_value = campaign.reservation_value || 0;
        const booking_step_1 = campaign.booking_step_1 || 0;
        const booking_step_2 = campaign.booking_step_2 || 0;

        return {
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
          objective: campaign.objective || undefined,
          // Conversion tracking fields (parsed from actions)
          click_to_call,
          email_contacts,
          reservations,
          reservation_value,
          booking_step_1,
          booking_step_2
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
    console.log(`📊 Loading ${viewType} data for period: ${periodId} with explicit client`, { periodId, clientId: clientData.id, forceClearCache });
    
    // 🚨 TEMPORARY FIX: Force fresh data for weekly reports due to database corruption
    // Remove this after database cleanup
    const forceWeeklyFresh = viewType === 'weekly';
    if (forceWeeklyFresh) {
      console.log('🚨 FORCING FRESH DATA for weekly reports due to database corruption issue');
    }
    
    // Prevent duplicate calls
    if (loadingRef.current || apiCallInProgress) {
      console.log('⚠️ Already loading data, skipping duplicate call');
      return;
    }

    // Check if this is the current month
    const isCurrentMonth = (() => {
      if (viewType === 'monthly') {
        const [year, month] = periodId.split('-').map(Number);
        const currentDate = new Date();
        return year === currentDate.getFullYear() && month === (currentDate.getMonth() + 1);
      }
      return false; // For weekly, always treat as current
    })();

    // For previous months, check if we already have this data
    // 🚨 TEMPORARY: Force fresh data for ALL weekly reports to fix date range issues
    const forceAllWeeklyFresh = viewType === 'weekly';
    
    if (!isCurrentMonth && reports[periodId] && !forceWeeklyFresh && !forceAllWeeklyFresh) {
      console.log('✅ Data already loaded for previous period, skipping API call');
      return;
    }
    
    if (forceAllWeeklyFresh) {
      console.log('🚨 FORCING FRESH DATA for all weekly reports to fix date range corruption');
    }

    if (isCurrentMonth) {
      console.log('🔄 Current month detected - using SMART CACHING system');
      // Let smart caching handle current month data optimization
    } else {
      console.log('📚 Previous month detected - will use stored data if available');
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
      console.log(`🎯 Data source: ${isCurrentMonth ? 'LIVE API (current month)' : 'API (previous month)'}`);
      
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
        
        if (isCurrentMonth) {
          // For current month, use today as the end date
          const startDate = new Date(Date.UTC(year, month - 1, 1));
          const endDate = new Date(); // Today
          
          dateRange = {
            start: startDate.toISOString().split('T')[0] || '',
            end: endDate.toISOString().split('T')[0] || ''
          };
          
          console.log(`📅 Current month date parsing:`, {
            periodId,
            year,
            month,
            startDate: dateRange.start,
            endDate: dateRange.end,
            isCurrentMonth: true
          });
        } else {
          // For past months, use the full month
          dateRange = getMonthBoundaries(year || new Date().getFullYear(), month || 1);
          
          console.log(`📅 Past month date parsing:`, {
            periodId,
            year,
            month,
            startDate: dateRange.start,
            endDate: dateRange.end,
            isCurrentMonth: false
          });
        }
      } else {
        // Parse week ID to get start and end dates using proper ISO week calculation
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
        
        console.log(`📅 ISO Week parsing for ${periodId}:`, {
          periodId,
          year: yearNum,
          week,
          jan4: jan4.toISOString().split('T')[0],
          startOfWeek1: startOfWeek1.toISOString().split('T')[0],
          weekStartDate: weekStartDate.toISOString().split('T')[0],
          dateRange,
          calculatedStart: dateRange.start,
          calculatedEnd: dateRange.end
        });
        
        // 🚨 CRITICAL DEBUG: Log the exact dates being used
        console.log(`🚨 CRITICAL: Week ${week} of ${yearNum} should be:`, {
          expectedStart: '2025-08-10', // Monday Aug 10
          expectedEnd: '2025-08-16',   // Sunday Aug 16
          actualStart: dateRange.start,
          actualEnd: dateRange.end,
          isCorrect: dateRange.start === '2025-08-10' && dateRange.end === '2025-08-16'
        });
      }
      
      // Use standardized date formatting
      periodStartDate = dateRange.start;
      periodEndDate = dateRange.end;
      
      console.log(`📅 Generated date range for ${periodId}: ${periodStartDate} to ${periodEndDate}`);
      
      // Fetch data from Meta API (current month always fresh, previous months may be cached)
      console.log(`📡 Fetching data from Meta API...`);
    
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
        clientId: clientData.id, // Always send the client ID for real clients
        ...(forceClearCache && { forceFresh: true }), // Add cache clearing if requested
        ...(forceWeeklyFresh && { forceFresh: true, reason: 'weekly_corruption_fix' }) // Force fresh for weekly reports
      };
      
      // 🚨 CRITICAL DEBUG: Verify what dates are being sent to API
      console.log('🚨 CRITICAL API REQUEST:', {
        periodId,
        viewType,
        periodStartDate,
        periodEndDate,
        requestBody,
        isWeekly: viewType === 'weekly',
        shouldBeAugust: periodId === '2025-W33',
        actuallyIsAugust: periodStartDate.includes('2025-08'),
        forceWeeklyFresh,
        forceFresh: forceWeeklyFresh
      });
      
      console.log('📡 Making API call with request body:', requestBody);
      
      // Create a timeout promise (increased for optimized API)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('API call timeout after 40 seconds')), 40000);
      });
      
      console.log('⏱️ Starting API call with timeout...');
      
      // Add specific loading message for current month
      if (isCurrentMonth) {
        console.log('📅 Current month detected - fetching live data (may take 10-30s)');
      } else {
        console.log('📅 Previous month detected - using database (should be fast)');
      }
      
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
        console.log(`🎯 ${isCurrentMonth ? 'LIVE API DATA' : 'API DATA'} received for ${periodId}`);
        
        // 🚨 CRITICAL DEBUG: Check what the API actually returned
        console.log(`🚨 CRITICAL API RESPONSE:`, {
          periodId,
          responseSuccess: data.success,
          apiDateRange: data.data?.dateRange || data.dateRange,
          apiFromCache: data.data?.fromCache || data.fromCache,
          apiLastUpdated: data.data?.lastUpdated || data.lastUpdated,
          apiSource: data.debug?.source,
          campaignsCount: data.data?.campaigns?.length || data.campaigns?.length || 0,
          totalSpend: data.data?.stats?.totalSpend || 'not available',
          isForceWeeklyFresh: forceWeeklyFresh
        });
        
        console.log(`📊 Raw API response structure:`, {
          hasSuccess: !!data.success,
          hasData: !!data.data,
          dataKeys: data.data ? Object.keys(data.data) : [],
          campaignsInData: data.data?.campaigns?.length || 0,
          campaignsDirect: data.campaigns?.length || 0,
          isPartialData: !!data.data?.partialData,
          hasTimeoutError: !!data.data?.timeoutError
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
          allKeys: Object.keys(rawCampaigns[0] || {})
        });
      }
      
      // Transform campaigns to match frontend interface
      const campaigns: Campaign[] = rawCampaigns.map((campaign: any, index: number) => {
        // Use already-parsed conversion tracking data from API response
        // The Meta API service already processes the actions and action_values
        const click_to_call = campaign.click_to_call || 0;
        const email_contacts = campaign.email_contacts || 0;
        const reservations = campaign.reservations || 0;
        const reservation_value = campaign.reservation_value || 0;
        const booking_step_1 = campaign.booking_step_1 || 0;
        const booking_step_2 = campaign.booking_step_2 || 0;

        return {
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
          objective: campaign.objective || undefined,
          // Conversion tracking fields (parsed from actions)
          click_to_call,
          email_contacts,
          reservations,
          reservation_value,
          booking_step_1,
          booking_step_2
        };
      });
      
      console.log(`📊 Transformed campaigns:`, campaigns.length, 'campaigns');
      if (campaigns.length > 0) {
        console.log(`📊 Sample campaign:`, campaigns[0]);
        console.log(`🔍 CONVERSION DATA DEBUG - Sample campaign:`, {
          campaignName: campaigns[0]?.campaign_name,
          click_to_call: campaigns[0]?.click_to_call,
          email_contacts: campaigns[0]?.email_contacts,
          booking_step_1: campaigns[0]?.booking_step_1,
          reservations: campaigns[0]?.reservations,
          reservation_value: campaigns[0]?.reservation_value,
          booking_step_2: campaigns[0]?.booking_step_2
        });
        
        // 🔍 DATA FRESHNESS AUDIT
        console.log(`🕐 DATA FRESHNESS AUDIT:`, {
          dataSource: data.debug?.source || 'unknown',
          generatedAt: data.data?.lastUpdated || data.lastUpdated || 'unknown',
          isFromCache: data.data?.fromCache || false,
          cacheAge: data.data?.cacheAge ? `${Math.round(data.data.cacheAge / 1000)}s` : 'unknown',
          totalCampaigns: campaigns.length,
          totalSpend: campaigns.reduce((sum, c) => sum + c.spend, 0),
          dateRange: `${periodStartDate} to ${periodEndDate}`,
          isCurrentWeek: periodId === '2025-W33',
          shouldBeFreshData: periodId === '2025-W33' ? 'YES - Current week' : 'NO - Historical'
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
        // For monthly reports, use API response dates if available
        const apiDateRange = data.data?.dateRange || data.dateRange;
        correctStartDate = apiDateRange?.start || periodStartDate;
        correctEndDate = apiDateRange?.end || periodEndDate;
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
        campaigns: campaigns
      };

      console.log(`💾 Setting successful report for ${periodId}:`, report);
      console.log(`💾 Report campaigns count:`, report.campaigns.length);
      if (report.campaigns.length > 0) {
        console.log(`💾 Sample campaign:`, report.campaigns[0]);
      }
      console.log(`🎯 ${isCurrentMonth ? 'LIVE API DATA' : 'API DATA'} set for ${periodId} with ${campaigns.length} campaigns`);
      
      setReports(prev => {
        const newState = { ...prev, [periodId]: report };
        console.log('💾 Updated reports state:', {
          periodId,
          totalReports: Object.keys(newState).length,
          allPeriods: Object.keys(newState),
          dataSource: isCurrentMonth ? 'LIVE API' : 'API',
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
              // For current month, use today as the end date (same logic as original)
              const startDate = new Date(Date.UTC(year, month - 1, 1));
              const endDate = new Date(); // Today
              
              dateRange = {
                start: startDate.toISOString().split('T')[0] || '',
                end: endDate.toISOString().split('T')[0] || ''
              };
              
              console.log(`🔧 DEV: Current month date parsing:`, {
                periodId,
                year,
                month,
                startDate: dateRange.start,
                endDate: dateRange.end,
                isCurrentMonth: true
              });
            } else {
              // For past months, use the full month (same logic as original)
              dateRange = getMonthBoundaries(year || new Date().getFullYear(), month || 1);
              
              console.log(`🔧 DEV: Past month date parsing:`, {
                periodId,
                year,
                month,
                startDate: dateRange.start,
                endDate: dateRange.end,
                isCurrentMonth: false
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
          
          // Fetch data from Meta API with force fresh (same logic as original but with forceFresh: true)
          console.log(`🔧 DEV: Fetching fresh data from Meta API (bypassing cache)...`);
        
          // Skip API call for demo clients (same logic as original)
          console.log(`🔍 Client ID check: ${clientData?.id} (demo-client-id: ${clientData?.id === 'demo-client-id'})`);
          if (clientData?.id === 'demo-client-id') {
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
        
          // Make API call for the specific period with force fresh (same logic as original but with forceFresh: true)
          const requestBody = {
            dateRange: {
              start: periodStartDate,
              end: periodEndDate
            },
            clientId: clientData.id, // Always send the client ID for real clients
            forceFresh: true // This is the only difference - bypass cache
          };
          console.log('🔧 DEV: Making API call with force fresh flag:', requestBody);
          
          // Create a timeout promise (same logic as original)
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('API call timeout after 20 seconds')), 20000);
          });
          
          console.log('⏱️ Starting API call with timeout...');
          
          // Race between the fetch and timeout (same logic as original)
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
            
            // Show specific error messages for permission issues (same logic as original)
            if (errorData.error?.includes('permission') || errorData.error?.includes('ads_management')) {
              setError(`Meta API Permission Error: Your access token doesn't have the required permissions (ads_management or ads_read). Please contact support to update your token.`);
            } else if (errorData.error?.includes('Invalid Meta Ads token')) {
              setError(`Invalid Meta API Token: Your access token is invalid or expired. Please contact support to refresh your token.`);
            } else {
              setError(`Failed to load data for ${periodId}: ${errorData.error || 'Unknown error'}`);
            }
            
            // Add empty period if API fails (same logic as original)
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
            console.log(`🎯 DEV FRESH API DATA received for ${periodId}`);
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

          // Transform API response to our report format (same logic as original)
          const rawCampaigns = data.data?.campaigns || data.campaigns || [];
          
          console.log(`📊 Processing campaigns:`, {
            hasData: !!data,
            hasDataProperty: !!data.data,
            campaignsFromData: data.data?.campaigns?.length || 0,
            campaignsDirect: data.campaigns?.length || 0,
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

            return {
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
              objective: campaign.objective || undefined,
              // Conversion tracking fields (parsed from actions)
              click_to_call,
              email_contacts,
              reservations,
              reservation_value,
              booking_step_1,
              booking_step_2
            };
          });
          
          console.log(`📊 Transformed campaigns:`, campaigns.length, 'campaigns');
          if (campaigns.length > 0) {
            console.log(`📊 Sample campaign:`, campaigns[0]);
          }
          
          // 🚨 FIX: Use correct dates from API response instead of potentially corrupted periodStartDate/periodEndDate
          const apiDateRange = data.data?.dateRange || data.dateRange;
          const correctStartDate = apiDateRange?.start || periodStartDate;
          const correctEndDate = apiDateRange?.end || periodEndDate;
          
          console.log(`🔧 REPORT OBJECT FIX:`, {
            periodId,
            originalStart: periodStartDate,
            originalEnd: periodEndDate,
            apiReturnedStart: apiDateRange?.start,
            apiReturnedEnd: apiDateRange?.end,
            usingStart: correctStartDate,
            usingEnd: correctEndDate,
            isUsingAPIResponse: !!(apiDateRange?.start && apiDateRange?.end)
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
              },
              campaigns,
              totals: calculatedTotals,
              client: clientData,
              metaTables: metaTablesData // Include actual Meta tables data
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
  }, [viewType, selectedClient, loading]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
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

      <div className="max-w-[1400px] mx-auto px-6 py-8">
                {/* Header */}
        <div className="border-b border-gray-200 pb-6 mb-8">
          <div className="flex flex-col lg:flex-row items-center justify-between space-y-4 lg:space-y-0">
            <div className="flex items-center space-x-4">
              {/* Client Logo */}
              {selectedClient?.logo_url && (
                <div className="flex-shrink-0">
                  <img 
                    src={selectedClient.logo_url} 
                    alt={`${selectedClient?.name} logo`}
                    className="h-12 w-12 object-contain rounded-lg border border-gray-200 bg-white p-1"
                  />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 mb-1">
                  Raporty {
                    viewType === 'monthly' ? 'Miesięczne' :
                    viewType === 'weekly' ? 'Tygodniowe' :
                    viewType === 'all-time' ? 'Całego Okresu' :
                    'Własnego Zakresu'
                  }
                </h1>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span>{selectedClient?.name} - Premium Analytics Dashboard</span>
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>Aktualizacja: {new Date().toLocaleString('pl-PL')}</span>
                    </div>
                    {process.env.NODE_ENV === 'development' && (
                      <div className="flex items-center space-x-1 bg-orange-100 text-orange-800 px-2 py-1 rounded-md border border-orange-200">
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
                className="text-sm px-4 py-2 rounded-lg transition-all duration-200 hover:shadow-sm bg-blue-800 hover:bg-blue-900 text-white"
              >
                {profile?.role === 'admin' ? 'Powrót do Admina' : 'Powrót do Dashboard'}
              </button>
            </div>
          </div>
        </div>

        {/* View Type Selector */}
        <section className="mb-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Typ Widoku</h2>
            <p className="text-sm text-gray-600">Wybierz sposób wyświetlania danych</p>
          </div>

          <div className="flex items-center justify-center space-x-3 flex-wrap">
            <button
              onClick={() => handleViewTypeChange('monthly')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm transition-all duration-200 ${
                viewType === 'monthly'
                  ? 'text-white shadow-sm'
                  : 'text-gray-700 hover:shadow-sm'
              }`}
              style={viewType === 'monthly' 
                ? { backgroundColor: '#244583' }
                : { backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }
              }
            >
              <Calendar className="w-4 h-4" />
              <span>Miesięczny</span>
            </button>

            <button
              onClick={() => handleViewTypeChange('weekly')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm transition-all duration-200 ${
                viewType === 'weekly'
                  ? 'text-white shadow-sm'
                  : 'text-gray-700 hover:shadow-sm'
              }`}
              style={viewType === 'weekly' 
                ? { backgroundColor: '#244583' }
                : { backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }
              }
            >
              <CalendarDays className="w-4 h-4" />
              <span>Tygodniowy</span>
            </button>

            <button
              onClick={() => handleViewTypeChange('all-time')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm transition-all duration-200 ${
                viewType === 'all-time'
                  ? 'text-white shadow-sm'
                  : 'text-gray-700 hover:shadow-sm'
              }`}
              style={viewType === 'all-time' 
                ? { backgroundColor: '#244583' }
                : { backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }
              }
              title="Pokaż dane z całego dostępnego okresu (od 2010 do dziś)"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Cały Okres</span>
            </button>

            <button
              onClick={() => handleViewTypeChange('custom')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm transition-all duration-200 ${
                viewType === 'custom'
                  ? 'text-white shadow-sm'
                  : 'text-gray-700 hover:shadow-sm'
              }`}
              style={viewType === 'custom' 
                ? { backgroundColor: '#244583' }
                : { backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }
              }
            >
              <Calendar className="w-4 h-4" />
              <span>Własny Zakres</span>
            </button>
          </div>
        </section>

        {/* All Time Warning */}
        {viewType === 'all-time' && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <strong>Uwaga:</strong> Widok &quot;Cały Okres&quot; pobiera dane od momentu uruchomienia biznesu klienta lub z ostatnich 37 miesięcy (ograniczenie Meta API) - w zależności od tego, która data jest późniejsza.
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
                
                {/* Email Button for Custom Range */}
                {customDateRange.start && customDateRange.end && client && (
                  <button
                    onClick={() => setShowCustomEmailModal(true)}
                    disabled={isGeneratingCustomReport}
                    className="flex items-center space-x-2 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    title="Send custom range report via email"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>Send Email</span>
                  </button>
                )}
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

        {/* Period Selector - Only for Monthly and Weekly */}
        {(viewType === 'monthly' || viewType === 'weekly') && (
          <div className="bg-white rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CalendarDays className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Wybór Okresu</h2>
                <p className="text-sm text-gray-600">Wybierz {viewType === 'monthly' ? 'miesiąc' : 'tydzień'} do analizy</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={handleRefresh}
                disabled={loadingPeriod !== null}
                className="flex items-center space-x-2 bg-[#244583] text-white px-4 py-2 rounded-lg hover:bg-[#1a3366] transition-colors disabled:opacity-50 text-sm"
              >
                <RefreshCw className={`w-4 h-4 ${loadingPeriod ? 'animate-spin' : ''}`} />
                <span>Odśwież</span>
              </button>
              
              {/* Dev Button - Only show in development */}
              {process.env.NODE_ENV === 'development' && (
                <button
                  onClick={generateDevReport}
                  disabled={loadingPeriod !== null || apiCallInProgress}
                  className="flex items-center space-x-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 text-sm border-2 border-orange-500"
                  title="Generate fresh report and PDF bypassing cache (Dev only)"
                >
                  <Code className={`w-4 h-4 ${isGeneratingDevReport ? 'animate-spin' : ''}`} />
                  <span>{isGeneratingDevReport ? 'DEV: Generating...' : 'DEV: Fresh Report + PDF'}</span>
                </button>
              )}
              
              {selectedReport && selectedReport.campaigns.length > 0 && (
                <>
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
                  <button
                    onClick={() => setShowSendEmailModal(true)}
                    disabled={loadingPeriod !== null || !client}
                    className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm"
                    title="Send report via email"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>Send Email</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Period Navigation - Ultra Clean Design */}
          <div className="flex items-center justify-center space-x-6">
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
              className="p-2.5 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed group"
              title="Poprzedni miesiąc"
            >
              <ChevronLeft className="w-5 h-5 text-gray-500 group-hover:text-gray-700" />
            </button>

            {/* Center Period Display with Dropdown */}
            <div className="relative flex-1 max-w-sm md:max-w-md">
              <div className="relative">
                <select
                  value={selectedPeriod || ''}
                  onChange={handlePeriodChange}
                  disabled={loadingPeriod !== null}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 cursor-pointer appearance-none bg-white [&::-ms-expand]:hidden"
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
                
                {/* Minimalist dropdown arrow - only one, subtle */}
                
                {/* Live Data Indicator for Current Month */}
                {(() => {
                  if (viewType === 'monthly' && selectedPeriod) {
                    const [year, month] = selectedPeriod.split('-').map(Number);
                    const currentDate = new Date();
                    const isCurrentMonth = year === currentDate.getFullYear() && month === (currentDate.getMonth() + 1);
                    
                    if (isCurrentMonth) {
                      return (
                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
                          <div className="flex items-center space-x-2 bg-green-100 border border-green-200 rounded-full px-3 py-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-xs font-medium text-green-700">Dane na żywo</span>
                          </div>
                        </div>
                      );
                    }
                  }
                  return null;
                })()}
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </div>
                
                {/* Loading indicator */}
                {loadingPeriod && (
                  <div className="absolute left-2 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-200 border-t-blue-600"></div>
                  </div>
                )}
              </div>
              
              {/* Period indicator dots */}
              <div className="flex justify-center space-x-1.5 mt-3">
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
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 cursor-pointer group relative ${
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
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-300 flex items-center justify-center">
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
              className="p-2.5 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed group"
              title="Następny miesiąc"
            >
              <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-gray-700" />
            </button>

            {/* Refresh Button for Current Month */}
            {(() => {
              if (viewType === 'monthly' && selectedPeriod) {
                const [year, month] = selectedPeriod.split('-').map(Number);
                const currentDate = new Date();
                const isCurrentMonth = year === currentDate.getFullYear() && month === (currentDate.getMonth() + 1);
                
                if (isCurrentMonth) {
                  return (
                    <button
                      onClick={async () => {
                        if (selectedPeriod && selectedClient) {
                          console.log('🔄 Force refreshing current month data...');
                          await loadPeriodDataWithClient(selectedPeriod, selectedClient, true);
                        }
                      }}
                      disabled={loadingPeriod !== null}
                      className="p-2.5 bg-blue-50 border border-blue-200 rounded-full hover:bg-blue-100 hover:border-blue-300 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed group"
                      title="Odśwież dane bieżącego miesiąca (pobierz najnowsze dane z Meta API)"
                    >
                      <svg className="w-5 h-5 text-blue-600 group-hover:text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  );
                }
              }
              return null;
            })()}
          </div>

          {/* Period Navigation Info */}
          <div className="text-center mt-3">
            <p className="text-xs text-gray-400">
              Użyj strzałek do nawigacji lub kliknij okres, aby wybrać z listy
            </p>
            
            {/* Cache Status for Current Month */}
            {(() => {
              if (viewType === 'monthly' && selectedPeriod && selectedReport) {
                const [year, month] = selectedPeriod.split('-').map(Number);
                const currentDate = new Date();
                const isCurrentMonth = year === currentDate.getFullYear() && month === (currentDate.getMonth() + 1);
                
                if (isCurrentMonth && selectedReport.generated_at) {
                  const lastUpdated = new Date(selectedReport.generated_at);
                  const now = new Date();
                  const ageMinutes = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60));
                  const ageHours = Math.floor(ageMinutes / 60);
                  
                  let ageText = '';
                  let statusColor = '';
                  
                  if (ageMinutes < 5) {
                    ageText = 'przed chwilą';
                    statusColor = 'text-green-600';
                  } else if (ageMinutes < 60) {
                    ageText = `${ageMinutes} min temu`;
                    statusColor = 'text-green-600';
                  } else if (ageHours < 3) {
                    ageText = `${ageHours}h ${ageMinutes % 60}min temu`;
                    statusColor = 'text-blue-600';
                  } else {
                    ageText = `${ageHours}h ${ageMinutes % 60}min temu`;
                    statusColor = 'text-orange-600';
                  }
                  
                  return (
                    <div className="mt-2">
                      <p className={`text-xs ${statusColor} font-medium`}>
                        📊 Dane aktualizowane {ageText}
                        {ageHours >= 3 && ' • Kliknij odśwież dla najnowszych danych'}
                      </p>
                    </div>
                  );
                }
              }
              return null;
            })()}
          </div>
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
            {(() => {
              const totals = getSelectedPeriodTotals();
              console.log('🎯 Rendering WeeklyReportView with:');
              console.log('   selectedReport:', selectedReport);
              console.log('   campaigns:', selectedReport.campaigns);
              console.log('   totals:', totals);
              
              return (
                <WeeklyReportView
                  reports={{ 
                    [viewType === 'all-time' ? 'all-time' : 
                     viewType === 'custom' ? 'custom' : 
                     selectedPeriod]: selectedReport 
                  }}
                  viewType={viewType}
                />
              );
            })()}
            
            {/* Meta Ads Tables Section */}
            <div className="bg-white rounded-lg p-6 mb-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Meta Ads Analytics</h2>
                    <p className="text-sm text-gray-600">Szczegółowe analizy z Meta Ads API</p>
                  </div>
                </div>
              </div>
              
              {selectedReport.date_range_start && selectedReport.date_range_end && (() => {
                console.log('🔍 MetaAdsTables props:', {
                  dateStart: selectedReport.date_range_start,
                  dateEnd: selectedReport.date_range_end,
                  clientId: client?.id,
                  selectedReportId: selectedReport.id
                });
                return (
                  <MetaAdsTables
                    dateStart={selectedReport.date_range_start}
                    dateEnd={selectedReport.date_range_end}
                    clientId={client?.id || ''}
                    onDataLoaded={setMetaTablesData}
                  />
                );
              })()}
            </div>
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

        {/* Send Custom Report Modal */}
        {showSendEmailModal && selectedReport && client && (
          <SendCustomReportModal
            isOpen={showSendEmailModal}
            onClose={() => setShowSendEmailModal(false)}
            clientName={client.name}
            clientEmail={getClientEmail(client)}
            period={formatDateRange(selectedReport.date_range_start, selectedReport.date_range_end)}
            dateRange={{
              start: selectedReport.date_range_start,
              end: selectedReport.date_range_end
            }}
            campaigns={selectedReport.campaigns}
            totals={getSelectedPeriodTotals()}
            client={client}
            metaTables={metaTablesData}
          />
        )}

        {/* Send Custom Date Range Report Modal */}
        {showCustomEmailModal && customDateRange.start && customDateRange.end && client && (
          <SendCustomReportModal
            isOpen={showCustomEmailModal}
            onClose={() => setShowCustomEmailModal(false)}
            clientName={client.name}
            clientEmail={getClientEmail(client)}
            period={formatDateRange(customDateRange.start, customDateRange.end)}
            dateRange={{
              start: customDateRange.start,
              end: customDateRange.end
            }}
            campaigns={[]} // Custom date range reports will generate campaigns automatically
            totals={null} // Totals will be calculated automatically
            client={client}
            metaTables={null} // Meta tables will be fetched automatically
          />
        )}
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