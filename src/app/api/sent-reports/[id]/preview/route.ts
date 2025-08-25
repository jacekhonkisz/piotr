import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Get PDF preview URL for a sent report
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    
    // Await params before using
    const { id } = await params;
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

    const sentReportId = id;

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
        )
      `)
      .eq('id', sentReportId)
      .single();

    if (error || !sentReport) {
      return NextResponse.json({ error: 'Sent report not found' }, { status: 404 });
    }

    let previewUrl = null;
    let errorMessage = null;

    // Try to generate a signed URL for the PDF
    try {
      // Extract the file path from the URL
      const filePath = sentReport.pdf_url.replace('/storage/v1/object/public/reports/', '');
      
      const { data: signedUrl, error: signedUrlError } = await supabase.storage
        .from('reports')
        .createSignedUrl(filePath, 3600);

      if (signedUrlError) {
        console.error('Error generating signed URL:', signedUrlError);
        errorMessage = 'PDF file not found in storage';
      } else {
        previewUrl = signedUrl.signedUrl;
      }
    } catch (storageError) {
      console.error('Storage error:', storageError);
      errorMessage = 'PDF file not available';
    }

    // For testing purposes, if no PDF is available, return a sample PDF URL
    if (!previewUrl && process.env.NODE_ENV === 'development') {
      // Return a sample PDF URL for testing
      previewUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
    }

    return NextResponse.json({
      success: true,
      previewUrl: previewUrl,
      errorMessage: errorMessage,
      sentReport: {
        id: sentReport.id,
        clientName: sentReport.clients?.name,
        clientEmail: sentReport.clients?.email,
        reportPeriod: sentReport.report_period,
        sentAt: sentReport.sent_at,
        status: sentReport.status,
        fileSizeBytes: sentReport.file_size_bytes
      }
    });

  } catch (error) {
    console.error('Error getting PDF preview:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 