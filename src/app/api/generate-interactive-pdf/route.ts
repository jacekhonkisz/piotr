import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface InteractiveReportData {
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
    reach?: number;
    frequency?: number;
  };
  metaTables?: {
    placementPerformance: any[];
    demographicPerformance: any[];
    adRelevanceResults: any[];
  };
}

function generateInteractiveHTML(reportData: InteractiveReportData): string {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const months = [
      'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
      'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
    ];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const formatCurrency = (value: number) => `${value.toFixed(2)} zł`;
  const formatNumber = (value: number) => value.toLocaleString();
  const formatPercentage = (value: number) => `${value.toFixed(2)}%`;

  return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Interactive Meta Ads Report - ${reportData.client.name}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #1a1a1a;
          background: #F7F9FB;
          padding: 0;
          margin: 0;
          min-height: 100vh;
          width: 100%;
        }
        
        html {
          background: #F7F9FB;
          margin: 0;
          padding: 0;
        }
        
        /* Full-frame container */
        .container {
          max-width: 1100px;
          margin: 0 auto;
          background: #F7F9FB;
          padding: 0;
          min-height: 100vh;
        }
        
        /* Header section */
        .header {
          background: #F7F9FB;
          padding: 48px 64px 32px 64px;
          text-align: center;
          border-bottom: 1px solid #E5E7EB;
        }
        
        .header h1 {
          font-size: 36px;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 8px;
        }
        
        .header .client-name {
          font-size: 18px;
          color: #6b7280;
          margin-bottom: 16px;
          font-weight: 500;
        }
        
        .header .date-range {
          font-size: 16px;
          color: #374151;
          font-weight: 600;
        }
        
        /* Section styling - no boxes, just content */
        .section {
          padding: 48px 64px;
          border-bottom: 1px solid #E5E7EB;
        }
        
        .section:last-child {
          border-bottom: none;
        }
        
        /* Section headers */
        .section-header {
          margin-bottom: 32px;
        }
        
        .section-title {
          font-size: 28px;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 8px;
        }
        
        .section-subtitle {
          font-size: 16px;
          color: #6b7280;
          font-weight: 400;
        }
        
        /* Executive Summary */
        .executive-summary {
          background: #F7F9FB;
          padding: 48px 64px;
          border-bottom: 1px solid #E5E7EB;
        }
        
        .summary-text {
          font-size: 16px;
          line-height: 1.7;
          color: #374151;
          margin-bottom: 24px;
        }
        
        /* KPI Grid - always one row on desktop */
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 32px;
          margin-bottom: 32px;
        }
        
        .kpi-item {
          text-align: center;
        }
        
        .kpi-value {
          font-size: 32px;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 8px;
          line-height: 1.2;
        }
        
        .kpi-label {
          font-size: 14px;
          color: #6b7280;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        /* Performance Metrics Grid */
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 32px;
          margin-bottom: 32px;
        }
        
        .metric-item {
          text-align: center;
        }
        
        .metric-value {
          font-size: 24px;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 6px;
        }
        
        .metric-label {
          font-size: 13px;
          color: #6b7280;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        /* Premium Table Styling */
        .data-table {
          width: 100%;
          border-collapse: collapse;
          background: transparent;
          margin-bottom: 24px;
        }
        
        .data-table th {
          background: transparent;
          padding: 16px 12px;
          text-align: left;
          font-weight: 600;
          color: #1a1a1a;
          border-bottom: 2px solid #E5E7EB;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .data-table td {
          padding: 12px;
          border-bottom: 1px solid #f3f4f6;
          font-size: 13px;
          color: #374151;
        }
        
        .data-table tr:nth-child(even) {
          background: rgba(243, 244, 246, 0.3);
        }
        
        .data-table tr:hover {
          background: rgba(243, 244, 246, 0.5);
        }
        
        /* Metric Value Styling */
        .metric-value.spend { 
          color: #3b82f6; 
          font-weight: 600; 
        }
        .metric-value.ctr { 
          color: #10b981; 
          font-weight: 600; 
        }
        .metric-value.cpc { 
          color: #f59e0b; 
          font-weight: 600; 
        }
        .metric-value.cpp { 
          color: #3b82f6; 
          font-weight: 600; 
        }
        
        /* Ranking Badges */
        .ranking-badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          color: white;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .ranking-above { 
          background: #10b981;
        }
        .ranking-average { 
          background: #f59e0b;
        }
        .ranking-below { 
          background: #ef4444;
        }
        
        /* Footer */
        .footer {
          background: #F7F9FB;
          padding: 32px 64px;
          text-align: center;
          border-top: 1px solid #E5E7EB;
        }
        
        .generated-date {
          font-size: 14px;
          color: #6b7280;
          font-weight: 500;
        }
        
        /* Print Styles */
        @media print {
          body { 
            background: #F7F9FB !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
          html {
            background: #F7F9FB !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .container { 
            max-width: none;
            background: #F7F9FB !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .section { 
            page-break-inside: avoid; 
            background: #F7F9FB !important;
          }
          .executive-summary {
            background: #F7F9FB !important;
          }
          .footer {
            background: #F7F9FB !important;
          }
        }
        
        /* Responsive Design */
        @media (max-width: 768px) {
          .header {
            padding: 32px 32px 24px 32px;
          }
          
          .section {
            padding: 32px 32px;
          }
          
          .executive-summary {
            padding: 32px 32px;
          }
          
          .header h1 {
            font-size: 28px;
          }
          
          .kpi-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 24px;
          }
          
          .metrics-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 24px;
          }
          
          .kpi-value {
            font-size: 28px;
          }
          
          .metric-value {
            font-size: 20px;
          }
        }
        
        @media (max-width: 480px) {
          .header {
            padding: 24px 24px 20px 24px;
          }
          
          .section {
            padding: 24px 24px;
          }
          
          .executive-summary {
            padding: 24px 24px;
          }
          
          .kpi-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }
          
          .metrics-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
          }
        }
      </style>
    </head>
    <body>
              <div class="container">
          <!-- Header -->
          <div class="header">
            <h1>Meta Ads Report</h1>
            <div class="client-name">${reportData.client.name}</div>
            <div class="date-range">${formatDate(reportData.dateRange.start)} – ${formatDate(reportData.dateRange.end)}</div>
          </div>
          
          <!-- Executive Summary -->
          <div class="executive-summary">
            <div class="section-header">
              <div class="section-title">Executive Summary</div>
            </div>
            <div class="summary-text">
              ${generateExecutiveSummary(reportData)}
            </div>
          </div>
          
          <!-- Key Performance Indicators -->
          <div class="section">
            <div class="section-header">
              <div class="section-title">Key Performance Indicators</div>
              <div class="section-subtitle">Overview of campaign performance metrics</div>
            </div>
            
            <div class="kpi-grid">
              <div class="kpi-item">
                <div class="kpi-value">${formatCurrency(reportData.totals.spend)}</div>
                <div class="kpi-label">Total Spend</div>
              </div>
              <div class="kpi-item">
                <div class="kpi-value">${formatNumber(reportData.totals.impressions)}</div>
                <div class="kpi-label">Total Impressions</div>
              </div>
              <div class="kpi-item">
                <div class="kpi-value">${formatNumber(reportData.totals.clicks)}</div>
                <div class="kpi-label">Total Clicks</div>
              </div>
              <div class="kpi-item">
                <div class="kpi-value">${formatNumber(reportData.totals.conversions)}</div>
                <div class="kpi-label">Total Conversions</div>
              </div>
            </div>
          </div>
          
          <!-- Performance Metrics -->
          <div class="section">
            <div class="section-header">
              <div class="section-title">Performance Metrics</div>
              <div class="section-subtitle">Detailed campaign performance indicators</div>
            </div>
            
            <div class="metrics-grid">
              <div class="metric-item">
                <div class="metric-value">${formatNumber(reportData.totals.impressions)}</div>
                <div class="metric-label">Impressions</div>
              </div>
              
              <div class="metric-item">
                <div class="metric-value">${formatNumber(reportData.totals.clicks)}</div>
                <div class="metric-label">Clicks</div>
              </div>
              
              <div class="metric-item">
                <div class="metric-value">${formatCurrency(reportData.totals.cpm)}</div>
                <div class="metric-label">CPM</div>
              </div>
              
              <div class="metric-item">
                <div class="metric-value">${formatCurrency(reportData.totals.cpc)}</div>
                <div class="metric-label">CPC</div>
              </div>
              
              <div class="metric-item">
                <div class="metric-value">${formatNumber(reportData.totals.reach || 0)}</div>
                <div class="metric-label">Reach</div>
              </div>
              
              <div class="metric-item">
                <div class="metric-value">${(reportData.totals.frequency || 0).toFixed(1)}</div>
                <div class="metric-label">Frequency</div>
              </div>
            </div>
          </div>
            

          ${reportData.metaTables ? `
          <!-- Placement Performance -->
          <div class="section">
            <div class="section-header">
              <div class="section-title">Placement Performance</div>
              <div class="section-subtitle">Top performing ad placements by spend</div>
            </div>
            
            ${reportData.metaTables.placementPerformance && reportData.metaTables.placementPerformance.length > 0 ? `
            <table class="data-table">
              <thead>
                <tr>
                  <th>Placement</th>
                  <th>Spend</th>
                  <th>Impressions</th>
                  <th>Clicks</th>
                  <th>CTR</th>
                  <th>CPC</th>
                  <th>CPA (CPP)</th>
                </tr>
              </thead>
              <tbody>
                ${reportData.metaTables.placementPerformance
                  .sort((a, b) => b.spend - a.spend)
                  .slice(0, 10)
                  .map((placement) => `
                  <tr>
                    <td><strong>${placement.placement}</strong></td>
                    <td class="metric-value spend">${formatCurrency(placement.spend)}</td>
                    <td>${formatNumber(placement.impressions)}</td>
                    <td>${formatNumber(placement.clicks)}</td>
                    <td class="metric-value ctr">${formatPercentage(placement.ctr)}</td>
                    <td class="metric-value cpc">${formatCurrency(placement.cpc)}</td>
                    <td class="metric-value cpp">${placement.cpp ? formatCurrency(placement.cpp) : '–'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            ${reportData.metaTables.placementPerformance.length > 10 ? `<div class="note">Showing top 10 results by spend. Total: ${reportData.metaTables.placementPerformance.length} placements.</div>` : ''}
            ` : '<div class="note">No placement data available for this period.</div>'}
          </div>

          <!-- Demographic Performance -->
          <div class="section">
            <div class="section-header">
              <div class="section-title">Demographic Performance</div>
              <div class="section-subtitle">Audience breakdown by age and gender</div>
            </div>
            
            ${reportData.metaTables.demographicPerformance && reportData.metaTables.demographicPerformance.length > 0 ? `
            <table class="data-table">
              <thead>
                <tr>
                  <th>Age Group</th>
                  <th>Gender</th>
                  <th>Spend</th>
                  <th>Impressions</th>
                  <th>Clicks</th>
                  <th>CTR</th>
                  <th>CPC</th>
                  <th>CPA (CPP)</th>
                </tr>
              </thead>
              <tbody>
                ${reportData.metaTables.demographicPerformance
                  .sort((a, b) => b.spend - a.spend)
                  .slice(0, 10)
                  .map((demo) => `
                  <tr>
                    <td><strong>${demo.age}</strong></td>
                    <td><strong>${demo.gender}</strong></td>
                    <td class="metric-value spend">${formatCurrency(demo.spend)}</td>
                    <td>${formatNumber(demo.impressions)}</td>
                    <td>${formatNumber(demo.clicks)}</td>
                    <td class="metric-value ctr">${formatPercentage(demo.ctr)}</td>
                    <td class="metric-value cpc">${formatCurrency(demo.cpc)}</td>
                    <td class="metric-value cpp">${demo.cpp ? formatCurrency(demo.cpp) : '–'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            ${reportData.metaTables.demographicPerformance.length > 10 ? `<div class="note">Showing top 10 results by spend. Total: ${reportData.metaTables.demographicPerformance.length} demographics.</div>` : ''}
            ` : '<div class="note">No demographic data available for this period.</div>'}
          </div>

          <!-- Ad Relevance Results -->
          <div class="section">
            <div class="section-header">
              <div class="section-title">Ad Relevance & Results</div>
              <div class="section-subtitle">Ad performance and quality rankings</div>
            </div>
            
            ${reportData.metaTables.adRelevanceResults && reportData.metaTables.adRelevanceResults.length > 0 ? `
            <table class="data-table">
              <thead>
                <tr>
                  <th>Ad Name</th>
                  <th>Spend</th>
                  <th>Impressions</th>
                  <th>Clicks</th>
                  <th>CPA (CPP)</th>
                  <th>Quality Ranking</th>
                  <th>Engagement Ranking</th>
                  <th>Conversion Ranking</th>
                </tr>
              </thead>
              <tbody>
                ${reportData.metaTables.adRelevanceResults
                  .sort((a, b) => b.spend - a.spend)
                  .slice(0, 10)
                  .map((ad) => {
                    const getRankingClass = (ranking: string) => {
                      switch (ranking) {
                        case 'ABOVE_AVERAGE': return 'ranking-above';
                        case 'AVERAGE': return 'ranking-average';
                        case 'BELOW_AVERAGE': return 'ranking-below';
                        default: return 'ranking-average';
                      }
                    };
                    
                    const getRankingLabel = (ranking: string) => {
                      switch (ranking) {
                        case 'ABOVE_AVERAGE': return 'Above Average';
                        case 'AVERAGE': return 'Average';
                        case 'BELOW_AVERAGE': return 'Below Average';
                        default: return 'Unknown';
                      }
                    };
                    
                    return `
                    <tr>
                      <td><strong>${ad.ad_name}</strong></td>
                      <td class="metric-value spend">${formatCurrency(ad.spend)}</td>
                      <td>${formatNumber(ad.impressions)}</td>
                      <td>${formatNumber(ad.clicks)}</td>
                      <td class="metric-value cpp">${ad.cpp ? formatCurrency(ad.cpp) : '–'}</td>
                      <td><span class="ranking-badge ${getRankingClass(ad.quality_ranking)}">${getRankingLabel(ad.quality_ranking)}</span></td>
                      <td><span class="ranking-badge ${getRankingClass(ad.engagement_rate_ranking)}">${getRankingLabel(ad.engagement_rate_ranking)}</span></td>
                      <td><span class="ranking-badge ${getRankingClass(ad.conversion_rate_ranking)}">${getRankingLabel(ad.conversion_rate_ranking)}</span></td>
                    </tr>
                  `;
                  }).join('')}
              </tbody>
            </table>
            ${reportData.metaTables.adRelevanceResults.length > 10 ? `<div class="note">Showing top 10 results by spend. Total: ${reportData.metaTables.adRelevanceResults.length} ads.</div>` : ''}
            ` : '<div class="note">No ad relevance data available for this period.</div>'}
          </div>
          ` : `
          <!-- Fallback Content - No Meta Ads Data -->
          <div class="section">
            <div class="section-header">
              <div class="section-title">No Data Available</div>
              <div class="section-subtitle">Meta Ads data is not available for this period</div>
            </div>
            <div style="font-size: 14px; color: #6b7280; text-align: center; padding: 32px;">Please check your ad account settings and ensure campaigns are active during the selected date range.</div>
          </div>
          `}
        
        <!-- Footer -->
        <div class="footer">
          <div class="generated-date">Generated on ${new Date().toLocaleDateString('pl-PL')}</div>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateExecutiveSummary(reportData: InteractiveReportData): string {
  const formatCurrency = (value: number) => `${value.toFixed(2)} zł`;
  const formatNumber = (value: number) => value.toLocaleString();
  const formatPercentage = (value: number) => `${value.toFixed(2)}%`;

  // Calculate performance insights
  const insights = {
    // CTR Performance
    ctrPerformance: reportData.totals.ctr > 2 ? 'excellent' : 
                   reportData.totals.ctr > 1 ? 'good' : 
                   reportData.totals.ctr > 0.5 ? 'average' : 'needs improvement',
    
    // CPC Performance (assuming lower is better)
    cpcPerformance: reportData.totals.cpc < 1 ? 'excellent' : 
                   reportData.totals.cpc < 2 ? 'good' : 
                   reportData.totals.cpc < 5 ? 'average' : 'high',
    
    // Conversion Performance
    conversionPerformance: reportData.totals.conversions > 0 ? 'positive' : 'no conversions',
    
    // Spend Efficiency
    spendEfficiency: reportData.totals.impressions > 0 ? 
                    (reportData.totals.spend / reportData.totals.impressions * 1000) : 0,
    
    // Reach vs Impressions ratio
    reachEfficiency: reportData.totals.reach && reportData.totals.impressions > 0 ? 
                    (reportData.totals.impressions / reportData.totals.reach) : 0
  };

  // Generate contextual insights
  let summaryText = `W tym okresie wydano ${formatCurrency(reportData.totals.spend)}, osiągając ${formatNumber(reportData.totals.impressions)} wyświetleń i ${formatNumber(reportData.totals.clicks)} kliknięć. `;
  
  // Add CTR context
  if (insights.ctrPerformance === 'excellent') {
    summaryText += `Wskaźnik CTR wyniósł ${formatPercentage(reportData.totals.ctr)}, co jest doskonałym wynikiem w porównaniu ze standardami branżowymi. `;
  } else if (insights.ctrPerformance === 'good') {
    summaryText += `Wskaźnik CTR wyniósł ${formatPercentage(reportData.totals.ctr)}, co jest dobrym wynikiem. `;
  } else if (insights.ctrPerformance === 'average') {
    summaryText += `Wskaźnik CTR wyniósł ${formatPercentage(reportData.totals.ctr)}, co jest średnim wynikiem. `;
  } else {
    summaryText += `Wskaźnik CTR wyniósł ${formatPercentage(reportData.totals.ctr)}, co wymaga optymalizacji. `;
  }

  // Add CPC context
  if (insights.cpcPerformance === 'excellent') {
    summaryText += `Średni koszt kliknięcia ${formatCurrency(reportData.totals.cpc)} jest bardzo konkurencyjny. `;
  } else if (insights.cpcPerformance === 'good') {
    summaryText += `Średni koszt kliknięcia ${formatCurrency(reportData.totals.cpc)} jest w normie. `;
  } else if (insights.cpcPerformance === 'average') {
    summaryText += `Średni koszt kliknięcia ${formatCurrency(reportData.totals.cpc)} jest wyższy niż średnia. `;
  } else {
    summaryText += `Średni koszt kliknięcia ${formatCurrency(reportData.totals.cpc)} jest wysoki i wymaga optymalizacji. `;
  }

  // Add conversion context
  if (insights.conversionPerformance === 'positive') {
    summaryText += `Kampanie osiągnęły ${formatNumber(reportData.totals.conversions)} konwersji, co pokazuje skuteczność w osiąganiu celów biznesowych. `;
  } else {
    summaryText += `Nie odnotowano konwersji w tym okresie, co może wskazywać na potrzebę optymalizacji ścieżki konwersji. `;
  }

  // Add reach and frequency insights
  if (reportData.totals.reach && reportData.totals.reach > 0) {
    summaryText += `Kampanie dotarły do ${formatNumber(reportData.totals.reach)} unikalnych użytkowników, `;
    if (insights.reachEfficiency > 0) {
      summaryText += `z częstotliwością ${insights.reachEfficiency.toFixed(1)} wyświetleń na użytkownika. `;
    }
  }

  // Add CPM context
  if (reportData.totals.cpm > 0) {
    summaryText += `Koszt za 1000 wyświetleń (CPM) wyniósł ${formatCurrency(reportData.totals.cpm)}. `;
  }

  // Add campaign count context
  if (reportData.campaigns.length > 0) {
    summaryText += `W analizowanym okresie aktywnych było ${reportData.campaigns.length} kampanii. `;
  }

  return summaryText;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: userAuthError } = await supabase.auth.getUser(token);
    
    if (userAuthError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { clientId, dateRange } = await request.json();

    if (!clientId || !dateRange) {
      return NextResponse.json({ error: 'Client ID and date range are required' }, { status: 400 });
    }

    // Get client information
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Fetch existing report data from database
    let campaigns: any[] = [];
    let metaTablesData = null;
    
    try {
      console.log('🔍 Fetching existing report data from database...');
      
      // Get existing report
      const { data: existingReports, error: reportsError } = await supabase
        .from('reports')
        .select('*')
        .eq('client_id', clientId)
        .eq('date_range_start', dateRange.start)
        .eq('date_range_end', dateRange.end)
        .order('generated_at', { ascending: false })
        .limit(1);

      if (!reportsError && existingReports && existingReports.length > 0) {
        console.log('✅ Found existing report in database');
        
        // Get campaigns for this report
        const { data: existingCampaigns } = await supabase
          .from('campaigns')
          .select('*')
          .eq('client_id', clientId)
          .eq('date_range_start', dateRange.start)
          .eq('date_range_end', dateRange.end);

        campaigns = existingCampaigns?.map((campaign: any) => ({
          id: `${campaign.campaign_id}-${dateRange.start}`,
          campaign_id: campaign.campaign_id,
          campaign_name: campaign.campaign_name,
          spend: campaign.spend || 0,
          impressions: campaign.impressions || 0,
          clicks: campaign.clicks || 0,
          conversions: campaign.conversions || 0,
          ctr: campaign.ctr || 0,
          cpc: campaign.cpc || 0,
          cpp: campaign.cpp,
          frequency: campaign.frequency,
          reach: campaign.reach,
          date_range_start: dateRange.start,
          date_range_end: dateRange.end,
          status: campaign.status,
          objective: campaign.objective
        })) || [];

        console.log('✅ Campaigns loaded:', campaigns.length, 'campaigns');
      } else {
        console.log('⚠️ No existing report found, will use empty data');
      }
    } catch (error) {
      console.log('❌ Error fetching report data:', error);
    }

    // Fetch Meta Ads tables data for interactive tables
    try {
      console.log('🔍 Fetching Meta Ads tables data for interactive tables...');
      
      // Import Meta API service
      const { MetaAPIService } = await import('../../../lib/meta-api');
      
      // Get client's Meta access token
      if (!client.meta_access_token) {
        console.log('⚠️ Client has no Meta access token');
      } else {
        // Create Meta API service instance with client's token
        const metaService = new MetaAPIService(client.meta_access_token);
        
        // Fetch placement performance data
        let placementData = [];
        try {
          placementData = await metaService.getPlacementPerformance(
            client.ad_account_id,
            dateRange.start,
            dateRange.end
          );
          console.log('✅ Placement data fetched:', placementData.length, 'records');
        } catch (error) {
          console.log('❌ Error fetching placement data:', error);
        }
        
        // Fetch demographic performance data
        let demographicData = [];
        try {
          demographicData = await metaService.getDemographicPerformance(
            client.ad_account_id,
            dateRange.start,
            dateRange.end
          );
          console.log('✅ Demographic data fetched:', demographicData.length, 'records');
        } catch (error) {
          console.log('❌ Error fetching demographic data:', error);
        }
        
        // Fetch ad relevance data
        let adRelevanceData = [];
        try {
          adRelevanceData = await metaService.getAdRelevanceResults(
            client.ad_account_id,
            dateRange.start,
            dateRange.end
          );
          console.log('✅ Ad relevance data fetched:', adRelevanceData.length, 'records');
        } catch (error) {
          console.log('❌ Error fetching ad relevance data:', error);
        }
        
        metaTablesData = {
          placementPerformance: placementData,
          demographicPerformance: demographicData,
          adRelevanceResults: adRelevanceData
        };
        
        console.log('✅ Meta Ads tables data compiled successfully:', {
          placementCount: placementData.length,
          demographicCount: demographicData.length,
          adRelevanceCount: adRelevanceData.length
        });
      }
    } catch (error) {
      console.log('❌ Error in Meta Ads data fetching:', error);
    }

    // Calculate totals from campaign data (same as reports page)
    const totals = campaigns.reduce((acc, campaign) => ({
      spend: acc.spend + campaign.spend,
      impressions: acc.impressions + campaign.impressions,
      clicks: acc.clicks + campaign.clicks,
      conversions: acc.conversions + campaign.conversions,
      reach: acc.reach + (campaign.reach || 0),
      frequency: acc.frequency + (campaign.frequency || 0)
    }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, reach: 0, frequency: 0 });

    // Calculate derived metrics
    const calculatedTotals = {
      ...totals,
      ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
      cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
      cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0,
      frequency: totals.reach > 0 ? totals.impressions / totals.reach : 0
    };

    // Prepare report data
    const reportData: InteractiveReportData = {
      client,
      dateRange,
      campaigns,
      totals: calculatedTotals,
      metaTables: metaTablesData || {
        placementPerformance: [],
        demographicPerformance: [],
        adRelevanceResults: []
      }
    };

    // Generate interactive HTML
    const html = generateInteractiveHTML(reportData);

    // Generate PDF with optimized settings for faster generation
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--enable-javascript',
        '--disable-web-security',
        '--allow-running-insecure-content',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process'
      ]
    });

    const page = await browser.newPage();
    
    // Enable JavaScript and set optimized viewport
    await page.setJavaScriptEnabled(true);
    await page.setViewport({ width: 1000, height: 600 });
    
    // Set content with faster loading
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    
    // Simple page initialization for static tables
    await page.evaluate(() => {
      console.log('✅ Static PDF Report loaded successfully');
      console.log('📊 Showing top 10 results for each table');
    });
    
    // Short wait for page to settle
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm'
      },
      preferCSSPageSize: true
    });

    await browser.close();

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="interactive-report-${client.name}-${dateRange.start}-${dateRange.end}.pdf"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    });

  } catch (error) {
    console.error('Error generating interactive PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate interactive PDF' },
      { status: 500 }
    );
  }
} 