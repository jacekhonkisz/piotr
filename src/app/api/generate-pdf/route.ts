import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import { ExecutiveSummaryCacheService } from '../../../lib/executive-summary-cache';

import { convertMetaCampaignToUnified, convertGoogleCampaignToUnified, calculatePlatformTotals, UnifiedCampaign, PlatformTotals } from '../../../lib/unified-campaign-types';
import logger from '../../../lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ReportData {
  client: {
    id: string;
    name: string;
    email: string;
    ad_account_id: string;
    logo_url?: string;
  };
  dateRange: {
    start: string;
    end: string;
  };
  campaigns: any[];
  totals: {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    cpc: number;
    cpm: number;
  };
  // Google Ads integration
  googleCampaigns?: UnifiedCampaign[];
  metaCampaigns?: UnifiedCampaign[];
  platformTotals?: {
    meta: PlatformTotals;
    google: PlatformTotals;
    combined: PlatformTotals;
  };
  previousMonthTotals?: {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    cpc: number;
    cpm: number;
  };
  previousMonthConversions?: {
    click_to_call: number;
    email_contacts: number;
    booking_step_1: number;
    reservations: number;
    reservation_value: number;
    booking_step_2: number;
  };
  previousWeekTotals?: {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    cpc: number;
    cpm: number;
  };
  previousWeekConversions?: {
    click_to_call: number;
    email_contacts: number;
    booking_step_1: number;
    reservations: number;
    reservation_value: number;
    booking_step_2: number;
  };
  reportType?: 'weekly' | 'monthly' | 'custom';
  platform?: 'meta' | 'google'; // Add platform information for HTML generation
  previousYearTotals?: {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    cpc: number;
    cpm: number;
  };
  previousYearConversions?: {
    click_to_call: number;
    email_contacts: number;
    booking_step_1: number;
    reservations: number;
    reservation_value: number;
    booking_step_2: number;
  };
  metaTables?: {
    placementPerformance: any[];
    demographicPerformance: any[];
    adRelevanceResults: any[];
  };
  googleAdsTables?: {
    networkPerformance: any[];
    devicePerformance: any[];
    keywordPerformance: any[];
    qualityMetrics: any[];
  };
  googleAdsDemographics?: any[];
  executiveSummary?: string | undefined;
}

function generatePDFHTML(reportData: ReportData): string {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Calculate conversion metrics from campaigns (moved to top for cover KPIs)
  const conversionMetrics = reportData.campaigns.reduce((acc, campaign) => {
    return {
      click_to_call: acc.click_to_call + (campaign.click_to_call || 0),
      email_contacts: acc.email_contacts + (campaign.email_contacts || 0),
      booking_step_1: acc.booking_step_1 + (campaign.booking_step_1 || 0),
      reservations: acc.reservations + (campaign.reservations || 0),
      reservation_value: acc.reservation_value + (campaign.reservation_value || 0),
      booking_step_2: acc.booking_step_2 + (campaign.booking_step_2 || 0)
    };
  }, {
    click_to_call: 0,
    email_contacts: 0,
    booking_step_1: 0,
    reservations: 0,
    reservation_value: 0,
    booking_step_2: 0
  });

  const calculatePercentageChange = (current: number, previous: number): number => {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  const formatPercentageChange = (change: number): string => {
    const sign = change > 0 ? '+' : '';
    const className = change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral';
    const arrow = change > 0 ? '↗' : change < 0 ? '↘' : '→';
    return `<span class="stat-comparison ${className}">${arrow} ${sign}${change.toFixed(1)}%</span>`;
  };

  const formatStatValue = (current: any, previous?: number, formatter?: (val: number) => string): string => {
    const formattedCurrent = formatter ? formatter(current) : current.toString();
    
    // Determine if we have comparison data and what type it is
    const hasWeeklyComparison = reportData.reportType === 'weekly' && reportData.previousMonthTotals;
    const hasMonthlyComparison = reportData.reportType === 'monthly' && reportData.previousMonthTotals;
    const hasCustomComparison = reportData.reportType === 'custom' && reportData.previousMonthTotals;
    const hasComparison = hasWeeklyComparison || hasMonthlyComparison || hasCustomComparison;
    
    if (previous !== undefined && hasComparison) {
      const change = calculatePercentageChange(current, previous);
      return `
        <div class="stat-value">
          <span class="stat-main-value">${formattedCurrent}</span>
          ${formatPercentageChange(change)}
        </div>
      `;
    }
    
    return `<span class="stat-value">${formattedCurrent}</span>`;
  };

  const formatConversionValue = (current: number, previous?: number, formatter?: (val: number) => string): string => {
    if (current > 0) {
      return formatStatValue(current, previous, formatter);
    } else {
      return `<span class="stat-not-configured">— <span class="stat-tooltip">i</span></span>`;
    }
  };









  // Generate summary section
  const generateSummarySection = (): string => {
    const summaryParts = [];
    
    // Build summary based on combined platform data
    const periodLabel = reportData.reportType === 'weekly' ? 'tygodniu' : 'miesiącu';
    const startDate = formatDate(reportData.dateRange.start);
    const endDate = formatDate(reportData.dateRange.end);
    
    // Use combined platform totals if available, otherwise fall back to Meta-only data
    const combinedSpend = reportData.platformTotals ? reportData.platformTotals.combined.totalSpend : totalSpend;
    const combinedImpressions = reportData.platformTotals ? reportData.platformTotals.combined.totalImpressions : totalImpressions;
    const combinedClicks = reportData.platformTotals ? reportData.platformTotals.combined.totalClicks : totalClicks;
    const combinedReservations = reportData.platformTotals ? reportData.platformTotals.combined.totalReservations : conversionMetrics.reservations;
    const combinedCtr = reportData.platformTotals ? reportData.platformTotals.combined.averageCtr : ctr;
    const combinedCpc = reportData.platformTotals ? reportData.platformTotals.combined.averageCpc : cpc;
    
    // Determine data source for summary
    const dataSource = reportData.platformTotals ? 'Meta Ads i Google Ads' : 'Meta Ads';
    
    summaryParts.push(`W ${periodLabel} od ${startDate} do ${endDate} wydaliśmy na kampanie reklamowe ${formatCurrency(combinedSpend)}.`);
    
    if (combinedImpressions > 0) {
      summaryParts.push(`Działania te zaowocowały ${formatNumber(combinedImpressions)} wyświetleniami`);
      if (combinedClicks > 0) {
        summaryParts.push(`a liczba kliknięć wyniosła ${formatNumber(combinedClicks)}, co dało CTR na poziomie ${formatPercentage(combinedCtr)}.`);
        summaryParts.push(`Średni koszt kliknięcia (CPC) wyniósł ${formatCurrency(combinedCpc)}.`);
      } else {
        summaryParts.push('.');
      }
    }
    
    if (combinedReservations > 0) {
      const costPerReservation = combinedSpend > 0 ? combinedSpend / combinedReservations : 0;
      summaryParts.push(`W tym okresie zaobserwowaliśmy ${formatNumber(combinedReservations)} konwersje, co przekłada się na koszt pozyskania konwersji (CPA) na poziomie ${formatCurrency(costPerReservation)}.`);
      if (conversionMetrics.reservation_value > 0) {
        summaryParts.push(`Wszystkie konwersje to rezerwacje, dzięki czemu koszt pozyskania rezerwacji również wyniósł ${formatCurrency(costPerReservation)}.`);
      }
    }
    
    // Add data source information
    summaryParts.push(`Dane zostały pobrane z ${dataSource}.`);
    
    return summaryParts.join(' ');
  };

  // Polish number formatting
  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return '0,00 zł';
    return `${value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, '\u00A0')} zł`;
  };

  const formatNumber = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return '0';
    return value.toLocaleString('pl-PL').replace(/\s/g, '\u00A0');
  };



  const formatPercentage = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return '0,00%';
    return `${value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, '\u00A0')}%`;
  };

  // Calculate metrics with safety checks
  const totalSpend = reportData.totals.spend || 0;
  const totalImpressions = reportData.totals.impressions || 0;
  const totalClicks = reportData.totals.clicks || 0;
  const totalConversions = reportData.totals.conversions || 0;
  const ctr = reportData.totals.ctr || 0;
  const cpc = reportData.totals.cpc || 0;
  const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
  const reach = totalImpressions > 0 ? Math.round(totalImpressions / 1.5) : 0;



  // Calculate derived conversion metrics
  const roas = totalSpend > 0 && conversionMetrics.reservation_value > 0 
    ? conversionMetrics.reservation_value / totalSpend 
    : 0;
  const cost_per_reservation = conversionMetrics.reservations > 0 
    ? totalSpend / conversionMetrics.reservations 
    : 0;



  // Helper function for grouping and top N processing
  const groupAndTopN = (rows: any[], config: any) => {
    if (!rows || rows.length === 0) return [];
    
    const { groupBy, sum, derive, limit } = config;
    const groupMap = new Map();
    
    rows.forEach((item: any) => {
      const key = item[groupBy] || 'Inne';
      
      // Clean up placement names
      let cleanKey = key;
      if (groupBy === 'placement') {
        if (key.toLowerCase().includes('facebook')) cleanKey = 'Facebook Feed';
        else if (key.toLowerCase().includes('instagram') && !key.toLowerCase().includes('story') && !key.toLowerCase().includes('reels')) cleanKey = 'Instagram Feed';
        else if (key.toLowerCase().includes('story') || key.toLowerCase().includes('stories')) cleanKey = 'Instagram Stories';
        else if (key.toLowerCase().includes('reels')) cleanKey = 'Instagram Reels';
        else if (key.toLowerCase().includes('audience')) cleanKey = 'Audience Network';
        else if (key.toLowerCase().includes('messenger')) cleanKey = 'Messenger';
        else if (key === 'Unknown' || !key) cleanKey = 'Inne';
      }
      
      if (groupMap.has(cleanKey)) {
        const existing = groupMap.get(cleanKey);
        sum.forEach((field: string) => {
          existing[field] = (existing[field] || 0) + (item[field] || 0);
        });
      } else {
        const newEntry: any = { [groupBy]: cleanKey };
        sum.forEach((field: string) => {
          newEntry[field] = item[field] || 0;
        });
        groupMap.set(cleanKey, newEntry);
      }
    });
    
    // Calculate derived metrics
    let result = Array.from(groupMap.values()).map((item: any) => {
      const enhanced = { ...item };
      if (derive) {
        Object.entries(derive).forEach(([field, formula]) => {
          if (formula === 'clicks/impressions') {
            enhanced[field] = item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0;
          } else if (formula === 'spend/clicks') {
            enhanced[field] = item.clicks > 0 ? item.spend / item.clicks : 0;
          } else if (formula === 'spend/conversions') {
            enhanced[field] = totalConversions > 0 ? item.spend / totalConversions : 0;
          }
        });
      }
      return enhanced;
    });
    
    // Sort by spend and limit
    result = result.sort((a: any, b: any) => (b.spend || 0) - (a.spend || 0));
    
    if (limit && result.length > limit) {
      const topN = result.slice(0, limit);
      const remaining = result.slice(limit);
      
      if (remaining.length > 0) {
        const totalRemaining = remaining.reduce((acc: any, item: any) => ({
          [groupBy]: `Pozostałe ${remaining.length} pozycji`,
          spend: acc.spend + (item.spend || 0),
          impressions: acc.impressions + (item.impressions || 0),
          clicks: acc.clicks + (item.clicks || 0),
          ctr: 0, // Will be recalculated
          cpc: 0, // Will be recalculated
          cpa: 0  // Will be recalculated
        }), { spend: 0, impressions: 0, clicks: 0 });
        
        // Recalculate derived metrics for the aggregate
        totalRemaining.ctr = totalRemaining.impressions > 0 ? (totalRemaining.clicks / totalRemaining.impressions) * 100 : 0;
        totalRemaining.cpc = totalRemaining.clicks > 0 ? totalRemaining.spend / totalRemaining.clicks : 0;
        totalRemaining.cpa = totalConversions > 0 ? totalRemaining.spend / totalConversions : 0;
        
        topN.push(totalRemaining);
      }
      
      return topN;
    }
    
    return result;
  };

  // Process meta data for placement performance (aggregated and cleaned)
  const processPlacementData = () => {
    if (!reportData.metaTables?.placementPerformance) return [];
    
    return groupAndTopN(reportData.metaTables.placementPerformance, {
      groupBy: 'placement',
      sum: ['spend', 'impressions', 'clicks'],
      derive: {
        ctr: 'clicks/impressions',
        cpc: 'spend/clicks', 
        cpa: 'spend/conversions'
      },
      limit: 10
    });
  };

  // Process demographic data for charts with conversion metrics - PRODUCTION READY
  const processDemographicData = () => {
    logger.info('🔍 PDF: Processing demographic data...', {
      hasMetaTables: !!reportData.metaTables,
      hasDemographicData: !!reportData.metaTables?.demographicPerformance,
      demographicCount: reportData.metaTables?.demographicPerformance?.length || 0,
      sampleData: reportData.metaTables?.demographicPerformance?.slice(0, 2)
    });
    
    // Robust validation
    if (!reportData.metaTables?.demographicPerformance || 
        !Array.isArray(reportData.metaTables.demographicPerformance) ||
        reportData.metaTables.demographicPerformance.length === 0) {
      logger.info('⚠️ PDF: No demographic data available for PDF generation');
      return { gender: [], age: [] };
    }
    
    // Log all demographic data for debugging (production safe)
    logger.info('📊 PDF: Raw demographic data count:', reportData.metaTables.demographicPerformance.length);
    logger.info('📊 PDF: Sample demographic record:', reportData.metaTables.demographicPerformance[0]);
    
    const genderMap = new Map();
    const ageMap = new Map();
    
    reportData.metaTables.demographicPerformance.forEach((item, index) => {
      try {
        // Robust data validation
        if (!item || typeof item !== 'object') {
          logger.warn(`⚠️ PDF: Invalid demographic item at index ${index}:`, item);
          return;
        }

        // Gender aggregation with conversion metrics
        const gender = item.gender === 'male' ? 'Mężczyźni' : 
                      item.gender === 'female' ? 'Kobiety' : 'Nieznana';
      
      if (genderMap.has(gender)) {
        const existing = genderMap.get(gender);
        existing.impressions += (item.impressions || 0);
        existing.clicks += (item.clicks || 0);
        existing.reservations += (item.reservations || 0);
        existing.reservation_value += (item.reservation_value || 0);
        existing.booking_step_1 += (item.booking_step_1 || 0);
        existing.spend += (item.spend || 0);
      } else {
        genderMap.set(gender, {
          gender,
          impressions: item.impressions || 0,
          clicks: item.clicks || 0,
          reservations: item.reservations || 0,
          reservation_value: item.reservation_value || 0,
          booking_step_1: item.booking_step_1 || 0,
          spend: item.spend || 0,
          roas: 0 // Will be calculated after aggregation
        });
      }
      
      // Age aggregation with conversion metrics
      const age = item.age || 'Nieznany';
      if (ageMap.has(age)) {
        const existing = ageMap.get(age);
        existing.impressions += (item.impressions || 0);
        existing.clicks += (item.clicks || 0);
        existing.reservations += (item.reservations || 0);
        existing.reservation_value += (item.reservation_value || 0);
        existing.booking_step_1 += (item.booking_step_1 || 0);
        existing.spend += (item.spend || 0);
      } else {
        ageMap.set(age, {
          age,
          impressions: item.impressions || 0,
          clicks: item.clicks || 0,
          reservations: item.reservations || 0,
          reservation_value: item.reservation_value || 0,
          booking_step_1: item.booking_step_1 || 0,
          spend: item.spend || 0,
          roas: 0 // Will be calculated after aggregation
        });
      }
      } catch (error) {
        logger.error(`❌ PDF: Error processing demographic item at index ${index}:`, error, item);
      }
    });
    
    // Calculate ROAS for aggregated data with fallback to conversion value
    const calculateROAS = (item: any) => {
      if (item.spend > 0) {
        if (item.reservation_value > 0) {
          // Use actual purchase value if available
          item.roas = item.reservation_value / item.spend;
        } else if (item.booking_step_1 > 0) {
          // Fallback: Estimate value based on booking funnel engagement
          // Assume each booking step 1 has potential value (conservative estimate)
          const estimatedValue = item.booking_step_1 * 50; // 50 PLN estimated value per booking initiation
          item.roas = estimatedValue / item.spend;
        } else {
          item.roas = 0;
        }
      } else {
        item.roas = 0;
      }
      return item;
    };
    
    const result = {
      gender: Array.from(genderMap.values()).map(calculateROAS),
      age: Array.from(ageMap.values()).map(calculateROAS).sort((a, b) => {
        const ageA = parseInt(a.age.split('-')[0]) || 999;
        const ageB = parseInt(b.age.split('-')[0]) || 999;
        return ageA - ageB;
      })
    };
    
    // Comprehensive logging for production debugging
    const genderTotals = result.gender.reduce((acc, item) => ({
      spend: acc.spend + item.spend,
      impressions: acc.impressions + item.impressions,
      clicks: acc.clicks + item.clicks,
      reservations: acc.reservations + item.reservations,
      reservation_value: acc.reservation_value + item.reservation_value,
      booking_step_1: acc.booking_step_1 + item.booking_step_1
    }), { spend: 0, impressions: 0, clicks: 0, reservations: 0, reservation_value: 0, booking_step_1: 0 });

    const ageTotals = result.age.reduce((acc, item) => ({
      spend: acc.spend + item.spend,
      impressions: acc.impressions + item.impressions,
      clicks: acc.clicks + item.clicks,
      reservations: acc.reservations + item.reservations,
      reservation_value: acc.reservation_value + item.reservation_value,
      booking_step_1: acc.booking_step_1 + item.booking_step_1
    }), { spend: 0, impressions: 0, clicks: 0, reservations: 0, reservation_value: 0, booking_step_1: 0 });

    logger.info('✅ PDF: Processed demographic data successfully', {
      genderCount: result.gender.length,
      ageCount: result.age.length,
      genderTotals,
      ageTotals,
      hasReservationValue: genderTotals.reservation_value > 0,
      hasBookingEngagement: genderTotals.booking_step_1 > 0,
      willShowDemographics: result.gender.length > 0 || result.age.length > 0
    });
    
    return result;
  };

  // Google Ads demographics removed - API does not support demographic data retrieval
  // Confirmed through comprehensive testing of all available resources and segments

  const placementData = processPlacementData();
  const demographicData = processDemographicData();
  const topAds = reportData.metaTables?.adRelevanceResults?.slice(0, 10) || [];

  // Helper function to generate demographic data table with conversion metrics
  const generateDemographicTable = (data: any[], metric: 'roas' | 'reservations' | 'reservation_value' | 'booking_step_1') => {
    if (!data || data.length === 0) return '';
    
    const getMetricLabel = (metric: string) => {
      switch(metric) {
        case 'roas': return 'ROAS';
        case 'reservations': return 'Rezerwacje';
        case 'reservation_value': return 'Wartość';
        case 'booking_step_1': return 'Zaangażowanie';
        default: return 'Wartość';
      }
    };

    const formatMetricValue = (value: number, metric: string) => {
      switch(metric) {
        case 'roas': return `${(value || 0).toFixed(2)}x`; // Always show numeric value, even if 0
        case 'reservations': return value.toLocaleString('pl-PL');
        case 'reservation_value': return formatCurrency(value);
        case 'booking_step_1': return value.toLocaleString('pl-PL');
        default: return value.toLocaleString('pl-PL');
      }
    };
    
    const total = data.reduce((sum, item) => sum + (item[metric] || 0), 0);
    
    return `
      <div style="margin-top: 16px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #f8f9fa; border-bottom: 1px solid #dee2e6;">
              <th style="padding: 8px; text-align: left; font-weight: 600;">Grupa</th>
              <th style="padding: 8px; text-align: right; font-weight: 600;">${getMetricLabel(metric)}</th>
              <th style="padding: 8px; text-align: right; font-weight: 600;">%</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(item => {
              const value = item[metric] || 0;
              // Calculate percentage for all metrics, including ROAS
              let percentage = '-';
              if (total > 0) {
                if (metric === 'roas') {
                  // For ROAS, show percentage of total ROAS contribution
                  percentage = ((value / total) * 100).toFixed(1);
                } else {
                  // For other metrics, show percentage of total
                  percentage = ((value / total) * 100).toFixed(1);
                }
              }
              const label = item.gender || item.age || 'Nieznana';
              return `
                <tr style="border-bottom: 1px solid #f1f3f4;">
                  <td style="padding: 6px 8px;">${label}</td>
                  <td style="padding: 6px 8px; text-align: right; font-weight: 500;">${formatMetricValue(value, metric)}</td>
                  <td style="padding: 6px 8px; text-align: right; color: #6b7280;">${percentage}${percentage !== '-' ? '%' : ''}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Raport Meta Ads — ${reportData.client.name}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            
            :root {
                --bg-page: #F7F8FB;
                --bg-panel: #FFFFFF;
                --text-strong: #0B1324;
                --text-muted: #6B7280;
                --brand-primary: #3B82F6;
                --brand-accent: #FF7A00;
                --border-soft: #E6E9EF;
            }
            
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
                line-height: 1.5;
                color: var(--text-strong);
                background: var(--bg-page);
                font-size: 16px;
                -webkit-font-smoothing: antialiased;
                margin: 0;
                padding: 0;
                min-height: 100vh;
            }
            
            .container {
                max-width: 900px;
                margin: 0 auto;
                padding: 20px;
                min-height: 100vh;
                background: var(--bg-page);
            }
            
            /* Page 1 - Premium Cover */
            .cover-page {
                background: var(--bg-page);
                border-radius: 16px;
                padding: 20px;
                text-align: center;
                margin-bottom: 24px;
                min-height: 90vh;
                display: flex;
                flex-direction: column;
                justify-content: flex-start;
            }
            
            .logo-slot {
                position: relative;
                width: 120px;
                height: 120px;
                margin: 0 auto 20px auto;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                color: var(--text-muted);
            }
            
            .logo-image {
                width: 120px;
                height: 120px;
                object-fit: contain;
                margin: 0 auto 20px auto;
                display: block;
            }
            
            .cover-title {
                margin-bottom: 20px;
            }
            
            .cover-title h1 {
                font-size: 36px;
                font-weight: 700;
                color: var(--text-strong);
                margin-bottom: 12px;
                letter-spacing: -0.02em;
            }
            
            .cover-title h2 {
                font-size: 24px;
                font-weight: 600;
                color: var(--text-muted);
                margin-bottom: 10px;
            }
            
            .cover-meta {
                font-size: 14px;
                color: var(--text-muted);
                margin-bottom: 20px;
            }
            
            /* KPI Row for Cover */
            .cover-kpi-row {
                display: flex;
                justify-content: center;
                gap: 32px;
                flex-wrap: wrap;
                margin-bottom: 32px;
            }
            
            .cover-kpi {
                text-align: center;
                min-width: 120px;
            }
            
            .cover-kpi-value {
                font-size: 28px;
                font-weight: 700;
                color: var(--text-strong);
                display: block;
                margin-bottom: 8px;
            }
            
            .cover-kpi-label {
                font-size: 12px;
                color: var(--text-muted);
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }
            
            /* Executive Summary on Cover */
            .cover-summary {
                margin-top: 12px;
                text-align: left;
            }
            
            .cover-summary h3 {
                font-size: 20px;
                font-weight: 600;
                color: var(--text-strong);
                margin-bottom: 12px;
            }
            
            .summary-content {
                font-size: 16px;
                line-height: 1.4;
                color: var(--text-muted);
                max-width: 700px;
                margin: 0 auto;
            }
            
            .summary-content p {
                margin-bottom: 12px;
            }
            
            /* Year-over-Year Comparison Table */
            .year-comparison {
                margin-top: 20px;
                text-align: left;
            }
            
            .year-comparison h3 {
                font-size: 20px;
                font-weight: 600;
                color: var(--text-strong);
                margin-bottom: 12px;
                text-align: center;
            }
            
            .comparison-table {
                width: 100%;
                border-collapse: collapse;
                background: var(--bg-page);
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }
            
            .comparison-table th {
                background: var(--bg-page);
                color: var(--text-strong);
                padding: 12px 16px;
                text-align: center;
                font-weight: 600;
                font-size: 14px;
                border-bottom: 2px solid var(--border-soft);
            }
            
            .comparison-table td {
                padding: 12px 16px;
                border-bottom: 1px solid var(--border-soft);
                font-size: 14px;
                color: var(--text-strong);
                text-align: center;
            }
            
            .comparison-table tbody tr:nth-child(even) {
                background: #EDEEF2;
            }
            
            .comparison-table tbody tr:last-child td {
                border-bottom: none;
            }
            
            .metric-name {
                font-weight: 600;
                color: var(--text-strong);
                text-align: left !important;
import logger from '../../../lib/logger';
            }
            
            .current-year {
                font-weight: 600;
                color: var(--brand-primary);
            }
            
            .previous-year {
                font-weight: 500;
                color: var(--text-muted);
            }
            
            .year-change {
                font-weight: 600;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
            }
            
            .year-change.positive {
                color: #10B981;
            }
            
            .year-change.negative {
                color: #EF4444;
            }
            
            .year-change.neutral {
                color: var(--text-muted);
            }
            
            .current-period {
                font-weight: 600;
                color: var(--brand-primary);
            }
            
            .previous-period {
                font-weight: 500;
                color: var(--text-muted);
            }
            
            .period-change {
                font-weight: 600;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
            }
            
            .period-change.positive {
                color: #10B981;
            }
            
            .period-change.negative {
                color: #EF4444;
            }
            
            .period-change.neutral {
                color: var(--text-muted);
            }
            
            .period-comparison {
                margin-top: 24px;
            }
            
            .period-comparison h3 {
                font-size: 20px;
                font-weight: 600;
                color: var(--text-strong);
                margin-bottom: 12px;
                text-align: center;
            }
            
            /* KPI Overview Section */
            .kpi-overview {
                background: var(--bg-page);
                border-radius: 16px;
                padding: 32px;
                margin-bottom: 24px;
            }
            
            /* Section Styles */
            .section {
                margin-bottom: 32px;
            }
            
            .section-title {
                font-size: 20px;
                font-weight: 600;
                color: var(--text-strong);
                margin-bottom: 16px;
                letter-spacing: -0.01em;
            }
            
            /* Page 2 - Metrics Layout */
            .metrics-page {
                background: var(--bg-page);
                border-radius: 16px;
                padding: 32px;
                margin-bottom: 48px;
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 48px;
            }
            
            .metrics-column {
                display: flex;
                flex-direction: column;
            }
            
            .metrics-column h3 {
                font-size: 18px;
                font-weight: 600;
                color: var(--text-strong);
                margin-bottom: 24px;
            }
            
            /* Stat List Component */
            .stat-list {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }
            
            .stat-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 0;
                border-bottom: 1px solid var(--border-soft);
            }
            
            .stat-item:last-child {
                border-bottom: none;
            }
            
            .stat-label {
                font-size: 14px;
                color: var(--text-muted);
                font-weight: 500;
            }
            
            .stat-value {
                font-size: 16px;
                font-weight: 600;
                color: var(--text-strong);
                text-align: right;
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 2px;
            }
            
            .stat-main-value {
                font-size: 16px;
                font-weight: 600;
                color: var(--text-strong);
            }
            
            .stat-comparison {
                font-size: 12px;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 2px;
            }
            
            .stat-comparison.positive {
                color: #10B981; /* Green */
            }
            
            .stat-comparison.negative {
                color: #EF4444; /* Red */
            }
            
            .stat-comparison.neutral {
                color: var(--text-muted);
            }
            
            .comparison-period {
                font-size: 10px;
                color: var(--text-muted);
                font-weight: 400;
                display: block;
                margin-top: 2px;
            }
            
            .stat-not-configured {
                color: var(--text-muted);
                font-style: italic;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            
            .stat-tooltip {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: var(--text-muted);
                color: white;
                font-size: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
            }
            
            /* Tables */
            .table-container {
                background: var(--bg-page);
                border-radius: 16px;
                overflow: hidden;
                margin-bottom: 16px;
                page-break-inside: auto;
            }
            
            .data-table {
                width: 100%;
                border-collapse: collapse;
            }
            
            .data-table th {
                background: var(--bg-page);
                color: var(--text-strong);
                padding: 16px 20px;
                text-align: left;
                font-weight: 600;
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                border-bottom: 1px solid var(--border-soft);
            }
            
            .data-table td {
                padding: 16px 20px;
                border-bottom: 1px solid var(--border-soft);
                font-size: 14px;
                color: var(--text-strong);
            }
            
            .data-table tr:nth-child(even) {
                background: #EDEEF2;
            }
            
            .data-table tr:last-child td {
                border-bottom: none;
            }
            
            /* Demographics Charts */
            .chart-container {
                background: var(--bg-page);
                border-radius: 16px;
                padding: 32px;
                margin-bottom: 32px;
            }
            
            .chart-title {
                font-size: 16px;
                font-weight: 600;
                color: var(--text-strong);
                margin-bottom: 24px;
            }
            
            .charts-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 32px;
                margin-bottom: 24px;
            }
            
            .chart-section {
                text-align: center;
            }
            
            .chart-section h4 {
                font-size: 14px;
                font-weight: 500;
                color: var(--text-muted);
                margin-bottom: 16px;
            }
            
            /* Footer */
            .footer {
                text-align: center;
                padding: 24px 0;
                border-top: 1px solid var(--border-soft);
                color: var(--text-muted);
                font-size: 12px;
                margin-top: 48px;
            }
            
            /* Methodology */
            .methodology {
                background: var(--bg-page);
                border-radius: 16px;
                padding: 24px;
                border: 1px solid var(--border-soft);
            }
            
            .methodology h3 {
                font-size: 16px;
                font-weight: 600;
                color: var(--text-strong);
                margin-bottom: 16px;
            }
            
            .methodology p {
                font-size: 14px;
                color: var(--text-muted);
                margin-bottom: 8px;
                line-height: 1.6;
            }
            
            /* Page break utilities */
            .page-break-before {
                page-break-before: always;
            }
            
            .page-break-after {
                page-break-after: always;
            }
            

            
            /* Page breaks and print optimization */
            @media print {
                body { 
                    background: var(--bg-page) !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }
                .container { 
                    padding: 20px !important;
                    margin: 0 !important;
                    max-width: none !important;
                    width: 100% !important;
                    min-height: 100vh !important;
                    background: var(--bg-page) !important;
                }
                
                /* Allow sections to break but keep titles with content */
                .section-title { page-break-after: avoid; }
                .table-container { page-break-inside: auto; }
                .data-table thead { 
                    display: table-header-group; 
                    page-break-after: avoid;
                }
                
                /* Keep table headers with at least some rows */
                .data-table thead tr { page-break-inside: avoid; page-break-after: avoid; }
                .data-table tbody tr { page-break-inside: avoid; }
                
                /* Prevent orphaned headers */
                .data-table thead { break-after: avoid; }
            }
            
            @page {
                size: A4;
                margin: 0;
                background: var(--bg-page);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <!-- Page 1 - Premium Cover -->
            <div class="cover-page">
                ${reportData.client.logo_url 
                  ? `<img src="${reportData.client.logo_url}" alt="${reportData.client.name} logo" class="logo-image" />`
                  : '<div class="logo-slot">Logo</div>'
                }
                
                <div class="cover-title">
                    <h1>Raport Reklamowy — ${reportData.client.name}</h1>
                    <h2>${formatDate(reportData.dateRange.start)} – ${formatDate(reportData.dateRange.end)}</h2>
                </div>
                
                <div class="cover-meta">
Źródło: Meta Ads API & Google Ads API • Wygenerowano: ${new Date().toLocaleDateString('pl-PL')} ${new Date().toLocaleTimeString('pl-PL')}
                </div>
                
                <!-- Executive Summary -->
                <div class="cover-summary">
                    <h3>Podsumowanie</h3>
                    <div class="summary-content">
                        ${reportData.executiveSummary ? reportData.executiveSummary.trim() : generateSummarySection()}
                    </div>
                </div>
                

            </div>



                        <!-- Page 2 - Year-over-Year Comparison & Platform Performance -->
            <div style="page-break-before: always; padding: 40px; width: 100%; box-sizing: border-box; font-family: Arial, sans-serif;">
                
                <!-- Year-over-Year Comparison - At Top of Page 2 -->
                <div style="margin-bottom: 40px; padding: 30px; background: #f8f9fa; border-radius: 12px;">
                    <h2 style="text-align: center; margin-bottom: 30px; color: #333; font-size: 28px; font-weight: 600;">Porównanie okresów do poprzedniego roku</h2>
                    
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                        <thead>
                            <tr style="background: #e9ecef;">
                                <th style="padding: 15px; text-align: left; border: 1px solid #dee2e6; font-weight: 600; color: #495057;">Platforma / Metryka</th>
                                <th style="padding: 15px; text-align: center; border: 1px solid #dee2e6; font-weight: 600; color: #495057;">2025</th>
                                <th style="padding: 15px; text-align: center; border: 1px solid #dee2e6; font-weight: 600; color: #495057;">2024</th>
                                <th style="padding: 15px; text-align: center; border: 1px solid #dee2e6; font-weight: 600; color: #495057;">Zmiana</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reportData.platform === 'meta' ? `
                            <!-- Meta Ads Section -->
                            <tr style="background: #f0f8ff;">
                                <td colspan="4" style="padding: 12px 15px; border: 1px solid #dee2e6; font-weight: 600; color: #1877f2; text-align: center;">
                                    Meta Ads
                                </td>
                            </tr>
                            ` : ''}
                            ${reportData.platform === 'meta' ? `
                            <tr>
                                <td style="padding: 15px; padding-left: 30px; border: 1px solid #dee2e6; font-weight: 500;">Wydatki</td>
                                <td style="padding: 15px; text-align: center; border: 1px solid #dee2e6;">
                                    ${formatCurrency(reportData.platformTotals?.meta?.totalSpend || 0)}
                                </td>
                                <td style="padding: 15px; text-align: center; border: 1px solid #dee2e6; color: #6c757d;">
                                    ${reportData.previousYearTotals ? formatCurrency(reportData.previousYearTotals.spend) : 'Brak danych'}
                                </td>
                                <td style="padding: 15px; text-align: center; border: 1px solid #dee2e6;">
                                    ${reportData.previousYearTotals && reportData.previousYearTotals.spend > 0 ? 
                                        (() => {
                                            const current = reportData.platformTotals?.meta?.totalSpend || 0;
                                            const previous = reportData.previousYearTotals.spend;
                                            const change = ((current - previous) / previous) * 100;
                                            const arrow = change > 0 ? '↗' : change < 0 ? '↘' : '→';
                                            const sign = change > 0 ? '+' : '';
                                            const color = change > 0 ? '#28a745' : change < 0 ? '#dc3545' : '#6c757d';
                                            return `<span style="color: ${color};">${arrow} ${sign}${change.toFixed(1)}%</span>`;
                                        })() : '—'
                                    }
                                </td>
                            </tr>
                            ` : ''}
                            ${reportData.platform === 'meta' ? `
                            <tr>
                                <td style="padding: 15px; padding-left: 30px; border: 1px solid #dee2e6; font-weight: 500;">Rezerwacje</td>
                                <td style="padding: 15px; text-align: center; border: 1px solid #dee2e6;">
                                    ${reportData.platformTotals?.meta?.totalReservations || 0}
                                </td>
                                <td style="padding: 15px; text-align: center; border: 1px solid #dee2e6; color: #6c757d;">
                                    ${reportData.previousYearConversions ? reportData.previousYearConversions.reservations : 'Brak danych'}
                                </td>
                                <td style="padding: 15px; text-align: center; border: 1px solid #dee2e6;">
                                    ${reportData.previousYearConversions && reportData.previousYearConversions.reservations > 0 ? 
                                        (() => {
                                            const current = reportData.platformTotals?.meta?.totalReservations || 0;
                                            const previous = reportData.previousYearConversions.reservations;
                                            const change = ((current - previous) / previous) * 100;
                                            const arrow = change > 0 ? '↗' : change < 0 ? '↘' : '→';
                                            const sign = change > 0 ? '+' : '';
                                            const color = change > 0 ? '#28a745' : change < 0 ? '#dc3545' : '#6c757d';
                                            return `<span style="color: ${color};">${arrow} ${sign}${change.toFixed(1)}%</span>`;
                                        })() : '—'
                                    }
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 15px; padding-left: 30px; border: 1px solid #dee2e6; font-weight: 500;">Wartość rezerwacji</td>
                                <td style="padding: 15px; text-align: center; border: 1px solid #dee2e6;">
                                    ${formatCurrency(reportData.platformTotals?.meta?.totalReservationValue || 0)}
                                </td>
                                <td style="padding: 15px; text-align: center; border: 1px solid #dee2e6; color: #6c757d;">
                                    ${reportData.previousYearConversions ? formatCurrency(reportData.previousYearConversions.reservation_value) : 'Brak danych'}
                                </td>
                                <td style="padding: 15px; text-align: center; border: 1px solid #dee2e6;">
                                    ${reportData.previousYearConversions && reportData.previousYearConversions.reservation_value > 0 ? 
                                    (() => {
                                            const current = reportData.platformTotals?.meta?.totalReservationValue || 0;
                                            const previous = reportData.previousYearConversions.reservation_value;
                                            const change = ((current - previous) / previous) * 100;
                                            const arrow = change > 0 ? '↗' : change < 0 ? '↘' : '→';
                                            const sign = change > 0 ? '+' : '';
                                            const color = change > 0 ? '#28a745' : change < 0 ? '#dc3545' : '#6c757d';
                                            return `<span style="color: ${color};">${arrow} ${sign}${change.toFixed(1)}%</span>`;
                                        })() : '—'
                                    }
                                </td>
                            </tr>
                            ` : ''}
                            
                            ${reportData.platform === 'google' ? `
                            <!-- Google Ads Section -->
                            <tr style="background: #f0fff0;">
                                <td colspan="4" style="padding: 12px 15px; border: 1px solid #dee2e6; font-weight: 600; color: #34a853; text-align: center;">
                                    Google Ads
                                </td>
                            </tr>
                            ` : ''}
                            ${reportData.platform === 'google' ? `
                            <tr>
                                <td style="padding: 15px; padding-left: 30px; border: 1px solid #dee2e6; font-weight: 500;">Wydatki</td>
                                <td style="padding: 15px; text-align: center; border: 1px solid #dee2e6;">
                                    ${formatCurrency(reportData.platformTotals?.google?.totalSpend || 0)}
                                </td>
                                <td style="padding: 15px; text-align: center; border: 1px solid #dee2e6; color: #6c757d;">
                                    Brak danych*
                                </td>
                                <td style="padding: 15px; text-align: center; border: 1px solid #dee2e6;">
                                    —
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 15px; padding-left: 30px; border: 1px solid #dee2e6; font-weight: 500;">Rezerwacje</td>
                                <td style="padding: 15px; text-align: center; border: 1px solid #dee2e6;">
                                    ${reportData.platformTotals?.google?.totalReservations || 0}
                                </td>
                                <td style="padding: 15px; text-align: center; border: 1px solid #dee2e6; color: #6c757d;">
                                    Brak danych*
                                </td>
                                <td style="padding: 15px; text-align: center; border: 1px solid #dee2e6;">
                                    —
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 15px; padding-left: 30px; border: 1px solid #dee2e6; font-weight: 500;">Wartość rezerwacji</td>
                                <td style="padding: 15px; text-align: center; border: 1px solid #dee2e6;">
                                    ${formatCurrency(reportData.platformTotals?.google?.totalReservationValue || 0)}
                                </td>
                                <td style="padding: 15px; text-align: center; border: 1px solid #dee2e6; color: #6c757d;">
                                    Brak danych*
                                </td>
                                <td style="padding: 15px; text-align: center; border: 1px solid #dee2e6;">
                                    —
                                </td>
                            </tr>
                            ` : ''}
                        </tbody>
                    </table>
                    
                    <p style="text-align: center; color: #6c757d; font-size: 14px; margin-top: 20px;">
                        Porównanie wyników każdej platformy z analogicznym okresem roku poprzedniego<br/>
                        <span style="font-size: 12px;">* Dane Google Ads z roku poprzedniego będą dostępne po roku działania kampanii</span>
                    </p>
                    </div>

                ${reportData.platform === 'meta' ? `
                <!-- Meta Ads Header -->
                <h2 style="text-align: center; margin: 0 0 20px 0; color: #1877f2; font-size: 28px; font-weight: 600; width: 100%; display: block;">Meta Ads</h2>
                
                <!-- Two Column Layout for Meta Ads -->
                <div style="display: flex !important; flex-direction: row !important; gap: 40px; width: 100% !important; justify-content: space-between; margin: 0; padding: 0; box-sizing: border-box;">
                    <div style="flex: 1 !important; width: 48% !important; min-width: 0; margin: 0; padding: 0 10px; box-sizing: border-box;">
                        <h3 style="text-align: center; margin-bottom: 30px; font-size: 20px; color: #333; font-weight: 600;">Wydajność kampanii</h3>
                        <div style="margin: 0; padding: 0;">
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
                                <span style="font-weight: 500; color: #333;">Wydatki łączne</span>
                                <span style="font-weight: 600; color: #1877f2;">${formatStatValue(reportData.platformTotals?.meta?.totalSpend || 0, reportData.previousMonthTotals?.spend, formatCurrency)}</span>
                        </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
                                <span style="font-weight: 500; color: #333;">Wyświetlenia</span>
                                <span style="font-weight: 600; color: #1877f2;">${formatStatValue(reportData.platformTotals?.meta?.totalImpressions || 0, reportData.previousMonthTotals?.impressions, formatNumber)}</span>
                        </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
                                <span style="font-weight: 500; color: #333;">Kliknięcia</span>
                                <span style="font-weight: 600; color: #1877f2;">${formatStatValue(reportData.platformTotals?.meta?.totalClicks || 0, reportData.previousMonthTotals?.clicks, formatNumber)}</span>
                        </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
                                <span style="font-weight: 500; color: #333;">Zasięg</span>
                                <span style="font-weight: 600; color: #1877f2;">${formatStatValue(reportData.platformTotals?.meta?.totalImpressions ? Math.round((reportData.platformTotals.meta.totalImpressions) / 1.5) : 0, undefined, formatNumber)}</span>
                        </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
                                <span style="font-weight: 500; color: #333;">CTR</span>
                                <span style="font-weight: 600; color: #1877f2;">${formatStatValue(reportData.platformTotals?.meta?.totalClicks && reportData.platformTotals?.meta?.totalImpressions ? (reportData.platformTotals.meta.totalClicks / reportData.platformTotals.meta.totalImpressions) * 100 : 0, reportData.previousMonthTotals?.ctr, (val) => formatPercentage(val))}</span>
                        </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
                                <span style="font-weight: 500; color: #333;">CPC</span>
                                <span style="font-weight: 600; color: #1877f2;">${formatStatValue(reportData.platformTotals?.meta?.totalClicks && reportData.platformTotals?.meta?.totalClicks > 0 ? (reportData.platformTotals?.meta?.totalSpend || 0) / reportData.platformTotals.meta.totalClicks : 0, reportData.previousMonthTotals?.cpc, formatCurrency)}</span>
                        </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
                                <span style="font-weight: 500; color: #333;">CPM</span>
                                <span style="font-weight: 600; color: #1877f2;">${formatStatValue(reportData.platformTotals?.meta?.totalImpressions && reportData.platformTotals?.meta?.totalImpressions > 0 ? ((reportData.platformTotals?.meta?.totalSpend || 0) / reportData.platformTotals.meta.totalImpressions) * 1000 : 0, reportData.previousMonthTotals?.cpm, formatCurrency)}</span>
                        </div>
                    </div>
                </div>
                
                    <div style="flex: 1 !important; width: 48% !important; min-width: 0; margin: 0; padding: 0 10px; box-sizing: border-box;">
                        <h3 style="text-align: center; margin-bottom: 30px; font-size: 20px; color: #333; font-weight: 600;">Statystyki konwersji</h3>
                        <div style="margin: 0; padding: 0;">
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
                                <span style="font-weight: 500; color: #333;">Potencjalne kontakty – telefon</span>
                                <span style="font-weight: 600; color: #1877f2;">${formatConversionValue(reportData.platformTotals?.meta?.totalClickToCalls || 0, reportData.previousMonthConversions?.click_to_call, formatNumber)}</span>
                        </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
                                <span style="font-weight: 500; color: #333;">Potencjalne kontakty – e-mail</span>
                                <span style="font-weight: 600; color: #1877f2;">${formatConversionValue(reportData.platformTotals?.meta?.totalEmailContacts || 0, reportData.previousMonthConversions?.email_contacts, formatNumber)}</span>
                        </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
                                <span style="font-weight: 500; color: #333;">Kroki rezerwacji – Etap 1</span>
                                <span style="font-weight: 600; color: #1877f2;">${formatConversionValue(reportData.platformTotals?.meta?.totalBookingStep1 || 0, reportData.previousMonthConversions?.booking_step_1, formatNumber)}</span>
                        </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
                                <span style="font-weight: 500; color: #333;">Rezerwacje (zakończone)</span>
                                <span style="font-weight: 600; color: #1877f2;">${formatConversionValue(reportData.platformTotals?.meta?.totalReservations || 0, reportData.previousMonthConversions?.reservations, formatNumber)}</span>
                        </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
                                <span style="font-weight: 500; color: #333;">Wartość rezerwacji (zł)</span>
                                <span style="font-weight: 600; color: #1877f2;">${formatConversionValue(reportData.platformTotals?.meta?.totalReservationValue || 0, reportData.previousMonthConversions?.reservation_value, formatCurrency)}</span>
                        </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
                                <span style="font-weight: 500; color: #333;">ROAS (x)</span>
                                <span style="font-weight: 600; color: #1877f2;">${(reportData.platformTotals?.meta?.totalSpend || 0) > 0 && (reportData.platformTotals?.meta?.totalReservationValue || 0) > 0 ? 
                                formatStatValue((reportData.platformTotals?.meta?.totalReservationValue || 0) / (reportData.platformTotals?.meta?.totalSpend || 1), 
                                  reportData.previousMonthConversions?.reservation_value && reportData.previousMonthTotals?.spend 
                                    ? reportData.previousMonthConversions.reservation_value / reportData.previousMonthTotals.spend 
                                    : undefined, 
                                  (val) => `${val.toFixed(2)}x`) :
                                `<span class="stat-not-configured">— <span class="stat-tooltip">i</span></span>`
                                }</span>
                        </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
                                <span style="font-weight: 500; color: #333;">Koszt per rezerwacja (zł)</span>
                                <span style="font-weight: 600; color: #1877f2;">${(reportData.platformTotals?.meta?.totalReservations || 0) > 0 ? 
                                formatStatValue((reportData.platformTotals?.meta?.totalSpend || 0) / (reportData.platformTotals?.meta?.totalReservations || 1), 
                                  reportData.previousMonthConversions?.reservations && reportData.previousMonthTotals?.spend 
                                    ? reportData.previousMonthTotals.spend / reportData.previousMonthConversions.reservations 
                                    : undefined, 
                                  formatCurrency) :
                                `<span class="stat-not-configured">— <span class="stat-tooltip">i</span></span>`
                                }</span>
                        </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
                                <span style="font-weight: 500; color: #333;">Etap 2 rezerwacji</span>
                                <span style="font-weight: 600; color: #1877f2;">${formatConversionValue(reportData.platformTotals?.meta?.totalBookingStep2 || 0, reportData.previousMonthConversions?.booking_step_2, formatNumber)}</span>
                            </div>
                        </div>
                        </div>
                </div>
                </div>
            </div>
            ` : ''}
            
            ${reportData.platform === 'google' ? `
            <!-- Page 3 - Google Ads Performance & Conversion Metrics -->
            <div style="page-break-before: always; padding: 40px; width: 100%; box-sizing: border-box; font-family: Arial, sans-serif;">
                <!-- Google Ads Header -->
                <h2 style="text-align: center; margin: 0 0 20px 0; color: #34a853; font-size: 28px; font-weight: 600; width: 100%; display: block;">Google Ads</h2>
                
                <!-- Two Column Layout for Google Ads -->
                <div style="display: flex !important; flex-direction: row !important; gap: 40px; width: 100% !important; justify-content: space-between; margin: 0; padding: 0; box-sizing: border-box;">
                    <div style="flex: 1 !important; width: 48% !important; min-width: 0; margin: 0; padding: 0 10px; box-sizing: border-box;">
                        <h3 style="text-align: center; margin-bottom: 30px; font-size: 20px; color: #333; font-weight: 600;">Wydajność kampanii</h3>
                        <div style="margin: 0; padding: 0;">
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
                                <span style="font-weight: 500; color: #333;">Wydatki łączne</span>
                                <span style="font-weight: 600; color: #34a853;">${formatStatValue(reportData.platformTotals?.google?.totalSpend || 0, undefined, formatCurrency)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
                                <span style="font-weight: 500; color: #333;">Wyświetlenia</span>
                                <span style="font-weight: 600; color: #34a853;">${formatStatValue(reportData.platformTotals?.google?.totalImpressions || 0, undefined, formatNumber)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
                                <span style="font-weight: 500; color: #333;">Kliknięcia</span>
                                <span style="font-weight: 600; color: #34a853;">${formatStatValue(reportData.platformTotals?.google?.totalClicks || 0, undefined, formatNumber)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
                                <span style="font-weight: 500; color: #333;">Zasięg</span>
                                <span style="font-weight: 600; color: #34a853;">${formatStatValue(0, undefined, formatNumber)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
                                <span style="font-weight: 500; color: #333;">CTR</span>
                                <span style="font-weight: 600; color: #34a853;">${formatStatValue(reportData.platformTotals?.google?.totalClicks && reportData.platformTotals?.google?.totalImpressions ? (reportData.platformTotals.google.totalClicks / reportData.platformTotals.google.totalImpressions) * 100 : 0, undefined, (val) => formatPercentage(val))}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
                                <span style="font-weight: 500; color: #333;">CPC</span>
                                <span style="font-weight: 600; color: #34a853;">${formatStatValue(reportData.platformTotals?.google?.totalClicks && reportData.platformTotals?.google?.totalClicks > 0 ? (reportData.platformTotals?.google?.totalSpend || 0) / reportData.platformTotals.google.totalClicks : 0, undefined, formatCurrency)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
                                <span style="font-weight: 500; color: #333;">CPM</span>
                                <span style="font-weight: 600; color: #34a853;">${formatStatValue(reportData.platformTotals?.google?.totalImpressions && reportData.platformTotals?.google?.totalImpressions > 0 ? ((reportData.platformTotals?.google?.totalSpend || 0) / reportData.platformTotals.google.totalImpressions) * 1000 : 0, undefined, formatCurrency)}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div style="flex: 1 !important; width: 48% !important; min-width: 0; margin: 0; padding: 0 10px; box-sizing: border-box;">
                        <h3 style="text-align: center; margin-bottom: 30px; font-size: 20px; color: #333; font-weight: 600;">Statystyki konwersji</h3>
                        <div style="margin: 0; padding: 0;">
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
                                <span style="font-weight: 500; color: #333;">Potencjalne kontakty – telefon</span>
                                <span style="font-weight: 600; color: #34a853;">${formatConversionValue(reportData.platformTotals?.google?.totalPhoneCalls || 0, undefined, formatNumber)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
                                <span style="font-weight: 500; color: #333;">Potencjalne kontakty – e-mail</span>
                                <span style="font-weight: 600; color: #34a853;">${formatConversionValue(reportData.platformTotals?.google?.totalEmailContacts || 0, undefined, formatNumber)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
                                <span style="font-weight: 500; color: #333;">Kroki rezerwacji – Etap 1</span>
                                <span style="font-weight: 600; color: #34a853;">${formatConversionValue(reportData.platformTotals?.google?.totalBookingStep1 || 0, undefined, formatNumber)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
                                <span style="font-weight: 500; color: #333;">Rezerwacje (zakończone)</span>
                                <span style="font-weight: 600; color: #34a853;">${formatConversionValue(reportData.platformTotals?.google?.totalReservations || 0, undefined, formatNumber)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
                                <span style="font-weight: 500; color: #333;">Wartość rezerwacji (zł)</span>
                                <span style="font-weight: 600; color: #34a853;">${formatConversionValue(reportData.platformTotals?.google?.totalReservationValue || 0, undefined, formatCurrency)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
                                <span style="font-weight: 500; color: #333;">ROAS (x)</span>
                                <span style="font-weight: 600; color: #34a853;">${reportData.platformTotals?.google?.averageRoas && reportData.platformTotals?.google?.averageRoas > 0 ? 
                                    formatStatValue(reportData.platformTotals.google.averageRoas, undefined, (value) => `${value.toFixed(2)}x`) :
                                    `—`
                                }</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
                                <span style="font-weight: 500; color: #333;">Koszt per rezerwacja (zł)</span>
                                <span style="font-weight: 600; color: #34a853;">${reportData.platformTotals?.google?.totalReservations && reportData.platformTotals?.google?.totalReservations > 0 ? 
                                    formatStatValue((reportData.platformTotals?.google?.totalSpend || 0) / (reportData.platformTotals?.google?.totalReservations || 1), undefined, formatCurrency) :
                                    `—`
                                }</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e0e0e0;">
                                <span style="font-weight: 500; color: #333;">Etap 2 rezerwacji</span>
                                <span style="font-weight: 600; color: #34a853;">${formatConversionValue(reportData.platformTotals?.google?.totalBookingStep2 || 0, undefined, formatNumber)}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Google Ads Campaigns List - REMOVED: Duplicate section as requested -->
            </div>

                        <!-- Page 3 - Demographics (ROAS) -->
            ${demographicData.gender.length > 0 || demographicData.age.length > 0 ? `
            <div class="section page-break-before">
                <div class="chart-container">
                    <div class="chart-title">Demografia – ROAS</div>
                    
                    <!-- Meta Ads Demographics -->
                    <h4 style="margin-top: 20px; color: #1877f2; font-size: 16px;">Meta Ads</h4>
                    <div class="charts-grid">
                        ${demographicData.gender.length > 0 ? `
                        <div class="chart-section">
                            <h4>Podział według płci</h4>
                            <canvas id="genderROASChart" width="250" height="250"></canvas>
                            ${generateDemographicTable(demographicData.gender, 'roas')}
                        </div>
                        ` : `
                        <div class="chart-section">
                            <h4>Podział według płci</h4>
                            <div style="display: flex; align-items: center; justify-content: center; height: 250px; background: #f8f9fa; border: 2px dashed #dee2e6; border-radius: 8px; color: #6c757d; font-size: 14px;">
                                Brak danych demograficznych według płci
                            </div>
                        </div>
                        `}
                        ${demographicData.age.length > 0 ? `
                        <div class="chart-section">
                            <h4>Podział według grup wieku</h4>
                            <canvas id="ageROASChart" width="250" height="250"></canvas>
                            ${generateDemographicTable(demographicData.age, 'roas')}
                        </div>
                        ` : `
                        <div class="chart-section">
                            <h4>Podział według grup wieku</h4>
                            <div style="display: flex; align-items: center; justify-content: center; height: 250px; background: #f8f9fa; border: 2px dashed #dee2e6; border-radius: 8px; color: #6c757d; font-size: 14px;">
                                Brak danych demograficznych według wieku
                            </div>
                        </div>
                        `}
                    </div>
                    
                    <!-- Google Ads Demographics - Removed due to API limitations -->
                    <!-- Google Ads API does not provide demographic data for reporting purposes -->
                </div>
            </div>
            ` : `
            <div class="section page-break-before">
                <div class="chart-container">
                    <div class="chart-title">Demografia – ROAS</div>
                    <div style="text-align: center; padding: 40px; color: #6c757d;">
                        <p>Brak danych demograficznych dla tego okresu.</p>
                        <p style="font-size: 14px; margin-top: 8px;">Dane demograficzne będą dostępne po zebraniu wystarczającej liczby konwersji.</p>
                    </div>
                </div>
            </div>
            `}



            <!-- Page 4 - Demographics (Zaangażowanie) -->
            ${demographicData.gender.length > 0 || demographicData.age.length > 0 ? `
            <div class="section page-break-before">
                <div class="chart-container">
                    <div class="chart-title">Demografia – Zaangażowanie</div>
                    
                    <!-- Meta Ads Demographics -->
                    <h4 style="margin-top: 20px; color: #1877f2; font-size: 16px;">Meta Ads</h4>
                    <div class="charts-grid">
                        ${demographicData.gender.length > 0 ? `
                        <div class="chart-section">
                            <h4>Podział według płci</h4>
                            <canvas id="genderEngagementChart" width="250" height="250"></canvas>
                            ${generateDemographicTable(demographicData.gender, 'booking_step_1')}
                        </div>
                        ` : `
                        <div class="chart-section">
                            <h4>Podział według płci</h4>
                            <div style="display: flex; align-items: center; justify-content: center; height: 250px; background: #f8f9fa; border: 2px dashed #dee2e6; border-radius: 8px; color: #6c757d; font-size: 14px;">
                                Brak danych demograficznych według płci
                            </div>
                        </div>
                        `}
                        ${demographicData.age.length > 0 ? `
                        <div class="chart-section">
                            <h4>Podział według grup wieku</h4>
                            <canvas id="ageEngagementChart" width="250" height="250"></canvas>
                            ${generateDemographicTable(demographicData.age, 'booking_step_1')}
                        </div>
                        ` : `
                        <div class="chart-section">
                            <h4>Podział według grup wieku</h4>
                            <div style="display: flex; align-items: center; justify-content: center; height: 250px; background: #f8f9fa; border: 2px dashed #dee2e6; border-radius: 8px; color: #6c757d; font-size: 14px;">
                                Brak danych demograficznych według wieku
                            </div>
                        </div>
                        `}
                    </div>

                    <!-- Google Ads Demographics - Removed due to API limitations -->
                    <!-- Google Ads API does not provide demographic data for reporting purposes -->
                </div>
            </div>
            ` : `
            <div class="section">
                <div class="chart-container">
                    <div class="chart-title">Demografia – Zaangażowanie</div>
                    <div style="text-align: center; padding: 40px; color: #6c757d;">
                        <p>Brak danych demograficznych dla tego okresu.</p>
                        <p style="font-size: 14px; margin-top: 8px;">Dane demograficzne będą dostępne po zebraniu wystarczającej liczby konwersji.</p>
                    </div>
                </div>
            </div>
            `}

            <!-- Page 5 - Demographics (Wartość) -->
            ${demographicData.gender.length > 0 || demographicData.age.length > 0 ? `
            <div class="section page-break-before">
                <div class="chart-container">
                    <div class="chart-title">Demografia – Wartość</div>
                    
                    <!-- Meta Ads Demographics -->
                    <h4 style="margin-top: 20px; color: #1877f2; font-size: 16px;">Meta Ads</h4>
                    <div class="charts-grid">
                        ${demographicData.gender.length > 0 ? `
                        <div class="chart-section">
                            <h4>Podział według płci</h4>
                            <canvas id="genderValueChart" width="250" height="250"></canvas>
                            ${generateDemographicTable(demographicData.gender, 'reservation_value')}
                        </div>
                        ` : `
                        <div class="chart-section">
                            <h4>Podział według płci</h4>
                            <div style="display: flex; align-items: center; justify-content: center; height: 250px; background: #f8f9fa; border: 2px dashed #dee2e6; border-radius: 8px; color: #6c757d; font-size: 14px;">
                                Brak danych demograficznych według płci
                            </div>
                        </div>
                        `}
                        ${demographicData.age.length > 0 ? `
                        <div class="chart-section">
                            <h4>Podział według grup wieku</h4>
                            <canvas id="ageValueChart" width="250" height="250"></canvas>
                            ${generateDemographicTable(demographicData.age, 'reservation_value')}
                        </div>
                        ` : `
                        <div class="chart-section">
                            <h4>Podział według grup wieku</h4>
                            <div style="display: flex; align-items: center; justify-content: center; height: 250px; background: #f8f9fa; border: 2px dashed #dee2e6; border-radius: 8px; color: #6c757d; font-size: 14px;">
                                Brak danych demograficznych według wieku
                            </div>
                        </div>
                        `}
                    </div>

                    <!-- Google Ads Demographics - Removed due to API limitations -->
                    <!-- Google Ads API does not provide demographic data for reporting purposes -->
                </div>
            </div>
            ` : `
            <div class="section">
                <div class="chart-container">
                    <div class="chart-title">Demografia – Wartość</div>
                    <div style="text-align: center; padding: 40px; color: #6c757d;">
                        <p>Brak danych demograficznych dla tego okresu.</p>
                        <p style="font-size: 14px; margin-top: 8px;">Dane demograficzne będą dostępne po zebraniu wystarczającej liczby konwersji z wartością transakcji.</p>
                        <p style="font-size: 12px; margin-top: 4px; font-style: italic;">Uwaga: Wartość 0,00 zł oznacza brak bezpośrednich zakupów w podziale demograficznym, ale użytkownicy mogą nadal angażować się w lejek konwersji.</p>
                    </div>
                </div>
            </div>
            `}

            <!-- Top Placement Performance -->
            ${placementData.length > 0 ? `
            <div class="section page-break-before">
                <div class="section-title">Meta Ads - Pozycje Reklam</div>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>POZYCJA</th>
                                <th>WYDATKI</th>
                                <th>WYŚWIETLENIA</th>
                                <th>KLIKNIĘCIA</th>
                                <th>CTR</th>
                                <th>CPC</th>
                                <th>CPA</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${placementData.map((placement: any) => `
                                <tr>
                                    <td>${placement.placement}</td>
                                    <td>${formatCurrency(placement.spend)}</td>
                                    <td>${formatNumber(placement.impressions)}</td>
                                    <td>${formatNumber(placement.clicks)}</td>
                                    <td>${formatPercentage(placement.ctr)}</td>
                                    <td>${formatCurrency(placement.cpc)}</td>
                                    <td>${formatCurrency(placement.cpa)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                ${placementData.some((p: any) => p.placement?.includes('Pozostałe')) ? `
                <p style="font-size: 12px; color: var(--text-muted); margin-top: 16px; text-align: center;">
                    Pozycje zduplikowane wynikają z różnych zestawów reklam.
                </p>
                ` : ''}
            </div>
            ` : ''}

            <!-- Ad Relevance & Results -->
            ${topAds.length > 0 ? `
            <div class="section">
                <div class="section-title">Meta Ads - Trafność Reklam</div>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>NAZWA REKLAMY</th>
                                <th>WYDATKI</th>
                                <th>WYŚWIETLENIA</th>
                                <th>KLIKNIĘCIA</th>
                                <th>CPP/CPA</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${topAds.map((ad: any) => `
                                <tr>
                                    <td>${(ad.ad_name || 'Nieznana reklama').substring(0, 50)}${(ad.ad_name || '').length > 50 ? '...' : ''}</td>
                                    <td>${formatCurrency(ad.spend)}</td>
                                    <td>${formatNumber(ad.impressions)}</td>
                                    <td>${formatNumber(ad.clicks)}</td>
                                    <td>${ad.cpp ? formatCurrency(ad.cpp) : 'Brak danych'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                ${topAds.length === 10 ? `
                <p style="font-size: 12px; color: var(--text-muted); margin-top: 16px; text-align: center;">
                    Pokazano top 10 reklam według wydatków.
                </p>
                ` : ''}
            </div>
            ` : ''}

            <!-- Google Ads Tables Section -->
            ${reportData.googleAdsTables ? `
            
            <!-- Google Ads Network Performance -->
            ${reportData.googleAdsTables.networkPerformance && reportData.googleAdsTables.networkPerformance.length > 0 ? `
            <div class="section page-break-before">
                <div class="section-title">Google Ads - Sieci Reklamowe</div>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>SIEĆ</th>
                                <th>WYDATKI</th>
                                <th>WYŚWIETLENIA</th>
                                <th>KLIKNIĘCIA</th>
                                <th>CTR</th>
                                <th>CPC</th>
                                <th>KONWERSJE</th>
                                <th>ROAS</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reportData.googleAdsTables.networkPerformance.map((network: any) => `
                                <tr>
                                    <td>${network.network || 'Unknown Network'}</td>
                                    <td>${formatCurrency(network.spend || 0)}</td>
                                    <td>${formatNumber(network.impressions || 0)}</td>
                                    <td>${formatNumber(network.clicks || 0)}</td>
                                    <td>${formatPercentage(network.ctr || 0)}</td>
                                    <td>${formatCurrency(network.cpc || 0)}</td>
                                    <td>${formatNumber(network.conversions || 0)}</td>
                                    <td>${(network.roas || 0).toFixed(2)}x</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            ` : ''}

            <!-- Google Ads Device Performance -->
            ${reportData.googleAdsTables.devicePerformance && reportData.googleAdsTables.devicePerformance.length > 0 ? `
            <div class="section">
                <div class="section-title">Google Ads - Urządzenia</div>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>URZĄDZENIE</th>
                                <th>WYDATKI</th>
                                <th>WYŚWIETLENIA</th>
                                <th>KLIKNIĘCIA</th>
                                <th>CTR</th>
                                <th>CPC</th>
                                <th>KONWERSJE</th>
                                <th>ROAS</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reportData.googleAdsTables.devicePerformance.map((device: any) => `
                                <tr>
                                    <td>${device.device || 'Unknown Device'}</td>
                                    <td>${formatCurrency(device.spend || 0)}</td>
                                    <td>${formatNumber(device.impressions || 0)}</td>
                                    <td>${formatNumber(device.clicks || 0)}</td>
                                    <td>${formatPercentage(device.ctr || 0)}</td>
                                    <td>${formatCurrency(device.cpc || 0)}</td>
                                    <td>${formatNumber(device.conversions || 0)}</td>
                                    <td>${(device.roas || 0).toFixed(2)}x</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            ` : ''}

            <!-- Google Ads Keyword Performance -->
            ${reportData.googleAdsTables.keywordPerformance && reportData.googleAdsTables.keywordPerformance.length > 0 ? `
            <div class="section">
                <div class="section-title">Google Ads - Słowa Kluczowe</div>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>SŁOWO KLUCZOWE</th>
                                <th>WYDATKI</th>
                                <th>WYŚWIETLENIA</th>
                                <th>KLIKNIĘCIA</th>
                                <th>CTR</th>
                                <th>CPC</th>
                                <th>KONWERSJE</th>
                                <th>ROAS</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reportData.googleAdsTables.keywordPerformance.slice(0, 20).map((keyword: any) => `
                                <tr>
                                    <td>${(keyword.keyword || 'Unknown Keyword').substring(0, 40)}${(keyword.keyword || '').length > 40 ? '...' : ''}</td>
                                    <td>${formatCurrency(keyword.spend || 0)}</td>
                                    <td>${formatNumber(keyword.impressions || 0)}</td>
                                    <td>${formatNumber(keyword.clicks || 0)}</td>
                                    <td>${formatPercentage(keyword.ctr || 0)}</td>
                                    <td>${formatCurrency(keyword.cpc || 0)}</td>
                                    <td>${formatNumber(keyword.conversions || 0)}</td>
                                    <td>${(keyword.roas || 0).toFixed(2)}x</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                ${reportData.googleAdsTables.keywordPerformance.length > 20 ? `
                <p style="font-size: 12px; color: var(--text-muted); margin-top: 16px; text-align: center;">
                    Pokazano top 20 słów kluczowych według wydatków.
                </p>
                ` : ''}
            </div>
            ` : ''}
            
            ` : ''}

            <!-- Campaign Details - Updated to show Google Ads campaigns when available -->
            <div class="section">
                <div class="section-title">Szczegóły kampanii</div>
                <div style="margin-bottom: 16px; padding: 8px 12px; background: #f8f9fa; border-left: 4px solid ${(reportData.googleCampaigns && reportData.googleCampaigns.length > 0) ? '#34a853' : '#1877f2'}; border-radius: 4px; font-size: 14px; color: #495057;">
                    <strong>Źródło danych:</strong> ${(reportData.googleCampaigns && reportData.googleCampaigns.length > 0) ? 'Google Ads' : 'Meta Ads (Facebook)'}
                </div>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>NAZWA KAMPANII</th>
                                <th>WYDATKI</th>
                                <th>WYŚWIETLENIA</th>
                                <th>KLIKNIĘCIA</th>
                                <th>CTR</th>
                                <th>CPC</th>
                                <th>KONWERSJE</th>
                                <th>CPA</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${((reportData.googleCampaigns && reportData.googleCampaigns.length > 0) ? reportData.googleCampaigns : reportData.campaigns).filter((campaign: any) => (campaign.spend || 0) > 0).map((campaign: any) => {
                              const campaignCPA = campaign.conversions > 0 ? campaign.spend / campaign.conversions : 0;
                              return `
                                <tr>
                                    <td>${campaign.campaign_name || 'Nieznana kampania'}</td>
                                    <td>${formatCurrency(campaign.spend)}</td>
                                    <td>${formatNumber(campaign.impressions)}</td>
                                    <td>${formatNumber(campaign.clicks)}</td>
                                    <td>${formatPercentage(campaign.ctr)}</td>
                                    <td>${formatCurrency(campaign.cpc)}</td>
                                    <td>${formatNumber(campaign.conversions)}</td>
                                    <td>${formatCurrency(campaignCPA)}</td>
                                </tr>
                              `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Google Ads Campaign Details section removed - now integrated into main "Szczegóły kampanii" section above -->

            <!-- Methodology -->
            <div class="section">
                <div class="methodology">
                    <h3>Metodologia i przypisy</h3>
                    <p><strong>Źródło:</strong> Meta Ads API & Google Ads API, czas pobrania danych: ${new Date().toISOString()} (UTC)</p>
                    <p><strong>Definicje metryk:</strong></p>
                    <p>• Wydatki: Całkowita kwota wydana na kampanie reklamowe</p>
                    <p>• CTR: Stosunek kliknięć do wyświetleń (Click-Through Rate)</p>
                    <p>• CPC: Średni koszt kliknięcia (Cost Per Click)</p>
                    <p>• CPM: Koszt za 1000 wyświetleń (Cost Per Mille)</p>
                    <p>• CPA: Koszt pozyskania klienta (Cost Per Acquisition)</p>
                    <p>• ROAS: Zwrot z wydatków reklamowych (Return on Ad Spend)</p>
                    <p><strong>Zakres analizy:</strong> ${formatDate(reportData.dateRange.start)} – ${formatDate(reportData.dateRange.end)}</p>
                </div>
            </div>

            <!-- Footer -->
            <div class="footer">
                <p>Raport wygenerowany automatycznie • ${new Date().toLocaleDateString('pl-PL')} ${new Date().toLocaleTimeString('pl-PL')}</p>
            </div>
        </div>
            
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <script>
        // Debug: Check if Chart.js loaded
        console.log('🔍 PDF: Chart.js loaded:', typeof Chart !== 'undefined');
        console.log('🔍 PDF: Chart version:', typeof Chart !== 'undefined' ? Chart.version : 'not loaded');
        
        // Demographic data from server
        const demographicData = ${JSON.stringify(demographicData)};
        
        // Color schemes
        const genderColors = ['#8B5CF6', '#3B82F6', '#6B7280']; // Purple, Blue, Gray
        const ageColors = ['#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444', '#6B7280', '#F97316']; // Orange, Green, Blue, Purple, Red, Gray, Orange
        const googleColors = ['#34a853', '#4285f4', '#ea4335', '#fbbc04']; // Google brand colors
        
        // Chart configuration
        const chartOptions = {
            responsive: false,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 10,
                        usePointStyle: true,
                        font: {
                            size: 10
                        }
                    }
                },
                tooltip: {
                    enabled: false // Disable tooltips for PDF
                }
            }
        };
        
        // Capture console logs for debugging
        window.consoleLogs = [];
        const originalLog = console.log;
        const originalError = console.error;
        console.log = function(...args) {
            window.consoleLogs.push({type: 'log', args: args});
            originalLog.apply(console, args);
        };
        console.error = function(...args) {
            window.consoleLogs.push({type: 'error', args: args});
            originalError.apply(console, args);
        };
        
        console.log('🔍 PDF: Starting chart generation...');
        console.log('📊 PDF Chart Debug - Full demographic data:', JSON.stringify(demographicData, null, 2));
        
        // Gender ROAS Chart
        try {
            if (demographicData.gender && demographicData.gender.length > 0) {
                const canvas1 = document.getElementById('genderROASChart');
                if (canvas1) {
                    console.log('✅ PDF: Found genderROASChart canvas');
                    const ctx1 = canvas1.getContext('2d');
                    
                    // Use ROAS if available, otherwise fall back to impressions, then clicks, then spend
                    const hasROASData = demographicData.gender.some(g => (g.roas || 0) > 0);
                    const hasImpressionData = demographicData.gender.some(g => (g.impressions || 0) > 0);
                    const hasClickData = demographicData.gender.some(g => (g.clicks || 0) > 0);
                    
                    let chartData;
                    let dataSource;
                    
                    if (hasROASData) {
                        chartData = demographicData.gender.map(g => g.roas || 0);
                        dataSource = 'ROAS';
                    } else if (hasImpressionData) {
                        chartData = demographicData.gender.map(g => g.impressions || 0);
                        dataSource = 'Impressions';
                    } else if (hasClickData) {
                        chartData = demographicData.gender.map(g => g.clicks || 0);
                        dataSource = 'Clicks';
                    } else {
                        // Final fallback: use spend, or if spend is also 0, use equal distribution (1 for each)
                        const hasSpendData = demographicData.gender.some(g => (g.spend || 0) > 0);
                        if (hasSpendData) {
                            chartData = demographicData.gender.map(g => g.spend || 0);
                            dataSource = 'Spend';
                        } else {
                            // Ultimate fallback: equal distribution to show demographic categories
                            chartData = demographicData.gender.map(() => 1);
                            dataSource = 'Equal distribution (showing categories)';
                        }
                    }
                    
                    console.log('📊 PDF: Gender ROAS chart data:', { 
                        hasROASData, 
                        hasImpressionData, 
                        hasClickData, 
                        dataSource,
                        chartData,
                        labels: demographicData.gender.map(g => g.gender)
                    });
                    
                    new Chart(ctx1, {
                        type: 'pie',
                        data: {
                            labels: demographicData.gender.map(g => g.gender),
                            datasets: [{
                                data: chartData,
                                backgroundColor: genderColors,
                                borderWidth: 2,
                                borderColor: '#fff'
                            }]
                        },
                        options: chartOptions
                    });
                    console.log('✅ PDF: Gender ROAS chart created');
                } else {
                    console.log('❌ PDF: genderROASChart canvas not found');
                }
            } else {
                console.log('⚠️ PDF: No gender data available');
            }
        } catch (error) {
            console.error('❌ PDF: Error creating gender ROAS chart:', error);
        }
        
        // Age ROAS Chart
        try {
            if (demographicData.age && demographicData.age.length > 0) {
                const canvas2 = document.getElementById('ageROASChart');
                if (canvas2) {
                    console.log('✅ PDF: Found ageROASChart canvas');
                    const ctx2 = canvas2.getContext('2d');
                    
                    // Use ROAS if available, otherwise fall back to impressions, then clicks, then spend
                    const hasROASData = demographicData.age.some(a => (a.roas || 0) > 0);
                    const hasImpressionData = demographicData.age.some(a => (a.impressions || 0) > 0);
                    const hasClickData = demographicData.age.some(a => (a.clicks || 0) > 0);
                    
                    let chartData;
                    let dataSource;
                    
                    if (hasROASData) {
                        chartData = demographicData.age.map(a => a.roas || 0);
                        dataSource = 'ROAS';
                    } else if (hasImpressionData) {
                        chartData = demographicData.age.map(a => a.impressions || 0);
                        dataSource = 'Impressions';
                    } else if (hasClickData) {
                        chartData = demographicData.age.map(a => a.clicks || 0);
                        dataSource = 'Clicks';
                    } else {
                        // Final fallback: use spend, or if spend is also 0, use equal distribution (1 for each)
                        const hasSpendData = demographicData.age.some(a => (a.spend || 0) > 0);
                        if (hasSpendData) {
                            chartData = demographicData.age.map(a => a.spend || 0);
                            dataSource = 'Spend';
                        } else {
                            // Ultimate fallback: equal distribution to show demographic categories
                            chartData = demographicData.age.map(() => 1);
                            dataSource = 'Equal distribution (showing categories)';
                        }
                    }
                    
                    console.log('📊 PDF: Age ROAS chart data:', { 
                        hasROASData, 
                        hasImpressionData, 
                        hasClickData, 
                        dataSource,
                        chartData,
                        labels: demographicData.age.map(a => a.age)
                    });
                    
                    new Chart(ctx2, {
                        type: 'pie',
                        data: {
                            labels: demographicData.age.map(a => a.age),
                            datasets: [{
                                data: chartData,
                                backgroundColor: ageColors,
                                borderWidth: 2,
                                borderColor: '#fff'
                            }]
                        },
                        options: chartOptions
                    });
                    console.log('✅ PDF: Age ROAS chart created');
                } else {
                    console.log('❌ PDF: ageROASChart canvas not found');
                }
            } else {
                console.log('⚠️ PDF: No age data available');
            }
        } catch (error) {
            console.error('❌ PDF: Error creating age ROAS chart:', error);
        }
        
        // Debug: Check all canvas elements
        console.log('🔍 PDF: All canvas elements:', document.querySelectorAll('canvas').length);
        console.log('🔍 PDF: Canvas IDs:', Array.from(document.querySelectorAll('canvas')).map(c => c.id));
        
        // Gender Engagement Chart
        try {
            if (demographicData.gender && demographicData.gender.length > 0) {
                console.log('🔍 PDF: Looking for genderEngagementChart...');
                const canvas3 = document.getElementById('genderEngagementChart');
                console.log('🔍 PDF: genderEngagementChart found:', !!canvas3);
                if (canvas3) {
                    console.log('✅ PDF: Found genderEngagementChart canvas');
                    const ctx3 = canvas3.getContext('2d');
                    
                    // Use booking_step_1 (engagement) if available, otherwise fall back to clicks, then impressions, then equal distribution
                    const hasEngagementData = demographicData.gender.some(g => (g.booking_step_1 || 0) > 0);
                    const hasClickData = demographicData.gender.some(g => (g.clicks || 0) > 0);
                    const hasImpressionData = demographicData.gender.some(g => (g.impressions || 0) > 0);
                    
                    let chartData;
                    let dataSource;
                    
                    if (hasEngagementData) {
                        chartData = demographicData.gender.map(g => g.booking_step_1 || 0);
                        dataSource = 'Engagement';
                    } else if (hasClickData) {
                        chartData = demographicData.gender.map(g => g.clicks || 0);
                        dataSource = 'Clicks (fallback)';
                    } else if (hasImpressionData) {
                        chartData = demographicData.gender.map(g => g.impressions || 0);
                        dataSource = 'Impressions (fallback)';
                    } else {
                        chartData = demographicData.gender.map(() => 1);
                        dataSource = 'Equal distribution (showing categories)';
                    }
                    
                    console.log('📊 PDF: Gender engagement chart data:', { hasEngagementData, hasClickData, hasImpressionData, dataSource, chartData });
                    
                    new Chart(ctx3, {
                        type: 'pie',
                        data: {
                            labels: demographicData.gender.map(g => g.gender),
                            datasets: [{
                                data: chartData,
                                backgroundColor: genderColors,
                                borderWidth: 2,
                                borderColor: '#fff'
                            }]
                        },
                        options: chartOptions
                    });
                    console.log('✅ PDF: Gender engagement chart created');
                } else {
                    console.log('❌ PDF: genderEngagementChart canvas not found');
                }
            }
        } catch (error) {
            console.error('❌ PDF: Error creating gender engagement chart:', error);
        }
        
        // Age Engagement Chart
        try {
            if (demographicData.age && demographicData.age.length > 0) {
                const canvas4 = document.getElementById('ageEngagementChart');
                if (canvas4) {
                    console.log('✅ PDF: Found ageEngagementChart canvas');
                    const ctx4 = canvas4.getContext('2d');
                    
                    // Use booking_step_1 (engagement) if available, otherwise fall back to clicks for visualization
                    const hasEngagementData = demographicData.age.some(a => (a.booking_step_1 || 0) > 0);
                    const chartData = hasEngagementData 
                        ? demographicData.age.map(a => a.booking_step_1 || 0)
                        : demographicData.age.map(a => a.clicks || 0);
                    
                    console.log('📊 PDF: Age engagement chart data:', { hasEngagementData, chartData });
                    
                    new Chart(ctx4, {
                        type: 'pie',
                        data: {
                            labels: demographicData.age.map(a => a.age),
                            datasets: [{
                                data: chartData,
                                backgroundColor: ageColors,
                                borderWidth: 2,
                                borderColor: '#fff'
                            }]
                        },
                        options: chartOptions
                    });
                    console.log('✅ PDF: Age engagement chart created');
                } else {
                    console.log('❌ PDF: ageEngagementChart canvas not found');
                }
            }
        } catch (error) {
            console.error('❌ PDF: Error creating age engagement chart:', error);
        }

        // Gender Value Chart
        try {
            if (demographicData.gender && demographicData.gender.length > 0) {
                const canvas5 = document.getElementById('genderValueChart');
                if (canvas5) {
                    console.log('✅ PDF: Found genderValueChart canvas');
                    const ctx5 = canvas5.getContext('2d');
                    
                    // Use reservation value if available, otherwise fall back to spend for visualization
                    const hasValueData = demographicData.gender.some(g => (g.reservation_value || 0) > 0);
                    const chartData = hasValueData 
                        ? demographicData.gender.map(g => g.reservation_value || 0)
                        : demographicData.gender.map(g => g.spend || 0);
                    
                    console.log('📊 PDF: Gender value chart data:', { hasValueData, chartData });
                    
                    new Chart(ctx5, {
                        type: 'pie',
                        data: {
                            labels: demographicData.gender.map(g => g.gender),
                            datasets: [{
                                data: chartData,
                                backgroundColor: genderColors,
                                borderWidth: 2,
                                borderColor: '#fff'
                            }]
                        },
                        options: chartOptions
                    });
                    console.log('✅ PDF: Gender value chart created');
                } else {
                    console.log('❌ PDF: genderValueChart canvas not found');
                }
            }
        } catch (error) {
            console.error('❌ PDF: Error creating gender value chart:', error);
        }
        
        // Age Value Chart
        try {
            if (demographicData.age && demographicData.age.length > 0) {
                const canvas6 = document.getElementById('ageValueChart');
                if (canvas6) {
                    console.log('✅ PDF: Found ageValueChart canvas');
                    const ctx6 = canvas6.getContext('2d');
                    
                    // Use reservation value if available, otherwise fall back to spend for visualization
                    const hasValueData = demographicData.age.some(a => (a.reservation_value || 0) > 0);
                    const chartData = hasValueData 
                        ? demographicData.age.map(a => a.reservation_value || 0)
                        : demographicData.age.map(a => a.spend || 0);
                    
                    console.log('📊 PDF: Age value chart data:', { hasValueData, chartData });
                    
                    new Chart(ctx6, {
                        type: 'pie',
                        data: {
                            labels: demographicData.age.map(a => a.age),
                            datasets: [{
                                data: chartData,
                                backgroundColor: ageColors,
                                borderWidth: 2,
                                borderColor: '#fff'
                            }]
                        },
                        options: chartOptions
                    });
                    console.log('✅ PDF: Age value chart created');
                } else {
                    console.log('❌ PDF: ageValueChart canvas not found');
                }
            }
        } catch (error) {
            console.error('❌ PDF: Error creating age value chart:', error);
        }
        
        // Google Ads Demographics - Removed due to API limitations
        console.log('ℹ️ PDF: Google Ads demographics section removed - API does not support demographic data retrieval');
        
        console.log('🔍 PDF: Chart generation completed');
        </script>
        ` : ''}
        </body>
    </html>
  `;
}

// Helper function to detect report type based on date range
function detectReportType(dateRange: { start: string; end: string }): 'weekly' | 'monthly' | 'custom' {
  const start = new Date(dateRange.start);
  const end = new Date(dateRange.end);
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  console.log(`🔍 Report type detection: ${daysDiff} days between ${dateRange.start} and ${dateRange.end}`);
  
  if (daysDiff === 7) {
    logger.info('📊 Detected: WEEKLY report');
    return 'weekly';
  }
  if (daysDiff >= 28 && daysDiff <= 31) {
    logger.info('📊 Detected: MONTHLY report');
    return 'monthly';
  }
  
  logger.info('📊 Detected: CUSTOM report');
  return 'custom';
}

// Helper function to get previous week date range
function getPreviousWeekDateRange(dateRange: { start: string; end: string }) {
  const currentStart = new Date(dateRange.start);
  
  // Previous week is exactly 7 days before current week start
  const previousStart = new Date(currentStart.getTime() - (7 * 24 * 60 * 60 * 1000));
  const previousEnd = new Date(previousStart.getTime() + (6 * 24 * 60 * 60 * 1000));
  
  const result = {
    start: previousStart.toISOString().split('T')[0],
    end: previousEnd.toISOString().split('T')[0]
  };
  
  logger.info('📅 Previous week calculation:');
  console.log(`   Current week: ${dateRange.start} to ${dateRange.end}`);
  console.log(`   Previous week: ${result.start} to ${result.end}`);
  
  return result;
}

// Helper function to get previous month date range
function getPreviousMonthDateRange(dateRange: { start: string; end: string }) {
  // Parse date properly to avoid timezone issues
  const dateParts = dateRange.start.split('-').map(Number);
  if (dateParts.length !== 3) {
    throw new Error(`Invalid date format: ${dateRange.start}`);
  }
  
  const year = dateParts[0]!;
  const month = dateParts[1]!;
  
  // Calculate previous month
  let previousYear = year;
  let previousMonth = month - 1;
  
  // Handle year rollover
  if (previousMonth === 0) {
    previousMonth = 12;
    previousYear = year - 1;
  }
  
  // Format as YYYY-MM-DD (always first day of month)
  const previousStart = `${previousYear}-${previousMonth.toString().padStart(2, '0')}-01`;
  
  // Calculate last day of previous month
  const lastDayOfPreviousMonth = new Date(year, month - 1, 0).getDate();
  const previousEnd = `${previousYear}-${previousMonth.toString().padStart(2, '0')}-${lastDayOfPreviousMonth.toString().padStart(2, '0')}`;
  
  logger.info('📅 Date calculation:');
  console.log(`   Current: ${dateRange.start} (Year: ${year}, Month: ${month})`);
  console.log(`   Previous: ${previousStart} (Year: ${previousYear}, Month: ${previousMonth})`);
  
  return {
    start: previousStart,
    end: previousEnd
  };
}

// Helper function to get previous year date range
function getPreviousYearDateRange(dateRange: { start: string; end: string }) {
  // Parse date properly to avoid timezone issues
  const dateParts = dateRange.start.split('-').map(Number);
  if (dateParts.length !== 3) {
    throw new Error(`Invalid date format: ${dateRange.start}`);
  }
  
  const year = dateParts[0]!;
  const month = dateParts[1]!;
  
  // Calculate previous year (same month)
  const previousYear = year - 1;
  
  // Format as YYYY-MM-DD (always first day of month)
  const previousYearStart = `${previousYear}-${month.toString().padStart(2, '0')}-01`;
  
  // Calculate last day of the month in previous year (month is 0-indexed in Date constructor)
  const lastDayOfPreviousYearMonth = new Date(previousYear, month, 0).getDate();
  const previousYearEnd = `${previousYear}-${month.toString().padStart(2, '0')}-${lastDayOfPreviousYearMonth.toString().padStart(2, '0')}`;
  
  logger.info('📅 Previous year calculation:');
  console.log(`   Current: ${dateRange.start} (Year: ${year}, Month: ${month})`);
  console.log(`   Previous year: ${previousYearStart} (Year: ${previousYear}, Month: ${month})`);
  console.log(`   Previous year range: ${previousYearStart} to ${previousYearEnd}`);
  
  return {
    start: previousYearStart,
    end: previousYearEnd
  };
}

// Helper function to fetch previous year data from database (fast lookup)
async function fetchPreviousYearDataFromDB(dateRange: { start: string; end: string }, clientId: string) {
  try {
    logger.info('📊 Fetching previous year data from database (fast lookup)...');
    const previousYearDateRange = getPreviousYearDateRange(dateRange);
    logger.info('   Previous year range:', previousYearDateRange);

    // Query campaign_summaries table for stored data from previous year (both monthly and weekly)
    const { data: storedSummaries, error } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', clientId)
      .gte('summary_date', previousYearDateRange.start)
      .lte('summary_date', previousYearDateRange.end);

    if (error) {
      logger.warn('Warning', error.message);
      return null;
    }

    if (storedSummaries && storedSummaries.length > 0) {
      console.log(`✅ Found ${storedSummaries.length} stored summaries for ${previousYearDateRange.start} to ${previousYearDateRange.end}`);
      
      // Aggregate data from all summaries (monthly + weekly)
      const aggregatedData = storedSummaries.reduce((acc: any, summary: any) => ({
        spend: acc.spend + (summary.total_spend || 0),
        impressions: acc.impressions + (summary.total_impressions || 0),
        clicks: acc.clicks + (summary.total_clicks || 0),
        conversions: acc.conversions + (summary.total_conversions || 0),
        campaign_data: [...(acc.campaign_data || []), ...(summary.campaign_data || [])]
      }), { 
        spend: 0, impressions: 0, clicks: 0, conversions: 0, campaign_data: []
      });

      console.log(`   Aggregated previous year data: spend=${aggregatedData.spend}, impressions=${aggregatedData.impressions}, clicks=${aggregatedData.clicks}`);
      
      // Extract campaign data for conversion calculations
      const previousYearCampaigns = aggregatedData.campaign_data || [];
      console.log(`   Previous year campaigns from summaries: ${previousYearCampaigns.length}`);

      // Also fetch conversion data from campaigns table for the previous year
      const { data: previousYearCampaignRecords } = await supabase
        .from('campaigns')
        .select('*')
        .eq('client_id', clientId)
        .gte('created_at', previousYearDateRange.start)
        .lt('created_at', `${previousYearDateRange.start.split('-')[0]}-${(parseInt(previousYearDateRange.start.split('-')[1]!) + 1).toString().padStart(2, '0')}-01`);

      console.log(`   Previous year campaigns from campaigns table: ${previousYearCampaignRecords?.length || 0}`);

      // Calculate conversion metrics from both sources
      const campaignsToProcess = previousYearCampaignRecords && previousYearCampaignRecords.length > 0 
        ? previousYearCampaignRecords 
        : previousYearCampaigns;

      const previousYearTotals = campaignsToProcess.reduce((acc: any, campaign: any) => ({
        spend: acc.spend + (campaign.spend || 0),
        impressions: acc.impressions + (campaign.impressions || 0),
        clicks: acc.clicks + (campaign.clicks || 0),
        conversions: acc.conversions + (campaign.conversions || 0),
        click_to_call: acc.click_to_call + (campaign.click_to_call || 0),
        email_contacts: acc.email_contacts + (campaign.email_contacts || 0),
        booking_step_1: acc.booking_step_1 + (campaign.booking_step_1 || 0),
        reservations: acc.reservations + (campaign.purchase || campaign.reservations || 0), // Support both field names
        reservation_value: acc.reservation_value + (campaign.purchase_value || campaign.reservation_value || 0), // Support both field names
        booking_step_2: acc.booking_step_2 + (campaign.booking_step_2 || 0),
      }), { 
        spend: 0, impressions: 0, clicks: 0, conversions: 0,
        click_to_call: 0, email_contacts: 0, booking_step_1: 0,
        reservations: 0, reservation_value: 0, booking_step_2: 0
      });

      console.log(`   Previous year totals: reservations=${previousYearTotals.reservations}, value=${previousYearTotals.reservation_value}`);

      // Calculate averages for CTR, CPC, CPM from aggregated data
      const previousYearTotalsFormatted = {
        spend: aggregatedData.spend,
        impressions: aggregatedData.impressions,
        clicks: aggregatedData.clicks,
        conversions: aggregatedData.conversions,
        ctr: aggregatedData.clicks > 0 ? (aggregatedData.conversions / aggregatedData.clicks) * 100 : 0,
        cpc: aggregatedData.clicks > 0 ? aggregatedData.spend / aggregatedData.clicks : 0,
        cpm: aggregatedData.impressions > 0 ? (aggregatedData.spend / aggregatedData.impressions) * 1000 : 0
      };

      const previousYearConversions = {
        click_to_call: previousYearTotals.click_to_call,
        email_contacts: previousYearTotals.email_contacts,
        booking_step_1: previousYearTotals.booking_step_1,
        reservations: previousYearTotals.reservations,
        reservation_value: previousYearTotals.reservation_value,
        booking_step_2: previousYearTotals.booking_step_2,
      };

      logger.info('Success', {
        spend: previousYearTotalsFormatted.spend,
        conversions: previousYearTotalsFormatted.conversions,
        reservations: previousYearConversions.reservations,
        reservation_value: previousYearConversions.reservation_value,
        source: 'database'
      });

      return { previousYearTotals: previousYearTotalsFormatted, previousYearConversions };
    }
    
    logger.info('⚠️ No previous year data found in database');
    console.log(`   Searched for client: ${clientId}`);
    console.log(`   Date range: ${previousYearDateRange.start} to ${previousYearDateRange.end}`);
    return null;
  } catch (error) {
    logger.warn('Warning', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Helper function to fetch previous week data from database (fast lookup)
async function fetchPreviousWeekDataFromDB(dateRange: { start: string; end: string }, clientId: string) {
  try {
    logger.info('📊 Fetching previous week data from database (fast lookup)...');
    const previousDateRange = getPreviousWeekDateRange(dateRange);
    logger.info('   Previous week range:', previousDateRange);

    // Query campaign_summaries table for stored weekly data
    const { data: storedSummary, error } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', clientId)
      .eq('summary_type', 'weekly')
      .eq('summary_date', previousDateRange.start)
      .single();

    if (error) {
      logger.warn('Warning', error.message);
      return null;
    }

    if (storedSummary) {
      console.log(`✅ Found stored weekly summary for ${previousDateRange.start}`);
      
      // Extract campaign data for conversion calculations
      const previousCampaigns = storedSummary.campaign_data || [];
      console.log(`   Previous week campaigns: ${previousCampaigns.length}`);

      // Calculate conversion metrics from stored campaign data
      const previousTotals = previousCampaigns.reduce((acc: any, campaign: any) => ({
        spend: acc.spend + (campaign.spend || 0),
        impressions: acc.impressions + (campaign.impressions || 0),
        clicks: acc.clicks + (campaign.clicks || 0),
        conversions: acc.conversions + (campaign.conversions || 0),
        click_to_call: acc.click_to_call + (campaign.click_to_call || 0),
        email_contacts: acc.email_contacts + (campaign.email_contacts || 0),
        booking_step_1: acc.booking_step_1 + (campaign.booking_step_1 || 0),
        reservations: acc.reservations + (campaign.reservations || 0),
        reservation_value: acc.reservation_value + (campaign.reservation_value || 0),
        booking_step_2: acc.booking_step_2 + (campaign.booking_step_2 || 0),
      }), { 
        spend: 0, impressions: 0, clicks: 0, conversions: 0,
        click_to_call: 0, email_contacts: 0, booking_step_1: 0,
        reservations: 0, reservation_value: 0, booking_step_2: 0
      });

      const previousWeekTotals = {
        spend: storedSummary.total_spend,
        impressions: storedSummary.total_impressions,
        clicks: storedSummary.total_clicks,
        conversions: storedSummary.total_conversions,
        ctr: storedSummary.average_ctr,
        cpc: storedSummary.average_cpc,
        cpm: storedSummary.total_impressions > 0 ? (storedSummary.total_spend / storedSummary.total_impressions) * 1000 : 0
      };

      const previousWeekConversions = {
        click_to_call: previousTotals.click_to_call,
        email_contacts: previousTotals.email_contacts,
        booking_step_1: previousTotals.booking_step_1,
        reservations: previousTotals.reservations,
        reservation_value: previousTotals.reservation_value,
        booking_step_2: previousTotals.booking_step_2,
      };

      logger.info('Success', {
        spend: previousWeekTotals.spend,
        conversions: previousWeekTotals.conversions,
        source: 'database'
      });

      return { previousWeekTotals, previousWeekConversions };
    }
    
    logger.info('⚠️ No previous week data found in database');
    return null;
  } catch (error) {
    logger.warn('Warning', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Helper function to fetch previous month data from database (fast lookup)
async function fetchPreviousMonthDataFromDB(dateRange: { start: string; end: string }, clientId: string) {
  try {
    logger.info('📊 Fetching previous month data from database (fast lookup)...');
    const previousDateRange = getPreviousMonthDateRange(dateRange);
    logger.info('   Previous month range:', previousDateRange);

    // Query campaign_summaries table for stored monthly data
    const { data: storedSummary, error } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', clientId)
      .eq('summary_type', 'monthly')
      .eq('summary_date', previousDateRange.start)
      .single();

    if (error) {
      logger.warn('Warning', error.message);
      return null;
    }

    if (storedSummary) {
      console.log(`✅ Found stored summary for ${previousDateRange.start}`);
      
      // Extract campaign data for conversion calculations
      const previousCampaigns = storedSummary.campaign_data || [];
      console.log(`   Previous month campaigns: ${previousCampaigns.length}`);

      // Calculate conversion metrics from stored campaign data
      const previousTotals = previousCampaigns.reduce((acc: any, campaign: any) => ({
        spend: acc.spend + (campaign.spend || 0),
        impressions: acc.impressions + (campaign.impressions || 0),
        clicks: acc.clicks + (campaign.clicks || 0),
        conversions: acc.conversions + (campaign.conversions || 0),
        click_to_call: acc.click_to_call + (campaign.click_to_call || 0),
        email_contacts: acc.email_contacts + (campaign.email_contacts || 0),
        booking_step_1: acc.booking_step_1 + (campaign.booking_step_1 || 0),
        reservations: acc.reservations + (campaign.reservations || 0),
        reservation_value: acc.reservation_value + (campaign.reservation_value || 0),
        booking_step_2: acc.booking_step_2 + (campaign.booking_step_2 || 0),
      }), { 
        spend: 0, impressions: 0, clicks: 0, conversions: 0,
        click_to_call: 0, email_contacts: 0, booking_step_1: 0,
        reservations: 0, reservation_value: 0, booking_step_2: 0
      });

      const previousMonthTotals = {
        spend: storedSummary.total_spend,
        impressions: storedSummary.total_impressions,
        clicks: storedSummary.total_clicks,
        conversions: storedSummary.total_conversions,
        ctr: storedSummary.average_ctr,
        cpc: storedSummary.average_cpc,
        cpm: storedSummary.total_impressions > 0 ? (storedSummary.total_spend / storedSummary.total_impressions) * 1000 : 0
      };

      const previousMonthConversions = {
        click_to_call: previousTotals.click_to_call,
        email_contacts: previousTotals.email_contacts,
        booking_step_1: previousTotals.booking_step_1,
        reservations: previousTotals.reservations,
        reservation_value: previousTotals.reservation_value,
        booking_step_2: previousTotals.booking_step_2,
      };

      logger.info('Success', {
        spend: previousMonthTotals.spend,
        conversions: previousMonthTotals.conversions,
        source: 'database'
      });

      return { previousMonthTotals, previousMonthConversions };
    }
    
    logger.info('⚠️ No previous month data found in database');
    return null;
  } catch (error) {
    logger.warn('Warning', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

export async function POST(request: NextRequest) {
  logger.info('📄 PDF Generation Request Started');

  try {
    // Extract the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    const { clientId, dateRange, campaigns: directCampaigns, totals: directTotals, client: directClient, metaTables: directMetaTables, platform = 'meta' } = await request.json();

    if (!clientId || !dateRange) {
      return NextResponse.json({ error: 'Client ID and date range are required' }, { status: 400 });
    }

    logger.debug('Debug info', { clientId, dateRange });

    // Get client information
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientError || !clientData) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const client = directClient || clientData;
    logger.info('Success', client.name);

    // Auto-detect platform based on client configuration if not explicitly provided
    let detectedPlatform = platform;
    if (!platform || platform === 'meta') {
      // Check if client has Google Ads enabled and should use Google Ads data
      if (client.google_ads_enabled && client.google_ads_customer_id) {
        detectedPlatform = 'google';
        logger.info('🎯 Auto-detected Google Ads platform based on client configuration');
      } else {
        detectedPlatform = 'meta';
        logger.info('🎯 Using Meta platform (default or client has no Google Ads)');
      }
    }
    
    logger.info(`📊 PDF Generation Platform: ${detectedPlatform}`, {
      requestedPlatform: platform,
      detectedPlatform,
      hasGoogleAds: !!client.google_ads_enabled,
      hasGoogleCustomerId: !!client.google_ads_customer_id
    });

    let campaigns: any[] = [];
    let calculatedTotals: any = null;
    let metaTablesData: any = null;
    
    // Detect report type to use correct comparison logic
    const reportType = detectReportType(dateRange);
    
    // Start previous period and year fetches early (in parallel) if using direct data
    let previousPeriodPromise: Promise<any> = Promise.resolve(null);
    let previousYearPromise: Promise<any> = Promise.resolve(null);
    if (directCampaigns && directTotals) {
      console.log(`🚀 Using direct data - starting ${reportType} and year database lookups in parallel`);
      
      if (reportType === 'weekly') {
        previousPeriodPromise = fetchPreviousWeekDataFromDB(dateRange, clientId);
      } else if (reportType === 'monthly') {
        previousPeriodPromise = fetchPreviousMonthDataFromDB(dateRange, clientId);
      } else if (reportType === 'custom') {
        // For custom reports, try to get previous month data for comparison
        logger.info('📊 Custom report: fetching previous month data for comparison');
        previousPeriodPromise = fetchPreviousMonthDataFromDB(dateRange, clientId);
      }
      
      previousYearPromise = fetchPreviousYearDataFromDB(dateRange, clientId);
    }

    // Fetch Google Ads data in parallel with other operations
    let googleCampaigns: UnifiedCampaign[] = [];
    let metaCampaigns: UnifiedCampaign[] = [];
    let platformTotals: { meta: PlatformTotals; google: PlatformTotals; combined: PlatformTotals } | undefined;

    // PRODUCTION FIX: Always fetch Google Ads data first, regardless of path
    async function fetchGoogleAdsData(): Promise<UnifiedCampaign[]> {
      try {
        logger.info('🔍 [PRODUCTION] Fetching Google Ads data for unified report...');
        
        // Check if client has Google Ads enabled
        const { data: clientCheck, error: clientCheckError } = await supabase
          .from('clients')
          .select('google_ads_enabled, google_ads_customer_id, google_ads_refresh_token')
          .eq('id', clientId)
          .single();
        
        if (clientCheckError) {
          logger.warn('⚠️ [PRODUCTION] Error checking client Google Ads status:', clientCheckError);
          return [];
        }
        
        if (!clientCheck?.google_ads_enabled || !clientCheck?.google_ads_customer_id) {
          logger.info('ℹ️ [PRODUCTION] Google Ads not enabled for this client');
          return [];
        }
        
        logger.info('✅ [PRODUCTION] Client has Google Ads enabled, fetching campaigns...');
        
        // Fetch from google_ads_campaigns table (cached data)
        // CRITICAL FIX: Use overlapping date range logic instead of strict containment
        const { data: cachedGoogleCampaigns, error: cacheError } = await supabase
          .from('google_ads_campaigns')
          .select('*')
          .eq('client_id', clientId)
          .lte('date_range_start', dateRange.end)    // Campaign starts before or on report end
          .gte('date_range_end', dateRange.start);   // Campaign ends after or on report start
        
        if (cacheError) {
          logger.error('❌ [PRODUCTION] Error fetching Google Ads campaigns:', cacheError);
          return [];
        }
        
        if (!cachedGoogleCampaigns || cachedGoogleCampaigns.length === 0) {
          logger.info('ℹ️ [PRODUCTION] No Google Ads campaigns found for date range');
          return [];
        }
        
        logger.info(`🔍 [PRODUCTION] Found ${cachedGoogleCampaigns.length} raw Google Ads campaigns`);
        
        // Convert to unified format
        const convertedCampaigns = cachedGoogleCampaigns.map(convertGoogleCampaignToUnified);
        logger.info(`✅ [PRODUCTION] Successfully converted ${convertedCampaigns.length} Google Ads campaigns`);
        
        return convertedCampaigns;
      } catch (error) {
        logger.error('❌ [PRODUCTION] Error in fetchGoogleAdsData:', error);
        return [];
      }
    }

    // Fetch Google Ads data only if platform is Google or if we need both platforms
    // For platform-specific reports, only fetch the relevant platform data
    if (detectedPlatform === 'google') {
      logger.info('🎯 Platform is Google Ads - fetching Google Ads data only');
      googleCampaigns = await fetchGoogleAdsData();
    } else {
      logger.info('🎯 Platform is Meta - skipping Google Ads data fetch for platform-specific report');
      googleCampaigns = []; // No Google Ads data for Meta-only reports
    }

    // If we have direct data, use it (much faster)
    if (directCampaigns && directTotals) {
      logger.info('🚀 Using direct data for fast PDF generation');
      campaigns = directCampaigns;
      calculatedTotals = directTotals;
      console.log(`   Campaigns: ${campaigns.length}`);
      console.log(`   Total Spend: ${calculatedTotals.spend} zł`);
      
      // Convert campaigns to unified format based on platform
      try {
        if (detectedPlatform === 'meta') {
          logger.info('🔄 Converting Meta campaigns to unified format...');
          metaCampaigns = directCampaigns.map(convertMetaCampaignToUnified);
          logger.info(`✅ Converted ${metaCampaigns.length} Meta campaigns`);
        } else if (detectedPlatform === 'google') {
          logger.info('🔄 Converting Google Ads campaigns to unified format...');
          googleCampaigns = directCampaigns.map(convertGoogleCampaignToUnified);
          logger.info(`✅ Converted ${googleCampaigns.length} Google Ads campaigns`);
        }
      } catch (error) {
        logger.error(`❌ Error converting ${detectedPlatform} campaigns:`, error);
        if (detectedPlatform === 'meta') {
          metaCampaigns = [];
        } else {
          googleCampaigns = [];
        }
      }
      
      // Platform-specific data handling completed
      logger.info(`✅ [PRODUCTION] Platform-specific data processing completed for ${detectedPlatform}`);
      
      // Platform totals will be calculated after Google Ads data is fetched
      
      // Use direct Meta tables data if available
      if (directMetaTables) {
        logger.info('📊 Using direct Meta tables data for fast PDF generation');
        metaTablesData = directMetaTables;
        console.log(`   Placement: ${metaTablesData.placementPerformance?.length || 0} records`);
        console.log(`   Demographic: ${metaTablesData.demographicPerformance?.length || 0} records`);
        console.log(`   Ad Relevance: ${metaTablesData.adRelevanceResults?.length || 0} records`);
        
        // Debug demographic data structure
        if (metaTablesData.demographicPerformance?.length > 0) {
          console.log('🔍 PDF: Sample demographic data received:', JSON.stringify(metaTablesData.demographicPerformance.slice(0, 2), null, 2));
        } else {
          console.log('⚠️ PDF: No demographic data in directMetaTables');
        }
      }
    } else {
      // Fallback to API call (slower) - Use platform-specific API like reports page
      logger.info(`📡 Using dashboard API call for consistent data (platform: ${detectedPlatform})...`);
      
      try {
        // Use the same API endpoint selection logic as reports page
        const apiEndpoint = detectedPlatform === 'meta' 
          ? '/api/fetch-live-data'
          : '/api/fetch-google-ads-live-data';
          
        logger.info(`📡 PDF Generation: Using ${detectedPlatform} API endpoint: ${apiEndpoint}`);
        
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'}${apiEndpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            dateRange: {
              start: dateRange.start,
              end: dateRange.end
            },
            clientId: clientId,
            platform: detectedPlatform // Include platform parameter like reports page
          })
        });

        if (response.ok) {
          const data = await response.json();
          logger.info('📄 PDF Generation - API response:', {
            success: data.success,
            campaignsCount: data.data?.campaigns?.length || 0,
            stats: data.data?.stats,
            dateRange: data.data?.dateRange
          });
          
          if (data.success && data.data?.campaigns) {
            campaigns = data.data.campaigns;
            logger.info('✅ Using dashboard API data for PDF generation');
            console.log(`   Campaigns: ${campaigns.length}`);
            console.log(`   Total Spend: ${data.data.stats.totalSpend} zł`);
            
            // Convert campaigns to unified format based on platform (fallback path)
            try {
              if (detectedPlatform === 'meta') {
                logger.info('🔄 Converting Meta campaigns to unified format (fallback path)...');
                metaCampaigns = campaigns.map(convertMetaCampaignToUnified);
                logger.info(`✅ Converted ${metaCampaigns.length} Meta campaigns (fallback path)`);
              } else if (detectedPlatform === 'google') {
                logger.info('🔄 Converting Google Ads campaigns to unified format (fallback path)...');
                googleCampaigns = campaigns.map(convertGoogleCampaignToUnified);
                logger.info(`✅ Converted ${googleCampaigns.length} Google Ads campaigns (fallback path)`);
              }
            } catch (error) {
              logger.error(`❌ Error converting ${detectedPlatform} campaigns (fallback path):`, error);
              if (detectedPlatform === 'meta') {
                metaCampaigns = [];
              } else {
                googleCampaigns = [];
              }
            }
          } else {
            logger.info('⚠️ Dashboard API returned no data');
          }
        } else {
          logger.info('⚠️ Dashboard API call failed');
        }
      } catch (error) {
        logger.info('⚠️ Dashboard API call error');
      }
    }

    // ALWAYS fetch Google Ads data regardless of path (Meta or fallback)
    // Google Ads data already fetched at the beginning - no need for ensured fetch
    logger.info(`✅ [PRODUCTION] Google Ads data status: ${googleCampaigns.length} campaigns available`);

    // ALWAYS calculate platform totals after data fetching (regardless of path)
    try {
      logger.info('🧮 Calculating platform totals (ensured calculation)...');
      const metaTotals = calculatePlatformTotals(metaCampaigns);
      const googleTotals = calculatePlatformTotals(googleCampaigns);
      const allCampaigns = [...metaCampaigns, ...googleCampaigns];
      const combinedTotals = calculatePlatformTotals(allCampaigns);
      
      platformTotals = {
        meta: metaTotals,
        google: googleTotals,
        combined: combinedTotals
      };
      
      logger.info('✅ Platform totals calculated successfully (ensured calculation)');
      logger.info(`   Meta campaigns: ${metaCampaigns.length}, Google campaigns: ${googleCampaigns.length}`);
      logger.info(`   Combined total spend: ${combinedTotals.totalSpend.toFixed(2)} PLN`);
    } catch (error) {
      logger.error('❌ Error calculating platform totals (ensured calculation):', error);
      platformTotals = undefined;
    }

    // Calculate totals if not provided directly
    if (!calculatedTotals) {
      const totals = campaigns.reduce((acc, campaign) => ({
        spend: acc.spend + (campaign.spend || 0),
        impressions: acc.impressions + (campaign.impressions || 0),
        clicks: acc.clicks + (campaign.clicks || 0),
        conversions: acc.conversions + (campaign.conversions || 0),
      }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 });

      calculatedTotals = {
        ...totals,
        ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
        cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
        cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0
      };
    }

        // Get previous month and year data (either from parallel fetch or sequential fetch)
    let previousMonthTotals: any = null;
    let previousMonthConversions: any = null;
    let previousYearTotals: any = null;
    let previousYearConversions: any = null;

    if (directCampaigns) {
      // Wait for parallel previous period and year fetches to complete
      console.log(`⏳ Waiting for parallel ${reportType} and year fetches...`);
      const [previousPeriodData, previousYearData] = await Promise.all([
        previousPeriodPromise,
        previousYearPromise
      ]);
      
          logger.info('🔍 COMPARISON DATA RESULTS:');
    logger.info('   Previous Period Data:', !!previousPeriodData);
    logger.info('   Previous Year Data:', !!previousYearData);
    
    // Enhanced debugging for period comparison issue
    logger.info('🚨 PERIOD COMPARISON DEBUG - ENHANCED:');
    logger.info('   Report Type:', reportType);
    logger.info('   Previous Period Promise Result:', previousPeriodData);
    if (previousPeriodData) {
      logger.info('   Previous Period Data Structure:');
      logger.info('      Weekly totals:', previousPeriodData.previousWeekTotals);
      logger.info('      Monthly totals:', previousPeriodData.previousMonthTotals);
      logger.info('      Weekly conversions:', previousPeriodData.previousWeekConversions);
      logger.info('      Monthly conversions:', previousPeriodData.previousMonthConversions);
    }
    
    if (previousPeriodData) {
        if (reportType === 'weekly') {
          // For weekly reports, use previous week data
          previousMonthTotals = previousPeriodData.previousWeekTotals;
          previousMonthConversions = previousPeriodData.previousWeekConversions;
          logger.info('✅ Using previous week data for weekly PDF comparisons');
          logger.info('   Week totals:', previousMonthTotals);
          logger.info('   Week conversions:', previousMonthConversions);
        } else if (reportType === 'monthly') {
          // For monthly reports, use previous month data
          previousMonthTotals = previousPeriodData.previousMonthTotals;
          previousMonthConversions = previousPeriodData.previousMonthConversions;
          logger.info('✅ Using previous month data for monthly PDF comparisons');
          logger.info('   Month totals:', previousMonthTotals);
          logger.info('   Month conversions:', previousMonthConversions);
        } else if (reportType === 'custom') {
          // For custom reports, use previous month data for comparison
          previousMonthTotals = previousPeriodData.previousMonthTotals;
          previousMonthConversions = previousPeriodData.previousMonthConversions;
          logger.info('✅ Using previous month data for custom PDF comparisons');
          logger.info('   Month totals:', previousMonthTotals);
          logger.info('   Month conversions:', previousMonthConversions);
        }
      } else {
        logger.info('❌ No previous period data found');
      }
      
      if (previousYearData) {
        previousYearTotals = previousYearData.previousYearTotals;
        previousYearConversions = previousYearData.previousYearConversions;
        logger.info('✅ Previous year data loaded (parallel path)');
        logger.info('   Year totals:', !!previousYearTotals);
        logger.info('   Year conversions:', !!previousYearConversions);
        logger.info('   Year totals keys:', previousYearTotals ? Object.keys(previousYearTotals) : 'none');
        logger.info('   Year conversions keys:', previousYearConversions ? Object.keys(previousYearConversions) : 'none');
      } else {
        logger.info('❌ No previous year data found (parallel path)');
      }
    } else {
      // Sequential database lookups for non-direct data path
      logger.info('📊 Using database-only path for PDF generation');
      if (reportType === 'weekly') {
        const previousWeekData = await fetchPreviousWeekDataFromDB(dateRange, clientId);
        if (previousWeekData) {
          previousMonthTotals = previousWeekData.previousWeekTotals;
          previousMonthConversions = previousWeekData.previousWeekConversions;
        }
      } else if (reportType === 'monthly') {
        const previousMonthData = await fetchPreviousMonthDataFromDB(dateRange, clientId);
        if (previousMonthData) {
          previousMonthTotals = previousMonthData.previousMonthTotals;
          previousMonthConversions = previousMonthData.previousMonthConversions;
        }
      } else if (reportType === 'custom') {
        logger.info('📊 Custom report: fetching previous month data for comparison (sequential path)');
        const previousMonthData = await fetchPreviousMonthDataFromDB(dateRange, clientId);
        if (previousMonthData) {
          previousMonthTotals = previousMonthData.previousMonthTotals;
          previousMonthConversions = previousMonthData.previousMonthConversions;
        }
      }
      
      const previousYearData = await fetchPreviousYearDataFromDB(dateRange, clientId);
      logger.info('🔍 Previous Year Data Fetch Result:', {
        hasData: !!previousYearData,
        dataType: previousYearData ? typeof previousYearData : 'null',
        dataKeys: previousYearData ? Object.keys(previousYearData) : 'none'
      });
      
      if (previousYearData) {
        previousYearTotals = previousYearData.previousYearTotals;
        previousYearConversions = previousYearData.previousYearConversions;
        logger.info('✅ Previous year data assigned to variables');
        logger.info('   previousYearTotals:', !!previousYearTotals);
        logger.info('   previousYearConversions:', !!previousYearConversions);
      } else {
        logger.info('❌ No previous year data returned from fetchPreviousYearDataFromDB');
      }
    }

    // Use Meta Ads tables data if provided directly, otherwise skip (avoid 401 error)
    if (!metaTablesData && directMetaTables) {
      logger.info('📊 Using provided Meta tables data for PDF generation');
      metaTablesData = directMetaTables;
      console.log(`   Placement: ${metaTablesData.placementPerformance?.length || 0} records`);
      console.log(`   Demographic: ${metaTablesData.demographicPerformance?.length || 0} records`);
      console.log(`   Ad Relevance: ${metaTablesData.adRelevanceResults?.length || 0} records`);
    } else if (!metaTablesData) {
      logger.info('⚠️ No Meta Ads tables data available for PDF generation - skipping Meta tables section');
    }

    // Fetch Google Ads tables data for PDF generation
    let googleAdsTablesData: any = null;
    try {
      logger.info('🔍 Fetching Google Ads tables data for PDF generation...');
      
      const googleAdsTablesResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/fetch-google-ads-tables`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          dateStart: dateRange.start,
          dateEnd: dateRange.end,
          clientId: clientId
        })
      });

      if (googleAdsTablesResponse.ok) {
        const googleAdsTablesResult = await googleAdsTablesResponse.json();
        if (googleAdsTablesResult.success && googleAdsTablesResult.data) {
          googleAdsTablesData = googleAdsTablesResult.data;
          logger.info('✅ Google Ads tables data fetched successfully for PDF');
          console.log(`   Network Performance: ${googleAdsTablesData.networkPerformance?.length || 0} records`);
          console.log(`   Device Performance: ${googleAdsTablesData.devicePerformance?.length || 0} records`);
          console.log(`   Keyword Performance: ${googleAdsTablesData.keywordPerformance?.length || 0} records`);
          console.log(`   Quality Metrics: ${googleAdsTablesData.qualityMetrics?.length || 0} records`);
        } else {
          logger.info('⚠️ Google Ads tables API returned no data');
        }
      } else {
        logger.info('⚠️ Google Ads tables API request failed:', googleAdsTablesResponse.status);
      }
    } catch (error) {
      logger.warn('⚠️ Error fetching Google Ads tables data for PDF:', error);
      // Continue without Google Ads tables data - this is not critical for PDF generation
    }

    // Fetch AI Executive Summary with caching
    let executiveSummary: string | undefined;
    try {
      logger.info('🤖 Fetching AI Executive Summary for PDF with caching...');
      
      const cacheService = ExecutiveSummaryCacheService.getInstance();
      
      // Check if summary exists in cache
      const cachedSummary = await cacheService.getCachedSummary(clientId, dateRange);
      
      if (cachedSummary) {
        executiveSummary = cachedSummary.content;
        logger.info('✅ Using cached AI Executive Summary');
      } else {
        logger.info('⚠️ No cached AI Executive Summary found, generating new one...');
        
        // Generate new AI summary (AI API now fetches its own data)
        const generateResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'}/api/generate-executive-summary`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            clientId,
            dateRange
            // Note: Removed reportData - AI API now fetches its own data from smart cache/database
          })
        });

        if (generateResponse.ok) {
          const generateData = await generateResponse.json();
          if (generateData.summary) {
            executiveSummary = generateData.summary;
            logger.info('✅ Generated new AI Executive Summary');
            
            // Save to cache if within retention period (12 months)
            if (cacheService.isWithinRetentionPeriod(dateRange)) {
              await cacheService.saveSummary(clientId, dateRange, generateData.summary);
              logger.info('💾 Saved AI Executive Summary to cache');
            } else {
              logger.info('⚠️ Summary not saved to cache (outside 12-month retention period)');
            }
          }
        } else {
          const errorData = await generateResponse.json().catch(() => ({}));
          
          // Handle skipSummary case - no platform data available
          if (errorData.skipSummary) {
            logger.info('⚠️ No platform data available for AI summary - skipping AI section in PDF');
            executiveSummary = undefined; // Explicitly set to undefined to skip AI section
          } else {
            logger.info('⚠️ Failed to generate AI Executive Summary:', errorData.error || 'Unknown error');
          }
        }
      }
    } catch (error) {
      logger.warn('Warning', error);
    }

    // Handle case where campaigns table is empty but campaign_summaries has data
    let finalTotals = calculatedTotals;
    let finalCampaigns = campaigns;
    
    if ((!campaigns || campaigns.length === 0) && reportType === 'monthly') {
      logger.info('🔍 Campaigns table empty, checking campaign_summaries for current period data...');
      
      // Try to get current period data from campaign_summaries
      const { data: currentSummary } = await supabase
        .from('campaign_summaries')
        .select('*')
        .eq('client_id', clientId)
        .eq('summary_type', 'monthly')
        .eq('summary_date', dateRange.start)
        .single();
        
      if (currentSummary) {
        logger.info('✅ Found current period data in campaign_summaries');
        
        // Use summary data for totals
        finalTotals = {
          spend: currentSummary.total_spend || 0,
          impressions: currentSummary.total_impressions || 0,
          clicks: currentSummary.total_clicks || 0,
          conversions: currentSummary.total_conversions || 0,
          ctr: currentSummary.average_ctr || 0,
          cpc: currentSummary.average_cpc || 0,
          cpm: currentSummary.total_impressions > 0 ? (currentSummary.total_spend / currentSummary.total_impressions) * 1000 : 0
        };
        
        // Use campaign data from summary
        finalCampaigns = currentSummary.campaign_data || [];
        
        logger.info('Data processing', finalTotals.spend, 'zł, Campaigns:', finalCampaigns.length);
      } else {
        logger.info('⚠️ No current period data found in campaign_summaries either');
      }
    }

    // Prepare report data
    const reportData: ReportData = {
      client,
      dateRange,
      campaigns: finalCampaigns,
      totals: finalTotals,
      previousMonthTotals,
      previousMonthConversions,
      previousWeekTotals: reportType === 'weekly' ? previousMonthTotals : undefined,
      previousWeekConversions: reportType === 'weekly' ? previousMonthConversions : undefined,
      previousYearTotals,
      previousYearConversions,
      metaTables: metaTablesData,
      googleAdsTables: googleAdsTablesData,
      executiveSummary,
      reportType,
      // Google Ads integration - PRODUCTION FIX: Ensure data is always present
      googleCampaigns: googleCampaigns || [],
      metaCampaigns: metaCampaigns || [],
      platformTotals,
      platform: detectedPlatform // Add platform information for HTML generation
    };

    // Production logging: Data summary before HTML generation
    logger.info('📊 [PRODUCTION] PDF Data Summary:', {
      metaCampaigns: metaCampaigns?.length || 0,
      googleCampaigns: googleCampaigns?.length || 0,
      reportDataGoogleCampaigns: reportData.googleCampaigns?.length || 0,
      hasPlatformTotals: !!reportData.platformTotals,
      totalSpend: reportData.platformTotals?.combined?.totalSpend || 0,
      htmlConditionCheck: !!(reportData.googleCampaigns && reportData.googleCampaigns.length > 0),
      googleCampaignsSample: googleCampaigns?.slice(0, 1),
      reportDataGoogleSample: reportData.googleCampaigns?.slice(0, 1)
    });

    logger.info('🎯 PDF Generation Data:', {
      client: reportData.client.name,
      dateRange: `${reportData.dateRange.start} to ${reportData.dateRange.end}`,
      campaigns: reportData.campaigns.length,
      spend: (reportData.totals.spend || 0).toFixed(2) + ' zł',
      impressions: (reportData.totals.impressions || 0).toLocaleString(),
      clicks: (reportData.totals.clicks || 0).toLocaleString(),
      hasMetaTables: !!reportData.metaTables,
      hasExecutiveSummary: !!reportData.executiveSummary,
      hasPreviousMonthData: !!reportData.previousMonthTotals,
      hasPreviousYearData: !!reportData.previousYearTotals,
      // Google Ads integration debugging
      hasGoogleCampaigns: !!reportData.googleCampaigns && reportData.googleCampaigns.length > 0,
      googleCampaignsCount: reportData.googleCampaigns?.length || 0,
      hasMetaCampaigns: !!reportData.metaCampaigns && reportData.metaCampaigns.length > 0,
      metaCampaignsCount: reportData.metaCampaigns?.length || 0,
      hasPlatformTotals: !!reportData.platformTotals,
      platformTotalsMeta: reportData.platformTotals?.meta ? 'present' : 'missing',
      platformTotalsGoogle: reportData.platformTotals?.google ? 'present' : 'missing',
      platformTotalsCombined: reportData.platformTotals?.combined ? 'present' : 'missing'
    });

    // 🚨 CRITICAL DEBUGGING FOR PERIOD COMPARISON
    logger.info('🚨 FINAL REPORT DATA STRUCTURE FOR COMPARISON:');
    logger.info('   Report Type:', reportData.reportType);
    logger.info('   Previous Month Totals Present:', !!reportData.previousMonthTotals);
    logger.info('   Previous Month Conversions Present:', !!reportData.previousMonthConversions);
    if (reportData.previousMonthTotals) {
      logger.info('   Previous Month Totals Content:', reportData.previousMonthTotals);
    }
    if (reportData.previousMonthConversions) {
      logger.info('   Previous Month Conversions Content:', reportData.previousMonthConversions);
    }

    // Detailed comparison data debug
    if (reportData.previousMonthTotals) {
      logger.info('📊 Previous Month Data Details:');
      logger.info('   Spend:', (reportData.previousMonthTotals.spend || 0).toFixed(2) + ' zł');
      logger.info('   Conversions:', reportData.previousMonthConversions?.reservations || 0);
      logger.info('   Impressions:', (reportData.previousMonthTotals.impressions || 0).toLocaleString());
    }
    if (reportData.previousYearTotals) {
      logger.info('📊 Previous Year Data Details:');
      logger.info('   Spend:', (reportData.previousYearTotals.spend || 0).toFixed(2) + ' zł');
      logger.info('   Conversions:', reportData.previousYearConversions?.reservations || 0);
      logger.info('   Impressions:', (reportData.previousYearTotals.impressions || 0).toLocaleString());
    }

    // Generate PDF HTML
    let html: string;
    try {
      logger.info('🔄 Generating PDF HTML...');
      html = generatePDFHTML(reportData);
      logger.info('✅ PDF HTML generated successfully');
    } catch (htmlError) {
      logger.error('❌ Error generating PDF HTML:', htmlError);
      throw htmlError;
    }

    // Generate PDF
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage'
      ]
    });

    const page = await browser.newPage();
    
    // Capture console logs from the PDF page
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'log') {
        logger.info(`📄 PDF Console: ${text}`);
      } else if (type === 'error') {
        logger.error(`📄 PDF Console Error: ${text}`);
      } else if (type === 'warn') {
        logger.warn(`📄 PDF Console Warning: ${text}`);
      }
    });
    
    // Capture page errors
    page.on('pageerror', (error) => {
      logger.error('📄 PDF Page Error:', error.message);
    });
    
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Wait for charts to render
    logger.info('⏳ Waiting for charts to render...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // Give Chart.js more time to render
    
    // Check if charts were rendered by looking for canvas elements
    const chartsInfo = await page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas');
      const hasChartJs = typeof (window as any).Chart !== 'undefined';
      return {
        canvasCount: canvases.length,
        hasChartJs,
        canvasIds: Array.from(canvases).map(c => c.id),
        chartJsInstances: hasChartJs ? ((window as any).Chart.instances?.length || 0) : 0
      };
    });
    
    logger.info('Data processing', chartsInfo);
    
    // Get console logs from the page
    const pageLogs = await page.evaluate(() => {
      return (window as any).consoleLogs || [];
    });
    logger.debug('Debug info', pageLogs);
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      }
    });

    await browser.close();

    logger.info('✅ PDF generated successfully');

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="raport-${client.name}-${dateRange.start}-${dateRange.end}.pdf"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    });

  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    logger.error('PDF Generation Error Details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      context: 'PDF generation failed'
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to generate PDF',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}