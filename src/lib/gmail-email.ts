import nodemailer from 'nodemailer';
import logger from './logger';

export interface GmailEmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}

export class GmailEmailService {
  private static instance: GmailEmailService;
  private transporter: nodemailer.Transporter;

  constructor() {
    // Gmail SMTP configuration
    this.transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER, // jac.honkisz@gmail.com
        pass: process.env.GMAIL_APP_PASSWORD // App password (not regular password)
      }
    });
  }

  static getInstance(): GmailEmailService {
    if (!GmailEmailService.instance) {
      GmailEmailService.instance = new GmailEmailService();
    }
    return GmailEmailService.instance;
  }

  async sendEmail(emailData: GmailEmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      logger.info('📧 Sending email via Gmail SMTP...', {
        to: emailData.to,
        subject: emailData.subject
      });

      const mailOptions = {
        from: `"Meta Ads Reports" <${process.env.GMAIL_USER}>`,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
        attachments: emailData.attachments
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info('✅ Email sent successfully via Gmail SMTP', {
        messageId: result.messageId,
        to: emailData.to
      });

      return {
        success: true,
        messageId: result.messageId
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('❌ Gmail SMTP email sending failed:', errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async sendReportEmail(
    recipient: string,
    clientName: string,
    reportData: {
      dateRange: string;
      totalSpend: number;
      totalImpressions: number;
      totalClicks: number;
      ctr: number;
      cpc: number;
      cpm: number;
    }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const subject = `Meta Ads Report - ${clientName} - ${reportData.dateRange}`;
    
    const html = `
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

    const text = `
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

    return this.sendEmail({
      to: recipient,
      subject,
      html,
      text
    });
  }
}

export default GmailEmailService;
