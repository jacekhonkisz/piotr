import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

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

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  async sendEmail(emailData: EmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: emailData.from,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
        attachments: emailData.attachments,
      });

      if (error) {
        console.error('Email sending failed:', error);
        return { success: false, error: error.message };
      }

      return { success: true, messageId: data?.id };
    } catch (error) {
      console.error('Email service error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
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
      ctr: number;
      cpc: number;
      cpm: number;
    },
    pdfBuffer?: Buffer
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const fromEmail = process.env.EMAIL_FROM_ADDRESS || 'noreply@yourdomain.com';
    
    const emailTemplate = this.generateReportEmailTemplate(clientName, reportData);
    
    const attachments = pdfBuffer ? [{
      filename: `report-${new Date().toISOString().split('T')[0]}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }] : undefined;

    return this.sendEmail({
      to: clientEmail,
      from: fromEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
      attachments
    });
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

  private generateReportEmailTemplate(clientName: string, reportData: any): EmailTemplate {
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
              <h3>📈 Click-Through Rate</h3>
              <p>${(reportData.ctr * 100).toFixed(2)}%</p>
            </div>
            
            <div class="metric">
              <h3>💵 Cost Per Click</h3>
              <p>$${reportData.cpc.toFixed(2)}</p>
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
📈 Click-Through Rate: ${(reportData.ctr * 100).toFixed(2)}%
💵 Cost Per Click: $${reportData.cpc.toFixed(2)}
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
}

export default EmailService; 