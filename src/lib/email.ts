import { Resend } from 'resend';
import logger from './logger';
import { RateLimiter } from './rate-limiter';
import { EMAIL_CONFIG, isMonitoringMode, getEmailRecipients, getEmailSubject } from './email-config';

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

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

export class EmailService {
  private static instance: EmailService;
  private resend: Resend;
  private rateLimiter: RateLimiter;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
    
    // Initialize rate limiter for Resend API limits using configuration
    this.rateLimiter = new RateLimiter({
      minDelay: 100, // 100ms between emails
      maxCallsPerMinute: 50 // Conservative limit for email sending
    });
  }

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  async sendEmail(emailData: EmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Wait for rate limit slot before sending
      logger.info('Checking rate limit before sending email...');
      await this.rateLimiter.waitForNextCall();
      
      // Get appropriate recipients based on configuration
      const originalRecipient = emailData.to;
      const recipients = getEmailRecipients(originalRecipient);
      const subject = getEmailSubject(emailData.subject);
      
      // Send to each recipient (monitoring emails in monitoring mode, original in production)
      const results = [];
      for (const recipient of recipients) {
        const emailOptions: any = {
          from: emailData.from,
          to: recipient,
          subject: subject,
          html: isMonitoringMode() ? this.addMonitoringNotice(emailData.html, originalRecipient) : emailData.html,
        };

        if (emailData.text) {
          emailOptions.text = isMonitoringMode() ? 
            this.addMonitoringNoticeText(emailData.text, originalRecipient) : 
            emailData.text;
        }

        if (emailData.attachments) {
          emailOptions.attachments = emailData.attachments;
        }

        const logMessage = isMonitoringMode() ? 'Sending monitoring email via Resend API...' : 'Sending email via Resend API...';
        logger.info(logMessage, { 
          originalTo: originalRecipient,
          actualTo: recipient,
          subject: emailOptions.subject,
          monitoringMode: isMonitoringMode(),
          rateLimitStatus: this.rateLimiter.getStatus()
        });

        const { data, error } = await this.resend.emails.send(emailOptions);

        if (error) {
          const errorMessage = this.handleResendError(error);
          logger.error('Email sending failed:', { error, parsedError: errorMessage, recipient });
          results.push({ success: false, error: errorMessage, email: recipient });
        } else {
          const messageId = data?.id;
          const successMessage = isMonitoringMode() ? 'Monitoring email sent successfully' : 'Email sent successfully';
          logger.info(successMessage, { 
            messageId, 
            originalTo: originalRecipient, 
            actualTo: recipient,
            monitoringMode: isMonitoringMode()
          });
          results.push({ success: true, messageId, email: recipient });
        }

        // Small delay between emails to respect rate limits (only in monitoring mode with multiple recipients)
        if (isMonitoringMode() && recipients.indexOf(recipient) < recipients.length - 1) {
          await new Promise(resolve => setTimeout(resolve, EMAIL_CONFIG.MONITORING_EMAIL_DELAY));
        }
      }

      // Return success if at least one email was sent
      const successfulSends = results.filter(r => r.success);
      if (successfulSends.length > 0) {
        const errorMessage = results.length > successfulSends.length ? 
          (isMonitoringMode() ? 
            `Sent to ${successfulSends.length}/${results.length} monitoring addresses` :
            `Sent to ${successfulSends.length}/${results.length} recipients`
          ) : undefined;
          
        return { 
          success: true, 
          messageId: successfulSends[0]?.messageId,
          error: errorMessage
        };
      } else {
        const errorMessage = isMonitoringMode() ?
          `Failed to send to all monitoring addresses: ${results.map(r => r.error).join(', ')}` :
          `Failed to send email: ${results.map(r => r.error).join(', ')}`;
          
        return { 
          success: false, 
          error: errorMessage
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Nieznany błąd';
      logger.error('Email service error:', { error: errorMessage, to: emailData.to });
      return { 
        success: false, 
        error: errorMessage
      };
    }
  }

  async sendReportEmail(
    clientEmail: string,
    clientName: string,
    reportData: {
      dateRange: string;
      totalSpend: number;
      totalImpressions: number;
      totalClicks: number;
      cpm: number;
    },
    pdfBuffer?: Buffer
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const fromEmail = process.env.EMAIL_FROM_ADDRESS || 'noreply@yourdomain.com';
    
    const emailTemplate = this.generateReportEmailTemplate(clientName, reportData);
    
    const emailData: EmailData = {
      to: clientEmail,
      from: fromEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    };

    if (pdfBuffer) {
      emailData.attachments = [{
        filename: `report-${new Date().toISOString().split('T')[0]}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }];
    }

    return this.sendEmail(emailData);
  }

  async sendInteractiveReportEmail(
    clientEmail: string,
    clientName: string,
    reportData: {
      dateRange: string;
      totalSpend: number;
      totalImpressions: number;
      totalClicks: number;
      cpm: number;
    },
    pdfBuffer: Buffer
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const fromEmail = process.env.EMAIL_FROM_ADDRESS || 'noreply@yourdomain.com';
    
    const emailTemplate = this.generateInteractiveReportEmailTemplate(clientName, reportData);
    
    const emailData: EmailData = {
      to: clientEmail,
      from: fromEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
      attachments: [{
        filename: `interactive-meta-ads-report-${new Date().toISOString().split('T')[0]}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }]
    };

    return this.sendEmail(emailData);
  }

  async sendCredentialsEmail(
    clientEmail: string,
    clientName: string,
    credentials: { username: string; password: string }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const fromEmail = process.env.EMAIL_FROM_ADDRESS || 'noreply@yourdomain.com';
    
    const emailTemplate = this.generateCredentialsEmailTemplate(clientName, credentials);

    return this.sendEmail({
      to: clientEmail,
      from: fromEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text
    });
  }

  async sendCustomReportEmail(
    clientEmail: string,
    clientName: string,
    reportData: {
      dateRange: string;
      totalSpend: number;
      totalImpressions: number;
      totalClicks: number;
      totalConversions?: number;
      cpm: number;
    },
    content: {
      summary: string;
      customMessage: string;
    },
    pdfBuffer?: Buffer
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const fromEmail = process.env.EMAIL_FROM_ADDRESS || 'noreply@yourdomain.com';
    
    const emailTemplate = this.generateCustomReportEmailTemplate(clientName, reportData, content);
    
    const emailData: EmailData = {
      to: clientEmail,
      from: fromEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    };

    if (pdfBuffer) {
      const fileName = `Meta_Ads_Performance_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      emailData.attachments = [{
        filename: fileName,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }];
    }

    return this.sendEmail(emailData);
  }

  /**
   * Add monitoring notice to HTML email content
   */
  private addMonitoringNotice(htmlContent: string, originalRecipient: string): string {
    const style = EMAIL_CONFIG.MONITORING_NOTICE_STYLE;
    const monitoringEmails = EMAIL_CONFIG.MONITORING_EMAILS.join(', ');
    
    const monitoringNotice = `
      <div style="background: ${style.background}; border: ${style.border}; border-radius: ${style.borderRadius}; padding: ${style.padding}; margin: ${style.margin}; font-family: ${style.fontFamily};">
        <h3 style="color: #856404; margin: 0 0 10px 0; font-size: 16px;">
          🔍 MONITORING MODE - Internal Testing
        </h3>
        <p style="color: #856404; margin: 0; font-size: 14px;">
          <strong>Original Recipient:</strong> ${originalRecipient}<br>
          <strong>Monitoring Recipients:</strong> ${monitoringEmails}<br>
          <strong>Note:</strong> This email was redirected for monitoring purposes. In production, it would be sent to the original recipient.
        </p>
      </div>
    `;

    // Insert the notice after the opening body tag, or at the beginning if no body tag
    if (htmlContent.includes('<body')) {
      return htmlContent.replace(/(<body[^>]*>)/i, `$1${monitoringNotice}`);
    } else {
      return monitoringNotice + htmlContent;
    }
  }

  /**
   * Add monitoring notice to text email content
   */
  private addMonitoringNoticeText(textContent: string, originalRecipient: string): string {
    const monitoringEmails = EMAIL_CONFIG.MONITORING_EMAILS.join(', ');
    
    const monitoringNotice = `
🔍 MONITORING MODE - Internal Testing
=====================================
Original Recipient: ${originalRecipient}
Monitoring Recipients: ${monitoringEmails}
Note: This email was redirected for monitoring purposes. In production, it would be sent to the original recipient.
=====================================

`;
    return monitoringNotice + textContent;
  }

  /**
   * Handle Resend-specific errors with appropriate messages
   */
  private handleResendError(error: any): string {
    if (error.name) {
      switch (error.name) {
        case 'validation_error':
          return 'Invalid email format or content';
        case 'rate_limit_exceeded':
          return 'Email rate limit exceeded, please try again later';
        case 'invalid_api_key':
          return 'Invalid Resend API key configuration';
        case 'insufficient_credits':
          return 'Insufficient email credits in Resend account';
        case 'domain_not_verified':
          return 'Email domain not verified in Resend';
        default:
          return error.message || 'Unknown Resend API error';
      }
    }
    
    // Handle HTTP status codes
    if (error.status) {
      switch (error.status) {
        case 429:
          return 'Rate limit exceeded - too many requests';
        case 401:
          return 'Unauthorized - check API key';
        case 403:
          return 'Forbidden - insufficient permissions';
        case 422:
          return 'Invalid request data';
        default:
          return `HTTP ${error.status}: ${error.message || 'API error'}`;
      }
    }

    return error.message || 'Unknown email service error';
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus() {
    return this.rateLimiter.getStatus();
  }

  /**
   * Send multiple emails with rate limiting and progress tracking
   */
  async sendBulkEmails(
    emails: EmailData[], 
    onProgress?: (sent: number, total: number, current: EmailData) => void
  ): Promise<{
    successful: number;
    failed: number;
    results: Array<{ email: string; success: boolean; messageId?: string; error?: string }>;
  }> {
    const results: Array<{ email: string; success: boolean; messageId?: string; error?: string }> = [];
    let successful = 0;
    let failed = 0;

    logger.info(`Starting bulk email send for ${emails.length} emails`);

    for (let i = 0; i < emails.length; i++) {
      const emailData = emails[i];
      
      if (!emailData) {
        failed++;
        results.push({
          email: 'unknown',
          success: false,
          error: 'Invalid email data'
        });
        continue;
      }
      
      try {
        if (onProgress) {
          onProgress(i, emails.length, emailData);
        }

        const result = await this.sendEmail(emailData);
        
        if (result.success) {
          successful++;
          results.push({
            email: emailData.to,
            success: true,
            messageId: result.messageId
          });
        } else {
          failed++;
          results.push({
            email: emailData.to,
            success: false,
            error: result.error
          });
        }

        // Log progress every 10 emails
        if ((i + 1) % 10 === 0) {
          logger.info(`Bulk email progress: ${i + 1}/${emails.length} processed`);
        }

      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          email: emailData.to,
          success: false,
          error: errorMessage
        });
        logger.error(`Failed to send email to ${emailData.to}:`, errorMessage);
      }
    }

    logger.info(`Bulk email send completed: ${successful} successful, ${failed} failed`);
    
    return {
      successful,
      failed,
      results
    };
  }

  generateReportEmailTemplate(clientName: string, reportData: any): EmailTemplate {
    const subject = `Your Meta Ads Report - ${reportData.dateRange}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Meta Ads Report</title>
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
            <p>${reportData.dateRange}</p>
          </div>
          <div class="content">
            <p>Dear ${clientName},</p>
            <p>Here's your Meta Ads performance report for the period ${reportData.dateRange}.</p>
            
            <div class="metric">
              <h3>💰 Total Spend</h3>
              <p>$${reportData.totalSpend.toLocaleString()}</p>
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
              <h3>📊 Cost Per Mille</h3>
              <p>$${reportData.cpm.toFixed(2)}</p>
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

    const text = `
Meta Ads Performance Report - ${reportData.dateRange}

Dear ${clientName},

Here's your Meta Ads performance report for the period ${reportData.dateRange}:

💰 Total Spend: $${reportData.totalSpend.toLocaleString()}
👁️ Total Impressions: ${reportData.totalImpressions.toLocaleString()}
🖱️ Total Clicks: ${reportData.totalClicks.toLocaleString()}
📊 Cost Per Mille: $${reportData.cpm.toFixed(2)}

Please find the detailed report attached to this email.

If you have any questions about this report, please don't hesitate to reach out.

Best regards,
Your Meta Ads Reporting Team

---
This is an automated report. Please do not reply to this email.
    `;

    return { subject, html, text };
  }

  private generateInteractiveReportEmailTemplate(clientName: string, reportData: any): EmailTemplate {
    const subject = `Your Interactive Meta Ads Report - ${reportData.dateRange}`;
    
    const html = `
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
                <div class="stat-value">${reportData.totalSpend.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</div>
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
    
    const text = `
Interactive Meta Ads Report - ${reportData.dateRange}

Hello ${clientName},

Your interactive Meta Ads report is ready! This report includes detailed analytics with interactive tab switching for better data exploration.

Interactive Features:
- Tab switching between Placement, Demographic, and Ad Relevance data
- Clickable navigation within the PDF
- Professional styling with modern design
- Comprehensive Meta Ads analytics

Report Summary:
- Total Spend: ${reportData.totalSpend.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
- Impressions: ${reportData.totalImpressions.toLocaleString()}
- Clicks: ${reportData.totalClicks.toLocaleString()}

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
    
    return { subject, html, text };
  }



  private generateCredentialsEmailTemplate(clientName: string, credentials: { username: string; password: string }): EmailTemplate {
    const subject = 'Your Meta Ads Reporting Dashboard Access';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dashboard Access</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1877f2; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
          .credentials { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; border: 2px solid #1877f2; }
          .credentials h3 { margin: 0 0 10px 0; color: #1877f2; }
          .credential-item { margin: 10px 0; }
          .credential-label { font-weight: bold; color: #666; }
          .credential-value { font-family: monospace; background: #f0f0f0; padding: 5px 10px; border-radius: 3px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Dashboard Access Credentials</h1>
          </div>
          <div class="content">
            <p>Dear ${clientName},</p>
            <p>Your Meta Ads reporting dashboard has been set up successfully. Here are your login credentials:</p>
            
            <div class="credentials">
              <h3>Login Information</h3>
              <div class="credential-item">
                <div class="credential-label">Username:</div>
                <div class="credential-value">${credentials.username}</div>
              </div>
              <div class="credential-item">
                <div class="credential-label">Password:</div>
                <div class="credential-value">${credentials.password}</div>
              </div>
            </div>
            
            <p><strong>Dashboard URL:</strong> <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com'}/dashboard">${process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com'}/dashboard</a></p>
            
            <p><strong>Important Security Notes:</strong></p>
            <ul>
              <li>Please change your password after your first login</li>
              <li>Keep these credentials secure and don't share them</li>
              <li>Contact us immediately if you suspect any security issues</li>
            </ul>
            
            <p>You can now access your Meta Ads performance reports and analytics through the dashboard.</p>
            
            <p>Best regards,<br>Your Meta Ads Reporting Team</p>
          </div>
          <div class="footer">
            <p>If you didn't request this access, please contact us immediately.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Dashboard Access Credentials

Dear ${clientName},

Your Meta Ads reporting dashboard has been set up successfully. Here are your login credentials:

Username: ${credentials.username}
Password: ${credentials.password}

Dashboard URL: ${process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com'}/dashboard

Important Security Notes:
- Please change your password after your first login
- Keep these credentials secure and don't share them
- Contact us immediately if you suspect any security issues

You can now access your Meta Ads performance reports and analytics through the dashboard.

Best regards,
Your Meta Ads Reporting Team

---
If you didn't request this access, please contact us immediately.
    `;

    return { subject, html, text };
  }

  private generateCustomReportEmailTemplate(
    clientName: string, 
    reportData: any, 
    content: { summary: string; customMessage: string }
  ): EmailTemplate {
    const subject = `📊 Meta Ads Performance Report - ${reportData.dateRange}`;
    
    const html = `
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
          .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 100" fill="white" opacity="0.1"><polygon points="0,0 1000,100 1000,0"/></svg>') repeat-x;
            background-size: 100px 100px;
          }
          .header h1 { 
            margin: 0; 
            font-size: 28px; 
            font-weight: 600;
            position: relative;
            z-index: 1;
          }
          .header p { 
            margin: 10px 0 0 0; 
            font-size: 16px; 
            opacity: 0.9;
            position: relative;
            z-index: 1;
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
                <span class="metric-value">${reportData.totalSpend.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</span>
                <span class="metric-label">Wydana kwota</span>
              </div>
              <div class="metric-card">
                <span class="metric-value">${reportData.totalImpressions.toLocaleString('pl-PL')}</span>
                <span class="metric-label">Wyświetlenia</span>
              </div>
              <div class="metric-card">
                <span class="metric-value">${reportData.totalClicks.toLocaleString('pl-PL')}</span>
                <span class="metric-label">Kliknięcia linku</span>
              </div>
              ${reportData.potentialOfflineReservations !== undefined ? `
              <div class="metric-card">
                <span class="metric-value">${reportData.potentialOfflineReservations}</span>
                <span class="metric-label">Potencjalna ilość rezerwacji offline</span>
              </div>
              ` : ''}
              ${reportData.potentialOfflineValue !== undefined ? `
              <div class="metric-card">
                <span class="metric-value">${reportData.potentialOfflineValue.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</span>
                <span class="metric-label">Potencjalna łączna wartość rezerwacji offline</span>
              </div>
              ` : ''}
              ${reportData.totalPotentialValue !== undefined ? `
              <div class="metric-card">
                <span class="metric-value">${reportData.totalPotentialValue.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</span>
                <span class="metric-label">Łączna wartość potencjalnych rezerwacji online + offline</span>
              </div>
              ` : ''}
              ${reportData.costPercentage !== undefined ? `
              <div class="metric-card">
                <span class="metric-value">${reportData.costPercentage.toFixed(1)}%</span>
                <span class="metric-label">Koszt pozyskania rezerwacji</span>
              </div>
              ` : ''}
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

    const text = `Szanowni Państwo ${clientName},

${content.customMessage ? content.customMessage + '\n\n' : ''}Przesyłamy raport wyników kampanii Meta Ads za okres ${reportData.dateRange}.

Podsumowanie:
${content.summary}

Kompletny szczegółowy raport znajduje się w załączeniu PDF. Prosimy o otwarcie załącznika w celu zapoznania się z pełną analizą, wykresami i szczegółami kampanii.

W razie pytań dotyczących raportu lub chęci omówienia strategii optymalizacji, prosimy o kontakt.

Z poważaniem,
Zespół Meta Ads`;

    return { subject, html, text };
  }
}

export default EmailService; 