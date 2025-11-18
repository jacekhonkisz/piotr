import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MetaAPIService } from '@/lib/meta-api-optimized';
import logger from '@/lib/logger';
import { verifyCronAuth, createUnauthorizedResponse } from '@/lib/cron-auth';
import { parseMetaActions } from '@/lib/meta-actions-parser';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * OPTIMIZED INCREMENTAL WEEKLY COLLECTION
 * 
 * Collects ONLY MISSING weeks for all clients (fast & efficient)
 * Should complete in < 2 minutes (under Vercel timeout)
 * 
 * Strategy:
 * 1. Query database for existing weeks
 * 2. Find gaps (missing weeks)
 * 3. Collect only missing weeks (typically 1-2 weeks per client)
 * 4. Much faster than collecting all 53 weeks
 * 
 * Schedule: Every Sunday at 2 AM (replaces old weekly collection)
 * Security: Protected with CRON_SECRET / x-vercel-cron header
 */

export async function GET(request: NextRequest) {
  // 🔒 SECURITY: Verify cron authentication
  if (!verifyCronAuth(request)) {
    return createUnauthorizedResponse();
  }
  
  return await POST(request);
}

export async function POST(request: NextRequest) {
  // 🔒 SECURITY: Verify cron authentication
  if (!verifyCronAuth(request)) {
    return createUnauthorizedResponse();
  }

  const startTime = Date.now();
  
  try {
    logger.info('🚀 Starting INCREMENTAL weekly collection for all clients...');
    
    // Get all clients (status check removed - all clients are active by default)
    // If status column exists and is set, we prefer 'active' clients, but don't require it
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('clients')
      .select('*')
      .or('status.eq.active,status.is.null');
      
    if (clientsError) {
      logger.error('Error fetching clients:', clientsError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch clients',
        details: clientsError.message,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
    
    if (!clients || clients.length === 0) {
      logger.warn('No clients found');
      return NextResponse.json({
        success: true,
        message: 'No clients to process',
        clientsCount: 0,
        timestamp: new Date().toISOString()
      });
    }
    
    logger.info(`📊 Found ${clients.length} active clients`);
    
    const results = [];
    let totalWeeksCollected = 0;
    
    for (const client of clients) {
      try {
        logger.info(`📅 Processing client: ${client.name}`);
        
        // Find missing weeks for this client
        const missingWeeks = await findMissingWeeks(client.id, 'meta');
        
        logger.info(`🔍 Found ${missingWeeks.length} missing weeks for ${client.name}`);
        
        if (missingWeeks.length === 0) {
          results.push({
            clientId: client.id,
            clientName: client.name,
            weeksCollected: 0,
            status: 'up-to-date'
          });
          continue;
        }
        
        // Collect only missing weeks (much faster!)
        const collected = await collectMissingWeeks(client, missingWeeks, 'meta');
        
        totalWeeksCollected += collected;
        
        results.push({
          clientId: client.id,
          clientName: client.name,
          weeksCollected: collected,
          status: 'success'
        });
        
        logger.info(`✅ Collected ${collected} weeks for ${client.name}`);
        
      } catch (clientError) {
        logger.error(`❌ Failed to process client ${client.name}:`, clientError);
        results.push({
          clientId: client.id,
          clientName: client.name,
          weeksCollected: 0,
          status: 'error',
          error: clientError instanceof Error ? clientError.message : 'Unknown error'
        });
      }
    }
    
    const responseTime = Date.now() - startTime;
    
    logger.info(`✅ Incremental weekly collection completed in ${(responseTime / 1000).toFixed(2)}s`);
    logger.info(`📊 Total weeks collected: ${totalWeeksCollected}`);
    
    return NextResponse.json({
      success: true,
      message: 'Incremental weekly collection completed',
      summary: {
        clientsProcessed: clients.length,
        totalWeeksCollected,
        responseTimeMs: responseTime,
        averageTimePerClient: Math.round(responseTime / clients.length)
      },
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('❌ Incremental weekly collection failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Incremental weekly collection failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      responseTimeMs: responseTime,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Find missing weeks for a client (past 12 weeks only)
 */
async function findMissingWeeks(clientId: string, platform: string): Promise<string[]> {
  const missingWeeks: string[] = [];
  const now = new Date();
  
  // Check only last 12 weeks (recent data)
  // Older data is less important and can be collected on-demand
  for (let i = 1; i <= 12; i++) {
    const weekDate = new Date(now);
    weekDate.setDate(weekDate.getDate() - (i * 7));
    
    // Calculate ISO week
    const year = weekDate.getFullYear();
    const jan4 = new Date(year, 0, 4);
    const startOfYear = new Date(jan4);
    startOfYear.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
    
    const weeksDiff = Math.floor((weekDate.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const weekNumber = weeksDiff + 1;
    
    // Get week start date (Monday)
    const weekStartDate = new Date(startOfYear);
    weekStartDate.setDate(startOfYear.getDate() + (weekNumber - 1) * 7);
    const weekStart = weekStartDate.toISOString().split('T')[0];
    
    // Check if this week exists in database AND has valid data
    const { data: existing, error } = await supabaseAdmin
      .from('campaign_summaries')
      .select('summary_date, campaign_data')
      .eq('client_id', clientId)
      .eq('summary_type', 'weekly')
      .eq('platform', platform)
      .gte('summary_date', weekStart)
      .lte('summary_date', new Date(weekStartDate.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .limit(1);
      
    if (error) {
      logger.warn(`Warning checking week ${weekStart}:`, error);
      continue;
    }
    
    // ✅ CRITICAL FIX: Collect if week is missing OR has empty campaign_data
    const needsCollection = !existing || 
                           existing.length === 0 || 
                           !existing[0].campaign_data || 
                           existing[0].campaign_data.length === 0;
    
    if (needsCollection) {
      if (existing && existing.length > 0 && existing[0].campaign_data?.length === 0) {
        logger.info(`🔄 Week ${weekStart} exists but has empty campaign_data - will re-collect`);
      }
      missingWeeks.push(weekStart);
    }
  }
  
  return missingWeeks;
}

/**
 * Collect data for missing weeks only
 */
async function collectMissingWeeks(
  client: any,
  missingWeeks: string[],
  platform: string
): Promise<number> {
  let collected = 0;
  
  const metaService = new MetaAPIService(client.meta_access_token);
  const adAccountId = client.ad_account_id.startsWith('act_') 
    ? client.ad_account_id.substring(4)
    : client.ad_account_id;
  
  for (const weekStart of missingWeeks) {
    try {
      // Calculate week end (6 days after start)
      const startDate = new Date(weekStart);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      const weekEnd = endDate.toISOString().split('T')[0];
      
      logger.info(`📅 Collecting week ${weekStart} to ${weekEnd} for ${client.name}`);
      
      // Fetch data from Meta API
      const rawInsights = await metaService.getCampaignInsights(
        adAccountId,
        weekStart,
        weekEnd,
        0 // No time increment
      );
      
      // ✅ CRITICAL: Parse Meta API actions array to extract conversion metrics
      const campaigns = rawInsights.map(insight => {
        const parsed = parseMetaActions(
          insight.actions || [],
          insight.action_values || [],
          insight.campaign_name
        );
        
        const spend = parseFloat(insight.spend) || 0;
        const reservations = parsed.reservations || 0;
        const reservationValue = parsed.reservation_value || 0;
        
        return {
          campaign_id: insight.campaign_id,
          campaign_name: insight.campaign_name,
          status: 'ACTIVE',
          
          // Core metrics from Meta API
          spend,
          impressions: parseInt(insight.impressions) || 0,
          clicks: parseInt(insight.clicks) || 0,
          conversions: parseInt(insight.conversions) || 0,
          ctr: parseFloat(insight.ctr) || 0,
          cpc: parseFloat(insight.cpc) || 0,
          cpm: parseFloat(insight.cpm) || 0,
          cpp: parseFloat(insight.cpp) || 0,
          frequency: parseFloat(insight.frequency) || 0,
          reach: parseInt(insight.reach) || 0,
          
          // ✅ Parsed conversion funnel metrics
          click_to_call: parsed.click_to_call || 0,
          email_contacts: parsed.email_contacts || 0,
          booking_step_1: parsed.booking_step_1 || 0,
          booking_step_2: parsed.booking_step_2 || 0,
          booking_step_3: parsed.booking_step_3 || 0,
          reservations,
          reservation_value: reservationValue,
          
          // Calculated metrics
          roas: spend > 0 && reservationValue > 0 ? reservationValue / spend : 0,
          cost_per_reservation: reservations > 0 && spend > 0 ? spend / reservations : 0
        };
      });
      
      // Calculate totals from parsed campaigns
      const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
      const totalImpressions = campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
      const totalClicks = campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
      const totalConversions = campaigns.reduce((sum, c) => sum + (c.conversions || 0), 0);
      
      // Calculate aggregated conversion metrics
      const totalClickToCall = campaigns.reduce((sum, c) => sum + (c.click_to_call || 0), 0);
      const totalEmailContacts = campaigns.reduce((sum, c) => sum + (c.email_contacts || 0), 0);
      const totalBookingStep1 = campaigns.reduce((sum, c) => sum + (c.booking_step_1 || 0), 0);
      const totalBookingStep2 = campaigns.reduce((sum, c) => sum + (c.booking_step_2 || 0), 0);
      const totalBookingStep3 = campaigns.reduce((sum, c) => sum + (c.booking_step_3 || 0), 0);
      const totalReservations = campaigns.reduce((sum, c) => sum + (c.reservations || 0), 0);
      const totalReservationValue = campaigns.reduce((sum, c) => sum + (c.reservation_value || 0), 0);
      
      // Calculate aggregated ROAS and cost per reservation
      const totalROAS = totalSpend > 0 && totalReservationValue > 0 
        ? totalReservationValue / totalSpend 
        : 0;
      const totalCostPerReservation = totalReservations > 0 && totalSpend > 0 
        ? totalSpend / totalReservations 
        : 0;
      
      // Store in database
      const { error: insertError } = await supabaseAdmin
        .from('campaign_summaries')
        .upsert({
          client_id: client.id,
          summary_type: 'weekly',
          summary_date: weekStart,
          platform,
          campaign_data: campaigns,
          total_spend: totalSpend,
          total_impressions: totalImpressions,
          total_clicks: totalClicks,
          total_conversions: totalConversions,
          average_ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
          average_cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
          
          // ✅ COMPLETE conversion funnel metrics
          click_to_call: totalClickToCall,
          email_contacts: totalEmailContacts,
          booking_step_1: totalBookingStep1,
          booking_step_2: totalBookingStep2,
          booking_step_3: totalBookingStep3,
          reservations: totalReservations,
          reservation_value: totalReservationValue,
          
          // ✅ Calculated conversion metrics
          roas: totalROAS,
          cost_per_reservation: totalCostPerReservation,
          
          created_at: new Date().toISOString()
        }, {
          onConflict: 'client_id,summary_type,summary_date,platform'
        });
        
      if (insertError) {
        logger.error(`Failed to store week ${weekStart}:`, insertError);
      } else {
        collected++;
        logger.info(`✅ Stored week ${weekStart} (${campaigns.length} campaigns, ${totalSpend.toFixed(2)} PLN)`);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (weekError) {
      logger.error(`Failed to collect week ${weekStart}:`, weekError);
    }
  }
  
  return collected;
}

