import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MetaAPIService } from '@/lib/meta-api-optimized';
import logger from '@/lib/logger';
import { authenticateRequest, createErrorResponse } from '@/lib/auth-middleware';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * NEW CLIENT ONBOARDING - Initial Data Collection
 * 
 * Collects initial historical data for a new client
 * Collects: Last 8 weeks (2 months) + current week
 * 
 * This is faster than full 53-week collection and provides
 * enough data for immediate reporting.
 * 
 * Usage: POST /api/admin/onboard-client
 * Body: { "clientId": "client-uuid" }
 * Auth: Admin only
 */

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // 🔒 SECURITY: Admin authentication required
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated || authResult.user?.role !== 'admin') {
      return createErrorResponse('Admin access required', 403);
    }
    
    const body = await request.json();
    const { clientId } = body;
    
    if (!clientId) {
      return NextResponse.json({
        success: false,
        error: 'Missing clientId in request body',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }
    
    logger.info(`🚀 Starting onboarding for client: ${clientId}`);
    
    // Get client data
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();
      
    if (clientError || !client) {
      return NextResponse.json({
        success: false,
        error: 'Client not found',
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }
    
    logger.info(`📊 Onboarding client: ${client.name}`);
    
    // Collect last 8 weeks + current week (9 weeks total)
    const weeksToCollect = 9;
    const results = [];
    let successCount = 0;
    
    const metaService = new MetaAPIService(client.meta_access_token);
    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;
    
    const now = new Date();
    
    for (let i = weeksToCollect - 1; i >= 0; i--) {
      try {
        // Calculate week start (Monday)
        const weekDate = new Date(now);
        weekDate.setDate(weekDate.getDate() - (i * 7));
        
        // Get Monday of that week
        const dayOfWeek = weekDate.getDay();
        const diff = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek; // Adjust to Monday
        weekDate.setDate(weekDate.getDate() + diff);
        
        const weekStart = weekDate.toISOString().split('T')[0];
        
        // Calculate week end (Sunday)
        const weekEndDate = new Date(weekDate);
        weekEndDate.setDate(weekEndDate.getDate() + 6);
        const weekEnd = weekEndDate.toISOString().split('T')[0];
        
        logger.info(`📅 Collecting week ${weekStart} to ${weekEnd}`);
        
        // Fetch data from Meta API
        const campaigns = await metaService.getCampaignInsights(
          adAccountId,
          weekStart,
          weekEnd,
          0
        );
        
        // Calculate totals
        const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
        const totalImpressions = campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
        const totalClicks = campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
        const totalConversions = campaigns.reduce((sum, c) => sum + (c.conversions || 0), 0);
        
        // Store in database
        const { error: insertError } = await supabaseAdmin
          .from('campaign_summaries')
          .upsert({
            client_id: clientId,
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
          logger.error(`Failed to store week ${weekStart}:`, insertError);
          results.push({
            week: weekStart,
            status: 'error',
            error: insertError.message
          });
        } else {
          successCount++;
          results.push({
            week: weekStart,
            status: 'success',
            campaigns: campaigns.length,
            spend: totalSpend
          });
          logger.info(`✅ Stored week ${weekStart} (${campaigns.length} campaigns, ${totalSpend.toFixed(2)} PLN)`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (weekError) {
        logger.error(`Failed to collect week:`, weekError);
        results.push({
          week: 'unknown',
          status: 'error',
          error: weekError instanceof Error ? weekError.message : 'Unknown error'
        });
      }
    }
    
    const responseTime = Date.now() - startTime;
    
    logger.info(`✅ Client onboarding completed in ${(responseTime / 1000).toFixed(2)}s`);
    logger.info(`📊 Successfully collected ${successCount} out of ${weeksToCollect} weeks`);
    
    return NextResponse.json({
      success: true,
      message: `Client ${client.name} onboarding completed`,
      summary: {
        clientId,
        clientName: client.name,
        weeksRequested: weeksToCollect,
        weeksCollected: successCount,
        responseTimeMs: responseTime
      },
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('❌ Client onboarding failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Client onboarding failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      responseTimeMs: responseTime,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

