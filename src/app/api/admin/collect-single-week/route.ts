import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MetaAPIService } from '@/lib/meta-api-optimized';
import logger from '@/lib/logger';
import { verifyCronAuth, createUnauthorizedResponse } from '@/lib/cron-auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * DIRECT SINGLE WEEK COLLECTION
 * 
 * Collects a specific week for a specific client
 * No status checks - just collects the data
 * 
 * Usage:
 * POST /api/admin/collect-single-week
 * Body: { clientId: "...", weekStart: "2025-11-10" }
 */

export async function POST(request: NextRequest) {
  // 🔒 SECURITY: Verify cron authentication
  if (!verifyCronAuth(request)) {
    return createUnauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { clientId, weekStart } = body;
    
    if (!clientId || !weekStart) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: clientId, weekStart'
      }, { status: 400 });
    }
    
    // Get client (no status check!)
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();
      
    if (clientError || !client) {
      return NextResponse.json({
        success: false,
        error: 'Client not found',
        clientId
      }, { status: 404 });
    }
    
    logger.info(`📅 Collecting week ${weekStart} for ${client.name}`);
    
    // Calculate week end
    const startDate = new Date(weekStart);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    const weekEnd = endDate.toISOString().split('T')[0];
    
    logger.info(`📅 Date range: ${weekStart} to ${weekEnd}`);
    
    // Fetch data from Meta API
    const metaService = new MetaAPIService(client.meta_access_token);
    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;
    
    const campaigns = await metaService.getCampaignInsights(
      adAccountId,
      weekStart,
      weekEnd,
      0 // No time increment - single week
    );
    
    logger.info(`📊 Fetched ${campaigns.length} campaigns from Meta API`);
    
    // Calculate totals
    const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
    const totalImpressions = campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
    const totalClicks = campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
    const totalConversions = campaigns.reduce((sum, c) => sum + (c.conversions || 0), 0);
    
    logger.info(`💰 Totals: ${totalSpend.toFixed(2)} PLN, ${campaigns.length} campaigns`);
    
    // Store in database
    const { error: insertError } = await supabaseAdmin
      .from('campaign_summaries')
      .upsert({
        client_id: client.id,
        summary_type: 'weekly',
        summary_date: weekStart,
        platform: 'meta',
        campaign_data: campaigns,
        total_spend: totalSpend,
        total_impressions: totalImpressions,
        total_clicks: totalClicks,
        total_conversions: totalConversions,
        average_ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
        average_cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
        // Conversion metrics
        click_to_call: campaigns.reduce((sum, c) => sum + (c.click_to_call || 0), 0),
        email_contacts: campaigns.reduce((sum, c) => sum + (c.email_contacts || 0), 0),
        booking_step_1: campaigns.reduce((sum, c) => sum + (c.booking_step_1 || 0), 0),
        booking_step_2: campaigns.reduce((sum, c) => sum + (c.booking_step_2 || 0), 0),
        booking_step_3: campaigns.reduce((sum, c) => sum + (c.booking_step_3 || 0), 0),
        reservations: campaigns.reduce((sum, c) => sum + (c.reservations || 0), 0),
        reservation_value: campaigns.reduce((sum, c) => sum + (c.reservation_value || 0), 0),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'client_id,summary_type,summary_date,platform'
      });
      
    if (insertError) {
      logger.error('❌ Failed to store data:', insertError);
      return NextResponse.json({
        success: false,
        error: 'Failed to store data in database',
        details: insertError.message
      }, { status: 500 });
    }
    
    logger.info(`✅ Successfully stored week ${weekStart} for ${client.name}`);
    
    return NextResponse.json({
      success: true,
      message: 'Week collected successfully',
      data: {
        clientName: client.name,
        weekStart,
        weekEnd,
        campaignsCount: campaigns.length,
        totalSpend,
        totalImpressions,
        totalClicks,
        totalConversions
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('❌ Collection failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Collection failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

