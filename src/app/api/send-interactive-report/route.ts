import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import EmailService from '../../../lib/email';
import logger from '../../../lib/logger';

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
    const { clientId, dateRange, emailRecipient, emailSubject } = await request.json();

    if (!clientId || !dateRange) {
      return NextResponse.json({ error: 'Client ID and date range are required' }, { status: 400 });
    }

    // Get client information
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Generate the interactive PDF first
    logger.info('🔄 Generating interactive PDF for client:', client.name);
    
    const pdfResponse = await fetch('/api/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        clientId,
        dateRange
      })
    });

    if (!pdfResponse.ok) {
      const errorData = await pdfResponse.json();
      console.error('❌ Failed to generate PDF:', errorData);
      throw new Error(errorData.error || 'Failed to generate PDF');
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    logger.info('Success', pdfBuffer.byteLength, 'bytes');

    // Generate report data for email
    const reportData = {
      dateRange: `${dateRange.start} to ${dateRange.end}`,
      totalSpend: 12500.50, // This would come from actual report data
      totalImpressions: 250000,
      totalClicks: 5000,
      ctr: 0.02, // 2%
      cpc: 2.50,
      cpm: 50.00
    };

    // Send email with interactive PDF attachment to all contact emails
    const emailService = EmailService.getInstance();
    const contactEmails = client.contact_emails || [client.email];
    const emailRecipients = emailRecipient ? [emailRecipient] : contactEmails;
    
    let emailResults = [];
    for (const email of emailRecipients) {
      try {
        const emailResult = await emailService.sendInteractiveReportEmail(
          email,
          client.name,
          reportData,
          Buffer.from(pdfBuffer)
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

    // Create report record
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .insert({
        client_id: clientId,
        date_range_start: dateRange.start,
        date_range_end: dateRange.end,
        generated_at: new Date().toISOString(),
        email_sent: true,
        email_sent_at: new Date().toISOString()
      })
      .select()
      .single();

    if (reportError) {
      console.error('Error creating report record:', reportError);
    }

    // Log email sending in database for all emails
    for (const result of emailResults) {
      const { error: logError } = await supabase
        .from('email_logs')
        .insert({
          client_id: clientId,
          admin_id: user.id,
          email_type: 'interactive_report',
          recipient_email: result.email,
          subject: emailSubject || `Your Interactive Meta Ads Report - ${reportData.dateRange}`,
          message_id: result.success ? 'sent' : null,
          sent_at: new Date().toISOString(),
          status: result.success ? 'sent' : 'failed',
          error_message: result.error || null
        });

      if (logError) {
        console.error('Error logging email:', logError);
      }
    }

    // Create sent report record
    if (report) {
      const reportPeriod = `${new Date(dateRange.start).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}`;
      
      const { error: sentReportError } = await supabase
        .from('sent_reports')
        .insert({
          report_id: report.id,
          client_id: clientId,
          pdf_url: '', // Interactive PDF is sent directly via email
          recipient_email: emailRecipient || client.email,
          report_period: reportPeriod,
          status: 'sent',
          meta: {
            dateRange: reportData.dateRange,
            totalSpend: reportData.totalSpend,
            totalImpressions: reportData.totalImpressions,
            totalClicks: reportData.totalClicks,
            reportType: 'interactive_pdf'
          }
        });

      if (sentReportError) {
        console.error('Error creating sent report record:', sentReportError);
      }
    }

    logger.info('Success', emailRecipient || client.email);

    return NextResponse.json({
      success: true,
      message: `Interactive report sent successfully to ${successfulEmails.length} recipient(s)${failedEmails.length > 0 ? `, failed to send to ${failedEmails.length} recipient(s)` : ''}`,
      details: {
        successful: successfulEmails.map(e => e.email),
        failed: failedEmails.map(e => ({ email: e.email, error: e.error }))
      }
    });

  } catch (error) {
    console.error('Error in send interactive report API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 