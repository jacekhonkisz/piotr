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


// Generate Section 2: Production Comparison (Month-over-Month or Year-over-Year)
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
  
  return `
    <div class="section-container">
      <div class="page-content">
        <h2 class="section-title">Porównanie Okresów</h2>
        
        <table class="comparison-table">
          <thead>
            <tr>
              <th>Metryka</th>
              <th>Bieżący Okres</th>
              <th>Poprzedni Okres</th>
              <th>Zmiana</th>
            </tr>
          </thead>
          <tbody>
            <tr class="platform-section-header">
              <td colspan="4" class="platform-header meta-header">Meta Ads</td>
            </tr>
            <tr>
              <td class="metric-name">Wydatki</td>
              <td class="current-value">${formatCurrency(meta.current.spend)}</td>
              <td class="previous-value">${meta.previous.spend > 0 ? formatCurrency(meta.previous.spend) : '<span class="no-data">Brak danych</span>'}</td>
              <td class="change-cell">
                ${meta.previous.spend > 0 && meta.changes.spend !== -999 ? `
                  <span class="change-indicator ${meta.changes.spend >= 0 ? 'positive' : 'negative'}">
                    ${meta.changes.spend >= 0 ? '↗' : '↘'} ${Math.abs(meta.changes.spend).toFixed(1).replace('.', ',')}%
                  </span>
                ` : '<span class="no-data">—</span>'}
              </td>
            </tr>
            <tr>
              <td class="metric-name">Wartość rezerwacji</td>
              <td class="current-value">${formatCurrency(meta.current.reservationValue)}</td>
              <td class="previous-value">${meta.previous.reservationValue > 0 ? formatCurrency(meta.previous.reservationValue) : '<span class="no-data">Brak danych</span>'}</td>
              <td class="change-cell">
                ${meta.previous.reservationValue > 0 && meta.changes.reservationValue !== -999 ? `
                  <span class="change-indicator ${meta.changes.reservationValue >= 0 ? 'positive' : 'negative'}">
                    ${meta.changes.reservationValue >= 0 ? '↗' : '↘'} ${Math.abs(meta.changes.reservationValue).toFixed(1).replace('.', ',')}%
                  </span>
                ` : '<span class="no-data">—</span>'}
              </td>
            </tr>
            <tr class="platform-section-header">
              <td colspan="4" class="platform-header google-header">Google Ads</td>
            </tr>
            <tr>
              <td class="metric-name">Wydatki</td>
              <td class="current-value">${google.current.spend > 0 ? formatCurrency(google.current.spend) : '—'}</td>
              <td class="previous-value">${google.previous.spend > 0 ? formatCurrency(google.previous.spend) : '<span class="no-data">Brak danych</span>'}</td>
              <td class="change-cell">
                ${google.previous.spend > 0 && google.changes.spend !== -999 ? `
                  <span class="change-indicator ${google.changes.spend >= 0 ? 'positive' : 'negative'}">
                    ${google.changes.spend >= 0 ? '↗' : '↘'} ${Math.abs(google.changes.spend).toFixed(1).replace('.', ',')}%
                  </span>
                ` : '<span class="no-data">—</span>'}
              </td>
            </tr>
            <tr>
              <td class="metric-name">Wartość rezerwacji</td>
              <td class="current-value">${google.current.reservationValue > 0 ? formatCurrency(google.current.reservationValue) : '—'}</td>
              <td class="previous-value">${google.previous.reservationValue > 0 ? formatCurrency(google.previous.reservationValue) : '<span class="no-data">Brak danych</span>'}</td>
              <td class="change-cell">
                ${google.previous.reservationValue > 0 && google.changes.reservationValue !== -999 ? `
                  <span class="change-indicator ${google.changes.reservationValue >= 0 ? 'positive' : 'negative'}">
                    ${google.changes.reservationValue >= 0 ? '↗' : '↘'} ${Math.abs(google.changes.reservationValue).toFixed(1).replace('.', ',')}%
                  </span>
                ` : '<span class="no-data">—</span>'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
};

// Generate Section 3: Meta Ads Comprehensive Metrics
const generateMetaMetricsSection = (reportData: ReportData) => {
  if (!reportData.metaData) return '';
  
  const { metrics } = reportData.metaData;
  
  // Helper function to check if a metric has meaningful data
  const hasData = (value: number | undefined | null) => value !== null && value !== undefined && value > 0;
  
  // Core metrics that should always be shown if they have data
  const coreMetrics = [
    { key: 'totalSpend', label: 'Wydatki (zł)', value: metrics.totalSpend, formatter: formatCurrency },
    { key: 'totalImpressions', label: 'Wyświetlenia', value: metrics.totalImpressions, formatter: formatNumber },
    { key: 'totalClicks', label: 'Kliknięcia', value: metrics.totalClicks, formatter: formatNumber },
    { key: 'totalConversions', label: 'Konwersje', value: metrics.totalConversions, formatter: formatNumber },
  ].filter(metric => hasData(metric.value));
  
  // Meta-specific metrics (legacy metrics removed)
  const metaSpecificMetrics = [
    { key: 'relevanceScore', label: 'Ocena trafności', value: metrics.relevanceScore, formatter: (val: number) => `${val.toFixed(1)}/10` },
    { key: 'landingPageViews', label: 'Wyświetlenia strony docelowej', value: metrics.landingPageViews, formatter: formatNumber }
  ].filter(metric => hasData(metric.value));
  
  // Contact & conversion metrics
  const contactMetrics = [
    { key: 'emailContacts', label: 'Kliknięcia w adres e-mail', value: metrics.emailContacts, formatter: formatNumber },
    { key: 'phoneContacts', label: 'Kliknięcia w numer telefonu', value: metrics.phoneContacts, formatter: formatNumber },
    { key: 'totalReservations', label: 'Rezerwacje', value: metrics.totalReservations, formatter: formatNumber },
    { key: 'totalReservationValue', label: 'Wartość rezerwacji (zł)', value: metrics.totalReservationValue, formatter: formatCurrency },
    { key: 'roas', label: 'ROAS', value: metrics.roas, formatter: (val: number) => `${val.toFixed(2)}x` }
  ].filter(metric => hasData(metric.value));
  
  // Calculated offline potential metrics
  const offlineMetrics = [
    { 
      key: 'potentialOfflineReservations', 
      label: 'Potencjalna ilość rezerwacji offline', 
      value: Math.round((metrics.emailContacts + metrics.phoneContacts) * 0.2), 
      formatter: formatNumber 
    },
    { 
      key: 'potentialOfflineValue', 
      label: 'Potencjalna łączna wartość rezerwacji offline', 
      value: (() => {
        const potentialOfflineReservations = Math.round((metrics.emailContacts + metrics.phoneContacts) * 0.2);
        const averageReservationValue = metrics.totalReservations > 0 ? metrics.totalReservationValue / metrics.totalReservations : 0;
        return averageReservationValue * potentialOfflineReservations;
      })(), 
      formatter: formatCurrency 
    },
    { 
      key: 'costPerReservation', 
      label: 'Koszt pozyskania rezerwacji', 
      value: (() => {
        const potentialOfflineReservations = Math.round((metrics.emailContacts + metrics.phoneContacts) * 0.2);
        const averageReservationValue = metrics.totalReservations > 0 ? metrics.totalReservationValue / metrics.totalReservations : 0;
        const potentialOfflineValue = averageReservationValue * potentialOfflineReservations;
        const totalPotentialValue = potentialOfflineValue + metrics.totalReservationValue;
        return totalPotentialValue > 0 ? (metrics.totalSpend / totalPotentialValue) * 100 : 0;
      })(), 
      formatter: (val: number) => `${val.toFixed(1)}%` 
    },
    { 
      key: 'totalPotentialValue', 
      label: 'Łączna wartość potencjalnych rezerwacji online + offline', 
      value: (() => {
        const potentialOfflineReservations = Math.round((metrics.emailContacts + metrics.phoneContacts) * 0.2);
        const averageReservationValue = metrics.totalReservations > 0 ? metrics.totalReservationValue / metrics.totalReservations : 0;
        const potentialOfflineValue = averageReservationValue * potentialOfflineReservations;
        return potentialOfflineValue + metrics.totalReservationValue;
      })(), 
      formatter: formatCurrency 
    }
  ].filter(metric => hasData(metric.value));
  
  // Generate table rows for each section with YoY comparison
  const generateTableRows = (metrics: any[], yoyData?: any) => {
    return metrics.map(metric => {
      
      // Get YoY comparison for this metric - dynamic mapping
      let yoyIndicator = '';
      if (yoyData && yoyData.changes) {
        let change = 0;
        
        // Map metric keys to YoY data fields
        switch (metric.key) {
          case 'totalSpend':
            change = yoyData.changes?.spend || 0;
            break;
          case 'totalImpressions':
            change = yoyData.changes?.impressions || 0;
            break;
          case 'totalClicks':
            change = yoyData.changes?.clicks || 0;
            break;
          case 'totalConversions':
            change = yoyData.changes?.reservations || 0;
            break;
          case 'totalReservationValue':
            // YoY API doesn't include reservation_value, so we'll calculate it manually
            if (yoyData.current && yoyData.previous) {
              const currentValue = yoyData.current.reservations || 0;
              const previousValue = yoyData.previous.reservations || 0;
              if (previousValue > 0) {
                change = ((currentValue - previousValue) / previousValue) * 100;
              } else {
                change = -999; // No previous data
              }
            } else {
              change = -999;
            }
            break;
          case 'totalReservations':
            change = yoyData.changes?.reservations || 0;
            break;
          case 'bookingStep1':
            change = yoyData.changes?.booking_step_1 || 0;
            break;
          case 'bookingStep2':
            change = yoyData.changes?.booking_step_2 || 0;
            break;
          case 'bookingStep3':
            change = yoyData.changes?.booking_step_3 || 0;
            break;
          default:
            change = 0;
        }
        
        
        // Only show indicator if we have meaningful change and valid historical data
        if (change !== -999 && change !== 0 && Math.abs(change) >= 0.01) {
          const isPositive = change >= 0;
          yoyIndicator = `
            <span class="change-indicator ${isPositive ? 'positive' : 'negative'}">
              ${isPositive ? '↗' : '↘'} ${Math.abs(change).toFixed(1).replace('.', ',')}%
            </span>
          `;
        } else if (change === -999) {
          // Show "N/A" for no historical data
          yoyIndicator = `
            <span class="change-indicator no-data">
              N/A
            </span>
          `;
        }
      }
      
      return `
        <tr>
          <td class="metric-name">${metric.label}</td>
          <td class="metric-value">${metric.formatter(metric.value)}</td>
          <td class="change-cell">${yoyIndicator || '—'}</td>
        </tr>
      `;
    }).join('');
  };
  
  // Get YoY data for Meta
  const metaYoYData = reportData.yoyComparison?.meta;
  
  // Debug YoY data
  logger.info('🔍 META YOY DATA DEBUG:', {
    hasYoYData: !!metaYoYData,
    changes: metaYoYData?.changes,
    current: metaYoYData?.current,
    previous: metaYoYData?.previous
  });
  
  let sectionsHTML = '';
  
  // Core Metrics Section
  if (coreMetrics.length > 0) {
    sectionsHTML += `
      <h3 class="table-title">Podstawowe Metryki</h3>
        <table class="metrics-table">
          <thead>
            <tr>
              <th>Metryka</th>
              <th>Wartość</th>
              <th>vs rok do roku</th>
            </tr>
          </thead>
          <tbody>
          ${generateTableRows(coreMetrics, metaYoYData)}
        </tbody>
      </table>
    `;
  }
  
  // Meta-Specific Metrics Section
  if (metaSpecificMetrics.length > 0) {
    sectionsHTML += `
      <h3 class="table-title">Metryki Meta-Specific</h3>
      <table class="metrics-table">
        <thead>
          <tr>
            <th>Metryka</th>
            <th>Wartość</th>
            <th>vs rok do roku</th>
            </tr>
        </thead>
        <tbody>
          ${generateTableRows(metaSpecificMetrics, metaYoYData)}
        </tbody>
      </table>
    `;
  }
  
  // Contact & Conversion Metrics Section
  if (contactMetrics.length > 0) {
    sectionsHTML += `
      <h3 class="table-title">Kontakt i Konwersje</h3>
      <table class="metrics-table">
        <thead>
          <tr>
            <th>Metryka</th>
            <th>Wartość</th>
            <th>vs rok do roku</th>
            </tr>
        </thead>
        <tbody>
          ${generateTableRows(contactMetrics, metaYoYData)}
          </tbody>
        </table>
    `;
  }
  
  // Offline Potential Metrics Section
  if (offlineMetrics.length > 0) {
    sectionsHTML += `
      <h3 class="table-title">Potencjalne Metryki Offline</h3>
      <table class="metrics-table">
        <thead>
          <tr>
            <th>Metryka</th>
            <th>Wartość</th>
            <th>vs rok do roku</th>
            </tr>
        </thead>
        <tbody>
          ${generateTableRows(offlineMetrics, metaYoYData)}
          </tbody>
        </table>
    `;
  }
  
  // Only return the section if there are metrics to display
  if (sectionsHTML) {
    return `
      <div class="section-container">
        <div class="page-content">
          <h2 class="section-title">Meta Ads - Kompletne Metryki</h2>
          ${sectionsHTML}
      </div>
    </div>
  `;
  }
  
  return '';
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

  // Professional navy blue color scheme for funnel steps
  const funnelSteps = [
    {
      label: "Krok 1 w BE",
      value: booking_step_1,
      percentage: 100,
      bgColor: "background: linear-gradient(135deg, #0B1F3B 0%, #1e293b 100%)"
    },
    {
      label: "Krok 2 w BE", 
      value: booking_step_2,
      percentage: booking_step_1 > 0 ? Math.round((booking_step_2 / booking_step_1) * 100) : 0,
      bgColor: "background: linear-gradient(135deg, #1e293b 0%, #334155 100%)"
    },
    {
      label: "Krok 3 w BE",
      value: booking_step_3,
      percentage: booking_step_1 > 0 ? Math.round((booking_step_3 / booking_step_1) * 100) : 0,
      bgColor: "background: linear-gradient(135deg, #334155 0%, #475569 100%)"
    },
    {
      label: "Ilość rezerwacji",
      value: reservations,
      percentage: booking_step_1 > 0 ? Math.round((reservations / booking_step_1) * 100) : 0,
      bgColor: "background: linear-gradient(135deg, #475569 0%, #64748b 100%)"
    }
  ];

  const bottomCards = [
    {
      label: "Wartość rezerwacji (zł)",
      value: reservation_value,
      bgColor: "background: linear-gradient(135deg, #0B1F3B 0%, #1e40af 100%)"
    },
    {
      label: "ROAS",
      value: roas,
      bgColor: "background: linear-gradient(135deg, #1e40af 0%, #0B1F3B 100%)"
    }
  ];

  const funnelStepsHTML = funnelSteps.map((step, index) => `
    <div style="
      position: relative;
      ${step.bgColor};
      text-align: center;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      clip-path: ${createFunnelPath(index)};
      width: 600px;
      height: 90px;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="display: flex; align-items: center; justify-content: center; padding: 0 32px;">
        <div style="text-align: center; position: relative; min-width: 0; flex: 1;">
          <div style="font-size: 20px; font-weight: 700; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${formatNumber(step.value)}
        </div>
          <div style="font-size: 12px; color: white; opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${step.label}
                </div>
              </div>
            </div>
    </div>
  `).join('');

  const bottomCardsHTML = bottomCards.map(card => `
    <div style="
      ${card.bgColor};
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.05);
      color: white;
    ">
      <div style="margin-bottom: 8px;">
        <div style="font-size: 18px; font-weight: 700;">
          ${card.label === 'ROAS' ? `${card.value.toFixed(2)}x` : formatCurrency(card.value)}
                </div>
              </div>
      <div style="font-size: 12px; opacity: 0.9;">
        ${card.label}
            </div>
    </div>
  `).join('');
          
          return `
      <div style="text-align: center; margin-bottom: 32px;">
        <h3 style="color: #1e293b; font-size: 24px; font-weight: 700; margin: 0 0 8px 0;">Ścieżka Konwersji ${platform}</h3>
        <p style="color: #64748b; font-size: 16px; margin: 0;">System rezerwacji online</p>
                </div>
      
      <div style="display: flex; flex-direction: column; align-items: center; gap: 16px;">
        ${funnelStepsHTML}
        
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 32px; width: 100%; max-width: 512px;">
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

// Generate Section 5: Google Ads Comprehensive Metrics
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

  // Helper function to check if a metric has meaningful data
  const hasData = (value: number | undefined | null) => value !== null && value !== undefined && value > 0;
  
  // Debug Google Ads metrics
  logger.info('🔍 GOOGLE ADS METRICS DEBUG:', {
    totalSpend: metrics.totalSpend,
    totalImpressions: metrics.totalImpressions,
    totalClicks: metrics.totalClicks,
    totalConversions: metrics.totalConversions,
    averageCtr: metrics.averageCtr,
    averageCpc: metrics.averageCpc,
    metricsKeys: Object.keys(metrics)
  });
  
  // Core metrics that should always be shown if they have data
  const coreMetrics = [
    { key: 'totalSpend', label: 'Wydatki (zł)', value: metrics.totalSpend, formatter: formatCurrency },
    { key: 'totalImpressions', label: 'Wyświetlenia', value: metrics.totalImpressions, formatter: formatNumber },
    { key: 'totalClicks', label: 'Kliknięcia', value: metrics.totalClicks, formatter: formatNumber },
    { key: 'totalConversions', label: 'Konwersje', value: metrics.totalConversions, formatter: formatNumber },
  ];
  
  // Debug filtered metrics
  const filteredCoreMetrics = coreMetrics.filter(metric => hasData(metric.value));
  logger.info('🔍 GOOGLE ADS FILTERED CORE METRICS:', {
    originalCount: coreMetrics.length,
    filteredCount: filteredCoreMetrics.length,
    filteredMetrics: filteredCoreMetrics.map(m => ({ key: m.key, value: m.value }))
  });
  
  // Google-specific metrics
  const googleSpecificMetrics = [
    { key: 'searchImpressionShare', label: 'Udział w wyświetleniach wyszukiwania (%)', value: metrics.searchImpressionShare, formatter: formatPercentage },
    { key: 'qualityScore', label: 'Ocena jakości', value: metrics.qualityScore, formatter: (val: number) => `${val.toFixed(1)}/10` },
    { key: 'viewThroughConversions', label: 'Konwersje view-through', value: metrics.viewThroughConversions, formatter: formatNumber },
    { key: 'searchBudgetLostImpressionShare', label: 'Utracone wyświetlenia (budżet) (%)', value: metrics.searchBudgetLostImpressionShare, formatter: formatPercentage }
  ].filter(metric => hasData(metric.value));
  
  // Contact & conversion metrics
  const contactMetrics = [
    { key: 'emailContacts', label: 'Kliknięcia w adres e-mail', value: metrics.emailContacts, formatter: formatNumber },
    { key: 'phoneContacts', label: 'Kliknięcia w numer telefonu', value: metrics.phoneContacts, formatter: formatNumber },
    { key: 'totalReservations', label: 'Rezerwacje', value: metrics.totalReservations, formatter: formatNumber },
    { key: 'totalReservationValue', label: 'Wartość rezerwacji (zł)', value: metrics.totalReservationValue, formatter: formatCurrency },
    { key: 'roas', label: 'ROAS', value: metrics.roas, formatter: (val: number) => `${val.toFixed(2)}x` }
  ].filter(metric => hasData(metric.value));
  
  // Calculated offline potential metrics
  const offlineMetrics = [
    { 
      key: 'potentialOfflineReservations', 
      label: 'Potencjalna ilość rezerwacji offline', 
      value: Math.round((metrics.emailContacts + metrics.phoneContacts) * 0.2), 
      formatter: formatNumber 
    },
    { 
      key: 'potentialOfflineValue', 
      label: 'Potencjalna łączna wartość rezerwacji offline', 
      value: (() => {
        const potentialOfflineReservations = Math.round((metrics.emailContacts + metrics.phoneContacts) * 0.2);
        const averageReservationValue = metrics.totalReservations > 0 ? metrics.totalReservationValue / metrics.totalReservations : 0;
        return averageReservationValue * potentialOfflineReservations;
      })(), 
      formatter: formatCurrency 
    },
    { 
      key: 'costPerReservation', 
      label: 'Koszt pozyskania rezerwacji', 
      value: (() => {
        const potentialOfflineReservations = Math.round((metrics.emailContacts + metrics.phoneContacts) * 0.2);
        const averageReservationValue = metrics.totalReservations > 0 ? metrics.totalReservationValue / metrics.totalReservations : 0;
        const potentialOfflineValue = averageReservationValue * potentialOfflineReservations;
        const totalPotentialValue = potentialOfflineValue + metrics.totalReservationValue;
        return totalPotentialValue > 0 ? (metrics.totalSpend / totalPotentialValue) * 100 : 0;
      })(), 
      formatter: (val: number) => `${val.toFixed(1)}%` 
    },
    { 
      key: 'totalPotentialValue', 
      label: 'Łączna wartość potencjalnych rezerwacji online + offline', 
      value: (() => {
        const potentialOfflineReservations = Math.round((metrics.emailContacts + metrics.phoneContacts) * 0.2);
        const averageReservationValue = metrics.totalReservations > 0 ? metrics.totalReservationValue / metrics.totalReservations : 0;
        const potentialOfflineValue = averageReservationValue * potentialOfflineReservations;
        return potentialOfflineValue + metrics.totalReservationValue;
      })(), 
      formatter: formatCurrency 
    }
  ].filter(metric => hasData(metric.value));
  
  // Generate table rows for each section with YoY comparison
  const generateTableRows = (metrics: any[], yoyData?: any) => {
    return metrics.map(metric => {
      // Get YoY comparison for this metric - dynamic mapping
      let yoyIndicator = '';
      if (yoyData && yoyData.changes) {
        let change = 0;
        
        // Map metric keys to YoY data fields
        switch (metric.key) {
          case 'totalSpend':
            change = yoyData.changes?.spend || 0;
            break;
          case 'totalImpressions':
            change = yoyData.changes?.impressions || 0;
            break;
          case 'totalClicks':
            change = yoyData.changes?.clicks || 0;
            break;
          case 'totalConversions':
            change = yoyData.changes?.reservations || 0;
            break;
          case 'totalReservationValue':
            // YoY API doesn't include reservation_value, so we'll calculate it manually
            if (yoyData.current && yoyData.previous) {
              const currentValue = yoyData.current.reservations || 0;
              const previousValue = yoyData.previous.reservations || 0;
              if (previousValue > 0) {
                change = ((currentValue - previousValue) / previousValue) * 100;
              } else {
                change = -999; // No previous data
              }
            } else {
              change = -999;
            }
            break;
          case 'totalReservations':
            change = yoyData.changes?.reservations || 0;
            break;
          case 'bookingStep1':
            change = yoyData.changes?.booking_step_1 || 0;
            break;
          case 'bookingStep2':
            change = yoyData.changes?.booking_step_2 || 0;
            break;
          case 'bookingStep3':
            change = yoyData.changes?.booking_step_3 || 0;
            break;
          default:
            change = 0;
        }
        
        // Only show indicator if we have meaningful change and valid historical data
        if (change === -999) {
          // Show "Brak danych" for no historical data (same as reports page)
          yoyIndicator = `
            <span class="change-indicator no-data">
              Brak danych
            </span>
          `;
        } else if (change !== 0 && Math.abs(change) >= 0.01 && Math.abs(change) < 999) {
          // Only show percentage if it's a reasonable value (not 999% which indicates calculation error)
          const isPositive = change >= 0;
          yoyIndicator = `
            <span class="change-indicator ${isPositive ? 'positive' : 'negative'}">
              ${isPositive ? '↗' : '↘'} ${Math.abs(change).toFixed(1).replace('.', ',')}%
            </span>
          `;
        } else if (Math.abs(change) >= 999) {
          // Show "Brak danych" for unreasonable percentages (likely calculation errors)
          yoyIndicator = `
            <span class="change-indicator no-data">
              Brak danych
            </span>
          `;
        }
      }
      
      return `
        <tr>
          <td class="metric-name">${metric.label}</td>
          <td class="metric-value">${metric.formatter(metric.value)}</td>
          <td class="change-cell">${yoyIndicator || '—'}</td>
        </tr>
      `;
    }).join('');
  };
  
  // Get YoY data for Google Ads
  const googleYoYData = reportData.yoyComparison?.google;
  
  // Debug YoY data
  logger.info('🔍 GOOGLE YOY DATA DEBUG:', {
    hasYoYData: !!googleYoYData,
    changes: googleYoYData?.changes,
    current: googleYoYData?.current,
    previous: googleYoYData?.previous
  });
  
  let sectionsHTML = '';
  
  // Core Metrics Section
  if (filteredCoreMetrics.length > 0) {
    sectionsHTML += `
      <h3 class="table-title">Podstawowe Metryki</h3>
        <table class="metrics-table">
          <thead>
            <tr>
              <th>Metryka</th>
              <th>Wartość</th>
              <th>vs rok do roku</th>
            </tr>
          </thead>
          <tbody>
          ${generateTableRows(filteredCoreMetrics, googleYoYData)}
        </tbody>
      </table>
    `;
  } else {
    logger.warn('⚠️ No Google Ads core metrics to display');
  }
  
  // Google-Specific Metrics Section
  if (googleSpecificMetrics.length > 0) {
    sectionsHTML += `
      <h3 class="table-title">Metryki Google-Specific</h3>
      <table class="metrics-table">
        <thead>
          <tr>
            <th>Metryka</th>
            <th>Wartość</th>
            <th>vs rok do roku</th>
            </tr>
        </thead>
        <tbody>
          ${generateTableRows(googleSpecificMetrics, googleYoYData)}
        </tbody>
      </table>
    `;
  }
  
  // Contact & Conversion Metrics Section
  if (contactMetrics.length > 0) {
    sectionsHTML += `
      <h3 class="table-title">Kontakt i Konwersje</h3>
      <table class="metrics-table">
        <thead>
          <tr>
            <th>Metryka</th>
            <th>Wartość</th>
            <th>vs rok do roku</th>
            </tr>
        </thead>
        <tbody>
          ${generateTableRows(contactMetrics, googleYoYData)}
          </tbody>
        </table>
    `;
  }
  
  // Only return the section if there are metrics to display
  if (sectionsHTML) {
    return `
      <div class="section-container">
        <div class="page-content">
          <h2 class="section-title">Google Ads - Kompletne Metryki</h2>
          ${sectionsHTML}
        </div>
      </div>
    `;
  }
  
  return '';
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
  logger.info('🔍 DEMOGRAPHIC CHARTS GENERATION:', {
    hasDemographicData: !!demographicData,
    demographicDataLength: demographicData?.length || 0,
    demographicDataType: typeof demographicData,
    demographicDataSample: demographicData?.slice(0, 2) || []
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
  const validData = demographicData.filter(item => 
    item && 
    typeof item === 'object' && 
    (item.age || item.gender) && 
    typeof item.spend === 'number' && 
    item.spend > 0
  );
  
  logger.info('🔍 VALID DEMOGRAPHIC DATA:', {
    originalLength: demographicData.length,
    validLength: validData.length,
    validDataSample: validData.slice(0, 2)
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

  // Generate charts for both Reservation Value and Clicks metrics (matching MetaAdsTables.tsx)
  const generateChartsForMetric = (metric: 'reservation_value' | 'clicks') => {
    // Process gender data for the specific metric
  const genderMap = new Map();
    validData.forEach(item => {
    let gender = item.gender || 'Nieznane';
    // Ensure gender labels are in Polish
    if (gender.toLowerCase() === 'female') gender = 'Kobiety';
    else if (gender.toLowerCase() === 'male') gender = 'Mężczyźni';
    else if (gender.toLowerCase() === 'unknown') gender = 'Nieznane';
      const value = metric === 'reservation_value' ? (item.reservation_value || 0) : (item.clicks || 0);
      genderMap.set(gender, (genderMap.get(gender) || 0) + value);
  });

    // Process age data for the specific metric
  const ageMap = new Map();
    validData.forEach(item => {
    let age = item.age || 'Nieznane';
    // Ensure age labels are in Polish
    if (age.toLowerCase() === 'unknown') age = 'Nieznane';
      const value = metric === 'reservation_value' ? (item.reservation_value || 0) : (item.clicks || 0);
      ageMap.set(age, (ageMap.get(age) || 0) + value);
  });

  const genderEntries = Array.from(genderMap.entries()).sort((a, b) => b[1] - a[1]);
  const ageEntries = Array.from(ageMap.entries()).sort((a, b) => b[1] - a[1]);

    const genderTotal = genderEntries.reduce((sum, [, value]) => sum + value, 0);
    const ageTotal = ageEntries.reduce((sum, [, value]) => sum + value, 0);

    const metricLabel = metric === 'reservation_value' ? 'Wartość rezerwacji' : 'Kliknięcia';
    const formatValue = metric === 'reservation_value' 
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

  return `
    <div class="demographics-section">
      <h4 class="demographics-title">Analiza Demograficzna</h4>
      
      ${generateChartsForMetric('reservation_value')}
      ${generateChartsForMetric('clicks')}
    </div>
  `;
};

// Generate Section 7: Meta Ads Campaign Details
const generateMetaCampaignDetailsSection = (reportData: ReportData) => {
  if (!reportData.metaData) return '';
  
  const { campaigns, tables } = reportData.metaData;
  // Show ALL campaigns with spend data, exactly like /reports page
  const campaignsWithSpend = campaigns.filter(campaign => (campaign.spend || 0) > 0);
  
  // Don't generate section if no campaigns with spend
  if (campaignsWithSpend.length === 0) return '';
  
  return `
    <div class="campaign-details-section" style="padding: 0 2mm;">
      <h2 class="section-title">Meta Ads - Szczegóły Kampanii</h2>
        
        <!-- All Campaigns Table - Matching /reports page exactly -->
        <div class="campaigns-table">
          <h3 class="table-title">Aktywne Kampanie</h3>
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
              ${campaignsWithSpend.map(campaign => `
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
  // Show ALL campaigns with spend data, exactly like /reports page
  const campaignsWithSpend = campaigns.filter(campaign => (campaign.spend || 0) > 0);
  
  // Don't generate section if no campaigns with spend
  if (campaignsWithSpend.length === 0) return '';
  
  return `
    <div class="campaign-details-section" style="padding: 0 2mm;">
      <h2 class="section-title">Google Ads - Szczegóły Kampanii</h2>
        
        <!-- All Campaigns Table - Matching /reports page exactly -->
        <div class="campaigns-table">
          <h3 class="table-title">Aktywne Kampanie</h3>
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
              ${campaignsWithSpend.map(campaign => `
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
            /* Design System Tokens */
            :root {
                --color-primary-navy: #0B1F3B;
                --color-accent-orange: #FF6A00;
                --gray-900: #111827;
                --gray-700: #374151;
                --gray-500: #6B7280;
                --gray-200: #E5E7EB;
                --gray-50: #F8FAFC;
                
                /* Typography Scale */
                --font-h1: 32px;
                --font-h2: 20px;
                --font-body: 12px;
                --font-kpi: 28px;
                --font-label: 11px;
                
                /* Spacing System (8pt) */
                --space-xs: 4px;
                --space-sm: 8px;
                --space-md: 16px;
                --space-lg: 24px;
                --space-xl: 32px;
            }
            
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
                line-height: 1.5;
                color: var(--gray-900);
                background: #ffffff;
                font-size: var(--font-body);
            }
            
            /* A4 Page Layout */
            .title-page {
                padding: 0;
                max-width: 210mm;
            }
            
            .page-break-before {
                page-break-before: always;
                padding: 0;
                max-width: 210mm;
                min-height: 297mm;
                margin: 0 auto;
            }
            
            .section-container {
                padding: 0;
                max-width: 210mm;
                margin: 0 auto;
                margin-top: 40px;
            }
            
            .section-container:first-child {
                margin-top: 0;
            }
            
            .page-content {
                max-width: 100%;
                margin: 0 auto;
                width: 100%;
                padding: 0 5mm;
            }
            
            /* Special styling for campaign details pages */
            .campaign-details-section .page-content {
                padding: 0 2mm;
            }
            
            /* Typography Hierarchy */
            .h1 {
                font-size: var(--font-h1);
                line-height: 36px;
                font-weight: 600;
                color: var(--color-primary-navy);
                margin-bottom: var(--space-lg);
            }
            
            .h2, .section-title {
                font-size: var(--font-h2);
                line-height: 26px;
                font-weight: 600;
                color: var(--color-primary-navy);
                margin-bottom: var(--space-lg);
                text-align: left;
                border-bottom: 1px solid var(--gray-200);
                padding-bottom: var(--space-sm);
            }
            
            .body-text {
                font-size: var(--font-body);
                line-height: 18px;
                font-weight: 400;
                color: var(--gray-700);
            }
            
            /* Clean Cover Page */
            .clean-title-section {
                text-align: center;
                padding: 0;
            }
            
            .clean-logo-container {
                margin-bottom: var(--space-xl);
            }
            
            .clean-client-logo {
                max-height: 80px;
                max-width: 200px;
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
            
            
            /* YoY Section */
            .yoy-section {
                padding: 0;
            }
            
            .comparison-table-container {
                margin-top: 40px;
            }
            
            /* Clean Table Design */
            .data-table, .comparison-table, .metrics-table {
                width: 100%;
                border-collapse: collapse;
                background: white;
                margin: var(--space-lg) 0;
            }
            
            .data-table th, .comparison-table th, .metrics-table th {
                background: var(--gray-50);
                color: var(--gray-900);
                padding: 12px var(--space-md);
                text-align: left;
                font-weight: 600;
                font-size: var(--font-label);
                text-transform: uppercase;
                letter-spacing: 0.05em;
                border-bottom: 1px solid var(--gray-200);
            }
            
            .data-table td, .comparison-table td, .metrics-table td {
                padding: 10px var(--space-md);
                font-size: var(--font-body);
                border-bottom: none;
            }
            
            .data-table tr:nth-child(even), 
            .comparison-table tr:nth-child(even), 
            .metrics-table tr:nth-child(even) {
                background: #FAFAFA;
            }
            
            .platform-section-header {
                border-top: 3px solid var(--gray-200);
            }
            
            .platform-header {
                background: var(--color-primary-navy);
                color: white;
                font-weight: 700;
                font-size: 16px;
                text-align: center;
                padding: 16px 20px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }
            
            .meta-header {
                background: #1e40af;
            }
            
            .google-header {
                background: #059669;
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
                font-size: var(--font-label);
                font-weight: 600;
                padding: var(--space-xs) var(--space-sm);
                border-radius: 4px;
                display: inline-block;
            }
            
            .positive {
                color: var(--color-accent-orange);
            }
            
            .negative {
                color: var(--gray-500);
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
            
            /* Demographics */
            .demographics-section {
                margin: 40px 0;
                padding: 32px 0;
                border-top: 1px solid #e2e8f0;
            }
            
            .demographics-title {
                font-size: 20px;
                font-weight: 700;
                color: #1e293b;
                margin-bottom: 24px;
                text-align: center;
            }
            
            .metric-section {
                margin-bottom: 40px;
                padding: 20px 0;
                border-bottom: 1px solid #e2e8f0;
            }
            
            .metric-section:last-child {
                border-bottom: none;
            }
            
            .metric-title {
                font-size: 18px;
                font-weight: 600;
                color: #1e293b;
                margin-bottom: 20px;
                text-align: center;
                background: #f8fafc;
                padding: 10px 20px;
                border-radius: 8px;
                border: 1px solid #e2e8f0;
            }
            
            .demographics-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 32px;
            }
            
            .demographic-chart {
                text-align: center;
            }
            
            .demographic-chart h5 {
                font-size: 16px;
                font-weight: 600;
                color: #1e293b;
                margin-bottom: 16px;
                text-align: center;
            }
            
            .pie-chart-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 16px;
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
                gap: 8px;
                min-width: 200px;
            }
            
            .legend-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 4px 0;
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
                font-size: 11px;
            }
            
            .legend-label {
                font-weight: 600;
                color: #1e293b;
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
                color: #475569;
                font-size: 10px;
            }
            
            .legend-percentage {
                font-weight: 700;
                color: #1e293b;
                font-size: 11px;
            }
            
            .no-data {
                text-align: center;
                color: #64748b;
                font-style: italic;
                padding: 40px;
            }
            
            /* Premium Footer */
            .footer-section {
                margin-top: 40px;
                padding: 0;
                position: relative;
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

// Helper function to fetch data using EXACTLY same system as /reports page
async function fetchReportData(clientId: string, dateRange: { start: string; end: string }, request: NextRequest): Promise<ReportData> {
  logger.info('📊 PDF Generation using EXACT same system as reports page');
  
  // 🔓 AUTH DISABLED: Same as reports page - no authentication required
  logger.info('🔓 Authentication disabled for PDF generation (same as reports page)');
  
  // Get client data using same pattern as reports page (no auth)
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
          headers: { 'Content-Type': 'application/json' },
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
          headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
          'Content-Type': 'application/json'
          // No Authorization header (same as reports page)
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
          
          logger.info('🔍 PDF DEMOGRAPHIC DATA ASSIGNED:', {
            demographicLength: reportData.metaData.tables.demographicPerformance.length,
            demographicSample: reportData.metaData.tables.demographicPerformance.slice(0, 2)
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
        'Content-Type': 'application/json'
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
    
    // 🔓 AUTH DISABLED: Same as reports page - no authentication required
    logger.info('🔓 Authentication disabled for PDF generation (same as reports page)');

    logger.info('🔄 Fetching report data from same sources as /reports page...');
    let reportData: ReportData;
    
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

    logger.info('🚀 Launching Puppeteer...');
    let browser;
    
    try {
      browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    const page = await browser.newPage();
    
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
      timeout: 60000 // Add PDF generation timeout
    });

    await browser.close();

      logger.info('✅ New PDF generated successfully with 8 sections');

      // Encode filename to handle non-ASCII characters
      const sanitizedClientName = reportData.clientName
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 50);
    
    const filename = `raport_kampanii_${sanitizedClientName}_${new Date().toISOString().split('T')[0]}.pdf`;
    const encodedFilename = encodeURIComponent(filename);
    
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
      
      // Ensure browser is closed
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          logger.error('❌ Error closing browser:', closeError);
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
