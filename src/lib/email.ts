import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY environment variable is required');
}

const resend = new Resend(process.env.RESEND_API_KEY);

export interface EmailTemplate {
  subject: string;
  html: string;
}

export const emailTemplates = {
  clientCredentials: (clientName: string, email: string, username: string, password: string): EmailTemplate => ({
    subject: `Your Meta Ads Reporting Dashboard Access`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px;">Welcome to Meta Ads Reporting</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Your dashboard access has been created</p>
        </div>
        
        <div style="padding: 30px; background: #f8f9fa;">
          <h2 style="color: #333; margin-bottom: 20px;">Hello ${clientName},</h2>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
            Your Meta Ads reporting dashboard has been set up successfully. You can now access your performance reports and campaign analytics.
          </p>
          
          <div style="background: white; border: 1px solid #e1e5e9; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Your Login Credentials</h3>
            <div style="margin: 15px 0;">
              <strong style="color: #333;">Email:</strong> ${email}
            </div>
            <div style="margin: 15px 0;">
              <strong style="color: #333;">Username:</strong> ${username}
            </div>
            <div style="margin: 15px 0;">
              <strong style="color: #333;">Password:</strong> ${password}
            </div>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/auth/login" 
               style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Access Your Dashboard
            </a>
          </div>
          
          <div style="background: #e8f4fd; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #333; font-size: 14px;">
              <strong>Security Note:</strong> Please change your password after your first login for security purposes.
            </p>
          </div>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
            If you have any questions or need assistance, please don't hesitate to contact our support team.
          </p>
          
          <p style="color: #666; line-height: 1.6;">
            Best regards,<br>
            The Meta Ads Reporting Team
          </p>
        </div>
        
        <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
          <p style="margin: 0;">© 2024 Meta Ads Reporting. All rights reserved.</p>
        </div>
      </div>
    `
  }),

  reportGenerated: (clientName: string, reportDate: string, reportUrl: string): EmailTemplate => ({
    subject: `Your Meta Ads Report is Ready - ${reportDate}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px;">Your Report is Ready!</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Meta Ads Performance Report</p>
        </div>
        
        <div style="padding: 30px; background: #f8f9fa;">
          <h2 style="color: #333; margin-bottom: 20px;">Hello ${clientName},</h2>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
            Your Meta Ads performance report for ${reportDate} has been generated and is ready for review.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${reportUrl}" 
               style="background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              View Your Report
            </a>
          </div>
          
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #856404;">What's Included:</h4>
            <ul style="margin: 0; padding-left: 20px; color: #856404;">
              <li>Campaign performance metrics</li>
              <li>Spend analysis and ROI</li>
              <li>Click-through rates and conversions</li>
              <li>Audience insights and demographics</li>
            </ul>
          </div>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
            You can also access all your reports and analytics through your dashboard at any time.
          </p>
          
          <p style="color: #666; line-height: 1.6;">
            Best regards,<br>
            The Meta Ads Reporting Team
          </p>
        </div>
        
        <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
          <p style="margin: 0;">© 2024 Meta Ads Reporting. All rights reserved.</p>
        </div>
      </div>
    `
  }),

  reportError: (clientName: string, errorMessage: string): EmailTemplate => ({
    subject: 'Meta Ads Report Generation Failed',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px;">Report Generation Failed</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">We encountered an issue generating your report</p>
        </div>
        
        <div style="padding: 30px; background: #f8f9fa;">
          <h2 style="color: #333; margin-bottom: 20px;">Hello ${clientName},</h2>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
            We encountered an issue while generating your Meta Ads performance report. Our team has been notified and is working to resolve this.
          </p>
          
          <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #721c24;">Error Details:</h4>
            <p style="margin: 0; color: #721c24; font-family: monospace; font-size: 12px;">
              ${errorMessage}
            </p>
          </div>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
            Please try generating the report again in a few minutes, or contact our support team if the issue persists.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" 
               style="background: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Try Again
            </a>
          </div>
          
          <p style="color: #666; line-height: 1.6;">
            Best regards,<br>
            The Meta Ads Reporting Team
          </p>
        </div>
        
        <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
          <p style="margin: 0;">© 2024 Meta Ads Reporting. All rights reserved.</p>
        </div>
      </div>
    `
  })
};

export async function sendEmail(to: string, template: EmailTemplate) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Meta Ads Reporting <noreply@yourdomain.com>',
      to: [to],
      subject: template.subject,
      html: template.html,
    });

    if (error) {
      console.error('Error sending email:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

export async function sendClientCredentials(
  clientName: string, 
  email: string, 
  username: string, 
  password: string
) {
  const template = emailTemplates.clientCredentials(clientName, email, username, password);
  return sendEmail(email, template);
}

export async function sendReportNotification(
  clientEmail: string,
  clientName: string, 
  reportDate: string, 
  reportUrl: string
) {
  const template = emailTemplates.reportGenerated(clientName, reportDate, reportUrl);
  return sendEmail(clientEmail, template);
}

export async function sendReportError(
  clientEmail: string,
  clientName: string, 
  errorMessage: string
) {
  const template = emailTemplates.reportError(clientName, errorMessage);
  return sendEmail(clientEmail, template);
}

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