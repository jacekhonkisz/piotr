import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import logger from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest, canAccessClient, createErrorResponse } from '@/lib/auth-middleware';

interface ReportData {
  // Client information
  clientId: string;
  clientName: string;
  clientLogo?: string;
  
  // Date range
  dateRange: {
    start: string;
    end: string;
  };
  
  // AI Summary
  aiSummary?: string;
  
  // Year-over-year comparison data
  yoyComparison?: {
    meta: {
      current: { spend: number; reservationValue: number; };
      previous: { spend: number; reservationValue: number; };
      changes: { spend: number; reservationValue: number; };
    };
    google: {
      current: { spend: number; reservationValue: number; };
      previous: { spend: number; reservationValue: number; };
      changes: { spend: number; reservationValue: number; };
    };
  };
  
  // Meta Ads data
  metaData?: {
    metrics: {
      totalSpend: number;
      totalImpressions: number;
      totalClicks: number;
      totalConversions: number;
      averageCtr: number;
      averageCpc: number;
      averageCpa: number;
      averageCpm: number;
      reach: number;
      relevanceScore: number;
      landingPageViews: number;
      totalReservations: number;
      totalReservationValue: number;
      roas: number;
      emailContacts: number;
      phoneContacts: number;
    };
    campaigns: any[];
    funnel: {
      booking_step_1: number;
      booking_step_2: number;
      booking_step_3: number;
      reservations: number;
      reservation_value: number;
      roas: number;
    };
    tables: {
      placementPerformance: any[];
      demographicPerformance: any[];
      adRelevanceResults: any[];
    };
  };
  
  // Google Ads data
  googleData?: {
    metrics: {
      totalSpend: number;
      totalImpressions: number;
      totalClicks: number;
      totalConversions: number;
      averageCtr: number;
      averageCpc: number;
      averageCpa: number;
      averageCpm: number;
      searchImpressionShare: number;
      qualityScore: number;
      viewThroughConversions: number;
      searchBudgetLostImpressionShare: number;
      totalReservations: number;
      totalReservationValue: number;
      roas: number;
      emailContacts: number;
      phoneContacts: number;
    };
    campaigns: any[];
    funnel: {
      booking_step_1: number;
      booking_step_2: number;
      booking_step_3: number;
      reservations: number;
      reservation_value: number;
      roas: number;
    };
    tables: {
      networkPerformance: any[];
      devicePerformance: any[];
      keywordPerformance: any[];
    };
  };
}

interface Client {
  id: string;
  name: string;
  email: string;
}

// Helper functions for formatting
const formatCurrency = (value: number | undefined | null) => {
  if (value === undefined || value === null || isNaN(value) || value === 0) return '—';
  return `${value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, '\u00A0')} zł`;
};

const formatNumber = (value: number | undefined | null, decimals: number = 0) => {
  if (value === undefined || value === null || isNaN(value) || value === 0) return '—';
  return value.toLocaleString('pl-PL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).replace(/\s/g, '\u00A0');
};

const formatPercentage = (value: number | undefined | null) => {
  if (value === undefined || value === null || isNaN(value) || value === 0) return '—';
  return `${value.toFixed(2).replace('.', ',')}%`;
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('pl-PL', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

// Generate Section 1: Title Page with AI Summary
const generateTitleSection = (reportData: ReportData) => {
  // COMPREHENSIVE AI SUMMARY DISPLAY AUDIT
  logger.info('🎯 TITLE SECTION GENERATION - AI Summary Audit:', {
    hasAiSummary: !!reportData.aiSummary,
    aiSummaryLength: reportData.aiSummary?.length || 0,
    aiSummaryPreview: reportData.aiSummary?.substring(0, 50) || 'NO SUMMARY',
    aiSummaryType: typeof reportData.aiSummary,
    willDisplayAiSection: !!reportData.aiSummary
  });
  
  logger.info('🔍 TITLE SECTION: Generating without page break (should be page 1)');
  
  const titleHtml = `
    <div class="title-page">
      <div class="page-content">
        <div class="clean-title-section">
        ${reportData.clientLogo ? `
            <div class="clean-logo-container">
              <img src="${reportData.clientLogo}" alt="Logo" class="clean-client-logo" />
          </div>
        ` : ''}
        
          <div class="clean-title-header">
            <h1 class="clean-main-title">Raport Kampanii Reklamowych</h1>
            <h2 class="clean-company-name">${reportData.clientName}</h2>
            <div class="clean-date-range">
            ${formatDate(reportData.dateRange.start)} - ${formatDate(reportData.dateRange.end)}
          </div>
            <div class="clean-generation-date">
            Wygenerowano: ${formatDate(new Date().toISOString())}
          </div>
        </div>
        
        ${reportData.aiSummary ? `
            <div class="clean-ai-summary-section">
              <h3 class="clean-summary-title">Podsumowanie Wykonawcze</h3>
              <div class="clean-summary-content">
              ${reportData.aiSummary}
            </div>
          </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
  
  logger.info('🎯 TITLE SECTION HTML Generated:', {
    htmlLength: titleHtml.length,
    containsAiSummarySection: titleHtml.includes('ai-summary-section'),
    containsAiSummaryContent: titleHtml.includes('Podsumowanie Wykonawcze')
  });
  
  return titleHtml;
};


// Generate Section 2: Production Comparison (Month-over-Month or Year-over-Year) - CHART VERSION
const generateYoYSection = (reportData: ReportData) => {
  logger.info('🔍 COMPARISON SECTION: Starting generation', {
    hasYoyComparison: !!reportData.yoyComparison
  });
  
  if (!reportData.yoyComparison) {
    logger.info('🔍 COMPARISON SECTION: No comparison data available - this is expected for periods without historical data');
    return '';
  }
  
  const { meta, google } = reportData.yoyComparison;
  
  // ✅ PRODUCTION-READY: Only show if we have meaningful comparison data
  const hasMetaData = meta.current.spend > 0 || meta.previous.spend > 0;
  const hasGoogleData = google.current.spend > 0 || google.previous.spend > 0;
  
  if (!hasMetaData && !hasGoogleData) {
    logger.info('🔍 COMPARISON SECTION: No meaningful data to compare');
    return '';
  }
  
  logger.info('🔍 COMPARISON SECTION: Generating content with production data', {
    hasMetaData,
    hasGoogleData,
    metaCurrentSpend: meta.current.spend,
    metaPreviousSpend: meta.previous.spend
  });
  
  // Build metrics array for chart
  const metrics = [
    {
      label: 'Wydatki',
      metaCurrent: meta.current.spend,
      metaPrevious: meta.previous.spend,
      metaChange: meta.changes.spend,
      googleCurrent: google.current.spend,
      googlePrevious: google.previous.spend,
      googleChange: google.changes.spend,
      format: (v: number) => formatCurrency(v)
    },
    {
      label: 'Wartość rezerwacji',
      metaCurrent: meta.current.reservationValue,
      metaPrevious: meta.previous.reservationValue,
      metaChange: meta.changes.reservationValue,
      googleCurrent: google.current.reservationValue,
      googlePrevious: google.previous.reservationValue,
      googleChange: google.changes.reservationValue,
      format: (v: number) => formatCurrency(v)
    }
  ];
  
  // MUI X Charts inspired dimensions
  const width = 800;
  const height = 680;
  const padding = { top: 40, right: 140, bottom: 80, left: 200 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  const barHeight = 36;
  const barGap = 12;
  const platformGap = 80;
  const metricSectionGap = 100;
  
  // Extract years from date range
  const currentYear = new Date(reportData.dateRange.end).getFullYear();
  const previousYear = currentYear - 1;
  
  return `
    <div class="section-container">
      <div class="page-content">
        <h2 class="section-title">Porównanie Okresów</h2>
        <p style="font-size: 12px; color: #6B7280; margin-bottom: 24px; margin-top: -8px;">${currentYear} vs ${previousYear}</p>
        
        <svg width="${width}" height="${height}" style="background: #FAFAFA; border-radius: 6px;">
          <!-- Define gradients for depth (MUI X style) -->
          <defs>
            <linearGradient id="metaGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:#2563EB;stop-opacity:0.9" />
              <stop offset="100%" style="stop-color:#3B82F6;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="metaLightGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:#93C5FD;stop-opacity:0.7" />
              <stop offset="100%" style="stop-color:#BFDBFE;stop-opacity:0.9" />
            </linearGradient>
            <linearGradient id="googleGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:#F97316;stop-opacity:0.9" />
              <stop offset="100%" style="stop-color:#FB923C;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="googleLightGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:#FDBA74;stop-opacity:0.7" />
              <stop offset="100%" style="stop-color:#FED7AA;stop-opacity:0.9" />
            </linearGradient>
          </defs>
          
          ${metrics.map((metric, metricIndex) => {
            // Calculate positions for each metric section
            const singlePlatformHeight = (barHeight * 2) + barGap;
            const sectionHeight = (singlePlatformHeight * 2) + platformGap + metricSectionGap;
            const yStart = padding.top + (metricIndex * sectionHeight);
            
            // Find max value across ALL data for consistent scaling
            const allValues = [
              metric.metaCurrent, metric.metaPrevious,
              metric.googleCurrent, metric.googlePrevious
            ].filter(v => v > 0);
            const maxValue = Math.max(...allValues);
            
            // Calculate bar widths
            const metaCurrentWidth = maxValue > 0 ? (metric.metaCurrent / maxValue) * (chartWidth * 0.85) : 0;
            const metaPreviousWidth = maxValue > 0 ? (metric.metaPrevious / maxValue) * (chartWidth * 0.85) : 0;
            const googleCurrentWidth = maxValue > 0 ? (metric.googleCurrent / maxValue) * (chartWidth * 0.85) : 0;
            const googlePreviousWidth = maxValue > 0 ? (metric.googlePrevious / maxValue) * (chartWidth * 0.85) : 0;
            
            const metaY1 = yStart;
            const metaY2 = metaY1 + barHeight + barGap;
            const googleY1 = metaY2 + barHeight + platformGap;
            const googleY2 = googleY1 + barHeight + barGap;
            
            return `
              <!-- Section: ${metric.label} -->
              
              <!-- Metric Title -->
              <text x="${padding.left - 15}" y="${yStart - 8}" text-anchor="end" font-size="14" font-weight="700" fill="#1F2937" font-family="Roboto, Arial, sans-serif">${metric.label}</text>
              
              <!-- Y-axis line -->
              <line x1="${padding.left - 8}" y1="${metaY1 - 5}" x2="${padding.left - 8}" y2="${googleY2 + barHeight + 5}" stroke="#E5E7EB" stroke-width="2"/>
              
              <!-- META ADS -->
              <text x="${padding.left - 15}" y="${metaY1 + 22}" text-anchor="end" font-size="12" font-weight="600" fill="#2563EB" font-family="Roboto, Arial, sans-serif">Meta Ads</text>
              
              <!-- Current Period Bar (Meta) -->
              <rect x="${padding.left}" y="${metaY1}" width="${metaCurrentWidth}" height="${barHeight}" fill="url(#metaGradient)" rx="3"/>
              <text x="${padding.left + metaCurrentWidth + 8}" y="${metaY1 + 23}" font-size="13" font-weight="700" fill="#1F2937" font-family="Roboto, Arial, sans-serif">${metric.format(metric.metaCurrent)}</text>
              <text x="${padding.left + metaCurrentWidth + 8}" y="${metaY1 + 11}" font-size="9" font-weight="500" fill="#6B7280" font-family="Roboto, Arial, sans-serif">${currentYear}</text>
              
              <!-- Previous Period Bar (Meta) -->
              <rect x="${padding.left}" y="${metaY2}" width="${metaPreviousWidth}" height="${barHeight}" fill="url(#metaLightGradient)" rx="3"/>
              <text x="${padding.left + metaPreviousWidth + 8}" y="${metaY2 + 23}" font-size="12" font-weight="600" fill="#6B7280" font-family="Roboto, Arial, sans-serif">${metric.format(metric.metaPrevious)}</text>
              <text x="${padding.left + metaPreviousWidth + 8}" y="${metaY2 + 11}" font-size="9" font-weight="500" fill="#9CA3AF" font-family="Roboto, Arial, sans-serif">${previousYear}</text>
              
              <!-- Change Indicator (Meta) -->
              ${metric.metaPrevious > 0 && metric.metaChange !== -999 ? `
                <text x="${width - padding.right + 10}" y="${metaY1 + 21}" text-anchor="start" font-size="13" font-weight="700" fill="${metric.metaChange >= 0 ? '#10B981' : '#EF4444'}" font-family="Roboto, Arial, sans-serif">
                  ${metric.metaChange >= 0 ? '↗' : '↘'} ${Math.abs(metric.metaChange).toFixed(1)}%
                </text>
              ` : ''}
              
              <!-- GOOGLE ADS -->
              <text x="${padding.left - 15}" y="${googleY1 + 22}" text-anchor="end" font-size="12" font-weight="600" fill="#F97316" font-family="Roboto, Arial, sans-serif">Google Ads</text>
              
              <!-- Current Period Bar (Google) -->
              <rect x="${padding.left}" y="${googleY1}" width="${googleCurrentWidth}" height="${barHeight}" fill="url(#googleGradient)" rx="3"/>
              <text x="${padding.left + googleCurrentWidth + 8}" y="${googleY1 + 23}" font-size="13" font-weight="700" fill="#1F2937" font-family="Roboto, Arial, sans-serif">${metric.format(metric.googleCurrent)}</text>
              <text x="${padding.left + googleCurrentWidth + 8}" y="${googleY1 + 11}" font-size="9" font-weight="500" fill="#6B7280" font-family="Roboto, Arial, sans-serif">${currentYear}</text>
              
              <!-- Previous Period Bar (Google) -->
              <rect x="${padding.left}" y="${googleY2}" width="${googlePreviousWidth}" height="${barHeight}" fill="url(#googleLightGradient)" rx="3"/>
              <text x="${padding.left + googlePreviousWidth + 8}" y="${googleY2 + 23}" font-size="12" font-weight="600" fill="#6B7280" font-family="Roboto, Arial, sans-serif">${metric.format(metric.googlePrevious)}</text>
              <text x="${padding.left + googlePreviousWidth + 8}" y="${googleY2 + 11}" font-size="9" font-weight="500" fill="#9CA3AF" font-family="Roboto, Arial, sans-serif">${previousYear}</text>
              
              <!-- Change Indicator (Google) -->
              ${metric.googlePrevious > 0 && metric.googleChange !== -999 ? `
                <text x="${width - padding.right + 10}" y="${googleY1 + 21}" text-anchor="start" font-size="13" font-weight="700" fill="${metric.googleChange >= 0 ? '#10B981' : '#EF4444'}" font-family="Roboto, Arial, sans-serif">
                  ${metric.googleChange >= 0 ? '↗' : '↘'} ${Math.abs(metric.googleChange).toFixed(1)}%
                </text>
              ` : ''}
            `;
          }).join('')}
          
          <!-- Legend (MUI X style) -->
          <g transform="translate(${padding.left}, ${height - 35})">
            <rect x="0" y="0" width="12" height="12" fill="#2563EB" rx="2" opacity="0.9"/>
            <text x="18" y="10" font-size="11" fill="#4B5563" font-weight="500" font-family="Roboto, Arial, sans-serif">${currentYear}</text>
            
            <rect x="100" y="0" width="12" height="12" fill="#93C5FD" rx="2" opacity="0.8"/>
            <text x="118" y="10" font-size="11" fill="#6B7280" font-weight="500" font-family="Roboto, Arial, sans-serif">${previousYear}</text>
          </g>
        </svg>
      </div>
    </div>
  `;
};

// Generate Section 3: Meta Ads Comprehensive Metrics - Clean KPI Card Style
const generateMetaMetricsSection = (reportData: ReportData) => {
  if (!reportData.metaData) return '';
  
  const { metrics } = reportData.metaData;
  const metaYoYData = reportData.yoyComparison?.meta;
  
  // Helper function to check if a metric has meaningful data
  const hasData = (value: number | undefined | null) => value !== null && value !== undefined && value > 0;
  
  // Helper to get change delta for a metric
  const getMetricChange = (metricKey: string) => {
    if (!metaYoYData || !metaYoYData.changes) return null;
    
    const changeMap: { [key: string]: number } = {
      'totalSpend': metaYoYData.changes?.spend || 0,
      'totalImpressions': metaYoYData.changes?.impressions || 0,
      'totalClicks': metaYoYData.changes?.clicks || 0,
      'totalConversions': metaYoYData.changes?.reservations || 0,
      'totalReservations': metaYoYData.changes?.reservations || 0,
    };
    
    return changeMap[metricKey] || null;
  };
  
  // Helper to render a clean metric card
  const renderMetricCard = (label: string, value: string, change: number | null = null) => {
    let changeHTML = '';
    if (change !== null && Math.abs(change) >= 0.01) {
      const isPositive = change >= 0;
      changeHTML = `
        <div class="kpi-delta ${isPositive ? 'positive' : 'negative'}">
          ${isPositive ? '+' : '−'}${Math.abs(change).toFixed(1)}% <span style="color: #94A3B8; font-weight: 400;">vs poprzedni</span>
        </div>
      `;
    }
    
    return `
      <div class="kpi-card">
        <div class="kpi-label">${label}</div>
        <div class="kpi-value">${value}</div>
        ${changeHTML}
      </div>
    `;
  };
  
  // Calculate CTR and CPC
  const ctr = metrics.totalImpressions > 0 ? (metrics.totalClicks / metrics.totalImpressions) * 100 : 0;
  const cpc = metrics.totalClicks > 0 ? metrics.totalSpend / metrics.totalClicks : 0;
  
  // Calculate offline potential
        const potentialOfflineReservations = Math.round((metrics.emailContacts + metrics.phoneContacts) * 0.2);
        const averageReservationValue = metrics.totalReservations > 0 ? metrics.totalReservationValue / metrics.totalReservations : 0;
        const potentialOfflineValue = averageReservationValue * potentialOfflineReservations;
        const totalPotentialValue = potentialOfflineValue + metrics.totalReservationValue;
  
    return `
      <div class="section-container">
        <div class="page-content">
        <h2 class="section-title">Meta Ads</h2>
        <p style="font-size: 13px; color: #64748B; margin-bottom: 24px; margin-top: -4px;">Kluczowe wskaźniki efektywności kampanii</p>
        
        <!-- Basic Metrics Grid (2x3) -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px;">
          ${renderMetricCard('Wydatki', formatCurrency(metrics.totalSpend), getMetricChange('totalSpend'))}
          ${renderMetricCard('Wyświetlenia', formatNumber(metrics.totalImpressions), getMetricChange('totalImpressions'))}
          ${renderMetricCard('Kliknięcia', formatNumber(metrics.totalClicks), getMetricChange('totalClicks'))}
          ${renderMetricCard('CTR', `${ctr.toFixed(2)}%`, null)}
          ${renderMetricCard('CPC', formatCurrency(cpc), null)}
          ${renderMetricCard('Konwersje', formatNumber(metrics.totalConversions), getMetricChange('totalConversions'))}
      </div>
        
        <!-- Contact & Conversions Section -->
        <h3 style="font-size: 16px; font-weight: 600; color: #0F172A; margin-bottom: 4px; margin-top: 32px;">Kontakt & Konwersje</h3>
        <p style="font-size: 12px; color: #64748B; margin-bottom: 16px;">Metryki kontaktu i zakończonych konwersji</p>
        
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px;">
          ${renderMetricCard('E-mail', formatNumber(metrics.emailContacts), null)}
          ${renderMetricCard('Telefon', formatNumber(metrics.phoneContacts), null)}
          ${renderMetricCard('Rezerwacje', formatNumber(metrics.totalReservations), getMetricChange('totalReservations'))}
          ${renderMetricCard('Wartość rezerwacji', formatCurrency(metrics.totalReservationValue), null)}
    </div>
        
        ${metrics.roas && metrics.roas > 0 ? `
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px;">
            ${renderMetricCard('ROAS', `${metrics.roas.toFixed(2)}x`, null)}
          </div>
        ` : ''}
        
        <!-- Potential Offline Metrics - Summary Box -->
        ${(metrics.emailContacts > 0 || metrics.phoneContacts > 0) && potentialOfflineReservations > 0 ? `
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 20px; margin-bottom: 32px;">
            <h3 style="font-size: 13px; font-weight: 500; color: #0F172A; margin-bottom: 16px;">Potencjalne Metryki Offline</h3>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; font-size: 12px;">
              <div>
                <div style="font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;">Rezerwacje offline</div>
                <div style="font-size: 18px; font-weight: 600; color: #0F172A;">${formatNumber(potentialOfflineReservations)}</div>
              </div>
              <div>
                <div style="font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;">Wartość offline</div>
                <div style="font-size: 18px; font-weight: 600; color: #0F172A;">${formatCurrency(potentialOfflineValue)}</div>
              </div>
              <div>
                <div style="font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;">Łączna wartość</div>
                <div style="font-size: 18px; font-weight: 600; color: #0F172A;">${formatCurrency(totalPotentialValue)}</div>
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
};

// Generate Conversion Funnel HTML - EXACT copy from ConversionFunnel.tsx
const generateConversionFunnelHTML = (funnelData: any, platform: string = 'Meta') => {
  const { booking_step_1, booking_step_2, booking_step_3, reservations, reservation_value, roas } = funnelData;

  // Create funnel path function - EXACT copy from ConversionFunnel.tsx
  const createFunnelPath = (index: number) => {
    const baseWidth = 600;
    const taperRatio = 0.15;
    const stepWidth = baseWidth - (index * baseWidth * taperRatio);
    const nextStepWidth = baseWidth - ((index + 1) * baseWidth * taperRatio);
    const leftOffset = (baseWidth - stepWidth) / 2;
    const rightOffset = baseWidth - leftOffset;
    const nextLeftOffset = (baseWidth - nextStepWidth) / 2;
    const nextRightOffset = baseWidth - nextLeftOffset;
    return `polygon(${leftOffset}px 0%, ${rightOffset}px 0%, ${nextRightOffset}px 100%, ${nextLeftOffset}px 100%)`;
  };

  // Clean, flat navy/blue-grey color scheme - subtle progression
  const funnelSteps = [
    {
      label: "Krok 1 w BE",
      value: booking_step_1,
      percentage: 100,
      bgColor: "background: #1E293B" // Darkest - top of funnel
    },
    {
      label: "Krok 2 w BE", 
      value: booking_step_2,
      percentage: booking_step_1 > 0 ? Math.round((booking_step_2 / booking_step_1) * 100) : 0,
      bgColor: "background: #334155" // Dark mid-tone
    },
    {
      label: "Krok 3 w BE",
      value: booking_step_3,
      percentage: booking_step_1 > 0 ? Math.round((booking_step_3 / booking_step_1) * 100) : 0,
      bgColor: "background: #475569" // Light mid-tone
    },
    {
      label: "Ilość rezerwacji",
      value: reservations,
      percentage: booking_step_1 > 0 ? Math.round((reservations / booking_step_1) * 100) : 0,
      bgColor: "background: #64748B" // Lightest - bottom of funnel
    }
  ];

  const bottomCards = [
    {
      label: "Wartość rezerwacji",
      value: reservation_value,
      isROAS: false
    },
    {
      label: "ROAS",
      value: roas,
      isROAS: true
    }
  ];

  const funnelStepsHTML = funnelSteps.map((step, index) => `
    <div style="
      position: relative;
      ${step.bgColor};
      text-align: center;
      clip-path: ${createFunnelPath(index)};
      width: 600px;
      height: 90px;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="display: flex; align-items: center; justify-content: center; padding: 0 32px;">
        <div style="text-align: center; position: relative; min-width: 0; flex: 1;">
          <div style="font-size: 24px; font-weight: 600; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px;">
            ${formatNumber(step.value)}
        </div>
          <div style="font-size: 11px; color: rgba(255, 255, 255, 0.8); text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${step.label}
                </div>
              </div>
            </div>
    </div>
  `).join('');

  const bottomCardsHTML = bottomCards.map(card => `
    <div style="
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      padding: 20px;
      text-align: center;
    ">
      <div style="font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; color: #64748B; margin-bottom: 12px;">
        ${card.label}
            </div>
      <div style="font-size: 24px; font-weight: 600; color: #0F172A; font-variant-numeric: tabular-nums;">
        ${card.isROAS ? `${card.value.toFixed(2)}x` : formatCurrency(card.value)}
      </div>
    </div>
  `).join('');
          
          return `
      <div style="text-align: center; margin-bottom: 40px;">
        <h3 style="color: #0F172A; font-size: 20px; font-weight: 600; margin: 0 0 4px 0;">Ścieżka Konwersji ${platform}</h3>
        <p style="color: #64748B; font-size: 13px; margin: 0;">System rezerwacji online</p>
                </div>
      
      <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 0 40px;">
        ${funnelStepsHTML}
        
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 40px; width: 100%; max-width: 480px;">
          ${bottomCardsHTML}
        </div>
            </div>
          `;
};

// Generate Premium Footer Section
const generateFooter = (reportData: ReportData) => {
  return `
    <div class="footer-section">
      <div class="footer-divider"></div>
      <div class="footer-content">
        <div class="client-name-footer">${reportData.clientName}</div>
        <div class="footer-date">${formatDate(new Date().toISOString())}</div>
      </div>
    </div>
  `;
};

// Generate remaining sections...

// Generate Section 4: Meta Ads Funnel
const generateMetaFunnelSection = (reportData: ReportData) => {
  if (!reportData.metaData) return '';
  
  // Check if funnel has meaningful data
  const funnel = reportData.metaData.funnel;
  if (!funnel || (funnel.booking_step_1 === 0 && funnel.reservations === 0)) return '';
  
  return `
    <div class="section-container">
      <div class="funnel-section">
        <h2 class="section-title">Meta Ads - Ścieżka Konwersji</h2>
        ${generateConversionFunnelHTML(reportData.metaData.funnel, 'Meta Ads')}
                </div>
              </div>
  `;
};

// Generate Section 5: Google Ads Comprehensive Metrics - Clean KPI Card Style
const generateGoogleMetricsSection = (reportData: ReportData) => {
  logger.info('🔍 GENERATE GOOGLE METRICS SECTION CALLED:', {
    hasGoogleData: !!reportData.googleData,
    googleDataKeys: reportData.googleData ? Object.keys(reportData.googleData) : [],
    reportDataKeys: Object.keys(reportData)
  });
  
  if (!reportData.googleData) {
    logger.warn('⚠️ No Google Ads data available for metrics section');
    return '';
  }
  
  const { metrics } = reportData.googleData;
  const googleYoYData = reportData.yoyComparison?.google;

  // Helper function to check if a metric has meaningful data
  const hasData = (value: number | undefined | null) => value !== null && value !== undefined && value > 0;
  
  // Helper to get change delta for a metric
  const getMetricChange = (metricKey: string) => {
    if (!googleYoYData || !googleYoYData.changes) return null;
    
    const changeMap: { [key: string]: number } = {
      'totalSpend': googleYoYData.changes?.spend || 0,
      'totalImpressions': googleYoYData.changes?.impressions || 0,
      'totalClicks': googleYoYData.changes?.clicks || 0,
      'totalConversions': googleYoYData.changes?.reservations || 0,
      'totalReservations': googleYoYData.changes?.reservations || 0,
    };
    
    return changeMap[metricKey] || null;
  };
  
  // Helper to render a clean metric card
  const renderMetricCard = (label: string, value: string, change: number | null = null) => {
    let changeHTML = '';
    if (change !== null && Math.abs(change) >= 0.01) {
          const isPositive = change >= 0;
      changeHTML = `
        <div class="kpi-delta ${isPositive ? 'positive' : 'negative'}">
          ${isPositive ? '+' : '−'}${Math.abs(change).toFixed(1)}% <span style="color: #94A3B8; font-weight: 400;">vs poprzedni</span>
        </div>
      `;
      }
      
      return `
      <div class="kpi-card">
        <div class="kpi-label">${label}</div>
        <div class="kpi-value">${value}</div>
        ${changeHTML}
      </div>
    `;
  };
  
  // Calculate CTR and CPC
  const ctr = metrics.totalImpressions > 0 ? (metrics.totalClicks / metrics.totalImpressions) * 100 : 0;
  const cpc = metrics.totalClicks > 0 ? metrics.totalSpend / metrics.totalClicks : 0;
  
  // Calculate offline potential
  const potentialOfflineReservations = Math.round((metrics.emailContacts + metrics.phoneContacts) * 0.2);
  const averageReservationValue = metrics.totalReservations > 0 ? metrics.totalReservationValue / metrics.totalReservations : 0;
  const potentialOfflineValue = averageReservationValue * potentialOfflineReservations;
  const totalPotentialValue = potentialOfflineValue + metrics.totalReservationValue;
  
  return `
    <div class="section-container">
      <div class="page-content">
        <h2 class="section-title">Google Ads</h2>
        <p style="font-size: 13px; color: #64748B; margin-bottom: 24px; margin-top: -4px;">Kluczowe wskaźniki efektywności kampanii</p>
        
        <!-- Basic Metrics Grid (2x3) -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px;">
          ${renderMetricCard('Wydatki', formatCurrency(metrics.totalSpend), getMetricChange('totalSpend'))}
          ${renderMetricCard('Wyświetlenia', formatNumber(metrics.totalImpressions), getMetricChange('totalImpressions'))}
          ${renderMetricCard('Kliknięcia', formatNumber(metrics.totalClicks), getMetricChange('totalClicks'))}
          ${renderMetricCard('CTR', `${ctr.toFixed(2)}%`, null)}
          ${renderMetricCard('CPC', formatCurrency(cpc), null)}
          ${renderMetricCard('Konwersje', formatNumber(metrics.totalConversions), getMetricChange('totalConversions'))}
        </div>
        
        <!-- Contact & Conversions Section -->
        <h3 style="font-size: 16px; font-weight: 600; color: #0F172A; margin-bottom: 4px; margin-top: 32px;">Kontakt & Konwersje</h3>
        <p style="font-size: 12px; color: #64748B; margin-bottom: 16px;">Metryki kontaktu i zakończonych konwersji</p>
        
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px;">
          ${renderMetricCard('E-mail', formatNumber(metrics.emailContacts), null)}
          ${renderMetricCard('Telefon', formatNumber(metrics.phoneContacts), null)}
          ${renderMetricCard('Rezerwacje', formatNumber(metrics.totalReservations), getMetricChange('totalReservations'))}
          ${renderMetricCard('Wartość rezerwacji', formatCurrency(metrics.totalReservationValue), null)}
        </div>
        
        ${metrics.roas && metrics.roas > 0 ? `
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px;">
            ${renderMetricCard('ROAS', `${metrics.roas.toFixed(2)}x`, null)}
          </div>
        ` : ''}
        
        <!-- Potential Offline Metrics - Summary Box -->
        ${(metrics.emailContacts > 0 || metrics.phoneContacts > 0) && potentialOfflineReservations > 0 ? `
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 20px; margin-bottom: 32px;">
            <h3 style="font-size: 13px; font-weight: 500; color: #0F172A; margin-bottom: 16px;">Potencjalne Metryki Offline</h3>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; font-size: 12px;">
              <div>
                <div style="font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;">Rezerwacje offline</div>
                <div style="font-size: 18px; font-weight: 600; color: #0F172A;">${formatNumber(potentialOfflineReservations)}</div>
              </div>
              <div>
                <div style="font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;">Wartość offline</div>
                <div style="font-size: 18px; font-weight: 600; color: #0F172A;">${formatCurrency(potentialOfflineValue)}</div>
              </div>
              <div>
                <div style="font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;">Łączna wartość</div>
                <div style="font-size: 18px; font-weight: 600; color: #0F172A;">${formatCurrency(totalPotentialValue)}</div>
              </div>
            </div>
          </div>
        ` : ''}
        </div>
      </div>
    `;
};

// Generate Section 6: Google Ads Funnel
const generateGoogleFunnelSection = (reportData: ReportData) => {
  if (!reportData.googleData) return '';
  
  // Check if funnel has meaningful data
  const funnel = reportData.googleData.funnel;
  if (!funnel || (funnel.booking_step_1 === 0 && funnel.reservations === 0)) return '';
  
  return `
    <div class="section-container">
      <div class="funnel-section">
        <h2 class="section-title">Google Ads - Ścieżka Konwersji</h2>
        ${generateConversionFunnelHTML(reportData.googleData.funnel, 'Google Ads')}
      </div>
    </div>
  `;
};

// Generate demographic pie charts HTML - matching UI exactly
const generateDemographicChartsHTML = (demographicData: any[]) => {
  logger.info('🎨 PDF DEMOGRAPHIC CHARTS GENERATION:', {
    hasDemographicData: !!demographicData,
    demographicDataLength: demographicData?.length || 0,
    demographicDataType: typeof demographicData,
    demographicDataSample: demographicData?.slice(0, 1) || [],
    hasAge: demographicData?.[0]?.age,
    hasGender: demographicData?.[0]?.gender,
    hasSpend: demographicData?.[0]?.spend,
    spendType: typeof demographicData?.[0]?.spend,  // Will be 'string' from Meta API!
    clicksType: typeof demographicData?.[0]?.clicks  // Will be 'string' from Meta API!
  });
  
  if (!demographicData || demographicData.length === 0) {
    logger.warn('⚠️ No demographic data available for charts');
    return `
      <div class="demographics-section">
        <h4 class="demographics-title">Analiza Demograficzna</h4>
        <div class="no-data">
          <div class="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
            <div class="text-center">
              <div class="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
                </svg>
              </div>
              <p class="text-sm font-medium text-gray-900 mb-1">Brak danych demograficznych</p>
              <p class="text-xs text-gray-500">Meta API nie zwróciło danych o demografii</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  // Add validation for data structure
  // 🔧 CRITICAL FIX: Meta API returns strings, not numbers - need to parse!
  const validData = demographicData.filter(item => {
    if (!item || typeof item !== 'object') return false;
    if (!item.age && !item.gender) return false;
    
    // Parse spend (can be string or number)
    const spend = typeof item.spend === 'string' ? parseFloat(item.spend) : (item.spend || 0);
    if (spend <= 0) return false;
    
    // Check if at least one displayable metric exists
    const clicks = typeof item.clicks === 'string' ? parseInt(item.clicks) : (item.clicks || 0);
    const reservationValue = typeof item.reservation_value === 'string' ? parseFloat(item.reservation_value) : (item.reservation_value || 0);
    const impressions = typeof item.impressions === 'string' ? parseInt(item.impressions) : (item.impressions || 0);
    
    return clicks > 0 || reservationValue > 0 || impressions > 0;
  });
  
  logger.info('🔍 VALID DEMOGRAPHIC DATA:', {
    originalLength: demographicData.length,
    validLength: validData.length,
    validDataSample: validData.slice(0, 2),
    hasReservationValue: validData.some(item => item.reservation_value > 0),
    hasClicks: validData.some(item => item.clicks > 0)
  });
  
  if (validData.length === 0) {
    logger.warn('⚠️ No valid demographic data after filtering');
    return `
      <div class="demographics-section">
        <h4 class="demographics-title">Analiza Demograficzna</h4>
        <div class="no-data">
          <div class="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
            <div class="text-center">
              <div class="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
                </svg>
              </div>
              <p class="text-sm font-medium text-gray-900 mb-1">Brak danych demograficznych</p>
              <p class="text-xs text-gray-500">Meta API nie zwróciło danych o demografii</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Generate charts for both Spend and Clicks metrics (matching MetaAdsTables.tsx UI default)
  const generateChartsForMetric = (metric: 'spend' | 'clicks') => {
    // Process gender data for the specific metric
  const genderMap = new Map();
    validData.forEach(item => {
    let gender = item.gender || 'Nieznane';
    // Ensure gender labels are in Polish (handle both English and Polish input)
    if (gender.toLowerCase() === 'female' || gender.toLowerCase() === 'kobieta') gender = 'Kobiety';
    else if (gender.toLowerCase() === 'male' || gender.toLowerCase() === 'mężczyzna') gender = 'Mężczyźni';
    else if (gender.toLowerCase() === 'unknown' || gender.toLowerCase() === 'nieznane') gender = 'Nieznane';
      
      // 🔧 CRITICAL FIX: Parse strings to numbers (Meta API returns strings!)
      const rawValue = item[metric];
      const value = metric === 'spend' 
        ? (typeof rawValue === 'string' ? parseFloat(rawValue) : (rawValue || 0)) 
        : (typeof rawValue === 'string' ? parseInt(rawValue) : (rawValue || 0));
      
      genderMap.set(gender, (genderMap.get(gender) || 0) + value);
  });

    // Process age data for the specific metric
  const ageMap = new Map();
    validData.forEach(item => {
    let age = item.age || 'Nieznane';
    // Ensure age labels are in Polish
    if (age.toLowerCase() === 'unknown' || age.toLowerCase() === 'nieznane') age = 'Nieznane';
      
      // 🔧 CRITICAL FIX: Parse strings to numbers (Meta API returns strings!)
      const rawValue = item[metric];
      const value = metric === 'spend' 
        ? (typeof rawValue === 'string' ? parseFloat(rawValue) : (rawValue || 0)) 
        : (typeof rawValue === 'string' ? parseInt(rawValue) : (rawValue || 0));
      
      ageMap.set(age, (ageMap.get(age) || 0) + value);
  });

  const genderEntries = Array.from(genderMap.entries()).sort((a, b) => b[1] - a[1]);
  const ageEntries = Array.from(ageMap.entries()).sort((a, b) => b[1] - a[1]);

    const genderTotal = genderEntries.reduce((sum, [, value]) => sum + value, 0);
    const ageTotal = ageEntries.reduce((sum, [, value]) => sum + value, 0);

    const metricLabel = metric === 'spend' ? 'Wydatki' : 'Kliknięcia';
    const formatValue = metric === 'spend' 
      ? (val: number | null | undefined) => formatCurrency(val || 0)
      : (val: number | null | undefined) => formatNumber(val || 0);

              return `
      <div class="metric-section">
        <h4 class="metric-title">${metricLabel}</h4>
        <div class="demographics-grid">
          ${generatePieChart(genderEntries, genderColors, genderTotal, 'Podział według Płci', formatValue)}
          ${generatePieChart(ageEntries, ageColors, ageTotal, 'Podział według Grup Wiekowych', formatValue)}
                  </div>
                </div>
              `;
  };

  // Generate pie chart using CSS (simplified version of Chart.js pie charts)
  const generatePieChart = (entries: any[], colors: string[], total: number, title: string, valueFormatter = formatNumber) => {
    let cumulativePercentage = 0;
    const segments = entries.map(([label, value], index) => {
      const percentage = total > 0 ? (value / total) * 100 : 0;
      const startAngle = cumulativePercentage * 3.6; // Convert percentage to degrees
      const endAngle = (cumulativePercentage + percentage) * 3.6;
      cumulativePercentage += percentage;
      
      return {
        label,
        value,
        percentage: percentage.toFixed(1),
        color: colors[index] || '#94a3b8',
        startAngle,
        endAngle
      };
    });

    return `
        <div class="demographic-chart">
        <h5>${title}</h5>
        <div class="pie-chart-container">
          <div class="pie-chart">
            <svg width="200" height="200" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="80" fill="transparent" stroke="#e5e7eb" stroke-width="2"/>
              ${segments.map((segment, index) => {
                const x1 = 100 + 80 * Math.cos((segment.startAngle - 90) * Math.PI / 180);
                const y1 = 100 + 80 * Math.sin((segment.startAngle - 90) * Math.PI / 180);
                const x2 = 100 + 80 * Math.cos((segment.endAngle - 90) * Math.PI / 180);
                const y2 = 100 + 80 * Math.sin((segment.endAngle - 90) * Math.PI / 180);
                const largeArcFlag = segment.endAngle - segment.startAngle > 180 ? 1 : 0;
                
              return `
                  <path d="M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArcFlag} 1 ${x2} ${y2} Z" 
                        fill="${segment.color}" 
                        stroke="white" 
                        stroke-width="2"/>
                `;
              }).join('')}
            </svg>
                  </div>
          <div class="pie-legend">
            ${segments.map(segment => `
              <div class="legend-item">
                <div class="legend-color" style="background-color: ${segment.color};"></div>
                <div class="legend-info">
                  <span class="legend-label">${segment.label}</span>
                  <div class="legend-stats">
                    <span class="legend-value">${valueFormatter(segment.value)}</span>
                    <span class="legend-percentage">${segment.percentage}%</span>
                  </div>
                </div>
          </div>
            `).join('')}
        </div>
      </div>
      </div>
    `;
  };

  // Color schemes matching UI components
  const genderColors = ['#8B5CF6', '#3B82F6', '#6B7280']; // Purple, Blue, Gray
  const ageColors = ['#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444', '#6B7280', '#F97316']; // Orange, Green, Blue, Purple, Red, Gray, Orange

  // 🔧 FIX: Use 'spend' instead of 'reservation_value' to match UI default
  // UI component in MetaAdsTables.tsx defaults to 'spend' metric
  return `
    <div class="demographics-section">
      <h4 class="demographics-title">Analiza Demograficzna</h4>
      
      ${generateChartsForMetric('spend')}
      ${generateChartsForMetric('clicks')}
    </div>
  `;
};

// Generate Section 7: Meta Ads Campaign Details
const generateMetaCampaignDetailsSection = (reportData: ReportData) => {
  if (!reportData.metaData) return '';
  
  const { campaigns, tables } = reportData.metaData;
  // Show campaigns with spend data
  const campaignsWithSpend = campaigns.filter(campaign => (campaign.spend || 0) > 0);
  
  // Don't generate section if no campaigns with spend
  if (campaignsWithSpend.length === 0) return '';
  
  // Sort by spend (descending) and take top 5 for premium display
  const sortedCampaigns = [...campaignsWithSpend].sort((a, b) => (b.spend || 0) - (a.spend || 0));
  const topCampaigns = sortedCampaigns.slice(0, 5);
  const remainingCount = sortedCampaigns.length - 5;
  
  // Calculate totals for remaining campaigns
  const remainingTotals = remainingCount > 0 ? sortedCampaigns.slice(5).reduce((acc, campaign) => ({
    spend: acc.spend + (campaign.spend || 0),
    impressions: acc.impressions + (campaign.impressions || 0),
    clicks: acc.clicks + (campaign.clicks || 0),
    reservations: acc.reservations + (campaign.reservations || 0),
    reservation_value: acc.reservation_value + (campaign.reservation_value || 0),
  }), { spend: 0, impressions: 0, clicks: 0, reservations: 0, reservation_value: 0 }) : null;
  
  return `
    <div class="campaign-details-section" style="padding: 0 2mm;">
      <h2 class="section-title">Meta Ads - Szczegóły Kampanii</h2>
        
        <!-- Top 5 Campaigns Table (Premium Agency Style) -->
        <div class="campaigns-table">
          <h3 class="table-title">Top 5 Kampanii wg Wydatków ${remainingCount > 0 ? `<span style="font-size: 11px; font-weight: 400; color: #6B7280;">(+${remainingCount} więcej)</span>` : ''}</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Nazwa kampanii</th>
                <th>Wydatki</th>
                <th>Wyświetlenia</th>
                <th>Kliknięcia</th>
                <th>Ilość Rezerwacji</th>
                <th>Wartość Rezerwacji</th>
                <th>ROAS</th>
              </tr>
            </thead>
            <tbody>
              ${topCampaigns.map(campaign => `
                <tr>
                  <td class="campaign-name">${campaign.campaign_name || 'Nieznana kampania'}</td>
                  <td class="number">${formatCurrency(campaign.spend || 0)}</td>
                  <td class="number">${formatNumber(campaign.impressions || 0)}</td>
                  <td class="number">${formatNumber(campaign.clicks || 0)}</td>
                  <td class="number">${formatNumber(campaign.reservations || 0)}</td>
                  <td class="number">${formatCurrency(campaign.reservation_value || 0)}</td>
                  <td class="number">${(campaign.roas || 0).toFixed(2)}x</td>
                </tr>
              `).join('')}
              ${remainingTotals ? `
                <tr style="background: #F9FAFB; border-top: 2px solid #E5E7EB;">
                  <td class="campaign-name" style="font-style: italic; color: #6B7280;">Pozostałe ${remainingCount} kampanii</td>
                  <td class="number" style="font-weight: 600;">${formatCurrency(remainingTotals.spend)}</td>
                  <td class="number">${formatNumber(remainingTotals.impressions)}</td>
                  <td class="number">${formatNumber(remainingTotals.clicks)}</td>
                  <td class="number">${formatNumber(remainingTotals.reservations)}</td>
                  <td class="number">${formatCurrency(remainingTotals.reservation_value)}</td>
                  <td class="number">${remainingTotals.spend > 0 ? (remainingTotals.reservation_value / remainingTotals.spend).toFixed(2) : '0.00'}x</td>
                </tr>
              ` : ''}
            </tbody>
          </table>
        </div>
        
        <!-- Only show additional sections if campaigns exist -->
        ${campaignsWithSpend.length > 0 ? `
        <!-- Demographics -->
          ${(() => {
            logger.info('🔍 DEMOGRAPHIC DATA AUDIT:', {
              hasDemographicPerformance: !!tables.demographicPerformance,
              demographicDataLength: tables.demographicPerformance?.length || 0,
              demographicDataSample: tables.demographicPerformance?.slice(0, 2) || [],
              tablesKeys: Object.keys(tables || {}),
              fullTablesData: tables
            });
            return generateDemographicChartsHTML(tables.demographicPerformance);
          })()}
        
        <!-- Placement Performance -->
        ${tables.placementPerformance && tables.placementPerformance.length > 0 ? `
          <div class="placement-table">
            <h3 class="table-title">Wydajność Miejsc Docelowych</h3>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Miejsce docelowe</th>
                  <th>Wydatki</th>
                  <th>Wyświetlenia</th>
                  <th>Kliknięcia</th>
                </tr>
              </thead>
              <tbody>
                ${tables.placementPerformance.slice(0, 10).map(placement => `
                  <tr>
                    <td>${placement.placement || 'Nieznane'}</td>
                    <td class="number">${formatCurrency(placement.spend || 0)}</td>
                    <td class="number">${formatNumber(placement.impressions || 0)}</td>
                    <td class="number">${formatNumber(placement.clicks || 0)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
        
        <!-- Ad Relevance Results -->
        ${tables.adRelevanceResults && tables.adRelevanceResults.length > 0 ? `
          <div class="ad-relevance-table">
            <h3 class="table-title">Trafność Reklam i Wyniki</h3>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Nazwa Reklamy</th>
                  <th>Wydatki</th>
                  <th>Wyświetlenia</th>
                  <th>Kliknięcia</th>
                  <th>CPC</th>
                  <th>Ilość Rezerwacji</th>
                  <th>Wartość Rezerwacji</th>
                </tr>
              </thead>
              <tbody>
                ${tables.adRelevanceResults.slice(0, 10).map(ad => `
                  <tr>
                    <td class="campaign-name">${ad.ad_name || 'Nieznana reklama'}</td>
                    <td class="number">${formatCurrency(ad.spend || 0)}</td>
                    <td class="number">${formatNumber(ad.impressions || 0)}</td>
                    <td class="number">${formatNumber(ad.clicks || 0)}</td>
                    <td class="number">${ad.cpc ? formatCurrency(ad.cpc) : 'N/A'}</td>
                    <td class="number">${formatNumber(ad.reservations || 0)}</td>
                    <td class="number">${formatCurrency(ad.reservation_value || 0)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
        ` : ''}
      </div>
    </div>
  `;
};

// Generate Section 8: Google Ads Campaign Details
const generateGoogleCampaignDetailsSection = (reportData: ReportData) => {
  if (!reportData.googleData) return '';
  
  const { campaigns, tables } = reportData.googleData;
  // Show campaigns with spend data
  const campaignsWithSpend = campaigns.filter(campaign => (campaign.spend || 0) > 0);
  
  // Don't generate section if no campaigns with spend
  if (campaignsWithSpend.length === 0) return '';
  
  // Sort by spend (descending) and take top 5 for premium display
  const sortedCampaigns = [...campaignsWithSpend].sort((a, b) => (b.spend || 0) - (a.spend || 0));
  const topCampaigns = sortedCampaigns.slice(0, 5);
  const remainingCount = sortedCampaigns.length - 5;
  
  // Calculate totals for remaining campaigns
  const remainingTotals = remainingCount > 0 ? sortedCampaigns.slice(5).reduce((acc, campaign) => ({
    spend: acc.spend + (campaign.spend || 0),
    impressions: acc.impressions + (campaign.impressions || 0),
    clicks: acc.clicks + (campaign.clicks || 0),
    reservations: acc.reservations + (campaign.reservations || 0),
    reservation_value: acc.reservation_value + (campaign.reservation_value || 0),
  }), { spend: 0, impressions: 0, clicks: 0, reservations: 0, reservation_value: 0 }) : null;
  
  return `
    <div class="campaign-details-section" style="padding: 0 2mm;">
      <h2 class="section-title">Google Ads - Szczegóły Kampanii</h2>
        
        <!-- Top 5 Campaigns Table (Premium Agency Style) -->
        <div class="campaigns-table">
          <h3 class="table-title">Top 5 Kampanii wg Wydatków ${remainingCount > 0 ? `<span style="font-size: 11px; font-weight: 400; color: #6B7280;">(+${remainingCount} więcej)</span>` : ''}</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Nazwa kampanii</th>
                <th>Wydatki</th>
                <th>Wyświetlenia</th>
                <th>Kliknięcia</th>
                <th>Ilość Rezerwacji</th>
                <th>Wartość Rezerwacji</th>
                <th>ROAS</th>
              </tr>
            </thead>
            <tbody>
              ${topCampaigns.map(campaign => `
                <tr>
                  <td class="campaign-name">${campaign.campaign_name || 'Nieznana kampania'}</td>
                  <td class="number">${formatCurrency(campaign.spend || 0)}</td>
                  <td class="number">${formatNumber(campaign.impressions || 0)}</td>
                  <td class="number">${formatNumber(campaign.clicks || 0)}</td>
                  <td class="number">${formatNumber(campaign.reservations || 0)}</td>
                  <td class="number">${formatCurrency(campaign.reservation_value || 0)}</td>
                  <td class="number">${(campaign.roas || 0).toFixed(2)}x</td>
                </tr>
              `).join('')}
              ${remainingTotals ? `
                <tr style="background: #F9FAFB; border-top: 2px solid #E5E7EB;">
                  <td class="campaign-name" style="font-style: italic; color: #6B7280;">Pozostałe ${remainingCount} kampanii</td>
                  <td class="number" style="font-weight: 600;">${formatCurrency(remainingTotals.spend)}</td>
                  <td class="number">${formatNumber(remainingTotals.impressions)}</td>
                  <td class="number">${formatNumber(remainingTotals.clicks)}</td>
                  <td class="number">${formatNumber(remainingTotals.reservations)}</td>
                  <td class="number">${formatCurrency(remainingTotals.reservation_value)}</td>
                  <td class="number">${remainingTotals.spend > 0 ? (remainingTotals.reservation_value / remainingTotals.spend).toFixed(2) : '0.00'}x</td>
                </tr>
              ` : ''}
            </tbody>
          </table>
        </div>
        
        <!-- Only show additional sections if campaigns exist -->
        ${campaignsWithSpend.length > 0 ? `
        <!-- Network Performance -->
        ${tables.networkPerformance && tables.networkPerformance.length > 0 ? `
          <div class="network-table">
            <h3 class="table-title">Wydajność Sieci Reklamowych</h3>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Sieć</th>
                  <th>Wydatki</th>
                  <th>Wyświetlenia</th>
                  <th>Kliknięcia</th>
                </tr>
              </thead>
              <tbody>
                ${tables.networkPerformance.slice(0, 10).map(network => `
                  <tr>
                    <td>${network.network || 'Nieznana sieć'}</td>
                    <td class="number">${formatCurrency(network.spend || 0)}</td>
                    <td class="number">${formatNumber(network.impressions || 0)}</td>
                    <td class="number">${formatNumber(network.clicks || 0)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}
        ` : ''}
        
        <!-- Device Performance -->
        ${tables.devicePerformance && tables.devicePerformance.length > 0 ? `
          <div class="device-table">
            <h3 class="table-title">Wydajność Urządzeń</h3>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Urządzenie</th>
                  <th>Wydatki</th>
                  <th>Wyświetlenia</th>
                  <th>Kliknięcia</th>
                </tr>
              </thead>
              <tbody>
                ${tables.devicePerformance.slice(0, 10).map(device => `
                  <tr>
                    <td>${device.device || 'Nieznane urządzenie'}</td>
                    <td class="number">${formatCurrency(device.spend || 0)}</td>
                    <td class="number">${formatNumber(device.impressions || 0)}</td>
                    <td class="number">${formatNumber(device.clicks || 0)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
      </div>
    </div>
  `;
};

// Generate SVG Line Chart for Trends (Premium Style)
const generateTrendLineChart = (
  data: { label: string; metaValue: number; googleValue: number }[],
  title: string,
  metric: string
) => {
  const width = 600;
  const height = 250;
  const padding = { top: 40, right: 120, bottom: 40, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  // Find max value for scaling
  const allValues = data.flatMap(d => [d.metaValue, d.googleValue]);
  const maxValue = Math.max(...allValues);
  const yScale = (value: number) => chartHeight - (value / maxValue) * chartHeight;
  const xScale = (index: number) => (index / (data.length - 1)) * chartWidth;
  
  // Generate path for Meta Ads
  const metaPath = data.map((d, i) => {
    const x = padding.left + xScale(i);
    const y = padding.top + yScale(d.metaValue);
    return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
  }).join(' ');
  
  // Generate path for Google Ads
  const googlePath = data.map((d, i) => {
    const x = padding.left + xScale(i);
    const y = padding.top + yScale(d.googleValue);
    return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
  }).join(' ');
  
  // Generate grid lines
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(ratio => {
    const y = padding.top + chartHeight * (1 - ratio);
    return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="rgba(0,0,0,0.05)" stroke-width="1"/>`;
  }).join('');
  
  return `
    <div style="margin: 32px 0; page-break-inside: avoid;">
      <h3 style="font-size: 18px; font-weight: 600; color: #1F2937; margin-bottom: 8px;">${title}</h3>
      <p style="font-size: 12px; color: #6B7280; margin-bottom: 16px;">${metric} w okresie sprawozdawczym</p>
      <svg width="${width}" height="${height}" style="background: white; border-radius: 8px; border: 1px solid rgba(0,0,0,0.08);">
        ${gridLines}
        
        <!-- Meta Ads Line -->
        <path d="${metaPath}" fill="none" stroke="#1877F2" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        
        <!-- Google Ads Line -->
        <path d="${googlePath}" fill="none" stroke="#34A853" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        
        <!-- Data points -->
        ${data.map((d, i) => {
          const x = padding.left + xScale(i);
          const metaY = padding.top + yScale(d.metaValue);
          const googleY = padding.top + yScale(d.googleValue);
          return `
            <circle cx="${x}" cy="${metaY}" r="4" fill="#1877F2" stroke="white" stroke-width="2"/>
            <circle cx="${x}" cy="${googleY}" r="4" fill="#34A853" stroke="white" stroke-width="2"/>
          `;
        }).join('')}
        
        <!-- X-axis labels -->
        ${data.map((d, i) => {
          if (i % Math.ceil(data.length / 6) === 0) {
            const x = padding.left + xScale(i);
            return `<text x="${x}" y="${height - 15}" text-anchor="middle" font-size="11" fill="#6B7280">${d.label}</text>`;
          }
          return '';
        }).join('')}
        
        <!-- Y-axis labels -->
        ${[0, 0.5, 1].map(ratio => {
          const y = padding.top + chartHeight * (1 - ratio);
          const value = (maxValue * ratio).toFixed(0);
          return `<text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#6B7280">${formatNumber(parseInt(value))}</text>`;
        }).join('')}
        
        <!-- Legend -->
        <g transform="translate(${width - padding.right + 20}, ${padding.top})">
          <rect x="0" y="0" width="12" height="12" fill="#1877F2" rx="2"/>
          <text x="18" y="10" font-size="12" fill="#1F2937">Meta Ads</text>
          
          <rect x="0" y="25" width="12" height="12" fill="#34A853" rx="2"/>
          <text x="18" y="35" font-size="12" fill="#1F2937">Google Ads</text>
        </g>
      </svg>
    </div>
  `;
};

// Generate SVG Bar Chart for Meta vs Google Comparison (Premium Style)
const generateComparisonBarChart = (reportData: ReportData) => {
  const metaData = reportData.metaData;
  const googleData = reportData.googleData;
  
  if (!metaData && !googleData) return '';
  
  const metrics = [
    {
      label: 'Wydatki',
      meta: metaData?.metrics?.totalSpend || 0,
      google: googleData?.metrics?.totalSpend || 0,
      format: (v: number) => `${formatNumber(v)} zł`
    },
    {
      label: 'Kliknięcia',
      meta: metaData?.metrics?.totalClicks || 0,
      google: googleData?.metrics?.totalClicks || 0,
      format: (v: number) => formatNumber(v)
    },
    {
      label: 'Konwersje',
      meta: metaData?.metrics?.totalConversions || 0,
      google: googleData?.metrics?.totalConversions || 0,
      format: (v: number) => formatNumber(v)
    },
    {
      label: 'ROAS',
      meta: metaData?.metrics?.roas || 0,
      google: googleData?.metrics?.roas || 0,
      format: (v: number) => v.toFixed(2)
    }
  ];
  
  const width = 600;
  const height = 320;
  const padding = { top: 40, right: 40, bottom: 60, left: 100 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  const barHeight = chartHeight / metrics.length / 2.5;
  const groupGap = barHeight * 2.5;
  
  return `
    <div style="margin: 32px 0; page-break-inside: avoid;">
      <h3 style="font-size: 18px; font-weight: 600; color: #1F2937; margin-bottom: 8px;">Porównanie Wydajności Platform</h3>
      <p style="font-size: 12px; color: #6B7280; margin-bottom: 16px;">Meta Ads vs Google Ads - kluczowe metryki</p>
      <svg width="${width}" height="${height}" style="background: white; border-radius: 8px; border: 1px solid rgba(0,0,0,0.08);">
        ${metrics.map((metric, i) => {
          const maxValue = Math.max(metric.meta, metric.google);
          const metaWidth = maxValue > 0 ? (metric.meta / maxValue) * chartWidth * 0.85 : 0;
          const googleWidth = maxValue > 0 ? (metric.google / maxValue) * chartWidth * 0.85 : 0;
          
          const yBase = padding.top + i * groupGap;
          
          return `
            <!-- Metric Label -->
            <text x="${padding.left - 10}" y="${yBase + barHeight + 5}" text-anchor="end" font-size="13" font-weight="600" fill="#1F2937">${metric.label}</text>
            
            <!-- Meta Bar -->
            <rect x="${padding.left}" y="${yBase}" width="${metaWidth}" height="${barHeight}" fill="#1877F2" rx="4"/>
            <text x="${padding.left + metaWidth + 8}" y="${yBase + barHeight - 3}" font-size="11" font-weight="600" fill="#1F2937">${metric.format(metric.meta)}</text>
            
            <!-- Google Bar -->
            <rect x="${padding.left}" y="${yBase + barHeight + 8}" width="${googleWidth}" height="${barHeight}" fill="#34A853" rx="4"/>
            <text x="${padding.left + googleWidth + 8}" y="${yBase + barHeight * 2 + 5}" font-size="11" font-weight="600" fill="#1F2937">${metric.format(metric.google)}</text>
          `;
        }).join('')}
        
        <!-- Legend -->
        <g transform="translate(${padding.left}, ${height - 35})">
          <rect x="0" y="0" width="12" height="12" fill="#1877F2" rx="2"/>
          <text x="18" y="10" font-size="12" fill="#1F2937">Meta Ads</text>
          
          <rect x="100" y="0" width="12" height="12" fill="#34A853" rx="2"/>
          <text x="118" y="10" font-size="12" fill="#1F2937">Google Ads</text>
        </g>
      </svg>
    </div>
  `;
};

// Generate Premium KPI Scoreboard - Executive Summary
const generateKPIScoreboard = (reportData: ReportData) => {
  const metaData = reportData.metaData;
  const googleData = reportData.googleData;
  const yoyComparison = reportData.yoyComparison;
  
  // Calculate combined totals
  const totalSpend = (metaData?.stats?.totalSpend || 0) + (googleData?.stats?.totalSpend || 0);
  const totalConversions = (metaData?.stats?.totalConversions || 0) + (googleData?.stats?.totalConversions || 0);
  const totalRevenue = (metaData?.conversionMetrics?.reservation_value || 0) + (googleData?.conversionMetrics?.reservation_value || 0);
  const totalClicks = (metaData?.stats?.totalClicks || 0) + (googleData?.stats?.totalClicks || 0);
  const totalImpressions = (metaData?.stats?.totalImpressions || 0) + (googleData?.stats?.totalImpressions || 0);
  
  const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  
  // Calculate deltas from YoY comparison
  const getDelta = (current: number, previous: number) => {
    if (previous === 0) return null;
    return ((current - previous) / previous) * 100;
  };
  
  const spendDelta = yoyComparison ? getDelta(
    (yoyComparison.meta?.current?.spend || 0) + (yoyComparison.google?.current?.spend || 0),
    (yoyComparison.meta?.previous?.spend || 0) + (yoyComparison.google?.previous?.spend || 0)
  ) : null;
  
  const conversionsDelta = yoyComparison ? getDelta(
    (yoyComparison.meta?.current?.conversions || 0) + (yoyComparison.google?.current?.conversions || 0),
    (yoyComparison.meta?.previous?.conversions || 0) + (yoyComparison.google?.previous?.conversions || 0)
  ) : null;
  
  const renderKPICard = (label: string, value: string, delta: number | null) => {
    let deltaHTML = '';
    if (delta !== null && !isNaN(delta)) {
      const deltaClass = delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral';
      const deltaSymbol = delta > 0 ? '↗' : delta < 0 ? '↘' : '→';
      deltaHTML = `<div class="kpi-delta ${deltaClass}">${deltaSymbol} ${Math.abs(delta).toFixed(1)}%</div>`;
    }
    
    return `
      <div class="kpi-card">
        <div class="kpi-label">${label}</div>
        <div class="kpi-value">${value}</div>
        ${deltaHTML}
      </div>
    `;
  };
  
  return `
    <div class="section-container">
      <div class="page-content">
        <h2 class="section-title">Podsumowanie Wykonawcze</h2>
        <div class="kpi-scoreboard">
          ${renderKPICard('Wydatki', `${formatNumber(totalSpend)} zł`, spendDelta)}
          ${renderKPICard('ROAS', roas.toFixed(2), null)}
          ${renderKPICard('Konwersje', formatNumber(totalConversions), conversionsDelta)}
          ${renderKPICard('CTR', `${ctr.toFixed(2)}%`, null)}
          ${renderKPICard('CPC', `${cpc.toFixed(2)} zł`, null)}
          ${renderKPICard('Przychód', `${formatNumber(totalRevenue)} zł`, null)}
        </div>
      </div>
    </div>
  `;
};

// Generate Insights & Recommendations Section
const generateInsightsSection = (reportData: ReportData) => {
  const metaData = reportData.metaData;
  const googleData = reportData.googleData;
  
  // Generate agency-style insights based on data
  const insights = [];
  
  // Performance insights
  if (metaData && googleData) {
    const metaSpend = metaData.stats?.totalSpend || 0;
    const googleSpend = googleData.stats?.totalSpend || 0;
    const totalSpend = metaSpend + googleSpend;
    
    if (metaSpend > googleSpend * 1.5) {
      insights.push('<strong>Dominacja Meta Ads:</strong> Meta Ads stanowi większość wydatków reklamowych. Rozważ dywersyfikację budżetu dla zrównoważonej strategii wielokanałowej.');
    }
  }
  
  // ROAS analysis
  if (metaData) {
    const metaRoas = metaData.conversionMetrics?.reservation_value && metaData.stats?.totalSpend 
      ? metaData.conversionMetrics.reservation_value / metaData.stats.totalSpend 
      : 0;
    
    if (metaRoas > 3) {
      insights.push('<strong>Wysoki ROAS Meta Ads:</strong> Kampanie Meta Ads wykazują silny zwrot z inwestycji (ROAS > 3.0). Rozważ zwiększenie budżetu na najskuteczniejsze kampanie.');
    } else if (metaRoas < 1.5) {
      insights.push('<strong>Możliwość optymalizacji:</strong> ROAS Meta Ads poniżej 1.5. Zalecana analiza targetowania, kreacji reklamowych i stawek CPC.');
    }
  }
  
  // CTR insights
  if (metaData && metaData.stats) {
    const ctr = metaData.stats.totalImpressions > 0 
      ? (metaData.stats.totalClicks / metaData.stats.totalImpressions) * 100 
      : 0;
    
    if (ctr < 1) {
      insights.push('<strong>Niska skuteczność kreacji:</strong> CTR poniżej 1% sugeruje potrzebę odświeżenia materiałów reklamowych i testów A/B różnych wariantów.');
    }
  }
  
  // Add general recommendations
  insights.push('<strong>Rekomendacje na następny okres:</strong> Kontynuuj monitorowanie kluczowych metryk, przeprowadź testy A/B nowych kreacji oraz rozważ wdrożenie kampanii remarketingowych dla zwiększenia konwersji.');
  
  if (insights.length === 0) {
    insights.push('Brak wystarczających danych do wygenerowania szczegółowych insightów. Kontynuuj zbieranie danych kampanii.');
  }
  
  return `
    <div class="section-container">
      <div class="page-content">
        <div class="insights-section">
          <h2 class="insights-title">Kluczowe Wnioski i Rekomendacje</h2>
          <div class="insights-content">
            <ul class="insights-list">
              ${insights.map(insight => `<li>${insight}</li>`).join('')}
            </ul>
          </div>
        </div>
      </div>
    </div>
  `;
};

// Main PDF HTML generator with new 8-section structure
function generatePDFHTML(reportData: ReportData): string {
  // Sanitize data to prevent HTML injection and ensure valid content
  const sanitizedData = {
    ...reportData,
    clientName: reportData.clientName?.replace(/[<>]/g, '') || 'Unknown Client',
    aiSummary: reportData.aiSummary?.replace(/[<>]/g, '') || undefined
  };

  // Helper function to conditionally wrap content with page break
  const generateConditionalSection = (content: string) => {
    if (!content || content.trim() === '') {
      logger.info('🔍 CONDITIONAL SECTION: Empty content, skipping page break');
      return '';
    }
    logger.info('🔍 CONDITIONAL SECTION: Content found, adding page break');
    return `<div style="page-break-before: always;">${content}</div>`;
  };

  return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Raport Kampanii Reklamowych</title>
        <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline'; img-src 'self' data: https:;">
        <meta name="robots" content="noindex, nofollow">
        <style>
            /* Premium Agency-Grade Design System */
            :root {
                /* Premium Color Palette */
                --text-primary: #1F2937;
                --text-secondary: #6B7280;
                --text-tertiary: #9CA3AF;
                --border-light: rgba(0,0,0,0.08);
                --border-medium: rgba(0,0,0,0.12);
                --bg-white: #FFFFFF;
                --bg-subtle: #F9FAFB;
                --bg-muted: #F4F6F8;
                
                /* KPI Colors - Subtle & Professional */
                --kpi-up: #059669;
                --kpi-down: #DC2626;
                --kpi-neutral: #6B7280;
                
                /* Platform Colors */
                --meta-blue: #1877F2;
                --google-green: #34A853;
                
                /* Editorial Typography Scale */
                --font-h1: 34px;
                --font-h2: 26px;
                --font-h3: 18px;
                --font-body: 14px;
                --font-body-large: 16px;
                --font-small: 12px;
                --font-tiny: 11px;
                --font-kpi-value: 32px;
                --font-kpi-label: 11px;
                
                /* Grid & Spacing System (8pt base) */
                --space-xs: 4px;
                --space-sm: 8px;
                --space-md: 16px;
                --space-lg: 24px;
                --space-xl: 32px;
                --space-xxl: 48px;
                --space-xxxl: 64px;
                
                /* Consistent Margins */
                --page-margin: 20mm;
                --section-gap: 40px;
            }
            
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'Helvetica', sans-serif;
                line-height: 1.6;
                color: var(--text-primary);
                background: var(--bg-white);
                font-size: var(--font-body);
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
            }
            
            /* A4 Page Layout - Strict Grid System */
            .title-page {
                padding: var(--page-margin);
                max-width: 210mm;
                min-height: 297mm;
            }
            
            .page-break-before {
                page-break-before: always;
                padding: var(--page-margin);
                max-width: 210mm;
                min-height: 297mm;
                margin: 0 auto;
            }
            
            .section-container {
                padding: var(--space-xl) 0;
                max-width: 210mm;
                margin: 0 auto;
            }
            
            .section-container:first-child {
                padding-top: 0;
            }
            
            .page-content {
                max-width: 100%;
                margin: 0 auto;
                width: 100%;
            }
            
            /* Editorial Typography Hierarchy */
            .h1 {
                font-size: var(--font-h1);
                line-height: 1.2;
                font-weight: 700;
                color: var(--text-primary);
                margin-bottom: var(--space-xl);
                letter-spacing: -0.02em;
            }
            
            .h2, .section-title {
                font-size: 20px;
                line-height: 1.3;
                font-weight: 600;
                color: #0F172A;
                margin-bottom: 8px;
                margin-top: 32px;
            }
            
            .h3 {
                font-size: var(--font-h3);
                line-height: 1.4;
                font-weight: 600;
                color: var(--text-primary);
                margin-bottom: var(--space-md);
                margin-top: var(--space-lg);
            }
            
            .body-text {
                font-size: var(--font-body);
                line-height: 1.6;
                font-weight: 400;
                color: var(--text-secondary);
            }
            
            .body-text-large {
                font-size: var(--font-body-large);
                line-height: 1.7;
                font-weight: 400;
                color: var(--text-secondary);
            }
            
            /* Clean KPI Scoreboard - Analytics Product Style */
            .kpi-scoreboard {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 16px;
                margin: 24px 0 32px 0;
                page-break-inside: avoid;
            }
            
            .kpi-card {
                background: #FFFFFF;
                border: 1px solid #E2E8F0;
                border-radius: 6px;
                padding: 20px;
            }
            
            .kpi-label {
                font-size: 10px;
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                color: #64748B;
                margin-bottom: 12px;
            }
            
            .kpi-value {
                font-size: 24px;
                font-weight: 600;
                color: #0F172A;
                margin-bottom: 4px;
                font-variant-numeric: tabular-nums;
            }
            
            .kpi-delta {
                font-size: 11px;
                font-weight: 500;
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-variant-numeric: tabular-nums;
            }
            
            .kpi-delta.positive {
                color: #16A34A;
            }
            
            .kpi-delta.negative {
                color: #DC2626;
            }
            
            .kpi-delta.neutral {
                color: #94A3B8;
            }
            
            /* Clean Cover Page */
            .clean-title-section {
                text-align: center;
                padding: 0;
            }
            
            .clean-logo-container {
                margin-bottom: var(--space-xl);
                display: flex;
                justify-content: center;
                align-items: center;
            }
            
            .clean-client-logo {
                max-height: 80px;
                max-width: 200px;
                height: auto;
                width: auto;
                object-fit: contain;
                display: block;
            }
            
            .clean-title-header {
                margin-bottom: var(--space-xl);
            }
            
            .clean-main-title {
                font-size: var(--font-h1);
                line-height: 36px;
                font-weight: 600;
                color: var(--color-primary-navy);
                margin-bottom: var(--space-md);
                letter-spacing: -0.025em;
            }
            
            .clean-company-name {
                font-size: var(--font-h2);
                font-weight: 500;
                color: var(--gray-700);
                margin-bottom: var(--space-lg);
            }
            
            .clean-date-range {
                font-size: var(--font-body);
                color: var(--gray-500);
                margin-bottom: var(--space-sm);
            }
            
            .clean-generation-date {
                font-size: var(--font-label);
                color: var(--gray-500);
            }
            
            .clean-ai-summary-section {
                margin-top: var(--space-xl);
                padding: var(--space-xl) 0;
                border-top: 2px solid var(--color-primary-navy);
                text-align: left;
            }
            
            .clean-summary-title {
                font-size: var(--font-h2);
                font-weight: 600;
                color: var(--color-primary-navy);
                margin-bottom: var(--space-lg);
            }
            
            .clean-summary-content {
                font-size: var(--font-body);
                line-height: 1.6;
                color: var(--gray-700);
            }
            
            
            /* YoY Section - Premium Comparison Styling */
            .yoy-section {
                padding: 0;
            }
            
            .comparison-table-container {
                margin-top: 40px;
            }
            
            .comparison-table thead th {
                background: #F9FAFB;
                color: #6B7280;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                padding: 12px 16px;
            }
            
            /* Premium Table Design - Agency Grade */
            .data-table, .comparison-table, .metrics-table {
                width: 100%;
                border-collapse: collapse;
                background: var(--bg-white);
                margin: var(--space-lg) 0;
                border: 1px solid var(--border-light);
                border-radius: 4px;
                overflow: hidden;
            }
            
            .data-table th, .comparison-table th, .metrics-table th {
                background: var(--bg-muted);
                color: var(--text-primary);
                padding: 12px var(--space-md);
                text-align: left;
                font-weight: 600;
                font-size: var(--font-small);
                text-transform: uppercase;
                letter-spacing: 0.05em;
                border-bottom: 1px solid var(--border-light);
            }
            
            .data-table td, .comparison-table td, .metrics-table td {
                padding: 14px var(--space-md);
                font-size: var(--font-body);
                border-bottom: 1px solid var(--border-light);
                color: var(--text-secondary);
            }
            
            .data-table tr:last-child td,
            .comparison-table tr:last-child td,
            .metrics-table tr:last-child td {
                border-bottom: none;
            }
            
            .data-table tr:hover, 
            .comparison-table tr:hover, 
            .metrics-table tr:hover {
                background: var(--bg-subtle);
            }
            
            /* Table cell alignment by type */
            .data-table th:first-child,
            .data-table td:first-child {
                text-align: left;
                font-weight: 600;
                color: var(--text-primary);
            }
            
            .data-table th:not(:first-child),
            .data-table td:not(:first-child) {
                text-align: right;
                font-variant-numeric: tabular-nums;
            }
            
            .platform-section-header {
                border-top: 2px solid var(--border-light);
            }
            
            .platform-header {
                color: rgba(255,255,255,0.6) !important;
                font-weight: 700;
                font-size: 11px;
                text-align: center;
                padding: 16px 20px;
                text-transform: uppercase;
                letter-spacing: 0.1em;
            }
            
            .meta-header {
                background: #2563EB !important;
            }
            
            .google-header {
                background: #10B981 !important;
            }
            
            .metric-name {
                font-weight: 600;
                color: var(--gray-900);
                text-align: left;
            }
            
            .current-value, .previous-value, .metric-value {
                font-weight: 600;
                color: var(--gray-900);
                text-align: right;
                font-variant-numeric: tabular-nums;
            }
            
            .change-cell {
                text-align: center;
            }
            
            .change-indicator {
                font-size: var(--font-body);
                font-weight: 700;
                padding: var(--space-xs) var(--space-sm);
                border-radius: 4px;
                display: inline-block;
            }
            
            .positive {
                color: #10B981;
            }
            
            .negative {
                color: #EF4444;
            }
            
            /* Polish Number Formatting */
            .currency::after {
                content: " zł";
                font-weight: 400;
                color: var(--gray-500);
            }
            
            .no-data {
                color: var(--gray-500);
                font-style: italic;
                text-align: center;
            }
            
            /* Metrics Section */
            .metrics-section {
                padding: 0;
            }
            
            .metrics-table-container {
                margin-top: 40px;
            }
            
            .metrics-table {
                width: 100%;
                border-collapse: collapse;
                background: white;
                border: 1px solid #e2e8f0;
            }
            
            .metrics-table th {
                background: #1e293b;
                color: white;
                padding: 16px 20px;
                text-align: left;
                font-weight: 600;
                font-size: 14px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }
            
            .metrics-table td {
                padding: 16px 20px;
                border-bottom: 1px solid #e2e8f0;
                font-size: 14px;
            }
            
            .metrics-table .metric-name {
                font-weight: 600;
                color: #1e293b;
            }
            
            .metrics-table .metric-value {
                font-weight: 700;
                color: #1e293b;
                text-align: right;
                font-variant-numeric: tabular-nums;
            }
            
            /* Funnel Section */
            .funnel-section {
                padding: 0;
            }
            
            /* Campaign Details Section */
            .campaign-details-section {
                padding: 0;
                margin: 0;
                page-break-inside: avoid;
                break-inside: avoid;
            }
            
            .campaigns-table {
                margin: 0;
                padding: 0;
                width: 100%;
                overflow-x: auto;
            }
            
            .table-title {
                font-size: 18px;
                font-weight: 700;
                color: #1e293b;
                margin-bottom: 16px;
                text-align: center;
            }
            
            .data-table {
                width: 100%;
                border-collapse: collapse;
                margin: 0;
                background: white;
                border: 1px solid #e2e8f0;
                font-size: 10px;
                table-layout: fixed;
            }
            
            .data-table th {
                background: #1e293b;
                color: white;
                padding: 8px 4px;
                text-align: center;
                font-weight: 600;
                font-size: 9px;
                text-transform: uppercase;
                letter-spacing: 0.02em;
                border-right: 1px solid #334155;
                word-wrap: break-word;
            }
            
            .data-table th:first-child {
                width: 25%;
                text-align: left;
            }
            
            .data-table th:not(:first-child) {
                width: 9.375%;
            }
            
            .data-table td {
                padding: 6px 4px;
                border-bottom: 1px solid #e2e8f0;
                border-right: 1px solid #e2e8f0;
                font-size: 9px;
                text-align: center;
                word-wrap: break-word;
                overflow: hidden;
            }
            
            .data-table tr:nth-child(even) {
                background: #f8fafc;
            }
            
            .campaign-name {
                font-weight: 600;
                color: #1e293b;
                text-align: left !important;
                padding-left: 8px !important;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-size: 9px;
            }
            
            .number {
                text-align: right !important;
                font-variant-numeric: tabular-nums;
                color: #475569;
                font-weight: 500;
                padding-right: 6px !important;
            }
            
            /* Demographics & Charts - Clean Professional Style */
            .demographics-section {
                margin: var(--space-xxl) 0;
                padding: var(--space-xl) 0;
                border-top: 1px solid var(--border-light);
            }
            
            .demographics-title {
                font-size: var(--font-h2);
                font-weight: 700;
                color: var(--text-primary);
                margin-bottom: var(--space-lg);
                text-align: center;
            }
            
            .metric-section {
                margin-bottom: var(--space-xxl);
                padding: var(--space-lg) 0;
                border-bottom: 1px solid var(--border-light);
            }
            
            .metric-section:last-child {
                border-bottom: none;
            }
            
            .metric-title {
                font-size: var(--font-h3);
                font-weight: 600;
                color: var(--text-primary);
                margin-bottom: var(--space-lg);
                text-align: center;
                background: var(--bg-subtle);
                padding: var(--space-md) var(--space-lg);
                border-radius: 4px;
                border: 1px solid var(--border-light);
            }
            
            .demographics-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: var(--space-xl);
            }
            
            .demographic-chart {
                text-align: center;
            }
            
            .demographic-chart h5 {
                font-size: var(--font-body-large);
                font-weight: 600;
                color: var(--text-primary);
                margin-bottom: var(--space-md);
                text-align: center;
            }
            
            .pie-chart-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: var(--space-md);
            }
            
            .pie-chart {
                display: flex;
                justify-content: center;
            }
            
            .pie-chart svg {
                max-width: 200px;
                height: auto;
            }
            
            .pie-legend {
                display: flex;
                flex-direction: column;
                gap: var(--space-sm);
                min-width: 200px;
            }
            
            .legend-item {
                display: flex;
                align-items: center;
                gap: var(--space-sm);
                padding: var(--space-xs) 0;
            }
            
            .legend-color {
                width: 12px;
                height: 12px;
                border-radius: 2px;
                flex-shrink: 0;
            }
            
            .legend-info {
                display: flex;
                justify-content: space-between;
                align-items: center;
                width: 100%;
                font-size: var(--font-tiny);
            }
            
            .legend-label {
                font-weight: 600;
                color: var(--text-primary);
                text-transform: capitalize;
            }
            
            .legend-stats {
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 2px;
            }
            
            .legend-value {
                font-weight: 600;
                color: var(--text-secondary);
                font-size: var(--font-tiny);
            }
            
            .legend-percentage {
                font-weight: 700;
                color: var(--text-primary);
                font-size: var(--font-tiny);
            }
            
            .no-data {
                text-align: center;
                color: var(--text-tertiary);
                font-style: italic;
                padding: var(--space-xl);
                font-size: var(--font-body);
            }
            
            /* Insights & Recommendations Section - Agency Analysis */
            .insights-section {
                margin-top: var(--space-xxxl);
                padding: var(--space-xxl);
                background: var(--bg-subtle);
                border-left: 4px solid var(--text-primary);
                border-radius: 4px;
                page-break-inside: avoid;
            }
            
            .insights-title {
                font-size: var(--font-h2);
                font-weight: 700;
                color: var(--text-primary);
                margin-bottom: var(--space-lg);
            }
            
            .insights-content {
                font-size: var(--font-body-large);
                line-height: 1.7;
                color: var(--text-secondary);
            }
            
            .insights-list {
                margin: var(--space-md) 0;
                padding-left: var(--space-lg);
            }
            
            .insights-list li {
                margin-bottom: var(--space-md);
                line-height: 1.7;
            }
            
            .insights-list li strong {
                color: var(--text-primary);
                font-weight: 600;
            }
            
            .insight-category {
                font-size: var(--font-h3);
                font-weight: 600;
                color: var(--text-primary);
                margin-top: var(--space-lg);
                margin-bottom: var(--space-md);
            }
            
            /* Premium Footer */
            .footer-section {
                margin-top: var(--space-xxxl);
                padding: var(--space-lg) 0;
                border-top: 2px solid var(--border-light);
                page-break-inside: avoid;
                break-inside: avoid;
            }
            
            .footer-divider {
                width: 100%;
                height: 2px;
                background: var(--color-primary-navy);
                margin-bottom: 24px;
            }
            
            .footer-content {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .client-name-footer {
                font-size: 18px;
                font-weight: 600;
                color: var(--color-primary-navy);
                letter-spacing: -0.025em;
            }
            
            .footer-date {
                font-size: 12px;
                color: var(--gray-500);
                font-weight: 400;
            }
        </style>
    </head>
    <body>
        ${generateTitleSection(sanitizedData)}
        ${generateConditionalSection(generateYoYSection(sanitizedData))}
        ${generateConditionalSection(generateMetaMetricsSection(sanitizedData))}
        ${generateConditionalSection(generateMetaFunnelSection(sanitizedData))}
        ${generateConditionalSection(generateGoogleMetricsSection(sanitizedData))}
        ${generateConditionalSection(generateGoogleFunnelSection(sanitizedData))}
        ${generateMetaCampaignDetailsSection(sanitizedData)}
        ${generateGoogleCampaignDetailsSection(sanitizedData)}
        ${generateFooter(sanitizedData)}
        </body>
    </html>
  `;
}

// Generate mock data for preview mode
function generateMockReportData(clientId: string, dateRange: { start: string; end: string }): ReportData {
  return {
    clientId,
    clientName: 'Belmonte Hotel',
    clientLogo: 'https://placehold.co/200x80/667eea/white?text=BH',
    dateRange,
    aiSummary: `W analizowanym okresie kampanie reklamowe wykazały znaczący wzrost efektywności. ROAS osiągnął poziom 4.2, co oznacza, że każda złotówka zainwestowana w reklamy przyniosła 4.20 zł przychodu. 

Kluczowe obserwacje:
• Wydatki wzrosły o 15.3%, osiągając 12,450 zł
• Liczba konwersji wzrosła o 22.1%, osiągając 145 rezerwacji
• CTR uległ poprawie do 2.34%, co wskazuje na skuteczne targetowanie
• CPC spadł o 8.2%, świadcząc o lepszej jakości kampanii

Kampanie Meta Ads wygenerowały większość ruchu, z silnym ROAS na poziomie 4.5. Google Ads wspierał dotarcie do nowych użytkowników szukających hoteli w regionie.`,
    metaData: {
      metrics: {
        totalSpend: 8500,
        totalImpressions: 485000,
        totalClicks: 11350,
        totalConversions: 98,
        averageCtr: 2.34,
        averageCpc: 0.75,
        averageCpa: 86.73,
        averageCpm: 17.53,
        reach: 245000,
        relevanceScore: 7.5,
        landingPageViews: 8920,
        totalReservations: 98,
        totalReservationValue: 38250,
        roas: 4.5,
        emailContacts: 45,
        phoneContacts: 32,
      },
      funnel: {
        booking_step_1: 156,
        booking_step_2: 124,
        booking_step_3: 108,
        reservations: 98,
        reservation_value: 38250,
        roas: 4.5,
      },
      campaigns: [
        {
          name: 'Hotel Booking - Summer 2025',
          spend: 3200,
          impressions: 185000,
          clicks: 4250,
          conversions: 42,
          ctr: 2.3,
          cpc: 0.75,
          cpm: 17.3,
        },
        {
          name: 'Weekend Getaway Offers',
          spend: 2800,
          impressions: 165000,
          clicks: 3850,
          conversions: 35,
          ctr: 2.33,
          cpc: 0.73,
          cpm: 16.97,
        },
        {
          name: 'Business Travel Package',
          spend: 2500,
          impressions: 135000,
          clicks: 3250,
          conversions: 21,
          ctr: 2.41,
          cpc: 0.77,
          cpm: 18.52,
        },
      ],
      tables: {
        placementPerformance: [
          { placement: 'Facebook Feed', impressions: 245000, clicks: 5800, ctr: 2.37, cpc: 0.74 },
          { placement: 'Instagram Feed', impressions: 185000, clicks: 4350, ctr: 2.35, cpc: 0.76 },
          { placement: 'Facebook Stories', impressions: 55000, clicks: 1200, ctr: 2.18, cpc: 0.71 },
        ],
        demographicPerformance: [
          { age: '25-34', gender: 'Female', impressions: 185000, conversions: 42 },
          { age: '35-44', gender: 'Male', impressions: 155000, conversions: 31 },
          { age: '45-54', gender: 'Female', impressions: 95000, conversions: 18 },
        ],
        adRelevanceResults: [],
      },
    },
    googleData: {
      metrics: {
        totalSpend: 3950,
        totalImpressions: 125000,
        totalClicks: 2850,
        totalConversions: 47,
        averageCtr: 2.28,
        averageCpc: 1.39,
        averageCpa: 84.04,
        averageCpm: 31.6,
        searchImpressionShare: 68.5,
        qualityScore: 7.8,
        viewThroughConversions: 12,
        searchBudgetLostImpressionShare: 15.2,
        totalReservations: 47,
        totalReservationValue: 14040,
        roas: 3.55,
        emailContacts: 28,
        phoneContacts: 19,
      },
      funnel: {
        booking_step_1: 78,
        booking_step_2: 62,
        booking_step_3: 52,
        reservations: 47,
        reservation_value: 14040,
        roas: 3.55,
      },
      campaigns: [
        {
          name: 'Search - Hotel Bookings',
          spend: 2100,
          impressions: 45000,
          clicks: 1520,
          conversions: 28,
          ctr: 3.38,
          cpc: 1.38,
          cpm: 46.67,
        },
        {
          name: 'Display - Travel Intent',
          spend: 1850,
          impressions: 80000,
          clicks: 1330,
          conversions: 19,
          ctr: 1.66,
          cpc: 1.39,
          cpm: 23.13,
        },
      ],
      tables: {
        networkPerformance: [
          { network: 'Search Network', impressions: 65000, clicks: 1850, ctr: 2.85, cpc: 1.35 },
          { network: 'Display Network', impressions: 60000, clicks: 1000, ctr: 1.67, cpc: 1.43 },
        ],
        devicePerformance: [
          { device: 'Mobile', impressions: 75000, clicks: 1710, ctr: 2.28, conversions: 28 },
          { device: 'Desktop', impressions: 35000, clicks: 875, ctr: 2.5, conversions: 14 },
          { device: 'Tablet', impressions: 15000, clicks: 265, ctr: 1.77, conversions: 5 },
        ],
        keywordPerformance: [],
      },
    },
    yoyComparison: {
      meta: {
        current: {
          spend: 8500,
          reservationValue: 38250,
        },
        previous: {
          spend: 7370,
          reservationValue: 29600,
        },
        changes: {
          spend: 15.3,
          reservationValue: 29.2,
        },
      },
      google: {
        current: {
          spend: 3950,
          reservationValue: 14040,
        },
        previous: {
          spend: 4300,
          reservationValue: 12180,
        },
        changes: {
          spend: -8.1,
          reservationValue: 15.3,
        },
      },
    },
  };
}

// Helper function to fetch data using EXACTLY same system as /reports page
async function fetchReportData(clientId: string, dateRange: { start: string; end: string }, request: NextRequest): Promise<ReportData> {
  logger.info('📊 PDF Generation using EXACT same system as reports page');
  
  // 🔧 FIX: Extract authorization header to pass to internal API calls
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    logger.error('❌ Missing authorization header in fetchReportData');
    throw new Error('Missing authorization header');
  }
  
  // Get client data
  const { data: clientData, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();
    
  if (clientError || !clientData) {
    logger.error('❌ Client not found:', { clientId, error: clientError });
    throw new Error('Client not found');
  }
  
  logger.info('✅ Client data loaded:', { 
    id: clientData.id, 
    name: clientData.name,
    google_ads_enabled: clientData.google_ads_enabled,
    google_ads_customer_id: clientData.google_ads_customer_id,
    hasGoogleAdsRefreshToken: !!clientData.google_ads_refresh_token,
    meta_access_token: !!clientData.meta_access_token,
    ad_account_id: clientData.ad_account_id
  });
  
  const reportData: ReportData = {
    clientId,
    clientName: clientData.name,
    clientLogo: clientData.logo_url || undefined,
    dateRange,
    aiSummary: undefined,
    yoyComparison: undefined,
    metaData: undefined,
    googleData: undefined
  };
  
  // 🎯 USE EXACT SAME SYSTEM AS REPORTS PAGE: StandardizedDataFetcher
  logger.info('🎯 Using StandardizedDataFetcher (same as reports page)');
  
  // Import the same data fetchers used by reports page
  const { StandardizedDataFetcher } = await import('../../../lib/standardized-data-fetcher');
  const { GoogleAdsStandardizedDataFetcher } = await import('../../../lib/google-ads-standardized-data-fetcher');
  
  // Fetch Meta data using EXACT same logic as reports page
  let metaData = null;
  let metaError = null;
  
  if (clientData.meta_access_token && clientData.ad_account_id) {
    try {
      logger.info('📊 Fetching Meta data using StandardizedDataFetcher (same as reports)...');
      
      const metaResult = await StandardizedDataFetcher.fetchData({
        clientId,
        dateRange,
        platform: 'meta',
        reason: 'pdf-generation-meta',
        sessionToken: clientData.meta_access_token // Use client's access token
      });
      
      if (metaResult.success) {
        metaData = metaResult.data;
        logger.info('✅ Meta data fetched successfully via StandardizedDataFetcher');
        console.log('🔍 META DATA DEBUG:', {
          totalSpend: metaData?.stats?.totalSpend,
          totalReservations: metaData?.conversionMetrics?.reservations,
          totalReservationValue: metaData?.conversionMetrics?.reservation_value,
          source: metaResult.debug?.source,
          hasStats: !!metaData?.stats,
          hasConversionMetrics: !!metaData?.conversionMetrics
        });
      } else {
        metaError = `StandardizedDataFetcher failed for Meta: Unknown error`;
        logger.error('❌ Meta data fetching failed:', {
          debug: metaResult.debug,
          validation: metaResult.validation
        });
      }
    } catch (error) {
      logger.error('❌ Error fetching Meta data via StandardizedDataFetcher:', error);
      metaError = error instanceof Error ? error.message : 'Unknown Meta error';
    }
  }

  // Fetch Google Ads data using EXACT same logic as reports page
  let googleData = null;
  let googleError = null;
  
  // Debug Google Ads client data
  logger.info('🔍 GOOGLE ADS CLIENT DATA DEBUG:', {
    google_ads_enabled: clientData.google_ads_enabled,
    google_ads_customer_id: clientData.google_ads_customer_id,
    hasGoogleAdsRefreshToken: !!clientData.google_ads_refresh_token,
    clientId: clientData.id
  });
  
  // Debug why Google Ads condition might not be met
  // Define base URL for API calls
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? (process.env.NEXT_PUBLIC_APP_URL || '') 
    : 'http://localhost:3000';
    
  const googleAdsConditionMet = clientData.google_ads_enabled && clientData.google_ads_customer_id;
  logger.info('🔍 GOOGLE ADS CONDITION CHECK:', {
    google_ads_enabled: clientData.google_ads_enabled,
    google_ads_customer_id: clientData.google_ads_customer_id,
    conditionMet: googleAdsConditionMet,
    reason: !googleAdsConditionMet ? 
      (!clientData.google_ads_enabled ? 'google_ads_enabled is false' : 'google_ads_customer_id is missing') : 
      'condition met'
  });
  
  if (googleAdsConditionMet) {
    try {
      logger.info('📊 Fetching Google Ads data using /api/fetch-google-ads-live-data (same as reports with fallback)...');
      
      // Use the same API endpoint as reports page - this has fallback logic for expired tokens
      const googleResponse = await fetch(`${baseUrl}/api/fetch-google-ads-live-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          clientId,
          dateRange: { start: dateRange.start, end: dateRange.end },
          includeTableData: true
        })
      });
      
      if (googleResponse.ok) {
        const googleResult = await googleResponse.json();
        if (googleResult.success && googleResult.data) {
          googleData = googleResult.data;
          logger.info('✅ Google Ads data fetched successfully via API endpoint:', {
            totalSpend: googleData.stats?.totalSpend || 0,
            totalReservations: googleData.stats?.totalConversions || 0,
            totalReservationValue: googleData.conversionMetrics?.reservation_value || 0,
            source: googleData.fromDatabase ? 'database' : 'live_api',
            hasStats: !!googleData.stats,
            hasConversionMetrics: !!googleData.conversionMetrics,
            campaignCount: googleData.campaigns?.length || 0
          });
        } else {
          logger.error('❌ Google Ads API returned unsuccessful response:', googleResult);
          googleError = googleResult.error || 'Unknown Google Ads API error';
        }
      } else {
        const errorText = await googleResponse.text();
        logger.error('❌ Google Ads API request failed:', {
          status: googleResponse.status,
          statusText: googleResponse.statusText,
          errorText
        });
        googleError = `Google Ads API failed: ${googleResponse.status} ${googleResponse.statusText}`;
      }
    } catch (error) {
      logger.error('❌ Error fetching Google Ads data via API endpoint:', error);
      googleError = error instanceof Error ? error.message : 'Unknown Google Ads error';
    }
  } else {
    logger.warn('⚠️ Google Ads condition not met - skipping Google Ads data fetch:', {
      google_ads_enabled: clientData.google_ads_enabled,
      google_ads_customer_id: clientData.google_ads_customer_id,
      reason: !clientData.google_ads_enabled ? 'google_ads_enabled is false' : 'google_ads_customer_id is missing'
    });
  }

  // Fetch Year-over-Year comparison using SAME API as reports page
  try {
    logger.info('📊 Fetching Year-over-Year comparison using YoY API (same as reports page)...');
    
    // Use the same YoY API endpoint that works for the reports page
    // Use relative URL for same-origin requests
    
    // Fetch Meta YoY data
    let metaYoYData = null;
    if (clientData.meta_access_token && clientData.ad_account_id) {
      try {
        logger.info('📊 Fetching Meta YoY data from API...');
        
        const metaYoYResponse = await fetch(`${baseUrl}/api/year-over-year-comparison`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({ 
            clientId, 
            dateRange, 
            platform: 'meta' 
          })
        });
        
        if (metaYoYResponse.ok) {
          metaYoYData = await metaYoYResponse.json();
          logger.info('✅ Meta YoY data fetched successfully:', {
            hasData: !!metaYoYData,
            currentSpend: metaYoYData?.current?.spend || 0,
            previousSpend: metaYoYData?.previous?.spend || 0,
            changesSpend: metaYoYData?.changes?.spend || 0,
            fullResponse: metaYoYData
          });
        } else {
          const errorText = await metaYoYResponse.text();
          logger.warn('⚠️ Meta YoY API failed:', {
            status: metaYoYResponse.status,
            statusText: metaYoYResponse.statusText,
            error: errorText
          });
        }
      } catch (error) {
        logger.warn('⚠️ Meta YoY API error:', error);
      }
    }
    
    // Fetch Google Ads YoY data
    let googleYoYData = null;
    if (clientData.google_ads_enabled && clientData.google_ads_customer_id) {
      try {
        logger.info('📊 Fetching Google Ads YoY data from API...');
        
        const googleYoYResponse = await fetch(`${baseUrl}/api/year-over-year-comparison`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({ 
            clientId, 
            dateRange, 
            platform: 'google_ads' 
          })
        });
        
        if (googleYoYResponse.ok) {
          googleYoYData = await googleYoYResponse.json();
          logger.info('✅ Google Ads YoY data fetched successfully:', {
            hasData: !!googleYoYData,
            currentSpend: googleYoYData?.current?.spend || 0,
            previousSpend: googleYoYData?.previous?.spend || 0,
            changesSpend: googleYoYData?.changes?.spend || 0,
            fullResponse: googleYoYData
          });
        } else {
          const errorText = await googleYoYResponse.text();
          logger.warn('⚠️ Google Ads YoY API failed:', {
            status: googleYoYResponse.status,
            statusText: googleYoYResponse.statusText,
            error: errorText
          });
        }
      } catch (error) {
        logger.warn('⚠️ Google Ads YoY API error:', error);
      }
    }
    
    // Calculate YoY changes using same logic as reports page
    const calculateChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };
    
    // Process Meta YoY data from API - include ALL metrics
    const metaCurrent = {
      spend: metaYoYData?.current?.spend || 0,
      impressions: metaYoYData?.current?.impressions || 0,
      clicks: metaYoYData?.current?.clicks || 0,
      reservations: metaYoYData?.current?.reservations || 0,
      reservationValue: metaYoYData?.current?.reservation_value || 0,
      booking_step_1: metaYoYData?.current?.booking_step_1 || 0,
      booking_step_2: metaYoYData?.current?.booking_step_2 || 0,
      booking_step_3: metaYoYData?.current?.booking_step_3 || 0
    };
    
    const metaPrevious = {
      spend: metaYoYData?.previous?.spend || 0,
      impressions: metaYoYData?.previous?.impressions || 0,
      clicks: metaYoYData?.previous?.clicks || 0,
      reservations: metaYoYData?.previous?.reservations || 0,
      reservationValue: metaYoYData?.previous?.reservation_value || 0,
      booking_step_1: metaYoYData?.previous?.booking_step_1 || 0,
      booking_step_2: metaYoYData?.previous?.booking_step_2 || 0,
      booking_step_3: metaYoYData?.previous?.booking_step_3 || 0
    };
    
    const metaChanges = {
      spend: metaYoYData?.changes?.spend || 0,
      impressions: metaYoYData?.changes?.impressions || 0,
      clicks: metaYoYData?.changes?.clicks || 0,
      reservations: metaYoYData?.changes?.reservations || 0,
      reservationValue: metaYoYData?.changes?.reservation_value || 0,
      booking_step_1: metaYoYData?.changes?.booking_step_1 || 0,
      booking_step_2: metaYoYData?.changes?.booking_step_2 || 0,
      booking_step_3: metaYoYData?.changes?.booking_step_3 || 0
    };
    
    // Process Google Ads YoY data from API - include ALL metrics
    const googleCurrent = {
      spend: googleYoYData?.current?.spend || 0,
      impressions: googleYoYData?.current?.impressions || 0,
      clicks: googleYoYData?.current?.clicks || 0,
      reservations: googleYoYData?.current?.reservations || 0,
      reservationValue: googleYoYData?.current?.reservation_value || 0,
      booking_step_1: googleYoYData?.current?.booking_step_1 || 0,
      booking_step_2: googleYoYData?.current?.booking_step_2 || 0,
      booking_step_3: googleYoYData?.current?.booking_step_3 || 0
    };
    
    const googlePrevious = {
      spend: googleYoYData?.previous?.spend || 0,
      impressions: googleYoYData?.previous?.impressions || 0,
      clicks: googleYoYData?.previous?.clicks || 0,
      reservations: googleYoYData?.previous?.reservations || 0,
      reservationValue: googleYoYData?.previous?.reservation_value || 0,
      booking_step_1: googleYoYData?.previous?.booking_step_1 || 0,
      booking_step_2: googleYoYData?.previous?.booking_step_2 || 0,
      booking_step_3: googleYoYData?.previous?.booking_step_3 || 0
    };
    
    const googleChanges = {
      spend: googleYoYData?.changes?.spend || 0,
      impressions: googleYoYData?.changes?.impressions || 0,
      clicks: googleYoYData?.changes?.clicks || 0,
      reservations: googleYoYData?.changes?.reservations || 0,
      reservationValue: googleYoYData?.changes?.reservation_value || 0,
      booking_step_1: googleYoYData?.changes?.booking_step_1 || 0,
      booking_step_2: googleYoYData?.changes?.booking_step_2 || 0,
      booking_step_3: googleYoYData?.changes?.booking_step_3 || 0
    };
    
    // 🔍 DEBUG: Log the actual data being used for comparison
    logger.info('🔍 YoY Data Debug - Meta (from API):', {
      current: { 
        spend: metaCurrent.spend,
        reservationValue: metaCurrent.reservationValue,
        source: 'metaYoYData.current'
      },
      previous: { 
        spend: metaPrevious.spend,
        reservationValue: metaPrevious.reservationValue,
        source: 'metaYoYData.previous'
      },
      changes: metaChanges,
      hasApiData: !!metaYoYData
    });
    
    logger.info('🔍 YoY Data Debug - Google (from API):', {
      current: { 
        spend: googleCurrent.spend,
        reservationValue: googleCurrent.reservationValue,
        source: 'googleYoYData.current'
      },
      previous: { 
        spend: googlePrevious.spend,
        reservationValue: googlePrevious.reservationValue,
        source: 'googleYoYData.previous'
      },
      changes: googleChanges,
      hasApiData: !!googleYoYData
    });
    
    // 🔍 DEBUG: Check if reservation values are identical (potential bug)
    if (metaCurrent.reservationValue === googleCurrent.reservationValue && metaCurrent.reservationValue > 0) {
      logger.warn('⚠️ IDENTICAL RESERVATION VALUES DETECTED:', {
        metaValue: metaCurrent.reservationValue,
        googleValue: googleCurrent.reservationValue,
        message: 'This might indicate a data sharing issue between platforms'
      });
    }
    
    // Create YoY comparison data structure (same as reports page)
    reportData.yoyComparison = {
      meta: {
        current: metaCurrent,
        previous: metaPrevious,
        changes: metaChanges
      },
      google: {
        current: googleCurrent,
        previous: googlePrevious,
        changes: googleChanges
      }
    };
    
    
    logger.info('✅ YoY comparison data created for PDF:', {
      metaCurrent: metaCurrent,
      metaPrevious: metaPrevious,
      metaChanges: metaChanges,
      googleCurrent: googleCurrent,
      googlePrevious: googlePrevious,
      googleChanges: googleChanges
    });
    
    logger.info('✅ Year-over-year data calculated successfully:', {
      metaCurrent: metaCurrent,
      metaPrevious: metaPrevious,
      metaChanges: metaChanges,
      googleCurrent: googleCurrent,
      googlePrevious: googlePrevious,
      googleChanges: googleChanges
    });
    
  } catch (error) {
    logger.warn('⚠️ Year-over-year comparison failed:', error);
  }
  
  // 🔍 DEBUG: Check if we have any data at all
  logger.info('🔍 DATA AVAILABILITY CHECK:', {
    hasMetaData: !!metaData,
    hasGoogleData: !!googleData,
    metaError: metaError,
    googleError: googleError,
    metaSpend: metaData?.stats?.totalSpend || 0,
    googleSpend: googleData?.stats?.totalSpend || 0
  });

  // 🔧 FALLBACK: If direct fetchers failed, try using the same API endpoint as reports page
  if (!metaData && clientData.meta_access_token && clientData.ad_account_id) {
    try {
      logger.info('🔄 FALLBACK: Trying Meta data via API endpoint (same as reports page)...');
      
      const fallbackResponse = await fetch(`${baseUrl}/api/fetch-live-data`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          clientId,
          dateRange,
          platform: 'meta',
          reason: 'pdf-generation-fallback'
        })
      });

      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        if (fallbackData.success && fallbackData.data) {
          metaData = fallbackData.data;
          logger.info('✅ Meta data fetched successfully via fallback API');
          console.log('🔍 FALLBACK META DATA DEBUG:', {
            totalSpend: metaData?.stats?.totalSpend,
            totalReservations: metaData?.conversionMetrics?.reservations,
            totalReservationValue: metaData?.conversionMetrics?.reservation_value,
            source: 'fallback-api'
          });
        }
      }
    } catch (fallbackError) {
      logger.error('❌ Fallback Meta data fetching failed:', fallbackError);
    }
  }

  // Transform Meta data using EXACT same format as reports page (StandardizedDataFetcher format)
  if (metaData) {
    try {
      logger.info('📱 Using Meta data from StandardizedDataFetcher (same as reports page)...');
      
      // Use standardized data format directly (no transformation needed)
      const stats = metaData.stats || {};
      const conversionMetrics = metaData.conversionMetrics || {};
      const campaigns = metaData.campaigns || [];
      
      // Calculate additional metrics using same logic as reports page
      const totalConversions = stats.totalConversions || 0;
      const emailContacts = conversionMetrics.email_contacts || 0;
      const phoneContacts = conversionMetrics.click_to_call || 0;
      const totalReservationValue = conversionMetrics.reservation_value || 0;
      const totalReservations = conversionMetrics.reservations || 0;
      const totalSpend = stats.totalSpend || 0;
      
      // Calculate campaign averages (same as reports page) - legacy metrics removed
      const avgRelevanceScore = campaigns.length > 0 ? campaigns.reduce((sum: number, c: any) => sum + (c.relevance_score || 0), 0) / campaigns.length : 0;
      const totalLandingPageViews = campaigns.reduce((sum: number, c: any) => sum + (c.landing_page_view || 0), 0);
      const totalReach = conversionMetrics.reach || 0;
      
      reportData.metaData = {
        metrics: {
          totalSpend: totalSpend,
          totalImpressions: stats.totalImpressions || 0,
          totalClicks: stats.totalClicks || 0,
          totalConversions: totalConversions,
          averageCtr: stats.averageCtr || 0,
          averageCpc: stats.averageCpc || 0,
          averageCpa: totalConversions > 0 ? totalSpend / totalConversions : 0,
          averageCpm: (stats.totalImpressions || 0) > 0 ? (totalSpend / (stats.totalImpressions || 0)) * 1000 : 0,
          reach: totalReach,
          relevanceScore: avgRelevanceScore,
          landingPageViews: totalLandingPageViews,
          totalReservations: totalReservations,
          totalReservationValue: totalReservationValue,
          roas: conversionMetrics.roas || 0,
          emailContacts: emailContacts,
          phoneContacts: phoneContacts
        },
        campaigns: campaigns,
        funnel: {
          booking_step_1: conversionMetrics.booking_step_1 || 0,
          booking_step_2: conversionMetrics.booking_step_2 || 0,
          booking_step_3: conversionMetrics.booking_step_3 || 0,
          reservations: conversionMetrics.reservations || 0,
          reservation_value: conversionMetrics.reservation_value || 0,
          roas: conversionMetrics.roas || 0
        },
        tables: {
          placementPerformance: [],
          demographicPerformance: [],
          adRelevanceResults: []
        }
      };
    } catch (error) {
      logger.error('❌ Error processing Meta data:', error);
    }
  }

  // 🔧 FETCH META TABLES DATA: Always fetch demographic data if client has Meta credentials
  if (clientData.meta_access_token && clientData.ad_account_id) {
    try {
      logger.info('📊 Fetching Meta tables data (demographics, placement, ad relevance)...');
      
      const metaTablesResponse = await fetch(`${baseUrl}/api/fetch-meta-tables`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          clientId,
          dateRange: {
            start: dateRange.start,
            end: dateRange.end
          }
        })
      });
      
      if (metaTablesResponse.ok) {
        const tablesData = await metaTablesResponse.json();
        logger.info('🔍 PDF META TABLES RESPONSE:', {
          success: tablesData.success,
          hasData: !!tablesData.data,
          dataKeys: Object.keys(tablesData.data || {}),
          hasMetaTables: !!tablesData.data?.metaTables,
          metaTablesKeys: Object.keys(tablesData.data?.metaTables || {}),
          demographicLength: tablesData.data?.metaTables?.demographicPerformance?.length || 0,
          demographicSample: tablesData.data?.metaTables?.demographicPerformance?.slice(0, 2) || []
        });
        
        if (tablesData.success) {
          // Initialize metaData if it doesn't exist
          if (!reportData.metaData) {
            reportData.metaData = {
              metrics: {
                totalSpend: 0,
                totalImpressions: 0,
                totalClicks: 0,
                totalConversions: 0,
                averageCtr: 0,
                averageCpc: 0,
                averageCpa: 0,
                averageCpm: 0,
                reach: 0,
                relevanceScore: 0,
                landingPageViews: 0,
                totalReservations: 0,
                totalReservationValue: 0,
                roas: 0,
                emailContacts: 0,
                phoneContacts: 0
              },
              campaigns: [],
              funnel: {
                booking_step_1: 0,
                booking_step_2: 0,
                booking_step_3: 0,
                reservations: 0,
                reservation_value: 0,
                roas: 0
              },
              tables: {
                placementPerformance: [],
                demographicPerformance: [],
                adRelevanceResults: []
              }
            };
          }
          
          // Assign tables data
          reportData.metaData.tables = {
            placementPerformance: tablesData.data.metaTables?.placementPerformance || [],
            demographicPerformance: tablesData.data.metaTables?.demographicPerformance || [],
            adRelevanceResults: tablesData.data.metaTables?.adRelevanceResults || []
          };
          
          logger.info('✅ PDF META TABLES DATA ASSIGNED:', {
            placementLength: reportData.metaData.tables.placementPerformance.length,
            demographicLength: reportData.metaData.tables.demographicPerformance.length,
            adRelevanceLength: reportData.metaData.tables.adRelevanceResults.length,
            demographicSample: reportData.metaData.tables.demographicPerformance.slice(0, 1)
          });
        }
      } else {
        logger.warn('⚠️ Meta tables API failed:', metaTablesResponse.status, metaTablesResponse.statusText);
      }
    } catch (error) {
      logger.warn('⚠️ Meta tables data fetch failed:', error);
    }
  }
  
  // Transform Google Ads data using EXACT same format as reports page (GoogleAdsStandardizedDataFetcher format)
  if (googleData) {
    try {
      logger.info('🔍 Using Google Ads data from /api/fetch-google-ads-live-data (same as reports page)...');
      
      // Use API response format directly (same as reports page)
      const stats = googleData.stats || {};
      const conversionMetrics = googleData.conversionMetrics || {};
      const campaigns = googleData.campaigns || [];
      const googleAdsTables = googleData.googleAdsTables || {};
      
      // Calculate additional Google metrics using same logic as reports page
      const googleTotalConversions = stats.totalConversions || 0;
      const googleEmailContacts = conversionMetrics.email_contacts || 0;
      const googlePhoneContacts = conversionMetrics.click_to_call || 0;
      const googleTotalReservationValue = conversionMetrics.reservation_value || 0;
      const googleTotalReservations = conversionMetrics.reservations || 0;
      const googleTotalSpend = stats.totalSpend || 0;
      
      reportData.googleData = {
        metrics: {
          totalSpend: googleTotalSpend,
          totalImpressions: stats.totalImpressions || 0,
          totalClicks: stats.totalClicks || 0,
          totalConversions: googleTotalConversions,
          averageCtr: stats.averageCtr || 0,
          averageCpc: stats.averageCpc || 0,
          averageCpa: googleTotalConversions > 0 ? googleTotalSpend / googleTotalConversions : 0,
          averageCpm: (stats.totalImpressions || 0) > 0 ? (googleTotalSpend / (stats.totalImpressions || 0)) * 1000 : 0,
          searchImpressionShare: (stats as any).searchImpressionShare || 0,
          qualityScore: (stats as any).qualityScore || 0,
          viewThroughConversions: (stats as any).viewThroughConversions || 0,
          searchBudgetLostImpressionShare: (stats as any).searchBudgetLostImpressionShare || 0,
          totalReservations: googleTotalReservations,
          totalReservationValue: googleTotalReservationValue,
          roas: conversionMetrics.roas || 0,
          emailContacts: googleEmailContacts,
          phoneContacts: googlePhoneContacts
        },
        campaigns: campaigns,
        funnel: {
          booking_step_1: conversionMetrics.booking_step_1 || 0,
          booking_step_2: conversionMetrics.booking_step_2 || 0,
          booking_step_3: conversionMetrics.booking_step_3 || 0,
          reservations: conversionMetrics.reservations || 0,
          reservation_value: conversionMetrics.reservation_value || 0,
          roas: conversionMetrics.roas || 0
        },
        tables: {
          networkPerformance: googleAdsTables.networkPerformance || [],
          devicePerformance: googleAdsTables.devicePerformance || [],
          keywordPerformance: googleAdsTables.keywordPerformance || []
        }
      };
      
      // Debug Google Ads data assignment
      logger.info('🔍 GOOGLE ADS DATA ASSIGNED TO REPORTDATA:', {
        hasGoogleData: !!reportData.googleData,
        totalSpend: reportData.googleData.metrics.totalSpend,
        totalImpressions: reportData.googleData.metrics.totalImpressions,
        totalClicks: reportData.googleData.metrics.totalClicks,
        campaignCount: reportData.googleData.campaigns.length
      });
      
      logger.info('✅ Google Ads data transformed successfully:', {
        totalSpend: reportData.googleData.metrics.totalSpend,
        totalImpressions: reportData.googleData.metrics.totalImpressions,
        totalClicks: reportData.googleData.metrics.totalClicks,
        totalReservations: reportData.googleData.metrics.totalReservations,
        campaignCount: reportData.googleData.campaigns.length,
        bookingStep1: reportData.googleData.funnel.booking_step_1
      });
    } catch (error) {
      logger.warn('⚠️ Google Ads data transformation failed:', error);
    }
  } else if (googleError) {
    logger.warn('⚠️ Google Ads data not available:', googleError);
  }
  
  // Generate AI Summary using SAME DATA FETCHING SYSTEM as reports page
  logger.info('🔍 Generating AI summary using same data as reports page...');
  logger.info('🔍 Data availability for AI summary:', {
    hasMetaData: !!reportData.metaData,
    hasGoogleData: !!reportData.googleData,
    hasYoyData: !!reportData.yoyComparison
  });
  
  try {
    logger.info('🤖 Generating AI summary using main API...');
    
    // Call the main AI summary API instead of duplicating logic
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/generate-executive-summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        clientId,
        dateRange,
        reportData: {
          metaData: reportData.metaData,
          googleData: reportData.googleData
        }
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      if (result.success && result.summary) {
        reportData.aiSummary = result.summary;
        logger.info('✅ AI summary generated using main API:', {
          summaryLength: result.summary.length,
          summaryPreview: result.summary.substring(0, 100)
        });
      } else {
        logger.warn('⚠️ AI summary API returned no summary');
      }
    } else {
      logger.warn('⚠️ AI summary API call failed:', response.status);
    }
    
  } catch (error) {
    logger.error('❌ AI SUMMARY GENERATION EXCEPTION:', {
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : 'No stack trace',
      errorType: typeof error,
      errorName: error instanceof Error ? error.name : 'Unknown'
    });
    logger.warn('⚠️ AI summary generation failed, continuing without it:', error);
  }
  
  logger.info('🔍 AI SUMMARY GENERATION COMPLETED - Final check:', {
    hasAiSummary: !!reportData.aiSummary,
    aiSummaryLength: reportData.aiSummary?.length || 0,
    aiSummaryPreview: reportData.aiSummary?.substring(0, 30) || 'NO AI SUMMARY SET'
  });
  
  return reportData;
}

export async function POST(request: NextRequest) {
  console.log('🚨 CRITICAL: PDF POST handler reached!');
  logger.info('🚨 CRITICAL: PDF POST handler reached!');
  logger.info('📄 New PDF Generation Request Started - using EXACT same system as reports page');

  // 🔒 Apply rate limiting for PDF generation
  const { applyRateLimit, defaultRateLimiters } = await import('@/lib/api-rate-limiter');
  const rateLimitResponse = await applyRateLimit(request, defaultRateLimiters.pdf);
  if (rateLimitResponse) {
    logger.warn('PDF generation rate limit exceeded', {
      path: request.nextUrl.pathname,
    });
    return rateLimitResponse;
  }

  try {
    const body = await request.json();
    logger.info('📊 Received request body:', { keys: Object.keys(body) });

    // Validate required parameters
    if (!body.clientId || !body.dateRange) {
      logger.error('❌ Missing required parameters');
      return NextResponse.json(
        { error: 'Missing required parameters: clientId and dateRange are required' },
        { status: 400 }
      );
    }

    const { clientId, dateRange } = body;
    
    // Check if this is a preview request (development/design tool)
    const isPreviewMode = request.headers.get('X-Preview-Mode') === 'true';
    
    // Authenticate the request (skip for preview mode in development)
    let user: any = null;
    if (!isPreviewMode) {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
      user = authResult.user;
    logger.info('🔐 PDF generation authenticated for user:', user.email);
    } else {
      logger.info('🎨 Preview mode - skipping authentication');
    }

    let reportData: ReportData;
    
    // 🎨 PREVIEW MODE: Use mock data for UX/UI preview
    if (isPreviewMode) {
      logger.info('🎨 Preview mode - using mock data for design preview');
      reportData = generateMockReportData(clientId, dateRange);
      logger.info('✅ Mock report data generated for preview');
    } else {
      logger.info('🔄 Fetching report data from same sources as /reports page...');
    try {
      reportData = await fetchReportData(clientId, dateRange, request);
      logger.info('✅ Report data fetched successfully:', {
        hasAiSummary: !!reportData.aiSummary,
        aiSummaryLength: reportData.aiSummary?.length || 0,
        hasMetaData: !!reportData.metaData,
        hasGoogleData: !!reportData.googleData
      });
    } catch (fetchError) {
      logger.error('❌ Error fetching report data:', fetchError);
      return NextResponse.json(
        { 
          error: 'Failed to fetch report data',
          details: fetchError instanceof Error ? fetchError.message : 'Unknown fetch error'
        },
        { status: 500 }
      );
      }
    }

    logger.info('📊 Generating PDF HTML content with new 8-section structure...');
    
    // COMPREHENSIVE AUDIT: Check reportData before HTML generation
    logger.info('🔍 PDF YoY Data Check:', {
      hasYoyComparison: !!reportData.yoyComparison,
      metaCurrentSpend: reportData.yoyComparison?.meta?.current?.spend || 0,
      metaPreviousSpend: reportData.yoyComparison?.meta?.previous?.spend || 0,
      metaChangesSpend: reportData.yoyComparison?.meta?.changes?.spend || 0,
      googleCurrentSpend: reportData.yoyComparison?.google?.current?.spend || 0,
      googlePreviousSpend: reportData.yoyComparison?.google?.previous?.spend || 0,
      googleChangesSpend: reportData.yoyComparison?.google?.changes?.spend || 0
    });
    
    
    
    logger.info('🔍 FINAL REPORT DATA AUDIT (before HTML generation):', {
      hasAiSummary: !!reportData.aiSummary,
      aiSummaryLength: reportData.aiSummary?.length || 0,
      aiSummaryPreview: reportData.aiSummary?.substring(0, 50) || 'NO AI SUMMARY',
      aiSummaryType: typeof reportData.aiSummary,
      reportDataKeys: Object.keys(reportData),
      clientName: reportData.clientName,
      hasMetaData: !!reportData.metaData,
      hasGoogleData: !!reportData.googleData
    });
    
    let html: string;
    
    try {
      html = generatePDFHTML(reportData);
      
      // COMPREHENSIVE AUDIT: Check generated HTML
      logger.info('🔍 GENERATED HTML AUDIT:', {
        htmlLength: html.length,
        containsAiSummarySection: html.includes('ai-summary-section'),
        containsPodsumowanieWykonawcze: html.includes('Podsumowanie Wykonawcze'),
        containsAiSummaryMissingComment: html.includes('AI SUMMARY MISSING'),
        aiSummarySectionCount: (html.match(/ai-summary-section/g) || []).length
      });
      
      logger.info('✅ PDF HTML generated successfully');
    } catch (htmlError) {
      logger.error('❌ Error generating PDF HTML:', htmlError);
      return NextResponse.json(
        { 
          error: 'Failed to generate PDF HTML',
          details: htmlError instanceof Error ? htmlError.message : 'Unknown HTML error'
        },
        { status: 500 }
      );
    }

    // 🎨 PREVIEW MODE: Return HTML instead of PDF if preview header is set
    if (isPreviewMode) {
      logger.info('🎨 Preview mode detected - returning HTML instead of PDF');
      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'X-Preview-Mode': 'true',
        },
      });
    }

    logger.info('🚀 Launching Puppeteer...');
    let browser: any = null;
    let page: any = null;
    
    // 🔒 Resource limits for PDF generation
    const MAX_PDF_SIZE_MB = 50; // Maximum PDF size in MB
    const MAX_GENERATION_TIME_MS = 120000; // 2 minutes maximum
    const startTime = Date.now();
    
    try {
      // 🔒 SECURITY: Removed --disable-web-security flag for production security
      // Use proper content isolation instead of disabling security
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox', // Required for serverless environments
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          // Removed: '--disable-web-security' - Security risk
          '--disable-features=VizDisplayCompositor',
          // Resource limits
          '--max-old-space-size=512', // Limit memory to 512MB
        ],
        // Resource constraints
        timeout: MAX_GENERATION_TIME_MS,
      });

      page = await browser.newPage();
      
      // Set longer timeout for page operations
      page.setDefaultTimeout(60000); // 60 seconds
      page.setDefaultNavigationTimeout(60000); // 60 seconds
      
      // Capture page errors
      page.on('pageerror', (error) => {
        logger.error('📄 PDF Page Error:', error.message);
      });
      
      page.on('console', (msg) => {
        logger.info('📄 PDF Page Console:', msg.text());
      });
      
      // Use domcontentloaded instead of networkidle0 to avoid timeout issues
      logger.info('⏳ Setting page content...');
      await page.setContent(html, { 
        waitUntil: 'domcontentloaded',
        timeout: 60000 
      });
      
      logger.info('⏳ Waiting for content to render...');
      await new Promise(resolve => setTimeout(resolve, 2000)); // Reduced wait time
      
      // Wait for any remaining async operations
      await page.evaluate(() => {
        return new Promise((resolve) => {
          if (document.readyState === 'complete') {
            resolve(true);
          } else {
            window.addEventListener('load', () => resolve(true));
          }
        });
      });
      
      // Check generation time limit
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime > MAX_GENERATION_TIME_MS) {
        throw new Error(`PDF generation exceeded time limit of ${MAX_GENERATION_TIME_MS}ms`);
      }
      
      logger.info('📄 Generating PDF...');
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: false,
        margin: {
          top: '15mm',
          right: '15mm',
          bottom: '15mm',
          left: '15mm'
        },
        timeout: MAX_GENERATION_TIME_MS - elapsedTime // Remaining time
      });
      
      // Check PDF size limit
      const pdfSizeMB = pdfBuffer.length / (1024 * 1024);
      if (pdfSizeMB > MAX_PDF_SIZE_MB) {
        logger.warn('PDF size exceeded limit', {
          sizeMB: pdfSizeMB.toFixed(2),
          maxMB: MAX_PDF_SIZE_MB,
        });
        throw new Error(`PDF size (${pdfSizeMB.toFixed(2)}MB) exceeds maximum allowed (${MAX_PDF_SIZE_MB}MB)`);
      }
      
      logger.info('✅ PDF generated', {
        sizeMB: pdfSizeMB.toFixed(2),
        generationTimeMs: Date.now() - startTime,
      });

      logger.info('✅ New PDF generated successfully with 8 sections');

      // Encode filename to handle non-ASCII characters
      const sanitizedClientName = reportData.clientName
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 50);
    
      const filename = `raport_kampanii_${sanitizedClientName}_${new Date().toISOString().split('T')[0]}.pdf`;
      const encodedFilename = encodeURIComponent(filename);
      
      // 🔒 CRITICAL: Cleanup browser resources before returning response
      if (page) {
        try {
          await page.close();
        } catch (closePageError) {
          logger.error('❌ Error closing page:', closePageError);
        }
      }
      
      if (browser) {
        try {
          await browser.close();
          logger.info('✅ Browser closed successfully');
        } catch (closeBrowserError) {
          logger.error('❌ Error closing browser:', closeBrowserError);
        }
      }
      
      // Check if request wants JSON response with AI summary
      const acceptHeader = request.headers.get('accept');
      const wantsJson = acceptHeader?.includes('application/json');
      
      if (wantsJson) {
        // Return JSON with both PDF and AI summary for email integration
        logger.info('📧 Returning JSON response with PDF and AI summary for email integration');
        return NextResponse.json({
          success: true,
          pdf: Buffer.from(pdfBuffer).toString('base64'),
          aiSummary: reportData.aiSummary,
          clientName: reportData.clientName,
          dateRange: reportData.dateRange,
          size: pdfBuffer.length,
          hasAiSummary: !!reportData.aiSummary,
          aiSummaryLength: reportData.aiSummary?.length || 0,
          aiSummaryPreview: reportData.aiSummary?.substring(0, 100) || 'No AI summary'
        });
      } else {
        // Return the PDF as a response (default behavior)
        return new NextResponse(pdfBuffer as BodyInit, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`,
            'Content-Length': pdfBuffer.length.toString(),
            // Include AI summary info in headers for debugging
            'X-AI-Summary-Length': (reportData.aiSummary?.length || 0).toString(),
            'X-Has-AI-Summary': (!!reportData.aiSummary).toString(),
          },
        });
      }

    } catch (puppeteerError) {
      logger.error('❌ Puppeteer error:', puppeteerError);
      
      // 🔒 CRITICAL: Always cleanup browser resources even on error
      if (page) {
        try {
          await page.close();
        } catch (closePageError) {
          logger.error('❌ Error closing page:', closePageError);
        }
      }
      
      if (browser) {
        try {
          await browser.close();
          logger.info('✅ Browser closed successfully after error');
        } catch (closeBrowserError) {
          logger.error('❌ Error closing browser:', closeBrowserError);
        }
      }
      
      // Check if it's a timeout error and provide specific guidance
      const isTimeoutError = puppeteerError instanceof Error && 
        (puppeteerError.message.includes('timeout') || puppeteerError.message.includes('Navigation timeout'));
      
      return NextResponse.json(
        { 
          error: 'Failed to generate PDF with Puppeteer',
          details: puppeteerError instanceof Error ? puppeteerError.message : 'Unknown Puppeteer error',
          isTimeout: isTimeoutError,
          suggestion: isTimeoutError ? 'The PDF generation timed out. This may be due to complex content or server load. Please try again.' : undefined
        },
        { status: 500 }
      );
    }

  } catch (error) {
    logger.error('❌ New PDF Generation Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate PDF',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
