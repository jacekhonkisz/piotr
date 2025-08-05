import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import EmailService from '../../../lib/email';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Extract the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify the JWT token and get user
    const { data: { user }, error: userAuthError } = await supabase.auth.getUser(token);
    if (userAuthError || !user) {
      console.error('Token verification failed:', userAuthError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Parse request body
    const { clientId, reportId, includePdf } = await request.json();

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }

    // Get client information
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .eq('admin_id', user.id)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get report information if reportId is provided
    let reportData: any = null;
    if (reportId) {
      const { data: report, error: reportError } = await supabase
        .from('reports')
        .select('*')
        .eq('id', reportId)
        .eq('client_id', clientId)
        .single();

      if (reportError) {
        console.error('Error fetching report:', reportError);
        // Continue without report data
      } else {
        reportData = report;
      }
    }

    // Generate sample report data (in a real implementation, this would come from the actual report)
    const sampleReportData = {
      dateRange: reportData ? `${reportData.date_range_start} to ${reportData.date_range_end}` : 'Last 30 days',
      totalSpend: 12500.50,
      totalImpressions: 250000,
      totalClicks: 5000,
      ctr: 0.02, // 2%
      cpc: 2.50,
      cpm: 50.00
    };

    // Generate PDF if requested (placeholder for now)
    let pdfBuffer: Buffer | undefined;
    if (includePdf) {
      // In a real implementation, you would generate a PDF here
      // For now, we'll skip PDF generation
      console.log('PDF generation would happen here');
    }

    // Send email to all contact emails
    const emailService = EmailService.getInstance();
    const contactEmails = client.contact_emails || [client.email];
    
    let emailResults = [];
    for (const email of contactEmails) {
      try {
        const emailResult = await emailService.sendReportEmail(
          email,
          client.name,
          sampleReportData,
          pdfBuffer
        );
        emailResults.push({ email, success: emailResult.success, error: emailResult.error });
      } catch (error) {
        emailResults.push({ 
          email, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
    
    // Check if at least one email was sent successfully
    const successfulEmails = emailResults.filter(result => result.success);
    const failedEmails = emailResults.filter(result => !result.success);
    
    if (successfulEmails.length === 0) {
      return NextResponse.json({ 
        error: 'Failed to send email to any recipients',
        details: failedEmails.map(f => `${f.email}: ${f.error}`).join(', ')
      }, { status: 500 });
    }

    // Log email sending in database for all emails
    for (const result of emailResults) {
      const { error: logError } = await supabase
        .from('email_logs')
        .insert({
          client_id: clientId,
          admin_id: user.id,
          email_type: 'report',
          recipient_email: result.email,
          subject: `Your Meta Ads Report - ${sampleReportData.dateRange}`,
          message_id: result.success ? 'sent' : null,
          sent_at: new Date().toISOString(),
          status: result.success ? 'sent' : 'failed',
          error_message: result.error || null
        });

      if (logError) {
        console.error('Error logging email:', logError);
        // Don't fail the request if logging fails
      }
    }

    // Update report if it exists
    if (reportData) {
      await supabase
        .from('reports')
        .update({ email_sent: true, email_sent_at: new Date().toISOString() })
        .eq('id', reportId);
    }

    // Create sent report record (if we have report data)
    if (reportData) {
      const reportPeriod = `${new Date(reportData.date_range_start).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}`;
      
      // Create sent report record
      const { error: sentReportError } = await supabase
        .from('sent_reports')
        .insert({
          report_id: reportId,
          client_id: clientId,
          pdf_url: '', // Will be updated when PDF is actually generated
          recipient_email: client.email,
          report_period: reportPeriod,
          status: 'sent',
          meta: {
            dateRange: sampleReportData.dateRange,
            totalSpend: sampleReportData.totalSpend,
            totalImpressions: sampleReportData.totalImpressions,
            totalClicks: sampleReportData.totalClicks
          }
        });

      if (sentReportError) {
        console.error('Error creating sent report record:', sentReportError);
        // Don't fail the request if sent report creation fails
      }
    }

    return NextResponse.json({
      success: true,
      message: `Report sent successfully to ${successfulEmails.length} recipient(s)${failedEmails.length > 0 ? `, failed to send to ${failedEmails.length} recipient(s)` : ''}`,
      details: {
        successful: successfulEmails.map(e => e.email),
        failed: failedEmails.map(e => ({ email: e.email, error: e.error }))
      }
    });

  } catch (error) {
    console.error('Error in send report API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 