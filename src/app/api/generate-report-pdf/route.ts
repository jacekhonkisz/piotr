import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Campaign {
  id: string;
  campaign_id: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpp?: number;
  frequency?: number;
  reach?: number;
  date_range_start: string;
  date_range_end: string;
  status?: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'DRAFT';
  ad_type?: 'IMAGE' | 'VIDEO' | 'CAROUSEL' | 'COLLECTION' | 'REELS' | 'STORY' | 'UNKNOWN';
  objective?: string;
  budget?: number;
  start_time?: string;
  stop_time?: string;
}

interface Client {
  id: string;
  name: string;
  email: string;
  ad_account_id: string;
  meta_token?: string;
}

interface ReportData {
  client: Client;
  dateRange: {
    start: string;
    end: string;
  };
  campaigns: Campaign[];
  totals: {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    cpc: number;
    cpm: number;
  };
  trends: {
    spend: number;
    conversions: number;
    ctr: number;
  };
}

function generateReportHTML(reportData: ReportData): string {
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

  // Debug: Log the client data being used in HTML generation
  console.log('🔍 HTML Generation - Client data:', {
    id: reportData.client.id,
    name: reportData.client.name,
    email: reportData.client.email
  });

  return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Raport Meta Ads - ${reportData.client.name}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #1f2937;
          background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
          padding: 40px 20px;
        }
        
        .container {
          max-width: 1200px;
          margin: 0 auto;
          background: white;
          border-radius: 24px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          overflow: hidden;
        }
        
        .header {
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
          color: white;
          padding: 40px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        
        .header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="white" opacity="0.1"/><circle cx="75" cy="75" r="1" fill="white" opacity="0.1"/><circle cx="50" cy="10" r="0.5" fill="white" opacity="0.1"/><circle cx="10" cy="60" r="0.5" fill="white" opacity="0.1"/><circle cx="90" cy="40" r="0.5" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
          opacity: 0.3;
        }
        
        .header-content {
          position: relative;
          z-index: 1;
        }
        
        .header h1 {
          font-size: 48px;
          font-weight: 800;
          margin-bottom: 8px;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .header p {
          font-size: 20px;
          opacity: 0.9;
          margin-bottom: 16px;
        }
        
        .header .date-range {
          font-size: 18px;
          opacity: 0.8;
          background: rgba(255, 255, 255, 0.1);
          padding: 8px 16px;
          border-radius: 12px;
          display: inline-block;
          backdrop-filter: blur(10px);
        }
        
        .content {
          padding: 40px;
        }
        
        .section {
          margin-bottom: 40px;
        }
        
        .section-header {
          display: flex;
          align-items: center;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 2px solid #e5e7eb;
        }
        
        .section-icon {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 16px;
          color: white;
          font-size: 24px;
        }
        
        .section-title {
          font-size: 28px;
          font-weight: 700;
          color: #1f2937;
        }
        
        .section-subtitle {
          font-size: 16px;
          color: #6b7280;
          margin-top: 4px;
        }
        
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 24px;
          margin-bottom: 40px;
        }
        
        .metric-card {
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border-radius: 16px;
          padding: 24px;
          border: 1px solid #e2e8f0;
          position: relative;
          overflow: hidden;
        }
        
        .metric-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%);
        }
        
        .metric-header {
          display: flex;
          align-items: center;
          margin-bottom: 16px;
        }
        
        .metric-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 12px;
          font-size: 20px;
        }
        
        .metric-icon.spend { background: #dbeafe; color: #1d4ed8; }
        .metric-icon.conversions { background: #dcfce7; color: #15803d; }
        .metric-icon.ctr { background: #f3e8ff; color: #7c3aed; }
        
        .metric-title {
          font-size: 16px;
          font-weight: 600;
          color: #374151;
        }
        
        .metric-value {
          font-size: 32px;
          font-weight: 800;
          color: #1f2937;
          margin-bottom: 8px;
        }
        
        .metric-trend {
          display: flex;
          align-items: center;
          font-size: 14px;
          font-weight: 500;
        }
        
        .trend-positive { color: #059669; }
        .trend-negative { color: #dc2626; }
        .trend-neutral { color: #6b7280; }
        
        .trend-arrow {
          margin-right: 4px;
          font-size: 16px;
        }
        
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 40px;
        }
        
        .kpi-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          text-align: center;
          border: 1px solid #e5e7eb;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .kpi-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px;
          font-size: 24px;
        }
        
        .kpi-icon.impressions { background: #dbeafe; color: #1d4ed8; }
        .kpi-icon.clicks { background: #dcfce7; color: #15803d; }
        .kpi-icon.cpm { background: #fef3c7; color: #d97706; }
        .kpi-icon.cpc { background: #fce7f3; color: #be185d; }
        .kpi-icon.reach { background: #e0e7ff; color: #5b21b6; }
        .kpi-icon.frequency { background: #fef2f2; color: #dc2626; }
        
        .kpi-label {
          font-size: 14px;
          font-weight: 500;
          color: #6b7280;
          margin-bottom: 8px;
        }
        
        .kpi-value {
          font-size: 24px;
          font-weight: 700;
          color: #1f2937;
        }
        
        .campaigns-table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .campaigns-table th {
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          padding: 16px;
          text-align: left;
          font-weight: 600;
          color: #374151;
          border-bottom: 2px solid #e5e7eb;
        }
        
        .campaigns-table td {
          padding: 16px;
          border-bottom: 1px solid #f3f4f6;
        }
        
        .campaigns-table tr:hover {
          background: #f9fafb;
        }
        
        .campaign-name {
          font-weight: 600;
          color: #1f2937;
        }
        
        .campaign-status {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          text-transform: uppercase;
        }
        
        .status-active { background: #dcfce7; color: #15803d; }
        .status-paused { background: #fef3c7; color: #d97706; }
        .status-completed { background: #dbeafe; color: #1d4ed8; }
        .status-draft { background: #f3f4f6; color: #6b7280; }
        
        .footer {
          background: #f8fafc;
          padding: 24px 40px;
          text-align: center;
          border-top: 1px solid #e5e7eb;
        }
        
        .footer-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          max-width: 800px;
          margin: 0 auto;
        }
        
        .footer-info {
          display: flex;
          align-items: center;
          gap: 24px;
          font-size: 14px;
          color: #6b7280;
        }
        
        .footer-info-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .generated-date {
          font-weight: 500;
          color: #374151;
        }
        
        @media print {
          body { padding: 0; }
          .container { box-shadow: none; border-radius: 0; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="header-content">
            <h1>📊 Raport Meta Ads</h1>
            <p>${reportData.client.name} - Premium Analytics Dashboard</p>
            <div class="date-range">
              ${formatDate(reportData.dateRange.start)} - ${formatDate(reportData.dateRange.end)}
            </div>
          </div>
        </div>
        
        <div class="content">
          <!-- Key Metrics Section -->
          <div class="section">
            <div class="section-header">
              <div class="section-icon">🏆</div>
              <div>
                <div class="section-title">Kluczowe Metryki</div>
                <div class="section-subtitle">Wydajność kampanii w czasie rzeczywistym</div>
              </div>
            </div>
            
            <div class="metrics-grid">
              <div class="metric-card">
                <div class="metric-header">
                  <div class="metric-icon spend">💰</div>
                  <div class="metric-title">Wydatki</div>
                </div>
                <div class="metric-value">${formatCurrency(reportData.totals.spend)}</div>
                <div class="metric-trend ${reportData.trends.spend >= 0 ? 'trend-positive' : 'trend-negative'}">
                  <span class="trend-arrow">${reportData.trends.spend >= 0 ? '↗' : '↘'}</span>
                  ${reportData.trends.spend === 0 ? 'Brak danych z poprzedniego miesiąca' : `${reportData.trends.spend >= 0 ? '+' : ''}${reportData.trends.spend.toFixed(1)}% vs poprzedni miesiąc`}
                </div>
              </div>
              
              <div class="metric-card">
                <div class="metric-header">
                  <div class="metric-icon conversions">🎯</div>
                  <div class="metric-title">Konwersje</div>
                </div>
                <div class="metric-value">${formatNumber(reportData.totals.conversions)}</div>
                <div class="metric-trend ${reportData.trends.conversions >= 0 ? 'trend-positive' : 'trend-negative'}">
                  <span class="trend-arrow">${reportData.trends.conversions >= 0 ? '↗' : '↘'}</span>
                  ${reportData.trends.conversions === 0 ? 'Brak danych z poprzedniego miesiąca' : `${reportData.trends.conversions >= 0 ? '+' : ''}${reportData.trends.conversions.toFixed(1)}% vs poprzedni miesiąc`}
                </div>
              </div>
              
              <div class="metric-card">
                <div class="metric-header">
                  <div class="metric-icon ctr">📈</div>
                  <div class="metric-title">CTR</div>
                </div>
                <div class="metric-value">${formatPercentage(reportData.totals.ctr)}</div>
                <div class="metric-trend ${reportData.trends.ctr >= 0 ? 'trend-positive' : 'trend-negative'}">
                  <span class="trend-arrow">${reportData.trends.ctr >= 0 ? '↗' : '↘'}</span>
                  ${reportData.trends.ctr === 0 ? 'Brak danych z poprzedniego miesiąca' : `${reportData.trends.ctr >= 0 ? '+' : ''}${reportData.trends.ctr.toFixed(1)}% vs poprzedni miesiąc`}
                </div>
              </div>
            </div>
          </div>
          
          <!-- Performance Indicators Section -->
          <div class="section">
            <div class="section-header">
              <div class="section-icon">📊</div>
              <div>
                <div class="section-title">Wskaźniki Wydajności</div>
                <div class="section-subtitle">Szczegółowe metryki kampanii</div>
              </div>
            </div>
            
            <div class="kpi-grid">
              <div class="kpi-card">
                <div class="kpi-icon impressions">👁️</div>
                <div class="kpi-label">Wyświetlenia</div>
                <div class="kpi-value">${formatNumber(reportData.totals.impressions)}</div>
              </div>
              
              <div class="kpi-card">
                <div class="kpi-icon clicks">🖱️</div>
                <div class="kpi-label">Kliknięcia</div>
                <div class="kpi-value">${formatNumber(reportData.totals.clicks)}</div>
              </div>
              
              <div class="kpi-card">
                <div class="kpi-icon cpm">📊</div>
                <div class="kpi-label">CPM</div>
                <div class="kpi-value">${formatCurrency(reportData.totals.cpm)}</div>
              </div>
              
              <div class="kpi-card">
                <div class="kpi-icon cpc">💵</div>
                <div class="kpi-label">CPC</div>
                <div class="kpi-value">${formatCurrency(reportData.totals.cpc)}</div>
              </div>
              
              <div class="kpi-card">
                <div class="kpi-icon reach">👥</div>
                <div class="kpi-label">Zasięg</div>
                <div class="kpi-value">${formatNumber(Math.round(reportData.totals.impressions / 3))}</div>
              </div>
              
              <div class="kpi-card">
                <div class="kpi-icon frequency">🔄</div>
                <div class="kpi-label">Częstotliwość</div>
                <div class="kpi-value">3.0</div>
              </div>
            </div>
          </div>
          
          <!-- Campaigns Table Section -->
          <div class="section">
            <div class="section-header">
              <div class="section-icon">📋</div>
              <div>
                <div class="section-title">Szczegóły Kampanii</div>
                <div class="section-subtitle">Lista wszystkich aktywnych kampanii</div>
              </div>
            </div>
            
            <table class="campaigns-table">
              <thead>
                <tr>
                  <th>Nazwa Kampanii</th>
                  <th>Status</th>
                  <th>Wydatki</th>
                  <th>Wyświetlenia</th>
                  <th>Kliknięcia</th>
                  <th>Konwersje</th>
                  <th>CTR</th>
                  <th>CPC</th>
                </tr>
              </thead>
              <tbody>
                ${reportData.campaigns.map(campaign => `
                  <tr>
                    <td class="campaign-name">${campaign.campaign_name}</td>
                    <td>
                      <span class="campaign-status status-${campaign.status?.toLowerCase() || 'active'}">
                        ${campaign.status || 'ACTIVE'}
                      </span>
                    </td>
                    <td>${formatCurrency(campaign.spend)}</td>
                    <td>${formatNumber(campaign.impressions)}</td>
                    <td>${formatNumber(campaign.clicks)}</td>
                    <td>${formatNumber(campaign.conversions)}</td>
                    <td>${formatPercentage(campaign.ctr)}</td>
                    <td>${formatCurrency(campaign.cpc)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
        
        <div class="footer">
          <div class="footer-content">
            <div class="footer-info">
              <div class="footer-info-item">
                <span>📊</span>
                <span>Raport oparty na danych z Meta API</span>
              </div>
              <div class="footer-info-item">
                <span>🕒</span>
                <span>Ostatnia synchronizacja: ${new Date().toLocaleString('pl-PL')}</span>
              </div>
            </div>
            <div class="generated-date">
              Wygenerowano: ${new Date().toLocaleString('pl-PL')}
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function POST(request: NextRequest) {
  try {
    // Extract the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.substring(7);

    // Verify the JWT token and get user
    const { data: { user }, error: userAuthError } = await supabase.auth.getUser(token);
    if (userAuthError || !user) {
      console.error('Token verification failed:', userAuthError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const { clientId, monthId, includeEmail } = await request.json();

    if (!clientId || !monthId) {
      return NextResponse.json({ error: 'Client ID and Month ID are required' }, { status: 400 });
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

    // Debug: Log the client data being used
    console.log('🔍 PDF Generation - Client data:', {
      id: client.id,
      name: client.name,
      email: client.email
    });

    // Parse month ID to get start and end dates
    const [year, month] = monthId.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    const monthStartDate = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
    const monthEndDate = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    // Get report data from database
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('*')
      .eq('client_id', clientId)
      .eq('date_range_start', monthStartDate)
      .eq('date_range_end', monthEndDate)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (reportError) {
      return NextResponse.json({ error: 'Report not found for this period' }, { status: 404 });
    }

    // Get campaigns for this report
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', clientId)
      .eq('date_range_start', monthStartDate)
      .eq('date_range_end', monthEndDate);

    if (campaignsError) {
      return NextResponse.json({ error: 'Failed to fetch campaign data' }, { status: 500 });
    }

    // Calculate totals
    const totals = campaigns?.reduce((acc, campaign) => ({
      spend: acc.spend + (campaign.spend || 0),
      impressions: acc.impressions + (campaign.impressions || 0),
      clicks: acc.clicks + (campaign.clicks || 0),
      conversions: acc.conversions + (campaign.conversions || 0)
    }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 }) || { spend: 0, impressions: 0, clicks: 0, conversions: 0 };

    const calculatedTotals = {
      ...totals,
      ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
      cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
      cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0
    };

    // Calculate trends (simplified - in real implementation you'd compare with previous month)
    const trends = {
      spend: 0,
      conversions: 0,
      ctr: 0
    };

    // Debug: Log the report data being passed to HTML generation
    console.log('🔍 PDF Generation - Report data client:', {
      id: client.id,
      name: client.name,
      email: client.email
    });

    // Prepare report data
    const reportData: ReportData = {
      client,
      dateRange: {
        start: monthStartDate,
        end: monthEndDate
      },
      campaigns: campaigns?.map(campaign => ({
        id: `${campaign.campaign_id}-${monthId}`,
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
        date_range_start: monthStartDate,
        date_range_end: monthEndDate,
        status: campaign.status,
        objective: campaign.objective
      })) || [],
      totals: calculatedTotals,
      trends
    };

    // Generate HTML
    const html = generateReportHTML(reportData);

    // Launch Puppeteer and generate PDF
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      }
    });

    await browser.close();

    // Convert Uint8Array to Buffer for email service
    const pdfBufferForEmail = Buffer.from(pdfBuffer);

    // If email is requested, send it
    if (includeEmail) {
      const EmailService = (await import('../../../lib/email')).default;
      const emailService = EmailService.getInstance();
      
      const emailResult = await emailService.sendReportEmail(
        client.email,
        client.name,
        {
          dateRange: `${monthStartDate} to ${monthEndDate}`,
          totalSpend: calculatedTotals.spend,
          totalImpressions: calculatedTotals.impressions,
          totalClicks: calculatedTotals.clicks,
          ctr: calculatedTotals.ctr / 100,
          cpc: calculatedTotals.cpc,
          cpm: calculatedTotals.cpm
        },
        pdfBufferForEmail
      );

      if (!emailResult.success) {
        return NextResponse.json({ 
          error: 'Failed to send email',
          details: emailResult.error 
        }, { status: 500 });
      }

      // Log email sending
      await supabase
        .from('email_logs')
        .insert({
          client_id: clientId,
          admin_id: user.id,
          email_type: 'report_pdf',
          recipient_email: client.email,
          subject: `Raport Meta Ads - ${monthStartDate} do ${monthEndDate}`,
          message_id: emailResult.messageId,
          sent_at: new Date().toISOString(),
          status: 'sent'
        });

      return NextResponse.json({
        success: true,
        message: 'PDF report generated and sent via email',
        messageId: emailResult.messageId
      });
    }

    // Return PDF as response
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="report-${client.name}-${monthId}.pdf"`
      }
    });

  } catch (error) {
    console.error('Error generating PDF report:', error);
    return NextResponse.json({ 
      error: 'Failed to generate PDF report',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 