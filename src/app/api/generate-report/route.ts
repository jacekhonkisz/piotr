import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MetaAPIService } from '../../../lib/meta-api';

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
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('Token verification failed:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile to check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'client') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get client data
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', user.email)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Parse request body
    const { dateRange } = await request.json();
    const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = dateRange?.end || new Date().toISOString().split('T')[0];

    // Initialize Meta API service
    const metaService = new MetaAPIService(client.meta_access_token);
    
    // Validate token
    const tokenValidation = await metaService.validateToken();
    if (!tokenValidation.valid) {
      return NextResponse.json({ 
        error: 'Invalid Meta Ads token', 
        details: tokenValidation.error 
      }, { status: 400 });
    }

    // Generate report
    const startTime = Date.now();
    const report = await metaService.generateClientReport(
      client.ad_account_id.replace('act_', ''),
      startDate,
      endDate
    );
    const generationTime = Date.now() - startTime;

    // Store report in database
    const { data: reportRecord, error: reportError } = await supabase
      .from('reports')
      .insert({
        client_id: client.id,
        date_range_start: startDate,
        date_range_end: endDate,
        generated_at: new Date().toISOString(),
        generation_time_ms: generationTime,
        email_sent: false
      })
      .select()
      .single();

    if (reportError) {
      return NextResponse.json({ error: 'Failed to save report' }, { status: 500 });
    }

    // Store campaign data
    if (report.campaigns.length > 0) {
      const campaignData = report.campaigns.map(campaign => ({
        client_id: client.id,
        campaign_id: campaign.campaign_id,
        campaign_name: campaign.campaign_name,
        date_range_start: startDate,
        date_range_end: endDate,
        impressions: campaign.impressions,
        clicks: campaign.clicks,
        spend: campaign.spend,
        conversions: campaign.conversions,
        ctr: campaign.ctr,
        cpc: campaign.cpc,
        cpp: campaign.cpp,
        frequency: campaign.frequency,
        reach: campaign.reach,
        status: 'ACTIVE', // We'll need to get this from Meta API
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error: campaignError } = await supabase
        .from('campaigns')
        .insert(campaignData);

      if (campaignError) {
        console.error('Error saving campaigns:', campaignError);
      }
    }

    // Update client's last report date
    await supabase
      .from('clients')
      .update({ last_report_date: new Date().toISOString() })
      .eq('id', client.id);

    return NextResponse.json({
      success: true,
      report: {
        id: reportRecord.id,
        date_range: report.date_range,
        generated_at: report.generated_at,
        generation_time_ms: generationTime,
        account_summary: report.account_summary,
        campaign_count: report.campaigns.length
      }
    });

  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 