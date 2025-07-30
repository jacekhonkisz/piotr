import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Retrieve reports for a client or all clients (admin)
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

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    let reports;
    
    if (profile?.role === 'admin') {
      // Admin can get all reports or filter by clientId
      if (clientId) {
        // Get reports for specific client
        const { data, error } = await supabase
          .from('reports')
          .select(`
            *,
            clients (
              id,
              name,
              email,
              company
            )
          `)
          .eq('client_id', clientId)
          .order('generated_at', { ascending: false });
          
        if (error) throw error;
        reports = data;
      } else {
        // Get all reports
        const { data, error } = await supabase
          .from('reports')
          .select(`
            *,
            clients (
              id,
              name,
              email,
              company
            )
          `)
          .order('generated_at', { ascending: false });
          
        if (error) throw error;
        reports = data;
      }
    } else if (profile?.role === 'client') {
      // Client can only get their own reports
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('email', jwtUser.email)
        .single();
        
      if (!client) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      }
      
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          clients (
            id,
            name,
            email,
            company
          )
        `)
        .eq('client_id', client.id)
        .order('generated_at', { ascending: false });
        
      if (error) throw error;
      reports = data;
    } else {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      reports: reports || []
    });

  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST - Create a new report
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

    const { clientId, dateRangeStart, dateRangeEnd, reportData } = await request.json();

    let targetClientId;
    
    if (profile?.role === 'admin') {
      // Admin can create reports for any client
      if (!clientId) {
        return NextResponse.json({ error: 'Client ID required for admin' }, { status: 400 });
      }
      targetClientId = clientId;
    } else if (profile?.role === 'client') {
      // Client can only create reports for themselves
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('email', jwtUser.email)
        .single();
        
      if (!client) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      }
      targetClientId = client.id;
    } else {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Create the report
    const { data: report, error } = await supabase
      .from('reports')
      .insert({
        client_id: targetClientId,
        date_range_start: dateRangeStart,
        date_range_end: dateRangeEnd,
        generated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating report:', error);
      return NextResponse.json({ error: 'Failed to create report' }, { status: 500 });
    }

    // If report data is provided, store campaign data
    if (reportData && reportData.campaigns) {
      const campaignInserts = reportData.campaigns.map((campaign: any) => ({
        client_id: targetClientId,
        report_id: report.id,
        campaign_id: campaign.campaign_id,
        campaign_name: campaign.campaign_name,
        status: campaign.status || 'ACTIVE',
        date_range_start: dateRangeStart,
        date_range_end: dateRangeEnd,
        impressions: campaign.impressions || 0,
        clicks: campaign.clicks || 0,
        spend: campaign.spend || 0,
        conversions: campaign.conversions || 0,
        ctr: campaign.ctr || 0,
        cpc: campaign.cpc || 0,
        cpp: campaign.cpp,
        frequency: campaign.frequency,
        reach: campaign.reach
      }));

      const { error: campaignError } = await supabase
        .from('campaigns')
        .insert(campaignInserts);

      if (campaignError) {
        console.error('Error storing campaign data:', campaignError);
        // Don't fail the whole request if campaign storage fails
      }
    }

    return NextResponse.json({
      success: true,
      report: report
    });

  } catch (error) {
    console.error('Error creating report:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 