'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Download, Eye, EyeOff, BarChart3, HelpCircle, MousePointer, PhoneCall, Mail, DollarSign, Percent, Target } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useYearOverYearComparison } from '@/lib/hooks/useYearOverYearComparison';
import ConversionFunnel from './ConversionFunnel';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useMetricsConfig } from '../lib/useMetricsConfig';
import type { MetricSection } from '../lib/default-metrics-config';
import {
  getBelmontePotentialOfflineValue,
  getMicroConversionsForOfflineModel,
  isBelmonteClient,
  offlineMicroPartsFromCampaigns,
} from '@/lib/offline-reservation-estimate';
import {
  googleEmailContactsFromRow,
  googlePhoneContactsFromRow,
} from '@/lib/google-ads-contact-metrics';




interface Campaign {
  id: string;
  campaign_id: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cpa?: number;
  frequency?: number;
  reach?: number;
  relevance_score?: number;
  landing_page_view?: number;
  ad_type?: string;
  objective?: string;
  status?: string;
  
  // Conversion tracking metrics
  click_to_call?: number;
  email_contacts?: number;
  booking_step_1?: number;
  booking_step_2?: number;
  booking_step_3?: number;
  reservations?: number;
  reservation_value?: number;
  roas?: number;
  cost_per_reservation?: number;
}

/** Nominative plural label: "1 kampania", "2 kampanie", "5 kampanii", "12 kampanii", "22 kampanie". */
function polishCampaignNounAfterCount(n: number): string {
  const abs = Math.abs(Math.trunc(n));
  if (abs === 1) return 'kampania';
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'kampanie';
  return 'kampanii';
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
    conversion_value?: number;
    total_conversion_value?: number;
    reach: number;
    offline_reservations: number;
    offline_value: number;
  };
}

interface WeeklyReportViewProps {
  reports: { [key: string]: WeeklyReport };
  viewType?: 'monthly' | 'weekly' | 'all-time' | 'custom';
  clientData?: {
    id: string;
    name: string;
    email: string;
  };
  platform?: 'meta' | 'google';
  isLoading?: boolean; // 🔧 Progressive loading: parent is still fetching main data
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

const formatNumber = (num: number) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString('pl-PL');
};

/** Contact counts should never abbreviate to K/M — show the exact integer. */
const formatContactCount = (num: number) =>
  Math.round(num).toLocaleString('pl-PL');

/**
 * 🎯 STANDARDIZED METHOD: Get conversion metric
 * 
 * Priority: 
 *   1. conversionMetrics (if non-zero) → from aggregated API data
 *   2. campaigns.reduce() → fallback to individual campaign data
 *   3. 0 → if no data available
 * 
 * 🔧 FIX: Now prefers campaign data if conversionMetrics has 0
 * This handles cases where conversionMetrics wasn't properly populated
 */
const getConversionMetric = (
  report: WeeklyReport | undefined,
  metric: 'booking_step_1' | 'booking_step_2' | 'booking_step_3' | 'reservations' | 'reservation_value' | 'click_to_call' | 'email_contacts' | 'conversion_value' | 'total_conversion_value',
  campaigns: Campaign[]
): number => {
  // 🥇 PRIORITY 1: Use conversionMetrics if it has a non-zero value
  const conversionValue = report?.conversionMetrics?.[metric];
  if (conversionValue !== undefined && conversionValue > 0) {
    return conversionValue;
  }
  
  // 🥈 PRIORITY 2: Calculate from campaigns array
  // This is more reliable as each campaign has its own conversion data from the API
  const campaignTotal = campaigns.reduce((sum, c) => sum + ((c as any)[metric] || 0), 0);
  
  // 🥉 PRIORITY 3: If campaigns also have 0, return conversionMetrics value (which may be 0)
  // This preserves the case where conversionMetrics explicitly has 0
  if (campaignTotal > 0) {
    return campaignTotal;
  }
  
  return conversionValue ?? 0;
};

const getContactMetric = (
  report: WeeklyReport | undefined,
  campaigns: Campaign[],
  platform: 'meta' | 'google' | undefined,
  metric: 'email_contacts' | 'click_to_call',
): number => {
  const fromMetrics = getConversionMetric(report, metric, campaigns);
  if (fromMetrics > 0) return fromMetrics;

  if (platform === 'google') {
    const fromCampaigns = campaigns.reduce(
      (sum, c) =>
        sum +
        (metric === 'email_contacts'
          ? googleEmailContactsFromRow(c as unknown as Record<string, unknown>)
          : googlePhoneContactsFromRow(c as unknown as Record<string, unknown>)),
      0,
    );
    if (fromCampaigns > 0) return fromCampaigns;
  }

  return fromMetrics;
};

const formatDate = (dateString: string) => {
  if (!dateString || dateString.trim() === '') {
    return 'Brak daty';
  }
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return 'Nieprawidłowa data';
  }
  
  return date.toLocaleDateString('pl-PL', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// Helper function to get week start and end dates using proper ISO week calculation
const getWeekDateRange = (year: number, week: number) => {
  const yearNum = year;
  
  // January 4th is always in week 1 of the ISO year (SAME AS API)
  const jan4 = new Date(yearNum, 0, 4);
  
  // Find the Monday of week 1 (SAME AS API)
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  
  // Calculate the start date of the target week (SAME AS API)
  const weekStartDate = new Date(startOfWeek1);
  weekStartDate.setDate(startOfWeek1.getDate() + (week - 1) * 7);
  
  // FIXED: Use timezone-safe calculation (same as dropdown and API)
  const endDate = new Date(weekStartDate);
  endDate.setDate(weekStartDate.getDate() + 6); // Use setDate for timezone-safe calculation
  
  const formatDateForDisplay = (date: Date) => {
    // FIXED: Use timezone-safe formatting (same as dropdown)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${day}.${month}`;
  };
  
  const result = `${formatDateForDisplay(weekStartDate)} - ${formatDateForDisplay(endDate)}.${year}`;
  
  return result;
};

const getWeekNumber = (date: Date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

// Tooltip component for explanations
const Tooltip = ({ children, content }: { children: React.ReactNode; content: string }) => {
  const [isVisible, setIsVisible] = useState(false);
  
  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help"
      >
        {children}
      </div>
      {isVisible && (
        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap">
          {content}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
};

// Metric Card Component - Clean analytics product design
export const MetricCard = ({
  title, 
  value, 
  subtitle, 
  tooltip,
  icon,
  change,
  miniSpark,
  isComparisonLoading = false
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  tooltip?: string;
  icon?: React.ReactNode;
  change?: {
    value: number;
    period: string;
    type: 'increase' | 'decrease';
  };
  miniSpark?: number[];
  isComparisonLoading?: boolean; // 🔧 Progressive loading: YoY comparison is loading
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const card = (
    <div
      className="relative min-h-[104px] rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-150 hover:border-slate-300"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Title - uppercase, subtle */}
      <div className="mb-2 flex items-start justify-between gap-3">
        <span className="text-[11px] font-medium leading-4 text-slate-500">{title}</span>
        {tooltip && (
          <Tooltip content={tooltip}>
            <HelpCircle className="mt-0.5 h-3.5 w-3.5 text-slate-300 transition-colors hover:text-slate-500" />
          </Tooltip>
        )}
      </div>
      
      {/* Main Value - large, bold, clean */}
      <div>
        <p className="text-[1.35rem] font-semibold leading-7 text-slate-950 tabular-nums">
          {value}
        </p>
      </div>

      {/* Change Indicator - minimal, inline - with loading state */}
      {isComparisonLoading ? (
        <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
          <div className="h-3 w-3 animate-spin rounded-full border border-slate-300 border-t-slate-500"></div>
          <span>Ładuję porównanie...</span>
        </div>
      ) : (change && change.value > 0) ? (
        <div className="mt-1 text-[11px] font-medium tabular-nums">
          <span className={change.type === 'increase' ? 'text-green-600' : 'text-red-600'}>
            {change.type === 'increase' ? '+' : '−'}{Math.abs(change.value).toFixed(1)}%
          </span>
          <span className="text-slate-400 ml-1">vs {change.period}</span>
        </div>
      ) : null}
    </div>
  );

  return tooltip ? <Tooltip content={tooltip}>{card}</Tooltip> : card;
};



export default function WeeklyReportView({ reports, viewType = 'weekly', clientData, platform = 'meta', isLoading = false }: WeeklyReportViewProps) {
  console.log('🚨 YOY DEBUG - WeeklyReportView component rendered at:', new Date().toISOString());
  console.log('🚨 YOY DEBUG - Component props:', { 
    hasReports: !!reports, 
    reportCount: Object.keys(reports || {}).length,
    viewType, 
    hasClientData: !!clientData,
    platform 
  });
  
  const [socialInsights, setSocialInsights] = useState<{
    facebookNewFollowers: number | string;
    instagramFollowers: number;
    instagramReach: number;
    instagramProfileViews: number;
  } | null>(null);
  
  // DEBUG: Track state changes
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [campaignTableMode, setCampaignTableMode] = useState<'outcome' | 'traffic' | 'full'>('outcome');
  const [showAllCampaigns, setShowAllCampaigns] = useState(false);
  const { getMetricName, isMetricVisible } = useMetricsConfig(clientData?.id ?? null, platform);
  const metricLabel = (section: MetricSection, key: string, fallback: string) => (
    getMetricName(section, key) || fallback || key
  );
  const metricVisible = (section: MetricSection, key: string) => isMetricVisible(section, key);
  

  
  // Fetch social insights when component mounts - MOVED BEFORE EARLY RETURN
  useEffect(() => {
    let mounted = true;
    
    const fetchSocialInsights = async () => {
      if (socialLoading === false) {
        return;
      }

      setSocialLoading(true);

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          throw sessionError;
        }

        const session = sessionData.session;
        if (!session?.access_token) {
          throw new Error('No access token available');
        }

        const effectiveClientId = clientData?.id || session.user?.id;
        if (!effectiveClientId) {
          throw new Error('No client ID available');
        }

        const reportIds = Object.keys(reports);
        if (reportIds.length === 0) {
          if (mounted) {
            setSocialInsights({
              facebookNewFollowers: 0,
              instagramFollowers: 0,
              instagramReach: 0,
              instagramProfileViews: 0
            });
            setSocialLoading(false);
          }
          return;
        }

        const firstReportId = reportIds[0];
        const dateRange = firstReportId;

        const requestBody = {
          clientId: effectiveClientId,
          dateRange: dateRange
        };

        const maxAttempts = 3;
        let attempts = 0;
        let response: Response | null = null;

        while (attempts < maxAttempts && mounted) {
          attempts++;

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          try {
            response = await fetch('/api/fetch-social-insights', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify(requestBody),
              signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
              break;
            }
          } catch (fetchError: any) {
            clearTimeout(timeoutId);
            
            if (attempts < maxAttempts && mounted) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
            }
            throw fetchError;
          }
        }

        if (!response || !mounted) {
          return;
        }

        const data = await response.json();

        if (data.success && data.data?.metrics) {
          const facebook = data.data.metrics.facebook || {};
          const instagram = data.data.metrics.instagram || {};

          const socialInsightsData = {
            facebookNewFollowers: typeof facebook.page_fan_adds === 'number' ? facebook.page_fan_adds : 0,
            instagramFollowers: typeof instagram.follower_count === 'number' ? instagram.follower_count : 0,
            instagramReach: typeof instagram.reach === 'number' ? instagram.reach : 0,
            instagramProfileViews: typeof instagram.profile_views === 'number' ? instagram.profile_views : 0
          };

          if (mounted) {
            setSocialInsights(socialInsightsData);
            setSocialLoading(false);
          }
        } else {
          if (mounted) {
            setSocialInsights({
              facebookNewFollowers: 0,
              instagramFollowers: 0,
              instagramReach: 0,
              instagramProfileViews: 0
            });
            setSocialLoading(false);
          }
        }
      } catch (error: any) {
        if (mounted) {
          setSocialInsights({
            facebookNewFollowers: 0,
            instagramFollowers: 0,
            instagramReach: 0,
            instagramProfileViews: 0
          });
          setSocialLoading(false);
        }
      }
    };

    fetchSocialInsights();

    return () => {
      mounted = false;
    };
  }, [reports, clientData]);

  const reportIds = Object.keys(reports);
  
  // Year-over-year comparison hook - DISABLED for weekly reports to prevent misleading +100% comparisons
  const firstReport = reportIds.length > 0 ? reports[reportIds[0]!] : null;
  
  // Create date range for YoY comparison based on the actual report being viewed
  const getReasonableYoYDateRange = () => {
    // Use the first report's date range (the actual period being viewed)
    if (firstReport && firstReport.date_range_start && firstReport.date_range_end) {
  console.log('🔍 Using actual report date range for YoY comparison:', {
    start: firstReport.date_range_start,
    end: firstReport.date_range_end,
    reportId: firstReport.id,
    viewType: viewType,
    note: 'This will be compared with same period from previous year'
  });
  console.log('🚨 YOY DEBUG - Date range function called at:', new Date().toISOString());
      
      return {
        start: firstReport.date_range_start,
        end: firstReport.date_range_end
      };
    }
    
    // Fallback based on view type
    const now = new Date();
    
    if (viewType === 'weekly') {
      // For weekly view, use current week
      const startOfWeek = new Date(now);
      const dayOfWeek = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Monday
      startOfWeek.setDate(diff);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
      
      console.log('🔍 Fallback to current week for YoY comparison:', {
        start: startOfWeek.toISOString().split('T')[0],
        end: endOfWeek.toISOString().split('T')[0],
        viewType: 'weekly'
      });
      
      return {
        start: startOfWeek.toISOString().split('T')[0] || '',
        end: endOfWeek.toISOString().split('T')[0] || ''
      };
    } else {
      // For monthly view, use current month
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const monthStart = new Date(currentYear, currentMonth, 1);
      const monthEnd = new Date(currentYear, currentMonth + 1, 0);
      
      console.log('🔍 Fallback to current month for YoY comparison:', {
        start: monthStart.toISOString().split('T')[0],
        end: monthEnd.toISOString().split('T')[0],
        viewType: 'monthly'
      });
      
      return {
        start: monthStart.toISOString().split('T')[0] || '',
        end: monthEnd.toISOString().split('T')[0] || ''
      };
    }
  };
  
  const yoyDateRange = getReasonableYoYDateRange();
  
  // Year-over-year comparison configuration

  // Debug logging for YoY hook parameters
  console.log('🔍 YoY Hook Debug - Parameters:', {
    clientId: clientData?.id || 'MISSING',
    clientIdLength: (clientData?.id || '').length,
    dateRange: yoyDateRange,
    enabled: true,
    platform: platform,
    hasClientData: !!clientData,
    clientDataKeys: clientData ? Object.keys(clientData) : []
  });

  // 🔧 FIX: Use existing report data for year-over-year comparison instead of fetching fresh data
  // This prevents the issue where the API returns 0 values while the dashboard shows real data
  // CACHE BUST: 2025-01-11 v3 - Force browser refresh - YoY Hook Debug Added
  // 🔧 SKIP YoY for custom date ranges - doesn't make sense to compare custom ranges
  const { data: yoyData, loading: yoyLoading, error: yoyError } = useYearOverYearComparison({
    clientId: clientData?.id || '',
    dateRange: yoyDateRange,
    enabled: viewType !== 'custom', // 🔧 DISABLED for custom date ranges
    platform: platform,
  });
  
  // 🔍 DEBUG: Log YoY hook data
  console.log('🔍 YoY Hook Debug - Full Data:', {
    yoyData,
    yoyLoading,
    yoyError,
    hasData: !!yoyData,
    clientId: clientData?.id,
    dateRange: yoyDateRange,
    platform
  });
  
  // 🔧 FIX: Calculate year-over-year comparison from existing report data
  const calculateLocalYoYComparison = () => {
    console.log('🔍 Local YoY Calculation Debug:', {
      hasFirstReport: !!firstReport,
      hasCampaigns: !!(firstReport?.campaigns),
      campaignsLength: firstReport?.campaigns?.length || 0,
      firstReportKeys: firstReport ? Object.keys(firstReport) : [],
      sampleCampaign: firstReport?.campaigns?.[0] ? Object.keys(firstReport.campaigns[0]) : []
    });
    
    if (!firstReport || !firstReport.campaigns) return null;
    
    // Calculate current period totals from existing report data
    // 🎯 STANDARDIZED: Use getConversionMetric helper for consistency
    const currentTotals = {
      spend: firstReport.campaigns.reduce((sum, c) => sum + (c.spend || 0), 0),
      impressions: firstReport.campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0),
      clicks: firstReport.campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0),
      // ✅ Use standardized helper (priority: conversionMetrics → campaigns.reduce())
      booking_step_1: getConversionMetric(firstReport, 'booking_step_1', firstReport.campaigns),
      booking_step_2: getConversionMetric(firstReport, 'booking_step_2', firstReport.campaigns),
      booking_step_3: getConversionMetric(firstReport, 'booking_step_3', firstReport.campaigns),
      reservations: getConversionMetric(firstReport, 'reservations', firstReport.campaigns),
    };
    
    console.log('🔍 Local YoY Current Totals:', currentTotals);
    console.log('🔍 Local YoY Sample Campaign Data:', firstReport.campaigns[0] ? {
      spend: firstReport.campaigns[0].spend,
      impressions: firstReport.campaigns[0].impressions,
      clicks: firstReport.campaigns[0].clicks,
      booking_step_1: firstReport.campaigns[0].booking_step_1,
      booking_step_2: firstReport.campaigns[0].booking_step_2,
      booking_step_3: firstReport.campaigns[0].booking_step_3,
      reservations: firstReport.campaigns[0].reservations
    } : 'No campaigns found');
    
    // For now, we don't have previous year data in the reports prop
    // So we'll return null to hide comparisons until we can get historical data
    const previousTotals = {
      spend: 0,
      impressions: 0,
      clicks: 0,
      booking_step_1: 0,
      booking_step_2: 0,
      booking_step_3: 0,
      reservations: 0,
    };
    
    // Calculate changes
    const calculateChange = (current: number, previous: number): number => {
      if (previous === 0) return -999; // No historical data available
      return ((current - previous) / previous) * 100;
    };
    
    return {
      current: currentTotals,
      previous: previousTotals,
      changes: {
        spend: calculateChange(currentTotals.spend, previousTotals.spend),
        impressions: calculateChange(currentTotals.impressions, previousTotals.impressions),
        clicks: calculateChange(currentTotals.clicks, previousTotals.clicks),
        booking_step_1: calculateChange(currentTotals.booking_step_1, previousTotals.booking_step_1),
        booking_step_2: calculateChange(currentTotals.booking_step_2, previousTotals.booking_step_2),
        booking_step_3: calculateChange(currentTotals.booking_step_3, previousTotals.booking_step_3),
        reservations: calculateChange(currentTotals.reservations, previousTotals.reservations),
      }
    };
  };
  
  // Only use API data for comparisons — no local fallback to avoid stale/wrong comparisons
  const effectiveYoYData = yoyData;
  
  // Debug logging for YoY hook results
  console.log('🔍 YoY Hook Debug - Results:', {
    hasData: !!yoyData,
    loading: yoyLoading,
    error: yoyError,
    dataKeys: yoyData ? Object.keys(yoyData) : [],
    currentSpend: yoyData?.current?.spend || 0,
    previousSpend: yoyData?.previous?.spend || 0,
    effectiveYoYData: effectiveYoYData,
    enabled: true, // Hook is enabled and working
    reportIds: reportIds,
    reportsKeys: Object.keys(reports)
  });
  
  // 🔧 PROGRESSIVE LOADING: Show content immediately, even with empty data
  // The MetricCards will show 0s while loading
  if (reportIds.length === 0 && !isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Brak danych do wyświetlenia</p>
      </div>
    );
  }
  
  // If loading with no reports yet, create a placeholder report structure
  if (reportIds.length === 0 && isLoading) {
    // Show the structure with loading indicators
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 space-y-6 sm:space-y-10">
        <div className="space-y-10">
          {/* Header Section - Loading */}
          <div className="border-b pb-8" style={{ borderColor: '#E5E7EB' }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="h-8 bg-slate-200 rounded w-64 animate-pulse mb-2"></div>
                <div className="h-4 bg-slate-100 rounded w-48 animate-pulse"></div>
              </div>
            </div>
          </div>

          {/* Main Metrics Section - Loading skeleton */}
          <section className="mb-10">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-1">Podstawowe Metryki</h2>
              <p className="text-sm text-slate-600">Ładowanie danych...</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-lg p-5">
                  <div className="h-4 bg-slate-100 rounded w-24 animate-pulse mb-3"></div>
                  <div className="h-8 bg-slate-200 rounded w-32 animate-pulse mb-2"></div>
                  <div className="h-3 bg-slate-100 rounded w-20 animate-pulse"></div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 px-0 sm:space-y-6">
      {reportIds.map((reportId) => {
        const report = reports[reportId];
        if (!report) return null;
        const campaigns = report.campaigns || [];
        const campaignsSortedBySpend = [...campaigns]
          .filter((c) => (Number(c.spend) || 0) > 0)
          .sort((a, b) => (b.spend || 0) - (a.spend || 0));
        
        // Year-over-year comparison data loaded

        // Helper function to format comparison change for MetricCard
        const formatComparisonChange = (changePercent: number, currentValue?: number, previousValue?: number) => {
          if (viewType === 'custom') return undefined;
          if (!effectiveYoYData) return undefined;
          if (changePercent === -999) return undefined;
          if (Math.abs(changePercent) < 0.01) return undefined;

          // Hide when either side has no data
          if (currentValue === undefined || currentValue === null || currentValue === 0) return undefined;
          if (previousValue === undefined || previousValue === null || previousValue === 0) return undefined;

          return {
            value: Math.abs(changePercent),
            period: 'rok do roku',
            type: changePercent >= 0 ? 'increase' as const : 'decrease' as const,
          };
        };
        
        // Calculate campaign performance totals
        const campaignTotals = campaigns.reduce((acc, campaign) => {
          return {
            spend: acc.spend + (campaign.spend || 0),
            impressions: acc.impressions + (campaign.impressions || 0),
            clicks: acc.clicks + (campaign.clicks || 0),
            reach: acc.reach + (campaign.reach || 0),
            status: campaign.status || 'UNKNOWN'
          };
        }, { 
          spend: 0, 
          impressions: 0, 
          clicks: 0, 
          reach: 0,
          status: 'UNKNOWN'
        });
        
        // Calculate derived campaign metrics
        const clientName = clientData?.name ?? '';
        const metaCampaignsForOffline = campaigns.filter(
          (c: any) => !c.platform || c.platform === 'meta'
        );
        /** Meta slice only — used for Belmonte PBM + Meta-only micro parts (never use Google rows). */
        const metaMicroParts = offlineMicroPartsFromCampaigns(metaCampaignsForOffline);

        let offlineContactBasis: number;
        if (isBelmonteClient(clientName)) {
          offlineContactBasis =
            platform === 'google'
              ? 0
              : getMicroConversionsForOfflineModel(
                  clientName,
                  {
                    googleFormSubmits: 0,
                    googleEmail: 0,
                    googlePhone: 0,
                    metaFormSubmits: 0,
                    metaEmail: metaMicroParts.metaEmail,
                    metaPhone: metaMicroParts.metaPhone,
                  },
                  { metaCampaigns: metaCampaignsForOffline }
                );
        } else {
          // Must match contact cards above: prefer conversionMetrics, then Google row aliases.
          offlineContactBasis =
            getContactMetric(report, campaigns, platform, 'email_contacts') +
            getContactMetric(report, campaigns, platform, 'click_to_call');
        }

        const emailContacts = getContactMetric(report, campaigns, platform, 'email_contacts');
        const phoneContacts = getContactMetric(report, campaigns, platform, 'click_to_call');
        const totalContacts = emailContacts + phoneContacts;
        const showEmailContacts = metricVisible('contact', 'email_contacts');
        const showPhoneContacts = metricVisible('contact', 'click_to_call');
        const showCombinedContacts = showEmailContacts || showPhoneContacts;

        // Offline metrics are client-model based (not API-backed), so keep one consistent calculation path.
        const potentialOfflineReservations = Math.round(offlineContactBasis * 0.2);
        const onlineConversionValue = getConversionMetric(report, 'total_conversion_value', campaigns);
        const totalReservations = getConversionMetric(report, 'reservations', campaigns);
        const averageConversionValue = totalReservations > 0 ? onlineConversionValue / totalReservations : 0;
        const potentialOfflineValue = isBelmonteClient(clientName)
          ? getBelmontePotentialOfflineValue(averageConversionValue)
          : averageConversionValue * potentialOfflineReservations;
        const totalConversionValueWithOffline = onlineConversionValue + potentialOfflineValue;
        const costPercentage = totalConversionValueWithOffline > 0
          ? (campaignTotals.spend / totalConversionValueWithOffline) * 100
          : 0;
        const valueForRoas =
          onlineConversionValue || getConversionMetric(report, 'reservation_value', campaigns);
        const reportRoas = campaignTotals.spend > 0 ? valueForRoas / campaignTotals.spend : 0;

        // Calculate actual days in the report range
        const reportStartDate = new Date(report.date_range_start);
        const reportEndDate = new Date(report.date_range_end);
        const daysDifference = Math.ceil((reportEndDate.getTime() - reportStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        if (daysDifference > 7) {
          // console.log('⚠️ WARNING: Weekly report contains MORE than 7 days of data!');
          // console.log('   This explains why spend/metrics are higher than expected');
          // console.log('   The API may be returning a longer date range than requested');
        }
        const visibleCampaignRows = showAllCampaigns ? campaignsSortedBySpend : campaignsSortedBySpend.slice(0, 5);
        const showCampaignColumn = (key: string) => {
          if (!metricVisible('campaign_table', key)) return false;
          if (campaignTableMode === 'full') return true;
          if (key === 'campaign_name') return true;
          if (campaignTableMode === 'traffic') {
            return ['totalImpressions', 'totalClicks', 'averageCtr', 'averageCpc'].includes(key);
          }
          return ['totalSpend', 'reservations', 'reservation_value', 'total_conversion_value', 'cost_per_reservation', 'roas'].includes(key);
        };

        return (
          <div key={reportId} className="space-y-6">
            {/* Executive outcome section */}
            <section id="overview" className="scroll-mt-24 space-y-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Przegląd wyników</h2>
                  <p className="text-[13px] text-slate-500">Najważniejsze wskaźniki biznesowe dla wybranego okresu.</p>
                </div>
                <div className="text-xs font-medium text-slate-500">
                  {campaigns.length} {polishCampaignNounAfterCount(campaigns.length)}
                </div>
              </div>

              <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,220px))] justify-start gap-3">
                {metricVisible('report_summary', 'reservations') && (
                  <MetricCard
                    title={metricLabel('report_summary', 'reservations', 'Rezerwacje')}
                    value={formatNumber(getConversionMetric(report, 'reservations', campaigns))}
                    tooltip={metricLabel('report_summary', 'reservations', 'Rezerwacje')}
                    change={formatComparisonChange(effectiveYoYData?.changes?.reservations || 0, effectiveYoYData?.current?.reservations, effectiveYoYData?.previous?.reservations)}
                    isComparisonLoading={yoyLoading && viewType !== 'custom'}
                  />
                )}

                {metricVisible('report_summary', 'total_conversion_value') && (
                  <MetricCard
                    title={metricLabel('report_summary', 'total_conversion_value', 'Łączna wartość konwersji')}
                    value={formatCurrency(getConversionMetric(report, 'total_conversion_value', campaigns))}
                    tooltip={metricLabel('report_summary', 'total_conversion_value', 'Łączna wartość konwersji')}
                  />
                )}

                {!metricVisible('report_summary', 'total_conversion_value') && metricVisible('report_summary', 'reservation_value') && (
                  <MetricCard
                    title={metricLabel('report_summary', 'reservation_value', 'Wartość rezerwacji')}
                    value={formatCurrency(getConversionMetric(report, 'reservation_value', campaigns))}
                    tooltip={metricLabel('report_summary', 'reservation_value', 'Wartość rezerwacji')}
                  />
                )}

                {metricVisible('report_summary', 'roas') && (
                  <MetricCard
                    title={metricLabel('report_summary', 'roas', 'ROAS')}
                    value={`${reportRoas.toFixed(2)}x`}
                    tooltip={metricLabel('report_summary', 'roas', 'ROAS')}
                  />
                )}

                {metricVisible('contact', 'cost_per_reservation') && (
                  <MetricCard
                    title={metricLabel('contact', 'cost_per_reservation', 'Koszt rezerwacji')}
                    value={formatCurrency(
                      getConversionMetric(report, 'reservations', campaigns) > 0
                        ? campaignTotals.spend / getConversionMetric(report, 'reservations', campaigns)
                        : 0
                    )}
                    tooltip={metricLabel('contact', 'cost_per_reservation', 'Koszt rezerwacji')}
                  />
                )}

                {metricVisible('report_summary', 'totalSpend') && (
                  <MetricCard
                    title={metricLabel('report_summary', 'totalSpend', 'Wydatki')}
                    value={formatCurrency(campaignTotals.spend)}
                    tooltip={metricLabel('report_summary', 'totalSpend', 'Wydatki')}
                    change={formatComparisonChange(effectiveYoYData?.changes?.spend || 0, effectiveYoYData?.current?.spend, effectiveYoYData?.previous?.spend)}
                    isComparisonLoading={yoyLoading && viewType !== 'custom'}
                  />
                )}
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <div className="grid grid-cols-2 divide-y divide-slate-100 md:grid-cols-4 md:divide-x md:divide-y-0">
                  {metricVisible('report_summary', 'totalImpressions') && (
                    <div className="px-3 py-1.5">
                      <p className="text-[11px] font-medium text-slate-400">{metricLabel('report_summary', 'totalImpressions', 'Wyświetlenia')}</p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{formatNumber(campaignTotals.impressions)}</p>
                    </div>
                  )}
                  {metricVisible('report_summary', 'totalClicks') && (
                    <div className="px-3 py-1.5">
                      <p className="text-[11px] font-medium text-slate-400">{metricLabel('report_summary', 'totalClicks', 'Kliknięcia')}</p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{formatNumber(campaignTotals.clicks)}</p>
                    </div>
                  )}
                  {metricVisible('report_summary', 'averageCtr') && (
                    <div className="px-3 py-1.5">
                      <p className="text-[11px] font-medium text-slate-400">{metricLabel('report_summary', 'averageCtr', 'CTR')}</p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{`${((campaignTotals.clicks / campaignTotals.impressions) * 100 || 0).toFixed(2)}%`}</p>
                    </div>
                  )}
                  {metricVisible('report_summary', 'averageCpc') && (
                    <div className="px-3 py-1.5">
                      <p className="text-[11px] font-medium text-slate-400">{metricLabel('report_summary', 'averageCpc', 'CPC')}</p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{formatCurrency((campaignTotals.spend / campaignTotals.clicks) || 0)}</p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section id="conversions" className="grid scroll-mt-24 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.58fr)_minmax(320px,0.92fr)]">
              <ConversionFunnel
                step1={getConversionMetric(report, 'booking_step_1', campaigns)}
                step2={getConversionMetric(report, 'booking_step_2', campaigns)}
                step3={getConversionMetric(report, 'booking_step_3', campaigns)}
                reservations={getConversionMetric(report, 'reservations', campaigns)}
                reservationValue={getConversionMetric(report, 'reservation_value', campaigns)}
                conversionValue={getConversionMetric(report, 'conversion_value', campaigns)}
                totalConversionValue={getConversionMetric(report, 'total_conversion_value', campaigns)}
                roas={reportRoas}
                platform={platform}
                labels={{
                  booking_step_1: metricLabel('funnel', 'booking_step_1', platform === 'google' ? 'Booking step 1' : 'Wyszukiwania'),
                  booking_step_2: metricLabel('funnel', 'booking_step_2', platform === 'google' ? 'Booking step 2' : 'Wyświetlenia zawartości'),
                  booking_step_3: metricLabel('funnel', 'booking_step_3', platform === 'google' ? 'Booking step 3' : 'Zainicjowane przejścia do kasy'),
                  reservations: metricLabel('funnel', 'reservations', 'Ilość rezerwacji'),
                  reservation_value: metricLabel('funnel', 'reservation_value', 'Wartość rezerwacji'),
                  total_conversion_value: metricLabel('funnel', 'total_conversion_value', 'Łączna wartość rezerwacji'),
                  roas: metricLabel('funnel', 'roas', 'ROAS'),
                }}
                visible={{
                  booking_step_1: metricVisible('funnel', 'booking_step_1'),
                  booking_step_2: metricVisible('funnel', 'booking_step_2'),
                  booking_step_3: metricVisible('funnel', 'booking_step_3'),
                  reservations: metricVisible('funnel', 'reservations'),
                  reservation_value: metricVisible('funnel', 'reservation_value'),
                  total_conversion_value: metricVisible('funnel', 'total_conversion_value'),
                  roas: metricVisible('funnel', 'roas'),
                }}
                previousYear={yoyData ? {
                  step1: yoyData.previous.booking_step_1,
                  step2: yoyData.previous.booking_step_2,
                  step3: yoyData.previous.booking_step_3,
                  reservations: yoyData.previous.reservations
                } : undefined}
                yoyChanges={yoyData ? {
                  step1: yoyData.changes.booking_step_1,
                  step2: yoyData.changes.booking_step_2,
                  step3: yoyData.changes.booking_step_3,
                  reservations: yoyData.changes.reservations
                } : undefined}
                className="h-full"
              />

              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <div className="mb-3">
                  <h3 className="text-base font-semibold text-slate-950">Kontakt i konwersje</h3>
                  <p className="text-[13px] text-slate-500">Działania użytkowników i potencjał offline.</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold text-slate-400">Kontakt</p>
                    {showCombinedContacts && (
                      <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                        <p className="text-xs text-slate-500">Kontakty łącznie</p>
                        <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-950">
                          {formatContactCount(totalContacts)}
                        </p>
                        {showEmailContacts && showPhoneContacts && (
                          <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
                            {formatContactCount(emailContacts)} {metricLabel('contact', 'email_contacts', 'e-mail').toLowerCase()} / {formatContactCount(phoneContacts)} {metricLabel('contact', 'click_to_call', 'telefon').toLowerCase()}
                          </p>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      {showEmailContacts && (
                        <div className="rounded-lg bg-slate-50 p-2.5">
                          <p className="text-xs text-slate-500">{metricLabel('contact', 'email_contacts', 'E-mail')}</p>
                          <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-950">{formatContactCount(emailContacts)}</p>
                        </div>
                      )}
                      {showPhoneContacts && (
                        <div className="rounded-lg bg-slate-50 p-2.5">
                          <p className="text-xs text-slate-500">{metricLabel('contact', 'click_to_call', 'Telefon')}</p>
                          <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-950">{formatContactCount(phoneContacts)}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold text-slate-400">Rezerwacje</p>
                    <div className="grid grid-cols-2 gap-2">
                      {metricVisible('contact', 'reservations') && (
                        <div className="rounded-lg bg-slate-50 p-2.5">
                          <p className="text-xs text-slate-500">{metricLabel('contact', 'reservations', 'Rezerwacje')}</p>
                          <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-950">{formatNumber(getConversionMetric(report, 'reservations', campaigns))}</p>
                        </div>
                      )}
                      {metricVisible('contact', 'cost_per_reservation') && (
                        <div className="rounded-lg bg-slate-50 p-2.5">
                          <p className="text-xs text-slate-500">{metricLabel('contact', 'cost_per_reservation', 'Koszt rezerwacji')}</p>
                          <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-950">{formatCurrency(totalReservations > 0 ? campaignTotals.spend / totalReservations : 0)}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {(metricVisible('contact', 'offline_reservations') || metricVisible('contact', 'offline_value')) && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold text-slate-400">Potencjał offline</p>
                      <div className="grid grid-cols-2 gap-2">
                        {metricVisible('contact', 'offline_reservations') && (
                          <div className="rounded-lg bg-blue-50 p-2.5">
                            <p className="text-xs text-blue-700">{metricLabel('contact', 'offline_reservations', 'Rezerwacje offline')}</p>
                            <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-950">{formatNumber(potentialOfflineReservations)}</p>
                          </div>
                        )}
                        {metricVisible('contact', 'offline_value') && (
                          <div className="rounded-lg bg-blue-50 p-2.5">
                            <p className="text-xs text-blue-700">{metricLabel('contact', 'offline_value', 'Wartość offline')}</p>
                            <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-950">{formatCurrency(potentialOfflineValue)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {(metricVisible('contact', 'total_value_with_offline') || metricVisible('contact', 'cost_percentage')) && (
                    <div className="rounded-xl border border-slate-200 bg-slate-950 p-3.5 text-white">
                      <p className="text-[11px] font-semibold text-slate-300">Łączna wartość</p>
                      {metricVisible('contact', 'total_value_with_offline') && (
                        <p className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(totalConversionValueWithOffline)}</p>
                      )}
                      {metricVisible('contact', 'cost_percentage') && (
                        <p className="mt-1 text-xs text-slate-300">
                          {metricLabel('contact', 'cost_percentage', 'Koszt pozyskania rezerwacji')}: {costPercentage.toFixed(1)}%
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>


              {/* Social Media Metrics - Temporarily Hidden */}
              {/* 
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <MetricCard
                  title="Nowi obserwujący na Facebooku"
                  value={(() => {
                    // CRITICAL: Debug the exact value being displayed
                    const displayValue = socialLoading ? "Ładowanie..." : (socialInsights?.facebookNewFollowers?.toString() || "0");
                    return displayValue;
                  })()}
                  subtitle="Meta ograniczyła dostęp do danych"
                  tooltip="Facebook deprecował większość wskaźników obserwujących. Alternatywa: używaj danych o zaangażowaniu."
                />
                
                <MetricCard
                  title="Zasięg na Instagramie"
                  value={socialLoading ? "Ładowanie..." : (socialInsights?.instagramReach || 0).toString()}
                  subtitle="Użytkownicy którzy widzieli treści"
                  tooltip="Rzeczywiste dane o zasięgu postów na Instagramie w wybranym okresie"
                />
              </div>
              */}

              {/* Social Insights Status Display - Temporarily Hidden */}
              {/*
              {socialError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                      <p className="text-red-700 font-medium">Błąd - Metryki społecznościowe</p>
                    </div>
                    <button
                      onClick={() => {
                        setSocialError(null);
                        setSocialLoading(true);
                        // Trigger useEffect by changing a dependency
                        window.location.reload();
                      }}
                      className="text-red-600 hover:text-red-800 text-sm underline"
                    >
                      Spróbuj ponownie
                    </button>
                  </div>
                  <p className="text-red-600 text-sm mt-1">Problem z pobieraniem danych social media: {socialError}</p>
                  <p className="text-red-600 text-xs mt-2">Wszystkie metryki reklamowe działają normalnie.</p>
                </div>
              ) : socialLoading ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-yellow-500 rounded-full animate-pulse"></div>
                    <p className="text-yellow-700 font-medium">Ładowanie - Metryki społecznościowe</p>
                  </div>
                  <p className="text-yellow-600 text-sm mt-1">Pobieranie danych z Facebook Page Insights i Instagram Business Account...</p>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                    <p className="text-green-700 font-medium">Aktywne - Metryki społecznościowe</p>
                  </div>
                  <p className="text-green-600 text-sm mt-1">Dane z Facebook Page Insights i Instagram Business Account są aktywne.</p>
                  <p className="text-green-600 text-xs mt-2">Wszystkie metryki reklamowe i społecznościowe działają normalnie.</p>
                </div>
              )}
              */}



            </section>

            {/* Campaigns Table — only rows with wydatki (spend) > 0 */}
            {campaignsSortedBySpend.length > 0 && (
              <section id="campaigns" className="scroll-mt-24">
                <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">Kampanie</h2>
                    <p className="text-[13px] text-slate-500">
                      {campaignsSortedBySpend.length}{' '}
                      {polishCampaignNounAfterCount(campaignsSortedBySpend.length)} z wydatkami w wybranym okresie.
                    </p>
                  </div>
                  <div className="inline-flex w-fit rounded-lg border border-slate-200 bg-white p-0.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                    {[
                      { id: 'outcome' as const, label: 'Wynik' },
                      { id: 'traffic' as const, label: 'Ruch' },
                      { id: 'full' as const, label: 'Pełne dane' },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setCampaignTableMode(mode.id)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                          campaignTableMode === mode.id
                            ? 'bg-slate-950 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>
              
                <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr>
                        {showCampaignColumn('campaign_name') && (
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500">
                          {metricLabel('campaign_table', 'campaign_name', 'Nazwa Kampanii')}
                        </th>
                        )}
                        {showCampaignColumn('totalSpend') && (
                        <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500">
                          {metricLabel('campaign_table', 'totalSpend', 'Wydatki')}
                        </th>
                        )}
                        {showCampaignColumn('totalImpressions') && (
                        <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500">
                          {metricLabel('campaign_table', 'totalImpressions', 'Wyświetlenia')}
                        </th>
                        )}
                        {showCampaignColumn('totalClicks') && (
                        <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500">
                          {metricLabel('campaign_table', 'totalClicks', 'Kliknięcia')}
                        </th>
                        )}
                        {showCampaignColumn('totalConversions') && (
                        <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500">
                          {metricLabel('campaign_table', 'totalConversions', 'Konwersje')}
                        </th>
                        )}
                        {showCampaignColumn('averageCtr') && (
                        <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500">
                          {metricLabel('campaign_table', 'averageCtr', 'CTR')}
                        </th>
                        )}
                        {showCampaignColumn('averageCpc') && (
                        <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500">
                          {metricLabel('campaign_table', 'averageCpc', 'CPC')}
                        </th>
                        )}
                        {showCampaignColumn('reservations') && (
                        <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500">
                          {metricLabel('campaign_table', 'reservations', 'Ilość Rezerwacji')}
                        </th>
                        )}
                        {showCampaignColumn('reservation_value') && (
                        <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500">
                          {metricLabel('campaign_table', 'reservation_value', 'Wartość Rezerwacji')}
                        </th>
                        )}
                        {showCampaignColumn('total_conversion_value') && (
                        <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500">
                          {metricLabel('campaign_table', 'total_conversion_value', 'Łączna wartość konwersji')}
                        </th>
                        )}
                        {showCampaignColumn('cost_per_reservation') && (
                        <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500">
                          {metricLabel('campaign_table', 'cost_per_reservation', 'Koszt rezerwacji')}
                        </th>
                        )}
                        {showCampaignColumn('roas') && (
                        <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500">
                          {metricLabel('campaign_table', 'roas', 'ROAS')}
                        </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {visibleCampaignRows.map((campaign, index) => {
                        return (
                          <tr 
                            key={`${reportId}-${campaign.campaign_id}-${index}`} 
                            className="border-t border-slate-100 transition-colors hover:bg-slate-50"
                          >
                            {showCampaignColumn('campaign_name') && (
                            <td className="px-4 py-2.5">
                              <div className="flex items-center space-x-2.5">
                                <div
                                  className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-white"
                                  style={{
                                    backgroundColor: 
                                      index === 0 ? '#F8992B' :
                                      index === 1 ? '#6B7280' :
                                      index === 2 ? '#F59E0B' :
                                      '#244583',
                                    fontWeight: 500
                                  }}
                                >
                                  {index + 1}
                                </div>
                                <div>
                                  <div className="text-[13px] font-medium text-slate-900">
                                    {campaign.campaign_name}
                                  </div>
                                  <div className="mt-0.5 text-[11px] text-slate-400">
                                    {campaign.objective || 'N/A'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            )}
                            {showCampaignColumn('totalSpend') && (
                            <td className="px-4 py-2.5 text-right text-[13px] text-slate-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {formatCurrency(campaign.spend)}
                            </td>
                            )}
                            {showCampaignColumn('totalImpressions') && (
                            <td className="px-4 py-2.5 text-right text-[13px] text-slate-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {formatNumber(campaign.impressions)}
                            </td>
                            )}
                            {showCampaignColumn('totalClicks') && (
                            <td className="px-4 py-2.5 text-right text-[13px] font-medium text-slate-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {formatNumber(campaign.clicks)}
                            </td>
                            )}
                            {showCampaignColumn('totalConversions') && (
                            <td className="px-4 py-2.5 text-right text-[13px] font-medium text-slate-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {formatNumber(campaign.conversions || 0)}
                            </td>
                            )}
                            {showCampaignColumn('averageCtr') && (
                            <td className="px-4 py-2.5 text-right text-[13px] text-slate-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {`${(campaign.impressions > 0 ? (campaign.clicks / campaign.impressions) * 100 : 0).toFixed(2)}%`}
                            </td>
                            )}
                            {showCampaignColumn('averageCpc') && (
                            <td className="px-4 py-2.5 text-right text-[13px] text-slate-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {formatCurrency(campaign.clicks > 0 ? campaign.spend / campaign.clicks : 0)}
                            </td>
                            )}
                            {showCampaignColumn('reservations') && (
                            <td className="px-4 py-2.5 text-right text-[13px] font-medium text-slate-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {formatNumber(campaign.reservations || 0)}
                            </td>
                            )}
                            {showCampaignColumn('reservation_value') && (
                            <td className="px-4 py-2.5 text-right text-[13px] font-medium text-slate-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {formatCurrency(campaign.reservation_value || 0)}
                            </td>
                            )}
                            {showCampaignColumn('total_conversion_value') && (
                            <td className="px-4 py-2.5 text-right text-[13px] font-medium text-slate-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {formatCurrency((campaign as any).total_conversion_value || (campaign as any).conversion_value || campaign.reservation_value || 0)}
                            </td>
                            )}
                            {showCampaignColumn('cost_per_reservation') && (
                            <td className="px-4 py-2.5 text-right text-[13px] text-slate-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {formatCurrency(campaign.cost_per_reservation || ((campaign.reservations || 0) > 0 ? campaign.spend / (campaign.reservations || 1) : 0))}
                            </td>
                            )}
                            {showCampaignColumn('roas') && (
                            <td className="px-4 py-2.5 text-right text-[13px] font-medium text-slate-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {`${(
                                campaign.roas ||
                                (campaign.spend > 0
                                  ? ((campaign as any).total_conversion_value ??
                                      (campaign as any).conversion_value ??
                                      campaign.reservation_value ??
                                      0) / campaign.spend
                                  : 0)
                              ).toFixed(2)}x`}
                            </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {campaignsSortedBySpend.length > 5 && (
                  <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => setShowAllCampaigns((value) => !value)}
                      className="text-xs font-medium text-slate-700 hover:text-slate-950"
                    >
                      {showAllCampaigns ? 'Pokaż mniej' : 'Zobacz wszystkie kampanie'}
                    </button>
                  </div>
                )}
                </div>
              </section>
            )}

            {campaigns.length === 0 && (
              <section>
                <div className="text-center py-12">
                  <BarChart3 className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Brak Kampanii</h3>
                  <p className="text-gray-600">
                    Nie znaleziono aktywnych kampanii w wybranym okresie.
                  </p>
                </div>
              </section>
            )}

            {campaigns.length > 0 && campaignsSortedBySpend.length === 0 && (
              <section>
                <div className="text-center py-12">
                  <BarChart3 className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Brak kosztów reklamowych</h3>
                  <p className="text-gray-600">
                    W wybranym okresie kampanie nie generowały wydatków na reklamy.
                  </p>
                </div>
              </section>
            )}
          </div>
        );
      })}


    </div>
  );
} 