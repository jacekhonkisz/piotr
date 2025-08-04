import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';

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

  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return '0.00 zł';
    return `${value.toFixed(2)} zł`;
  };
  const formatNumber = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return '0';
    return value.toLocaleString();
  };
  const formatPercentage = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return '0.00%';
    return `${value.toFixed(2)}%`;
  };

  // Calculate additional metrics with safety checks
  const totalSpend = reportData.totals.spend || 0;
  const totalImpressions = reportData.totals.impressions || 0;
  const totalClicks = reportData.totals.clicks || 0;
  const totalConversions = reportData.totals.conversions || 0;
  const ctr = reportData.totals.ctr || 0;
  const cpc = reportData.totals.cpc || 0;
  const cpm = reportData.totals.cpm || 0;
  const reach = totalImpressions > 0 ? Math.round(totalImpressions / 1.5) : 0; // Estimate reach
  const frequency = reach > 0 ? totalImpressions / reach : 0;
  const campaignCount = reportData.campaigns.length;

  return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Meta Ads Report - ${reportData.client.name}</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                line-height: 1.6;
                color: #000;
                background: #fff;
                font-size: 14px;
            }
            
            .container {
                max-width: 800px;
                margin: 0 auto;
                padding: 40px 20px;
            }
            
            .header {
                text-align: center;
                margin-bottom: 40px;
            }
            
            .header h1 {
                font-size: 32px;
                font-weight: bold;
                color: #000;
                margin-bottom: 10px;
            }
            
            .header .client-name {
                font-size: 18px;
                color: #333;
                margin-bottom: 5px;
            }
            
            .header .date-range {
                font-size: 16px;
                color: #666;
            }
            
            .section {
                margin-bottom: 40px;
            }
            
            .section-title {
                font-size: 24px;
                font-weight: bold;
                color: #000;
                margin-bottom: 20px;
            }
            
            .section-subtitle {
                font-size: 16px;
                color: #666;
                margin-bottom: 20px;
            }
            
            .executive-summary {
                background: #f9f9f9;
                padding: 25px;
                border-radius: 8px;
                margin-bottom: 30px;
            }
            
            .executive-summary p {
                font-size: 16px;
                line-height: 1.8;
                color: #333;
                margin-bottom: 15px;
            }
            
            .metrics-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                flex-wrap: wrap;
            }
            
            .metric {
                text-align: center;
                flex: 1;
                min-width: 150px;
                margin: 10px;
            }
            
            .metric-value {
                font-size: 28px;
                font-weight: bold;
                color: #000;
                margin-bottom: 5px;
            }
            
            .metric-label {
                font-size: 14px;
                color: #666;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .campaigns-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
            }
            
            .campaigns-table th {
                background: #f5f5f5;
                color: #000;
                padding: 12px 15px;
                text-align: left;
                font-weight: bold;
                font-size: 14px;
                border-bottom: 2px solid #ddd;
            }
            
            .campaigns-table td {
                padding: 12px 15px;
                border-bottom: 1px solid #eee;
                font-size: 14px;
            }
            
            .campaigns-table tr:nth-child(even) {
                background: #fafafa;
            }
            
            .status-active {
                color: #28a745;
                font-weight: bold;
            }
            
            .status-paused {
                color: #dc3545;
                font-weight: bold;
            }
            
            .footer {
                text-align: center;
                padding: 30px 0;
                border-top: 1px solid #eee;
                color: #666;
                font-size: 12px;
                margin-top: 40px;
            }
            
            @media print {
                body {
                    background: white;
                }
                
                .container {
                    padding: 0;
                }
                
                .metric {
                    break-inside: avoid;
                }
                
                .campaigns-table {
                    break-inside: avoid;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Meta Ads Report</h1>
                <div class="client-name">${reportData.client.name}</div>
                <div class="date-range">${formatDate(reportData.dateRange.start)} - ${formatDate(reportData.dateRange.end)}</div>
            </div>
            
            <div class="section">
                <div class="section-title">Executive Summary</div>
                <div class="executive-summary">
                    <p>
                        W analizowanym okresie wydano ${formatCurrency(totalSpend)}, osiągając ${formatNumber(totalImpressions)} wyświetleń i ${formatNumber(totalClicks)} kliknięć. 
                        CTR wyniósł ${formatPercentage(ctr)}, co stanowi dobry wynik. Średni koszt kliknięcia (CPC) to ${formatCurrency(cpc)}, co jest wartością normalną. 
                        Nie odnotowano konwersji, co sugeruje potrzebę optymalizacji ścieżki konwersji. Kampanie dotarły do ${formatNumber(reach)} unikalnych użytkowników 
                        z częstotliwością ${frequency.toFixed(1)} wyświetleń na użytkownika. Koszt za 1000 wyświetleń (CPM) wyniósł ${formatCurrency(cpm)}. 
                        W analizowanym okresie aktywnych było ${campaignCount} kampanii.
                    </p>
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">Key Performance Indicators</div>
                <div class="section-subtitle">Overview of campaign performance metrics</div>
                
                <div class="metrics-row">
                    <div class="metric">
                        <div class="metric-value">${formatCurrency(totalSpend)}</div>
                        <div class="metric-label">Total Spend</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${formatNumber(totalImpressions)}</div>
                        <div class="metric-label">Impressions</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${formatNumber(totalClicks)}</div>
                        <div class="metric-label">Clicks</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${formatNumber(totalConversions)}</div>
                        <div class="metric-label">Conversions</div>
                    </div>
                </div>
                
                <div class="metrics-row">
                    <div class="metric">
                        <div class="metric-value">${formatPercentage(ctr)}</div>
                        <div class="metric-label">CTR</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${formatCurrency(cpc)}</div>
                        <div class="metric-label">CPC</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${formatCurrency(cpm)}</div>
                        <div class="metric-label">CPM</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${formatNumber(reach)}</div>
                        <div class="metric-label">Reach</div>
                    </div>
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">Campaign Details</div>
                <table class="campaigns-table">
                    <thead>
                        <tr>
                            <th>Campaign Name</th>
                            <th>Spend</th>
                            <th>Impressions</th>
                            <th>Clicks</th>
                            <th>CTR</th>
                            <th>CPC</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reportData.campaigns.map(campaign => `
                            <tr>
                                <td>${campaign.campaign_name || 'Unknown Campaign'}</td>
                                <td>${formatCurrency(campaign.spend)}</td>
                                <td>${formatNumber(campaign.impressions)}</td>
                                <td>${formatNumber(campaign.clicks)}</td>
                                <td>${formatPercentage(campaign.ctr)}</td>
                                <td>${formatCurrency(campaign.cpc)}</td>
                                <td class="status-${campaign.status?.toLowerCase() || 'active'}">
                                    ${campaign.status || 'ACTIVE'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            ${reportData.metaTables ? `
            <!-- Meta Ads Tables Section -->
            ${reportData.metaTables.placementPerformance && reportData.metaTables.placementPerformance.length > 0 ? `
            <div class="section">
                <div class="section-title">Top Placement Performance</div>
                <table class="campaigns-table">
                    <thead>
                        <tr>
                            <th>Placement</th>
                            <th>Spend</th>
                            <th>Impressions</th>
                            <th>Clicks</th>
                            <th>CTR</th>
                            <th>CPC</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reportData.metaTables.placementPerformance.slice(0, 10).map(placement => `
                            <tr>
                                <td>${placement.publisher_platform || 'Unknown'}</td>
                                <td>${formatCurrency(placement.spend)}</td>
                                <td>${formatNumber(placement.impressions)}</td>
                                <td>${formatNumber(placement.clicks)}</td>
                                <td>${formatPercentage(placement.ctr)}</td>
                                <td>${formatCurrency(placement.cpc)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ` : ''}
            
            ${reportData.metaTables.demographicPerformance && reportData.metaTables.demographicPerformance.length > 0 ? `
            <div class="section">
                <div class="section-title">Demographic Performance</div>
                <table class="campaigns-table">
                    <thead>
                        <tr>
                            <th>Age Group</th>
                            <th>Gender</th>
                            <th>Spend</th>
                            <th>Impressions</th>
                            <th>Clicks</th>
                            <th>CTR</th>
                            <th>CPC</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reportData.metaTables.demographicPerformance.slice(0, 10).map(demo => `
                            <tr>
                                <td>${demo.age || 'Unknown'}</td>
                                <td>${demo.gender || 'Unknown'}</td>
                                <td>${formatCurrency(demo.spend)}</td>
                                <td>${formatNumber(demo.impressions)}</td>
                                <td>${formatNumber(demo.clicks)}</td>
                                <td>${formatPercentage(demo.ctr)}</td>
                                <td>${formatCurrency(demo.cpc)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ` : ''}
            
            ${reportData.metaTables.adRelevanceResults && reportData.metaTables.adRelevanceResults.length > 0 ? `
            <div class="section">
                <div class="section-title">Ad Relevance & Results</div>
                <table class="campaigns-table">
                    <thead>
                        <tr>
                            <th>Ad Name</th>
                            <th>Quality Ranking</th>
                            <th>Engagement Ranking</th>
                            <th>Conversion Ranking</th>
                            <th>Spend</th>
                            <th>Impressions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reportData.metaTables.adRelevanceResults.slice(0, 10).map(ad => `
                            <tr>
                                <td>${ad.ad_name || 'Unknown'}</td>
                                <td>${ad.quality_ranking || 'N/A'}</td>
                                <td>${ad.engagement_rate_ranking || 'N/A'}</td>
                                <td>${ad.conversion_rate_ranking || 'N/A'}</td>
                                <td>${formatCurrency(ad.spend)}</td>
                                <td>${formatNumber(ad.impressions)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ` : ''}
            ` : ''}
            
            <div class="footer">
                <p>Report generated automatically • ${new Date().toLocaleDateString('pl-PL')} ${new Date().toLocaleTimeString('pl-PL')}</p>
            </div>
        </div>
    </body>
    </html>
  `;
}

export async function POST(request: NextRequest) {
  console.log('📄 PDF Generation Request Started');

  try {
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
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/fetch-live-data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer mock-token-for-pdf-generation`
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

    // Prepare report data
    const reportData: ReportData = {
      client,
      dateRange,
      campaigns,
      totals: calculatedTotals,
      metaTables: metaTablesData
    };

    console.log('🎯 PDF Generation Data:', {
      client: reportData.client.name,
      dateRange: `${reportData.dateRange.start} to ${reportData.dateRange.end}`,
      campaigns: reportData.campaigns.length,
      spend: (reportData.totals.spend || 0).toFixed(2) + ' zł',
      impressions: (reportData.totals.impressions || 0).toLocaleString(),
      clicks: (reportData.totals.clicks || 0).toLocaleString(),
      hasMetaTables: !!reportData.metaTables
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
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    
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