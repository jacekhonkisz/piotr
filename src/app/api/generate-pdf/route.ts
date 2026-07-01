import { NextRequest, NextResponse } from 'next/server';
import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import logger from '@/lib/logger';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { authenticateRequest } from '@/lib/auth-middleware';
import { getPdfBrandLogoDataUrl } from '@/lib/pdf-brand-logo';
import {
  getBelmontePotentialOfflineValue,
  getMicroConversionsForOfflineModel,
  isBelmonteClient,
  offlineMicroPartsFromPlatformMetrics,
} from '@/lib/offline-reservation-estimate';
import { PDFDocument } from 'pdf-lib';
import {
  mergeWithDefaults,
  normalizeConfigForPlatform,
  isMetricVisible,
  getMetricName,
  type MetricConfigItem,
  type MetricSection,
} from '@/lib/default-metrics-config';
import { getConfiguredColumns } from '@/lib/configured-report-columns';
import { googleAdsDeviceLabelPl } from '@/lib/google-ads-device-pl';
import { cpcBlended, cpcFromStats, ctrPercentBlended, ctrPercentFromStats } from '@/lib/ctr-from-stats';

async function countPdfPages(buffer: Buffer): Promise<number> {
  const doc = await PDFDocument.load(buffer);
  return doc.getPageCount();
}

async function pdfExtractFirstPage(pdfBuffer: Buffer): Promise<Buffer> {
  const src = await PDFDocument.load(pdfBuffer);
  const dest = await PDFDocument.create();
  const [p] = await dest.copyPages(src, [0]);
  dest.addPage(p);
  return Buffer.from(await dest.save());
}

async function pdfMergeBuffers(parts: Buffer[]): Promise<Buffer> {
  const merged = await PDFDocument.create();
  for (const part of parts) {
    const doc = await PDFDocument.load(part);
    const copied = await merged.copyPages(doc, doc.getPageIndices());
    copied.forEach((page) => merged.addPage(page));
  }
  return Buffer.from(await merged.save());
}

/** Escapes for double-quoted HTML attributes (Puppeteer footerTemplate img src). */
function escapeHtmlAttrForPdf(dataUrl: string): string {
  return dataUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function buildPuppeteerFooterTemplate(logoDataUrl: string): string {
  const safe = escapeHtmlAttrForPdf(logoDataUrl);
  return `<div style="font-size:1px;width:100%;text-align:center;margin:0;padding:4px 0 0 0;box-sizing:border-box;">
  <img src="${safe}" alt="" style="height:11mm;max-width:42mm;object-fit:contain;display:inline-block;vertical-align:bottom;opacity:0.92;" />
</div>`;
}

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const serverSupabase = supabaseAdmin ?? supabase;

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
  mediaEnabled?: {
    meta: boolean;
    google: boolean;
  };
  
  // Year-over-year comparison data
  yoyComparison?: {
    meta: {
      current: {
        spend: number;
        reservationValue: number;
        impressions?: number;
        clicks?: number;
        reservations?: number;
        conversions?: number;
        booking_step_1?: number;
        booking_step_2?: number;
        booking_step_3?: number;
      };
      previous: {
        spend: number;
        reservationValue: number;
        impressions?: number;
        clicks?: number;
        reservations?: number;
        conversions?: number;
        booking_step_1?: number;
        booking_step_2?: number;
        booking_step_3?: number;
      };
      changes: {
        spend: number;
        reservationValue: number;
        impressions?: number;
        clicks?: number;
        reservations?: number;
        conversions?: number;
        booking_step_1?: number;
        booking_step_2?: number;
        booking_step_3?: number;
      };
    };
    google: {
      current: {
        spend: number;
        reservationValue: number;
        impressions?: number;
        clicks?: number;
        reservations?: number;
        conversions?: number;
        booking_step_1?: number;
        booking_step_2?: number;
        booking_step_3?: number;
      };
      previous: {
        spend: number;
        reservationValue: number;
        impressions?: number;
        clicks?: number;
        reservations?: number;
        conversions?: number;
        booking_step_1?: number;
        booking_step_2?: number;
        booking_step_3?: number;
      };
      changes: {
        spend: number;
        reservationValue: number;
        impressions?: number;
        clicks?: number;
        reservations?: number;
        conversions?: number;
        booking_step_1?: number;
        booking_step_2?: number;
        booking_step_3?: number;
      };
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
      total_conversion_value?: number;
      roas: number;
    };
    tables: {
      placementPerformance: any[];
      demographicPerformance: any[];
      adRelevanceResults: any[];
      geographicPerformance?: any[];
    };
  };
  
  /** Merged per-client dashboard config (drives PDF KPI visibility, same as Metryki). */
  metricsConfig?: {
    meta: MetricConfigItem[];
    google: MetricConfigItem[];
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
      total_conversion_value?: number;
      roas: number;
    };
    tables: {
      networkPerformance: any[];
      devicePerformance: any[];
      keywordPerformance: any[];
      searchTermPerformance?: any[];
      demographicPerformance?: any[];
      geographicPerformance?: any[];
      qualityMetrics?: any[];
    };
  };
}

interface Client {
  id: string;
  name: string;
  email: string;
}

function pdfMetricVisible(
  reportData: ReportData,
  platform: 'meta' | 'google',
  section: MetricSection,
  key: string
): boolean {
  const raw =
    platform === 'meta'
      ? reportData.metricsConfig?.meta
      : reportData.metricsConfig?.google;
  if (!raw || raw.length === 0) return true;
  return isMetricVisible(raw, section, key);
}

function pdfMetricLabel(
  reportData: ReportData,
  platform: 'meta' | 'google',
  section: MetricSection,
  key: string,
  fallback: string
): string {
  const raw =
    platform === 'meta'
      ? reportData.metricsConfig?.meta
      : reportData.metricsConfig?.google;
  if (!raw || raw.length === 0) return fallback;
  return getMetricName(raw, section, key);
}

// Helper functions for formatting
const formatCurrency = (value: number | undefined | null) => {
  if (value === undefined || value === null || isNaN(value) || value === 0) return '—';
  // Use NBSPs between digits AND before the currency suffix so the value
  // never wraps mid-number or leaves "zł" on a new line inside a table cell.
  const num = value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, '\u00A0');
  return `${num}\u00A0zł`;
};

const formatNumber = (value: number | undefined | null, decimals: number = 0) => {
  if (value === undefined || value === null || isNaN(value) || value === 0) return '—';
  return value.toLocaleString('pl-PL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).replace(/\s/g, '\u00A0');
};

const formatCompactNumber = (value: number | undefined | null, decimals: number = 0) =>
  formatNumber(value, decimals);

const formatPercentage = (value: number | undefined | null) => {
  if (value === undefined || value === null || isNaN(value) || value === 0) return '—';
  return `${value.toFixed(2).replace('.', ',')}\u2060%`;
};

const formatCurrencyNonBreaking = formatCurrency;
const formatNumberNonBreaking = formatNumber;
const formatPercentNonBreaking = formatPercentage;

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('pl-PL', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

/** Offline 20% model — aligned with generate-report (Belmonte: Meta-only micro pool). */
function computeOfflinePotentialFromReportData(reportData: ReportData) {
  const clientName = reportData.clientName || '';
  const g = reportData.googleData;
  const m = reportData.metaData;
  const parts = offlineMicroPartsFromPlatformMetrics(
    g
      ? {
          booking_step_1: g.funnel?.booking_step_1 ?? 0,
          email_contacts: g.metrics?.emailContacts ?? 0,
          click_to_call: g.metrics?.phoneContacts ?? 0,
        }
      : undefined,
    m
      ? {
          booking_step_1: m.funnel?.booking_step_1 ?? 0,
          email_contacts: m.metrics?.emailContacts ?? 0,
          click_to_call: m.metrics?.phoneContacts ?? 0,
        }
      : undefined
  );
  const metaCampaignsOnly = (m?.campaigns || []) as any[];
  const microTotal = getMicroConversionsForOfflineModel(clientName, parts, {
    metaCampaigns: metaCampaignsOnly,
  });
  const potentialOfflineReservations = Math.round(microTotal * 0.2);
  const totalReservationsCombined =
    (reportData.metaData?.metrics.totalReservations ?? 0) +
    (reportData.googleData?.metrics.totalReservations ?? 0);
  const totalReservationValueCombined =
    (reportData.metaData?.metrics.totalReservationValue ?? 0) +
    (reportData.googleData?.metrics.totalReservationValue ?? 0);
  let averageReservationValue =
    totalReservationsCombined > 0 ? totalReservationValueCombined / totalReservationsCombined : 0;
  if (isBelmonteClient(clientName)) {
    const tr = metaCampaignsOnly.reduce((s, c) => s + (Number(c.reservations) || 0), 0);
    const tv = metaCampaignsOnly.reduce((s, c) => s + (Number(c.reservation_value) || 0), 0);
    if (tr > 0) {
      averageReservationValue = tv / tr;
    }
  }
  const potentialOfflineValue = isBelmonteClient(clientName)
    ? getBelmontePotentialOfflineValue(averageReservationValue)
    : potentialOfflineReservations * averageReservationValue;
  const metaOnlineReservationValue = metaCampaignsOnly.reduce(
    (s, c) => s + (Number(c.reservation_value) || 0),
    0
  );
  const totalPotentialValue = isBelmonteClient(clientName)
    ? potentialOfflineValue + metaOnlineReservationValue
    : potentialOfflineValue + totalReservationValueCombined;
  return {
    microTotal,
    potentialOfflineReservations,
    averageReservationValue,
    potentialOfflineValue,
    totalPotentialValue,
  };
}

// Page 1: Cover only — logo + titles, vertically centered (Podsumowanie wykonawcze is page 2)
const generateCoverPage = (reportData: ReportData) => {
  logger.info('🎯 COVER PAGE: page 1 (centered, no AI)');
  return `
    <div class="title-page title-page--cover">
      <div class="page-content page-content--cover">
        <div class="clean-title-section clean-title-section--cover">
          <div class="clean-cover-hero clean-cover-hero--centered">
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
        </div>
      </div>
    </div>
  `;
};

// Page 2: Full-page executive summary. Porównanie okresów follows on page 3.
const generateExecutiveSummaryPage = (reportData: ReportData) => {
  if (!reportData.aiSummary) return '';
  logger.info('🎯 EXECUTIVE SUMMARY: full page 2');
  return `
    <div class="pdf-page-executive-summary">
      <div class="clean-ai-summary-section clean-ai-summary-section--full-page">
        <h3 class="clean-summary-title">Podsumowanie Wykonawcze</h3>
        <div class="clean-summary-content clean-summary-content--full-page">
              ${reportData.aiSummary}
        </div>
      </div>
    </div>
  `;
};


// Generate Section: Production Comparison (Month-over-Month or Year-over-Year) — typically page 3+
const generateYoYSection = (reportData: ReportData) => {
  logger.info('🔍 COMPARISON SECTION: Starting generation', {
    hasYoyComparison: !!reportData.yoyComparison
  });

  const zeroSide = { spend: 0, reservationValue: 0 };
  const zeroChanges = { spend: 0, reservationValue: 0 };
  const comparison = reportData.yoyComparison || {
    meta: { current: zeroSide, previous: zeroSide, changes: zeroChanges },
    google: { current: zeroSide, previous: zeroSide, changes: zeroChanges }
  };
  const { meta, google } = comparison;
  
  // ✅ PRODUCTION-READY: Only show if we have meaningful comparison data
  const hasMetaData = (reportData.mediaEnabled?.meta ?? false) || meta.current.spend > 0 || meta.previous.spend > 0;
  const hasGoogleData = (reportData.mediaEnabled?.google ?? false) || google.current.spend > 0 || google.previous.spend > 0;
  
  if (!hasMetaData && !hasGoogleData) {
    logger.info('🔍 COMPARISON SECTION: No meaningful data to compare');
    return '';
  }
  
  logger.info('🔍 COMPARISON SECTION: Generating content with production data', {
    hasMetaData,
    hasGoogleData,
    metaCurrentSpend: meta.current.spend,
    metaPreviousSpend: meta.previous.spend,
    googleCurrentSpend: google.current.spend,
    googlePreviousSpend: google.previous.spend,
    mediaEnabled: reportData.mediaEnabled
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
            
            /* Google Ads first (góra), Meta Ads pod spodem — spójnie z resztą PDF */
            const googleY1 = yStart;
            const googleY2 = googleY1 + barHeight + barGap;
            const metaY1 = googleY2 + barHeight + platformGap;
            const metaY2 = metaY1 + barHeight + barGap;
            
            return `
              <!-- Section: ${metric.label} -->
              
              <!-- Metric Title -->
              <text x="${padding.left - 15}" y="${yStart - 8}" text-anchor="end" font-size="14" font-weight="700" fill="#1F2937" font-family="Roboto, Arial, sans-serif">${metric.label}</text>
              
              <!-- Y-axis line -->
              <line x1="${padding.left - 8}" y1="${googleY1 - 5}" x2="${padding.left - 8}" y2="${metaY2 + barHeight + 5}" stroke="#E5E7EB" stroke-width="2"/>
              
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
              ${metric.googleCurrent > 0 && metric.googlePrevious > 0 && metric.googleChange !== -999 ? `
                <text x="${width - padding.right + 10}" y="${googleY1 + 21}" text-anchor="start" font-size="13" font-weight="700" fill="${metric.googleChange >= 0 ? '#10B981' : '#EF4444'}" font-family="Roboto, Arial, sans-serif">
                  ${metric.googleChange >= 0 ? '↗' : '↘'} ${Math.abs(metric.googleChange).toFixed(1)}%
                </text>
              ` : ''}

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
              ${metric.metaCurrent > 0 && metric.metaPrevious > 0 && metric.metaChange !== -999 ? `
                <text x="${width - padding.right + 10}" y="${metaY1 + 21}" text-anchor="start" font-size="13" font-weight="700" fill="${metric.metaChange >= 0 ? '#10B981' : '#EF4444'}" font-family="Roboto, Arial, sans-serif">
                  ${metric.metaChange >= 0 ? '↗' : '↘'} ${Math.abs(metric.metaChange).toFixed(1)}%
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

  const getMetricChange = (metricKey: string) => {
    if (!metaYoYData || !metaYoYData.changes) return null;

    const currentMap: { [key: string]: number } = {
      'totalSpend': metaYoYData.current?.spend || 0,
      'totalImpressions': metaYoYData.current?.impressions || 0,
      'totalClicks': metaYoYData.current?.clicks || 0,
      'totalConversions': metaYoYData.current?.reservations || 0,
      'totalReservations': metaYoYData.current?.reservations || 0,
    };
    const previousMap: { [key: string]: number } = {
      'totalSpend': metaYoYData.previous?.spend || 0,
      'totalImpressions': metaYoYData.previous?.impressions || 0,
      'totalClicks': metaYoYData.previous?.clicks || 0,
      'totalConversions': metaYoYData.previous?.reservations || 0,
      'totalReservations': metaYoYData.previous?.reservations || 0,
    };

    if ((currentMap[metricKey] || 0) === 0 || (previousMap[metricKey] || 0) === 0) return null;

    const change = metaYoYData.changes?.[metricKey === 'totalConversions' || metricKey === 'totalReservations' ? 'reservations' : metricKey === 'totalSpend' ? 'spend' : metricKey === 'totalImpressions' ? 'impressions' : 'clicks'] || 0;
    if (change === -999 || Math.abs(change) < 0.01) return null;
    return change;
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
  
  // Canonical contract v1: same as /reports — prefer stats.averageCtr (incl. 0), else clicks/impressions×100
  const ctr = ctrPercentFromStats(
    metrics.averageCtr,
    metrics.totalClicks ?? 0,
    metrics.totalImpressions ?? 0
  );
  const cpc = cpcFromStats(
    metrics.averageCpc,
    metrics.totalSpend ?? 0,
    metrics.totalClicks ?? 0
  );

  const offlinePot = computeOfflinePotentialFromReportData(reportData);
  const {
    microTotal: offlineMicroTotal,
    potentialOfflineReservations,
    potentialOfflineValue,
    totalPotentialValue,
  } = offlinePot;
  const showMetaOfflineBox =
    offlineMicroTotal > 0 && potentialOfflineReservations > 0;

  const metaBasicCards: string[] = [];
  if (pdfMetricVisible(reportData, 'meta', 'report_summary', 'totalSpend')) {
    metaBasicCards.push(
      renderMetricCard(
        pdfMetricLabel(reportData, 'meta', 'report_summary', 'totalSpend', 'Wydatki'),
        formatCurrency(metrics.totalSpend),
        getMetricChange('totalSpend')
      )
    );
  }
  if (pdfMetricVisible(reportData, 'meta', 'report_summary', 'totalImpressions')) {
    metaBasicCards.push(
      renderMetricCard(
        pdfMetricLabel(reportData, 'meta', 'report_summary', 'totalImpressions', 'Wyświetlenia'),
        formatNumber(metrics.totalImpressions),
        getMetricChange('totalImpressions')
      )
    );
  }
  if (pdfMetricVisible(reportData, 'meta', 'report_summary', 'totalClicks')) {
    metaBasicCards.push(
      renderMetricCard(
        pdfMetricLabel(reportData, 'meta', 'report_summary', 'totalClicks', 'Kliknięcia'),
        formatNumber(metrics.totalClicks),
        getMetricChange('totalClicks')
      )
    );
  }
  if (pdfMetricVisible(reportData, 'meta', 'report_summary', 'averageCtr')) {
    metaBasicCards.push(
      renderMetricCard(
        pdfMetricLabel(
          reportData,
          'meta',
          'report_summary',
          'averageCtr',
          'Współczynnik kliknięć z linku'
        ),
        `${ctr.toFixed(2)}%`,
        null
      )
    );
  }
  if (pdfMetricVisible(reportData, 'meta', 'report_summary', 'averageCpc')) {
    metaBasicCards.push(
      renderMetricCard(
        pdfMetricLabel(
          reportData,
          'meta',
          'report_summary',
          'averageCpc',
          'Koszt kliknięcia linku'
        ),
        formatCurrency(cpc),
        null
      )
    );
  }
  if (pdfMetricVisible(reportData, 'meta', 'report_summary', 'totalConversions')) {
    metaBasicCards.push(
      renderMetricCard(
        pdfMetricLabel(reportData, 'meta', 'report_summary', 'totalConversions', 'Konwersje'),
        formatNumber(metrics.totalConversions),
        getMetricChange('totalConversions')
      )
    );
  }

  const metaContactCards: string[] = [];
  if (pdfMetricVisible(reportData, 'meta', 'contact', 'email_contacts')) {
    metaContactCards.push(
      renderMetricCard(
        pdfMetricLabel(reportData, 'meta', 'contact', 'email_contacts', 'E-mail'),
        formatNumber(metrics.emailContacts),
        null
      )
    );
  }
  if (pdfMetricVisible(reportData, 'meta', 'contact', 'click_to_call')) {
    metaContactCards.push(
      renderMetricCard(
        pdfMetricLabel(reportData, 'meta', 'contact', 'click_to_call', 'Telefon'),
        formatNumber(metrics.phoneContacts),
        null
      )
    );
  }
  if (pdfMetricVisible(reportData, 'meta', 'contact', 'reservations')) {
    metaContactCards.push(
      renderMetricCard(
        pdfMetricLabel(reportData, 'meta', 'contact', 'reservations', 'Rezerwacje'),
        formatNumber(metrics.totalReservations),
        getMetricChange('totalReservations')
      )
    );
  }
  if (pdfMetricVisible(reportData, 'meta', 'contact', 'reservation_value')) {
    metaContactCards.push(
      renderMetricCard(
        pdfMetricLabel(
          reportData,
          'meta',
          'contact',
          'reservation_value',
          'Wartość rezerwacji'
        ),
        formatCurrency(metrics.totalReservationValue),
        null
      )
    );
  }

  const showMetaRoas =
    metrics.roas &&
    metrics.roas > 0 &&
    pdfMetricVisible(reportData, 'meta', 'funnel', 'roas');

    return `
      <div class="section-container">
        <div class="page-content">
        <h2 class="section-title">Meta Ads</h2>
        <p style="font-size: 13px; color: #64748B; margin-bottom: 24px; margin-top: -4px;">Kluczowe wskaźniki efektywności kampanii</p>
        
        <!-- Basic Metrics Grid (2x3) -->
        <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-bottom: 32px; width: 100%; max-width: 100%; box-sizing: border-box;">
          ${metaBasicCards.join('')}
      </div>
        
        <!-- Contact & Conversions Section -->
        <h3 style="font-size: 16px; font-weight: 600; color: #0F172A; margin-bottom: 4px; margin-top: 32px;">Kontakt & Konwersje</h3>
        <p style="font-size: 12px; color: #64748B; margin-bottom: 16px;">Metryki kontaktu i zakończonych konwersji</p>
        
        <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-bottom: 32px; width: 100%; max-width: 100%; box-sizing: border-box;">
          ${metaContactCards.join('')}
    </div>
        
        ${showMetaRoas ? `
          <div style="display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; margin-bottom: 32px; width: 100%; max-width: 100%; box-sizing: border-box;">
            ${renderMetricCard(
              pdfMetricLabel(reportData, 'meta', 'funnel', 'roas', 'ROAS'),
              `${metrics.roas.toFixed(2)}x`,
              null
            )}
          </div>
        ` : ''}
        
        <!-- Potential Offline Metrics - Summary Box (global 20% model; Belmonte = Meta-only micro pool) -->
        ${showMetaOfflineBox ? `
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 20px; margin-bottom: 32px;">
            <h3 style="font-size: 13px; font-weight: 500; color: #0F172A; margin-bottom: 16px;">Potencjalne Metryki Offline</h3>
            <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; font-size: 12px; width: 100%; max-width: 100%; box-sizing: border-box;">
              <div>
                <div style="font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;">Rezerwacje offline</div>
                <div style="font-size: 16px; font-weight: 600; color: #0F172A; overflow-wrap: anywhere;">${formatNumber(potentialOfflineReservations)}</div>
              </div>
              <div>
                <div style="font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;">Wartość offline</div>
                <div style="font-size: 16px; font-weight: 600; color: #0F172A; overflow-wrap: anywhere;">${formatCurrency(potentialOfflineValue)}</div>
              </div>
              <div>
                <div style="font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;">Łączna wartość</div>
                <div style="font-size: 16px; font-weight: 600; color: #0F172A; overflow-wrap: anywhere;">${formatCurrency(totalPotentialValue)}</div>
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
};

// Generate Conversion Funnel HTML — labels follow client metrics config (same as WeeklyReportView / ConversionFunnel).
const generateConversionFunnelHTML = (
  funnelData: any,
  reportData: ReportData,
  platform: 'meta' | 'google'
) => {
  const { booking_step_1, booking_step_2, booking_step_3, reservations, reservation_value, total_conversion_value, roas } = funnelData;
  const displayConversionValue = total_conversion_value ?? reservation_value;

  const step1Label = pdfMetricLabel(
    reportData,
    platform,
    'funnel',
    'booking_step_1',
    platform === 'google' ? 'Booking step 1' : 'Wyszukiwania'
  );
  const step2Label = pdfMetricLabel(
    reportData,
    platform,
    'funnel',
    'booking_step_2',
    platform === 'google' ? 'Booking step 2' : 'Wyświetlenia zawartości'
  );
  const step3Label = pdfMetricLabel(
    reportData,
    platform,
    'funnel',
    'booking_step_3',
    platform === 'google' ? 'Booking step 3' : 'Zainicjowane przejścia do kasy'
  );
  const reservationsLabel = pdfMetricLabel(reportData, platform, 'funnel', 'reservations', 'Ilość rezerwacji');
  const reservationValueLabel = pdfMetricLabel(
    reportData,
    platform,
    'funnel',
    total_conversion_value !== undefined ? 'total_conversion_value' : 'reservation_value',
    platform === 'google' ? 'Łączna wartość rezerwacji' : 'Wartość rezerwacji'
  );
  const roasLabel = pdfMetricLabel(reportData, platform, 'funnel', 'roas', 'ROAS');

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
      label: step1Label,
      value: booking_step_1,
      percentage: 100,
      bgColor: "background: #1E293B" // Darkest - top of funnel
    },
    {
      label: step2Label,
      value: booking_step_2,
      percentage: booking_step_1 > 0 ? Math.round((booking_step_2 / booking_step_1) * 100) : 0,
      bgColor: "background: #334155" // Dark mid-tone
    },
    {
      label: step3Label,
      value: booking_step_3,
      percentage: booking_step_1 > 0 ? Math.round((booking_step_3 / booking_step_1) * 100) : 0,
      bgColor: "background: #475569" // Light mid-tone
    },
    {
      label: reservationsLabel,
      value: reservations,
      percentage: booking_step_1 > 0 ? Math.round((reservations / booking_step_1) * 100) : 0,
      bgColor: "background: #64748B" // Lightest - bottom of funnel
    }
  ];

  const bottomCards = [
    {
      label: reservationValueLabel,
      value: displayConversionValue,
      isROAS: false
    },
    {
      label: roasLabel,
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
        <h3 style="color: #0F172A; font-size: 20px; font-weight: 600; margin: 0 0 4px 0;">Ścieżka Konwersji ${platform === 'google' ? 'Google Ads' : 'Meta Ads'}</h3>
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
        ${generateConversionFunnelHTML(reportData.metaData.funnel, reportData, 'meta')}
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

  const getMetricChange = (metricKey: string) => {
    if (!googleYoYData || !googleYoYData.changes) return null;

    const currentMap: { [key: string]: number } = {
      'totalSpend': googleYoYData.current?.spend || 0,
      'totalImpressions': googleYoYData.current?.impressions || 0,
      'totalClicks': googleYoYData.current?.clicks || 0,
      'totalConversions': googleYoYData.current?.reservations || 0,
      'totalReservations': googleYoYData.current?.reservations || 0,
    };
    const previousMap: { [key: string]: number } = {
      'totalSpend': googleYoYData.previous?.spend || 0,
      'totalImpressions': googleYoYData.previous?.impressions || 0,
      'totalClicks': googleYoYData.previous?.clicks || 0,
      'totalConversions': googleYoYData.previous?.reservations || 0,
      'totalReservations': googleYoYData.previous?.reservations || 0,
    };

    if ((currentMap[metricKey] || 0) === 0 || (previousMap[metricKey] || 0) === 0) return null;

    const change = googleYoYData.changes?.[metricKey === 'totalConversions' || metricKey === 'totalReservations' ? 'reservations' : metricKey === 'totalSpend' ? 'spend' : metricKey === 'totalImpressions' ? 'impressions' : 'clicks'] || 0;
    if (change === -999 || Math.abs(change) < 0.01) return null;
    return change;
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
  
  // Canonical contract v1: same as /reports — prefer stats.averageCtr (incl. 0), else clicks/impressions×100
  const ctr = ctrPercentFromStats(
    metrics.averageCtr,
    metrics.totalClicks ?? 0,
    metrics.totalImpressions ?? 0
  );
  const cpc = cpcFromStats(
    metrics.averageCpc,
    metrics.totalSpend ?? 0,
    metrics.totalClicks ?? 0
  );

  const clientName = reportData.clientName || '';
  const offlinePot = computeOfflinePotentialFromReportData(reportData);
  const {
    microTotal: offlineMicroTotal,
    potentialOfflineReservations,
    potentialOfflineValue,
    totalPotentialValue,
  } = offlinePot;
  // Belmonte: offline model uses Meta only — do not repeat the box under Google Ads (same numbers live under Meta).
  const showGoogleOfflineBox =
    !isBelmonteClient(clientName) &&
    offlineMicroTotal > 0 &&
    potentialOfflineReservations > 0;

  const googleBasicCards: string[] = [];
  if (pdfMetricVisible(reportData, 'google', 'report_summary', 'totalSpend')) {
    googleBasicCards.push(
      renderMetricCard(
        pdfMetricLabel(reportData, 'google', 'report_summary', 'totalSpend', 'Wydatki'),
        formatCurrency(metrics.totalSpend),
        getMetricChange('totalSpend')
      )
    );
  }
  if (pdfMetricVisible(reportData, 'google', 'report_summary', 'totalImpressions')) {
    googleBasicCards.push(
      renderMetricCard(
        pdfMetricLabel(reportData, 'google', 'report_summary', 'totalImpressions', 'Wyświetlenia'),
        formatNumber(metrics.totalImpressions),
        getMetricChange('totalImpressions')
      )
    );
  }
  if (pdfMetricVisible(reportData, 'google', 'report_summary', 'totalClicks')) {
    googleBasicCards.push(
      renderMetricCard(
        pdfMetricLabel(reportData, 'google', 'report_summary', 'totalClicks', 'Kliknięcia'),
        formatNumber(metrics.totalClicks),
        getMetricChange('totalClicks')
      )
    );
  }
  if (pdfMetricVisible(reportData, 'google', 'report_summary', 'averageCtr')) {
    googleBasicCards.push(
      renderMetricCard(
        pdfMetricLabel(
          reportData,
          'google',
          'report_summary',
          'averageCtr',
          'Współczynnik kliknięć z linku'
        ),
        `${ctr.toFixed(2)}%`,
        null
      )
    );
  }
  if (pdfMetricVisible(reportData, 'google', 'report_summary', 'averageCpc')) {
    googleBasicCards.push(
      renderMetricCard(
        pdfMetricLabel(
          reportData,
          'google',
          'report_summary',
          'averageCpc',
          'Koszt kliknięcia linku'
        ),
        formatCurrency(cpc),
        null
      )
    );
  }
  if (pdfMetricVisible(reportData, 'google', 'report_summary', 'totalConversions')) {
    googleBasicCards.push(
      renderMetricCard(
        pdfMetricLabel(
          reportData,
          'google',
          'report_summary',
          'totalConversions',
          'Konwersje'
        ),
        formatNumber(metrics.totalConversions),
        getMetricChange('totalConversions')
      )
    );
  }

  const googleContactCards: string[] = [];
  if (pdfMetricVisible(reportData, 'google', 'contact', 'email_contacts')) {
    googleContactCards.push(
      renderMetricCard(
        pdfMetricLabel(reportData, 'google', 'contact', 'email_contacts', 'E-mail'),
        formatNumber(metrics.emailContacts),
        null
      )
    );
  }
  if (pdfMetricVisible(reportData, 'google', 'contact', 'click_to_call')) {
    googleContactCards.push(
      renderMetricCard(
        pdfMetricLabel(reportData, 'google', 'contact', 'click_to_call', 'Telefon'),
        formatNumber(metrics.phoneContacts),
        null
      )
    );
  }
  if (pdfMetricVisible(reportData, 'google', 'contact', 'reservations')) {
    googleContactCards.push(
      renderMetricCard(
        pdfMetricLabel(reportData, 'google', 'contact', 'reservations', 'Rezerwacje'),
        formatNumber(metrics.totalReservations),
        getMetricChange('totalReservations')
      )
    );
  }
  if (pdfMetricVisible(reportData, 'google', 'contact', 'reservation_value')) {
    googleContactCards.push(
      renderMetricCard(
        pdfMetricLabel(
          reportData,
          'google',
          'contact',
          'reservation_value',
          'Wartość rezerwacji'
        ),
        formatCurrency(metrics.totalReservationValue),
        null
      )
    );
  }

  const showGoogleRoas =
    metrics.roas &&
    metrics.roas > 0 &&
    pdfMetricVisible(reportData, 'google', 'funnel', 'roas');
  
  return `
    <div class="section-container">
      <div class="page-content">
        <h2 class="section-title">Google Ads</h2>
        <p style="font-size: 13px; color: #64748B; margin-bottom: 24px; margin-top: -4px;">Kluczowe wskaźniki efektywności kampanii</p>
        
        <!-- Basic Metrics Grid (2x3) -->
        <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-bottom: 32px; width: 100%; max-width: 100%; box-sizing: border-box;">
          ${googleBasicCards.join('')}
        </div>
        
        <!-- Contact & Conversions Section -->
        <h3 style="font-size: 16px; font-weight: 600; color: #0F172A; margin-bottom: 4px; margin-top: 32px;">Kontakt & Konwersje</h3>
        <p style="font-size: 12px; color: #64748B; margin-bottom: 16px;">Metryki kontaktu i zakończonych konwersji</p>
        
        <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-bottom: 32px; width: 100%; max-width: 100%; box-sizing: border-box;">
          ${googleContactCards.join('')}
        </div>
        
        ${showGoogleRoas ? `
          <div style="display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; margin-bottom: 32px; width: 100%; max-width: 100%; box-sizing: border-box;">
            ${renderMetricCard(
              pdfMetricLabel(reportData, 'google', 'funnel', 'roas', 'ROAS'),
              `${metrics.roas.toFixed(2)}x`,
              null
            )}
          </div>
        ` : ''}
        
        <!-- Potential Offline Metrics - Summary Box -->
        ${showGoogleOfflineBox ? `
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 20px; margin-bottom: 32px;">
            <h3 style="font-size: 13px; font-weight: 500; color: #0F172A; margin-bottom: 16px;">Potencjalne Metryki Offline</h3>
            <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; font-size: 12px; width: 100%; max-width: 100%; box-sizing: border-box;">
              <div>
                <div style="font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;">Rezerwacje offline</div>
                <div style="font-size: 16px; font-weight: 600; color: #0F172A; overflow-wrap: anywhere;">${formatNumber(potentialOfflineReservations)}</div>
              </div>
              <div>
                <div style="font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;">Wartość offline</div>
                <div style="font-size: 16px; font-weight: 600; color: #0F172A; overflow-wrap: anywhere;">${formatCurrency(potentialOfflineValue)}</div>
              </div>
              <div>
                <div style="font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;">Łączna wartość</div>
                <div style="font-size: 16px; font-weight: 600; color: #0F172A; overflow-wrap: anywhere;">${formatCurrency(totalPotentialValue)}</div>
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
        ${generateConversionFunnelHTML(reportData.googleData.funnel, reportData, 'google')}
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

  const generateChartsForMetric = (metric: 'spend' | 'clicks' | 'reservation_value') => {
    const genderMap = new Map();
    validData.forEach(item => {
      let gender = item.gender || 'Nieznane';
      if (gender.toLowerCase() === 'female' || gender.toLowerCase() === 'kobieta') gender = 'Kobiety';
      else if (gender.toLowerCase() === 'male' || gender.toLowerCase() === 'mężczyzna') gender = 'Mężczyźni';
      else if (gender.toLowerCase() === 'unknown' || gender.toLowerCase() === 'nieznane') gender = 'Nieznane';
      
      const rawValue = item[metric];
      const value = (metric === 'spend' || metric === 'reservation_value')
        ? (typeof rawValue === 'string' ? parseFloat(rawValue) : (rawValue || 0)) 
        : (typeof rawValue === 'string' ? parseInt(rawValue) : (rawValue || 0));
      
      genderMap.set(gender, (genderMap.get(gender) || 0) + value);
    });

    const ageMap = new Map();
    validData.forEach(item => {
      let age = item.age || 'Nieznane';
      if (age.toLowerCase() === 'unknown' || age.toLowerCase() === 'nieznane') age = 'Nieznane';
      
      const rawValue = item[metric];
      const value = (metric === 'spend' || metric === 'reservation_value')
        ? (typeof rawValue === 'string' ? parseFloat(rawValue) : (rawValue || 0)) 
        : (typeof rawValue === 'string' ? parseInt(rawValue) : (rawValue || 0));
      
      ageMap.set(age, (ageMap.get(age) || 0) + value);
    });

  const genderEntries = Array.from(genderMap.entries()).sort((a, b) => b[1] - a[1]);
  const ageEntries = Array.from(ageMap.entries()).sort((a, b) => b[1] - a[1]);

    const genderTotal = genderEntries.reduce((sum, [, value]) => sum + value, 0);
    const ageTotal = ageEntries.reduce((sum, [, value]) => sum + value, 0);

    const metricLabel = metric === 'reservation_value' ? 'Wartość rezerwacji' : metric === 'spend' ? 'Wydatki' : 'Kliknięcia';
    const formatValue = (metric === 'spend' || metric === 'reservation_value')
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
  // Show campaigns with spend data
  const campaignsWithSpend = campaigns.filter(campaign => (campaign.spend || 0) > 0);
  
  // Don't generate section if no campaigns with spend
  if (campaignsWithSpend.length === 0) return '';
  
  // Sort by spend (descending) - display all campaigns
  const sortedCampaigns = [...campaignsWithSpend].sort((a, b) => (b.spend || 0) - (a.spend || 0));
  
  return `
    <div class="campaign-details-section" style="padding: 0 2mm;">
      <h2 class="section-title">Meta Ads - Szczegóły Kampanii</h2>
        
        <!-- All Campaigns Table (Premium Agency Style) -->
        <div class="campaigns-table">
          <h3 class="table-title">Kampanie wg Wydatków</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Nazwa kampanii</th>
                  <th>${pdfMetricLabel(reportData, 'meta', 'campaign_table', 'totalSpend', 'Wydatki')}</th>
                  <th>${pdfMetricLabel(reportData, 'meta', 'campaign_table', 'totalImpressions', 'Wyświetlenia')}</th>
                  <th>${pdfMetricLabel(reportData, 'meta', 'campaign_table', 'totalClicks', 'Kliknięcia')}</th>
                  <th>${pdfMetricLabel(reportData, 'meta', 'campaign_table', 'reservations', 'Ilość Rezerwacji')}</th>
                  <th>${pdfMetricLabel(reportData, 'meta', 'campaign_table', 'reservation_value', 'Wartość Rezerwacji')}</th>
                  <th>${pdfMetricLabel(reportData, 'meta', 'campaign_table', 'roas', 'ROAS')}</th>
              </tr>
            </thead>
            <tbody>
              ${sortedCampaigns.map(campaign => `
                <tr>
                  <td class="campaign-name">${campaign.campaign_name || campaign.campaignName || campaign.name || campaign.id || 'Nieznana kampania'}</td>
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
          ${pdfMetricVisible(reportData, 'meta', 'demographic_breakdown', 'age') || pdfMetricVisible(reportData, 'meta', 'demographic_breakdown', 'gender') ? (() => {
            logger.info('🔍 DEMOGRAPHIC DATA AUDIT:', {
              hasDemographicPerformance: !!tables.demographicPerformance,
              demographicDataLength: tables.demographicPerformance?.length || 0,
              demographicDataSample: tables.demographicPerformance?.slice(0, 2) || [],
              tablesKeys: Object.keys(tables || {}),
              fullTablesData: tables
            });
            return generateDemographicChartsHTML(tables.demographicPerformance);
          })() : ''}
        
        <!-- Placement Performance -->
        ${pdfMetricVisible(reportData, 'meta', 'placement_table', 'placement') && tables.placementPerformance && tables.placementPerformance.length > 0 ? `
          <div class="placement-table">
            <h3 class="table-title">Skuteczność Miejsc Docelowych</h3>
            <table class="data-table">
              <thead>
                <tr>
                  ${pdfMetricVisible(reportData, 'meta', 'placement_table', 'placement') ? `<th>${pdfMetricLabel(reportData, 'meta', 'placement_table', 'placement', 'Miejsce docelowe')}</th>` : ''}
                  ${pdfMetricVisible(reportData, 'meta', 'placement_table', 'totalSpend') ? `<th>${pdfMetricLabel(reportData, 'meta', 'placement_table', 'totalSpend', 'Wydatki')}</th>` : ''}
                  ${pdfMetricVisible(reportData, 'meta', 'placement_table', 'totalImpressions') ? `<th>${pdfMetricLabel(reportData, 'meta', 'placement_table', 'totalImpressions', 'Wyświetlenia')}</th>` : ''}
                  ${pdfMetricVisible(reportData, 'meta', 'placement_table', 'totalClicks') ? `<th>${pdfMetricLabel(reportData, 'meta', 'placement_table', 'totalClicks', 'Kliknięcia')}</th>` : ''}
                  ${pdfMetricVisible(reportData, 'meta', 'placement_table', 'reservations') ? `<th>${pdfMetricLabel(reportData, 'meta', 'placement_table', 'reservations', 'Rezerwacje')}</th>` : ''}
                  ${pdfMetricVisible(reportData, 'meta', 'placement_table', 'reservation_value') ? `<th>${pdfMetricLabel(reportData, 'meta', 'placement_table', 'reservation_value', 'Wartość Rezerwacji')}</th>` : ''}
                  ${pdfMetricVisible(reportData, 'meta', 'placement_table', 'roas') ? `<th>${pdfMetricLabel(reportData, 'meta', 'placement_table', 'roas', 'ROAS')}</th>` : ''}
                </tr>
              </thead>
              <tbody>
                ${tables.placementPerformance.slice(0, 10).map(placement => {
                  const pSpend = typeof placement.spend === 'string' ? parseFloat(placement.spend) : (placement.spend || 0);
                  const pResVal = typeof placement.reservation_value === 'string' ? parseFloat(placement.reservation_value) : (placement.reservation_value || 0);
                  const pRes = typeof placement.reservations === 'string' ? parseInt(placement.reservations) : (placement.reservations || 0);
                  const pRoas = pSpend > 0 ? pResVal / pSpend : 0;
                  return `
                  <tr>
                    ${pdfMetricVisible(reportData, 'meta', 'placement_table', 'placement') ? `<td>${placement.placement || 'Nieznane'}</td>` : ''}
                    ${pdfMetricVisible(reportData, 'meta', 'placement_table', 'totalSpend') ? `<td class="number">${formatCurrency(pSpend)}</td>` : ''}
                    ${pdfMetricVisible(reportData, 'meta', 'placement_table', 'totalImpressions') ? `<td class="number">${formatNumber(typeof placement.impressions === 'string' ? parseInt(placement.impressions) : (placement.impressions || 0))}</td>` : ''}
                    ${pdfMetricVisible(reportData, 'meta', 'placement_table', 'totalClicks') ? `<td class="number">${formatNumber(typeof placement.clicks === 'string' ? parseInt(placement.clicks) : (placement.clicks || 0))}</td>` : ''}
                    ${pdfMetricVisible(reportData, 'meta', 'placement_table', 'reservations') ? `<td class="number">${formatNumber(pRes)}</td>` : ''}
                    ${pdfMetricVisible(reportData, 'meta', 'placement_table', 'reservation_value') ? `<td class="number">${formatCurrency(pResVal)}</td>` : ''}
                    ${pdfMetricVisible(reportData, 'meta', 'placement_table', 'roas') ? `<td class="number">${pRoas.toFixed(2)}x</td>` : ''}
                  </tr>
                `}).join('')}
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
                  <th>Koszt kliknięcia linku</th>
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

/**
 * Render the Google Ads geographic_view payload as a Poland heatmap +
 * top-cities table for the PDF.
 *
 * The heatmap reuses the same voivodeship paths and heatmap_color helpers
 * as the live <PolandRegionMap /> component so the PDF and the dashboard
 * stay visually identical. We import dynamically inside the function so
 * Next.js can still tree-shake the SVG path data out of the API route
 * bundle when this section is not generated.
 */
const generateGoogleGeographicSectionHTML = (
  geographicData: any[],
  campaignTotals?: {
    spend?: number;
    clicks?: number;
    conversions?: number;
    conversion_value?: number;
  } | null,
  options?: {
    includeCityTable?: boolean;
  },
) => {
  if (!geographicData || geographicData.length === 0) {
    return '';
  }

  // Synchronous require so the heavy work runs only when this section is
  // actually generated. We import the module here (not at the top of the
  // file) because route.ts already approaches the 5000-line mark and
  // localized imports keep the regional change contained.
  const { POLAND_MAP_VIEW_BOX, POLAND_VOIVODESHIPS, VOIVODESHIP_BY_CODE, heatmapColor } = require('@/lib/poland-voivodeships');
  const { formatPolishCityName, formatPolishVoivodeshipName, resolvePolishVoivodeshipCode, formatPolishCountryName } = require('@/lib/polish-geo-display');

  type RegionBucket = {
    code: string; name: string;
    spend: number; impressions: number; clicks: number;
    conversions: number; conversion_value: number;
  };
  type CountryBucket = RegionBucket;

  const byCode = new Map<string, RegionBucket>();
  const foreignByCountry = new Map<string, CountryBucket>();
  let unmatchedPolandValue = 0;

  for (const row of geographicData) {
    if (row.countryCode && row.countryCode !== 'PL') {
      const countryKey = row.countryCode || row.countryName || '__foreign__';
      const country = foreignByCountry.get(countryKey) ?? {
        code: countryKey,
        name: row.countryName || row.countryCode || 'Zagranica / Nieznane',
        spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0,
      };
      country.spend += row.spend || 0;
      country.impressions += row.impressions || 0;
      country.clicks += row.clicks || 0;
      country.conversions += row.conversions || 0;
      country.conversion_value += row.conversion_value || row.reservation_value || 0;
      foreignByCountry.set(countryKey, country);
      continue;
    }

    const code = resolvePolishVoivodeshipCode(row);
    const shape = code ? VOIVODESHIP_BY_CODE[code] : null;
    if (!code || !shape) {
      unmatchedPolandValue += row.conversion_value || row.reservation_value || 0;
      continue;
    }
    const bucket = byCode.get(code) ?? {
      code, name: shape.name,
      spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0,
    };
    bucket.spend += row.spend || 0;
    bucket.impressions += row.impressions || 0;
    bucket.clicks += row.clicks || 0;
    bucket.conversions += row.conversions || 0;
    bucket.conversion_value += row.conversion_value || row.reservation_value || 0;
    byCode.set(code, bucket);
  }

  // Heatmap is keyed off reservation/conversion value to match the dashboard's
  // default selection - this is the metric clients most often want to see
  // geographically (ROAS surrogate).
  const heatmapMetric = 'conversion_value' as const;
  const values = Array.from(byCode.values()).map((b) => b[heatmapMetric]);
  const maxValue = values.length > 0 ? Math.max(...values) : 0;
  const foreignTotal = Array.from(foreignByCountry.values()).reduce((s, country) => s + country[heatmapMetric], 0);
  const geographicViewTotal = values.reduce((s, v) => s + v, 0) + unmatchedPolandValue + foreignTotal;

  // When campaign totals are available, reconcile the map back to campaign
  // value by surfacing the gap as "Nieznana lokalizacja". Google's
  // geographic_view does not return rows for every conversion, so this bucket
  // is what makes the map total match the campaign-level KPI.
  const campaignMetricTotal = typeof campaignTotals?.[heatmapMetric] === 'number'
    ? (campaignTotals![heatmapMetric] as number)
    : null;
  const unknownLocationMetric = campaignMetricTotal !== null
    ? Math.max(0, campaignMetricTotal - geographicViewTotal)
    : 0;
  const totalMetric = campaignMetricTotal !== null ? campaignMetricTotal : geographicViewTotal;

  // Top cities: sort by clicks (matches live GoogleAdsTables city list).
  const cityRows = [...geographicData]
    .filter((r: any) => r.cityName && r.cityName !== '(nieznane)')
    .sort((a: any, b: any) => (b.clicks || 0) - (a.clicks || 0))
    .slice(0, 15);

  const paths = POLAND_VOIVODESHIPS.map((v: any) => {
    const bucket = byCode.get(v.code);
    const value = bucket ? bucket[heatmapMetric] : 0;
    const normalized = maxValue > 0 ? value / maxValue : 0;
    const fill = heatmapColor(normalized, value > 0);
    return `<path d="${v.path}" fill="${fill}" stroke="rgba(15,39,66,0.2)" stroke-width="1"/>`;
  }).join('');

  const topRegions = Array.from(byCode.values())
    .filter((b) => b[heatmapMetric] > 0)
    .sort((a, b) => b[heatmapMetric] - a[heatmapMetric])
    .slice(0, 5);
  const topForeignCountries = Array.from(foreignByCountry.values())
    .filter((b) => b[heatmapMetric] > 0)
    .sort((a, b) => b[heatmapMetric] - a[heatmapMetric])
    .slice(0, 5);
  const topRegionMax = topRegions[0]?.[heatmapMetric] || 0;
  const showInlineTopRegionBars = topRegions.every((r) => formatCurrency(r[heatmapMetric]).length <= 8);
  const locationRowsExceedCampaignTotal =
    campaignMetricTotal !== null &&
    geographicViewTotal > totalMetric + 0.0001;
  const locationRowsLabel = locationRowsExceedCampaignTotal
    ? 'suma wierszy lokalizacji'
    : 'z czego z lokalizacji';

  return `
    <div class="geographic-section" style="padding: 0; margin-top: 20px;">
      <div style="border:0; border-radius:0; background:transparent; box-shadow:none; padding:0; page-break-inside:avoid;">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:16px; border-bottom:1px solid #eef2f7; padding-bottom:14px; margin-bottom:16px;">
          <div>
            <h3 style="margin:0; color:#0f172a; font-size:22px; line-height:1.1; font-weight:800;">Regiony</h3>
            <p style="margin:4px 0 0; color:#64748b; font-size:12px;">Wyniki według regionów i miast</p>
          </div>
          <div style="display:flex; align-items:center; gap:8px; color:#64748b; font-size:11px; font-weight:700;">
            Metryka:
            <span style="display:inline-flex; align-items:center; gap:7px; border:1px solid #dbe3ef; border-radius:12px; padding:8px 12px; color:#0f172a; background:#fff; font-size:12px; font-weight:800;"><i style="width:10px; height:10px; border-radius:999px; background:#dbeafe; box-shadow:inset 0 0 0 3px #1f5fbf; display:inline-block;"></i>Wartość konwersji</span>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:minmax(0,1.55fr) minmax(260px,0.95fr); gap:18px; align-items:start;">
          <div style="min-width:0;">
            <div style="display:flex; gap:9px; align-items:flex-start; margin-bottom:9px;">
              <span style="width:32px; height:32px; border-radius:10px; background:#071842; display:inline-block;"></span>
              <div>
                <strong style="display:block; color:#0f172a; font-size:14px;">Wydajność wg regionów</strong>
                <small style="display:block; margin-top:2px; color:#64748b; font-size:10px;">Mapa cieplna — wartość konwersji wg województw; zagranica w podsumowaniu</small>
              </div>
            </div>
            <svg viewBox="${POLAND_MAP_VIEW_BOX}" style="width:100%; height:auto; background:transparent; padding:0;">
              ${paths}
            </svg>
            <div style="display:flex; align-items:center; justify-content:center; gap:10px; margin-top:8px; font-size:10px; color:#64748b; font-weight:700;">
              <span>Niska wartość</span>
              <span style="display:block; width:150px; height:7px; border-radius:999px; background:linear-gradient(90deg,#dbeafe,#5b9bed,#071842);"></span>
              <span>Wysoka wartość</span>
            </div>
          </div>

          <div style="min-width:0;">
            <div style="border-radius:16px; background:linear-gradient(135deg,#eff6ff,#f8fafc 68%,#fff); padding:16px; margin-bottom:16px;">
              <span style="display:block; color:#64748b; font-size:10px; letter-spacing:.12em; text-transform:uppercase; font-weight:800;">Łącznie (kampanie Google Ads)</span>
              <strong style="display:block; margin-top:6px; color:#0f172a; font-size:30px; line-height:1; font-weight:850;">${formatCurrency(totalMetric)}</strong>
              <small style="display:block; margin-top:5px; color:#64748b; font-size:11px;">${locationRowsLabel}: ${formatCurrency(geographicViewTotal)}</small>
              ${locationRowsExceedCampaignTotal ? '<small style="display:block; margin-top:3px; color:#94a3b8; font-size:9px;">Wiersze lokalizacji nie sumują się do KPI kampanii.</small>' : ''}
            </div>
            <div style="display:flex; justify-content:space-between; gap:12px; margin-bottom:10px;">
              <strong style="color:#0f172a; font-size:13px;">Najlepsze regiony</strong>
              <span style="color:#64748b; font-size:11px;">Wartość konwersji</span>
            </div>
            ${topRegions.length === 0 ? `
              <div style="font-size:12px; color:#64748b; padding:18px; background:#f8fafc; border-radius:12px; border:1px dashed #dbe3ef; text-align:center;">Brak danych dla wybranego okresu.</div>
            ` : topRegions.map((r, idx) => {
              const pct = topRegionMax > 0 ? Math.max(6, (r[heatmapMetric] / topRegionMax) * 100) : 0;
              const barColor = ['#071842', '#1f5fbf', '#4f8ee8', '#8db8f7', '#bfdbfe'][idx] || '#bfdbfe';
              const valueLabel = formatCurrency(r[heatmapMetric]);
              return `
                <div style="display:grid; grid-template-columns:${showInlineTopRegionBars ? '20px minmax(76px,1fr) minmax(28px,0.42fr) max-content' : '20px minmax(0,1fr) max-content'}; gap:7px; align-items:center; margin:10px 0; max-width:100%; overflow:hidden;">
                  <b style="width:20px; height:20px; border-radius:999px; background:${idx === 0 ? '#071842' : '#dbeafe'}; color:${idx === 0 ? '#fff' : '#1e3a8a'}; display:inline-flex; align-items:center; justify-content:center; font-size:10px;">${idx + 1}</b>
                  <em style="font-style:normal; color:#334155; font-size:12px; font-weight:700; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(r.name.toLowerCase())}</em>
                  ${showInlineTopRegionBars ? `<span style="display:block; min-width:0; height:6px; border-radius:999px; background:#eef2ff; overflow:hidden;"><i style="display:block; height:100%; width:${pct.toFixed(1)}%; background:${barColor}; border-radius:999px;"></i></span>` : ''}
                  <strong style="color:#0f172a; font-size:11px; font-weight:850; white-space:nowrap; text-align:right;">${valueLabel}</strong>
                </div>
              `;
            }).join('')}

          ${unmatchedPolandValue > 0 ? `
            <div style="font-size: 10px; color: #92400e; background: #fef3c7; border: 1px solid #fde68a; border-radius: 6px; padding: 8px; margin-top: 8px;">
              <strong>Polska niedopasowana:</strong> ${formatCurrency(unmatchedPolandValue)} w wierszach, których Google Ads nie przypisał jednoznacznie do województwa.
            </div>
          ` : ''}

          ${topForeignCountries.length > 0 ? `
            <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin: 14px 0 8px;">
              Zagranica — wartość konwersji
            </div>
            ${topForeignCountries.map((r) => {
              const pct = totalMetric > 0 ? (r[heatmapMetric] / totalMetric) * 100 : 0;
              return `
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; margin-bottom: 6px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-size: 11px; color: #1e293b;"><strong>${formatPolishCountryName({ countryCode: r.code, countryName: r.name })}</strong></span>
                    <span style="font-size: 11px; font-weight: 600; color: #0f172a;">${formatCurrency(r[heatmapMetric])}</span>
                  </div>
                  <div style="height: 4px; background: #e2e8f0; border-radius: 2px; overflow: hidden;">
                    <div style="height: 100%; width: ${pct.toFixed(1)}%; background: #64748b;"></div>
                  </div>
                  <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${pct.toFixed(1)}%</div>
                </div>
              `;
            }).join('')}
          ` : ''}

          ${campaignMetricTotal !== null && unknownLocationMetric > 0 ? `
            <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin: 14px 0 8px;">
              Nieznana lokalizacja
            </div>
            <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 8px 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 11px; color: #1e293b;"><strong>Bez przypisania geograficznego</strong></span>
                <span style="font-size: 11px; font-weight: 600; color: #0f172a;">${formatCurrency(unknownLocationMetric)}</span>
              </div>
              <div style="height: 4px; background: #e2e8f0; border-radius: 2px; overflow: hidden;">
                <div style="height: 100%; width: ${totalMetric > 0 ? ((unknownLocationMetric / totalMetric) * 100).toFixed(1) : 0}%; background: #94a3b8;"></div>
              </div>
              <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
                ${totalMetric > 0 ? ((unknownLocationMetric / totalMetric) * 100).toFixed(1) : '0.0'}% wartości kampanii
              </div>
            </div>
          ` : ''}
        </div>
      </div>
      </div>

      ${options?.includeCityTable !== false && cityRows.length > 0 ? `
        <div class="city-table" style="margin-top: 16px;">
          <h3 class="table-title">Najlepiej konwertujące miasta</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Miasto</th>
                <th>Województwo</th>
                <th>Wydatki</th>
                <th>Kliknięcia</th>
                <th>Wartość konwersji</th>
              </tr>
            </thead>
            <tbody>
              ${cityRows.map((r: any) => {
                const spend = r.spend || 0;
                const convVal = r.conversion_value || 0;
                const regionName = r.countryCode && r.countryCode !== 'PL'
                  ? (r.regionName || r.region || r.countryName || r.countryCode)
                  : formatPolishVoivodeshipName(r);
                return `
                  <tr>
                    <td>${formatPolishCityName(r.cityName)}</td>
                    <td>${regionName}</td>
                    <td class="number">${formatCurrency(spend)}</td>
                    <td class="number">${formatNumber(r.clicks || 0)}</td>
                    <td class="number">${formatCurrency(convVal)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}
    </div>
  `;
};

const generateGoogleCityTableHTML = (geographicData: any[]): string => {
  if (!geographicData || geographicData.length === 0) return '';
  const { formatPolishCityName, formatPolishVoivodeshipName } = require('@/lib/polish-geo-display');
  const cityRows = [...geographicData]
    .filter((r: any) => r.cityName && r.cityName !== '(nieznane)')
    .sort((a: any, b: any) => (b.clicks || 0) - (a.clicks || 0))
    .slice(0, 15);
  if (cityRows.length === 0) return '';
  return framedSection('Najlepiej konwertujące miasta', hotelTable(
    ['Miasto', 'Województwo', 'Kraj', 'Wydatki', 'Kliknięcia', 'Konwersje', 'Wartość konwersji', 'ROAS'],
    cityRows.map((r: any) => {
      const spend = parsePdfNumber(r.spend);
      const clicks = parsePdfNumber(r.clicks);
      const conversions = parsePdfNumber(r.conversions);
      const convVal = parsePdfNumber(r.conversion_value || r.reservation_value);
      const roas = spend > 0 ? convVal / spend : 0;
      const regionName = r.countryCode && r.countryCode !== 'PL'
        ? (r.regionName || r.region || r.countryName || r.countryCode)
        : formatPolishVoivodeshipName(r);
      return [
        escapeHtml(formatPolishCityName(r.cityName)),
        escapeHtml(regionName),
        escapeHtml(r.countryName || r.countryCode || 'Polska'),
        formatCurrency(spend),
        formatNumber(clicks),
        formatNumber(conversions),
        formatCurrency(convVal),
        `${roas.toFixed(2)}x`,
      ];
    }),
    'city-table'
  ));
};

/**
 * Google-specific demographic chart generator.
 *
 * Why this is separate from generateDemographicChartsHTML (Meta):
 * Meta returns rows with BOTH age and gender per row (breakdowns=age,gender).
 * Google Ads API returns gender_view rows (gender only) and age_range_view
 * rows (age only) as TWO independent dimensions — they cannot be cross-tabbed
 * via the API. Each row from the fetcher is tagged with exactly one of
 * `gender` or `ageRange`; we filter on the tag before aggregating, which
 * avoids the "Nieznane bucket" double-count that would happen if we reused
 * the Meta helper.
 */
const generateGoogleDemographicChartsHTML = (demographicData: any[]) => {
  if (!demographicData || demographicData.length === 0) {
    return '';
  }

  const genderRows = demographicData.filter((r) => r && r.gender !== undefined && r.gender !== null);
  const ageRows = demographicData.filter((r) => r && (r.ageRange ?? r.age) !== undefined && (r.ageRange ?? r.age) !== null);

  if (genderRows.length === 0 && ageRows.length === 0) {
    return '';
  }

  const parseNum = (v: unknown): number => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return parseFloat(v) || 0;
    return 0;
  };

  const aggregate = (
    rows: any[],
    keyFn: (r: any) => string,
    metric: 'spend' | 'clicks' | 'reservation_value' | 'impressions'
  ): Array<[string, number]> => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      const key = keyFn(r) || 'Nieznane';
      map.set(key, (map.get(key) || 0) + parseNum(r[metric]));
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  };

  const genderColors = ['#8B5CF6', '#3B82F6', '#6B7280'];
  const ageColors = ['#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444', '#6B7280', '#F97316'];

  const pieChart = (
    entries: Array<[string, number]>,
    colors: string[],
    title: string,
    formatValue: (v: number) => string,
  ): string => {
    const total = entries.reduce((s, [, v]) => s + v, 0);
    if (total <= 0) {
      return `
        <div class="demographic-chart">
          <h5>${title}</h5>
          <div class="pie-chart-container">
            <div class="text-center text-xs text-gray-500" style="padding: 24px 0;">Brak danych w tym okresie</div>
          </div>
        </div>`;
    }
    let cumulative = 0;
    const segments = entries.map(([label, value], idx) => {
      const pct = (value / total) * 100;
      const start = cumulative * 3.6;
      const end = (cumulative + pct) * 3.6;
      cumulative += pct;
      return { label, value, pct: pct.toFixed(1), color: colors[idx] || '#94a3b8', start, end };
    });
    return `
      <div class="demographic-chart">
        <h5>${title}</h5>
        <div class="pie-chart-container">
          <div class="pie-chart">
            <svg width="200" height="200" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="80" fill="transparent" stroke="#e5e7eb" stroke-width="2"/>
              ${segments.map((s) => {
                const x1 = 100 + 80 * Math.cos((s.start - 90) * Math.PI / 180);
                const y1 = 100 + 80 * Math.sin((s.start - 90) * Math.PI / 180);
                const x2 = 100 + 80 * Math.cos((s.end - 90) * Math.PI / 180);
                const y2 = 100 + 80 * Math.sin((s.end - 90) * Math.PI / 180);
                const largeArc = s.end - s.start > 180 ? 1 : 0;
                return `<path d="M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${s.color}" stroke="white" stroke-width="2"/>`;
              }).join('')}
            </svg>
          </div>
          <div class="pie-legend">
            ${segments.map((s) => `
              <div class="legend-item">
                <div class="legend-color" style="background-color: ${s.color};"></div>
                <div class="legend-info">
                  <span class="legend-label">${s.label}</span>
                  <div class="legend-stats">
                    <span class="legend-value">${formatValue(s.value)}</span>
                    <span class="legend-percentage">${s.pct}%</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  };

  const chartsForMetric = (metric: 'spend' | 'clicks' | 'reservation_value') => {
    const genderEntries = aggregate(genderRows, (r) => r.gender, metric);
    const ageEntries = aggregate(ageRows, (r) => r.ageRange ?? r.age, metric);
    const label = metric === 'reservation_value' ? 'Wartość konwersji' : metric === 'spend' ? 'Wydatki' : 'Kliknięcia';
    const fmt = metric === 'clicks' ? formatNumber : formatCurrency;
    return `
      <div class="metric-section">
        <h4 class="metric-title">${label}</h4>
        <div class="demographics-grid">
          ${pieChart(genderEntries, genderColors, 'Podział według Płci', fmt)}
          ${pieChart(ageEntries, ageColors, 'Podział według Grup Wiekowych', fmt)}
        </div>
      </div>
    `;
  };

  return `
    <div class="demographics-section">
      <h4 class="demographics-title">Demografia</h4>
      ${chartsForMetric('reservation_value')}
      ${chartsForMetric('clicks')}
    </div>
  `;
};

// Generate Section 8: Google Ads Campaign Details
const generateGoogleCampaignDetailsSection = (reportData: ReportData) => {
  if (!reportData.googleData) return '';

  const tables = (reportData.googleData.tables ?? {}) as Record<string, any>;
  const { campaigns } = reportData.googleData;

  // Build campaign-level totals from the same campaigns array used by the KPI
  // section so the Poland map can compute "Nieznana lokalizacja" as the gap
  // between this and the geographic_view sum.
  const geoCampaignTotals = campaigns.reduce(
    (acc, c: any) => ({
      spend: acc.spend + (Number(c?.spend) || 0),
      clicks: acc.clicks + (Number(c?.clicks) || 0),
      conversions: acc.conversions + (Number(c?.conversions) || 0),
      conversion_value:
        acc.conversion_value +
        (Number(c?.conversion_value ?? c?.total_conversion_value ?? c?.reservation_value) || 0),
    }),
    { spend: 0, clicks: 0, conversions: 0, conversion_value: 0 },
  );
  // Show campaigns with spend data
  const campaignsWithSpend = campaigns.filter(campaign => (campaign.spend || 0) > 0);
  
  // Don't generate section if no campaigns with spend
  if (campaignsWithSpend.length === 0) return '';
  
  // Wszystkie kampanie z wydatkiem — jak w Meta Ads (sort malejąco po spend)
  const sortedCampaigns = [...campaignsWithSpend].sort((a, b) => (b.spend || 0) - (a.spend || 0));
  
  return `
    <div class="campaign-details-section" style="padding: 0 2mm;">
      <h2 class="section-title">Google Ads - Szczegóły Kampanii</h2>
        
        <div class="campaigns-table">
          <h3 class="table-title">Kampanie wg Wydatków</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Nazwa kampanii</th>
                  <th>${pdfMetricLabel(reportData, 'google', 'campaign_table', 'totalSpend', 'Wydatki')}</th>
                  <th>${pdfMetricLabel(reportData, 'google', 'campaign_table', 'totalImpressions', 'Wyświetlenia')}</th>
                  <th>${pdfMetricLabel(reportData, 'google', 'campaign_table', 'totalClicks', 'Kliknięcia')}</th>
                  <th>${pdfMetricLabel(reportData, 'google', 'campaign_table', 'reservations', 'Ilość Rezerwacji')}</th>
                  <th>${pdfMetricLabel(reportData, 'google', 'campaign_table', 'reservation_value', 'Wartość Rezerwacji')}</th>
                  <th>${pdfMetricLabel(reportData, 'google', 'campaign_table', 'roas', 'ROAS')}</th>
              </tr>
            </thead>
            <tbody>
              ${sortedCampaigns.map(campaign => `
                <tr>
                  <td class="campaign-name">${campaign.campaign_name || campaign.campaignName || campaign.name || campaign.id || 'Nieznana kampania'}</td>
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
                ${tables.networkPerformance.slice(0, 10).map((network: any) => `
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
        
        <!-- Device Performance (now includes conversions + value + ROAS) -->
        ${pdfMetricVisible(reportData, 'google', 'device_table', 'device') && tables.devicePerformance && tables.devicePerformance.length > 0 ? `
          <div class="device-table">
            <h3 class="table-title">Wydajność Urządzeń</h3>
            <table class="data-table">
              <thead>
                <tr>
                  ${pdfMetricVisible(reportData, 'google', 'device_table', 'device') ? `<th>${pdfMetricLabel(reportData, 'google', 'device_table', 'device', 'Urządzenie')}</th>` : ''}
                  ${pdfMetricVisible(reportData, 'google', 'device_table', 'totalSpend') ? `<th>${pdfMetricLabel(reportData, 'google', 'device_table', 'totalSpend', 'Wydatki')}</th>` : ''}
                  ${pdfMetricVisible(reportData, 'google', 'device_table', 'totalImpressions') ? `<th>${pdfMetricLabel(reportData, 'google', 'device_table', 'totalImpressions', 'Wyświetlenia')}</th>` : ''}
                  ${pdfMetricVisible(reportData, 'google', 'device_table', 'totalClicks') ? `<th>${pdfMetricLabel(reportData, 'google', 'device_table', 'totalClicks', 'Kliknięcia')}</th>` : ''}
                  ${pdfMetricVisible(reportData, 'google', 'device_table', 'totalConversions') ? `<th>${pdfMetricLabel(reportData, 'google', 'device_table', 'totalConversions', 'Konwersje')}</th>` : ''}
                  ${pdfMetricVisible(reportData, 'google', 'device_table', 'conversion_value') ? `<th>${pdfMetricLabel(reportData, 'google', 'device_table', 'conversion_value', 'Wartość konwersji')}</th>` : ''}
                  ${pdfMetricVisible(reportData, 'google', 'device_table', 'roas') ? `<th>${pdfMetricLabel(reportData, 'google', 'device_table', 'roas', 'ROAS')}</th>` : ''}
                </tr>
              </thead>
              <tbody>
                ${tables.devicePerformance.slice(0, 10).map((device: any) => {
                  const spend = typeof device.spend === 'string' ? parseFloat(device.spend) : (device.spend || 0);
                  const conv = typeof device.conversions === 'string' ? parseFloat(device.conversions) : (device.conversions || 0);
                  const convVal = typeof device.conversion_value === 'string' ? parseFloat(device.conversion_value) : (device.conversion_value || 0);
                  const roas = typeof device.roas === 'number' ? device.roas : (spend > 0 ? convVal / spend : 0);
                  return `
                  <tr>
                    ${pdfMetricVisible(reportData, 'google', 'device_table', 'device') ? `<td>${googleAdsDeviceLabelPl(device.device ?? device.deviceType)}</td>` : ''}
                    ${pdfMetricVisible(reportData, 'google', 'device_table', 'totalSpend') ? `<td class="number">${formatCurrency(spend)}</td>` : ''}
                    ${pdfMetricVisible(reportData, 'google', 'device_table', 'totalImpressions') ? `<td class="number">${formatNumber(device.impressions || 0)}</td>` : ''}
                    ${pdfMetricVisible(reportData, 'google', 'device_table', 'totalClicks') ? `<td class="number">${formatNumber(device.clicks || 0)}</td>` : ''}
                    ${pdfMetricVisible(reportData, 'google', 'device_table', 'totalConversions') ? `<td class="number">${formatNumber(conv)}</td>` : ''}
                    ${pdfMetricVisible(reportData, 'google', 'device_table', 'conversion_value') ? `<td class="number">${formatCurrency(convVal)}</td>` : ''}
                    ${pdfMetricVisible(reportData, 'google', 'device_table', 'roas') ? `<td class="number">${roas.toFixed(2)}x</td>` : ''}
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        <!-- Demographic Performance (gender + age, R.100) — always show heading so PDF matches UI expectations -->
        ${pdfMetricVisible(reportData, 'google', 'demographic_breakdown', 'age') || pdfMetricVisible(reportData, 'google', 'demographic_breakdown', 'gender') ? `<div class="google-demographics-pdf-block" style="margin-top: 16px;">
          <h3 class="table-title">Demografia</h3>
          ${(tables.demographicPerformance && tables.demographicPerformance.length > 0)
            ? (generateGoogleDemographicChartsHTML(tables.demographicPerformance) || `
              <p style="font-size: 12px; color: #64748b; padding: 12px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
                Brak danych demograficznych dla tego okresu.
              </p>`)
            : `
              <p style="font-size: 12px; color: #64748b; padding: 12px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
                Brak danych demograficznych dla tego okresu.
              </p>`
          }
        </div>` : ''}

        <!-- Geographic Performance -->
        ${pdfMetricVisible(reportData, 'google', 'geographic_map', 'region') || pdfMetricVisible(reportData, 'google', 'geographic_map', 'city') ? `<div class="google-geographic-pdf-block" style="margin-top: 16px;">
          ${(tables.geographicPerformance && tables.geographicPerformance.length > 0)
            ? (generateGoogleGeographicSectionHTML(tables.geographicPerformance, geoCampaignTotals) || `
              <p style="font-size: 12px; color: #64748b; padding: 12px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
                Nie udało się przygotować widoku mapy dla zebranych danych lokalizacyjnych.
              </p>`)
            : `
              <p style="font-size: 12px; color: #64748b; padding: 12px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
                Brak danych regionalnych dla tego okresu.
              </p>`
          }
        </div>` : ''}
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
      <p style="font-size: 12px; color: #6B7280; margin-bottom: 16px;">Google Ads, następnie Meta Ads — kluczowe metryki</p>
      <svg width="${width}" height="${height}" style="background: white; border-radius: 8px; border: 1px solid rgba(0,0,0,0.08);">
        ${metrics.map((metric, i) => {
          const maxValue = Math.max(metric.meta, metric.google);
          const metaWidth = maxValue > 0 ? (metric.meta / maxValue) * chartWidth * 0.85 : 0;
          const googleWidth = maxValue > 0 ? (metric.google / maxValue) * chartWidth * 0.85 : 0;
          
          const yBase = padding.top + i * groupGap;
          
          return `
            <!-- Metric Label -->
            <text x="${padding.left - 10}" y="${yBase + barHeight + 5}" text-anchor="end" font-size="13" font-weight="600" fill="#1F2937">${metric.label}</text>
            
            <!-- Google Bar (góra) -->
            <rect x="${padding.left}" y="${yBase}" width="${googleWidth}" height="${barHeight}" fill="#34A853" rx="4"/>
            <text x="${padding.left + googleWidth + 8}" y="${yBase + barHeight - 3}" font-size="11" font-weight="600" fill="#1F2937">${metric.format(metric.google)}</text>
            
            <!-- Meta Bar (dół) -->
            <rect x="${padding.left}" y="${yBase + barHeight + 8}" width="${metaWidth}" height="${barHeight}" fill="#1877F2" rx="4"/>
            <text x="${padding.left + metaWidth + 8}" y="${yBase + barHeight * 2 + 5}" font-size="11" font-weight="600" fill="#1F2937">${metric.format(metric.meta)}</text>
          `;
        }).join('')}
        
        <!-- Legend -->
        <g transform="translate(${padding.left}, ${height - 35})">
          <rect x="0" y="0" width="12" height="12" fill="#34A853" rx="2"/>
          <text x="18" y="10" font-size="12" fill="#1F2937">Google Ads</text>
          
          <rect x="100" y="0" width="12" height="12" fill="#1877F2" rx="2"/>
          <text x="118" y="10" font-size="12" fill="#1F2937">Meta Ads</text>
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
  
  // Calculate combined totals (ReportData uses metrics, not stats)
  const mImp = metaData?.metrics?.totalImpressions || 0;
  const gImp = googleData?.metrics?.totalImpressions || 0;
  const mClk = metaData?.metrics?.totalClicks || 0;
  const gClk = googleData?.metrics?.totalClicks || 0;
  const totalSpend = (metaData?.metrics?.totalSpend || 0) + (googleData?.metrics?.totalSpend || 0);
  const totalConversions =
    (metaData?.metrics?.totalConversions || 0) + (googleData?.metrics?.totalConversions || 0);
  const totalRevenue =
    (metaData?.metrics?.totalReservationValue || 0) +
    (googleData?.metrics?.totalReservationValue || 0);
  const totalClicks = mClk + gClk;
  const totalImpressions = mImp + gImp;

  const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const metaCtr = metaData?.metrics
    ? ctrPercentFromStats(metaData.metrics.averageCtr, mClk, mImp)
    : 0;
  const googleCtr = googleData?.metrics
    ? ctrPercentFromStats(googleData.metrics.averageCtr, gClk, gImp)
    : 0;
  const ctr =
    mImp > 0 && gImp > 0
      ? ctrPercentBlended({ ctr: metaCtr, impressions: mImp }, { ctr: googleCtr, impressions: gImp })
      : mImp > 0
        ? metaCtr
        : gImp > 0
          ? googleCtr
          : totalImpressions > 0
            ? (totalClicks / totalImpressions) * 100
            : 0;
  const mSpend = metaData?.metrics?.totalSpend || 0;
  const gSpend = googleData?.metrics?.totalSpend || 0;
  const metaCpc = metaData?.metrics
    ? cpcFromStats(metaData.metrics.averageCpc, mSpend, mClk)
    : 0;
  const googleCpc = googleData?.metrics
    ? cpcFromStats(googleData.metrics.averageCpc, gSpend, gClk)
    : 0;
  const cpc =
    mClk > 0 && gClk > 0
      ? cpcBlended({ cpc: metaCpc, clicks: mClk }, { cpc: googleCpc, clicks: gClk })
      : mClk > 0
        ? metaCpc
        : gClk > 0
          ? googleCpc
          : totalClicks > 0
            ? totalSpend / totalClicks
            : 0;
  
  const getDelta = (current: number, previous: number) => {
    if (current === 0 || previous === 0) return null;
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
          ${renderKPICard('Współczynnik kliknięć z linku', `${ctr.toFixed(2)}%`, null)}
          ${renderKPICard('Koszt kliknięcia linku', `${cpc.toFixed(2)} zł`, null)}
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
    const metaSpend = metaData.metrics?.totalSpend || 0;
    const googleSpend = googleData.metrics?.totalSpend || 0;

    if (metaSpend > googleSpend * 1.5) {
      insights.push('<strong>Dominacja Meta Ads:</strong> Meta Ads stanowi większość wydatków reklamowych. Rozważ dywersyfikację budżetu dla zrównoważonej strategii wielokanałowej.');
    }
  }
  
  // ROAS analysis
  if (metaData) {
    const metaRv = metaData.metrics?.totalReservationValue || 0;
    const metaSp = metaData.metrics?.totalSpend || 0;
    const metaRoas = metaSp > 0 && metaRv > 0 ? metaRv / metaSp : 0;
    
    if (metaRoas > 3) {
      insights.push('<strong>Wysoki ROAS Meta Ads:</strong> Kampanie Meta Ads wykazują silny zwrot z inwestycji (ROAS > 3.0). Rozważ zwiększenie budżetu na najskuteczniejsze kampanie.');
    } else if (metaRoas < 1.5) {
      insights.push('<strong>Możliwość optymalizacji:</strong> ROAS Meta Ads poniżej 1.5. Zalecana analiza targetowania, kreacji reklamowych i stawek CPC.');
    }
  }
  
  // CTR insights — same source as Meta KPI card (metrics.averageCtr with totals fallback)
  if (metaData?.metrics) {
    const ctr = ctrPercentFromStats(
      metaData.metrics.averageCtr,
      metaData.metrics.totalClicks ?? 0,
      metaData.metrics.totalImpressions ?? 0
    );

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
        <meta name="robots" content="noindex, nofollow">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
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
                font-family: 'Inter', 'Roboto', 'Helvetica Neue', Helvetica, Arial, sans-serif;
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
            
            /* Cover page 1: vertically center logo + report title block */
            .title-page--cover {
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: stretch;
                box-sizing: border-box;
            }
            .page-content--cover {
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                flex: 1;
                width: 100%;
                min-height: 0;
            }
            .clean-title-section--cover {
                width: 100%;
            }
            .clean-cover-hero--centered {
                justify-content: center !important;
                align-items: center;
                width: 100%;
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
                width: 100%;
                max-width: 100%;
                margin: 0 auto;
                box-sizing: border-box;
            }
            
            .section-container:first-child {
                padding-top: 0;
            }
            
            .page-content {
                max-width: 100%;
                margin: 0 auto;
                width: 100%;
                min-width: 0;
                box-sizing: border-box;
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
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 16px;
                margin: 24px 0 32px 0;
                page-break-inside: avoid;
                width: 100%;
                max-width: 100%;
                box-sizing: border-box;
            }
            
            .kpi-card {
                background: #FFFFFF;
                border: 1px solid #E2E8F0;
                border-radius: 6px;
                padding: 16px;
                min-width: 0;
                max-width: 100%;
                box-sizing: border-box;
                page-break-inside: avoid;
            }
            
            .kpi-label {
                font-size: 10px;
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                color: #64748B;
                margin-bottom: 12px;
                white-space: normal;
                overflow-wrap: anywhere;
            }
            
            .kpi-value {
                font-size: 21px;
                font-weight: 600;
                color: #0F172A;
                margin-bottom: 4px;
                font-variant-numeric: tabular-nums;
                max-width: 100%;
                white-space: normal;
                overflow-wrap: anywhere;
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
                display: flex;
                flex-direction: column;
            }

            .clean-cover-hero {
                display: flex;
                flex-direction: column;
                justify-content: flex-start;
                align-items: center;
                padding-top: 0;
                margin-top: 0;
            }
            
            .clean-logo-container {
                margin-bottom: 6mm;
                display: flex;
                justify-content: center;
                align-items: center;
                width: 100%;
            }
            
            /* ~2× previous cover logo size; scoped to cover page only */
            .title-page--cover .clean-client-logo {
                width: 80%;
                max-width: 150mm;
                min-width: 124mm;
                max-height: 104mm;
                height: auto;
                object-fit: contain;
                display: block;
            }
            
            .clean-title-header {
                margin-bottom: 0;
            }
            
            .clean-main-title {
                font-size: var(--font-h1);
                line-height: 36px;
                font-weight: 600;
                color: var(--color-primary-navy);
                margin-bottom: var(--space-sm);
                margin-top: 0;
                letter-spacing: -0.025em;
            }
            
            .clean-company-name {
                font-size: var(--font-h2);
                font-weight: 500;
                color: var(--gray-700);
                margin-bottom: var(--space-md);
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
                margin-top: var(--space-lg);
                padding: var(--space-lg) 0 var(--space-md) 0;
                border-top: 2px solid var(--color-primary-navy);
                text-align: left;
                max-width: 100%;
            }
            
            /* Page 2: full-page executive summary (footer logo: Puppeteer footerTemplate on pages 2+) */
            .pdf-page-executive-summary {
                page-break-before: always;
                break-before: page;
                min-height: 297mm;
                max-width: 210mm;
                margin: 0 auto;
                padding: var(--page-margin);
                padding-top: var(--space-xl);
                box-sizing: border-box;
            }
            .clean-ai-summary-section--full-page {
                margin-top: 0;
                padding: 0 0 var(--space-md) 0;
                border-top: none;
                text-align: left;
                max-width: 100%;
                min-height: calc(297mm - 42mm);
                display: flex;
                flex-direction: column;
            }
            .clean-summary-content--full-page {
                flex: 1;
            }

            .clean-summary-title {
                font-size: 30px;
                font-weight: 600;
                color: var(--color-primary-navy);
                margin-bottom: var(--space-md);
                margin-top: 0;
                line-height: 1.3;
                letter-spacing: -0.02em;
            }
            
            .clean-summary-content {
                font-size: 17px;
                line-height: 1.75;
                color: var(--gray-700);
                margin: 0;
                padding: 0;
                text-align: justify;
                text-justify: inter-word;
                white-space: pre-line;
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
            
            /* Campaign Details Section — allow long tables to span pages; sub-blocks control breaks */
            .campaign-details-section {
                padding: 0;
                margin: 0;
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
                page-break-before: always;
                break-before: page;
            }
            
            .demographics-title {
                font-size: var(--font-h2);
                font-weight: 700;
                color: var(--text-primary);
                margin-bottom: var(--space-lg);
                text-align: center;
                page-break-after: avoid;
                break-after: avoid;
            }
            
            .metric-section {
                margin-bottom: var(--space-xxl);
                padding: var(--space-lg) 0;
                border-bottom: 1px solid var(--border-light);
                page-break-inside: avoid;
                break-inside: avoid;
            }

            /* Second+ metric (e.g. Kliknięcia after Wartość rezerwacji): always new page */
            .demographics-section .metric-section + .metric-section {
                page-break-before: always;
                break-before: page;
            }

            .metric-section:last-child {
                border-bottom: none;
            }

            /* Extra tables under campaign details: each block starts on a new page */
            .campaign-details-section .network-table,
            .campaign-details-section .device-table,
            .campaign-details-section .placement-table,
            .campaign-details-section .ad-relevance-table {
                page-break-before: always;
                break-before: page;
                page-break-inside: avoid;
                break-inside: avoid;
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
        ${generateCoverPage(sanitizedData)}
        ${generateExecutiveSummaryPage(sanitizedData)}
        ${generateConditionalSection(generateYoYSection(sanitizedData))}
        ${generateConditionalSection(generateGoogleMetricsSection(sanitizedData))}
        ${generateConditionalSection(generateGoogleFunnelSection(sanitizedData))}
        ${generateConditionalSection(generateGoogleCampaignDetailsSection(sanitizedData))}
        ${generateConditionalSection(generateMetaMetricsSection(sanitizedData))}
        ${generateConditionalSection(generateMetaFunnelSection(sanitizedData))}
        ${generateConditionalSection(generateMetaCampaignDetailsSection(sanitizedData))}
        ${generateFooter(sanitizedData)}
        </body>
    </html>
  `;
}

type HotelMetricCard = {
  label: string;
  value: string;
  delta?: number | null;
  subtext?: string;
};
type HotelPlatformMetrics =
  | NonNullable<ReportData['googleData']>['metrics']
  | NonNullable<ReportData['metaData']>['metrics'];
type ReportPlatform = 'google' | 'meta';
type ReportTableVariant = 'compact' | 'campaign' | 'placement' | 'city' | 'device' | 'appendix';
type ReportBlock = {
  title: string;
  subtitle?: string;
  kicker?: string;
  html: string;
  heightMm: number;
  className?: string;
  platform?: ReportPlatform | 'global';
};
type TableColumn = {
  key: string;
  label: string;
  compactLabel?: string;
  className?: string;
  value: (row: any) => string;
};

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const normalized = value.replace(/\s/g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parsePdfNumber(value: unknown): number {
  return safeNumber(value);
}

function safeDivide(numerator: unknown, denominator: unknown): number | null {
  const den = safeNumber(denominator);
  if (den === 0) return null;
  return safeNumber(numerator) / den;
}

function formatPercentValue(value: number | null, decimals = 1): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(decimals).replace('.', ',')}\u2060%`;
}

function formatROASValue(value: unknown): string {
  const numeric = safeNumber(value);
  if (!numeric) return '—';
  return `${numeric.toFixed(2).replace('.', ',')}\u2060x`;
}

const formatRoasNonBreaking = formatROASValue;

function getRowValue(row: any, key: string): unknown {
  const aliases: Record<string, string[]> = {
    campaign_name: ['campaign_name', 'campaignName', 'name', 'campaign_id', 'id'],
    placement: ['placement', 'publisher_platform', 'platform_position', 'name'],
    device: ['device', 'deviceType'],
    city: ['cityName', 'city', 'locationName'],
    region: ['regionName', 'region', 'voivodeship'],
    totalSpend: ['totalSpend', 'spend', 'cost'],
    totalImpressions: ['totalImpressions', 'impressions'],
    totalClicks: ['totalClicks', 'clicks'],
    totalConversions: ['totalConversions', 'conversions'],
    averageCtr: ['averageCtr', 'ctr'],
    averageCpc: ['averageCpc', 'cpc'],
    reservations: ['reservations', 'totalReservations'],
    reservation_value: ['reservation_value', 'totalReservationValue', 'conversion_value', 'total_conversion_value'],
    conversion_value: ['conversion_value', 'reservation_value', 'total_conversion_value'],
    roas: ['roas'],
  };
  const keys = aliases[key] || [key];
  for (const candidate of keys) {
    if (row?.[candidate] !== undefined && row?.[candidate] !== null) return row[candidate];
  }
  return undefined;
}

function metricLabel(reportData: ReportData, platform: ReportPlatform, section: MetricSection, key: string, fallback: string): string {
  return pdfMetricLabel(reportData, platform, section, key, fallback);
}

function visibleMetricLabel(reportData: ReportData, platform: ReportPlatform, section: MetricSection, key: string, fallback: string): string | null {
  return pdfMetricVisible(reportData, platform, section, key)
    ? metricLabel(reportData, platform, section, key, fallback)
    : null;
}

function compactTableLabel(label: string, key: string): string {
  const compactByKey: Record<string, string> = {
    totalImpressions: 'Wyśw.',
    impressions: 'Wyśw.',
    totalClicks: 'Klik.',
    clicks: 'Klik.',
    totalConversions: 'Konw.',
    conversions: 'Konw.',
    reservations: 'Rez.',
    totalReservations: 'Rez.',
    reservation_value: 'Wartość',
    conversion_value: 'Wartość',
    totalReservationValue: 'Wartość',
    totalSpend: 'Wydatki',
    spend: 'Wydatki',
    roas: 'ROAS',
    averageCtr: 'CTR',
    averageCpc: 'CPC',
  };
  return compactByKey[key] || label;
}

function categoryDisplayLabel(rawCategory: unknown): string {
  const value = String(rawCategory ?? '').trim();
  if (!value) return 'Nieznane';
  const normalized = value.toLowerCase();
  const map: Record<string, string> = {
    female: 'Kobiety',
    kobieta: 'Kobiety',
    kobiety: 'Kobiety',
    male: 'Mężczyźni',
    mezczyzna: 'Mężczyźni',
    mężczyzna: 'Mężczyźni',
    mężczyźni: 'Mężczyźni',
    unknown: 'Nieznane',
    unspecified: 'Nieznane',
    nieznane: 'Nieznane',
  };
  return map[normalized] || value;
}

function combinedContactsLabel(reportData: ReportData): string {
  const emailLabel = metricLabel(reportData, 'google', 'contact', 'email_contacts', 'Kontakty e-mail');
  const phoneLabel = metricLabel(reportData, 'google', 'contact', 'click_to_call', 'Kliknięcia w telefon');
  return emailLabel === phoneLabel ? emailLabel : 'Kontakty łącznie';
}

function getCampaignName(campaign: any): string {
  return String(
    campaign?.campaign_name ||
    campaign?.campaignName ||
    campaign?.name ||
    campaign?.campaign_id ||
    campaign?.id ||
    'Nieznana kampania'
  );
}

function formatDateRangeShort(range: ReportData['dateRange']): string {
  const start = new Date(`${range.start}T00:00:00`);
  const end = new Date(`${range.end}T00:00:00`);
  const month = end.toLocaleDateString('pl-PL', { month: 'long' }).toUpperCase();
  const startDay = String(start.getDate()).padStart(2, '0');
  const endDay = String(end.getDate()).padStart(2, '0');
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${startDay}–${endDay} ${month} ${end.getFullYear()}`;
  }
  return `${start.toLocaleDateString('pl-PL')} – ${end.toLocaleDateString('pl-PL')}`.toUpperCase();
}

function hotelWordmark(reportData: ReportData): string {
  if (reportData.clientLogo) {
    return `<img class="hotel-logo" src="${escapeHtml(reportData.clientLogo)}" alt="${escapeHtml(reportData.clientName)}" />`;
  }
  return `
    <div class="hotel-wordmark">
      <div class="hotel-wordmark-name">${escapeHtml(reportData.clientName)}</div>
      <div class="hotel-wordmark-rule"><span></span><small>RAPORT MARKETINGOWY</small><span></span></div>
    </div>
  `;
}

function hotelReportPage(
  reportData: ReportData,
  pageNumber: number,
  title: string,
  subtitle: string,
  body: string,
  sectionLabel = '',
  pageClass = '',
): string {
  const clientName = escapeHtml(reportData.clientName || '');
  const period = escapeHtml(formatDateRangeShort(reportData.dateRange));
  const brandLogo = getPdfBrandLogoDataUrl();
  return `
    <section class="hotel-page${pageClass ? ` ${pageClass}` : ''}" data-page-title="${escapeHtml(title)}">
      <div class="page-border"></div>
      <header class="running-header">
        <div class="running-header-center">${hotelWordmark(reportData)}</div>
      </header>
      <main class="page-main">
        <div class="page-title-block">
          <h1>${escapeHtml(title)}</h1>
          ${subtitle ? `<div class="page-subtitle">${escapeHtml(subtitle)}</div>` : ''}
          <div class="period-pill">${period}</div>
          ${sectionLabel ? `<div class="section-kicker"><span></span>${escapeHtml(sectionLabel)}<span></span></div>` : ''}
        </div>
        ${body}
      </main>
      <footer class="hotel-footer">
        <div class="agency-mark">
          ${brandLogo ? `<img src="${brandLogo}" alt="Piotr Bajerlein Marketing" />` : '<span class="agency-fallback">PB<br/><small>MARKETING</small></span>'}
          <span>PIOTR BAJERLEIN<br/>MARKETING</span>
        </div>
        <div class="footer-client">${clientName}</div>
        <div class="footer-page-number">STRONA ${pageNumber}</div>
      </footer>
    </section>
  `;
}

function metricDeltaBadge(delta: number | null | undefined): string {
  if (typeof delta !== 'number' || !Number.isFinite(delta)) return '';
  const deltaClass = delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral';
  return `<span class="metric-delta ${deltaClass}">${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(1).replace('.', ',')}% <small>vs rok do roku</small></span>`;
}

function normalizeMetricDelta(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const delta = safeNumber(value);
  return Number.isFinite(delta) ? delta : null;
}

function yoyMetricChange(
  side: NonNullable<ReportData['yoyComparison']>[ReportPlatform] | undefined,
  metricKey: string,
): number | null {
  const changes = side?.changes;
  if (!changes) return null;

  switch (metricKey) {
    case 'totalSpend':
    case 'spend':
      return normalizeMetricDelta(changes.spend);
    case 'totalImpressions':
    case 'impressions':
      return normalizeMetricDelta(changes.impressions);
    case 'totalClicks':
    case 'clicks':
      return normalizeMetricDelta(changes.clicks);
    case 'reservations':
    case 'totalReservations':
    case 'totalConversions':
      return normalizeMetricDelta(changes.reservations ?? changes.conversions);
    case 'reservation_value':
    case 'reservationValue':
    case 'conversion_value':
      return normalizeMetricDelta(changes.reservationValue);
    case 'booking_step_1':
      return normalizeMetricDelta(changes.booking_step_1);
    case 'booking_step_2':
      return normalizeMetricDelta(changes.booking_step_2);
    case 'booking_step_3':
      return normalizeMetricDelta(changes.booking_step_3);
    default:
      return null;
  }
}

function hotelMetricCard(card: HotelMetricCard): string {
  const delta = metricDeltaBadge(card.delta);
  return `
    <div class="hotel-metric-card">
      <div class="metric-label">${escapeHtml(card.label)}</div>
      <div class="metric-value">${card.value}</div>
      ${delta ? `<div class="metric-delta-row">${delta}</div>` : ''}
      ${card.subtext ? `<div class="metric-subtext">${escapeHtml(card.subtext)}</div>` : ''}
    </div>
  `;
}

function metricStrip(cards: HotelMetricCard[], columns = 3): string {
  return `<div class="metric-strip cols-${columns}">${cards.map(hotelMetricCard).join('')}</div>`;
}

function framedSection(title: string, content: string, extraClass = ''): string {
  return `
    <section class="framed-section ${extraClass}">
      <div class="framed-title"><span></span>${escapeHtml(title)}<span></span></div>
      ${content}
    </section>
  `;
}

function hotelTable(headers: string[], rows: string[][], className = '', variant: ReportTableVariant = 'compact'): string {
  return `
    <table class="hotel-table report-table-${variant} ${className}">
      <thead>
        <tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows.length > 0
          ? rows.map((row) => `<tr>${row.map((cell, idx) => `<td class="${idx === 0 ? 'text-cell' : 'number-cell'}">${cell}</td>`).join('')}</tr>`).join('')
          : `<tr><td colspan="${headers.length}" class="empty-cell">Brak danych dla wybranego okresu.</td></tr>`}
      </tbody>
    </table>
  `;
}

const REPORT_LAYOUT = {
  PAGE_WIDTH_MM: 108,
  PAGE_HEIGHT_MM: 192,
  CSS_PX_PER_MM: 96 / 25.4,
  CONTENT_HEIGHT_MM: 123,
  FULL_BODY_HEIGHT_MM: 132,
  BLOCK_GAP_MM: 5,
  TABLE_ROW_MM: 7.2,
  TABLE_CHROME_MM: 15,
};

const REPORT_PAGE_WIDTH_CSS_PX = REPORT_LAYOUT.PAGE_WIDTH_MM * REPORT_LAYOUT.CSS_PX_PER_MM;
const REPORT_PAGE_HEIGHT_CSS_PX = REPORT_LAYOUT.PAGE_HEIGHT_MM * REPORT_LAYOUT.CSS_PX_PER_MM;
const REPORT_PAGE_VIEWPORT_WIDTH_PX = Math.ceil(REPORT_PAGE_WIDTH_CSS_PX);
const REPORT_PAGE_VIEWPORT_HEIGHT_PX = Math.ceil(REPORT_PAGE_HEIGHT_CSS_PX);

function estimateTableBlockHeightMm(rowCount: number, hasTitle = true): number {
  return (hasTitle ? REPORT_LAYOUT.TABLE_CHROME_MM : 9) + rowCount * REPORT_LAYOUT.TABLE_ROW_MM;
}

function estimateRowCardBlockHeightMm(rowCount: number, variant: 'campaign' | 'placement'): number {
  const rowHeight = variant === 'placement' ? 24 : 21;
  return REPORT_LAYOUT.TABLE_CHROME_MM + rowCount * rowHeight;
}

function tableRowCapacityForAvailableHeightMm(availableHeightMm: number, hasTitle = true): number {
  const chromeMm = hasTitle ? REPORT_LAYOUT.TABLE_CHROME_MM : 9;
  return Math.max(1, Math.floor((availableHeightMm - chromeMm) / REPORT_LAYOUT.TABLE_ROW_MM));
}

function splitRowsBalanced<T>(rows: T[], maxRowsPerPage: number, minUsefulRows = 4): T[][] {
  if (rows.length <= maxRowsPerPage) return rows.length > 0 ? [rows] : [];
  const pageCount = Math.ceil(rows.length / maxRowsPerPage);
  const balancedSize = Math.ceil(rows.length / pageCount);
  const chunks: T[][] = [];
  for (let offset = 0; offset < rows.length; offset += balancedSize) {
    chunks.push(rows.slice(offset, offset + balancedSize));
  }
  const last = chunks[chunks.length - 1];
  const prev = chunks[chunks.length - 2];
  if (chunks.length > 1 && last && prev && last.length < minUsefulRows) {
    const needed = minUsefulRows - last.length;
    last.unshift(...prev.splice(Math.max(0, prev.length - needed), needed));
  }
  return chunks.filter((chunk) => chunk.length > 0);
}

function combinedMetrics(reportData: ReportData) {
  const meta = reportData.metaData?.metrics;
  const google = reportData.googleData?.metrics;
  const totalSpend = safeNumber(meta?.totalSpend) + safeNumber(google?.totalSpend);
  const totalReservations = safeNumber(meta?.totalReservations) + safeNumber(google?.totalReservations);
  const totalReservationValue = safeNumber(meta?.totalReservationValue) + safeNumber(google?.totalReservationValue);
  const roas = safeDivide(totalReservationValue, totalSpend) || 0;
  const costPerReservation = safeDivide(totalSpend, totalReservations) || 0;
  const emailContacts = safeNumber(meta?.emailContacts) + safeNumber(google?.emailContacts);
  const phoneContacts = safeNumber(meta?.phoneContacts) + safeNumber(google?.phoneContacts);
  return { totalSpend, totalReservations, totalReservationValue, roas, costPerReservation, contacts: emailContacts + phoneContacts, emailContacts, phoneContacts };
}

function summaryTextBlocks(reportData: ReportData): string[] {
  const meta = reportData.metaData?.metrics;
  const google = reportData.googleData?.metrics;
  const total = combinedMetrics(reportData);
  const summary = reportData.aiSummary?.trim();
  const text = summary || [
    `W okresie ${formatDateRangeShort(reportData.dateRange).toLowerCase()} analizowaliśmy skuteczność kampanii reklamowych prowadzonych w Google Ads oraz Meta Ads.`,
    '',
    'Google Ads',
    `Wydaliśmy ${formatCurrency(google?.totalSpend || 0)}. Kampania wygenerowała ${formatNumber(google?.totalImpressions || 0)} wyświetleń i ${formatNumber(google?.totalClicks || 0)} kliknięć, co przełożyło się na ${formatNumber(google?.totalReservations || 0)} rezerwacji.`,
    '',
    'Meta Ads',
    `Wydaliśmy ${formatCurrency(meta?.totalSpend || 0)}. Kampania wygenerowała ${formatNumber(meta?.totalImpressions || 0)} wyświetleń i ${formatNumber(meta?.totalClicks || 0)} kliknięć, co przełożyło się na ${formatNumber(meta?.totalReservations || 0)} rezerwacji.`,
    '',
    'Podsumowanie łączne',
    `Łącznie: ${formatNumber(total.totalReservations)} rezerwacji, wartość ${formatCurrency(total.totalReservationValue)}, ROAS ${formatROASValue(total.roas)}, średni koszt rezerwacji ${formatCurrency(total.costPerReservation)}.`,
    '',
    'Kontakty',
    `${formatNumber(total.emailContacts)} kontaktów e-mail i ${formatNumber(total.phoneContacts)} telefonicznych.`
  ].join('\n');

  return escapeHtml(text)
    .split(/\n{2,}/)
    .filter((block) => !/^Lejek konwersji\s*\(łącznie\)/i.test(block.trim()))
    .filter((block) => block.trim().length > 0);
}

function renderSummaryTextBlocks(blocks: string[]): string {
  return `<div class="summary-copy">${blocks
    .map((block) => {
      const lines = block.split('\n');
      if (lines.length > 1 && lines[0] && lines[0].length < 48) {
        return `<div class="summary-block"><h3>${lines[0]}</h3><p>${lines.slice(1).join('<br/>')}</p></div>`;
      }
      return `<p>${block.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('')}</div>`;
}

function chunkSummaryBlocks(blocks: string[], maxChars: number): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let length = 0;
  blocks.forEach((block) => {
    const blockLength = block.length;
    if (current.length > 0 && length + blockLength > maxChars) {
      chunks.push(current);
      current = [];
      length = 0;
    }
    current.push(block);
    length += blockLength;
  });
  if (current.length > 0) chunks.push(current);
  return chunks;
}

function renderBlocks(blocks: ReportBlock[]): string {
  return blocks.map((block) => `<div class="flow-block ${block.className || ''}" data-platform="${block.platform || 'global'}">${block.html}</div>`).join('');
}

function paginateBlocks(blocks: ReportBlock[], startPageNumber: number, reportData: ReportData): string[] {
  const pages: string[] = [];
  let current: ReportBlock[] = [];
  let used = 0;
  const flush = () => {
    if (current.length === 0) return;
    const first = current[0];
    if (!first) return;
    pages.push(hotelReportPage(
      reportData,
      startPageNumber + pages.length,
      first.title,
      first.subtitle || '',
      renderBlocks(current),
      first.kicker || '',
    ));
    current = [];
    used = 0;
  };

  blocks.forEach((block) => {
    const currentPlatform = current[0]?.platform;
    const isPlatformBoundary = current.length > 0
      && currentPlatform
      && block.platform
      && currentPlatform !== block.platform
      && !(currentPlatform === 'global' && block.platform === 'global');
    if (isPlatformBoundary) flush();
    let nextHeight = block.heightMm + (current.length > 0 ? REPORT_LAYOUT.BLOCK_GAP_MM : 0);
    if (current.length > 0 && used + nextHeight > REPORT_LAYOUT.CONTENT_HEIGHT_MM) {
      flush();
      nextHeight = block.heightMm;
    }
    current.push(block);
    used += nextHeight;
  });
  flush();
  return pages;
}

function buildMetricCards(
  reportData: ReportData,
  platform: ReportPlatform,
  section: MetricSection,
  metrics: Array<{ key: string; fallback: string; value: string; delta?: number | null }>,
): HotelMetricCard[] {
  return metrics
    .map((metric) => {
      const label = visibleMetricLabel(reportData, platform, section, metric.key, metric.fallback);
      return label ? { label, value: metric.value, delta: metric.delta } : null;
    })
    .filter(Boolean) as HotelMetricCard[];
}

function platformName(platform: ReportPlatform): string {
  return platform === 'google' ? 'Google Ads' : 'Meta Ads';
}

function platformData(reportData: ReportData, platform: ReportPlatform) {
  return platform === 'google' ? reportData.googleData : reportData.metaData;
}

function percentDelta(current: unknown, previous: unknown): number | null {
  const previousValue = safeNumber(previous);
  if (previousValue <= 0) return null;
  const currentValue = safeNumber(current);
  const delta = ((currentValue - previousValue) / previousValue) * 100;
  return Number.isFinite(delta) ? delta : null;
}

function yoyMetricValue(
  side: NonNullable<ReportData['yoyComparison']>[ReportPlatform] | undefined,
  period: 'current' | 'previous',
  metricKey: string,
): number | null {
  const data = side?.[period];
  if (!data) return null;
  const spend = safeNumber(data.spend);
  const impressions = safeNumber(data.impressions);
  const clicks = safeNumber(data.clicks);
  const reservations = safeNumber(data.reservations ?? data.conversions);
  const reservationValue = safeNumber(data.reservationValue);

  switch (metricKey) {
    case 'totalSpend':
    case 'spend':
      return spend;
    case 'totalImpressions':
    case 'impressions':
      return impressions;
    case 'totalClicks':
    case 'clicks':
      return clicks;
    case 'averageCtr':
      return impressions > 0 ? (clicks / impressions) * 100 : null;
    case 'averageCpc':
      return clicks > 0 ? spend / clicks : null;
    case 'reservations':
    case 'totalReservations':
    case 'totalConversions':
      return reservations;
    case 'reservation_value':
    case 'reservationValue':
    case 'conversion_value':
      return reservationValue;
    case 'roas':
      return spend > 0 ? reservationValue / spend : null;
    case 'cost_per_reservation':
      return reservations > 0 ? spend / reservations : null;
    case 'booking_step_1':
      return safeNumber(data.booking_step_1);
    case 'booking_step_2':
      return safeNumber(data.booking_step_2);
    case 'booking_step_3':
      return safeNumber(data.booking_step_3);
    default:
      return null;
  }
}

function platformMetricDelta(reportData: ReportData, platform: ReportPlatform, metricKey: string): number | null {
  const side = reportData.yoyComparison?.[platform];
  const previousValue = yoyMetricValue(side, 'previous', metricKey);
  if (safeNumber(previousValue) <= 0) return null;

  const storedChange = yoyMetricChange(side, metricKey);
  if (storedChange !== null) return storedChange;

  return percentDelta(
    yoyMetricValue(side, 'current', metricKey),
    yoyMetricValue(side, 'previous', metricKey),
  );
}

function comparisonBarRows(entries: Array<{ label: string; google: number; meta: number; formatter: (value: number) => string }>): string {
  return `
    <div class="comparison-bars">
      <div class="comparison-legend">
        <span><i class="legend-dot navy"></i>Google Ads</span>
        <span><i class="legend-dot copper"></i>Meta Ads</span>
      </div>
      ${entries.map((entry) => {
        const total = entry.google + entry.meta;
        const googlePct = total > 0 ? (entry.google / total) * 100 : 0;
        const metaPct = total > 0 ? (entry.meta / total) * 100 : 0;
        return `
          <div class="comparison-row">
            <div class="comparison-label">${escapeHtml(entry.label)}</div>
            <div class="comparison-line">
              <span class="comparison-platform">Google Ads</span>
              <div class="comparison-track navy"><span style="width:${googlePct.toFixed(1)}%"></span></div>
              <strong>${entry.formatter(entry.google)}</strong>
            </div>
            <div class="comparison-line">
              <span class="comparison-platform">Meta Ads</span>
              <div class="comparison-track copper"><span style="width:${metaPct.toFixed(1)}%"></span></div>
              <strong>${entry.formatter(entry.meta)}</strong>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function barPanel(title: string, entries: Array<[string, number]>, formatter: (v: number) => string = formatNumber, options?: { maxRows?: number }): string {
  const visible = entries.slice(0, options?.maxRows || 6);
  const total = visible.reduce((s, [, v]) => s + v, 0);
  return `
    <div class="bar-panel">
      <h3>${escapeHtml(title)}</h3>
      ${visible.length > 0 ? visible.map(([label, value]) => {
        const pct = safeDivide(value, total);
        const width = pct !== null ? pct * 100 : 0;
        return `
          <div class="bar-row">
            <div class="bar-row-head"><span>${escapeHtml(label)}</span><strong>${formatter(value)}</strong></div>
            <div class="bar-track"><div style="width:${width.toFixed(1)}%"></div></div>
          </div>
        `;
      }).join('') : '<div class="empty-panel">Brak danych.</div>'}
    </div>
  `;
}

function aggregateBy(rows: any[], keyFn: (row: any) => string, metric: string): Array<[string, number]> {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    const key = keyFn(row) || 'Nieznane';
    const value = safeNumber(row[metric] ?? row.conversion_value ?? row.reservation_value);
    map.set(key, (map.get(key) || 0) + value);
  });
  return Array.from(map.entries()).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
}

function donutChart(entries: Array<[string, number]>): string {
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total <= 0) return '<div class="donut-empty">Brak danych</div>';
  let cumulative = 0;
  const colors = ['#D85F36', '#0E2742', '#F3C7AF', '#8B8178'];
  const segments = entries.slice(0, 4).map(([, value], idx) => {
    const pct = (value / total) * 100;
    const dash = `${pct} ${100 - pct}`;
    const offset = -cumulative;
    cumulative += pct;
    return `<circle r="15.9155" cx="18" cy="18" fill="transparent" stroke="${colors[idx] || '#F3C7AF'}" stroke-width="6" stroke-dasharray="${dash}" stroke-dashoffset="${offset}" />`;
  }).join('');
  return `
    <div class="donut-wrap">
      <svg viewBox="-3 -3 42 42" class="donut">${segments}</svg>
      <div class="donut-legend">
        ${entries.slice(0, 4).map(([label, value], idx) => `<div><span style="background:${colors[idx] || '#F3C7AF'}"></span>${escapeHtml(label)} <strong>${formatPercentValue(safeDivide(value, total), 1)}</strong></div>`).join('')}
      </div>
    </div>
  `;
}

function configuredTableColumns(reportData: ReportData, platform: ReportPlatform, section: MetricSection, columns: TableColumn[]): TableColumn[] {
  const config = platform === 'google' ? reportData.metricsConfig?.google : reportData.metricsConfig?.meta;
  if (!config || config.length === 0) return columns;
  const allowed = new Set(getConfiguredColumns(config, section, { keys: columns.map((column) => column.key) }).map((column) => column.key));
  const configuredOrder = getConfiguredColumns(config, section, { keys: columns.map((column) => column.key) });
  const byKey = new Map(columns.map((column) => [column.key, column]));
  const ordered = configuredOrder
    .map((column) => byKey.get(column.key))
    .filter(Boolean) as TableColumn[];
  const dimensions = columns.filter((column) => column.className === 'dimension' && !ordered.some((orderedColumn) => orderedColumn.key === column.key));
  return [...dimensions, ...ordered.filter((column) => allowed.has(column.key))];
}

function tableFromColumns(rows: any[], columns: TableColumn[], className: string, variant: ReportTableVariant = 'compact'): string {
  return hotelTable(
    columns.map((column) => column.compactLabel || compactTableLabel(column.label, column.key)),
    rows.map((row) => columns.map((column) => column.value(row))),
    className,
    variant,
  );
}

function rowCardMetric(label: string, value: string): string {
  return `<div class="row-card-metric"><span>${escapeHtml(label)}</span><strong>${value || '—'}</strong></div>`;
}

function campaignRowCards(reportData: ReportData, platform: ReportPlatform, rows: any[]): string {
  return `
    <div class="report-row-cards report-table-campaign">
      ${rows.map((row) => {
        const value = safeNumber(getRowValue(row, 'reservation_value'));
        const spend = safeNumber(getRowValue(row, 'totalSpend'));
        const metrics = [
          { key: 'totalSpend', fallback: 'Wydatki', value: formatCurrency(spend) },
          { key: 'totalImpressions', fallback: 'Wyświetlenia', value: formatNumber(safeNumber(getRowValue(row, 'totalImpressions'))) },
          { key: 'totalClicks', fallback: 'Kliknięcia', value: formatNumber(safeNumber(getRowValue(row, 'totalClicks'))) },
          { key: 'reservations', fallback: 'Rezerwacje', value: formatNumber(safeNumber(getRowValue(row, 'reservations'))) },
          { key: 'reservation_value', fallback: 'Wartość rezerwacji', value: formatCurrency(value) },
          { key: 'roas', fallback: 'ROAS', value: formatROASValue(safeNumber(getRowValue(row, 'roas')) || safeDivide(value, spend)) },
        ].filter((metric) => pdfMetricVisible(reportData, platform, 'campaign_table', metric.key));
        return `
          <article class="report-row-card campaign-row-card">
            <h3>${escapeHtml(getCampaignName(row))}</h3>
            <div class="row-card-grid">
              ${metrics.map((metric) => rowCardMetric(metricLabel(reportData, platform, 'campaign_table', metric.key, metric.fallback), metric.value)).join('')}
            </div>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function placementRowCards(reportData: ReportData, rows: any[]): string {
  return `
    <div class="report-row-cards report-table-placement">
      ${rows.map((row) => {
        const spend = safeNumber(row.spend);
        const value = safeNumber(row.reservation_value);
        const metrics = [
          { key: 'totalSpend', fallback: 'Wydatki', value: formatCurrency(spend) },
          { key: 'totalImpressions', fallback: 'Wyświetlenia', value: formatNumber(safeNumber(row.impressions)) },
          { key: 'totalClicks', fallback: 'Kliknięcia', value: formatNumber(safeNumber(row.clicks)) },
          { key: 'reservations', fallback: 'Rezerwacje', value: formatNumber(safeNumber(row.reservations)) },
          { key: 'reservation_value', fallback: 'Wartość rezerwacji', value: formatCurrency(value) },
          { key: 'roas', fallback: 'ROAS', value: formatROASValue(safeDivide(value, spend)) },
        ].filter((metric) => pdfMetricVisible(reportData, 'meta', 'placement_table', metric.key));
        return `
          <article class="report-row-card placement-row-card">
            <h3>${escapeHtml(row.placement || 'Nieznane')}</h3>
            <div class="row-card-grid">
              ${metrics.map((metric) => rowCardMetric(metricLabel(reportData, 'meta', 'placement_table', metric.key, metric.fallback), metric.value)).join('')}
            </div>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function campaignCompactColumns(reportData: ReportData, platform: ReportPlatform): TableColumn[] {
  const base: TableColumn[] = [
    { key: 'campaign_name', label: metricLabel(reportData, platform, 'campaign_table', 'campaign_name', 'Kampania'), compactLabel: 'Kampania', className: 'dimension', value: (row) => escapeHtml(getCampaignName(row)) },
    { key: 'totalSpend', label: metricLabel(reportData, platform, 'campaign_table', 'totalSpend', 'Wydatki'), compactLabel: 'Wydatki', value: (row) => formatCurrency(safeNumber(getRowValue(row, 'totalSpend'))) },
    { key: 'reservations', label: metricLabel(reportData, platform, 'campaign_table', 'reservations', 'Rezerwacje'), compactLabel: 'Rez.', value: (row) => formatNumber(safeNumber(getRowValue(row, 'reservations'))) },
    { key: 'reservation_value', label: metricLabel(reportData, platform, 'campaign_table', 'reservation_value', 'Wartość rezerwacji'), compactLabel: 'Wartość', value: (row) => formatCurrency(safeNumber(getRowValue(row, 'reservation_value'))) },
    { key: 'roas', label: metricLabel(reportData, platform, 'campaign_table', 'roas', 'ROAS'), compactLabel: 'ROAS', value: (row) => formatROASValue(safeNumber(getRowValue(row, 'roas')) || safeDivide(getRowValue(row, 'reservation_value'), getRowValue(row, 'totalSpend'))) },
  ];
  return configuredTableColumns(reportData, platform, 'campaign_table', base);
}

function placementCompactColumns(reportData: ReportData): TableColumn[] {
  const base: TableColumn[] = [
    { key: 'placement', label: metricLabel(reportData, 'meta', 'placement_table', 'placement', 'Placement'), compactLabel: 'Placement', className: 'dimension', value: (row) => escapeHtml(row.placement || 'Nieznane') },
    { key: 'totalSpend', label: metricLabel(reportData, 'meta', 'placement_table', 'totalSpend', 'Wydatki'), compactLabel: 'Wydatki', value: (row) => formatCurrency(safeNumber(row.spend)) },
    { key: 'totalClicks', label: metricLabel(reportData, 'meta', 'placement_table', 'totalClicks', 'Kliknięcia'), compactLabel: 'Klik.', value: (row) => formatNumber(safeNumber(row.clicks)) },
    { key: 'reservations', label: metricLabel(reportData, 'meta', 'placement_table', 'reservations', 'Rezerwacje'), compactLabel: 'Rez.', value: (row) => formatNumber(safeNumber(row.reservations)) },
    { key: 'reservation_value', label: metricLabel(reportData, 'meta', 'placement_table', 'reservation_value', 'Wartość rezerwacji'), compactLabel: 'Wartość', value: (row) => formatCurrency(safeNumber(row.reservation_value)) },
    { key: 'roas', label: metricLabel(reportData, 'meta', 'placement_table', 'roas', 'ROAS'), compactLabel: 'ROAS', value: (row) => formatROASValue(safeDivide(row.reservation_value, row.spend)) },
  ];
  return configuredTableColumns(reportData, 'meta', 'placement_table', base);
}

function sortedCampaigns(reportData: ReportData, platform: ReportPlatform): any[] {
  return [...(platformData(reportData, platform)?.campaigns || [])]
    .filter((campaign) => safeNumber(getRowValue(campaign, 'totalSpend')) > 0 || safeNumber(getRowValue(campaign, 'reservation_value')) > 0)
    .sort((a, b) => safeNumber(getRowValue(b, 'totalSpend')) - safeNumber(getRowValue(a, 'totalSpend')));
}

/** Minimum share of total reservation value required to show an international signal card. */
const INTERNATIONAL_SIGNAL_MIN_SHARE = 0.05;

type GeographicHighlightBucket = {
  code: string;
  name: string;
  conversion_value: number;
  conversions: number;
  clicks: number;
};

function aggregateGeographicHighlights(reportData: ReportData, platform: ReportPlatform): {
  topForeign: GeographicHighlightBucket | null;
  topRegion: GeographicHighlightBucket | null;
  foreignShare: number;
  totalMetric: number;
} {
  const rows = platform === 'google'
    ? (reportData.googleData?.tables?.geographicPerformance || [])
    : (reportData.metaData?.tables?.geographicPerformance || []);
  if (!rows.length) {
    return { topForeign: null, topRegion: null, foreignShare: 0, totalMetric: 0 };
  }

  const { resolvePolishVoivodeshipCode, formatPolishCountryName, formatPolishVoivodeshipName } = require('@/lib/polish-geo-display');
  const { VOIVODESHIP_BY_CODE } = require('@/lib/poland-voivodeships');

  const byCode = new Map<string, GeographicHighlightBucket>();
  const foreignByCountry = new Map<string, GeographicHighlightBucket>();
  let geoTotal = 0;

  rows.forEach((row: any) => {
    const value = safeNumber(row.conversion_value || row.reservation_value);
    const conversions = safeNumber(row.conversions || row.reservations);
    const clicks = safeNumber(row.clicks);
    geoTotal += value;

    if (row.countryCode && row.countryCode !== 'PL') {
      const key = row.countryCode || row.countryName || '__foreign__';
      const bucket = foreignByCountry.get(key) ?? {
        code: key,
        name: row.countryName || row.countryCode || 'Zagranica',
        conversion_value: 0,
        conversions: 0,
        clicks: 0,
      };
      bucket.conversion_value += value;
      bucket.conversions += conversions;
      bucket.clicks += clicks;
      foreignByCountry.set(key, bucket);
      return;
    }

    const code = resolvePolishVoivodeshipCode(row);
    const shape = code ? VOIVODESHIP_BY_CODE[code] : null;
    if (code && shape) {
      const bucket = byCode.get(code) ?? { code, name: shape.name, conversion_value: 0, conversions: 0, clicks: 0 };
      bucket.conversion_value += value;
      bucket.conversions += conversions;
      bucket.clicks += clicks;
      byCode.set(code, bucket);
      return;
    }

    // Meta rows for Poland often lack voivodeship codes — bucket by region name.
    if ((!row.countryCode || row.countryCode === 'PL') && row.regionName && row.regionName !== '(nieznane)') {
      const regionKey = `region::${String(row.regionName).trim().toLowerCase()}`;
      const bucket = byCode.get(regionKey) ?? {
        code: regionKey,
        name: formatPolishVoivodeshipName(row),
        conversion_value: 0,
        conversions: 0,
        clicks: 0,
      };
      bucket.conversion_value += value;
      bucket.conversions += conversions;
      bucket.clicks += clicks;
      byCode.set(regionKey, bucket);
    }
  });

  const campaigns = platformData(reportData, platform)?.campaigns || [];
  const campaignTotalValue = campaigns.reduce(
    (sum: number, campaign: any) => sum + safeNumber(getRowValue(campaign, 'reservation_value')),
    0
  );
  const platformTotalValue = platform === 'meta'
    ? safeNumber(reportData.metaData?.metrics?.totalReservationValue)
    : 0;
  const totalMetric = campaignTotalValue > 0
    ? campaignTotalValue
    : (platformTotalValue > 0 ? platformTotalValue : geoTotal);
  const foreignTotal = Array.from(foreignByCountry.values()).reduce((sum, country) => sum + country.conversion_value, 0);
  const foreignShare = totalMetric > 0 ? foreignTotal / totalMetric : 0;

  const topForeignRaw = Array.from(foreignByCountry.values())
    .filter((bucket) => bucket.conversion_value > 0)
    .sort((a, b) => b.conversion_value - a.conversion_value)[0] ?? null;
  const topForeign = topForeignRaw
    ? {
        ...topForeignRaw,
        name: formatPolishCountryName({ countryCode: topForeignRaw.code, countryName: topForeignRaw.name }),
      }
    : null;
  const topRegion = Array.from(byCode.values())
    .filter((bucket) => bucket.conversion_value > 0)
    .sort((a, b) => b.conversion_value - a.conversion_value)[0] ?? null;

  return { topForeign, topRegion, foreignShare, totalMetric };
}

function renderCampaignHighlightCard(reportData: ReportData, platform: ReportPlatform, title: string, campaign: any): string {
  return `
    <div class="highlight-card">
      <div class="highlight-label">${escapeHtml(title)}</div>
      <h3>${escapeHtml(getCampaignName(campaign))}</h3>
      <dl>
        <div><dt>${escapeHtml(metricLabel(reportData, platform, 'campaign_table', 'reservations', 'Rezerwacje'))}</dt><dd>${formatNumber(safeNumber(getRowValue(campaign, 'reservations')))}</dd></div>
        <div><dt>${escapeHtml(metricLabel(reportData, platform, 'campaign_table', 'reservation_value', 'Wartość rezerwacji'))}</dt><dd>${formatCurrency(safeNumber(getRowValue(campaign, 'reservation_value')))}</dd></div>
        <div><dt>${escapeHtml(metricLabel(reportData, platform, 'campaign_table', 'roas', 'ROAS'))}</dt><dd>${formatROASValue(safeNumber(getRowValue(campaign, 'roas')) || safeDivide(getRowValue(campaign, 'reservation_value'), getRowValue(campaign, 'totalSpend')))}</dd></div>
      </dl>
    </div>
  `;
}

function renderGeographicHighlightCard(
  reportData: ReportData,
  platform: ReportPlatform,
  title: string,
  name: string,
  bucket: GeographicHighlightBucket,
  totalMetric: number,
  shareLabel: string,
): string {
  const share = safeDivide(bucket.conversion_value, totalMetric);
  return `
    <div class="highlight-card">
      <div class="highlight-label">${escapeHtml(title)}</div>
      <h3>${escapeHtml(name)}</h3>
      <dl>
        <div><dt>${escapeHtml(metricLabel(reportData, platform, 'geographic_map', 'totalConversions', 'Konwersje'))}</dt><dd>${formatNumber(bucket.conversions)}</dd></div>
        <div><dt>${escapeHtml(metricLabel(reportData, platform, 'geographic_map', 'conversion_value', 'Wartość konwersji'))}</dt><dd>${formatCurrency(bucket.conversion_value)}</dd></div>
        <div><dt>${escapeHtml(shareLabel)}</dt><dd>${formatPercentValue(share, 1)}</dd></div>
      </dl>
    </div>
  `;
}

function resolveThirdHighlightCard(
  reportData: ReportData,
  platform: ReportPlatform,
  rows: any[],
  byRoas: any[],
): string {
  const geo = aggregateGeographicHighlights(reportData, platform);
  if (geo.topForeign && geo.foreignShare >= INTERNATIONAL_SIGNAL_MIN_SHARE) {
    return renderGeographicHighlightCard(
      reportData,
      platform,
      'International signal',
      geo.topForeign.name,
      geo.topForeign,
      geo.totalMetric,
      'Udział zagranicy',
    );
  }
  if (geo.topRegion) {
    return renderGeographicHighlightCard(
      reportData,
      platform,
      'Top region',
      geo.topRegion.name,
      geo.topRegion,
      geo.totalMetric,
      'Udział regionu',
    );
  }
  if (byRoas[0]) {
    return renderCampaignHighlightCard(reportData, platform, 'Best ROAS', byRoas[0]);
  }
  return '';
}

function campaignHighlightCards(reportData: ReportData, platform: ReportPlatform): string {
  const rows = sortedCampaigns(reportData, platform);
  const byReservations = [...rows].sort((a, b) => safeNumber(getRowValue(b, 'reservations')) - safeNumber(getRowValue(a, 'reservations')) || safeNumber(getRowValue(b, 'reservation_value')) - safeNumber(getRowValue(a, 'reservation_value')));
  const byValue = [...rows].sort((a, b) => safeNumber(getRowValue(b, 'reservation_value')) - safeNumber(getRowValue(a, 'reservation_value')));
  const byTraffic = [...rows].sort((a, b) => safeNumber(getRowValue(b, 'totalClicks')) - safeNumber(getRowValue(a, 'totalClicks')) || safeNumber(getRowValue(b, 'totalImpressions')) - safeNumber(getRowValue(a, 'totalImpressions')));
  const byRoas = [...rows].filter((row) => safeNumber(getRowValue(row, 'reservations')) > 0).sort((a, b) => safeNumber(getRowValue(b, 'roas')) - safeNumber(getRowValue(a, 'roas')));

  const campaignCards = platform === 'google'
    ? [
        { title: 'Top booking driver', campaign: byReservations[0] },
        { title: 'Highest booking value', campaign: byValue.find((row) => row !== byReservations[0]) || byValue[0] },
      ]
    : [
        { title: 'Top booking driver', campaign: byReservations[0] },
        { title: 'Highest traffic', campaign: byTraffic[0] },
      ];

  const uniqueCampaignCards = campaignCards
    .filter((candidate) => candidate.campaign)
    .filter((candidate, idx, arr) => arr.findIndex((item) => item.campaign === candidate.campaign) === idx);

  const thirdCard = resolveThirdHighlightCard(reportData, platform, rows, byRoas);
  const cardsHtml = [
    ...uniqueCampaignCards.map(({ title, campaign }) => renderCampaignHighlightCard(reportData, platform, title, campaign)),
    thirdCard,
  ].filter(Boolean);

  if (cardsHtml.length === 0) return '<div class="empty-panel">Brak danych kampanii dla wyróżnień.</div>';
  return `<div class="highlight-grid">${cardsHtml.join('')}</div>`;
}

function campaignContributionChart(reportData: ReportData, platform: ReportPlatform): string {
  const totalValue = safeNumber(platformData(reportData, platform)?.metrics.totalReservationValue);
  const entries = sortedCampaigns(reportData, platform)
    .map((campaign) => [getCampaignName(campaign), safeNumber(getRowValue(campaign, 'reservation_value'))] as [string, number])
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  if (entries.length === 0) return '';
  return barPanel(metricLabel(reportData, platform, 'campaign_table', 'reservation_value', 'Wartość rezerwacji wg kampanii'), entries.map(([label, value]) => [totalValue > 0 ? `${label}` : label, value]), formatCurrency);
}

function funnelBlock(reportData: ReportData, platform: ReportPlatform): string {
  const funnel = platformData(reportData, platform)?.funnel;
  const steps = [
    { key: 'booking_step_1', fallback: 'Krok 1', value: safeNumber(funnel?.booking_step_1) },
    { key: 'booking_step_2', fallback: 'Krok 2', value: safeNumber(funnel?.booking_step_2) },
    { key: 'booking_step_3', fallback: 'Krok 3', value: safeNumber(funnel?.booking_step_3) },
    { key: 'reservations', fallback: 'Rezerwacje', value: safeNumber(funnel?.reservations) },
  ].filter((step) => pdfMetricVisible(reportData, platform, 'funnel', step.key));
  const firstValue = steps[0]?.value || 0;
  const lastValue = steps[steps.length - 1]?.value || 0;
  const firstStepKey = steps[0]?.key;
  const lastStepKey = steps[steps.length - 1]?.key;
  const side = reportData.yoyComparison?.[platform];
  const previousFirstValue = firstStepKey ? yoyMetricValue(side, 'previous', firstStepKey) : null;
  const previousLastValue = lastStepKey ? yoyMetricValue(side, 'previous', lastStepKey) : null;
  const funnelRateDelta = percentDelta(
    safeDivide(lastValue, firstValue),
    previousFirstValue && previousLastValue ? safeDivide(previousLastValue, previousFirstValue) : null,
  );
  return `
    <div class="funnel-shell">
      <div class="funnel-segments">
        ${steps.map((step, idx) => {
          const previous = idx > 0 ? steps[idx - 1]?.value ?? null : null;
          const rate = previous === null ? null : safeDivide(step.value, previous);
          const delta = metricDeltaBadge(platformMetricDelta(reportData, platform, step.key));
          return `
            <div class="funnel-segment segment-${idx + 1}">
              <div class="funnel-label">${escapeHtml(metricLabel(reportData, platform, 'funnel', step.key, step.fallback))}</div>
              <div class="funnel-value">${formatNumber(step.value)}</div>
              ${delta ? `<div class="funnel-delta-row">${delta}</div>` : ''}
              <div class="funnel-rate">${idx === 0 ? 'Początek ścieżki' : `${formatPercentValue(rate, 1)} z poprzedniego kroku`}</div>
            </div>
          `;
        }).join('')}
      </div>
      <div class="funnel-total-rate">
        <span>Współczynnik konwersji</span>
        <strong>${formatPercentValue(safeDivide(lastValue, firstValue), 2)}</strong>
        ${metricDeltaBadge(funnelRateDelta)}
      </div>
    </div>
  `;
}

function platformMediaCards(reportData: ReportData, platform: ReportPlatform): string {
  const metrics = platformData(reportData, platform)?.metrics;
  if (!metrics) return '<div class="empty-panel">Brak danych mediowych.</div>';
  return metricStrip(buildMetricCards(reportData, platform, 'report_summary', [
    { key: 'totalSpend', fallback: 'Wydatki', value: formatCurrency(metrics.totalSpend), delta: platformMetricDelta(reportData, platform, 'totalSpend') },
    { key: 'totalImpressions', fallback: 'Wyświetlenia', value: formatNumber(metrics.totalImpressions), delta: platformMetricDelta(reportData, platform, 'totalImpressions') },
    { key: 'totalClicks', fallback: 'Kliknięcia', value: formatNumber(metrics.totalClicks), delta: platformMetricDelta(reportData, platform, 'totalClicks') },
    { key: 'averageCtr', fallback: 'CTR', value: formatPercentage(metrics.averageCtr), delta: platformMetricDelta(reportData, platform, 'averageCtr') },
    { key: 'averageCpc', fallback: 'CPC', value: formatCurrency(metrics.averageCpc), delta: platformMetricDelta(reportData, platform, 'averageCpc') },
  ]), 5);
}

function platformOutcomeCards(reportData: ReportData, platform: ReportPlatform): string {
  const data = platformData(reportData, platform);
  if (!data) return '';
  const offline = computeOfflinePotentialFromReportData(reportData);
  const metrics = data.metrics;
  const funnel = data.funnel;
  const cards = buildMetricCards(reportData, platform, 'funnel', [
    { key: 'reservation_value', fallback: 'Wartość rezerwacji', value: formatCurrency(funnel.reservation_value || metrics.totalReservationValue), delta: platformMetricDelta(reportData, platform, 'reservation_value') },
    { key: 'roas', fallback: 'ROAS', value: formatROASValue(funnel.roas || metrics.roas), delta: platformMetricDelta(reportData, platform, 'roas') },
    { key: 'reservations', fallback: 'Rezerwacje', value: formatNumber(funnel.reservations || metrics.totalReservations), delta: platformMetricDelta(reportData, platform, 'reservations') },
  ]);
  const contactCards = buildMetricCards(reportData, platform, 'contact', [
    { key: 'email_contacts', fallback: 'Kontakty e-mail', value: formatNumber(metrics.emailContacts) },
    { key: 'click_to_call', fallback: 'Kliknięcia w telefon', value: formatNumber(metrics.phoneContacts) },
    { key: 'offline_reservations', fallback: 'Potencjał offline', value: formatNumber(offline.potentialOfflineReservations) },
  ]);
  return metricStrip([...cards, ...contactCards], 2);
}

function channelCard(reportData: ReportData, platform: ReportPlatform, metrics: HotelPlatformMetrics | undefined): string {
  if (!metrics) return `<div class="channel-card"><h3>${platformName(platform)}</h3><div class="empty-panel">Brak danych.</div></div>`;
  const spend = safeNumber(metrics.totalSpend);
  const value = safeNumber(metrics.totalReservationValue);
  const row = (key: string, fallback: string, displayValue: string, deltaKey = key) => `
    <div>
      <dt>${escapeHtml(metricLabel(reportData, platform, 'report_summary', key, fallback))}</dt>
      <dd><span>${displayValue}</span>${metricDeltaBadge(platformMetricDelta(reportData, platform, deltaKey))}</dd>
    </div>
  `;
  return `
    <div class="channel-card">
      <h3>${platformName(platform)}</h3>
      <dl>
        ${row('totalSpend', 'Wydatki', formatCurrency(spend))}
        ${row('reservations', 'Rezerwacje', formatNumber(metrics.totalReservations))}
        ${row('reservation_value', 'Wartość rezerwacji', formatCurrency(value))}
        ${row('roas', 'ROAS', formatROASValue(safeDivide(value, spend)))}
      </dl>
    </div>
  `;
}

function yoyBlock(reportData: ReportData, platform: ReportPlatform, data: any | undefined): string {
  if (!data || !data.previous || ((!data.previous.spend || data.previous.spend === 0) && (!data.previous.reservationValue || data.previous.reservationValue === 0))) {
    return `
      <div class="yoy-card">
        <h3>${platformName(platform)}</h3>
        <div class="empty-panel">Brak danych z analogicznego okresu.</div>
      </div>
    `;
  }
  const rows = [
    [metricLabel(reportData, platform, 'report_summary', 'totalSpend', 'Wydatki'), formatCurrency(data.current?.spend || 0), formatCurrency(data.previous?.spend || 0), `${safeNumber(data.changes?.spend).toFixed(1).replace('.', ',')}%`],
    [metricLabel(reportData, platform, 'report_summary', 'reservation_value', 'Wartość rezerwacji'), formatCurrency(data.current?.reservationValue || 0), formatCurrency(data.previous?.reservationValue || 0), `${safeNumber(data.changes?.reservationValue).toFixed(1).replace('.', ',')}%`],
  ];
  return `
    <div class="yoy-card">
      <h3>${platformName(platform)}</h3>
      ${hotelTable(['Wskaźnik', 'Bieżący', 'Poprz.', 'Zmiana'], rows, 'yoy-table', 'compact')}
    </div>
  `;
}

function generateHotelSummaryPages(reportData: ReportData, startPageNumber: number): string[] {
  const blocks = summaryTextBlocks(reportData);
  const pages: string[] = [];
  let remaining = blocks;
  while (remaining.length > 0) {
    const isFirst = pages.length === 0;
    const maxChars = isFirst ? 620 : 950;
    const chunks = chunkSummaryBlocks(remaining, maxChars);
    const chunk = chunks[0] || remaining;
    pages.push(hotelReportPage(
      reportData,
      startPageNumber + pages.length,
      isFirst ? 'Raport kampanii reklamowej' : 'Podsumowanie kampanii',
      isFirst ? 'Podsumowanie wyników' : 'Ciąg dalszy podsumowania',
      `<div class="summary-text-only">${renderSummaryTextBlocks(chunk)}</div>`,
      'PODSUMOWANIE',
      'summary-page',
    ));
    remaining = remaining.slice(chunk.length);
  }
  return pages;
}

function combinedResultsBlocks(reportData: ReportData): ReportBlock[] {
  const total = combinedMetrics(reportData);
  const google = reportData.googleData?.metrics;
  const meta = reportData.metaData?.metrics;
  return [
    {
      title: 'Wyniki łączne',
      subtitle: 'Najważniejsze wskaźniki z obu kanałów',
      kicker: 'PODSUMOWANIE',
      platform: 'global',
      heightMm: 52,
      html: framedSection('Kluczowe wskaźniki łącznie', metricStrip([
        { label: metricLabel(reportData, 'google', 'report_summary', 'totalSpend', 'Wydatki'), value: formatCurrency(total.totalSpend) },
        { label: metricLabel(reportData, 'google', 'report_summary', 'reservations', 'Rezerwacje'), value: formatNumber(total.totalReservations) },
        { label: metricLabel(reportData, 'google', 'report_summary', 'reservation_value', 'Wartość rezerwacji'), value: formatCurrency(total.totalReservationValue) },
        { label: metricLabel(reportData, 'google', 'report_summary', 'roas', 'ROAS'), value: formatROASValue(total.roas) },
        { label: metricLabel(reportData, 'google', 'contact', 'cost_per_reservation', 'Koszt rezerwacji'), value: formatCurrency(total.costPerReservation) },
        { label: combinedContactsLabel(reportData), value: formatNumber(total.contacts), subtext: `${formatNumber(total.emailContacts)} e-mail / ${formatNumber(total.phoneContacts)} telefoniczne` },
      ], 3)),
    },
    {
      title: 'Wyniki łączne',
      subtitle: 'Wartość i liczba rezerwacji wg kanału',
      kicker: 'PODSUMOWANIE',
      platform: 'global',
      heightMm: 70,
      html: `<div class="two-stack">
        ${barPanel(metricLabel(reportData, 'google', 'report_summary', 'reservation_value', 'Wartość rezerwacji'), [
          ['Google Ads', safeNumber(google?.totalReservationValue)],
          ['Meta Ads', safeNumber(meta?.totalReservationValue)],
        ], formatCurrency)}
        ${barPanel(metricLabel(reportData, 'google', 'report_summary', 'reservations', 'Rezerwacje'), [
          ['Google Ads', safeNumber(google?.totalReservations)],
          ['Meta Ads', safeNumber(meta?.totalReservations)],
        ], formatNumber)}
      </div>`,
    },
  ];
}

function channelComparisonBlocks(reportData: ReportData): ReportBlock[] {
  const google = reportData.googleData?.metrics;
  const meta = reportData.metaData?.metrics;
  return [
    {
      title: 'Porównanie kanałów',
      subtitle: 'Google Ads i Meta Ads',
      platform: 'global',
      heightMm: 65,
      html: `<div class="channel-grid">${channelCard(reportData, 'google', google)}${channelCard(reportData, 'meta', meta)}</div>`,
    },
    {
      title: 'Porównanie kanałów',
      subtitle: 'Wskaźniki kanałów',
      platform: 'global',
      heightMm: 74,
      html: comparisonBarRows([
        { label: metricLabel(reportData, 'google', 'report_summary', 'totalSpend', 'Wydatki'), google: safeNumber(google?.totalSpend), meta: safeNumber(meta?.totalSpend), formatter: formatCurrency },
        { label: metricLabel(reportData, 'google', 'report_summary', 'reservations', 'Rezerwacje'), google: safeNumber(google?.totalReservations), meta: safeNumber(meta?.totalReservations), formatter: formatNumber },
        { label: metricLabel(reportData, 'google', 'report_summary', 'reservation_value', 'Wartość rezerwacji'), google: safeNumber(google?.totalReservationValue), meta: safeNumber(meta?.totalReservationValue), formatter: formatCurrency },
        { label: metricLabel(reportData, 'google', 'report_summary', 'roas', 'ROAS'), google: safeNumber(google?.roas), meta: safeNumber(meta?.roas), formatter: formatROASValue },
      ]),
    },
    {
      title: 'Porównanie rok do roku',
      subtitle: 'Dane dostępne wg kanału',
      platform: 'global',
      heightMm: 72,
      html: `<div class="yoy-grid">${yoyBlock(reportData, 'google', reportData.yoyComparison?.google)}${yoyBlock(reportData, 'meta', reportData.yoyComparison?.meta)}</div>`,
    },
  ];
}

function platformOverviewBlocks(reportData: ReportData, platform: ReportPlatform): ReportBlock[] {
  return [
    {
      title: platformName(platform),
      subtitle: 'Wskaźniki i efekty',
      platform,
      heightMm: 104,
      html: `<div class="two-stack">
        ${platformMediaCards(reportData, platform)}
        ${framedSection('Wyniki i efekty', platformOutcomeCards(reportData, platform), 'outcome-panel')}
      </div>`,
    },
    {
      title: platformName(platform),
      subtitle: 'Ścieżka konwersji',
      platform,
      heightMm: 88,
      html: framedSection('Ścieżka konwersji', funnelBlock(reportData, platform), 'funnel-panel funnel-hero'),
    },
  ];
}

function mediaMetricsBlock(reportData: ReportData, platform: ReportPlatform): ReportBlock {
  const data = platformData(reportData, platform);
  const networks = platform === 'google' ? (reportData.googleData?.tables?.networkPerformance || []) : [];
  const networkRows = networks.slice(0, 8);
  return {
    title: platformName(platform),
    subtitle: platform === 'google' ? 'Media / sieci reklamowe' : 'Wskaźniki mediowe',
    platform,
    heightMm: platform === 'google' ? 58 : 0,
    html: platform === 'google'
      ? `${framedSection('Wydajność sieci reklamowych', hotelTable(
          [
            metricLabel(reportData, 'google', 'placement_table', 'placement', 'Sieć'),
            compactTableLabel(metricLabel(reportData, 'google', 'placement_table', 'totalSpend', 'Wydatki'), 'totalSpend'),
            compactTableLabel(metricLabel(reportData, 'google', 'placement_table', 'totalImpressions', 'Wyświetlenia'), 'totalImpressions'),
            compactTableLabel(metricLabel(reportData, 'google', 'placement_table', 'totalClicks', 'Kliknięcia'), 'totalClicks'),
          ],
          networkRows.map((n: any) => [
            escapeHtml(n.network || n.placement || 'Nieznana sieć'),
            formatCurrency(safeNumber(n.spend)),
            formatNumber(safeNumber(n.impressions)),
            formatNumber(safeNumber(n.clicks)),
          ]),
          'network-table',
          'compact',
        ))}`
      : '',
  };
}

function campaignBlocks(reportData: ReportData, platform: ReportPlatform): ReportBlock[] {
  const rows = sortedCampaigns(reportData, platform);
  const columns = campaignCompactColumns(reportData, platform);
  const contribution = campaignContributionChart(reportData, platform);
  const blocks: ReportBlock[] = [
    {
      title: platformName(platform),
      subtitle: 'Wyróżnione kampanie',
      platform,
      heightMm: 92,
      html: campaignHighlightCards(reportData, platform),
    },
  ];
  if (contribution) {
    blocks.push({
      title: platformName(platform),
      subtitle: 'Wartość rezerwacji wg kampanii',
      platform,
      heightMm: 72,
      html: contribution,
    });
  }
  const chunks = splitRowsBalanced(rows, 9, 4);
  chunks.forEach((chunk, idx) => {
    blocks.push({
      title: platformName(platform),
      subtitle: idx === 0 ? 'Kampanie wg wydatków' : 'Kampanie wg wydatków — ciąg dalszy',
      platform,
      heightMm: estimateTableBlockHeightMm(chunk.length),
      html: framedSection(
        idx === 0 ? 'Kampanie wg wydatków' : 'Kampanie wg wydatków — ciąg dalszy',
        tableFromColumns(chunk, columns, 'campaign-table', 'campaign'),
      ),
    });
  });
  return blocks;
}

function deviceBlocks(reportData: ReportData): ReportBlock[] {
  const rows = reportData.googleData?.tables?.devicePerformance || [];
  const columns: TableColumn[] = [
    { key: 'device', label: metricLabel(reportData, 'google', 'device_table', 'device', 'Urządzenie'), className: 'dimension', value: (row) => escapeHtml(googleAdsDeviceLabelPl(row.device ?? row.deviceType)) },
    { key: 'totalSpend', label: metricLabel(reportData, 'google', 'device_table', 'totalSpend', 'Wydatki'), value: (row) => formatCurrency(safeNumber(row.spend)) },
    { key: 'conversion_value', label: metricLabel(reportData, 'google', 'device_table', 'conversion_value', 'Wartość konwersji'), value: (row) => formatCurrency(safeNumber(row.conversion_value)) },
    { key: 'roas', label: metricLabel(reportData, 'google', 'device_table', 'roas', 'ROAS'), value: (row) => formatROASValue(safeNumber(row.roas) || safeDivide(row.conversion_value, row.spend)) },
  ];
  const configured = configuredTableColumns(reportData, 'google', 'device_table', columns);
  return [{
    title: 'Google Ads',
    subtitle: 'Urządzenia',
    platform: 'google',
    heightMm: 92,
    html: `${framedSection('Urządzenia', tableFromColumns(rows, configured, 'device-table', 'device'))}${barPanel(metricLabel(reportData, 'google', 'device_table', 'conversion_value', 'Wartość konwersji wg urządzenia'), rows.map((row: any) => [googleAdsDeviceLabelPl(row.device ?? row.deviceType), safeNumber(row.conversion_value)]), formatCurrency, { maxRows: 4 })}`,
  }];
}

function demographicBlocks(reportData: ReportData, platform: ReportPlatform): ReportBlock[] {
  const demographics = platform === 'google'
    ? reportData.googleData?.tables?.demographicPerformance || []
    : reportData.metaData?.tables?.demographicPerformance || [];
  const valueMetric = platform === 'google' ? 'conversion_value' : 'reservation_value';
  const genderValue = aggregateBy(demographics.filter((r: any) => r.gender !== undefined), (r) => categoryDisplayLabel(r.gender), valueMetric);
  const ageValue = aggregateBy(demographics.filter((r: any) => (r.ageRange ?? r.age) !== undefined), (r) => r.ageRange ?? r.age, valueMetric);
  const genderClicks = aggregateBy(demographics.filter((r: any) => r.gender !== undefined), (r) => categoryDisplayLabel(r.gender), 'clicks');
  const ageClicks = aggregateBy(demographics.filter((r: any) => (r.ageRange ?? r.age) !== undefined), (r) => r.ageRange ?? r.age, 'clicks');
  return [
    {
      title: platformName(platform),
      subtitle: 'Demografia wartości',
      platform,
      heightMm: 82,
      html: `<div class="demo-layout">
        ${framedSection(metricLabel(reportData, platform, 'demographic_breakdown', valueMetric === 'conversion_value' ? 'conversion_value' : 'reservation_value', 'Wartość'), `${donutChart(genderValue)}${barPanel('Wiek', ageValue, formatCurrency, { maxRows: 6 })}`)}
      </div>`,
    },
    {
      title: platformName(platform),
      subtitle: 'Demografia kliknięć',
      platform,
      heightMm: 72,
      html: `<div class="two-stack">${barPanel(metricLabel(reportData, platform, 'demographic_breakdown', 'gender', 'Płeć'), genderClicks, formatNumber, { maxRows: 4 })}${barPanel(metricLabel(reportData, platform, 'demographic_breakdown', 'age', 'Wiek'), ageClicks, formatNumber, { maxRows: 6 })}</div>`,
    },
  ];
}

function getGeographicPerformanceRows(reportData: ReportData, platform: ReportPlatform): any[] {
  return platform === 'google'
    ? (reportData.googleData?.tables?.geographicPerformance || [])
    : (reportData.metaData?.tables?.geographicPerformance || []);
}

type GeoMapMetric = 'spend' | 'clicks' | 'impressions' | 'conversion_value';

const META_TOP_REGIONS_LIMIT = 10;

function defaultGeoMapMetric(platform: ReportPlatform): GeoMapMetric {
  // Meta does not return offsite conversion value at region breakdown; clicks
  // are the most reliable geographic signal for PDF maps.
  return platform === 'meta' ? 'clicks' : 'conversion_value';
}

function getGeoRowMetric(row: any, metric: GeoMapMetric): number {
  switch (metric) {
    case 'spend':
      return safeNumber(row.spend);
    case 'clicks':
      return safeNumber(row.clicks);
    case 'impressions':
      return safeNumber(row.impressions);
    case 'conversion_value':
      return safeNumber(row.conversion_value || row.reservation_value);
  }
}

function formatGeoMapMetric(value: number, metric: GeoMapMetric): string {
  return metric === 'spend' || metric === 'conversion_value'
    ? formatCurrency(value)
    : formatNumber(value);
}

function formatCompactGeoMapMetric(value: number, metric: GeoMapMetric): string {
  return formatGeoMapMetric(value, metric);
}

function geoMapMetricLabel(metric: GeoMapMetric): string {
  switch (metric) {
    case 'spend':
      return 'wydatków';
    case 'clicks':
      return 'kliknięć';
    case 'impressions':
      return 'wyświetleń';
    case 'conversion_value':
      return 'wartości konwersji';
  }
}

function geoMapMetricTitle(metric: GeoMapMetric): string {
  switch (metric) {
    case 'spend':
      return 'Wydatki';
    case 'clicks':
      return 'Kliknięcia';
    case 'impressions':
      return 'Wyświetlenia';
    case 'conversion_value':
      return 'Wartość konwersji';
  }
}

function getGeographicCampaignTotal(reportData: ReportData, platform: ReportPlatform, metric: GeoMapMetric): number {
  const campaignField =
    metric === 'conversion_value' ? 'reservation_value'
    : metric === 'spend' ? 'totalSpend'
    : metric === 'clicks' ? 'totalClicks'
    : 'totalImpressions';
  const campaigns = platformData(reportData, platform)?.campaigns || [];
  const fromCampaigns = campaigns.reduce(
    (sum: number, campaign: any) => sum + safeNumber(getRowValue(campaign, campaignField)),
    0,
  );
  if (fromCampaigns > 0) return fromCampaigns;
  if (platform === 'meta') {
    const metrics = reportData.metaData?.metrics;
    if (metric === 'conversion_value') return safeNumber(metrics?.totalReservationValue);
    if (metric === 'spend') return safeNumber(metrics?.totalSpend);
    if (metric === 'clicks') return safeNumber(metrics?.totalClicks);
    if (metric === 'impressions') return safeNumber(metrics?.totalImpressions);
  }
  return 0;
}

function generateHotelRegionsBody(
  reportData: ReportData,
  platform: ReportPlatform,
  metric: GeoMapMetric = defaultGeoMapMetric(platform),
): string {
  const rows = getGeographicPerformanceRows(reportData, platform);
  if (!rows || rows.length === 0) {
    return `
      <div class="regions-card">
        <div class="regions-card-header">
          <div>
            <h3>Regiony</h3>
            <p>Wyniki według regionów i miast</p>
          </div>
          <div class="metric-static-wrap"><span>Metryka:</span><div class="metric-static-pill"><i></i>${escapeHtml(geoMapMetricTitle(metric))}</div></div>
        </div>
        <div class="regions-empty-state">Brak danych regionalnych dla tego okresu.</div>
      </div>
    `;
  }
  const { POLAND_MAP_VIEW_BOX, POLAND_VOIVODESHIPS, VOIVODESHIP_BY_CODE, heatmapColor } = require('@/lib/poland-voivodeships');
  const { resolvePolishVoivodeshipCode, formatPolishCountryName } = require('@/lib/polish-geo-display');

  type Bucket = { code: string; name: string; metricValue: number };
  const byCode = new Map<string, Bucket>();
  const foreignByCountry = new Map<string, Bucket>();
  let unmatchedPolandValue = 0;
  rows.forEach((row: any) => {
    const value = getGeoRowMetric(row, metric);
    if (row.countryCode && row.countryCode !== 'PL') {
      const key = row.countryCode || row.countryName || '__foreign__';
      const country = foreignByCountry.get(key) ?? { code: key, name: row.countryName || row.countryCode || 'Zagranica', metricValue: 0 };
      country.metricValue += value;
      foreignByCountry.set(key, country);
      return;
    }
    const code = resolvePolishVoivodeshipCode(row);
    const shape = code ? VOIVODESHIP_BY_CODE[code] : null;
    if (!code || !shape) {
      unmatchedPolandValue += value;
      return;
    }
    const bucket = byCode.get(code) ?? { code, name: shape.name, metricValue: 0 };
    bucket.metricValue += value;
    byCode.set(code, bucket);
  });
  const values = Array.from(byCode.values()).map((b) => b.metricValue);
  const maxValue = values.length > 0 ? Math.max(...values) : 0;
  const geoTotal = values.reduce((s, v) => s + v, 0) + unmatchedPolandValue + Array.from(foreignByCountry.values()).reduce((s, c) => s + c.metricValue, 0);
  const campaignTotal = getGeographicCampaignTotal(reportData, platform, metric);
  const totalMetric = campaignTotal > 0 ? campaignTotal : geoTotal;
  const unknownLocation = Math.max(0, totalMetric - geoTotal);
  const geographicCoverage = totalMetric > 0 ? geoTotal / totalMetric : 1;
  const showCoverageWarning =
    metric === 'conversion_value' &&
    totalMetric > 0 &&
    unknownLocation > 0 &&
    geographicCoverage < 0.05;
  const legendLow = metric === 'conversion_value' || metric === 'spend' ? 'Niższa wartość' : 'Mniej';
  const legendHigh = metric === 'conversion_value' || metric === 'spend' ? 'Wyższa wartość' : 'Więcej';
  const legendSuffix = metric === 'clicks' ? ' kliknięć' : metric === 'impressions' ? ' wyświetleń' : '';
  const paths = POLAND_VOIVODESHIPS.map((v: any) => {
    const bucket = byCode.get(v.code);
    const value = bucket ? bucket.metricValue : 0;
    return `<path d="${v.path}" fill="${heatmapColor(maxValue > 0 ? value / maxValue : 0, value > 0)}" stroke="rgba(15,39,66,0.18)" stroke-width="1"/>`;
  }).join('');
  const topRegions = Array.from(byCode.values()).filter((b) => b.metricValue > 0).sort((a, b) => b.metricValue - a.metricValue).slice(0, 5);
  const topForeign = Array.from(foreignByCountry.values()).filter((b) => b.metricValue > 0).sort((a, b) => b.metricValue - a.metricValue).slice(0, 3);
  const hasRegionalContent = topRegions.length > 0 || topForeign.length > 0 || unknownLocation + unmatchedPolandValue > 0;
  const platformLabel = platformName(platform);
  const metricKey =
    metric === 'conversion_value' ? 'conversion_value'
    : metric === 'spend' ? 'totalSpend'
    : metric === 'clicks' ? 'totalClicks'
    : 'totalImpressions';
  const selectedMetricLabel = metricLabel(reportData, platform, 'geographic_map', metricKey, geoMapMetricTitle(metric));
  const topRegionMax = topRegions[0]?.metricValue || 0;
  const showTopRegionBars = topRegions.every((r) => formatGeoMapMetric(r.metricValue, metric).length <= 8);
  const locationRowsExceedCampaignTotal = campaignTotal > 0 && geoTotal > totalMetric + 0.0001;
  const locationRowsLabel = locationRowsExceedCampaignTotal
    ? 'suma wierszy lokalizacji'
    : 'z czego z lokalizacji';
  return `
    <div class="regions-card">
      <div class="regions-card-header">
        <div>
          <h3>Regiony</h3>
          <p>Wyniki według regionów i miast</p>
        </div>
        <div class="metric-static-wrap"><span>Metryka:</span><div class="metric-static-pill"><i></i>${escapeHtml(selectedMetricLabel)}</div></div>
      </div>
      ${showCoverageWarning ? `<div class="region-warning">API nie zwróciło wiarygodnego podziału geograficznego dla wartości konwersji. Przypisano geograficznie ${formatCurrency(geoTotal)} z ${formatCurrency(totalMetric)} (${formatPercentValue(geographicCoverage, 1)}), dlatego mapa nie powinna być traktowana jako realny podział województw.</div>` : ''}
      <div class="regions-layout">
        <div class="map-wrap">
          <div class="map-heading">
            <span class="map-pin"></span>
            <div><strong>Wydajność wg regionów</strong><small>Mapa cieplna — ${escapeHtml(selectedMetricLabel.toLowerCase())} wg województw; zagranica w podsumowaniu</small></div>
          </div>
          ${hasRegionalContent ? `<svg viewBox="${POLAND_MAP_VIEW_BOX}" class="poland-map" preserveAspectRatio="xMidYMid meet">${paths}</svg>
          <div class="map-legend map-legend-caption"><span>${legendLow}${legendSuffix}</span><span class="legend-ramp"></span><span>${legendHigh}${legendSuffix}</span></div>` : '<div class="regions-empty-state">Mapa niedostępna dla tego zakresu danych.</div>'}
        </div>
        <div class="region-side-panel">
          <div class="region-total-card">
            <span>Łącznie (kampanie ${escapeHtml(platformLabel)})</span>
            <strong>${formatGeoMapMetric(totalMetric, metric)}</strong>
            <small>${locationRowsLabel}: ${formatGeoMapMetric(geoTotal, metric)}</small>
            ${locationRowsExceedCampaignTotal ? '<small class="region-total-note">Wiersze lokalizacji nie sumują się do KPI kampanii.</small>' : ''}
          </div>
          <div class="top-region-list">
            <div class="top-region-head"><strong>Najlepsze regiony</strong><span>${escapeHtml(selectedMetricLabel)}</span></div>
            ${topRegions.map((r, idx) => {
              const pct = topRegionMax > 0 ? Math.max(6, (r.metricValue / topRegionMax) * 100) : 0;
              const barColor = ['#071842', '#1f5fbf', '#4f8ee8', '#8db8f7', '#bfdbfe'][idx] || '#bfdbfe';
              const valueLabel = formatGeoMapMetric(r.metricValue, metric);
              return `<div class="top-region-row ${showTopRegionBars ? 'with-bars' : 'no-bars'}"><b>${idx + 1}</b><em>${escapeHtml(r.name.toLowerCase())}</em>${showTopRegionBars ? `<span><i style="width:${pct.toFixed(1)}%; background:${barColor};"></i></span>` : ''}<strong>${valueLabel}</strong></div>`;
            }).join('') || '<div class="regions-empty-state compact">Brak danych.</div>'}
          </div>
          ${(unmatchedPolandValue > 0 || topForeign.length > 0 || unknownLocation > 0) ? `
            <div class="region-extra-list">
              ${unmatchedPolandValue > 0 ? `<div><span>Polska niedopasowana</span><strong>${formatGeoMapMetric(unmatchedPolandValue, metric)}</strong></div>` : ''}
              ${topForeign.map((r) => `<div><span>${escapeHtml(formatPolishCountryName({ countryCode: r.code, countryName: r.name }))}</span><strong>${formatGeoMapMetric(r.metricValue, metric)}</strong></div>`).join('')}
              ${unknownLocation > 0 ? `<div><span>Nieznana lokalizacja</span><strong>${formatGeoMapMetric(unknownLocation, metric)}</strong></div>` : ''}
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

function generateHotelGoogleCityRows(reportData: ReportData): any[] {
  return [...(reportData.googleData?.tables?.geographicPerformance || [])]
    .filter((r: any) => r.cityName && r.cityName !== '(nieznane)')
    .sort((a: any, b: any) => safeNumber(b.conversion_value || b.reservation_value) - safeNumber(a.conversion_value || a.reservation_value))
    .slice(0, 15);
}

function generateHotelMetaRegionRows(reportData: ReportData): any[] {
  return [...getGeographicPerformanceRows(reportData, 'meta')]
    .filter((row: any) => !row.countryCode || row.countryCode === 'PL')
    .filter((row: any) => row.regionName && row.regionName !== '(nieznane)')
    .sort((a: any, b: any) => getGeoRowMetric(b, 'clicks') - getGeoRowMetric(a, 'clicks'))
    .slice(0, META_TOP_REGIONS_LIMIT);
}

function geoBlocks(reportData: ReportData, platform: ReportPlatform): ReportBlock[] {
  const platformTitle = platformName(platform);
  const { formatPolishVoivodeshipName } = require('@/lib/polish-geo-display');
  const geoMapMetric = defaultGeoMapMetric(platform);
  const blocks: ReportBlock[] = [{
    title: platformTitle,
    subtitle: platform === 'meta'
      ? `Regiony — ${metricLabel(reportData, 'meta', 'geographic_map', 'totalClicks', 'kliknięcia')}`
      : 'Regiony',
    platform,
    heightMm: 118,
    html: generateHotelRegionsBody(reportData, platform, geoMapMetric),
  }];

  if (platform === 'google') {
    const cityRows = generateHotelGoogleCityRows(reportData);
    const cityColumns: TableColumn[] = [
      { key: 'city', label: metricLabel(reportData, 'google', 'geographic_map', 'city', 'Miasto'), className: 'dimension', value: (row) => escapeHtml(row.cityName || row.city || 'Nieznane') },
      {
        key: 'region',
        label: metricLabel(reportData, 'google', 'geographic_map', 'region', 'Województwo'),
        className: 'dimension',
        value: (row: any) => {
          const text =
            row.countryCode && row.countryCode !== 'PL'
              ? row.regionName || row.region || row.countryName || row.countryCode
              : formatPolishVoivodeshipName(row);
          return escapeHtml(String(text ?? '—'));
        },
      },
      { key: 'totalClicks', label: metricLabel(reportData, 'google', 'geographic_map', 'totalClicks', 'Kliknięcia'), value: (row) => formatNumber(safeNumber(row.clicks)) },
      { key: 'totalConversions', label: metricLabel(reportData, 'google', 'geographic_map', 'totalConversions', 'Konwersje'), value: (row) => formatNumber(safeNumber(row.conversions)) },
      { key: 'conversion_value', label: metricLabel(reportData, 'google', 'geographic_map', 'conversion_value', 'Wartość konwersji'), value: (row) => formatCurrency(safeNumber(row.conversion_value || row.reservation_value)) },
    ];
    const cityChunks = cityRows.length > 6
      ? [cityRows.slice(0, 6), cityRows.slice(6)]
      : cityRows.length > 0 ? [cityRows] : [];
    cityChunks.forEach((chunk, idx) => {
      blocks.push({
        title: platformTitle,
        subtitle: idx === 0 ? 'Miasta' : 'Miasta — ciąg dalszy',
        platform,
        heightMm: idx === 0 ? 105 : estimateTableBlockHeightMm(chunk.length),
        html: `${idx === 0 ? barPanel(metricLabel(reportData, 'google', 'geographic_map', 'conversion_value', 'Wartość konwersji wg miasta'), chunk.slice(0, 5).map((row: any) => [row.cityName || row.city || 'Nieznane', safeNumber(row.conversion_value || row.reservation_value)]), formatCurrency, { maxRows: 5 }) : ''}${framedSection(idx === 0 ? 'Miasta' : 'Miasta — ciąg dalszy', tableFromColumns(chunk, configuredTableColumns(reportData, 'google', 'geographic_map', cityColumns), 'city-table', 'city'))}`,
      });
    });
    return blocks;
  }

  const regionRows = generateHotelMetaRegionRows(reportData);
  if (regionRows.length === 0) return blocks;

  const regionColumns: TableColumn[] = [
    {
      key: 'region',
      label: metricLabel(reportData, 'meta', 'geographic_map', 'region', 'Region'),
      className: 'dimension',
      value: (row: any) => escapeHtml(String(formatPolishVoivodeshipName(row) ?? row.regionName ?? '—')),
    },
    { key: 'totalSpend', label: metricLabel(reportData, 'meta', 'geographic_map', 'totalSpend', 'Wydatki'), value: (row) => formatCurrency(safeNumber(row.spend)) },
    { key: 'totalClicks', label: metricLabel(reportData, 'meta', 'geographic_map', 'totalClicks', 'Kliknięcia'), value: (row) => formatNumber(safeNumber(row.clicks)) },
    { key: 'totalImpressions', label: metricLabel(reportData, 'meta', 'report_summary', 'totalImpressions', 'Wyświetlenia'), value: (row) => formatNumber(safeNumber(row.impressions)) },
  ];
  const regionChunks = regionRows.length > 8
    ? [regionRows.slice(0, 8), regionRows.slice(8)]
    : [regionRows];
  regionChunks.forEach((chunk, idx) => {
    blocks.push({
      title: platformTitle,
      subtitle: idx === 0 ? 'Regiony — szczegóły' : 'Regiony — ciąg dalszy',
      platform,
      heightMm: estimateTableBlockHeightMm(chunk.length),
      html: framedSection(
        idx === 0 ? 'Najlepsze regiony — kliknięcia' : 'Najlepsze regiony — ciąg dalszy',
        tableFromColumns(chunk, configuredTableColumns(reportData, 'meta', 'geographic_map', regionColumns), 'city-table', 'city'),
      ),
    });
  });
  return blocks;
}

function placementBlocks(reportData: ReportData): ReportBlock[] {
  const rows = [...(reportData.metaData?.tables?.placementPerformance || [])]
    .filter((p: any) => safeNumber(p.spend) > 0 || safeNumber(p.impressions) > 0 || safeNumber(p.clicks) > 0)
    .sort((a: any, b: any) => safeNumber(b.reservation_value) - safeNumber(a.reservation_value) || safeNumber(b.clicks) - safeNumber(a.clicks));
  const columns = placementCompactColumns(reportData);
  const topValue = [...rows].sort((a, b) => safeNumber(b.reservation_value) - safeNumber(a.reservation_value))[0];
  const topTraffic = [...rows].sort((a, b) => safeNumber(b.clicks) - safeNumber(a.clicks))[0];
  const topRoas = [...rows].filter((row) => safeNumber(row.reservations) > 0).sort((a, b) => (safeDivide(b.reservation_value, b.spend) || 0) - (safeDivide(a.reservation_value, a.spend) || 0))[0];
  const summaryCards = [topValue, topTraffic, topRoas].filter((row, idx, arr) => row && arr.indexOf(row) === idx).map((row, idx) => `
    <div class="highlight-card">
      <div class="highlight-label">${idx === 0 ? 'Top booking value' : idx === 1 ? 'Top traffic' : 'Best ROAS'}</div>
      <h3>${escapeHtml(row.placement || 'Nieznane')}</h3>
      <dl>
        <div><dt>${escapeHtml(metricLabel(reportData, 'meta', 'placement_table', 'totalClicks', 'Kliknięcia'))}</dt><dd>${formatNumber(safeNumber(row.clicks))}</dd></div>
        <div><dt>${escapeHtml(metricLabel(reportData, 'meta', 'placement_table', 'reservation_value', 'Wartość rezerwacji'))}</dt><dd>${formatCurrency(safeNumber(row.reservation_value))}</dd></div>
        <div><dt>${escapeHtml(metricLabel(reportData, 'meta', 'placement_table', 'roas', 'ROAS'))}</dt><dd>${formatROASValue(safeDivide(row.reservation_value, row.spend))}</dd></div>
      </dl>
    </div>
  `).join('');
  const blocks: ReportBlock[] = [{
    title: 'Meta Ads',
    subtitle: 'Placements / miejsca docelowe',
    platform: 'meta',
    heightMm: 72,
    html: `<div class="highlight-grid">${summaryCards || '<div class="empty-panel">Brak danych placementów.</div>'}</div>`,
  }];
  splitRowsBalanced(rows, 10, 5).forEach((chunk, idx) => {
    blocks.push({
      title: 'Meta Ads',
      subtitle: idx === 0 ? 'Tabela placementów' : 'Tabela placementów — ciąg dalszy',
      platform: 'meta',
      heightMm: estimateTableBlockHeightMm(chunk.length),
      html: framedSection(idx === 0 ? 'Skuteczność miejsc docelowych' : 'Skuteczność miejsc docelowych — ciąg dalszy', tableFromColumns(chunk, columns, 'placement-table', 'placement')),
    });
  });
  return blocks;
}

function buildHotelReportBlocks(reportData: ReportData): ReportBlock[] {
  const blocks: ReportBlock[] = [
    ...combinedResultsBlocks(reportData),
    ...channelComparisonBlocks(reportData),
  ];
  if (reportData.googleData) {
    blocks.push(
      ...platformOverviewBlocks(reportData, 'google'),
      mediaMetricsBlock(reportData, 'google'),
      ...campaignBlocks(reportData, 'google'),
      ...deviceBlocks(reportData),
      ...demographicBlocks(reportData, 'google'),
      ...geoBlocks(reportData, 'google'),
    );
  }
  if (reportData.metaData) {
    blocks.push(
      ...platformOverviewBlocks(reportData, 'meta'),
      ...campaignBlocks(reportData, 'meta'),
      ...demographicBlocks(reportData, 'meta'),
      ...geoBlocks(reportData, 'meta'),
      ...placementBlocks(reportData),
    );
  }
  return blocks;
}

function generateHotelPDFHTML(reportData: ReportData, options?: { debug?: boolean }): string {
  const sanitizedData: ReportData = {
    ...reportData,
    clientName: reportData.clientName?.replace(/[<>]/g, '') || 'Unknown Client',
    aiSummary: reportData.aiSummary?.replace(/[<>]/g, '') || undefined,
  };
  let pageNumber = 1;
  const pages: string[] = [];

  const summaryPages = generateHotelSummaryPages(sanitizedData, pageNumber);
  pages.push(...summaryPages);
  pageNumber += summaryPages.length;
  const flowPages = paginateBlocks(buildHotelReportBlocks(sanitizedData), pageNumber, sanitizedData);
  pages.push(...flowPages);
  pageNumber += flowPages.length;

  const bodyClass = options?.debug ? 'debug' : '';

  return `
    <!DOCTYPE html>
    <html lang="pl">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Raport kampanii reklamowej</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          @page { size: ${REPORT_LAYOUT.PAGE_WIDTH_MM}mm ${REPORT_LAYOUT.PAGE_HEIGHT_MM}mm; margin: 0; }
          :root {
            --ivory: #FFFFFF;
            --paper: #FFFFFF;
            --paper-soft: #FFFFFF;
            --navy: #0E2742;
            --footer-navy: #225497;
            --muted: #65707A;
            --terracotta: #D85F36;
            --terracotta-muted: #C96545;
            --pale-terracotta: #F3C7AF;
            --line: rgba(201, 101, 69, 0.35);
            --line-soft: rgba(201, 101, 69, 0.18);
            --soft: rgba(216, 95, 54, 0.09);
            --green: #4F8B61;
            --red: #A84D44;
            --serif: 'DM Serif Display', Georgia, serif;
            --sans: 'Inter', Arial, sans-serif;
            --page-w: 108mm;
            --page-h: 192mm;
            --pad-x: 7mm;
            --content-y: 24mm;
            --content-h: calc(var(--page-h) - var(--content-y) - var(--footer-h) - 3mm);
            --footer-h: 13mm;
          }
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: var(--ivory); color: var(--navy); font-family: var(--sans); }
          body { font-feature-settings: 'tnum' 1, 'lnum' 1; }
          .hotel-page {
            position: relative;
            width: var(--page-w);
            height: var(--page-h);
            break-after: page;
            page-break-after: always;
            overflow: hidden;
            background: #FFFFFF;
          }
          .hotel-page:last-of-type { break-after: auto; page-break-after: auto; }
          .page-border { position: absolute; pointer-events: none; z-index: 1; top: 2.2mm; left: 2.2mm; right: 2.2mm; bottom: var(--footer-h); border: 0.28mm solid var(--line); }
          .running-header { position: absolute; top: 6mm; left: var(--pad-x); right: var(--pad-x); height: 17mm; display: flex; align-items: center; justify-content: center; z-index: 2; }
          .hotel-logo { max-height: 13mm; max-width: 54mm; object-fit: contain; }
          .hotel-wordmark { text-align: center; }
          .hotel-wordmark-name { font-size: 11pt; font-weight: 600; letter-spacing: 0.42em; text-transform: uppercase; color: var(--navy); }
          .hotel-wordmark-rule { display: flex; align-items: center; justify-content: center; gap: 4mm; margin-top: 1.7mm; color: var(--navy); }
          .hotel-wordmark-rule span { width: 18mm; height: 0.15mm; background: var(--line); }
          .hotel-wordmark-rule small { font-size: 5.8pt; letter-spacing: 0.35em; }
          .page-main { position: absolute; left: var(--pad-x); right: var(--pad-x); top: var(--content-y); height: var(--content-h); overflow: hidden; z-index: 2; max-width: calc(var(--page-w) - (2 * var(--pad-x))); box-sizing: border-box; }
          .page-main > *, .flow-block, .framed-section, .two-stack, .metric-strip, .channel-grid, .yoy-grid, .highlight-grid, .row-card-grid, .regions-card, .regions-layout { width: 100%; max-width: 100%; min-width: 0; box-sizing: border-box; }
          .page-title-block { text-align: center; margin: 0 0 3mm; }
          .hotel-page.summary-page .page-title-block { margin: 0 0 2mm; }
          .hotel-page.summary-page .page-title-block h1 { font-size: 26pt; line-height: 1.05; }
          .hotel-page.summary-page .page-subtitle { font-size: 12pt; margin-top: 1mm; }
          .hotel-page.summary-page .period-pill { margin-top: 2mm; }
          .hotel-page.summary-page .section-kicker { margin-top: 2mm; }
          .page-title-block h1 { font-family: var(--serif); font-weight: 400; font-size: 32pt; line-height: 0.96; margin: 0; letter-spacing: -0.025em; color: var(--navy); }
          .page-subtitle { font-family: var(--serif); color: var(--terracotta-muted); font-size: 14pt; line-height: 1.12; margin-top: 1.6mm; }
          .period-pill { display: inline-flex; align-items: center; justify-content: center; margin-top: 3mm; padding: 1.1mm 4mm; border: 0.16mm solid var(--line-soft); border-radius: 999px; background: rgba(255,255,255,0.42); font-size: 6.2pt; font-weight: 700; letter-spacing: 0.11em; }
          .section-kicker, .framed-title { display: flex; align-items: center; gap: 3mm; justify-content: center; font-size: 6.7pt; letter-spacing: 0.26em; text-transform: uppercase; color: var(--navy); margin-top: 4mm; font-weight: 700; }
          .section-kicker span, .framed-title span { height: 0.16mm; background: var(--line); flex: 1; max-width: 25mm; }
          .flow-block + .flow-block { margin-top: 5mm; }
          .summary-text-only { max-width: 84mm; margin: 0 auto; }
          .summary-copy { font-size: 9pt; line-height: 1.55; color: var(--navy); }
          .summary-copy p { margin: 0 0 3mm; }
          .summary-block { border-top: 0.14mm solid var(--line-soft); padding-top: 2.5mm; margin-top: 2.5mm; }
          .summary-block:first-child { border-top: 0; padding-top: 0; margin-top: 0; }
          .summary-block h3 { font-family: var(--serif); font-size: 11.5pt; font-weight: 400; margin: 0 0 1.2mm; color: var(--navy); }
          .summary-block p { margin: 0; }
          .hotel-footer { position: absolute; left: 0; right: 0; bottom: 0; height: var(--footer-h); z-index: 3; display: grid; grid-template-columns: 1fr auto; align-items: center; padding: 0 7mm; background: var(--footer-navy); color: #fffdf8; }
          .agency-mark { display: flex; align-items: center; gap: 2.2mm; font-size: 5.8pt; letter-spacing: 0.12em; line-height: 1.05; }
          .agency-mark img { height: 8mm; width: auto; display: block; }
          .agency-fallback { font-weight: 800; font-size: 11pt; line-height: 0.72; }
          .agency-fallback small { font-size: 4.8pt; letter-spacing: 0.1em; }
          .footer-client { display: none; }
          .footer-page-number { font-size: 6.2pt; letter-spacing: 0.34em; font-variant-numeric: tabular-nums; }
          .framed-section { margin-top: 0; }
          .framed-title { margin: 0 0 4mm; font-size: 7pt; }
          .metric-strip { display: grid; gap: 3mm; margin: 0; width: 100%; max-width: 100%; min-width: 0; }
          .metric-strip.cols-5 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .metric-strip.cols-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .metric-strip.cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .metric-strip.cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .hotel-metric-card, .channel-card, .yoy-card, .highlight-card, .bar-panel, .empty-panel, .donut-wrap, .region-card {
            border: 0.16mm solid var(--line-soft);
            border-radius: 2mm;
            background: rgba(255,253,248,0.72);
            box-shadow: 0 1.2mm 5mm rgba(14,39,66,0.035);
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .hotel-metric-card { min-width: 0; max-width: 100%; min-height: 18mm; padding: 3mm 1.8mm; text-align: center; display: flex; flex-direction: column; justify-content: center; overflow: visible; }
          .metric-label { min-width: 0; min-height: 6mm; display: flex; align-items: center; justify-content: center; font-size: 5.5pt; line-height: 1.15; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: var(--navy); white-space: normal; overflow-wrap: anywhere; word-break: normal; }
          .metric-value { max-width: 100%; margin-top: 1.8mm; font-size: 11pt; line-height: 1.08; color: var(--navy); font-variant-numeric: tabular-nums; font-weight: 650; white-space: normal; overflow-wrap: anywhere; word-break: normal; }
          .metric-delta-row { margin-top: 1mm; display: flex; justify-content: center; }
          .metric-subtext { max-width: 100%; margin-top: 1mm; font-size: 5.4pt; line-height: 1.15; color: var(--muted); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
          .metric-strip.cols-5 .metric-label { font-size: 5.1pt; letter-spacing: 0.07em; }
          .metric-strip.cols-5 .metric-value { font-size: 9.8pt; }
          .metric-strip.cols-5 .metric-delta { padding: 0.25mm 0.55mm; font-size: 4.3pt; }
          .metric-strip.cols-2 .hotel-metric-card { min-height: 14mm; padding: 2mm; }
          .metric-strip.cols-2 .metric-value { font-size: 10pt; }
          .metric-delta { display: inline-flex; align-items: center; border-radius: 999px; padding: 0.35mm 0.9mm; background: rgba(14,39,66,0.055); font-size: 5.2pt; line-height: 1; font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }
          .metric-delta small { margin-left: 0.7mm; color: var(--muted); font-size: 4.7pt; font-weight: 700; }
          .metric-delta.positive { color: var(--green); }
          .metric-delta.negative { color: var(--red); }
          .metric-delta.neutral { color: var(--muted); }
          .two-stack { display: grid; gap: 5mm; }
          .channel-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4mm; width: 100%; max-width: 100%; min-width: 0; }
          .yoy-grid { display: grid; grid-template-columns: 1fr; gap: 3mm; }
          .channel-card, .yoy-card, .highlight-card, .bar-panel, .empty-panel, .donut-wrap, .region-card { padding: 4mm; }
          .channel-card h3, .yoy-card h3, .highlight-card h3, .bar-panel h3 { font-family: var(--serif); font-size: 15pt; font-weight: 400; line-height: 1.05; margin: 0 0 3mm; text-align: center; }
          dl { margin: 0; }
          .channel-card dl div, .highlight-card dl div { display: flex; justify-content: space-between; gap: 2mm; border-top: 0.12mm solid var(--line-soft); padding: 1.5mm 0; min-width: 0; max-width: 100%; }
          dt { min-width: 0; color: var(--muted); font-size: 6.1pt; line-height: 1.15; text-transform: uppercase; letter-spacing: 0.06em; overflow-wrap: anywhere; }
          dd { max-width: 54%; margin: 0; font-size: 7.1pt; font-weight: 700; font-variant-numeric: tabular-nums; text-align: right; white-space: normal; overflow-wrap: anywhere; }
          .channel-card dd { display: inline-flex; flex-direction: column; align-items: flex-end; justify-content: flex-end; gap: 0.7mm; }
          .channel-card dd span { max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
          .channel-card .metric-delta { font-size: 4.5pt; padding: 0.25mm 0.55mm; }
          .comparison-bars { display: grid; gap: 3.2mm; }
          .comparison-legend { display: flex; justify-content: center; gap: 5mm; font-size: 6.3pt; line-height: 1.2; color: var(--muted); font-weight: 700; }
          .comparison-legend span { display: inline-flex; align-items: center; gap: 1.2mm; }
          .legend-dot { width: 2.2mm; height: 2.2mm; border-radius: 50%; display: inline-block; }
          .legend-dot.navy { background: var(--navy); }
          .legend-dot.copper { background: var(--terracotta); }
          .comparison-row { display: grid; gap: 1.25mm; }
          .comparison-label { font-size: 7pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; }
          .comparison-line { display: grid; grid-template-columns: 18mm minmax(0,1fr) 22mm; gap: 2mm; align-items: center; }
          .comparison-platform { font-size: 6.2pt; color: var(--muted); font-weight: 700; line-height: 1; }
          .comparison-line strong { font-size: 6.7pt; line-height: 1; color: var(--navy); font-weight: 800; font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; overflow-wrap: normal; }
          .comparison-track { position: relative; height: 4.6mm; border-radius: 999px; background: rgba(14,39,66,0.06); overflow: hidden; }
          .comparison-track span { display: block; height: 100%; border-radius: inherit; }
          .comparison-track.navy span { background: var(--navy); }
          .comparison-track.copper span { background: var(--terracotta); }
          .outcome-funnel-layout { display: grid; grid-template-columns: 0.82fr 1.18fr; gap: 5mm; align-items: start; }
          .funnel-hero .framed-title { margin-bottom: 5mm; }
          .funnel-shell { display: grid; gap: 3mm; max-width: 82mm; margin: 0 auto; }
          .funnel-segments { display: flex; flex-direction: column; align-items: center; gap: 1.8mm; }
          .funnel-segment { min-height: 16.5mm; padding: 2mm 5mm; color: #fffdf8; text-align: center; background: linear-gradient(135deg, var(--terracotta), #E8906E); clip-path: polygon(6% 0, 94% 0, 86% 100%, 14% 100%); display: flex; flex-direction: column; justify-content: center; box-shadow: 0 1.2mm 4mm rgba(14,39,66,0.08); }
          .funnel-segment.segment-1 { width: 100%; }
          .funnel-segment.segment-2 { width: 86%; }
          .funnel-segment.segment-3 { width: 72%; }
          .funnel-segment.segment-4 { width: 58%; background: linear-gradient(135deg, var(--navy), #17466B); }
          .funnel-label { font-size: 6.5pt; line-height: 1.15; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; }
          .funnel-value { margin-top: 0.7mm; font-size: 15pt; line-height: 1; font-weight: 750; font-variant-numeric: tabular-nums; white-space: nowrap; overflow-wrap: normal; }
          .funnel-delta-row { margin-top: 0.8mm; display: flex; justify-content: center; }
          .funnel-segment .metric-delta { background: rgba(255,253,248,0.9); font-size: 5pt; padding: 0.3mm 0.75mm; }
          .funnel-rate { margin-top: 0.9mm; font-size: 5.8pt; opacity: 0.9; white-space: nowrap; overflow-wrap: normal; }
          .funnel-total-rate { border: 0.16mm solid var(--line-soft); border-radius: 2mm; padding: 2.6mm; text-align: center; background: rgba(255,253,248,0.72); }
          .funnel-total-rate span { display: block; color: var(--muted); font-size: 6pt; text-transform: uppercase; letter-spacing: 0.1em; }
          .funnel-total-rate strong { display: block; margin-top: 0.8mm; color: var(--terracotta-muted); font-size: 14pt; font-weight: 700; }
          .funnel-total-rate .metric-delta { margin-top: 1mm; }
          .highlight-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 3mm; }
          .highlight-label { color: var(--terracotta-muted); font-size: 5.6pt; font-weight: 800; letter-spacing: 0.06em; margin-bottom: 2mm; text-align: center; text-transform: uppercase; }
          .highlight-card { padding: 3mm; }
          .highlight-card h3 { min-height: auto; font-size: 8.5pt; line-height: 1.18; overflow-wrap: anywhere; }
          .bar-row { margin: 2.1mm 0; }
          .bar-row-head { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 2mm; align-items: baseline; font-size: 7.2pt; line-height: 1.25; }
          .bar-row-head span { min-width: 0; overflow-wrap: anywhere; }
          .bar-row-head strong { font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; overflow-wrap: normal; }
          .bar-track { height: 2.6mm; background: var(--soft); border-radius: 999px; overflow: hidden; margin-top: 1mm; }
          .bar-track div { height: 100%; background: linear-gradient(90deg, var(--terracotta), var(--pale-terracotta)); }
          .donut-wrap { display: flex; gap: 5mm; align-items: center; justify-content: center; min-height: 35mm; }
          .donut { width: 32mm; height: 32mm; overflow: visible; transform: rotate(-90deg); transform-origin: center; }
          .donut-legend { font-size: 7pt; line-height: 1.65; }
          .donut-legend span { display: inline-block; width: 2.4mm; height: 2.4mm; margin-right: 1.4mm; vertical-align: middle; border-radius: 50%; }
          .donut-empty, .empty-cell, .empty-panel { text-align: center; color: var(--muted); font-style: italic; }
          .hotel-table { width: 100%; border-collapse: collapse; border: 0.16mm solid var(--line-soft); background: rgba(255,253,248,0.58); table-layout: fixed; font-family: var(--sans); }
          .hotel-table thead { display: table-header-group; }
          .hotel-table tr { break-inside: avoid; page-break-inside: avoid; }
          .hotel-table th { font-size: 5.7pt; line-height: 1.12; text-transform: uppercase; letter-spacing: 0.01em; padding: 1.3mm 0.55mm; color: var(--navy); border: 0.12mm solid var(--line-soft); background: rgba(216,95,54,0.05); font-weight: 800; overflow-wrap: anywhere; word-break: normal; hyphens: auto; }
          .hotel-table td { font-size: 6.2pt; line-height: 1.24; padding: 1.2mm 0.65mm; border: 0.12mm solid var(--line-soft); vertical-align: middle; word-break: normal; }
          .hotel-table .text-cell { text-align: left; overflow-wrap: anywhere; }
          .hotel-table .number-cell { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; overflow-wrap: normal; }
          .report-table-compact th { font-size: 5.6pt; }
          .report-table-compact td { font-size: 6.1pt; }
          .report-table-device th, .report-table-city th { font-size: 5.5pt; }
          .report-table-device td, .report-table-city td { font-size: 6pt; }
          .report-table-campaign th, .report-table-placement th { font-size: 5.3pt; padding-left: 0.35mm; padding-right: 0.35mm; }
          .report-table-campaign td, .report-table-placement td { font-size: 5.8pt; padding-left: 0.45mm; padding-right: 0.45mm; }
          .hotel-table.campaign-table th:nth-child(1), .hotel-table.campaign-table td:nth-child(1) { width: 42%; }
          .hotel-table.campaign-table th:nth-child(2), .hotel-table.campaign-table td:nth-child(2) { width: 17%; }
          .hotel-table.campaign-table th:nth-child(3), .hotel-table.campaign-table td:nth-child(3) { width: 10%; }
          .hotel-table.campaign-table th:nth-child(4), .hotel-table.campaign-table td:nth-child(4) { width: 20%; }
          .hotel-table.campaign-table th:nth-child(5), .hotel-table.campaign-table td:nth-child(5) { width: 11%; }
          .hotel-table.placement-table th:nth-child(1), .hotel-table.placement-table td:nth-child(1) { width: 34%; }
          .hotel-table.placement-table th:nth-child(2), .hotel-table.placement-table td:nth-child(2) { width: 15%; }
          .hotel-table.placement-table th:nth-child(3), .hotel-table.placement-table td:nth-child(3) { width: 13%; }
          .hotel-table.placement-table th:nth-child(4), .hotel-table.placement-table td:nth-child(4) { width: 9%; }
          .hotel-table.placement-table th:nth-child(5), .hotel-table.placement-table td:nth-child(5) { width: 18%; }
          .hotel-table.placement-table th:nth-child(6), .hotel-table.placement-table td:nth-child(6) { width: 11%; }
          .hotel-table.device-table th:nth-child(1), .hotel-table.device-table td:nth-child(1) { width: 32%; }
          .hotel-table.city-table th:nth-child(1), .hotel-table.city-table td:nth-child(1) { width: 24%; }
          .hotel-table.city-table th:nth-child(2), .hotel-table.city-table td:nth-child(2) { width: 26%; }
          .hotel-table.city-table th:nth-child(3), .hotel-table.city-table td:nth-child(3) { width: 14%; }
          .hotel-table.city-table th:nth-child(4), .hotel-table.city-table td:nth-child(4) { width: 16%; }
          .hotel-table.city-table th:nth-child(5), .hotel-table.city-table td:nth-child(5) { width: 20%; }
          .report-row-cards { display: grid; gap: 3mm; }
          .report-row-card {
            border: 0.16mm solid var(--line-soft);
            border-radius: 2mm;
            background: rgba(255,253,248,0.72);
            padding: 3mm;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .report-row-card h3 {
            font-family: var(--sans);
            font-size: 8.3pt;
            line-height: 1.22;
            margin: 0 0 2.4mm;
            color: var(--navy);
            font-weight: 750;
            overflow-wrap: anywhere;
          }
          .row-card-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.4mm 3mm; }
          .row-card-metric { display: flex; justify-content: space-between; align-items: baseline; gap: 2mm; border-top: 0.12mm dashed var(--line-soft); padding-top: 1.1mm; font-family: var(--sans); }
          .row-card-metric span { color: var(--muted); font-size: 5.9pt; line-height: 1.15; text-transform: uppercase; letter-spacing: 0.03em; overflow-wrap: anywhere; }
          .row-card-metric strong { color: var(--navy); font-size: 7pt; line-height: 1.15; font-weight: 750; font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; overflow-wrap: normal; }
          .report-table-appendix th { font-size: 5.2pt; }
          .report-table-appendix td { font-size: 5.7pt; }
          .regions-card { border: 0; border-radius: 0; background: transparent; box-shadow: none; padding: 0; break-inside: avoid; page-break-inside: avoid; }
          .regions-card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 4mm; border-bottom: 0.12mm solid rgba(226,232,240,0.95); padding-bottom: 3.2mm; margin-bottom: 4.3mm; }
          .regions-card-header h3 { margin: 0; font-size: 12pt; line-height: 1.05; color: #0f172a; font-weight: 800; letter-spacing: -0.02em; }
          .regions-card-header p { margin: 1mm 0 0; font-size: 6.6pt; line-height: 1.2; color: #64748b; }
          .metric-static-wrap { display: flex; align-items: center; gap: 1.5mm; color: #64748b; font-size: 5.8pt; font-weight: 700; white-space: nowrap; }
          .metric-static-pill { display: inline-flex; align-items: center; gap: 1.5mm; min-height: 7.5mm; border: 0.14mm solid rgba(148,163,184,0.35); border-radius: 3mm; background: #fff; padding: 0 3mm; color: #0f172a; font-size: 6.4pt; line-height: 1; font-weight: 800; box-shadow: 0 0.7mm 2mm rgba(15,23,42,0.04); }
          .metric-static-pill i, .metric-static-pill span { width: 3mm; height: 3mm; border-radius: 999px; background: #dbeafe; box-shadow: inset 0 0 0 0.8mm #1f5fbf; display: inline-block; }
          .regions-layout { display: grid; grid-template-columns: minmax(0, 1.58fr) minmax(47mm, 0.92fr); gap: 5mm; align-items: start; }
          .map-wrap { min-height: 68mm; display: flex; flex-direction: column; justify-content: flex-start; }
          .map-fallback { min-height: 48mm; }
          .map-heading { display: flex; gap: 2mm; align-items: flex-start; margin-bottom: 2mm; }
          .map-pin { width: 7mm; height: 7mm; border-radius: 2mm; background: #071842; display: inline-block; position: relative; flex: 0 0 auto; }
          .map-pin:after { content: ''; position: absolute; left: 2.45mm; top: 2.45mm; width: 2.1mm; height: 2.1mm; border: 0.5mm solid #fff; border-radius: 999px; }
          .map-heading strong { display: block; font-size: 7.5pt; line-height: 1.15; color: #0f172a; font-weight: 800; }
          .map-heading small { display: block; margin-top: 0.6mm; font-size: 5.7pt; line-height: 1.25; color: #64748b; }
          .map-wrap svg.poland-map { width: 100%; height: 55mm; display: block; background: transparent; border-radius: 0; padding: 0; }
          .map-legend { display: flex; align-items: center; justify-content: center; gap: 2.2mm; margin-top: 2mm; font-size: 5.7pt; color: var(--muted); width: 100%; }
          .map-legend-caption { margin-top: 1.5mm; font-size: 5.2pt; font-weight: 700; }
          .legend-ramp { display: block; width: 34mm; height: 2mm; border-radius: 999px; background: linear-gradient(90deg, #dbeafe, #5b9bed, #071842); }
          .region-side-panel { min-width: 0; }
          .region-total-card { border-radius: 4mm; background: linear-gradient(135deg, #eff6ff, #f8fafc 68%, #fff); padding: 4mm; margin-bottom: 4mm; }
          .region-total-card span { display: block; color: #64748b; font-size: 5.4pt; letter-spacing: 0.12em; text-transform: uppercase; line-height: 1.15; font-weight: 800; }
          .region-total-card strong { display: block; margin-top: 1.5mm; color: #0f172a; font-size: 18pt; line-height: 1; font-weight: 850; font-variant-numeric: tabular-nums; white-space: nowrap; }
          .region-total-card small { display: block; margin-top: 1.3mm; color: #64748b; font-size: 6pt; line-height: 1.2; font-variant-numeric: tabular-nums; }
          .region-total-card .region-total-note { color: #94a3b8; font-size: 5.2pt; font-variant-numeric: normal; }
          .top-region-head { display: flex; justify-content: space-between; gap: 2mm; align-items: baseline; margin-bottom: 2.3mm; }
          .top-region-head strong { color: #0f172a; font-size: 7pt; line-height: 1; font-weight: 850; }
          .top-region-head span { color: #64748b; font-size: 5.7pt; line-height: 1; font-weight: 700; }
          .top-region-row { display: grid; align-items: center; gap: 1.35mm; margin: 2.2mm 0; max-width: 100%; overflow: hidden; }
          .top-region-row.with-bars { grid-template-columns: 4.8mm minmax(13mm, 1fr) minmax(7mm, 0.42fr) max-content; }
          .top-region-row.no-bars { grid-template-columns: 4.8mm minmax(0, 1fr) max-content; }
          .top-region-row b { width: 4.2mm; height: 4.2mm; border-radius: 999px; background: #dbeafe; color: #1e3a8a; display: inline-flex; align-items: center; justify-content: center; font-size: 5.5pt; line-height: 1; font-weight: 850; }
          .top-region-row:first-of-type b { background: #071842; color: #fff; }
          .top-region-row em { min-width: 0; color: #334155; font-size: 6.5pt; line-height: 1.1; font-style: normal; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .top-region-row span { display: block; min-width: 0; height: 1.6mm; border-radius: 999px; background: #eef2ff; overflow: hidden; }
          .top-region-row span i { display: block; height: 100%; border-radius: inherit; }
          .top-region-row strong { color: #0f172a; font-size: 5.8pt; line-height: 1; font-weight: 850; font-variant-numeric: tabular-nums; white-space: nowrap; text-align: right; }
          .region-extra-list { margin-top: 2mm; border-radius: 3mm; background: #f8fafc; padding: 1.4mm 2.2mm; }
          .region-extra-list div { display: flex; justify-content: space-between; gap: 2mm; padding: 0.45mm 0; color: #64748b; font-size: 5.4pt; line-height: 1.1; }
          .region-extra-list strong { color: #0f172a; font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }
          .region-warning { margin-bottom: 3mm; border-radius: 3mm; background: rgba(254,243,199,0.62); color: #78350f; padding: 2.2mm 3mm; font-size: 6pt; line-height: 1.3; }
          .regions-empty-state { border: 0.14mm dashed rgba(148,163,184,0.35); border-radius: 3mm; background: #f8fafc; color: #64748b; padding: 7mm 4mm; text-align: center; font-size: 7pt; line-height: 1.3; }
          .regions-empty-state.compact { padding: 3mm; font-size: 6pt; }
          .map-region-label { font-family: var(--sans); font-size: 24px; font-weight: 800; fill: #0f2742; paint-order: stroke; stroke: rgba(255,253,248,0.92); stroke-width: 5px; stroke-linejoin: round; pointer-events: none; }
          .map-region-code { font-size: 19px; letter-spacing: 1px; fill: rgba(15,39,66,0.72); }
          .region-card-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; }
          .region-card { padding: 3mm; }
          .region-card-title { font-size: 5.7pt; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); margin-bottom: 1.8mm; text-align: center; font-weight: 800; }
          .region-card-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2mm; align-items: baseline; font-size: 6pt; line-height: 1.2; padding: 1mm 0; border-top: 0.12mm dashed var(--line-soft); }
          .region-card-row:first-of-type { border-top: 0; }
          .region-card-row span { min-width: 0; overflow-wrap: anywhere; }
          .region-card-row strong { font-weight: 700; font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; overflow-wrap: normal; }
          body.debug .page-main { outline: 0.2mm dashed #2563eb; }
          body.debug .hotel-footer { outline: 0.2mm dashed #ef4444; }
          body.debug .running-header { outline: 0.2mm dashed #16a34a; }
          @media screen {
            body { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 16px; background: #172332; }
            .hotel-page { box-shadow: 0 14px 44px rgba(0,0,0,0.22); }
          }
        </style>
      </head>
      <body class="${bodyClass}">
        ${pages.join('')}
        <script>
          // Lightweight layout QA. Runs at content-loaded time and logs
          // any pages where a child of .page-main extends past the
          // content area, or where the page is under-utilised. Used by
          // Puppeteer to surface issues during PDF generation; the logs
          // are captured by the route's page.on('console') handler.
          (function(){
            try {
              function contentBottom(main) {
                const mainRect = main.getBoundingClientRect();
                let lastBottom = mainRect.top;
                main.querySelectorAll(':scope > *').forEach((el) => {
                  const r = el.getBoundingClientRect();
                  if (r.bottom > lastBottom) lastBottom = r.bottom;
                });
                return lastBottom;
              }

              function fitsAboveFooter(main, footer, gapPx) {
                return contentBottom(main) <= footer.getBoundingClientRect().top - gapPx;
              }

              // Shrink summary text on summary pages until it clears the footer.
              document.querySelectorAll('.hotel-page.summary-page').forEach((page) => {
                const main = page.querySelector('.page-main');
                const footer = page.querySelector('.hotel-footer');
                const copy = page.querySelector('.summary-copy');
                if (!main || !footer || !copy) return;

                let bodyPt = 9;
                let headingPt = 11.5;
                const minBodyPt = 6.5;
                const minHeadingPt = 9;
                const gapPx = 10;

                copy.style.fontSize = bodyPt + 'pt';
                page.querySelectorAll('.summary-block h3').forEach((h3) => {
                  h3.style.fontSize = headingPt + 'pt';
                });

                while (!fitsAboveFooter(main, footer, gapPx) && bodyPt > minBodyPt) {
                  bodyPt -= 0.25;
                  headingPt = Math.max(minHeadingPt, headingPt - 0.2);
                  copy.style.fontSize = bodyPt + 'pt';
                  copy.style.lineHeight = bodyPt <= 7.5 ? '1.45' : '1.55';
                  page.querySelectorAll('.summary-block h3').forEach((h3) => {
                    h3.style.fontSize = headingPt + 'pt';
                  });
                }
              });

              const pages = document.querySelectorAll('.hotel-page');
              const violations = [];
              pages.forEach((page, idx) => {
                const main = page.querySelector('.page-main');
                const footer = page.querySelector('.hotel-footer');
                if (!main || !footer) return;
                const mainRect = main.getBoundingClientRect();
                const footerRect = footer.getBoundingClientRect();
                const pageRect = page.getBoundingClientRect();
                const expectedWidth = ${REPORT_PAGE_WIDTH_CSS_PX};
                const expectedHeight = ${REPORT_PAGE_HEIGHT_CSS_PX};
                const safeGapPx = 20; // MIN_FOOTER_GAP for regular content.
                const tableSafeGapPx = 16; // Tables may sit slightly lower; still clear of footer.
                if (Math.abs(pageRect.width - expectedWidth) > 0.5 || Math.abs(pageRect.height - expectedHeight) > 0.5) {
                  violations.push({ page: idx + 1, kind: 'page-size-mismatch', width: pageRect.width.toFixed(1), height: pageRect.height.toFixed(1) });
                }
                if (Math.abs(footerRect.bottom - pageRect.bottom) > 0.5) {
                  violations.push({ page: idx + 1, kind: 'footer-not-at-page-bottom', gapPx: (pageRect.bottom - footerRect.bottom).toFixed(1) });
                }
                // Aggregate content extent — last child bottom vs main top.
                let lastBottom = mainRect.top;
                main.querySelectorAll(':scope > *').forEach((el) => {
                  const r = el.getBoundingClientRect();
                  if (r.bottom > lastBottom) lastBottom = r.bottom;
                });
                const utilisation = (lastBottom - mainRect.top) / mainRect.height;
                if (lastBottom > mainRect.bottom + 1) {
                  violations.push({ page: idx + 1, kind: 'overflow', overflowMm: ((lastBottom - mainRect.bottom) / 3.7795).toFixed(1) });
                }
                if (lastBottom > footerRect.top - 1) {
                  violations.push({ page: idx + 1, kind: 'footer-collision' });
                }
                if ((footerRect.top - lastBottom) < safeGapPx) {
                  violations.push({ page: idx + 1, kind: 'footer-safe-gap', gapPx: (footerRect.top - lastBottom).toFixed(1) });
                }
                main.querySelectorAll('.hotel-table').forEach((table) => {
                  const r = table.getBoundingClientRect();
                  if ((footerRect.top - r.bottom) < tableSafeGapPx) {
                    violations.push({ page: idx + 1, kind: 'table-footer-safe-gap', gapPx: (footerRect.top - r.bottom).toFixed(1) });
                  }
                });
                if (idx < pages.length - 1 && utilisation > 0 && utilisation < 0.25) {
                  violations.push({ page: idx + 1, kind: 'low-utilisation', utilisation: utilisation.toFixed(2) });
                }
              });
              if (violations.length > 0) {
                console.log('PDF_LAYOUT_QA_VIOLATIONS=' + JSON.stringify(violations));
              } else {
                console.log('PDF_LAYOUT_QA_OK=' + pages.length);
              }
            } catch (e) {
              console.log('PDF_LAYOUT_QA_ERROR=' + (e && e.message));
            }
          })();
        </script>
      </body>
    </html>
  `;
}

// Generate mock data for preview mode
function generateMockReportData(clientId: string, dateRange: { start: string; end: string }): ReportData {
  return {
    clientId,
    clientName: 'Belmonte Hotel',
    clientLogo: undefined,
    dateRange,
    metricsConfig: {
      meta: normalizeConfigForPlatform(mergeWithDefaults([]), 'meta'),
      google: normalizeConfigForPlatform(mergeWithDefaults([]), 'google'),
    },
    aiSummary: `Poniżej zestawienie wyników za analizowany okres.

Google Ads
Wydaliśmy 4 200,00 zł. Wygenerowaliśmy 125 000 wyświetleń i 3 100 kliknięć (CTR 2,48%). Rezerwacje: 42. Średni CPC 1,35 zł.

Meta Ads
Wydaliśmy 4 300,00 zł. Wygenerowaliśmy 360 000 wyświetleń i 8 250 kliknięć (CTR 2,29%). Rezerwacje: 56. Silniejszy udział w ruchu i konwersjach w kanale społecznościowym.

Podsumowanie łączne
Łącznie 98 rezerwacji, wartość 38 250,00 zł, ROAS 4,20x.`,
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
          { device: 'Mobile', spend: 2100, impressions: 75000, clicks: 1710, ctr: 2.28, conversions: 28, conversion_value: 8450, roas: 4.02 },
          { device: 'Desktop', spend: 1250, impressions: 35000, clicks: 875, ctr: 2.5, conversions: 14, conversion_value: 4210, roas: 3.37 },
          { device: 'Tablet', spend: 600, impressions: 15000, clicks: 265, ctr: 1.77, conversions: 5, conversion_value: 1380, roas: 2.30 },
        ],
        geographicPerformance: [
          { cityName: 'Warszawa', regionName: 'Mazowieckie', clicks: 620, conversions: 11, conversion_value: 3820 },
          { cityName: 'Kraków', regionName: 'Małopolskie', clicks: 410, conversions: 8, conversion_value: 2760 },
          { cityName: 'Poznań', regionName: 'Wielkopolskie', clicks: 360, conversions: 6, conversion_value: 1940 },
          { cityName: 'Wrocław', regionName: 'Dolnośląskie', clicks: 330, conversions: 5, conversion_value: 1720 },
          { cityName: 'Gdańsk', regionName: 'Pomorskie', clicks: 295, conversions: 4, conversion_value: 1450 },
          { cityName: 'Łódź', regionName: 'Łódzkie', clicks: 240, conversions: 4, conversion_value: 1220 },
          { cityName: 'Katowice', regionName: 'Śląskie', clicks: 210, conversions: 3, conversion_value: 980 },
          { cityName: 'Szczecin', regionName: 'Zachodniopomorskie', clicks: 180, conversions: 2, conversion_value: 740 },
          { cityName: 'Bydgoszcz', regionName: 'Kujawsko-pomorskie', clicks: 160, conversions: 2, conversion_value: 610 },
          { cityName: 'Lublin', regionName: 'Lubelskie', clicks: 145, conversions: 2, conversion_value: 580 },
          { cityName: 'Rzeszów', regionName: 'Podkarpackie', clicks: 120, conversions: 1, conversion_value: 420 },
          { cityName: 'Białystok', regionName: 'Podlaskie', clicks: 105, conversions: 1, conversion_value: 390 },
          { cityName: 'Toruń', regionName: 'Kujawsko-pomorskie', clicks: 96, conversions: 1, conversion_value: 330 },
          { cityName: 'Opole', regionName: 'Opolskie', clicks: 82, conversions: 1, conversion_value: 260 },
          { cityName: 'Zielona Góra', regionName: 'Lubuskie', clicks: 70, conversions: 1, conversion_value: 210 },
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
  const { data: clientData, error: clientError } = await serverSupabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();
    
  if (clientError || !clientData) {
    logger.error('❌ Client not found:', { clientId, error: clientError });
    throw new Error('Client not found');
  }

  const { data: dashConfigRow } = await serverSupabase
    .from('client_dashboard_config')
    .select('meta_metrics_config, google_metrics_config')
    .eq('client_id', clientId)
    .maybeSingle();
  const metricsConfigRow = dashConfigRow as {
    meta_metrics_config?: MetricConfigItem[] | null;
    google_metrics_config?: MetricConfigItem[] | null;
  } | null;

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
    clientLogo: undefined,
    dateRange,
    aiSummary: undefined,
    mediaEnabled: {
      meta: !!(clientData.meta_access_token && clientData.ad_account_id),
      google: !!(clientData.google_ads_enabled && clientData.google_ads_customer_id)
    },
    yoyComparison: undefined,
    metaData: undefined,
    googleData: undefined,
    metricsConfig: {
      meta: normalizeConfigForPlatform(
        mergeWithDefaults(metricsConfigRow?.meta_metrics_config || []),
        'meta'
      ),
      google: normalizeConfigForPlatform(
        mergeWithDefaults(metricsConfigRow?.google_metrics_config || []),
        'google'
      ),
    },
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
      
      // 🔍 DEBUG: Log date range before fetching
      logger.info('🔍 PDF WEEKLY DATA FETCH DEBUG:', {
        dateRange,
        daysDiff: Math.ceil((new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / (1000 * 60 * 60 * 24)) + 1,
        startDayOfWeek: new Date(dateRange.start).getDay(),
        isLikelyWeekly: Math.ceil((new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / (1000 * 60 * 60 * 24)) + 1 <= 7
      });
      
      // ✅ CRITICAL: Use EXACT same data fetching logic as /reports page
      // StandardizedDataFetcher automatically routes to:
      // - current_week_cache (via weekly smart cache) for current week periods
      // - campaign_summaries (via database) for historical periods
      // This ensures PDF data matches /reports page exactly
      logger.info('📊 PDF: Using StandardizedDataFetcher (same as /reports page) for data source routing');
      
      const metaResult = await StandardizedDataFetcher.fetchData({
        clientId,
        dateRange,
        platform: 'meta',
        reason: 'pdf-generation-meta', // Same pattern as reports page
        sessionToken: clientData.meta_access_token // Use client's access token
      });
      
      if (metaResult.success) {
        metaData = metaResult.data;
        
        // ✅ CRITICAL FIX: Sanitize data immediately after fetching (before any logging)
        // This prevents string concatenation issues
        const sanitizeNumber = (value: any): number => {
          if (value === null || value === undefined) return 0;
          if (typeof value === 'string') {
            // Handle string concatenation artifacts - extract first valid number
            const cleaned = value.replace(/[^0-9.-]/g, '');
            const num = parseFloat(cleaned);
            return Number.isFinite(num) ? num : 0;
          }
          const num = Number(value);
          return Number.isFinite(num) ? num : 0;
        };
        
        // Sanitize stats immediately
        if (metaData?.stats) {
          metaData.stats = {
            ...metaData.stats,
            totalSpend: sanitizeNumber(metaData.stats.totalSpend),
            totalImpressions: sanitizeNumber(metaData.stats.totalImpressions),
            totalClicks: sanitizeNumber(metaData.stats.totalClicks),
            totalConversions: sanitizeNumber(metaData.stats.totalConversions),
            averageCtr: sanitizeNumber(metaData.stats.averageCtr),
            averageCpc: sanitizeNumber(metaData.stats.averageCpc)
          };
        }
        
        // Sanitize conversionMetrics
        if (metaData?.conversionMetrics) {
          metaData.conversionMetrics = {
            ...metaData.conversionMetrics,
            reservations: sanitizeNumber(metaData.conversionMetrics.reservations),
            reservation_value: sanitizeNumber(metaData.conversionMetrics.reservation_value),
            roas: sanitizeNumber(metaData.conversionMetrics.roas),
            email_contacts: sanitizeNumber(metaData.conversionMetrics.email_contacts),
            click_to_call: sanitizeNumber(metaData.conversionMetrics.click_to_call)
          };
        }
        
        logger.info('✅ Meta data fetched successfully via StandardizedDataFetcher');
        logger.info('🔍 META DATA SOURCE DEBUG:', {
          totalSpend: metaData?.stats?.totalSpend,
          totalImpressions: metaData?.stats?.totalImpressions,
          totalClicks: metaData?.stats?.totalClicks,
          totalReservations: metaData?.conversionMetrics?.reservations,
          totalReservationValue: metaData?.conversionMetrics?.reservation_value,
          source: metaResult.debug?.source,
          cachePolicy: metaResult.debug?.cachePolicy,
          periodType: metaResult.debug?.periodType,
          dataSourcePriority: metaResult.debug?.dataSourcePriority,
          hasStats: !!metaData?.stats,
          hasConversionMetrics: !!metaData?.conversionMetrics,
          campaignsCount: metaData?.campaigns?.length || 0
        });
        
        // ✅ VERIFY: Ensure we're using the correct data source
        const expectedSourceForCurrentWeek = ['weekly-smart-cache', 'smart-cache-direct', 'weekly-cache', 'stale-weekly-cache'];
        const expectedSourceForHistorical = ['campaign-summaries-database', 'campaign_summaries', 'daily-kpi-data'];
        const actualSource = metaResult.debug?.source || 'unknown';
        
        if (metaResult.debug?.periodType === 'current-week' || metaResult.debug?.periodType === 'current') {
          if (!expectedSourceForCurrentWeek.includes(actualSource)) {
            logger.warn('⚠️ PDF DATA SOURCE MISMATCH: Current week should use smart cache, but got:', actualSource);
            logger.warn('⚠️ This may indicate smart cache validation failed - check weekly cache overlap logic');
          } else {
            logger.info('✅ PDF DATA SOURCE VERIFIED: Current week using smart cache (matches /reports page)');
          }
        } else if (metaResult.debug?.periodType === 'historical' || metaResult.debug?.periodType === 'historical-week') {
          if (!expectedSourceForHistorical.includes(actualSource)) {
            logger.warn('⚠️ PDF DATA SOURCE MISMATCH: Historical period should use database, but got:', actualSource);
          } else {
            logger.info('✅ PDF DATA SOURCE VERIFIED: Historical period using database (matches /reports page)');
          }
        }
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
  
  // Define base URL for API calls - always use NEXT_PUBLIC_APP_URL to match running server
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
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
      logger.info('📊 Fetching Google Ads data DIRECTLY via GoogleAdsStandardizedDataFetcher (no HTTP)...');
      
      const sessionToken = authHeader?.replace('Bearer ', '') || undefined;
      const googleResult = await GoogleAdsStandardizedDataFetcher.fetchData({
        clientId,
        dateRange: { start: dateRange.start, end: dateRange.end },
        reason: 'pdf-generation-google-ads',
        sessionToken
      });
      
      if (googleResult.success && googleResult.data) {
        googleData = googleResult.data;
        const googleSource = googleResult.debug?.source || 'direct-fetcher';
        logger.info('✅ Google Ads data fetched directly:', {
          totalSpend: googleData.stats?.totalSpend || 0,
          hasStats: !!googleData.stats,
          hasConversionMetrics: !!googleData.conversionMetrics,
          campaignsCount: googleData.campaigns?.length || 0,
          source: googleSource
        });
      } else {
        logger.error('❌ Google Ads direct fetch unsuccessful');
        googleError = 'Google Ads data not available';
      }
    } catch (error) {
      logger.error('❌ Error fetching Google Ads data directly:', error);
      googleError = error instanceof Error ? error.message : 'Unknown Google Ads error';
    }
  } else {
    logger.warn('⚠️ Google Ads condition not met - skipping Google Ads data fetch:', {
      google_ads_enabled: clientData.google_ads_enabled,
      google_ads_customer_id: clientData.google_ads_customer_id,
      reason: !clientData.google_ads_enabled ? 'google_ads_enabled is false' : 'google_ads_customer_id is missing'
    });
  }

  // Fetch Year-over-Year comparison DIRECTLY (no HTTP calls)
  try {
    logger.info('📊 Fetching YoY comparison DIRECTLY via database (no HTTP)...');
    
    // Calculate previous year date range
    const currentStart = new Date(dateRange.start + 'T00:00:00Z');
    const currentEnd = new Date(dateRange.end + 'T00:00:00Z');
    const prevStart = new Date(Date.UTC(currentStart.getUTCFullYear() - 1, currentStart.getUTCMonth(), currentStart.getUTCDate()));
    const prevEnd = new Date(Date.UTC(currentEnd.getUTCFullYear() - 1, currentEnd.getUTCMonth(), currentEnd.getUTCDate()));
    const prevDateRange = {
      start: prevStart.toISOString().split('T')[0] ?? '',
      end: prevEnd.toISOString().split('T')[0] ?? ''
    };
    
    logger.info('📅 YoY periods:', { current: dateRange, previous: prevDateRange });
    
    const calculateChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };
    
    const extractPeriodTotals = (result: any) => {
      if (!result?.data) return null;
      const stats = result.data.stats || {};
      const cm = result.data.conversionMetrics || {};
      const campaigns = result.data.campaigns || [];
      return {
        spend: stats.totalSpend || 0,
        impressions: stats.totalImpressions || 0,
        clicks: stats.totalClicks || 0,
        reservations: cm.reservations || stats.totalConversions || 0,
        reservationValue: cm.reservation_value || 0,
        booking_step_1: cm.booking_step_1 || campaigns.reduce((s: number, c: any) => s + (c.booking_step_1 || 0), 0),
        booking_step_2: cm.booking_step_2 || campaigns.reduce((s: number, c: any) => s + (c.booking_step_2 || 0), 0),
        booking_step_3: cm.booking_step_3 || campaigns.reduce((s: number, c: any) => s + (c.booking_step_3 || 0), 0),
      };
    };
    
    const buildChanges = (current: any, previous: any) => ({
      spend: calculateChange(current.spend, previous.spend),
      impressions: calculateChange(current.impressions, previous.impressions),
      clicks: calculateChange(current.clicks, previous.clicks),
      reservations: calculateChange(current.reservations, previous.reservations),
      reservationValue: calculateChange(current.reservationValue, previous.reservationValue),
      booking_step_1: calculateChange(current.booking_step_1, previous.booking_step_1),
      booking_step_2: calculateChange(current.booking_step_2, previous.booking_step_2),
      booking_step_3: calculateChange(current.booking_step_3, previous.booking_step_3),
    });
    
    const zeroTotals = { spend: 0, impressions: 0, clicks: 0, reservations: 0, reservationValue: 0, booking_step_1: 0, booking_step_2: 0, booking_step_3: 0 };
    
    // Fetch Meta YoY data directly
    let metaCurrent = { ...zeroTotals };
    let metaPrevious = { ...zeroTotals };
    if (clientData.meta_access_token && clientData.ad_account_id) {
      try {
        // Use raw fetched metaData (reportData.metaData is not yet assigned at this point)
        if (metaData?.stats) {
          const s = metaData.stats;
          const cm = metaData.conversionMetrics || {} as any;
          metaCurrent = {
            spend: s.totalSpend || 0, impressions: s.totalImpressions || 0, clicks: s.totalClicks || 0,
            reservations: cm.reservations || s.totalConversions || 0, reservationValue: cm.reservation_value || 0,
            booking_step_1: cm.booking_step_1 || 0, booking_step_2: cm.booking_step_2 || 0, booking_step_3: cm.booking_step_3 || 0,
          };
        }
        // Fetch previous year Meta data from database
        const prevMetaResult = await StandardizedDataFetcher.fetchData({
          clientId, dateRange: prevDateRange, platform: 'meta', reason: 'pdf-yoy-meta-previous'
        });
        const prevTotals = extractPeriodTotals(prevMetaResult);
        if (prevTotals) metaPrevious = prevTotals;
        logger.info('✅ Meta YoY: current spend=' + metaCurrent.spend + ', previous spend=' + metaPrevious.spend);
      } catch (e) {
        logger.warn('⚠️ Meta YoY direct fetch failed:', e);
      }
    }
    
    // Fetch Google Ads YoY data directly
    let googleCurrent = { ...zeroTotals };
    let googlePrevious = { ...zeroTotals };
    if (googleAdsConditionMet) {
      try {
        // Use raw fetched googleData (reportData.googleData is not yet assigned at this point)
        if (googleData?.stats) {
          const s = googleData.stats;
          const cm = googleData.conversionMetrics || {} as any;
          googleCurrent = {
            spend: s.totalSpend || 0, impressions: s.totalImpressions || 0, clicks: s.totalClicks || 0,
            reservations: cm.reservations || s.totalConversions || 0, reservationValue: cm.reservation_value || 0,
            booking_step_1: cm.booking_step_1 || 0, booking_step_2: cm.booking_step_2 || 0, booking_step_3: cm.booking_step_3 || 0,
          };
        }
        // Fetch previous year Google data from database
        const prevGoogleResult = await GoogleAdsStandardizedDataFetcher.fetchData({
          clientId, dateRange: prevDateRange, reason: 'pdf-yoy-google-previous'
        });
        const prevTotals = extractPeriodTotals(prevGoogleResult);
        if (prevTotals) googlePrevious = prevTotals;
        logger.info('✅ Google YoY: current spend=' + googleCurrent.spend + ', previous spend=' + googlePrevious.spend);
      } catch (e) {
        logger.warn('⚠️ Google YoY direct fetch failed:', e);
      }
    }
    
    const metaChanges = buildChanges(metaCurrent, metaPrevious);
    const googleChanges = buildChanges(googleCurrent, googlePrevious);
    
    // Set YoY if we have meaningful data or the platform is enabled
    const hasMetaYoY = (reportData.mediaEnabled?.meta ?? false) || metaCurrent.spend > 0 || metaPrevious.spend > 0;
    const hasGoogleYoY = (reportData.mediaEnabled?.google ?? false) || googleCurrent.spend > 0 || googlePrevious.spend > 0;
    
    if (hasMetaYoY || hasGoogleYoY) {
      reportData.yoyComparison = {
        meta: { current: metaCurrent, previous: metaPrevious, changes: metaChanges },
        google: { current: googleCurrent, previous: googlePrevious, changes: googleChanges }
      };
      logger.info('✅ YoY comparison built directly:', {
        hasMetaYoY, hasGoogleYoY,
        metaCurrentSpend: metaCurrent.spend, metaPrevSpend: metaPrevious.spend,
        googleCurrentSpend: googleCurrent.spend, googlePrevSpend: googlePrevious.spend
      });
    } else {
      logger.info('ℹ️ No YoY data available (no spend in current or previous period)');
    }
    
  } catch (error) {
    logger.warn('⚠️ Year-over-year comparison failed:', error);
  }
  
  // ✅ CRITICAL FIX: Sanitize data immediately after fetching to prevent string concatenation
  const sanitizeNumber = (value: any): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'string') {
      // Handle string concatenation artifacts
      const cleaned = value.replace(/[^0-9.-]/g, '');
      const num = parseFloat(cleaned);
      return Number.isFinite(num) ? num : 0;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };
  
  // ✅ FIX: Sanitize metaData stats immediately after fetching
  if (metaData?.stats) {
    metaData.stats = {
      ...metaData.stats,
      totalSpend: sanitizeNumber(metaData.stats.totalSpend),
      totalImpressions: sanitizeNumber(metaData.stats.totalImpressions),
      totalClicks: sanitizeNumber(metaData.stats.totalClicks),
      totalConversions: sanitizeNumber(metaData.stats.totalConversions),
      averageCtr: sanitizeNumber(metaData.stats.averageCtr),
      averageCpc: sanitizeNumber(metaData.stats.averageCpc)
    };
  }
  
  // ✅ FIX: Sanitize googleData stats immediately after fetching
  if (googleData?.stats) {
    googleData.stats = {
      ...googleData.stats,
      totalSpend: sanitizeNumber(googleData.stats.totalSpend),
      totalImpressions: sanitizeNumber(googleData.stats.totalImpressions),
      totalClicks: sanitizeNumber(googleData.stats.totalClicks),
      totalConversions: sanitizeNumber(googleData.stats.totalConversions),
      averageCtr: sanitizeNumber(googleData.stats.averageCtr),
      averageCpc: sanitizeNumber(googleData.stats.averageCpc)
    };
  }
  
  // 🔍 DEBUG: Check if we have any data at all
  logger.info('🔍 DATA AVAILABILITY CHECK:', {
    hasMetaData: !!metaData,
    hasGoogleData: !!googleData,
    metaError: metaError,
    googleError: googleError,
    metaSpend: metaData?.stats?.totalSpend || 0,
    metaSpendType: typeof metaData?.stats?.totalSpend,
    googleSpend: googleData?.stats?.totalSpend || 0,
    googleSpendType: typeof googleData?.stats?.totalSpend
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
          // ✅ FIX: Sanitize fallback data immediately
          if (metaData?.stats) {
            metaData.stats = {
              ...metaData.stats,
              totalSpend: sanitizeNumber(metaData.stats.totalSpend),
              totalImpressions: sanitizeNumber(metaData.stats.totalImpressions),
              totalClicks: sanitizeNumber(metaData.stats.totalClicks),
              totalConversions: sanitizeNumber(metaData.stats.totalConversions),
              averageCtr: sanitizeNumber(metaData.stats.averageCtr),
              averageCpc: sanitizeNumber(metaData.stats.averageCpc)
            };
          }
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
      
      // ✅ CRITICAL FIX: Use sanitizeNumber defined at function scope (line 3025)
      // Note: sanitizeNumber is already defined above, use it here
      
      // Calculate additional metrics using same logic as reports page
      const totalConversions = sanitizeNumber(stats.totalConversions);
      const emailContacts = sanitizeNumber(conversionMetrics.email_contacts);
      const phoneContacts = sanitizeNumber(conversionMetrics.click_to_call);
      const totalReservationValue = sanitizeNumber(conversionMetrics.reservation_value);
      const totalReservations = sanitizeNumber(conversionMetrics.reservations);
      const totalSpend = sanitizeNumber(stats.totalSpend);
      
      // Calculate campaign averages (same as reports page) - legacy metrics removed
      const avgRelevanceScore = campaigns.length > 0 ? campaigns.reduce((sum: number, c: any) => sum + (c.relevance_score || 0), 0) / campaigns.length : 0;
      const totalLandingPageViews = campaigns.reduce((sum: number, c: any) => sum + (c.landing_page_view || 0), 0);
      const totalReach = conversionMetrics.reach || 0;
      
      reportData.metaData = {
        metrics: {
          totalSpend: totalSpend,
          totalImpressions: sanitizeNumber(stats.totalImpressions),
          totalClicks: sanitizeNumber(stats.totalClicks),
          totalConversions: totalConversions,
          averageCtr: sanitizeNumber(stats.averageCtr),
          averageCpc: sanitizeNumber(stats.averageCpc),
          averageCpa: totalConversions > 0 ? totalSpend / totalConversions : 0,
          averageCpm: sanitizeNumber(stats.totalImpressions) > 0 ? (totalSpend / sanitizeNumber(stats.totalImpressions)) * 1000 : 0,
          reach: sanitizeNumber(totalReach),
          relevanceScore: sanitizeNumber(avgRelevanceScore),
          landingPageViews: sanitizeNumber(totalLandingPageViews),
          totalReservations: totalReservations,
          totalReservationValue: totalReservationValue,
          roas: sanitizeNumber(conversionMetrics.roas),
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
          adRelevanceResults: [],
          geographicPerformance: [],
        }
      };
    } catch (error) {
      logger.error('❌ Error processing Meta data:', error);
    }
  }

  // 🔧 FETCH META TABLES DATA DIRECTLY (no HTTP call - avoids auth issues in serverless)
  if (clientData.meta_access_token && clientData.ad_account_id) {
    try {
      logger.info('📊 Fetching Meta tables data DIRECTLY via MetaAPIService (no HTTP)...');
      
      const metaToken = clientData.system_user_token || clientData.meta_access_token;
      const { MetaAPIService } = await import('@/lib/meta-api-optimized');
      const metaService = new MetaAPIService(metaToken);
      const adAccountId = clientData.ad_account_id.startsWith('act_') 
        ? clientData.ad_account_id.substring(4) 
        : clientData.ad_account_id;
      
      const [placementResult, demographicResult, adRelevanceResult, geographicResult] = await Promise.allSettled([
        metaService.getPlacementPerformance(adAccountId, dateRange.start, dateRange.end),
        metaService.getDemographicPerformance(adAccountId, dateRange.start, dateRange.end),
        metaService.getAdRelevanceResults(adAccountId, dateRange.start, dateRange.end),
        metaService.getGeographicPerformance(adAccountId, dateRange.start, dateRange.end),
      ]);
      
      const placementData = placementResult.status === 'fulfilled' ? (placementResult.value || []) : [];
      const demographicData = demographicResult.status === 'fulfilled' ? (demographicResult.value || []) : [];
      const adRelevanceData = adRelevanceResult.status === 'fulfilled' ? (adRelevanceResult.value || []) : [];
      const geographicData = geographicResult.status === 'fulfilled' ? (geographicResult.value || []) : [];
      
      logger.info('✅ Meta tables fetched directly:', {
        placementCount: placementData.length,
        demographicCount: demographicData.length,
        adRelevanceCount: adRelevanceData.length,
        geographicCount: geographicData.length,
      });
      
      if (!reportData.metaData) {
        reportData.metaData = {
          metrics: { totalSpend: 0, totalImpressions: 0, totalClicks: 0, totalConversions: 0, averageCtr: 0, averageCpc: 0, averageCpa: 0, averageCpm: 0, reach: 0, relevanceScore: 0, landingPageViews: 0, totalReservations: 0, totalReservationValue: 0, roas: 0, emailContacts: 0, phoneContacts: 0 },
          campaigns: [],
          funnel: { booking_step_1: 0, booking_step_2: 0, booking_step_3: 0, reservations: 0, reservation_value: 0, roas: 0 },
          tables: { placementPerformance: [], demographicPerformance: [], adRelevanceResults: [], geographicPerformance: [] }
        };
      }
      
      reportData.metaData.tables = {
        placementPerformance: placementData,
        demographicPerformance: demographicData,
        adRelevanceResults: adRelevanceData,
        geographicPerformance: geographicData,
      };
    } catch (error) {
      logger.warn('⚠️ Meta tables direct fetch failed:', error);
    }
  }

  // 🔧 FALLBACK: If GoogleAdsStandardizedDataFetcher failed, try smart cache helper directly
  if (!googleData && googleAdsConditionMet) {
    try {
      logger.info('🔄 FALLBACK: Trying Google Ads smart cache helper directly...');

      const { getGoogleAdsSmartCacheData } = await import('@/lib/google-ads-smart-cache-helper');
      const cacheResult = await getGoogleAdsSmartCacheData(clientId, false);

      if (cacheResult.success && cacheResult.data) {
        googleData = cacheResult.data;
        logger.info('✅ Google Ads data fetched via smart cache fallback:', {
          totalSpend: googleData?.stats?.totalSpend || 0,
          campaigns: googleData?.campaigns?.length || 0,
          source: cacheResult.source || 'smart-cache-fallback'
        });
      } else {
        logger.warn('⚠️ Google Ads smart cache fallback returned no data');

        // Last resort: try fetch-google-ads-live-data API with auth
        try {
          logger.info('🔄 LAST RESORT: Trying Google Ads via HTTP API...');
          const googleFallbackResponse = await fetch(`${baseUrl}/api/fetch-google-ads-live-data`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader
            },
            body: JSON.stringify({
              clientId,
              dateRange,
              platform: 'google',
              forceFresh: true,
              reason: 'pdf-generation-google-ads-fallback'
            })
          });

          if (googleFallbackResponse.ok) {
            const googleFallbackData = await googleFallbackResponse.json();
            if (googleFallbackData.success && googleFallbackData.data) {
              googleData = googleFallbackData.data;
              logger.info('✅ Google Ads data fetched via HTTP API fallback');
            }
          }
        } catch (httpFallbackError) {
          logger.error('❌ Google Ads HTTP API fallback failed:', httpFallbackError);
        }
      }
    } catch (fallbackError) {
      logger.error('❌ Google Ads smart cache fallback failed:', fallbackError);
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
      // ✅ FIX: reservation_value now includes form conversion values from "Wartość konwersji"
      const googleTotalReservationValue = conversionMetrics.reservation_value || 0;
      const googleTotalConversionValue =
        conversionMetrics.total_conversion_value ||
        conversionMetrics.conversion_value ||
        conversionMetrics.reservation_value ||
        0;
      const googleTotalReservations = conversionMetrics.reservations || 0;
      const googleTotalSpend = stats.totalSpend || 0;
      const googleRoas =
        googleTotalSpend > 0 ? googleTotalConversionValue / googleTotalSpend : 0;
      
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
          roas: googleRoas,
          emailContacts: googleEmailContacts,
          phoneContacts: googlePhoneContacts
        },
        campaigns: campaigns,
        funnel: {
          booking_step_1: conversionMetrics.booking_step_1 || 0,
          booking_step_2: conversionMetrics.booking_step_2 || 0,
          booking_step_3: conversionMetrics.booking_step_3 || 0,
          reservations: conversionMetrics.reservations || 0,
          // ✅ FIX: reservation_value now includes form conversion values
          reservation_value: conversionMetrics.reservation_value || 0,
          total_conversion_value: googleTotalConversionValue,
          roas: googleRoas
        },
        tables: {
          networkPerformance: googleAdsTables.networkPerformance || [],
          devicePerformance: googleAdsTables.devicePerformance || [],
          keywordPerformance: googleAdsTables.keywordPerformance || [],
          searchTermPerformance: googleAdsTables.searchTermPerformance || [],
          demographicPerformance: googleAdsTables.demographicPerformance || [],
          geographicPerformance: googleAdsTables.geographicPerformance || [],
          qualityMetrics: googleAdsTables.qualityMetrics || [],
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
  
  // 🔧 FETCH GOOGLE ADS TABLES DATA DIRECTLY if not already available from cache
  if (reportData.googleData && googleAdsConditionMet) {
    const tables = reportData.googleData.tables as any;
    const hasTables = tables &&
      (tables.networkPerformance?.length > 0 ||
       tables.devicePerformance?.length > 0 ||
       tables.keywordPerformance?.length > 0 ||
       tables.demographicPerformance?.length > 0 ||
       tables.geographicPerformance?.length > 0);

    if (!hasTables) {
      // First try the persistent google_ads_tables_data cache so PDFs for
      // historical periods don't hammer the Google Ads API on every export.
      try {
        const { loadGoogleAdsTablesFromDatabase, hasAnyGoogleAdsTablesRows } =
          await import('@/lib/google-ads-tables-storage');
        const stored = await loadGoogleAdsTablesFromDatabase(
          clientData.id,
          dateRange.start,
          dateRange.end,
        );
        if (hasAnyGoogleAdsTablesRows(stored)) {
          reportData.googleData.tables = {
            networkPerformance: stored!.networkPerformance,
            devicePerformance: stored!.devicePerformance,
            keywordPerformance: stored!.keywordPerformance,
            searchTermPerformance: stored!.searchTermPerformance,
            demographicPerformance: stored!.demographicPerformance,
            geographicPerformance: stored!.geographicPerformance,
            qualityMetrics: stored!.qualityMetrics,
          };
          logger.info('✅ Google Ads tables hydrated from google_ads_tables_data for PDF');
        }
      } catch (storedErr) {
        logger.warn('⚠️ PDF google_ads_tables_data lookup failed:', storedErr);
      }
    }

    // Recompute after the persistent lookup above
    const tablesAfterStored = reportData.googleData.tables as any;
    const stillMissing = !(
      tablesAfterStored &&
      (tablesAfterStored.networkPerformance?.length > 0 ||
        tablesAfterStored.devicePerformance?.length > 0 ||
        tablesAfterStored.keywordPerformance?.length > 0 ||
        tablesAfterStored.demographicPerformance?.length > 0 ||
        tablesAfterStored.geographicPerformance?.length > 0)
    );

    if (stillMissing) {
      try {
        logger.info('📊 Fetching Google Ads tables data DIRECTLY via GoogleAdsAPIService...');

        const { data: settingsData } = await serverSupabase
          .from('system_settings')
          .select('key, value')
          .in('key', ['google_ads_client_id', 'google_ads_client_secret', 'google_ads_developer_token', 'google_ads_manager_refresh_token', 'google_ads_manager_customer_id']);

        const settings = (settingsData || []).reduce((acc: Record<string, any>, s: any) => {
          acc[s.key] = s.value;
          return acc;
        }, {} as Record<string, any>);

        const refreshToken = settings.google_ads_manager_refresh_token || clientData.google_ads_refresh_token;

        if (refreshToken && settings.google_ads_client_id) {
          const { GoogleAdsAPIService } = await import('@/lib/google-ads-api');
          const googleAdsService = new GoogleAdsAPIService({
            refreshToken,
            clientId: settings.google_ads_client_id,
            clientSecret: settings.google_ads_client_secret,
            developmentToken: settings.google_ads_developer_token,
            customerId: clientData.google_ads_customer_id!,
            managerCustomerId: settings.google_ads_manager_customer_id,
          });

          // Use the unified getGoogleAdsTables() so PDF gets exactly the same
          // payload shape as the /reports UI (network + device + keyword +
          // searchTerm + demographic + geographic). Also persist the result
          // to google_ads_tables_data so the next PDF export and the
          // reports UI can both reuse it without an API roundtrip.
          const { fetchAndStoreGoogleAdsTables } = await import('@/lib/google-ads-tables-storage');
          const tables = await fetchAndStoreGoogleAdsTables(
            googleAdsService,
            clientData.id,
            dateRange.start,
            dateRange.end,
          );

          reportData.googleData.tables = {
            networkPerformance: tables?.networkPerformance || [],
            devicePerformance: tables?.devicePerformance || [],
            keywordPerformance: tables?.keywordPerformance || [],
            searchTermPerformance: tables?.searchTermPerformance || [],
            demographicPerformance: tables?.demographicPerformance || [],
            geographicPerformance: tables?.geographicPerformance || [],
            qualityMetrics: tables?.qualityMetrics || [],
          };

          logger.info('✅ Google Ads tables fetched directly:', {
            networkCount: reportData.googleData.tables.networkPerformance.length,
            deviceCount: reportData.googleData.tables.devicePerformance.length,
            keywordCount: reportData.googleData.tables.keywordPerformance.length,
            demographicCount: reportData.googleData.tables.demographicPerformance?.length || 0,
            geographicCount: (reportData.googleData.tables as any).geographicPerformance?.length || 0,
          });
        }
      } catch (error) {
        logger.warn('⚠️ Google Ads tables direct fetch failed:', error);
      }
    }
  }

  // Generate AI Summary using SAME DATA FETCHING SYSTEM as reports page
  logger.info('🔍 Generating AI summary using same data as reports page...');
  logger.info('🔍 Data availability for AI summary:', {
    hasMetaData: !!reportData.metaData,
    hasGoogleData: !!reportData.googleData,
    hasYoyData: !!reportData.yoyComparison
  });
  
  try {
    logger.info('🤖 Generating AI summary DIRECTLY (no HTTP call)...');
    
    const { generateAISummary } = await import('@/lib/ai-summary-generator');
    
    const metaMetrics = reportData.metaData?.metrics;
    const googleMetrics = reportData.googleData?.metrics;
    const cn = reportData.clientName || '';
    const emailContactsCombined = isBelmonteClient(cn)
      ? (metaMetrics?.emailContacts || 0)
      : (metaMetrics?.emailContacts || 0) + (googleMetrics?.emailContacts || 0);
    const clickToCallCombined = isBelmonteClient(cn)
      ? (metaMetrics?.phoneContacts || 0)
      : (metaMetrics?.phoneContacts || 0) + (googleMetrics?.phoneContacts || 0);
    
    const totalSpend = (metaMetrics?.totalSpend || 0) + (googleMetrics?.totalSpend || 0);
    const totalImpressions = (metaMetrics?.totalImpressions || 0) + (googleMetrics?.totalImpressions || 0);
    const totalClicks = (metaMetrics?.totalClicks || 0) + (googleMetrics?.totalClicks || 0);
    const totalConversions = (metaMetrics?.totalConversions || 0) + (googleMetrics?.totalConversions || 0);
    const totalReservations = (metaMetrics?.totalReservations || 0) + (googleMetrics?.totalReservations || 0);
    const totalReservationValue = (metaMetrics?.totalReservationValue || 0) + (googleMetrics?.totalReservationValue || 0);

    const mImp = metaMetrics?.totalImpressions || 0;
    const gImp = googleMetrics?.totalImpressions || 0;
    const mClk = metaMetrics?.totalClicks || 0;
    const gClk = googleMetrics?.totalClicks || 0;
    const metaCtrPct = ctrPercentFromStats(metaMetrics?.averageCtr, mClk, mImp);
    const googleCtrPct = ctrPercentFromStats(googleMetrics?.averageCtr, gClk, gImp);
    const blendedAverageCtr =
      reportData.mediaEnabled?.meta && reportData.mediaEnabled?.google
        ? ctrPercentBlended(
            { ctr: metaCtrPct, impressions: mImp },
            { ctr: googleCtrPct, impressions: gImp }
          )
        : reportData.mediaEnabled?.meta
          ? metaCtrPct
          : reportData.mediaEnabled?.google
            ? googleCtrPct
            : totalImpressions > 0
              ? (totalClicks / totalImpressions) * 100
              : 0;

    const mSpend = metaMetrics?.totalSpend || 0;
    const gSpend = googleMetrics?.totalSpend || 0;
    const metaCpcPct = cpcFromStats(metaMetrics?.averageCpc, mSpend, mClk);
    const googleCpcPct = cpcFromStats(googleMetrics?.averageCpc, gSpend, gClk);
    const blendedAverageCpc =
      reportData.mediaEnabled?.meta && reportData.mediaEnabled?.google
        ? cpcBlended(
            { cpc: metaCpcPct, clicks: mClk },
            { cpc: googleCpcPct, clicks: gClk }
          )
        : reportData.mediaEnabled?.meta
          ? metaCpcPct
          : reportData.mediaEnabled?.google
            ? googleCpcPct
            : totalClicks > 0
              ? totalSpend / totalClicks
              : 0;

    const summaryData = {
      totalSpend,
      totalImpressions,
      totalClicks,
      totalConversions,
      averageCtr: blendedAverageCtr,
      averageCpc: blendedAverageCpc,
      averageCpa: totalConversions > 0 ? totalSpend / totalConversions : 0,
      currency: 'PLN',
      dateRange,
      clientName: reportData.clientName,
      reservations: totalReservations,
      reservationValue: totalReservationValue,
      roas: totalSpend > 0 ? totalReservationValue / totalSpend : 0,
      costPerReservation: totalReservations > 0 ? totalSpend / totalReservations : 0,
      platformAttribution: reportData.mediaEnabled?.meta && reportData.mediaEnabled?.google
        ? 'kampanie Meta Ads i Google Ads'
        : reportData.mediaEnabled?.google
          ? 'kampanie Google Ads'
          : 'kampanie Meta Ads',
      platformBreakdown: {
        ...(reportData.mediaEnabled?.meta ? {
          meta: {
            spend: metaMetrics?.totalSpend || 0,
            impressions: metaMetrics?.totalImpressions || 0,
            clicks: metaMetrics?.totalClicks || 0,
            conversions: metaMetrics?.totalReservations || 0,
            averageCtr: metaMetrics?.averageCtr,
            averageCpc: metaCpcPct,
          }
        } : {}),
        ...(reportData.mediaEnabled?.google ? {
          google: {
            spend: googleMetrics?.totalSpend || 0,
            impressions: googleMetrics?.totalImpressions || 0,
            clicks: googleMetrics?.totalClicks || 0,
            conversions: googleMetrics?.totalReservations || 0,
            averageCtr: googleMetrics?.averageCtr,
            averageCpc: googleCpcPct,
          }
        } : {})
      },
      platformSources: [
        ...(reportData.mediaEnabled?.meta ? ['Meta Ads'] : []),
        ...(reportData.mediaEnabled?.google ? ['Google Ads'] : [])
      ],
      bookingStep1: (reportData.metaData?.funnel?.booking_step_1 || 0) + (reportData.googleData?.funnel?.booking_step_1 || 0),
      bookingStep2: (reportData.metaData?.funnel?.booking_step_2 || 0) + (reportData.googleData?.funnel?.booking_step_2 || 0),
      bookingStep3: (reportData.metaData?.funnel?.booking_step_3 || 0) + (reportData.googleData?.funnel?.booking_step_3 || 0),
      emailContacts: emailContactsCombined,
      clickToCall: clickToCallCombined,
    };
    
    const summary = await generateAISummary(summaryData, clientId);
    if (summary) {
      reportData.aiSummary = summary;
      logger.info('✅ AI summary generated directly:', { summaryLength: summary.length });
    } else {
      logger.warn('⚠️ AI summary generator returned null');
    }
  } catch (error) {
    logger.error('❌ AI SUMMARY GENERATION EXCEPTION:', {
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    logger.warn('⚠️ AI summary generation failed, continuing without it');
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

    const { clientId, dateRange, campaigns, totals, client, metaTables, bypassAllCache, viewType } = body;
    
    // 🔧 CUSTOM DATE RANGE: Check if live data was passed
    const hasLiveData = bypassAllCache && viewType === 'custom' && campaigns && client;
    if (hasLiveData) {
      logger.info('🚀 CUSTOM DATE RANGE: Using passed live data for PDF generation (bypassing all cache)');
    }
    
    // Check if this is a preview request (development/design tool)
    const isPreviewMode = request.headers.get('X-Preview-Mode') === 'true';
    // Debug mode is opt-in via the URL (e.g. /pdf-preview?debug=1) and turns
    // on the layout-bounding-box overlay defined in the page CSS.
    const requestUrl = new URL(request.url);
    const isDebugMode = requestUrl.searchParams.get('debug') === '1';
    
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
    }
    // 🚀 CUSTOM DATE RANGE: Use passed live data directly
    else if (hasLiveData) {
      logger.info('🚀 CUSTOM DATE RANGE: Building report from passed live data');
      const { data: dashConfigRow } = await serverSupabase
        .from('client_dashboard_config')
        .select('meta_metrics_config, google_metrics_config')
        .eq('client_id', clientId)
        .maybeSingle();
      const metricsConfigRow = dashConfigRow as {
        meta_metrics_config?: MetricConfigItem[] | null;
        google_metrics_config?: MetricConfigItem[] | null;
      } | null;
      
      // Build report data from passed campaigns - match expected ReportData structure
      const totalSpend = totals?.spend || campaigns.reduce((sum: number, c: any) => sum + (c.spend || 0), 0);
      const totalImpressions = totals?.impressions || campaigns.reduce((sum: number, c: any) => sum + (c.impressions || 0), 0);
      const totalClicks = totals?.clicks || campaigns.reduce((sum: number, c: any) => sum + (c.clicks || 0), 0);
      const totalConversions = totals?.conversions || campaigns.reduce((sum: number, c: any) => sum + (c.conversions || 0), 0);
      const reservations = campaigns.reduce((sum: number, c: any) => sum + (c.reservations || 0), 0);
      const reservationValue = campaigns.reduce((sum: number, c: any) => sum + (c.reservation_value || 0), 0);
      
      const metrics = {
        totalSpend,
        totalImpressions,
        totalClicks,
        totalConversions,
        averageCtr: totals?.ctr || (totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0),
        averageCpc: totals?.cpc || (totalClicks > 0 ? totalSpend / totalClicks : 0),
        averageCpa: totalConversions > 0 ? totalSpend / totalConversions : 0,
        averageCpm: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
        reach: campaigns.reduce((sum: number, c: any) => sum + (c.reach || 0), 0),
        relevanceScore: 0,
        landingPageViews: campaigns.reduce((sum: number, c: any) => sum + (c.landing_page_view || 0), 0),
        totalReservations: reservations,
        totalReservationValue: reservationValue,
        roas: totalSpend > 0 ? reservationValue / totalSpend : 0,
        emailContacts: campaigns.reduce((sum: number, c: any) => sum + (c.email_contacts || 0), 0),
        phoneContacts: campaigns.reduce((sum: number, c: any) => sum + (c.click_to_call || 0), 0)
      };
      
      const funnel = {
        booking_step_1: campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_1 || 0), 0),
        booking_step_2: campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_2 || 0), 0),
        booking_step_3: campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_3 || 0), 0),
        reservations,
        reservation_value: reservationValue,
        roas: totalSpend > 0 ? reservationValue / totalSpend : 0
      };
      
      const tables = {
        placementPerformance: metaTables?.placementPerformance || [],
        demographicPerformance: metaTables?.demographicPerformance || [],
        adRelevanceResults: metaTables?.adRelevanceResults || [],
        geographicPerformance: metaTables?.geographicPerformance || [],
      };
      
      reportData = {
        clientId,
        clientName: client.name,
        clientLogo: undefined,
        dateRange,
        aiSummary: undefined,
        yoyComparison: undefined, // Skip YoY for custom date ranges
        metricsConfig: {
          meta: normalizeConfigForPlatform(
            mergeWithDefaults(metricsConfigRow?.meta_metrics_config || []),
            'meta'
          ),
          google: normalizeConfigForPlatform(
            mergeWithDefaults(metricsConfigRow?.google_metrics_config || []),
            'google'
          ),
        },
        metaData: {
          metrics,
          campaigns,
          funnel,
          tables
        },
        googleData: undefined // Custom ranges currently support Meta only
      };
      
      logger.info('✅ Report data built from live data:', {
        campaignCount: campaigns.length,
        totalSpend: totalSpend,
        totalClicks: totalClicks,
        reservations: reservations
      });
    }
    else {
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
      html = generateHotelPDFHTML(reportData, { debug: isDebugMode });
      
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

    logger.info('🚀 Launching Puppeteer (serverless-compatible)...');
    let browser: any = null;
    let page: any = null;
    
    const MAX_PDF_SIZE_MB = 50;
    const MAX_GENERATION_TIME_MS = 110000; // 110s (within Vercel's 120s maxDuration)
    const startTime = Date.now();
    
    try {
      const isProduction = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NODE_ENV === 'production';
      
      let executablePath: string | undefined;
      if (isProduction) {
        executablePath = await chromium.executablePath();
        logger.info('🔧 Using @sparticuz/chromium for serverless environment');
      } else {
        // Local development: try common Chrome/Chromium paths
        const { execSync } = require('child_process');
        try {
          executablePath = execSync('which google-chrome-stable || which google-chrome || which chromium-browser || which chromium', { encoding: 'utf-8' }).trim();
        } catch {
          // macOS fallback
          const fs = require('fs');
          const macPaths = [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
          ];
          executablePath = macPaths.find(p => fs.existsSync(p));
        }
        logger.info(`🔧 Using local Chrome: ${executablePath}`);
      }

      if (!executablePath) {
        throw new Error('No Chrome/Chromium executable found. Install Chrome or set CHROME_PATH.');
      }

      const launchArgs = isProduction ? chromium.args : [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ];

      browser = await puppeteerCore.launch({
        executablePath,
        headless: true,
        args: launchArgs,
        defaultViewport: {
          width: REPORT_PAGE_VIEWPORT_WIDTH_PX,
          height: REPORT_PAGE_VIEWPORT_HEIGHT_PX,
          deviceScaleFactor: 1,
        },
        timeout: MAX_GENERATION_TIME_MS,
      });

      page = await browser.newPage();
      await page.setViewport({
        width: REPORT_PAGE_VIEWPORT_WIDTH_PX,
        height: REPORT_PAGE_VIEWPORT_HEIGHT_PX,
        deviceScaleFactor: 1,
      });
      
      page.setDefaultTimeout(90000);
      page.setDefaultNavigationTimeout(90000);

      page.on('pageerror', (error: Error) => {
        logger.error('📄 PDF Page Error:', error.message);
      });
      
      page.on('console', (msg: { text: () => string }) => {
        const text = msg.text();
        if (text.startsWith('PDF_LAYOUT_QA_VIOLATIONS=')) {
          logger.warn('⚠️ PDF layout QA violations:', text.replace('PDF_LAYOUT_QA_VIOLATIONS=', ''));
        } else if (text.startsWith('PDF_LAYOUT_QA_OK=')) {
          logger.info(`✅ PDF layout QA passed for ${text.replace('PDF_LAYOUT_QA_OK=', '')} pages`);
        } else if (text.startsWith('PDF_LAYOUT_QA_ERROR=')) {
          logger.error('❌ PDF layout QA error:', text.replace('PDF_LAYOUT_QA_ERROR=', ''));
        } else {
          logger.info('📄 PDF Page Console:', text);
        }
      });
      
      logger.info('⏳ Setting page content...');
      await page.setContent(html, { 
        waitUntil: 'domcontentloaded',
        timeout: 90000
      });
      await new Promise(r => setTimeout(r, 3000));
      
      logger.info('⏳ Waiting for fonts and content to render...');
      await page.evaluate(() => {
        return document.fonts.ready.then(() => {
          return new Promise((resolve) => {
            if (document.readyState === 'complete') {
              resolve(true);
            } else {
              window.addEventListener('load', () => resolve(true));
            }
          });
        });
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check generation time limit
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime > MAX_GENERATION_TIME_MS) {
        throw new Error(`PDF generation exceeded time limit of ${MAX_GENERATION_TIME_MS}ms`);
      }
      
      logger.info('📄 Generating PDF...');
      const logoForFooter = '';
      const pdfMargin = {
        top: '0px',
        right: '0px',
        bottom: '0px',
        left: '0px',
      };
      const pdfPageSize = {
        width: `${REPORT_LAYOUT.PAGE_WIDTH_MM}mm`,
        height: `${REPORT_LAYOUT.PAGE_HEIGHT_MM}mm`,
      };
      const pdfTimeout = () => Math.max(5000, MAX_GENERATION_TIME_MS - (Date.now() - startTime));

      let pdfBuffer: Buffer;

      if (!logoForFooter) {
        pdfBuffer = Buffer.from(
          await page.pdf({
            ...pdfPageSize,
            printBackground: true,
            preferCSSPageSize: true,
            margin: pdfMargin,
            timeout: pdfTimeout(),
          })
        );
      } else {
        const fullPdf = Buffer.from(
          await page.pdf({
            ...pdfPageSize,
            printBackground: true,
            preferCSSPageSize: true,
            margin: pdfMargin,
            timeout: pdfTimeout(),
          })
        );
        const pageCount = await countPdfPages(fullPdf);
        if (pageCount <= 1) {
          pdfBuffer = fullPdf;
          logger.info('📄 PDF footer logo: single page, no footer strip');
        } else {
          const coverPdf = await pdfExtractFirstPage(fullPdf);
          const restPdf = Buffer.from(
            await page.pdf({
              ...pdfPageSize,
              printBackground: true,
              preferCSSPageSize: true,
              margin: pdfMargin,
              pageRanges: `2-${pageCount}`,
              displayHeaderFooter: true,
              headerTemplate:
                '<div style="font-size:1px;height:0;padding:0;margin:0;"></div>',
              footerTemplate: buildPuppeteerFooterTemplate(logoForFooter),
              timeout: pdfTimeout(),
            })
          );
          pdfBuffer = await pdfMergeBuffers([coverPdf, restPdf]);
          logger.info('📄 PDF footer logo: merged cover + pages 2–last with footer', {
            pageCount,
            restPages: pageCount - 1,
          });
        }
      }
      
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
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 50);
      
      // Format date range for filename (DD.MM.YYYY-DD.MM.YYYY)
      const formatDateForFilename = (dateString: string) => {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
      };
      
      const startDate = formatDateForFilename(reportData.dateRange.start);
      const endDate = formatDateForFilename(reportData.dateRange.end);
      const okresRaportu = `${startDate}-${endDate}`;
    
      const filename = `Raport Reklamowy PBM - ${sanitizedClientName} - ${okresRaportu}.pdf`;
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
          error: 'Failed to generate PDF',
          details: puppeteerError instanceof Error ? puppeteerError.message : 'Unknown PDF generation error',
          isTimeout: isTimeoutError,
          suggestion: isTimeoutError 
            ? 'The PDF generation timed out. This may be due to complex content or server load. Please try again.' 
            : 'PDF generation failed. Please try again or contact support if the issue persists.'
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
