import { createClient } from '@supabase/supabase-js';
import EmailService from './email';
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

interface SystemSettings {
  global_default_frequency: string;
  global_default_send_day: number;
  email_scheduler_enabled: boolean;
  email_scheduler_time: string;
  email_retry_attempts: number;
  email_retry_delay_minutes: number;
}

export class EmailScheduler {
  private supabase;
  private emailService: EmailService;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.emailService = EmailService.getInstance();
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

    // Send the report
    try {
      await this.sendScheduledReport(client, period);
      
      // Update client's last sent date
      await this.updateClientLastSentDate(client.id);
      
      logger.info(`✅ Successfully sent report to ${client.name} for ${period.start} to ${period.end}`);
      
      return {
        clientId: client.id,
        clientName: client.name,
        success: true,
        period
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ Failed to send report to ${client.name}:`, errorMsg);
      
      // Log the error
      await this.logSchedulerError(client, period, errorMsg);
      
      return {
        clientId: client.id,
        clientName: client.name,
        success: false,
        error: errorMsg,
        period
      };
    }
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

  /**
   * Check if a report was already sent for this period
   */
  private async isReportAlreadySent(client: Client, period: ReportPeriod): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('email_scheduler_logs')
      .select('id')
      .eq('client_id', client.id)
      .eq('report_period_start', period.start)
      .eq('report_period_end', period.end)
      .eq('email_sent', true)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      logger.error('Error checking if report already sent:', error);
      return false;
    }

    return !!data;
  }

  /**
   * Send a scheduled report to a client
   */
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
   * Log successful email sending
   */
  private async logSchedulerSuccess(client: Client, period: ReportPeriod): Promise<void> {
    const { error } = await this.supabase
      .from('email_scheduler_logs')
      .insert({
        client_id: client.id,
        admin_id: client.admin_id,
        operation_type: 'scheduled',
        frequency: client.reporting_frequency,
        send_day: client.send_day,
        report_period_start: period.start,
        report_period_end: period.end,
        email_sent: true,
        email_sent_at: new Date().toISOString()
      });

    if (error) {
      logger.error('Error logging scheduler success:', error);
    }
  }

  /**
   * Log scheduler error
   */
  private async logSchedulerError(client: Client, period: ReportPeriod, errorMessage: string): Promise<void> {
    const { error } = await this.supabase
      .from('email_scheduler_logs')
      .insert({
        client_id: client.id,
        admin_id: client.admin_id,
        operation_type: 'scheduled',
        frequency: client.reporting_frequency,
        send_day: client.send_day,
        report_period_start: period.start,
        report_period_end: period.end,
        email_sent: false,
        error_message: errorMessage
      });

    if (error) {
      logger.error('Error logging scheduler error:', error);
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
        admin_id
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
  async sendManualReport(clientId: string, adminId: string, period?: ReportPeriod): Promise<{
    success: boolean;
    error?: string;
    period?: ReportPeriod;
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

      // Send the report
      await this.sendScheduledReport(client, reportPeriod);

      // Log manual send
      await this.supabase
        .from('email_scheduler_logs')
        .insert({
          client_id: clientId,
          admin_id: adminId,
          operation_type: 'manual',
          frequency: client.reporting_frequency,
          send_day: client.send_day,
          report_period_start: reportPeriod.start,
          report_period_end: reportPeriod.end,
          email_sent: true,
          email_sent_at: new Date().toISOString()
        });

      return { success: true, period: reportPeriod };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMsg };
    }
  }
} 