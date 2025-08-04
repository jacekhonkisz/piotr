import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
  try {
    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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
        status: 'running'
      })
      .select()
      .single();

    if (logError) {
      throw logError;
    }

    let successfulSends = 0;
    let failedSends = 0;
    const errors: string[] = [];

    // Process each client
    for (const client of clients) {
      try {
        // Generate interactive PDF report for the client
        const interactivePdfResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/generate-pdf`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({
            clientId: client.id,
            dateRange: {
              start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
              end: new Date().toISOString().split('T')[0] // today
            }
          })
        });

        if (interactivePdfResponse.ok) {
          const pdfBuffer = await interactivePdfResponse.arrayBuffer();
          
          // Send the interactive PDF report via email
          const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-interactive-report`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({
              clientId: client.id,
              clientEmail: client.email,
              pdfBuffer: Buffer.from(pdfBuffer).toString('base64'),
              dateRange: {
                start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end: new Date().toISOString().split('T')[0]
              }
            })
          });

          if (emailResponse.ok) {
            successfulSends++;
          } else {
            failedSends++;
            errors.push(`Failed to send email to ${client.email}: ${emailResponse.statusText}`);
          }
        } else {
          failedSends++;
          errors.push(`Failed to generate interactive PDF for ${client.name}: ${interactivePdfResponse.statusText}`);
        }
      } catch (error: any) {
        failedSends++;
        errors.push(`Error processing ${client.name}: ${error.message}`);
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