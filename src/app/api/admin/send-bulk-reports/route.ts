import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import FlexibleEmailService from '../../../../lib/flexible-email';

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

    // Send reports directly to each client using the NEW monthly template
    const emailService = FlexibleEmailService.getInstance();

    // Get current month for reports
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();
    const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const yearForReport = currentMonth === 1 ? currentYear - 1 : currentYear;

    // Send to each client individually
    for (const client of clients) {
      try {
        // Use contact_emails or fallback to primary email
        const contactEmails = client.contact_emails || [client.email];
        
        for (const email of contactEmails) {
          try {
            // Create dummy report data for bulk send (in production, fetch real data)
            const dummyReportData = {
              dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
              totalOnlineReservations: 0,
              totalOnlineValue: 0,
              onlineCostPercentage: 0,
              totalMicroConversions: 0,
              estimatedOfflineReservations: 0,
              estimatedOfflineValue: 0,
              finalCostPercentage: 0,
              totalValue: 0
            };

            const result = await emailService.sendClientMonthlyReport(
              email,
              client.id,
              client.name,
              getPolishMonthName(previousMonth),
              yearForReport,
              dummyReportData
            );

            if (result.success) {
              successfulSends++;
            } else {
              failedSends++;
              errors.push(`${client.name} (${email}): ${result.error || 'Unknown error'}`);
            }
          } catch (emailError: any) {
            failedSends++;
            errors.push(`${client.name} (${email}): ${emailError.message}`);
          }
        }

      } catch (error: any) {
        failedSends++;
        errors.push(`Error processing client ${client.name}: ${error.message}`);
      }
    }

    // Helper function for Polish month names
    function getPolishMonthName(month: number): string {
      const months = [
        'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
        'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'
      ];
      return months[month - 1] || 'unknown';
    }

    console.log(`📧 Bulk send completed: ${successfulSends} successful, ${failedSends} failed`);

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