'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, ChevronDown, ChevronUp, Download, Eye, EyeOff, BarChart3, HelpCircle, MousePointer, PhoneCall, Mail, DollarSign, Percent, Target } from 'lucide-react';
import { supabase } from '../lib/supabase';




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
  cpm?: number;
  
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
}

interface WeeklyReportViewProps {
  reports: { [key: string]: WeeklyReport };
  viewType?: 'monthly' | 'weekly' | 'all-time' | 'custom';
  clientData?: {
    id: string;
    name: string;
    email: string;
  };
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
  
  // Use the same getWeekBoundaries logic as API (adds 6 days with UTC)
  const endDate = new Date(weekStartDate);
  endDate.setUTCDate(weekStartDate.getUTCDate() + 6);
  
  const formatDateForDisplay = (date: Date) => {
    // Use toISOString to get consistent formatting like API
    const isoString = date.toISOString().split('T')[0] || '';
    const [yearStr, monthStr, dayStr] = isoString.split('-');
    return `${dayStr}.${monthStr}`;
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



export default function WeeklyReportView({ reports, viewType = 'weekly', clientData }: WeeklyReportViewProps) {
  
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
  
  if (reportIds.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Brak danych do wyświetlenia</p>
      </div>
    );
  }

  const toggleCampaignExpansion = (reportId: string) => {
    setExpandedCampaigns(prev => ({
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
        const cpm = campaignTotals.impressions > 0 ? (campaignTotals.spend / campaignTotals.impressions) * 1000 : 0;



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
          // 🚨 FIX: For weekly reports, use the reportId instead of corrupted database date
          // reportId format: "2025-W33" -> extract year and week number
          const [year, weekStr] = reportId.split('-W');
          const weekNum = parseInt(weekStr || '1');
          const yearNum = parseInt(year || new Date().getFullYear().toString());
          
          reportTitle = `Raport - ${getWeekDateRange(yearNum, weekNum)}`;
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
                      {viewType === 'weekly' && reportId.includes('-W') ? (
                        // 🚨 FIX: For weekly reports, calculate correct date range from reportId
                        (() => {
                          const [year, weekStr] = reportId.split('-W');
                          const weekNum = parseInt(weekStr || '1');
                          const yearNum = parseInt(year || new Date().getFullYear().toString());
                          
                          // Calculate proper week boundaries
                          const jan4 = new Date(yearNum, 0, 4);
                          const startOfWeek1 = new Date(jan4);
                          startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
                          const weekStartDate = new Date(startOfWeek1);
                          weekStartDate.setDate(startOfWeek1.getDate() + (weekNum - 1) * 7);
                          const weekEndDate = new Date(weekStartDate.getTime() + 6 * 24 * 60 * 60 * 1000);
                          
                          const weekStartDateStr = weekStartDate.toISOString().split('T')[0] || '';
                          const weekEndDateStr = weekEndDate.toISOString().split('T')[0] || '';
                          
                          return (
                            <span>{formatDate(weekStartDateStr)} - {formatDate(weekEndDateStr)}</span>
                          );
                        })()
                      ) : (
                        <span>{formatDate(report.date_range_start)} - {formatDate(report.date_range_end)}</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4" />
                      <span>Ostatnia aktualizacja: {new Date().toLocaleString('pl-PL')}</span>
                    </div>
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
              
              {/* Main Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <MetricCard
                  title="Wydana kwota"
                  value={formatCurrency(campaignTotals.spend)}
                  subtitle="Suma wydatków na reklamy"
                  tooltip="Łączna kwota wydana na reklamy"
                  icon={<BarChart3 className="w-5 h-5 text-slate-600" />}
                />
                
                <MetricCard
                  title="Wyświetlenia"
                  value={formatNumber(campaignTotals.impressions)}
                  subtitle="Liczba wyświetleń reklam"
                  tooltip="Całkowita liczba wyświetleń reklam"
                  icon={<Eye className="w-5 h-5 text-slate-600" />}
                />
                
                <MetricCard
                  title="Kliknięcia linku"
                  value={formatNumber(campaignTotals.clicks)}
                  subtitle="Liczba kliknięć w reklamy"
                  tooltip="Całkowita liczba kliknięć w reklamy"
                  icon={<MousePointer className="w-5 h-5 text-slate-600" />}
                />
              </div>

              {/* Booking Engine Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <MetricCard
                  title="Booking Engine krok 1"
                  value={campaigns.reduce((sum, c) => sum + (c.booking_step_1 || 0), 0).toString()}
                  subtitle="Pierwszy krok rezerwacji"
                  tooltip="Liczba użytkowników, którzy rozpoczęli proces rezerwacji"
                  icon={<Download className="w-5 h-5 text-slate-600" />}
                />
                
                <MetricCard
                  title="Booking Engine krok 2"
                  value={campaigns.reduce((sum, c) => sum + (c.booking_step_2 || 0), 0).toString()}
                  subtitle="Drugi krok rezerwacji"
                  tooltip="Liczba użytkowników, którzy przeszli do drugiego kroku"
                  icon={<Download className="w-5 h-5 text-slate-600" />}
                />
                
                <MetricCard
                  title="Booking Engine krok 3"
                  value={campaigns.reduce((sum, c) => sum + (c.booking_step_3 || 0), 0).toString()}
                  subtitle="Trzeci krok rezerwacji"
                  tooltip="Liczba użytkowników, którzy ukończyli proces rezerwacji"
                  icon={<Download className="w-5 h-5 text-slate-600" />}
                />
              </div>

              {/* Contact Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <MetricCard
                  title="Kliknięcia w adres e-mail"
                  value={campaigns.reduce((sum, c) => sum + (c.email_contacts || 0), 0).toString()}
                  subtitle="Kontakt przez e-mail"
                  tooltip="Liczba kliknięć w adres e-mail"
                  icon={<Mail className="w-5 h-5 text-slate-600" />}
                />
                
                <MetricCard
                  title="Kliknięcia w numer telefonu"
                  value={campaigns.reduce((sum, c) => sum + (c.click_to_call || 0), 0).toString()}
                  subtitle="Kontakt przez telefon"
                  tooltip="Liczba kliknięć w numer telefonu"
                  icon={<PhoneCall className="w-5 h-5 text-slate-600" />}
                />
              </div>

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



              {/* Conversion Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard
                  title="Rezerwacje"
                  value={campaigns.reduce((sum, c) => sum + (c.reservations || 0), 0).toString()}
                  subtitle="Liczba rezerwacji"
                  tooltip="Całkowita liczba rezerwacji"
                  icon={<Calendar className="w-5 h-5 text-slate-600" />}
                />
                
                <MetricCard
                  title="Wartość rezerwacji"
                  value={formatCurrency(campaigns.reduce((sum, c) => sum + (c.reservation_value || 0), 0))}
                  subtitle="Wartość wszystkich rezerwacji"
                  tooltip="Łączna wartość wszystkich rezerwacji"
                  icon={<DollarSign className="w-5 h-5 text-slate-600" />}
                />
                
                <MetricCard
                  title="ROAS"
                  value={(() => {
                    const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
                    const totalValue = campaigns.reduce((sum, c) => sum + (c.reservation_value || 0), 0);
                    return totalSpend > 0 ? (totalValue / totalSpend).toFixed(2) + 'x' : '0x';
                  })()}
                  subtitle="Return on Ad Spend"
                  tooltip="Zwrot z wydatków na reklamy"
                  icon={<Percent className="w-5 h-5 text-slate-600" />}
                />
              </div>
            </section>

            {/* Campaign Performance Section - Consolidated */}
            <section>
              <div className="mb-8">
                <h2 className="text-2xl font-semibold text-slate-900 mb-3 tracking-tight">Dodatkowe Metryki</h2>
                <p className="text-base text-slate-600">Wszystkie dodatkowe metryki reklamowe i konwersji</p>
              </div>
              
              {/* Main Campaign Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <MetricCard
                  title="Zasięg"
                  value={formatNumber(campaignTotals.reach)}
                  subtitle="Unikalni użytkownicy"
                  tooltip="Liczba unikalnych użytkowników, którzy zobaczyli reklamy"
                  icon={<Download className="w-5 h-5 text-slate-600" />}
                />
                
                <MetricCard
                  title="CTR"
                  value={`${ctr.toFixed(2)}%`}
                  subtitle="Click-through rate"
                  tooltip="Procent kliknięć w stosunku do wyświetleń"
                  icon={<Percent className="w-5 h-5 text-slate-600" />}
                />
                
                <MetricCard
                  title="CPC"
                  value={formatCurrency(cpc)}
                  subtitle="Cost per click"
                  tooltip="Średni koszt za kliknięcie"
                  icon={<Download className="w-5 h-5 text-slate-600" />}
                />
                
                <MetricCard
                  title="CPM"
                  value={formatCurrency(cpm)}
                  subtitle="Cost per mille"
                  tooltip="Koszt za 1000 wyświetleń"
                  icon={<Download className="w-5 h-5 text-slate-600" />}
                />
              </div>

              {/* Conversion and Performance Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <MetricCard
                  title="Konwersje"
                  value={campaigns.reduce((sum, c) => sum + (c.conversions || 0), 0).toString()}
                  subtitle="Łączna liczba konwersji"
                  tooltip="Całkowita liczba konwersji ze wszystkich kampanii"
                  icon={<Download className="w-5 h-5 text-slate-600" />}
                />
                
                <MetricCard
                  title="Koszt per rezerwacja"
                  value={(() => {
                    const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
                    const totalReservations = campaigns.reduce((sum, c) => sum + (c.reservations || 0), 0);
                    return totalReservations > 0 ? formatCurrency(totalSpend / totalReservations) : '—';
                  })()}
                  subtitle="Średni koszt za jedną rezerwację"
                  tooltip="Średni koszt za jedną rezerwację"
                  icon={<Download className="w-5 h-5 text-slate-600" />}
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
                      </tr>
                    </thead>
                    <tbody style={{ backgroundColor: '#FFFFFF' }}>
                      {campaignsToShow.map((campaign, index) => {
                        const ctr = campaign.impressions > 0 ? (campaign.clicks / campaign.impressions) * 100 : 0;
                        const cpc = campaign.clicks > 0 ? campaign.spend / campaign.clicks : 0;
                        
                        return (
                          <tr 
                            key={`${reportId}-${campaign.campaign_id}`} 
                            className="transition-all duration-150 border-t border-gray-100"
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#F8F9FA';
                              e.currentTarget.style.borderLeftColor = '#244583';
                              e.currentTarget.style.borderLeftWidth = '3px';
                            }}
                            onMouseLeave={(e) => {
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