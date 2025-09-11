'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, ChevronDown, ChevronUp, Download, Eye, EyeOff, BarChart3, HelpCircle, MousePointer, PhoneCall, Mail, DollarSign, Percent, Target } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useYearOverYearComparison } from '@/lib/hooks/useYearOverYearComparison';
import ConversionFunnel from './ConversionFunnel';




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

interface WeeklyReportViewProps {
  reports: { [key: string]: WeeklyReport };
  viewType?: 'monthly' | 'weekly' | 'all-time' | 'custom';
  clientData?: {
    id: string;
    name: string;
    email: string;
  };
  platform?: 'meta' | 'google';
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

// Metric Card Component - Premium minimalist design
const MetricCard = ({ 
  title, 
  value, 
  subtitle, 
  tooltip,
  icon,
  change,
  miniSpark
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
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const card = (
    <div 
      className="relative bg-white border border-slate-200 rounded-2xl p-6 transition-all duration-200 shadow-sm hover:shadow-md"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Icon and Title */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          {icon && (
            <div className="p-2 bg-slate-100 rounded-lg">
              {icon}
            </div>
          )}
          <span className="text-sm font-medium text-slate-600">{title}</span>
        </div>
        {tooltip && (
          <Tooltip content={tooltip}>
            <HelpCircle className="w-4 h-4 text-slate-400 hover:text-slate-600 transition-colors" />
          </Tooltip>
        )}
      </div>
      
      {/* Main Value */}
      <div className="mb-4">
        <p className="text-3xl font-semibold text-slate-900 tabular-nums tracking-tight">
          {value}
        </p>
        {subtitle && (
          <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
        )}
      </div>

      {/* Mini Spark Chart */}
      {miniSpark && miniSpark.length > 0 && (
        <div className="mb-4">
          <div className="flex items-end space-x-1 h-8">
            {miniSpark.map((val, idx) => {
              const maxVal = Math.max(...miniSpark);
              const height = maxVal > 0 ? (val / maxVal) * 32 : 2;
              return (
                <div
                  key={idx}
                  className="bg-slate-900 rounded-sm flex-1 transition-all duration-200"
                  style={{ height: `${height}px`, minHeight: '2px' }}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>0</span>
            <span>cel</span>
          </div>
        </div>
      )}

      {/* Change Indicator */}
      {change && (
        <div className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium ${
          change.type === 'increase' 
            ? 'bg-slate-900/8 text-slate-900' 
            : 'bg-orange-500/10 text-orange-700'
        }`}>
          <span className="mr-1">vs {change.period}</span>
          <span className={`${change.type === 'increase' ? 'text-slate-900' : 'text-orange-600'}`}>
            {change.type === 'increase' ? '+' : '−'}{Math.abs(change.value).toFixed(1)}%
          </span>
          <span className="ml-1">
            {change.type === 'increase' ? '▲' : '▼'}
          </span>
        </div>
      )}
    </div>
  );

  return tooltip ? <Tooltip content={tooltip}>{card}</Tooltip> : card;
};



export default function WeeklyReportView({ reports, viewType = 'weekly', clientData, platform = 'meta' }: WeeklyReportViewProps) {
  console.log('🚨 YOY DEBUG - WeeklyReportView component rendered at:', new Date().toISOString());
  console.log('🚨 YOY DEBUG - Component props:', { 
    hasReports: !!reports, 
    reportCount: Object.keys(reports || {}).length,
    viewType, 
    hasClientData: !!clientData,
    platform 
  });
  
  const [expandedCampaigns, setExpandedCampaigns] = useState<{ [key: string]: boolean }>({});
  const [socialInsights, setSocialInsights] = useState<{
    facebookNewFollowers: number | string;
    instagramFollowers: number;
    instagramReach: number;
    instagramProfileViews: number;
  } | null>(null);
  
  // DEBUG: Track state changes
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialError, setSocialError] = useState<string | null>(null);
  

  
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
  const { data: yoyData, loading: yoyLoading, error: yoyError } = useYearOverYearComparison({
    clientId: clientData?.id || '',
    dateRange: yoyDateRange,
    enabled: true, // 🔧 RE-ENABLED: API is now fixed and working correctly
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
    const currentTotals = firstReport.campaigns.reduce((acc, campaign) => ({
      spend: acc.spend + (campaign.spend || 0),
      impressions: acc.impressions + (campaign.impressions || 0),
      clicks: acc.clicks + (campaign.clicks || 0),
      booking_step_1: acc.booking_step_1 + (campaign.booking_step_1 || 0),
      booking_step_2: acc.booking_step_2 + (campaign.booking_step_2 || 0),
      booking_step_3: acc.booking_step_3 + (campaign.booking_step_3 || 0),
      reservations: acc.reservations + (campaign.reservations || 0),
    }), {
      spend: 0,
      impressions: 0,
      clicks: 0,
      booking_step_1: 0,
      booking_step_2: 0,
      booking_step_3: 0,
      reservations: 0,
    });
    
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
  
  // Use hook data instead of local calculation (API is now working correctly)
  const localYoYData = calculateLocalYoYComparison();
  
  // Debug logging for YoY hook results
  console.log('🔍 YoY Hook Debug - Results:', {
    hasData: !!yoyData,
    loading: yoyLoading,
    error: yoyError,
    dataKeys: yoyData ? Object.keys(yoyData) : [],
    currentSpend: yoyData?.current?.spend || 0,
    previousSpend: yoyData?.previous?.spend || 0,
    localYoYData: localYoYData,
    enabled: true, // Hook is enabled and working
    reportIds: reportIds,
    reportsKeys: Object.keys(reports)
  });
  
  if (reportIds.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Brak danych do wyświetlenia</p>
      </div>
    );
  }

  const toggleCampaignExpansion = (reportId: string) => {
    setExpandedCampaigns((prev: { [key: string]: boolean }) => ({
      ...prev,
      [reportId]: !prev[reportId]
    }));
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-10">
      {reportIds.map((reportId) => {
        const report = reports[reportId];
        if (!report) return null;
        const campaigns = report.campaigns || [];
        
        // Year-over-year comparison data loaded

        // Helper function to format comparison change for MetricCard
        const formatComparisonChange = (changePercent: number) => {
          // 🔧 FIX: Use hook YoY data (API is now working correctly)
          if (!yoyData) return undefined;
          
          // Handle special case for no historical data (-999 indicates no comparison available)
          if (changePercent === -999) return undefined; // Don't show comparison when no historical data
          
          // Only show if we have meaningful change (not exactly 0)
          if (Math.abs(changePercent) < 0.01) return undefined;
          
          return {
            value: Math.abs(changePercent),
            period: 'rok do roku', // Year-over-year comparison
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
        const ctr = campaignTotals.impressions > 0 ? (campaignTotals.clicks / campaignTotals.impressions) * 100 : 0;
        const cpc = campaignTotals.clicks > 0 ? campaignTotals.spend / campaignTotals.clicks : 0;



        const startDate = new Date(report.date_range_start);
        const weekNumber = getWeekNumber(startDate);

        // Determine report title
        let reportTitle = 'Raport';
        if (reportId === 'all-time') {
          reportTitle = 'Raport - Cały Okres';
        } else if (reportId === 'custom') {
          reportTitle = 'Raport - Własny Zakres';
        } else if (viewType === 'monthly') {
          reportTitle = 'Raport - Miesiąc';
        } else {
          // 🔧 FIX: For weekly reports, handle both formats: "2025-W36" or "weekly-2025-W36"
          let periodId = reportId;
          
          // If reportId starts with "weekly-", extract the period part
          if (reportId.startsWith('weekly-')) {
            periodId = reportId.replace('weekly-', '');
          }
          
          // Now parse the period ID: "2025-W36" -> extract year and week number
          const [year, weekStr] = periodId.split('-W');
          const weekNum = parseInt(weekStr || '1');
          const yearNum = parseInt(year || new Date().getFullYear().toString());
          
          // Validate parsed values to avoid NaN
          if (isNaN(yearNum) || isNaN(weekNum)) {
            console.error('Failed to parse weekly period ID:', { reportId, periodId, year, weekStr, yearNum, weekNum });
            reportTitle = 'Raport - Tydzień';
          } else {
            reportTitle = `Raport - ${getWeekDateRange(yearNum, weekNum)}`;
          }
        }

        // Determine how many campaigns to show
        const isExpanded = expandedCampaigns[reportId] || false;
        const campaignsToShow = isExpanded ? campaigns : campaigns.slice(0, 5);
        const hasMoreCampaigns = campaigns.length > 5;

        // Calculate actual days in the report range
        const reportStartDate = new Date(report.date_range_start);
        const reportEndDate = new Date(report.date_range_end);
        const daysDifference = Math.ceil((reportEndDate.getTime() - reportStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        if (daysDifference > 7) {
          // console.log('⚠️ WARNING: Weekly report contains MORE than 7 days of data!');
          // console.log('   This explains why spend/metrics are higher than expected');
          // console.log('   The API may be returning a longer date range than requested');
        }

        return (
          <div key={reportId} className="space-y-10">
            {/* Header Section */}
            <div className="border-b pb-8" style={{ borderColor: '#E5E7EB' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl text-gray-900 mb-2" style={{ fontWeight: 600 }}>
                    {reportTitle}
                  </h1>
                  <div className="flex items-center space-x-6 text-sm text-gray-600">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4" />
                      {viewType === 'weekly' && (reportId.includes('-W') || reportId.startsWith('weekly-')) ? (
                        // 🔧 FIX: For weekly reports, calculate correct date range from reportId using safe date methods
                        (() => {
                          // Handle both formats: "2025-W36" or "weekly-2025-W36"
                          let periodId = reportId;
                          if (reportId.startsWith('weekly-')) {
                            periodId = reportId.replace('weekly-', '');
                          }
                          
                          const [year, weekStr] = periodId.split('-W');
                          const weekNum = parseInt(weekStr || '1');
                          const yearNum = parseInt(year || new Date().getFullYear().toString());
                          
                          // Validate parsed values
                          if (isNaN(yearNum) || isNaN(weekNum)) {
                            console.error('Failed to parse weekly period for date display:', { reportId, periodId, year, weekStr });
                            return <span>Nieprawidłowy okres</span>;
                          }
                          
                          // Calculate proper week boundaries using safe date methods
                          const jan4 = new Date(yearNum, 0, 4);
                          const startOfWeek1 = new Date(jan4);
                          startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
                          const weekStartDate = new Date(startOfWeek1);
                          weekStartDate.setDate(startOfWeek1.getDate() + (weekNum - 1) * 7);
                          
                          // 🔧 FIX: Use setDate instead of getTime() + milliseconds to avoid invalid dates
                          const weekEndDate = new Date(weekStartDate);
                          weekEndDate.setDate(weekStartDate.getDate() + 6);
                          
                          // Helper function for safe date formatting
                          const formatDateSafe = (date: Date) => {
                            try {
                              const year = date.getFullYear();
                              const month = String(date.getMonth() + 1).padStart(2, '0');
                              const day = String(date.getDate()).padStart(2, '0');
                              return `${year}-${month}-${day}`;
                            } catch (error) {
                              console.error('Date formatting error:', error);
                              return 'Invalid Date';
                            }
                          };
                          
                          const weekStartDateStr = formatDateSafe(weekStartDate);
                          const weekEndDateStr = formatDateSafe(weekEndDate);
                          
                          return (
                            <span>{formatDate(weekStartDateStr)} - {formatDate(weekEndDateStr)}</span>
                          );
                        })()
                      ) : (
                        <span>{formatDate(report.date_range_start)} - {formatDate(report.date_range_end)}</span>
                      )}
                    </div>
                    {/* Last Updated - Only visible in development mode */}
                    {process.env.NODE_ENV === 'development' && (
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4" />
                        <span>Ostatnia aktualizacja: {new Date().toLocaleString('pl-PL')}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg text-gray-900" style={{ fontWeight: 600 }}>
                    {campaigns.length}
                  </div>
                  <div className="text-sm text-gray-600">
                    {campaigns.length === 1 ? 'kampania' : 'kampanii'}
                  </div>
                </div>
              </div>
            </div>



            {/* Comprehensive Metrics Section */}
            <section className="mb-12">
              <div className="mb-8">
                <h2 className="text-2xl font-semibold text-slate-900 mb-3 tracking-tight">Kompletne Metryki</h2>
                <p className="text-base text-slate-600">Wszystkie metryki reklamowe i konwersji</p>
              </div>
              
              {/* Main Metrics - First Section */}
              <div className="mb-8">
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">Podstawowe metryki</h3>
                  <p className="text-slate-600">Wydatki i podstawowe wskaźniki wydajności</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                  <MetricCard
                    title="Wydana kwota"
                    value={formatCurrency(campaignTotals.spend)}
                    subtitle="Suma wydatków na reklamy"
                    tooltip="Łączna kwota wydana na reklamy"
                    icon={<BarChart3 className="w-5 h-5 text-slate-600" />}
                    change={formatComparisonChange(yoyData?.changes?.spend || 0)}
                  />
                  
                  <MetricCard
                    title="Wyświetlenia"
                    value={formatNumber(campaignTotals.impressions)}
                    subtitle="Liczba wyświetleń reklam"
                    tooltip="Całkowita liczba wyświetleń reklam"
                    icon={<Eye className="w-5 h-5 text-slate-600" />}
                    change={formatComparisonChange(yoyData?.changes?.impressions || 0)}
                  />
                  
                  <MetricCard
                    title="Kliknięcia linku"
                    value={formatNumber(campaignTotals.clicks)}
                    subtitle="Liczba kliknięć w reklamy"
                    tooltip="Całkowita liczba kliknięć w reklamy"
                    icon={<MousePointer className="w-5 h-5 text-slate-600" />}
                    change={formatComparisonChange(yoyData?.changes?.clicks || 0)}
                  />
                  
                  <MetricCard
                    title="CTR"
                    value={(() => {
                      const ctr = campaignTotals.impressions > 0 ? (campaignTotals.clicks / campaignTotals.impressions) * 100 : 0;
                      return ctr.toFixed(2) + '%';
                    })()}
                    subtitle="Wskaźnik klikalności"
                    tooltip="Wskaźnik klikalności - procent kliknięć w stosunku do wyświetleń"
                    icon={<Target className="w-5 h-5 text-slate-600" />}
                  />
                  
                  <MetricCard
                    title="CPC"
                    value={(() => {
                      const cpc = campaignTotals.clicks > 0 ? campaignTotals.spend / campaignTotals.clicks : 0;
                      return formatCurrency(cpc);
                    })()}
                    subtitle="Koszt za kliknięcie"
                    tooltip="Koszt za kliknięcie"
                    icon={<DollarSign className="w-5 h-5 text-slate-600" />}
                  />
                </div>
              </div>

              {/* Conversion Funnel - Second Section */}
              <ConversionFunnel
                step1={yoyData ? yoyData.current.booking_step_1 : campaigns.reduce((sum, c) => sum + (c.booking_step_1 || 0), 0)}
                step2={yoyData ? yoyData.current.booking_step_2 : campaigns.reduce((sum, c) => sum + (c.booking_step_2 || 0), 0)}
                step3={yoyData ? yoyData.current.booking_step_3 : campaigns.reduce((sum, c) => sum + (c.booking_step_3 || 0), 0)}
                reservations={yoyData ? yoyData.current.reservations : campaigns.reduce((sum, c) => sum + (c.reservations || 0), 0)}
                reservationValue={campaigns.reduce((sum, c) => sum + (c.reservation_value || 0), 0)}
                roas={(() => {
                  const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
                  const totalValue = campaigns.reduce((sum, c) => sum + (c.reservation_value || 0), 0);
                  return totalSpend > 0 ? totalValue / totalSpend : 0;
                })()}
                previousYear={yoyData ? {
                  // Use real booking step data from hook
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
                className="mb-8"
              />


              {/* Social Media Metrics - Temporarily Hidden */}
              {/* 
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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

            {/* Campaign Performance Section - Consolidated */}
            <section>
              <div className="mb-8">
                <h2 className="text-2xl font-semibold text-slate-900 mb-3 tracking-tight">Wydajność kampanii</h2>
                <p className="text-base text-slate-600">Wszystkie dodatkowe metryki reklamowe i konwersji</p>
              </div>
              
              {/* Contact Metrics - Moved to top */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <MetricCard
                  title="Kliknięcia w adres e-mail"
                  value={(report.conversionMetrics?.email_contacts || campaigns.reduce((sum, c) => sum + (c.email_contacts || 0), 0)).toString()}
                  subtitle="Kontakt przez e-mail"
                  tooltip="Liczba kliknięć w adres e-mail"
                  icon={<Mail className="w-5 h-5 text-slate-600" />}
                  change={formatComparisonChange(yoyData?.changes?.clicks || 0)} // Using clicks as proxy for contact metrics
                />
                
                <MetricCard
                  title="Kliknięcia w numer telefonu"
                  value={(report.conversionMetrics?.click_to_call || campaigns.reduce((sum, c) => sum + (c.click_to_call || 0), 0)).toString()}
                  subtitle="Kontakt przez telefon"
                  tooltip="Liczba kliknięć w numer telefonu"
                  icon={<PhoneCall className="w-5 h-5 text-slate-600" />}
                  change={formatComparisonChange(yoyData?.changes?.clicks || 0)} // Using clicks as proxy for contact metrics
                />
              </div>

              {/* Calculated Offline Potential Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <MetricCard
                  title="Potencjalna ilość rezerwacji offline"
                  value={(() => {
                    const totalEmailContacts = campaigns.reduce((sum, c) => sum + (c.email_contacts || 0), 0);
                    const totalPhoneContacts = campaigns.reduce((sum, c) => sum + (c.click_to_call || 0), 0);
                    const potentialOfflineReservations = Math.round((totalEmailContacts + totalPhoneContacts) * 0.2);
                    return potentialOfflineReservations.toString();
                  })()}
                  subtitle="20% z łącznej liczby e-mail i telefonów"
                  tooltip="Szacowana liczba rezerwacji offline na podstawie kontaktów"
                  icon={<PhoneCall className="w-5 h-5 text-slate-600" />}
                  change={formatComparisonChange(yoyData?.changes?.clicks || 0)} // Using clicks as proxy
                />
                
                <MetricCard
                  title="Koszt pozyskania rezerwacji"
                  value={(() => {
                    // Calculate offline value
                    let potentialOfflineValue = 0;
                    if (report.conversionMetrics?.offline_value !== undefined) {
                      potentialOfflineValue = report.conversionMetrics.offline_value;
                    } else {
                      const totalEmailContacts = campaigns.reduce((sum, c) => sum + (c.email_contacts || 0), 0);
                      const totalPhoneContacts = campaigns.reduce((sum, c) => sum + (c.click_to_call || 0), 0);
                      const potentialOfflineReservations = Math.round((totalEmailContacts + totalPhoneContacts) * 0.2);
                      
                      const totalReservationValue = campaigns.reduce((sum, c) => sum + (c.reservation_value || 0), 0);
                      const totalReservations = campaigns.reduce((sum, c) => sum + (c.reservations || 0), 0);
                      
                      const averageReservationValue = totalReservations > 0 ? totalReservationValue / totalReservations : 0;
                      potentialOfflineValue = potentialOfflineReservations * averageReservationValue;
                    }
                    
                    // Calculate online value
                    const onlineReservationValue = campaigns.reduce((sum, c) => sum + (c.reservation_value || 0), 0);
                    
                    // Total potential value
                    const totalPotentialValue = potentialOfflineValue + onlineReservationValue;
                    
                    // Calculate cost percentage
                    const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
                    const costPercentage = totalPotentialValue > 0 ? (totalSpend / totalPotentialValue) * 100 : 0;
                    
                    return `${costPercentage.toFixed(1)}%`;
                  })()}
                  subtitle="(wydana kwota / łączna wartość potencjalnych rezerwacji) × 100"
                  tooltip="Procentowy koszt pozyskania rezerwacji w stosunku do ich wartości"
                  icon={<Percent className="w-5 h-5 text-slate-600" />}
                  change={formatComparisonChange(yoyData?.changes?.spend || 0)}
                />
              </div>
              
              {/* Main Campaign Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <MetricCard
                  title="Zasięg"
                  value={formatNumber(report.conversionMetrics?.reach || campaignTotals.reach)}
                  subtitle="Unikalni użytkownicy"
                  tooltip="Liczba unikalnych użytkowników, którzy zobaczyli reklamy"
                  icon={<Download className="w-5 h-5 text-slate-600" />}
                  change={formatComparisonChange(yoyData?.changes?.impressions || 0)} // Using impressions as proxy for reach
                />
                
                <MetricCard
                  title="CTR"
                  value={`${ctr.toFixed(2)}%`}
                  subtitle="Click-through rate"
                  tooltip="Procent kliknięć w stosunku do wyświetleń"
                  icon={<Percent className="w-5 h-5 text-slate-600" />}
                  change={formatComparisonChange(yoyData?.changes?.clicks || 0)} // CTR is related to clicks
                />
                
                <MetricCard
                  title="CPC"
                  value={formatCurrency(cpc)}
                  subtitle="Cost per click"
                  tooltip="Średni koszt za kliknięcie"
                  icon={<Download className="w-5 h-5 text-slate-600" />}
                  change={formatComparisonChange(yoyData?.changes?.spend || 0)} // CPC is related to spend efficiency
                />
                

              </div>


            </section>

            {/* Campaigns Table */}
            {campaigns.length > 0 && (
              <section>
                <div className="mb-8">
                  <h2 className="text-lg text-gray-900 mb-2" style={{ fontWeight: 600 }}>Szczegóły Kampanii</h2>
                  <p className="text-sm text-gray-600">
                    Top kampanie według wydajności • {campaigns.length} aktywnych kampanii
                    {hasMoreCampaigns && !isExpanded && ` • Pokazano top 5`}
                  </p>
                </div>
              
                <div className="overflow-x-auto" style={{ backgroundColor: '#FFFFFF', border: '1px solid #F0F0F0', borderRadius: '8px' }}>
                  <table className="w-full">
                    <thead style={{ backgroundColor: '#FAFBFC' }} className="sticky top-0">
                      <tr>
                        <th className="text-left py-4 px-5 text-xs font-medium text-gray-600 uppercase tracking-wide">
                          Nazwa Kampanii
                        </th>
                        <th className="text-right py-4 px-5 text-xs font-medium text-gray-600 uppercase tracking-wide">
                          Wydatki
                        </th>
                        <th className="text-right py-4 px-5 text-xs font-medium text-gray-600 uppercase tracking-wide">
                          Wyświetlenia
                        </th>
                        <th className="text-right py-4 px-5 text-xs font-medium text-gray-600 uppercase tracking-wide">
                          Kliknięcia
                        </th>
                        <th className="text-right py-4 px-5 text-xs font-medium text-gray-600 uppercase tracking-wide">
                          CTR
                        </th>
                        <th className="text-right py-4 px-5 text-xs font-medium text-gray-600 uppercase tracking-wide">
                          CPC
                        </th>
                        <th className="text-right py-4 px-5 text-xs font-medium text-gray-600 uppercase tracking-wide">
                          Ilość Rezerwacji
                        </th>
                        <th className="text-right py-4 px-5 text-xs font-medium text-gray-600 uppercase tracking-wide">
                          Wartość Rezerwacji
                        </th>
                      </tr>
                    </thead>
                    <tbody style={{ backgroundColor: '#FFFFFF' }}>
                      {campaignsToShow.map((campaign, index) => {
                        const ctr = campaign.impressions > 0 ? (campaign.clicks / campaign.impressions) * 100 : 0;
                        const cpc = campaign.clicks > 0 ? campaign.spend / campaign.clicks : 0;
                        
                        return (
                          <tr 
                            key={`${reportId}-${campaign.campaign_id}-${index}`} 
                            className="transition-all duration-150 border-t border-gray-100"
                            onMouseEnter={(e: React.MouseEvent<HTMLTableRowElement>) => {
                              e.currentTarget.style.backgroundColor = '#F8F9FA';
                              e.currentTarget.style.borderLeftColor = '#244583';
                              e.currentTarget.style.borderLeftWidth = '3px';
                            }}
                            onMouseLeave={(e: React.MouseEvent<HTMLTableRowElement>) => {
                              e.currentTarget.style.backgroundColor = '#FFFFFF';
                              e.currentTarget.style.borderLeftColor = 'transparent';
                              e.currentTarget.style.borderLeftWidth = '0px';
                            }}
                          >
                            <td className="py-4 px-5">
                              <div className="flex items-center space-x-3">
                                <div 
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs"
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
                                  <div className="text-sm text-gray-900" style={{ fontWeight: 500 }}>
                                    {campaign.campaign_name}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    {campaign.objective || 'N/A'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-5 text-sm text-gray-900 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {formatCurrency(campaign.spend)}
                            </td>
                            <td className="py-4 px-5 text-sm text-gray-900 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {formatNumber(campaign.impressions)}
                            </td>
                            <td className="py-4 px-5 text-sm text-gray-900 text-right" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                              {formatNumber(campaign.clicks)}
                            </td>
                            <td className="py-4 px-5 text-sm text-gray-900 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {ctr.toFixed(2)}%
                            </td>
                            <td className="py-4 px-5 text-sm text-gray-900 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {formatCurrency(cpc)}
                            </td>
                            <td className="py-4 px-5 text-sm text-gray-900 text-right" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                              {formatNumber(campaign.reservations || 0)}
                            </td>
                            <td className="py-4 px-5 text-sm text-gray-900 text-right" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                              {formatCurrency(campaign.reservation_value || 0)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* See More/Less Button */}
                {hasMoreCampaigns && (
                  <div className="flex justify-center mt-6">
                    <button
                      onClick={() => toggleCampaignExpansion(reportId)}
                      className="flex items-center space-x-2 px-6 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 text-sm font-medium text-gray-700"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-4 h-4" />
                          <span>Pokaż mniej</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4" />
                          <span>Zobacz więcej ({campaigns.length - 5} więcej)</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
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
          </div>
        );
      })}


    </div>
  );
} 