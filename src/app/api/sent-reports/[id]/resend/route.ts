import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST - Resend a report to the client
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Extract the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Create a client with the JWT token
    const jwtClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );
    
    // Get user from the JWT token
    const { data: { user: jwtUser }, error: authError } = await jwtClient.auth.getUser();
    
    if (authError || !jwtUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile to check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', jwtUser.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied - admin only' }, { status: 403 });
    }

    const sentReportId = params.id;

    // Get the sent report with client information
    const { data: sentReport, error } = await supabase
      .from('sent_reports')
      .select(`
        *,
        clients (
          id,
          name,
          email,
          company
        ),
        reports (
          id,
          date_range_start,
          date_range_end
        )
      `)
      .eq('id', sentReportId)
      .single();

    if (error || !sentReport) {
      return NextResponse.json({ error: 'Sent report not found' }, { status: 404 });
    }

    // Check if the client still exists and has a valid email
    if (!sentReport.clients?.email) {
      return NextResponse.json({ error: 'Client email not found' }, { status: 404 });
    }

    // Generate a signed URL for the PDF (valid for 24 hours for email)
    const { data: signedUrl, error: signedUrlError } = await supabase.storage
      .from('reports')
      .createSignedUrl(sentReport.pdf_url.replace('/storage/v1/object/public/reports/', ''), 86400);

    if (signedUrlError) {
      console.error('Error generating signed URL:', signedUrlError);
      return NextResponse.json({ error: 'Failed to generate PDF URL for email' }, { status: 500 });
    }

    // Send the email using the existing email functionality
    const emailData = {
      to: sentReport.clients.email,
      subject: `Raport - ${sentReport.report_period} (ponownie wysłany)`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Raport ${sentReport.report_period}</h2>
          <p>Dzień dobry ${sentReport.clients.name},</p>
          <p>W załączniku znajduje się raport za okres <strong>${sentReport.report_period}</strong>.</p>
          <p>Raport został ponownie wysłany na prośbę administratora.</p>
          <p>Pozdrawiamy,<br>Zespół raportowania</p>
        </div>
      `,
      attachments: [
        {
          filename: `${sentReport.clients.name}_${sentReport.report_period}.pdf`,
          content: signedUrl.signedUrl,
          contentType: 'application/pdf'
        }
      ]
    };

    // Call the email API
    const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        reportId: sentReport.report_id,
        emailData
      })
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error('Error sending email:', errorData);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    // Update the sent report status to indicate it was resent
    const { error: updateError } = await supabase
      .from('sent_reports')
      .update({ 
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('id', sentReportId);

    if (updateError) {
      console.error('Error updating sent report status:', updateError);
      // Don't fail the request if status update fails
    }

    return NextResponse.json({
      success: true,
      message: 'Report resent successfully',
      sentReport: {
        id: sentReport.id,
        clientName: sentReport.clients?.name,
        clientEmail: sentReport.clients?.email,
        reportPeriod: sentReport.report_period,
        resentAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error resending report:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 