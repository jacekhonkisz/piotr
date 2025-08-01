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
    const { clientId, dateRange, emailRecipient, emailSubject, emailMessage } = await request.json();

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
    console.log('🔄 Generating interactive PDF for client:', client.name);
    
    const pdfResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/generate-interactive-pdf`, {
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
    console.log('✅ PDF generated successfully, size:', pdfBuffer.byteLength, 'bytes');

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

    // Send email with interactive PDF attachment
    const emailService = EmailService.getInstance();
    const emailResult = await emailService.sendInteractiveReportEmail(
      emailRecipient || client.email,
      client.name,
      reportData,
      Buffer.from(pdfBuffer)
    );

    if (!emailResult.success) {
      return NextResponse.json({ 
        error: 'Failed to send email',
        details: emailResult.error 
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

    // Log email sending in database
    const { error: logError } = await supabase
      .from('email_logs')
      .insert({
        client_id: clientId,
        admin_id: user.id,
        email_type: 'interactive_report',
        recipient_email: emailRecipient || client.email,
        subject: emailSubject || `Your Interactive Meta Ads Report - ${reportData.dateRange}`,
        message_id: emailResult.messageId,
        sent_at: new Date().toISOString(),
        status: 'sent'
      });

    if (logError) {
      console.error('Error logging email:', logError);
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

    console.log('✅ Interactive report sent successfully to:', emailRecipient || client.email);

    return NextResponse.json({
      success: true,
      messageId: emailResult.messageId,
      message: 'Interactive report sent successfully'
    });

  } catch (error) {
    console.error('Error in send interactive report API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 