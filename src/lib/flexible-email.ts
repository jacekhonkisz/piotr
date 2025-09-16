import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import logger from './logger';
import { RateLimiter } from './rate-limiter';
import { EMAIL_CONFIG, isMonitoringMode, getEmailRecipients, getEmailSubject } from './email-config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
  totalConversions: number;
  ctr: number;
  cpc: number;
  cpm: number;
  reservations?: number;
  reservationValue?: number;
  // Separate platform data
  metaData?: {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    cpc: number;
    cpm: number;
    reservations?: number;
    reservationValue?: number;
  };
  googleData?: {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    cpc: number;
    cpm: number;
    reservations?: number;
    reservationValue?: number;
  };
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
    // Force Gmail SMTP for development mode
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev') {
      return 'gmail';
    }

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
   * REMOVED: Email draft system was replaced with simpler direct sending
   * See OLD_EMAIL_DRAFT_SYSTEM_REMOVAL.md for details
   */
  private async loadEmailDraft(clientId: string, adminId?: string): Promise<any | null> {
    // Email drafts system was removed - always return null
    logger.info('📝 Email drafts system removed - using standard templates');
    return null;
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
      text: emailData.text || '',
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
      text: emailData.text || '',
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
   * Send report email with automatic provider selection and draft integration
   */
  async sendReportEmail(
    recipient: string,
    clientName: string,
    reportData: ReportData,
    pdfBuffer?: Buffer,
    provider?: EmailProvider,
    aiSummary?: string,
    clientId?: string,
    adminId?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string; provider: string }> {
    let subject = `📊 Raport Kampanii Reklamowych - ${clientName} - ${reportData.dateRange}`;
    let html = '';
    let text = '';

    // Try to load saved draft first
    let savedDraft = null;
    if (clientId) {
      savedDraft = await this.loadEmailDraft(clientId, adminId);
    }

    if (savedDraft) {
      // Use saved draft template
      logger.info('📝 Using saved draft for email generation');
      subject = savedDraft.subject_template || subject;
      
      if (savedDraft.html_template) {
        html = savedDraft.html_template;
        // Replace AI summary placeholder with actual summary
        if (aiSummary) {
          html = html.replace('[Podsumowanie AI zostanie wygenerowane podczas wysyłania]', aiSummary);
        }
      } else {
        html = this.generateReportHTML(clientName, reportData, aiSummary);
      }

      if (savedDraft.text_template) {
        text = savedDraft.text_template;
        // Replace AI summary placeholder with actual summary
        if (aiSummary) {
          text = text.replace('[Podsumowanie AI zostanie wygenerowane podczas wysyłania]', aiSummary);
        }
      } else {
        text = this.generateReportText(clientName, reportData, aiSummary);
      }
    } else {
      // Use standard template
      logger.info('📝 Using standard template for email generation');
      html = this.generateReportHTML(clientName, reportData, aiSummary);
      text = this.generateReportText(clientName, reportData, aiSummary);
    }

    const emailData: EmailData = {
      to: recipient,
      from: this.getFromAddress(provider || this.determineProvider(recipient)),
      subject,
      html,
      text
    };

    if (pdfBuffer) {
      emailData.attachments = [{
        filename: `raport-kampanii-${new Date().toISOString().split('T')[0]}.pdf`,
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
    const subject = `📊 Interaktywny Raport Kampanii Reklamowych - ${reportData.dateRange}`;
    
    const html = this.generateInteractiveReportHTML(clientName, reportData);
    const text = this.generateInteractiveReportText(clientName, reportData);

    const emailData: EmailData = {
      to: recipient,
      from: this.getFromAddress(provider || this.determineProvider(recipient)),
      subject,
      html,
      text,
      attachments: [{
        filename: `interaktywny-raport-kampanii-${new Date().toISOString().split('T')[0]}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }]
    };

    return this.sendEmail(emailData, provider);
  }

  /**
   * Send custom report email with automatic provider selection and draft integration
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
    provider?: EmailProvider,
    clientId?: string,
    adminId?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string; provider: string }> {
    let subject = `📊 Raport Wydajności Kampanii Reklamowych - ${reportData.dateRange}`;
    let html = '';
    let text = '';

    // Try to load saved draft first
    let savedDraft = null;
    if (clientId) {
      savedDraft = await this.loadEmailDraft(clientId, adminId);
    }

    if (savedDraft) {
      // Use saved draft template
      logger.info('📝 Using saved draft for custom email generation');
      subject = savedDraft.subject_template || subject;
      
      if (savedDraft.html_template) {
        html = savedDraft.html_template;
        // Replace AI summary placeholder with actual summary
        if (content.summary) {
          html = html.replace('[Podsumowanie AI zostanie wygenerowane podczas wysyłania]', content.summary);
        }
      } else {
        html = this.generateCustomReportHTML(clientName, reportData, content);
      }

      if (savedDraft.text_template) {
        text = savedDraft.text_template;
        // Replace AI summary placeholder with actual summary
        if (content.summary) {
          text = text.replace('[Podsumowanie AI zostanie wygenerowane podczas wysyłania]', content.summary);
        }
      } else {
        text = this.generateCustomReportText(clientName, reportData, content);
      }
    } else {
      // Use standard template
      logger.info('📝 Using standard template for custom email generation');
      html = this.generateCustomReportHTML(clientName, reportData, content);
      text = this.generateCustomReportText(clientName, reportData, content);
    }

    const emailData: EmailData = {
      to: recipient,
      from: this.getFromAddress(provider || this.determineProvider(recipient)),
      subject,
      html,
      text
    };

    if (pdfBuffer) {
      const fileName = `Raport_Kampanii_Reklamowych_${new Date().toISOString().split('T')[0]}.pdf`;
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
  private generateReportHTML(clientName: string, reportData: ReportData, aiSummary?: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Raport Kampanii Reklamowych - ${clientName}</title>
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
            <h1>📊 Raport Wydajności Kampanii Reklamowych</h1>
            <p>${clientName} - ${reportData.dateRange}</p>
          </div>
          
          <div class="content">
            <p>Szanowni Państwo,</p>
            <p>W załączeniu przekazujemy raport wydajności kampanii reklamowych prowadzonych dla ${clientName} w okresie ${reportData.dateRange}.</p>
            
            ${aiSummary ? `
            <div style="background: #f8f9fa; border-radius: 12px; padding: 25px; margin: 25px 0; border: 1px solid #e9ecef;">
              <div style="font-size: 20px; font-weight: 600; color: #495057; margin-bottom: 15px; display: flex; align-items: center;">
                <span style="margin-right: 10px; font-size: 24px;">📊</span>
                Podsumowanie Wykonawcze
              </div>
              <div style="font-size: 16px; line-height: 1.7; color: #6c757d; text-align: justify;">
                ${aiSummary}
              </div>
            </div>
            ` : ''}
            
            ${reportData.metaData ? `
            <h2 style="color: #1877f2; margin: 30px 0 20px 0; padding-bottom: 10px; border-bottom: 2px solid #1877f2;">📘 META ADS</h2>
            
            <div class="metric">
              <h3>💰 Wydatki Meta Ads</h3>
              <p>${reportData.metaData.spend.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</p>
            </div>
            
            <div class="metric">
              <h3>👁️ Wyświetlenia Meta</h3>
              <p>${reportData.metaData.impressions.toLocaleString('pl-PL')}</p>
            </div>
            
            <div class="metric">
              <h3>🖱️ Kliknięcia Meta</h3>
              <p>${reportData.metaData.clicks.toLocaleString('pl-PL')}</p>
            </div>
            
            <div class="metric">
              <h3>📈 CTR Meta</h3>
              <p>${(reportData.metaData.ctr * 100).toFixed(2)}%</p>
            </div>
            
            <div class="metric">
              <h3>💵 CPC Meta</h3>
              <p>${reportData.metaData.cpc.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</p>
            </div>
            
            <div class="metric">
              <h3>📊 CPM Meta</h3>
              <p>${reportData.metaData.cpm.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</p>
            </div>
            ` : ''}
            
            ${reportData.googleData ? `
            <h2 style="color: #4285f4; margin: 30px 0 20px 0; padding-bottom: 10px; border-bottom: 2px solid #4285f4;">🔍 GOOGLE ADS</h2>
            
            <div class="metric">
              <h3>💰 Wydatki Google Ads</h3>
              <p>${reportData.googleData.spend.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</p>
            </div>
            
            <div class="metric">
              <h3>👁️ Wyświetlenia Google</h3>
              <p>${reportData.googleData.impressions.toLocaleString('pl-PL')}</p>
            </div>
            
            <div class="metric">
              <h3>🖱️ Kliknięcia Google</h3>
              <p>${reportData.googleData.clicks.toLocaleString('pl-PL')}</p>
            </div>
            
            <div class="metric">
              <h3>📈 CTR Google</h3>
              <p>${(reportData.googleData.ctr * 100).toFixed(2)}%</p>
            </div>
            
            <div class="metric">
              <h3>💵 CPC Google</h3>
              <p>${reportData.googleData.cpc.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</p>
            </div>
            
            <div class="metric">
              <h3>📊 CPM Google</h3>
              <p>${reportData.googleData.cpm.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</p>
            </div>
            ` : ''}
            
            ${reportData.metaData && reportData.googleData ? `
            <h2 style="color: #28a745; margin: 30px 0 20px 0; padding-bottom: 10px; border-bottom: 2px solid #28a745;">📊 PODSUMOWANIE ŁĄCZNE</h2>
            
            <div class="metric">
              <h3>💰 Łączne Wydatki</h3>
              <p>${reportData.totalSpend.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</p>
            </div>
            
            <div class="metric">
              <h3>👁️ Łączne Wyświetlenia</h3>
              <p>${reportData.totalImpressions.toLocaleString('pl-PL')}</p>
            </div>
            
            <div class="metric">
              <h3>🖱️ Łączne Kliknięcia</h3>
              <p>${reportData.totalClicks.toLocaleString('pl-PL')}</p>
            </div>
            ` : ''}
            
            <p><strong>📎 ZAŁĄCZNIK:</strong><br>
            Szczegółowy raport znajdą Państwo w załączeniu do tego e-maila.</p>
            <p>W przypadku pytań dotyczących wyników, pozostaję do dyspozycji.</p>
            <p>Z poważaniem,<br>Piotr Bajerlein</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate text report template
   */
  private generateReportText(clientName: string, reportData: ReportData, aiSummary?: string): string {
    return `
📊 RAPORT WYDAJNOŚCI KAMPANII REKLAMOWYCH - ${clientName}
${reportData.dateRange}

Szanowni Państwo,

W załączeniu przekazujemy raport wydajności kampanii reklamowych prowadzonych dla ${clientName} w okresie ${reportData.dateRange}:

${aiSummary ? `
📈 PODSUMOWANIE WYKONAWCZE:
${aiSummary}

` : ''}${reportData.metaData ? `
📘 META ADS:
💰 Wydatki Meta Ads: ${reportData.metaData.spend.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
👁️ Wyświetlenia Meta: ${reportData.metaData.impressions.toLocaleString('pl-PL')}
🖱️ Kliknięcia Meta: ${reportData.metaData.clicks.toLocaleString('pl-PL')}
📈 CTR Meta: ${(reportData.metaData.ctr * 100).toFixed(2)}%
💵 CPC Meta: ${reportData.metaData.cpc.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
📊 CPM Meta: ${reportData.metaData.cpm.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}

` : ''}${reportData.googleData ? `
🔍 GOOGLE ADS:
💰 Wydatki Google Ads: ${reportData.googleData.spend.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
👁️ Wyświetlenia Google: ${reportData.googleData.impressions.toLocaleString('pl-PL')}
🖱️ Kliknięcia Google: ${reportData.googleData.clicks.toLocaleString('pl-PL')}
📈 CTR Google: ${(reportData.googleData.ctr * 100).toFixed(2)}%
💵 CPC Google: ${reportData.googleData.cpc.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
📊 CPM Google: ${reportData.googleData.cpm.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}

` : ''}${reportData.metaData && reportData.googleData ? `
📊 PODSUMOWANIE ŁĄCZNE:
💰 Łączne Wydatki: ${reportData.totalSpend.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
👁️ Łączne Wyświetlenia: ${reportData.totalImpressions.toLocaleString('pl-PL')}
🖱️ Łączne Kliknięcia: ${reportData.totalClicks.toLocaleString('pl-PL')}

` : ''}

📎 ZAŁĄCZNIK:
Szczegółowy raport znajdą Państwo w załączeniu do tego e-maila.

W przypadku pytań dotyczących wyników, pozostaję do dyspozycji.

Z poważaniem,
Piotr Bajerlein
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
    // Format dates in Polish
    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('pl-PL', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    };

    // Extract date range from reportData.dateRange
    const dateRangeParts = reportData.dateRange.split(' to ');
    const startDate = dateRangeParts[0];
    const endDate = dateRangeParts[1];
    const formattedDateRange = `${formatDate(startDate)} - ${formatDate(endDate)}`;

    // Determine if we have both platforms or just one
    const hasBothPlatforms = content.summary && content.summary.includes('Meta Ads') && content.summary.includes('Google Ads');
    const platformTitle = hasBothPlatforms ? 'META ADS I GOOGLE ADS' : 'META ADS';

    return `📊 RAPORT WYDAJNOŚCI ${platformTitle}
${formattedDateRange}

${content.customMessage ? content.customMessage + '\n\n' : `Szanowni Państwo ${clientName},\n\nPrzesyłamy raport wyników kampanii reklamowych za okres ${formattedDateRange}.\n\n`}

${content.summary ? `PODSUMOWANIE WYKONAWCZE:\n${content.summary}\n\n` : ''}GŁÓWNE WSKAŹNIKI:
• Łączne wydatki: ${reportData.totalSpend.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
• Wyświetlenia: ${reportData.totalImpressions.toLocaleString('pl-PL')}
• Kliknięcia: ${reportData.totalClicks.toLocaleString('pl-PL')}
• CTR: ${(reportData.ctr).toFixed(2)}%
• CPC: ${reportData.cpc.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
• CPM: ${reportData.cpm.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}${reportData.reservations ? `\n• Rezerwacje: ${reportData.reservations.toLocaleString('pl-PL')}` : ''}${reportData.reservationValue ? `\n• Wartość rezerwacji: ${reportData.reservationValue.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}` : ''}${reportData.reservations && reportData.reservationValue && reportData.totalSpend > 0 ? `\n• ROAS: ${(reportData.reservationValue / reportData.totalSpend).toFixed(2)}x` : ''}

📎 ZAŁĄCZNIK:
Kompletny szczegółowy raport znajduje się w załączeniu PDF. Prosimy o otwarcie załącznika w celu zapoznania się z pełną analizą, wykresami i szczegółami kampanii.

W razie pytań dotyczących raportu lub chęci omówienia strategii optymalizacji, proszę o kontakt.

Z poważaniem,
Piotr Bajerlein`;
  }
}

export default FlexibleEmailService;

