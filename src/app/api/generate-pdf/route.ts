import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import { ExecutiveSummaryCacheService } from '../../../lib/executive-summary-cache';

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

  // Function to determine if year-over-year comparison should be shown
  const shouldShowYearOverYear = (): boolean => {
    console.log('🔍 YEAR-OVER-YEAR VALIDATION DEBUG:');
    console.log('   Report Type:', reportData.reportType);
    console.log('   Previous Year Totals:', !!reportData.previousYearTotals);
    console.log('   Previous Year Conversions:', !!reportData.previousYearConversions);
    console.log('   Date Range:', reportData.dateRange);
    
    // Show for monthly reports OR custom reports that span reasonable periods
    if (reportData.reportType !== 'monthly' && reportData.reportType !== 'custom') {
      console.log('🚫 Year-over-year hidden: Not a monthly or custom report');
      return false;
    }
    
    // Must have previous year data
    if (!reportData.previousYearTotals || !reportData.previousYearConversions) {
      console.log('🚫 Year-over-year hidden: No previous year data');
      console.log('   Available totals keys:', reportData.previousYearTotals ? Object.keys(reportData.previousYearTotals) : 'none');
      console.log('   Available conversions keys:', reportData.previousYearConversions ? Object.keys(reportData.previousYearConversions) : 'none');
      return false;
    }
    
    // Check if we have meaningful comparison data (previous year must have spend)
    const currentSpend = reportData.totals.spend || 0;
    const previousSpend = reportData.previousYearTotals.spend || 0;
    
    console.log('   Current spend:', currentSpend);
    console.log('   Previous year spend:', previousSpend);
    
    // Show comparison if previous year has meaningful data (even if current is 0)
    // This handles cases where current period has no campaigns table data but summary data exists
    if (previousSpend <= 0) {
      console.log('🚫 Year-over-year hidden: No meaningful previous year data');
      return false;
    }
    
    console.log('✅ Year-over-year comparison shown: Previous year has meaningful data');
    return true;
  };

  // Function to determine if period-over-period comparison should be shown
  const shouldShowPeriodComparison = (): boolean => {
    console.log('🔍 PERIOD COMPARISON VALIDATION DEBUG:');
    console.log('   Report Type:', reportData.reportType);
    console.log('   Previous Month Totals:', !!reportData.previousMonthTotals);
    console.log('   Previous Month Conversions:', !!reportData.previousMonthConversions);
    
    // 🚨 ENHANCED DEBUGGING
    console.log('🚨 DETAILED VALIDATION DEBUG:');
    console.log('   previousMonthTotals value:', reportData.previousMonthTotals);
    console.log('   previousMonthConversions value:', reportData.previousMonthConversions);
    console.log('   Type check previousMonthTotals:', typeof reportData.previousMonthTotals);
    console.log('   Type check previousMonthConversions:', typeof reportData.previousMonthConversions);
    
    if (reportData.reportType === 'weekly') {
      // For weekly reports, check if we have previous week data (stored in previousMonthTotals)
      const hasData = !!(reportData.previousMonthTotals && reportData.previousMonthConversions);
      console.log('   Weekly comparison data available:', hasData);
      
      if (hasData && reportData.previousMonthTotals) {
        const previousSpend = reportData.previousMonthTotals.spend || 0;
        console.log('   Previous week spend:', previousSpend);
        
        if (previousSpend > 0) {
          console.log('   ✅ Weekly comparison shown: Previous week has meaningful data');
          return true;
        } else {
          console.log('   🚫 Weekly comparison hidden: Previous week has no spend');
          return false;
        }
      }
      
      return false;
    } else if (reportData.reportType === 'monthly' || reportData.reportType === 'custom') {
      const hasData = !!(reportData.previousMonthTotals && reportData.previousMonthConversions);
              console.log('   Monthly/Custom comparison data available:', hasData);
        
        // Show comparison if we have previous month data (regardless of current period data)
        if (hasData && reportData.previousMonthTotals) {
          const previousSpend = reportData.previousMonthTotals.spend || 0;
          console.log('   Previous period spend:', previousSpend);
          
          if (previousSpend > 0) {
            console.log(`   ✅ ${reportData.reportType} comparison shown: Previous period has meaningful data`);
            return true;
          } else {
            console.log(`   🚫 ${reportData.reportType} comparison hidden: Previous period has no spend`);
            return false;
          }
        }
        
        return false;
    }
    console.log('   No period comparison for this report type');
    return false;
    };

  // Function to get the period comparison label
  const getPeriodComparisonLabel = (): string => {
    if (reportData.reportType === 'weekly') {
      return 'vs poprzedni tydzień';
    } else if (reportData.reportType === 'monthly') {
      return 'vs poprzedni miesiąc';
    }
    return 'vs poprzedni okres';
  };



  // Generate summary section
  const generateSummarySection = (): string => {
    const summaryParts = [];
    
    // Build summary based on current period data
    const periodLabel = reportData.reportType === 'weekly' ? 'tygodniu' : 'miesiącu';
    const startDate = formatDate(reportData.dateRange.start);
    const endDate = formatDate(reportData.dateRange.end);
    
    summaryParts.push(`W ${periodLabel} od ${startDate} do ${endDate} wydaliśmy na kampanie reklamowe ${formatCurrency(totalSpend)}.`);
    
    if (totalImpressions > 0) {
      summaryParts.push(`Działania te zaowocowały ${formatNumber(totalImpressions)} wyświetleniami`);
      if (totalClicks > 0) {
        summaryParts.push(`a liczba kliknięć wyniosła ${formatNumber(totalClicks)}, co dało CTR na poziomie ${formatPercentage(ctr)}.`);
        summaryParts.push(`Średni koszt kliknięcia (CPC) wyniósł ${formatCurrency(cpc)}.`);
      } else {
        summaryParts.push('.');
      }
    }
    
    if (conversionMetrics.reservations > 0) {
      summaryParts.push(`W tym okresie zaobserwowaliśmy ${formatNumber(conversionMetrics.reservations)} konwersje, co przekłada się na koszt pozyskania konwersji (CPA) na poziomie ${formatCurrency(cost_per_reservation)}.`);
      if (conversionMetrics.reservation_value > 0) {
        summaryParts.push(`Wszystkie konwersje to rezerwacje, dzięki czemu koszt pozyskania rezerwacji również wyniósł ${formatCurrency(cost_per_reservation)}.`);
      }
    }
    
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

  // Calculate conversion metrics from campaigns
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

  // Calculate derived conversion metrics
  const roas = totalSpend > 0 && conversionMetrics.reservation_value > 0 
    ? conversionMetrics.reservation_value / totalSpend 
    : 0;
  const cost_per_reservation = conversionMetrics.reservations > 0 
    ? totalSpend / conversionMetrics.reservations 
    : 0;

  // Function to generate period comparison table
  const generatePeriodComparisonTable = (): string => {
    console.log('🔍 PERIOD COMPARISON TABLE GENERATION DEBUG:');
    console.log('   Previous month totals:', !!reportData.previousMonthTotals);
    console.log('   Previous month conversions:', !!reportData.previousMonthConversions);
    console.log('   Campaigns length:', reportData.campaigns.length);
    console.log('   Conversion metrics reservations:', conversionMetrics.reservations);
    console.log('   Conversion metrics reservation_value:', conversionMetrics.reservation_value);
    
    // TEMPORARY: Force show for debugging - always show if we have previous month data
    if (!reportData.previousMonthTotals) {
      console.log('   🚫 No previous month totals - returning empty string');
      return '';
    }
    
    console.log('   ✅ Generating period comparison table');
    
    const currentPeriodLabel = reportData.reportType === 'weekly' ? 'Bieżący tydzień' : 
                                reportData.reportType === 'custom' ? 'Bieżący okres' : 'Bieżący miesiąc';
    const previousPeriodLabel = reportData.reportType === 'weekly' ? 'Poprzedni tydzień' : 
                                reportData.reportType === 'custom' ? 'Poprzedni miesiąc' : 'Poprzedni miesiąc';
    
    return `
      <div class="period-comparison">
        <h3>Porównanie ${reportData.reportType === 'weekly' ? 'tydzień do tygodnia' : 
                          reportData.reportType === 'custom' ? 'okres do poprzedniego miesiąca' : 'miesiąc do miesiąca'}</h3>
        <table class="comparison-table">
          <thead>
            <tr>
              <th class="metric-name">Metryka</th>
              <th>${currentPeriodLabel}</th>
              <th>${previousPeriodLabel}</th>
              <th>Zmiana</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="metric-name">Wartość rezerwacji</td>
              <td class="current-period">${formatCurrency(conversionMetrics.reservation_value)}</td>
              <td class="previous-period">${formatCurrency(reportData.previousMonthConversions?.reservation_value || 0)}</td>
              <td class="period-change ${(() => {
                const prev = reportData.previousMonthConversions?.reservation_value || 0;
                if (prev === 0) return 'neutral';
                return conversionMetrics.reservation_value > prev ? 'positive' : 
                       conversionMetrics.reservation_value < prev ? 'negative' : 'neutral';
              })()}">
                ${(() => {
                  const prev = reportData.previousMonthConversions?.reservation_value || 0;
                  if (prev === 0) return '—';
                  const change = ((conversionMetrics.reservation_value - prev) / prev) * 100;
                  const arrow = change > 0 ? '↗' : change < 0 ? '↘' : '→';
                  const sign = change > 0 ? '+' : '';
                  return `${arrow} ${sign}${change.toFixed(1)}%`;
                })()}
              </td>
            </tr>
            <tr>
              <td class="metric-name">Wydatki</td>
              <td class="current-period">${formatCurrency(totalSpend)}</td>
              <td class="previous-period">${formatCurrency(reportData.previousMonthTotals?.spend || 0)}</td>
              <td class="period-change ${(() => {
                const prev = reportData.previousMonthTotals?.spend || 0;
                if (prev === 0) return 'neutral';
                return totalSpend > prev ? 'negative' : totalSpend < prev ? 'positive' : 'neutral';
              })()}">
                ${(() => {
                  const prev = reportData.previousMonthTotals?.spend || 0;
                  if (prev === 0) return '—';
                  const change = ((totalSpend - prev) / prev) * 100;
                  const arrow = change > 0 ? '↗' : change < 0 ? '↘' : '→';
                  const sign = change > 0 ? '+' : '';
                  return `${arrow} ${sign}${change.toFixed(1)}%`;
                })()}
              </td>
            </tr>
            <tr>
              <td class="metric-name">Koszt per rezerwacja</td>
              <td class="current-period">${cost_per_reservation > 0 ? formatCurrency(cost_per_reservation) : '—'}</td>
              <td class="previous-period">${(() => {
                const prevReservations = reportData.previousMonthConversions?.reservations || 0;
                const prevSpend = reportData.previousMonthTotals?.spend || 0;
                return prevReservations > 0 && prevSpend > 0 ? formatCurrency(prevSpend / prevReservations) : '—';
              })()}</td>
              <td class="period-change ${(() => {
                const prevReservations = reportData.previousMonthConversions?.reservations || 0;
                const prevSpend = reportData.previousMonthTotals?.spend || 0;
                if (cost_per_reservation <= 0 || prevReservations <= 0 || prevSpend <= 0) return 'neutral';
                const prevCostPerReservation = prevSpend / prevReservations;
                return cost_per_reservation > prevCostPerReservation ? 'negative' : 
                       cost_per_reservation < prevCostPerReservation ? 'positive' : 'neutral';
              })()}">
                ${(() => {
                  const prevReservations = reportData.previousMonthConversions?.reservations || 0;
                  const prevSpend = reportData.previousMonthTotals?.spend || 0;
                  if (cost_per_reservation <= 0 || prevReservations <= 0 || prevSpend <= 0) return '—';
                  const prevCostPerReservation = prevSpend / prevReservations;
                  const change = ((cost_per_reservation - prevCostPerReservation) / prevCostPerReservation) * 100;
                  const arrow = change > 0 ? '↗' : change < 0 ? '↘' : '→';
                  const sign = change > 0 ? '+' : '';
                  return `${arrow} ${sign}${change.toFixed(1)}%`;
                })()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  };

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

  // Process demographic data for charts
  const processDemographicData = () => {
    console.log('🔍 PDF: Processing demographic data:', {
      hasMetaTables: !!reportData.metaTables,
      hasDemographicData: !!reportData.metaTables?.demographicPerformance,
      demographicCount: reportData.metaTables?.demographicPerformance?.length || 0,
      sampleData: reportData.metaTables?.demographicPerformance?.slice(0, 2)
    });
    
    if (!reportData.metaTables?.demographicPerformance) {
      console.log('⚠️ PDF: No demographic data available for PDF generation');
      return { gender: [], age: [] };
    }
    
    const genderMap = new Map();
    const ageMap = new Map();
    
    reportData.metaTables.demographicPerformance.forEach(item => {
      // Gender aggregation
      const gender = item.gender === 'male' ? 'Mężczyźni' : 
                    item.gender === 'female' ? 'Kobiety' : 'Nieznana';
      
      if (genderMap.has(gender)) {
        const existing = genderMap.get(gender);
        existing.impressions += (item.impressions || 0);
        existing.clicks += (item.clicks || 0);
      } else {
        genderMap.set(gender, {
          gender,
          impressions: item.impressions || 0,
          clicks: item.clicks || 0
        });
      }
      
      // Age aggregation
      const age = item.age || 'Nieznany';
      if (ageMap.has(age)) {
        const existing = ageMap.get(age);
        existing.impressions += (item.impressions || 0);
        existing.clicks += (item.clicks || 0);
      } else {
        ageMap.set(age, {
          age,
          impressions: item.impressions || 0,
          clicks: item.clicks || 0
        });
      }
    });
    
    const result = {
      gender: Array.from(genderMap.values()),
      age: Array.from(ageMap.values()).sort((a, b) => {
        const ageA = parseInt(a.age.split('-')[0]) || 999;
        const ageB = parseInt(b.age.split('-')[0]) || 999;
        return ageA - ageB;
      })
    };
    
    console.log('✅ PDF: Processed demographic data result:', {
      genderCount: result.gender.length,
      ageCount: result.age.length,
      genderData: result.gender,
      ageData: result.age
    });
    
    return result;
  };

  const placementData = processPlacementData();
  const demographicData = processDemographicData();
  const topAds = reportData.metaTables?.adRelevanceResults?.slice(0, 10) || [];

  // Helper function to generate demographic data table
  const generateDemographicTable = (data: any[], metric: 'impressions' | 'clicks') => {
    if (!data || data.length === 0) return '';
    
    const total = data.reduce((sum, item) => sum + (item[metric] || 0), 0);
    
    return `
      <div style="margin-top: 16px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #f8f9fa; border-bottom: 1px solid #dee2e6;">
              <th style="padding: 8px; text-align: left; font-weight: 600;">${metric === 'impressions' ? 'Grupa' : 'Grupa'}</th>
              <th style="padding: 8px; text-align: right; font-weight: 600;">${metric === 'impressions' ? 'Wyświetlenia' : 'Kliknięcia'}</th>
              <th style="padding: 8px; text-align: right; font-weight: 600;">%</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(item => {
              const value = item[metric] || 0;
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
              const label = item.gender || item.age || 'Nieznana';
              return `
                <tr style="border-bottom: 1px solid #f1f3f4;">
                  <td style="padding: 6px 8px;">${label}</td>
                  <td style="padding: 6px 8px; text-align: right; font-weight: 500;">${value.toLocaleString('pl-PL')}</td>
                  <td style="padding: 6px 8px; text-align: right; color: #6b7280;">${percentage}%</td>
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
            }
            
            .container {
                max-width: 900px;
                margin: 0 auto;
                padding: 0;
            }
            
            /* Page 1 - Premium Cover */
            .cover-page {
                background: var(--bg-panel);
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
                background: var(--bg-panel);
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
                background: #FAFBFC;
            }
            
            .comparison-table tbody tr:last-child td {
                border-bottom: none;
            }
            
            .metric-name {
                font-weight: 600;
                color: var(--text-strong);
                text-align: left !important;
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
                background: var(--bg-panel);
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
                background: var(--bg-panel);
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
                background: var(--bg-panel);
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
                background: #FAFBFC;
            }
            
            .data-table tr:last-child td {
                border-bottom: none;
            }
            
            /* Demographics Charts */
            .chart-container {
                background: var(--bg-panel);
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
                body { background: white; }
                .container { padding: 0; }
                
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
                margin: 2cm;
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
                    <h1>Raport Meta Ads — ${reportData.client.name}</h1>
                    <h2>${formatDate(reportData.dateRange.start)} – ${formatDate(reportData.dateRange.end)}</h2>
                </div>
                
                <div class="cover-meta">
                    Źródło: Meta Ads API • Wygenerowano: ${new Date().toLocaleDateString('pl-PL')} ${new Date().toLocaleTimeString('pl-PL')}
                </div>
                
                <!-- Executive Summary -->
                <div class="cover-summary">
                    <h3>Podsumowanie</h3>
                    <div class="summary-content">
                        ${reportData.executiveSummary ? reportData.executiveSummary.trim() : generateSummarySection()}
                    </div>
                </div>
                
                <!-- Period-over-Period Comparison - Now shown inline with individual metrics -->
                
                <!-- Year-over-Year Comparison -->
                ${shouldShowYearOverYear() ? `
                
                <div class="year-comparison">
                    <h3>Porównanie rok do roku</h3>
                    <table class="comparison-table">
                        <thead>
                            <tr>
                                <th class="metric-name">Metryka</th>
                                <th>${new Date(reportData.dateRange.start).getFullYear()}</th>
                                <th>${new Date(reportData.dateRange.start).getFullYear() - 1}</th>
                                <th>Zmiana</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="metric-name">Wartość rezerwacji</td>
                                <td class="current-year">${formatCurrency(conversionMetrics.reservation_value)}</td>
                                <td class="previous-year">${formatCurrency(reportData.previousYearConversions!.reservation_value)}</td>
                                <td class="year-change ${reportData.previousYearConversions!.reservation_value > 0 ? (conversionMetrics.reservation_value > reportData.previousYearConversions!.reservation_value ? 'positive' : conversionMetrics.reservation_value < reportData.previousYearConversions!.reservation_value ? 'negative' : 'neutral') : 'neutral'}">
                                    ${reportData.previousYearConversions!.reservation_value > 0 ? 
                                        (() => {
                                            const change = ((conversionMetrics.reservation_value - reportData.previousYearConversions!.reservation_value) / reportData.previousYearConversions!.reservation_value) * 100;
                                            const arrow = change > 0 ? '↗' : change < 0 ? '↘' : '→';
                                            const sign = change > 0 ? '+' : '';
                                            return `${arrow} ${sign}${change.toFixed(1)}%`;
                                        })() :
                                        '—'
                                    }
                                </td>
                            </tr>
                            <tr>
                                <td class="metric-name">Wydatki</td>
                                <td class="current-year">${formatCurrency(totalSpend)}</td>
                                <td class="previous-year">${formatCurrency(reportData.previousYearTotals!.spend)}</td>
                                <td class="year-change ${reportData.previousYearTotals!.spend > 0 ? (totalSpend > reportData.previousYearTotals!.spend ? 'positive' : totalSpend < reportData.previousYearTotals!.spend ? 'negative' : 'neutral') : 'neutral'}">
                                    ${reportData.previousYearTotals!.spend > 0 ? 
                                        (() => {
                                            const change = ((totalSpend - reportData.previousYearTotals!.spend) / reportData.previousYearTotals!.spend) * 100;
                                            const arrow = change > 0 ? '↗' : change < 0 ? '↘' : '→';
                                            const sign = change > 0 ? '+' : '';
                                            return `${arrow} ${sign}${change.toFixed(1)}%`;
                                        })() :
                                        '—'
                                    }
                                </td>
                            </tr>
                            <tr>
                                <td class="metric-name">Koszt per rezerwacja</td>
                                <td class="current-year">${cost_per_reservation > 0 ? formatCurrency(cost_per_reservation) : '—'}</td>
                                <td class="previous-year">${reportData.previousYearConversions!.reservations > 0 && reportData.previousYearTotals!.spend > 0 ? formatCurrency(reportData.previousYearTotals!.spend / reportData.previousYearConversions!.reservations) : '—'}</td>
                                <td class="year-change ${cost_per_reservation > 0 && reportData.previousYearConversions!.reservations > 0 && reportData.previousYearTotals!.spend > 0 ? 
                                    (() => {
                                        const previousCostPerReservation = reportData.previousYearTotals!.spend / reportData.previousYearConversions!.reservations;
                                        return cost_per_reservation > previousCostPerReservation ? 'negative' : cost_per_reservation < previousCostPerReservation ? 'positive' : 'neutral';
                                    })() : 'neutral'}">
                                    ${cost_per_reservation > 0 && reportData.previousYearConversions!.reservations > 0 && reportData.previousYearTotals!.spend > 0 ? 
                                        (() => {
                                            const previousCostPerReservation = reportData.previousYearTotals!.spend / reportData.previousYearConversions!.reservations;
                                            const change = ((cost_per_reservation - previousCostPerReservation) / previousCostPerReservation) * 100;
                                            const arrow = change > 0 ? '↗' : change < 0 ? '↘' : '→';
                                            const sign = change > 0 ? '+' : '';
                                            return `${arrow} ${sign}${change.toFixed(1)}%`;
                                        })() :
                                        '—'
                                    }
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                ` : ''}
            </div>



            <!-- Page 2 - Performance & Conversion Metrics -->
            <div class="metrics-page page-break-before">
                <div class="metrics-column">
                    <h3>Wydajność kampanii</h3>
                    <div class="stat-list">
                        <div class="stat-item">
                            <span class="stat-label">Wydatki łączne</span>
                            ${formatStatValue(totalSpend, reportData.previousMonthTotals?.spend, formatCurrency)}
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Wyświetlenia</span>
                            ${formatStatValue(totalImpressions, reportData.previousMonthTotals?.impressions, formatNumber)}
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Kliknięcia</span>
                            ${formatStatValue(totalClicks, reportData.previousMonthTotals?.clicks, formatNumber)}
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Zasięg</span>
                            ${formatStatValue(reach, undefined, formatNumber)}
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">CTR</span>
                            ${formatStatValue(ctr, reportData.previousMonthTotals?.ctr, (val) => formatPercentage(val))}
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">CPC</span>
                            ${formatStatValue(cpc, reportData.previousMonthTotals?.cpc, formatCurrency)}
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">CPM</span>
                            ${formatStatValue(cpm, reportData.previousMonthTotals?.cpm, formatCurrency)}
                        </div>
                    </div>
                </div>
                
                <div class="metrics-column">
                    <h3>Statystyki konwersji</h3>
                    <div class="stat-list">
                        <div class="stat-item">
                            <span class="stat-label">Potencjalne kontakty – telefon</span>
                            ${formatConversionValue(conversionMetrics.click_to_call, reportData.previousMonthConversions?.click_to_call, formatNumber)}
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Potencjalne kontakty – e-mail</span>
                            ${formatConversionValue(conversionMetrics.email_contacts, reportData.previousMonthConversions?.email_contacts, formatNumber)}
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Kroki rezerwacji – Etap 1</span>
                            ${formatConversionValue(conversionMetrics.booking_step_1, reportData.previousMonthConversions?.booking_step_1, formatNumber)}
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Rezerwacje (zakończone)</span>
                            ${formatConversionValue(conversionMetrics.reservations, reportData.previousMonthConversions?.reservations, formatNumber)}
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Wartość rezerwacji (zł)</span>
                            ${formatConversionValue(conversionMetrics.reservation_value, reportData.previousMonthConversions?.reservation_value, formatCurrency)}
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">ROAS (x)</span>
                            ${roas > 0 ? 
                                formatStatValue(roas, 
                                  reportData.previousMonthConversions?.reservation_value && reportData.previousMonthTotals?.spend 
                                    ? reportData.previousMonthConversions.reservation_value / reportData.previousMonthTotals.spend 
                                    : undefined, 
                                  (val) => `${val.toFixed(2)}x`) :
                                `<span class="stat-not-configured">— <span class="stat-tooltip">i</span></span>`
                            }
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Koszt per rezerwacja (zł)</span>
                            ${cost_per_reservation > 0 ? 
                                formatStatValue(cost_per_reservation, 
                                  reportData.previousMonthConversions?.reservations && reportData.previousMonthTotals?.spend 
                                    ? reportData.previousMonthTotals.spend / reportData.previousMonthConversions.reservations 
                                    : undefined, 
                                  formatCurrency) :
                                `<span class="stat-not-configured">— <span class="stat-tooltip">i</span></span>`
                            }
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Etap 2 rezerwacji</span>
                            ${formatConversionValue(conversionMetrics.booking_step_2, reportData.previousMonthConversions?.booking_step_2, formatNumber)}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Page 3 - Demographics (Impressions) -->
            ${demographicData.gender.length > 0 || demographicData.age.length > 0 ? `
            <div class="section page-break-before">
                <div class="chart-container">
                    <div class="chart-title">Demografia – Wyświetlenia</div>
                    <div class="charts-grid">
                        ${demographicData.gender.length > 0 ? `
                        <div class="chart-section">
                            <h4>Podział według płci</h4>
                            <canvas id="genderImpressionsChart" width="250" height="250"></canvas>
                            ${generateDemographicTable(demographicData.gender, 'impressions')}
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
                            <canvas id="ageImpressionsChart" width="250" height="250"></canvas>
                            ${generateDemographicTable(demographicData.age, 'impressions')}
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
                </div>
            </div>
            ` : `
            <div class="section page-break-before">
                <div class="chart-container">
                    <div class="chart-title">Demografia – Wyświetlenia</div>
                    <div style="text-align: center; padding: 40px; color: #6c757d;">
                        <p>Brak danych demograficznych dla tego okresu.</p>
                        <p style="font-size: 14px; margin-top: 8px;">Dane demograficzne będą dostępne po zebraniu wystarczającej liczby wyświetleń.</p>
                    </div>
                </div>
            </div>
            `}

            <!-- Page 4 - Demographics (Clicks) -->
            ${demographicData.gender.length > 0 || demographicData.age.length > 0 ? `
            <div class="section page-break-before">
                <div class="chart-container">
                    <div class="chart-title">Demografia – Kliknięcia</div>
                    <div class="charts-grid">
                        ${demographicData.gender.length > 0 ? `
                        <div class="chart-section">
                            <h4>Podział według płci</h4>
                            <canvas id="genderClicksChart" width="250" height="250"></canvas>
                            ${generateDemographicTable(demographicData.gender, 'clicks')}
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
                            <canvas id="ageClicksChart" width="250" height="250"></canvas>
                            ${generateDemographicTable(demographicData.age, 'clicks')}
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
                </div>
            </div>
            ` : `
            <div class="section">
                <div class="chart-container">
                    <div class="chart-title">Demografia – Kliknięcia</div>
                    <div style="text-align: center; padding: 40px; color: #6c757d;">
                        <p>Brak danych demograficznych dla tego okresu.</p>
                        <p style="font-size: 14px; margin-top: 8px;">Dane demograficzne będą dostępne po zebraniu wystarczającej liczby kliknięć.</p>
                    </div>
                </div>
            </div>
            `}

            <!-- Top Placement Performance -->
            ${placementData.length > 0 ? `
            <div class="section page-break-before">
                <div class="section-title">Top Placement Performance</div>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>PLACEMENT</th>
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
                <div class="section-title">Ad Relevance & Results</div>
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

            <!-- Campaign Details -->
            <div class="section">
                <div class="section-title">Szczegóły kampanii</div>
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
                            ${reportData.campaigns.map((campaign: any) => {
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

            <!-- Methodology -->
            <div class="section">
                <div class="methodology">
                    <h3>Metodologia i przypisy</h3>
                    <p><strong>Źródło:</strong> Meta Ads API, czas pobrania danych: ${new Date().toISOString()} (UTC)</p>
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
        // Demographic data from server
        const demographicData = ${JSON.stringify(demographicData)};
        
        // Color schemes
        const genderColors = ['#8B5CF6', '#3B82F6', '#6B7280']; // Purple, Blue, Gray
        const ageColors = ['#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444', '#6B7280', '#F97316']; // Orange, Green, Blue, Purple, Red, Gray, Orange
        
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
        console.log('🔍 PDF: Demographic data:', demographicData);
        
        // Gender Impressions Chart
        try {
            if (demographicData.gender && demographicData.gender.length > 0) {
                const canvas1 = document.getElementById('genderImpressionsChart');
                if (canvas1) {
                    console.log('✅ PDF: Found genderImpressionsChart canvas');
                    const ctx1 = canvas1.getContext('2d');
                    new Chart(ctx1, {
                        type: 'pie',
                        data: {
                            labels: demographicData.gender.map(g => g.gender),
                            datasets: [{
                                data: demographicData.gender.map(g => g.impressions),
                                backgroundColor: genderColors,
                                borderWidth: 2,
                                borderColor: '#fff'
                            }]
                        },
                        options: chartOptions
                    });
                    console.log('✅ PDF: Gender impressions chart created');
                } else {
                    console.log('❌ PDF: genderImpressionsChart canvas not found');
                }
            } else {
                console.log('⚠️ PDF: No gender data available');
            }
        } catch (error) {
            console.error('❌ PDF: Error creating gender impressions chart:', error);
        }
        
        // Age Impressions Chart
        try {
            if (demographicData.age && demographicData.age.length > 0) {
                const canvas2 = document.getElementById('ageImpressionsChart');
                if (canvas2) {
                    console.log('✅ PDF: Found ageImpressionsChart canvas');
                    const ctx2 = canvas2.getContext('2d');
                    new Chart(ctx2, {
                        type: 'pie',
                        data: {
                            labels: demographicData.age.map(a => a.age),
                            datasets: [{
                                data: demographicData.age.map(a => a.impressions),
                                backgroundColor: ageColors,
                                borderWidth: 2,
                                borderColor: '#fff'
                            }]
                        },
                        options: chartOptions
                    });
                    console.log('✅ PDF: Age impressions chart created');
                } else {
                    console.log('❌ PDF: ageImpressionsChart canvas not found');
                }
            } else {
                console.log('⚠️ PDF: No age data available');
            }
        } catch (error) {
            console.error('❌ PDF: Error creating age impressions chart:', error);
        }
        
        // Gender Clicks Chart
        try {
            if (demographicData.gender && demographicData.gender.length > 0) {
                const canvas3 = document.getElementById('genderClicksChart');
                if (canvas3) {
                    console.log('✅ PDF: Found genderClicksChart canvas');
                    const ctx3 = canvas3.getContext('2d');
                    new Chart(ctx3, {
                        type: 'pie',
                        data: {
                            labels: demographicData.gender.map(g => g.gender),
                            datasets: [{
                                data: demographicData.gender.map(g => g.clicks),
                                backgroundColor: genderColors,
                                borderWidth: 2,
                                borderColor: '#fff'
                            }]
                        },
                        options: chartOptions
                    });
                    console.log('✅ PDF: Gender clicks chart created');
                } else {
                    console.log('❌ PDF: genderClicksChart canvas not found');
                }
            }
        } catch (error) {
            console.error('❌ PDF: Error creating gender clicks chart:', error);
        }
        
        // Age Clicks Chart
        try {
            if (demographicData.age && demographicData.age.length > 0) {
                const canvas4 = document.getElementById('ageClicksChart');
                if (canvas4) {
                    console.log('✅ PDF: Found ageClicksChart canvas');
                    const ctx4 = canvas4.getContext('2d');
                    new Chart(ctx4, {
                        type: 'pie',
                        data: {
                            labels: demographicData.age.map(a => a.age),
                            datasets: [{
                                data: demographicData.age.map(a => a.clicks),
                                backgroundColor: ageColors,
                                borderWidth: 2,
                                borderColor: '#fff'
                            }]
                        },
                        options: chartOptions
                    });
                    console.log('✅ PDF: Age clicks chart created');
                } else {
                    console.log('❌ PDF: ageClicksChart canvas not found');
                }
            }
        } catch (error) {
            console.error('❌ PDF: Error creating age clicks chart:', error);
        }
        
        console.log('🔍 PDF: Chart generation completed');
        </script>
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
    console.log('📊 Detected: WEEKLY report');
    return 'weekly';
  }
  if (daysDiff >= 28 && daysDiff <= 31) {
    console.log('📊 Detected: MONTHLY report');
    return 'monthly';
  }
  
  console.log('📊 Detected: CUSTOM report');
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
  
  console.log('📅 Previous week calculation:');
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
  const day = dateParts[2]!;
  
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
  
  console.log('📅 Date calculation:');
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
  const day = dateParts[2]!;
  
  // Calculate previous year (same month)
  const previousYear = year - 1;
  
  // Format as YYYY-MM-DD (always first day of month)
  const previousYearStart = `${previousYear}-${month.toString().padStart(2, '0')}-01`;
  
  // Calculate last day of the month in previous year
  const lastDayOfPreviousYearMonth = new Date(previousYear, month, 0).getDate();
  const previousYearEnd = `${previousYear}-${month.toString().padStart(2, '0')}-${lastDayOfPreviousYearMonth.toString().padStart(2, '0')}`;
  
  console.log('📅 Previous year calculation:');
  console.log(`   Current: ${dateRange.start} (Year: ${year}, Month: ${month})`);
  console.log(`   Previous year: ${previousYearStart} (Year: ${previousYear}, Month: ${month})`);
  
  return {
    start: previousYearStart,
    end: previousYearEnd
  };
}

// Helper function to fetch previous year data from database (fast lookup)
async function fetchPreviousYearDataFromDB(dateRange: { start: string; end: string }, clientId: string) {
  try {
    console.log('📊 Fetching previous year data from database (fast lookup)...');
    const previousYearDateRange = getPreviousYearDateRange(dateRange);
    console.log('   Previous year range:', previousYearDateRange);

    // Query campaign_summaries table for stored monthly data from previous year
    const { data: storedSummary, error } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', clientId)
      .eq('summary_type', 'monthly')
      .eq('summary_date', previousYearDateRange.start)
      .single();

    if (error) {
      console.log('⚠️ No stored summary found for previous year:', error.message);
      return null;
    }

    if (storedSummary) {
      console.log(`✅ Found stored summary for ${previousYearDateRange.start}`);
      
      // Extract campaign data for conversion calculations
      const previousYearCampaigns = storedSummary.campaign_data || [];
      console.log(`   Previous year campaigns from summary: ${previousYearCampaigns.length}`);

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

      const previousYearTotalsFormatted = {
        spend: storedSummary.total_spend,
        impressions: storedSummary.total_impressions,
        clicks: storedSummary.total_clicks,
        conversions: storedSummary.total_conversions,
        ctr: storedSummary.average_ctr,
        cpc: storedSummary.average_cpc,
        cpm: storedSummary.total_impressions > 0 ? (storedSummary.total_spend / storedSummary.total_impressions) * 1000 : 0
      };

      const previousYearConversions = {
        click_to_call: previousYearTotals.click_to_call,
        email_contacts: previousYearTotals.email_contacts,
        booking_step_1: previousYearTotals.booking_step_1,
        reservations: previousYearTotals.reservations,
        reservation_value: previousYearTotals.reservation_value,
        booking_step_2: previousYearTotals.booking_step_2,
      };

      console.log('✅ Previous year data loaded from database:', {
        spend: previousYearTotalsFormatted.spend,
        conversions: previousYearTotalsFormatted.conversions,
        reservations: previousYearConversions.reservations,
        reservation_value: previousYearConversions.reservation_value,
        source: 'database'
      });

      return { previousYearTotals: previousYearTotalsFormatted, previousYearConversions };
    }
    
    console.log('⚠️ No previous year data found in database');
    return null;
  } catch (error) {
    console.log('⚠️ Previous year database lookup failed:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Helper function to fetch previous week data from database (fast lookup)
async function fetchPreviousWeekDataFromDB(dateRange: { start: string; end: string }, clientId: string) {
  try {
    console.log('📊 Fetching previous week data from database (fast lookup)...');
    const previousDateRange = getPreviousWeekDateRange(dateRange);
    console.log('   Previous week range:', previousDateRange);

    // Query campaign_summaries table for stored weekly data
    const { data: storedSummary, error } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', clientId)
      .eq('summary_type', 'weekly')
      .eq('summary_date', previousDateRange.start)
      .single();

    if (error) {
      console.log('⚠️ No stored weekly summary found for previous week:', error.message);
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

      console.log('✅ Previous week data loaded from database:', {
        spend: previousWeekTotals.spend,
        conversions: previousWeekTotals.conversions,
        source: 'database'
      });

      return { previousWeekTotals, previousWeekConversions };
    }
    
    console.log('⚠️ No previous week data found in database');
    return null;
  } catch (error) {
    console.log('⚠️ Weekly database lookup failed:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Helper function to fetch previous month data from database (fast lookup)
async function fetchPreviousMonthDataFromDB(dateRange: { start: string; end: string }, clientId: string) {
  try {
    console.log('📊 Fetching previous month data from database (fast lookup)...');
    const previousDateRange = getPreviousMonthDateRange(dateRange);
    console.log('   Previous month range:', previousDateRange);

    // Query campaign_summaries table for stored monthly data
    const { data: storedSummary, error } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', clientId)
      .eq('summary_type', 'monthly')
      .eq('summary_date', previousDateRange.start)
      .single();

    if (error) {
      console.log('⚠️ No stored summary found for previous month:', error.message);
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

      console.log('✅ Previous month data loaded from database:', {
        spend: previousMonthTotals.spend,
        conversions: previousMonthTotals.conversions,
        source: 'database'
      });

      return { previousMonthTotals, previousMonthConversions };
    }
    
    console.log('⚠️ No previous month data found in database');
    return null;
  } catch (error) {
    console.log('⚠️ Database lookup failed:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

export async function POST(request: NextRequest) {
  console.log('📄 PDF Generation Request Started');

  try {
    // Extract the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    const { clientId, dateRange, campaigns: directCampaigns, totals: directTotals, client: directClient, metaTables: directMetaTables } = await request.json();

    if (!clientId || !dateRange) {
      return NextResponse.json({ error: 'Client ID and date range are required' }, { status: 400 });
    }

    console.log('🔍 PDF Generation Request:', { clientId, dateRange });

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
    console.log('✅ Client found:', client.name);

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
        console.log('📊 Custom report: fetching previous month data for comparison');
        previousPeriodPromise = fetchPreviousMonthDataFromDB(dateRange, clientId);
      }
      
      previousYearPromise = fetchPreviousYearDataFromDB(dateRange, clientId);
    }

    // If we have direct data, use it (much faster)
    if (directCampaigns && directTotals) {
      console.log('🚀 Using direct data for fast PDF generation');
      campaigns = directCampaigns;
      calculatedTotals = directTotals;
      console.log(`   Campaigns: ${campaigns.length}`);
      console.log(`   Total Spend: ${calculatedTotals.spend} zł`);
      
      // Use direct Meta tables data if available
      if (directMetaTables) {
        console.log('📊 Using direct Meta tables data for fast PDF generation');
        metaTablesData = directMetaTables;
        console.log(`   Placement: ${metaTablesData.placementPerformance?.length || 0} records`);
        console.log(`   Demographic: ${metaTablesData.demographicPerformance?.length || 0} records`);
        console.log(`   Ad Relevance: ${metaTablesData.adRelevanceResults?.length || 0} records`);
      }
    } else {
      // Fallback to API call (slower)
      console.log('📡 Using dashboard API call for consistent data...');
      
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'}/api/fetch-live-data`, {
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
            clientId: clientId
          })
        });

        if (response.ok) {
          const data = await response.json();
          console.log('📄 PDF Generation - API response:', {
            success: data.success,
            campaignsCount: data.data?.campaigns?.length || 0,
            stats: data.data?.stats,
            dateRange: data.data?.dateRange
          });
          
          if (data.success && data.data?.campaigns) {
            campaigns = data.data.campaigns;
            console.log('✅ Using dashboard API data for PDF generation');
            console.log(`   Campaigns: ${campaigns.length}`);
            console.log(`   Total Spend: ${data.data.stats.totalSpend} zł`);
          } else {
            console.log('⚠️ Dashboard API returned no data');
          }
        } else {
          console.log('⚠️ Dashboard API call failed');
        }
      } catch (error) {
        console.log('⚠️ Dashboard API call error');
      }
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
      
          console.log('🔍 COMPARISON DATA RESULTS:');
    console.log('   Previous Period Data:', !!previousPeriodData);
    console.log('   Previous Year Data:', !!previousYearData);
    
    // Enhanced debugging for period comparison issue
    console.log('🚨 PERIOD COMPARISON DEBUG - ENHANCED:');
    console.log('   Report Type:', reportType);
    console.log('   Previous Period Promise Result:', previousPeriodData);
    if (previousPeriodData) {
      console.log('   Previous Period Data Structure:');
      console.log('      Weekly totals:', previousPeriodData.previousWeekTotals);
      console.log('      Monthly totals:', previousPeriodData.previousMonthTotals);
      console.log('      Weekly conversions:', previousPeriodData.previousWeekConversions);
      console.log('      Monthly conversions:', previousPeriodData.previousMonthConversions);
    }
    
    if (previousPeriodData) {
        if (reportType === 'weekly') {
          // For weekly reports, use previous week data
          previousMonthTotals = previousPeriodData.previousWeekTotals;
          previousMonthConversions = previousPeriodData.previousWeekConversions;
          console.log('✅ Using previous week data for weekly PDF comparisons');
          console.log('   Week totals:', previousMonthTotals);
          console.log('   Week conversions:', previousMonthConversions);
        } else if (reportType === 'monthly') {
          // For monthly reports, use previous month data
          previousMonthTotals = previousPeriodData.previousMonthTotals;
          previousMonthConversions = previousPeriodData.previousMonthConversions;
          console.log('✅ Using previous month data for monthly PDF comparisons');
          console.log('   Month totals:', previousMonthTotals);
          console.log('   Month conversions:', previousMonthConversions);
        } else if (reportType === 'custom') {
          // For custom reports, use previous month data for comparison
          previousMonthTotals = previousPeriodData.previousMonthTotals;
          previousMonthConversions = previousPeriodData.previousMonthConversions;
          console.log('✅ Using previous month data for custom PDF comparisons');
          console.log('   Month totals:', previousMonthTotals);
          console.log('   Month conversions:', previousMonthConversions);
        }
      } else {
        console.log('❌ No previous period data found');
      }
      
      if (previousYearData) {
        previousYearTotals = previousYearData.previousYearTotals;
        previousYearConversions = previousYearData.previousYearConversions;
        console.log('✅ Previous year data loaded');
        console.log('   Year totals:', previousYearTotals);
        console.log('   Year conversions:', previousYearConversions);
      } else {
        console.log('❌ No previous year data found');
      }
    } else {
      // Sequential database lookups for non-direct data path
      console.log('📊 Using database-only path for PDF generation');
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
        console.log('📊 Custom report: fetching previous month data for comparison (sequential path)');
        const previousMonthData = await fetchPreviousMonthDataFromDB(dateRange, clientId);
        if (previousMonthData) {
          previousMonthTotals = previousMonthData.previousMonthTotals;
          previousMonthConversions = previousMonthData.previousMonthConversions;
        }
      }
      
      const previousYearData = await fetchPreviousYearDataFromDB(dateRange, clientId);
      if (previousYearData) {
        previousYearTotals = previousYearData.previousYearTotals;
        previousYearConversions = previousYearData.previousYearConversions;
      }
    }

    // Use Meta Ads tables data if provided directly, otherwise skip (avoid 401 error)
    if (!metaTablesData && directMetaTables) {
      console.log('📊 Using provided Meta tables data for PDF generation');
      metaTablesData = directMetaTables;
      console.log(`   Placement: ${metaTablesData.placementPerformance?.length || 0} records`);
      console.log(`   Demographic: ${metaTablesData.demographicPerformance?.length || 0} records`);
      console.log(`   Ad Relevance: ${metaTablesData.adRelevanceResults?.length || 0} records`);
    } else if (!metaTablesData) {
      console.log('⚠️ No Meta Ads tables data available for PDF generation - skipping Meta tables section');
    }

    // Fetch AI Executive Summary with caching
    let executiveSummary: string | undefined;
    try {
      console.log('🤖 Fetching AI Executive Summary for PDF with caching...');
      
      const cacheService = ExecutiveSummaryCacheService.getInstance();
      
      // Check if summary exists in cache
      const cachedSummary = await cacheService.getCachedSummary(clientId, dateRange);
      
      if (cachedSummary) {
        executiveSummary = cachedSummary.content;
        console.log('✅ Using cached AI Executive Summary');
      } else {
        console.log('⚠️ No cached AI Executive Summary found, generating new one...');
        
        // Generate new AI summary
        const generateResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'}/api/generate-executive-summary`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            clientId,
            dateRange,
            reportData: {
              account_summary: {
                total_spend: calculatedTotals.spend,
                total_impressions: calculatedTotals.impressions,
                total_clicks: calculatedTotals.clicks,
                total_conversions: calculatedTotals.conversions,
                average_ctr: calculatedTotals.ctr,
                average_cpc: calculatedTotals.cpc,
                average_cpa: calculatedTotals.conversions > 0 ? calculatedTotals.spend / calculatedTotals.conversions : 0,
                total_conversion_value: 0, // Will be calculated if available
                roas: 0, // Will be calculated if available
                micro_conversions: 0 // Will be calculated if available
              }
            }
          })
        });

        if (generateResponse.ok) {
          const generateData = await generateResponse.json();
          if (generateData.summary) {
            executiveSummary = generateData.summary;
            console.log('✅ Generated new AI Executive Summary');
            
            // Save to cache if within retention period (12 months)
            if (cacheService.isWithinRetentionPeriod(dateRange)) {
              await cacheService.saveSummary(clientId, dateRange, generateData.summary);
              console.log('💾 Saved AI Executive Summary to cache');
            } else {
              console.log('⚠️ Summary not saved to cache (outside 12-month retention period)');
            }
          }
        } else {
          console.log('⚠️ Failed to generate AI Executive Summary');
        }
      }
    } catch (error) {
      console.log('⚠️ Error fetching/generating AI Executive Summary:', error);
    }

    // Handle case where campaigns table is empty but campaign_summaries has data
    let finalTotals = calculatedTotals;
    let finalCampaigns = campaigns;
    
    if ((!campaigns || campaigns.length === 0) && reportType === 'monthly') {
      console.log('🔍 Campaigns table empty, checking campaign_summaries for current period data...');
      
      // Try to get current period data from campaign_summaries
      const { data: currentSummary } = await supabase
        .from('campaign_summaries')
        .select('*')
        .eq('client_id', clientId)
        .eq('summary_type', 'monthly')
        .eq('summary_date', dateRange.start)
        .single();
        
      if (currentSummary) {
        console.log('✅ Found current period data in campaign_summaries');
        
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
        
        console.log('📊 Using campaign_summaries data - Spend:', finalTotals.spend, 'zł, Campaigns:', finalCampaigns.length);
      } else {
        console.log('⚠️ No current period data found in campaign_summaries either');
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
      executiveSummary,
      reportType
    };

    console.log('🎯 PDF Generation Data:', {
      client: reportData.client.name,
      dateRange: `${reportData.dateRange.start} to ${reportData.dateRange.end}`,
      campaigns: reportData.campaigns.length,
      spend: (reportData.totals.spend || 0).toFixed(2) + ' zł',
      impressions: (reportData.totals.impressions || 0).toLocaleString(),
      clicks: (reportData.totals.clicks || 0).toLocaleString(),
      hasMetaTables: !!reportData.metaTables,
      hasExecutiveSummary: !!reportData.executiveSummary,
      hasPreviousMonthData: !!reportData.previousMonthTotals,
      hasPreviousYearData: !!reportData.previousYearTotals
    });

    // 🚨 CRITICAL DEBUGGING FOR PERIOD COMPARISON
    console.log('🚨 FINAL REPORT DATA STRUCTURE FOR COMPARISON:');
    console.log('   Report Type:', reportData.reportType);
    console.log('   Previous Month Totals Present:', !!reportData.previousMonthTotals);
    console.log('   Previous Month Conversions Present:', !!reportData.previousMonthConversions);
    if (reportData.previousMonthTotals) {
      console.log('   Previous Month Totals Content:', reportData.previousMonthTotals);
    }
    if (reportData.previousMonthConversions) {
      console.log('   Previous Month Conversions Content:', reportData.previousMonthConversions);
    }

    // Detailed comparison data debug
    if (reportData.previousMonthTotals) {
      console.log('📊 Previous Month Data Details:');
      console.log('   Spend:', (reportData.previousMonthTotals.spend || 0).toFixed(2) + ' zł');
      console.log('   Conversions:', reportData.previousMonthConversions?.reservations || 0);
      console.log('   Impressions:', (reportData.previousMonthTotals.impressions || 0).toLocaleString());
    }
    if (reportData.previousYearTotals) {
      console.log('📊 Previous Year Data Details:');
      console.log('   Spend:', (reportData.previousYearTotals.spend || 0).toFixed(2) + ' zł');
      console.log('   Conversions:', reportData.previousYearConversions?.reservations || 0);
      console.log('   Impressions:', (reportData.previousYearTotals.impressions || 0).toLocaleString());
    }

    // Generate PDF HTML
    const html = generatePDFHTML(reportData);

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
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Wait for charts to render
    console.log('⏳ Waiting for charts to render...');
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
    
    console.log('📊 Charts status:', chartsInfo);
    
    // Get console logs from the page
    const pageLogs = await page.evaluate(() => {
      return (window as any).consoleLogs || [];
    });
    console.log('🔍 Page console logs:', pageLogs);
    
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

    console.log('✅ PDF generated successfully');

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="raport-${client.name}-${dateRange.start}-${dateRange.end}.pdf"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    });

  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
} 