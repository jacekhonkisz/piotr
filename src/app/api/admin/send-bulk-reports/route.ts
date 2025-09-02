import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import EmailService from '../../../../lib/email';

export async function POST() {
  try {
    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get first admin user for system operations
    const { data: adminUser, error: adminError } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
      .single();

    if (adminError || !adminUser) {
      console.error('No admin user found for bulk operation');
      return NextResponse.json({ 
        error: 'No admin user available for bulk operations' 
      }, { status: 500 });
    }

    // Get all active clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .eq('api_status', 'valid');

    if (clientsError) {
      throw clientsError;
    }

    if (!clients || clients.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No active clients found to send reports to' 
      });
    }

    // Create bulk email log entry
    const { data: bulkLog, error: logError } = await supabase
      .from('email_logs_bulk')
      .insert({
        operation_type: 'bulk_report_send',
        total_recipients: clients.length,
        successful_sends: 0,
        failed_sends: 0,
        status: 'running',
        admin_id: adminUser.id // Use first admin for system operations
      })
      .select()
      .single();

    if (logError) {
      throw logError;
    }

    let successfulSends = 0;
    let failedSends = 0;
    const errors: string[] = [];

    // Prepare bulk email data with rate limiting
    const emailService = EmailService.getInstance();
    const bulkEmailData: any[] = [];

    // First, prepare all email data
    for (const client of clients) {
      try {
        // Generate sample report data (in production, this would be real data)
        const sampleReportData = {
          dateRange: 'Last 30 days',
          totalSpend: 12500.50,
          totalImpressions: 250000,
          totalClicks: 5000,
          ctr: 0.02,
          cpc: 2.50,
          cpm: 50.00
        };

        const fromEmail = process.env.EMAIL_FROM_ADDRESS || 'noreply@yourdomain.com';
        const emailTemplate = emailService.generateReportEmailTemplate(client.name, sampleReportData);

        // For monitoring mode, we'll send one email per client (will be redirected to monitoring addresses)
        // In production, this would iterate through client.contact_emails || [client.email]
        const originalEmail = client.email; // Use primary email as the "original recipient"
        
        bulkEmailData.push({
          to: originalEmail, // This will be overridden to monitoring addresses in EmailService
          from: fromEmail,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          text: emailTemplate.text,
            clientId: client.id,
          clientName: client.name
        });

      } catch (error: any) {
        errors.push(`Error preparing email for ${client.name}: ${error.message}`);
      }
    }

    console.log(`📧 MONITORING MODE: Prepared ${bulkEmailData.length} emails for ${clients.length} clients`);
    console.log(`📧 All emails will be redirected to monitoring addresses (see email-config.ts)`);

    // Send bulk emails with rate limiting and progress tracking
    const bulkResult = await emailService.sendBulkEmails(
      bulkEmailData,
      (sent, total, current) => {
        if (sent % 5 === 0) { // Log every 5 emails
          console.log(`📧 Bulk email progress: ${sent}/${total} - original recipient: ${current.to} (redirected to monitoring)`);
        }
      }
    );

    successfulSends = bulkResult.successful;
    failedSends = bulkResult.failed;

    // Process results for database logging
    for (const result of bulkResult.results) {
      const emailData = bulkEmailData.find(e => e.to === result.email);
      if (emailData) {
        // Log email in database
        const { error: logError } = await supabase
          .from('email_logs')
          .insert({
            client_id: emailData.clientId,
            admin_id: null, // Bulk operation, no specific admin
            email_type: 'bulk_report',
            recipient_email: result.email,
            subject: emailData.subject,
            message_id: result.messageId || null,
            sent_at: new Date().toISOString(),
            status: result.success ? 'sent' : 'failed',
            error_message: result.error || null
          });

        if (logError) {
          console.error('Error logging email:', logError);
        }
      }

      if (!result.success && result.error) {
        errors.push(`${result.email}: ${result.error}`);
      }
    }

    // Update bulk email log
    await supabase
      .from('email_logs_bulk')
      .update({
        successful_sends: successfulSends,
        failed_sends: failedSends,
        error_details: errors.length > 0 ? { errors } : null,
        status: failedSends === 0 ? 'completed' : 'completed_with_errors',
        completed_at: new Date().toISOString()
      })
      .eq('id', bulkLog.id);

    return NextResponse.json({
      success: true,
      message: `Bulk report sending completed. Sent: ${successfulSends}, Failed: ${failedSends}`,
      data: {
        total: clients.length,
        successful: successfulSends,
        failed: failedSends,
        errors: errors.length > 0 ? errors : undefined
      }
    });

  } catch (error: any) {
    console.error('Bulk report sending error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to send bulk reports' 
    }, { status: 500 });
  }
} 