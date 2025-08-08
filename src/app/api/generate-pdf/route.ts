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
    return `${value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
  };

  const formatNumber = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return '0';
    return value.toLocaleString('pl-PL');
  };

  const formatNumberShort = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return '0';
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return value.toLocaleString('pl-PL');
  };

  const formatPercentage = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return '0,00%';
    return `${value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
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

  // Process meta data for placement performance (aggregated and cleaned)
  const processPlacementData = () => {
    if (!reportData.metaTables?.placementPerformance) return [];
    
    const placementMap = new Map();
    
    reportData.metaTables.placementPerformance.forEach(item => {
      const placement = item.placement || item.publisher_platform || 'Inne';
      
      // Clean up placement names
      let cleanPlacement = placement;
      if (placement.toLowerCase().includes('facebook')) cleanPlacement = 'Facebook Feed';
      else if (placement.toLowerCase().includes('instagram')) cleanPlacement = 'Instagram Feed';
      else if (placement.toLowerCase().includes('story') || placement.toLowerCase().includes('stories')) cleanPlacement = 'Instagram Stories';
      else if (placement.toLowerCase().includes('reels')) cleanPlacement = 'Instagram Reels';
      else if (placement.toLowerCase().includes('audience')) cleanPlacement = 'Audience Network';
      else if (placement.toLowerCase().includes('messenger')) cleanPlacement = 'Messenger';
      else if (placement === 'Unknown' || !placement) cleanPlacement = 'Inne';
      
      if (placementMap.has(cleanPlacement)) {
        const existing = placementMap.get(cleanPlacement);
        existing.spend += (item.spend || 0);
        existing.impressions += (item.impressions || 0);
        existing.clicks += (item.clicks || 0);
      } else {
        placementMap.set(cleanPlacement, {
          placement: cleanPlacement,
          spend: item.spend || 0,
          impressions: item.impressions || 0,
          clicks: item.clicks || 0
        });
      }
    });
    
    // Calculate derived metrics and sort by spend
    const placements = Array.from(placementMap.values()).map(item => ({
      ...item,
      ctr: item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0,
      cpc: item.clicks > 0 ? item.spend / item.clicks : 0,
      cpa: totalConversions > 0 ? item.spend / totalConversions : 0
    })).sort((a, b) => b.spend - a.spend).slice(0, 10);
    
    return placements;
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
            
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif;
                line-height: 1.5;
                color: #0B1324;
                background: #F6F8FB;
                font-size: 16px;
                -webkit-font-smoothing: antialiased;
            }
            
            .container {
                max-width: 900px;
                margin: 0 auto;
                padding: 48px 56px;
            }
            
            /* Header */
            .header {
                background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
                color: white;
                padding: 40px 48px;
                border-radius: 20px;
                margin-bottom: 64px;
                position: relative;
                overflow: hidden;
            }
            
            .header::before {
                content: '';
                position: absolute;
                top: -50%;
                right: -20%;
                width: 400px;
                height: 400px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 50%;
                z-index: 1;
            }
            
            .header-content {
                position: relative;
                z-index: 2;
            }
            
            .header h1 {
                font-size: 36px;
                font-weight: 700;
                margin-bottom: 12px;
                letter-spacing: -0.02em;
            }
            
            .header .client-name {
                font-size: 24px;
                font-weight: 600;
                margin-bottom: 8px;
                opacity: 0.95;
            }
            
            .header .date-range {
                font-size: 18px;
                opacity: 0.8;
                margin-bottom: 24px;
            }
            
            .header .meta-info {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 14px;
                opacity: 0.7;
                border-top: 1px solid rgba(255, 255, 255, 0.2);
                padding-top: 24px;
            }
            
            /* Section Styles */
            .section {
                margin-bottom: 64px;
            }
            
            .section-title {
                font-size: 24px;
                font-weight: 600;
                color: #0B1324;
                margin-bottom: 32px;
                letter-spacing: -0.01em;
            }
            
            /* Card Styles */
            .card {
                background: white;
                border-radius: 20px;
                padding: 28px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
                border: 1px solid #E6E9EF;
            }
            
            /* KPI Grid */
            .kpi-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 24px;
                margin-bottom: 16px;
            }
            
            .kpi-grid-row2 {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 24px;
            }
            
            .kpi-card {
                background: white;
                border-radius: 16px;
                padding: 24px;
                text-align: center;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
                border: 1px solid #E6E9EF;
                position: relative;
            }
            
            .kpi-icon {
                position: absolute;
                top: 16px;
                left: 16px;
                width: 20px;
                height: 20px;
                background: #1e40af;
                border-radius: 4px;
                opacity: 0.8;
            }
            
            .kpi-value {
                font-size: 48px;
                font-weight: 700;
                color: #0B1324;
                margin-bottom: 8px;
                letter-spacing: -0.02em;
            }
            
            .kpi-label {
                font-size: 14px;
                color: #3A4556;
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }
            
            /* Conversion Cards */
            .conversion-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 24px;
                margin-bottom: 16px;
            }
            
                         .conversion-grid-row2 {
                 display: grid;
                 grid-template-columns: repeat(3, 1fr);
                 gap: 24px;
             }
             
             .conversion-grid-row3 {
                 display: grid;
                 grid-template-columns: repeat(3, 1fr);
                 gap: 24px;
             }
            
            .conversion-card {
                background: white;
                border-radius: 16px;
                padding: 24px;
                text-align: center;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
                border: 1px solid #E6E9EF;
            }
            
            .conversion-value {
                font-size: 40px;
                font-weight: 700;
                color: #0B1324;
                margin-bottom: 8px;
            }
            
            .conversion-label {
                font-size: 14px;
                color: #3A4556;
                font-weight: 500;
            }
            
            .conversion-cta {
                margin-top: 32px;
                text-align: center;
            }
            
            .cta-button {
                background: #FF7A00;
                color: white;
                padding: 12px 24px;
                border-radius: 12px;
                font-weight: 600;
                text-decoration: none;
                display: inline-block;
                font-size: 14px;
            }
            
            /* Tables */
            .table-container {
                background: white;
                border-radius: 20px;
                overflow: hidden;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
                border: 1px solid #E6E9EF;
            }
            
            .data-table {
                width: 100%;
                border-collapse: collapse;
            }
            
            .data-table th {
                background: #F6F8FB;
                color: #0B1324;
                padding: 16px 20px;
                text-align: left;
                font-weight: 600;
                font-size: 14px;
                letter-spacing: 0.02em;
                border-bottom: 1px solid #E6E9EF;
            }
            
            .data-table td {
                padding: 16px 20px;
                border-bottom: 1px solid #F6F8FB;
                font-size: 14px;
                color: #3A4556;
            }
            
            .data-table tr:hover {
                background: #FAFBFC;
            }
            
            .data-table tr:last-child td {
                border-bottom: none;
            }
            
            /* Demographics Charts Placeholder */
            .chart-placeholder {
                background: #F6F8FB;
                border-radius: 16px;
                padding: 48px;
                text-align: center;
                margin-bottom: 24px;
                border: 2px dashed #E6E9EF;
            }
            
            .chart-title {
                font-size: 18px;
                font-weight: 600;
                color: #0B1324;
                margin-bottom: 8px;
            }
            
            .chart-subtitle {
                font-size: 14px;
                color: #3A4556;
            }
            
            /* Footer */
            .footer {
                text-align: center;
                padding: 32px 0;
                border-top: 1px solid #E6E9EF;
                color: #3A4556;
                font-size: 12px;
                margin-top: 64px;
            }
            
            /* Executive Summary */
            .executive-summary {
                background: white;
                border-radius: 20px;
                padding: 32px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
                border: 1px solid #E6E9EF;
                margin-bottom: 48px;
            }
            
            .executive-summary p {
                font-size: 16px;
                line-height: 1.7;
                color: #3A4556;
                margin-bottom: 16px;
            }
            
            /* Methodology */
            .methodology {
                background: #F6F8FB;
                border-radius: 20px;
                padding: 32px;
                border: 1px solid #E6E9EF;
            }
            
            .methodology h3 {
                font-size: 18px;
                font-weight: 600;
                color: #0B1324;
                margin-bottom: 16px;
            }
            
            .methodology p {
                font-size: 14px;
                color: #3A4556;
                margin-bottom: 12px;
                line-height: 1.6;
            }
            
            @media print {
                body { background: white; }
                .container { padding: 0; }
                .header::before { display: none; }
                
                /* Page breaks */
                .section { break-inside: avoid; }
                .kpi-card, .conversion-card { break-inside: avoid; }
                .table-container { break-inside: avoid; }
                
                /* Ensure headers repeat on new pages */
                .data-table thead { display: table-header-group; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <!-- Header Section -->
            <div class="header">
                <div class="header-content">
                    <h1>Raport Meta Ads</h1>
                    <div class="client-name">${reportData.client.name}</div>
                    <div class="date-range">${formatDate(reportData.dateRange.start)} – ${formatDate(reportData.dateRange.end)}</div>
                    <div class="meta-info">
                        <span>Wygenerowano ${new Date().toLocaleDateString('pl-PL')} ${new Date().toLocaleTimeString('pl-PL')}</span>
                        <span>Źródło: Meta API</span>
                    </div>
                </div>
            </div>

            <!-- Executive Summary -->
            ${reportData.executiveSummary ? `
            <div class="section">
                <div class="section-title">Podsumowanie wykonawcze</div>
                <div class="executive-summary">
                    ${reportData.executiveSummary.trim()}
                </div>
            </div>
            ` : ''}

            <!-- KPI Section -->
            <div class="section">
                <div class="section-title">Wydajność kampanii</div>
                <div class="kpi-grid">
                    <div class="kpi-card">
                        <div class="kpi-icon"></div>
                        <div class="kpi-value">${formatCurrency(totalSpend)}</div>
                        <div class="kpi-label">Całkowite wydatki</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-icon"></div>
                        <div class="kpi-value">${formatNumberShort(totalImpressions)}</div>
                        <div class="kpi-label">Wyświetlenia</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-icon"></div>
                        <div class="kpi-value">${formatNumberShort(totalClicks)}</div>
                        <div class="kpi-label">Kliknięcia</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-icon"></div>
                        <div class="kpi-value">${formatPercentage(ctr)}</div>
                        <div class="kpi-label">CTR</div>
                    </div>
                </div>
                <div class="kpi-grid-row2">
                    <div class="kpi-card">
                        <div class="kpi-icon"></div>
                        <div class="kpi-value">${formatCurrency(cpc)}</div>
                        <div class="kpi-label">CPC</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-icon"></div>
                        <div class="kpi-value">${formatNumberShort(reach)}</div>
                        <div class="kpi-label">Zasięg</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-icon"></div>
                        <div class="kpi-value">${formatCurrency(cpm)}</div>
                        <div class="kpi-label">CPM</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-icon"></div>
                        <div class="kpi-value">${formatNumber(totalConversions)}</div>
                        <div class="kpi-label">Konwersje</div>
                    </div>
                </div>
            </div>

            <!-- Conversion Statistics -->
            <div class="section">
                <div class="section-title">Statystyki konwersji</div>
                <div class="conversion-grid">
                    <div class="conversion-card">
                        <div class="conversion-value">${formatNumber(conversionMetrics.click_to_call)}</div>
                        <div class="conversion-label">Potencjalne kontakty – telefon</div>
                    </div>
                    <div class="conversion-card">
                        <div class="conversion-value">${formatNumber(conversionMetrics.email_contacts)}</div>
                        <div class="conversion-label">Potencjalne kontakty – e-mail</div>
                    </div>
                    <div class="conversion-card">
                        <div class="conversion-value">${formatNumber(conversionMetrics.booking_step_1)}</div>
                        <div class="conversion-label">Kroki rezerwacji – Etap 1</div>
                    </div>
                </div>
                <div class="conversion-grid-row2">
                    <div class="conversion-card">
                        <div class="conversion-value">${formatNumber(conversionMetrics.reservations)}</div>
                        <div class="conversion-label">Rezerwacje (zakończone)</div>
                    </div>
                    <div class="conversion-card">
                        <div class="conversion-value">${formatCurrency(conversionMetrics.reservation_value)}</div>
                        <div class="conversion-label">Wartość rezerwacji</div>
                    </div>
                    <div class="conversion-card">
                        <div class="conversion-value">${roas > 0 ? roas.toFixed(2) + 'x' : '0x'}</div>
                        <div class="conversion-label">ROAS</div>
                    </div>
                </div>
                <div class="conversion-grid-row3">
                    <div class="conversion-card">
                        <div class="conversion-value">${formatCurrency(cost_per_reservation)}</div>
                        <div class="conversion-label">Koszt per rezerwacja</div>
                    </div>
                    <div class="conversion-card">
                        <div class="conversion-value">${formatNumber(conversionMetrics.booking_step_2)}</div>
                        <div class="conversion-label">Etap 2 rezerwacji</div>
                    </div>
                    <div class="conversion-card">
                        <div class="conversion-value">-</div>
                        <div class="conversion-label">-</div>
                    </div>
                </div>
                ${(conversionMetrics.click_to_call === 0 && conversionMetrics.email_contacts === 0 && conversionMetrics.booking_step_1 === 0) ? `
                <div class="conversion-cta">
                    <a href="#" class="cta-button">Skonfiguruj śledzenie konwersji</a>
                </div>
                ` : ''}
            </div>

            <!-- Demographics -->
            <div class="section">
                <div class="section-title">Demografia – Wyświetlenia</div>
                <div style="display: flex; gap: 20px; margin-bottom: 30px;">
                    <div style="flex: 1;">
                        <div class="chart-title">Podział według płci</div>
                        <canvas id="genderImpressionsChart" width="250" height="250"></canvas>
                    </div>
                    <div style="flex: 1;">
                        <div class="chart-title">Podział według grup wieku</div>
                        <canvas id="ageImpressionsChart" width="250" height="250"></canvas>
                    </div>
                </div>
                
                <!-- Gender Impressions Data Table -->
                <div style="margin-bottom: 20px;">
                    <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 10px; color: #374151;">Podział według Płci</h4>
                    <div style="display: flex; gap: 20px;">
                        ${demographicData.gender.map(item => `
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div style="width: 12px; height: 12px; border-radius: 50%; background-color: ${item.gender === 'Kobiety' || item.gender === 'female' ? '#8B5CF6' : item.gender === 'Mężczyźni' || item.gender === 'male' ? '#3B82F6' : '#6B7280'};"></div>
                                <span style="font-size: 12px; color: #374151; font-weight: 500;">${item.gender === 'female' ? 'Female' : item.gender === 'male' ? 'Male' : item.gender === 'unknown' ? 'Unknown' : item.gender}</span>
                                <span style="font-size: 12px; color: #6B7280;">${formatNumberShort(item.impressions)}</span>
                                <span style="font-size: 12px; color: #6B7280;">(${((item.impressions / demographicData.gender.reduce((sum, g) => sum + g.impressions, 0)) * 100).toFixed(1)}%)</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Age Impressions Data Table -->
                <div style="margin-bottom: 20px;">
                    <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 10px; color: #374151;">Podział według Grup Wiekowych</h4>
                    <div style="display: flex; flex-wrap: wrap; gap: 15px;">
                        ${demographicData.age.map((item, index) => `
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div style="width: 12px; height: 12px; border-radius: 50%; background-color: ${['#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444', '#6B7280', '#F97316'][index % 7]};"></div>
                                <span style="font-size: 12px; color: #374151; font-weight: 500;">${item.age}</span>
                                <span style="font-size: 12px; color: #6B7280;">${formatNumberShort(item.impressions)}</span>
                                <span style="font-size: 12px; color: #6B7280;">(${((item.impressions / demographicData.age.reduce((sum, a) => sum + a.impressions, 0)) * 100).toFixed(1)}%)</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <!-- Demographics Clicks -->
            <div class="section">
                <div class="section-title">Demografia – Kliknięcia</div>
                <div style="display: flex; gap: 20px; margin-bottom: 30px;">
                    <div style="flex: 1;">
                        <div class="chart-title">Podział według płci</div>
                        <canvas id="genderClicksChart" width="250" height="250"></canvas>
                    </div>
                    <div style="flex: 1;">
                        <div class="chart-title">Podział według grup wieku</div>
                        <canvas id="ageClicksChart" width="250" height="250"></canvas>
                    </div>
                </div>

                <!-- Gender Clicks Data Table -->
                <div style="margin-bottom: 20px;">
                    <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 10px; color: #374151;">Podział według Płci</h4>
                    <div style="display: flex; gap: 20px;">
                        ${demographicData.gender.map(item => `
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div style="width: 12px; height: 12px; border-radius: 50%; background-color: ${item.gender === 'Kobiety' || item.gender === 'female' ? '#8B5CF6' : item.gender === 'Mężczyźni' || item.gender === 'male' ? '#3B82F6' : '#6B7280'};"></div>
                                <span style="font-size: 12px; color: #374151; font-weight: 500;">${item.gender === 'female' ? 'Female' : item.gender === 'male' ? 'Male' : item.gender === 'unknown' ? 'Unknown' : item.gender}</span>
                                <span style="font-size: 12px; color: #6B7280;">${formatNumberShort(item.clicks)}</span>
                                <span style="font-size: 12px; color: #6B7280;">(${((item.clicks / demographicData.gender.reduce((sum, g) => sum + g.clicks, 0)) * 100).toFixed(1)}%)</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Age Clicks Data Table -->
                <div style="margin-bottom: 20px;">
                    <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 10px; color: #374151;">Podział według Grup Wiekowych</h4>
                    <div style="display: flex; flex-wrap: wrap; gap: 15px;">
                        ${demographicData.age.map((item, index) => `
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div style="width: 12px; height: 12px; border-radius: 50%; background-color: ${['#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444', '#6B7280', '#F97316'][index % 7]};"></div>
                                <span style="font-size: 12px; color: #374151; font-weight: 500;">${item.age}</span>
                                <span style="font-size: 12px; color: #6B7280;">${formatNumberShort(item.clicks)}</span>
                                <span style="font-size: 12px; color: #6B7280;">(${((item.clicks / demographicData.age.reduce((sum, a) => sum + a.clicks, 0)) * 100).toFixed(1)}%)</span>
                            </div>
                        `).join('')}
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
                                <th>Placement</th>
                                <th>Wydatki</th>
                                <th>Wyświetlenia</th>
                                <th>Kliknięcia</th>
                                <th>CTR</th>
                                <th>CPC</th>
                                <th>CPA</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${placementData.map(placement => `
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
                                <th>Nazwa reklamy</th>
                                <th>Wydatki</th>
                                <th>Wyświetlenia</th>
                                <th>Kliknięcia</th>
                                <th>CPP/CPA</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${topAds.map(ad => `
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
            </div>
            ` : ''}

            <!-- Campaign Details -->
            <div class="section">
                <div class="section-title">Szczegóły kampanii</div>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Nazwa kampanii</th>
                                <th>Wydatki</th>
                                <th>Wyświetlenia</th>
                                <th>Kliknięcia</th>
                                <th>CTR</th>
                                <th>CPC</th>
                                <th>Konwersje</th>
                                <th>CPA</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reportData.campaigns.map(campaign => {
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