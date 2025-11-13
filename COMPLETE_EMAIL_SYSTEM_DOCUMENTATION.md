# 📧 Complete Email System Documentation

## 🎯 **OVERVIEW**

Your application has a **fully automated email system** that generates and sends professional report emails to clients. The system includes automated scheduling, professional HTML templates, PDF attachments, and comprehensive logging.

---

## 📋 **TABLE OF CONTENTS**

1. [Email Generation](#email-generation)
2. [Email Templates & Message Structure](#email-templates--message-structure)
3. [Automatic Email Sending](#automatic-email-sending)
4. [Email Service Providers](#email-service-providers)
5. [Email Scheduling System](#email-scheduling-system)
6. [Email Logging & Tracking](#email-logging--tracking)
7. [Email Configuration](#email-configuration)
8. [Database Schema](#database-schema)

---

## 🎨 **EMAIL GENERATION**

### **How Emails Are Generated**

Emails are generated automatically using template functions in the `EmailService` and `FlexibleEmailService` classes:

#### **1. Report Email Generation**
```12:178:src/lib/email.ts
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
```

#### **2. Custom Report Email Generation**
```230:269:src/lib/email.ts
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
```

#### **3. Credentials Email Generation**
```212:228:src/lib/email.ts
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
```

---

## 📧 **EMAIL TEMPLATES & MESSAGE STRUCTURE**

### **1. Standard Report Email Template**

**Subject Format:**
- `Your Meta Ads Report - [Date Range]`

**Email Structure:**
```753:1035:src/lib/email.ts
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
```

**Visual Elements:**
1. **Gradient Header** - Purple/blue gradient with report title
2. **Greeting** - Personalized with client name
3. **Custom Message Section** (optional) - Admin-provided personalized message
4. **Podsumowanie Section** - Polish summary with period analysis
5. **Metrics Grid** - Visual cards showing:
   - Total Spend (Wydana kwota)
   - Impressions (Wyświetlenia)
   - Clicks (Kliknięcia linku)
   - Conversions (if available)
   - Cost Percentage (if available)
6. **PDF Notice** - Highlighted section indicating PDF attachment
7. **Professional Footer** - Support contact and branding

### **2. Credentials Email Template**

**Subject:** `🔐 Dashboard Access Credentials`

**Structure:**
```659:751:src/lib/email.ts
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
```

---

## ⚙️ **AUTOMATIC EMAIL SENDING**

### **1. Automated Daily Email Scheduler**

**Cron Job Configuration:**
```36:38:vercel.json
    {
      "path": "/api/automated/send-scheduled-reports",
      "schedule": "0 9 * * *"
    },
```

**Schedule:** Daily at 9:00 AM UTC

**How It Works:**
```60:117:src/lib/email-scheduler.ts
  async checkAndSendScheduledEmails(): Promise<SchedulerResult> {
    logger.info('📅 Starting email scheduler check...');
    
    const result: SchedulerResult = {
      sent: 0,
      skipped: 0,
      errors: [],
      details: []
    };

    try {
      // Check if scheduler is enabled
      const settings = await this.getSystemSettings();
      if (!settings.email_scheduler_enabled) {
        logger.info('⚠️ Email scheduler is disabled');
        return result;
      }

      // Get all active clients
      const clients = await this.getActiveClients();
      logger.info(`📊 Found ${clients.length} active clients`);

      // Process each client
      for (const client of clients) {
        try {
          const clientResult = await this.processClient(client);
          result.details.push(clientResult);
          
          if (clientResult.success) {
            result.sent++;
          } else {
            result.skipped++;
            if (clientResult.error) {
              result.errors.push(`${client.name}: ${clientResult.error}`);
            }
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`${client.name}: ${errorMsg}`);
          result.details.push({
            clientId: client.id,
            clientName: client.name,
            success: false,
            error: errorMsg
          });
        }
      }

      logger.info(`✅ Email scheduler completed. Sent: ${result.sent}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`);
      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('❌ Email scheduler error:', errorMsg);
      result.errors.push(`Scheduler error: ${errorMsg}`);
      return result;
    }
  }
```

### **2. Scheduler Process Flow**

**Step 1: Check Client Eligibility**
- Skips clients with `reporting_frequency = 'on_demand'`
- Checks if email is scheduled for today based on `send_day` and `reporting_frequency`

**Step 2: Determine Report Period**
```230:259:src/lib/email-scheduler.ts
  private getReportPeriod(client: Client): ReportPeriod | null {
    const today = new Date();
    
    if (client.reporting_frequency === 'monthly') {
      // Get previous full month
      const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      
      return {
        start: previousMonth.toISOString().split('T')[0] || '',
        end: lastDayOfMonth.toISOString().split('T')[0] || ''
      };
    } else if (client.reporting_frequency === 'weekly') {
      // Get previous full week (Monday to Sunday)
      const todayWeekday = today.getDay();
      const daysBackToMonday = todayWeekday === 0 ? 6 : todayWeekday - 1;
      const lastMonday = new Date(today);
      lastMonday.setDate(today.getDate() - daysBackToMonday - 7);
      
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      
      return {
        start: lastMonday.toISOString().split('T')[0] || '',
        end: lastSunday.toISOString().split('T')[0] || ''
      };
    }

    return null;
  }
```

**Step 3: Ensure Report is Generated**
```364:380:src/lib/email-scheduler.ts
  private async ensureReportGenerated(client: Client, period: ReportPeriod): Promise<void> {
    const reportType = client.reporting_frequency === 'monthly' ? 'monthly' : 'weekly';
    
    // Check if report already exists
    const existingReport = await this.getGeneratedReport(client.id, period);
    if (existingReport && existingReport.status === 'completed') {
      logger.info(`✅ Report already generated for ${client.name} - ${period.start} to ${period.end}`);
      return;
    }

    // Import the automated report generator
    const { generateReportForPeriod } = await import('./automated-report-generator');
    
    // Trigger report generation
    logger.info(`🚀 Triggering report generation for ${client.name} - ${period.start} to ${period.end}`);
    await generateReportForPeriod(client.id, reportType, period.start, period.end);
  }
```

**Step 4: Send Email to All Contact Emails**
```285:359:src/lib/email-scheduler.ts
  private async sendScheduledReport(client: Client, period: ReportPeriod): Promise<void> {
    logger.info(`📤 Sending scheduled report to ${client.name} for ${period.start} to ${period.end}`);

    // First, ensure the report has been generated (trigger if needed)
    await this.ensureReportGenerated(client, period);

    // Get the generated report with real data and Polish summary
    const generatedReport = await this.getGeneratedReport(client.id, period);
    
    if (!generatedReport) {
      throw new Error('Generated report not found - may need to wait for report generation to complete');
    }

    // Prepare real report data from generated report
    const reportData = {
      dateRange: `${period.start} to ${period.end}`,
      totalSpend: generatedReport.total_spend,
      totalImpressions: generatedReport.total_impressions,
      totalClicks: generatedReport.total_clicks,
      totalConversions: generatedReport.total_conversions,
      ctr: generatedReport.ctr,
      cpc: generatedReport.cpc,
      cpm: generatedReport.cpm,
      polishSummary: generatedReport.polish_summary,
      polishSubject: generatedReport.polish_subject,
      pdfUrl: generatedReport.pdf_url
    };

    // Send to all contact emails
    const contactEmails = client.contact_emails || [client.email];
    
    for (const email of contactEmails) {
      try {
        // Download PDF if available
        let pdfBuffer: Buffer | undefined;
        if (generatedReport.pdf_url) {
          try {
            const pdfResponse = await fetch(generatedReport.pdf_url);
            if (pdfResponse.ok) {
              pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
            }
          } catch (error) {
            logger.warn('Could not download PDF for email attachment:', error);
          }
        }

        const emailResult = await this.emailService.sendReportEmail(
          email,
          client.name,
          {
            dateRange: reportData.dateRange,
            totalSpend: reportData.totalSpend,
            totalImpressions: reportData.totalImpressions,
            totalClicks: reportData.totalClicks,
            ctr: reportData.ctr,
            cpc: reportData.cpc,
            cpm: reportData.cpm
          },
          pdfBuffer
        );

        if (!emailResult.success) {
          throw new Error(emailResult.error || 'Email sending failed');
        }

        // Log successful email
        await this.logSchedulerSuccess(client, period);

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Failed to send email to ${email}:`, errorMsg);
        throw error;
      }
    }
  }
```

**Step 5: Update Client Status**
```406:427:src/lib/email-scheduler.ts
  private async updateClientLastSentDate(clientId: string): Promise<void> {
    // First get the current count
    const { data: currentClient } = await this.supabase
      .from('clients')
      .select('email_send_count')
      .eq('id', clientId)
      .single();

    const currentCount = currentClient?.email_send_count || 0;

    const { error } = await this.supabase
      .from('clients')
      .update({ 
        last_report_sent_at: new Date().toISOString(),
        email_send_count: currentCount + 1
      })
      .eq('id', clientId);

    if (error) {
      logger.error('Error updating client last sent date:', error);
    }
  }
```

---

## 📮 **EMAIL SERVICE PROVIDERS**

### **1. Resend API (Primary Provider)**

**Configuration:**
```30:38:src/lib/email.ts
  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
    
    // Initialize rate limiter for Resend API limits using configuration
    this.rateLimiter = new RateLimiter({
      minDelay: 100, // 100ms between emails
      maxCallsPerMinute: 50 // Conservative limit for email sending
    });
  }
```

**Sending Process:**
```47:143:src/lib/email.ts
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
```

**Rate Limiting:**
- **Max Requests:** 2 per second (Resend limit)
- **Implementation:** Rate limiter with 100ms minimum delay
- **Max Calls Per Minute:** 50 (conservative limit)

### **2. Gmail SMTP (Alternative Provider)**

**Configuration:**
```70:78:src/lib/flexible-email.ts
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
```

**Auto-Detection Logic:**
```99:123:src/lib/flexible-email.ts
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
```

---

## ⏰ **EMAIL SCHEDULING SYSTEM**

### **Scheduler Configuration**

**System Settings:**
```36:43:src/lib/email-scheduler.ts
interface SystemSettings {
  global_default_frequency: string;
  global_default_send_day: number;
  email_scheduler_enabled: boolean;
  email_scheduler_time: string;
  email_retry_attempts: number;
  email_retry_delay_minutes: number;
}
```

**Default Settings:**
```496:503:src/lib/email-scheduler.ts
    const settings: SystemSettings = {
      global_default_frequency: 'monthly',
      global_default_send_day: 5,
      email_scheduler_enabled: true,
      email_scheduler_time: '09:00',
      email_retry_attempts: 3,
      email_retry_delay_minutes: 30
    };
```

### **Scheduling Logic**

**Monthly Reports:**
- Send on specific day of month (default: 5th)
- Report period: Previous full month
- Example: If `send_day = 5`, sends on 5th of each month with previous month's data

**Weekly Reports:**
- Send on specific weekday (1-7, where 1=Monday, 7=Sunday)
- Report period: Previous full week (Monday to Sunday)
- Example: If `send_day = 1`, sends every Monday with previous week's data

**On-Demand:**
- Clients with `reporting_frequency = 'on_demand'` are skipped by scheduler
- Must be sent manually by admin

---

## 📊 **EMAIL LOGGING & TRACKING**

### **1. Individual Email Logs**

**Table:** `email_logs`

**Fields:**
- `id` - UUID
- `client_id` - Client reference
- `admin_id` - Admin who triggered
- `report_id` - Report reference (if applicable)
- `generated_report_id` - Generated report reference
- `email_type` - Type of email (report, credentials, interactive, etc.)
- `recipient_email` - Email address
- `subject` - Email subject
- `status` - Sent status (sent, failed, pending)
- `message_id` - Provider message ID
- `sent_at` - Timestamp
- `error_message` - Error details (if failed)

### **2. Scheduler Logs**

**Table:** `email_scheduler_logs`

**Fields:**
- `id` - UUID
- `client_id` - Client reference
- `admin_id` - Admin reference
- `operation_type` - 'scheduled' or 'manual'
- `frequency` - Monthly, weekly, on_demand
- `send_day` - Day/weekday number
- `report_period_start` - Period start date
- `report_period_end` - Period end date
- `email_sent` - Boolean success flag
- `email_sent_at` - Timestamp
- `error_message` - Error details (if failed)

### **3. Bulk Email Logs**

**Table:** `email_logs_bulk`

**Fields:**
- `id` - UUID
- `admin_id` - Admin who triggered
- `total_emails` - Total emails in batch
- `successful_count` - Successfully sent
- `failed_count` - Failed sends
- `status` - Batch status
- `started_at` - Batch start time
- `completed_at` - Batch completion time
- `error_summary` - Error details

---

## ⚙️ **EMAIL CONFIGURATION**

### **Email Config File**
```8:44:src/lib/email-config.ts
export const EMAIL_CONFIG = {
  // Set to false when ready for production
  MONITORING_MODE: false, // ✅ PRODUCTION: Disabled monitoring mode
  
  // Monitoring email addresses (only used when MONITORING_MODE is true)
  // Updated to use verified Resend email address
  MONITORING_EMAILS: [
    'pbajerlein@gmail.com'  // Resend verified address - forward to jac.honkisz@gmail.com
  ],
  
  // Email settings
  RATE_LIMIT: {
    MAX_REQUESTS: 2,      // Resend allows 2 requests per second
    WINDOW_MS: 1000,      // 1 second window
    RETRY_AFTER_MS: 1000  // Wait 1 second before retry
  },
  
  // Subject prefixes
  MONITORING_SUBJECT_PREFIX: '[MONITORING]',
  
  // Monitoring notice styling
  MONITORING_NOTICE_STYLE: {
    background: '#fff3cd',
    border: '2px solid #ffc107',
    borderRadius: '8px',
    padding: '15px',
    margin: '20px 0',
    fontFamily: 'Arial, sans-serif'
  },
  
  // Delays between emails (in milliseconds)
  MONITORING_EMAIL_DELAY: 100, // Small delay between monitoring emails
  
  // Logging settings
  LOG_ORIGINAL_RECIPIENTS: true,
  LOG_MONITORING_REDIRECTS: true
} as const;
```

### **Environment Variables**

**Required:**
- `RESEND_API_KEY` - Resend API key
- `EMAIL_FROM_ADDRESS` - Sender email address

**Optional:**
- `GMAIL_USER` - Gmail SMTP username
- `GMAIL_APP_PASSWORD` - Gmail app password
- `EMAIL_PROVIDER` - 'resend', 'gmail', or 'auto'
- `NEXT_PUBLIC_APP_URL` - Application URL for dashboard links

---

## 🗄️ **DATABASE SCHEMA**

### **Clients Table Email Fields**

```sql
clients (
  id UUID PRIMARY KEY,
  name TEXT,
  email TEXT,                    -- Main login email
  contact_emails TEXT[],          -- Array of email addresses for reports
  reporting_frequency TEXT,        -- 'monthly', 'weekly', 'on_demand'
  send_day INTEGER,               -- Day of month (monthly) or weekday (weekly)
  last_report_sent_at TIMESTAMP,
  next_report_scheduled_at TIMESTAMP,
  email_send_count INTEGER
)
```

### **Email Logs Tables**

**email_logs:**
```sql
email_logs (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  admin_id UUID REFERENCES profiles(id),
  report_id UUID REFERENCES reports(id),
  generated_report_id UUID REFERENCES generated_reports(id),
  email_type TEXT,
  recipient_email TEXT,
  subject TEXT,
  status TEXT,
  message_id TEXT,
  sent_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

**email_scheduler_logs:**
```sql
email_scheduler_logs (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  admin_id UUID REFERENCES profiles(id),
  operation_type TEXT,            -- 'scheduled' or 'manual'
  frequency TEXT,                 -- 'monthly', 'weekly', 'on_demand'
  send_day INTEGER,
  report_period_start DATE,
  report_period_end DATE,
  email_sent BOOLEAN,
  email_sent_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

**email_logs_bulk:**
```sql
email_logs_bulk (
  id UUID PRIMARY KEY,
  admin_id UUID REFERENCES profiles(id),
  total_emails INTEGER,
  successful_count INTEGER,
  failed_count INTEGER,
  status TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_summary TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

---

## 📝 **SUMMARY**

### **Email Generation:**
✅ Templates generate HTML and text versions  
✅ Professional styling with gradients and responsive design  
✅ Polish language support with proper formatting  
✅ PDF attachments included automatically  
✅ Custom messages and summaries supported  

### **Automatic Sending:**
✅ Daily cron job at 9:00 AM UTC  
✅ Checks all active clients  
✅ Determines report periods automatically  
✅ Generates reports if needed  
✅ Sends to all contact emails  
✅ Comprehensive error handling and logging  

### **Email Service:**
✅ Resend API as primary provider  
✅ Gmail SMTP as alternative  
✅ Rate limiting to respect API limits  
✅ Monitoring mode for testing  
✅ Multiple recipient support  

### **Logging & Tracking:**
✅ Individual email logs  
✅ Scheduler operation logs  
✅ Bulk email operation logs  
✅ Success/failure tracking  
✅ Error message capture  

The system is **production-ready** and handles all aspects of email generation and delivery automatically! 🚀




