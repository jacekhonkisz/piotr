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

  // Polish number formatting
  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return '0,00 zł';
    return `${value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, '\u00A0')} zł`;
  };

  const formatNumber = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return '0';
    return value.toLocaleString('pl-PL').replace(/\s/g, '\u00A0');
  };

  const formatNumberShort = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return '0';
    if (value >= 1000000) return `${(value / 1000000).toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).replace(/\s/g, '\u00A0')}M`;
    if (value >= 1000) return `${(value / 1000).toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).replace(/\s/g, '\u00A0')}k`;
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
                padding: 32px;
            }
            
            /* Page 1 - Premium Cover */
            .cover-page {
                background: var(--bg-panel);
                border-radius: 16px;
                padding: 64px 48px;
                text-align: center;
                margin-bottom: 48px;
                min-height: 70vh;
                display: flex;
                flex-direction: column;
                justify-content: center;
                position: relative;
            }
            
            .logo-slot {
                position: absolute;
                top: 32px;
                left: 32px;
                width: 96px;
                height: 96px;
                border: 2px dashed var(--border-soft);
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                color: var(--text-muted);
            }
            
            .logo-image {
                position: absolute;
                top: 32px;
                left: 32px;
                width: 96px;
                height: 96px;
                object-fit: contain;
                border-radius: 8px;
                background: white;
                padding: 4px;
                border: 1px solid var(--border-soft);
            }
            
            .cover-title {
                margin-bottom: 48px;
            }
            
            .cover-title h1 {
                font-size: 36px;
                font-weight: 700;
                color: var(--text-strong);
                margin-bottom: 16px;
                letter-spacing: -0.02em;
            }
            
            .cover-title h2 {
                font-size: 24px;
                font-weight: 600;
                color: var(--text-muted);
                margin-bottom: 8px;
            }
            
            .cover-meta {
                font-size: 14px;
                color: var(--text-muted);
                margin-bottom: 48px;
            }
            
            /* KPI Row for Cover */
            .cover-kpi-row {
                display: flex;
                justify-content: center;
                gap: 32px;
                flex-wrap: wrap;
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
                margin-bottom: 4px;
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
                margin-top: 48px;
                text-align: left;
            }
            
            .cover-summary h3 {
                font-size: 20px;
                font-weight: 600;
                color: var(--text-strong);
                margin-bottom: 24px;
            }
            
            .summary-content {
                font-size: 16px;
                line-height: 1.7;
                color: var(--text-muted);
                max-width: 700px;
                margin: 0 auto;
            }
            
            .summary-content p {
                margin-bottom: 16px;
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
                ${reportData.executiveSummary ? `
                <div class="cover-summary">
                    <h3>Podsumowanie</h3>
                    <div class="summary-content">
                        ${reportData.executiveSummary.trim()}
                    </div>
                </div>
                ` : ''}
            </div>

            <!-- KPI Overview -->
            <div class="section">
                <div class="kpi-overview">
                    <div class="cover-kpi-row">
                        <div class="cover-kpi">
                            <span class="cover-kpi-value">${formatCurrency(totalSpend)}</span>
                            <div class="cover-kpi-label">Wydatki</div>
                        </div>
                        <div class="cover-kpi">
                            <span class="cover-kpi-value">${formatNumberShort(totalImpressions)}</span>
                            <div class="cover-kpi-label">Wyświetlenia</div>
                        </div>
                        <div class="cover-kpi">
                            <span class="cover-kpi-value">${formatNumberShort(totalClicks)}</span>
                            <div class="cover-kpi-label">Kliknięcia</div>
                        </div>
                        <div class="cover-kpi">
                            <span class="cover-kpi-value">${formatPercentage(ctr)}</span>
                            <div class="cover-kpi-label">CTR</div>
                        </div>
                        <div class="cover-kpi">
                            <span class="cover-kpi-value">${formatCurrency(cpc)}</span>
                            <div class="cover-kpi-label">CPC</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Page 2 - Performance & Conversion Metrics -->
            <div class="metrics-page">
                <div class="metrics-column">
                    <h3>Wydajność kampanii</h3>
                    <div class="stat-list">
                        <div class="stat-item">
                            <span class="stat-label">Wydatki łączne</span>
                            <span class="stat-value">${formatCurrency(totalSpend)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Wyświetlenia</span>
                            <span class="stat-value">${formatNumber(totalImpressions)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Kliknięcia</span>
                            <span class="stat-value">${formatNumber(totalClicks)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Zasięg</span>
                            <span class="stat-value">${formatNumber(reach)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">CTR</span>
                            <span class="stat-value">${formatPercentage(ctr)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">CPC</span>
                            <span class="stat-value">${formatCurrency(cpc)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">CPM</span>
                            <span class="stat-value">${formatCurrency(cpm)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="metrics-column">
                    <h3>Statystyki konwersji</h3>
                    <div class="stat-list">
                        <div class="stat-item">
                            <span class="stat-label">Potencjalne kontakty – telefon</span>
                            ${conversionMetrics.click_to_call > 0 ? 
                                `<span class="stat-value">${formatNumber(conversionMetrics.click_to_call)}</span>` :
                                `<span class="stat-not-configured">— <span class="stat-tooltip">i</span></span>`
                            }
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Potencjalne kontakty – e-mail</span>
                            ${conversionMetrics.email_contacts > 0 ? 
                                `<span class="stat-value">${formatNumber(conversionMetrics.email_contacts)}</span>` :
                                `<span class="stat-not-configured">— <span class="stat-tooltip">i</span></span>`
                            }
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Kroki rezerwacji – Etap 1</span>
                            ${conversionMetrics.booking_step_1 > 0 ? 
                                `<span class="stat-value">${formatNumber(conversionMetrics.booking_step_1)}</span>` :
                                `<span class="stat-not-configured">— <span class="stat-tooltip">i</span></span>`
                            }
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Rezerwacje (zakończone)</span>
                            ${conversionMetrics.reservations > 0 ? 
                                `<span class="stat-value">${formatNumber(conversionMetrics.reservations)}</span>` :
                                `<span class="stat-not-configured">— <span class="stat-tooltip">i</span></span>`
                            }
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Wartość rezerwacji (zł)</span>
                            ${conversionMetrics.reservation_value > 0 ? 
                                `<span class="stat-value">${formatCurrency(conversionMetrics.reservation_value)}</span>` :
                                `<span class="stat-not-configured">— <span class="stat-tooltip">i</span></span>`
                            }
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">ROAS (x)</span>
                            ${roas > 0 ? 
                                `<span class="stat-value">${roas.toFixed(2)}x</span>` :
                                `<span class="stat-not-configured">— <span class="stat-tooltip">i</span></span>`
                            }
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Koszt per rezerwacja (zł)</span>
                            ${cost_per_reservation > 0 ? 
                                `<span class="stat-value">${formatCurrency(cost_per_reservation)}</span>` :
                                `<span class="stat-not-configured">— <span class="stat-tooltip">i</span></span>`
                            }
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Etap 2 rezerwacji</span>
                            ${conversionMetrics.booking_step_2 > 0 ? 
                                `<span class="stat-value">${formatNumber(conversionMetrics.booking_step_2)}</span>` :
                                `<span class="stat-not-configured">— <span class="stat-tooltip">i</span></span>`
                            }
                        </div>
                    </div>
                </div>
            </div>

            <!-- Page 3 - Demographics (Impressions) -->
            <div class="section">
                <div class="chart-container">
                    <div class="chart-title">Demografia – Wyświetlenia</div>
                    <div class="charts-grid">
                        <div class="chart-section">
                            <h4>Podział według płci</h4>
                            <canvas id="genderImpressionsChart" width="250" height="250"></canvas>
                        </div>
                        <div class="chart-section">
                            <h4>Podział według grup wieku</h4>
                            <canvas id="ageImpressionsChart" width="250" height="250"></canvas>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Page 4 - Demographics (Clicks) -->
            <div class="section">
                <div class="chart-container">
                    <div class="chart-title">Demografia – Kliknięcia</div>
                    <div class="charts-grid">
                        <div class="chart-section">
                            <h4>Podział według płci</h4>
                            <canvas id="genderClicksChart" width="250" height="250"></canvas>
                        </div>
                        <div class="chart-section">
                            <h4>Podział według grup wieku</h4>
                            <canvas id="ageClicksChart" width="250" height="250"></canvas>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Top Placement Performance -->
            ${placementData.length > 0 ? `
            <div class="section">
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
        
        // Gender Impressions Chart
        if (demographicData.gender && demographicData.gender.length > 0) {
            const ctx1 = document.getElementById('genderImpressionsChart').getContext('2d');
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
        }
        
        // Age Impressions Chart
        if (demographicData.age && demographicData.age.length > 0) {
            const ctx2 = document.getElementById('ageImpressionsChart').getContext('2d');
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
        }
        
        // Gender Clicks Chart
        if (demographicData.gender && demographicData.gender.length > 0) {
            const ctx3 = document.getElementById('genderClicksChart').getContext('2d');
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
        }
        
        // Age Clicks Chart
        if (demographicData.age && demographicData.age.length > 0) {
            const ctx4 = document.getElementById('ageClicksChart').getContext('2d');
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
        }
        </script>
        </body>
    </html>
  `;
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

    // Prepare report data
    const reportData: ReportData = {
      client,
      dateRange,
      campaigns,
      totals: calculatedTotals,
      metaTables: metaTablesData,
      executiveSummary
    };

    console.log('🎯 PDF Generation Data:', {
      client: reportData.client.name,
      dateRange: `${reportData.dateRange.start} to ${reportData.dateRange.end}`,
      campaigns: reportData.campaigns.length,
      spend: (reportData.totals.spend || 0).toFixed(2) + ' zł',
      impressions: (reportData.totals.impressions || 0).toLocaleString(),
      clicks: (reportData.totals.clicks || 0).toLocaleString(),
      hasMetaTables: !!reportData.metaTables,
      hasExecutiveSummary: !!reportData.executiveSummary
    });

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
    await new Promise(resolve => setTimeout(resolve, 3000)); // Give Chart.js time to render
    
    // Check if charts were rendered by looking for canvas elements
    const chartsRendered = await page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas');
      return canvases.length > 0;
    });
    
    console.log('📊 Charts rendered status:', chartsRendered);
    
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