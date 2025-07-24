import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY environment variable is required');
}

const resend = new Resend(process.env.RESEND_API_KEY);

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: {
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }[];
  from?: string;
}

export interface ReportEmailData {
  clientName: string;
  reportPeriod: string;
  reportUrl: string;
  adminName?: string;
  agencyName?: string;
  customMessage?: string;
}

// Default email templates
export const EMAIL_TEMPLATES = {
  MONTHLY_REPORT: {
    subject: (data: ReportEmailData) => 
      `Your ${data.reportPeriod} Meta Ads Performance Report`,
    
    html: (data: ReportEmailData) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Meta Ads Report</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3b82f6; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
          .metrics { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .custom-message { background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #2196f3; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Your Meta Ads Report is Ready</h1>
            <p>${data.reportPeriod} Performance Summary</p>
          </div>
          
          <div class="content">
            <p>Hi ${data.clientName},</p>
            
            <p>Your ${data.reportPeriod} Meta Ads performance report has been generated and is ready for review.</p>
            
            ${data.customMessage ? `
              <div class="custom-message">
                <strong>Message from your account manager:</strong><br>
                ${data.customMessage}
              </div>
            ` : ''}
            
            <p>This comprehensive report includes:</p>
            <ul>
              <li>📈 Campaign performance metrics</li>
              <li>💰 Spend analysis and budget utilization</li>
              <li>🎯 Conversion tracking and ROI insights</li>
              <li>👥 Audience demographics breakdown</li>
              <li>💡 Optimization recommendations</li>
            </ul>
            
            <div style="text-align: center;">
              <a href="${data.reportUrl}" class="button">📄 View Your Report</a>
            </div>
            
            <p><strong>What's Next?</strong></p>
            <p>Review your report and feel free to reach out if you have any questions or would like to discuss optimization strategies for your campaigns.</p>
            
            <p>Best regards,<br>
            ${data.adminName || 'Your Account Manager'}${data.agencyName ? `<br>${data.agencyName}` : ''}</p>
          </div>
          
          <div class="footer">
            <p>This is an automated report delivery. If you have questions, please reply to this email.</p>
            <p>© ${new Date().getFullYear()} ${data.agencyName || 'Meta Ads Reporting'}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    
    text: (data: ReportEmailData) => `
      Your ${data.reportPeriod} Meta Ads Report is Ready
      
      Hi ${data.clientName},
      
      Your ${data.reportPeriod} Meta Ads performance report has been generated and is ready for review.
      
      ${data.customMessage ? `Message from your account manager: ${data.customMessage}\n\n` : ''}
      
      This comprehensive report includes:
      - Campaign performance metrics
      - Spend analysis and budget utilization
      - Conversion tracking and ROI insights
      - Audience demographics breakdown
      - Optimization recommendations
      
      View your report: ${data.reportUrl}
      
      What's Next?
      Review your report and feel free to reach out if you have any questions or would like to discuss optimization strategies for your campaigns.
      
      Best regards,
      ${data.adminName || 'Your Account Manager'}
      ${data.agencyName || ''}
      
      ---
      This is an automated report delivery. If you have questions, please reply to this email.
      © ${new Date().getFullYear()} ${data.agencyName || 'Meta Ads Reporting'}. All rights reserved.
    `
  },

  WELCOME_CLIENT: {
    subject: (data: { clientName: string; agencyName?: string }) => 
      `Welcome to ${data.agencyName || 'Meta Ads Reporting'} - Access Your Reports`,
    
    html: (data: { clientName: string; loginUrl: string; agencyName?: string; adminName?: string }) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Meta Ads Reporting</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3b82f6; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to Your Reporting Dashboard</h1>
          </div>
          
          <div class="content">
            <p>Hi ${data.clientName},</p>
            
            <p>Welcome to your new Meta Ads reporting dashboard! You now have 24/7 access to your campaign performance reports.</p>
            
            <p><strong>What you can do:</strong></p>
            <ul>
              <li>📊 View your monthly performance reports</li>
              <li>📥 Download reports as PDF</li>
              <li>📈 Track your campaign metrics over time</li>
              <li>🔍 Access historical report data</li>
            </ul>
            
            <div style="text-align: center;">
              <a href="${data.loginUrl}" class="button">🚀 Access Your Dashboard</a>
            </div>
            
            <p><strong>Need Help?</strong></p>
            <p>If you have any questions about your reports or need assistance accessing your dashboard, don't hesitate to reach out.</p>
            
            <p>Best regards,<br>
            ${data.adminName || 'Your Account Manager'}${data.agencyName ? `<br>${data.agencyName}` : ''}</p>
          </div>
          
          <div class="footer">
            <p>Keep this email for your records. You can bookmark the dashboard link for easy access.</p>
            <p>© ${new Date().getFullYear()} ${data.agencyName || 'Meta Ads Reporting'}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }
};

// Main email sending function
export const sendEmail = async (params: SendEmailParams): Promise<{ id: string; success: boolean }> => {
  try {
    const fromEmail = params.from || process.env.DEFAULT_FROM_EMAIL || 'reports@youragency.com';
    const fromName = process.env.DEFAULT_FROM_NAME || 'Meta Ads Reporting';
    
      const emailPayload: any = {
    from: `${fromName} <${fromEmail}>`,
    to: Array.isArray(params.to) ? params.to : [params.to],
    subject: params.subject,
    html: params.html,
  };

  if (params.text) {
    emailPayload.text = params.text;
  }

  if (params.attachments) {
    emailPayload.attachments = params.attachments;
  }

  const { data, error } = await resend.emails.send(emailPayload);

    if (error) {
      console.error('Email sending error:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }

    return {
      id: data?.id || '',
      success: true
    };
  } catch (error) {
    console.error('Email service error:', error);
    throw error;
  }
};

// Send monthly report email
export const sendMonthlyReport = async (
  reportData: ReportEmailData,
  pdfBuffer: Buffer,
  fileName: string
): Promise<{ id: string; success: boolean }> => {
  const template = EMAIL_TEMPLATES.MONTHLY_REPORT;
  
  return sendEmail({
    to: reportData.clientName, // This should be the email, update the interface
    subject: template.subject(reportData),
    html: template.html(reportData),
    text: template.text(reportData),
    attachments: [
      {
        filename: fileName,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  });
};

// Send welcome email to new client
export const sendWelcomeEmail = async (
  clientEmail: string,
  clientName: string,
  loginUrl: string,
  agencyData?: { name?: string; adminName?: string }
): Promise<{ id: string; success: boolean }> => {
  const template = EMAIL_TEMPLATES.WELCOME_CLIENT;
  const subjectData: { clientName: string; agencyName?: string } = {
    clientName
  };
  if (agencyData?.name) {
    subjectData.agencyName = agencyData.name;
  }
  
  const htmlData: { clientName: string; loginUrl: string; agencyName?: string; adminName?: string } = {
    clientName,
    loginUrl
  };
  if (agencyData?.name) {
    htmlData.agencyName = agencyData.name;
  }
  if (agencyData?.adminName) {
    htmlData.adminName = agencyData.adminName;
  }
  
  return sendEmail({
    to: clientEmail,
    subject: template.subject(subjectData),
    html: template.html(htmlData)
  });
};

// Validate email configuration
export const validateEmailConfig = async (): Promise<boolean> => {
  try {
    // Test the Resend API key by attempting to get domain info
    const { data } = await resend.domains.list();
    return !!data;
  } catch (error) {
    console.error('Email configuration validation failed:', error);
    return false;
  }
};

export { resend }; 