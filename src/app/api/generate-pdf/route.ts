import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import logger from '@/lib/logger';

interface ReportData {
  totals: {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    cpc: number;
  };
  metaCampaigns?: any[];
  googleCampaigns?: any[];
  platform?: string;
  isUnifiedReport?: boolean;
  previousYearConversions?: any;
  platformTotals?: {
    meta?: {
      totalSpend: number;
      totalImpressions: number;
      totalClicks: number;
      totalReservations: number;
      totalReservationValue: number;
    };
    google?: {
      totalSpend: number;
      totalImpressions: number;
      totalClicks: number;
      totalReservations: number;
      totalReservationValue: number;
    };
  };
}

interface Client {
  id: string;
  name: string;
  email: string;
}

// Generate Conversion Funnel HTML - EXACT copy from ConversionFunnel.tsx
const generateConversionFunnelHTML = (campaigns: any[], platform: string = 'Meta', yoyData?: any) => {
  // Calculate funnel steps from campaigns data
  const step1 = campaigns.reduce((sum, campaign) => sum + (campaign.booking_step_1 || 0), 0);
  const step2 = campaigns.reduce((sum, campaign) => sum + (campaign.potencjalne_kontakty_telefon || 0), 0);
  const step3 = campaigns.reduce((sum, campaign) => sum + (campaign.potencjalne_kontakty_email || 0), 0);
  const reservations = campaigns.reduce((sum, campaign) => sum + (campaign.reservations || 0), 0);
  const reservationValue = campaigns.reduce((sum, campaign) => sum + (campaign.reservation_value || 0), 0);

  // Create funnel path function - EXACT copy from ConversionFunnel.tsx
  const createFunnelPath = (index: number, total: number) => {
    const baseWidth = 600; // Base width in pixels
    const height = 90; // Height of each step
    const taperRatio = 0.15; // How much each step narrows

    const stepWidth = baseWidth - (index * baseWidth * taperRatio);
    const nextStepWidth = baseWidth - ((index + 1) * baseWidth * taperRatio);

    // Create trapezoid shape
    const leftOffset = (baseWidth - stepWidth) / 2;
    const rightOffset = baseWidth - leftOffset;
    const nextLeftOffset = (baseWidth - nextStepWidth) / 2;
    const nextRightOffset = baseWidth - nextLeftOffset;

    return `polygon(${leftOffset}px 0%, ${rightOffset}px 0%, ${nextRightOffset}px 100%, ${nextLeftOffset}px 100%)`;
  };

  // Funnel steps data - EXACT copy from ConversionFunnel.tsx with monochrome icons
  const funnelSteps = [
    {
      label: "Krok 1 w BE",
      value: step1,
      percentage: 100,
      icon: "◐",
      color: "text-white",
      bgColor: "background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)"
    },
    {
      label: "Potencjalne kontakty – telefon",
      value: step2,
      percentage: step1 > 0 ? Math.round((step2 / step1) * 100) : 0,
      icon: "▣",
      color: "text-white",
      bgColor: "background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)"
    },
    {
      label: "Potencjalne kontakty – e-mail",
      value: step3,
      percentage: step1 > 0 ? Math.round((step3 / step1) * 100) : 0,
      icon: "✓",
      color: "text-white",
      bgColor: "background: linear-gradient(135deg, #10b981 0%, #059669 100%)"
    },
    {
      label: "Kroki rezerwacji – Etap 1",
      value: reservations,
      percentage: step1 > 0 ? Math.round((reservations / step1) * 100) : 0,
      icon: "▢",
      color: "text-white",
      bgColor: "background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
    }
  ];

  // Bottom cards data - EXACT copy from ConversionFunnel.tsx with monochrome icons
  const bottomCards = [
    {
      label: "Rezerwacje (zakończone)",
      value: reservations,
      icon: "€",
      bgColor: "background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
    },
    {
      label: "Wartość rezerwacji (zł)",
      value: reservationValue,
      icon: "↗",
      bgColor: "background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)"
    }
  ];

  const funnelStepsHTML = funnelSteps.map((step, index) => `
    <div style="
      position: relative;
      ${step.bgColor};
      text-align: center;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      clip-path: ${createFunnelPath(index, funnelSteps.length)};
      width: 600px;
      height: 90px;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="display: flex; align-items: center; justify-content: center; gap: 16px; padding: 0 32px;">
        <div style="padding: 12px; background: rgba(226, 232, 240, 0.3); border-radius: 8px; flex-shrink: 0; color: white;">
          <span style="font-size: 24px;">${step.icon}</span>
      </div>
        <div style="text-align: center; position: relative; min-width: 0; flex: 1;">
          <div style="font-size: 20px; font-weight: 700; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${(step.value as number).toLocaleString()}
        </div>
          <div style="font-size: 12px; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
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
      <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 8px;">
        <span style="font-size: 20px;">${card.icon}</span>
        <div style="font-size: 18px; font-weight: 700;">
          ${(card.value as number).toLocaleString()}
                </div>
              </div>
      <div style="font-size: 12px; opacity: 0.9;">
        ${card.label}
            </div>
    </div>
  `).join('');

  // Year-over-Year comparison (optional)
  const yoyHTML = yoyData ? `
    <div style="margin-left: 32px;">
      <h4 style="color: #1e293b; font-size: 16px; font-weight: 600; margin-bottom: 16px; text-align: center;">
        Porównanie rok do roku
      </h4>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${['step1', 'step2', 'step3', 'reservations'].map((key, index) => {
          const change = yoyData.changes?.[key] || 0;
          const isPositive = change > 0;
          const isNeutral = change === 0;
          
          return `
            <div style="
              padding: 8px;
              border-radius: 8px;
              text-align: center;
              min-width: 90px;
              font-size: 12px;
              font-weight: 500;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
              height: 90px;
              display: flex;
              align-items: center;
              justify-content: center;
              ${isNeutral 
                ? 'background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0;'
                : isPositive 
                  ? 'background: #dcfce7; color: #166534; border: 1px solid #bbf7d0;'
                  : 'background: #fef2f2; color: #991b1b; border: 1px solid #fecaca;'
              }
            ">
              <div style="text-align: center;">
                <div style="font-weight: 700;">
                  ${isNeutral ? 'N/A' : `${isPositive ? '↗' : '↘'} ${Math.abs(change).toFixed(1)}%`}
                </div>
                <div style="font-size: 10px; margin-top: 4px;">vs rok temu</div>
              </div>
            </div>
          `;
        }).join('')}
                </div>
              </div>
  ` : '';

  return `
    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 12px; padding: 32px; margin: 20px 0;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h3 style="color: #1e293b; font-size: 24px; font-weight: 700; margin: 0 0 8px 0;">Konwersje Online</h3>
        <p style="color: #64748b; font-size: 16px; margin: 0;">Ścieżka konwersji w systemie rezerwacji</p>
          </div>
          
      <div style="display: flex; align-items: flex-start; justify-content: center; gap: 32px;">
        <!-- Funnel Steps Column - EXACT copy from ConversionFunnel.tsx -->
        <div style="display: flex; flex-direction: column; align-items: center; gap: 16px;">
          ${funnelStepsHTML}
          
          <!-- Bottom Cards - EXACT copy from ConversionFunnel.tsx -->
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 32px; width: 100%; max-width: 512px;">
            ${bottomCardsHTML}
          </div>
        </div>
        
        <!-- Year-over-Year Comparison Column -->
        ${yoyHTML}
        </div>
      </div>
    `;
};

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

  return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Raport Kampanii Reklamowych</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                background: #fff;
            }
            
            .page-break-before {
                page-break-before: always;
            }
            
                .container { 
                padding: 40px;
                max-width: 100%;
            }
            
            h1, h2, h3 {
                margin-bottom: 20px;
            }
            
            .header {
                text-align: center;
                margin-bottom: 40px;
                padding: 30px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border-radius: 12px;
            }
            
            .summary {
                background: #f8f9fa;
                padding: 30px;
                border-radius: 12px;
                margin-bottom: 30px;
            }
        </style>
    </head>
    <body>
        <!-- Page 1 - Cover Page -->
        <div class="container">
            <div class="header">
                <h1 style="font-size: 36px; margin-bottom: 10px;">📊 Raport Kampanii Reklamowych</h1>
                <p style="font-size: 18px; opacity: 0.9;">Analiza wyników Meta Ads i Google Ads</p>
                <p style="font-size: 14px; margin-top: 20px; opacity: 0.8;">Wygenerowano: ${new Date().toLocaleDateString('pl-PL')}</p>
                </div>
                
            <div class="summary">
                <h2 style="color: #333; margin-bottom: 20px;">📈 Podsumowanie wykonawcze</h2>
                <p style="font-size: 16px; line-height: 1.8;">
                    Ten raport przedstawia kompleksową analizę wyników kampanii reklamowych prowadzonych na platformach Meta Ads (Facebook & Instagram) oraz Google Ads. 
                    Dokument zawiera szczegółowe ścieżki konwersji pokazujące efektywność każdej platformy w generowaniu rezerwacji i wartości biznesowej.
                </p>
                
                <div style="margin-top: 30px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
                    <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                        <h3 style="color: #3b82f6; margin-bottom: 10px;">📱 Meta Ads</h3>
                        <p style="font-size: 14px; color: #666;">Kampanie na Facebook i Instagram z fokusem na engagement i konwersje</p>
                    </div>
                    <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981;">
                        <h3 style="color: #10b981; margin-bottom: 10px;">🔍 Google Ads</h3>
                        <p style="font-size: 14px; color: #666;">Kampanie wyszukiwania i displayowe z fokusem na intent i reach</p>
                </div>
            </div>
                        </div>
                    </div>
                    
        <!-- Page 2 - Meta Ads Conversion Funnel -->
                            ${reportData.platform === 'meta' || reportData.isUnifiedReport ? `
        <div class="page-break-before container">
            <div style="text-align: center; margin-bottom: 40px;">
                <h2 style="color: #1e40af; font-size: 32px; font-weight: 600; margin: 0 0 10px 0;">Meta Ads</h2>
                <p style="color: #3b82f6; font-size: 16px; margin: 0;">Ścieżka konwersji w systemie rezerwacji</p>
                </div>
                
            ${generateConversionFunnelHTML(reportData.metaCampaigns || [], 'Meta Ads', reportData.previousYearConversions)}
            </div>
                            ` : ''}
                            
        <!-- Page 3 - Google Ads Conversion Funnel -->
                            ${reportData.platform === 'google' || reportData.isUnifiedReport ? `
        <div class="page-break-before container">
            <div style="text-align: center; margin-bottom: 40px;">
                <h2 style="color: #166534; font-size: 32px; font-weight: 600; margin: 0 0 10px 0;">Google Ads</h2>
                <p style="color: #16a34a; font-size: 16px; margin: 0;">Ścieżka konwersji w systemie rezerwacji</p>
                    </div>

            ${generateConversionFunnelHTML(reportData.googleCampaigns || [], 'Google Ads', reportData.previousYearConversions)}
            </div>
        ` : ''}
        </body>
    </html>
  `;
}

export async function POST(request: NextRequest) {
  logger.info('📄 PDF Generation Request Started');

  try {
    const body = await request.json();
    logger.info('📊 Received request body:', { keys: Object.keys(body) });

    // Handle both old format (reportData + client) and new format (clientId + dateRange)
    let reportData: ReportData;
    let client: Client;

    if (body.reportData && body.client) {
      // Old format - direct data
      reportData = body.reportData;
      client = body.client;
      logger.info('📊 Using direct reportData format');
    } else if (body.clientId && body.dateRange) {
      // New format - fetch data based on clientId and dateRange
      logger.info('📊 Using clientId + dateRange format, fetching data...');
      
      // For now, create mock data structure to prevent the error
      // TODO: Implement actual data fetching from database
      reportData = {
        totals: {
          spend: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          ctr: 0,
          cpc: 0
        },
        metaCampaigns: [],
        googleCampaigns: [],
        platform: 'unified',
        isUnifiedReport: true,
        platformTotals: {
            meta: {
            totalSpend: 0,
            totalImpressions: 0,
            totalClicks: 0,
            totalReservations: 0,
            totalReservationValue: 0
            },
            google: {
            totalSpend: 0,
            totalImpressions: 0,
            totalClicks: 0,
            totalReservations: 0,
            totalReservationValue: 0
          }
        }
      };

      client = {
        id: body.clientId,
        name: 'Client Name', // TODO: Fetch from database
        email: 'client@example.com' // TODO: Fetch from database
      };

      logger.info('📊 Created mock data structure for PDF generation');
      } else {
      logger.error('❌ Invalid request format - missing required data');
      return NextResponse.json(
        { error: 'Missing required data. Provide either (reportData + client) or (clientId + dateRange)' },
        { status: 400 }
      );
    }

    logger.info('📊 Generating PDF HTML content...');
    const html = generatePDFHTML(reportData);

    logger.info('🚀 Launching Puppeteer...');
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process'
      ]
    });

    const page = await browser.newPage();
    
    // Capture page errors
    page.on('pageerror', (error) => {
      logger.error('📄 PDF Page Error:', error.message);
    });
    
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    logger.info('⏳ Waiting for content to render...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
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

    // Encode filename to handle non-ASCII characters (Polish characters like ł, ą, ć, etc.)
    const sanitizedClientName = client.name
      .replace(/[^\w\s-]/g, '') // Remove special characters except word chars, spaces, and hyphens
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .substring(0, 50); // Limit length
    
    const filename = `raport_kampanii_${sanitizedClientName}_${new Date().toISOString().split('T')[0]}.pdf`;
    const encodedFilename = encodeURIComponent(filename);
    
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });

  } catch (error) {
    logger.error('❌ PDF Generation Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate PDF',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
