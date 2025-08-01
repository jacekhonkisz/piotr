import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Retrieve sent reports (only reports that have been sent to clients)
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const groupBy = searchParams.get('groupBy') || 'date'; // 'date' or 'client'
    const dateFilter = searchParams.get('dateFilter'); // Optional date filter

    // Build the query for sent reports (only reports that have been sent)
    let query = supabase
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
      .gte('sent_at', new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 12 months only
      .order('sent_at', { ascending: false });

    // Apply client filter if specified
    if (clientId && clientId !== 'all') {
      query = query.eq('client_id', clientId);
    }

    // Apply date filter if specified
    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      const nextDay = new Date(filterDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      query = query
        .gte('sent_at', filterDate.toISOString())
        .lt('sent_at', nextDay.toISOString());
    }

    const { data: sentReports, error } = await query;

    if (error) {
      console.error('Error fetching sent reports:', error);
      return NextResponse.json({ error: 'Failed to fetch sent reports' }, { status: 500 });
    }

    // Group the reports based on the groupBy parameter
    let groupedReports;
    if (groupBy === 'date') {
      groupedReports = groupReportsByDate(sentReports || []);
    } else if (groupBy === 'client') {
      groupedReports = groupReportsByClient(sentReports || []);
    } else {
      groupedReports = { all: sentReports || [] };
    }

    return NextResponse.json({
      success: true,
      sentReports: sentReports || [],
      groupedReports,
      totalCount: sentReports?.length || 0
    });

  } catch (error) {
    console.error('Error fetching sent reports:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST - Create a new sent report record (when a report is actually sent)
export async function POST(request: NextRequest) {
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

    const { 
      reportId, 
      clientId, 
      pdfUrl, 
      recipientEmail, 
      reportPeriod, 
      fileSizeBytes,
      meta 
    } = await request.json();

    // Validate required fields
    if (!reportId || !clientId || !pdfUrl || !recipientEmail || !reportPeriod) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create the sent report record
    const { data: sentReport, error } = await supabase
      .from('sent_reports')
      .insert({
        report_id: reportId,
        client_id: clientId,
        pdf_url: pdfUrl,
        recipient_email: recipientEmail,
        report_period: reportPeriod,
        file_size_bytes: fileSizeBytes,
        meta: meta || {},
        status: 'sent'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating sent report:', error);
      return NextResponse.json({ error: 'Failed to create sent report record' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      sentReport
    });

  } catch (error) {
    console.error('Error creating sent report:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper function to group reports by date
function groupReportsByDate(reports: any[]) {
  const grouped: { [key: string]: any[] } = {};
  
  reports.forEach(report => {
    const sentDate = new Date(report.sent_at);
    const dateKey = sentDate.toLocaleDateString('pl-PL', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(report);
  });
  
  return grouped;
}

// Helper function to group reports by client
function groupReportsByClient(reports: any[]) {
  const grouped: { [key: string]: any[] } = {};
  
  reports.forEach(report => {
    const clientName = report.clients?.name || 'Unknown Client';
    
    if (!grouped[clientName]) {
      grouped[clientName] = [];
    }
    grouped[clientName].push(report);
  });
  
  return grouped;
} 