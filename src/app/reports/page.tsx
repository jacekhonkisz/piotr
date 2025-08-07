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
  Database as DatabaseIcon
} from 'lucide-react';
import WeeklyReportView from '../../components/WeeklyReportView';
import InteractivePDFButton from '../../components/InteractivePDFButton';
import MetaAdsTables from '../../components/MetaAdsTables';
import { useAuth } from '../../components/AuthProvider';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';
import { getMonthBoundaries, getWeekBoundaries } from '../../lib/date-range-utils';

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
  // Conversion tracking fields
  click_to_call?: number;
  lead?: number;
  purchase?: number;
  purchase_value?: number;
  booking_step_1?: number;
  booking_step_2?: number;
  booking_step_3?: number;
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
  const [viewType, setViewType] = useState<'monthly' | 'weekly' | 'all-time' | 'custom'>('monthly');
  const [apiCallInProgress, setApiCallInProgress] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: ''
  });
  const [isGeneratingCustomReport, setIsGeneratingCustomReport] = useState(false);
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

  // Load all-time data by fetching month by month
  const loadAllTimeData = async () => {
    console.log('🚀 loadAllTimeData function called!');
    
    if (!client) {
      console.log('⚠️ Client not loaded yet, cannot load all-time data');
      return;
    }

    console.log('📊 Loading all-time data for client:', {
      id: client.id,
      name: client.name,
      email: client.email,
      adAccountId: client.ad_account_id,
      hasMetaToken: !!client.meta_access_token,
      tokenLength: client.meta_access_token?.length || 0
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
      
      const adAccountId = client.ad_account_id.startsWith('act_') 
        ? client.ad_account_id.substring(4)
        : client.ad_account_id;
      
      // Get campaigns to find earliest creation date with better error handling
      let earliestCampaignDate = null;
      let campaignsData = null;
      
      try {
        const campaignsResponse = await fetch(`https://graph.facebook.com/v18.0/act_${adAccountId}/campaigns?access_token=${client.meta_access_token}&fields=id,name,created_time,status`, {
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
      const clientStartDate = new Date(client.created_at);
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
        clientId: client.id
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
          let lead = 0;
          let purchase = 0;
          let purchase_value = 0;
          let booking_step_1 = 0;
          let booking_step_2 = 0;
          let booking_step_3 = 0;

          if (campaign.actions && Array.isArray(campaign.actions)) {
            campaign.actions.forEach((action: any) => {
              const actionType = action.action_type;
              const value = parseInt(action.value || '0');
              
              if (actionType.includes('click_to_call')) {
                click_to_call += value;
              }
              if (actionType.includes('lead')) {
                lead += value;
              }
              if (actionType === 'purchase' || actionType.includes('purchase')) {
                purchase += value;
              }
              if (actionType.includes('booking_step_1') || actionType.includes('initiate_checkout')) {
                booking_step_1 += value;
              }
              if (actionType.includes('booking_step_2') || actionType.includes('add_to_cart')) {
                booking_step_2 += value;
              }
              if (actionType.includes('booking_step_3') || actionType.includes('purchase')) {
                booking_step_3 += value;
              }
            });
          }

          // Extract purchase value from action_values
          if (campaign.action_values && Array.isArray(campaign.action_values)) {
            campaign.action_values.forEach((actionValue: any) => {
              if (actionValue.action_type === 'purchase') {
                purchase_value = parseFloat(actionValue.value || '0');
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
            lead,
            purchase,
            purchase_value,
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
        const lead = campaign.lead || 0;
        const purchase = campaign.purchase || 0;
        const purchase_value = campaign.purchase_value || 0;
        const booking_step_1 = campaign.booking_step_1 || 0;
        const booking_step_2 = campaign.booking_step_2 || 0;
        const booking_step_3 = campaign.booking_step_3 || 0;

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
          lead,
          purchase,
          purchase_value,
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
    // Use actual current date (August 2025) as the latest period
    const currentDate = new Date();
    const limit = type === 'monthly' ? 24 : 52; // 2 years for monthly, 1 year for weekly
    
    console.log(`📅 Generating periods using actual current date: ${currentDate.toISOString().split('T')[0]}`);
    
    for (let i = 0; i < limit; i++) {
      let periodDate: Date;
      
      if (type === 'monthly') {
        // For monthly, go back from current month
        periodDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      } else {
        // For weekly, go back from current week
        periodDate = new Date(currentDate.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
      }
      
      // Validate that the period is not in the future
      if (periodDate > currentDate) {
        console.log(`⚠️ Skipping future period: ${generatePeriodId(periodDate, type)}`);
        continue;
      }
      
      const periodId = generatePeriodId(periodDate, type);
      periods.push(periodId);
    }
    
    console.log(`📅 Generated ${periods.length} periods for ${type} view`);
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

    // Check if this is the current month
    const isCurrentMonth = (() => {
      if (viewType === 'monthly') {
        const [year, month] = periodId.split('-').map(Number);
        const currentDate = new Date();
        return year === currentDate.getFullYear() && month === (currentDate.getMonth() + 1);
      }
      return false; // For weekly, always treat as current
    })();

    // For current month, always fetch fresh data (no caching)
    // For previous months, check if we already have this data
    if (!isCurrentMonth && reports[periodId]) {
      console.log('✅ Data already loaded for previous period, skipping API call');
      return;
    }

    if (isCurrentMonth) {
      console.log('🔄 Current month detected - always fetching fresh live data from API');
      // Force clear any cached data for current month to ensure fresh API call
      setReports(prev => {
        const newReports = { ...prev };
        delete newReports[periodId];
        return newReports;
      });
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
        // Parse week ID to get start and end dates using standardized utility
        const [year, weekStr] = periodId.split('-W');
        const week = parseInt(weekStr || '1');
        const firstDayOfYear = new Date(parseInt(year || new Date().getFullYear().toString()), 0, 1);
        const days = (week - 1) * 7;
        const weekStartDate = new Date(firstDayOfYear.getTime() + days * 24 * 60 * 60 * 1000);
        dateRange = getWeekBoundaries(weekStartDate);
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
      console.log(`🎯 ${isCurrentMonth ? 'LIVE API DATA' : 'API DATA'} received for ${periodId}`);
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
      const campaigns: Campaign[] = rawCampaigns.map((campaign: any, index: number) => {
        // Use already-parsed conversion tracking data from API response
        // The Meta API service already processes the actions and action_values
        const click_to_call = campaign.click_to_call || 0;
        const lead = campaign.lead || 0;
        const purchase = campaign.purchase || 0;
        const purchase_value = campaign.purchase_value || 0;
        const booking_step_1 = campaign.booking_step_1 || 0;
        const booking_step_2 = campaign.booking_step_2 || 0;
        const booking_step_3 = campaign.booking_step_3 || 0;

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
          lead,
          purchase,
          purchase_value,
          booking_step_1,
          booking_step_2,
          booking_step_3
        };
      });
      
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
      console.log(`🎯 ${isCurrentMonth ? 'LIVE API DATA' : 'API DATA'} set for ${periodId} with ${campaigns.length} campaigns`);
      setReports(prev => {
        const newState = { ...prev, [periodId]: report };
        console.log('💾 Updated reports state:', {
          periodId,
          totalReports: Object.keys(newState).length,
          allPeriods: Object.keys(newState),
          dataSource: isCurrentMonth ? 'LIVE API' : 'API'
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
        // For current month, don't show fallback data - show empty state instead
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
  const handleViewTypeChange = (newViewType: 'monthly' | 'weekly' | 'all-time' | 'custom') => {
    console.log('🔄 View type changed to:', newViewType);
    setViewType(newViewType);
    setReports({}); // Clear existing reports
    
    if (newViewType === 'all-time' || newViewType === 'custom') {
      // For all-time and custom, we don't use periods
      setAvailablePeriods([]);
      setSelectedPeriod('');
      
      if (newViewType === 'all-time' && client) {
        console.log('🚀 Calling loadAllTimeData from handleViewTypeChange');
        // Load all-time data immediately
        loadAllTimeData();
      } else if (newViewType === 'all-time' && !client) {
        console.log('⚠️ Cannot load all-time data: client not loaded');
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
    if (!client) {
      console.log('⚠️ Cannot refresh: client not loaded');
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
  }, [viewType, client, loading]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ backgroundColor: '#F7F8FA' }}>
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
                <span>{client?.name} - Premium Analytics Dashboard</span>
                <div className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>Aktualizacja: {new Date().toLocaleString('pl-PL')}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.push(profile?.role === 'admin' ? '/admin' : '/dashboard')}
                className="text-sm px-4 py-2 rounded-lg transition-all duration-200 hover:shadow-sm"
                style={{ 
                  backgroundColor: '#244583', 
                  color: 'white',
                  borderRadius: '8px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#1a3660';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#244583';
                }}
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

              <div className="flex-shrink-0">
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
              
              {selectedReport && selectedReport.campaigns.length > 0 && (
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
                  style={{ backgroundImage: 'none' }}
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
          </div>

          {/* Period Navigation Info */}
          <div className="text-center mt-3">
            <p className="text-xs text-gray-400">
              Użyj strzałek do nawigacji lub kliknij okres, aby wybrać z listy
            </p>
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
            <WeeklyReportView
              reports={{ 
                [viewType === 'all-time' ? 'all-time' : 
                 viewType === 'custom' ? 'custom' : 
                 selectedPeriod]: selectedReport 
              }}
              viewType={viewType}
            />
            
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
              
              {selectedReport.date_range_start && selectedReport.date_range_end && (
                <MetaAdsTables
                  dateStart={selectedReport.date_range_start}
                  dateEnd={selectedReport.date_range_end}
                  clientId={client?.id || ''}
                  onDataLoaded={setMetaTablesData}
                />
              )}
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
        
        <button
          onClick={async () => {
            if (!client) {
              alert('Client not loaded');
              return;
            }
            
            console.log('🔍 Testing client Meta API access...');
            
            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (!session?.access_token) {
                alert('No session token');
                return;
              }
              
              // Test with a recent month first
              const testRequestBody = {
                dateRange: {
                  start: '2024-01-01',
                  end: '2024-01-31'
                },
                clientId: client.id
              };
              
              console.log('🔍 Testing with recent data:', testRequestBody);
              
              const response = await fetch('/api/fetch-live-data', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(testRequestBody)
              });
              
              console.log('🔍 Test response status:', response.status);
              
              if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error('🔍 Test API error:', errorData);
                alert(`Test API Error: ${response.status} - ${JSON.stringify(errorData)}`);
                return;
              }
              
              const data = await response.json();
              console.log('🔍 Test API response:', data);
              alert(`Test complete!\nCampaigns found: ${data.data?.campaigns?.length || 0}\nStatus: ${response.status}`);
              
            } catch (error) {
              console.error('🔍 Test error:', error);
              alert(`Test error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg shadow-lg block w-full"
        >
          Test Recent Data
        </button>
        
        <button
          onClick={async () => {
            if (!client) {
              alert('Client not loaded');
              return;
            }
            
            console.log('🔍 Testing all-time function directly...');
            loadAllTimeData();
          }}
          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg shadow-lg block w-full"
        >
          Test All-Time
        </button>
        
        <button
          onClick={() => {
            const realisticCurrentDate = new Date('2024-12-01');
            const maxPastDate = new Date(realisticCurrentDate);
            maxPastDate.setMonth(maxPastDate.getMonth() - 37);
            
            console.log('📅 Realistic current date:', realisticCurrentDate.toISOString().split('T')[0]);
            console.log('📅 37 months ago:', maxPastDate.toISOString().split('T')[0]);
            console.log('📅 Meta API limit info:', {
              currentDate: realisticCurrentDate.toISOString().split('T')[0],
              maxPastDate: maxPastDate.toISOString().split('T')[0],
              monthsBack: 37,
              year: maxPastDate.getFullYear(),
              month: maxPastDate.getMonth() + 1
            });
            
            alert(`Meta API Limit:\nCurrent: ${realisticCurrentDate.toISOString().split('T')[0]}\n37 months ago: ${maxPastDate.toISOString().split('T')[0]}`);
          }}
          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg shadow-lg block w-full"
        >
          Show API Limits
        </button>
        
        <button
          onClick={() => {
            if (!client) {
              alert('Client not loaded');
              return;
            }
            
            // Force refresh current month
            const currentDate = new Date();
            const currentMonthId = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
            
            console.log('🔄 Force refreshing current month:', currentMonthId);
            
            // Clear current month data
            setReports(prev => {
              const newReports = { ...prev };
              delete newReports[currentMonthId];
              return newReports;
            });
            
            // Set view type to monthly and select current month
            setViewType('monthly');
            setSelectedPeriod(currentMonthId);
            
            // Force reload
            setTimeout(() => {
              loadPeriodData(currentMonthId);
            }, 100);
            
            alert(`Force refreshing current month: ${currentMonthId}`);
          }}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow-lg block w-full"
        >
          Force Refresh Current Month
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