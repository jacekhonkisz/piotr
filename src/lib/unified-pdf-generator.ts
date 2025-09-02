/**
 * Unified PDF Generator for Meta Ads and Google Ads Reports
 * Generates comprehensive PDF reports that include data from both platforms
 */

import { UnifiedReport, UnifiedCampaign, PlatformTotals } from './unified-campaign-types';

export interface UnifiedPDFOptions {
  report: UnifiedReport;
  clientName: string;
  clientEmail?: string;
  clientLogo?: string;
  aiSummary?: string;
  currency?: string;
}

export class UnifiedPDFGenerator {
  
  /**
   * Generate HTML template for unified PDF report
   */
  static generateUnifiedHTML(options: UnifiedPDFOptions): string {
    const { report, clientName, clientEmail, clientLogo, aiSummary, currency = 'PLN' } = options;
    
    // Formatting utilities
    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('pl-PL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('pl-PL', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
      }).format(amount);
    };

    const formatNumber = (num: number) => {
      return new Intl.NumberFormat('pl-PL').format(Math.round(num));
    };

    const formatPercentage = (num: number) => {
      return `${num.toFixed(2)}%`;
    };

    const formatDateRange = (start: string, end: string) => {
      return `${formatDate(start)} - ${formatDate(end)}`;
    };

    // Generate campaign tables for both platforms
    const generateCampaignTable = (campaigns: UnifiedCampaign[], title: string, platformClass: string) => {
      if (campaigns.length === 0) {
        return `
          <div class="table-container">
            <h3 class="section-title">${title}</h3>
            <div class="no-data">
              <p>Brak kampanii w tym okresie</p>
            </div>
          </div>
        `;
      }

      const tableRows = campaigns.map(campaign => `
        <tr>
          <td class="campaign-name">
            <div class="campaign-info">
              <div class="name">${campaign.campaign_name}</div>
              <div class="status ${campaign.status.toLowerCase()}">${campaign.status}</div>
            </div>
          </td>
          <td class="text-right">${formatCurrency(campaign.spend)}</td>
          <td class="text-right">${formatNumber(campaign.impressions)}</td>
          <td class="text-right">${formatNumber(campaign.clicks)}</td>
          <td class="text-right">${formatPercentage(campaign.ctr)}</td>
          <td class="text-right">${formatCurrency(campaign.cpc)}</td>
          <td class="text-right">${formatNumber(campaign.reservations || 0)}</td>
          <td class="text-right">${(campaign.roas || 0).toFixed(2)}x</td>
        </tr>
      `).join('');

      return `
        <div class="table-container">
          <h3 class="section-title ${platformClass}">${title}</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Kampania</th>
                <th class="text-right">Wydano</th>
                <th class="text-right">Wyświetlenia</th>
                <th class="text-right">Kliknięcia</th>
                <th class="text-right">CTR</th>
                <th class="text-right">CPC</th>
                <th class="text-right">Rezerwacje</th>
                <th class="text-right">ROAS</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
      `;
    };

    // Generate the complete HTML
    return `
      <!DOCTYPE html>
      <html lang="pl">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Raport Unified — ${clientName}</title>
          <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
              
              :root {
                  --bg-page: #F7F8FB;
                  --bg-panel: #FFFFFF;
                  --text-strong: #0B1324;
                  --text-muted: #6B7280;
                  --brand-primary: #3B82F6;
                  --brand-secondary: #10B981;
                  --meta-color: #1877F2;
                  --google-color: #4285F4;
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
              
              /* Cover Page */
              .cover-page {
                  background: linear-gradient(135deg, var(--brand-primary) 0%, #8B5CF6 100%);
                  border-radius: 16px;
                  padding: 60px 40px;
                  text-align: center;
                  margin-bottom: 24px;
                  min-height: 90vh;
                  display: flex;
                  flex-direction: column;
                  justify-content: center;
                  color: white;
              }
              
              .logo-slot {
                  width: 120px;
                  height: 120px;
                  margin: 0 auto 30px auto;
                  background: rgba(255, 255, 255, 0.1);
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 12px;
                  backdrop-filter: blur(10px);
              }
              
              .logo-image {
                  width: 120px;
                  height: 120px;
                  object-fit: contain;
                  border-radius: 50%;
              }
              
              .cover-title h1 {
                  font-size: 48px;
                  font-weight: 700;
                  margin-bottom: 16px;
                  letter-spacing: -0.02em;
              }
              
              .cover-title h2 {
                  font-size: 28px;
                  font-weight: 500;
                  margin-bottom: 12px;
                  opacity: 0.9;
              }
              
              .cover-meta {
                  font-size: 18px;
                  opacity: 0.8;
                  margin-bottom: 40px;
              }
              
              .cover-kpi-row {
                  display: flex;
                  justify-content: center;
                  gap: 40px;
                  flex-wrap: wrap;
                  margin-bottom: 40px;
              }
              
              .cover-kpi {
                  text-align: center;
                  min-width: 140px;
                  background: rgba(255, 255, 255, 0.1);
                  padding: 20px;
                  border-radius: 12px;
                  backdrop-filter: blur(10px);
              }
              
              .cover-kpi-value {
                  font-size: 32px;
                  font-weight: 700;
                  display: block;
                  margin-bottom: 8px;
              }
              
              .cover-kpi-label {
                  font-size: 14px;
                  font-weight: 500;
                  text-transform: uppercase;
                  letter-spacing: 0.05em;
                  opacity: 0.8;
              }
              
              /* Section Styles */
              .section-title {
                  font-size: 20px;
                  font-weight: 600;
                  color: var(--text-strong);
                  margin-bottom: 16px;
                  letter-spacing: -0.01em;
              }
              
              .section-title.meta-platform {
                  color: var(--meta-color);
              }
              
              .section-title.google-platform {
                  color: var(--google-color);
              }
              
              /* Tables */
              .table-container {
                  background: var(--bg-page);
                  border-radius: 16px;
                  overflow: hidden;
                  margin-bottom: 32px;
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
              
              .text-right {
                  text-align: right;
              }
              
              .campaign-name .name {
                  font-weight: 600;
                  margin-bottom: 4px;
              }
              
              .campaign-name .status {
                  font-size: 12px;
                  padding: 2px 8px;
                  border-radius: 12px;
                  text-transform: uppercase;
                  font-weight: 500;
              }
              
              .status.active {
                  background: #D1FAE5;
                  color: #065F46;
              }
              
              .status.paused {
                  background: #FEF3C7;
                  color: #92400E;
              }
              
              .no-data {
                  padding: 40px;
                  text-align: center;
                  color: var(--text-muted);
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
              
              /* Page breaks */
              .page-break-before {
                  page-break-before: always;
              }
              
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
                  .section-title { page-break-after: avoid; }
                  .table-container { page-break-inside: auto; }
                  .data-table thead { 
                      display: table-header-group; 
                      page-break-after: avoid;
                  }
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
              <!-- Cover Page -->
              <div class="cover-page">
                  ${clientLogo 
                    ? `<img src="${clientLogo}" alt="${clientName} Logo" class="logo-image">`
                    : `<div class="logo-slot">Logo</div>`
                  }
                  
                  <div class="cover-title">
                      <h1>Raport Reklamowy</h1>
                      <h2>${clientName}</h2>
                  </div>
                  
                  <div class="cover-meta">
                      ${formatDateRange(report.date_range_start, report.date_range_end)}
                  </div>
                  
                  <div class="cover-kpi-row">
                      <div class="cover-kpi">
                          <span class="cover-kpi-value">${formatCurrency(report.totals.combined.totalSpend)}</span>
                          <span class="cover-kpi-label">Łączne Wydatki</span>
                      </div>
                      <div class="cover-kpi">
                          <span class="cover-kpi-value">${formatNumber(report.totals.combined.totalImpressions)}</span>
                          <span class="cover-kpi-label">Wyświetlenia</span>
                      </div>
                      <div class="cover-kpi">
                          <span class="cover-kpi-value">${formatNumber(report.totals.combined.totalClicks)}</span>
                          <span class="cover-kpi-label">Kliknięcia</span>
                      </div>
                      <div class="cover-kpi">
                          <span class="cover-kpi-value">${formatNumber(report.totals.combined.totalReservations)}</span>
                          <span class="cover-kpi-label">Rezerwacje</span>
                      </div>
                  </div>
              </div>
              
              <!-- AI Executive Summary -->
              ${aiSummary ? `
                <div class="ai-summary">
                    <h3>🤖 Podsumowanie Wykonawcze</h3>
                    ${aiSummary.split('\n').map(paragraph => 
                      paragraph.trim() ? `<p>${paragraph.trim()}</p>` : ''
                    ).join('')}
                </div>
              ` : ''}
              
              <!-- Campaign Tables -->
              <div class="page-break-before">
                  ${generateCampaignTable(report.metaCampaigns, 'Kampanie Meta Ads', 'meta-platform')}
                  ${generateCampaignTable(report.googleCampaigns, 'Kampanie Google Ads', 'google-platform')}
              </div>
              
              <!-- Footer -->
              <div class="footer">
                  <p>Raport wygenerowany: ${new Date().toLocaleDateString('pl-PL')} | 
                     Dane z: Meta Ads API & Google Ads API</p>
              </div>
          </div>
      </body>
      </html>
    `;
  }
}
