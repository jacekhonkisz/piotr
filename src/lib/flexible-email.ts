import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import logger from './logger';
import { RateLimiter } from './rate-limiter';
import { EMAIL_CONFIG, isMonitoringMode, getEmailRecipients, getEmailSubject } from './email-config';

export interface EmailData {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}

export interface ReportData {
  dateRange: string;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
}

export type EmailProvider = 'resend' | 'gmail' | 'auto';

export class FlexibleEmailService {
  private static instance: FlexibleEmailService;
  private resend: Resend;
  private gmailTransporter: nodemailer.Transporter;
  private rateLimiter: RateLimiter;
  private defaultProvider: EmailProvider;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
    this.defaultProvider = (process.env.EMAIL_PROVIDER as EmailProvider) || 'auto';
    
    // Initialize Gmail transporter if credentials are available
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      this.gmailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD
        }
      });
    }
    
    // Initialize rate limiter
    this.rateLimiter = new RateLimiter({
      minDelay: 100,
      maxCallsPerMinute: 600,
      backoffMultiplier: 1.5,
      maxBackoffDelay: 5000
    });
  }

  static getInstance(): FlexibleEmailService {
    if (!FlexibleEmailService.instance) {
      FlexibleEmailService.instance = new FlexibleEmailService();
    }
    return FlexibleEmailService.instance;
  }

  /**
   * Determine the best email provider based on recipient and configuration
   */
  private determineProvider(recipient: string): EmailProvider {
    if (this.defaultProvider !== 'auto') {
      return this.defaultProvider;
    }

    // Auto-detection logic
    const isJacEmail = recipient.toLowerCase().includes('jac.honkisz');
    const isVerifiedResendEmail = recipient.toLowerCase().includes('pbajerlein');
    
    if (isJacEmail && this.gmailTransporter) {
      return 'gmail'; // Use Gmail for direct sending to Jac
    }
    
    if (isVerifiedResendEmail) {
      return 'resend'; // Use Resend for verified emails
    }
    
    // Default to Resend for production emails
    return 'resend';
  }

  /**
   * Send email using the determined provider
   */
  async sendEmail(emailData: EmailData, provider?: EmailProvider): Promise<{ success: boolean; messageId?: string; error?: string; provider: string }> {
    const selectedProvider = provider || this.determineProvider(emailData.to);
    
    try {
      logger.info(`📧 Sending email via ${selectedProvider.toUpperCase()}...`, {
        to: emailData.to,
        subject: emailData.subject,
        provider: selectedProvider
      });

      let result: { success: boolean; messageId?: string; error?: string };

      switch (selectedProvider) {
        case 'gmail':
          result = await this.sendViaGmail(emailData);
          break;
        case 'resend':
          result = await this.sendViaResend(emailData);
          break;
        default:
          throw new Error(`Unsupported email provider: ${selectedProvider}`);
      }

      return {
        ...result,
        provider: selectedProvider
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ Email sending failed via ${selectedProvider}:`, errorMessage);
      
      return {
        success: false,
        error: errorMessage,
        provider: selectedProvider
      };
    }
  }

  /**
   * Send email via Gmail SMTP
   */
  private async sendViaGmail(emailData: EmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.gmailTransporter) {
      throw new Error('Gmail transporter not configured. Please set GMAIL_USER and GMAIL_APP_PASSWORD');
    }

    const mailOptions = {
      from: `"Meta Ads Reports" <${process.env.GMAIL_USER}>`,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
      attachments: emailData.attachments
    };

    const result = await this.gmailTransporter.sendMail(mailOptions);
    
    return {
      success: true,
      messageId: result.messageId
    };
  }

  /**
   * Send email via Resend API
   */
  private async sendViaResend(emailData: EmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Wait for rate limit slot
    await this.rateLimiter.waitForNextCall();
    
    // Get appropriate recipients based on configuration
    const originalRecipient = emailData.to;
    const recipients = getEmailRecipients(originalRecipient);
    const subject = getEmailSubject(emailData.subject);

    const resendData = {
      from: emailData.from,
      to: recipients,
      subject: subject,
      html: emailData.html,
      text: emailData.text,
      attachments: emailData.attachments
    };

    const { data, error } = await this.resend.emails.send(resendData);
    
    if (error) {
      return {
        success: false,
        error: error.message || 'Unknown Resend error'
      };
    }

    return {
      success: true,
      messageId: data.id
    };
  }

  /**
   * Send report email with automatic provider selection
   */
  async sendReportEmail(
    recipient: string,
    clientName: string,
    reportData: ReportData,
    pdfBuffer?: Buffer,
    provider?: EmailProvider
  ): Promise<{ success: boolean; messageId?: string; error?: string; provider: string }> {
    const subject = `Meta Ads Report - ${clientName} - ${reportData.dateRange}`;
    
    const html = this.generateReportHTML(clientName, reportData);
    const text = this.generateReportText(clientName, reportData);

    const emailData: EmailData = {
      to: recipient,
      from: this.getFromAddress(provider || this.determineProvider(recipient)),
      subject,
      html,
      text
    };

    if (pdfBuffer) {
      emailData.attachments = [{
        filename: `report-${new Date().toISOString().split('T')[0]}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }];
    }

    return this.sendEmail(emailData, provider);
  }

  /**
   * Send interactive report email with automatic provider selection
   */
  async sendInteractiveReportEmail(
    recipient: string,
    clientName: string,
    reportData: ReportData,
    pdfBuffer: Buffer,
    provider?: EmailProvider
  ): Promise<{ success: boolean; messageId?: string; error?: string; provider: string }> {
    const subject = `Your Interactive Meta Ads Report - ${reportData.dateRange}`;
    
    const html = this.generateInteractiveReportHTML(clientName, reportData);
    const text = this.generateInteractiveReportText(clientName, reportData);

    const emailData: EmailData = {
      to: recipient,
      from: this.getFromAddress(provider || this.determineProvider(recipient)),
      subject,
      html,
      text,
      attachments: [{
        filename: `interactive-meta-ads-report-${new Date().toISOString().split('T')[0]}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }]
    };

    return this.sendEmail(emailData, provider);
  }

  /**
   * Send custom report email with automatic provider selection
   */
  async sendCustomReportEmail(
    recipient: string,
    clientName: string,
    reportData: ReportData,
    content: {
      summary: string;
      customMessage: string;
    },
    pdfBuffer?: Buffer,
    provider?: EmailProvider
  ): Promise<{ success: boolean; messageId?: string; error?: string; provider: string }> {
    const subject = `📊 Meta Ads Performance Report - ${reportData.dateRange}`;
    
    const html = this.generateCustomReportHTML(clientName, reportData, content);
    const text = this.generateCustomReportText(clientName, reportData, content);

    const emailData: EmailData = {
      to: recipient,
      from: this.getFromAddress(provider || this.determineProvider(recipient)),
      subject,
      html,
      text
    };

    if (pdfBuffer) {
      const fileName = `Meta_Ads_Performance_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      emailData.attachments = [{
        filename: fileName,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }];
    }

    return this.sendEmail(emailData, provider);
  }

  /**
   * Get the appropriate from address based on provider
   */
  private getFromAddress(provider: EmailProvider): string {
    switch (provider) {
      case 'gmail':
        return process.env.GMAIL_USER || 'jac.honkisz@gmail.com';
      case 'resend':
        return process.env.EMAIL_FROM_ADDRESS || 'onboarding@resend.dev';
      default:
        return process.env.EMAIL_FROM_ADDRESS || 'onboarding@resend.dev';
    }
  }

  /**
   * Generate HTML report template
   */
  private generateReportHTML(clientName: string, reportData: ReportData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Meta Ads Report - ${clientName}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1877f2; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
          .metric { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #1877f2; }
          .metric h3 { margin: 0 0 5px 0; color: #1877f2; }
          .metric p { margin: 0; font-size: 18px; font-weight: bold; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Meta Ads Performance Report</h1>
            <p>${clientName} - ${reportData.dateRange}</p>
          </div>
          
          <div class="content">
            <p>Dear ${clientName},</p>
            <p>Here's your Meta Ads performance report for the period ${reportData.dateRange}.</p>
            
            <div class="metric">
              <h3>💰 Total Spend</h3>
              <p>€${reportData.totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
            
            <div class="metric">
              <h3>👁️ Total Impressions</h3>
              <p>${reportData.totalImpressions.toLocaleString()}</p>
            </div>
            
            <div class="metric">
              <h3>🖱️ Total Clicks</h3>
              <p>${reportData.totalClicks.toLocaleString()}</p>
            </div>
            
            <div class="metric">
              <h3>📈 Click-Through Rate</h3>
              <p>${(reportData.ctr * 100).toFixed(2)}%</p>
            </div>
            
            <div class="metric">
              <h3>💵 Cost Per Click</h3>
              <p>€${reportData.cpc.toFixed(2)}</p>
            </div>
            
            <div class="metric">
              <h3>📊 Cost Per Mille</h3>
              <p>€${reportData.cpm.toFixed(2)}</p>
            </div>
            
            <p>Please find the detailed report attached to this email.</p>
            <p>If you have any questions about this report, please don't hesitate to reach out.</p>
            <p>Best regards,<br>Your Meta Ads Reporting Team</p>
          </div>
          
          <div class="footer">
            <p>This is an automated report. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate text report template
   */
  private generateReportText(clientName: string, reportData: ReportData): string {
    return `
Meta Ads Performance Report - ${clientName}
${reportData.dateRange}

Dear ${clientName},

Here's your Meta Ads performance report for the period ${reportData.dateRange}:

💰 Total Spend: €${reportData.totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2 })}
👁️ Total Impressions: ${reportData.totalImpressions.toLocaleString()}
🖱️ Total Clicks: ${reportData.totalClicks.toLocaleString()}
📈 Click-Through Rate: ${(reportData.ctr * 100).toFixed(2)}%
💵 Cost Per Click: €${reportData.cpc.toFixed(2)}
📊 Cost Per Mille: €${reportData.cpm.toFixed(2)}

Please find the detailed report attached to this email.

If you have any questions about this report, please don't hesitate to reach out.

Best regards,
Your Meta Ads Reporting Team

---
This is an automated report. Please do not reply to this email.
    `;
  }

  /**
   * Generate interactive report HTML template
   */
  private generateInteractiveReportHTML(clientName: string, reportData: ReportData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Interactive Meta Ads Report</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .highlight { background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
          .stat { background: white; padding: 15px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .stat-value { font-size: 24px; font-weight: bold; color: #667eea; }
          .stat-label { font-size: 12px; color: #666; text-transform: uppercase; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .interactive-note { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Interactive Meta Ads Report</h1>
            <p>${reportData.dateRange}</p>
          </div>
          
          <div class="content">
            <h2>Hello ${clientName},</h2>
            
            <p>Your interactive Meta Ads report is ready! This report includes detailed analytics with interactive tab switching for better data exploration.</p>
            
            <div class="interactive-note">
              <strong>🎯 Interactive Features:</strong>
              <ul>
                <li>Tab switching between Placement, Demographic, and Ad Relevance data</li>
                <li>Clickable navigation within the PDF</li>
                <li>Professional styling with modern design</li>
                <li>Comprehensive Meta Ads analytics</li>
              </ul>
            </div>
            
            <div class="stats">
              <div class="stat">
                <div class="stat-value">€${reportData.totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                <div class="stat-label">Total Spend</div>
              </div>
              <div class="stat">
                <div class="stat-value">${reportData.totalImpressions.toLocaleString()}</div>
                <div class="stat-label">Impressions</div>
              </div>
              <div class="stat">
                <div class="stat-value">${reportData.totalClicks.toLocaleString()}</div>
                <div class="stat-label">Clicks</div>
              </div>
              <div class="stat">
                <div class="stat-value">${(reportData.ctr * 100).toFixed(2)}%</div>
                <div class="stat-label">CTR</div>
              </div>
            </div>
            
            <div class="highlight">
              <h3>📋 Report Highlights:</h3>
              <ul>
                <li><strong>Top Placement Performance:</strong> See which ad placements are performing best</li>
                <li><strong>Demographic Insights:</strong> Understand your audience better</li>
                <li><strong>Ad Relevance Metrics:</strong> Track quality and engagement scores</li>
                <li><strong>Interactive Navigation:</strong> Switch between different data views easily</li>
              </ul>
            </div>
            
            <p><strong>Note:</strong> For the best interactive experience, open the attached PDF in Adobe Reader or a compatible PDF viewer with JavaScript enabled.</p>
            
            <p>If you have any questions about your report, please don't hesitate to contact us.</p>
            
            <p>Best regards,<br>Your Meta Ads Team</p>
          </div>
          
          <div class="footer">
            <p>This is an automated report generated by your Meta Ads management system.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate interactive report text template
   */
  private generateInteractiveReportText(clientName: string, reportData: ReportData): string {
    return `
Interactive Meta Ads Report - ${reportData.dateRange}

Hello ${clientName},

Your interactive Meta Ads report is ready! This report includes detailed analytics with interactive tab switching for better data exploration.

Interactive Features:
- Tab switching between Placement, Demographic, and Ad Relevance data
- Clickable navigation within the PDF
- Professional styling with modern design
- Comprehensive Meta Ads analytics

Report Summary:
- Total Spend: €${reportData.totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2 })}
- Impressions: ${reportData.totalImpressions.toLocaleString()}
- Clicks: ${reportData.totalClicks.toLocaleString()}
- CTR: ${(reportData.ctr * 100).toFixed(2)}%

Report Highlights:
- Top Placement Performance: See which ad placements are performing best
- Demographic Insights: Understand your audience better
- Ad Relevance Metrics: Track quality and engagement scores
- Interactive Navigation: Switch between different data views easily

Note: For the best interactive experience, open the attached PDF in Adobe Reader or a compatible PDF viewer with JavaScript enabled.

If you have any questions about your report, please don't hesitate to contact us.

Best regards,
Your Meta Ads Team

This is an automated report generated by your Meta Ads management system.
    `;
  }

  /**
   * Generate custom report HTML template
   */
  private generateCustomReportHTML(clientName: string, reportData: ReportData, content: { summary: string; customMessage: string }): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Meta Ads Performance Report</title>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 20px;
            background-color: #f5f7fa;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 40px 30px; 
            text-align: center; 
            position: relative;
          }
          .header h1 { 
            margin: 0; 
            font-size: 28px; 
            font-weight: 600;
          }
          .header p { 
            margin: 10px 0 0 0; 
            font-size: 16px; 
            opacity: 0.9;
          }
          .content { 
            padding: 40px 30px; 
            background: #ffffff;
          }
          .greeting {
            font-size: 18px;
            margin-bottom: 25px;
            color: #2c3e50;
          }
          .custom-message {
            background: #e8f4fd;
            border-left: 4px solid #3498db;
            padding: 20px;
            margin: 25px 0;
            border-radius: 0 8px 8px 0;
            font-style: italic;
            color: #2c3e50;
          }
          .summary-section {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 25px;
            margin: 25px 0;
            border: 1px solid #e9ecef;
          }
          .summary-title {
            font-size: 20px;
            font-weight: 600;
            color: #495057;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
          }
          .summary-title::before {
            content: '📊';
            margin-right: 10px;
            font-size: 24px;
          }
          .summary-text {
            font-size: 16px;
            line-height: 1.7;
            color: #6c757d;
            text-align: justify;
          }
          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 15px;
            margin: 30px 0;
          }
          .metric-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            text-align: center;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
          }
          .metric-value {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 5px;
            display: block;
          }
          .metric-label {
            font-size: 12px;
            opacity: 0.9;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .pdf-notice {
            background: linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%);
            color: #2d3436;
            padding: 20px;
            border-radius: 12px;
            margin: 25px 0;
            text-align: center;
            font-weight: 500;
          }
          .pdf-notice::before {
            content: '📎';
            font-size: 24px;
            margin-right: 10px;
          }
          .closing {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #e9ecef;
          }
          .signature {
            color: #495057;
            font-weight: 500;
          }
          .footer { 
            background: #2c3e50;
            color: #bdc3c7;
            text-align: center; 
            padding: 20px 30px;
            font-size: 12px;
            line-height: 1.5;
          }
          .footer a {
            color: #74b9ff;
            text-decoration: none;
          }
          @media (max-width: 600px) {
            .metrics-grid {
              grid-template-columns: repeat(2, 1fr);
            }
            .content, .header {
              padding: 20px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Meta Ads Performance Report</h1>
            <p>${reportData.dateRange}</p>
          </div>
          
          <div class="content">
            <div class="greeting">
              Dear ${clientName},
            </div>
            
            <p>Here's your Meta Ads performance report for the period <strong>${reportData.dateRange}</strong>.</p>
            
            ${content.customMessage ? `
            <div class="custom-message">
              ${content.customMessage.replace(/\n/g, '<br>')}
            </div>
            ` : ''}
            
            ${content.summary ? `
            <div class="summary-section">
              <div class="summary-title">Podsumowanie</div>
              <div class="summary-text">${content.summary}</div>
            </div>
            ` : ''}
            
            <div class="metrics-grid">
              <div class="metric-card">
                <span class="metric-value">€${reportData.totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                <span class="metric-label">Total Spend</span>
              </div>
              <div class="metric-card">
                <span class="metric-value">${reportData.totalImpressions.toLocaleString()}</span>
                <span class="metric-label">Impressions</span>
              </div>
              <div class="metric-card">
                <span class="metric-value">${reportData.totalClicks.toLocaleString()}</span>
                <span class="metric-label">Clicks</span>
              </div>
              <div class="metric-card">
                <span class="metric-value">${(reportData.ctr * 100).toFixed(2)}%</span>
                <span class="metric-label">CTR</span>
              </div>
              <div class="metric-card">
                <span class="metric-value">€${reportData.cpc.toFixed(2)}</span>
                <span class="metric-label">CPC</span>
              </div>
              <div class="metric-card">
                <span class="metric-value">€${reportData.cpm.toFixed(2)}</span>
                <span class="metric-label">CPM</span>
              </div>
            </div>
            
            <div class="pdf-notice">
              <strong>Complete detailed report is attached as PDF</strong><br>
              Open the PDF attachment for comprehensive analysis, charts, and campaign details.
            </div>
            
            <p>If you have any questions about this report or would like to discuss optimization strategies, please don't hesitate to reach out to us.</p>
            
            <div class="closing">
              <div class="signature">
                Best regards,<br>
                <strong>Your Meta Ads Team</strong>
              </div>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an automated report generated by your Meta Ads management system.</p>
            <p>For support, contact us at <a href="mailto:support@example.com">support@example.com</a></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate custom report text template
   */
  private generateCustomReportText(clientName: string, reportData: ReportData, content: { summary: string; customMessage: string }): string {
    return `Meta Ads Performance Report - ${reportData.dateRange}

Dear ${clientName},

${content.customMessage ? content.customMessage + '\n\n' : ''}Here's your Meta Ads performance report for the period ${reportData.dateRange}.

${content.summary ? `Summary:\n${content.summary}\n\n` : ''}Report Metrics:
- Total Spend: €${reportData.totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2 })}
- Impressions: ${reportData.totalImpressions.toLocaleString()}
- Clicks: ${reportData.totalClicks.toLocaleString()}
- CTR: ${(reportData.ctr * 100).toFixed(2)}%
- CPC: €${reportData.cpc.toFixed(2)}
- CPM: €${reportData.cpm.toFixed(2)}

Complete detailed report is attached as PDF. Open the PDF attachment for comprehensive analysis, charts, and campaign details.

If you have any questions about this report or would like to discuss optimization strategies, please don't hesitate to reach out to us.

Best regards,
Your Meta Ads Team

This is an automated report generated by your Meta Ads management system.`;
  }
}

export default FlexibleEmailService;
