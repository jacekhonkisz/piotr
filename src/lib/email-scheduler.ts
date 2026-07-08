import { createClient } from '@supabase/supabase-js';
import FlexibleEmailService from './flexible-email';
import { buildMonthlyReportData, builtPlatformToSummaryShape } from './monthly-report-data-builder';
import { adaptCampaignSummary } from './report-adapters';
import { evaluatePreSend } from './report-presend-guard';
import { getPolishMonthName } from './email-helpers';
import logger from './logger';

interface Client {
  id: string;
  name: string;
  email: string;
  contact_emails: string[];
  reporting_frequency: 'monthly' | 'weekly' | 'on_demand';
  send_day: number;
  last_report_sent_at: string | null;
  next_report_scheduled_at: string | null;
  api_status: string;
  admin_id: string;
  google_ads_enabled?: boolean;
  meta_access_token?: string;
}

interface ReportPeriod {
  start: string;
  end: string;
}

interface SchedulerResult {
  sent: number;
  skipped: number;
  errors: string[];
  details: {
    clientId: string;
    clientName: string;
    success: boolean;
    error?: string;
    period?: ReportPeriod;
  }[];
}

interface SendOverrideOptions {
  reviewRecipientOverride?: string;
  /** Allow re-sending a report for a period that was already sent (manual sends only). */
  allowDuplicate?: boolean;
}

interface SystemSettings {
  global_default_frequency: string;
  global_default_send_day: number;
  email_scheduler_enabled: boolean;
  email_scheduler_time: string;
  email_retry_attempts: number;
  email_retry_delay_minutes: number;
}

const SEND_IN_PROGRESS_MARKER = 'SEND_IN_PROGRESS';

const parsedScheduledSendConcurrency = Number(process.env.EMAIL_SCHEDULER_CONCURRENCY || 3);
const SCHEDULED_SEND_CONCURRENCY = Number.isFinite(parsedScheduledSendConcurrency)
  ? Math.max(1, Math.min(parsedScheduledSendConcurrency, 5))
  : 3;

export class EmailScheduler {
  private supabase;
  private emailService: FlexibleEmailService;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.emailService = FlexibleEmailService.getInstance();
  }

  private getAppBaseUrl(): string {
    const configuredUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
    const isLocalConfiguredUrl = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configuredUrl);

    if (configuredUrl && !isLocalConfiguredUrl) {
      return configuredUrl;
    }

    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL.replace(/\/$/, '')}`;
    }

    return configuredUrl || 'http://localhost:3000';
  }

  private async generatePdfBuffer(clientId: string, period: ReportPeriod): Promise<Buffer> {
    const appBaseUrl = this.getAppBaseUrl();
    const pdfUrl = `${appBaseUrl}/api/generate-pdf`;

    logger.info(`📄 Generating scheduled PDF via ${pdfUrl}`);

    const response = await fetch(pdfUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        clientId,
        dateRange: {
          start: period.start,
          end: period.end
        }
      })
    });

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      throw new Error(`PDF generation failed: HTTP ${response.status}${details ? ` - ${details.slice(0, 500)}` : ''}`);
    }

    const pdfBuffer = Buffer.from(await response.arrayBuffer());
    if (pdfBuffer.length === 0) {
      throw new Error('PDF generation failed: empty PDF response');
    }

    return pdfBuffer;
  }

  /**
   * Main method to check and send scheduled emails
   */
  async checkAndSendScheduledEmails(): Promise<SchedulerResult> {
    logger.info('📅 Starting email scheduler check...');
    
    const result: SchedulerResult = {
      sent: 0,
      skipped: 0,
      errors: [],
      details: []
    };

    try {
      // 🔒 PRODUCTION ONLY: Prevent automatic sending in development
      const isProduction = process.env.NODE_ENV === 'production';
      if (!isProduction) {
        logger.warn('⚠️ Email scheduler disabled: Not in production environment');
        logger.warn('   Current NODE_ENV:', process.env.NODE_ENV);
        logger.warn('   Automatic emails only send in production mode');
        return result;
      }

      // Check if scheduler is enabled
      const settings = await this.getSystemSettings();
      if (!settings.email_scheduler_enabled) {
        logger.info('⚠️ Email scheduler is disabled in system settings');
        return result;
      }

      // Get all active clients
      const clients = await this.getActiveClients();
      logger.info(`📊 Found ${clients.length} active clients`);

      for (let i = 0; i < clients.length; i += SCHEDULED_SEND_CONCURRENCY) {
        const batch = clients.slice(i, i + SCHEDULED_SEND_CONCURRENCY);
        const batchResults = await Promise.all(batch.map(async (client) => {
          try {
            return await this.processClient(client);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            return {
              clientId: client.id,
              clientName: client.name,
              success: false,
              error: errorMsg
            };
          }
        }));

        for (const clientResult of batchResults) {
          result.details.push(clientResult);

          if (clientResult.success) {
            result.sent++;
          } else {
            result.skipped++;
            if (clientResult.error) {
              result.errors.push(`${clientResult.clientName}: ${clientResult.error}`);
            }
          }
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

  /**
   * Process a single client for scheduled email sending
   */
  private async processClient(client: Client): Promise<{
    clientId: string;
    clientName: string;
    success: boolean;
    error?: string;
    period?: ReportPeriod;
  }> {
    logger.info(`📧 Processing client: ${client.name} (${client.reporting_frequency})`);

    // Skip on_demand clients
    if (client.reporting_frequency === 'on_demand') {
      logger.info(`⏭️ Skipping ${client.name} - on_demand frequency`);
      return {
        clientId: client.id,
        clientName: client.name,
        success: false,
        error: 'On-demand frequency - no automatic sending'
      };
    }

    // Check if it's time to send
    if (!this.shouldSendEmail(client)) {
      logger.info(`⏭️ Skipping ${client.name} - not scheduled for today`);
      return {
        clientId: client.id,
        clientName: client.name,
        success: false,
        error: 'Not scheduled for today'
      };
    }

    // Get report period
    const period = this.getReportPeriod(client);
    if (!period) {
      return {
        clientId: client.id,
        clientName: client.name,
        success: false,
        error: 'Could not determine report period'
      };
    }

    // Check if we already sent this report
    if (await this.isReportAlreadySent(client, period)) {
      logger.info(`⏭️ Skipping ${client.name} - report already sent for this period`);
      return {
        clientId: client.id,
        clientName: client.name,
        success: false,
        error: 'Report already sent for this period'
      };
    }

    // 🔍 PRE-FLIGHT CHECK: Verify PDF exists before attempting to send
    logger.info(`🔍 Pre-flight check: Verifying PDF exists for ${client.name}...`);
    const existingReport = await this.getGeneratedReport(client.id, period);
    
    if (!existingReport || !existingReport.pdf_url) {
      logger.warn(`⚠️ PDF not found for ${client.name}, will generate during send process`);
      // Note: The sendProfessionalMonthlyReport method will handle PDF generation
      // This pre-flight check is just for early detection and logging
    } else {
      logger.info(`✅ Pre-flight check passed: PDF exists for ${client.name}`);
    }

    // Claim the send slot so overlapping scheduler runs see this period as
    // in-progress and skip it.
    const claimId = await this.claimSendSlot(client, period, 'scheduled');

    // Send the report using NEW professional monthly template, retrying on
    // transient failures. Retries happen in-process with a short delay
    // (serverless functions cannot honor multi-minute retry windows).
    const settings = await this.getSystemSettings();
    const maxAttempts = Math.max(1, Math.min(settings.email_retry_attempts || 1, 5));
    let lastError = '';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const sendDetails = await this.sendProfessionalMonthlyReport(client, period);
        
        // Update client's last sent date
        await this.updateClientLastSentDate(client.id);
        
        await this.recordSendResult(claimId, client, period, 'scheduled', {
          success: true,
          messageId: sendDetails.messageId,
          recipients: sendDetails.routedRecipients,
          retryCount: attempt - 1
        });
        
        logger.info(`✅ Successfully sent report to ${client.name} for ${period.start} to ${period.end} (attempt ${attempt}/${maxAttempts})`);
        
        return {
          clientId: client.id,
          clientName: client.name,
          success: true,
          period
        };

      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Nieznany błąd';
        logger.error(`❌ Attempt ${attempt}/${maxAttempts} failed for ${client.name}:`, lastError);

        if (attempt < maxAttempts) {
          const delayMs = Math.min(10_000 * attempt, 30_000);
          logger.info(`⏳ Retrying ${client.name} in ${delayMs / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    // All attempts exhausted - record the failure with the retry count
    await this.recordSendResult(claimId, client, period, 'scheduled', {
      success: false,
      error: lastError,
      retryCount: maxAttempts - 1
    });
    
    return {
      clientId: client.id,
      clientName: client.name,
      success: false,
      error: lastError,
      period
    };
  }

  /**
   * Check if it's time to send an email for this client
   */
  private shouldSendEmail(client: Client): boolean {
    const today = new Date();
    const currentDay = today.getDate();
    const currentWeekday = today.getDay(); // 0 = Sunday, 1 = Monday, etc.

    if (client.reporting_frequency === 'monthly') {
      return currentDay === client.send_day;
    } else if (client.reporting_frequency === 'weekly') {
      // Convert to Monday=1, Sunday=7 format
      const weekday = currentWeekday === 0 ? 7 : currentWeekday;
      return weekday === client.send_day;
    }

    return false;
  }

  /**
   * Get the report period for a client
   */
  private getReportPeriod(client: Client): ReportPeriod | null {
    const today = new Date();
    
    if (client.reporting_frequency === 'monthly') {
      const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      
      return {
        start: this.toLocalDateKey(previousMonth),
        end: this.toLocalDateKey(lastDayOfMonth)
      };
    } else if (client.reporting_frequency === 'weekly') {
      const todayWeekday = today.getDay();
      const daysBackToMonday = todayWeekday === 0 ? 6 : todayWeekday - 1;
      const lastMonday = new Date(today);
      lastMonday.setDate(today.getDate() - daysBackToMonday - 7);
      
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      
      return {
        start: this.toLocalDateKey(lastMonday),
        end: this.toLocalDateKey(lastSunday)
      };
    }

    return null;
  }

  private toLocalDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Check if a report was already sent (or is currently being sent) for this period.
   * Considers both successful sends and fresh in-progress claims, which narrows
   * the check-then-act race between overlapping scheduler invocations.
   */
  private async isReportAlreadySent(client: Client, period: ReportPeriod): Promise<boolean> {
    const claimCutoff = new Date(Date.now() - 45 * 60 * 1000).toISOString();

    const { data, error } = await this.supabase
      .from('email_scheduler_logs')
      .select('id, email_sent, error_message, created_at')
      .eq('client_id', client.id)
      .eq('report_period_start', period.start)
      .eq('report_period_end', period.end)
      .or(`email_sent.eq.true,and(error_message.eq.${SEND_IN_PROGRESS_MARKER},created_at.gt.${claimCutoff})`)
      .limit(1);

    if (error) {
      logger.error('Error checking if report already sent:', error);
      return false;
    }

    return !!(data && data.length > 0);
  }

  /**
   * Claim a send slot for this client + period by inserting an in-progress log
   * row. The row is updated in place with the final result, so each send cycle
   * produces exactly one audit record.
   */
  private async claimSendSlot(client: Client, period: ReportPeriod, operationType: string, adminId?: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('email_scheduler_logs')
      .insert({
        client_id: client.id,
        admin_id: adminId || client.admin_id,
        operation_type: operationType,
        frequency: client.reporting_frequency,
        send_day: client.send_day,
        report_period_start: period.start,
        report_period_end: period.end,
        email_sent: false,
        error_message: SEND_IN_PROGRESS_MARKER
      })
      .select('id')
      .single();

    if (error || !data) {
      logger.error('Error claiming send slot (continuing without claim):', error);
      return null;
    }

    return data.id;
  }

  /**
   * Send professional monthly report with dynamic data fetching
   * Fetches Google Ads + Meta Ads data and uses the new Polish template
   */
  private async sendProfessionalMonthlyReport(
    client: Client,
    period: ReportPeriod,
    options?: SendOverrideOptions
  ): Promise<{ attemptedRecipients: string[]; routedRecipients: string[]; pdfSize: number; messageId?: string }> {
    logger.info(`📧 NEW TEMPLATE: Preparing professional report for ${client.name}`);
    logger.info(`📅 Period: ${period.start} to ${period.end}`);

    try {
      // Steps 1-4: Fetch Meta + Google via the standardized fetchers and compute
      // the canonical email payload. Shared with /api/send-report so scheduled
      // and manual sends can never diverge on data source or metric definitions.
      logger.info('1️⃣2️⃣3️⃣ Building report data (shared builder)...');
      const built = await buildMonthlyReportData({
        client,
        period: { start: period.start, end: period.end },
        reasonPrefix: 'scheduled-email'
      });
      const { reportData, monthName, year } = built;

      logger.info(`📅 Report for: ${monthName} ${year}`);
      logger.info('✅ Metrics calculated:', {
        totalOnlineReservations: reportData.totalOnlineReservations,
        totalOnlineValue: reportData.totalOnlineValue.toFixed(2),
        microConversions: reportData.totalMicroConversions,
        finalCostPercentage: reportData.finalCostPercentage.toFixed(2) + '%'
      });

      // Pre-send consistency guard: compare the payload we are about to send
      // against a fresh live baseline. Soft by default (logs a warning/block
      // decision); set EMAIL_PRESEND_HARD_BLOCK=true to abort sends the guard
      // rejects.
      await this.runPreSendGuard(client, { start: period.start, end: period.end }, built);

      // Step 5: Generate PDF directly. Do not depend on generated_reports table;
      // that table is optional/report-history storage, while email delivery only
      // needs a valid PDF buffer attached to the message.
      logger.info('4️⃣ Generating PDF attachment...');
      const pdfBuffer = await this.generatePdfBuffer(client.id, period);
      
      logger.info(`✅ PDF ready for email attachment: ${pdfBuffer.length} bytes`);

      // Step 6: Send ONE email to all contact emails.
      // Primary contact = To, remaining contacts = CC ("DW"). The admin preview
      // address (kontakt@piotrbajerlein.pl) is added to CC automatically by the
      // email service so every report is copied to the admin for oversight.
      const contactEmails = client.contact_emails?.length ? client.contact_emails : [client.email];
      const [primaryRecipient, ...ccRecipients] = contactEmails;
      logger.info(`5️⃣ Sending to ${contactEmails.length} contact(s): To=${primaryRecipient}${ccRecipients.length ? `, DW=${ccRecipients.join(', ')}` : ''}`);

      const emailResult = await this.emailService.sendClientMonthlyReport(
        primaryRecipient!,
        client.id,
        client.name,
        monthName,
        year,
        reportData,
        pdfBuffer,
        undefined,
        { ...options, cc: ccRecipients }
      );

      if (!emailResult.success) {
        throw new Error(emailResult.error || 'Email sending failed');
      }

      const routedRecipients = [
        emailResult.redirectedTo || primaryRecipient!,
        ...(emailResult.cc || [])
      ];
      logger.info(`✅ Email sent successfully - Message ID: ${emailResult.messageId} → ${routedRecipients.join(', ')}`);

      logger.info(`🎉 Professional report sent successfully to ${client.name}`);
      return {
        attemptedRecipients: contactEmails,
        routedRecipients,
        pdfSize: pdfBuffer.length,
        messageId: emailResult.messageId
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ Failed to send professional report:`, errorMsg);
      throw error;
    }
  }

  /**
   * Validate the outgoing payload against a fresh live baseline before sending.
   * Soft mode logs the decision; hard mode (EMAIL_PRESEND_HARD_BLOCK=true) throws
   * on a 'block' decision so the retry/failure path records it.
   */
  private async runPreSendGuard(
    client: Client,
    dateRange: ReportPeriod,
    built: Awaited<ReturnType<typeof buildMonthlyReportData>>
  ): Promise<void> {
    const hardBlock = process.env.EMAIL_PRESEND_HARD_BLOCK === 'true';
    const platforms: Array<{ platform: 'meta' | 'google'; data?: Record<string, number> }> = [
      { platform: 'meta', data: built.metaAdsData },
      { platform: 'google', data: built.googleAdsData }
    ];

    for (const { platform, data } of platforms) {
      if (!data) continue;
      try {
        const candidate = adaptCampaignSummary({
          clientId: client.id,
          clientName: client.name ?? '',
          platform,
          dateRange,
          summary: builtPlatformToSummaryShape(data, platform)
        });
        const result = await evaluatePreSend(candidate);
        logger.info(`scheduler pre-send guard (${platform})`, {
          clientId: client.id,
          decision: result.decision,
          score: result.score,
          reason: result.reason
        });
        if (hardBlock && result.decision === 'block') {
          throw new Error(
            `Pre-send guard blocked ${platform} report (score ${result.score}, ${result.reason})`
          );
        }
      } catch (err) {
        // A guard wiring/baseline failure must not silently drop a send in soft
        // mode; only rethrow when it is the intentional hard-block error.
        if (hardBlock && err instanceof Error && err.message.startsWith('Pre-send guard blocked')) {
          throw err;
        }
        logger.warn(`scheduler pre-send guard (${platform}) failed`, {
          clientId: client.id,
          error: err instanceof Error ? err.message : 'unknown'
        });
      }
    }
  }

  /**
   * Ensure a report has been generated for the period
   */
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

  /**
   * Get generated report for a client and period
   */
  private async getGeneratedReport(clientId: string, period: ReportPeriod): Promise<any | null> {
    const { data, error } = await this.supabase
      .from('generated_reports')
      .select('*')
      .eq('client_id', clientId)
      .eq('period_start', period.start)
      .eq('period_end', period.end)
      .order('generated_at', { ascending: false })
      .maybeSingle();

    if (error) {
      logger.error('Error fetching generated report:', error);
      return null;
    }

    return data;
  }

  /**
   * Update client's last sent date
   */
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

  /**
   * Record the final result of a send cycle. Updates the claim row in place
   * when one exists so each cycle produces exactly one audit record; falls
   * back to inserting a new row otherwise.
   */
  private async recordSendResult(
    claimId: string | null,
    client: Client,
    period: ReportPeriod,
    operationType: string,
    result: {
      success: boolean;
      messageId?: string;
      recipients?: string[];
      error?: string;
      retryCount?: number;
    },
    adminId?: string
  ): Promise<void> {
    const fields = {
      email_sent: result.success,
      email_sent_at: result.success ? new Date().toISOString() : null,
      error_message: result.success ? null : (result.error || 'Unknown error'),
      message_id: result.messageId || null,
      recipients: result.recipients || null,
      retry_count: result.retryCount ?? 0
    };

    const { error } = claimId
      ? await this.supabase
          .from('email_scheduler_logs')
          .update(fields)
          .eq('id', claimId)
      : await this.supabase
          .from('email_scheduler_logs')
          .insert({
            client_id: client.id,
            admin_id: adminId || client.admin_id,
            operation_type: operationType,
            frequency: client.reporting_frequency,
            send_day: client.send_day,
            report_period_start: period.start,
            report_period_end: period.end,
            ...fields
          });

    if (error) {
      // 23505 = unique violation: another run already recorded a successful
      // send for this period (should be prevented by the claim, but log it).
      if ((error as any).code === '23505') {
        logger.warn('⚠️ Duplicate send record blocked by unique index', {
          clientId: client.id,
          period
        });
      } else {
        logger.error('Error recording send result:', error);
      }
    }

    // Parity: also mirror into email_logs so the unified admin Email Logs view
    // (and the Resend webhook status updates) cover scheduled sends, not just
    // manual /api/send-report sends.
    await this.mirrorToEmailLogs(client, period, operationType, result, adminId);
  }

  /**
   * Write one email_logs row per recipient for a completed send cycle, using the
   * same column shape as the manual send path. Best-effort: never throws.
   */
  private async mirrorToEmailLogs(
    client: Client,
    period: ReportPeriod,
    operationType: string,
    result: { success: boolean; messageId?: string; recipients?: string[]; error?: string },
    adminId?: string
  ): Promise<void> {
    try {
      const startDate = new Date(period.start);
      const monthName = getPolishMonthName(startDate.getUTCMonth() + 1);
      const year = startDate.getUTCFullYear();
      const subject = `Podsumowanie miesiąca - ${monthName} ${year} | ${client.name}`;

      const recipients = result.recipients?.length
        ? result.recipients
        : (client.contact_emails?.length ? client.contact_emails : [client.email]);

      const rows = recipients.map((recipient) => ({
        client_id: client.id,
        admin_id: adminId || client.admin_id,
        email_type: operationType === 'scheduled' ? 'monthly_report' : operationType,
        recipient_email: recipient,
        subject,
        message_id: result.success ? (result.messageId || 'sent') : null,
        sent_at: new Date().toISOString(),
        status: result.success ? 'sent' : 'failed',
        error_message: result.success ? null : (result.error || null)
      }));

      const { error } = await this.supabase.from('email_logs').insert(rows);
      if (error) {
        logger.warn('Could not mirror scheduled send into email_logs', {
          clientId: client.id,
          error: error.message
        });
      }
    } catch (err) {
      logger.warn('email_logs parity write failed', {
        clientId: client.id,
        error: err instanceof Error ? err.message : 'unknown'
      });
    }
  }

  /**
   * Get system settings
   */
  private async getSystemSettings(): Promise<SystemSettings> {
    const { data, error } = await this.supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'global_default_frequency',
        'global_default_send_day',
        'email_scheduler_enabled',
        'email_scheduler_time',
        'email_retry_attempts',
        'email_retry_delay_minutes'
      ]);

    if (error) {
      logger.error('Error fetching system settings:', error);
      throw error;
    }

    const settings: SystemSettings = {
      global_default_frequency: 'monthly',
      global_default_send_day: 5,
      email_scheduler_enabled: true,
      email_scheduler_time: '09:00',
      email_retry_attempts: 3,
      email_retry_delay_minutes: 30
    };

    data?.forEach(setting => {
      let value;
      try {
        // Try to parse as JSON first
        value = JSON.parse(setting.value);
      } catch {
        // If parsing fails, use the value as-is
        value = setting.value;
      }
      
      switch (setting.key) {
        case 'global_default_frequency':
          settings.global_default_frequency = value;
          break;
        case 'global_default_send_day':
          settings.global_default_send_day = value;
          break;
        case 'email_scheduler_enabled':
          settings.email_scheduler_enabled = value;
          break;
        case 'email_scheduler_time':
          settings.email_scheduler_time = value;
          break;
        case 'email_retry_attempts':
          settings.email_retry_attempts = value;
          break;
        case 'email_retry_delay_minutes':
          settings.email_retry_delay_minutes = value;
          break;
      }
    });

    return settings;
  }

  /**
   * Get all active clients
   */
  private async getActiveClients(): Promise<Client[]> {
    const { data, error } = await this.supabase
      .from('clients')
      .select(`
        id,
        name,
        email,
        contact_emails,
        reporting_frequency,
        send_day,
        last_report_sent_at,
        next_report_scheduled_at,
        api_status,
        admin_id,
        google_ads_enabled,
        meta_access_token
      `)
      .eq('api_status', 'valid')
      .neq('reporting_frequency', 'on_demand');

    if (error) {
      logger.error('Error fetching active clients:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Manual override - send report now for a specific client
   */
  async sendManualReport(
    clientId: string,
    adminId: string,
    period?: ReportPeriod,
    options?: SendOverrideOptions
  ): Promise<{
    success: boolean;
    error?: string;
    period?: ReportPeriod;
    attemptedRecipients?: string[];
    routedRecipients?: string[];
    pdfSize?: number;
  }> {
    try {
      // Get client
      const { data: client, error: clientError } = await this.supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (clientError || !client) {
        return { success: false, error: 'Client not found' };
      }

      // Use provided period or calculate default
      const reportPeriod = period || this.getReportPeriod(client);
      if (!reportPeriod) {
        return { success: false, error: 'Could not determine report period' };
      }

      // Deduplication: block accidental double-sends for a period that was
      // already delivered, unless the admin explicitly allows a resend.
      if (!options?.allowDuplicate && await this.isReportAlreadySent(client, reportPeriod)) {
        return {
          success: false,
          error: `Report already sent for ${reportPeriod.start} - ${reportPeriod.end}. Use allowDuplicate to resend.`,
          period: reportPeriod
        };
      }

      const claimId = await this.claimSendSlot(client, reportPeriod, 'manual', adminId);

      try {
        // Send the report using NEW professional monthly template
        const sendDetails = await this.sendProfessionalMonthlyReport(client, reportPeriod, options);

        await this.updateClientLastSentDate(clientId);

        await this.recordSendResult(claimId, client, reportPeriod, 'manual', {
          success: true,
          messageId: sendDetails.messageId,
          recipients: sendDetails.routedRecipients
        }, adminId);

        return {
          success: true,
          period: reportPeriod,
          attemptedRecipients: sendDetails.attemptedRecipients,
          routedRecipients: sendDetails.routedRecipients,
          pdfSize: sendDetails.pdfSize
        };
      } catch (sendError) {
        const sendErrorMsg = sendError instanceof Error ? sendError.message : 'Unknown error';
        await this.recordSendResult(claimId, client, reportPeriod, 'manual', {
          success: false,
          error: sendErrorMsg
        }, adminId);
        return { success: false, error: sendErrorMsg, period: reportPeriod };
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMsg };
    }
  }
} 